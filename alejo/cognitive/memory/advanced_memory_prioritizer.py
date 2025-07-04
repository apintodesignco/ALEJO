"""
ALEJO Advanced Memory Prioritization System

This module extends the base memory prioritization system with advanced algorithms
for determining memory relevance, including contextual importance, temporal patterns,
relationship significance, and adaptive weighting based on user behavior.
"""

import logging
import math
import time
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable

import numpy as np

from alejo.cognitive.memory.memory_prioritizer import MemoryPrioritizer, PriorityFactor
from alejo.cognitive.memory.models import Episode, MemoryType, Concept
from alejo.cognitive.memory.entity_graph import PersonalEntityGraph
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_errors

logger = logging.getLogger(__name__)


class AdvancedPriorityFactor(Enum):
    """Advanced factors that influence memory priority."""
    TEMPORAL_PATTERN = "temporal_pattern"   # Recurring patterns in memory access
    RELATIONSHIP = "relationship"           # Connection to important relationships
    GOAL_RELEVANCE = "goal_relevance"       # Relevance to current user goals
    NARRATIVE = "narrative"                 # Part of an important narrative
    NOVELTY = "novelty"                     # Uniqueness or novelty of the memory
    PREDICTIVE = "predictive"               # Predictive value for future events


class AdvancedMemoryPrioritizer(MemoryPrioritizer):
    """
    Advanced memory prioritization system with sophisticated algorithms.
    
    This system extends the base MemoryPrioritizer with more advanced techniques
    for determining memory relevance, including contextual importance, temporal
    patterns, relationship significance, and adaptive weighting based on user behavior.
    """
    
    def __init__(
        self,
        entity_graph: Optional[PersonalEntityGraph] = None,
        event_bus: Optional[EventBus] = None
    ):
        """Initialize the advanced memory prioritizer.
        
        Args:
            entity_graph: Personal entity graph for relationship context
            event_bus: Event bus for publishing prioritization events
        """
        super().__init__(event_bus=event_bus)
        
        self.entity_graph = entity_graph
        
        # Extended weights for advanced priority factors
        self.advanced_factor_weights = {
            AdvancedPriorityFactor.TEMPORAL_PATTERN: 0.10,
            AdvancedPriorityFactor.RELATIONSHIP: 0.15,
            AdvancedPriorityFactor.GOAL_RELEVANCE: 0.10,
            AdvancedPriorityFactor.NARRATIVE: 0.05,
            AdvancedPriorityFactor.NOVELTY: 0.05,
            AdvancedPriorityFactor.PREDICTIVE: 0.05
        }
        
        # Adjust base factor weights to accommodate advanced factors
        total_advanced_weight = sum(self.advanced_factor_weights.values())
        scaling_factor = (1.0 - total_advanced_weight) / sum(self.factor_weights.values())
        
        for factor in self.factor_weights:
            self.factor_weights[factor] *= scaling_factor
            
        # Temporal pattern detection
        self.temporal_patterns = {}  # memory_id -> pattern data
        
        # User goals and interests
        self.user_goals = []
        self.user_interests = {}  # topic -> interest level (0.0 to 1.0)
        
        # Narrative tracking
        self.narratives = {}  # narrative_id -> {memory_ids, importance}
        
        # Adaptive learning rate
        self.learning_rate = 0.05
        
        # Memory importance decay parameters
        self.importance_decay_rate = 0.01  # Daily decay rate for non-reinforced memories
        
        # Cache for computed priority scores
        self._priority_cache = {}  # (memory_id, context_hash) -> (score, timestamp)
        self._cache_ttl = 300  # 5 minutes
        
        logger.info("Advanced memory prioritization system initialized")
        
    @handle_errors("Failed to calculate advanced priority score")
    def calculate_priority(
        self,
        memory_id: str,
        memory: Any,
        context: Optional[Dict[str, Any]] = None,
        current_time: Optional[datetime] = None
    ) -> float:
        """Calculate the priority score for a memory with advanced factors.
        
        Args:
            memory_id: ID of the memory
            memory: Memory object (Episode, Concept, etc.)
            context: Optional context for relevance calculation
            current_time: Current time for recency calculation
            
        Returns:
            Priority score between 0.0 and 1.0
        """
        current_time = current_time or datetime.now()
        context = context or {}
        
        # Generate context hash for caching
        context_hash = hash(frozenset(context.items())) if context else 0
        cache_key = (memory_id, context_hash)
        
        # Check cache
        if cache_key in self._priority_cache:
            cached_score, cached_time = self._priority_cache[cache_key]
            if (current_time - cached_time).total_seconds() < self._cache_ttl:
                return cached_score
        
        # Get base priority score from parent class
        base_score = super().calculate_priority(memory_id, memory, context, current_time)
        
        # Calculate advanced factor scores
        advanced_factor_scores = {}
        
        # Temporal pattern score
        advanced_factor_scores[AdvancedPriorityFactor.TEMPORAL_PATTERN] = self._calculate_temporal_pattern_score(memory_id)
        
        # Relationship score
        advanced_factor_scores[AdvancedPriorityFactor.RELATIONSHIP] = self._calculate_relationship_score(memory, context)
        
        # Goal relevance score
        advanced_factor_scores[AdvancedPriorityFactor.GOAL_RELEVANCE] = self._calculate_goal_relevance_score(memory, context)
        
        # Narrative score
        advanced_factor_scores[AdvancedPriorityFactor.NARRATIVE] = self._calculate_narrative_score(memory_id)
        
        # Novelty score
        advanced_factor_scores[AdvancedPriorityFactor.NOVELTY] = self._calculate_novelty_score(memory)
        
        # Predictive score
        advanced_factor_scores[AdvancedPriorityFactor.PREDICTIVE] = self._calculate_predictive_score(memory, context)
        
        # Calculate weighted advanced score
        advanced_score = 0.0
        for factor, score in advanced_factor_scores.items():
            weight = self.advanced_factor_weights.get(factor, 0.0)
            advanced_score += score * weight
            
        # Combine base score and advanced score
        final_score = base_score + advanced_score
        
        # Ensure score is between 0 and 1
        final_score = max(0.0, min(1.0, final_score))
        
        # Cache the result
        self._priority_cache[cache_key] = (final_score, current_time)
        
        return final_score
        
    def update_user_goal(self, goal: str, importance: float = 0.5) -> None:
        """Update or add a user goal.
        
        Args:
            goal: Description of the goal
            importance: Importance of this goal (0.0 to 1.0)
        """
        # Check if goal already exists
        for i, (existing_goal, existing_importance) in enumerate(self.user_goals):
            if existing_goal == goal:
                self.user_goals[i] = (goal, importance)
                return
                
        # Add new goal
        self.user_goals.append((goal, importance))
        
        # Sort goals by importance
        self.user_goals.sort(key=lambda x: x[1], reverse=True)
        
    def remove_user_goal(self, goal: str) -> bool:
        """Remove a user goal.
        
        Args:
            goal: Goal to remove
            
        Returns:
            True if the goal was removed, False otherwise
        """
        for i, (existing_goal, _) in enumerate(self.user_goals):
            if existing_goal == goal:
                self.user_goals.pop(i)
                return True
                
        return False
        
    def update_user_interest(self, topic: str, interest_level: float) -> None:
        """Update or add a user interest.
        
        Args:
            topic: Topic of interest
            interest_level: Level of interest (0.0 to 1.0)
        """
        self.user_interests[topic] = interest_level
        
        # Clean up interests with very low levels
        to_remove = []
        for topic, level in self.user_interests.items():
            if level < 0.1:
                to_remove.append(topic)
                
        for topic in to_remove:
            del self.user_interests[topic]
            
    def add_memory_to_narrative(
        self,
        narrative_id: str,
        memory_id: str,
        importance: float = 0.5
    ) -> None:
        """Add a memory to a narrative.
        
        Args:
            narrative_id: ID of the narrative
            memory_id: ID of the memory to add
            importance: Importance of this memory in the narrative
        """
        if narrative_id not in self.narratives:
            self.narratives[narrative_id] = {
                "memory_ids": set(),
                "importance": 0.5
            }
            
        self.narratives[narrative_id]["memory_ids"].add(memory_id)
        
        # Update narrative importance based on memory importance
        current_importance = self.narratives[narrative_id]["importance"]
        self.narratives[narrative_id]["importance"] = max(current_importance, importance)
        
    def remove_memory_from_narrative(
        self,
        narrative_id: str,
        memory_id: str
    ) -> bool:
        """Remove a memory from a narrative.
        
        Args:
            narrative_id: ID of the narrative
            memory_id: ID of the memory to remove
            
        Returns:
            True if the memory was removed, False otherwise
        """
        if narrative_id not in self.narratives:
            return False
            
        if memory_id not in self.narratives[narrative_id]["memory_ids"]:
            return False
            
        self.narratives[narrative_id]["memory_ids"].remove(memory_id)
        
        # Remove narrative if empty
        if not self.narratives[narrative_id]["memory_ids"]:
            del self.narratives[narrative_id]
            
        return True
        
    def update_factor_weights(
        self,
        feedback: Dict[str, float],
        learning_rate: Optional[float] = None
    ) -> None:
        """Update factor weights based on feedback.
        
        Args:
            feedback: Dictionary mapping factor names to feedback values (-1.0 to 1.0)
            learning_rate: Learning rate for weight updates (optional)
        """
        learning_rate = learning_rate or self.learning_rate
        
        # Update base factor weights
        for factor_name, feedback_value in feedback.items():
            try:
                factor = PriorityFactor(factor_name)
                if factor in self.factor_weights:
                    self.factor_weights[factor] += learning_rate * feedback_value
            except ValueError:
                pass
                
        # Update advanced factor weights
        for factor_name, feedback_value in feedback.items():
            try:
                factor = AdvancedPriorityFactor(factor_name)
                if factor in self.advanced_factor_weights:
                    self.advanced_factor_weights[factor] += learning_rate * feedback_value
            except ValueError:
                pass
                
        # Normalize weights to sum to 1.0
        base_sum = sum(self.factor_weights.values())
        advanced_sum = sum(self.advanced_factor_weights.values())
        total_sum = base_sum + advanced_sum
        
        if total_sum > 0:
            for factor in self.factor_weights:
                self.factor_weights[factor] /= total_sum
                
            for factor in self.advanced_factor_weights:
                self.advanced_factor_weights[factor] /= total_sum
                
    def decay_memory_importance(self, days_elapsed: int = 1) -> None:
        """Decay the importance of memories over time.
        
        Args:
            days_elapsed: Number of days to simulate for decay
        """
        # This would be called periodically to decay memory importance
        # Implementation would depend on how memories are stored and accessed
        pass
        
    def _calculate_temporal_pattern_score(self, memory_id: str) -> float:
        """Calculate a score based on temporal access patterns.
        
        Args:
            memory_id: ID of the memory
            
        Returns:
            Temporal pattern score between 0.0 and 1.0
        """
        if memory_id not in self.access_history:
            return 0.0
            
        accesses = self.access_history[memory_id]
        if len(accesses) < 3:
            return 0.0
            
        # Check for daily pattern
        daily_pattern_score = self._check_periodic_pattern(accesses, timedelta(days=1))
        
        # Check for weekly pattern
        weekly_pattern_score = self._check_periodic_pattern(accesses, timedelta(days=7))
        
        # Return the stronger pattern
        return max(daily_pattern_score, weekly_pattern_score)
        
    def _check_periodic_pattern(
        self,
        timestamps: List[datetime],
        period: timedelta
    ) -> float:
        """Check if timestamps follow a periodic pattern.
        
        Args:
            timestamps: List of timestamps
            period: Expected period between accesses
            
        Returns:
            Pattern strength score between 0.0 and 1.0
        """
        if len(timestamps) < 3:
            return 0.0
            
        # Convert to seconds
        period_seconds = period.total_seconds()
        
        # Calculate intervals between accesses
        intervals = []
        for i in range(1, len(timestamps)):
            interval = (timestamps[i] - timestamps[i-1]).total_seconds()
            intervals.append(interval)
            
        # Calculate how close intervals are to the expected period
        similarities = []
        for interval in intervals:
            # How many periods does this interval represent?
            periods = interval / period_seconds
            
            # How close is this to an integer number of periods?
            closest_integer = round(periods)
            similarity = 1.0 - min(abs(periods - closest_integer), 1.0)
            similarities.append(similarity)
            
        # Average similarity is our pattern strength
        return sum(similarities) / len(similarities) if similarities else 0.0
        
    def _calculate_relationship_score(
        self,
        memory: Any,
        context: Dict[str, Any]
    ) -> float:
        """Calculate a score based on relationship significance.
        
        Args:
            memory: Memory object
            context: Context dictionary
            
        Returns:
            Relationship score between 0.0 and 1.0
        """
        if not self.entity_graph:
            return 0.0
            
        # Extract entity IDs from memory and context
        memory_entity_ids = self._extract_entity_ids(memory)
        context_entity_ids = self._extract_entity_ids_from_context(context)
        
        if not memory_entity_ids or not context_entity_ids:
            return 0.0
            
        # Calculate relationship strengths between memory entities and context entities
        relationship_strengths = []
        
        for memory_entity_id in memory_entity_ids:
            for context_entity_id in context_entity_ids:
                # Skip if same entity
                if memory_entity_id == context_entity_id:
                    continue
                    
                # Get relationship strength
                relationships = self.entity_graph.get_relationships(
                    source_id=memory_entity_id,
                    target_id=context_entity_id
                )
                
                if relationships:
                    relationship_strengths.append(relationships[0].get("strength", 0.0))
                    
        # Return maximum relationship strength
        return max(relationship_strengths) if relationship_strengths else 0.0
        
    def _extract_entity_ids(self, memory: Any) -> List[str]:
        """Extract entity IDs from a memory.
        
        Args:
            memory: Memory object
            
        Returns:
            List of entity IDs
        """
        entity_ids = []
        
        # Extract from context if available
        if hasattr(memory, "context") and memory.context:
            entity_ids.extend(self._extract_entity_ids_from_context(memory.context))
            
        return entity_ids
        
    def _extract_entity_ids_from_context(self, context: Dict[str, Any]) -> List[str]:
        """Extract entity IDs from a context dictionary.
        
        Args:
            context: Context dictionary
            
        Returns:
            List of entity IDs
        """
        entity_ids = []
        
        # Extract entity_id if present
        if "entity_id" in context:
            entity_ids.append(context["entity_id"])
            
        # Extract from people list if present
        if "people" in context and isinstance(context["people"], list):
            entity_ids.extend(context["people"])
            
        # Extract from entities list if present
        if "entities" in context and isinstance(context["entities"], list):
            entity_ids.extend(context["entities"])
            
        return entity_ids
        
    def _calculate_goal_relevance_score(
        self,
        memory: Any,
        context: Dict[str, Any]
    ) -> float:
        """Calculate a score based on relevance to current user goals.
        
        Args:
            memory: Memory object
            context: Context dictionary
            
        Returns:
            Goal relevance score between 0.0 and 1.0
        """
        if not self.user_goals:
            return 0.0
            
        # Extract memory content
        content = ""
        if hasattr(memory, "content"):
            content = memory.content
            
        if not content:
            return 0.0
            
        # Calculate relevance to each goal
        relevance_scores = []
        
        for goal, importance in self.user_goals:
            # Simple keyword matching for now
            # In production, this would use semantic similarity
            keywords = goal.lower().split()
            content_lower = content.lower()
            
            matches = sum(1 for keyword in keywords if keyword in content_lower)
            relevance = min(1.0, matches / max(1, len(keywords))) * importance
            
            relevance_scores.append(relevance)
            
        # Return maximum relevance
        return max(relevance_scores) if relevance_scores else 0.0
        
    def _calculate_narrative_score(self, memory_id: str) -> float:
        """Calculate a score based on narrative importance.
        
        Args:
            memory_id: ID of the memory
            
        Returns:
            Narrative score between 0.0 and 1.0
        """
        # Check if memory is part of any narratives
        narrative_importances = []
        
        for narrative_id, narrative in self.narratives.items():
            if memory_id in narrative["memory_ids"]:
                narrative_importances.append(narrative["importance"])
                
        # Return maximum narrative importance
        return max(narrative_importances) if narrative_importances else 0.0
        
    def _calculate_novelty_score(self, memory: Any) -> float:
        """Calculate a score based on memory novelty.
        
        Args:
            memory: Memory object
            
        Returns:
            Novelty score between 0.0 and 1.0
        """
        # Base novelty on recency of creation and access frequency
        if not hasattr(memory, "timestamp"):
            return 0.0
            
        # Calculate time since creation
        time_since_creation = (datetime.now() - memory.timestamp).total_seconds()
        
        # Convert to days
        days_since_creation = time_since_creation / (24 * 60 * 60)
        
        # Novelty decays with age, but very slowly
        age_factor = math.exp(-days_since_creation / 365)  # Half-life of 1 year
        
        # Novelty also decreases with access frequency
        access_count = len(self.access_history.get(memory.id, []))
        frequency_factor = math.exp(-access_count / 10)  # Half-life of 10 accesses
        
        return age_factor * frequency_factor
        
    def _calculate_predictive_score(
        self,
        memory: Any,
        context: Dict[str, Any]
    ) -> float:
        """Calculate a score based on predictive value for future events.
        
        Args:
            memory: Memory object
            context: Context dictionary
            
        Returns:
            Predictive score between 0.0 and 1.0
        """
        # This would be more sophisticated in production
        # For now, return a placeholder value
        return 0.5
