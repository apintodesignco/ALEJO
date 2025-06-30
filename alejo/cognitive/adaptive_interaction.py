"""
Adaptive Interaction Module for ALEJO

This module enables ALEJO to adapt its communication style based on:
1. User's cognitive state and potential neurodivergence
2. Emotional state and mood
3. Current context and situation
4. Past interactions and learned preferences
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import numpy as np

from ..core.event_bus import EventBus, Event, EventType
from ..cognitive.memory.working_memory import WorkingMemory
from ..cognitive.memory.episodic_memory import EpisodicMemory
from ..models.memory_models import EmotionalState

logger = logging.getLogger(__name__)

@dataclass
class CognitiveProfile:
    """Represents a user's cognitive characteristics and preferences"""
    attention_span: float = 1.0  # 0.0 to 1.0
    processing_speed: float = 1.0  # 0.0 to 1.0
    abstraction_level: float = 1.0  # Concrete (0.0) to Abstract (1.0)
    learning_style: str = "visual"  # visual, auditory, kinesthetic
    communication_preferences: Dict[str, float] = None  # Preferred modes
    neurodivergent_traits: Dict[str, float] = None  # Observed traits
    confidence: float = 0.5  # How confident we are in this profile
    
    def __post_init__(self):
        if self.communication_preferences is None:
            self.communication_preferences = {
                "visual": 0.33,
                "auditory": 0.33,
                "text": 0.34
            }
        if self.neurodivergent_traits is None:
            self.neurodivergent_traits = {}

@dataclass
class InteractionStyle:
    """Defines how ALEJO should communicate"""
    complexity_level: float = 0.5  # 0.0 (simple) to 1.0 (complex)
    pace: float = 0.5  # 0.0 (slow) to 1.0 (fast)
    detail_level: float = 0.5  # 0.0 (minimal) to 1.0 (comprehensive)
    tone: str = "neutral"  # friendly, formal, supportive, etc.
    modality: str = "multimodal"  # text, speech, visual, multimodal
    structure: str = "sequential"  # sequential, hierarchical, networked
    repetition: bool = False  # Whether to repeat key points
    verification: bool = True  # Whether to verify understanding

class AdaptiveInteractionEngine:
    """
    Manages ALEJO's adaptive interaction capabilities.
    Analyzes user state and adjusts communication accordingly.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        working_memory: WorkingMemory,
        episodic_memory: EpisodicMemory,
        config: Optional[Dict[str, Any]] = None
    ):
        self.event_bus = event_bus
        self.working_memory = working_memory
        self.episodic_memory = episodic_memory
        self.config = config or {}
        
        self.current_profile: Optional[CognitiveProfile] = None
        self.interaction_history: List[Dict[str, Any]] = []
        
        # Subscribe to relevant events
        self.event_bus.subscribe(EventType.USER_INTERACTION, self._handle_interaction)
        self.event_bus.subscribe(EventType.EMOTIONAL_UPDATE, self._handle_emotional_update)
    
    async def analyze_user_state(self) -> Dict[str, Any]:
        """
        Analyze current user state using multiple inputs:
        - Emotional state from facial/voice analysis
        - Interaction patterns from recent history
        - Cognitive indicators from response patterns
        - Environmental context from scene analysis
        """
        try:
            # Get recent interactions
            recent = await self._get_recent_interactions()
            
            # Get emotional state
            emotional_state = await self._get_emotional_state()
            
            # Analyze cognitive indicators
            cognitive_indicators = await self._analyze_cognitive_indicators(recent)
            
            # Get environmental context
            context = await self._get_environmental_context()
            
            # Combine analyses
            state = {
                "emotional_state": emotional_state,
                "cognitive_indicators": cognitive_indicators,
                "context": context,
                "interaction_patterns": self._analyze_interaction_patterns(recent)
            }
            
            return state
            
        except Exception as e:
            logger.error(f"Error analyzing user state: {str(e)}")
            return {}
    
    async def update_cognitive_profile(self, state: Dict[str, Any]):
        """Update the user's cognitive profile based on new observations"""
        try:
            if not self.current_profile:
                self.current_profile = CognitiveProfile()
            
            # Update attention span based on interaction patterns
            if "interaction_patterns" in state:
                patterns = state["interaction_patterns"]
                self.current_profile.attention_span = self._calculate_attention_span(
                    patterns
                )
            
            # Update processing speed based on response times
            if "cognitive_indicators" in state:
                indicators = state["cognitive_indicators"]
                self.current_profile.processing_speed = self._calculate_processing_speed(
                    indicators
                )
            
            # Update learning style preferences
            if "interaction_success" in state:
                self._update_learning_preferences(state["interaction_success"])
            
            # Detect and update neurodivergent traits
            await self._update_neurodivergent_traits(state)
            
            # Store updated profile in working memory
            await self.working_memory.store_memory({
                "type": "cognitive_profile",
                "content": self.current_profile,
                "timestamp": datetime.now().timestamp()
            })
            
        except Exception as e:
            logger.error(f"Error updating cognitive profile: {str(e)}")
    
    def get_interaction_style(
        self,
        state: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> InteractionStyle:
        """
        Determine the appropriate interaction style based on:
        - Current user state
        - Cognitive profile
        - Context
        - Past successful interactions
        """
        try:
            style = InteractionStyle()
            
            # Adjust based on cognitive profile
            if self.current_profile:
                style.complexity_level = self.current_profile.abstraction_level
                style.pace = self.current_profile.processing_speed
                
                # Set primary modality based on learning style
                style.modality = self.current_profile.learning_style
                
                # Add repetition for lower processing speeds
                style.repetition = self.current_profile.processing_speed < 0.7
            
            # Adjust based on current state
            if "emotional_state" in state:
                emotional = state["emotional_state"]
                if emotional.get("valence", 0) < 0:
                    style.tone = "supportive"
                    style.pace *= 0.8  # Slow down when user is distressed
            
            # Adjust based on context
            if context and context.get("urgency") == "high":
                style.detail_level = min(0.6, style.detail_level)  # Be more concise
            
            return style
            
        except Exception as e:
            logger.error(f"Error determining interaction style: {str(e)}")
            return InteractionStyle()
    
    async def adapt_response(
        self,
        response: str,
        style: InteractionStyle
    ) -> Dict[str, Any]:
        """
        Adapt a response according to the determined interaction style
        Returns a dict with the adapted response and any additional modalities
        """
        try:
            adapted = {
                "text": response,
                "modalities": {}
            }
            
            # Adjust complexity
            if style.complexity_level < 0.3:
                adapted["text"] = await self._simplify_text(response)
            
            # Add visual aids if appropriate
            if style.modality in ["visual", "multimodal"]:
                adapted["modalities"]["visual"] = await self._generate_visual_aids(
                    response
                )
            
            # Add speech if appropriate
            if style.modality in ["auditory", "multimodal"]:
                adapted["modalities"]["speech"] = {
                    "text": response,
                    "speed": style.pace,
                    "tone": style.tone
                }
            
            # Add verification prompts if needed
            if style.verification:
                adapted["verification"] = self._generate_verification_prompts(
                    response
                )
            
            return adapted
            
        except Exception as e:
            logger.error(f"Error adapting response: {str(e)}")
            return {"text": response}
    
    async def _get_recent_interactions(self) -> List[Dict[str, Any]]:
        """Retrieve recent interaction history"""
        # TODO: Implement interaction history retrieval
        return []
    
    async def _get_emotional_state(self) -> EmotionalState:
        """Get current emotional state from working memory"""
        # TODO: Implement emotional state retrieval
        return EmotionalState()
    
    async def _analyze_cognitive_indicators(
        self,
        interactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze cognitive patterns from interactions"""
        # TODO: Implement cognitive pattern analysis
        return {}
    
    async def _get_environmental_context(self) -> Dict[str, Any]:
        """Get current environmental context"""
        # TODO: Implement context retrieval
        return {}
    
    def _analyze_interaction_patterns(
        self,
        interactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze patterns in recent interactions"""
        # TODO: Implement interaction pattern analysis
        return {}
    
    def _calculate_attention_span(
        self,
        patterns: Dict[str, Any]
    ) -> float:
        """Calculate attention span metric"""
        # TODO: Implement attention span calculation
        return 1.0
    
    def _calculate_processing_speed(
        self,
        indicators: Dict[str, Any]
    ) -> float:
        """Calculate processing speed metric"""
        # TODO: Implement processing speed calculation
        return 1.0
    
    def _update_learning_preferences(
        self,
        success_metrics: Dict[str, float]
    ):
        """Update learning style preferences based on interaction success"""
        # TODO: Implement learning preference updates
        pass
    
    async def _update_neurodivergent_traits(
        self,
        state: Dict[str, Any]
    ):
        """Update observed neurodivergent traits"""
        # TODO: Implement neurodivergent trait detection
        pass
    
    async def _simplify_text(self, text: str) -> str:
        """Simplify text while maintaining core meaning"""
        # TODO: Implement text simplification
        return text
    
    async def _generate_visual_aids(
        self,
        text: str
    ) -> List[Dict[str, Any]]:
        """Generate appropriate visual aids for the content"""
        # TODO: Implement visual aid generation
        return []
    
    def _generate_verification_prompts(
        self,
        text: str
    ) -> List[str]:
        """Generate verification questions to ensure understanding"""
        # TODO: Implement verification prompt generation
        return []
    
    async def _handle_interaction(self, event: Event):
        """Handle user interaction events"""
        if "interaction" in event.data:
            self.interaction_history.append({
                "timestamp": datetime.now().timestamp(),
                "data": event.data
            })
            
            # Update state and profile
            state = await self.analyze_user_state()
            await self.update_cognitive_profile(state)
    
    async def _handle_emotional_update(self, event: Event):
        """Handle emotional state update events"""
        if "emotional_state" in event.data:
            # Update profile based on emotional indicators
            state = {"emotional_state": event.data["emotional_state"]}
            await self.update_cognitive_profile(state)
