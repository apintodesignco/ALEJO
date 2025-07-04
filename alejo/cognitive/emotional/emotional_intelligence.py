"""
ALEJO Emotional Intelligence Engine

This module implements ALEJO's emotional intelligence capabilities, enabling it to
understand, process, and respond to emotions in a human-like manner. It integrates
with the memory systems, reasoning engine, and multimodal fusion to provide a
comprehensive emotional understanding framework.

Features:
- Emotion detection and classification from text, voice, and facial expressions
- Emotional context tracking across conversations
- Empathetic response generation based on emotional context
- Emotional memory integration for long-term relationship building
- Adaptive emotional response calibration based on user preferences
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Union, Tuple, Set

import numpy as np

from alejo.cognitive.memory.relationship_memory import RelationshipMemory, InteractionType
from alejo.cognitive.memory.memory_prioritizer import MemoryPrioritizer, PriorityFactor
from alejo.cognitive.reasoning.orchestrator import ReasoningEngineOrchestrator
from alejo.integration.fusion.multimodal_merge import MultimodalFusionEngine, InputModality
from alejo.core.events import EventBus, Event
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class EmotionCategory(Enum):
    """Categories of emotions that can be detected and processed."""
    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    TRUST = "trust"
    ANTICIPATION = "anticipation"
    NEUTRAL = "neutral"


class EmotionIntensity(Enum):
    """Intensity levels for emotions."""
    VERY_LOW = 0.2
    LOW = 0.4
    MEDIUM = 0.6
    HIGH = 0.8
    VERY_HIGH = 1.0


class EmotionalState:
    """
    Represents an emotional state with multiple emotion categories and intensities.
    """
    def __init__(
        self,
        primary_emotion: EmotionCategory = EmotionCategory.NEUTRAL,
        primary_intensity: float = 0.5,
        secondary_emotions: Dict[EmotionCategory, float] = None,
        confidence: float = 1.0,
        source: str = "unknown",
        timestamp: Optional[datetime] = None
    ):
        """
        Initialize an emotional state.
        
        Args:
            primary_emotion: The primary emotion category
            primary_intensity: Intensity of the primary emotion (0.0 to 1.0)
            secondary_emotions: Dictionary of secondary emotions and their intensities
            confidence: Confidence in this emotional assessment (0.0 to 1.0)
            source: Source of this emotional state detection
            timestamp: When this emotional state was detected
        """
        self.primary_emotion = primary_emotion
        self.primary_intensity = min(max(primary_intensity, 0.0), 1.0)
        self.secondary_emotions = secondary_emotions or {}
        self.confidence = min(max(confidence, 0.0), 1.0)
        self.source = source
        self.timestamp = timestamp or datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert emotional state to dictionary."""
        return {
            "primary_emotion": self.primary_emotion.value,
            "primary_intensity": self.primary_intensity,
            "secondary_emotions": {e.value: i for e, i in self.secondary_emotions.items()},
            "confidence": self.confidence,
            "source": self.source,
            "timestamp": self.timestamp.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EmotionalState':
        """Create emotional state from dictionary."""
        return cls(
            primary_emotion=EmotionCategory(data["primary_emotion"]),
            primary_intensity=data["primary_intensity"],
            secondary_emotions={EmotionCategory(e): i for e, i in data["secondary_emotions"].items()},
            confidence=data["confidence"],
            source=data["source"],
            timestamp=datetime.fromisoformat(data["timestamp"]) if "timestamp" in data else None
        )


class EmotionalContext:
    """
    Tracks emotional context across a conversation or interaction session.
    """
    def __init__(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        context_window: int = 10
    ):
        """
        Initialize an emotional context tracker.
        
        Args:
            session_id: ID of the current session
            user_id: ID of the user (optional)
            context_window: Number of emotional states to track in history
        """
        self.session_id = session_id
        self.user_id = user_id
        self.context_window = context_window
        self.emotional_history: List[EmotionalState] = []
        self.baseline_emotion: Optional[EmotionalState] = None
        self.start_time = datetime.now()
        self.last_updated = datetime.now()
    
    def add_emotional_state(self, state: EmotionalState) -> None:
        """
        Add an emotional state to the context history.
        
        Args:
            state: Emotional state to add
        """
        self.emotional_history.append(state)
        self.last_updated = datetime.now()
        
        # Trim history if needed
        if len(self.emotional_history) > self.context_window:
            self.emotional_history = self.emotional_history[-self.context_window:]
        
        # Update baseline if not set
        if not self.baseline_emotion:
            self.baseline_emotion = state
    
    def get_current_emotional_state(self) -> Optional[EmotionalState]:
        """
        Get the current emotional state.
        
        Returns:
            Current emotional state or None if no history
        """
        if not self.emotional_history:
            return None
        return self.emotional_history[-1]
    
    def get_emotional_trend(self) -> Dict[str, Any]:
        """
        Calculate emotional trend over the conversation.
        
        Returns:
            Dictionary with trend information
        """
        if len(self.emotional_history) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate trend for primary emotion
        first_state = self.emotional_history[0]
        last_state = self.emotional_history[-1]
        
        # Check if primary emotion has changed
        emotion_changed = first_state.primary_emotion != last_state.primary_emotion
        
        # Calculate intensity change
        if not emotion_changed:
            intensity_change = last_state.primary_intensity - first_state.primary_intensity
        else:
            intensity_change = 0.0
        
        # Determine trend direction
        if emotion_changed:
            trend = "emotion_shifted"
            from_emotion = first_state.primary_emotion.value
            to_emotion = last_state.primary_emotion.value
        elif abs(intensity_change) < 0.1:
            trend = "stable"
            from_emotion = to_emotion = first_state.primary_emotion.value
        elif intensity_change > 0:
            trend = "intensifying"
            from_emotion = to_emotion = first_state.primary_emotion.value
        else:
            trend = "diminishing"
            from_emotion = to_emotion = first_state.primary_emotion.value
        
        return {
            "trend": trend,
            "from_emotion": from_emotion,
            "to_emotion": to_emotion,
            "intensity_change": intensity_change,
            "duration_seconds": (last_state.timestamp - first_state.timestamp).total_seconds()
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert emotional context to dictionary."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "emotional_history": [state.to_dict() for state in self.emotional_history],
            "baseline_emotion": self.baseline_emotion.to_dict() if self.baseline_emotion else None,
            "start_time": self.start_time.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "emotional_trend": self.get_emotional_trend()
        }


class EmotionalIntelligenceEngine:
    """
    Core emotional intelligence engine for ALEJO.
    
    This engine integrates emotion detection, emotional context tracking,
    empathetic response generation, and emotional memory to provide
    comprehensive emotional intelligence capabilities.
    """
    def __init__(
        self,
        relationship_memory: Optional[RelationshipMemory] = None,
        memory_prioritizer: Optional[MemoryPrioritizer] = None,
        reasoning_engine: Optional[ReasoningEngineOrchestrator] = None,
        fusion_engine: Optional[MultimodalFusionEngine] = None,
        event_bus: Optional[EventBus] = None
    ):
        """
        Initialize the emotional intelligence engine.
        
        Args:
            relationship_memory: Relationship memory system
            memory_prioritizer: Memory prioritization system
            reasoning_engine: Reasoning engine for emotional reasoning
            fusion_engine: Multimodal fusion engine for integrated emotion detection
            event_bus: Event bus for publishing events
        """
        self.relationship_memory = relationship_memory
        self.memory_prioritizer = memory_prioritizer
        self.reasoning_engine = reasoning_engine
        self.fusion_engine = fusion_engine
        self.event_bus = event_bus
        
        # Active emotional contexts by session ID
        self.active_contexts: Dict[str, EmotionalContext] = {}
        
        # Emotion detection confidence thresholds
        self.confidence_thresholds = {
            InputModality.TEXT: 0.6,
            InputModality.VOICE: 0.7,
            InputModality.FACIAL: 0.8
        }
        
        # Emotional response adaptation settings
        self.empathy_level = 0.7  # 0.0 to 1.0, higher means more empathetic
        self.emotional_mirroring = 0.5  # 0.0 to 1.0, how much to mirror user emotions
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info("Emotional Intelligence Engine initialized")
    
    async def detect_emotion(
        self,
        input_data: Dict[str, Any],
        modality: InputModality
    ) -> Optional[EmotionalState]:
        """
        Detect emotion from input data of a specific modality.
        
        Args:
            input_data: Input data to analyze
            modality: Input modality (text, voice, facial)
            
        Returns:
            Detected emotional state or None if confidence is too low
        """
        # Different detection methods based on modality
        if modality == InputModality.TEXT:
            return await self._detect_emotion_from_text(input_data)
        elif modality == InputModality.VOICE:
            return await self._detect_emotion_from_voice(input_data)
        elif modality == InputModality.FACIAL:
            return await self._detect_emotion_from_facial(input_data)
        else:
            logger.warning(f"Unsupported modality for emotion detection: {modality}")
            return None
    
    async def _detect_emotion_from_text(self, text_data: Dict[str, Any]) -> Optional[EmotionalState]:
        """
        Detect emotion from text input.
        
        Args:
            text_data: Text input data
            
        Returns:
            Detected emotional state or None if confidence is too low
        """
        text = text_data.get("content", "")
        if not text:
            return None
        
        # Simple keyword-based emotion detection
        # In a production system, this would use a more sophisticated NLP model
        emotion_keywords = {
            EmotionCategory.JOY: ["happy", "joy", "delighted", "pleased", "glad", "excited"],
            EmotionCategory.SADNESS: ["sad", "unhappy", "depressed", "miserable", "down", "upset"],
            EmotionCategory.ANGER: ["angry", "furious", "annoyed", "irritated", "mad"],
            EmotionCategory.FEAR: ["afraid", "scared", "fearful", "terrified", "worried", "anxious"],
            EmotionCategory.SURPRISE: ["surprised", "shocked", "amazed", "astonished"],
            EmotionCategory.DISGUST: ["disgusted", "revolted", "appalled", "repulsed"],
            EmotionCategory.TRUST: ["trust", "believe", "confident", "faith", "sure"],
            EmotionCategory.ANTICIPATION: ["anticipate", "expect", "looking forward", "hope"]
        }
        
        # Count emotion keywords in text
        emotion_counts = {emotion: 0 for emotion in EmotionCategory}
        text_lower = text.lower()
        
        for emotion, keywords in emotion_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    emotion_counts[emotion] += 1
        
        # Find primary emotion
        max_count = max(emotion_counts.values())
        if max_count == 0:
            primary_emotion = EmotionCategory.NEUTRAL
            primary_intensity = 0.5
            confidence = 0.5
        else:
            primary_emotions = [e for e, c in emotion_counts.items() if c == max_count]
            primary_emotion = primary_emotions[0]  # Take first if multiple match
            primary_intensity = min(0.5 + (max_count * 0.1), 1.0)  # Scale intensity by count
            confidence = min(0.5 + (max_count * 0.1), 0.9)  # Simple confidence heuristic
        
        # Get secondary emotions
        secondary_emotions = {
            emotion: count / (max_count * 2) if max_count > 0 else 0
            for emotion, count in emotion_counts.items()
            if emotion != primary_emotion and count > 0
        }
        
        # Check confidence threshold
        if confidence < self.confidence_thresholds[InputModality.TEXT]:
            return None
        
        return EmotionalState(
            primary_emotion=primary_emotion,
            primary_intensity=primary_intensity,
            secondary_emotions=secondary_emotions,
            confidence=confidence,
            source="text_analysis"
        )
    
    async def _detect_emotion_from_voice(self, voice_data: Dict[str, Any]) -> Optional[EmotionalState]:
        """
        Detect emotion from voice input.
        
        Args:
            voice_data: Voice input data
            
        Returns:
            Detected emotional state or None if confidence is too low
        """
        # In a production system, this would use audio feature extraction and ML models
        # For now, we'll use any provided emotion metadata
        
        if "emotion" in voice_data:
            emotion_str = voice_data["emotion"].lower()
            intensity = voice_data.get("intensity", 0.7)
            confidence = voice_data.get("confidence", 0.7)
            
            # Map string to emotion category
            try:
                primary_emotion = next(e for e in EmotionCategory if e.value == emotion_str)
            except StopIteration:
                primary_emotion = EmotionCategory.NEUTRAL
            
            # Check confidence threshold
            if confidence < self.confidence_thresholds[InputModality.VOICE]:
                return None
            
            return EmotionalState(
                primary_emotion=primary_emotion,
                primary_intensity=intensity,
                confidence=confidence,
                source="voice_analysis"
            )
        
        return None
    
    async def _detect_emotion_from_facial(self, facial_data: Dict[str, Any]) -> Optional[EmotionalState]:
        """
        Detect emotion from facial expression input.
        
        Args:
            facial_data: Facial expression input data
            
        Returns:
            Detected emotional state or None if confidence is too low
        """
        # In a production system, this would use computer vision models
        # For now, we'll use any provided emotion metadata
        
        if "expressions" in facial_data and facial_data["expressions"]:
            expressions = facial_data["expressions"]
            
            # Find primary expression
            primary_expr = max(expressions.items(), key=lambda x: x[1])
            primary_emotion_str = primary_expr[0].lower()
            primary_intensity = primary_expr[1]
            
            # Map string to emotion category
            try:
                primary_emotion = next(e for e in EmotionCategory if e.value == primary_emotion_str)
            except StopIteration:
                primary_emotion = EmotionCategory.NEUTRAL
            
            # Get secondary emotions
            secondary_emotions = {
                next(e for e in EmotionCategory if e.value == expr_name): intensity
                for expr_name, intensity in expressions.items()
                if expr_name.lower() != primary_emotion_str and intensity > 0.2
            }
            
            confidence = facial_data.get("confidence", 0.8)
            
            # Check confidence threshold
            if confidence < self.confidence_thresholds[InputModality.FACIAL]:
                return None
            
            return EmotionalState(
                primary_emotion=primary_emotion,
                primary_intensity=primary_intensity,
                secondary_emotions=secondary_emotions,
                confidence=confidence,
                source="facial_analysis"
            )
        
        return None
    
    async def process_multimodal_input(
        self,
        session_id: str,
        text_input: Optional[Dict[str, Any]] = None,
        voice_input: Optional[Dict[str, Any]] = None,
        facial_input: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process multimodal input to detect and track emotional state.
        
        Args:
            session_id: ID of the current session
            text_input: Text input data (optional)
            voice_input: Voice input data (optional)
            facial_input: Facial expression input data (optional)
            user_id: ID of the user (optional)
            
        Returns:
            Dictionary with emotional analysis results
        """
        async with self._lock:
            # Detect emotions from each modality
            emotions = {}
            
            if text_input:
                emotions[InputModality.TEXT] = await self.detect_emotion(text_input, InputModality.TEXT)
            
            if voice_input:
                emotions[InputModality.VOICE] = await self.detect_emotion(voice_input, InputModality.VOICE)
            
            if facial_input:
                emotions[InputModality.FACIAL] = await self.detect_emotion(facial_input, InputModality.FACIAL)
            
            # Fuse emotions from different modalities
            fused_emotion = await self._fuse_emotions(emotions)
            
            if not fused_emotion:
                fused_emotion = EmotionalState(
                    primary_emotion=EmotionCategory.NEUTRAL,
                    primary_intensity=0.5,
                    confidence=0.5,
                    source="default"
                )
            
            # Get or create emotional context
            if session_id not in self.active_contexts:
                self.active_contexts[session_id] = EmotionalContext(
                    session_id=session_id,
                    user_id=user_id
                )
            
            context = self.active_contexts[session_id]
            
            # Add emotional state to context
            context.add_emotional_state(fused_emotion)
            
            # Record in relationship memory if available
            if self.relationship_memory and user_id:
                await self._record_emotional_interaction(user_id, fused_emotion, context)
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="emotion_detected",
                        data={
                            "session_id": session_id,
                            "user_id": user_id,
                            "emotional_state": fused_emotion.to_dict(),
                            "emotional_trend": context.get_emotional_trend()
                        }
                    )
                )
            
            # Return analysis results
            return {
                "emotional_state": fused_emotion.to_dict(),
                "emotional_context": context.to_dict()
            }
    
    async def _fuse_emotions(
        self,
        emotions: Dict[InputModality, Optional[EmotionalState]]
    ) -> Optional[EmotionalState]:
        """
        Fuse emotions detected from different modalities.
        
        Args:
            emotions: Dictionary mapping modalities to detected emotional states
            
        Returns:
            Fused emotional state or None if no valid emotions
        """
        # Filter out None values
        valid_emotions = {m: e for m, e in emotions.items() if e is not None}
        
        if not valid_emotions:
            return None
        
        # If only one modality, return that emotion
        if len(valid_emotions) == 1:
            return next(iter(valid_emotions.values()))
        
        # Assign weights to different modalities
        modality_weights = {
            InputModality.TEXT: 0.3,
            InputModality.VOICE: 0.3,
            InputModality.FACIAL: 0.4
        }
        
        # Adjust weights based on confidence
        weighted_emotions = {}
        total_weight = 0.0
        
        for modality, emotion in valid_emotions.items():
            weight = modality_weights[modality] * emotion.confidence
            weighted_emotions[modality] = (emotion, weight)
            total_weight += weight
        
        if total_weight == 0.0:
            return None
        
        # Normalize weights
        for modality in weighted_emotions:
            emotion, weight = weighted_emotions[modality]
            weighted_emotions[modality] = (emotion, weight / total_weight)
        
        # Count weighted votes for primary emotion
        emotion_votes = {}
        for modality, (emotion, weight) in weighted_emotions.items():
            if emotion.primary_emotion not in emotion_votes:
                emotion_votes[emotion.primary_emotion] = 0.0
            emotion_votes[emotion.primary_emotion] += weight
        
        # Select primary emotion with highest weighted vote
        primary_emotion = max(emotion_votes.items(), key=lambda x: x[1])[0]
        
        # Calculate weighted average intensity for primary emotion
        primary_intensity = 0.0
        primary_weight = 0.0
        
        for modality, (emotion, weight) in weighted_emotions.items():
            if emotion.primary_emotion == primary_emotion:
                primary_intensity += emotion.primary_intensity * weight
                primary_weight += weight
        
        if primary_weight > 0:
            primary_intensity /= primary_weight
        else:
            primary_intensity = 0.5
        
        # Collect secondary emotions from all modalities
        secondary_emotions = {}
        
        for modality, (emotion, weight) in weighted_emotions.items():
            for sec_emotion, sec_intensity in emotion.secondary_emotions.items():
                if sec_emotion != primary_emotion:
                    if sec_emotion not in secondary_emotions:
                        secondary_emotions[sec_emotion] = 0.0
                    secondary_emotions[sec_emotion] += sec_intensity * weight
        
        # Calculate average confidence
        avg_confidence = sum(emotion.confidence * weight for emotion, weight in weighted_emotions.values())
        
        return EmotionalState(
            primary_emotion=primary_emotion,
            primary_intensity=primary_intensity,
            secondary_emotions=secondary_emotions,
            confidence=avg_confidence,
            source="multimodal_fusion"
        )
    
    async def _record_emotional_interaction(
        self,
        user_id: str,
        emotion: EmotionalState,
        context: EmotionalContext
    ) -> None:
        """
        Record emotional interaction in relationship memory.
        
        Args:
            user_id: ID of the user
            emotion: Detected emotional state
            context: Emotional context
        """
        if not self.relationship_memory:
            return
        
        # Determine interaction type based on emotion
        if emotion.primary_emotion in [EmotionCategory.JOY, EmotionCategory.TRUST]:
            interaction_type = InteractionType.EMOTIONAL_EXCHANGE
        elif emotion.primary_emotion in [EmotionCategory.ANGER, EmotionCategory.DISGUST]:
            interaction_type = InteractionType.CONFLICT
        else:
            interaction_type = InteractionType.CONVERSATION
        
        # Create content description
        content = f"User expressed {emotion.primary_emotion.value} with intensity {emotion.primary_intensity:.2f}"
        
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
        
        sentiment = sentiment_map[emotion.primary_emotion] * emotion.primary_intensity
        
        # Record in relationship memory
        await self.relationship_memory.record_interaction(
            entity_id=user_id,
            interaction_type=interaction_type,
            content=content,
            sentiment=sentiment,
            importance=emotion.primary_intensity,
            context={
                "emotional_state": emotion.to_dict(),
                "emotional_trend": context.get_emotional_trend()
            }
        )
    
    async def generate_empathetic_response(
        self,
        session_id: str,
        response_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate empathetic response based on emotional context.
        
        Args:
            session_id: ID of the current session
            response_context: Context for response generation
            
        Returns:
            Dictionary with response adaptation suggestions
        """
        if session_id not in self.active_contexts:
            return {"adaptations": {}}
        
        context = self.active_contexts[session_id]
        current_emotion = context.get_current_emotional_state()
        
        if not current_emotion:
            return {"adaptations": {}}
        
        # Calculate response adaptations based on emotional context
        adaptations = {}
        
        # Tone adaptation based on primary emotion
        if current_emotion.primary_emotion == EmotionCategory.JOY:
            adaptations["tone"] = "upbeat"
        elif current_emotion.primary_emotion == EmotionCategory.SADNESS:
            adaptations["tone"] = "gentle"
        elif current_emotion.primary_emotion == EmotionCategory.ANGER:
            adaptations["tone"] = "calm"
        elif current_emotion.primary_emotion == EmotionCategory.FEAR:
            adaptations["tone"] = "reassuring"
        elif current_emotion.primary_emotion == EmotionCategory.SURPRISE:
            adaptations["tone"] = "explanatory"
        elif current_emotion.primary_emotion == EmotionCategory.DISGUST:
            adaptations["tone"] = "respectful"
        elif current_emotion.primary_emotion == EmotionCategory.TRUST:
            adaptations["tone"] = "confident"
        elif current_emotion.primary_emotion == EmotionCategory.ANTICIPATION:
            adaptations["tone"] = "encouraging"
        else:
            adaptations["tone"] = "neutral"
        
        # Pacing adaptation based on emotional intensity
        if current_emotion.primary_intensity > 0.7:
            adaptations["pacing"] = "measured"
        elif current_emotion.primary_intensity < 0.3:
            adaptations["pacing"] = "energetic"
        else:
            adaptations["pacing"] = "balanced"
        
        # Empathy level adaptation
        adaptations["empathy_level"] = min(self.empathy_level + (current_emotion.primary_intensity * 0.2), 1.0)
        
        # Emotional mirroring suggestion
        if self.emotional_mirroring > 0.3:
            adaptations["mirror_emotion"] = current_emotion.primary_emotion.value
            adaptations["mirror_intensity"] = current_emotion.primary_intensity * self.emotional_mirroring
        
        # Response strategy based on emotional trend
        trend = context.get_emotional_trend()
        if trend["trend"] == "intensifying" and current_emotion.primary_emotion in [EmotionCategory.ANGER, EmotionCategory.FEAR, EmotionCategory.SADNESS]:
            adaptations["strategy"] = "de-escalation"
        elif trend["trend"] == "diminishing" and current_emotion.primary_emotion in [EmotionCategory.JOY, EmotionCategory.TRUST]:
            adaptations["strategy"] = "reinforcement"
        elif trend["trend"] == "emotion_shifted":
            adaptations["strategy"] = "acknowledgment"
        else:
            adaptations["strategy"] = "maintenance"
        
        return {"adaptations": adaptations}
    
    def clean_expired_contexts(self, max_age_minutes: int = 60) -> int:
        """
        Clean expired emotional contexts.
        
        Args:
            max_age_minutes: Maximum age of contexts in minutes
            
        Returns:
            Number of contexts removed
        """
        cutoff_time = datetime.now() - timedelta(minutes=max_age_minutes)
        expired_sessions = [
            session_id for session_id, context in self.active_contexts.items()
            if context.last_updated < cutoff_time
        ]
        
        for session_id in expired_sessions:
            del self.active_contexts[session_id]
        
        return len(expired_sessions)


# Example usage
async def main():
    # Initialize emotional intelligence engine
    engine = EmotionalIntelligenceEngine()
    
    # Process text input
    text_input = {"content": "I'm really excited about this new project!"}
    result = await engine.process_multimodal_input(
        session_id="test_session",
        text_input=text_input,
        user_id="test_user"
    )
    
    print(json.dumps(result, indent=2))
    
    # Generate empathetic response
    response = await engine.generate_empathetic_response(
        session_id="test_session",
        response_context={}
    )
    
    print(json.dumps(response, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
