"""
ALEJO Cache Decorator Module

This module provides decorators for easy function result caching,
supporting both memory and persistent caching with configurable options.
"""

import time
import functools
import inspect
import hashlib
import json
import logging
from typing import Any, Dict, Optional, Callable, Tuple, List, Union, TypeVar, cast

from alejo.performance.cache_base import BaseCache, EvictionPolicy
from alejo.performance.memory_cache import MemoryCache

logger = logging.getLogger(__name__)

# Type variable for function return type
T = TypeVar('T')

# Global cache instances
_function_caches: Dict[str, BaseCache] = {}


def _get_cache_key(func: Callable, args: Tuple, kwargs: Dict) -> str:
    """
    Generate a unique cache key for a function call.
    
    Args:
        func: The function being called
        args: Positional arguments
        kwargs: Keyword arguments
        
    Returns:
        A unique string key for this function call
    """
    # Get function signature
    sig = inspect.signature(func)
    
    # Bind arguments to signature parameters
    bound_args = sig.bind(*args, **kwargs)
    bound_args.apply_defaults()
    
    # Create a list of parameter values
    arg_values = []
    for param_name, param_value in bound_args.arguments.items():
        try:
            # Try to convert to JSON to ensure consistent serialization
            param_json = json.dumps(param_value, sort_keys=True)
            arg_values.append(f"{param_name}:{param_json}")
        except (TypeError, ValueError):
            # Fall back to string representation for non-serializable objects
            arg_values.append(f"{param_name}:{str(param_value)}")
    
    # Combine function name and arguments into a string
    key_base = f"{func.__module__}.{func.__qualname__}({','.join(arg_values)})"
    
    # Hash the string to get a fixed-length key
    return hashlib.md5(key_base.encode('utf-8')).hexdigest()


def cached(
    ttl: Optional[int] = None,
    max_size: int = 1000,
    cache_name: Optional[str] = None,
    key_generator: Optional[Callable] = None,
    eviction_policy: EvictionPolicy = EvictionPolicy.LRU
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to cache function results in memory.
    
    Args:
        ttl: Time-to-live for cache entries in seconds (None means no expiration)
        max_size: Maximum number of entries in this function's cache
        cache_name: Name for this cache (defaults to function name)
        key_generator: Custom function to generate cache keys
        eviction_policy: Policy to use when cache is full
        
    Returns:
        Decorated function with caching
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        # Get or create cache for this function
        nonlocal cache_name
        if cache_name is None:
            cache_name = f"{func.__module__}.{func.__qualname__}"
        
        if cache_name not in _function_caches:
            _function_caches[cache_name] = MemoryCache(
                max_size=max_size,
                default_ttl=ttl,
                eviction_policy=eviction_policy
            )
        
        cache = _function_caches[cache_name]
        
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            # Generate cache key
            if key_generator:
                key = key_generator(func, args, kwargs)
            else:
                key = _get_cache_key(func, args, kwargs)
            
            # Check cache
            cached_value = cache.get(key)
            if cached_value is not None:
                logger.debug(f"Cache hit for {cache_name}")
                return cast(T, cached_value)
            
            # Cache miss, call function
            logger.debug(f"Cache miss for {cache_name}")
            result = func(*args, **kwargs)
            
            # Store result in cache
            cache.set(key, result)
            
            return result
        
        # Add cache management methods to the wrapped function
        wrapper.cache_clear = lambda: cache.clear()  # type: ignore
        wrapper.cache_info = lambda: cache.get_stats()  # type: ignore
        
        return wrapper
    
    return decorator


def invalidate_cache(cache_name: str) -> bool:
    """
    Invalidate (clear) a specific cache by name.
    
    Args:
        cache_name: Name of the cache to invalidate
        
    Returns:
        True if cache was found and cleared, False otherwise
    """
    if cache_name in _function_caches:
        _function_caches[cache_name].clear()
        return True
    return False


def invalidate_all_caches() -> None:
    """Invalidate all function caches."""
    for cache in _function_caches.values():
        cache.clear()


def get_cache_stats() -> Dict[str, Dict[str, Any]]:
    """
    Get statistics for all caches.
    
    Returns:
        Dictionary mapping cache names to their statistics
    """
    return {name: cache.get_stats() for name, cache in _function_caches.items()}
