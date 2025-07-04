"""
ALEJO Emotion Detector

This module implements comprehensive emotion detection capabilities across multiple modalities.
It integrates text, voice, and facial emotion analysis into a unified system with multimodal fusion.
"""

import asyncio
import logging
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union, Set

from alejo.cognitive.emotional.emotion_types import (
    EmotionCategory, EmotionIntensity, EmotionScore, 
    EmotionDetectionResult, InputModality, EmotionContext,
    TextFeatures, VoiceFeatures, FacialFeatures
)
from alejo.cognitive.emotional.text_analyzer import TextEmotionAnalyzer
from alejo.cognitive.emotional.voice_analyzer import VoiceEmotionAnalyzer
from alejo.cognitive.emotional.facial_analyzer import FacialEmotionAnalyzer
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class EmotionDetector:
    """
    Comprehensive emotion detector with multimodal capabilities.
    
    This class provides methods to detect emotions from text, voice, and facial
    expressions, with support for multimodal fusion when multiple inputs are available.
    It integrates with ALEJO's event system and relationship memory for contextual
    emotion tracking.
    
    Features:
    - Text-based emotion detection using lexical analysis
    - Voice-based emotion detection using acoustic features
    - Facial expression analysis using action units and valence-arousal
    - Multimodal fusion for more accurate emotion detection
    - Contextual emotion tracking across interactions
    """
    
    def __init__(
        self,
        text_analyzer: Optional[TextEmotionAnalyzer] = None,
        voice_analyzer: Optional[VoiceEmotionAnalyzer] = None,
        facial_analyzer: Optional[FacialEmotionAnalyzer] = None
    ):
        """
        Initialize the emotion detector with analyzers for different modalities.
        
        Args:
            text_analyzer: Analyzer for text-based emotion detection
            voice_analyzer: Analyzer for voice-based emotion detection
            facial_analyzer: Analyzer for facial expression analysis
        """
        # Initialize analyzers
        self.text_analyzer = text_analyzer or TextEmotionAnalyzer()
        self.voice_analyzer = voice_analyzer or VoiceEmotionAnalyzer()
        self.facial_analyzer = facial_analyzer or FacialEmotionAnalyzer()
        
        # Active emotion contexts by session
        self.active_contexts = {}
        
        # Detection history
        self.detection_history = {}
        
        logger.info("Emotion detector initialized with multimodal capabilities")
    
    @handle_exceptions("Failed to detect emotion from text")
    async def detect_from_text(
        self, 
        text: str, 
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> EmotionDetectionResult:
        """
        Detect emotions from text input.
        
        Args:
            text: Text to analyze
            session_id: ID of the current session (optional)
            user_id: ID of the user (optional)
            context: Additional context information (optional)
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        # Create or retrieve emotion context
        emotion_context = self._get_or_create_context(session_id, user_id, context)
        
        # Analyze text
        result = self.text_analyzer.analyze(text, context=context)
        
        # Update context with this result
        self._update_context(emotion_context, result)
        
        return result
    
    @handle_exceptions("Failed to detect emotion from voice")
    async def detect_from_voice(
        self, 
        voice_features: VoiceFeatures, 
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> EmotionDetectionResult:
        """
        Detect emotions from voice input.
        
        Args:
            voice_features: Extracted voice features
            session_id: ID of the current session (optional)
            user_id: ID of the user (optional)
            context: Additional context information (optional)
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        # Create or retrieve emotion context
        emotion_context = self._get_or_create_context(session_id, user_id, context)
        
        # Analyze voice
        result = self.voice_analyzer.analyze(voice_features, context=context)
        
        # Update context with this result
        self._update_context(emotion_context, result)
        
        return result
    
    @handle_exceptions("Failed to detect emotion from facial expressions")
    async def detect_from_facial(
        self, 
        facial_features: FacialFeatures, 
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> EmotionDetectionResult:
        """
        Detect emotions from facial expressions.
        
        Args:
            facial_features: Extracted facial features
            session_id: ID of the current session (optional)
            user_id: ID of the user (optional)
            context: Additional context information (optional)
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        # Create or retrieve emotion context
        emotion_context = self._get_or_create_context(session_id, user_id, context)
        
        # Analyze facial expressions
        result = self.facial_analyzer.analyze(facial_features, context=context)
        
        # Update context with this result
        self._update_context(emotion_context, result)
        
        return result
    
    def _get_or_create_context(
        self, 
        session_id: Optional[str], 
        user_id: Optional[str],
        context_data: Optional[Dict[str, Any]]
    ) -> EmotionContext:
        """
        Get or create emotion context for a session.
        
        Args:
            session_id: ID of the session
            user_id: ID of the user
            context_data: Additional context data
            
        Returns:
            EmotionContext for this session
        """
        # Generate session ID if not provided
        if not session_id:
            session_id = f"session_{int(time.time())}"
        
        # Create new context if not exists
        if session_id not in self.active_contexts:
            self.active_contexts[session_id] = EmotionContext(
                user_id=user_id,
                session_id=session_id,
                preferences=context_data.get("preferences") if context_data else None,
                environment=context_data.get("environment") if context_data else None,
                app_state=context_data.get("app_state") if context_data else None
            )
            
            # Initialize history for this session
            self.detection_history[session_id] = []
        
        return self.active_contexts[session_id]
    
    def _update_context(self, context: EmotionContext, result: EmotionDetectionResult) -> None:
        """
        Update emotion context with new detection result.
        
        Args:
            context: Emotion context to update
            result: New emotion detection result
        """
        # Add result to context history
        context.history.append(result)
        
        # Limit history size (keep last 20)
        if len(context.history) > 20:
            context.history = context.history[-20:]
        
        # Add to detection history
        if context.session_id in self.detection_history:
            self.detection_history[context.session_id].append(result)
            
            # Limit history size (keep last 100)
            if len(self.detection_history[context.session_id]) > 100:
                self.detection_history[context.session_id] = self.detection_history[context.session_id][-100:]


# Example usage
async def main():
    # Initialize detector
    detector = EmotionDetector()
    
    # Test with text
    text_result = await detector.detect_from_text(
        text="I'm really excited about this new project!",
        session_id="test_session"
    )
    print(f"Text emotion: {text_result.primary.category.value} "
          f"(intensity: {text_result.primary.intensity:.2f})")


if __name__ == "__main__":
    asyncio.run(main())
