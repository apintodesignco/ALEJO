"""
ALEJO Persistent Cache Implementation

This module provides a persistent caching system that stores cache data on disk,
allowing cache to persist between application restarts while maintaining the same
interface as the memory cache.
"""

import os
import time
import json
import pickle
import logging
import threading
import shutil
from pathlib import Path
from typing import Any, Dict, Optional, List, Set, Tuple, Union

from alejo.performance.cache_base import BaseCache, CacheEntry, EvictionPolicy
from alejo.security.encryption import encrypt_data, decrypt_data

logger = logging.getLogger(__name__)


class PersistentCache(BaseCache):
    """
    Persistent cache implementation that stores cache entries on disk.
    
    Features:
    - Thread-safe operations
    - Encryption support for sensitive data
    - Configurable storage location
    - Automatic cleanup of expired entries
    - Lazy loading for improved startup performance
    - Periodic flush to disk to prevent data loss
    """
    
    def __init__(
        self,
        cache_dir: str,
        max_size: int = 10000,
        default_ttl: Optional[int] = None,
        eviction_policy: EvictionPolicy = EvictionPolicy.LRU,
        encrypt: bool = False,
        flush_interval: int = 60,  # Seconds between flushes to disk
        cleanup_interval: int = 300  # Seconds between cleanup runs
    ):
        """
        Initialize the persistent cache.
        
        Args:
            cache_dir: Directory to store cache files
            max_size: Maximum number of items to store in the cache
            default_ttl: Default time-to-live for cache entries in seconds
            eviction_policy: Policy to use when cache is full
            encrypt: Whether to encrypt cache data on disk
            flush_interval: Seconds between automatic flushes to disk
            cleanup_interval: Seconds between automatic cleanup runs
        """
        super().__init__(max_size, default_ttl, eviction_policy)
        
        self.cache_dir = Path(cache_dir)
        self.encrypt = encrypt
        self.flush_interval = flush_interval
        self.cleanup_interval = cleanup_interval
        
        # Create cache directory if it doesn't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Main cache storage (in-memory copy)
        self._cache: Dict[str, CacheEntry] = {}
        
        # Track which entries have been modified since last flush
        self._modified_keys: Set[str] = set()
        
        # Statistics
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._expirations = 0
        
        # For FIFO policy
        self._insertion_order: List[str] = []
        
        # Timing
        self._last_flush = time.time()
        self._last_cleanup = time.time()
        
        # Load metadata
        self._metadata_path = self.cache_dir / "metadata.json"
        self._load_metadata()
        
        logger.debug(f"Initialized PersistentCache in {cache_dir}")
    
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
            # Check for cleanup and flush
            self._maybe_cleanup()
            self._maybe_flush()
            
            # Check if key exists in memory
            if key not in self._cache:
                # Check if key exists on disk
                entry = self._load_entry(key)
                if entry is None:
                    self._misses += 1
                    return default
                self._cache[key] = entry
            
            entry = self._cache[key]
            
            # Check if expired
            if entry.is_expired():
                self._remove_entry(key)
                self._expirations += 1
                self._misses += 1
                return default
            
            # Update access metadata
            entry.access()
            self._modified_keys.add(key)
            
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
            # Check for cleanup and flush
            self._maybe_cleanup()
            self._maybe_flush()
            
            # If key already exists, update it
            if key in self._cache:
                self._remove_entry(key)
            
            # If cache is full, evict an entry
            elif len(self._cache) >= self.max_size:
                self._evict_entry()
            
            # Create new entry
            entry = CacheEntry(key, value, self._get_ttl(ttl))
            self._cache[key] = entry
            self._modified_keys.add(key)
            
            # Update policy-specific metadata
            if self.eviction_policy == EvictionPolicy.FIFO:
                self._insertion_order.append(key)
    
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
            
            # Check if key exists on disk
            entry_path = self._get_entry_path(key)
            if entry_path.exists():
                os.remove(entry_path)
                return True
            
            return False
    
    def clear(self) -> None:
        """Clear all entries from the cache."""
        with self._lock:
            self._cache.clear()
            self._modified_keys.clear()
            self._insertion_order.clear()
            
            # Remove all cache files
            for file_path in self.cache_dir.glob("entry_*"):
                os.remove(file_path)
            
            # Update metadata
            self._save_metadata()
            
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
            # Check in-memory cache
            if key in self._cache:
                entry = self._cache[key]
                if entry.is_expired():
                    self._remove_entry(key)
                    self._expirations += 1
                    return False
                return True
            
            # Check disk cache
            entry = self._load_entry(key)
            if entry is None:
                return False
            
            # Add to in-memory cache
            self._cache[key] = entry
            
            # Check if expired
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
            
            # Count disk entries
            disk_entries = len(list(self.cache_dir.glob("entry_*")))
            
            return {
                "in_memory_size": len(self._cache),
                "disk_entries": disk_entries,
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": hit_ratio,
                "evictions": self._evictions,
                "expirations": self._expirations,
                "eviction_policy": self.eviction_policy.value,
                "encrypted": self.encrypt
            }
    
    def flush(self) -> None:
        """
        Flush all modified entries to disk.
        """
        with self._lock:
            for key in list(self._modified_keys):
                if key in self._cache:
                    self._save_entry(key, self._cache[key])
            
            self._modified_keys.clear()
            self._save_metadata()
            self._last_flush = time.time()
            
            logger.debug("Cache flushed to disk")
    
    def _maybe_flush(self) -> None:
        """Flush to disk if enough time has passed since the last flush."""
        current_time = time.time()
        if current_time - self._last_flush >= self.flush_interval:
            self.flush()
    
    def _maybe_cleanup(self) -> None:
        """Run cleanup if enough time has passed since the last cleanup."""
        current_time = time.time()
        if current_time - self._last_cleanup >= self.cleanup_interval:
            self._cleanup_expired()
            self._last_cleanup = current_time
    
    def _cleanup_expired(self) -> None:
        """Remove all expired entries from the cache."""
        # Check in-memory entries
        expired_keys = []
        for key, entry in list(self._cache.items()):
            if entry.is_expired():
                expired_keys.append(key)
        
        for key in expired_keys:
            self._remove_entry(key)
            self._expirations += 1
        
        # Check disk entries (only those not in memory)
        for entry_path in self.cache_dir.glob("entry_*"):
            key = entry_path.name[6:]  # Remove "entry_" prefix
            if key not in self._cache:
                entry = self._load_entry(key)
                if entry and entry.is_expired():
                    os.remove(entry_path)
                    self._expirations += 1
        
        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired entries")
    
    def _remove_entry(self, key: str) -> None:
        """Remove an entry from the cache and all related data structures."""
        if key not in self._cache:
            return
        
        # Remove from main cache
        del self._cache[key]
        
        # Remove from modified keys
        if key in self._modified_keys:
            self._modified_keys.remove(key)
        
        # Remove from policy-specific data structures
        if self.eviction_policy == EvictionPolicy.FIFO:
            if key in self._insertion_order:
                self._insertion_order.remove(key)
        
        # Remove from disk
        entry_path = self._get_entry_path(key)
        if entry_path.exists():
            os.remove(entry_path)
    
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
        
        elif self.eviction_policy == EvictionPolicy.FIFO:
            # Get the oldest entry
            if self._insertion_order:
                key_to_evict = self._insertion_order[0]
        
        elif self.eviction_policy == EvictionPolicy.TTL:
            # Find the entry closest to expiration
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
    
    def _get_entry_path(self, key: str) -> Path:
        """Get the file path for a cache entry."""
        # Use a safe filename
        safe_key = key.replace('/', '_').replace('\\', '_')
        return self.cache_dir / f"entry_{safe_key}"
    
    def _save_entry(self, key: str, entry: CacheEntry) -> None:
        """Save a cache entry to disk."""
        entry_path = self._get_entry_path(key)
        
        try:
            # Serialize the entry
            data = pickle.dumps(entry)
            
            # Encrypt if needed
            if self.encrypt:
                data = encrypt_data(data)
            
            # Write to file
            with open(entry_path, 'wb') as f:
                f.write(data)
        except Exception as e:
            logger.error(f"Failed to save cache entry '{key}': {e}")
    
    def _load_entry(self, key: str) -> Optional[CacheEntry]:
        """Load a cache entry from disk."""
        entry_path = self._get_entry_path(key)
        
        if not entry_path.exists():
            return None
        
        try:
            # Read from file
            with open(entry_path, 'rb') as f:
                data = f.read()
            
            # Decrypt if needed
            if self.encrypt:
                data = decrypt_data(data)
            
            # Deserialize the entry
            entry = pickle.loads(data)
            return entry
        except Exception as e:
            logger.error(f"Failed to load cache entry '{key}': {e}")
            
            # Remove corrupted entry
            if entry_path.exists():
                os.remove(entry_path)
            
            return None
    
    def _save_metadata(self) -> None:
        """Save cache metadata to disk."""
        metadata = {
            'stats': {
                'hits': self._hits,
                'misses': self._misses,
                'evictions': self._evictions,
                'expirations': self._expirations
            },
            'insertion_order': self._insertion_order,
            'last_flush': self._last_flush,
            'last_cleanup': self._last_cleanup
        }
        
        try:
            with open(self._metadata_path, 'w') as f:
                json.dump(metadata, f)
        except Exception as e:
            logger.error(f"Failed to save cache metadata: {e}")
    
    def _load_metadata(self) -> None:
        """Load cache metadata from disk."""
        if not self._metadata_path.exists():
            return
        
        try:
            with open(self._metadata_path, 'r') as f:
                metadata = json.load(f)
            
            # Restore statistics
            stats = metadata.get('stats', {})
            self._hits = stats.get('hits', 0)
            self._misses = stats.get('misses', 0)
            self._evictions = stats.get('evictions', 0)
            self._expirations = stats.get('expirations', 0)
            
            # Restore other metadata
            self._insertion_order = metadata.get('insertion_order', [])
            self._last_flush = metadata.get('last_flush', time.time())
            self._last_cleanup = metadata.get('last_cleanup', time.time())
        except Exception as e:
            logger.error(f"Failed to load cache metadata: {e}")
            
            # Reset metadata
            self._hits = 0
            self._misses = 0
            self._evictions = 0
            self._expirations = 0
            self._insertion_order = []
            self._last_flush = time.time()
            self._last_cleanup = time.time()
