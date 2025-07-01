"""
Tests for the ProactiveCognitionEngine in ALEJO's cognitive system
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch

from alejo.cognitive.proactive_cognition import ProactiveCognitionEngine, CognitiveInsight
from alejo.cognitive.empathy_layer import EmpathyEngine
from alejo.cognitive.curiosity_layer import CuriosityEngine, PromptSuggestion
from alejo.core.config_manager import ConfigManager
from alejo.utils.event_bus import EventBus, Event
import secrets  # More secure for cryptographic purposes


@pytest.fixture
def mock_config_manager():
    """Create a mock configuration manager"""
    config_manager = MagicMock(spec=ConfigManager)
    config_manager.get_config.return_value = {
        "proactive_enabled": True,
        "empathy_enabled": True,
        "curiosity_enabled": True,
        "empathy_threshold": 0.7,
        "curiosity_threshold": 0.6
    }
    return config_manager


@pytest.fixture
def mock_event_bus():
    """Create a mock event bus"""
    event_bus = MagicMock(spec=EventBus)
    event_bus.publish = AsyncMock()
    event_bus.subscribe = MagicMock()
    return event_bus


@pytest.fixture
def mock_empathy_engine():
    """Create a mock empathy engine"""
    engine = MagicMock(spec=EmpathyEngine)
    engine.should_reflect.return_value = None
    engine.generate_reflection.return_value = "I understand how you feel."
    return engine


@pytest.fixture
def mock_curiosity_engine():
    """Create a mock curiosity engine"""
    engine = MagicMock(spec=CuriosityEngine)
    engine.get_proactive_prompt.return_value = None
    return engine


@pytest.fixture
def proactive_engine(mock_config_manager, mock_event_bus):
    """Create a ProactiveCognitionEngine instance"""
    with patch('alejo.cognitive.proactive_cognition.EmpathyEngine'), \
         patch('alejo.cognitive.proactive_cognition.CuriosityEngine'):
        engine = ProactiveCognitionEngine(mock_config_manager, mock_event_bus)
        return engine


class TestProactiveCognitionEngine:
    """Tests for the ProactiveCognitionEngine class"""
    
    def test_initialization(self, proactive_engine, mock_config_manager, mock_event_bus):
        """Test engine initialization"""
        assert proactive_engine.config_manager == mock_config_manager
        assert proactive_engine.event_bus == mock_event_bus
        assert proactive_engine.proactive_enabled is True
        assert proactive_engine.empathy_enabled is True
        assert proactive_engine.curiosity_enabled is True
        assert proactive_engine.empathy_threshold == 0.7
        assert proactive_engine.curiosity_threshold == 0.6
    
    def test_load_configuration(self, mock_config_manager):
        """Test loading configuration"""
        with patch('alejo.cognitive.proactive_cognition.EmpathyEngine'), \
             patch('alejo.cognitive.proactive_cognition.CuriosityEngine'):
            engine = ProactiveCognitionEngine(mock_config_manager)
            
            # Verify configuration was loaded
            assert engine.proactive_enabled is True
            assert engine.empathy_threshold == 0.7
            assert engine.curiosity_threshold == 0.6
            
            # Test with different configuration
            mock_config_manager.get_config.return_value = {
                "proactive_enabled": False,
                "empathy_threshold": 0.8,
                "curiosity_threshold": 0.5
            }
            
            engine._load_configuration()
            
            assert engine.proactive_enabled is False
            assert engine.empathy_threshold == 0.8
            assert engine.curiosity_threshold == 0.5
    
    def test_register_event_handlers(self, mock_event_bus):
        """Test event handler registration"""
        with patch('alejo.cognitive.proactive_cognition.EmpathyEngine'), \
             patch('alejo.cognitive.proactive_cognition.CuriosityEngine'):
            engine = ProactiveCognitionEngine(event_bus=mock_event_bus)
            
            # Verify event handlers were registered
            assert mock_event_bus.subscribe.call_count == 3
            mock_event_bus.subscribe.assert_any_call("message.received", engine._handle_message_received)
            mock_event_bus.subscribe.assert_any_call("user.emotion_detected", engine._handle_emotion_detected)
            mock_event_bus.subscribe.assert_any_call("conversation.topic_changed", engine._handle_topic_changed)
    
    @pytest.mark.asyncio
    async def test_handle_message_received(self, proactive_engine):
        """Test handling message received events"""
        # Replace the engines with mocks
        proactive_engine.empathy_engine = MagicMock()
        proactive_engine.curiosity_engine = MagicMock()
        proactive_engine._process_message = AsyncMock()
        
        # Create a test event
        event = Event(
            event_type="message.received",
            payload={"message": "Hello, world!", "speaker": "user"}
        )
        
        # Handle the event
        await proactive_engine._handle_message_received(event)
        
        # Verify engines recorded the turn
        proactive_engine.empathy_engine.record_turn.assert_called_once_with("user", "Hello, world!")
        proactive_engine.curiosity_engine.record_turn.assert_called_once_with("user", "Hello, world!")
        
        # Verify message processing was called
        proactive_engine._process_message.assert_called_once_with("user", "Hello, world!")
    
    @pytest.mark.asyncio
    async def test_handle_emotion_detected(self, proactive_engine):
        """Test handling emotion detection events"""
        # Create a test event with a negative emotion
        event = Event(
            event_type="user.emotion_detected",
            payload={"emotion": {"type": "angry", "intensity": 0.8}}
        )
        
        # Initial receptiveness
        initial_receptiveness = proactive_engine.conversation_state["user_receptiveness"]
        
        # Handle the event
        await proactive_engine._handle_emotion_detected(event)
        
        # Verify emotional trajectory was updated
        assert len(proactive_engine.conversation_state["emotional_trajectory"]) == 1
        assert proactive_engine.conversation_state["emotional_trajectory"][0]["emotion"] == "angry"
        
        # Verify receptiveness decreased for negative emotion
        assert proactive_engine.conversation_state["user_receptiveness"] < initial_receptiveness
        
        # Test with positive emotion
        event = Event(
            event_type="user.emotion_detected",
            payload={"emotion": {"type": "happy", "intensity": 0.8}}
        )
        
        current_receptiveness = proactive_engine.conversation_state["user_receptiveness"]
        
        # Handle the event
        await proactive_engine._handle_emotion_detected(event)
        
        # Verify receptiveness increased for positive emotion
        assert proactive_engine.conversation_state["user_receptiveness"] > current_receptiveness
    
    @pytest.mark.asyncio
    async def test_handle_topic_changed(self, proactive_engine):
        """Test handling topic change events"""
        # Set initial state
        proactive_engine.conversation_state["interaction_depth"] = 5
        
        # Create a test event
        event = Event(
            event_type="conversation.topic_changed",
            payload={"topic": "artificial intelligence"}
        )
        
        # Handle the event
        await proactive_engine._handle_topic_changed(event)
        
        # Verify topic was updated and depth reset
        assert proactive_engine.conversation_state["topic_focus"] == "artificial intelligence"
        assert proactive_engine.conversation_state["interaction_depth"] == 0
    
    @pytest.mark.asyncio
    async def test_process_message_empathy(self, proactive_engine):
        """Test processing messages with empathy response"""
        # Configure mocks
        proactive_engine.empathy_engine = MagicMock()
        proactive_engine.empathy_engine.should_reflect.return_value = MagicMock(confidence=0.8)
        proactive_engine.empathy_engine.generate_reflection.return_value = "I understand your frustration."
        
        proactive_engine._publish_empathetic_response = AsyncMock()
        
        # Process a user message
        await proactive_engine._process_message("user", "I'm feeling frustrated with this.")
        
        # Verify empathy was triggered
        proactive_engine.empathy_engine.should_reflect.assert_called_once()
        proactive_engine.empathy_engine.generate_reflection.assert_called_once()
        proactive_engine._publish_empathetic_response.assert_called_once()
        
        # Verify interaction depth increased
        assert proactive_engine.conversation_state["interaction_depth"] == 1
    
    @pytest.mark.asyncio
    async def test_process_message_curiosity(self, proactive_engine):
        """Test processing messages with curiosity response"""
        # Configure mocks
        proactive_engine.empathy_engine = MagicMock()
        proactive_engine.empathy_engine.should_reflect.return_value = None
        
        proactive_engine.curiosity_engine = MagicMock()
        prompt = PromptSuggestion(
            text="Tell me more about that project?",
            rationale="User mentioned a project but provided few details."
        )
        proactive_engine.curiosity_engine.get_proactive_prompt.return_value = prompt
        
        proactive_engine._calculate_prompt_confidence = MagicMock(return_value=0.8)
        proactive_engine._publish_curious_prompt = AsyncMock()
        
        # Process a user message
        await proactive_engine._process_message("user", "I'm working on a project.")
        
        # Verify curiosity was triggered
        proactive_engine.curiosity_engine.get_proactive_prompt.assert_called_once()
        proactive_engine._calculate_prompt_confidence.assert_called_once()
        proactive_engine._publish_curious_prompt.assert_called_once_with(prompt)
    
    @pytest.mark.asyncio
    async def test_generate_cognitive_insights(self, proactive_engine):
        """Test generating cognitive insights"""
        # Configure mocks
        proactive_engine.empathy_engine = MagicMock()
        empathy_result = MagicMock(confidence=0.8)
        proactive_engine.empathy_engine.should_reflect.return_value = empathy_result
        proactive_engine.empathy_engine.generate_reflection.return_value = "I understand your concern."
        
        proactive_engine.curiosity_engine = MagicMock()
        prompt = PromptSuggestion(
            text="What solutions have you tried?",
            rationale="User mentioned a problem but not solutions."
        )
        proactive_engine.curiosity_engine.get_proactive_prompt.return_value = prompt
        
        proactive_engine._calculate_prompt_confidence = MagicMock(return_value=0.7)
        
        # Test context
        context = {
            "message_history": [
                {"speaker": "user", "text": "I'm having a problem with this code."},
                {"speaker": "system", "text": "Can you describe the problem?"},
                {"speaker": "user", "text": "It keeps crashing when I run it."}
            ]
        }
        
        # Generate insights
        insights = await proactive_engine.generate_cognitive_insights(context)
        
        # Verify insights were generated
        assert len(insights) == 2
        assert insights[0].insight_type == "empathy"
        assert insights[0].content == "I understand your concern."
        assert insights[0].confidence == 0.8
        
        assert insights[1].insight_type == "curiosity"
        assert insights[1].content == "What solutions have you tried?"
        assert insights[1].confidence == 0.7
    
    def test_update_configuration(self, proactive_engine, mock_config_manager):
        """Test updating configuration"""
        # New configuration
        new_config = {
            "proactive_enabled": False,
            "empathy_threshold": 0.8,
            "curiosity_threshold": 0.5
        }
        
        # Update configuration
        proactive_engine.update_configuration(new_config)
        
        # Verify configuration was updated
        assert proactive_engine.proactive_enabled is False
        assert proactive_engine.empathy_threshold == 0.8
        assert proactive_engine.curiosity_threshold == 0.5
        
        # Verify config manager was updated
        mock_config_manager.update_config.assert_called_once_with("cognitive", new_config)
    
    def test_adjust_curiosity_threshold(self, proactive_engine):
        """Test adjusting curiosity threshold based on conversation state"""
        # Test with low receptiveness
        proactive_engine.conversation_state["user_receptiveness"] = 0.2
        proactive_engine.conversation_state["interaction_depth"] = 2
        
        threshold = proactive_engine._adjust_curiosity_threshold()
        assert threshold > proactive_engine.curiosity_threshold  # Should increase threshold
        
        # Test with deep interaction
        proactive_engine.conversation_state["user_receptiveness"] = 0.5
        proactive_engine.conversation_state["interaction_depth"] = 5
        
        threshold = proactive_engine._adjust_curiosity_threshold()
        assert threshold < proactive_engine.curiosity_threshold  # Should decrease threshold