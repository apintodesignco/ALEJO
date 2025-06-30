"""
Proactive Cognition Module for ALEJO

This module implements proactive empathy and curiosity capabilities for ALEJO,
integrating emotional intelligence with contextual awareness to create
a more engaging and supportive user experience.

The ProactiveCognitionEngine combines empathy and curiosity to:
1. Detect emotional states and respond appropriately
2. Generate contextually relevant follow-up questions
3. Balance empathetic responses with curious exploration
4. Adapt interaction style based on user preferences and context
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import asyncio
from dataclasses import dataclass, field

from .empathy_layer import EmpathyEngine
from .curiosity_layer import CuriosityEngine, PromptSuggestion
from ..emotional_intelligence.models.empathy_modeling import EmpatheticResponse
from ..core.config_manager import ConfigManager
from ..utils.event_bus import EventBus, Event

logger = logging.getLogger(__name__)


@dataclass
class CognitiveInsight:
    """Represents a cognitive insight about the user's state or needs"""
    
    insight_type: str  # empathy, curiosity, context, etc.
    content: str
    confidence: float
    source: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ProactiveCognitionEngine:
    """
    Integrates empathy and curiosity capabilities to provide proactive cognitive features.
    
    This engine combines emotional intelligence with contextual awareness to:
    1. Generate empathetic responses when appropriate
    2. Ask follow-up questions driven by curiosity
    3. Maintain awareness of conversation context and user preferences
    4. Adapt interaction style based on detected patterns
    """
    
    def __init__(self, config_manager: Optional[ConfigManager] = None, event_bus: Optional[EventBus] = None):
        """
        Initialize the ProactiveCognitionEngine with configuration and event handling
        
        Args:
            config_manager: Configuration manager for settings
            event_bus: Event bus for publishing and subscribing to events
        """
        self.config_manager = config_manager
        self.event_bus = event_bus
        
        # Initialize empathy and curiosity engines
        self.empathy_engine = EmpathyEngine(max_history=10)
        self.curiosity_engine = CuriosityEngine(max_history=10)
        
        # Configuration settings
        self.empathy_threshold = 0.7
        self.curiosity_threshold = 0.6
        self.proactive_enabled = True
        self.empathy_enabled = True
        self.curiosity_enabled = True
        
        # Conversation state tracking
        self.conversation_state = {
            "emotional_trajectory": [],
            "topic_focus": None,
            "interaction_depth": 0,
            "user_receptiveness": 0.5  # Default middle value
        }
        
        # Load configuration if available
        if config_manager:
            self._load_configuration()
            
        # Register event handlers if event bus is available
        if event_bus:
            self._register_event_handlers()
    
    def _load_configuration(self) -> None:
        """Load configuration settings from config manager"""
        cognitive_config = self.config_manager.get_config("cognitive", {})
        
        self.proactive_enabled = cognitive_config.get("proactive_enabled", True)
        self.empathy_enabled = cognitive_config.get("empathy_enabled", True)
        self.curiosity_enabled = cognitive_config.get("curiosity_enabled", True)
        
        self.empathy_threshold = cognitive_config.get("empathy_threshold", 0.7)
        self.curiosity_threshold = cognitive_config.get("curiosity_threshold", 0.6)
    
    def _register_event_handlers(self) -> None:
        """Register handlers for relevant events"""
        self.event_bus.subscribe("message.received", self._handle_message_received)
        self.event_bus.subscribe("user.emotion_detected", self._handle_emotion_detected)
        self.event_bus.subscribe("conversation.topic_changed", self._handle_topic_changed)
    
    async def _handle_message_received(self, event: Event) -> None:
        """Handle incoming message events"""
        if not self.proactive_enabled:
            return
            
        message = event.payload.get("message", "")
        speaker = event.payload.get("speaker", "user")
        
        # Record the turn in both engines
        self.empathy_engine.record_turn(speaker, message)
        self.curiosity_engine.record_turn(speaker, message)
        
        # Process the message for insights
        await self._process_message(speaker, message)
    
    async def _handle_emotion_detected(self, event: Event) -> None:
        """Handle emotion detection events"""
        emotion = event.payload.get("emotion", {})
        intensity = emotion.get("intensity", 0.5)
        
        # Update emotional trajectory
        self.conversation_state["emotional_trajectory"].append({
            "emotion": emotion.get("type", "neutral"),
            "intensity": intensity,
            "timestamp": datetime.utcnow()
        })
        
        # Adjust user receptiveness based on emotional state
        if emotion.get("type") in ["angry", "frustrated", "sad"]:
            # Decrease receptiveness for negative emotions
            self.conversation_state["user_receptiveness"] = max(
                0.1, self.conversation_state["user_receptiveness"] - (0.1 * intensity)
            )
        elif emotion.get("type") in ["happy", "excited", "curious"]:
            # Increase receptiveness for positive emotions
            self.conversation_state["user_receptiveness"] = min(
                1.0, self.conversation_state["user_receptiveness"] + (0.1 * intensity)
            )
    
    async def _handle_topic_changed(self, event: Event) -> None:
        """Handle topic change events"""
        self.conversation_state["topic_focus"] = event.payload.get("topic")
        self.conversation_state["interaction_depth"] = 0  # Reset depth for new topic
    
    async def _process_message(self, speaker: str, message: str) -> None:
        """
        Process a message to generate cognitive insights
        
        Args:
            speaker: The speaker of the message (user or system)
            message: The message content
        """
        if speaker != "user":
            return
            
        # Increment interaction depth
        self.conversation_state["interaction_depth"] += 1
        
        # Generate empathetic response if appropriate
        if self.empathy_enabled:
            empathy_needed = self.empathy_engine.should_reflect(message)
            if empathy_needed and empathy_needed.confidence >= self.empathy_threshold:
                reflection = self.empathy_engine.generate_reflection(message)
                await self._publish_empathetic_response(reflection, empathy_needed.confidence)
        
        # Generate curious follow-up if appropriate
        if self.curiosity_enabled:
            # Adjust curiosity threshold based on conversation state
            adjusted_threshold = self._adjust_curiosity_threshold()
            
            prompt = self.curiosity_engine.get_proactive_prompt()
            if prompt and self._calculate_prompt_confidence(prompt) >= adjusted_threshold:
                await self._publish_curious_prompt(prompt)
    
    def _adjust_curiosity_threshold(self) -> float:
        """
        Dynamically adjust curiosity threshold based on conversation state
        
        Returns:
            Adjusted threshold value
        """
        base_threshold = self.curiosity_threshold
        
        # Increase threshold (harder to trigger) when user receptiveness is low
        if self.conversation_state["user_receptiveness"] < 0.3:
            return min(0.9, base_threshold + 0.2)
            
        # Decrease threshold (easier to trigger) for deeper interactions on a topic
        if self.conversation_state["interaction_depth"] > 3:
            return max(0.3, base_threshold - 0.1)
            
        return base_threshold
    
    def _calculate_prompt_confidence(self, prompt: PromptSuggestion) -> float:
        """
        Calculate confidence score for a prompt suggestion
        
        Args:
            prompt: The prompt suggestion to evaluate
            
        Returns:
            Confidence score between 0 and 1
        """
        # Base implementation - can be enhanced with more sophisticated scoring
        base_confidence = 0.7
        
        # Adjust based on conversation state
        if self.conversation_state["user_receptiveness"] < 0.3:
            base_confidence -= 0.2
        elif self.conversation_state["user_receptiveness"] > 0.7:
            base_confidence += 0.1
            
        # Limit to valid range
        return max(0.0, min(1.0, base_confidence))
    
    async def _publish_empathetic_response(self, reflection: str, confidence: float) -> None:
        """
        Publish an empathetic response to the event bus
        
        Args:
            reflection: The empathetic reflection
            confidence: Confidence score for the reflection
        """
        if not self.event_bus:
            logger.debug(f"Empathetic response generated (no event bus): {reflection}")
            return
            
        response = EmpatheticResponse(
            text=reflection,
            confidence=confidence,
            created_at=datetime.utcnow()
        )
        
        await self.event_bus.publish(
            "cognitive.empathetic_response",
            {
                "response": response,
                "confidence": confidence,
                "should_display": confidence >= self.empathy_threshold
            }
        )
        
        # Also publish as a cognitive insight
        insight = CognitiveInsight(
            insight_type="empathy",
            content=reflection,
            confidence=confidence,
            source="empathy_engine"
        )
        
        await self.event_bus.publish(
            "cognitive.insight",
            {"insight": insight}
        )
    
    async def _publish_curious_prompt(self, prompt: PromptSuggestion) -> None:
        """
        Publish a curious prompt to the event bus
        
        Args:
            prompt: The curious prompt suggestion
        """
        if not self.event_bus:
            logger.debug(f"Curious prompt generated (no event bus): {prompt.text}")
            return
            
        confidence = self._calculate_prompt_confidence(prompt)
        
        await self.event_bus.publish(
            "cognitive.curious_prompt",
            {
                "prompt": prompt,
                "confidence": confidence,
                "should_display": confidence >= self.curiosity_threshold
            }
        )
        
        # Also publish as a cognitive insight
        insight = CognitiveInsight(
            insight_type="curiosity",
            content=prompt.text,
            confidence=confidence,
            source="curiosity_engine",
            metadata={"rationale": prompt.rationale}
        )
        
        await self.event_bus.publish(
            "cognitive.insight",
            {"insight": insight}
        )
    
    async def generate_cognitive_insights(self, context: Dict[str, Any]) -> List[CognitiveInsight]:
        """
        Generate cognitive insights based on provided context
        
        Args:
            context: Context information for generating insights
            
        Returns:
            List of cognitive insights
        """
        insights = []
        
        # Extract message history if available
        message_history = context.get("message_history", [])
        for message in message_history:
            if message.get("speaker") == "user":
                self.empathy_engine.record_turn("user", message.get("text", ""))
                self.curiosity_engine.record_turn("user", message.get("text", ""))
        
        # Generate empathetic insights
        if self.empathy_enabled and message_history:
            last_message = next((m for m in reversed(message_history) 
                               if m.get("speaker") == "user"), None)
            
            if last_message:
                empathy_needed = self.empathy_engine.should_reflect(last_message.get("text", ""))
                if empathy_needed and empathy_needed.confidence >= self.empathy_threshold:
                    reflection = self.empathy_engine.generate_reflection(last_message.get("text", ""))
                    insights.append(CognitiveInsight(
                        insight_type="empathy",
                        content=reflection,
                        confidence=empathy_needed.confidence,
                        source="empathy_engine"
                    ))
        
        # Generate curiosity insights
        if self.curiosity_enabled:
            prompt = self.curiosity_engine.get_proactive_prompt()
            if prompt:
                confidence = self._calculate_prompt_confidence(prompt)
                if confidence >= self.curiosity_threshold:
                    insights.append(CognitiveInsight(
                        insight_type="curiosity",
                        content=prompt.text,
                        confidence=confidence,
                        source="curiosity_engine",
                        metadata={"rationale": prompt.rationale}
                    ))
        
        return insights
    
    def update_configuration(self, config: Dict[str, Any]) -> None:
        """
        Update engine configuration
        
        Args:
            config: New configuration settings
        """
        if "proactive_enabled" in config:
            self.proactive_enabled = config["proactive_enabled"]
        
        if "empathy_enabled" in config:
            self.empathy_enabled = config["empathy_enabled"]
            
        if "curiosity_enabled" in config:
            self.curiosity_enabled = config["curiosity_enabled"]
            
        if "empathy_threshold" in config:
            self.empathy_threshold = config["empathy_threshold"]
            
        if "curiosity_threshold" in config:
            self.curiosity_threshold = config["curiosity_threshold"]
            
        # Update config manager if available
        if self.config_manager:
            self.config_manager.update_config("cognitive", config)


# Export public API
__all__ = ["ProactiveCognitionEngine", "CognitiveInsight"]
