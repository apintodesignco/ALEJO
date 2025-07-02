"""Integration tests for ALEJOBrain proactive dialogue functionality"""

import secrets  # More secure for cryptographic purposes
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.core.event_bus import EventBus
from alejo.emotional_intelligence.adaptive_processor import AdaptiveEmotionalProcessor
from alejo.emotional_intelligence.emotional_core import EmotionalCore


@pytest.fixture
async def brain():
    """Create a test instance of ALEJOBrain with mocked dependencies"""
    config = {
        "proactive_dialogue": {"min_interval_seconds": 5}  # Short interval for testing
    }
    event_bus = EventBus()
    brain = ALEJOBrain(config=config, event_bus=event_bus)

    # Mock dependencies
    brain.adaptive_processor = AsyncMock(spec=AdaptiveEmotionalProcessor)
    brain.emotional_processor = AsyncMock(spec=EmotionalCore)
    brain.adaptive_engine = AsyncMock()

    # Initialize brain
    await brain.setup()
    return brain


@pytest.mark.asyncio
async def test_proactive_dialogue_timing(brain):
    """Test that proactive questions respect the minimum interval"""
    # Mock emotional context and adaptive response
    brain.emotional_processor.process.return_value = {"emotion": "neutral"}
    brain.adaptive_engine.get_adaptive_response.return_value = "Here's a response"

    # Mock proactive questions
    brain.adaptive_processor.get_proactive_question.return_value = (
        "How are you feeling?"
    )

    # Process first text - should get proactive question
    responses = []
    async for response in brain.process_text("Hello"):
        responses.append(response)

    assert len(responses) == 2
    assert responses[0]["type"] == "direct_response"
    assert responses[1]["type"] == "proactive_question"

    # Process second text immediately - should not get proactive question
    responses = []
    async for response in brain.process_text("I'm doing well"):
        responses.append(response)

    assert len(responses) == 1
    assert responses[0]["type"] == "direct_response"

    # Wait for interval
    brain._last_proactive_check = datetime.now() - timedelta(seconds=10)

    # Process third text - should get proactive question again
    responses = []
    async for response in brain.process_text("What's next?"):
        responses.append(response)

    assert len(responses) == 2
    assert responses[0]["type"] == "direct_response"
    assert responses[1]["type"] == "proactive_question"


@pytest.mark.asyncio
async def test_proactive_response_handling(brain):
    """Test handling of responses to proactive questions"""
    # Mock emotional context and adaptive response
    brain.emotional_processor.process.return_value = {"emotion": "happy"}
    brain.adaptive_engine.get_adaptive_response.return_value = "I understand"

    # Mock proactive question
    question = "How are you feeling today?"
    brain.adaptive_processor.get_proactive_question.return_value = question

    # Process initial text to get proactive question
    responses = []
    async for response in brain.process_text("Hi"):
        responses.append(response)

    assert len(responses) == 2
    assert responses[1]["text"] == question

    # Process response to proactive question
    await brain.process_response("I'm feeling great!", is_proactive_response=True)

    # Verify adaptive processor handled the response
    brain.adaptive_processor.process_question_response.assert_called_once_with(
        "I'm feeling great!", {}
    )

    # Verify emotional state was updated
    brain.emotional_processor.update_emotional_state.assert_called()


@pytest.mark.asyncio
async def test_graceful_failure_emotional_components(brain):
    """Test graceful handling when emotional components are unavailable"""
    # Simulate emotional processor failure
    brain.emotional_processor.process.side_effect = Exception("Service unavailable")

    # Process text - should still work without emotional processing
    responses = []
    async for response in brain.process_text("Hello"):
        responses.append(response)

    # Should still get direct response but no proactive question
    assert len(responses) == 1
    assert responses[0]["type"] == "direct_response"

    # Simulate adaptive processor failure
    brain.emotional_processor.process.side_effect = None
    brain.adaptive_processor.get_proactive_question.side_effect = Exception(
        "Service unavailable"
    )

    # Process text - should still work without proactive questions
    responses = []
    async for response in brain.process_text("Hi again"):
        responses.append(response)

    assert len(responses) == 1
    assert responses[0]["type"] == "direct_response"


@pytest.mark.asyncio
async def test_non_answer_handling(brain):
    """Test handling when user doesn't directly answer a proactive question"""
    # Mock proactive question
    question = "How are you feeling today?"
    brain.adaptive_processor.get_proactive_question.return_value = question

    # Get initial proactive question
    responses = []
    async for response in brain.process_text("Hello"):
        responses.append(response)

    assert responses[1]["type"] == "proactive_question"

    # User changes subject instead of answering
    responses = []
    async for response in brain.process_text("What's the weather like?"):
        responses.append(response)

    # Should handle gracefully and not force an answer
    assert len(responses) == 1
    assert responses[0]["type"] == "direct_response"

    # Should not immediately ask another question
    brain._last_proactive_check = datetime.now() - timedelta(seconds=10)
    responses = []
    async for response in brain.process_text("Tell me more about the weather"):
        responses.append(response)

    assert len(responses) == 1


@pytest.mark.asyncio
async def test_conversation_state_management(brain):
    """Test management of conversation state over multiple turns"""
    # Mock initial emotional state
    brain.emotional_processor.process.return_value = {"emotion": "neutral"}
    brain.adaptive_processor.get_proactive_question.return_value = (
        "How are you feeling?"
    )

    # Start conversation
    responses = []
    async for response in brain.process_text("Hi ALEJO"):
        responses.append(response)

    assert len(responses) == 2
    assert responses[1]["type"] == "proactive_question"

    # User answers emotionally
    brain.emotional_processor.process.return_value = {"emotion": "sad"}
    responses = []
    async for response in brain.process_text(
        "I'm feeling down today", is_proactive_response=True
    ):
        responses.append(response)

    # Should update emotional state and respond empathetically
    brain.emotional_processor.update_emotional_state.assert_called()
    assert len(responses) == 1

    # Next turn should be influenced by previous emotional state
    brain.adaptive_processor.get_proactive_question.return_value = (
        "Would you like to talk about what's bothering you?"
    )
    brain._last_proactive_check = datetime.now() - timedelta(seconds=10)

    responses = []
    async for response in brain.process_text("I don't know what to do"):
        responses.append(response)

    assert len(responses) == 2
    assert "bothering you" in responses[1]["text"]


@pytest.mark.asyncio
async def test_proactive_dialogue_disabled(brain):
    """Test that proactive dialogue is disabled when adaptive processor is not available"""
    # Remove adaptive processor
    brain.adaptive_processor = None

    # Mock emotional context and adaptive response
    brain.emotional_processor.process.return_value = {"emotion": "neutral"}
    brain.adaptive_engine.get_adaptive_response.return_value = "Here's a response"

    # Process text - should not get proactive question
    responses = []
    async for response in brain.process_text("Hello"):
        responses.append(response)

    assert len(responses) == 1
    assert responses[0]["type"] == "direct_response"
