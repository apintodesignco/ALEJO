"""
Interactive Learning System for ALEJO
Enables continuous learning from user interactions
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
import torch
import torch.nn as nn
from ..emotional_intelligence.adaptive_processor import EmotionalState, InteractionStyle

logger = logging.getLogger("alejo.learning.interactive_learner")

@dataclass
class LearningFeedback:
    """User feedback for learning"""
    timestamp: datetime
    interaction_id: str
    feedback_type: str  # "explicit", "implicit", "behavioral"
    sentiment: float  # -1.0 to 1.0
    content: Dict[str, Any]
    context: Dict[str, Any]

@dataclass
class InteractionPattern:
    """Learned pattern from user interactions"""
    pattern_type: str  # "preference", "behavior", "response"
    features: Dict[str, Any]
    confidence: float
    last_observed: datetime
    observation_count: int

@dataclass
class LearningMetrics:
    """Metrics tracking learning progress"""
    accuracy: float
    adaptation_rate: float
    feedback_incorporation: float
    pattern_recognition: float
    timestamp: datetime

class InteractiveLearner:
    """
    Interactive learning system
    Features:
    - Real-time learning from user feedback
    - Pattern recognition in user interactions
    - Adaptive behavior modification
    - Performance tracking and optimization
    """
    
    def __init__(self):
        """Initialize interactive learner"""
        self.feedback_history: List[LearningFeedback] = []
        self.interaction_patterns: Dict[str, InteractionPattern] = {}
        self.learning_metrics: List[LearningMetrics] = []
        self.current_session: Dict[str, Any] = {
            "start_time": datetime.now(),
            "interactions": 0,
            "feedback_count": 0,
            "patterns_recognized": 0
        }
        
    async def process_feedback(self, feedback: LearningFeedback,
                             emotional_state: Optional[EmotionalState] = None,
                             interaction_style: Optional[InteractionStyle] = None
                             ) -> Dict[str, Any]:
        """
        Process user feedback and update learning
        
        Args:
            feedback: User feedback to process
            emotional_state: Current emotional state if available
            interaction_style: Current interaction style if available
            
        Returns:
            Dictionary of learning updates and adaptations
        """
        try:
            # Store feedback
            self.feedback_history.append(feedback)
            self.current_session["feedback_count"] += 1
            
            # Extract patterns from feedback
            new_patterns = await self._extract_patterns(
                feedback, emotional_state, interaction_style
            )
            
            # Update existing patterns
            updates = await self._update_patterns(new_patterns)
            
            # Calculate learning metrics
            metrics = self._calculate_metrics()
            self.learning_metrics.append(metrics)
            
            return {
                "patterns_found": len(new_patterns),
                "patterns_updated": updates,
                "current_metrics": metrics
            }
            
        except Exception as e:
            logger.error(f"Error processing feedback: {e}")
            raise
            
    async def _extract_patterns(
        self,
        feedback: LearningFeedback,
        emotional_state: Optional[EmotionalState],
        interaction_style: Optional[InteractionStyle]
    ) -> List[InteractionPattern]:
        """Extract interaction patterns from feedback"""
        patterns = []
        
        try:
            # Analyze timing patterns
            if "response_time" in feedback.content:
                patterns.append(InteractionPattern(
                    pattern_type="behavior",
                    features={
                        "type": "response_timing",
                        "average_time": feedback.content["response_time"],
                        "context": feedback.context
                    },
                    confidence=0.7,
                    last_observed=feedback.timestamp,
                    observation_count=1
                ))
            
            # Analyze communication preferences
            if "message_length" in feedback.content:
                patterns.append(InteractionPattern(
                    pattern_type="preference",
                    features={
                        "type": "communication_length",
                        "preferred_length": feedback.content["message_length"],
                        "context": feedback.context
                    },
                    confidence=0.6,
                    last_observed=feedback.timestamp,
                    observation_count=1
                ))
            
            # Analyze emotional response patterns
            if emotional_state:
                patterns.append(InteractionPattern(
                    pattern_type="response",
                    features={
                        "type": "emotional_response",
                        "emotion": emotional_state.primary_emotion,
                        "valence": emotional_state.valence,
                        "context": feedback.context
                    },
                    confidence=emotional_state.confidence,
                    last_observed=feedback.timestamp,
                    observation_count=1
                ))
            
            # Analyze interaction style preferences
            if interaction_style:
                patterns.append(InteractionPattern(
                    pattern_type="preference",
                    features={
                        "type": "interaction_style",
                        "pace": interaction_style.communication_pace,
                        "detail": interaction_style.detail_level,
                        "formality": interaction_style.formality,
                        "context": feedback.context
                    },
                    confidence=0.8,
                    last_observed=feedback.timestamp,
                    observation_count=1
                ))
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error extracting patterns: {e}")
            return []
            
    async def _update_patterns(self, new_patterns: List[InteractionPattern]) -> int:
        """Update existing patterns with new observations"""
        updates = 0
        
        try:
            for pattern in new_patterns:
                pattern_key = f"{pattern.pattern_type}:{pattern.features['type']}"
                
                if pattern_key in self.interaction_patterns:
                    # Update existing pattern
                    existing = self.interaction_patterns[pattern_key]
                    
                    # Update observation count and timestamp
                    existing.observation_count += 1
                    existing.last_observed = pattern.last_observed
                    
                    # Update confidence based on consistency
                    if self._check_pattern_consistency(existing, pattern):
                        existing.confidence = min(
                            existing.confidence + 0.1,
                            1.0
                        )
                    else:
                        existing.confidence *= 0.9
                    
                    # Update features with running averages
                    for key, value in pattern.features.items():
                        if key != "context" and isinstance(value, (int, float)):
                            existing_val = existing.features.get(key, 0)
                            weight = 1.0 / existing.observation_count
                            existing.features[key] = (
                                existing_val * (1 - weight) + value * weight
                            )
                    
                    updates += 1
                    
                else:
                    # Add new pattern
                    self.interaction_patterns[pattern_key] = pattern
                    self.current_session["patterns_recognized"] += 1
            
            return updates
            
        except Exception as e:
            logger.error(f"Error updating patterns: {e}")
            return 0
            
    def _check_pattern_consistency(self, existing: InteractionPattern,
                                 new: InteractionPattern) -> bool:
        """Check if new pattern observation is consistent with existing pattern"""
        try:
            # Compare numerical features
            for key, value in new.features.items():
                if key != "context" and isinstance(value, (int, float)):
                    existing_val = existing.features.get(key, 0)
                    if abs(existing_val - value) > (existing_val * 0.3):  # 30% threshold
                        return False
                        
            # Compare categorical features
            for key, value in new.features.items():
                if key != "context" and isinstance(value, str):
                    existing_val = existing.features.get(key)
                    if existing_val and existing_val != value:
                        return False
                        
            return True
            
        except Exception as e:
            logger.error(f"Error checking pattern consistency: {e}")
            return False
            
    def _calculate_metrics(self) -> LearningMetrics:
        """Calculate current learning metrics"""
        try:
            # Calculate accuracy from recent feedback
            recent_feedback = [f for f in self.feedback_history[-50:]]
            if recent_feedback:
                accuracy = np.mean([f.sentiment for f in recent_feedback])
            else:
                accuracy = 0.0
                
            # Calculate adaptation rate
            pattern_updates = sum(
                p.observation_count for p in self.interaction_patterns.values()
            )
            adaptation_rate = min(
                pattern_updates / max(len(self.feedback_history), 1),
                1.0
            )
            
            # Calculate feedback incorporation
            feedback_ratio = (
                self.current_session["feedback_count"] /
                max(self.current_session["interactions"], 1)
            )
            
            # Calculate pattern recognition rate
            pattern_ratio = (
                self.current_session["patterns_recognized"] /
                max(self.current_session["feedback_count"], 1)
            )
            
            return LearningMetrics(
                accuracy=accuracy,
                adaptation_rate=adaptation_rate,
                feedback_incorporation=feedback_ratio,
                pattern_recognition=pattern_ratio,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            return LearningMetrics(0.0, 0.0, 0.0, 0.0, datetime.now())
            
    def get_learning_summary(self) -> Dict[str, Any]:
        """Get summary of current learning state"""
        try:
            return {
                "total_patterns": len(self.interaction_patterns),
                "total_feedback": len(self.feedback_history),
                "session_duration": (
                    datetime.now() - self.current_session["start_time"]
                ).total_seconds(),
                "latest_metrics": self.learning_metrics[-1] if self.learning_metrics else None,
                "top_patterns": sorted(
                    self.interaction_patterns.values(),
                    key=lambda p: p.confidence,
                    reverse=True
                )[:5]
            }
            
        except Exception as e:
            logger.error(f"Error getting learning summary: {e}")
            return {}
