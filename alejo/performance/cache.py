"""
ALEJO Caching System

This module provides a unified interface to ALEJO's caching infrastructure,
allowing easy access to different cache implementations and configurations.
"""

import os
import logging
import threading
from typing import Any, Dict, Optional, Union, Type, List, Set

from alejo.performance.cache_base import BaseCache, EvictionPolicy
from alejo.performance.memory_cache import MemoryCache
from alejo.performance.persistent_cache import PersistentCache
from alejo.performance.cache_decorator import (
    cached, invalidate_cache, invalidate_all_caches, get_cache_stats
)

logger = logging.getLogger(__name__)

# Global cache registry
_cache_registry: Dict[str, BaseCache] = {}
_registry_lock = threading.RLock()


class CacheManager:
    """
    Central manager for all caches in the ALEJO system.
    
    This class provides methods to create, access, and manage different types
    of caches throughout the application with consistent configuration.
    """
    
    @staticmethod
    def get_cache(
        name: str,
        cache_type: str = "memory",
        max_size: int = 1000,
        ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        **kwargs
    ) -> BaseCache:
        """
        Get or create a cache with the specified configuration.
        
        Args:
            name: Unique name for the cache
            cache_type: Type of cache ("memory" or "persistent")
            max_size: Maximum number of items in the cache
            ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
            **kwargs: Additional arguments for specific cache types
            
        Returns:
            The requested cache instance
        
        Raises:
            ValueError: If cache_type is not supported
        """
        with _registry_lock:
            if name in _cache_registry:
                return _cache_registry[name]
            
            # Create new cache
            if cache_type == "memory":
                cache = MemoryCache(
                    max_size=max_size,
                    default_ttl=ttl,
                    eviction_policy=eviction_policy,
                    cleanup_interval=kwargs.get("cleanup_interval", 60)
                )
            elif cache_type == "persistent":
                # Get cache directory
                cache_dir = kwargs.get("cache_dir")
                if cache_dir is None:
                    # Use default location
                    from alejo.config import get_config
                    config = get_config()
                    cache_dir = os.path.join(config.get("data_dir", "data"), "cache", name)
                
                cache = PersistentCache(
                    cache_dir=cache_dir,
                    max_size=max_size,
                    default_ttl=ttl,
                    eviction_policy=eviction_policy,
                    encrypt=kwargs.get("encrypt", False),
                    flush_interval=kwargs.get("flush_interval", 60),
                    cleanup_interval=kwargs.get("cleanup_interval", 300)
                )
            else:
                raise ValueError(f"Unsupported cache type: {cache_type}")
            
            # Register cache
            _cache_registry[name] = cache
            logger.debug(f"Created {cache_type} cache: {name}")
            
            return cache
    
    @staticmethod
    def get_memory_cache(
        name: str,
        max_size: int = 1000,
        ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        cleanup_interval: int = 60
    ) -> MemoryCache:
        """
        Get or create a memory cache with the specified configuration.
        
        Args:
            name: Unique name for the cache
            max_size: Maximum number of items in the cache
            ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
            cleanup_interval: Seconds between automatic cleanup runs
            
        Returns:
            Memory cache instance
        """
        cache = CacheManager.get_cache(
            name=name,
            cache_type="memory",
            max_size=max_size,
            ttl=ttl,
            eviction_policy=eviction_policy,
            cleanup_interval=cleanup_interval
        )
        return cache  # type: MemoryCache
    
    @staticmethod
    def get_persistent_cache(
        name: str,
        cache_dir: Optional[str] = None,
        max_size: int = 10000,
        ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        encrypt: bool = False,
        flush_interval: int = 60,
        cleanup_interval: int = 300
    ) -> PersistentCache:
        """
        Get or create a persistent cache with the specified configuration.
        
        Args:
            name: Unique name for the cache
            cache_dir: Directory to store cache files
            max_size: Maximum number of items in the cache
            ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
            encrypt: Whether to encrypt cache data on disk
            flush_interval: Seconds between automatic flushes to disk
            cleanup_interval: Seconds between automatic cleanup runs
            
        Returns:
            Persistent cache instance
        """
        cache = CacheManager.get_cache(
            name=name,
            cache_type="persistent",
            max_size=max_size,
            ttl=ttl,
            eviction_policy=eviction_policy,
            cache_dir=cache_dir,
            encrypt=encrypt,
            flush_interval=flush_interval,
            cleanup_interval=cleanup_interval
        )
        return cache  # type: PersistentCache
    
    @staticmethod
    def invalidate_cache(name: str) -> bool:
        """
        Invalidate (clear) a specific cache by name.
        
        Args:
            name: Name of the cache to invalidate
            
        Returns:
            True if cache was found and cleared, False otherwise
        """
        with _registry_lock:
            if name in _cache_registry:
                _cache_registry[name].clear()
                logger.debug(f"Invalidated cache: {name}")
                return True
            return False
    
    @staticmethod
    def invalidate_all_caches() -> None:
        """Invalidate all registered caches."""
        with _registry_lock:
            for name, cache in _cache_registry.items():
                cache.clear()
                logger.debug(f"Invalidated cache: {name}")
    
    @staticmethod
    def flush_persistent_caches() -> None:
        """Flush all persistent caches to disk."""
        with _registry_lock:
            for cache in _cache_registry.values():
                if isinstance(cache, PersistentCache):
                    cache.flush()
    
    @staticmethod
    def get_cache_stats() -> Dict[str, Dict[str, Any]]:
        """
        Get statistics for all registered caches.
        
        Returns:
            Dictionary mapping cache names to their statistics
        """
        with _registry_lock:
            return {name: cache.get_stats() for name, cache in _cache_registry.items()}
    
    @staticmethod
    def get_registered_caches() -> List[str]:
        """
        Get a list of all registered cache names.
        
        Returns:
            List of cache names
        """
        with _registry_lock:
            return list(_cache_registry.keys())


# Create default application caches
def initialize_default_caches():
    """Initialize default caches used throughout the ALEJO application."""
    # Database query cache
    CacheManager.get_memory_cache(
        name="db_query_cache",
        max_size=5000,
        ttl=300,  # 5 minutes
        eviction_policy=EvictionPolicy.LRU
    )
    
    # API response cache
    CacheManager.get_memory_cache(
        name="api_response_cache",
        max_size=1000,
        ttl=60,  # 1 minute
        eviction_policy=EvictionPolicy.TTL
    )
    
    # User preferences cache (persistent)
    CacheManager.get_persistent_cache(
        name="user_preferences",
        max_size=1000,
        ttl=None,  # No expiration
        eviction_policy=EvictionPolicy.LRU,
        encrypt=True  # Encrypt sensitive user data
    )
    
    # Asset cache (persistent)
    CacheManager.get_persistent_cache(
        name="asset_cache",
        max_size=10000,
        ttl=86400 * 7,  # 7 days
        eviction_policy=EvictionPolicy.LFU,
        encrypt=False
    )
    
    logger.info("Initialized default application caches")


# Convenience functions for direct access to cache functionality
def get_cache(
    name: str,
    cache_type: str = "memory",
    max_size: int = 1000,
    ttl: Optional[int] = None,
    eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
    **kwargs
) -> BaseCache:
    """
    Get or create a cache with the specified configuration.
    
    This is a convenience function that delegates to CacheManager.get_cache.
    
    Args:
        name: Unique name for the cache
        cache_type: Type of cache ("memory" or "persistent")
        max_size: Maximum number of items in the cache
        ttl: Default time-to-live for cache entries in seconds
        eviction_policy: Policy to use when cache is full
        **kwargs: Additional arguments for specific cache types
        
    Returns:
        The requested cache instance
    """
    return CacheManager.get_cache(
        name=name,
        cache_type=cache_type,
        max_size=max_size,
        ttl=ttl,
        eviction_policy=eviction_policy,
        **kwargs
    )


def create_memory_cache(
    name: str,
    max_size: int = 1000,
    ttl: Optional[int] = None,
    eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
    cleanup_interval: int = 60
) -> MemoryCache:
    """
    Create a new memory cache with the specified configuration.
    
    This is a convenience function that delegates to CacheManager.get_memory_cache.
    
    Args:
        name: Unique name for the cache
        max_size: Maximum number of items in the cache
        ttl: Default time-to-live for cache entries in seconds
        eviction_policy: Policy to use when cache is full
        cleanup_interval: Seconds between automatic cleanup runs
        
    Returns:
        Memory cache instance
    """
    return CacheManager.get_memory_cache(
        name=name,
        max_size=max_size,
        ttl=ttl,
        eviction_policy=eviction_policy,
        cleanup_interval=cleanup_interval
    )


# Export public API
__all__ = [
    'CacheManager',
    'BaseCache',
    'MemoryCache',
    'PersistentCache',
    'EvictionPolicy',
    'cached',
    'invalidate_cache',
    'invalidate_all_caches',
    'get_cache_stats',
    'initialize_default_caches',
    'get_cache',
    'create_memory_cache'
]
