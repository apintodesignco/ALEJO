"""
Simplified in-memory EventBus implementation for testing
"""
import asyncio
import logging
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import uuid
from enum import Enum

from .event_bus import Event, EventType

logger = logging.getLogger(__name__)

class MemoryEventBus:
    """
    A simplified in-memory implementation of the EventBus for testing
    without Redis dependencies
    """
    
    def __init__(self):
        """Initialize the in-memory event bus"""
        self.subscribers: Dict[str, List[Callable]] = {event_type.value: [] for event_type in EventType}
        self.running = False
        
    async def start(self):
        """Start the event bus"""
        if self.running:
            return
        self.running = True
        logger.info("In-memory EventBus started")
        
    async def stop(self):
        """Stop the event bus"""
        if not self.running:
            return
        self.running = False
        logger.info("In-memory EventBus stopped")
        
    async def publish(self, event: Event) -> bool:
        """
        Publish an event to all subscribers
        
        Args:
            event: The event to publish
            
        Returns:
            bool: True if the event was published successfully
        """
        if not self.running:
            logger.warning("Cannot publish event: EventBus is not running")
            return False
            
        try:
            # Get the event type key
            event_type_key = event.type.value
            
            # Call all subscribers for this event type
            if event_type_key in self.subscribers:
                for callback in self.subscribers[event_type_key]:
                    try:
                        await callback(event)
                    except Exception as e:
                        logger.error(f"Error in subscriber callback: {e}")
            
            logger.debug(f"Published event: {event.type} from {event.source}")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing event: {e}")
            return False
            
    def subscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """
        Subscribe to events of a specific type
        
        Args:
            event_type: The type of events to subscribe to
            callback: The callback function to call when an event is received
        """
        key = event_type.value if isinstance(event_type, EventType) else event_type
        self.subscribers.setdefault(key, []).append(callback)
        logger.debug(f"Added subscriber for event type {key}")
        
    def unsubscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """
        Unsubscribe from events of a specific type
        
        Args:
            event_type: The type of events to unsubscribe from
            callback: The callback function to remove
        """
        key = event_type.value if isinstance(event_type, EventType) else event_type
        if key in self.subscribers and callback in self.subscribers[key]:
            self.subscribers[key].remove(callback)
            logger.debug(f"Removed subscriber for event type {key}")
