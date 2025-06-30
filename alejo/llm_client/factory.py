"""
LLM Client Factory
Manages creation and configuration of different LLM clients

The factory prioritizes local inference by default, using Llama-3-13B quantized model
via llama-cpp-python. External providers are only used if explicitly requested and
ALEJO_LOCAL_INFERENCE is not set to enforce local-only operation.
"""

from typing import Dict, Any, Optional, Type
import os
import pathlib
import logging
from .base import BaseLLMClient, LLMConfig
from .ollama_client import OllamaClient, OllamaConfig
from .openai_client import OpenAIClient, OpenAIConfig
from .local_client import LocalLLMClient, LocalConfig
from .vlm_client import VLMClient, VLMConfig
from .local_provider import LocalLLMProvider

logger = logging.getLogger(__name__)

class LLMClientFactory:
    """Factory for creating and managing LLM clients"""
    
    # Registry of available client implementations
    _clients: Dict[str, Type[BaseLLMClient]] = {
        "local": LocalLLMClient,
        "ollama": OllamaClient,
        "openai": OpenAIClient,
        "vlm": VLMClient,
    }
    
    # Provider instances (singletons)
    _providers = {
        "local_provider": None
    }
    
    # Registry of config classes for each client
    _config_classes: Dict[str, Type[LLMConfig]] = {
        "local": LocalConfig,
        "ollama": OllamaConfig,
        "openai": OpenAIConfig,
        "vlm": VLMConfig,
    }
    
    # Default configuration for each provider
    _default_configs: Dict[str, Dict[str, Any]] = {
        "local": {
            "model_name": "llama-3-13b-q4_k_m",
            "model_path": str((pathlib.Path.home()/'.alejo'/'models'/'llama-3-13b-q4_k_m.gguf').resolve()),
            "max_tokens": 2048,
            "temperature": 0.7,
            "top_p": 1.0,
            "retry_attempts": 3,
            "timeout": 30.0,
            "n_ctx": 4096,
            "n_gpu_layers": 35,  # Will be auto-adjusted based on hardware
            "model_tier": "standard",
        },
        "ollama": {
            "model_name": "llama-3-13b-q4_k_m.gguf",
            "base_url": "http://localhost:11434",
            "max_tokens": 2048,
            "temperature": 0.7,
            "top_p": 1.0,
            "retry_attempts": 3,
            "timeout": 30.0
        },
        "openai": {
            "model_name": "gpt-3.5-turbo",
            "max_tokens": 2048,
            "temperature": 0.7,
            "top_p": 1.0,
            "retry_attempts": 3,
            "timeout": 30.0,
            "presence_penalty": 0.0,
            "frequency_penalty": 0.0
        },
        "vlm": {
            "model_name": "llava-v1.6-mistral-7b-q4_k_m",
            "model_path": str((pathlib.Path.home()/'.alejo'/'models'/'llava-v1.6-mistral-7b-q4_k_m.gguf').resolve()),
            "max_tokens": 2048,
            "temperature": 0.7,
            "top_p": 1.0,
            "retry_attempts": 3,
            "timeout": 60.0,  # VLM processing may take longer
            "n_ctx": 4096,
            "n_gpu_layers": 35,  # Will be auto-adjusted based on hardware
            "model_tier": "vlm_standard",
            "image_processor": "clip"
        }
    }
    
    @classmethod
    def register_client(
        cls,
        provider: str,
        client_class: Type[BaseLLMClient],
        config_class: Type[LLMConfig],
        default_config: Dict[str, Any]
    ):
        """Register a new LLM client implementation"""
        cls._clients[provider] = client_class
        cls._config_classes[provider] = config_class
        cls._default_configs[provider] = default_config
        logger.info(f"Registered new LLM client: {provider}")
    
    @classmethod
    def get_local_provider(cls) -> LocalLLMProvider:
        """Get or create the local LLM provider instance"""
        if cls._providers["local_provider"] is None:
            cls._providers["local_provider"] = LocalLLMProvider()
            logger.info("Initialized LocalLLMProvider")
        return cls._providers["local_provider"]
    
    @classmethod
    def create_client(
        cls,
        provider: str = "local",
        config_override: Optional[Dict[str, Any]] = None,
        force_local: bool = False
    ) -> BaseLLMClient:
        """Create a new LLM client instance
        
        Args:
            provider: The LLM provider to use (e.g., "ollama")
            config_override: Optional configuration to override defaults
            force_local: If True, force local inference regardless of provider
            
        Returns:
            An initialized LLM client
            
        Raises:
            ValueError: If the provider is not supported
        """
        # Enforce local inference in these cases:
        # 1. When ALEJO_LOCAL_INFERENCE is set to 1 (default in production)
        # 2. When force_local flag is True
        # 3. When provider is "openai" but ALEJO_ALLOW_EXTERNAL_API is not set to 1
        
        # Check environment variables for enforced local inference
        local_inference_enforced = os.environ.get("ALEJO_LOCAL_INFERENCE", "1") == "1"
        external_api_allowed = os.environ.get("ALEJO_ALLOW_EXTERNAL_API", "0") == "1"
        
        # Force local provider if required
        original_provider = provider
        if local_inference_enforced or force_local:
            provider = "local"
            if original_provider != "local":
                logger.info(f"Switching from {original_provider} to local LLM provider due to local inference policy")
        
        # Specific check for OpenAI to ensure no accidental external API usage
        if provider == "openai" and not external_api_allowed:
            logger.warning("OpenAI provider requested but ALEJO_ALLOW_EXTERNAL_API not set. Defaulting to local provider.")
            provider = "local"
            
        if provider not in cls._clients:
            logger.warning(f"Unsupported LLM provider: {provider}. Defaulting to local provider.")
            provider = "local"
        
        # Get the client class and its config class
        client_class = cls._clients[provider]
        config_class = cls._config_classes[provider]
        
        # Start with default config
        config_dict = cls._default_configs[provider].copy()
        
        # Override with user-provided config
        if config_override:
            config_dict.update(config_override)
        
        # Create config instance
        config = config_class(**config_dict)
        
        # Create and return client instance
        client = client_class(config)
        logger.info(
            f"Created {provider} client with model {config.model_name}"
        )
        return client
    
    @classmethod
    def get_available_providers(cls) -> Dict[str, Dict[str, Any]]:
        """Get information about available LLM providers"""
        return {
            provider: {
                "config_class": cls._config_classes[provider].__name__,
                "default_config": cls._default_configs[provider]
            }
            for provider in cls._clients
        }
    
    @classmethod
    def get_provider_info(cls, provider: str) -> Dict[str, Any]:
        """Get detailed information about a specific provider"""
        if provider not in cls._clients:
            raise ValueError(f"Unknown provider: {provider}")
            
        return {
            "client_class": cls._clients[provider].__name__,
            "config_class": cls._config_classes[provider].__name__,
            "default_config": cls._default_configs[provider],
            "capabilities": [
                cap.value for cap in 
                cls._default_configs[provider].get("capabilities", [])
            ]
        }
