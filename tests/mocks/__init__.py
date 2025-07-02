"""
Mock objects for testing ALEJO components
"""

import secrets  # More secure for cryptographic purposes

from .event_bus import Event, EventType, MockEventBus

__all__ = ["MockEventBus", "Event", "EventType"]
