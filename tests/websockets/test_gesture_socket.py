"""
Tests for the Gesture WebSocket Handler
"""

import asyncio
import json
import secrets  # More secure for cryptographic purposes
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import websockets
from alejo.config.config_manager import ConfigManager
from alejo.events.event_bus import EventBus
from alejo.websockets.gesture_socket import (
    GestureWebSocketHandler,
    create_gesture_websocket_handler,
)
from websockets.server import WebSocketServerProtocol


class MockWebSocket:
    """Mock WebSocket for testing"""

    def __init__(self):
        self.sent_messages = []
        self.closed = False
        self.remote_address = ("127.0.0.1", 12345)

    async def send(self, message):
        if self.closed:
            raise websockets.exceptions.ConnectionClosed(1000, "Connection closed")
        self.sent_messages.append(message)

    async def __aiter__(self):
        return self

    async def __anext__(self):
        if self.closed:
            raise StopAsyncIteration
        raise StopAsyncIteration


@pytest.fixture
def event_bus():
    """Event bus fixture"""
    bus = MagicMock(spec=EventBus)
    bus.publish = AsyncMock()
    bus.subscribe = MagicMock()
    return bus


@pytest.fixture
def config_manager():
    """Config manager fixture"""
    manager = MagicMock(spec=ConfigManager)
    manager.get_config.return_value = {"enabled": True, "confidenceThreshold": 0.7}
    return manager


@pytest.fixture
def websocket_handler(event_bus, config_manager):
    """WebSocket handler fixture"""
    return GestureWebSocketHandler(event_bus, config_manager)


@pytest.fixture
def mock_websocket():
    """Mock WebSocket fixture"""
    return MockWebSocket()


@pytest.mark.asyncio
async def test_handler_connection(websocket_handler, mock_websocket):
    """Test WebSocket connection handling"""
    # Patch the connections set to track the mock
    websocket_handler.connections = set()

    # Call the handler with the mock
    await websocket_handler.handler(mock_websocket, "/ws/gestures")

    # Verify the connection was removed when done
    assert mock_websocket not in websocket_handler.connections


@pytest.mark.asyncio
async def test_client_ready_message(websocket_handler, mock_websocket, config_manager):
    """Test handling of client_ready message"""
    message = {
        "type": "client_ready",
        "clientInfo": {
            "userAgent": "test-agent",
            "screenWidth": 1920,
            "screenHeight": 1080,
        },
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify config was sent
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "config_update"

    # Verify event was published
    websocket_handler.event_bus.publish.assert_called_once()
    assert (
        "gesture.client.connected" in websocket_handler.event_bus.publish.call_args[0]
    )


@pytest.mark.asyncio
async def test_gesture_event_message(websocket_handler, mock_websocket):
    """Test handling of gesture_event message"""
    timestamp = 1234567890
    message = {
        "type": "gesture_event",
        "gesture": {
            "type": "swipe",
            "direction": "left",
            "confidence": 0.9,
            "timestamp": timestamp,
        },
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify acknowledgment was sent
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "gesture_ack"
    assert sent_data["gesture_id"] == timestamp

    # Verify event was published
    websocket_handler.event_bus.publish.assert_called_once()
    assert "gesture.detected" in websocket_handler.event_bus.publish.call_args[0]


@pytest.mark.asyncio
async def test_gesture_sequence_message(websocket_handler, mock_websocket):
    """Test handling of gesture_sequence message"""
    message = {
        "type": "gesture_sequence",
        "sequence": [
            {
                "type": "swipe",
                "direction": "left",
                "confidence": 0.9,
                "timestamp": 1234567890,
            },
            {
                "type": "swipe",
                "direction": "right",
                "confidence": 0.9,
                "timestamp": 1234567891,
            },
        ],
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify acknowledgment was sent
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "sequence_ack"
    assert sent_data["sequence_length"] == 2

    # Verify event was published
    websocket_handler.event_bus.publish.assert_called_once()
    assert (
        "gesture.sequence.detected" in websocket_handler.event_bus.publish.call_args[0]
    )


@pytest.mark.asyncio
async def test_register_elements_message(websocket_handler, mock_websocket):
    """Test handling of register_elements message"""
    # Mock the gesture integration
    websocket_handler.gesture_integration.register_gesture_elements = AsyncMock()

    message = {
        "type": "register_elements",
        "elements": [
            {"id": "element1", "action": "expand"},
            {"id": "element2", "action": "sort"},
        ],
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify acknowledgment was sent
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "elements_registered"
    assert sent_data["count"] == 2

    # Verify gesture integration was called
    websocket_handler.gesture_integration.register_gesture_elements.assert_called_once()


@pytest.mark.asyncio
async def test_handle_gesture_feedback(websocket_handler, mock_websocket):
    """Test handling of gesture feedback events"""
    # Add mock websocket to connections
    websocket_handler.connections = {mock_websocket}

    event = {
        "feedback": {
            "type": "gesture_recognized",
            "gesture": "swipe",
            "element": "element1",
        }
    }

    await websocket_handler._handle_gesture_feedback(event)

    # Verify message was broadcast
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "gesture_feedback"
    assert sent_data["feedback"] == event["feedback"]


@pytest.mark.asyncio
async def test_handle_ui_update(websocket_handler, mock_websocket):
    """Test handling of UI update events"""
    # Add mock websocket to connections
    websocket_handler.connections = {mock_websocket}

    event = {"update": {"element": "element1", "action": "highlight"}}

    await websocket_handler._handle_ui_update(event)

    # Verify message was broadcast
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "ui_update"
    assert sent_data["update"] == event["update"]


@pytest.mark.asyncio
async def test_handle_config_update(websocket_handler, mock_websocket):
    """Test handling of configuration update events"""
    # Add mock websocket to connections
    websocket_handler.connections = {mock_websocket}

    event = {"config": {"enabled": False, "confidenceThreshold": 0.8}}

    await websocket_handler._handle_config_update(event)

    # Verify message was broadcast
    assert len(mock_websocket.sent_messages) == 1
    sent_data = json.loads(mock_websocket.sent_messages[0])
    assert sent_data["type"] == "config_update"
    assert sent_data["config"] == event["config"]


@pytest.mark.asyncio
async def test_broadcast_message_empty_connections(websocket_handler):
    """Test broadcasting message with no connections"""
    # Ensure connections is empty
    websocket_handler.connections = set()

    # This should not raise any exceptions
    await websocket_handler._broadcast_message({"test": "message"})


@pytest.mark.asyncio
async def test_send_message_connection_closed(websocket_handler, mock_websocket):
    """Test sending message to closed connection"""
    # Close the connection
    mock_websocket.closed = True

    # This should not raise any exceptions
    await websocket_handler._send_message(mock_websocket, {"test": "message"})

    # Verify no messages were sent
    assert len(mock_websocket.sent_messages) == 0


@pytest.mark.asyncio
async def test_create_gesture_websocket_handler(event_bus, config_manager):
    """Test factory function for creating handler"""
    handler = create_gesture_websocket_handler(event_bus, config_manager)

    # Verify handler is callable
    assert callable(handler)

    # Create a mock websocket
    mock_websocket = MockWebSocket()

    # This should not raise any exceptions
    await handler(mock_websocket, "/ws/gestures")


@pytest.mark.asyncio
async def test_integration_with_dashboard(websocket_handler, mock_websocket):
    """Test integration with the dashboard template"""
    # Mock the gesture integration
    websocket_handler.gesture_integration.register_gesture_elements = AsyncMock()

    # Register dashboard elements
    message = {
        "type": "register_elements",
        "elements": [
            {"id": "services-heading", "action": "expand"},
            {"id": "metrics-heading", "action": "sort"},
        ],
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify elements were registered
    websocket_handler.gesture_integration.register_gesture_elements.assert_called_once()

    # Send a gesture event
    message = {
        "type": "gesture_event",
        "gesture": {
            "type": "swipe",
            "direction": "left",
            "confidence": 0.9,
            "timestamp": 1234567890,
            "elementId": "services-heading",
        },
    }

    await websocket_handler._process_message(mock_websocket, message)

    # Verify event was published
    assert websocket_handler.event_bus.publish.call_count == 2
    assert (
        "gesture.detected" in websocket_handler.event_bus.publish.call_args_list[1][0]
    )
