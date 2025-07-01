"""Integration tests for AdaptiveEmotionalProcessor"""

import pytest
from datetime import datetime, timedelta
import json

from unittest.mock import AsyncMock, MagicMock, patch

from alejo.emotional_intelligence.adaptive_processor import AdaptiveEmotionalProcessor
from alejo.emotional_intelligence.emotional_core import EmotionalDimension, EmotionalState
from alejo.emotional_intelligence.memory import EmotionalMemoryService
from alejo.core.event_bus import Event, EventType
from alejo.learning.orchestrator import LearningOrchestrator
import secrets  # More secure for cryptographic purposes

@pytest.fixture
async def memory_service():
    """Create mock EmotionalMemoryService for testing"""
    service = AsyncMock(spec=EmotionalMemoryService)
    
    # Mock store_interaction to return None
    service.store_interaction = AsyncMock(return_value=None)
    
    # Mock get_emotional_summary to return test data
    service.get_emotional_summary = AsyncMock(return_value={
        "interactions": [
            {
                "timestamp": datetime.now().isoformat(),
                "emotion": "joy",
                "intensity": 0.8,
                "context": {"trigger": "achievement"},
                "response": "empathetic_acknowledgment"
            }
        ]
    })
    
    # Mock get_emotional_patterns to return test patterns
    service.get_emotional_patterns = AsyncMock(return_value=[
        {
            "trigger": "achievement",
            "emotion": "joy",
            "frequency": 0.8,
            "confidence": 0.9
        }
    ])
    
    # Mock get_nostalgic_memories to return test memories
    service.get_nostalgic_memories = AsyncMock(return_value=[
        {
            "timestamp": datetime.now().isoformat(),
            "emotion": "joy",
            "intensity": 0.8,
            "context": {"trigger": "achievement"},
            "response": "empathetic_acknowledgment"
        }
    ])
    
    # Mock get_similar_memories to return test memories
    service.get_similar_memories = AsyncMock(return_value=[
        {
            "timestamp": datetime.now().isoformat(),
            "emotion": "joy",
            "intensity": 0.8,
            "context": {"trigger": "achievement"},
            "response": "empathetic_acknowledgment",
            "match_type": "trigger"
        }
    ])
    
    return service

@pytest.fixture
def event_bus():
    """Create mock EventBus for testing"""
    bus = MagicMock()
    bus.emit = AsyncMock(return_value=None)
    bus.get_recent_events = MagicMock(return_value=[
        Event(
            type=EventType.EMOTIONAL_STATE_UPDATE,
            data={
                "state": EmotionalState(
                    primary_emotion="joy",
                    secondary_emotion=None,
                    valence=0.8,
                    arousal=0.6,
                    confidence=0.9,
                    context={"trigger": "achievement"},
                    timestamp=datetime.now()
                ),
                "response": "empathetic_acknowledgment",
                "personality": {}
            }
        )
    ])
    return bus

@pytest.fixture
def learning_orchestrator():
    """Create mock LearningOrchestrator for testing"""
    orchestrator = MagicMock(spec=LearningOrchestrator)
    orchestrator.get_interaction_preferences = MagicMock(return_value={
        "pace": "fast",
        "detail": "brief",
        "support": "high"
    })
    return orchestrator

@pytest.fixture
async def processor(memory_service, event_bus, learning_orchestrator):
    """Create AdaptiveEmotionalProcessor for testing"""
    processor = AdaptiveEmotionalProcessor(
        memory_service=memory_service,
        event_bus=event_bus,
        learning_orchestrator=learning_orchestrator
    )
    return processor

@pytest.mark.asyncio
async def test_process_emotion_integration(processor, memory_service, event_bus):
    """Test end-to-end emotion processing with memory storage and event emission"""
    # Process an emotion
    emotion = "joy"
    intensity = 0.8
    context = {
        "trigger": "achievement",
        "user_state": "focused",
        "facial_confidence": 0.9
    }
    
    state = await processor.process_emotion(emotion, intensity, context)
    
    # Verify emotional state
    assert state.primary_emotion == emotion
    assert state.valence > 0  # Joy should have positive valence
    assert state.arousal > 0  # Joy should have moderate arousal
    assert state.confidence > 0.8  # High confidence due to facial data
    
    # Verify memory storage
    summary = await memory_service.get_emotional_summary(
        start_time=datetime.now() - timedelta(hours=1),
        end_time=datetime.now()
    )
    assert len(summary["interactions"]) == 1
    interaction = summary["interactions"][0]
    assert interaction["emotion"] == emotion
    assert interaction["intensity"] == intensity
    assert interaction["dimensions"][EmotionalDimension.VALENCE.name] > 0
    
    # Verify event emission
    events = event_bus.get_recent_events(EventType.EMOTIONAL_STATE_UPDATE)
    assert len(events) == 1
    event_data = events[0].data
    assert event_data["state"] == state
    assert "personality" in event_data

@pytest.mark.asyncio
async def test_adapt_interaction_style_integration(processor, learning_orchestrator):
    """Test interaction style adaptation with learning orchestrator"""
    # Provide feedback data
    feedback = {
        "response_times": [1.5, 1.8, 1.6],  # Fast responses
        "message_lengths": [40, 35, 45],     # Brief messages
        "interaction_patterns": {
            "needs_clarity": True,
            "sensory_sensitivity": True
        },
        "emotional_responses": {
            "seeks_support": 0.8
        }
    }
    
    style = await processor.adapt_interaction_style(feedback)
    
    # Verify adapted style
    assert style.communication_pace == "fast"
    assert style.detail_level == "brief"
    assert style.emotional_support == "high"
    assert style.neurodivergent_adaptations["clear_communication"]
    assert style.neurodivergent_adaptations["sensory_considerations"]
    
    # Verify learning orchestrator integration
    assert learning_orchestrator.get_interaction_preferences() == {
        "pace": "fast",
        "detail": "brief",
        "support": "high"
    }

@pytest.mark.asyncio
async def test_emotional_memory_persistence(processor, memory_service):
    """Test persistence of emotional interactions across sessions"""
    # Process multiple emotions
    emotions = [
        ("joy", 0.8, {"trigger": "achievement"}),
        ("sadness", 0.6, {"trigger": "loss"}),
        ("anger", 0.7, {"trigger": "frustration"})
    ]
    
    for emotion, intensity, context in emotions:
        await processor.process_emotion(emotion, intensity, context)
    
    # Get emotional patterns
    patterns = await memory_service.get_emotional_patterns(
        start_time=datetime.now() - timedelta(hours=1),
        end_time=datetime.now()
    )
    
    # Verify patterns were stored and analyzed
    assert len(patterns) > 0
    assert any(p["trigger"] == "achievement" for p in patterns)
    assert any(p["emotion"] == "joy" for p in patterns)
    
    # Test nostalgic memory retrieval
    nostalgic = await memory_service.get_nostalgic_memories("achievement")
    assert len(nostalgic) > 0
    assert nostalgic[0]["emotion"] == "joy"
    
    # Test similar memory retrieval
    similar = await memory_service.get_similar_memories(
        trigger="achievement",
        context={"user_state": "focused"}
    )
    assert len(similar) > 0