"""
Mock Event Bus for Testing
"""

from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)

class EventType(Enum):
    COMMAND = "command"
    EMOTION = "emotion"
    MEMORY = "memory"
    VISION = "vision"
    VOICE = "voice"
    SYSTEM = "system"
    ERROR = "error"

@dataclass
class Event:
    """Mock event class for testing"""
    type: EventType
    payload: Dict[str, Any]
    timestamp: float
    source: str
    correlation_id: str
    priority: int = 1

class MockEventBus:
    """Mock event bus for testing"""
    
    def __init__(self):
        self.subscribers: Dict[EventType, List[Callable]] = {event_type: [] for event_type in EventType}
        self.published_events: List[Event] = []
        self.running = True
        
    async def start(self):
        """Start the event bus"""
        self.running = True
        
    async def stop(self):
        """Stop the event bus"""
        self.running = False
        self.clear()
        
    async def publish(self, event: Event) -> bool:
        """Mock publish method"""
        if not self.running:
            return False
            
        self.published_events.append(event)
        
        # Notify subscribers
        for callback in self.subscribers[event.type]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                logger.error(f"Error in event handler: {str(e)}")
                
        return True
                    
    def subscribe(self, event_type: EventType, callback: Callable[[Event], None]) -> None:
        """Mock subscribe method"""
        self.subscribers[event_type].append(callback)
        
    def unsubscribe(self, event_type: EventType, callback: Callable[[Event], None]) -> None:
        """Mock unsubscribe method"""
        if callback in self.subscribers[event_type]:
            self.subscribers[event_type].remove(callback)
            
    def clear(self) -> None:
        """Clear all subscriptions and events"""
        self.subscribers = {event_type: [] for event_type in EventType}
        self.published_events.clear()
