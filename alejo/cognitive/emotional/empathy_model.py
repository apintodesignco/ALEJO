"""
ALEJO Empathy Model

This module implements ALEJO's empathy capabilities, enabling it to understand
and respond appropriately to user emotions. It works with the Emotional Intelligence
Engine to provide empathetic responses based on detected emotional states.
"""

import logging
import json
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional, Union

from alejo.cognitive.emotional.emotional_intelligence import EmotionalState, EmotionCategory
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class EmpathyLevel(Enum):
    """Levels of empathy that can be expressed in responses."""
    MINIMAL = "minimal"      # Basic acknowledgment of emotions
    MODERATE = "moderate"    # Clear recognition and validation of emotions
    HIGH = "high"            # Deep understanding and mirroring of emotions
    ADAPTIVE = "adaptive"    # Dynamically adjusted based on user preferences


class ResponseStrategy(Enum):
    """Strategies for responding to different emotional states."""
    ACKNOWLEDGE = "acknowledge"      # Simply acknowledge the emotion
    VALIDATE = "validate"            # Validate the emotion as reasonable
    SUPPORT = "support"              # Offer support and understanding
    REDIRECT = "redirect"            # Gently redirect to more positive emotions
    MIRROR = "mirror"                # Mirror the emotion to show understanding
    NEUTRALIZE = "neutralize"        # Respond neutrally to avoid escalation


class EmpathyModel:
    """
    Empathy model for generating empathetic responses based on emotional states.
    
    This model provides strategies and templates for responding to different
    emotional states with appropriate levels of empathy, while respecting
    user preferences and conversation context.
    """
    
    def __init__(self, default_empathy_level: EmpathyLevel = EmpathyLevel.MODERATE):
        """
        Initialize the empathy model.
        
        Args:
            default_empathy_level: Default level of empathy to express
        """
        self.default_empathy_level = default_empathy_level
        
        # User-specific empathy preferences
        self.user_preferences = {}
        
        # Response strategy mapping for different emotions
        self.default_strategies = {
            EmotionCategory.JOY: ResponseStrategy.MIRROR,
            EmotionCategory.SADNESS: ResponseStrategy.VALIDATE,
            EmotionCategory.ANGER: ResponseStrategy.ACKNOWLEDGE,
            EmotionCategory.FEAR: ResponseStrategy.SUPPORT,
            EmotionCategory.SURPRISE: ResponseStrategy.ACKNOWLEDGE,
            EmotionCategory.DISGUST: ResponseStrategy.NEUTRALIZE,
            EmotionCategory.TRUST: ResponseStrategy.MIRROR,
            EmotionCategory.ANTICIPATION: ResponseStrategy.SUPPORT,
            EmotionCategory.NEUTRAL: ResponseStrategy.MIRROR
        }
        
        logger.info("Empathy model initialized with default level: %s", default_empathy_level.value)
    
    def set_user_preference(self, user_id: str, empathy_level: EmpathyLevel) -> None:
        """
        Set empathy preference for a specific user.
        
        Args:
            user_id: ID of the user
            empathy_level: Preferred level of empathy
        """
        self.user_preferences[user_id] = empathy_level
        logger.info("Set empathy preference for user %s to %s", user_id, empathy_level.value)
    
    def get_empathy_level(self, user_id: Optional[str] = None) -> EmpathyLevel:
        """
        Get appropriate empathy level based on user preferences.
        
        Args:
            user_id: ID of the user (optional)
            
        Returns:
            Appropriate empathy level
        """
        if user_id and user_id in self.user_preferences:
            return self.user_preferences[user_id]
        return self.default_empathy_level
    
    @handle_exceptions("Failed to determine response strategy")
    def determine_response_strategy(
        self,
        emotional_state: EmotionalState,
        context: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> ResponseStrategy:
        """
        Determine appropriate response strategy based on emotional state and context.
        
        Args:
            emotional_state: Detected emotional state
            context: Conversation context
            user_id: ID of the user (optional)
            
        Returns:
            Appropriate response strategy
        """
        # Get base strategy for primary emotion
        strategy = self.default_strategies.get(
            emotional_state.primary_emotion,
            ResponseStrategy.ACKNOWLEDGE
        )
        
        # Adjust strategy based on emotional intensity
        if emotional_state.primary_intensity > 0.8:
            # For very intense emotions, provide more support
            if emotional_state.primary_emotion in [EmotionCategory.SADNESS, EmotionCategory.FEAR]:
                strategy = ResponseStrategy.SUPPORT
            elif emotional_state.primary_emotion == EmotionCategory.ANGER:
                strategy = ResponseStrategy.VALIDATE
        
        # Adjust strategy based on conversation history
        if "conversation_history" in context:
            # If the same emotion persists for multiple turns, consider redirecting
            if len(context["conversation_history"]) >= 3:
                persistent_emotion = True
                for i in range(min(3, len(context["conversation_history"]))):
                    if "emotional_state" not in context["conversation_history"][i]:
                        persistent_emotion = False
                        break
                    
                    prev_emotion = context["conversation_history"][i]["emotional_state"]
                    if prev_emotion["primary_emotion"] != emotional_state.primary_emotion.value:
                        persistent_emotion = False
                        break
                
                if persistent_emotion and emotional_state.primary_emotion in [
                    EmotionCategory.SADNESS, EmotionCategory.ANGER, EmotionCategory.FEAR
                ]:
                    strategy = ResponseStrategy.REDIRECT
        
        # Adjust strategy based on empathy level
        empathy_level = self.get_empathy_level(user_id)
        
        if empathy_level == EmpathyLevel.MINIMAL:
            # For minimal empathy, acknowledge but don't mirror intense emotions
            if strategy == ResponseStrategy.MIRROR and emotional_state.primary_intensity > 0.5:
                strategy = ResponseStrategy.ACKNOWLEDGE
        
        elif empathy_level == EmpathyLevel.HIGH:
            # For high empathy, prefer mirroring and validation
            if strategy == ResponseStrategy.ACKNOWLEDGE:
                strategy = ResponseStrategy.VALIDATE
            elif strategy == ResponseStrategy.NEUTRALIZE:
                strategy = ResponseStrategy.ACKNOWLEDGE
        
        return strategy
    
    @handle_exceptions("Failed to generate empathetic response")
    def generate_response_adaptations(
        self,
        emotional_state: EmotionalState,
        context: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate empathetic response adaptations based on emotional state.
        
        Args:
            emotional_state: Detected emotional state
            context: Conversation context
            user_id: ID of the user (optional)
            
        Returns:
            Dictionary with response adaptations
        """
        # Determine response strategy
        strategy = self.determine_response_strategy(emotional_state, context, user_id)
        
        # Get empathy level
        empathy_level = self.get_empathy_level(user_id)
        
        # Generate adaptations
        adaptations = {
            "strategy": strategy.value,
            "empathy_level": empathy_level.value
        }
        
        # Add tone adaptation based on emotion and strategy
        adaptations["tone"] = self._determine_tone(emotional_state, strategy)
        
        # Add phrasing suggestions based on strategy
        adaptations["phrasing"] = self._generate_phrasing_suggestions(emotional_state, strategy, empathy_level)
        
        # Add mirroring suggestions if appropriate
        if strategy == ResponseStrategy.MIRROR:
            adaptations["mirror"] = {
                "emotion": emotional_state.primary_emotion.value,
                "intensity": min(emotional_state.primary_intensity, 0.7)  # Cap mirroring intensity
            }
        
        return adaptations
    
    def _determine_tone(
        self,
        emotional_state: EmotionalState,
        strategy: ResponseStrategy
    ) -> str:
        """
        Determine appropriate tone for response based on emotional state and strategy.
        
        Args:
            emotional_state: Detected emotional state
            strategy: Response strategy
            
        Returns:
            Appropriate tone descriptor
        """
        # Base tone mapping for different emotions
        emotion_tones = {
            EmotionCategory.JOY: "cheerful",
            EmotionCategory.SADNESS: "gentle",
            EmotionCategory.ANGER: "calm",
            EmotionCategory.FEAR: "reassuring",
            EmotionCategory.SURPRISE: "curious",
            EmotionCategory.DISGUST: "respectful",
            EmotionCategory.TRUST: "warm",
            EmotionCategory.ANTICIPATION: "encouraging",
            EmotionCategory.NEUTRAL: "balanced"
        }
        
        # Get base tone for emotion
        base_tone = emotion_tones.get(emotional_state.primary_emotion, "neutral")
        
        # Adjust tone based on strategy
        if strategy == ResponseStrategy.NEUTRALIZE:
            return "neutral"
        elif strategy == ResponseStrategy.REDIRECT:
            return "gentle"
        elif strategy == ResponseStrategy.SUPPORT:
            return "supportive"
        elif strategy == ResponseStrategy.MIRROR:
            return base_tone
        
        return base_tone
    
    def _generate_phrasing_suggestions(
        self,
        emotional_state: EmotionalState,
        strategy: ResponseStrategy,
        empathy_level: EmpathyLevel
    ) -> List[str]:
        """
        Generate phrasing suggestions based on emotional state and strategy.
        
        Args:
            emotional_state: Detected emotional state
            strategy: Response strategy
            empathy_level: Empathy level to express
            
        Returns:
            List of phrasing suggestions
        """
        suggestions = []
        
        # Generate suggestions based on strategy
        if strategy == ResponseStrategy.ACKNOWLEDGE:
            suggestions.append(f"I notice you're feeling {emotional_state.primary_emotion.value}")
            suggestions.append(f"I understand that you might be experiencing {emotional_state.primary_emotion.value}")
        
        elif strategy == ResponseStrategy.VALIDATE:
            suggestions.append(f"It's completely understandable to feel {emotional_state.primary_emotion.value} in this situation")
            suggestions.append(f"Your feelings of {emotional_state.primary_emotion.value} make sense given what you're describing")
        
        elif strategy == ResponseStrategy.SUPPORT:
            suggestions.append(f"I'm here to help as you work through these feelings of {emotional_state.primary_emotion.value}")
            suggestions.append(f"Let's address your concerns together")
        
        elif strategy == ResponseStrategy.REDIRECT:
            suggestions.append("Let's look at this from a different perspective")
            suggestions.append("I wonder if we could approach this differently")
        
        elif strategy == ResponseStrategy.MIRROR:
            suggestions.append(f"I share your {emotional_state.primary_emotion.value} about this")
            suggestions.append(f"That does seem {emotional_state.primary_emotion.value}-inducing")
        
        # Adjust suggestions based on empathy level
        if empathy_level == EmpathyLevel.MINIMAL:
            # Keep suggestions brief and less emotional
            suggestions = [s.split(" I ")[0] if " I " in s else s for s in suggestions]
        
        elif empathy_level == EmpathyLevel.HIGH:
            # Add more emotionally expressive suggestions
            if emotional_state.primary_emotion == EmotionCategory.JOY:
                suggestions.append("That's wonderful! I'm genuinely happy for you")
            elif emotional_state.primary_emotion == EmotionCategory.SADNESS:
                suggestions.append("I'm truly sorry you're going through this difficult time")
            elif emotional_state.primary_emotion == EmotionCategory.FEAR:
                suggestions.append("It's okay to be afraid, and I'm here to help you through it")
        
        return suggestions


# Example usage
def main():
    # Initialize empathy model
    model = EmpathyModel(default_empathy_level=EmpathyLevel.MODERATE)
    
    # Create sample emotional state
    emotional_state = EmotionalState(
        primary_emotion=EmotionCategory.SADNESS,
        primary_intensity=0.7,
        confidence=0.8,
        source="text_analysis"
    )
    
    # Generate response adaptations
    adaptations = model.generate_response_adaptations(
        emotional_state=emotional_state,
        context={"conversation_history": []},
        user_id="test_user"
    )
    
    print(json.dumps(adaptations, indent=2))


if __name__ == "__main__":
    main()
