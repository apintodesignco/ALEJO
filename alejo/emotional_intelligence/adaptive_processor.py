"""
Advanced Emotional Intelligence Processing for ALEJO
Handles dynamic emotional state tracking and adaptive interaction
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from datetime import datetime, timedelta

from .memory import EmotionalMemoryService
from .emotional_core import EmotionalDimension, EmotionalState
from ..core.event_bus import EventBus, Event, EventType
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..cognitive.learning_orchestrator import LearningOrchestrator

logger = logging.getLogger("alejo.emotional_intelligence.adaptive_processor")

@dataclass
class EmotionalInteraction:
    """Record of an emotional interaction"""
    timestamp: datetime
    emotion: str
    intensity: float
    context: Dict[str, Any]
    response: str
    feedback: Optional[str] = None

@dataclass
class PersonalityTrait:
    """Dynamic personality trait that adapts to user interactions"""
    name: str  # e.g., "openness", "empathy", "humor"
    value: float  # 0.0 to 1.0
    confidence: float
    last_updated: datetime

@dataclass
class InteractionStyle:
    """User's preferred interaction style"""
    communication_pace: str  # "fast", "moderate", "slow"
    detail_level: str  # "brief", "balanced", "detailed"
    formality: str  # "casual", "balanced", "formal"
    humor_preference: str  # "none", "subtle", "frequent"
    emotional_support: str  # "minimal", "balanced", "high"
    neurodivergent_adaptations: Dict[str, bool]  # Specific adaptations needed

@dataclass
class EmotionalState:
    """Current emotional state with context"""
    primary_emotion: str
    secondary_emotion: Optional[str]
    valence: float  # -1.0 to 1.0
    arousal: float  # 0.0 to 1.0
    confidence: float
    context: Dict[str, Any]
    timestamp: datetime

class AdaptiveEmotionalProcessor:
    """
    Advanced emotional intelligence processing
    Features:
    - Dynamic personality adaptation
    - Emotional memory and learning
    - Context-aware response generation
    - Neurodivergent interaction support
    """
    
    def __init__(self, memory_service: EmotionalMemoryService, event_bus: EventBus,
                 learning_orchestrator: 'LearningOrchestrator', emotional_core=None):
        """Initialize adaptive emotional processor
        
        Args:
            memory_service: Service for persistent emotional memory storage
            event_bus: Event bus for emotional state updates
            learning_orchestrator: Orchestrator for learning and adaptation
            emotional_core: Optional EmotionalCore instance for proactive dialogue
        """
        self.memory_service = memory_service
        self.event_bus = event_bus
        self.learning_orchestrator = learning_orchestrator
        self.emotional_core = emotional_core
        
        self.personality_traits: Dict[str, PersonalityTrait] = {
            "openness": PersonalityTrait("openness", 0.7, 0.8, datetime.now()),
            "empathy": PersonalityTrait("empathy", 0.8, 0.8, datetime.now()),
            "humor": PersonalityTrait("humor", 0.5, 0.7, datetime.now()),
            "patience": PersonalityTrait("patience", 0.9, 0.9, datetime.now()),
            "adaptability": PersonalityTrait("adaptability", 0.8, 0.8, datetime.now()),
            "curiosity": PersonalityTrait("curiosity", 0.7, 0.8, datetime.now())
        }
        self.current_state: Optional[EmotionalState] = None
        self.user_style: Optional[InteractionStyle] = None
        self.memory_window = timedelta(hours=24)  # How far back to consider memories
        self._last_interaction = datetime.now()
        self._interaction_threshold = timedelta(minutes=2)  # Time before considering proactive interaction
        
    async def should_be_proactive(self, context: Dict[str, Any]) -> bool:
        """Determine if a proactive question would be appropriate
        
        Args:
            context: Current conversation context and emotional state
            
        Returns:
            True if a proactive question would be appropriate
        """
        # Check if enough time has passed since last interaction
        if datetime.now() - self._last_interaction < self._interaction_threshold:
            return False
            
        # Check personality traits
        curiosity = self.personality_traits["curiosity"].value
        empathy = self.personality_traits["empathy"].value
        
        # More likely to be proactive with high curiosity and empathy
        proactivity_score = (curiosity + empathy) / 2.0
        
        # Consider user's emotional state
        if self.current_state:
            # More likely to be proactive if user shows strong emotions
            if abs(self.current_state.valence) > 0.6:
                proactivity_score += 0.2
                
            # Less likely to interrupt if user seems focused/busy
            if self.current_state.arousal > 0.8:
                proactivity_score -= 0.3
        
        # Consider user's interaction style
        if self.user_style:
            if self.user_style.emotional_support == "high":
                proactivity_score += 0.2
            elif self.user_style.emotional_support == "minimal":
                proactivity_score -= 0.2
        
        return proactivity_score > 0.6
    
    async def get_proactive_question(self, context: Dict[str, Any]) -> Optional[str]:
        """Get a proactive question if appropriate
        
        Args:
            context: Current conversation context and emotional state
            
        Returns:
            A proactive question or None if not appropriate
        """
        if not self.emotional_core:
            return None
            
        if not await self.should_be_proactive(context):
            return None
            
        question = await self.emotional_core.generate_proactive_question(context)
        if question:
            self._last_interaction = datetime.now()
        
        return question
    
    async def process_question_response(self, response: str, context: Dict[str, Any]):
        """Process user's response to a proactive question
        
        Args:
            response: User's response text
            context: Current conversation context
        """
        # Update emotional memory with response
        await self.memory_service.store_interaction(
            interaction_type="proactive_dialogue",
            content=response,
            context=context
        )
        
        # Analyze response sentiment and update traits
        sentiment = await self.analyze_sentiment(response)
        if sentiment > 0.3:  # Positive response
            await self._adjust_trait("curiosity", 0.1)
            await self._adjust_trait("empathy", 0.05)
        elif sentiment < -0.3:  # Negative response
            await self._adjust_trait("curiosity", -0.05)
        
        # Trigger learning if needed
        await self.learning_orchestrator.learn_from_interaction(
            "proactive_dialogue",
            {
                "response": response,
                "sentiment": sentiment,
                "context": context
            }
        )
    
    async def process_emotion(self, emotion: str, intensity: float,
                            context: Dict[str, Any]) -> EmotionalState:
        """
        Process a detected emotion and update emotional state
        
        Args:
            emotion: Detected emotion
            intensity: Emotion intensity (0.0 to 1.0)
            context: Contextual information about the emotion
            
        Returns:
            Updated emotional state
        """
        try:
            # Map emotion to valence-arousal space
            valence, arousal = self._map_emotion_to_va(emotion, intensity)
            
            # Create new emotional state
            new_state = EmotionalState(
                primary_emotion=emotion,
                secondary_emotion=self._detect_secondary_emotion(context),
                valence=valence,
                arousal=arousal,
                confidence=self._calculate_confidence(context),
                context=context,
                timestamp=datetime.now()
            )
            
            # Store interaction in persistent memory
            response = self._generate_response(new_state)
            await self.memory_service.store_interaction(
                emotion=emotion,
                intensity=intensity,
                dimensions={
                    EmotionalDimension.VALENCE: new_state.valence,
                    EmotionalDimension.AROUSAL: new_state.arousal,
                    EmotionalDimension.CONFIDENCE: new_state.confidence
                },
                context=context,
                response=response
            )
            
            # Emit emotional state update event
            await self.event_bus.emit(Event(
                type=EventType.EMOTIONAL_STATE_UPDATE,
                data={
                    "state": new_state,
                    "response": response,
                    "personality": self.personality_traits
                }
            ))
            
            # Update personality traits based on interaction
            self._update_personality(new_state)
            
            self.current_state = new_state
            return new_state
            
        except Exception as e:
            logger.error(f"Error processing emotion: {e}")
            raise
            
    async def adapt_interaction_style(self, feedback: Dict[str, Any]) -> InteractionStyle:
        """
        Adapt interaction style based on user feedback and behavior
        
        Args:
            feedback: User feedback and behavioral indicators
            
        Returns:
            Updated interaction style
        """
        try:
            # Initialize style if not exists
            if not self.user_style:
                self.user_style = InteractionStyle(
                    communication_pace="moderate",
                    detail_level="balanced",
                    formality="balanced",
                    humor_preference="subtle",
                    emotional_support="balanced",
                    neurodivergent_adaptations={
                        "clear_communication": True,
                        "sensory_considerations": False,
                        "routine_preference": False,
                        "literal_interpretation": False
                    }
                )
            
            # Analyze response times
            if "response_times" in feedback:
                avg_response_time = np.mean(feedback["response_times"])
                if avg_response_time < 2.0:
                    self.user_style.communication_pace = "fast"
                elif avg_response_time > 5.0:
                    self.user_style.communication_pace = "slow"
                    
            # Analyze message length preference
            if "message_lengths" in feedback:
                avg_length = np.mean(feedback["message_lengths"])
                if avg_length < 50:
                    self.user_style.detail_level = "brief"
                elif avg_length > 200:
                    self.user_style.detail_level = "detailed"
                    
            # Update neurodivergent adaptations
            if "interaction_patterns" in feedback:
                patterns = feedback["interaction_patterns"]
                self.user_style.neurodivergent_adaptations.update({
                    "clear_communication": patterns.get("needs_clarity", True),
                    "sensory_considerations": patterns.get("sensory_sensitivity", False),
                    "routine_preference": patterns.get("prefers_routine", False),
                    "literal_interpretation": patterns.get("literal_communication", False)
                })
                
            # Adjust emotional support level
            if "emotional_responses" in feedback:
                responses = feedback["emotional_responses"]
                if responses.get("seeks_support", 0) > 0.7:
                    self.user_style.emotional_support = "high"
                elif responses.get("seeks_support", 0) < 0.3:
                    self.user_style.emotional_support = "minimal"
                    
            return self.user_style
            
        except Exception as e:
            logger.error(f"Error adapting interaction style: {e}")
            raise
            
    def _map_emotion_to_va(self, emotion: str, intensity: float) -> Tuple[float, float]:
        """Map emotion to valence-arousal space"""
        # Basic emotion to V-A mapping
        emotion_va = {
            "joy": (0.8, 0.6),
            "sadness": (-0.8, -0.4),
            "anger": (-0.6, 0.8),
            "fear": (-0.7, 0.7),
            "surprise": (0.4, 0.8),
            "disgust": (-0.6, 0.2),
            "neutral": (0.0, 0.0)
        }
        
        base_v, base_a = emotion_va.get(emotion.lower(), (0.0, 0.0))
        return base_v * intensity, base_a * intensity
        
    def _detect_secondary_emotion(self, context: Dict[str, Any]) -> Optional[str]:
        """Detect potential secondary emotion from context"""
        # TODO: Implement more sophisticated secondary emotion detection
        return None
        
    def _calculate_confidence(self, context: Dict[str, Any]) -> float:
        """Calculate confidence in emotional assessment"""
        # Start with base confidence
        confidence = 0.7
        
        # Adjust based on context
        if "facial_confidence" in context:
            confidence *= context["facial_confidence"]
            
        if "voice_confidence" in context:
            confidence *= context["voice_confidence"]
            
        if "consistent_history" in context and context["consistent_history"]:
            confidence *= 1.2
            
        return min(confidence, 1.0)
        
    def _generate_response(self, state: EmotionalState) -> str:
        """Generate appropriate emotional response"""
        # TODO: Implement more sophisticated response generation
        return "empathetic_acknowledgment"
        
    async def _get_recent_interactions(self) -> List[EmotionalInteraction]:
        """Get recent emotional interactions from persistent memory"""
        cutoff = datetime.now() - self.memory_window
        summary = await self.memory_service.get_emotional_summary(
            start_time=cutoff,
            end_time=datetime.now()
        )
        
        return [EmotionalInteraction(
            timestamp=datetime.fromisoformat(interaction["timestamp"]),
            emotion=interaction["emotion"],
            intensity=interaction["intensity"],
            context=interaction["context"],
            response=interaction["response"],
            feedback=interaction.get("feedback")
        ) for interaction in summary["interactions"]]
        
    def _update_personality(self, state: EmotionalState):
        """Update personality traits based on interaction"""
        # Update empathy based on emotional state
        if state.valence < -0.5:  # Strong negative emotion
            self.personality_traits["empathy"].value = min(
                self.personality_traits["empathy"].value + 0.1,
                1.0
            )
            
        # Update adaptability based on context changes
        context_shift = state.context.get("context_shift", 0.0)
        self.personality_traits["adaptability"].value = min(
            self.personality_traits["adaptability"].value + (context_shift * 0.1),
            1.0
        )
        
        # Update timestamps
        now = datetime.now()
        for trait in self.personality_traits.values():
            trait.last_updated = now
