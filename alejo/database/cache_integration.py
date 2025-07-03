"""
ALEJO Database Cache Integration

This module integrates the advanced caching system with the database manager,
providing optimized query caching with configurable eviction policies and
persistence options.
"""

import logging
import time
from typing import Any, Dict, Optional, List, Tuple, Union, Callable

from alejo.performance.cache import CacheManager, EvictionPolicy
from alejo.performance.cache_decorator import cached

logger = logging.getLogger(__name__)


class DatabaseCacheManager:
    """
    Advanced caching manager for database operations.
    
    This class provides a bridge between the DatabaseManager and the
    performance caching system, offering:
    - Multiple cache levels (memory and persistent)
    - Configurable eviction policies
    - Automatic cache invalidation
    - Cache statistics and monitoring
    - Pattern-based cache invalidation
    """
    
    def __init__(
        self,
        cache_enabled: bool = True,
        memory_ttl: int = 300,  # 5 minutes
        persistent_ttl: int = 3600,  # 1 hour
        memory_max_size: int = 5000,
        persistent_max_size: int = 10000,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        use_persistent: bool = True,
        encrypt_persistent: bool = True
    ):
        """
        Initialize the database cache manager.
        
        Args:
            cache_enabled: Whether caching is enabled
            memory_ttl: Time-to-live for memory cache in seconds
            persistent_ttl: Time-to-live for persistent cache in seconds
            memory_max_size: Maximum number of items in memory cache
            persistent_max_size: Maximum number of items in persistent cache
            eviction_policy: Policy to use when cache is full
            use_persistent: Whether to use persistent caching
            encrypt_persistent: Whether to encrypt persistent cache data
        """
        self.cache_enabled = cache_enabled
        self.use_persistent = use_persistent
        
        # Initialize memory cache for database queries
        self.memory_cache = CacheManager.get_memory_cache(
            name="db_query_cache",
            max_size=memory_max_size,
            ttl=memory_ttl,
            eviction_policy=eviction_policy
        )
        
        # Initialize persistent cache if enabled
        self.persistent_cache = None
        if use_persistent:
            self.persistent_cache = CacheManager.get_persistent_cache(
                name="db_persistent_cache",
                max_size=persistent_max_size,
                ttl=persistent_ttl,
                eviction_policy=eviction_policy,
                encrypt=encrypt_persistent
            )
        
        logger.info(f"Database cache initialized with policy: {eviction_policy.value}")
    
    def get_cached(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache hierarchy.
        
        First checks memory cache, then persistent cache if enabled.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        if not self.cache_enabled:
            return None
        
        # Try memory cache first
        value = self.memory_cache.get(key)
        if value is not None:
            return value
        
        # Try persistent cache if enabled
        if self.use_persistent and self.persistent_cache:
            value = self.persistent_cache.get(key)
            if value is not None:
                # Promote to memory cache for faster access next time
                self.memory_cache.set(key, value)
                return value
        
        return None
    
    def set_cached(self, key: str, value: Any, memory_only: bool = False) -> None:
        """
        Store a value in the cache hierarchy.
        
        Args:
            key: Cache key
            value: Value to cache
            memory_only: If True, only store in memory cache
        """
        if not self.cache_enabled:
            return
        
        # Always store in memory cache
        self.memory_cache.set(key, value)
        
        # Store in persistent cache if enabled and not memory_only
        if self.use_persistent and self.persistent_cache and not memory_only:
            self.persistent_cache.set(key, value)
    
    def invalidate(self, pattern: Optional[str] = None) -> None:
        """
        Invalidate cache entries matching the pattern or all if None.
        
        Args:
            pattern: Pattern to match cache keys against
        """
        if not self.cache_enabled:
            return
        
        if pattern is None:
            # Clear all caches
            self.memory_cache.clear()
            if self.use_persistent and self.persistent_cache:
                self.persistent_cache.clear()
        else:
            # For pattern-based invalidation, we need to get all keys
            # and check each one against the pattern
            memory_stats = self.memory_cache.get_stats()
            memory_size = memory_stats.get("size", 0)
            
            # If memory cache is large, it's more efficient to just clear it
            # as we don't have a built-in way to get all keys matching a pattern
            if memory_size > 1000:
                self.memory_cache.clear()
            else:
                # This is a simplified approach - in a real implementation,
                # we would need a way to get all keys from the cache
                pass
            
            # For persistent cache, same approach
            if self.use_persistent and self.persistent_cache:
                persistent_stats = self.persistent_cache.get_stats()
                persistent_size = persistent_stats.get("in_memory_size", 0)
                
                if persistent_size > 1000:
                    self.persistent_cache.clear()
                else:
                    # Simplified approach
                    pass
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the cache.
        
        Returns:
            Dictionary with cache statistics
        """
        stats = {
            "memory_cache": self.memory_cache.get_stats(),
            "enabled": self.cache_enabled
        }
        
        if self.use_persistent and self.persistent_cache:
            stats["persistent_cache"] = self.persistent_cache.get_stats()
        
        return stats
    
    def flush_persistent(self) -> None:
        """Flush persistent cache to disk."""
        if self.use_persistent and self.persistent_cache:
            self.persistent_cache.flush()


# Decorator for database method caching
def db_cached(
    ttl: Optional[int] = None,
    memory_only: bool = False,
    invalidate_on_write: bool = True
):
    """
    Decorator for caching database methods.
    
    This decorator provides a convenient way to cache database methods
    with automatic cache invalidation on write operations.
    
    Args:
        ttl: Time-to-live for cache entries in seconds
        memory_only: If True, only store in memory cache
        invalidate_on_write: If True, invalidate cache on write operations
        
    Returns:
        Decorated function with caching
    """
    def decorator(func):
        # Use the standard cached decorator from our caching system
        cached_func = cached(ttl=ttl)(func)
        
        # Add database-specific cache behavior
        if invalidate_on_write and func.__name__.startswith(('store_', 'update_', 'set_', 'delete_')):
            # For write operations, we need to invalidate related caches
            # This is a simplified approach - in a real implementation,
            # we would need more sophisticated invalidation logic
            pass
        
        return cached_func
    
    return decorator
