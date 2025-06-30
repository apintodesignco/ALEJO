"""
ALEJO Emotional Memory System
Handles storage and processing of emotional states, experiences, and relationships.
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

from ...core.events import Event, EventType
from ...utils.error_handling import handle_errors
from .models import EmotionalState, EmotionalMemoryItem

class EmotionalMemory:
    """
    Manages emotional memory, including:
    - Current emotional state
    - Emotional history
    - Relationship context
    - Value system alignment
    """
    
    def __init__(self, event_bus=None, config: Dict[str, Any] = None):
        """
        Initialize emotional memory system.
        
        Args:
            event_bus: Event bus for system communication
            config: Configuration options
        """
        self.event_bus = event_bus
        self.config = config or {}
        
        # Initialize emotional state tracking
        self.current_state = EmotionalState()
        self.emotional_history: List[EmotionalMemoryItem] = []
        self.relationship_context: Dict[str, Dict[str, Any]] = {}
        
        # Configure emotional parameters
        self.decay_rate = self.config.get('emotion_decay_rate', 0.1)
        self.memory_capacity = self.config.get('emotional_memory_capacity', 1000)
        self.intensity_threshold = self.config.get('emotion_intensity_threshold', 0.3)
        
    async def start(self):
        """Start emotional memory system and subscribe to events."""
        if self.event_bus:
            await self.event_bus.subscribe(EventType.MEMORY, self._handle_memory_event)
            await self.event_bus.subscribe(EventType.PERCEPTION, self._handle_perception_event)
            
    async def stop(self):
        """Stop emotional memory system and cleanup."""
        if self.event_bus:
            await self.event_bus.unsubscribe(EventType.MEMORY, self._handle_memory_event)
            await self.event_bus.unsubscribe(EventType.PERCEPTION, self._handle_perception_event)
            
    @handle_errors(component='emotional_memory')
    async def update_emotional_state(self, 
                                   valence: float,
                                   arousal: float,
                                   dominance: float,
                                   source: str,
                                   context: Dict[str, Any] = None) -> str:
        """
        Update the current emotional state.
        
        Args:
            valence: Pleasure-displeasure (-1 to 1)
            arousal: Activation level (-1 to 1) 
            dominance: Control level (-1 to 1)
            source: Source of the emotional update
            context: Additional context
            
        Returns:
            ID of the emotional memory item created
        """
        # Validate inputs
        for value in [valence, arousal, dominance]:
            if not -1 <= value <= 1:
                raise ValueError("Emotional values must be between -1 and 1")
                
        # Create emotional memory item
        item = EmotionalMemoryItem(
            valence=valence,
            arousal=arousal,
            dominance=dominance,
            source=source,
            context=context or {},
            timestamp=datetime.now().isoformat()
        )
        
        # Update current state with weighted average
        weight = max(abs(valence), abs(arousal), abs(dominance))
        self.current_state.update(item, weight)
        
        # Store in history
        self.emotional_history.append(item)
        
        # Trim history if needed
        while len(self.emotional_history) > self.memory_capacity:
            self.emotional_history.pop(0)
            
        # Publish event
        if self.event_bus:
            await self.event_bus.publish(
                Event(
                    type=EventType.MEMORY,
                    source="emotional_memory",
                    payload={
                        "action": "emotional_update",
                        "item_id": item.id,
                        "current_state": asdict(self.current_state)
                    }
                )
            )
            
        return item.id
        
    @handle_errors(component='emotional_memory')
    async def get_current_state(self) -> EmotionalState:
        """Get the current emotional state."""
        return self.current_state
        
    @handle_errors(component='emotional_memory')
    async def get_emotional_history(self, 
                                  limit: int = 100,
                                  source: Optional[str] = None) -> List[EmotionalMemoryItem]:
        """
        Get emotional history, optionally filtered by source.
        
        Args:
            limit: Maximum number of items to return
            source: Optional source filter
            
        Returns:
            List of emotional memory items
        """
        history = self.emotional_history
        if source:
            history = [item for item in history if item.source == source]
        return history[-limit:]
        
    @handle_errors(component='emotional_memory')
    async def update_relationship_context(self,
                                        entity_id: str,
                                        context_update: Dict[str, Any]) -> None:
        """
        Update relationship context for an entity.
        
        Args:
            entity_id: ID of the entity (person, object, etc.)
            context_update: Context information to update
        """
        if entity_id not in self.relationship_context:
            self.relationship_context[entity_id] = {}
            
        self.relationship_context[entity_id].update(context_update)
        
        # Publish event
        if self.event_bus:
            await self.event_bus.publish(
                Event(
                    type=EventType.MEMORY,
                    source="emotional_memory",
                    payload={
                        "action": "relationship_update",
                        "entity_id": entity_id,
                        "context": self.relationship_context[entity_id]
                    }
                )
            )
            
    @handle_errors(component='emotional_memory')
    async def get_relationship_context(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """
        Get relationship context for an entity.
        
        Args:
            entity_id: ID of the entity
            
        Returns:
            Context dictionary or None if not found
        """
        return self.relationship_context.get(entity_id)
        
    async def _handle_memory_event(self, event: Event):
        """Handle memory-related events."""
        if event.payload.get('action') == 'focus':
            # Update emotional state based on focused content
            content = event.payload.get('content', {})
            if 'emotional_valence' in content:
                await self.update_emotional_state(
                    valence=content['emotional_valence'],
                    arousal=content.get('emotional_arousal', 0),
                    dominance=content.get('emotional_dominance', 0),
                    source=event.source,
                    context=event.payload.get('context')
                )
                
    async def _handle_perception_event(self, event: Event):
        """Handle perception events that may have emotional content."""
        if 'emotion' in event.payload:
            emotion = event.payload['emotion']
            await self.update_emotional_state(
                valence=emotion.get('valence', 0),
                arousal=emotion.get('arousal', 0),
                dominance=emotion.get('dominance', 0),
                source=event.source,
                context=event.payload.get('context')
            )
