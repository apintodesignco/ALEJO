"""
Tests for ALEJO's caching system.

This module tests all aspects of the caching system including:
- Memory cache
- Persistent cache
- Cache decorators
- Cache manager
- Eviction policies
- TTL expiration
"""

import os
import time
import shutil
import threading
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pytest

from alejo.performance.cache_base import EvictionPolicy
from alejo.performance.memory_cache import MemoryCache
from alejo.performance.persistent_cache import PersistentCache
from alejo.performance.cache_decorator import cached, invalidate_cache
from alejo.performance.cache import CacheManager, initialize_default_caches


class TestMemoryCache(unittest.TestCase):
    """Test the memory cache implementation."""
    
    def setUp(self):
        """Set up a fresh cache for each test."""
        self.cache = MemoryCache(max_size=10, default_ttl=60)
    
    def test_basic_operations(self):
        """Test basic cache operations (get, set, delete, contains)."""
        # Set and get
        self.cache.set("key1", "value1")
        self.assertEqual(self.cache.get("key1"), "value1")
        
        # Get with default
        self.assertEqual(self.cache.get("nonexistent", "default"), "default")
        
        # Contains
        self.assertTrue(self.cache.contains("key1"))
        self.assertFalse(self.cache.contains("nonexistent"))
        
        # Delete
        self.assertTrue(self.cache.delete("key1"))
        self.assertFalse(self.cache.contains("key1"))
        self.assertFalse(self.cache.delete("nonexistent"))
    
    def test_ttl_expiration(self):
        """Test that entries expire based on TTL."""
        # Set with short TTL
        self.cache.set("key1", "value1", ttl=0.1)
        self.assertEqual(self.cache.get("key1"), "value1")
        
        # Wait for expiration
        time.sleep(0.2)
        
        # Should be expired
        self.assertIsNone(self.cache.get("key1"))
        self.assertFalse(self.cache.contains("key1"))
    
    def test_lru_eviction(self):
        """Test LRU eviction policy."""
        # Fill cache
        for i in range(10):
            self.cache.set(f"key{i}", f"value{i}")
        
        # Access some keys to update LRU order
        for i in [0, 2, 4, 6, 8]:
            self.cache.get(f"key{i}")
        
        # Add one more to trigger eviction
        self.cache.set("new_key", "new_value")
        
        # LRU keys should be evicted first (1, 3, 5, 7, 9)
        self.assertIsNone(self.cache.get("key1"))
        self.assertIsNone(self.cache.get("key3"))
        self.assertIsNotNone(self.cache.get("key0"))
        self.assertIsNotNone(self.cache.get("key8"))
        self.assertIsNotNone(self.cache.get("new_key"))
    
    def test_clear(self):
        """Test clearing the cache."""
        # Add some entries
        for i in range(5):
            self.cache.set(f"key{i}", f"value{i}")
        
        # Clear
        self.cache.clear()
        
        # All should be gone
        for i in range(5):
            self.assertIsNone(self.cache.get(f"key{i}"))
    
    def test_stats(self):
        """Test cache statistics."""
        # Add some entries
        for i in range(5):
            self.cache.set(f"key{i}", f"value{i}")
        
        # Generate hits and misses
        for i in range(10):
            self.cache.get(f"key{i % 5}")
        
        # Check stats
        stats = self.cache.get_stats()
        self.assertEqual(stats["size"], 5)
        self.assertEqual(stats["max_size"], 10)
        self.assertEqual(stats["hits"], 10)
        self.assertEqual(stats["misses"], 0)
        self.assertEqual(stats["evictions"], 0)
        
        # Generate misses
        for i in range(5):
            self.cache.get(f"nonexistent{i}")
        
        # Check updated stats
        stats = self.cache.get_stats()
        self.assertEqual(stats["misses"], 5)


class TestPersistentCache(unittest.TestCase):
    """Test the persistent cache implementation."""
    
    def setUp(self):
        """Set up a fresh cache for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = PersistentCache(
            cache_dir=self.temp_dir,
            max_size=10,
            default_ttl=60,
            flush_interval=0.1  # Short interval for testing
        )
    
    def tearDown(self):
        """Clean up after each test."""
        shutil.rmtree(self.temp_dir)
    
    def test_basic_operations(self):
        """Test basic cache operations (get, set, delete, contains)."""
        # Set and get
        self.cache.set("key1", "value1")
        self.assertEqual(self.cache.get("key1"), "value1")
        
        # Get with default
        self.assertEqual(self.cache.get("nonexistent", "default"), "default")
        
        # Contains
        self.assertTrue(self.cache.contains("key1"))
        self.assertFalse(self.cache.contains("nonexistent"))
        
        # Delete
        self.assertTrue(self.cache.delete("key1"))
        self.assertFalse(self.cache.contains("key1"))
        self.assertFalse(self.cache.delete("nonexistent"))
    
    def test_persistence(self):
        """Test that entries persist after cache is reloaded."""
        # Set some values
        self.cache.set("key1", "value1")
        self.cache.set("key2", "value2")
        
        # Force flush
        self.cache.flush()
        
        # Create new cache instance with same directory
        new_cache = PersistentCache(
            cache_dir=self.temp_dir,
            max_size=10,
            default_ttl=60
        )
        
        # Values should still be there
        self.assertEqual(new_cache.get("key1"), "value1")
        self.assertEqual(new_cache.get("key2"), "value2")
    
    def test_ttl_expiration(self):
        """Test that entries expire based on TTL."""
        # Set with short TTL
        self.cache.set("key1", "value1", ttl=0.1)
        self.assertEqual(self.cache.get("key1"), "value1")
        
        # Wait for expiration
        time.sleep(0.2)
        
        # Should be expired
        self.assertIsNone(self.cache.get("key1"))
        self.assertFalse(self.cache.contains("key1"))
    
    def test_clear(self):
        """Test clearing the cache."""
        # Add some entries
        for i in range(5):
            self.cache.set(f"key{i}", f"value{i}")
        
        # Force flush
        self.cache.flush()
        
        # Verify files exist
        self.assertTrue(any(Path(self.temp_dir).glob("entry_*")))
        
        # Clear
        self.cache.clear()
        
        # All should be gone from memory
        for i in range(5):
            self.assertIsNone(self.cache.get(f"key{i}"))
        
        # All files should be gone
        self.assertFalse(any(Path(self.temp_dir).glob("entry_*")))


class TestCacheDecorator(unittest.TestCase):
    """Test the cache decorator."""
    
    def setUp(self):
        """Set up for each test."""
        # Reset function call counter
        self.call_count = 0
    
    def test_basic_caching(self):
        """Test basic function caching."""
        @cached(ttl=60)
        def expensive_function(a, b):
            self.call_count += 1
            return a + b
        
        # First call should execute the function
        result1 = expensive_function(1, 2)
        self.assertEqual(result1, 3)
        self.assertEqual(self.call_count, 1)
        
        # Second call with same args should use cache
        result2 = expensive_function(1, 2)
        self.assertEqual(result2, 3)
        self.assertEqual(self.call_count, 1)  # Still 1
        
        # Call with different args should execute again
        result3 = expensive_function(2, 3)
        self.assertEqual(result3, 5)
        self.assertEqual(self.call_count, 2)
    
    def test_cache_invalidation(self):
        """Test cache invalidation."""
        @cached(ttl=60, cache_name="test_cache")
        def cached_function(x):
            self.call_count += 1
            return x * 2
        
        # Call function
        result1 = cached_function(5)
        self.assertEqual(result1, 10)
        self.assertEqual(self.call_count, 1)
        
        # Call again (should use cache)
        result2 = cached_function(5)
        self.assertEqual(result2, 10)
        self.assertEqual(self.call_count, 1)  # Still 1
        
        # Invalidate cache
        invalidate_cache("test_cache")
        
        # Call again (should execute again)
        result3 = cached_function(5)
        self.assertEqual(result3, 10)
        self.assertEqual(self.call_count, 2)
    
    def test_cache_info(self):
        """Test cache info method."""
        @cached(ttl=60)
        def cached_function(x):
            self.call_count += 1
            return x * 2
        
        # Call function a few times
        cached_function(1)
        cached_function(1)
        cached_function(2)
        
        # Check cache info
        info = cached_function.cache_info()
        self.assertEqual(info["hits"], 1)
        self.assertEqual(info["misses"], 2)
        self.assertEqual(info["size"], 2)


class TestCacheManager(unittest.TestCase):
    """Test the cache manager."""
    
    def setUp(self):
        """Set up for each test."""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up after each test."""
        shutil.rmtree(self.temp_dir)
    
    def test_get_memory_cache(self):
        """Test getting a memory cache."""
        cache = CacheManager.get_memory_cache(
            name="test_memory_cache",
            max_size=100,
            ttl=60
        )
        
        # Should be a memory cache
        self.assertIsInstance(cache, MemoryCache)
        
        # Should have the right configuration
        self.assertEqual(cache.max_size, 100)
        self.assertEqual(cache.default_ttl, 60)
        
        # Getting the same cache again should return the same instance
        cache2 = CacheManager.get_memory_cache(name="test_memory_cache")
        self.assertIs(cache, cache2)
    
    def test_get_persistent_cache(self):
        """Test getting a persistent cache."""
        cache = CacheManager.get_persistent_cache(
            name="test_persistent_cache",
            cache_dir=self.temp_dir,
            max_size=200,
            ttl=120,
            encrypt=True
        )
        
        # Should be a persistent cache
        self.assertIsInstance(cache, PersistentCache)
        
        # Should have the right configuration
        self.assertEqual(cache.max_size, 200)
        self.assertEqual(cache.default_ttl, 120)
        self.assertTrue(cache.encrypt)
        
        # Getting the same cache again should return the same instance
        cache2 = CacheManager.get_persistent_cache(name="test_persistent_cache")
        self.assertIs(cache, cache2)
    
    def test_invalidate_cache(self):
        """Test invalidating a specific cache."""
        # Create two caches
        cache1 = CacheManager.get_memory_cache(name="cache1")
        cache2 = CacheManager.get_memory_cache(name="cache2")
        
        # Add some data
        cache1.set("key1", "value1")
        cache2.set("key2", "value2")
        
        # Invalidate one cache
        result = CacheManager.invalidate_cache("cache1")
        self.assertTrue(result)
        
        # cache1 should be empty, cache2 should still have data
        self.assertIsNone(cache1.get("key1"))
        self.assertEqual(cache2.get("key2"), "value2")
    
    def test_invalidate_all_caches(self):
        """Test invalidating all caches."""
        # Create two caches
        cache1 = CacheManager.get_memory_cache(name="cache1")
        cache2 = CacheManager.get_memory_cache(name="cache2")
        
        # Add some data
        cache1.set("key1", "value1")
        cache2.set("key2", "value2")
        
        # Invalidate all caches
        CacheManager.invalidate_all_caches()
        
        # Both caches should be empty
        self.assertIsNone(cache1.get("key1"))
        self.assertIsNone(cache2.get("key2"))
    
    def test_get_cache_stats(self):
        """Test getting cache statistics."""
        # Create two caches
        cache1 = CacheManager.get_memory_cache(name="cache1")
        cache2 = CacheManager.get_memory_cache(name="cache2")
        
        # Add some data and generate hits/misses
        cache1.set("key1", "value1")
        cache1.get("key1")
        cache1.get("nonexistent")
        
        cache2.set("key2", "value2")
        cache2.get("key2")
        
        # Get stats
        stats = CacheManager.get_cache_stats()
        
        # Should have stats for both caches
        self.assertIn("cache1", stats)
        self.assertIn("cache2", stats)
        
        # Stats should be correct
        self.assertEqual(stats["cache1"]["hits"], 1)
        self.assertEqual(stats["cache1"]["misses"], 1)
        self.assertEqual(stats["cache2"]["hits"], 1)
        self.assertEqual(stats["cache2"]["misses"], 0)
    
    def test_initialize_default_caches(self):
        """Test initializing default caches."""
        # Mock config to avoid dependency on actual config
        with mock.patch('alejo.performance.cache.get_config', return_value={"data_dir": self.temp_dir}):
            initialize_default_caches()
        
        # Should have created default caches
        self.assertIn("db_query_cache", CacheManager.get_registered_caches())
        self.assertIn("api_response_cache", CacheManager.get_registered_caches())
        self.assertIn("user_preferences", CacheManager.get_registered_caches())
        self.assertIn("asset_cache", CacheManager.get_registered_caches())


if __name__ == "__main__":
    unittest.main()
