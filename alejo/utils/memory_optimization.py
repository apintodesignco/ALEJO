"""
ALEJO Memory Optimization Module

This module provides tools for optimizing memory usage in ALEJO,
particularly for managing large AI models and their resources.
It implements strategies like lazy loading, model unloading,
and memory-efficient tensor operations.
"""

import os
import gc
import time
import logging
import threading
import psutil
from typing import Dict, Any, List, Optional, Set, Callable
import weakref
from pathlib import Path
import json

# Conditional imports for torch
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger("alejo.memory_optimization")

class MemoryOptimizer:
    """
    Memory optimization for ALEJO's AI components
    
    This class provides tools to:
    1. Monitor memory usage of AI models
    2. Implement lazy loading strategies
    3. Unload unused models to free memory
    4. Apply memory-efficient tensor operations
    5. Cache and reuse computation results
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the memory optimizer
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.enabled = self.config.get('memory_optimization', True)
        
        # Memory thresholds
        self.thresholds = {
            'high_memory_percent': self.config.get('high_memory_percent', 80.0),
            'critical_memory_percent': self.config.get('critical_memory_percent', 90.0),
            'model_unload_threshold_minutes': self.config.get('model_unload_threshold_minutes', 30),
            'cache_size_mb': self.config.get('cache_size_mb', 512),
        }
        
        # Active models registry
        self._active_models: Dict[str, Dict[str, Any]] = {}
        self._model_lock = threading.RLock()
        
        # Result cache
        self._result_cache: Dict[str, Any] = {}
        self._cache_info: Dict[str, Dict[str, Any]] = {}
        self._cache_lock = threading.RLock()
        
        # Start background monitoring
        self._running = True
        self._monitor_thread = None
        if self.enabled:
            self._start_monitoring()
        
        logger.info("Memory optimizer initialized")
    
    def _start_monitoring(self):
        """Start background memory monitoring thread"""
        def monitor_loop():
            while self._running:
                try:
                    self._check_memory_usage()
                    self._cleanup_unused_models()
                    self._cleanup_cache()
                except Exception as e:
                    logger.error(f"Error in memory monitoring: {e}")
                time.sleep(60)  # Check every minute
        
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()
        logger.debug("Memory monitoring started")
    
    def shutdown(self):
        """Shutdown the memory optimizer"""
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=1.0)
        
        # Clear caches and unload models
        with self._cache_lock:
            self._result_cache.clear()
            self._cache_info.clear()
        
        with self._model_lock:
            self._unload_all_models()
        
        logger.info("Memory optimizer shutdown")
    
    def _check_memory_usage(self):
        """Check system memory usage and take action if needed"""
        if not self.enabled:
            return
        
        # Get memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        if memory_percent > self.thresholds['critical_memory_percent']:
            logger.warning(f"Critical memory usage: {memory_percent}%")
            # Take immediate action
            self._emergency_memory_cleanup()
        elif memory_percent > self.thresholds['high_memory_percent']:
            logger.info(f"High memory usage: {memory_percent}%")
            # Take preventive action
            self._cleanup_unused_models(aggressive=True)
            self._cleanup_cache(aggressive=True)
    
    def _emergency_memory_cleanup(self):
        """Emergency memory cleanup when system is critically low on memory"""
        logger.warning("Performing emergency memory cleanup")
        
        # Force garbage collection
        gc.collect()
        
        # Unload all non-essential models
        with self._model_lock:
            models_to_unload = []
            for model_id, info in self._active_models.items():
                if not info.get('essential', False):
                    models_to_unload.append(model_id)
            
            for model_id in models_to_unload:
                self._unload_model(model_id)
        
        # Clear all caches
        with self._cache_lock:
            self._result_cache.clear()
            self._cache_info.clear()
        
        # If torch is available, empty CUDA cache
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("CUDA cache cleared")
    
    def register_model(
        self,
        model_id: str,
        model: Any,
        essential: bool = False,
        unloadable: bool = True
    ):
        """
        Register a model with the memory optimizer
        
        Args:
            model_id: Unique identifier for the model
            model: The model object
            essential: Whether this model is essential and should not be unloaded
            unloadable: Whether this model can be unloaded to free memory
        """
        if not self.enabled:
            return
        
        with self._model_lock:
            # Store weak reference if unloadable
            model_ref = weakref.ref(model) if unloadable else model
            
            self._active_models[model_id] = {
                'model': model_ref,
                'essential': essential,
                'unloadable': unloadable,
                'last_used': time.time(),
                'size_estimate_mb': self._estimate_model_size(model)
            }
            
            logger.debug(f"Registered model: {model_id}")
    
    def unregister_model(self, model_id: str):
        """
        Unregister a model from the memory optimizer
        
        Args:
            model_id: Unique identifier for the model
        """
        if not self.enabled:
            return
        
        with self._model_lock:
            if model_id in self._active_models:
                del self._active_models[model_id]
                logger.debug(f"Unregistered model: {model_id}")
    
    def mark_model_used(self, model_id: str):
        """
        Mark a model as recently used
        
        Args:
            model_id: Unique identifier for the model
        """
        if not self.enabled:
            return
        
        with self._model_lock:
            if model_id in self._active_models:
                self._active_models[model_id]['last_used'] = time.time()
    
    def _cleanup_unused_models(self, aggressive: bool = False):
        """
        Cleanup unused models to free memory
        
        Args:
            aggressive: If True, use a shorter timeout for unloading
        """
        if not self.enabled:
            return
        
        # Determine timeout based on aggressiveness
        timeout_minutes = 5 if aggressive else self.thresholds['model_unload_threshold_minutes']
        timeout_seconds = timeout_minutes * 60
        
        now = time.time()
        with self._model_lock:
            models_to_unload = []
            for model_id, info in self._active_models.items():
                # Skip essential models
                if info.get('essential', False):
                    continue
                
                # Skip models that aren't unloadable
                if not info.get('unloadable', True):
                    continue
                
                # Check if model has been unused for too long
                if now - info['last_used'] > timeout_seconds:
                    models_to_unload.append(model_id)
            
            # Unload models
            for model_id in models_to_unload:
                self._unload_model(model_id)
    
    def _unload_model(self, model_id: str):
        """
        Unload a model to free memory
        
        Args:
            model_id: Unique identifier for the model
        """
        if model_id not in self._active_models:
            return
        
        info = self._active_models[model_id]
        
        # Get model from weak reference if unloadable
        if info.get('unloadable', True):
            model = info['model']()
            if model is None:
                # Model already garbage collected
                del self._active_models[model_id]
                return
        else:
            model = info['model']
        
        # Try to call model's unload method if it exists
        try:
            if hasattr(model, 'unload'):
                model.unload()
            elif hasattr(model, 'cpu'):
                # Move to CPU if it's a torch model
                model.cpu()
        except Exception as e:
            logger.error(f"Error unloading model {model_id}: {e}")
        
        # Remove from active models
        del self._active_models[model_id]
        
        # Force garbage collection
        gc.collect()
        
        # Clear CUDA cache if available
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info(f"Unloaded model: {model_id}")
    
    def _unload_all_models(self):
        """Unload all registered models"""
        with self._model_lock:
            model_ids = list(self._active_models.keys())
            for model_id in model_ids:
                self._unload_model(model_id)
    
    def _estimate_model_size(self, model: Any) -> float:
        """
        Estimate the memory size of a model in MB
        
        Args:
            model: The model object
            
        Returns:
            Estimated size in MB
        """
        if TORCH_AVAILABLE and hasattr(model, 'parameters'):
            # For PyTorch models
            try:
                size_bytes = 0
                for param in model.parameters():
                    if param.data is not None:
                        size_bytes += param.nelement() * param.element_size()
                return size_bytes / (1024 * 1024)  # Convert to MB
            except Exception:
                pass
        
        # Fallback: use object size estimation
        try:
            import sys
            size_bytes = sys.getsizeof(model)
            return size_bytes / (1024 * 1024)  # Convert to MB
        except Exception:
            # If all else fails, return a default estimate
            return 100.0  # Assume 100MB
    
    def cache_result(self, key: str, result: Any, ttl_seconds: int = 300):
        """
        Cache a computation result
        
        Args:
            key: Cache key
            result: Result to cache
            ttl_seconds: Time to live in seconds
        """
        if not self.enabled:
            return
        
        with self._cache_lock:
            self._result_cache[key] = result
            self._cache_info[key] = {
                'created': time.time(),
                'expires': time.time() + ttl_seconds,
                'hits': 0
            }
    
    def get_cached_result(self, key: str) -> Optional[Any]:
        """
        Get a cached result
        
        Args:
            key: Cache key
            
        Returns:
            Cached result or None if not found or expired
        """
        if not self.enabled:
            return None
        
        with self._cache_lock:
            if key not in self._result_cache:
                return None
            
            # Check if expired
            if time.time() > self._cache_info[key]['expires']:
                del self._result_cache[key]
                del self._cache_info[key]
                return None
            
            # Update hit count
            self._cache_info[key]['hits'] += 1
            
            return self._result_cache[key]
    
    def _cleanup_cache(self, aggressive: bool = False):
        """
        Cleanup expired cache entries
        
        Args:
            aggressive: If True, remove more cache entries
        """
        if not self.enabled:
            return
        
        now = time.time()
        with self._cache_lock:
            # Remove expired entries
            keys_to_remove = [
                key for key, info in self._cache_info.items()
                if now > info['expires']
            ]
            
            for key in keys_to_remove:
                if key in self._result_cache:
                    del self._result_cache[key]
                if key in self._cache_info:
                    del self._cache_info[key]
            
            # If aggressive, also remove least used entries
            if aggressive and self._result_cache:
                # Calculate total cache size (rough estimate)
                total_size_mb = sum(
                    sys.getsizeof(result) / (1024 * 1024)
                    for result in self._result_cache.values()
                )
                
                # If cache is too large, remove least used entries
                if total_size_mb > self.thresholds['cache_size_mb']:
                    # Sort by hit count
                    sorted_keys = sorted(
                        self._cache_info.keys(),
                        key=lambda k: self._cache_info[k]['hits']
                    )
                    
                    # Remove up to 25% of entries
                    remove_count = max(1, len(sorted_keys) // 4)
                    for key in sorted_keys[:remove_count]:
                        if key in self._result_cache:
                            del self._result_cache[key]
                        if key in self._cache_info:
                            del self._cache_info[key]

# Lazy loading decorator
def lazy_load(func):
    """
    Decorator for lazy loading of resources
    
    This decorator ensures that a resource is only loaded when actually needed.
    
    Args:
        func: Function that loads a resource
        
    Returns:
        Wrapped function
    """
    loaded_resource = None
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        nonlocal loaded_resource
        if loaded_resource is None:
            loaded_resource = func(*args, **kwargs)
        return loaded_resource
    
    # Add a method to force reload
    def reload(*args, **kwargs):
        nonlocal loaded_resource
        loaded_resource = None
        return wrapper(*args, **kwargs)
    
    wrapper.reload = reload
    return wrapper

# Singleton instance
_memory_optimizer_instance = None

def get_memory_optimizer(config: Dict[str, Any] = None) -> MemoryOptimizer:
    """
    Get or create the memory optimizer instance
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        MemoryOptimizer instance
    """
    global _memory_optimizer_instance
    if _memory_optimizer_instance is None:
        _memory_optimizer_instance = MemoryOptimizer(config)
    return _memory_optimizer_instance

# Import missing module
import sys
