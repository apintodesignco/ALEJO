"""
ALEJO Emotion Processor

This module connects the emotion detector with the empathy model to provide
a complete emotional processing pipeline. It handles the detection, analysis,
and appropriate response generation for emotional content.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

from alejo.cognitive.emotional.emotion_detector import EmotionDetector, EmotionCategory
from alejo.cognitive.emotional.empathy_model import EmpathyModel, EmpathyLevel, ResponseStrategy
from alejo.cognitive.memory.relationship_memory import RelationshipMemory, InteractionType
from alejo.core.events import EventBus, Event
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class EmotionProcessor:
    """
    Emotion processing pipeline connecting detection with empathetic responses.
    
    This class orchestrates the emotion detection and response generation process,
    integrating with relationship memory to maintain emotional context over time.
    """
    
    def __init__(
        self,
        emotion_detector: Optional[EmotionDetector] = None,
        empathy_model: Optional[EmpathyModel] = None,
        relationship_memory: Optional[RelationshipMemory] = None,
        event_bus: Optional[EventBus] = None
    ):
        """
        Initialize the emotion processor.
        
        Args:
            emotion_detector: Emotion detector for analyzing inputs
            empathy_model: Empathy model for generating responses
            relationship_memory: Relationship memory for tracking emotional context
            event_bus: Event bus for publishing events
        """
        self.emotion_detector = emotion_detector or EmotionDetector()
        self.empathy_model = empathy_model or EmpathyModel()
        self.relationship_memory = relationship_memory
        self.event_bus = event_bus
        
        # Active session contexts
        self.active_sessions = {}
        
        logger.info("Emotion processor initialized")
    
    @handle_exceptions("Failed to process text input")
    async def process_text(
        self,
        session_id: str,
        text: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process text input to detect emotions and generate response adaptations.
        
        Args:
            session_id: ID of the current session
            text: Text input to analyze
            user_id: ID of the user (optional)
            context: Additional context information (optional)
            
        Returns:
            Dictionary with emotional analysis and response adaptations
        """
        # Initialize context if not provided
        context = context or {}
        
        # Detect emotions from text
        emotion_result = self.emotion_detector.detect_from_text(text)
        
        # Update session context
        if session_id not in self.active_sessions:
            self.active_sessions[session_id] = {
                "history": [],
                "start_time": datetime.now(),
                "user_id": user_id
            }
        
        session = self.active_sessions[session_id]
        
        # Add current emotion to history
        session["history"].append({
            "timestamp": datetime.now(),
            "emotion": emotion_result,
            "text": text
        })
        
        # Trim history if needed (keep last 10 entries)
        if len(session["history"]) > 10:
            session["history"] = session["history"][-10:]
        
        # Update context with conversation history
        context["conversation_history"] = session["history"]
        
        # Generate response adaptations
        adaptations = await self._generate_response_adaptations(
            emotion_result, context, user_id
        )
        
        # Record in relationship memory if available
        if self.relationship_memory and user_id:
            await self._record_emotional_interaction(user_id, emotion_result, text)
        
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                Event(
                    type="emotion_processed",
                    data={
                        "session_id": session_id,
                        "user_id": user_id,
                        "emotion": emotion_result,
                        "adaptations": adaptations
                    }
                )
            )
        
        # Return combined results
        return {
            "emotion": emotion_result,
            "adaptations": adaptations
        }
    
    @handle_exceptions("Failed to generate response adaptations")
    async def _generate_response_adaptations(
        self,
        emotion_result: Dict[str, Any],
        context: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate empathetic response adaptations based on detected emotions.
        
        Args:
            emotion_result: Detected emotion results
            context: Conversation context
            user_id: ID of the user (optional)
            
        Returns:
            Dictionary with response adaptations
        """
        # Convert emotion result to format expected by empathy model
        primary_emotion = EmotionCategory(emotion_result["primary_emotion"])
        
        # Create emotional state for empathy model
        emotional_state = {
            "primary_emotion": primary_emotion,
            "primary_intensity": emotion_result["primary_intensity"],
            "secondary_emotions": {
                EmotionCategory(e): i for e, i in emotion_result["secondary_emotions"].items()
            },
            "confidence": emotion_result["confidence"]
        }
        
        # Generate adaptations using empathy model
        adaptations = self.empathy_model.generate_response_adaptations(
            emotional_state=emotional_state,
            context=context,
            user_id=user_id
        )
        
        return adaptations
    
    @handle_exceptions("Failed to record emotional interaction")
    async def _record_emotional_interaction(
        self,
        user_id: str,
        emotion_result: Dict[str, Any],
        text: str
    ) -> None:
        """
        Record emotional interaction in relationship memory.
        
        Args:
            user_id: ID of the user
            emotion_result: Detected emotion results
            text: Original text input
        """
        if not self.relationship_memory:
            return
        
        # Determine interaction type based on emotion
        primary_emotion = EmotionCategory(emotion_result["primary_emotion"])
        
        if primary_emotion in [EmotionCategory.JOY, EmotionCategory.TRUST]:
            interaction_type = InteractionType.EMOTIONAL_EXCHANGE
        elif primary_emotion in [EmotionCategory.ANGER, EmotionCategory.DISGUST]:
            interaction_type = InteractionType.CONFLICT
        else:
            interaction_type = InteractionType.CONVERSATION
        
        # Create content description
        content = f"User expressed {primary_emotion.value} with intensity {emotion_result['primary_intensity']:.2f}: '{text[:50]}...'" if len(text) > 50 else text
        
        # Calculate sentiment (-1.0 to 1.0)
        sentiment_map = {
            EmotionCategory.JOY: 0.8,
            EmotionCategory.SADNESS: -0.7,
            EmotionCategory.ANGER: -0.8,
            EmotionCategory.FEAR: -0.6,
            EmotionCategory.SURPRISE: 0.2,
            EmotionCategory.DISGUST: -0.7,
            EmotionCategory.TRUST: 0.7,
            EmotionCategory.ANTICIPATION: 0.5,
            EmotionCategory.NEUTRAL: 0.0
        }
        
        sentiment = sentiment_map[primary_emotion] * emotion_result["primary_intensity"]
        
        # Record in relationship memory
        await self.relationship_memory.record_interaction(
            entity_id=user_id,
            interaction_type=interaction_type,
            content=content,
            sentiment=sentiment,
            importance=emotion_result["primary_intensity"],
            context={
                "emotional_state": emotion_result,
                "original_text": text
            }
        )


# Example usage
async def main():
    # Initialize components
    emotion_detector = EmotionDetector()
    empathy_model = EmpathyModel()
    
    # Initialize emotion processor
    processor = EmotionProcessor(
        emotion_detector=emotion_detector,
        empathy_model=empathy_model
    )
    
    # Process some example text
    result = await processor.process_text(
        session_id="test_session",
        text="I'm feeling really anxious about my upcoming presentation.",
        user_id="test_user"
    )
    
    # Print results
    print("Detected emotion:", result["emotion"]["primary_emotion"])
    print("Response adaptations:", result["adaptations"])


if __name__ == "__main__":
    asyncio.run(main())
