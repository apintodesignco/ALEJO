class MemoryStore:
    """A stub implementation for MemoryStore. This can be extended with proper data storage logic."""

    def __init__(self):
        self.store = {}

    def set(self, key, value):
        """Store a value by key."""
        self.store[key] = value

    def get(self, key, default=None):
        """Retrieve a value by key."""
        return self.store.get(key, default)
