"""
Integration tests for the EmotionDetector with ALEJO's core systems.

These tests verify that the emotion detector properly integrates with:
1. Event bus for publishing emotion detection events
2. Relationship memory for storing emotional context
3. Multimodal fusion engine for combining different modalities
"""

import asyncio
import unittest
from datetime import datetime, timedelta
import logging

from alejo.cognitive.emotional.emotion_detector_updated import EmotionDetector
from alejo.cognitive.emotional.text_analyzer import TextEmotionAnalyzer
from alejo.cognitive.emotional.voice_analyzer import VoiceEmotionAnalyzer
from alejo.cognitive.emotional.facial_analyzer import FacialEmotionAnalyzer
from alejo.cognitive.emotional.emotion_types import EmotionCategory, InputModality
from alejo.core.events import EventBus, Event
from alejo.cognitive.memory.relationship_memory import RelationshipMemory
from alejo.integration.fusion.multimodal_merge import MultimodalFusionEngine


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestEmotionDetectorIntegration(unittest.TestCase):
    """Integration tests for EmotionDetector with ALEJO systems."""
    
    async def asyncSetUp(self):
        """Set up test fixtures asynchronously."""
        # Initialize real components
        self.event_bus = EventBus()
        self.relationship_memory = RelationshipMemory()
        self.fusion_engine = MultimodalFusionEngine()
        
        # Initialize emotion detector with real components
        self.detector = EmotionDetector(
            text_analyzer=TextEmotionAnalyzer(),
            voice_analyzer=VoiceEmotionAnalyzer(),
            facial_analyzer=FacialEmotionAnalyzer(),
            fusion_engine=self.fusion_engine,
            event_bus=self.event_bus,
            relationship_memory=self.relationship_memory
        )
        
        # Set up event listener for testing
        self.received_events = []
        self.event_bus.subscribe("emotion_detected", self._on_emotion_event)
        
        # Test user and session
        self.user_id = "test_user_integration"
        self.session_id = "test_session_integration"
    
    def setUp(self):
        """Set up test fixtures."""
        self.loop = asyncio.get_event_loop()
        self.loop.run_until_complete(self.asyncSetUp())
    
    async def _on_emotion_event(self, event):
        """Event listener callback."""
        self.received_events.append(event)
        logger.info(f"Received emotion event: {event.data['primary_emotion']} "
                   f"(intensity: {event.data['primary_intensity']:.2f})")
    
    async def test_end_to_end_emotion_detection(self):
        """Test end-to-end emotion detection flow with all components."""
        # 1. Detect emotion from text
        text_result = await self.detector.detect_from_text(
            text="I'm really excited about this new project!",
            session_id=self.session_id,
            user_id=self.user_id
        )
        
        # Verify text detection result
        self.assertIsNotNone(text_result)
        self.assertEqual(text_result.modality, InputModality.TEXT)
        
        # 2. Detect emotion from voice
        voice_features = {
            "pitch_mean": 220.0,  # High pitch (joy)
            "pitch_range": 80.0,   # Wide range
            "intensity_mean": 75.0,  # High intensity
            "speech_rate": 6.0,     # Fast
            "voice_quality": "bright",
            "energy_variance": 0.8
        }
        voice_result = await self.detector.detect_from_voice(
            voice_features=voice_features,
            session_id=self.session_id,
            user_id=self.user_id
        )
        
        # Verify voice detection result
        self.assertIsNotNone(voice_result)
        self.assertEqual(voice_result.modality, InputModality.VOICE)
        
        # 3. Detect emotion from facial expressions
        facial_features = {
            "smile_intensity": 0.8,
            "eye_openness": 0.7,
            "brow_position": 0.6,
            "mouth_width": 0.75,
            "facial_movement": "high"
        }
        facial_result = await self.detector.detect_from_facial(
            facial_features=facial_features,
            session_id=self.session_id,
            user_id=self.user_id
        )
        
        # Verify facial detection result
        self.assertIsNotNone(facial_result)
        self.assertEqual(facial_result.modality, InputModality.FACIAL)
        
        # 4. Detect emotion using multimodal fusion
        multimodal_result = await self.detector.detect_multimodal(
            text="I'm really excited about this new project!",
            voice_features=voice_features,
            facial_features=facial_features,
            session_id=self.session_id,
            user_id=self.user_id
        )
        
        # Verify multimodal result
        self.assertIsNotNone(multimodal_result)
        self.assertEqual(multimodal_result.modality, InputModality.MULTIMODAL)
        
        # 5. Verify events were published
        self.assertEqual(len(self.received_events), 4)  # One for each detection
        
        # 6. Verify relationship memory was updated
        emotional_context = await self.detector.get_emotional_context_from_memory(
            user_id=self.user_id
        )
        self.assertIsNotNone(emotional_context)
        self.assertIn("dominant_emotion", emotional_context)
        self.assertIn("emotional_stability", emotional_context)
        
        # 7. Verify emotion trend
        trend = self.detector.get_emotion_trend(session_id=self.session_id)
        self.assertIsNotNone(trend)
        self.assertIn("trend", trend)
        self.assertIn("dominant_emotion", trend)
    
    async def test_emotion_tracking_over_time(self):
        """Test emotion tracking over time with changing emotions."""
        # Create sequence of emotions
        emotions = [
            ("I'm feeling great today!", {"pitch_mean": 220.0, "speech_rate": 6.0}, {"smile_intensity": 0.8}),
            ("This is interesting.", {"pitch_mean": 180.0, "speech_rate": 4.0}, {"smile_intensity": 0.4}),
            ("I'm not sure about this.", {"pitch_mean": 160.0, "speech_rate": 3.0}, {"smile_intensity": 0.2}),
            ("That's concerning.", {"pitch_mean": 140.0, "speech_rate": 2.5}, {"smile_intensity": 0.1}),
            ("This is terrible news!", {"pitch_mean": 250.0, "speech_rate": 7.0}, {"smile_intensity": 0.0})
        ]
        
        # Process each emotion
        for i, (text, voice, facial) in enumerate(emotions):
            await self.detector.detect_multimodal(
                text=text,
                voice_features=voice,
                facial_features=facial,
                session_id=self.session_id,
                user_id=self.user_id
            )
        
        # Verify emotion trend shows change
        trend = self.detector.get_emotion_trend(session_id=self.session_id)
        self.assertIsNotNone(trend)
        
        # Get emotional context from memory
        emotional_context = await self.detector.get_emotional_context_from_memory(
            user_id=self.user_id
        )
        
        # Verify we have recent emotions in the context
        self.assertGreaterEqual(len(emotional_context["recent_emotions"]), 1)
        
        # Verify we received events for each emotion
        self.assertEqual(len(self.received_events), len(emotions))
    
    async def test_relationship_memory_integration(self):
        """Test integration with relationship memory for long-term emotional patterns."""
        # Create a series of consistent joy emotions
        for i in range(5):
            await self.detector.detect_from_text(
                text=f"I'm really happy about this! {i}",
                session_id=self.session_id,
                user_id=self.user_id
            )
        
        # Get emotional context
        context = await self.detector.get_emotional_context_from_memory(
            user_id=self.user_id
        )
        
        # Verify dominant emotion is joy-related
        self.assertIn(context["dominant_emotion"].lower(), ["joy", "happy", "excitement"])
        
        # Verify emotional stability is stable (consistent emotions)
        self.assertIn(context["emotional_stability"], ["stable", "very stable"])
        
        # Verify positive sentiment
        self.assertGreater(context["average_sentiment"], 0)


# Custom test runner for async tests
class AsyncioTestRunner:
    """Custom test runner for asyncio tests."""
    
    def run_tests(self):
        """Run all tests."""
        loop = asyncio.get_event_loop()
        result = unittest.TestResult()
        
        # Get all test methods
        test_case = TestEmotionDetectorIntegration()
        test_methods = [m for m in dir(test_case) if m.startswith('test_')]
        
        for method_name in test_methods:
            # Run each test method
            method = getattr(test_case, method_name)
            if asyncio.iscoroutinefunction(method):
                try:
                    test_case.setUp()
                    loop.run_until_complete(method())
                    test_case.tearDown()
                    print(f"✅ {method_name} passed")
                except Exception as e:
                    print(f"❌ {method_name} failed: {e}")
            else:
                print(f"Skipping {method_name} - not a coroutine")


# Run tests
if __name__ == "__main__":
    runner = AsyncioTestRunner()
    runner.run_tests()
