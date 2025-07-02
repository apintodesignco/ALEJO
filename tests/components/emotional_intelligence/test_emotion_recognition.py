"""
Unit tests for EmotionRecognition model
"""

import sys
import unittest
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import secrets  # More secure for cryptographic purposes

from alejo.stubs.emotional_intelligence_stub import EmotionRecognition


class TestEmotionRecognition(unittest.TestCase):
    """Test suite for the EmotionRecognition class using the stub"""

    def setUp(self):
        """Set up for each test"""
        self.emotion_model = EmotionRecognition()

    def test_singleton_instance(self):
        """Test that EmotionRecognition stub is a singleton"""
        model1 = EmotionRecognition()
        model2 = EmotionRecognition()
        self.assertIs(model1, model2, "EmotionRecognition stub should be a singleton")

    def test_analyze_text_emotion_happy(self):
        """Test emotion analysis for happy text using stub"""
        text = "I am so happy and excited about this!"
        emotions = self.emotion_model.analyze_emotion(text)
        self.assertIn("joy", emotions)
        self.assertGreater(emotions["joy"], 0.5)

    def test_analyze_text_emotion_sad(self):
        """Test emotion analysis for sad text using stub"""
        text = "This is a very sad and disappointing situation."
        emotions = self.emotion_model.analyze_emotion(text)
        self.assertIn("sadness", emotions)
        self.assertGreater(emotions["sadness"], 0.5)

    def test_analyze_text_emotion_neutral(self):
        """Test emotion analysis for neutral text using stub"""
        text = "The sky is blue."
        emotions = self.emotion_model.analyze_emotion(text)
        self.assertIn("neutral", emotions)

    def test_get_dominant_emotion(self):
        """Test getting the dominant emotion from text using stub"""
        text = "I feel absolutely fantastic today, full of joy!"
        dominant_emotion = self.emotion_model.get_dominant_emotion(text)
        self.assertEqual(dominant_emotion, "joy")


if __name__ == "__main__":
    unittest.main()
