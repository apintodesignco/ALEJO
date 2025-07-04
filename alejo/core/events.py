"""
ALEJO - Advanced Language and Execution Joint Operator
Core event system for communication between components
"""

from dataclasses import dataclass
from enum import Enum, auto
import asyncio
import logging
from typing import Any, Dict, Optional, List, Callable, Set, Coroutine


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


# Type aliases for callback functions

EventCallback = Callable[[Event], Coroutine[Any, Any, bool]]
EventFilter = Callable[[Event], bool]


class EventBus:
    """
    Asynchronous event bus for ALEJO system communication

    Provides a publish-subscribe mechanism for components to communicate
    with each other through events. Subscribers can filter events by type,
    source, or custom filter functions.
    """
    _instance = None

    @classmethod
    def get_instance(cls):
        """
        Get the singleton instance of the EventBus

        Returns:
            The EventBus singleton instance
        """
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventBus, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._subscribers: Dict[str, List[Dict[str, Any]]] = {}
        self._topics: Set[str] = set()
        self._logger = logging.getLogger(__name__)
        self._initialized = True

    @property
    def topics(self) -> List[str]:
        """Get list of all active topics"""
        return list(self._topics)

    async def publish(self, event: Event, topic: str = "global") -> None:
        """
        Publish an event to all subscribers of the given topic

        Args:
            event: The event to publish
            topic: The topic to publish to (default: "global")
        """
        self._topics.add(topic)

        if topic not in self._subscribers:
            return

        tasks = []
        for subscriber in self._subscribers[topic]:
            callback = subscriber["callback"]
            event_filter = subscriber.get("filter")

            # Apply filter if provided
            if event_filter and not event_filter(event):
                continue

            # Schedule the callback
            try:
                tasks.append(asyncio.create_task(callback(event)))
            except Exception as e:
                self._logger.error(f"Error scheduling event callback: {e}")

        # Wait for all callbacks to complete
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def subscribe(
        self,
        callback: EventCallback,
        topic: str = "global",
        event_filter: Optional[EventFilter] = None
    ) -> str:
        """
        Subscribe to events on a specific topic with optional filtering

        Args:
            callback: Async function to call when an event is published
            topic: Topic to subscribe to (default: "global")
            event_filter: Optional function to filter events

        Returns:
            Subscription ID that can be used to unsubscribe
        """
        import uuid

        if topic not in self._subscribers:
            self._subscribers[topic] = []
            self._topics.add(topic)

        subscription_id = str(uuid.uuid4())
        self._subscribers[topic].append({
            "id": subscription_id,
            "callback": callback,
            "filter": event_filter
        })

        self._logger.debug(f"Subscribed to {topic} with ID {subscription_id}")
        return subscription_id

    async def subscribe_by_type(
        self,
        callback: EventCallback,
        event_type: EventType,
        topic: str = "global"
    ) -> str:
        """
        Subscribe to events of a specific type

        Args:
            callback: Async function to call when an event is published
            event_type: Type of events to subscribe to
            topic: Topic to subscribe to (default: "global")

        Returns:
            Subscription ID that can be used to unsubscribe
        """
        self._logger.debug(
            f"Subscribing to events of type {event_type.name} on topic {topic}"
        )
        return await self.subscribe(
            callback,
            topic,
            lambda event: event.type == event_type
        )

    async def subscribe_by_source(
        self,
        callback: EventCallback,
        source: str,
        topic: str = "global"
    ) -> str:
        """
        Subscribe to events from a specific source

        Args:
            callback: Async function to call when an event is published
            source: Source of events to subscribe to
            topic: Topic to subscribe to (default: "global")

        Returns:
            Subscription ID that can be used to unsubscribe
        """
        self._logger.debug(
            f"Subscribing to events from source {source} on topic {topic}"
        )
        return await self.subscribe(
            callback,
            topic,
            lambda event: event.source == source
        )

    async def unsubscribe(self, subscription_id: str) -> bool:
        """
        Unsubscribe from events using the subscription ID

        Args:
            subscription_id: ID returned from subscribe method

        Returns:
            True if successfully unsubscribed, False otherwise
        """
        for topic, subscribers in self._subscribers.items():
            for i, subscriber in enumerate(subscribers):
                if subscriber["id"] == subscription_id:
                    self._subscribers[topic].pop(i)
                    self._logger.debug(
                        f"Unsubscribed ID {subscription_id} from topic {topic}"
                    )
                    return True
        self._logger.debug(
            f"Failed to unsubscribe ID {subscription_id}: not found"
        )
        return False

    def unsubscribe_all(self, topic: Optional[str] = None) -> None:
        """
        Unsubscribe all callbacks from a topic or all topics

        Args:
            topic: Topic to clear subscribers from, or None for all topics
        """
        if topic is None:
            self._subscribers.clear()
        elif topic in self._subscribers:
            self._subscribers[topic] = []
