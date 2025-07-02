class WorkingMemory:
    """A stub implementation for WorkingMemory. This can be extended with temporary memory caching logic."""

    def __init__(self):
        self.cache = []

    def add_item(self, item):
        """Add an item to the working memory."""
        self.cache.append(item)

    def get_items(self):
        """Return all items in the working memory."""
        return self.cache
