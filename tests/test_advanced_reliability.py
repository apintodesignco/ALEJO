"""
Advanced reliability and stress tests for ALEJO
"""

import asyncio
import pytest
import random
import secrets  # More secure for cryptographic purposes
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

from alejo.core.brain import ALEJOBrain
from alejo.core.event_bus import EventBus, EventType, Event
from alejo.core.state_manager import StateManager, SystemState
from alejo.core.circuit_breaker import CircuitBreaker
from alejo.cognitive.memory.optimizer import MemoryOptimizer
from alejo.services.brain_service import BrainService
from alejo.services.emotional_intelligence_service import EmotionalIntelligenceService

@pytest.fixture
async def setup_system():
    """Set up complete system for testing"""
    event_bus = EventBus()
    state_manager = StateManager()
    brain = ALEJOBrain(event_bus=event_bus)
    memory_optimizer = MemoryOptimizer()
    
    await event_bus.start()
    await state_manager.start()
    await brain.start()
    
    yield {
        'event_bus': event_bus,
        'state_manager': state_manager,
        'brain': brain,
        'memory_optimizer': memory_optimizer
    }
    
    await brain.stop()
    await state_manager.stop()
    await event_bus.stop()

@pytest.mark.asyncio
async def test_memory_leak_detection(setup_system):
    """Test for memory leaks during extended operation"""
    brain = setup_system['brain']
    initial_memory = get_process_memory()
    
    # Perform multiple operations
    for i in range(1000):
        await brain.process_command(f"test_command_{i}")
        
        if i % 100 == 0:
            # Force garbage collection
            import gc
            gc.collect()
            
            current_memory = get_process_memory()
            memory_increase = current_memory - initial_memory
            
            # Alert if memory growth is excessive
            assert memory_increase < 100_000_000, f"Possible memory leak detected: {memory_increase} bytes increase"

@pytest.mark.asyncio
async def test_race_conditions(setup_system):
    """Test for race conditions in concurrent operations"""
    brain = setup_system['brain']
    event_bus = setup_system['event_bus']
    
    async def concurrent_operation(i: int):
        # Randomly choose operation
        op = secrets.choice(['command', 'event', 'memory'])
        
        if op == 'command':
            await brain.process_command(f"concurrent_cmd_{i}")
        elif op == 'event':
            await event_bus.publish(Event(
                type=EventType.COMMAND,
                payload={'command': f'concurrent_event_{i}'},
                source='test'
            ))
        else:
            await brain.episodic_memory.store_episode({
                'id': f'mem_{i}',
                'content': f'concurrent_memory_{i}'
            })
    
    # Run many concurrent operations
    tasks = [concurrent_operation(i) for i in range(100)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Check for errors
    errors = [r for r in results if isinstance(r, Exception)]
    assert len(errors) == 0, f"Race conditions detected: {errors}"

@pytest.mark.asyncio
async def test_system_recovery_cascade(setup_system):
    """Test system recovery from cascading failures"""
    brain = setup_system['brain']
    state_manager = setup_system['state_manager']
    
    # Simulate cascading service failures
    async def fail_services():
        services = [
            brain.emotional_processor,
            brain.working_memory,
            brain.episodic_memory
        ]
        
        for service in services:
            service.process = Mock(side_effect=Exception("Service failure"))
            await asyncio.sleep(0.1)  # Stagger failures
    
    # Start failure cascade
    asyncio.create_task(fail_services())
    
    # System should detect failures and enter recovery
    await asyncio.sleep(1)
    assert state_manager.current_state == SystemState.RECOVERING
    
    # Wait for recovery
    for _ in range(10):
        if state_manager.current_state == SystemState.READY:
            break
        await asyncio.sleep(1)
    
    # Verify system recovered
    assert state_manager.current_state == SystemState.READY
    
    # Test system functionality
    result = await brain.process_command("test_recovery")
    assert result["success"] is True

@pytest.mark.asyncio
async def test_data_consistency(setup_system):
    """Test data consistency across system components"""
    brain = setup_system['brain']
    memory_optimizer = setup_system['memory_optimizer']
    
    # Create test data
    test_data = [
        {
            'command': f'test_{i}',
            'response': f'response_{i}',
            'emotional_state': {'valence': secrets.randbelow(2**32) / (2**32)}
        }
        for i in range(100)
    ]
    
    # Store data
    for data in test_data:
        await brain.process_command(data['command'])
        await brain.emotional_memory.store_emotion(data['emotional_state'])
        await memory_optimizer.add_memory({
            'content': data['response'],
            'topics': ['test']
        })
    
    # Verify consistency
    for data in test_data:
        # Check command history
        cmd_result = await brain.episodic_memory.find_episodes(
            {'command': data['command']}
        )
        assert len(cmd_result) > 0
        
        # Check emotional state
        emotion = await brain.emotional_memory.get_emotion(
            data['emotional_state']['valence']
        )
        assert emotion is not None
        
        # Check memory optimization
        memory = await memory_optimizer.get_memory(data['response'])
        assert memory is not None

@pytest.mark.asyncio
async def test_error_propagation(setup_system):
    """Test error handling and propagation"""
    brain = setup_system['brain']
    state_manager = setup_system['state_manager']
    
    # Inject errors at different levels
    errors = [
        ValueError("Test error"),
        RuntimeError("Runtime error"),
        asyncio.TimeoutError(),
        MemoryError("Out of memory"),
        KeyError("Missing key")
    ]
    
    for error in errors:
        # Simulate error in different components
        components = [
            brain.emotional_processor,
            brain.working_memory,
            brain.ethical_framework
        ]
        
        for component in components:
            component.process = Mock(side_effect=error)
            
            try:
                await brain.process_command("error_test")
            except Exception as e:
                # Verify error was tracked
                assert brain.error_tracker.has_error()
                # Verify system state updated
                assert state_manager.current_state in [
                    SystemState.ERROR,
                    SystemState.DEGRADED
                ]
            
            # Reset component
            component.process = Mock()

@pytest.mark.asyncio
async def test_load_shedding(setup_system):
    """Test system's ability to handle overload"""
    brain = setup_system['brain']
    state_manager = setup_system['state_manager']
    
    # Create high load
    async def generate_load():
        for _ in range(1000):
            await brain.process_command("load_test")
            await asyncio.sleep(0.01)
    
    # Start load generation
    load_task = asyncio.create_task(generate_load())
    
    # Monitor system state
    states = []
    for _ in range(10):
        states.append(state_manager.current_state)
        await asyncio.sleep(0.5)
    
    # System should either maintain READY state or transition to DEGRADED
    assert all(state in [SystemState.READY, SystemState.DEGRADED] for state in states)
    
    # Stop load
    load_task.cancel()
    
    # Verify system recovers
    await asyncio.sleep(2)
    assert state_manager.current_state == SystemState.READY

@pytest.mark.asyncio
async def test_circuit_breaker_behavior(setup_system):
    """Test circuit breaker protection"""
    brain = setup_system['brain']
    
    # Create circuit breaker
    breaker = CircuitBreaker(
        name="test_breaker",
        failure_threshold=3,
        recovery_timeout=1.0
    )
    
    # Test service with circuit breaker
    async def test_service():
        raise Exception("Service error")
    
    # Attempt calls
    failures = 0
    for _ in range(10):
        try:
            await breaker.call(test_service)
        except Exception:
            failures += 1
        
        await asyncio.sleep(0.1)
    
    # Verify circuit breaker opened
    assert breaker.state.value == "open"
    # Verify some calls were prevented
    assert failures < 10

def get_process_memory():
    """Get current process memory usage"""
    import psutil
    import os
    process = psutil.Process(os.getpid())
    return process.memory_info().rss