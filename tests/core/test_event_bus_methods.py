"""Tests for EventBus internal methods that were recently fixed"""

import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from alejo.core.event_bus import EventBus, Event, EventType, EventBusError
import secrets  # More secure for cryptographic purposes

@pytest.fixture
async def event_bus():
    """Create a test event bus instance in test mode to avoid real Redis connection"""
    bus = EventBus(test_mode=True)
    await bus.start()
    yield bus
    await bus.stop()

@pytest.mark.asyncio
async def test_message_listener():
    """Test that message listener correctly processes messages"""
    # Create event bus with mocked pubsub
    bus = EventBus(test_mode=True)
    await bus.start()
    
    # Mock the pubsub object
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.get_message = AsyncMock()
    
    # Set up message data
    test_event_data = {
        "type": EventType.COMMAND.value,
        "payload": {"command": "test"},
        "timestamp": datetime.now().isoformat(),
        "source": "test",
        "correlation_id": "test-123",
        "priority": 1
    }
    
    encoded_data = json.dumps(test_event_data).encode('utf-8')
    mock_message = {
        'type': 'message', 
        'data': encoded_data,
        'channel': EventType.COMMAND.value
    }
    
    # Configure mock to return our message and then None
    mock_pubsub.get_message.side_effect = [mock_message, None]
    bus._pubsub = mock_pubsub
    
    # Mock the handle_message method
    bus._handle_message = AsyncMock()
    
    # Run the message listener for a short time
    bus.running = True
    listener_task = asyncio.create_task(bus._message_listener())
    await asyncio.sleep(0.1)  # Give some time for processing
    
    # Stop the listener
    bus.running = False
    await listener_task
    
    # Verify message listener behavior
    assert mock_pubsub.subscribe.call_count == len(EventType), "Should subscribe to all event types"
    assert bus._handle_message.called, "Should call handle_message with the received message"
    bus._handle_message.assert_called_with(mock_message)
    
    # Cleanup
    await bus.stop()

@pytest.mark.asyncio
async def test_handle_message():
    """Test handling of incoming messages from Redis"""
    # Create event bus
    bus = EventBus(test_mode=True)
    await bus.start()
    
    # Set up callback tracking
    callback_async = AsyncMock()
    callback_sync = Mock()
    
    # Subscribe to test event type
    bus.subscribe(EventType.COMMAND, callback_async)
    bus.subscribe(EventType.COMMAND, callback_sync)
    
    # Create a test message
    test_event_data = {
        "type": EventType.COMMAND.value,
        "payload": {"command": "test"},
        "timestamp": datetime.now().isoformat(),
        "source": "test",
        "correlation_id": "test-123"
    }
    encoded_data = json.dumps(test_event_data).encode('utf-8')
    message = {
        'type': 'message', 
        'data': encoded_data,
        'channel': EventType.COMMAND.value
    }
    
    # Process the message
    await bus._handle_message(message)
    
    # Verify callbacks were called
    assert callback_async.called, "Async callback should be called"
    # For sync callback, need to verify it was scheduled to run in executor
    await asyncio.sleep(0.1)  # Allow time for executor to run
    assert callback_sync.called, "Sync callback should be called"
    
    # Verify callback arguments
    callback_args = callback_async.call_args[0][0]
    assert callback_args.type == EventType.COMMAND
    assert callback_args.payload == {"command": "test"}
    assert callback_args.source == "test"
    assert callback_args.correlation_id == "test-123"
    
    # Test error handling by passing invalid message
    invalid_message = {'type': 'message', 'data': b'invalid-json'}
    await bus._handle_message(invalid_message)  # Should not raise exception
    
    # Cleanup
    await bus.stop()

@pytest.mark.asyncio
async def test_process_priority_queue():
    """Test processing events from priority queue"""
    bus = EventBus(test_mode=True)
    await bus.start()
    
    # Mock the priority queue and publish method
    bus._priority_queue = AsyncMock()
    bus._publish_to_redis = AsyncMock()
    
    # Configure mock to return test events and then raise CancelledError
    test_event = Event(type=EventType.COMMAND, payload={"command": "test"})
    bus._priority_queue.get.side_effect = [
        (1, test_event),  # First call returns event with priority 1
        asyncio.CancelledError()  # Second call raises CancelledError to exit loop
    ]
    
    # Set success for first publish
    bus._publish_to_redis.return_value = True
    
    # Run the priority queue processor
    bus.running = True
    try:
        await bus._process_priority_queue()
    except asyncio.CancelledError:
        pass  # Expected
        
    # Verify behavior
    assert bus._priority_queue.get.called
    assert bus._publish_to_redis.called
    bus._publish_to_redis.assert_called_with(test_event)
    assert bus._priority_queue.task_done.called
    
    # Test retry logic
    bus._priority_queue.get.side_effect = [
        (1, test_event),  # Return event
        asyncio.CancelledError()  # Exit loop
    ]
    bus._publish_to_redis.return_value = False  # Publish fails
    test_event.retry_count = 0
    test_event.max_retries = 3
    
    try:
        await bus._process_priority_queue()
    except asyncio.CancelledError:
        pass  # Expected
        
    # Cleanup
    await bus.stop()

@pytest.mark.asyncio
async def test_get_redis_client():
    """Test getting a Redis client from the pool"""
    # Mock redis asyncio module
    mock_redis = MagicMock()
    mock_redis_client = MagicMock()
    mock_redis.Redis.return_value = mock_redis_client
    
    with patch('alejo.core.event_bus.get_redis_asyncio', return_value=mock_redis):
        bus = EventBus()
        await bus.start()
        
        # Initialize Redis pool manually since we're mocking
        bus._redis_pool = MagicMock()
        
        # Test normal operation
        async with bus._get_redis_client() as client:
            assert client == mock_redis_client, "Should return Redis client"
        
        # Client close should be called in finally block
        assert mock_redis_client.close.called
        
        # Test error handling
        mock_redis.Redis.side_effect = Exception("Redis connection error")
        
        with pytest.raises(EventBusError):
            async with bus._get_redis_client():
                pass  # Should not reach here
                
        # Pool disconnect should be called on error
        assert bus._redis_pool.disconnect.called
        
        # Cleanup
        await bus.stop()

@pytest.mark.asyncio
async def test_init_redis_test_mode():
    """Test initializing Redis in test mode"""
    bus = EventBus(test_mode=True)
    
    # Test that _init_redis doesn't do anything in test mode
    await bus._init_redis()
    assert bus._redis_pool is None, "Should not create Redis pool in test mode"
    
    # Test that operations that require Redis raise appropriate error in test mode
    with pytest.raises(EventBusError):
        async with bus._get_redis_client():
            pass

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])