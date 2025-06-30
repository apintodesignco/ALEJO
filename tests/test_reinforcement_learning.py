"""
Tests for ALEJO's reinforcement learning system
"""

import asyncio
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from alejo.cognitive.learning.reinforcement import ReinforcementLearner, Experience
from alejo.cognitive.learning.manager import LearningManager
from alejo.core.event_bus import EventBus, Event, EventType

@pytest.fixture
def temp_model_dir():
    """Temporary directory for model files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def learner(temp_model_dir):
    """Create ReinforcementLearner instance"""
    return ReinforcementLearner(
        model_path=str(Path(temp_model_dir) / "test_model.h5"),
        learning_rate=0.01,
        epsilon_start=1.0,
        batch_size=32
    )

@pytest.fixture
async def learning_manager(temp_model_dir):
    """Create LearningManager instance"""
    event_bus = EventBus()
    await event_bus.start()
    
    manager = LearningManager(
        event_bus=event_bus,
        base_dir=temp_model_dir,
        config={
            'learning_rate': 0.01,
            'batch_size': 32
        }
    )
    
    yield manager
    
    await event_bus.stop()

@pytest.mark.asyncio
async def test_reinforcement_learner_initialization(learner):
    """Test learner initialization"""
    assert learner.learning_rate == 0.01
    assert learner.epsilon == 1.0
    assert len(learner.experience_buffer) == 0
    assert learner.training_steps == 0

@pytest.mark.asyncio
async def test_experience_addition(learner):
    """Test adding experiences"""
    state = {
        'emotional_state': {'valence': 0.5},
        'memory_state': {'working_memory_load': 0.3}
    }
    next_state = {
        'emotional_state': {'valence': 0.6},
        'memory_state': {'working_memory_load': 0.4}
    }
    
    await learner.add_experience(
        state=state,
        action='process_normally',
        reward=1.0,
        next_state=next_state
    )
    
    assert len(learner.experience_buffer) == 1
    exp = learner.experience_buffer[0]
    assert exp.state == state
    assert exp.action == 'process_normally'
    assert exp.reward == 1.0
    assert exp.next_state == next_state

@pytest.mark.asyncio
async def test_action_selection(learner):
    """Test action selection"""
    state = {
        'emotional_state': {'valence': 0.5},
        'memory_state': {'working_memory_load': 0.3},
        'task_context': {'complexity': 0.7}
    }
    
    # Test exploration (epsilon = 1.0)
    action = await learner.get_action(state)
    assert action in [
        'process_normally',
        'request_clarification',
        'delegate_subtask',
        'optimize_resource_usage',
        'engage_safety_protocol'
    ]
    
    # Test exploitation (epsilon = 0.0)
    learner.epsilon = 0.0
    action = await learner.get_action(state)
    assert action in [
        'process_normally',
        'request_clarification',
        'delegate_subtask',
        'optimize_resource_usage',
        'engage_safety_protocol'
    ]

@pytest.mark.asyncio
async def test_training(learner):
    """Test training process"""
    # Add some experiences
    for i in range(100):
        await learner.add_experience(
            state={'value': float(i)},
            action='process_normally',
            reward=float(i % 2),  # Alternate rewards
            next_state={'value': float(i + 1)}
        )
    
    # Train
    metrics = await learner.train()
    assert 'loss' in metrics
    assert 'epsilon' in metrics
    assert learner.training_steps == 1

@pytest.mark.asyncio
async def test_learning_manager_initialization(learning_manager):
    """Test learning manager initialization"""
    assert learning_manager.event_bus is not None
    assert learning_manager.rl is not None
    assert not learning_manager._running

@pytest.mark.asyncio
async def test_learning_manager_event_handling(learning_manager):
    """Test event handling"""
    await learning_manager.start()
    assert learning_manager._running
    
    # Test command handling
    command_event = Event(
        type=EventType.COMMAND,
        payload={'command': 'test'},
        metadata={
            'command_id': 'test_1',
            'emotional_state': {'valence': 0.5}
        }
    )
    await learning_manager._handle_command(command_event)
    assert learning_manager._current_state is not None
    assert learning_manager._current_action is not None
    
    # Test response handling
    response_event = Event(
        type=EventType.RESPONSE,
        payload={
            'success': True,
            'satisfaction': 0.8
        },
        metadata={'command_id': 'test_1'}
    )
    await learning_manager._handle_response(response_event)
    assert learning_manager._current_state is None
    assert learning_manager._current_action is None
    
    # Test error handling
    error_event = Event(
        type=EventType.ERROR,
        payload={'error': 'test error'},
        metadata={'command_id': 'test_2'}
    )
    await learning_manager._handle_error(error_event)
    
    await learning_manager.stop()
    assert not learning_manager._running

@pytest.mark.asyncio
async def test_reward_calculation(learning_manager):
    """Test reward calculation"""
    event = Event(
        type=EventType.RESPONSE,
        payload={
            'success': True,
            'satisfaction': 0.8,
            'efficiency': 0.7,
            'error_count': 0
        }
    )
    
    reward = learning_manager._calculate_reward(event)
    assert -1.0 <= reward <= 1.0

@pytest.mark.asyncio
async def test_state_building(learning_manager):
    """Test state representation building"""
    event = Event(
        type=EventType.COMMAND,
        payload={'command': 'test'},
        metadata={
            'emotional_state': {'valence': 0.5},
            'memory_load': 0.3,
            'urgency': 0.8
        }
    )
    
    state = learning_manager._build_state(event)
    assert 'emotional_state' in state
    assert 'memory_state' in state
    assert 'task_context' in state
    assert 'performance_metrics' in state

@pytest.mark.asyncio
async def test_action_application(learning_manager):
    """Test action application"""
    event = Event(
        type=EventType.COMMAND,
        payload={'command': 'test'},
        metadata={'command_id': 'test_1'}
    )
    
    # Test each action type
    for action in [
        'request_clarification',
        'delegate_subtask',
        'optimize_resource_usage',
        'engage_safety_protocol'
    ]:
        await learning_manager._apply_action(action, event)
        # Verify event was published (would need to mock event_bus for full test)

@pytest.mark.asyncio
async def test_learning_manager_stats(learning_manager):
    """Test statistics collection"""
    stats = learning_manager.get_stats()
    assert 'total_experiences' in stats
    assert 'total_rewards' in stats
    assert 'avg_reward' in stats
    assert 'training_episodes' in stats
    assert 'rl_stats' in stats
    assert 'running' in stats
