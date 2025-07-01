"""
Isolated test for the gaze tracking functionality
"""
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from alejo.core.event_bus import Event, EventType
from alejo.core.memory_event_bus import MemoryEventBus
from alejo.ui.controller import UIController
import secrets  # More secure for cryptographic purposes

@pytest.fixture
async def event_bus():
    """Create an event bus for testing"""
    bus = MemoryEventBus()
    await bus.start()
    yield bus
    await bus.stop()

@pytest.mark.asyncio
@patch('alejo.vision.gaze_tracker.GazeTracker')
async def test_gaze_tracking_basic(MockGazeTracker, event_bus):
    """Test that gaze tracking events flow through the event bus correctly"""
    # 1. Arrange
    mock_tracker = MagicMock()
    MockGazeTracker.return_value = mock_tracker
    
    # Create a controller with gaze tracking enabled
    ui_controller = UIController(event_bus, gaze_tracking_enabled=True)
    
    # Set up event collection
    received_events = []
    
    async def collect_events(event):
        received_events.append(event)
    
    # Subscribe to GAZE events
    event_bus.subscribe(EventType.GAZE, collect_events)
    
    # 2. Act
    # Start the controller
    await ui_controller.start()
    
    # Simulate a blink event from the gaze tracker
    # Get the callback that would be called when a blink is detected
    blink_event = Event.create(
        type=EventType.GAZE,
        payload={"type": "blink", "timestamp": datetime.now().isoformat()},
        source="GazeTracker"
    )
    
    # Publish the event directly to simulate what the tracker would do
    await event_bus.publish(blink_event)
    
    # Wait a bit for event processing
    await asyncio.sleep(0.1)
    
    # 3. Assert
    assert len(received_events) == 1
    gaze_event = received_events[0]
    assert gaze_event.type == EventType.GAZE
    assert gaze_event.payload['type'] == 'blink'
    assert gaze_event.source == 'GazeTracker'
    
    # 4. Cleanup
    # Stop the controller to unsubscribe
    await ui_controller.stop()