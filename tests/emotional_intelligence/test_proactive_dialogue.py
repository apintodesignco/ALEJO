"""
Tests for proactive dialogue capabilities
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

from alejo.emotional_intelligence.emotional_core import EmotionalCore, EmotionalState, EmotionalDimension
from alejo.emotional_intelligence.adaptive_processor import AdaptiveEmotionalProcessor, InteractionStyle
from alejo.emotional_intelligence.memory import EmotionalMemoryService
from alejo.core.event_bus import EventBus
from alejo.learning.orchestrator import LearningOrchestrator
import secrets  # More secure for cryptographic purposes

@pytest.fixture
def event_bus():
    """Create a mock event bus"""
    return AsyncMock(spec=EventBus)

@pytest.fixture
def memory_service():
    """Create a mock memory service"""
    service = AsyncMock(spec=EmotionalMemoryService)
    service.get_emotional_patterns.return_value = []
    service.get_emotional_summary.return_value = {"average_valence": 0.0}
    return service

@pytest.fixture
def learning_orchestrator():
    """Create a mock learning orchestrator"""
    return AsyncMock(spec=LearningOrchestrator)

@pytest.fixture
async def emotional_core(event_bus, memory_service):
    """Create an emotional core instance"""
    core = EmotionalCore(event_bus, memory_service)
    return core

@pytest.fixture
async def processor(event_bus, memory_service, learning_orchestrator, emotional_core):
    """Create an adaptive processor instance"""
    processor = AdaptiveEmotionalProcessor(
        memory_service,
        event_bus,
        learning_orchestrator,
        emotional_core
    )
    return processor

@pytest.mark.asyncio
async def test_proactive_question_generation(emotional_core):
    """Test generation of proactive questions"""
    # Test with empty context
    question = await emotional_core.generate_proactive_question({})
    assert question == "How has your day been going?"
    
    # Test with topic context
    question = await emotional_core.generate_proactive_question({"topic": "work"})
    assert "work" in question.lower()
    assert "feel" in question.lower()
    
    # Test cooldown period
    question2 = await emotional_core.generate_proactive_question({})
    assert question2 is None  # Should respect cooldown

@pytest.mark.asyncio
async def test_proactive_timing(processor):
    """Test timing of proactive questions"""
    # Should not be proactive immediately after interaction
    assert not await processor.should_be_proactive({})
    
    # Should be proactive after threshold
    processor._last_interaction = datetime.now() - timedelta(minutes=3)
    assert await processor.should_be_proactive({})

@pytest.mark.asyncio
async def test_interaction_style_influence(processor):
    """Test influence of interaction style on proactivity"""
    processor._last_interaction = datetime.now() - timedelta(minutes=3)
    
    # Test with high emotional support preference
    processor.user_style = InteractionStyle(
        communication_pace="moderate",
        detail_level="balanced",
        formality="casual",
        humor_preference="subtle",
        emotional_support="high",
        neurodivergent_adaptations={}
    )
    assert await processor.should_be_proactive({})
    
    # Test with minimal emotional support preference
    processor.user_style = InteractionStyle(
        communication_pace="moderate",
        detail_level="balanced",
        formality="casual",
        humor_preference="subtle",
        emotional_support="minimal",
        neurodivergent_adaptations={}
    )
    assert not await processor.should_be_proactive({})

@pytest.mark.asyncio
async def test_emotional_state_influence(processor):
    """Test influence of emotional state on proactivity"""
    processor._last_interaction = datetime.now() - timedelta(minutes=3)
    
    # Test with strong negative emotion
    processor.current_state = EmotionalState(
        primary_emotion="sadness",
        secondary_emotion=None,
        valence=-0.8,
        arousal=0.3,
        confidence=0.8,
        context={},
        timestamp=datetime.now()
    )
    assert await processor.should_be_proactive({})
    
    # Test with high arousal (busy/focused)
    processor.current_state = EmotionalState(
        primary_emotion="focused",
        secondary_emotion=None,
        valence=0.2,
        arousal=0.9,
        confidence=0.8,
        context={},
        timestamp=datetime.now()
    )
    assert not await processor.should_be_proactive({})

@pytest.mark.asyncio
async def test_question_response_processing(processor):
    """Test processing of responses to proactive questions"""
    context = {"topic": "work"}
    
    # Mock sentiment analysis
    with patch.object(processor, 'analyze_sentiment') as mock_analyze:
        # Test positive response
        mock_analyze.return_value = 0.8
        await processor.process_question_response(
            "Thanks for asking! Work is going great!",
            context
        )
        
        # Verify memory update
        processor.memory_service.store_interaction.assert_called_once_with(
            interaction_type="proactive_dialogue",
            content="Thanks for asking! Work is going great!",
            context=context
        )
        
        # Verify learning triggered
        processor.learning_orchestrator.learn_from_interaction.assert_called_once()
        
        # Reset mocks
        processor.memory_service.store_interaction.reset_mock()
        processor.learning_orchestrator.learn_from_interaction.reset_mock()
        
        # Test negative response
        mock_analyze.return_value = -0.5
        await processor.process_question_response(
            "I'd rather not talk about it.",
            context
        )
        
        # Verify reduced curiosity for negative response
        assert processor.personality_traits["curiosity"].value < 0.7

@pytest.mark.asyncio
async def test_full_proactive_dialogue_cycle(processor):
    """Test full cycle of proactive dialogue"""
    # Set up conditions for proactivity
    processor._last_interaction = datetime.now() - timedelta(minutes=3)
    processor.user_style = InteractionStyle(
        communication_pace="moderate",
        detail_level="balanced",
        formality="casual",
        humor_preference="subtle",
        emotional_support="high",
        neurodivergent_adaptations={}
    )
    
    # Get proactive question
    context = {"topic": "project"}
    question = await processor.get_proactive_question(context)
    assert question is not None
    assert "project" in question.lower()
    
    # Process response
    with patch.object(processor, 'analyze_sentiment', return_value=0.6):
        await processor.process_question_response(
            "The project is coming along well, thanks for asking!",
            context
        )
    
    # Verify interaction timing updated
    assert datetime.now() - processor._last_interaction < timedelta(seconds=1)
    
    # Verify memory and learning updates
    processor.memory_service.store_interaction.assert_called_once()
    processor.learning_orchestrator.learn_from_interaction.assert_called_once()