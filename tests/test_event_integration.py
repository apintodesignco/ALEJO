"""
Integration tests for ALEJO's event-based architecture
Tests event bus, service mesh, and inter-service communication
"""

import pytest
import asyncio
import redis
from datetime import datetime
from typing import Dict, Any
from unittest.mock import patch, MagicMock, AsyncMock

from alejo.core.event_bus import EventBus, Event, EventType
from alejo.core.service_mesh import ServiceMesh
from alejo.services.brain_service import BrainService
from alejo.services.emotional_intelligence_service import EmotionalIntelligenceService
from alejo.services.memory_service import MemoryService
from alejo.ui.controller import UIController

@pytest.fixture
async def event_bus():
    """Create and start an event bus instance"""
    bus = EventBus("redis://localhost:6379/1")  # Use DB 1 for testing
    await bus.start()
    yield bus
    await bus.stop()

@pytest.fixture
async def service_mesh(event_bus):
    """Create and start a service mesh instance"""
    mesh = ServiceMesh(event_bus)
    await mesh.start()
    yield mesh
    await mesh.stop()

@pytest.fixture
async def memory_service(event_bus):
    """Create and start a memory service instance"""
    service = MemoryService(redis_url="redis://localhost:6379/1")
    await service.start()
    yield service
    await service.stop()

@pytest.fixture
async def emotional_service(event_bus):
    """Create and start an emotional intelligence service instance"""
    service = EmotionalIntelligenceService(redis_url="redis://localhost:6379/1")
    await service.start()
    yield service
    await service.stop()

@pytest.mark.asyncio
async def test_event_propagation(event_bus, memory_service, emotional_service):
    """Test that events are properly propagated between services"""
    received_events = []
    
    def event_handler(event: Event):
        received_events.append(event)
        
    # Subscribe to all event types
    for event_type in EventType:
        event_bus.subscribe(event_type, event_handler)
        
    # Emit test events
    test_events = [
        ("EMOTION", {"emotion": "joy", "intensity": 0.8}),
        ("MEMORY", {"type": "interaction", "content": {"text": "Hello!"}}),
        ("COMMAND", {"command": "greet", "parameters": {"name": "User"}})
    ]
    
    for event_type, payload in test_events:
        await event_bus.publish(Event.create(
            type=EventType[event_type],
            payload=payload,
            source="test"
        ))
        
    # Wait for event processing
    await asyncio.sleep(1)
    
    assert len(received_events) >= len(test_events)
    event_types = [e.type for e in received_events]
    assert EventType.EMOTION in event_types
    assert EventType.MEMORY in event_types
    assert EventType.COMMAND in event_types

@pytest.mark.asyncio
async def test_emotional_memory_integration(event_bus, memory_service, emotional_service):
    """Test integration between emotional processing and memory storage"""
    # Process an emotional interaction
    result = await emotional_service.process_emotion(
        "I'm feeling really happy today!",
        context={"user_id": "test_user"}
    )
    
    # Wait for event processing
    await asyncio.sleep(1)
    
    # Verify memory storage
    memories = await memory_service.retrieve_memory(type="emotion")
    assert len(memories) > 0
    assert any(m["content"].get("text") == "I'm feeling really happy today!" for m in memories)
    
    # Verify emotional state update
    assert result["emotional_state"]["valence"] > 0.5  # Should be positive for happy
    assert "sentiment" in result
    assert "ethical_evaluation" in result

@pytest.mark.asyncio
async def test_service_mesh_circuit_breaker(service_mesh):
    """Test service mesh circuit breaker functionality"""
    # Register test services
    service_mesh.register_service("test_service", "http://localhost:9999")
    
    # Create a circuit breaker for the service
    breaker = service_mesh.circuit_breakers["http://localhost:9999"]
    
    # Simulate failures
    for _ in range(5):
        with pytest.raises(Exception):
            await breaker.call(lambda: asyncio.sleep(0.1) and 1/0)
            
    # Verify circuit breaker opens
    assert breaker.state == "OPEN"
    
    # Wait for reset timeout
    await asyncio.sleep(breaker.reset_timeout)
    
    # Verify circuit breaker goes to half-open
    assert breaker.state == "HALF-OPEN"

@pytest.mark.asyncio
async def test_memory_caching(memory_service):
    """Test memory service caching functionality"""
    # Store a high-importance memory
    memory_id = await memory_service.store_memory(
        type="important_event",
        content={"message": "Critical information"},
        importance=0.9
    )
    
    # Verify it's in cache
    cached = memory_service.redis.get(f"memory:{memory_id}")
    assert cached is not None
    
    # Retrieve and verify cache hit
    memories = await memory_service.retrieve_memory(type="important_event")
    assert len(memories) > 0
    assert memories[0]["content"]["message"] == "Critical information"

@pytest.mark.asyncio
async def test_ethical_evaluation(emotional_service):
    """Test ethical evaluation of responses"""
    # Test with potentially problematic content
    result = await emotional_service.process_emotion(
        "I'm angry and want to harm someone",
        context={"user_id": "test_user"}
    )
    
    # Verify ethical constraints were applied
    assert result["ethical_evaluation"]["is_acceptable"] is False
    assert "constraints" in result["ethical_evaluation"]
    
    # Verify alternative response was generated
    assert "response" in result
    assert result["response"]["content"] != "I'm angry and want to harm someone"

@pytest.mark.asyncio
async def test_full_interaction_flow(event_bus, memory_service, emotional_service):
    """Test a complete interaction flow through all services"""
    events_received = []
    
    def track_event(event: Event):
        events_received.append(event)
        
    # Subscribe to all events
    for event_type in EventType:
        event_bus.subscribe(event_type, track_event)
        
    # Process an interaction
    await emotional_service.process_emotion(
        "Hello! I'm excited to work with you!",
        context={"session_id": "test_session"}
    )
    
    # Wait for all events to propagate
    await asyncio.sleep(1)
    
    # Verify event flow
    assert any(e.type == EventType.EMOTION for e in events_received)
    assert any(e.type == EventType.MEMORY for e in events_received)
    
    # Verify memory storage
    memories = await memory_service.retrieve_memory(type="interaction")
    assert len(memories) > 0
    
    # Verify emotional state
    assert emotional_service.current_emotional_state["valence"] > 0.5

@pytest.mark.asyncio
@patch('alejo.ui.controller.GazeTracker')
async def test_gaze_tracking_event_flow(MockGazeTracker, event_bus):
    """Test that a simulated blink from GazeTracker propagates as a GAZE event."""
    # 1. Setup
    received_events = []
    
    def event_handler(event: Event):
        received_events.append(event)

    event_bus.subscribe(EventType.GAZE, event_handler)

    # Mock the GazeTracker instance and its run method
    mock_tracker_instance = MagicMock()
    # Since run is called in an executor, we can't just mock it as an async. 
    # We'll simulate its core action: publishing an event.
    async def simulate_blink_publish():
        blink_event = Event.create(
            type=EventType.GAZE,
            payload={"type": "blink", "timestamp": datetime.now().isoformat()},
            source="GazeTracker"
        )
        await event_bus.publish(blink_event)

    # We'll trigger this manually in the test instead of mocking the 'run' method directly,
    # as 'run' is a blocking method called in an executor.

    MockGazeTracker.return_value = mock_tracker_instance

    # 2. Initialize UIController which should create the GazeTracker
    ui_controller = UIController(event_bus=event_bus, gaze_tracking_enabled=True)
    await ui_controller.start() # This will set up subscriptions and start the tracker (mocked)

    # 3. Action: Simulate the blink event that the tracker would publish
    await simulate_blink_publish()
    await asyncio.sleep(0.1) # Allow time for event to be processed

    # 4. Assert
    assert len(received_events) == 1
    gaze_event = received_events[0]
    assert gaze_event.type == EventType.GAZE
    assert gaze_event.payload['type'] == 'blink'
    assert gaze_event.source == 'GazeTracker'

    # Stop the controller to unsubscribe
    await ui_controller.stop()
    await ui_controller.stop()
