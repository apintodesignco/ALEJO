"""
Working Memory System for ALEJO
Manages active information processing and coordination between memory systems.
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import time
import numpy as np
import logging
from collections import OrderedDict
from ...core.event_bus import EventBus, Event, EventType
from .episodic_memory import EpisodicMemory
from .semantic_memory import SemanticMemory

logger = logging.getLogger(__name__)

from .models import WorkingMemoryItem

class WorkingMemory:
    """
    Manages working memory with features essential for AGI:
    - Limited capacity management
    - Attention focusing
    - Multi-item relationships
    - Priority-based retention
    - Cross-system coordination
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        episodic_memory: EpisodicMemory,
        semantic_memory: SemanticMemory,
        capacity: int = 7  # Miller's Law: 7 ± 2 items
    ):
        self.event_bus = event_bus
        self.episodic = episodic_memory
        self.semantic = semantic_memory
        self.capacity = capacity
        self.decay_rate = 0.1  # Activation decay per second
        self.activation_threshold = 0.2
        
        # Use OrderedDict for deterministic item removal
        self.items: OrderedDict[str, WorkingMemoryItem] = OrderedDict()
        self.last_update = time.time()
        
        # Register event handlers
        self.event_bus.subscribe(EventType.MEMORY, self._handle_focus_request)
        self.event_bus.subscribe(EventType.MEMORY, self._handle_clear_request)
        
    async def focus_on(
        self,
        content: Any,
        source: str,
        context: Dict[str, Any],
        importance: float = 0.5
    ) -> str:
        """
        Focus attention on new information
        Returns: item_id if successful
        """
        try:
            # Update activation levels and remove decayed items
            await self._update_activations()
            
            # Create new item
            item = WorkingMemoryItem(
                content=content,
                source=source,
                activation=importance,
                timestamp=time.time(),
                context=context,
                dependencies=await self._find_dependencies(content, context)
            )
            
            # Generate unique ID
            item_id = f"wm_{time.time()}_{hash(str(content))}"
            
            # Check capacity
            if len(self.items) >= self.capacity:
                await self._make_room()
                
            # Add item
            self.items[item_id] = item
            
            # Notify event bus
            await self.event_bus.publish(Event(
                type=EventType.MEMORY,
                payload={
                    "action": "focus",
                    "item_id": item_id,
                    "content": content
                },
                timestamp=time.time(),
                source="working_memory",
                correlation_id=item_id
            ))
            
            logger.info(f"Focused on new item: {item_id}")
            return item_id
            
        except Exception as e:
            logger.error(f"Failed to focus on new item: {str(e)}")
            raise
            
    async def get_active_items(
        self,
        min_activation: float = None
    ) -> List[Tuple[str, WorkingMemoryItem]]:
        """Get currently active items in working memory"""
        await self._update_activations()
        
        threshold = min_activation or self.activation_threshold
        return [
            (id, item) for id, item in self.items.items()
            if item.activation >= threshold
        ]
        
    async def clear_item(self, item_id: str):
        """Remove specific item from working memory"""
        if item_id in self.items:
            item = self.items.pop(item_id)
            
            # Store in long-term memory if needed
            if item.source == 'sensory' and item.activation > 0.5:
                if item.context.get('type') == 'experience':
                    await self.episodic.store_experience(
                        item.content,
                        item.context,
                        item.context.get('emotions', {})
                    )
                else:
                    await self.semantic.learn_concept(
                        str(item.content),
                        item.context,
                        'working_memory',
                        item.activation
                    )
                    
            await self.event_bus.publish(Event(
                type=EventType.MEMORY,
                payload={
                    "action": "clear",
                    "item_id": item_id
                },
                timestamp=time.time(),
                source="working_memory",
                correlation_id=item_id
            ))
            
    async def _update_activations(self):
        """Update activation levels of all items"""
        current_time = time.time()
        elapsed = current_time - self.last_update
        
        # Update activations
        items_to_remove = []
        for id, item in self.items.items():
            # Apply decay
            item.activation *= np.exp(-self.decay_rate * elapsed)
            
            # Check if below threshold
            if item.activation < self.activation_threshold:
                items_to_remove.append(id)
                
        # Remove decayed items
        for id in items_to_remove:
            await self.clear_item(id)
            
        self.last_update = current_time
        
    async def _make_room(self):
        """Remove least important item if at capacity"""
        if not self.items:
            return
            
        # Find item with lowest activation
        min_id = min(
            self.items.items(),
            key=lambda x: x[1].activation
        )[0]
        
        await self.clear_item(min_id)
        
    async def _find_dependencies(
        self,
        content: Any,
        context: Dict[str, Any]
    ) -> List[str]:
        """Find dependencies with other items in working memory"""
        dependencies = []
        
        # Check semantic relationships
        if isinstance(content, str):
            concepts = await self.semantic.query_knowledge(content)
            for concept in concepts:
                for id, item in self.items.items():
                    if (isinstance(item.content, str) and
                        item.content in concept['relationships'].get('related', [])):
                        dependencies.append(id)
                        
        # Check contextual relationships
        for id, item in self.items.items():
            if self._context_overlap(item.context, context) > 0.7:
                dependencies.append(id)
                
        return dependencies
        
    def _context_overlap(
        self,
        context1: Dict[str, Any],
        context2: Dict[str, Any]
    ) -> float:
        """Calculate context similarity"""
        # Get common keys
        common_keys = set(context1.keys()) & set(context2.keys())
        if not common_keys:
            return 0.0
            
        # Calculate similarity for common attributes
        similarities = []
        for key in common_keys:
            if context1[key] == context2[key]:
                similarities.append(1.0)
            else:
                similarities.append(0.3)  # Partial match
                
        return sum(similarities) / len(common_keys)
        
    async def _handle_focus_request(self, event: Event):
        """Handle focus requests from event bus"""
        if event.payload.get('action') == 'focus':
            await self.focus_on(
                event.payload['content'],
                event.source,
                event.payload['context'],
                event.payload.get('importance', 0.5)
            )
        
    async def _handle_clear_request(self, event: Event):
        """Handle clear requests from event bus"""
        if event.payload.get('action') == 'clear':
            await self.clear_item(event.payload['item_id'])
