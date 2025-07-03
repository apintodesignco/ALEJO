"""
ALEJO Base Caching System

This module provides the foundation for ALEJO's caching infrastructure,
implementing memory-efficient caching with configurable eviction policies.
"""

import time
import threading
import logging
from typing import Any, Dict, Optional, Callable, Tuple, List, Union
from abc import ABC, abstractmethod
from enum import Enum

logger = logging.getLogger(__name__)

class EvictionPolicy(Enum):
    """Supported cache eviction policies."""
    LRU = "least_recently_used"  # Least Recently Used
    LFU = "least_frequently_used"  # Least Frequently Used
    FIFO = "first_in_first_out"  # First In First Out
    TTL = "time_to_live"  # Time-based expiration


class CacheEntry:
    """
    Represents a single cache entry with metadata for eviction policies.
    """
    
    def __init__(self, key: str, value: Any, ttl: Optional[int] = None):
        """
        Initialize a cache entry.
        
        Args:
            key: The cache key
            value: The cached value
            ttl: Time-to-live in seconds (None means no expiration)
        """
        self.key = key
        self.value = value
        self.ttl = ttl
        self.created_at = time.time()
        self.last_accessed = self.created_at
        self.access_count = 0
    
    def access(self) -> None:
        """Update access metadata when entry is accessed."""
        self.last_accessed = time.time()
        self.access_count += 1
    
    def is_expired(self) -> bool:
        """Check if the entry has expired based on TTL."""
        if self.ttl is None:
            return False
        return time.time() > (self.created_at + self.ttl)


class BaseCache(ABC):
    """
    Abstract base class for all cache implementations.
    
    This class defines the interface that all cache implementations must follow
    and provides common functionality for cache management.
    """
    
    def __init__(
        self, 
        max_size: int = 1000, 
        default_ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU
    ):
        """
        Initialize the cache.
        
        Args:
            max_size: Maximum number of items to store in the cache
            default_ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.eviction_policy = eviction_policy
        self._lock = threading.RLock()  # Reentrant lock for thread safety
    
    @abstractmethod
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a value from the cache.
        
        Args:
            key: The cache key
            default: Value to return if key is not in cache
            
        Returns:
            The cached value or default if not found
        """
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in the cache.
        
        Args:
            key: The cache key
            value: The value to cache
            ttl: Time-to-live in seconds (overrides default_ttl)
        """
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        """
        Delete a value from the cache.
        
        Args:
            key: The cache key
            
        Returns:
            True if the key was in the cache, False otherwise
        """
        pass
    
    @abstractmethod
    def clear(self) -> None:
        """Clear all entries from the cache."""
        pass
    
    @abstractmethod
    def contains(self, key: str) -> bool:
        """
        Check if a key exists in the cache.
        
        Args:
            key: The cache key
            
        Returns:
            True if the key exists in the cache, False otherwise
        """
        pass
    
    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the cache.
        
        Returns:
            Dictionary with cache statistics
        """
        pass
    
    def _get_ttl(self, ttl: Optional[int] = None) -> Optional[int]:
        """
        Get the TTL to use for a cache entry.
        
        Args:
            ttl: Specific TTL for this entry (overrides default)
            
        Returns:
            TTL to use (None means no expiration)
        """
        if ttl is not None:
            return ttl
        return self.default_ttl
