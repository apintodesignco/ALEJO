class EpisodicMemory:
    """A stub implementation for EpisodicMemory. This can be extended with proper memory storage logic."""

    def __init__(self):
        self.events = []

    def store_event(self, event):
        """Store an event into episodic memory."""
        self.events.append(event)

    def get_all_events(self):
        """Return all stored events."""
        return self.events
