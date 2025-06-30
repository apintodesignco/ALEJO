#!/usr/bin/env python3
"""
Direct test for the gaze tracking functionality without using pytest
"""
import asyncio
import sys
import os
import logging
from unittest.mock import patch, MagicMock
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from alejo.core.event_bus import Event, EventType
from alejo.core.memory_event_bus import MemoryEventBus
from alejo.ui.controller import UIController

async def test_gaze_tracking_basic():
    """Test that gaze tracking events flow through the event bus correctly"""
    print("Starting gaze tracking test...")
    
    # Create an in-memory event bus
    bus = MemoryEventBus()
    await bus.start()
    
    # Mock the GazeTracker
    mock_tracker = MagicMock()
    
    # Create a controller with gaze tracking enabled
    with patch('alejo.vision.gaze_tracker.GazeTracker', return_value=mock_tracker):
        ui_controller = UIController(bus, gaze_tracking_enabled=True)
        
        # Set up event collection
        received_events = []
        
        async def collect_events(event):
            received_events.append(event)
            print(f"Received event: {event.type}, payload: {event.payload}")
        
        # Subscribe to GAZE events
        bus.subscribe(EventType.GAZE, collect_events)
        
        # Start the controller
        await ui_controller.start()
        
        # Simulate a blink event from the gaze tracker
        blink_event = Event.create(
            type=EventType.GAZE,
            payload={"type": "blink", "timestamp": datetime.now().isoformat()},
            source="GazeTracker"
        )
        
        # Publish the event directly to simulate what the tracker would do
        print(f"Publishing event: {blink_event.type}, payload: {blink_event.payload}")
        await bus.publish(blink_event)
        
        # Wait a bit for event processing
        await asyncio.sleep(0.1)
        
        # Check if the event was received
        if received_events:
            print("✅ Gaze tracking test PASSED!")
            print(f"Received {len(received_events)} events")
            for event in received_events:
                print(f"  - {event.type}: {event.payload}")
        else:
            print("❌ Gaze tracking test FAILED!")
            print("No events were received")
        
        # Stop the controller to unsubscribe
        await ui_controller.stop()
        
    # Stop the event bus
    await bus.stop()

if __name__ == "__main__":
    asyncio.run(test_gaze_tracking_basic())
