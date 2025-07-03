"""
ALEJO Memory Cache Implementation

This module provides an efficient in-memory caching system with multiple
eviction policies and thread-safety for concurrent access.
"""

import time
import threading
import logging
import heapq
from typing import Any, Dict, Optional, List, Tuple, Set, Union
from collections import OrderedDict, defaultdict

from alejo.performance.cache_base import BaseCache, CacheEntry, EvictionPolicy

logger = logging.getLogger(__name__)


class MemoryCache(BaseCache):
    """
    High-performance in-memory cache implementation with multiple eviction policies.
    
    Features:
    - Thread-safe operations for concurrent access
    - Multiple eviction policies (LRU, LFU, FIFO, TTL)
    - Automatic cleanup of expired entries
    - Configurable maximum size with eviction
    - Detailed statistics for monitoring
    """
    
    def __init__(
        self, 
        max_size: int = 1000, 
        default_ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        cleanup_interval: int = 60  # Seconds between cleanup runs
    ):
        """
        Initialize the memory cache.
        
        Args:
            max_size: Maximum number of items to store in the cache
            default_ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
            cleanup_interval: Seconds between automatic cleanup runs
        """
        super().__init__(max_size, default_ttl, eviction_policy)
        
        # Main cache storage
        self._cache: Dict[str, CacheEntry] = {}
        
        # Statistics
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._expirations = 0
        
        # For FIFO policy
        self._insertion_order: List[str] = []
        
        # For LFU policy
        self._frequency_map: Dict[int, Set[str]] = defaultdict(set)
        self._item_frequencies: Dict[str, int] = {}
        
        # Automatic cleanup
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.time()
        
        logger.debug(f"Initialized MemoryCache with max_size={max_size}, "
                    f"policy={eviction_policy.value}, ttl={default_ttl}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a value from the cache.
        
        Args:
            key: The cache key
            default: Value to return if key is not in cache
            
        Returns:
            The cached value or default if not found
        """
        with self._lock:
            # Check for cleanup
            self._maybe_cleanup()
            
            if key not in self._cache:
                self._misses += 1
                return default
            
            entry = self._cache[key]
            
            # Check if expired
            if entry.is_expired():
                self._remove_entry(key)
                self._expirations += 1
                self._misses += 1
                return default
            
            # Update access metadata
            entry.access()
            
            # Update LFU metadata if needed
            if self.eviction_policy == EvictionPolicy.LFU:
                old_freq = self._item_frequencies[key]
                new_freq = old_freq + 1
                
                self._frequency_map[old_freq].remove(key)
                if not self._frequency_map[old_freq]:
                    del self._frequency_map[old_freq]
                
                self._frequency_map[new_freq].add(key)
                self._item_frequencies[key] = new_freq
            
            self._hits += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in the cache.
        
        Args:
            key: The cache key
            value: The value to cache
            ttl: Time-to-live in seconds (overrides default_ttl)
        """
        with self._lock:
            # Check for cleanup
            self._maybe_cleanup()
            
            # If key already exists, update it
            if key in self._cache:
                self._remove_entry(key)
            
            # If cache is full, evict an entry
            elif len(self._cache) >= self.max_size:
                self._evict_entry()
            
            # Create new entry
            entry = CacheEntry(key, value, self._get_ttl(ttl))
            self._cache[key] = entry
            
            # Update policy-specific metadata
            if self.eviction_policy == EvictionPolicy.FIFO:
                self._insertion_order.append(key)
            elif self.eviction_policy == EvictionPolicy.LFU:
                self._item_frequencies[key] = 1
                self._frequency_map[1].add(key)
    
    def delete(self, key: str) -> bool:
        """
        Delete a value from the cache.
        
        Args:
            key: The cache key
            
        Returns:
            True if the key was in the cache, False otherwise
        """
        with self._lock:
            if key in self._cache:
                self._remove_entry(key)
                return True
            return False
    
    def clear(self) -> None:
        """Clear all entries from the cache."""
        with self._lock:
            self._cache.clear()
            self._insertion_order.clear()
            self._frequency_map.clear()
            self._item_frequencies.clear()
            logger.debug("Cache cleared")
    
    def contains(self, key: str) -> bool:
        """
        Check if a key exists in the cache and is not expired.
        
        Args:
            key: The cache key
            
        Returns:
            True if the key exists in the cache and is not expired, False otherwise
        """
        with self._lock:
            if key not in self._cache:
                return False
            
            entry = self._cache[key]
            if entry.is_expired():
                self._remove_entry(key)
                self._expirations += 1
                return False
            
            return True
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the cache.
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            total_operations = self._hits + self._misses
            hit_ratio = self._hits / total_operations if total_operations > 0 else 0
            
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": hit_ratio,
                "evictions": self._evictions,
                "expirations": self._expirations,
                "eviction_policy": self.eviction_policy.value
            }
    
    def _maybe_cleanup(self) -> None:
        """Run cleanup if enough time has passed since the last cleanup."""
        current_time = time.time()
        if current_time - self._last_cleanup >= self._cleanup_interval:
            self._cleanup_expired()
            self._last_cleanup = current_time
    
    def _cleanup_expired(self) -> None:
        """Remove all expired entries from the cache."""
        expired_keys = []
        
        for key, entry in list(self._cache.items()):
            if entry.is_expired():
                expired_keys.append(key)
        
        for key in expired_keys:
            self._remove_entry(key)
            self._expirations += 1
        
        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired entries")
    
    def _remove_entry(self, key: str) -> None:
        """Remove an entry from the cache and all related data structures."""
        if key not in self._cache:
            return
        
        # Remove from main cache
        del self._cache[key]
        
        # Remove from policy-specific data structures
        if self.eviction_policy == EvictionPolicy.FIFO:
            if key in self._insertion_order:
                self._insertion_order.remove(key)
        
        elif self.eviction_policy == EvictionPolicy.LFU:
            if key in self._item_frequencies:
                freq = self._item_frequencies[key]
                if freq in self._frequency_map and key in self._frequency_map[freq]:
                    self._frequency_map[freq].remove(key)
                    if not self._frequency_map[freq]:
                        del self._frequency_map[freq]
                del self._item_frequencies[key]
    
    def _evict_entry(self) -> None:
        """Evict an entry based on the configured eviction policy."""
        if not self._cache:
            return
        
        key_to_evict = None
        
        # Apply the appropriate eviction policy
        if self.eviction_policy == EvictionPolicy.LRU:
            # Find least recently used entry
            lru_time = float('inf')
            for key, entry in self._cache.items():
                if entry.last_accessed < lru_time:
                    lru_time = entry.last_accessed
                    key_to_evict = key
        
        elif self.eviction_policy == EvictionPolicy.LFU:
            # Find least frequently used entry
            if self._frequency_map:
                min_freq = min(self._frequency_map.keys())
                # Get any key with this frequency
                key_to_evict = next(iter(self._frequency_map[min_freq]))
        
        elif self.eviction_policy == EvictionPolicy.FIFO:
            # Get the oldest entry
            if self._insertion_order:
                key_to_evict = self._insertion_order[0]
        
        elif self.eviction_policy == EvictionPolicy.TTL:
            # Find the entry closest to expiration or already expired
            closest_expiry = float('inf')
            current_time = time.time()
            
            for key, entry in self._cache.items():
                if entry.ttl is None:
                    continue
                
                expiry_time = entry.created_at + entry.ttl
                time_to_expiry = expiry_time - current_time
                
                if time_to_expiry < closest_expiry:
                    closest_expiry = time_to_expiry
                    key_to_evict = key
            
            # If no TTL entries, fall back to LRU
            if key_to_evict is None:
                return self._evict_entry_lru()
        
        # Remove the selected entry
        if key_to_evict:
            self._remove_entry(key_to_evict)
            self._evictions += 1
            logger.debug(f"Evicted entry with key '{key_to_evict}' using {self.eviction_policy.value} policy")
    
    def _evict_entry_lru(self) -> None:
        """Evict the least recently used entry (fallback method)."""
        if not self._cache:
            return
        
        lru_time = float('inf')
        key_to_evict = None
        
        for key, entry in self._cache.items():
            if entry.last_accessed < lru_time:
                lru_time = entry.last_accessed
                key_to_evict = key
        
        if key_to_evict:
            self._remove_entry(key_to_evict)
            self._evictions += 1
            logger.debug(f"Evicted entry with key '{key_to_evict}' using LRU fallback")
