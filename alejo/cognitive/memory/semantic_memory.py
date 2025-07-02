class SemanticMemory:
    """A stub implementation for SemanticMemory. This can be extended with semantics storage and retrieval logic."""

    def __init__(self):
        self.data = []

    def add_entry(self, entry):
        """Store an entry into semantic memory."""
        self.data.append(entry)

    def get_entries(self):
        """Return all stored entries."""
        return self.data
