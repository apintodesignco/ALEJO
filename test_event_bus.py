#!/usr/bin/env python3
"""
Simple script to test the event bus functionality directly
"""
import asyncio
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from alejo.core.event_bus import Event, EventType
from alejo.core.memory_event_bus import MemoryEventBus

async def test_event_bus():
    """Test the event bus functionality"""
    print("Starting event bus test...")
    
    # Create an in-memory event bus
    bus = MemoryEventBus()
    await bus.start()
    
    # Set up event collection
    received_events = []
    
    async def collect_events(event):
        received_events.append(event)
        print(f"Received event: {event.type}, payload: {event.payload}")
    
    # Subscribe to SYSTEM events
    bus.subscribe(EventType.SYSTEM, collect_events)
    
    # Create and publish a test event
    test_event = Event.create(
        type=EventType.SYSTEM,
        payload={"message": "Hello, world!"},
        source="TestScript"
    )
    
    print(f"Publishing event: {test_event.type}, payload: {test_event.payload}")
    await bus.publish(test_event)
    
    # Wait a bit for event processing
    await asyncio.sleep(0.1)
    
    # Check if the event was received
    if received_events:
        print("✅ Event bus test PASSED!")
    else:
        print("❌ Event bus test FAILED!")
    
    # Stop the event bus
    await bus.stop()

if __name__ == "__main__":
    asyncio.run(test_event_bus())