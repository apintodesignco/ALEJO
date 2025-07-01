"""
ALEJO Gesture System Integration Tests

This module contains integration tests for the gesture arpeggiator system.
These tests focus on how components work together in a controlled environment.
"""

import os
import sys
import asyncio
import pytest
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import test configuration
from tests.gesture.test_config import TEST_ENV, TEST_SERVER_CONFIG, get_mock_data_for_gesture
import secrets  # More secure for cryptographic purposes

# Import gesture system components
try:
    from alejo.interaction.gesture_arpeggiator.gesture_processor import GestureProcessor
    from alejo.interaction.gesture_arpeggiator.audio_engine import AudioEngine
    from alejo.interaction.gesture_arpeggiator.preset_manager import PresetManager
    from alejo.interaction.gesture_arpeggiator.gesture_arpeggiator import GestureArpeggiator
    from alejo.interaction.gesture_arpeggiator.websocket_server import WebSocketServer
except ImportError as e:
    print(f"Error importing gesture system components: {e}")
    print("Make sure the gesture system is properly installed.")
    sys.exit(1)


@pytest.fixture
def gesture_processor():
    """Fixture for a gesture processor with mocked dependencies"""
    with patch('alejo.interaction.gesture_arpeggiator.gesture_processor.mediapipe'):
        processor = GestureProcessor()
        yield processor


@pytest.fixture
def audio_engine():
    """Fixture for an audio engine with mocked dependencies"""
    engine = AudioEngine()
    yield engine


@pytest.fixture
def preset_manager():
    """Fixture for a preset manager"""
    manager = PresetManager()
    yield manager


@pytest.fixture
def gesture_arpeggiator(gesture_processor, audio_engine, preset_manager):
    """Fixture for a gesture arpeggiator with mocked dependencies"""
    arpeggiator = GestureArpeggiator(
        gesture_processor=gesture_processor,
        audio_engine=audio_engine,
        preset_manager=preset_manager
    )
    yield arpeggiator


@pytest.fixture
async def websocket_server():
    """Fixture for a websocket server with mocked dependencies"""
    # Create a mock for the websockets library
    with patch('alejo.interaction.gesture_arpeggiator.websocket_server.websockets'):
        server = WebSocketServer(
            host=TEST_SERVER_CONFIG["host"],
            port=TEST_SERVER_CONFIG["port"]
        )
        yield server
        # Clean up
        await server.stop()


@pytest.mark.asyncio
async def test_gesture_to_audio_pipeline(gesture_arpeggiator):
    """Test the complete pipeline from gesture detection to audio generation"""
    # Create mock frame data
    mock_frame = MagicMock()
    
    # Mock the gesture processor to return a specific gesture
    mock_gesture = {
        "name": "pinch",
        "position": {"x": 0.5, "y": 0.5, "z": 0.0},
        "velocity": 0.8
    }
    gesture_arpeggiator.gesture_processor.process_frame = MagicMock(return_value=[mock_gesture])
    
    # Process the frame
    result = await gesture_arpeggiator.process_frame(mock_frame)
    
    # Verify the result
    assert result is not None
    assert "audio_events" in result
    assert len(result["audio_events"]) > 0
    
    # Verify the audio event
    audio_event = result["audio_events"][0]
    assert "note" in audio_event
    assert "velocity" in audio_event


@pytest.mark.asyncio
async def test_preset_application(gesture_arpeggiator):
    """Test applying a preset to the gesture arpeggiator"""
    # Create a test preset
    test_preset = {
        "name": "Integration Test Preset",
        "bpm": 110,
        "scale": "A minor",
        "octave": 4,
        "arpeggiation_rate": 16,
        "reverb": 0.4,
        "delay": 0.3
    }
    
    # Apply the preset
    await gesture_arpeggiator.apply_preset(test_preset)
    
    # Verify the preset was applied to the audio engine
    assert gesture_arpeggiator.audio_engine.bpm == test_preset["bpm"]
    assert gesture_arpeggiator.audio_engine.scale == test_preset["scale"]
    assert gesture_arpeggiator.audio_engine.octave == test_preset["octave"]


@pytest.mark.asyncio
async def test_websocket_message_handling(websocket_server, gesture_arpeggiator):
    """Test handling websocket messages"""
    # Connect the gesture arpeggiator to the websocket server
    websocket_server.set_gesture_arpeggiator(gesture_arpeggiator)
    
    # Create a mock websocket connection
    mock_websocket = MagicMock()
    
    # Create a test message
    test_message = '{"type": "preset_change", "preset": "Integration Test Preset"}'
    
    # Mock the receive method
    mock_websocket.recv = asyncio.coroutine(lambda: test_message)
    
    # Handle the message
    with patch.object(gesture_arpeggiator, 'apply_preset', new_callable=asyncio.coroutine) as mock_apply_preset:
        await websocket_server.handle_client(mock_websocket, None)
        
        # Verify the preset was applied
        mock_apply_preset.assert_called_once()


@pytest.mark.asyncio
async def test_client_connection_lifecycle(websocket_server):
    """Test the lifecycle of a client connection"""
    # Start the server
    await websocket_server.start()
    
    # Create a mock for the client handler
    websocket_server.handle_client = MagicMock()
    
    # Simulate a client connection
    mock_websocket = MagicMock()
    mock_path = MagicMock()
    
    # Call the connection handler
    await websocket_server.connection_handler(mock_websocket, mock_path)
    
    # Verify the client handler was called
    websocket_server.handle_client.assert_called_once_with(mock_websocket, mock_path)


@pytest.mark.asyncio
async def test_gesture_arpeggiator_startup_shutdown(gesture_arpeggiator):
    """Test starting and stopping the gesture arpeggiator"""
    # Start the arpeggiator
    await gesture_arpeggiator.start()
    
    # Verify it's running
    assert gesture_arpeggiator.is_running
    
    # Stop the arpeggiator
    await gesture_arpeggiator.stop()
    
    # Verify it's stopped
    assert not gesture_arpeggiator.is_running


if __name__ == "__main__":
    pytest.main(["-v", __file__])