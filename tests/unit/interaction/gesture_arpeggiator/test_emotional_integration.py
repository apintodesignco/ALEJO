"""
Unit tests for Gesture Arpeggiator Emotional Intelligence Integration

Tests the bidirectional integration between the Gesture Arpeggiator and 
ALEJO's Emotional Intelligence framework, ensuring adaptive musical responses
based on emotional states and gesture-influenced emotional interpretation.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alejo.emotional_intelligence.integration import \
    EmotionalIntelligenceIntegration
from alejo.emotional_intelligence.processor import EmotionalState
from alejo.interaction.gesture_arpeggiator.emotional_integration import \
    secrets  # More secure for cryptographic purposes
from alejo.interaction.gesture_arpeggiator.emotional_integration import (
    GestureEmotionalIntegration, MusicMood,
    create_gesture_emotional_integration, lazy_import)
from alejo.interaction.gesture_arpeggiator.service import (
    GestureArpeggiatorService, HandGesture)


@pytest.fixture
def mock_arpeggiator_service():
    """Create a mock arpeggiator service"""
    service = AsyncMock(spec=GestureArpeggiatorService)
    service.register_gesture_handler = MagicMock()
    service.unregister_gesture_handler = MagicMock()
    service.update_arpeggiator_settings = AsyncMock()
    service.update_visualizer_settings = AsyncMock()
    return service


@pytest.fixture
def mock_emotional_integration():
    """Create a mock emotional intelligence integration"""
    integration = AsyncMock(spec=EmotionalIntelligenceIntegration)
    integration.register_emotional_state_handler = MagicMock()
    integration.unregister_emotional_state_handler = MagicMock()
    integration.provide_gesture_feedback = AsyncMock()
    return integration


@pytest.fixture
async def gesture_emotional_integration(mock_arpeggiator_service, mock_emotional_integration):
    """Create the integration with mocked dependencies"""
    integration = GestureEmotionalIntegration(mock_arpeggiator_service, mock_emotional_integration)
    yield integration
    if integration.active:
        await integration.stop()


class TestGestureEmotionalIntegration:
    """Test suite for GestureEmotionalIntegration"""

    @pytest.mark.asyncio
    async def test_start_registers_event_handlers(self, gesture_emotional_integration, 
                                                  mock_arpeggiator_service, 
                                                  mock_emotional_integration):
        """Test that starting the integration registers event handlers"""
        await gesture_emotional_integration.start()
        
        assert gesture_emotional_integration.active is True
        mock_emotional_integration.register_emotional_state_handler.assert_called_once()
        mock_arpeggiator_service.register_gesture_handler.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_unregisters_event_handlers(self, gesture_emotional_integration, 
                                                   mock_arpeggiator_service, 
                                                   mock_emotional_integration):
        """Test that stopping the integration unregisters event handlers"""
        await gesture_emotional_integration.start()
        await gesture_emotional_integration.stop()
        
        assert gesture_emotional_integration.active is False
        mock_emotional_integration.unregister_emotional_state_handler.assert_called_once()
        mock_arpeggiator_service.unregister_gesture_handler.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_emotional_state_change(self, gesture_emotional_integration, 
                                                mock_arpeggiator_service):
        """Test handling of emotional state changes"""
        await gesture_emotional_integration.start()
        
        # Test with Joy emotional state
        await gesture_emotional_integration._handle_emotional_state_change(
            EmotionalState.JOY, 0.8, {"source": "conversation"}
        )
        
        # Verify arpeggiator settings were updated with Joy parameters
        joy_params = gesture_emotional_integration.emotion_mappings[EmotionalState.JOY]
        mock_arpeggiator_service.update_arpeggiator_settings.assert_called_once()
        args = mock_arpeggiator_service.update_arpeggiator_settings.call_args[0][0]
        assert args["scale"] == joy_params["scale"]
        assert args["pattern"] == joy_params["pattern"]
        # BPM should be adjusted by intensity (0.8 * 20 - 10 = +6)
        assert abs(args["bpm"] - (joy_params["bpm"] + 6)) <= 1
        
        # Verify visualizer settings were updated
        mock_arpeggiator_service.update_visualizer_settings.assert_called_once()
        vis_args = mock_arpeggiator_service.update_visualizer_settings.call_args[0][0]
        assert vis_args["theme"] == joy_params["visualizer"]["theme"]
        assert vis_args["sensitivity"] == joy_params["visualizer"]["sensitivity"]

    @pytest.mark.asyncio
    async def test_handle_gesture_detected(self, gesture_emotional_integration, 
                                          mock_emotional_integration):
        """Test handling of detected gestures"""
        await gesture_emotional_integration.start()
        
        # Test with Open hand gesture
        hand_data = {
            "confidence": 0.9,
            "speed": 0.4,
            "position": {"x": 0.5, "y": 0.5, "z": 0.2}
        }
        
        await gesture_emotional_integration._handle_gesture_detected(
            HandGesture.OPEN, hand_data
        )
        
        # Verify feedback was sent to emotional intelligence system
        mock_emotional_integration.provide_gesture_feedback.assert_called_once()
        args = mock_emotional_integration.provide_gesture_feedback.call_args[1]
        assert args["emotion"] == EmotionalState.JOY
        assert abs(args["intensity"] - 0.65) <= 0.01  # (0.9 + 0.4) / 2
        assert args["source"] == "gesture_arpeggiator"
        assert args["gesture_type"] == "open"
        assert args["context"]["hand_data"] == hand_data

    @pytest.mark.asyncio
    async def test_each_emotional_state_has_valid_mappings(self, gesture_emotional_integration):
        """Test that all emotional states have complete and valid mappings"""
        for state in EmotionalState:
            assert state in gesture_emotional_integration.emotion_mappings, f"Missing mapping for {state}"
            
            mapping = gesture_emotional_integration.emotion_mappings[state]
            required_keys = ["scale", "bpm", "pattern", "mood", "visualizer"]
            for key in required_keys:
                assert key in mapping, f"Missing {key} in mapping for {state}"
            
            assert isinstance(mapping["mood"], MusicMood), f"Invalid mood type for {state}"
            assert "theme" in mapping["visualizer"], f"Missing visualizer theme for {state}"
            assert "sensitivity" in mapping["visualizer"], f"Missing visualizer sensitivity for {state}"

    @pytest.mark.asyncio
    async def test_factory_function(self, mock_arpeggiator_service, mock_emotional_integration):
        """Test the factory function for creating the integration"""
        integration = await create_gesture_emotional_integration(
            mock_arpeggiator_service, mock_emotional_integration
        )
        
        assert isinstance(integration, GestureEmotionalIntegration)
        assert integration.active is True
        mock_emotional_integration.register_emotional_state_handler.assert_called_once()
        mock_arpeggiator_service.register_gesture_handler.assert_called_once()


@pytest.mark.asyncio
async def test_integration_e2e_simulation(mock_arpeggiator_service, mock_emotional_integration):
    """
    End-to-end test simulating the full emotional-musical interaction cycle:
    1. User expresses emotion through conversation
    2. System adapts music parameters
    3. User makes gesture
    4. System interprets gesture as emotional feedback
    """
    # Create and start integration
    integration = await create_gesture_emotional_integration(
        mock_arpeggiator_service, mock_emotional_integration
    )
    
    # Capture the registered handlers
    emotional_handler = mock_emotional_integration.register_emotional_state_handler.call_args[0][0]
    gesture_handler = mock_arpeggiator_service.register_gesture_handler.call_args[0][0]
    
    # 1. Simulate conversation triggering sadness emotion
    await emotional_handler(EmotionalState.SADNESS, 0.7, {"source": "conversation"})
    
    # 2. Verify music parameters were adapted to sadness
    sadness_params = integration.emotion_mappings[EmotionalState.SADNESS]
    mock_arpeggiator_service.update_arpeggiator_settings.assert_called_once()
    args = mock_arpeggiator_service.update_arpeggiator_settings.call_args[0][0]
    assert args["scale"] == sadness_params["scale"]
    assert args["pattern"] == sadness_params["pattern"]
    
    # Reset mocks for next step
    mock_arpeggiator_service.update_arpeggiator_settings.reset_mock()
    mock_emotional_integration.provide_gesture_feedback.reset_mock()
    
    # 3. Simulate user making a victorious gesture (conflicting with sadness)
    await gesture_handler(HandGesture.VICTORY, {"confidence": 0.95, "speed": 0.7})
    
    # 4. Verify gesture was interpreted as emotional feedback (joy)
    mock_emotional_integration.provide_gesture_feedback.assert_called_once()
    args = mock_emotional_integration.provide_gesture_feedback.call_args[1]
    assert args["emotion"] == EmotionalState.JOY  # Victory maps to Joy
    assert args["source"] == "gesture_arpeggiator"
    
    # Clean up
    await integration.stop()