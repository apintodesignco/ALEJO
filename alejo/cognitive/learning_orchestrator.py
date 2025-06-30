"""
Learning and Emotional Intelligence Orchestrator for ALEJO
Coordinates learning and emotional adaptation across systems
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..emotional_intelligence.adaptive_processor import AdaptiveEmotionalProcessor

from ..emotional_intelligence import AdaptiveEmotionalProcessor, EmotionalMemoryService
from ..emotional_intelligence.adaptive_processor import (
    EmotionalState,
    InteractionStyle
)
from ..learning.interactive_learner import (
    InteractiveLearner,
    LearningFeedback,
    InteractionPattern,
    LearningMetrics
)
from ..core.event_bus import EventBus, Event, EventType

logger = logging.getLogger("alejo.cognitive.learning_orchestrator")

@dataclass
class AdaptiveResponse:
    """Combined adaptive response from learning and emotional systems"""
    emotional_state: EmotionalState
    interaction_style: InteractionStyle
    learning_metrics: LearningMetrics
    adaptations: Dict[str, Any]
    confidence: float
    timestamp: datetime

class LearningOrchestrator:
    """
    Orchestrates learning and emotional adaptation
    Features:
    - Coordinates emotional and interactive learning
    - Manages feedback distribution
    - Tracks adaptation progress
    - Provides unified interface for brain
    """
    
    def __init__(self, event_bus: EventBus, memory_service: EmotionalMemoryService):
        """Initialize learning orchestrator"""
        self.event_bus = event_bus
        self.memory_service = memory_service
        self.emotional_processor = AdaptiveEmotionalProcessor(
            memory_service=self.memory_service,
            event_bus=self.event_bus,
            learning_orchestrator=self
        )
        self.interactive_learner = InteractiveLearner()
        self.adaptation_history: List[AdaptiveResponse] = []
        
    async def process_interaction(
        self,
        interaction_data: Dict[str, Any]
    ) -> AdaptiveResponse:
        """
        Process an interaction through both emotional and learning systems
        
        Args:
            interaction_data: Data about the interaction including:
                - detected_emotion: str
                - emotion_intensity: float
                - interaction_context: dict
                - user_feedback: dict
                
        Returns:
            Combined adaptive response
        """
        try:
            # Process emotional state
            emotional_state = await self.emotional_processor.process_emotion(
                emotion=interaction_data.get("detected_emotion", "neutral"),
                intensity=interaction_data.get("emotion_intensity", 0.5),
                context=interaction_data.get("interaction_context", {})
            )
            
            # Create learning feedback
            feedback = LearningFeedback(
                timestamp=datetime.now(),
                interaction_id=interaction_data.get("interaction_id", ""),
                feedback_type="implicit",
                sentiment=emotional_state.valence,
                content=interaction_data.get("user_feedback", {}),
                context=interaction_data.get("interaction_context", {})
            )
            
            # Process through interactive learner
            learning_updates = await self.interactive_learner.process_feedback(
                feedback,
                emotional_state=emotional_state,
                interaction_style=self.emotional_processor.user_style
            )
            
            # Adapt interaction style
            interaction_style = await self.emotional_processor.adapt_interaction_style(
                feedback=interaction_data.get("user_feedback", {})
            )
            
            # Create adaptive response
            response = AdaptiveResponse(
                emotional_state=emotional_state,
                interaction_style=interaction_style,
                learning_metrics=learning_updates["current_metrics"],
                adaptations={
                    "patterns_found": learning_updates["patterns_found"],
                    "patterns_updated": learning_updates["patterns_updated"],
                    "style_changes": self._get_style_changes(interaction_style)
                },
                confidence=emotional_state.confidence,
                timestamp=datetime.now()
            )
            
            # Store response
            self.adaptation_history.append(response)
            
            # Emit event if bus available
            if self.event_bus:
                await self.event_bus.emit(Event(
                    type=EventType.ADAPTATION_UPDATED,
                    data={
                        "response": response,
                        "timestamp": response.timestamp
                    }
                ))
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing interaction: {e}")
            raise
            
    async def process_explicit_feedback(
        self,
        feedback_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process explicit user feedback
        
        Args:
            feedback_data: Explicit feedback including:
                - feedback_type: str
                - content: dict
                - context: dict
                
        Returns:
            Dictionary of updates and adaptations
        """
        try:
            # Create feedback object
            feedback = LearningFeedback(
                timestamp=datetime.now(),
                interaction_id=feedback_data.get("interaction_id", ""),
                feedback_type="explicit",
                sentiment=feedback_data.get("sentiment", 0.0),
                content=feedback_data.get("content", {}),
                context=feedback_data.get("context", {})
            )
            
            # Process through interactive learner
            learning_updates = await self.interactive_learner.process_feedback(
                feedback
            )
            
            # Update interaction style
            interaction_style = await self.emotional_processor.adapt_interaction_style(
                feedback=feedback_data.get("content", {})
            )
            
            return {
                "learning_updates": learning_updates,
                "style_updates": self._get_style_changes(interaction_style)
            }
            
        except Exception as e:
            logger.error(f"Error processing explicit feedback: {e}")
            raise
            
    def get_adaptation_status(self) -> Dict[str, Any]:
        """Get current status of adaptation and learning"""
        try:
            # Get learning summary
            learning_summary = self.interactive_learner.get_learning_summary()
            
            # Get recent emotional states
            recent_emotions = [
                resp.emotional_state for resp in self.adaptation_history[-10:]
            ]
            
            # Calculate adaptation metrics
            adaptation_confidence = np.mean([
                resp.confidence for resp in self.adaptation_history[-10:]
            ]) if self.adaptation_history else 0.0
            
            return {
                "learning_summary": learning_summary,
                "recent_emotions": recent_emotions,
                "adaptation_confidence": adaptation_confidence,
                "current_style": self.emotional_processor.user_style,
                "personality_traits": self.emotional_processor.personality_traits
            }
            
        except Exception as e:
            logger.error(f"Error getting adaptation status: {e}")
            return {}
            
    def _get_style_changes(
        self,
        new_style: InteractionStyle
    ) -> Dict[str, Tuple[str, str]]:
        """Get changes in interaction style"""
        changes = {}
        
        if not hasattr(self, '_last_style'):
            self._last_style = new_style
            return changes
            
        # Compare attributes
        for attr in [
            "communication_pace",
            "detail_level",
            "formality",
            "humor_preference",
            "emotional_support"
        ]:
            old_val = getattr(self._last_style, attr)
            new_val = getattr(new_style, attr)
            if old_val != new_val:
                changes[attr] = (old_val, new_val)
                
        # Compare neurodivergent adaptations
        for key in new_style.neurodivergent_adaptations:
            old_val = self._last_style.neurodivergent_adaptations.get(key)
            new_val = new_style.neurodivergent_adaptations[key]
            if old_val != new_val:
                changes[f"adaptation_{key}"] = (str(old_val), str(new_val))
                
        self._last_style = new_style
        return changes
