"""
Memory Optimization Module for ALEJO

This module provides utilities for optimizing memory usage in ALEJO,
particularly for managing large models and caching expensive computations.
"""

import gc
import os
import sys
import time
import logging
import threading
import weakref
import importlib
from functools import wraps
from typing import Any, Dict, List, Set, Optional, Callable, TypeVar, cast, Union
import secrets  # More secure for cryptographic purposes

logger = logging.getLogger(__name__)

# Type variables for generic functions
T = TypeVar('T')
R = TypeVar('R')

# Singleton instance
_MEMORY_OPTIMIZER_INSTANCE = None
_INSTANCE_LOCK = threading.Lock()


class MemoryOptimizer:
    """
    Memory optimization manager for ALEJO.
    
    This class provides utilities for:
    - Managing model lifecycle (loading, unloading)
    - Tracking model usage and automatically unloading unused models
    - Caching expensive computation results
    - Monitoring and optimizing memory usage
    """
    
    def __init__(self, 
                 auto_cleanup_interval: int = 300,  # 5 minutes
                 cache_ttl: int = 3600,  # 1 hour
                 memory_threshold: float = 0.85,  # 85% memory usage triggers cleanup
                 aggressive_threshold: float = 0.95):  # 95% memory usage triggers aggressive cleanup
        """
        Initialize the memory optimizer.
        
        Args:
            auto_cleanup_interval: Seconds between automatic cleanup runs
            cache_ttl: Default time-to-live for cached results in seconds
            memory_threshold: Memory usage percentage that triggers cleanup
            aggressive_threshold: Memory usage percentage that triggers aggressive cleanup
        """
        # Model management
        self._models: Dict[str, Any] = {}
        self._model_last_used: Dict[str, float] = {}
        self._model_size_estimates: Dict[str, int] = {}
        self._essential_models: Set[str] = set()
        
        # Result caching
        self._result_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = cache_ttl
        
        # Cleanup settings
        self._auto_cleanup_interval = auto_cleanup_interval
        self._last_cleanup = time.time()
        self._memory_threshold = memory_threshold
        self._aggressive_threshold = aggressive_threshold
        
        # Thread safety
        self._lock = threading.RLock()
        
        # Statistics
        self._cache_hits = 0
        self._cache_misses = 0
        self._models_unloaded = 0
        self._emergency_cleanups = 0
        
        logger.info(f"Memory optimizer initialized with cleanup interval={auto_cleanup_interval}s, "
                   f"cache TTL={cache_ttl}s, memory threshold={memory_threshold*100}%")
    
    def register_model(self, name: str, model: Any, size_estimate: Optional[int] = None, 
                      essential: bool = False) -> None:
        """
        Register a model with the memory optimizer.
        
        Args:
            name: Unique name for the model
            model: The model object
            size_estimate: Estimated size in bytes (optional)
            essential: If True, model will not be unloaded during cleanup
        """
        with self._lock:
            self._models[name] = model
            self._model_last_used[name] = time.time()
            
            if size_estimate is not None:
                self._model_size_estimates[name] = size_estimate
            else:
                # Try to estimate size
                self._model_size_estimates[name] = self._estimate_model_size(model)
            
            if essential:
                self._essential_models.add(name)
                
            logger.debug(f"Registered model '{name}' with size estimate {self._model_size_estimates[name]} bytes")
    
    def unregister_model(self, name: str) -> bool:
        """
        Unregister a model from the memory optimizer.
        
        Args:
            name: Name of the model to unregister
            
        Returns:
            True if the model was unregistered, False if it wasn't registered
        """
        with self._lock:
            if name in self._models:
                del self._models[name]
                self._model_last_used.pop(name, None)
                self._model_size_estimates.pop(name, None)
                self._essential_models.discard(name)
                logger.debug(f"Unregistered model '{name}'")
                return True
            return False
    
    def mark_model_used(self, name: str) -> bool:
        """
        Mark a model as recently used to prevent it from being unloaded.
        
        Args:
            name: Name of the model
            
        Returns:
            True if the model was found and marked, False otherwise
        """
        with self._lock:
            if name in self._models:
                self._model_last_used[name] = time.time()
                return True
            return False
    
    def get_model(self, name: str) -> Optional[Any]:
        """
        Get a registered model and mark it as used.
        
        Args:
            name: Name of the model
            
        Returns:
            The model object or None if not found
        """
        with self._lock:
            if name in self._models:
                self._model_last_used[name] = time.time()
                return self._models[name]
            return None
    
    def unload_model(self, name: str) -> bool:
        """
        Unload a model to free memory.
        
        Args:
            name: Name of the model to unload
            
        Returns:
            True if the model was unloaded, False otherwise
        """
        with self._lock:
            if name not in self._models or name in self._essential_models:
                return False
            
            model = self._models[name]
            
            # Try different unloading methods based on model type
            try:
                # PyTorch-like models
                if hasattr(model, 'cpu') and callable(model.cpu):
                    model.cpu()
                    logger.debug(f"Moved model '{name}' to CPU")
                
                # Models with explicit unload method
                if hasattr(model, 'unload') and callable(model.unload):
                    model.unload()
                    logger.debug(f"Called unload() on model '{name}'")
                
                # Keep reference but mark as unloaded
                self._models[name] = None
                self._models_unloaded += 1
                logger.info(f"Unloaded model '{name}'")
                return True
            
            except Exception as e:
                logger.error(f"Error unloading model '{name}': {e}")
                return False
    
    def cleanup_unused_models(self, max_age_seconds: int = 600, 
                             force: bool = False) -> int:
        """
        Unload models that haven't been used recently.
        
        Args:
            max_age_seconds: Unload models not used in this many seconds
            force: If True, ignore essential flag
            
        Returns:
            Number of models unloaded
        """
        with self._lock:
            current_time = time.time()
            unloaded_count = 0
            
            for name, last_used in list(self._model_last_used.items()):
                if name not in self._models:
                    continue
                    
                if (current_time - last_used > max_age_seconds and 
                    (force or name not in self._essential_models)):
                    if self.unload_model(name):
                        unloaded_count += 1
            
            if unloaded_count > 0:
                logger.info(f"Cleaned up {unloaded_count} unused models")
                gc.collect()  # Encourage garbage collection
                
            return unloaded_count
    
    def cache_result(self, func_name: str, args_key: str, result: Any, 
                    ttl: Optional[int] = None) -> None:
        """
        Cache a function result.
        
        Args:
            func_name: Name of the function
            args_key: String representation of function arguments
            result: Result to cache
            ttl: Time-to-live in seconds (overrides default)
        """
        with self._lock:
            if func_name not in self._result_cache:
                self._result_cache[func_name] = {}
                
            expiration = time.time() + (ttl if ttl is not None else self._cache_ttl)
            self._result_cache[func_name][args_key] = {
                'result': result,
                'expires': expiration
            }
            
            logger.debug(f"Cached result for {func_name}({args_key})")
    
    def get_cached_result(self, func_name: str, args_key: str) -> tuple[Optional[Any], bool]:
        """
        Get a cached function result.
        
        Args:
            func_name: Name of the function
            args_key: String representation of function arguments
            
        Returns:
            Tuple of (result, hit) where hit is True if cache hit, False otherwise
        """
        with self._lock:
            self._maybe_cleanup()
            
            if (func_name in self._result_cache and 
                args_key in self._result_cache[func_name]):
                
                cache_entry = self._result_cache[func_name][args_key]
                
                # Check if expired
                if time.time() > cache_entry['expires']:
                    # Remove expired entry
                    del self._result_cache[func_name][args_key]
                    self._cache_misses += 1
                    return None, False
                
                self._cache_hits += 1
                return cache_entry['result'], True
            
            self._cache_misses += 1
            return None, False
    
    def cleanup_cache(self, force_full_cleanup: bool = False) -> int:
        """
        Remove expired entries from the cache.
        
        Args:
            force_full_cleanup: If True, remove all entries regardless of expiration
            
        Returns:
            Number of entries removed
        """
        with self._lock:
            removed_count = 0
            current_time = time.time()
            
            for func_name in list(self._result_cache.keys()):
                for args_key in list(self._result_cache[func_name].keys()):
                    cache_entry = self._result_cache[func_name][args_key]
                    
                    if force_full_cleanup or current_time > cache_entry['expires']:
                        del self._result_cache[func_name][args_key]
                        removed_count += 1
                
                # Clean up empty function entries
                if not self._result_cache[func_name]:
                    del self._result_cache[func_name]
            
            if removed_count > 0:
                logger.debug(f"Cleaned up {removed_count} cache entries")
                
            return removed_count
    
    def emergency_memory_cleanup(self) -> None:
        """
        Perform aggressive memory cleanup when system is low on memory.
        
        This method:
        1. Clears all non-essential caches
        2. Unloads all non-essential models
        3. Forces garbage collection
        """
        with self._lock:
            logger.warning("Performing emergency memory cleanup")
            
            # Clear all caches
            self.cleanup_cache(force_full_cleanup=True)
            
            # Unload all non-essential models
            self.cleanup_unused_models(max_age_seconds=0)
            
            # Force garbage collection
            gc.collect()
            
            self._emergency_cleanups += 1
            logger.info("Emergency memory cleanup completed")
    
    def _maybe_cleanup(self) -> None:
        """Run cleanup if enough time has passed since the last cleanup."""
        current_time = time.time()
        if current_time - self._last_cleanup > self._auto_cleanup_interval:
            self.cleanup_cache()
            self.cleanup_unused_models()
            self._last_cleanup = current_time
    
    def _estimate_model_size(self, model: Any) -> int:
        """
        Estimate the memory size of a model in bytes.
        
        Args:
            model: The model to estimate
            
        Returns:
            Estimated size in bytes
        """
        try:
            # Try to get size from model parameters (for PyTorch-like models)
            if hasattr(model, 'parameters') and callable(model.parameters):
                params = list(model.parameters())
                if params:
                    total_size = 0
                    for param in params:
                        if hasattr(param, 'nelement') and hasattr(param, 'element_size'):
                            total_size += param.nelement() * param.element_size()
                    
                    if total_size > 0:
                        return total_size
            
            # Fallback: rough estimate based on object's __sizeof__
            return sys.getsizeof(model)
        
        except Exception as e:
            logger.warning(f"Error estimating model size: {e}")
            return 1024 * 1024  # Default to 1MB if estimation fails
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the memory optimizer.
        
        Returns:
            Dictionary with memory optimizer statistics
        """
        with self._lock:
            return {
                'models_registered': len(self._models),
                'models_unloaded': self._models_unloaded,
                'essential_models': len(self._essential_models),
                'cache_hits': self._cache_hits,
                'cache_misses': self._cache_misses,
                'cache_hit_ratio': (
                    self._cache_hits / (self._cache_hits + self._cache_misses)
                    if (self._cache_hits + self._cache_misses) > 0 else 0
                ),
                'cached_functions': len(self._result_cache),
                'cached_entries': sum(len(entries) for entries in self._result_cache.values()),
                'emergency_cleanups': self._emergency_cleanups,
                'last_cleanup': self._last_cleanup
            }


def get_memory_optimizer() -> MemoryOptimizer:
    """
    Get the singleton instance of the memory optimizer.
    
    Returns:
        The memory optimizer instance
    """
    global _MEMORY_OPTIMIZER_INSTANCE
    
    if _MEMORY_OPTIMIZER_INSTANCE is None:
        with _INSTANCE_LOCK:
            if _MEMORY_OPTIMIZER_INSTANCE is None:
                _MEMORY_OPTIMIZER_INSTANCE = MemoryOptimizer()
    
    return _MEMORY_OPTIMIZER_INSTANCE


def lazy_load(module_path: str, attribute: Optional[str] = None) -> Callable[[Callable[..., R]], Callable[..., R]]:
    """
    Decorator for lazy loading of modules and objects.
    
    This decorator delays the import of modules until the function is actually called,
    which can significantly reduce startup time and memory usage.
    
    Args:
        module_path: Import path to the module
        attribute: Specific attribute to import from the module (optional)
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable[..., R]) -> Callable[..., R]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> R:
            # Import the module only when the function is called
            module = importlib.import_module(module_path)
            
            # If an attribute is specified, get it from the module
            if attribute is not None:
                module = getattr(module, attribute)
                
            # Replace the global in the function's module
            func.__globals__[module_path.split('.')[-1]] = module
            
            # Call the function with the imported module
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Convenience function for importing modules lazily
def lazy_import(module_path: str, attribute: Optional[str] = None) -> Any:
    """
    Import a module or attribute lazily.
    
    Args:
        module_path: Import path to the module
        attribute: Specific attribute to import from the module (optional)
        
    Returns:
        The imported module or attribute
    """
    module = importlib.import_module(module_path)
    if attribute is not None:
        return getattr(module, attribute)
    return module
