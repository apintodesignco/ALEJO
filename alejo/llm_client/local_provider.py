"""
LocalLLMProvider for ALEJO

This module provides a unified interface for managing and accessing local LLM models.
It handles model selection, loading, and inference while providing a consistent API
for the rest of the ALEJO platform to use.

Features:
- Automatic model selection based on system capabilities
- Dynamic model switching based on task requirements
- Unified interface for text generation, chat, and embeddings
- Support for both CPU and GPU acceleration
- Memory-efficient operation with model unloading
"""

import os
import sys
import json
import asyncio
import logging
import pathlib
import time
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass
import threading
import torch

from .base import LLMResponse, LLMError, ModelCapability
from .local_client import LocalLLMClient, LocalConfig
from .model_manager import ModelManager, ModelTier, MODEL_TIERS, VLM_MODEL_TIERS
from ..utils.error_handling import handle_errors
from ..utils.exceptions import ModelError

logger = logging.getLogger(__name__)

@dataclass
class ModelInstance:
    """Represents a loaded model instance"""
    client: Any  # LocalLLMClient or similar
    model_id: str
    tier: str
    capabilities: List[ModelCapability]
    last_used: float  # timestamp
    in_use: bool = False
    
    def mark_used(self):
        """Mark the model as recently used"""
        self.last_used = time.time()
        
    def start_use(self):
        """Mark the model as currently in use"""
        self.in_use = True
        self.mark_used()
        
    def end_use(self):
        """Mark the model as no longer in use"""
        self.in_use = False
        self.mark_used()

class LocalLLMProvider:
    """
    Unified provider for local LLM models
    
    This class manages the lifecycle of local LLM models, providing a consistent
    interface for the rest of the ALEJO platform. It handles model selection,
    loading, unloading, and inference while optimizing for system resources.
    """
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        models_dir: Optional[pathlib.Path] = None,
        max_loaded_models: int = 2,
        unload_after_minutes: int = 30
    ):
        """
        Initialize the local LLM provider
        
        Args:
            config_path: Path to configuration file
            models_dir: Directory for model storage
            max_loaded_models: Maximum number of models to keep loaded
            unload_after_minutes: Unload models after this many minutes of inactivity
        """
        # Configuration
        self.config = self._load_config(config_path)
        
        # Model management
        self.models_dir = models_dir or pathlib.Path.home() / ".alejo" / "models"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.model_manager = ModelManager(models_dir=self.models_dir)
        
        # Resource management
        self.max_loaded_models = max_loaded_models
        self.unload_after_seconds = unload_after_minutes * 60
        
        # Active model instances
        self._loaded_models: Dict[str, ModelInstance] = {}
        self._model_lock = threading.RLock()
        
        # Start background cleanup task
        self._cleanup_task = None
        self._running = True
        self._start_cleanup_task()
        
        logger.info(f"LocalLLMProvider initialized with models directory: {self.models_dir}")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "default_model_tiers": {
                "general": "standard",
                "code": "standard",
                "creative": "standard",
                "reasoning": "performance",
                "embeddings": "lightweight"
            },
            "gpu_acceleration": True,
            "context_window": 4096,
            "temperature": 0.7,
            "top_p": 0.9
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    config.update(loaded_config)
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _start_cleanup_task(self):
        """Start background task to clean up unused models"""
        def cleanup_worker():
            while self._running:
                try:
                    self._cleanup_unused_models()
                except Exception as e:
                    logger.error(f"Error in model cleanup: {e}")
                time.sleep(60)  # Check every minute
        
        self._cleanup_task = threading.Thread(target=cleanup_worker, daemon=True)
        self._cleanup_task.start()
    
    def _cleanup_unused_models(self):
        """Unload models that haven't been used recently"""
        now = time.time()
        with self._model_lock:
            models_to_unload = []
            for model_id, instance in self._loaded_models.items():
                # Skip models currently in use
                if instance.in_use:
                    continue
                
                # Check if model has been unused for too long
                if now - instance.last_used > self.unload_after_seconds:
                    models_to_unload.append(model_id)
            
            # Unload models
            for model_id in models_to_unload:
                logger.info(f"Unloading unused model: {model_id}")
                del self._loaded_models[model_id]
    
    def shutdown(self):
        """Shutdown the provider and release resources"""
        self._running = False
        if self._cleanup_task:
            self._cleanup_task.join(timeout=1.0)
        
        # Unload all models
        with self._model_lock:
            self._loaded_models.clear()
    
    @handle_errors(ModelError)
    async def get_model_for_task(
        self,
        task_type: str = "general",
        required_capabilities: Optional[List[ModelCapability]] = None
    ) -> ModelInstance:
        """
        Get an appropriate model for the given task
        
        Args:
            task_type: Type of task (general, code, creative, reasoning, embeddings)
            required_capabilities: List of required model capabilities
            
        Returns:
            ModelInstance for the task
        """
        # Default capabilities if none specified
        if required_capabilities is None:
            required_capabilities = [ModelCapability.TEXT_GENERATION]
        
        # Get recommended tier for task
        tier_id = self.config["default_model_tiers"].get(task_type, "standard")
        
        # Check if we already have this model loaded
        model_id = MODEL_TIERS[tier_id].model_id
        
        with self._model_lock:
            if model_id in self._loaded_models:
                instance = self._loaded_models[model_id]
                # Check if model has required capabilities
                if all(cap in instance.capabilities for cap in required_capabilities):
                    instance.start_use()
                    return instance
            
            # Need to load the model
            return await self._load_model_for_task(task_type, tier_id, required_capabilities)
    
    @handle_errors(ModelError)
    async def _load_model_for_task(
        self,
        task_type: str,
        tier_id: str,
        required_capabilities: List[ModelCapability]
    ) -> ModelInstance:
        """
        Load a model for the given task
        
        Args:
            task_type: Type of task
            tier_id: Model tier ID
            required_capabilities: Required capabilities
            
        Returns:
            ModelInstance for the task
        """
        with self._model_lock:
            # Check if we need to unload a model to make room
            if len(self._loaded_models) >= self.max_loaded_models:
                self._unload_least_recently_used()
            
            # Get model tier
            tier = MODEL_TIERS.get(tier_id)
            if not tier:
                raise ModelError(f"Unknown model tier: {tier_id}")
            
            # Create model config
            gpu_layers = 0
            if self.config["gpu_acceleration"] and torch.cuda.is_available():
                # Use all layers if we have enough VRAM
                if tier.min_vram_gb and self.model_manager.system_specs["gpu_vram_gb"] >= tier.min_vram_gb:
                    gpu_layers = 100  # All layers
            
            model_config = LocalConfig(
                model_tier=tier_id,
                n_ctx=self.config["context_window"],
                gpu_layers=gpu_layers
            )
            
            # Create client
            try:
                client = LocalLLMClient(config=model_config)
                
                # Create model instance
                instance = ModelInstance(
                    client=client,
                    model_id=tier.model_id,
                    tier=tier_id,
                    capabilities=[ModelCapability.TEXT_GENERATION, ModelCapability.EMBEDDINGS],
                    last_used=time.time(),
                    in_use=True
                )
                
                # Store in loaded models
                self._loaded_models[tier.model_id] = instance
                
                logger.info(f"Loaded model {tier.model_id} for task type: {task_type}")
                return instance
            except Exception as e:
                raise ModelError(f"Failed to load model {tier.model_id}: {str(e)}")
    
    def _unload_least_recently_used(self):
        """Unload the least recently used model"""
        with self._model_lock:
            if not self._loaded_models:
                return
            
            # Find least recently used model that's not in use
            lru_model_id = None
            lru_time = float('inf')
            
            for model_id, instance in self._loaded_models.items():
                if not instance.in_use and instance.last_used < lru_time:
                    lru_model_id = model_id
                    lru_time = instance.last_used
            
            # Unload if found
            if lru_model_id:
                logger.info(f"Unloading least recently used model: {lru_model_id}")
                del self._loaded_models[lru_model_id]
    
    @handle_errors(ModelError)
    async def generate_text(
        self,
        prompt: str,
        task_type: str = "general",
        **kwargs
    ) -> LLMResponse:
        """
        Generate text from a prompt
        
        Args:
            prompt: Text prompt
            task_type: Type of task
            **kwargs: Additional parameters for the model
            
        Returns:
            LLMResponse with generated text
        """
        # Get model for task
        model_instance = await self.get_model_for_task(
            task_type=task_type,
            required_capabilities=[ModelCapability.TEXT_GENERATION]
        )
        
        try:
            # Set default parameters if not provided
            if "temperature" not in kwargs:
                kwargs["temperature"] = self.config["temperature"]
            if "top_p" not in kwargs:
                kwargs["top_p"] = self.config["top_p"]
            
            # Generate text
            response = await model_instance.client.generate_text(prompt, **kwargs)
            return response
        except Exception as e:
            raise ModelError(f"Text generation failed: {str(e)}")
        finally:
            # Mark model as no longer in use
            model_instance.end_use()
    
    @handle_errors(ModelError)
    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        task_type: str = "general",
        **kwargs
    ) -> LLMResponse:
        """
        Generate a response to a chat conversation
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            task_type: Type of task
            **kwargs: Additional parameters for the model
            
        Returns:
            LLMResponse with generated text
        """
        # Get model for task
        model_instance = await self.get_model_for_task(
            task_type=task_type,
            required_capabilities=[ModelCapability.TEXT_GENERATION]
        )
        
        try:
            # Set default parameters if not provided
            if "temperature" not in kwargs:
                kwargs["temperature"] = self.config["temperature"]
            if "top_p" not in kwargs:
                kwargs["top_p"] = self.config["top_p"]
            
            # Generate chat response
            response = await model_instance.client.generate_chat_response(messages, **kwargs)
            return response
        except Exception as e:
            raise ModelError(f"Chat response generation failed: {str(e)}")
        finally:
            # Mark model as no longer in use
            model_instance.end_use()
    
    @handle_errors(ModelError)
    async def get_embeddings(
        self,
        text: Union[str, List[str]],
        **kwargs
    ) -> Union[List[float], List[List[float]]]:
        """
        Get embeddings for text
        
        Args:
            text: Text to embed (string or list of strings)
            **kwargs: Additional parameters for the model
            
        Returns:
            List of embeddings
        """
        # Get model for embeddings task
        model_instance = await self.get_model_for_task(
            task_type="embeddings",
            required_capabilities=[ModelCapability.EMBEDDINGS]
        )
        
        try:
            # Generate embeddings
            embeddings = await model_instance.client.get_embeddings(text, **kwargs)
            return embeddings
        except Exception as e:
            raise ModelError(f"Embedding generation failed: {str(e)}")
        finally:
            # Mark model as no longer in use
            model_instance.end_use()
    
    @handle_errors(ModelError)
    async def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        """
        Get information about available models
        
        Returns:
            Dictionary of model information
        """
        # Get compatible tiers
        compatible_tiers = self.model_manager.get_compatible_tiers()
        
        # Build model information
        models_info = {}
        for tier_id, tier in MODEL_TIERS.items():
            if tier_id in compatible_tiers:
                model_path = self.models_dir / f"{tier.model_id}.gguf"
                is_downloaded = model_path.exists()
                
                models_info[tier_id] = {
                    "name": tier.name,
                    "model_id": tier.model_id,
                    "params_billion": tier.params_billion,
                    "size_gb": tier.size_gb,
                    "description": tier.description,
                    "is_downloaded": is_downloaded,
                    "is_loaded": tier.model_id in self._loaded_models
                }
        
        return models_info
    
    @handle_errors(ModelError)
    async def download_model(self, tier_id: str) -> Dict[str, Any]:
        """
        Download a model
        
        Args:
            tier_id: Model tier ID
            
        Returns:
            Status information
        """
        # Get tier
        tier = MODEL_TIERS.get(tier_id)
        if not tier:
            raise ModelError(f"Unknown model tier: {tier_id}")
        
        try:
            # Download model
            self.model_manager.download_model(tier)
            
            return {
                "success": True,
                "model_id": tier.model_id,
                "tier": tier_id,
                "path": str(self.models_dir / f"{tier.model_id}.gguf")
            }
        except Exception as e:
            raise ModelError(f"Model download failed: {str(e)}")
