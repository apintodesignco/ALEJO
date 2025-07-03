"""Memory Store Module

This module provides a simple key-value store implementation that leverages
the advanced caching system from the performance module.
"""

from alejo.performance.cache import get_cache, create_memory_cache


class MemoryStore:
    """A memory store implementation that uses the ALEJO caching system.
    
    This provides a simple key-value store interface while leveraging the
    advanced features of the caching system like eviction policies,
    TTL support, and thread safety.
    """

    def __init__(self, namespace="memory_store", max_size=1000, ttl=None):
        """Initialize a new memory store.
        
        Args:
            namespace: The namespace for this memory store (used as cache name)
            max_size: Maximum number of items to store
            ttl: Time-to-live for items in seconds (None for no expiration)
        """
        # Try to get an existing cache with this namespace or create a new one
        try:
            self.cache = get_cache(namespace)
        except KeyError:
            self.cache = create_memory_cache(
                name=namespace,
                max_size=max_size,
                ttl_seconds=ttl
            )

    def set(self, key, value):
        """Store a value by key.
        
        Args:
            key: The key to store the value under
            value: The value to store
        """
        self.cache.set(key, value)

    def get(self, key, default=None):
        """Retrieve a value by key.
        
        Args:
            key: The key to retrieve
            default: Value to return if key is not found
            
        Returns:
            The stored value or the default if not found
        """
        return self.cache.get(key, default)
        
    def delete(self, key):
        """Delete a value by key.
        
        Args:
            key: The key to delete
            
        Returns:
            True if the key was deleted, False if it didn't exist
        """
        return self.cache.delete(key)
        
    def clear(self):
        """Clear all values from the store."""
        self.cache.clear()
