"""
ALEJO Emotional Memory System

This module implements ALEJO's emotional memory capabilities, enabling it to
track, store, and recall emotional states, contexts, and relationship-specific
emotional patterns over time.

Features:
- Emotional state tracking using the VAD (Valence-Arousal-Dominance) model
- Emotional context persistence across sessions
- Relationship-specific emotional memory
- Integration with event bus for real-time emotional updates
- Trend analysis and emotional pattern recognition
"""

import asyncio
import json
import logging
import secrets
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Union, Tuple, Set

import numpy as np

from alejo.cognitive.memory.models import MemoryType, EmotionalMemoryItem
from alejo.core.events import EventBus, Event, EventType
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class EmotionalState:
    """
    Represents an emotional state using the VAD (Valence-Arousal-Dominance) model.
    
    Valence: Pleasure to displeasure (-1.0 to 1.0)
    Arousal: Activation to deactivation (-1.0 to 1.0)
    Dominance: Dominance to submissiveness (-1.0 to 1.0)
    """
    def __init__(
        self,
        valence: float = 0.0,
        arousal: float = 0.0,
        dominance: float = 0.0,
        source: str = "unknown",
        context: Dict[str, Any] = None,
        timestamp: Optional[datetime] = None
    ):
        """
        Initialize an emotional state.
        
        Args:
            valence: Pleasure-displeasure dimension (-1.0 to 1.0)
            arousal: Activation-deactivation dimension (-1.0 to 1.0)
            dominance: Dominance-submissiveness dimension (-1.0 to 1.0)
            source: Source of this emotional state detection
            context: Additional context information
            timestamp: When this emotional state was detected
        """
        # Validate input ranges
        if not -1.0 <= valence <= 1.0:
            raise ValueError(f"Valence must be between -1.0 and 1.0, got {valence}")
        if not -1.0 <= arousal <= 1.0:
            raise ValueError(f"Arousal must be between -1.0 and 1.0, got {arousal}")
        if not -1.0 <= dominance <= 1.0:
            raise ValueError(f"Dominance must be between -1.0 and 1.0, got {dominance}")
            
        self.valence = valence
        self.arousal = arousal
        self.dominance = dominance
        self.source = source
        self.context = context or {}
        self.timestamp = timestamp or datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert emotional state to dictionary."""
        return {
            "valence": self.valence,
            "arousal": self.arousal,
            "dominance": self.dominance,
            "source": self.source,
            "context": self.context,
            "timestamp": self.timestamp.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EmotionalState':
        """Create an emotional state from dictionary."""
        timestamp = data.get("timestamp")
        if timestamp and isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        
        return cls(
            valence=data.get("valence", 0.0),
            arousal=data.get("arousal", 0.0),
            dominance=data.get("dominance", 0.0),
            source=data.get("source", "unknown"),
            context=data.get("context", {}),
            timestamp=timestamp
        )
    
    def get_intensity(self) -> float:
        """
        Calculate the overall emotional intensity.
        
        Returns:
            Intensity value from 0.0 (neutral) to 1.0 (intense)
        """
        # Calculate Euclidean distance from neutral point (0,0,0)
        return min(1.0, (self.valence**2 + self.arousal**2 + self.dominance**2)**0.5 / 1.732)
    
    def get_primary_emotion(self) -> Tuple[str, float]:
        """
        Determine the primary emotion based on VAD coordinates.
        
        Returns:
            Tuple of (emotion_name, confidence)
        """
        # Simple mapping of VAD space to basic emotions
        # This is a simplified model and could be enhanced with more sophisticated mapping
        
        # Neutral zone - close to origin
        if self.get_intensity() < 0.2:
            return ("neutral", 0.8)
        
        # High valence, high arousal
        if self.valence > 0.3 and self.arousal > 0.3:
            if self.dominance > 0.3:
                return ("joy", 0.7 + 0.3 * self.get_intensity())
            else:
                return ("excitement", 0.7 + 0.3 * self.get_intensity())
        
        # High valence, low arousal
        if self.valence > 0.3 and self.arousal < -0.3:
            if self.dominance > 0.3:
                return ("contentment", 0.7 + 0.3 * self.get_intensity())
            else:
                return ("relaxation", 0.7 + 0.3 * self.get_intensity())
        
        # Low valence, high arousal
        if self.valence < -0.3 and self.arousal > 0.3:
            if self.dominance > 0.3:
                return ("anger", 0.7 + 0.3 * self.get_intensity())
            else:
                return ("fear", 0.7 + 0.3 * self.get_intensity())
        
        # Low valence, low arousal
        if self.valence < -0.3 and self.arousal < -0.3:
            if self.dominance > 0.3:
                return ("disgust", 0.7 + 0.3 * self.get_intensity())
            else:
                return ("sadness", 0.7 + 0.3 * self.get_intensity())
        
        # Default fallback
        return ("mixed", 0.5)


class EmotionalMemory:
    """
    Emotional memory system for ALEJO.
    
    Tracks, stores, and analyzes emotional states over time, providing insights
    into emotional patterns and relationship-specific emotional contexts.
    
    Features:
    - Emotional state tracking and history
    - Relationship-specific emotional context
    - Emotional trend analysis
    - Event-driven updates
    """
    def __init__(self, event_bus: Optional[EventBus] = None):
        """
        Initialize the emotional memory system.
        
        Args:
            event_bus: Event bus for publishing and subscribing to events
        """
        self.event_bus = event_bus
        self.emotional_history: List[EmotionalState] = []
        self.relationship_contexts: Dict[str, Dict[str, Any]] = {}
        self.current_state: Optional[EmotionalState] = EmotionalState()
        self.baseline_state: Optional[EmotionalState] = EmotionalState()
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        # Event handlers
        self._event_handlers = {}
        
        logger.info("Emotional Memory system initialized")
    
    async def start(self) -> bool:
        """
        Start the emotional memory system.
        
        Returns:
            Success status
        """
        try:
            logger.info("Starting Emotional Memory system")
            
            # Set initial emotional state if none exists
            if not self.current_state:
                self.current_state = EmotionalState()
                self.baseline_state = EmotionalState()
            
            # Subscribe to events if event bus is available
            if self.event_bus:
                await self._subscribe_to_events()
            
            # Publish started event
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.SYSTEM,
                        source="emotional_memory",
                        payload={"action": "started"}
                    )
                )
            
            logger.info("Emotional Memory system started successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to start Emotional Memory system: {e}")
            return False
    
    async def stop(self) -> bool:
        """
        Stop the emotional memory system.
        
        Returns:
            Success status
        """
        try:
            logger.info("Stopping Emotional Memory system")
            
            # Unsubscribe from events if event bus is available
            if self.event_bus and self._event_handlers:
                await self._unsubscribe_from_events()
            
            # Publish stopped event
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.SYSTEM,
                        source="emotional_memory",
                        payload={"action": "stopped"}
                    )
                )
            
            logger.info("Emotional Memory system stopped successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to stop Emotional Memory system: {e}")
            return False
    
    async def _subscribe_to_events(self) -> None:
        """Subscribe to relevant events."""
        if not self.event_bus:
            return
        
        # Subscribe to memory events
        self._event_handlers["memory"] = self._handle_memory_event
        await self.event_bus.subscribe(EventType.MEMORY, self._event_handlers["memory"])
        
        # Subscribe to perception events
        self._event_handlers["perception"] = self._handle_perception_event
        await self.event_bus.subscribe(EventType.PERCEPTION, self._event_handlers["perception"])
        
        # Subscribe to interaction events
        self._event_handlers["interaction"] = self._handle_interaction_event
        await self.event_bus.subscribe(EventType.INTERACTION, self._event_handlers["interaction"])
    
    async def _unsubscribe_from_events(self) -> None:
        """Unsubscribe from events."""
        if not self.event_bus:
            return
        
        for event_type, handler in self._event_handlers.items():
            await self.event_bus.unsubscribe(getattr(EventType, event_type.upper()), handler)
        
        self._event_handlers = {}
    
    @handle_exceptions
    async def _handle_memory_event(self, event: Event) -> None:
        """
        Handle memory events.
        
        Args:
            event: Memory event to handle
        """
        if not event.payload or "content" not in event.payload:
            return
        
        content = event.payload["content"]
        
        # Check for emotional content
        if "emotional_valence" in content and "emotional_arousal" in content:
            await self.update_emotional_state(
                valence=content.get("emotional_valence", 0.0),
                arousal=content.get("emotional_arousal", 0.0),
                dominance=content.get("emotional_dominance", 0.0),
                source=f"memory:{event.payload.get('action', 'unknown')}",
                context={
                    "memory_type": event.payload.get("memory_type"),
                    "memory_action": event.payload.get("action"),
                    "memory_content": content.get("text", "")
                }
            )
    
    @handle_exceptions
    async def _handle_perception_event(self, event: Event) -> None:
        """
        Handle perception events.
        
        Args:
            event: Perception event to handle
        """
        if not event.payload:
            return
            
        # Check for emotion field (test expects 'emotion' not 'emotional')
        emotional_data = event.payload.get("emotion") or event.payload.get("emotional")
        if not emotional_data:
            return
        
        await self.update_emotional_state(
            valence=emotional_data.get("valence", 0.0),
            arousal=emotional_data.get("arousal", 0.0),
            dominance=emotional_data.get("dominance", 0.0),
            source=event.source or f"perception:{event.payload.get('type', 'unknown')}",
            context=event.payload.get("context") or {
                "perception_type": event.payload.get("type"),
                "confidence": emotional_data.get("confidence", 1.0),
                "modality": event.payload.get("modality")
            }
        )
    
    @handle_exceptions
    async def _handle_interaction_event(self, event: Event) -> None:
        """
        Handle interaction events.
        
        Args:
            event: Interaction event to handle
        """
        if not event.payload:
            return
        
        # Update relationship context if entity ID is present
        if "entity_id" in event.payload:
            entity_id = event.payload["entity_id"]
            
            context_update = {
                "last_interaction": datetime.now().isoformat(),
                "interaction_type": event.payload.get("type")
            }
            
            # Add additional context from payload
            if "context" in event.payload:
                context_update.update(event.payload["context"])
            
            await self.update_relationship_context(entity_id, context_update)
        
        # Update emotional state if emotional data is present
        if "emotional" in event.payload:
            emotional = event.payload["emotional"]
            
            await self.update_emotional_state(
                valence=emotional.get("valence", 0.0),
                arousal=emotional.get("arousal", 0.0),
                dominance=emotional.get("dominance", 0.0),
                source=f"interaction:{event.payload.get('type', 'unknown')}",
                context={
                    "interaction_type": event.payload.get("type"),
                    "entity_id": event.payload.get("entity_id"),
                    "confidence": emotional.get("confidence", 1.0)
                }
            )
    
    async def update_emotional_state(
        self,
        valence: float,
        arousal: float,
        dominance: float,
        source: str = "unknown",
        context: Dict[str, Any] = None
    ) -> str:
        """
        Update the current emotional state.
        
        Args:
            valence: Pleasure-displeasure dimension (-1.0 to 1.0)
            arousal: Activation-deactivation dimension (-1.0 to 1.0)
            dominance: Dominance-submissiveness dimension (-1.0 to 1.0)
            source: Source of this emotional state update
            context: Additional context information
            
        Returns:
            ID of the created emotional memory item
        """
        async with self._lock:
            # Create new emotional state
            new_state = EmotionalState(
                valence=valence,
                arousal=arousal,
                dominance=dominance,
                source=source,
                context=context or {}
            )
            
            # Update current state
            self.current_state = new_state
            
            # Add to history
            self.emotional_history.append(new_state)
            
            # Limit history size
            if len(self.emotional_history) > 1000:
                self.emotional_history = self.emotional_history[-1000:]
            
            # Update baseline state if needed
            if not self.baseline_state:
                self.baseline_state = new_state
            else:
                # Slowly adjust baseline (10% weight to new state)
                self.baseline_state = EmotionalState(
                    valence=0.9 * self.baseline_state.valence + 0.1 * new_state.valence,
                    arousal=0.9 * self.baseline_state.arousal + 0.1 * new_state.arousal,
                    dominance=0.9 * self.baseline_state.dominance + 0.1 * new_state.dominance,
                    source="baseline",
                    context={}
                )
            
            # Generate a unique ID for this emotional memory item
            memory_id = secrets.token_hex(8)
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.EMOTIONAL,
                        source="emotional_memory",
                        payload={
                            "action": "state_updated",
                            "state": new_state.to_dict(),
                            "memory_id": memory_id
                        }
                    )
                )
            
            logger.debug(f"Emotional state updated: v={valence:.2f}, a={arousal:.2f}, d={dominance:.2f}, source={source}")
            return memory_id
    
    async def get_current_state(self) -> Optional[EmotionalState]:
        """
        Get the current emotional state.
        
        Returns:
            Current emotional state or None if not set
        """
        return self.current_state
    
    async def get_baseline_state(self) -> Optional[EmotionalState]:
        """
        Get the baseline emotional state.
        
        Returns:
            Baseline emotional state or None if not set
        """
        return self.baseline_state
    
    async def get_emotional_history(
        self,
        limit: int = 10,
        source: Optional[str] = None,
        min_valence: Optional[float] = None,
        max_valence: Optional[float] = None,
        min_arousal: Optional[float] = None,
        max_arousal: Optional[float] = None,
        min_dominance: Optional[float] = None,
        max_dominance: Optional[float] = None
    ) -> List[EmotionalState]:
        """
        Get emotional history with optional filtering.
        
        Args:
            limit: Maximum number of history items to retrieve
            source: Filter by source
            min_valence: Minimum valence threshold
            max_valence: Maximum valence threshold
            min_arousal: Minimum arousal threshold
            max_arousal: Maximum arousal threshold
            min_dominance: Minimum dominance threshold
            max_dominance: Maximum dominance threshold
            
        Returns:
            List of emotional states matching criteria
        """
        async with self._lock:
            filtered_history = self.emotional_history
            
            # Apply filters
            if source:
                filtered_history = [state for state in filtered_history if state.source == source]
            
            if min_valence is not None:
                filtered_history = [state for state in filtered_history if state.valence >= min_valence]
            
            if max_valence is not None:
                filtered_history = [state for state in filtered_history if state.valence <= max_valence]
            
            if min_arousal is not None:
                filtered_history = [state for state in filtered_history if state.arousal >= min_arousal]
            
            if max_arousal is not None:
                filtered_history = [state for state in filtered_history if state.arousal <= max_arousal]
            
            if min_dominance is not None:
                filtered_history = [state for state in filtered_history if state.dominance >= min_dominance]
            
            if max_dominance is not None:
                filtered_history = [state for state in filtered_history if state.dominance <= max_dominance]
            
            # Limit results
            return filtered_history[-limit:]
    
    async def update_relationship_context(
        self,
        entity_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update relationship context for an entity.
        
        Args:
            entity_id: ID of the entity
            context: Context information to update
            
        Returns:
            Updated relationship context
        """
        async with self._lock:
            # Create context if it doesn't exist
            if entity_id not in self.relationship_contexts:
                self.relationship_contexts[entity_id] = {}
            
            # Update context
            self.relationship_contexts[entity_id].update(context)
            
            # Add last updated timestamp if not provided
            if "last_updated" not in context:
                self.relationship_contexts[entity_id]["last_updated"] = datetime.now().isoformat()
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.RELATIONSHIP,
                        source="emotional_memory",
                        payload={
                            "action": "context_updated",
                            "entity_id": entity_id,
                            "context": self.relationship_contexts[entity_id]
                        }
                    )
                )
            
            logger.debug(f"Relationship context updated for entity {entity_id}")
            return self.relationship_contexts[entity_id]
    
    async def get_relationship_context(
        self,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get relationship context for an entity.
        
        Args:
            entity_id: ID of the entity
            
        Returns:
            Relationship context or None if not found
        """
        return self.relationship_contexts.get(entity_id)
    
    async def get_emotional_trend(
        self,
        window_size: int = 10
    ) -> Dict[str, Any]:
        """
        Calculate emotional trend over time.
        
        Args:
            window_size: Number of recent emotional states to analyze
            
        Returns:
            Dictionary with trend information
        """
        async with self._lock:
            if not self.emotional_history:
                return {
                    "trend": "neutral",
                    "confidence": 0.0,
                    "details": {
                        "valence_trend": 0.0,
                        "arousal_trend": 0.0,
                        "dominance_trend": 0.0
                    }
                }
            
            # Get recent history
            recent_history = self.emotional_history[-window_size:]
            
            if len(recent_history) < 2:
                return {
                    "trend": "neutral",
                    "confidence": 0.0,
                    "details": {
                        "valence_trend": 0.0,
                        "arousal_trend": 0.0,
                        "dominance_trend": 0.0
                    }
                }
            
            # Calculate trends
            valence_values = [state.valence for state in recent_history]
            arousal_values = [state.arousal for state in recent_history]
            dominance_values = [state.dominance for state in recent_history]
            
            # Simple linear trend (positive = increasing, negative = decreasing)
            valence_trend = (valence_values[-1] - valence_values[0]) / len(valence_values)
            arousal_trend = (arousal_values[-1] - arousal_values[0]) / len(arousal_values)
            dominance_trend = (dominance_values[-1] - dominance_values[0]) / len(dominance_values)
            
            # Determine overall trend
            trend = "neutral"
            confidence = 0.0
            
            # Significant valence change
            if abs(valence_trend) > 0.1:
                if valence_trend > 0:
                    trend = "improving"
                else:
                    trend = "deteriorating"
                confidence = min(1.0, abs(valence_trend) * 5)
            
            # Significant arousal change
            elif abs(arousal_trend) > 0.1:
                if arousal_trend > 0:
                    trend = "intensifying"
                else:
                    trend = "calming"
                confidence = min(1.0, abs(arousal_trend) * 5)
            
            # Significant dominance change
            elif abs(dominance_trend) > 0.1:
                if dominance_trend > 0:
                    trend = "empowering"
                else:
                    trend = "submitting"
                confidence = min(1.0, abs(dominance_trend) * 5)
            
            return {
                "trend": trend,
                "confidence": confidence,
                "details": {
                    "valence_trend": valence_trend,
                    "arousal_trend": arousal_trend,
                    "dominance_trend": dominance_trend,
                    "current_state": self.current_state.to_dict() if self.current_state else None,
                    "baseline_state": self.baseline_state.to_dict() if self.baseline_state else None
                }
            }
            
    async def _handle_interaction_event(self, event: Event) -> None:
        """
        Handle interaction events.
        
        Args:
            event: Interaction event to handle
        """
        if not event.payload:
            return
        
        # Update relationship context if entity ID is present
        if "entity_id" in event.payload:
            entity_id = event.payload["entity_id"]
            
            context_update = {
                "last_interaction": datetime.now().isoformat(),
                "interaction_type": event.payload.get("type")
            }
            
            # Add additional context from payload
            if "context" in event.payload:
                context_update.update(event.payload["context"])
            
            await self.update_relationship_context(entity_id, context_update)
        
        # Update emotional state if emotional data is present
        if "emotional" in event.payload:
            emotional = event.payload["emotional"]
            
            await self.update_emotional_state(
                valence=emotional.get("valence", 0.0),
                arousal=emotional.get("arousal", 0.0),
                dominance=emotional.get("dominance", 0.0),
                source=f"interaction:{event.payload.get('type', 'unknown')}",
                context={
                    "interaction_type": event.payload.get("type"),
                    "entity_id": event.payload.get("entity_id"),
                    "confidence": emotional.get("confidence", 1.0)
                }
            )
    
    async def persist(self, path: str) -> bool:
        """
        Persist emotional memory to disk.
        
        Args:
            path: Path to save the data
            
        Returns:
            Success status
        """
        try:
            data = {
                "current_state": self.current_state.to_dict() if self.current_state else None,
                "baseline_state": self.baseline_state.to_dict() if self.baseline_state else None,
                "emotional_history": [state.to_dict() for state in self.emotional_history[-100:]],
                "relationship_contexts": self.relationship_contexts
            }
            
            with open(path, "w") as f:
                json.dump(data, f)
            
            logger.info(f"Emotional memory persisted to {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to persist emotional memory: {e}")
            return False
    
    async def load(self, path: str) -> bool:
        """
        Load emotional memory from disk.
        
        Args:
            path: Path to load the data from
            
        Returns:
            Success status
        """
        try:
            with open(path, "r") as f:
                data = json.load(f)
            
            if "current_state" in data and data["current_state"]:
                self.current_state = EmotionalState.from_dict(data["current_state"])
            
            if "baseline_state" in data and data["baseline_state"]:
                self.baseline_state = EmotionalState.from_dict(data["baseline_state"])
            
            if "emotional_history" in data:
                self.emotional_history = [
                    EmotionalState.from_dict(state_data)
                    for state_data in data["emotional_history"]
                ]
            
            if "relationship_contexts" in data:
                self.relationship_contexts = data["relationship_contexts"]
            
            logger.info(f"Emotional memory loaded from {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load emotional memory: {e}")
            return False
