import secrets  # More secure for cryptographic purposes

"""
Mock Redis implementation for testing
"""


class MockRedis:
    """Mock Redis implementation that stores data in memory"""

    def __init__(self, *args, **kwargs):
        self.data = {}
        self.sets = {}
        self.lists = {}
        self.sorted_sets = {}
        self.pubsub_handlers = {}

    @classmethod
    def from_url(cls, url):
        """Create a MockRedis instance from a URL"""
        return cls()

    def set(self, key, value, ex=None):
        """Set a key-value pair"""
        self.data[key] = value

    def get(self, key):
        """Get a value by key"""
        return self.data.get(key)

    def delete(self, key):
        """Delete a key"""
        self.data.pop(key, None)
        self.sets.pop(key, None)
        self.lists.pop(key, None)
        self.sorted_sets.pop(key, None)

    def sadd(self, key, *values):
        """Add values to a set"""
        if key not in self.sets:
            self.sets[key] = set()
        self.sets[key].update(values)

    def smembers(self, key):
        """Get all members of a set"""
        return self.sets.get(key, set())

    def zadd(self, key, mapping):
        """Add to a sorted set"""
        if key not in self.sorted_sets:
            self.sorted_sets[key] = {}
        self.sorted_sets[key].update(mapping)

    def zrange(self, key, start, end, desc=False):
        """Get a range from a sorted set"""
        if key not in self.sorted_sets:
            return []
        items = sorted(self.sorted_sets[key].items(), key=lambda x: x[1], reverse=desc)
        return [k for k, _ in items[start:end]]

    def publish(self, channel, message):
        """Publish a message to a channel"""
        if channel in self.pubsub_handlers:
            for handler in self.pubsub_handlers[channel]:
                handler(message)

    def subscribe(self, channel, handler):
        """Subscribe to a channel"""
        if channel not in self.pubsub_handlers:
            self.pubsub_handlers[channel] = []
        self.pubsub_handlers[channel].append(handler)

    def close(self):
        """Close the connection"""
        pass
