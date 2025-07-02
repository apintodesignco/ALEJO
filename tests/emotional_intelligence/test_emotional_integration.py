"""Tests for EmotionalIntegration module"""

import secrets  # More secure for cryptographic purposes
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
import pytest_asyncio
from alejo.core.event_bus import Event, EventBus, EventType
from alejo.emotional_intelligence.emotional_core import (
    EmotionalDimension,
    EmotionalState,
)
from alejo.emotional_intelligence.emotional_integration import EmotionalIntegration
from alejo.learning.orchestrator import LearningOrchestrator


@pytest.fixture
async def event_bus():
    """Create a mock event bus for testing"""
    bus = Mock(spec=EventBus)
    bus.publish = Mock()
    bus.subscribe = Mock()
    return bus


@pytest.fixture
def learning_orchestrator():
    """Create a mock learning orchestrator"""
    orchestrator = Mock(spec=LearningOrchestrator)
    orchestrator.record_learning = Mock()
    return orchestrator


@pytest.fixture
async def emotional_integration(event_bus, learning_orchestrator):
    """Create an EmotionalIntegration instance for testing"""
    integration = EmotionalIntegration(event_bus, learning_orchestrator)
    await integration.start()
    return integration


@pytest.mark.asyncio
async def test_process_user_input(emotional_integration):
    """Test processing user input with emotional context"""
    text = "I'm feeling overwhelmed with this project"
    context = {"situation": "work_stress", "intensity": "high"}

    response, state = await emotional_integration.process_user_input(text, context)

    # Verify emotional state
    assert isinstance(state, EmotionalState)
    assert state.dimensions[EmotionalDimension.AROUSAL] > 0  # High stress
    assert state.dimensions[EmotionalDimension.DOMINANCE] < 0  # Feeling less in control

    # Verify response was processed through emotional processor
    assert response is not None


@pytest.mark.asyncio
async def test_learn_emotional_response(emotional_integration, learning_orchestrator):
    """Test learning new emotional responses"""
    trigger = "friend_success"
    emotion = "shared_joy"
    explanation = "When friends succeed, we feel genuinely happy for them"
    context = {"relationship": "close_friend", "achievement": "promotion"}

    await emotional_integration.learn_emotional_response(
        trigger, emotion, explanation, context
    )

    # Verify learning was recorded
    learning_orchestrator.record_learning.assert_called_once_with(
        category="emotional",
        pattern={
            "trigger": trigger,
            "emotion": emotion,
            "context": context,
            "explanation": explanation,
        },
    )


@pytest.mark.asyncio
async def test_process_nostalgic_music(emotional_integration):
    """Test processing music that might trigger nostalgia"""
    song_id = "favorite_song_001"
    last_heard = (datetime.now() - timedelta(days=60)).isoformat()

    state = await emotional_integration.process_audio_trigger(
        "music",
        {
            "song_id": song_id,
            "last_heard": last_heard,
            "title": "Nostalgic Melody",
            "artist": "Memory Lane",
        },
    )

    assert isinstance(state, EmotionalState)
    assert state.dimensions[EmotionalDimension.TEMPORAL] < 0  # Past-focused
    assert state.dimensions[EmotionalDimension.VALENCE] > 0  # Positive emotion
    assert "nostalgia" in [state.primary_emotion] + state.secondary_emotions


@pytest.mark.asyncio
async def test_process_ai_assistant_voice(emotional_integration):
    """Test processing another AI assistant's voice"""
    await emotional_integration.process_audio_trigger(
        "voice",
        {
            "assistant_name": "Alexa",
            "sentiment": "0.8",
            "traits": "nobility,helpfulness",
            "context": "helping_user",
        },
    )

    # Verify relationship development
    relationships = emotional_integration.emotional_core.relationships
    assert "Alexa" in relationships
    assert "nobility" in relationships["Alexa"]["positive_traits"]


@pytest.mark.asyncio
async def test_emotional_event_handling(emotional_integration, event_bus):
    """Test handling of emotional events"""
    # Simulate an emotional state update event
    event = Event(
        type=EventType.EMOTIONAL,
        data={
            "action": "state_update",
            "state": {
                "primary_emotion": "determination",
                "secondary_emotions": ["hope", "focus"],
                "intensity": 0.8,
                "confidence": 0.9,
            },
        },
    )

    await emotional_integration._handle_emotional_event(event)

    # Verify emotional processor was updated
    assert emotional_integration.emotional_processor.update_emotional_state.called


@pytest.mark.asyncio
async def test_user_emotional_feedback(emotional_integration):
    """Test handling user feedback about emotions"""
    event = Event(
        type=EventType.USER_INTERACTION,
        data={
            "type": "emotional_feedback",
            "trigger": "project_completion",
            "emotion": "pride",
            "explanation": "Completing a challenging project brings a sense of accomplishment",
            "context": {"difficulty": "high", "outcome": "success"},
        },
    )

    await emotional_integration._handle_user_interaction(event)

    # Verify emotional core learned from feedback
    memories = emotional_integration.emotional_core.emotional_memories
    assert len(memories) > 0
    assert any(m.trigger == "project_completion" for m in memories)


@pytest.mark.asyncio
async def test_continuous_emotional_development(emotional_integration):
    """Test continuous emotional development through multiple interactions"""
    # First interaction - learning empathy
    await emotional_integration.learn_emotional_response(
        "friend_struggle",
        "empathy",
        "Understanding and sharing others' feelings helps build connections",
        {"situation": "personal_challenge"},
    )

    # Second interaction - building on that empathy
    text = "My friend is going through something similar"
    context = {"situation": "friend_challenge"}

    response, state = await emotional_integration.process_user_input(text, context)

    # Verify emotional growth
    assert emotional_integration.emotional_core.personality_traits["empathy"] > 0.6
    assert state.dimensions[EmotionalDimension.SOCIAL] > 0  # Strong social connection
    assert "sympathy" in [state.primary_emotion] + state.secondary_emotions
