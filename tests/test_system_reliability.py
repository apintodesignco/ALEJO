"""
System-wide reliability and resilience tests for ALEJO
"""

import asyncio
import pytest
from unittest.mock import Mock, patch
from alejo.core.brain import ALEJOBrain
from alejo.core.event_bus import EventBus, EventType, Event
from alejo.services.brain_service import BrainService
from alejo.services.emotional_intelligence_service import EmotionalIntelligenceService
from alejo.cognitive.memory import WorkingMemory, EpisodicMemory
from alejo.security.encryption import EncryptionManager

@pytest.fixture
async def event_bus():
    bus = EventBus()
    await bus.start()
    yield bus
    await bus.stop()

@pytest.fixture
async def brain(event_bus):
    brain = ALEJOBrain(event_bus=event_bus)
    await brain.start()
    yield brain
    await brain.stop()

@pytest.mark.asyncio
async def test_system_recovery_after_service_failure(brain, event_bus):
    """Test system's ability to recover from service failures"""
    # Simulate emotional service failure
    brain.emotional_processor.analyze_sentiment = Mock(side_effect=Exception("Service down"))
    
    # System should still process command with degraded functionality
    result = await brain.process_command("test command")
    assert result["success"] is True
    assert "error_state" in result
    
    # Restore service and verify recovery
    brain.emotional_processor.analyze_sentiment = Mock(return_value={"valence": 0.5, "arousal": 0.5})
    result = await brain.process_command("test command")
    assert result["success"] is True
    assert "error_state" not in result

@pytest.mark.asyncio
async def test_memory_consistency_under_load(brain):
    """Test memory system consistency under heavy load"""
    # Generate concurrent memory operations
    memory_ops = []
    for i in range(100):
        memory_ops.append(brain.episodic_memory.store_episode({
            "command": f"test_{i}",
            "response": f"response_{i}",
            "timestamp": i
        }))
    
    # Execute concurrently
    await asyncio.gather(*memory_ops)
    
    # Verify consistency
    for i in range(100):
        episode = await brain.episodic_memory.get_episode(i)
        assert episode["command"] == f"test_{i}"
        assert episode["response"] == f"response_{i}"

@pytest.mark.asyncio
async def test_event_bus_reliability(event_bus):
    """Test event bus reliability under various conditions"""
    received_events = []
    
    async def event_handler(event):
        received_events.append(event)
    
    # Subscribe to events
    await event_bus.subscribe(EventType.COMMAND, event_handler)
    
    # Test high frequency publishing
    publish_ops = []
    for i in range(100):
        event = Event(
            type=EventType.COMMAND,
            payload={"command": f"test_{i}"},
            source="test"
        )
        publish_ops.append(event_bus.publish(event))
    
    await asyncio.gather(*publish_ops)
    await asyncio.sleep(1)  # Allow time for processing
    
    assert len(received_events) == 100
    assert all(e.payload["command"].startswith("test_") for e in received_events)

@pytest.mark.asyncio
async def test_service_mesh_resilience(brain):
    """Test service mesh resilience and circuit breaking"""
    # Simulate service degradation
    with patch("alejo.core.service_mesh.ServiceMesh.call_service") as mock_call:
        mock_call.side_effect = [
            Exception("Service timeout"),  # First call fails
            {"status": "ok"},  # Second call succeeds
            Exception("Service error"),  # Third call fails
            {"status": "ok"}  # Fourth call succeeds
        ]
        
        # Service should handle failures gracefully
        result1 = await brain.service_mesh.call_service("test_service", "test_endpoint")
        assert "error" in result1
        
        result2 = await brain.service_mesh.call_service("test_service", "test_endpoint")
        assert result2["status"] == "ok"
        
        # Verify circuit breaker behavior
        result3 = await brain.service_mesh.call_service("test_service", "test_endpoint")
        assert "circuit_open" in result3

@pytest.mark.asyncio
async def test_emotional_state_consistency(brain):
    """Test emotional state consistency across operations"""
    # Initialize emotional state
    await brain.emotional_processor.update_emotional_state({
        "valence": 0.7,
        "arousal": 0.3,
        "dominance": 0.5
    })
    
    # Perform multiple emotional operations
    ops = []
    for _ in range(10):
        ops.append(brain.process_command("test command"))
    
    results = await asyncio.gather(*ops)
    
    # Verify emotional state consistency
    states = [r["emotional_state"] for r in results]
    assert all(isinstance(s, dict) for s in states)
    assert all(0 <= s["valence"] <= 1 for s in states)
    assert all(0 <= s["arousal"] <= 1 for s in states)
    
    # Verify state transitions are smooth
    for i in range(1, len(states)):
        diff = abs(states[i]["valence"] - states[i-1]["valence"])
        assert diff <= 0.3  # No sudden jumps

@pytest.mark.asyncio
async def test_memory_persistence(brain):
    """Test memory persistence and recovery"""
    # Store test memories
    test_memories = [
        {"type": "episodic", "content": "test1"},
        {"type": "semantic", "content": "test2"},
        {"type": "emotional", "content": "test3"}
    ]
    
    for mem in test_memories:
        if mem["type"] == "episodic":
            await brain.episodic_memory.store_episode(mem)
        elif mem["type"] == "semantic":
            await brain.semantic_memory.store_fact(mem)
        else:
            await brain.emotional_memory.store_emotion(mem)
    
    # Simulate system restart
    await brain.stop()
    await brain.start()
    
    # Verify memory persistence
    assert await brain.episodic_memory.get_episode(0) == test_memories[0]
    assert await brain.semantic_memory.get_fact(0) == test_memories[1]
    assert await brain.emotional_memory.get_emotion(0) == test_memories[2]

@pytest.mark.asyncio
async def test_encryption_and_security(brain):
    """Test encryption and security measures"""
    encryption_manager = EncryptionManager()
    
    # Test data encryption
    sensitive_data = {"user_id": "test", "data": "sensitive"}
    encrypted = encryption_manager.encrypt(sensitive_data)
    decrypted = encryption_manager.decrypt(encrypted)
    
    assert sensitive_data == decrypted
    assert isinstance(encrypted, bytes)
    
    # Test secure communication
    async with brain.service_mesh.secure_channel("test_service") as channel:
        response = await channel.send({"command": "test"})
        assert response["status"] == "secure"

@pytest.mark.asyncio
async def test_concurrent_command_processing(brain):
    """Test concurrent command processing and resource management"""
    # Generate concurrent commands
    commands = [f"test_command_{i}" for i in range(50)]
    
    # Process commands concurrently
    async def process_command(cmd):
        return await brain.process_command(cmd)
    
    results = await asyncio.gather(*[process_command(cmd) for cmd in commands])
    
    # Verify all commands processed successfully
    assert len(results) == 50
    assert all(r["success"] for r in results)
    
    # Verify resource cleanup
    assert brain.working_memory.size() <= brain.working_memory.max_size
    assert not brain.is_processing

@pytest.mark.asyncio
async def test_error_handling_and_recovery(brain):
    """Test error handling and system recovery"""
    # Test various error scenarios
    error_cases = [
        None,  # Invalid input
        "x" * 1000000,  # Oversized input
        {"invalid": "type"},  # Wrong type
        "raise_error"  # Trigger intentional error
    ]
    
    for case in error_cases:
        try:
            await brain.process_command(case)
        except Exception as e:
            # Verify error is tracked
            assert brain.error_tracker.has_error()
            # Verify system remains operational
            result = await brain.process_command("test")
            assert result["success"]
