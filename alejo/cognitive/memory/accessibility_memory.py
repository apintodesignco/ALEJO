"""
Accessibility Memory Module

This module provides a specialized memory system for accessibility features.
It tracks user interaction patterns, preferences, and adaptation needs to
provide personalized accessibility experiences.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set, Union, Callable

import numpy as np

from alejo.cognitive.memory.models import MemoryType
from alejo.cognitive.memory.working_memory import WorkingMemory
from alejo.performance.cache_decorator import cached

# Configure logging
logger = logging.getLogger(__name__)

class AccessibilityMemoryItem:
    """Represents an accessibility-related memory item.
    
    Attributes:
        id: Unique identifier for this memory item
        feature_id: Identifier of the accessibility feature this relates to
        modality: Input/output modality (eye, voice, gesture, etc.)
        context: Context in which this memory was created
        preferences: User preferences for this feature
        effectiveness: How effective this feature was for the user
        timestamp: When this memory was created or last updated
        activation: Current activation level in memory
        metadata: Additional metadata about this memory
    """
    
    def __init__(self, 
                 id: str,
                 feature_id: str,
                 modality: str,
                 context: Dict[str, Any],
                 preferences: Dict[str, Any],
                 effectiveness: float = 0.0,
                 timestamp: Optional[datetime] = None,
                 activation: float = 1.0,
                 metadata: Optional[Dict[str, Any]] = None):
        """Initialize a new accessibility memory item.
        
        Args:
            id: Unique identifier for this memory item
            feature_id: Identifier of the accessibility feature
            modality: Input/output modality (eye, voice, gesture, etc.)
            context: Context in which this memory was created
            preferences: User preferences for this feature
            effectiveness: How effective this feature was (0.0-1.0)
            timestamp: When this memory was created/updated
            activation: Initial activation level (0.0-1.0)
            metadata: Additional metadata about this memory
        """
        self.id = id
        self.feature_id = feature_id
        self.modality = modality
        self.context = context or {}
        self.preferences = preferences or {}
        self.effectiveness = max(0.0, min(1.0, effectiveness))
        self.timestamp = timestamp or datetime.now()
        self.activation = activation
        self.metadata = metadata or {}
        self.access_count = 0
        self.last_accessed = self.timestamp
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert this memory item to a dictionary.
        
        Returns:
            Dictionary representation of this memory item
        """
        return {
            "id": self.id,
            "feature_id": self.feature_id,
            "modality": self.modality,
            "context": self.context,
            "preferences": self.preferences,
            "effectiveness": self.effectiveness,
            "timestamp": self.timestamp.isoformat(),
            "activation": self.activation,
            "metadata": self.metadata,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed.isoformat()
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AccessibilityMemoryItem':
        """Create a memory item from a dictionary.
        
        Args:
            data: Dictionary representation of a memory item
            
        Returns:
            New AccessibilityMemoryItem instance
        """
        # Convert ISO format strings to datetime objects
        timestamp = datetime.fromisoformat(data["timestamp"]) if isinstance(data["timestamp"], str) else data["timestamp"]
        last_accessed = datetime.fromisoformat(data["last_accessed"]) if isinstance(data["last_accessed"], str) else data["last_accessed"]
        
        item = cls(
            id=data["id"],
            feature_id=data["feature_id"],
            modality=data["modality"],
            context=data["context"],
            preferences=data["preferences"],
            effectiveness=data["effectiveness"],
            timestamp=timestamp,
            activation=data["activation"],
            metadata=data["metadata"]
        )
        item.access_count = data["access_count"]
        item.last_accessed = last_accessed
        return item


class AccessibilityMemory:
    """Memory system specialized for accessibility features.
    
    This system maintains memories of user interactions with accessibility features,
    tracks preferences, and learns patterns to provide personalized experiences.
    It integrates with the working memory system but provides specialized
    functionality for accessibility needs.
    
    Attributes:
        memory_store: Persistent storage for accessibility memories
        event_bus: Event bus for publishing memory events
        working_memory: Reference to the working memory system
        items: Dictionary of accessibility memory items by ID
        feature_index: Index of memory items by feature ID
        modality_index: Index of memory items by modality
        context_index: Index of memory items by context keys
    """
    
    def __init__(self, memory_store=None, event_bus=None, working_memory=None):
        """Initialize the accessibility memory system.
        
        Args:
            memory_store: Persistent storage for memory items
            event_bus: Event bus for publishing memory events
            working_memory: Reference to the working memory system
        """
        self.memory_store = memory_store
        self.event_bus = event_bus
        self.working_memory = working_memory
        self.items = {}
        self.feature_index = {}
        self.modality_index = {}
        self.context_index = {}
        self.adaptation_history = []
        self._running = False
        
    async def start(self):
        """Start the accessibility memory system."""
        if self._running:
            return
            
        self._running = True
        logger.info("Starting accessibility memory system")
        
        # Load existing memories from storage if available
        if self.memory_store:
            try:
                stored_items = await asyncio.to_thread(
                    self.memory_store.get, "accessibility_memories", {}
                )
                for item_dict in stored_items.values():
                    item = AccessibilityMemoryItem.from_dict(item_dict)
                    self._add_item_to_indices(item)
                logger.info(f"Loaded {len(stored_items)} accessibility memories from storage")
            except Exception as e:
                logger.error(f"Failed to load accessibility memories: {e}")
        
        # Subscribe to relevant events
        if self.event_bus:
            self.event_bus.subscribe("accessibility:feature:used", self._on_feature_used)
            self.event_bus.subscribe("accessibility:preference:changed", self._on_preference_changed)
            self.event_bus.subscribe("accessibility:effectiveness:feedback", self._on_effectiveness_feedback)
            self.event_bus.subscribe("user:context:changed", self._on_context_changed)
            self.event_bus.subscribe("user:fatigue:detected", self._on_fatigue_detected)
            
    async def stop(self):
        """Stop the accessibility memory system."""
        if not self._running:
            return
            
        self._running = False
        logger.info("Stopping accessibility memory system")
        
        # Unsubscribe from events
        if self.event_bus:
            self.event_bus.unsubscribe("accessibility:feature:used", self._on_feature_used)
            self.event_bus.unsubscribe("accessibility:preference:changed", self._on_preference_changed)
            self.event_bus.unsubscribe("accessibility:effectiveness:feedback", self._on_effectiveness_feedback)
            self.event_bus.unsubscribe("user:context:changed", self._on_context_changed)
            self.event_bus.unsubscribe("user:fatigue:detected", self._on_fatigue_detected)
        
        # Save memories to storage
        if self.memory_store:
            try:
                items_dict = {item.id: item.to_dict() for item in self.items.values()}
                await asyncio.to_thread(
                    self.memory_store.set, "accessibility_memories", items_dict
                )
                logger.info(f"Saved {len(items_dict)} accessibility memories to storage")
            except Exception as e:
                logger.error(f"Failed to save accessibility memories: {e}")
                
    def _add_item_to_indices(self, item):
        """Add a memory item to all indices.
        
        Args:
            item: The AccessibilityMemoryItem to add
        """
        # Add to main items dictionary
        self.items[item.id] = item
        
        # Add to feature index
        if item.feature_id not in self.feature_index:
            self.feature_index[item.feature_id] = set()
        self.feature_index[item.feature_id].add(item.id)
        
        # Add to modality index
        if item.modality not in self.modality_index:
            self.modality_index[item.modality] = set()
        self.modality_index[item.modality].add(item.id)
        
        # Add to context index
        for key in item.context:
            if key not in self.context_index:
                self.context_index[key] = set()
            self.context_index[key].add(item.id)
            
    def _remove_item_from_indices(self, item_id):
        """Remove a memory item from all indices.
        
        Args:
            item_id: ID of the item to remove
        """
        if item_id not in self.items:
            return
            
        item = self.items[item_id]
        
        # Remove from feature index
        if item.feature_id in self.feature_index:
            self.feature_index[item.feature_id].discard(item_id)
            
        # Remove from modality index
        if item.modality in self.modality_index:
            self.modality_index[item.modality].discard(item_id)
            
        # Remove from context index
        for key in item.context:
            if key in self.context_index:
                self.context_index[key].discard(item_id)
                
        # Remove from main items dictionary
        del self.items[item_id]
        
    async def _on_feature_used(self, event):
        """Handle accessibility feature usage events.
        
        Args:
            event: Event data containing feature usage information
        """
        feature_id = event.get("feature_id")
        modality = event.get("modality")
        context = event.get("context", {})
        
        if not feature_id or not modality:
            return
            
        # Look for existing memory for this feature
        existing_items = self.find_by_feature_and_modality(feature_id, modality)
        
        if existing_items:
            # Update existing memory
            item = existing_items[0]
            item.access_count += 1
            item.last_accessed = datetime.now()
            item.activation = min(1.0, item.activation + 0.2)
            
            # Update context if new information is available
            for key, value in context.items():
                item.context[key] = value
                
            logger.debug(f"Updated accessibility memory for feature {feature_id}")
        else:
            # Create new memory
            item_id = f"acc_mem_{feature_id}_{modality}_{int(time.time())}"
            item = AccessibilityMemoryItem(
                id=item_id,
                feature_id=feature_id,
                modality=modality,
                context=context,
                preferences={},
                effectiveness=0.5,  # Default neutral effectiveness
                timestamp=datetime.now(),
                activation=1.0
            )
            self._add_item_to_indices(item)
            logger.debug(f"Created new accessibility memory for feature {feature_id}")
            
        # Notify working memory if available
        if self.working_memory:
            await self.working_memory.add_reference(
                type=MemoryType.ACCESSIBILITY,
                reference_id=item.id,
                content=f"Accessibility feature {feature_id} used with {modality}",
                metadata={
                    "feature_id": feature_id,
                    "modality": modality,
                    "context": context
                }
            )
            
    async def _on_preference_changed(self, event):
        """Handle accessibility preference change events.
        
        Args:
            event: Event data containing preference change information
        """
        feature_id = event.get("feature_id")
        modality = event.get("modality")
        preferences = event.get("preferences", {})
        
        if not feature_id or not preferences:
            return
            
        # Look for existing memory for this feature
        existing_items = self.find_by_feature_and_modality(feature_id, modality)
        
        if existing_items:
            # Update existing memory
            item = existing_items[0]
            item.preferences.update(preferences)
            item.timestamp = datetime.now()
            item.activation = min(1.0, item.activation + 0.2)
            logger.debug(f"Updated preferences for feature {feature_id}")
        else:
            # Create new memory
            item_id = f"acc_mem_{feature_id}_{modality}_{int(time.time())}"
            item = AccessibilityMemoryItem(
                id=item_id,
                feature_id=feature_id,
                modality=modality,
                context={},
                preferences=preferences,
                timestamp=datetime.now(),
                activation=1.0
            )
            self._add_item_to_indices(item)
            logger.debug(f"Created new accessibility memory with preferences for feature {feature_id}")
            
    async def _on_effectiveness_feedback(self, event):
        """Handle feedback about feature effectiveness.
        
        Args:
            event: Event data containing effectiveness feedback
        """
        feature_id = event.get("feature_id")
        modality = event.get("modality")
        effectiveness = event.get("effectiveness")
        
        if not feature_id or effectiveness is None:
            return
            
        # Look for existing memory for this feature
        existing_items = self.find_by_feature_and_modality(feature_id, modality)
        
        if existing_items:
            # Update existing memory
            item = existing_items[0]
            # Blend new effectiveness with existing (70% old, 30% new)
            item.effectiveness = (item.effectiveness * 0.7) + (effectiveness * 0.3)
            item.timestamp = datetime.now()
            logger.debug(f"Updated effectiveness for feature {feature_id}: {item.effectiveness:.2f}")
            
            # Record adaptation if effectiveness is low
            if item.effectiveness < 0.4:
                self._record_adaptation_need(feature_id, modality, item.effectiveness)
                
    async def _on_context_changed(self, event):
        """Handle user context change events.
        
        Args:
            event: Event data containing context change information
        """
        context = event.get("context", {})
        
        if not context:
            return
            
        # Find memories related to this context
        related_items = self.find_by_context(context)
        
        for item in related_items:
            # Update context in memory
            for key, value in context.items():
                item.context[key] = value
                
            # Boost activation as this context is currently relevant
            item.activation = min(1.0, item.activation + 0.1)
            
        logger.debug(f"Updated {len(related_items)} memories with new context")
        
    async def _on_fatigue_detected(self, event):
        """Handle user fatigue detection events.
        
        Args:
            event: Event data containing fatigue information
        """
        fatigue_level = event.get("level", 0.0)
        modality = event.get("modality")
        
        if not modality or fatigue_level < 0.4:  # Only respond to significant fatigue
            return
            
        # Find memories related to this modality
        related_items = self.find_by_modality(modality)
        
        # Record adaptation need for fatigue
        self._record_adaptation_need(
            feature_id="fatigue_adaptation",
            modality=modality,
            effectiveness=1.0 - fatigue_level,
            context={"fatigue_level": fatigue_level}
        )
        
        logger.debug(f"Recorded fatigue adaptation need for {modality}: {fatigue_level:.2f}")
        
    def _record_adaptation_need(self, feature_id, modality, effectiveness, context=None):
        """Record an adaptation need for later analysis.
        
        Args:
            feature_id: ID of the feature needing adaptation
            modality: Modality related to the adaptation
            effectiveness: Current effectiveness triggering adaptation
            context: Optional context information
        """
        self.adaptation_history.append({
            "feature_id": feature_id,
            "modality": modality,
            "effectiveness": effectiveness,
            "context": context or {},
            "timestamp": datetime.now()
        })
        
        # Keep adaptation history manageable
        if len(self.adaptation_history) > 100:
            self.adaptation_history = self.adaptation_history[-100:]
            
    def find_by_feature_and_modality(self, feature_id, modality):
        """Find memory items by feature ID and modality.
        
        Args:
            feature_id: Feature ID to search for
            modality: Modality to search for
            
        Returns:
            List of matching AccessibilityMemoryItems
        """
        if feature_id not in self.feature_index:
            return []
            
        feature_items = self.feature_index[feature_id]
        
        if modality:
            if modality not in self.modality_index:
                return []
                
            modality_items = self.modality_index[modality]
            item_ids = feature_items.intersection(modality_items)
        else:
            item_ids = feature_items
            
        return [self.items[item_id] for item_id in item_ids if item_id in self.items]
        
    def find_by_modality(self, modality):
        """Find memory items by modality.
        
        Args:
            modality: Modality to search for
            
        Returns:
            List of matching AccessibilityMemoryItems
        """
        if modality not in self.modality_index:
            return []
            
        return [self.items[item_id] for item_id in self.modality_index[modality] 
                if item_id in self.items]
                
    def find_by_context(self, context):
        """Find memory items related to a context.
        
        Args:
            context: Dictionary of context key-values to match
            
        Returns:
            List of matching AccessibilityMemoryItems
        """
        matching_ids = set()
        first = True
        
        for key, value in context.items():
            if key not in self.context_index:
                continue
                
            key_items = self.context_index[key]
            
            # Filter to items that have this context key-value
            matching_key_items = {
                item_id for item_id in key_items
                if item_id in self.items and 
                key in self.items[item_id].context and
                self.items[item_id].context[key] == value
            }
            
            if first:
                matching_ids = matching_key_items
                first = False
            else:
                matching_ids = matching_ids.intersection(matching_key_items)
                
        return [self.items[item_id] for item_id in matching_ids]
        
    async def get_preferred_settings(self, feature_id, modality=None, context=None):
        """Get preferred settings for a feature based on memory.
        
        Args:
            feature_id: ID of the feature to get settings for
            modality: Optional modality to filter by
            context: Optional context to consider
            
        Returns:
            Dictionary of preferred settings
        """
        # Find memories for this feature
        items = self.find_by_feature_and_modality(feature_id, modality)
        
        if not items:
            return {}
            
        # If context provided, prioritize context-relevant memories
        if context:
            context_items = self.find_by_context(context)
            context_item_ids = {item.id for item in context_items}
            
            # Prioritize items that match both feature and context
            prioritized_items = [item for item in items if item.id in context_item_ids]
            
            if prioritized_items:
                items = prioritized_items
                
        # Sort by effectiveness and recency
        sorted_items = sorted(
            items,
            key=lambda x: (x.effectiveness, x.last_accessed.timestamp()),
            reverse=True
        )
        
        # Return preferences from the most effective/recent item
        if sorted_items:
            return sorted_items[0].preferences.copy()
            
        return {}
        
    async def get_adaptation_recommendations(self, modality=None, context=None):
        """Get recommendations for adaptations based on memory patterns.
        
        Args:
            modality: Optional modality to filter by
            context: Optional context to consider
            
        Returns:
            List of adaptation recommendations
        """
        # Analyze adaptation history for patterns
        if not self.adaptation_history:
            return []
            
        # Filter by modality if specified
        history = self.adaptation_history
        if modality:
            history = [entry for entry in history if entry["modality"] == modality]
            
        # Group by feature_id
        feature_groups = {}
        for entry in history:
            feature_id = entry["feature_id"]
            if feature_id not in feature_groups:
                feature_groups[feature_id] = []
            feature_groups[feature_id].append(entry)
            
        # Generate recommendations
        recommendations = []
        
        for feature_id, entries in feature_groups.items():
            # Calculate average effectiveness
            avg_effectiveness = sum(e["effectiveness"] for e in entries) / len(entries)
            
            # Only recommend changes for features with low effectiveness
            if avg_effectiveness < 0.5:
                # Find the most common context values
                context_values = {}
                for entry in entries:
                    for key, value in entry["context"].items():
                        if key not in context_values:
                            context_values[key] = {}
                        if value not in context_values[key]:
                            context_values[key][value] = 0
                        context_values[key][value] += 1
                
                # Create recommendation
                recommendations.append({
                    "feature_id": feature_id,
                    "modality": entries[0]["modality"],
                    "effectiveness": avg_effectiveness,
                    "frequency": len(entries),
                    "context_patterns": context_values,
                    "recommendation_type": "adaptation_needed"
                })
                
        # Sort by frequency and effectiveness (lower effectiveness = higher priority)
        recommendations.sort(key=lambda x: (x["frequency"], 1.0 - x["effectiveness"]), reverse=True)
        
        return recommendations
        
    async def record_successful_adaptation(self, feature_id, modality, context=None, preferences=None):
        """Record a successful adaptation for future reference.
        
        Args:
            feature_id: ID of the adapted feature
            modality: Modality that was adapted
            context: Context in which adaptation was successful
            preferences: Settings that worked well
        """
        # Create or update memory item
        items = self.find_by_feature_and_modality(feature_id, modality)
        
        if items:
            item = items[0]
            # Update with successful adaptation
            item.effectiveness = min(1.0, item.effectiveness + 0.2)
            if preferences:
                item.preferences.update(preferences)
            if context:
                item.context.update(context)
            item.timestamp = datetime.now()
            item.activation = 1.0  # Boost activation for successful adaptations
        else:
            # Create new memory for successful adaptation
            item_id = f"acc_mem_{feature_id}_{modality}_{int(time.time())}"
            item = AccessibilityMemoryItem(
                id=item_id,
                feature_id=feature_id,
                modality=modality,
                context=context or {},
                preferences=preferences or {},
                effectiveness=0.8,  # High effectiveness for successful adaptation
                timestamp=datetime.now(),
                activation=1.0
            )
            self._add_item_to_indices(item)
            
        logger.info(f"Recorded successful adaptation for {feature_id} with {modality}")
        
        # Publish event if event bus available
        if self.event_bus:
            self.event_bus.publish(
                "accessibility:adaptation:successful",
                {
                    "feature_id": feature_id,
                    "modality": modality,
                    "context": context,
                    "preferences": preferences
                }
            )
