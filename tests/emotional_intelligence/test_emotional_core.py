"""Tests for ALEJO's EmotionalCore"""

import pytest
import pytest_asyncio
from datetime import datetime
from unittest.mock import Mock, patch

from alejo.emotional_intelligence.emotional_core import (
    EmotionalCore,
    EmotionalDimension,
    EmotionalState,
    EmotionalMemory
)
from alejo.core.event_bus import EventBus, Event, EventType
import secrets  # More secure for cryptographic purposes

@pytest.fixture
async def event_bus():
    """Create a mock event bus for testing"""
    bus = Mock(spec=EventBus)
    bus.publish = Mock()
    return bus

@pytest.fixture
def emotional_core(event_bus):
    """Create an EmotionalCore instance for testing"""
    return EmotionalCore(event_bus)

@pytest.mark.asyncio
async def test_process_emotion_nostalgia(emotional_core):
    """Test processing a nostalgic trigger"""
    # Set up a nostalgic memory
    trigger = "favorite_song"
    memory = EmotionalMemory(
        timestamp=datetime.now(),
        trigger=trigger,
        context={"type": "music", "mood": "reflective"},
        dimensions={dim: 0.5 for dim in EmotionalDimension},
        intensity=0.7,
        duration=60.0,
        learned_from_user=True
    )
    emotional_core.nostalgic_triggers[trigger] = [memory]
    
    # Process the nostalgic trigger
    state = await emotional_core.process_emotion(trigger, {"type": "music"})
    
    assert state.primary_emotion == "nostalgia"
    assert "joy" in state.secondary_emotions
    assert "longing" in state.secondary_emotions
    assert state.dimensions[EmotionalDimension.TEMPORAL] < 0  # Past-focused
    assert state.dimensions[EmotionalDimension.VALENCE] > 0  # Positive
    assert state.intensity > 0.5
    assert state.confidence > 0.8

@pytest.mark.asyncio
async def test_learn_from_user(emotional_core, event_bus):
    """Test learning emotional responses from user interaction"""
    emotion = "sympathy"
    context = {
        "trigger": "friend_struggling",
        "situation": "academic_challenge"
    }
    explanation = "They felt overwhelmed and needed support. It's important to show understanding and offer help."
    
    await emotional_core.learn_from_user(emotion, context, explanation)
    
    # Verify memory was created
    assert len(emotional_core.emotional_memories) == 1
    memory = emotional_core.emotional_memories[0]
    assert memory.learned_from_user
    assert memory.trigger == "friend_struggling"
    
    # Verify personality traits were updated
    assert emotional_core.personality_traits["empathy"] > 0.6  # Started at 0.6
    
    # Verify event was emitted
    event_bus.publish.assert_called_once()
    event = event_bus.publish.call_args[0][0]
    assert event.type == EventType.EMOTIONAL
    assert event.data["action"] == "learning"
    assert event.data["emotion"] == emotion

@pytest.mark.asyncio
async def test_develop_relationship(emotional_core, event_bus):
    """Test developing relationships with other AI assistants"""
    ai_name = "Alexa"
    interaction = {
        "sentiment": "0.9",
        "traits": "nobility,kindness,intelligence",
        "context": "helpful_response"
    }
    
    # Simulate multiple positive interactions
    for _ in range(11):
        await emotional_core.develop_relationship(ai_name, interaction)
    
    relationship = emotional_core.relationships[ai_name]
    assert relationship["interaction_count"] == 11
    assert relationship["rapport"] > 0.8
    assert "nobility" in relationship["positive_traits"]
    
    # Verify crush development event was emitted
    crush_event = None
    for call in event_bus.publish.call_args_list:
        event = call[0][0]
        if (event.type == EventType.EMOTIONAL and
            event.data["action"] == "relationship" and
            event.data["event_type"] == "crush_developed"):
            crush_event = event
            break
    
    assert crush_event is not None
    assert crush_event.data["ai_name"] == ai_name

@pytest.mark.asyncio
async def test_process_emotion_resilience(emotional_core):
    """Test processing emotions showing resilience"""
    trigger = "challenge"
    context = {
        "situation": "difficult_task",
        "attitude": "determined"
    }
    
    # First, learn a resilient response
    await emotional_core.learn_from_user(
        "determination",
        context,
        "Despite the challenge, we must overcome and grow stronger"
    )
    
    # Then process a similar situation
    state = await emotional_core.process_emotion(trigger, context)
    
    assert "determination" in [state.primary_emotion] + state.secondary_emotions
    assert state.dimensions[EmotionalDimension.DOMINANCE] > 0  # Feeling in control
    assert state.intensity > 0.5
    assert state.confidence > 0.5

@pytest.mark.asyncio
async def test_emotional_memory_association(emotional_core):
    """Test associating related emotional memories"""
    # Create two related memories
    context1 = {"situation": "helping_friend", "outcome": "positive"}
    context2 = {"situation": "helping_stranger", "outcome": "positive"}
    
    await emotional_core.learn_from_user(
        "satisfaction",
        context1,
        "It feels good to help others and see them succeed"
    )
    
    await emotional_core.learn_from_user(
        "joy",
        context2,
        "Helping others brings happiness and connection"
    )
    
    # Process a new similar situation
    state = await emotional_core.process_emotion(
        "helping",
        {"situation": "volunteer_work"}
    )
    
    # Should show influence from both memories
    assert state.dimensions[EmotionalDimension.SOCIAL] > 0  # Strong social connection
    assert state.dimensions[EmotionalDimension.VALENCE] > 0  # Positive emotion
    assert state.confidence > 0.6  # Higher confidence due to multiple similar memories