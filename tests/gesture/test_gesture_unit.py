"""
ALEJO Gesture System Unit Tests

This module contains unit tests for the gesture arpeggiator system.
These tests focus on isolated components and mock external dependencies.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

# Import test configuration
from tests.gesture.test_config import (
    TEST_ENV,
    get_mock_data_for_gesture,
    get_test_preset,
)

# Import gesture system components
try:
    from alejo.interaction.gesture_arpeggiator.audio_engine import AudioEngine
    from alejo.interaction.gesture_arpeggiator.gesture_processor import GestureProcessor
    from alejo.interaction.gesture_arpeggiator.preset_manager import PresetManager
except ImportError as e:
    print(f"Error importing gesture system components: {e}")
    print("Make sure the gesture system is properly installed.")
    sys.exit(1)


class TestGestureProcessor(unittest.TestCase):
    """Test the gesture processor component"""

    def setUp(self):
        """Set up test environment"""
        self.mock_mediapipe = MagicMock()
        self.patcher = patch(
            "alejo.interaction.gesture_arpeggiator.gesture_processor.mediapipe",
            self.mock_mediapipe,
        )
        self.patcher.start()
        self.processor = GestureProcessor()

    def tearDown(self):
        """Clean up test environment"""
        self.patcher.stop()

    def test_initialization(self):
        """Test that the gesture processor initializes correctly"""
        self.assertIsNotNone(self.processor)
        self.assertEqual(self.processor.detection_confidence, 0.5)
        self.assertEqual(self.processor.tracking_confidence, 0.5)

    def test_process_frame_with_no_hands(self):
        """Test processing a frame with no hands detected"""
        # Mock the hand detection to return no hands
        self.mock_mediapipe.solutions.hands.Hands().process().multi_hand_landmarks = (
            None
        )

        # Process an empty frame
        result = self.processor.process_frame(MagicMock())

        # Verify the result
        self.assertEqual(result, [])

    def test_process_frame_with_hands(self):
        """Test processing a frame with hands detected"""
        # Mock hand detection to return landmarks
        mock_landmarks = MagicMock()
        self.mock_mediapipe.solutions.hands.Hands().process().multi_hand_landmarks = [
            mock_landmarks
        ]

        # Process a frame
        result = self.processor.process_frame(MagicMock())

        # Verify the result
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)

    def test_detect_gesture_pinch(self):
        """Test detecting a pinch gesture"""
        # Mock the landmarks for a pinch gesture
        landmarks = get_mock_data_for_gesture("pinch")

        # Mock the hand detection
        mock_hand = MagicMock()
        mock_hand.landmark = landmarks

        # Detect the gesture
        gesture = self.processor.detect_gesture(mock_hand)

        # Verify the result
        self.assertEqual(gesture["name"], "pinch")

    def test_detect_gesture_open_hand(self):
        """Test detecting an open hand gesture"""
        # Mock the landmarks for an open hand gesture
        landmarks = get_mock_data_for_gesture("open_hand")

        # Mock the hand detection
        mock_hand = MagicMock()
        mock_hand.landmark = landmarks

        # Detect the gesture
        gesture = self.processor.detect_gesture(mock_hand)

        # Verify the result
        self.assertEqual(gesture["name"], "open")


class TestAudioEngine(unittest.TestCase):
    """Test the audio engine component"""

    def setUp(self):
        """Set up test environment"""
        self.audio_engine = AudioEngine()

    def test_initialization(self):
        """Test that the audio engine initializes correctly"""
        self.assertIsNotNone(self.audio_engine)

    def test_set_bpm(self):
        """Test setting the BPM"""
        self.audio_engine.set_bpm(120)
        self.assertEqual(self.audio_engine.bpm, 120)

    def test_set_scale(self):
        """Test setting the scale"""
        self.audio_engine.set_scale("C major")
        self.assertEqual(self.audio_engine.scale, "C major")

    def test_process_gesture(self):
        """Test processing a gesture to generate audio"""
        # Create a mock gesture
        gesture = {
            "name": "pinch",
            "position": {"x": 0.5, "y": 0.5, "z": 0.0},
            "velocity": 0.8,
        }

        # Process the gesture
        result = self.audio_engine.process_gesture(gesture)

        # Verify the result
        self.assertIsNotNone(result)
        self.assertIn("note", result)
        self.assertIn("velocity", result)


class TestPresetManager(unittest.TestCase):
    """Test the preset manager component"""

    def setUp(self):
        """Set up test environment"""
        self.preset_manager = PresetManager()

    def test_initialization(self):
        """Test that the preset manager initializes correctly"""
        self.assertIsNotNone(self.preset_manager)
        self.assertGreater(len(self.preset_manager.get_presets()), 0)

    def test_get_preset(self):
        """Test getting a preset by name"""
        # Add a test preset
        test_preset = get_test_preset("basic")
        self.preset_manager.add_preset(test_preset["name"], test_preset)

        # Get the preset
        preset = self.preset_manager.get_preset(test_preset["name"])

        # Verify the preset
        self.assertIsNotNone(preset)
        self.assertEqual(preset["name"], test_preset["name"])
        self.assertEqual(preset["bpm"], test_preset["bpm"])

    def test_add_preset(self):
        """Test adding a new preset"""
        # Create a new preset
        new_preset = {
            "name": "Test Preset",
            "bpm": 100,
            "scale": "D minor",
            "octave": 3,
            "arpeggiation_rate": 8,
            "reverb": 0.5,
            "delay": 0.3,
        }

        # Add the preset
        self.preset_manager.add_preset(new_preset["name"], new_preset)

        # Verify the preset was added
        presets = self.preset_manager.get_presets()
        self.assertIn(new_preset["name"], [p["name"] for p in presets])

    def test_delete_preset(self):
        """Test deleting a preset"""
        # Add a test preset
        test_preset = get_test_preset("ambient")
        self.preset_manager.add_preset(test_preset["name"], test_preset)

        # Delete the preset
        self.preset_manager.delete_preset(test_preset["name"])

        # Verify the preset was deleted
        presets = self.preset_manager.get_presets()
        self.assertNotIn(test_preset["name"], [p["name"] for p in presets])


if __name__ == "__main__":
    pytest.main(["-v", __file__])
