"""
Tests for the GestureArpeggiator UI controller
"""

import asyncio
import secrets  # More secure for cryptographic purposes
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alejo.core.config_manager import ConfigManager
from alejo.ui.gesture_arpeggiator import GestureArpeggiator, GestureEvent, GestureType
from alejo.utils.event_bus import Event, EventBus


@pytest.fixture
def mock_config_manager():
    """Create a mock configuration manager"""
    config_manager = MagicMock(spec=ConfigManager)
    config_manager.get_config.return_value = {
        "enabled": True,
        "sensitivity": 0.5,
        "gesture_timeout": 0.8,
        "max_sequence_length": 5,
        "sequence_timeout": 2.0,
        "gesture_mappings": {
            "swipe_left": "navigation.previous",
            "swipe_right": "navigation.next",
        },
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
def arpeggiator(mock_config_manager, mock_event_bus):
    """Create a GestureArpeggiator instance"""
    return GestureArpeggiator(mock_config_manager, mock_event_bus)


class TestGestureArpeggiator:
    """Tests for the GestureArpeggiator class"""

    def test_initialization(self, arpeggiator, mock_config_manager, mock_event_bus):
        """Test arpeggiator initialization"""
        assert arpeggiator.config_manager == mock_config_manager
        assert arpeggiator.event_bus == mock_event_bus
        assert arpeggiator.enabled is True
        assert arpeggiator.sensitivity == 0.5
        assert arpeggiator.gesture_timeout == 0.8
        assert arpeggiator.max_sequence_length == 5
        assert arpeggiator.sequence_timeout == 2.0

        # Verify gesture mappings
        assert (
            arpeggiator.gesture_mappings[GestureType.SWIPE_LEFT]
            == "navigation.previous"
        )
        assert (
            arpeggiator.gesture_mappings[GestureType.SWIPE_RIGHT] == "navigation.next"
        )

    def test_load_configuration(self, mock_config_manager):
        """Test loading configuration"""
        arpeggiator = GestureArpeggiator(mock_config_manager)

        # Verify configuration was loaded
        assert arpeggiator.enabled is True
        assert arpeggiator.sensitivity == 0.5

        # Test with different configuration
        mock_config_manager.get_config.return_value = {
            "enabled": False,
            "sensitivity": 0.7,
            "gesture_mappings": {"tap": "custom.action"},
        }

        arpeggiator._load_configuration()

        assert arpeggiator.enabled is False
        assert arpeggiator.sensitivity == 0.7
        assert arpeggiator.gesture_mappings[GestureType.TAP] == "custom.action"

    def test_register_event_handlers(self, mock_event_bus):
        """Test event handler registration"""
        arpeggiator = GestureArpeggiator(event_bus=mock_event_bus)

        # Verify event handlers were registered
        assert mock_event_bus.subscribe.call_count == 3
        mock_event_bus.subscribe.assert_any_call(
            "gesture.detected", arpeggiator._handle_gesture_detected
        )
        mock_event_bus.subscribe.assert_any_call(
            "ui.mode_changed", arpeggiator._handle_ui_mode_changed
        )
        mock_event_bus.subscribe.assert_any_call(
            "config.updated", arpeggiator._handle_config_updated
        )

    @pytest.mark.asyncio
    async def test_handle_gesture_detected_valid(self, arpeggiator):
        """Test handling valid gesture detection events"""
        # Replace the process_gesture method with a mock
        arpeggiator._process_gesture = AsyncMock()

        # Create a test event with valid gesture data
        event = Event(
            event_type="gesture.detected",
            payload={
                "gesture": {
                    "type": "swipe_left",
                    "confidence": 0.8,
                    "position": (0.3, 0.5),
                    "duration": 0.2,
                    "magnitude": 1.2,
                    "metadata": {"speed": "fast"},
                }
            },
        )

        # Handle the event
        await arpeggiator._handle_gesture_detected(event)

        # Verify process_gesture was called with correct parameters
        assert arpeggiator._process_gesture.called
        call_args = arpeggiator._process_gesture.call_args[0][0]
        assert call_args.gesture_type == GestureType.SWIPE_LEFT
        assert call_args.confidence == 0.8
        assert call_args.position == (0.3, 0.5)
        assert call_args.duration == 0.2
        assert call_args.magnitude == 1.2
        assert call_args.metadata == {"speed": "fast"}

    @pytest.mark.asyncio
    async def test_handle_gesture_detected_low_confidence(self, arpeggiator):
        """Test handling gesture with confidence below threshold"""
        # Replace the process_gesture method with a mock
        arpeggiator._process_gesture = AsyncMock()

        # Create a test event with low confidence
        event = Event(
            event_type="gesture.detected",
            payload={
                "gesture": {
                    "type": "swipe_left",
                    "confidence": 0.3,  # Below threshold of 0.5
                    "position": (0.3, 0.5),
                }
            },
        )

        # Handle the event
        await arpeggiator._handle_gesture_detected(event)

        # Verify process_gesture was not called
        assert not arpeggiator._process_gesture.called

    @pytest.mark.asyncio
    async def test_handle_gesture_detected_invalid(self, arpeggiator):
        """Test handling invalid gesture detection events"""
        # Replace the process_gesture method with a mock
        arpeggiator._process_gesture = AsyncMock()

        # Create a test event with invalid gesture type
        event = Event(
            event_type="gesture.detected",
            payload={
                "gesture": {
                    "type": "invalid_gesture",
                    "confidence": 0.8,
                    "position": (0.3, 0.5),
                }
            },
        )

        # Handle the event
        await arpeggiator._handle_gesture_detected(event)

        # Verify process_gesture was not called
        assert not arpeggiator._process_gesture.called

    @pytest.mark.asyncio
    async def test_handle_ui_mode_changed(self, arpeggiator):
        """Test handling UI mode change events"""
        # Set initial state
        arpeggiator.active_gestures = [MagicMock(), MagicMock()]
        arpeggiator.gesture_sequence = [MagicMock(), MagicMock()]

        # Create a test event
        event = Event(event_type="ui.mode_changed", payload={"mode": "edit"})

        # Handle the event
        await arpeggiator._handle_ui_mode_changed(event)

        # Verify state was reset
        assert len(arpeggiator.active_gestures) == 0
        assert len(arpeggiator.gesture_sequence) == 0

    @pytest.mark.asyncio
    async def test_handle_config_updated(self, arpeggiator):
        """Test handling configuration update events"""
        # Replace update_configuration with a mock
        arpeggiator.update_configuration = MagicMock()

        # Create a test event
        event = Event(
            event_type="config.updated",
            payload={
                "component": "gesture_arpeggiator",
                "config": {"sensitivity": 0.7},
            },
        )

        # Handle the event
        await arpeggiator._handle_config_updated(event)

        # Verify update_configuration was called
        arpeggiator.update_configuration.assert_called_once_with({"sensitivity": 0.7})

        # Test with different component
        event = Event(
            event_type="config.updated",
            payload={"component": "other_component", "config": {"some_setting": True}},
        )

        # Reset mock
        arpeggiator.update_configuration.reset_mock()

        # Handle the event
        await arpeggiator._handle_config_updated(event)

        # Verify update_configuration was not called
        assert not arpeggiator.update_configuration.called

    @pytest.mark.asyncio
    async def test_process_gesture(self, arpeggiator):
        """Test processing a gesture"""
        # Replace methods with mocks
        arpeggiator._map_gesture_to_action = AsyncMock()
        arpeggiator._check_gesture_sequences = AsyncMock()

        # Create a test gesture
        gesture = GestureEvent(
            gesture_type=GestureType.SWIPE_LEFT, confidence=0.8, position=(0.3, 0.5)
        )

        # Process the gesture
        await arpeggiator._process_gesture(gesture)

        # Verify gesture was added to active gestures
        assert len(arpeggiator.active_gestures) == 1
        assert arpeggiator.active_gestures[0] == gesture

        # Verify gesture was added to sequence
        assert len(arpeggiator.gesture_sequence) == 1
        assert arpeggiator.gesture_sequence[0] == gesture

        # Verify methods were called
        arpeggiator._map_gesture_to_action.assert_called_once_with(gesture)
        arpeggiator._check_gesture_sequences.assert_called_once()

    @pytest.mark.asyncio
    async def test_map_gesture_to_action(self, arpeggiator, mock_event_bus):
        """Test mapping a gesture to an action"""
        # Create a test gesture
        gesture = GestureEvent(
            gesture_type=GestureType.SWIPE_LEFT, confidence=0.8, position=(0.3, 0.5)
        )

        # Map gesture to action
        await arpeggiator._map_gesture_to_action(gesture)

        # Verify event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args[0][0] == "ui.action"
        assert call_args[0][1]["action"] == "navigation.previous"
        assert call_args[0][1]["source"] == "gesture_arpeggiator"
        assert call_args[0][1]["gesture"]["type"] == "swipe_left"

    @pytest.mark.asyncio
    async def test_check_gesture_sequences(self, arpeggiator, mock_event_bus):
        """Test checking for gesture sequences"""
        # Create a sequence of gestures
        arpeggiator.gesture_sequence = [
            GestureEvent(
                gesture_type=GestureType.SWIPE_RIGHT,
                confidence=0.8,
                position=(0.7, 0.5),
                timestamp=time.time() - 0.5,
            ),
            GestureEvent(
                gesture_type=GestureType.SWIPE_LEFT,
                confidence=0.8,
                position=(0.3, 0.5),
                timestamp=time.time(),
            ),
        ]

        # Check for sequences
        await arpeggiator._check_gesture_sequences()

        # Verify event was published for the recognized sequence
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args[0][0] == "ui.action"
        assert call_args[0][1]["action"] == "edit.undo"
        assert call_args[0][1]["source"] == "gesture_sequence"
        assert call_args[0][1]["sequence"] == ["swipe_right", "swipe_left"]

        # Verify sequence was cleared
        assert len(arpeggiator.gesture_sequence) == 0

    def test_update_configuration(self, arpeggiator, mock_config_manager):
        """Test updating configuration"""
        # New configuration
        new_config = {
            "enabled": False,
            "sensitivity": 0.7,
            "gesture_timeout": 1.0,
            "gesture_mappings": {"tap": "custom.action"},
        }

        # Update configuration
        arpeggiator.update_configuration(new_config)

        # Verify configuration was updated
        assert arpeggiator.enabled is False
        assert arpeggiator.sensitivity == 0.7
        assert arpeggiator.gesture_timeout == 1.0
        assert arpeggiator.gesture_mappings[GestureType.TAP] == "custom.action"

        # Verify config manager was updated
        mock_config_manager.update_config.assert_called_once_with(
            "gesture_arpeggiator", new_config
        )
