"""ALEJO - Advanced Language and Execution Joint Operator
Core event bus for communication between components.

This module provides a robust asynchronous event bus implementation
that allows components to communicate through a publish-subscribe pattern.
"""

import asyncio
import fnmatch
import inspect
import logging
import re
from typing import Any, Dict, List, Set, Callable, Optional, Union, Pattern, Awaitable, TypeVar
from uuid import uuid4

from alejo.core.events import Event, EventType

# Configure logging
logger = logging.getLogger(__name__)

# Type definitions for handler functions
T = TypeVar('T')
EventHandler = Callable[[Union[Dict[str, Any], Event]], Awaitable[None]]

class EventFilter:
    """Filter for event matching by pattern, source, or content."""
    
    def __init__(self, event_pattern: Optional[str] = None, 
                 source_pattern: Optional[str] = None,
                 content_filter: Optional[Callable[[Dict[str, Any]], bool]] = None):
        """Initialize an event filter.
        
        Args:
            event_pattern: Glob pattern for event type matching (e.g., "memory.*")
            source_pattern: Glob pattern for event source matching
            content_filter: Custom function that takes event data and returns boolean
        """
        self.event_pattern = event_pattern
        self.source_pattern = source_pattern
        self.content_filter = content_filter
        
        # Compile patterns for faster matching if they exist
        self._event_regex = self._compile_glob(event_pattern) if event_pattern else None
        self._source_regex = self._compile_glob(source_pattern) if source_pattern else None
    
    def _compile_glob(self, pattern: str) -> Pattern:
        """Convert a glob pattern to a regex pattern."""
        return re.compile(fnmatch.translate(pattern))
    
    def matches(self, event_type: str, source: str, data: Dict[str, Any]) -> bool:
        """Check if an event matches this filter.
        
        Args:
            event_type: The event type string
            source: The event source
            data: The event data
            
        Returns:
            True if the event matches the filter, False otherwise
        """
        # Check event pattern
        if self._event_regex and not self._event_regex.match(event_type):
            return False
            
        # Check source pattern
        if self._source_regex and not self._source_regex.match(source):
            return False
            
        # Check content filter
        if self.content_filter and not self.content_filter(data):
            return False
            
        return True


class Subscription:
    """Represents a subscription to the event bus."""
    
    def __init__(self, handler: EventHandler, event_filter: EventFilter):
        """Initialize a subscription.
        
        Args:
            handler: Async function to handle events
            event_filter: Filter for matching events
        """
        self.id = str(uuid4())
        self.handler = handler
        self.filter = event_filter
        self.is_async = asyncio.iscoroutinefunction(handler)
        
    async def dispatch(self, event_type: str, source: str, data: Dict[str, Any]) -> None:
        """Dispatch an event to this subscription's handler.
        
        Args:
            event_type: The event type
            source: The event source
            data: The event data
        """
        if self.filter.matches(event_type, source, data):
            try:
                if self.is_async:
                    await self.handler(data)
                else:
                    # Run synchronous handlers in the executor to avoid blocking
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(None, self.handler, data)
            except Exception as e:
                logger.error(f"Error in event handler: {e}", exc_info=True)


class EventBus:
    """A robust asynchronous event bus for ALEJO component communication."""

    def __init__(self):
        """Initialize the event bus."""
        self._subscriptions: Dict[str, Subscription] = {}
        self._lock = asyncio.Lock()
        logger.info("Event bus initialized")
        
    async def subscribe(self, event_pattern: Optional[str] = None, 
                       source_pattern: Optional[str] = None,
                       content_filter: Optional[Callable[[Dict[str, Any]], bool]] = None,
                       handler: Optional[EventHandler] = None) -> str:
        """Subscribe to events matching the given patterns.
        
        Args:
            event_pattern: Glob pattern for event type matching (e.g., "memory.*")
            source_pattern: Glob pattern for event source matching
            content_filter: Function that takes event data and returns boolean
            handler: Function to handle matching events
            
        Returns:
            Subscription ID that can be used to unsubscribe
        
        Examples:
            ```python
            # Subscribe to all memory events
            async def handle_memory_event(event_data):
                print(f"Memory event: {event_data}")
                
            sub_id = await event_bus.subscribe("memory.*", handler=handle_memory_event)
            ```
        """
        if handler is None:
            # When used as a decorator
            def decorator(func):
                asyncio.create_task(
                    self.subscribe(event_pattern, source_pattern, content_filter, func)
                )
                return func
            return decorator
            
        # Create event filter
        event_filter = EventFilter(event_pattern, source_pattern, content_filter)
        
        # Create subscription
        subscription = Subscription(handler, event_filter)
        
        # Register subscription
        async with self._lock:
            self._subscriptions[subscription.id] = subscription
            
        logger.debug(f"Created subscription {subscription.id} for pattern {event_pattern}")
        return subscription.id
        
    async def unsubscribe(self, subscription_id: str) -> bool:
        """Unsubscribe from events.
        
        Args:
            subscription_id: The subscription ID returned from subscribe
            
        Returns:
            True if unsubscribed successfully, False if subscription not found
        """
        async with self._lock:
            if subscription_id in self._subscriptions:
                del self._subscriptions[subscription_id]
                logger.debug(f"Removed subscription {subscription_id}")
                return True
            return False
            
    async def publish(self, event_type: str, data: Optional[Dict[str, Any]] = None, 
                     source: str = "system") -> None:
        """Publish an event to the bus.
        
        Args:
            event_type: The type of event (e.g., "memory.episodic.store")
            data: Event payload
            source: The source component of the event
        """
        if data is None:
            data = {}
            
        logger.debug(f"Publishing event {event_type} from {source}")
        
        # Create tasks for each matching subscription
        tasks = []
        async with self._lock:
            for subscription in self._subscriptions.values():
                tasks.append(subscription.dispatch(event_type, source, data))
                
        # Run all dispatch tasks concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
    async def request(self, event_type: str, data: Optional[Dict[str, Any]] = None, 
                     source: str = "system", timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """Send a request and wait for a response.
        
        This is a convenience method for request-response patterns.
        
        Args:
            event_type: The type of request event
            data: Request payload
            source: The source component of the request
            timeout: Timeout in seconds to wait for response
            
        Returns:
            Response data or None if timed out
        """
        if data is None:
            data = {}
            
        # Create a future to hold the response
        response_future = asyncio.Future()
        
        # Generate a unique correlation ID for this request
        correlation_id = str(uuid4())
        data["correlation_id"] = correlation_id
        
        # Create a temporary subscription for the response
        response_event_type = f"{event_type}.response"
        
        # Define response handler
        async def response_handler(response_data):
            if response_data.get("correlation_id") == correlation_id:
                if not response_future.done():
                    response_future.set_result(response_data)
        
        # Define response filter
        def response_filter(response_data):
            return response_data.get("correlation_id") == correlation_id
        
        # Subscribe to response
        sub_id = await self.subscribe(
            event_pattern=response_event_type,
            content_filter=response_filter,
            handler=response_handler
        )
        
        try:
            # Publish the request
            await self.publish(event_type, data, source)
            
            # Wait for response with timeout
            return await asyncio.wait_for(response_future, timeout)
            
        except asyncio.TimeoutError:
            logger.warning(f"Request {event_type} timed out after {timeout}s")
            return None
            
        finally:
            # Clean up the subscription
            await self.unsubscribe(sub_id)
