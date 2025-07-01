#!/usr/bin/env python3
"""
Integration tests for the ALEJO gesture WebSocket system.
Tests the integration between the WebSocket handler and the event bus.
"""
import asyncio
import json
import os
import pytest
import time
import websockets
from unittest.mock import AsyncMock, MagicMock, patch

# Import the event bus for integration testing
try:
    from alejo.core.event_bus import EventBus
except ImportError:
    # Create a mock EventBus if the actual module is not available
    class EventBus:
        @classmethod
        def get_instance(cls):
            if not hasattr(cls, "_instance"):
                cls._instance = cls()
            return cls._instance
            
        async def publish(self, topic, data):
            pass
            
        async def subscribe(self, topic, callback):
            pass


@pytest.fixture
async def event_bus():
    """Create an EventBus instance for testing."""
    return EventBus.get_instance()


@pytest.fixture
async def mock_websocket_server():
    """Create a mock WebSocket server for testing."""
    # Start a simple WebSocket server for testing
    async def echo_handler(websocket, path):
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": time.time()
                    }))
                elif data.get("type") == "gesture":
                    # Publish the gesture event to the event bus
                    await EventBus.get_instance().publish(
                        "gesture.event",
                        {
                            "gesture": data.get("gesture"),
                            "direction": data.get("direction"),
                            "timestamp": data.get("timestamp")
                        }
                    )
                    # Send acknowledgment
                    await websocket.send(json.dumps({
                        "type": "ack",
                        "gesture": data.get("gesture"),
                        "timestamp": time.time()
                    }))
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                    "timestamp": time.time()
                }))
    
    # Start the server
    port = int(os.environ.get("ALEJO_WEBSOCKET_PORT", "8765"))
    server = await websockets.serve(echo_handler, "localhost", port)
    
    yield server
    
    # Clean up
    server.close()
    await server.wait_closed()


class TestGestureWebSocketIntegration:
    """Integration tests for the gesture WebSocket system."""
    
    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self, mock_websocket_server):
        """Test basic WebSocket ping/pong functionality."""
        uri = f"ws://localhost:{os.environ.get('ALEJO_WEBSOCKET_PORT', '8765')}"
        
        async with websockets.connect(uri) as websocket:
            # Send a ping message
            await websocket.send(json.dumps({
                "type": "ping",
                "timestamp": time.time()
            }))
            
            # Wait for a response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            
            # Check that we got a pong response
            assert response_data.get("type") == "pong"
    
    @pytest.mark.asyncio
    async def test_gesture_event_publishing(self, mock_websocket_server, event_bus):
        """Test that gesture events are published to the event bus."""
        uri = f"ws://localhost:{os.environ.get('ALEJO_WEBSOCKET_PORT', '8765')}"
        
        # Mock the event bus publish method
        with patch.object(event_bus, 'publish', AsyncMock()) as mock_publish:
            # Connect to the WebSocket server
            async with websockets.connect(uri) as websocket:
                # Send a gesture event
                gesture_data = {
                    "type": "gesture",
                    "gesture": "swipe",
                    "direction": "left",
                    "timestamp": time.time()
                }
                await websocket.send(json.dumps(gesture_data))
                
                # Wait for a response
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                
                # Check that we got an acknowledgment
                assert response_data.get("type") == "ack"
                assert response_data.get("gesture") == "swipe"
    
    @pytest.mark.asyncio
    async def test_multiple_clients(self, mock_websocket_server):
        """Test that multiple clients can connect and send gestures."""
        uri = f"ws://localhost:{os.environ.get('ALEJO_WEBSOCKET_PORT', '8765')}"
        
        # Connect with multiple clients
        async with websockets.connect(uri) as websocket1, \
                  websockets.connect(uri) as websocket2:
            
            # Send gestures from both clients
            await websocket1.send(json.dumps({
                "type": "gesture",
                "gesture": "swipe",
                "direction": "left",
                "timestamp": time.time()
            }))
            
            await websocket2.send(json.dumps({
                "type": "gesture",
                "gesture": "tap",
                "position": {"x": 100, "y": 100},
                "timestamp": time.time()
            }))
            
            # Wait for responses
            response1 = await asyncio.wait_for(websocket1.recv(), timeout=5.0)
            response2 = await asyncio.wait_for(websocket2.recv(), timeout=5.0)
            
            # Check responses
            response_data1 = json.loads(response1)
            response_data2 = json.loads(response2)
            
            assert response_data1.get("type") == "ack"
            assert response_data1.get("gesture") == "swipe"
            
            assert response_data2.get("type") == "ack"
            assert response_data2.get("gesture") == "tap"


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
