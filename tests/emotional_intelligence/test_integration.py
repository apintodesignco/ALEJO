"""
Integration tests for the Emotional Intelligence integration with ALEJO Brain
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

from alejo.core.event_bus import EventBus
from alejo.database.memory_store import MemoryStore
from alejo.emotional_intelligence.ethics import EthicalDecision, EthicalFramework
from alejo.emotional_intelligence.integration import EmotionalIntelligenceIntegration
from alejo.emotional_intelligence.memory import EmotionalMemory
from alejo.emotional_intelligence.processor import EmotionalProcessor, EmotionalState


# Mock classes
class MockBrain:
    """Mock brain for testing"""

    def __init__(self):
        self.event_bus = MagicMock()
        self.memory_store = MagicMock()
        self.short_term_memory = []
        self.conversation_history = {}

    async def add_to_short_term_memory(self, entry):
        """Add to short-term memory"""
        self.short_term_memory.append(entry)
        return True

    async def add_to_conversation_history(self, user_id, message):
        """Add to conversation history"""
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []
        self.conversation_history[user_id].append(message)
        return True


class MockEmotionalProcessor:
    """Mock emotional processor for testing"""

    def analyze_sentiment(self, text, context=None):
        """Mock sentiment analysis"""
        return EmotionalState(
            valence=0.7 if "happy" in text.lower() else -0.3,
            arousal=0.6,
            dominance=0.5,
            primary_emotion="joy" if "happy" in text.lower() else "sadness",
            emotion_scores=(
                {"joy": 0.8, "sadness": 0.1, "anger": 0.05, "fear": 0.05}
                if "happy" in text.lower()
                else {"joy": 0.1, "sadness": 0.7, "anger": 0.1, "fear": 0.1}
            ),
            confidence=0.85,
            context_relevance=0.9,
        )

    def generate_emotional_response(self, input_text, context, target_emotion=None):
        """Mock emotional response generation"""
        if "happy" in input_text.lower():
            return "I'm glad to hear that you're feeling happy!"
        elif "sad" in input_text.lower():
            return "I'm sorry to hear that you're feeling down. Is there anything I can do to help?"
        else:
            return "I understand. Please tell me more about how you're feeling."

    def get_interaction_recommendation(self, state, context=None):
        """Mock interaction recommendation"""
        if state.primary_emotion == "joy":
            return {
                "formality": 0.4,
                "humor": 0.7,
                "complexity": 0.5,
                "empathy": 0.6,
                "response_speed": 0.7,
            }
        elif state.primary_emotion == "sadness":
            return {
                "formality": 0.5,
                "humor": 0.3,
                "complexity": 0.4,
                "empathy": 0.9,
                "response_speed": 0.5,
            }
        else:
            return {
                "formality": 0.5,
                "humor": 0.5,
                "complexity": 0.5,
                "empathy": 0.7,
                "response_speed": 0.5,
            }


class MockEthicalFramework:
    """Mock ethical framework for testing"""

    def evaluate_action(self, action, context):
        """Mock ethical evaluation"""
        if "share" in action.lower() and "personal" in action.lower():
            return EthicalDecision(
                action=action,
                context=context,
                value_alignment=0.3,
                justification="Sharing personal information raises privacy concerns",
                principles_considered=["privacy", "autonomy"],
            )
        else:
            return EthicalDecision(
                action=action,
                context=context,
                value_alignment=0.9,
                justification="Action aligns with ethical principles",
                principles_considered=["beneficence", "autonomy"],
            )


class MockEmotionalMemory:
    """Mock emotional memory for testing"""

    def __init__(self):
        self.memory = {}

    async def store_emotional_state(self, user_id, state, text=None, context=None):
        """Mock storing emotional state"""
        if user_id not in self.memory:
            self.memory[user_id] = []

        self.memory[user_id].append(
            {
                "state": state,
                "text": text,
                "context": context,
                "timestamp": "2023-01-01T12:00:00",
            }
        )

        return True

    async def get_emotional_history(self, user_id, limit=10):
        """Mock getting emotional history"""
        if user_id not in self.memory:
            return []

        return self.memory[user_id][:limit]


# Fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Clean up
    import shutil

    shutil.rmtree(temp_dir)


@pytest.fixture
def config_file(temp_dir):
    """Create a temporary config file"""
    config = {
        "empathy_threshold": 0.8,
        "ethical_evaluation_threshold": 0.7,
        "emotion_tracking_enabled": True,
        "adaptive_personality_enabled": True,
        "ethical_logging_enabled": True,
        "default_interaction_style": {
            "formality": 0.6,
            "humor": 0.4,
            "complexity": 0.5,
            "empathy": 0.8,
            "response_speed": 0.5,
        },
    }

    config_path = os.path.join(temp_dir, "emotional_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f)

    return config_path


@pytest.fixture
def mock_brain():
    """Create a mock brain"""
    return MockBrain()


@pytest.fixture
def mock_emotional_processor():
    """Create a mock emotional processor"""
    return MockEmotionalProcessor()


@pytest.fixture
def mock_ethical_framework():
    """Create a mock ethical framework"""
    return MockEthicalFramework()


@pytest.fixture
def mock_emotional_memory():
    """Create a mock emotional memory"""
    return MockEmotionalMemory()


@pytest.fixture
def emotional_integration(
    mock_brain, mock_emotional_processor, mock_ethical_framework, mock_emotional_memory
):
    """Create an emotional intelligence integration with mocks"""
    return EmotionalIntelligenceIntegration(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        memory_store=mock_brain.memory_store,
        emotional_processor=mock_emotional_processor,
        ethical_framework=mock_ethical_framework,
        emotional_memory=mock_emotional_memory,
    )


# Tests
@pytest.mark.asyncio
async def test_initialization(config_file):
    """Test initialization of emotional intelligence integration"""
    # Test with config file
    with patch(
        "alejo.emotional_intelligence.processor.EmotionalProcessor"
    ) as mock_processor_class, patch(
        "alejo.emotional_intelligence.ethics.EthicalFramework"
    ) as mock_framework_class, patch(
        "alejo.emotional_intelligence.memory.EmotionalMemory"
    ) as mock_memory_class:

        mock_processor = MagicMock()
        mock_framework = MagicMock()
        mock_memory = MagicMock()

        mock_processor_class.return_value = mock_processor
        mock_framework_class.return_value = mock_framework
        mock_memory_class.return_value = mock_memory

        # Create integration
        integration = EmotionalIntelligenceIntegration(config_path=config_file)

        # Check that components were initialized
        assert mock_processor_class.called
        assert mock_framework_class.called
        assert mock_memory_class.called

        assert integration.emotional_processor == mock_processor
        assert integration.ethical_framework == mock_framework
        assert integration.emotional_memory == mock_memory

        # Check that config was loaded
        assert integration.config["empathy_threshold"] == 0.8
        assert integration.config["ethical_evaluation_threshold"] == 0.7


@pytest.mark.asyncio
async def test_analyze_emotion(emotional_integration):
    """Test analyzing emotion"""
    # Test with happy text
    result = await emotional_integration.analyze_emotion(
        text="I'm feeling happy today!", user_id="test_user"
    )

    # Check result
    assert result["primary_emotion"] == "joy"
    assert result["valence"] > 0
    assert "emotion_scores" in result
    assert result["emotion_scores"]["joy"] > 0.5

    # Test with sad text
    result = await emotional_integration.analyze_emotion(
        text="I'm feeling sad today.", user_id="test_user"
    )

    # Check result
    assert result["primary_emotion"] == "sadness"
    assert result["valence"] < 0
    assert "emotion_scores" in result
    assert result["emotion_scores"]["sadness"] > 0.5


@pytest.mark.asyncio
async def test_evaluate_ethics(emotional_integration):
    """Test evaluating ethics"""
    # Test with ethical action
    result = await emotional_integration.evaluate_ethics(
        action="Help the user find information",
        context={"user_request": "information search"},
    )

    # Check result
    assert result["value_alignment"] > 0.8
    assert "principles_considered" in result
    assert len(result["principles_considered"]) > 0

    # Test with potentially unethical action
    result = await emotional_integration.evaluate_ethics(
        action="Share personal information about the user",
        context={"data_type": "personal"},
    )

    # Check result
    assert result["value_alignment"] < 0.5
    assert "privacy" in result["principles_considered"]
    assert "justification" in result
    assert "privacy concerns" in result["justification"].lower()


@pytest.mark.asyncio
async def test_get_emotional_response(emotional_integration):
    """Test getting emotional response"""
    # Test with happy input
    result = await emotional_integration.get_emotional_response(
        input_text="I'm feeling happy today!", user_id="test_user"
    )

    # Check result
    assert "response" in result
    assert "glad" in result["response"].lower()

    # Test with sad input
    result = await emotional_integration.get_emotional_response(
        input_text="I'm feeling sad today.", user_id="test_user"
    )

    # Check result
    assert "response" in result
    assert "sorry" in result["response"].lower()


@pytest.mark.asyncio
async def test_get_interaction_recommendation(
    emotional_integration, mock_emotional_memory
):
    """Test getting interaction recommendation"""
    # Store some emotional history first
    await mock_emotional_memory.store_emotional_state(
        user_id="test_user",
        state=EmotionalState(
            valence=0.7,
            arousal=0.6,
            dominance=0.5,
            primary_emotion="joy",
            emotion_scores={"joy": 0.8, "sadness": 0.1, "anger": 0.05, "fear": 0.05},
            confidence=0.85,
            context_relevance=0.9,
        ),
    )

    # Get recommendation
    result = await emotional_integration.get_interaction_recommendation(
        user_id="test_user", current_context={}
    )

    # Check result
    assert "humor" in result
    assert result["humor"] > 0.6  # Higher humor for joy
    assert "empathy" in result

    # Test with no history
    result = await emotional_integration.get_interaction_recommendation(
        user_id="new_user", current_context={}
    )

    # Should use defaults
    assert "interaction_style" in result
    assert "formality" in result["interaction_style"]
    assert "humor" in result["interaction_style"]


@pytest.mark.asyncio
async def test_emotional_memory_integration(
    emotional_integration, mock_emotional_memory
):
    """Test integration with emotional memory"""
    # Analyze emotion (should store in memory)
    await emotional_integration.analyze_emotion(
        text="I'm feeling happy today!", user_id="test_user"
    )

    # Check that it was stored
    history = await mock_emotional_memory.get_emotional_history(user_id="test_user")
    assert len(history) > 0
    assert history[0]["state"].primary_emotion == "joy"


@pytest.mark.asyncio
async def test_event_handlers(emotional_integration):
    """Test event handlers"""
    # Test analyze_emotion event handler
    result = await emotional_integration._handle_analyze_emotion(
        {"text": "I'm feeling happy today!", "user_id": "test_user"}
    )

    assert result["primary_emotion"] == "joy"

    # Test evaluate_ethics event handler
    result = await emotional_integration._handle_evaluate_ethics(
        {
            "action": "Help the user find information",
            "context": {"user_request": "information search"},
        }
    )

    assert result["value_alignment"] > 0.8

    # Test get_emotional_response event handler
    result = await emotional_integration._handle_get_emotional_response(
        {"input_text": "I'm feeling sad today.", "user_id": "test_user"}
    )

    assert "sorry" in result["response"].lower()

    # Test update_emotional_memory event handler
    result = await emotional_integration._handle_update_emotional_memory(
        {
            "user_id": "test_user",
            "emotional_state": {
                "valence": 0.7,
                "arousal": 0.6,
                "dominance": 0.5,
                "primary_emotion": "joy",
                "emotion_scores": {"joy": 0.8, "sadness": 0.1},
                "confidence": 0.85,
                "context_relevance": 0.9,
            },
            "text": "Test text",
        }
    )

    assert result["success"] is True


@pytest.mark.asyncio
async def test_error_handling(emotional_integration):
    """Test error handling"""
    # Create a failing scenario
    with patch.object(
        emotional_integration.emotional_processor,
        "analyze_sentiment",
        side_effect=Exception("Test error"),
    ):
        # Process should handle the error gracefully
        with pytest.raises(Exception):
            await emotional_integration.analyze_emotion(
                text="Test text", user_id="test_user"
            )


@pytest.mark.asyncio
async def test_calculate_volatility(emotional_integration):
    """Test volatility calculation"""
    # Test with stable emotions
    volatility = emotional_integration._calculate_volatility(
        valence_trend=[0.7, 0.7, 0.7, 0.7, 0.7], arousal_trend=[0.6, 0.6, 0.6, 0.6, 0.6]
    )

    assert volatility == 0.0

    # Test with volatile emotions
    volatility = emotional_integration._calculate_volatility(
        valence_trend=[0.7, 0.3, 0.8, 0.2, 0.9], arousal_trend=[0.6, 0.8, 0.3, 0.9, 0.4]
    )

    assert volatility > 0.3


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
