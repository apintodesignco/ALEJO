"""
Local LLM Client implementation powered by `llama-cpp-python`.
Loads a quantised GGUF model from the user's file-system and exposes the
same async interface as other LLM clients so the rest of ALEJO remains
provider-agnostic.

Features automatic model management:
- Selects best model for user's system on startup
- Downloads model if missing
- Cleans up old models to save disk space
- Updates to newest compatible models
"""
from __future__ import annotations

import asyncio
import logging
import os
import pathlib
import hashlib
import urllib.request
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union, Generator

# Import torch for GPU detection
import torch

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from llama_cpp import Llama, LlamaCompletion, LlamaEmbedding

from .base import (
    BaseLLMClient,
    LLMConfig,
    LLMResponse,
    LLMError,
    ModelCapability,
)

logger = logging.getLogger(__name__)

from .model_manager import ModelManager, ModelTier, MODEL_TIERS
from .auto_model_manager import AutoModelManager

# Initialize managers
_model_manager = ModelManager()
_auto_model_manager = AutoModelManager()

# Default model directory
_MODEL_DIR = pathlib.Path.home() / ".alejo" / "models"
_MODEL_DIR.mkdir(parents=True, exist_ok=True)


async def _ensure_model_exists(model_tier: Optional[str] = None) -> pathlib.Path:
    """Ensure model exists and is verified, downloading if necessary
    
    Args:
        model_tier: Optional specific tier ID to use, otherwise uses best for system
        
    Returns:
        Path to the verified model file
        
    This uses the AutoModelManager to:
    1. Select best model for the system if none specified
    2. Download if missing
    3. Clean up old models in background
    4. Check for updates
    """
    try:
        # If specific tier requested, get that model
        if model_tier and model_tier in MODEL_TIERS:
            tier = MODEL_TIERS[model_tier]
            return await _auto_model_manager._download_model_async(tier)
        
        # Otherwise let AutoModelManager choose the best model
        return await _auto_model_manager.ensure_best_model("llm")
    except Exception as e:
        logger.error(f"Failed to download model: {e}")
        raise ValueError(f"Could not download model: {str(e)}")
        
# Synchronous version for backward compatibility
def ensure_model_exists_sync(model_tier: Optional[str] = None) -> pathlib.Path:
    """Synchronous version of model download for backward compatibility"""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # If we're in an async context, create a new loop for this sync function
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(_ensure_model_exists(model_tier))
        finally:
            new_loop.close()
    else:
        # Normal case
        return loop.run_until_complete(_ensure_model_exists(model_tier))


@dataclass
class LocalConfig(LLMConfig):
    """Configuration for the local Llama model
    
    Args:
        model_tier: Name of model tier to use ('lightweight', 'standard', 'performance')
        model_path: Optional explicit path to model file (overrides model_tier)
        n_ctx: Context window size
        gpu_layers: Number of layers to offload to GPU (0 for CPU-only)
        auto_model_management: Whether to enable automatic model selection and management
    """
    model_tier: str = "standard"
    model_path: Optional[str] = None
    n_ctx: int = 4096
    gpu_layers: int = 35
    auto_model_management: bool = True
    
    def __post_init__(self):
        super().__post_init__()
        
        # If model_path not specified, handle based on auto_model_management setting
        if not self.model_path:
            if self.auto_model_management:
                # Let auto manager handle it at runtime
                pass
            else:
                # Legacy manual approach
                if self.model_tier not in MODEL_TIERS:
                    raise ValueError(f"Invalid model tier: {self.model_tier}")
                tier = MODEL_TIERS[self.model_tier]
                # Download/verify model for this tier
                model_path = ensure_model_exists_sync(self.model_tier)
                self.model_path = str(model_path)
        
        # Auto-detect GPU availability
        if torch.cuda.is_available() and self.gpu_layers > 0:
            self.capabilities.append(ModelCapability.GPU_ACCELERATION)
        
        # Set standard capabilities
        self.capabilities.extend([
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CHAT,
            ModelCapability.EMBEDDINGS,
            ModelCapability.STREAMING,
            ModelCapability.FUNCTION_CALLING
        ])


class LocalLLMClient(BaseLLMClient):
    """Local  quantised GGUF model via llama-cpp"""

    def __init__(self, config: Optional[LocalConfig] = None):
        """Initialize the local LLM client
        
        Args:
            config: Optional configuration. If not provided, will use recommended
                   model tier based on system capabilities.
        """
        # If no config provided, create one with recommended tier
        if not config:
            recommended_tier = _model_manager.recommend_tier()
            config = LocalConfig(model_tier=recommended_tier.model_id)
        
        super().__init__(config)
        self._ensure_config_type()
        
        # Lazy load model
        self._llama: Optional["Llama"] = None
        self._model_loaded = False
        
        # Log selected model info
        model_path = pathlib.Path(self.config.model_path)
        if model_info := _model_manager.get_model_info(model_path):
            logger.info(
                f"Using {model_info.name} model ({model_info.params_billion}B params) "
                f"from {model_path}"
            )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _ensure_model_exists(self):
        """Ensure the model file exists, downloading if necessary"""
        path = pathlib.Path(self.config.model_path)
        if not path.exists():
            # Get model tier from path name
            model_id = path.stem
            for tier_id, tier in MODEL_TIERS.items():
                if tier.model_id == model_id:
                    logger.info(f"Model {model_id} not found, downloading...")
                    _model_manager.download_model(tier)
                    return
            
            # If we get here, we couldn't identify the model tier
            raise ValueError(f"Model {path} not found and couldn't determine tier for download")

    def _load_model(self):
        """Load the Llama model with appropriate error handling"""
        if self._model_loaded and self._llama is not None:
            return
            
        try:
            logger.info(f"Loading local Llama model from {self.config.model_path}")
            # Import llama_cpp lazily to avoid DLL issues during test collection
            try:
                from llama_cpp import Llama  # noqa: WPS433 (runtime import)
            except ImportError:
                logger.error("llama-cpp-python not installed. Installing required dependencies...")
                raise LLMError(
                    "llama-cpp-python not installed. Please run: pip install llama-cpp-python", 
                    "local", 
                    "dependency_error"
                )
            
            # Ensure model file exists
            if self.config.auto_model_management:
                # Get model through automatic manager
                model_path = ensure_model_exists_sync(self.config.model_tier)
                # Update the config path to reflect the actual model used
                self.config.model_path = str(model_path)
            else:
                model_path = pathlib.Path(self.config.model_path)
                if not model_path.exists():
                    raise LLMError(
                        f"Model file not found at {self.config.model_path}", 
                        "local", 
                        "file_not_found"
                    )
            
            # Initialize with appropriate GPU settings
            start_time = time.time()
            logger.info(f"Loading model with {self.config.gpu_layers} GPU layers")
            
            # Initialize with appropriate GPU acceleration if available
            self._llama = Llama(
                model_path=str(model_path),
                n_ctx=self.config.n_ctx,
                n_gpu_layers=self.config.gpu_layers,
                seed=0,  # Reproducible responses
            )

            load_time = time.time() - start_time
            logger.info(f"Model loaded in {load_time:.2f} seconds")
            self._model_loaded = True
            
            # Start cleanup in background (non-blocking)
            if self.config.auto_model_management:
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # Schedule as task if we're in async context
                        asyncio.create_task(_auto_model_manager.cleanup_old_models())
                except Exception as cleanup_err:
                    # Don't let cleanup errors affect model loading
                    logger.warning(f"Non-critical error during model cleanup: {cleanup_err}")

        except Exception as e:
            error_msg = f"Failed to load model: {str(e)}"
            logger.error(error_msg)
            raise LLMError(error_msg, "local", "load_error", e) from e

    # ------------------------------------------------------------------
    # BaseLLMClient interface
    # ------------------------------------------------------------------
    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate text from a prompt using the local Llama model"""
        # Ensure model is loaded
        if not self._model_loaded or self._llama is None:
            self._load_model()
            
        params = {
            "temperature": kwargs.get("temperature", self.config.temperature),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
        }
        
        start = asyncio.get_event_loop().time()
        try:
            # Import here to avoid circular imports
            from llama_cpp import LlamaCompletion  # type: ignore  # noqa
            
            # Run inference in thread pool to avoid blocking event loop
            completion: "LlamaCompletion" = await asyncio.get_event_loop().run_in_executor(
                self._executor, lambda: self._llama(prompt, **params)
            )
            
            # Extract content and clean it
            content = completion["choices"][0]["text"].lstrip()
            
            # Calculate metrics
            latency = asyncio.get_event_loop().time() - start
            self._update_metrics(start, success=True)
            
            # Return standardized response
            return LLMResponse(
                content=content,
                model=self.config.model_name,
                usage=completion.get("usage", {}),
                finish_reason=completion["choices"][0].get("finish_reason"),
                latency=latency,
                metadata={
                    "provider": "local",
                    "model_path": self.config.model_path,
                    "gpu_layers": self.config.gpu_layers
                }
            )
        except Exception as e:
            self._update_metrics(start, success=False)
            logger.error(f"Error generating text: {str(e)}")
            raise LLMError(f"Text generation failed: {str(e)}", "local", "generate_error", e) from e

    async def generate_chat_response(self, messages: List[Dict[str, str]], **kwargs) -> LLMResponse:
        # Simple implementation: convert chat messages to a prompt
        prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
        return await self.generate_text(prompt, **kwargs)

    async def generate_stream(
        self, prompt: Union[str, List[Dict[str, str]]], **kwargs
    ) -> Generator[str, None, None]:
        # llama_cpp streaming callback
        queue: asyncio.Queue[str] = asyncio.Queue()

        def _cb(token: str, _):
            asyncio.run_coroutine_threadsafe(queue.put(token), asyncio.get_event_loop())

        def _worker():
            if isinstance(prompt, list):
                _prompt = "\n".join(f"{m['role']}: {m['content']}" for m in prompt)
            else:
                _prompt = prompt
            self._llama(
                _prompt,
                stream=True,
                callback=_cb,
                temperature=kwargs.get("temperature", self.config.temperature),
                top_p=kwargs.get("top_p", self.config.top_p),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            )
            asyncio.run_coroutine_threadsafe(queue.put(None), asyncio.get_event_loop())

        # Start generation in pool
        self._executor.submit(_worker)
        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

    async def get_embeddings(self, text: Union[str, List[str]], **kwargs) -> List[List[float]]:
        try:
            if isinstance(text, str):
                text_list = [text]
            else:
                text_list = text
            from llama_cpp import LlamaEmbedding  # type: ignore  # noqa
            embeddings: "LlamaEmbedding" = await asyncio.get_event_loop().run_in_executor(
                self._executor, lambda: self._llama.embed(text_list)
            )
            return embeddings
        except Exception as e:
            raise LLMError(str(e), "local", "embedding_error", e) from e
