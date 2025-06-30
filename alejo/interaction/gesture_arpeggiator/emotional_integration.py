"""
Gesture Arpeggiator - Emotional Intelligence Integration

This module connects the Gesture Arpeggiator with ALEJO's Emotional Intelligence framework,
allowing the system to adapt musical expressions based on detected emotional states
and create a more responsive, empathetic interaction experience.
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Union
from enum import Enum

from alejo.emotional_intelligence.integration import EmotionalIntelligenceIntegration
from alejo.emotional_intelligence.processor import EmotionalState
from alejo.interaction.gesture_arpeggiator.service import GestureArpeggiatorService, HandGesture

logger = logging.getLogger(__name__)

class MusicMood(Enum):
    """Music moods that can be expressed through the arpeggiator"""
    JOYFUL = "joyful"
    CALM = "calm"
    MELANCHOLIC = "melancholic"
    ENERGETIC = "energetic"
    PENSIVE = "pensive"
    HOPEFUL = "hopeful"
    MYSTERIOUS = "mysterious"
    TRIUMPHANT = "triumphant"


class GestureEmotionalIntegration:
    """
    Integrates the Gesture Arpeggiator with ALEJO's emotional intelligence framework
    
    This integration allows for:
    1. Adaptive musical responses based on detected user emotional states
    2. Emotion-influenced musical parameter adjustments
    3. Bidirectional communication where music can express emotions
       and gestures can influence emotional state interpretation
    """
    
    def __init__(
        self, 
        arpeggiator_service: GestureArpeggiatorService,
        emotional_integration: EmotionalIntelligenceIntegration
    ):
        """
        Initialize the integration
        
        Args:
            arpeggiator_service: The gesture arpeggiator service
            emotional_integration: The emotional intelligence integration module
        """
        self.arpeggiator_service = arpeggiator_service
        self.emotional_integration = emotional_integration
        self.active = False
        
        # Emotion to musical parameter mappings
        self.emotion_mappings = {
            EmotionalState.JOY: {
                "scale": "major",
                "bpm": 120,
                "pattern": "up",
                "mood": MusicMood.JOYFUL,
                "visualizer": {"theme": "sunshine", "sensitivity": 0.7}
            },
            EmotionalState.SADNESS: {
                "scale": "minor",
                "bpm": 80,
                "pattern": "down",
                "mood": MusicMood.MELANCHOLIC,
                "visualizer": {"theme": "ocean", "sensitivity": 0.4}
            },
            EmotionalState.ANGER: {
                "scale": "phrygian",
                "bpm": 140,
                "pattern": "random",
                "mood": MusicMood.ENERGETIC,
                "visualizer": {"theme": "fire", "sensitivity": 0.9}
            },
            EmotionalState.FEAR: {
                "scale": "diminished",
                "bpm": 100,
                "pattern": "converge",
                "mood": MusicMood.MYSTERIOUS,
                "visualizer": {"theme": "shadow", "sensitivity": 0.6}
            },
            EmotionalState.DISGUST: {
                "scale": "locrian",
                "bpm": 90,
                "pattern": "diverge",
                "mood": MusicMood.PENSIVE,
                "visualizer": {"theme": "toxic", "sensitivity": 0.5}
            },
            EmotionalState.SURPRISE: {
                "scale": "lydian",
                "bpm": 130,
                "pattern": "updown",
                "mood": MusicMood.HOPEFUL,
                "visualizer": {"theme": "sparkle", "sensitivity": 0.8}
            },
            EmotionalState.TRUST: {
                "scale": "major",
                "bpm": 110,
                "pattern": "inside_out",
                "mood": MusicMood.TRIUMPHANT,
                "visualizer": {"theme": "aurora", "sensitivity": 0.6}
            },
            EmotionalState.ANTICIPATION: {
                "scale": "mixolydian",
                "bpm": 115,
                "pattern": "up",
                "mood": MusicMood.HOPEFUL,
                "visualizer": {"theme": "cosmic", "sensitivity": 0.7}
            }
        }
        
        # Gesture to emotional influence mappings
        self.gesture_emotion_influence = {
            HandGesture.OPEN: EmotionalState.JOY,
            HandGesture.CLOSED: EmotionalState.SADNESS,
            HandGesture.POINTING: EmotionalState.ANTICIPATION,
            HandGesture.PINCH: EmotionalState.TRUST,
            HandGesture.VICTORY: EmotionalState.JOY,
            HandGesture.THUMBS_UP: EmotionalState.TRUST,
            HandGesture.ROCK: EmotionalState.SURPRISE,
            HandGesture.PALM_DOWN: EmotionalState.SADNESS,
            HandGesture.PALM_UP: EmotionalState.ANTICIPATION,
            HandGesture.FIST: EmotionalState.ANGER
        }
        
    async def start(self):
        """Start the emotional integration"""
        if self.active:
            return
            
        self.active = True
        
        # Register event handlers
        self.emotional_integration.register_emotional_state_handler(
            self._handle_emotional_state_change
        )
        self.arpeggiator_service.register_gesture_handler(
            self._handle_gesture_detected
        )
        
        logger.info("Gesture Arpeggiator Emotional Integration started")
        
    async def stop(self):
        """Stop the emotional integration"""
        if not self.active:
            return
            
        self.active = False
        
        # Unregister event handlers
        self.emotional_integration.unregister_emotional_state_handler(
            self._handle_emotional_state_change
        )
        self.arpeggiator_service.unregister_gesture_handler(
            self._handle_gesture_detected
        )
        
        logger.info("Gesture Arpeggiator Emotional Integration stopped")
    
    async def _handle_emotional_state_change(self, state: EmotionalState, intensity: float, context: Dict):
        """
        Handle changes in user emotional state
        
        Args:
            state: The detected emotional state
            intensity: How strongly the emotion is expressed (0.0-1.0)
            context: Additional contextual information
        """
        if not self.active:
            return
            
        # Get musical parameters for this emotion
        params = self.emotion_mappings.get(state, self.emotion_mappings[EmotionalState.JOY])
        
        # Adjust parameters based on intensity
        bpm = params["bpm"] + int(intensity * 20) - 10  # +/- 10 BPM based on intensity
        
        # Update arpeggiator settings
        await self.arpeggiator_service.update_arpeggiator_settings({
            "scale": params["scale"],
            "bpm": bpm,
            "pattern": params["pattern"],
        })
        
        # Update visualizer settings
        await self.arpeggiator_service.update_visualizer_settings({
            "theme": params["visualizer"]["theme"],
            "sensitivity": params["visualizer"]["sensitivity"]
        })
        
        logger.debug(f"Adapted music to emotional state: {state.name}, intensity: {intensity:.2f}")
    
    async def _handle_gesture_detected(self, gesture: HandGesture, hand_data: Dict):
        """
        Handle detected hand gestures to influence emotional state
        
        Args:
            gesture: The detected gesture
            hand_data: Additional hand tracking data
        """
        if not self.active or gesture not in self.gesture_emotion_influence:
            return
            
        # Get the emotional state influenced by this gesture
        emotion = self.gesture_emotion_influence[gesture]
        
        # Calculate intensity based on gesture confidence and movement speed
        confidence = hand_data.get("confidence", 0.5)
        speed = hand_data.get("speed", 0.5)
        intensity = (confidence + speed) / 2.0
        
        # Send feedback to the emotional intelligence system
        await self.emotional_integration.provide_gesture_feedback(
            emotion=emotion,
            intensity=intensity,
            source="gesture_arpeggiator",
            gesture_type=gesture.value,
            context={"hand_data": hand_data}
        )
        
        logger.debug(f"Gesture {gesture.value} influenced emotional state: {emotion.name}")


async def create_gesture_emotional_integration(
    arpeggiator_service: GestureArpeggiatorService,
    emotional_integration: EmotionalIntelligenceIntegration
) -> GestureEmotionalIntegration:
    """
    Factory function to create and initialize the integration
    
    Args:
        arpeggiator_service: The gesture arpeggiator service
        emotional_integration: The emotional intelligence integration module
        
    Returns:
        Initialized GestureEmotionalIntegration instance
    """
    integration = GestureEmotionalIntegration(arpeggiator_service, emotional_integration)
    await integration.start()
    return integration
