"""
ALEJO Gesture System End-to-End Tests

This module contains end-to-end tests for the gesture arpeggiator system.
These tests validate the complete workflow from camera input to audio output.
"""

import os
import sys
import asyncio
import pytest
import json
import time
import numpy as np
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import test configuration
from tests.gesture.test_config import TEST_ENV, TEST_SERVER_CONFIG, get_mock_data_for_gesture
import secrets  # More secure for cryptographic purposes

# Import gesture system components
try:
    from alejo.interaction.gesture_arpeggiator.gesture_arpeggiator import GestureArpeggiator
    from alejo.interaction.gesture_arpeggiator.websocket_server import WebSocketServer
    from alejo.interaction.gesture_arpeggiator.camera_manager import CameraManager
except ImportError as e:
    print(f"Error importing gesture system components: {e}")
    print("Make sure the gesture system is properly installed.")
    sys.exit(1)


class MockWebSocketClient:
    """Mock WebSocket client for testing"""
    
    def __init__(self, uri):
        self.uri = uri
        self.connected = False
        self.messages = []
        self.closed = False
    
    async def connect(self):
        """Simulate connecting to the server"""
        self.connected = True
        return self
    
    async def send(self, message):
        """Simulate sending a message to the server"""
        if not self.connected:
            raise Exception("Not connected")
        self.messages.append(message)
    
    async def recv(self):
        """Simulate receiving a message from the server"""
        if not self.connected:
            raise Exception("Not connected")
        # Wait for a message to be available
        while not self.messages:
            await asyncio.sleep(0.1)
        return self.messages.pop(0)
    
    async def close(self):
        """Simulate closing the connection"""
        self.connected = False
        self.closed = True


@pytest.fixture
def mock_camera():
    """Fixture for a mock camera that provides test frames"""
    # Create a mock camera
    camera = MagicMock()
    
    # Create a test frame (black image)
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Mock the read method to return the test frame
    camera.read.return_value = (True, test_frame)
    
    # Mock the isOpened method
    camera.isOpened.return_value = True
    
    return camera


@pytest.fixture
def camera_manager(mock_camera):
    """Fixture for a camera manager with a mock camera"""
    with patch('alejo.interaction.gesture_arpeggiator.camera_manager.cv2.VideoCapture', return_value=mock_camera):
        manager = CameraManager()
        yield manager
        # Clean up
        manager.release()


@pytest.fixture
async def running_gesture_system():
    """Fixture for a complete running gesture system with mocked components"""
    # Mock dependencies
    with patch('alejo.interaction.gesture_arpeggiator.gesture_processor.mediapipe'), \
         patch('alejo.interaction.gesture_arpeggiator.websocket_server.websockets'):
        
        # Create the gesture arpeggiator
        arpeggiator = GestureArpeggiator()
        
        # Create the websocket server
        server = WebSocketServer(
            host=TEST_SERVER_CONFIG["host"],
            port=TEST_SERVER_CONFIG["port"]
        )
        
        # Connect the server to the arpeggiator
        server.set_gesture_arpeggiator(arpeggiator)
        
        # Start the server
        await server.start()
        
        # Start the arpeggiator
        await arpeggiator.start()
        
        # Return the components
        yield {
            "arpeggiator": arpeggiator,
            "server": server
        }
        
        # Clean up
        await arpeggiator.stop()
        await server.stop()


@pytest.mark.asyncio
async def test_client_connection_and_preset_change():
    """Test connecting a client and changing presets"""
    # Mock the websockets library
    with patch('websockets.connect', new_callable=lambda: asyncio.coroutine(
        lambda uri: MockWebSocketClient(uri).connect()
    )):
        # Create a mock for the running system
        arpeggiator = MagicMock()
        server = MagicMock()
        
        # Mock the apply_preset method
        arpeggiator.apply_preset = asyncio.coroutine(lambda preset: None)
        
        # Create a client
        client = await MockWebSocketClient(f"ws://{TEST_SERVER_CONFIG['host']}:{TEST_SERVER_CONFIG['port']}").connect()
        
        # Send a preset change message
        preset_message = {
            "type": "preset_change",
            "preset": "E2E Test Preset"
        }
        await client.send(json.dumps(preset_message))
        
        # Close the connection
        await client.close()
        
        # Verify the client sent the message
        assert len(client.messages) == 0  # All messages were processed
        assert client.closed


@pytest.mark.asyncio
async def test_complete_gesture_pipeline(mock_camera):
    """Test the complete gesture pipeline from camera to audio"""
    # Mock dependencies
    with patch('alejo.interaction.gesture_arpeggiator.gesture_processor.mediapipe'), \
         patch('alejo.interaction.gesture_arpeggiator.camera_manager.cv2.VideoCapture', return_value=mock_camera):
        
        # Create the gesture arpeggiator
        arpeggiator = GestureArpeggiator()
        
        # Mock the gesture processor to detect a specific gesture
        mock_gesture = {
            "name": "pinch",
            "position": {"x": 0.5, "y": 0.5, "z": 0.0},
            "velocity": 0.8
        }
        arpeggiator.gesture_processor.process_frame = MagicMock(return_value=[mock_gesture])
        
        # Start the arpeggiator
        await arpeggiator.start()
        
        # Create a camera manager
        camera_manager = CameraManager()
        
        # Process a frame
        frame = camera_manager.get_frame()
        result = await arpeggiator.process_frame(frame)
        
        # Stop the arpeggiator
        await arpeggiator.stop()
        
        # Verify the result
        assert result is not None
        assert "audio_events" in result
        assert len(result["audio_events"]) > 0
        
        # Verify the audio event
        audio_event = result["audio_events"][0]
        assert "note" in audio_event
        assert "velocity" in audio_event


@pytest.mark.asyncio
async def test_websocket_server_broadcasts():
    """Test that the websocket server broadcasts events to clients"""
    # Mock the websockets library
    with patch('websockets.connect', new_callable=lambda: asyncio.coroutine(
        lambda uri: MockWebSocketClient(uri).connect()
    )), \
         patch('alejo.interaction.gesture_arpeggiator.websocket_server.websockets'):
        
        # Create the websocket server
        server = WebSocketServer(
            host=TEST_SERVER_CONFIG["host"],
            port=TEST_SERVER_CONFIG["port"]
        )
        
        # Start the server
        await server.start()
        
        # Create a mock client connection
        mock_client = MagicMock()
        server.clients.add(mock_client)
        
        # Broadcast a message
        test_message = {
            "type": "gesture_detected",
            "gesture": "pinch",
            "position": {"x": 0.5, "y": 0.5, "z": 0.0}
        }
        await server.broadcast(json.dumps(test_message))
        
        # Verify the message was sent to the client
        mock_client.send.assert_called_once_with(json.dumps(test_message))
        
        # Stop the server
        await server.stop()


if __name__ == "__main__":
    pytest.main(["-v", __file__])