"""Tests for integrated learning and emotional intelligence functionality"""

import asyncio
import secrets  # More secure for cryptographic purposes
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.cognitive.learning_orchestrator import AdaptiveResponse, LearningOrchestrator
from alejo.core.event_bus import Event, EventBus, EventType
from alejo.emotional_intelligence.adaptive_processor import (
    AdaptiveEmotionalProcessor,
    EmotionalState,
    InteractionStyle,
)
from alejo.learning.interactive_learner import InteractiveLearner, LearningFeedback


@pytest.fixture
async def event_bus():
    """Create a test event bus"""
    return EventBus()


@pytest.fixture
async def brain(event_bus):
    """Create a test brain instance"""
    brain = ALEJOBrain(event_bus=event_bus)
    await brain.initialize()
    return brain


@pytest.mark.asyncio
async def test_learning_orchestration(brain, event_bus):
    """Test that learning orchestration works end-to-end"""
    # Prepare test data
    test_command = "Hello ALEJO, how are you today?"

    # Process command
    response = await brain.process_command(test_command)
    assert response is not None

    # Verify learning orchestrator processed the interaction
    adaptation_status = brain.learning_orchestrator.get_adaptation_status()
    assert adaptation_status is not None
    assert "learning_summary" in adaptation_status
    assert "recent_emotions" in adaptation_status
    assert "current_style" in adaptation_status


@pytest.mark.asyncio
async def test_emotional_adaptation(brain):
    """Test that emotional adaptation affects responses"""
    # Process a neutral command
    neutral_response = await brain.process_command("What time is it?")

    # Process an emotional command
    emotional_response = await brain.process_command("I'm feeling really sad today")

    # Responses should be different due to emotional adaptation
    assert neutral_response != emotional_response

    # Check adaptation status
    status = brain.learning_orchestrator.get_adaptation_status()
    recent_emotions = status.get("recent_emotions", [])
    assert len(recent_emotions) > 0
    assert any(e.primary_emotion == "sadness" for e in recent_emotions)


@pytest.mark.asyncio
async def test_learning_feedback_loop(brain, event_bus):
    """Test that the learning feedback loop works"""
    # Mock the interactive learner to track feedback
    mock_learner = AsyncMock()
    brain.learning_orchestrator.interactive_learner = mock_learner

    # Process a command
    test_command = "Tell me a joke"
    await brain.process_command(test_command)

    # Verify feedback was processed
    mock_learner.process_feedback.assert_called()
    feedback = mock_learner.process_feedback.call_args[0][0]
    assert isinstance(feedback, LearningFeedback)
    assert feedback.interaction_id is not None
    assert feedback.timestamp is not None


@pytest.mark.asyncio
async def test_neurodivergent_adaptations(brain):
    """Test adaptations for neurodivergent interaction styles"""
    # Get initial style
    initial_status = brain.learning_orchestrator.get_adaptation_status()
    initial_style = initial_status["current_style"]

    # Process commands that suggest neurodivergent preferences
    commands = [
        "Can you be more specific?",
        "I need clear, direct communication",
        "Please don't use metaphors",
    ]

    for cmd in commands:
        await brain.process_command(cmd)

    # Check if style adapted
    final_status = brain.learning_orchestrator.get_adaptation_status()
    final_style = final_status["current_style"]

    # Verify adaptations were made
    assert final_style != initial_style
    assert final_style.neurodivergent_adaptations.get("clear_communication") is True


@pytest.mark.asyncio
async def test_event_emission(brain, event_bus):
    """Test that learning events are properly emitted"""
    events = []

    async def collect_events(event: Event):
        events.append(event)

    # Subscribe to adaptation events
    await event_bus.subscribe(EventType.ADAPTATION_UPDATED, collect_events)

    # Process a command
    await brain.process_command("How's the weather?")

    # Give events time to be processed
    await asyncio.sleep(0.1)

    # Verify events were emitted
    assert len(events) > 0
    assert any(e.type == EventType.ADAPTATION_UPDATED for e in events)

    # Check event data
    adaptation_event = next(e for e in events if e.type == EventType.ADAPTATION_UPDATED)
    assert "response" in adaptation_event.data
    assert "timestamp" in adaptation_event.data
