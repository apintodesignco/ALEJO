"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
LLaMa Model - LLaMa-specific model implementation
"""

import os
import logging
import tempfile
from typing import Dict, Any, Optional, List, Union, Tuple

import numpy as np

from alejo.ml.models.model_base import ModelBase

logger = logging.getLogger("alejo.ml.llama")

class LlamaModel(ModelBase):
    """
    LLaMa model implementation for ALEJO.
    
    This class handles loading, inference, and memory management for LLaMa models
    using the llama-cpp-python library for efficient CPU inference.
    """
    
    def __init__(
        self, 
        model_id: str, 
        framework: str = "llama",
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize a LLaMa model.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (should be "llama")
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        super().__init__(model_id, framework, config, cache_dir)
        
        # Lazy import llama-cpp-python to avoid loading it unnecessarily
        self.llama_cpp = None
        
        # Model configuration
        self.model_path = config.get("model_path")
        self.n_ctx = config.get("n_ctx", 2048)  # Context window size
        self.n_batch = config.get("n_batch", 512)  # Batch size for prompt processing
        self.n_gpu_layers = config.get("n_gpu_layers", 0)  # Number of layers to offload to GPU
        self.n_threads = config.get("n_threads", None)  # Number of threads to use
        self.use_mlock = config.get("use_mlock", False)  # Lock model in memory
        self.use_mmap = config.get("use_mmap", True)  # Use memory mapping
        self.vocab_only = config.get("vocab_only", False)  # Load only vocabulary
        self.memory_usage_bytes = 0
        
        # LLaMa-specific metadata
        self.metadata.update({
            "n_ctx": self.n_ctx,
            "n_gpu_layers": self.n_gpu_layers,
            "model_type": config.get("model_type", "llama"),  # llama, llama2, codellama, etc.
        })
        
    def _import_llama_cpp(self) -> bool:
        """
        Import llama-cpp-python library.
        
        Returns:
            True if import was successful, False otherwise
        """
        if self.llama_cpp is not None:
            return True
            
        try:
            # Import llama-cpp-python
            import llama_cpp
            self.llama_cpp = llama_cpp
            
            logger.info(f"llama-cpp-python {llama_cpp.__version__} imported successfully")
            return True
        except ImportError as e:
            logger.error(f"Failed to import llama-cpp-python: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error configuring llama-cpp-python: {str(e)}")
            return False
            
    def load(self) -> bool:
        """
        Load the LLaMa model into memory.
        
        Returns:
            True if loading was successful, False otherwise
        """
        if self.is_loaded:
            return True
            
        if not self._import_llama_cpp():
            return False
            
        try:
            # Determine model path
            model_path = self.model_path
            if not model_path:
                cache_path = self.get_cache_path()
                if cache_path and os.path.exists(cache_path):
                    model_path = cache_path
                else:
                    logger.error(f"No model path specified for {self.model_id}")
                    return False
                    
            # Determine number of threads if not specified
            n_threads = self.n_threads
            if n_threads is None:
                import multiprocessing
                n_threads = max(1, multiprocessing.cpu_count() // 2)
                
            # Load model
            self.model = self.llama_cpp.Llama(
                model_path=model_path,
                n_ctx=self.n_ctx,
                n_batch=self.n_batch,
                n_gpu_layers=self.n_gpu_layers,
                n_threads=n_threads,
                use_mlock=self.use_mlock,
                use_mmap=self.use_mmap,
                vocab_only=self.vocab_only
            )
            
            # Update metadata with model info
            self.metadata.update({
                "n_params": getattr(self.model, "n_params", 0),
                "n_vocab": getattr(self.model, "n_vocab", 0),
                "n_ctx": self.model.n_ctx,
            })
            
            # Estimate memory usage
            self._estimate_memory_usage()
            
            self.is_loaded = True
            self.touch()
            logger.info(f"Loaded LLaMa model: {self.model_id} (n_ctx: {self.n_ctx}, n_gpu_layers: {self.n_gpu_layers})")
            return True
        except Exception as e:
            logger.error(f"Failed to load LLaMa model {self.model_id}: {str(e)}")
            self.model = None
            return False
            
    def unload(self) -> bool:
        """
        Unload the LLaMa model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        if not self.is_loaded:
            return True
            
        try:
            # Clear model
            self.model = None
            
            # Force garbage collection
            import gc
            gc.collect()
                
            self.is_loaded = False
            self.memory_usage_bytes = 0
            logger.info(f"Unloaded LLaMa model: {self.model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unload LLaMa model {self.model_id}: {str(e)}")
            return False
            
    def predict(self, inputs: Union[str, Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Run inference on the LLaMa model.
        
        Args:
            inputs: Input text or dictionary with generation parameters
            **kwargs: Additional arguments for generation
            
        Returns:
            Dictionary with generated text and metadata
        """
        if not self.is_loaded:
            if not self.load():
                raise RuntimeError(f"Failed to load model {self.model_id}")
                
        self.touch()
        
        try:
            # Process inputs
            if isinstance(inputs, str):
                prompt = inputs
                params = kwargs
            elif isinstance(inputs, dict):
                prompt = inputs.get("prompt", "")
                params = {**inputs, **kwargs}
            else:
                raise ValueError(f"Unsupported input type: {type(inputs)}")
                
            # Extract generation parameters
            max_tokens = params.get("max_tokens", 128)
            temperature = params.get("temperature", 0.8)
            top_p = params.get("top_p", 0.95)
            top_k = params.get("top_k", 40)
            repeat_penalty = params.get("repeat_penalty", 1.1)
            stop = params.get("stop", [])
            echo = params.get("echo", False)
            stream = params.get("stream", False)
            
            # Run inference
            if stream:
                # Return a generator for streaming responses
                return self._stream_generate(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repeat_penalty=repeat_penalty,
                    stop=stop,
                    echo=echo
                )
            else:
                # Generate text
                result = self.model(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repeat_penalty=repeat_penalty,
                    stop=stop,
                    echo=echo
                )
                
                # Format result
                return {
                    "text": result["choices"][0]["text"],
                    "usage": {
                        "prompt_tokens": result["usage"]["prompt_tokens"],
                        "completion_tokens": result["usage"]["completion_tokens"],
                        "total_tokens": result["usage"]["total_tokens"]
                    },
                    "finish_reason": result["choices"][0]["finish_reason"]
                }
        except Exception as e:
            logger.error(f"Error during LLaMa inference: {str(e)}")
            raise
            
    def _stream_generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        Stream generation from the LLaMa model.
        
        Args:
            prompt: Input text
            **kwargs: Generation parameters
            
        Returns:
            Generator yielding text chunks
        """
        # Extract generation parameters
        max_tokens = kwargs.get("max_tokens", 128)
        temperature = kwargs.get("temperature", 0.8)
        top_p = kwargs.get("top_p", 0.95)
        top_k = kwargs.get("top_k", 40)
        repeat_penalty = kwargs.get("repeat_penalty", 1.1)
        stop = kwargs.get("stop", [])
        echo = kwargs.get("echo", False)
        
        # Create generator
        generator = self.model(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            repeat_penalty=repeat_penalty,
            stop=stop,
            echo=echo,
            stream=True
        )
        
        # Yield chunks
        for chunk in generator:
            yield {
                "text": chunk["choices"][0]["text"],
                "usage": {
                    "prompt_tokens": chunk["usage"]["prompt_tokens"],
                    "completion_tokens": chunk["usage"]["completion_tokens"],
                    "total_tokens": chunk["usage"]["total_tokens"]
                },
                "finish_reason": chunk["choices"][0]["finish_reason"]
            }
            
    def get_memory_usage(self) -> int:
        """
        Get the estimated memory usage of the model in bytes.
        
        Returns:
            Estimated memory usage in bytes
        """
        return self.memory_usage_bytes
        
    def _estimate_memory_usage(self) -> None:
        """Estimate the memory usage of the loaded model"""
        try:
            if not self.is_loaded or self.model is None:
                self.memory_usage_bytes = 0
                return
                
            # Get model parameters
            n_params = getattr(self.model, "n_params", 0)
            
            if n_params > 0:
                # Estimate based on parameters (assuming 2 bytes per parameter for quantized models)
                bytes_per_param = 2  # Most llama.cpp models are quantized to 4-bit or 8-bit
                param_memory = n_params * bytes_per_param
                
                # Add overhead for KV cache based on context window
                kv_cache_size = self.n_ctx * 128 * 2 * 4  # Rough estimate
                
                # Total memory
                self.memory_usage_bytes = param_memory + kv_cache_size
            else:
                # Fallback estimation based on model type
                model_type = self.metadata.get("model_type", "").lower()
                
                if "7b" in model_type:
                    self.memory_usage_bytes = 4 * 1024 * 1024 * 1024  # ~4GB for 7B models
                elif "13b" in model_type:
                    self.memory_usage_bytes = 8 * 1024 * 1024 * 1024  # ~8GB for 13B models
                elif "70b" in model_type:
                    self.memory_usage_bytes = 35 * 1024 * 1024 * 1024  # ~35GB for 70B models
                else:
                    self.memory_usage_bytes = 2 * 1024 * 1024 * 1024  # Default 2GB
                    
            logger.debug(f"Estimated memory usage for {self.model_id}: {self.memory_usage_bytes / (1024*1024*1024):.2f} GB")
        except Exception as e:
            logger.warning(f"Failed to estimate memory usage: {str(e)}")
            # Default to 2GB if estimation fails
            self.memory_usage_bytes = 2 * 1024 * 1024 * 1024
