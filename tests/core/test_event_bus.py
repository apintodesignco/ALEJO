"""Tests for enhanced EventBus with prioritization and retry mechanisms"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
import redis.exceptions

from alejo.core.event_bus import EventBus, Event, EventType
from alejo.utils.exceptions import EventBusError

@pytest.fixture
async def event_bus():
    """Create a test event bus instance"""
    bus = EventBus("redis://localhost:6379/0")
    await bus.start()
    yield bus
    await bus.stop()

@pytest.mark.asyncio
async def test_event_prioritization(event_bus):
    """Test that events are processed in priority order"""
    # Create events with different priorities
    events = [
        Event(EventType.ERROR, {"error": "Critical error"}, priority=1),
        Event(EventType.SYSTEM, {"status": "System update"}, priority=2),
        Event(EventType.COMMAND, {"command": "test"}, priority=3)
    ]
    
    # Track processed events
    processed_events = []
    
    async def track_event(event):
        processed_events.append(event)
    
    # Subscribe to all event types
    for event_type in EventType:
        event_bus.subscribe(event_type, track_event)
    
    # Publish events in reverse priority order
    for event in reversed(events):
        await event_bus.publish(event)
    
    # Wait for events to be processed
    await asyncio.sleep(0.1)
    
    # Verify events were processed in priority order
    assert len(processed_events) == len(events)
    for i in range(len(processed_events) - 1):
        assert processed_events[i].priority <= processed_events[i + 1].priority

@pytest.mark.asyncio
async def test_event_retry_mechanism(event_bus):
    """Test that failed events are retried"""
    # Mock Redis publish to fail initially
    fail_count = 0
    original_publish = event_bus.redis_client.publish
    
    def failing_publish(*args, **kwargs):
        nonlocal fail_count
        if fail_count < 2:
            fail_count += 1
            raise redis.exceptions.RedisError("Test error")
        return original_publish(*args, **kwargs)
    
    with patch.object(event_bus.redis_client, 'publish', failing_publish):
        # Create test event
        event = Event(EventType.COMMAND, {"command": "test"})
        
        # Track retries
        retried_events = []
        
        async def track_retry(event):
            retried_events.append(event)
        
        event_bus.subscribe(EventType.COMMAND, track_retry)
        
        # Publish event
        await event_bus.publish(event)
        
        # Wait for retries
        await asyncio.sleep(0.5)  # Allow time for exponential backoff
        
        # Verify event was retried and eventually succeeded
        assert len(retried_events) == 1
        assert retried_events[0].retry_count == 2

@pytest.mark.asyncio
async def test_event_retry_exhaustion(event_bus):
    """Test that events are dropped after max retries"""
    # Mock Redis publish to always fail
    with patch.object(event_bus.redis_client, 'publish', 
                     side_effect=redis.exceptions.RedisError("Test error")):
        # Create test event
        event = Event(EventType.COMMAND, {"command": "test"}, max_retries=2)
        
        # Track failed events
        failed_events = []
        
        async def track_failure(event):
            failed_events.append(event)
        
        event_bus.subscribe(EventType.COMMAND, track_failure)
        
        # Publish event
        await event_bus.publish(event)
        
        # Wait for retries to exhaust
        await asyncio.sleep(1)  # Allow time for exponential backoff
        
        # Verify event was dropped after max retries
        assert len(failed_events) == 0  # Event should not have been delivered
        # Check logs for failure message (would require log capture fixture)

@pytest.mark.asyncio
async def test_graceful_shutdown(event_bus):
    """Test that event bus shuts down gracefully"""
    # Queue some events
    events = [
        Event(EventType.COMMAND, {"command": "test1"}),
        Event(EventType.COMMAND, {"command": "test2"}),
        Event(EventType.COMMAND, {"command": "test3"})
    ]
    
    for event in events:
        await event_bus.publish(event)
    
    # Immediately initiate shutdown
    await event_bus.stop()
    
    # Verify queues are empty
    assert event_bus._priority_queue.empty()
    assert event_bus._retry_queue.empty()
    assert not event_bus.running
    
    # Verify tasks are cancelled
    for task in event_bus._processing_tasks:
        assert task.cancelled()

@pytest.mark.asyncio
async def test_event_bus_recovery(event_bus):
    """Test that event bus recovers from Redis connection issues"""
    # Mock Redis to temporarily fail
    original_publish = event_bus.redis_client.publish
    fail_next = True
    
    def intermittent_publish(*args, **kwargs):
        nonlocal fail_next
        if fail_next:
            fail_next = False
            raise redis.exceptions.ConnectionError("Test connection error")
        return original_publish(*args, **kwargs)
    
    with patch.object(event_bus.redis_client, 'publish', intermittent_publish):
        # Create and track test events
        events = []
        
        async def track_event(event):
            events.append(event)
        
        event_bus.subscribe(EventType.COMMAND, track_event)
        
        # Publish test event
        test_event = Event(EventType.COMMAND, {"command": "test"})
        await event_bus.publish(test_event)
        
        # Wait for retry and recovery
        await asyncio.sleep(0.5)
        
        # Verify event was eventually delivered
        assert len(events) == 1
        assert events[0].data["command"] == "test"
