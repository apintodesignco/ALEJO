"""
EmotionalMemory Module for ALEJO

Provides a comprehensive emotional memory system that tracks emotional states,
relationship context, value systems, and experience-based learning.

This module serves as the foundation for ALEJO's emotional intelligence,
enabling it to maintain emotional continuity across interactions and
adapt its responses based on past experiences.
"""

import logging
import asyncio
import json
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path

from ..utils.events import EventBus
from ..utils.exceptions import EmotionalMemoryError
from .memory import EmotionalMemoryService

logger = logging.getLogger(__name__)

class EmotionalMemory:
    """
    Enhanced emotional memory system for ALEJO that provides emotional state tracking,
    relationship context, value system storage, and experience-based learning.
    
    This class serves as a high-level interface to the EmotionalMemoryService,
    adding event-driven architecture, asynchronous processing, and advanced
    emotional pattern recognition.
    """
    
    def __init__(self, config: Dict[str, Any] = None, event_bus: Optional[EventBus] = None):
        """
        Initialize the EmotionalMemory system.
        
        Args:
            config: Configuration dictionary for emotional memory
            event_bus: Event bus for publishing and subscribing to events
        """
        self.config = config or {}
        self.event_bus = event_bus or EventBus()
        self.memory_service = EmotionalMemoryService(config=self.config)
        self.initialized = False
        self.current_user_id = self.config.get("default_user_id", "default_user")
        
        # Track current emotional state
        self.current_emotional_state = {
            "valence": 0.0,
            "arousal": 0.0,
            "dominance": 0.0,
            "social": 0.0,
            "moral": 0.0,
            "temporal": 0.0,
            "primary_emotion": "neutral",
            "emotion_scores": {},
            "confidence": 1.0
        }
        
        # Value system storage
        self.value_system = self.config.get("default_values", {
            "honesty": 0.9,
            "kindness": 0.8,
            "helpfulness": 0.9,
            "respect": 0.8,
            "fairness": 0.7
        })
        
        # Experience tracking
        self.interaction_count = 0
        self.last_interaction_time = None
        
        # Subscribe to events
        self.event_bus.subscribe("emotional.update", self._handle_emotional_update)
        self.event_bus.subscribe("interaction.complete", self._handle_interaction_complete)
        self.event_bus.subscribe("value.update", self._handle_value_update)
        
        logger.info("EmotionalMemory initialized")
        
    async def initialize(self) -> None:
        """
        Initialize the emotional memory system asynchronously.
        
        This method loads any persistent data and prepares the system for use.
        """
        try:
            # Load relationship metrics for current user
            relationship = self.memory_service.get_relationship_context(self.current_user_id)
            self.interaction_count = relationship.get("interaction_count", 0)
            self.last_interaction_time = relationship.get("last_interaction")
            
            # Load value system if available
            context_list = self.memory_service.get_emotional_context(
                self.current_user_id, context_type="value_system"
            )
            if context_list:
                self.value_system = context_list[0].get("context_data", self.value_system)
            
            # Load recent emotional state
            recent_interactions = self.memory_service.get_recent_interactions(
                self.current_user_id, limit=1
            )
            if recent_interactions:
                latest = recent_interactions[0]
                self.current_emotional_state.update({
                    "valence": latest.get("emotional_data", {}).get("valence", 0.0),
                    "arousal": latest.get("emotional_data", {}).get("arousal", 0.0),
                    "dominance": latest.get("emotional_data", {}).get("dominance", 0.0)
                })
            
            # Emit initialization event
            await self.event_bus.emit("emotional.memory.initialized", {
                "user_id": self.current_user_id,
                "interaction_count": self.interaction_count,
                "value_system": self.value_system
            })
            
            self.initialized = True
            logger.info(f"EmotionalMemory initialized for user {self.current_user_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize EmotionalMemory: {str(e)}")
            raise EmotionalMemoryError(f"Initialization failed: {str(e)}")
    
    async def store_interaction(self, 
                               interaction_type: str,
                               emotional_data: Dict[str, float],
                               context: Dict[str, Any],
                               response: str,
                               trigger: Optional[str] = None,
                               confidence: Optional[float] = None) -> None:
        """
        Store an emotional interaction in memory.
        
        Args:
            interaction_type: Type of interaction (e.g., "greeting", "question", "command")
            emotional_data: Dictionary of emotional dimensions (valence, arousal, etc.)
            context: Context of the interaction
            response: ALEJO's response
            trigger: Optional trigger for the emotional response
            confidence: Confidence in the emotional assessment
        """
        try:
            # Update current emotional state
            self.current_emotional_state.update(emotional_data)
            self.current_emotional_state["primary_emotion"] = interaction_type
            
            # Store in memory service
            self.memory_service.store_interaction(
                user_id=self.current_user_id,
                interaction_type=interaction_type,
                emotional_data=emotional_data,
                context=context,
                response=response,
                trigger=trigger,
                confidence=confidence
            )
            
            # Update interaction tracking
            self.interaction_count += 1
            self.last_interaction_time = datetime.now().isoformat()
            
            # Emit event
            await self.event_bus.emit("emotional.memory.interaction_stored", {
                "user_id": self.current_user_id,
                "interaction_type": interaction_type,
                "emotional_data": emotional_data,
                "trigger": trigger
            })
            
            logger.debug(f"Stored emotional interaction: {interaction_type}")
            
        except Exception as e:
            logger.error(f"Failed to store interaction: {str(e)}")
            raise EmotionalMemoryError(f"Failed to store interaction: {str(e)}")
    
    async def update_relationship(self,
                                trust_delta: float = 0.0,
                                rapport_delta: float = 0.0) -> Dict[str, Any]:
        """
        Update relationship metrics with the current user.
        
        Args:
            trust_delta: Change in trust level (-1.0 to 1.0)
            rapport_delta: Change in rapport level (-1.0 to 1.0)
            
        Returns:
            Updated relationship metrics
        """
        try:
            # Update in memory service
            self.memory_service.update_relationship_metrics(
                user_id=self.current_user_id,
                trust_delta=trust_delta,
                rapport_delta=rapport_delta
            )
            
            # Get updated relationship
            relationship = self.memory_service.get_relationship_context(self.current_user_id)
            
            # Emit event
            await self.event_bus.emit("emotional.memory.relationship_updated", {
                "user_id": self.current_user_id,
                "trust_level": relationship.get("trust_level"),
                "rapport_level": relationship.get("rapport_level")
            })
            
            return relationship
            
        except Exception as e:
            logger.error(f"Failed to update relationship: {str(e)}")
            raise EmotionalMemoryError(f"Failed to update relationship: {str(e)}")
    
    async def store_value(self, value_name: str, value_level: float) -> None:
        """
        Store or update a value in the value system.
        
        Args:
            value_name: Name of the value (e.g., "honesty", "kindness")
            value_level: Level of importance (0.0 to 1.0)
        """
        try:
            # Update local value system
            self.value_system[value_name] = max(0.0, min(1.0, value_level))
            
            # Store in memory service
            self.memory_service.store_emotional_context(
                user_id=self.current_user_id,
                context_type="value_system",
                context_data=self.value_system
            )
            
            # Emit event
            await self.event_bus.emit("emotional.memory.value_updated", {
                "user_id": self.current_user_id,
                "value_name": value_name,
                "value_level": value_level
            })
            
            logger.debug(f"Updated value: {value_name}={value_level}")
            
        except Exception as e:
            logger.error(f"Failed to store value: {str(e)}")
            raise EmotionalMemoryError(f"Failed to store value: {str(e)}")
    
    async def get_emotional_context(self, 
                                  context_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get emotional context from memory.
        
        Args:
            context_type: Optional type of context to retrieve
            
        Returns:
            List of emotional context items
        """
        try:
            return self.memory_service.get_emotional_context(
                user_id=self.current_user_id,
                context_type=context_type
            )
        except Exception as e:
            logger.error(f"Failed to get emotional context: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get emotional context: {str(e)}")
    
    async def get_emotional_summary(self, days: int = 7) -> Dict[str, Any]:
        """
        Get a summary of emotional state over time.
        
        Args:
            days: Number of days to include in the summary
            
        Returns:
            Dictionary with emotional state summary
        """
        try:
            return self.memory_service.get_emotional_summary(
                user_id=self.current_user_id,
                days=days
            )
        except Exception as e:
            logger.error(f"Failed to get emotional summary: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get emotional summary: {str(e)}")
    
    async def get_emotional_patterns(self,
                                   pattern_types: Optional[List[str]] = None,
                                   min_confidence: float = 0.5) -> List[Dict[str, Any]]:
        """
        Get emotional patterns from memory.
        
        Args:
            pattern_types: Optional list of pattern types to filter by
            min_confidence: Minimum confidence threshold for patterns
            
        Returns:
            List of emotional patterns
        """
        try:
            return self.memory_service.get_emotional_patterns(
                user_id=self.current_user_id,
                pattern_types=pattern_types,
                min_confidence=min_confidence
            )
        except Exception as e:
            logger.error(f"Failed to get emotional patterns: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get emotional patterns: {str(e)}")
    
    async def get_nostalgic_memories(self, 
                                   trigger: str, 
                                   limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get nostalgic memories associated with a trigger.
        
        Args:
            trigger: Trigger to search for
            limit: Maximum number of memories to return
            
        Returns:
            List of nostalgic memories
        """
        try:
            return self.memory_service.get_nostalgic_memories(
                trigger=trigger,
                limit=limit
            )
        except Exception as e:
            logger.error(f"Failed to get nostalgic memories: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get nostalgic memories: {str(e)}")
    
    async def get_similar_memories(self,
                                 trigger: str,
                                 context: Dict[str, str],
                                 limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get memories with similar triggers or context.
        
        Args:
            trigger: Trigger to search for
            context: Current context dictionary
            limit: Maximum number of memories to return
            
        Returns:
            List of similar memories
        """
        try:
            return self.memory_service.get_similar_memories(
                trigger=trigger,
                context=context,
                limit=limit
            )
        except Exception as e:
            logger.error(f"Failed to get similar memories: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get similar memories: {str(e)}")
    
    async def get_relationship_context(self) -> Dict[str, Any]:
        """
        Get relationship context for the current user.
        
        Returns:
            Dictionary with relationship metrics
        """
        try:
            return self.memory_service.get_relationship_context(self.current_user_id)
        except Exception as e:
            logger.error(f"Failed to get relationship context: {str(e)}")
            raise EmotionalMemoryError(f"Failed to get relationship context: {str(e)}")
    
    async def get_current_emotional_state(self) -> Dict[str, Any]:
        """
        Get the current emotional state.
        
        Returns:
            Dictionary with current emotional state
        """
        return self.current_emotional_state
    
    async def get_value_system(self) -> Dict[str, float]:
        """
        Get the current value system.
        
        Returns:
            Dictionary with value system
        """
        return self.value_system
    
    async def clear_user_data(self) -> None:
        """
        Clear all emotional data for the current user.
        """
        try:
            self.memory_service.clear_user_data(self.current_user_id)
            
            # Reset local state
            self.current_emotional_state = {
                "valence": 0.0,
                "arousal": 0.0,
                "dominance": 0.0,
                "social": 0.0,
                "moral": 0.0,
                "temporal": 0.0,
                "primary_emotion": "neutral",
                "emotion_scores": {},
                "confidence": 1.0
            }
            self.interaction_count = 0
            self.last_interaction_time = None
            
            # Emit event
            await self.event_bus.emit("emotional.memory.cleared", {
                "user_id": self.current_user_id
            })
            
            logger.info(f"Cleared emotional data for user {self.current_user_id}")
            
        except Exception as e:
            logger.error(f"Failed to clear user data: {str(e)}")
            raise EmotionalMemoryError(f"Failed to clear user data: {str(e)}")
    
    async def switch_user(self, user_id: str) -> None:
        """
        Switch to a different user.
        
        Args:
            user_id: ID of the user to switch to
        """
        try:
            # Store current state before switching
            if self.initialized:
                # Update relationship metrics before switching
                await self.update_relationship()
            
            # Switch user
            self.current_user_id = user_id
            
            # Reset local state
            self.current_emotional_state = {
                "valence": 0.0,
                "arousal": 0.0,
                "dominance": 0.0,
                "social": 0.0,
                "moral": 0.0,
                "temporal": 0.0,
                "primary_emotion": "neutral",
                "emotion_scores": {},
                "confidence": 1.0
            }
            
            # Load new user data
            relationship = self.memory_service.get_relationship_context(self.current_user_id)
            self.interaction_count = relationship.get("interaction_count", 0)
            self.last_interaction_time = relationship.get("last_interaction")
            
            # Load value system if available
            context_list = self.memory_service.get_emotional_context(
                self.current_user_id, context_type="value_system"
            )
            if context_list:
                self.value_system = context_list[0].get("context_data", self.value_system)
            
            # Emit event
            await self.event_bus.emit("emotional.memory.user_switched", {
                "user_id": self.current_user_id,
                "interaction_count": self.interaction_count,
                "value_system": self.value_system
            })
            
            logger.info(f"Switched to user {self.current_user_id}")
            
        except Exception as e:
            logger.error(f"Failed to switch user: {str(e)}")
            raise EmotionalMemoryError(f"Failed to switch user: {str(e)}")
    
    async def _handle_emotional_update(self, event_data: Dict[str, Any]) -> None:
        """
        Handle emotional update events.
        
        Args:
            event_data: Event data with emotional update
        """
        try:
            if "emotional_data" in event_data:
                # Update current emotional state
                self.current_emotional_state.update(event_data["emotional_data"])
                
                # Store interaction if complete data is provided
                if all(key in event_data for key in ["interaction_type", "context", "response"]):
                    await self.store_interaction(
                        interaction_type=event_data["interaction_type"],
                        emotional_data=event_data["emotional_data"],
                        context=event_data["context"],
                        response=event_data["response"],
                        trigger=event_data.get("trigger"),
                        confidence=event_data.get("confidence")
                    )
        except Exception as e:
            logger.error(f"Error handling emotional update: {str(e)}")
    
    async def _handle_interaction_complete(self, event_data: Dict[str, Any]) -> None:
        """
        Handle interaction complete events.
        
        Args:
            event_data: Event data with interaction details
        """
        try:
            # Update relationship metrics based on interaction
            trust_delta = event_data.get("trust_delta", 0.0)
            rapport_delta = event_data.get("rapport_delta", 0.0)
            
            if trust_delta != 0.0 or rapport_delta != 0.0:
                await self.update_relationship(
                    trust_delta=trust_delta,
                    rapport_delta=rapport_delta
                )
        except Exception as e:
            logger.error(f"Error handling interaction complete: {str(e)}")
    
    async def _handle_value_update(self, event_data: Dict[str, Any]) -> None:
        """
        Handle value update events.
        
        Args:
            event_data: Event data with value update
        """
        try:
            if "value_name" in event_data and "value_level" in event_data:
                await self.store_value(
                    value_name=event_data["value_name"],
                    value_level=event_data["value_level"]
                )
        except Exception as e:
            logger.error(f"Error handling value update: {str(e)}")
