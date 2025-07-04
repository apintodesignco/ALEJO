"""
Unit tests for the EmotionDetector class.

These tests verify the functionality of the multimodal emotion detector,
including text, voice, and facial emotion detection, multimodal fusion,
and integration with the event bus and relationship memory.
"""

import asyncio
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

from alejo.cognitive.emotional.emotion_detector_updated import EmotionDetector
from alejo.cognitive.emotional.emotion_types import (
    EmotionCategory, 
    EmotionScore, 
    EmotionDetectionResult,
    InputModality,
    EmotionIntensityLevel
)


class TestEmotionDetector(unittest.TestCase):
    """Test cases for the EmotionDetector class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create mock analyzers
        self.mock_text_analyzer = MagicMock()
        self.mock_voice_analyzer = MagicMock()
        self.mock_facial_analyzer = MagicMock()
        self.mock_fusion_engine = MagicMock()
        self.mock_event_bus = MagicMock()
        self.mock_relationship_memory = MagicMock()
        
        # Create detector with mocks
        self.detector = EmotionDetector(
            text_analyzer=self.mock_text_analyzer,
            voice_analyzer=self.mock_voice_analyzer,
            facial_analyzer=self.mock_facial_analyzer,
            fusion_engine=self.mock_fusion_engine,
            event_bus=self.mock_event_bus,
            relationship_memory=self.mock_relationship_memory
        )
        
        # Sample emotion results
        self.joy_score = EmotionScore.create(
            category=EmotionCategory.JOY,
            intensity=0.8,
            confidence=0.9
        )
        
        self.anger_score = EmotionScore.create(
            category=EmotionCategory.ANGER,
            intensity=0.7,
            confidence=0.8
        )
        
        self.text_result = EmotionDetectionResult(
            primary=self.joy_score,
            secondary={
                EmotionCategory.SURPRISE: EmotionScore.create(
                    category=EmotionCategory.SURPRISE,
                    intensity=0.4,
                    confidence=0.6
                )
            },
            modality=InputModality.TEXT,
            features={"keywords": ["happy", "excited"]},
            timestamp=datetime.now()
        )
        
        self.voice_result = EmotionDetectionResult(
            primary=self.anger_score,
            secondary={
                EmotionCategory.FEAR: EmotionScore.create(
                    category=EmotionCategory.FEAR,
                    intensity=0.3,
                    confidence=0.5
                )
            },
            modality=InputModality.VOICE,
            features={"pitch_mean": 220.0},
            timestamp=datetime.now()
        )
    
    def test_init(self):
        """Test initialization of EmotionDetector."""
        detector = EmotionDetector()
        self.assertIsNotNone(detector.text_analyzer)
        self.assertIsNotNone(detector.voice_analyzer)
        self.assertIsNotNone(detector.facial_analyzer)
        self.assertEqual(detector.active_contexts, {})
        self.assertEqual(detector.detection_history, {})
    
    @patch('alejo.cognitive.emotional.emotion_detector_updated.handle_exceptions')
    async def test_detect_from_text(self, mock_handle_exceptions):
        """Test text emotion detection."""
        # Setup mock
        self.mock_text_analyzer.analyze.return_value = self.text_result
        
        # Call method
        result = await self.detector.detect_from_text(
            text="I'm happy!",
            session_id="test_session",
            user_id="test_user"
        )
        
        # Verify
        self.mock_text_analyzer.analyze.assert_called_once()
        self.assertEqual(result.primary.category, EmotionCategory.JOY)
        self.assertEqual(result.modality, InputModality.TEXT)
        self.mock_event_bus.publish.assert_called_once()
        self.mock_relationship_memory.record_interaction.assert_called_once()
    
    @patch('alejo.cognitive.emotional.emotion_detector_updated.handle_exceptions')
    async def test_detect_from_voice(self, mock_handle_exceptions):
        """Test voice emotion detection."""
        # Setup mock
        self.mock_voice_analyzer.analyze.return_value = self.voice_result
        
        # Voice features
        voice_features = {
            "pitch_mean": 220.0,
            "pitch_range": 80.0,
            "intensity_mean": 75.0,
            "speech_rate": 6.0
        }
        
        # Call method
        result = await self.detector.detect_from_voice(
            voice_features=voice_features,
            session_id="test_session",
            user_id="test_user"
        )
        
        # Verify
        self.mock_voice_analyzer.analyze.assert_called_once_with(voice_features, context=None)
        self.assertEqual(result.primary.category, EmotionCategory.ANGER)
        self.assertEqual(result.modality, InputModality.VOICE)
        self.mock_event_bus.publish.assert_called_once()
        self.mock_relationship_memory.record_interaction.assert_called_once()
    
    @patch('alejo.cognitive.emotional.emotion_detector_updated.handle_exceptions')
    async def test_detect_multimodal_with_fusion_engine(self, mock_handle_exceptions):
        """Test multimodal emotion detection with fusion engine."""
        # Setup mocks
        self.mock_text_analyzer.analyze.return_value = self.text_result
        self.mock_voice_analyzer.analyze.return_value = self.voice_result
        
        # Setup fusion engine result
        fusion_result = {
            "primary_emotion": "surprise",
            "primary_intensity": 0.85,
            "confidence": 0.95,
            "secondary_emotions": {
                "joy": 0.6,
                "fear": 0.2
            },
            "fusion_weights": [0.6, 0.4],
            "modality_contributions": {
                "text": 0.6,
                "voice": 0.4
            }
        }
        self.mock_fusion_engine.fuse_emotional_inputs.return_value = fusion_result
        
        # Call method
        result = await self.detector.detect_multimodal(
            text="I'm happy!",
            voice_features={"pitch_mean": 220.0},
            session_id="test_session",
            user_id="test_user"
        )
        
        # Verify
        self.mock_text_analyzer.analyze.assert_called_once()
        self.mock_voice_analyzer.analyze.assert_called_once()
        self.mock_fusion_engine.fuse_emotional_inputs.assert_called_once()
        self.assertEqual(result.primary.category, EmotionCategory.SURPRISE)
        self.assertEqual(result.modality, InputModality.MULTIMODAL)
        self.assertAlmostEqual(result.primary.intensity, 0.85)
        self.assertAlmostEqual(result.primary.confidence, 0.95)
        self.mock_event_bus.publish.assert_called_once()
        self.mock_relationship_memory.record_interaction.assert_called_once()
    
    @patch('alejo.cognitive.emotional.emotion_detector_updated.handle_exceptions')
    async def test_detect_multimodal_without_fusion_engine(self, mock_handle_exceptions):
        """Test multimodal emotion detection without fusion engine."""
        # Create detector without fusion engine
        detector = EmotionDetector(
            text_analyzer=self.mock_text_analyzer,
            voice_analyzer=self.mock_voice_analyzer,
            facial_analyzer=self.mock_facial_analyzer,
            event_bus=self.mock_event_bus,
            relationship_memory=self.mock_relationship_memory
        )
        
        # Setup mocks
        self.mock_text_analyzer.analyze.return_value = self.text_result
        self.mock_voice_analyzer.analyze.return_value = self.voice_result
        
        # Call method
        result = await detector.detect_multimodal(
            text="I'm happy!",
            voice_features={"pitch_mean": 220.0},
            session_id="test_session",
            user_id="test_user"
        )
        
        # Verify that simple fusion was used
        self.mock_text_analyzer.analyze.assert_called_once()
        self.mock_voice_analyzer.analyze.assert_called_once()
        self.assertEqual(result.modality, InputModality.MULTIMODAL)
        self.assertIn("fusion_weights", result.features)
        self.assertIn("source_modalities", result.features)
        
    @patch('alejo.cognitive.emotional.emotion_detector_updated.handle_exceptions')
    async def test_simple_fusion(self, mock_handle_exceptions):
        """Test the simple fusion algorithm."""
        # Create results with different emotions
        joy_result = EmotionDetectionResult(
            primary=self.joy_score,
            secondary={},
            modality=InputModality.TEXT,
            timestamp=datetime.now()
        )
        
        anger_result = EmotionDetectionResult(
            primary=self.anger_score,
            secondary={},
            modality=InputModality.VOICE,
            timestamp=datetime.now()
        )
        
        # Perform fusion
        result = self.detector._simple_fusion([joy_result, anger_result])
        
        # Verify
        self.assertEqual(result.modality, InputModality.MULTIMODAL)
        self.assertIn(joy_result.primary.category, [result.primary.category] + list(result.secondary.keys()))
        self.assertIn(anger_result.primary.category, [result.primary.category] + list(result.secondary.keys()))
        
    async def test_get_emotion_trend(self):
        """Test getting emotion trend."""
        # Setup history
        session_id = "test_session"
        self.detector.detection_history[session_id] = [
            EmotionDetectionResult(
                primary=EmotionScore.create(
                    category=EmotionCategory.JOY,
                    intensity=0.5,
                    confidence=0.8
                ),
                secondary={},
                modality=InputModality.TEXT,
                timestamp=datetime.now()
            ),
            EmotionDetectionResult(
                primary=EmotionScore.create(
                    category=EmotionCategory.JOY,
                    intensity=0.7,
                    confidence=0.8
                ),
                secondary={},
                modality=InputModality.TEXT,
                timestamp=datetime.now()
            ),
            EmotionDetectionResult(
                primary=EmotionScore.create(
                    category=EmotionCategory.JOY,
                    intensity=0.9,
                    confidence=0.8
                ),
                secondary={},
                modality=InputModality.TEXT,
                timestamp=datetime.now()
            )
        ]
        
        # Get trend
        trend = self.detector.get_emotion_trend(session_id)
        
        # Verify
        self.assertEqual(trend["dominant_emotion"], EmotionCategory.JOY.value)
        self.assertEqual(trend["trend"], "increasing")
        
    async def test_get_emotional_context_from_memory(self):
        """Test getting emotional context from memory."""
        # Setup mock
        interactions = [
            {
                "data": {
                    "emotion": "joy",
                    "intensity": 0.7,
                    "timestamp": datetime.now().isoformat()
                },
                "sentiment": 0.6
            },
            {
                "data": {
                    "emotion": "joy",
                    "intensity": 0.8,
                    "timestamp": datetime.now().isoformat()
                },
                "sentiment": 0.7
            }
        ]
        self.mock_relationship_memory.get_recent_interactions.return_value = interactions
        
        # Get context
        context = await self.detector.get_emotional_context_from_memory("test_user")
        
        # Verify
        self.mock_relationship_memory.get_recent_interactions.assert_called_once()
        self.assertEqual(context["dominant_emotion"], "joy")
        self.assertAlmostEqual(context["average_sentiment"], 0.65)


# Run tests
if __name__ == "__main__":
    # Use asyncio to run async tests
    loop = asyncio.get_event_loop()
    unittest.main()
