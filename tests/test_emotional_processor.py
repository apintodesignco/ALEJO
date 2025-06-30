"""
Tests for ALEJO's emotional processor.
"""

import pytest
import asyncio
from unittest.mock import MagicMock, patch

from alejo.cognitive.emotional.processor import EmotionalProcessor
from alejo.cognitive.memory.emotional_memory import EmotionalMemory
from alejo.core.events import Event, EventType

class TestEmotionalProcessor:
    """Tests for EmotionalProcessor class."""
    
    @pytest.fixture
    async def processor(self, event_bus):
        """Create EmotionalProcessor instance for testing."""
        memory = EmotionalMemory(event_bus)
        processor = EmotionalProcessor(memory, event_bus)
        await processor.start()
        yield processor
        await processor.stop()
        
    async def test_01_sentiment_analysis(self, processor):
        """Test sentiment analysis capabilities."""
        # Test positive sentiment
        result = await processor.analyze_sentiment("I'm really happy today!")
        assert result['sentiment']['label'] == 'POSITIVE'
        assert result['emotional_state']['valence'] > 0
        
        # Test negative sentiment
        result = await processor.analyze_sentiment("I'm feeling very sad.")
        assert result['sentiment']['label'] == 'NEGATIVE'
        assert result['emotional_state']['valence'] < 0
        
        # Test neutral text
        result = await processor.analyze_sentiment("The sky is blue.")
        assert -0.5 < result['emotional_state']['valence'] < 0.5
        
    async def test_02_empathetic_response(self, processor):
        """Test empathetic response generation."""
        # Test response to joy
        response, state = await processor.generate_empathetic_response(
            "I just got promoted at work!"
        )
        assert any(phrase in response.lower() for phrase in ['happy', 'wonderful', 'joy'])
        assert state['valence'] > 0
        
        # Test response to sadness
        response, state = await processor.generate_empathetic_response(
            "I lost my favorite book."
        )
        assert any(phrase in response.lower() for phrase in ['sorry', 'understand'])
        assert state['valence'] < 0
        
    async def test_03_context_awareness(self, processor):
        """Test context-aware response generation."""
        # Test with previous response context
        context = {
            'previous_responses': ["I'm happy to hear that!"]
        }
        
        response, _ = await processor.generate_empathetic_response(
            "This is great news!",
            context
        )
        
        # Should not repeat the previous response
        assert response != "I'm happy to hear that!"
        
    async def test_04_empathy_model_updates(self, processor):
        """Test empathy model adaptation."""
        initial_threshold = processor.empathy_threshold
        
        # Simulate successful interaction
        await processor.update_empathy_model({
            'success_rating': 0.9,
            'interaction_type': 'comfort',
            'user_feedback': 'positive'
        })
        
        # Check parameters adapted
        assert processor.empathy_threshold != initial_threshold
        
        # Simulate unsuccessful interaction
        await processor.update_empathy_model({
            'success_rating': 0.2,
            'interaction_type': 'comfort',
            'user_feedback': 'negative'
        })
        
        # Check parameters adapted again
        assert processor.empathy_threshold != initial_threshold
        
    async def test_05_event_handling(self, processor, event_bus):
        """Test event handling capabilities."""
        # Test perception event
        event = Event(
            type=EventType.PERCEPTION,
            source='text_input',
            payload={
                'text': "I'm feeling great today!",
                'context': {'situation': 'morning_greeting'}
            }
        )
        
        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing
        
        # Verify emotional state was updated
        state = await processor.emotional_memory.get_current_state()
        assert state.valence > 0
        
    async def test_06_arousal_estimation(self, processor):
        """Test arousal level estimation."""
        # Test high arousal text
        result = await processor.analyze_sentiment("WOW! This is AMAZING!!!")
        assert result['emotional_state']['arousal'] > 0.5
        
        # Test low arousal text
        result = await processor.analyze_sentiment("It's quite peaceful here.")
        assert result['emotional_state']['arousal'] < 0.5
        
    async def test_07_dominance_estimation(self, processor):
        """Test dominance level estimation."""
        # Test high dominance text
        result = await processor.analyze_sentiment("I will definitely succeed!")
        assert result['emotional_state']['dominance'] > 0
        
        # Test low dominance text
        result = await processor.analyze_sentiment("I'm not sure what to do...")
        assert result['emotional_state']['dominance'] < 0
