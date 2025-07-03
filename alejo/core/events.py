"""
ALEJO - Advanced Language and Execution Joint Operator
Core event system for communication between components
"""

from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Dict, Optional


class EventType(Enum):
    """Standard event types for the ALEJO system"""
    SYSTEM_STARTUP = auto()
    SYSTEM_SHUTDOWN = auto()
    USER_INPUT = auto()
    USER_COMMAND = auto()
    VOICE_DETECTED = auto()
    GESTURE_DETECTED = auto()
    FACE_DETECTED = auto()
    EMOTION_DETECTED = auto()
    ERROR_OCCURRED = auto()
    MODEL_LOADED = auto()
    RESPONSE_GENERATED = auto()
    SECURITY_ALERT = auto()
    ETHICAL_DECISION = auto()
    MEMORY_UPDATED = auto()
    CONFIG_CHANGED = auto()
    NOTIFICATION = auto()
    TIMER = auto()
    CUSTOM = auto()


@dataclass
class Event:
    """
    Standard event object for communication between ALEJO components
    """
    type: EventType
    source: str
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[float] = None
    
    def __post_init__(self):
        """Auto-populate timestamp if not provided"""
        import time
        if self.timestamp is None:
            self.timestamp = time.time()
        
        if self.data is None:
            self.data = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary representation"""
        return {
            "type": self.type.name,
            "source": self.source,
            "data": self.data,
            "timestamp": self.timestamp
        }
    
    @classmethod
    def from_dict(cls, event_dict: Dict[str, Any]) -> 'Event':
        """Create an Event from a dictionary representation"""
        return cls(
            type=EventType[event_dict["type"]],
            source=event_dict["source"],
            data=event_dict.get("data", {}),
            timestamp=event_dict.get("timestamp")
        )
