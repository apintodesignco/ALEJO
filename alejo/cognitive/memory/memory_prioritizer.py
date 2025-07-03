"""
ALEJO Memory Prioritization System

This module implements a memory prioritization system that determines which
memories are most relevant and important in different contexts. It uses a
combination of recency, frequency, emotional significance, and explicit
importance markers to weight memories appropriately.
"""

import logging
import math
import time
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np

from alejo.cognitive.memory.models import Episode, MemoryType, Concept
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_errors

logger = logging.getLogger(__name__)


class PriorityFactor(Enum):
    """Factors that influence memory priority."""
    RECENCY = "recency"           # How recently the memory was accessed/created
    FREQUENCY = "frequency"       # How often the memory is accessed
    EMOTIONAL = "emotional"       # Emotional significance of the memory
    EXPLICIT = "explicit"         # Explicitly marked as important
    RELEVANCE = "relevance"       # Contextual relevance
    USER_ATTENTION = "attention"  # User has shown attention to this memory
    SEMANTIC = "semantic"         # Semantic similarity to current context


class MemoryPrioritizer:
    """
    Memory prioritization system for determining which memories are most important.
    
    This system assigns priority scores to memories based on multiple factors
    including recency, frequency, emotional significance, and explicit importance
    markers. These scores are used to surface the most relevant memories in
    different contexts.
    """
    
    def __init__(self, event_bus: EventBus = None):
        """Initialize the memory prioritizer.
        
        Args:
            event_bus: Event bus for publishing prioritization events
        """
        self.event_bus = event_bus
        
        # Default weights for different priority factors
        self.factor_weights = {
            PriorityFactor.RECENCY: 0.25,
            PriorityFactor.FREQUENCY: 0.15,
            PriorityFactor.EMOTIONAL: 0.15,
            PriorityFactor.EXPLICIT: 0.15,
            PriorityFactor.RELEVANCE: 0.1,
            PriorityFactor.USER_ATTENTION: 0.05,
            PriorityFactor.SEMANTIC: 0.15  # New semantic similarity factor
        }
        
        # Time decay parameters
        self.recency_half_life = timedelta(days=7)  # Time for recency score to halve
        
        # Access history for frequency calculation
        self.access_history = {}  # memory_id -> list of access timestamps
        self.max_history_length = 100  # Maximum number of accesses to track per memory
        
        logger.info("Memory prioritization system initialized")
    
    @handle_errors("Failed to calculate priority score")
    def calculate_priority(self, memory_id: str, memory: Any, 
                          context: Optional[Dict[str, Any]] = None,
                          current_time: Optional[datetime] = None) -> float:
        """Calculate the priority score for a memory.
        
        Args:
            memory_id: ID of the memory
            memory: Memory object (Episode, Concept, etc.)
            context: Optional context for relevance calculation
            current_time: Current time for recency calculation
            
        Returns:
            Priority score between 0.0 and 1.0
        """
        current_time = current_time or datetime.now()
        
        # Record access for frequency calculation
        self._record_access(memory_id, current_time)
        
        # Calculate individual factor scores
        factor_scores = {}
        
        # Recency score
        factor_scores[PriorityFactor.RECENCY] = self._calculate_recency_score(memory, current_time)
        
        # Frequency score
        factor_scores[PriorityFactor.FREQUENCY] = self._calculate_frequency_score(memory_id)
        
        # Emotional significance score
        factor_scores[PriorityFactor.EMOTIONAL] = self._calculate_emotional_score(memory)
        
        # Explicit importance score
        factor_scores[PriorityFactor.EXPLICIT] = self._calculate_explicit_score(memory)
        
        # Relevance score (if context provided)
        if context:
            factor_scores[PriorityFactor.RELEVANCE] = self._calculate_relevance_score(memory, context)
        else:
            factor_scores[PriorityFactor.RELEVANCE] = 0.0
        
        # User attention score
        factor_scores[PriorityFactor.USER_ATTENTION] = self._calculate_attention_score(memory_id)
        
        # Semantic similarity score (if context provided and embeddings available)
        if context and 'embedding' in context:
            factor_scores[PriorityFactor.SEMANTIC] = self._calculate_semantic_score(memory, context)
        else:
            factor_scores[PriorityFactor.SEMANTIC] = 0.0
        
        # Calculate weighted sum
        priority_score = 0.0
        for factor, score in factor_scores.items():
            priority_score += score * self.factor_weights[factor]
        
        # Ensure score is between 0 and 1
        priority_score = max(0.0, min(1.0, priority_score))
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.MEMORY_PRIORITIZED,
                {
                    "memory_id": memory_id,
                    "priority_score": priority_score,
                    "factor_scores": {f.value: s for f, s in factor_scores.items()}
                }
            )
        
        return priority_score
    
    @handle_errors("Failed to prioritize memories")
    def prioritize_memories(self, memories: Dict[str, Any], 
                           context: Optional[Dict[str, Any]] = None,
                           limit: Optional[int] = None) -> List[Tuple[str, float]]:
        """Prioritize a set of memories based on their importance.
        
        Args:
            memories: Dictionary mapping memory IDs to memory objects
            context: Optional context for relevance calculation
            limit: Maximum number of memories to return
            
        Returns:
            List of (memory_id, priority_score) tuples, sorted by priority
        """
        current_time = datetime.now()
        
        # Calculate priority scores for all memories
        priority_scores = []
        for memory_id, memory in memories.items():
            score = self.calculate_priority(memory_id, memory, context, current_time)
            priority_scores.append((memory_id, score))
        
        # Sort by priority score (descending)
        priority_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Limit results if requested
        if limit is not None:
            priority_scores = priority_scores[:limit]
        
        return priority_scores
    
    @handle_errors("Failed to adjust factor weights")
    def adjust_factor_weights(self, new_weights: Dict[PriorityFactor, float]) -> None:
        """Adjust the weights for different priority factors.
        
        Args:
            new_weights: Dictionary mapping factors to new weights
        """
        # Validate weights
        total_weight = sum(new_weights.values())
        if not (0.99 <= total_weight <= 1.01):  # Allow small rounding errors
            logger.warning("Total weight should be 1.0, got %.2f. Normalizing weights.", total_weight)
            # Normalize weights
            for factor in new_weights:
                new_weights[factor] /= total_weight
        
        # Update weights
        for factor, weight in new_weights.items():
            if factor in self.factor_weights:
                self.factor_weights[factor] = weight
        
        logger.info("Adjusted factor weights: %s", 
                   {f.value: w for f, w in self.factor_weights.items()})
    
    @handle_errors("Failed to record user attention")
    def record_user_attention(self, memory_id: str, attention_level: float = 1.0) -> None:
        """Record that the user has shown attention to a memory.
        
        Args:
            memory_id: ID of the memory
            attention_level: Level of attention (0.0 to 1.0)
        """
        # Store attention level with timestamp
        if memory_id not in self.access_history:
            self.access_history[memory_id] = []
        
        self.access_history[memory_id].append({
            "timestamp": datetime.now(),
            "attention": attention_level
        })
        
        # Trim history if needed
        if len(self.access_history[memory_id]) > self.max_history_length:
            self.access_history[memory_id] = self.access_history[memory_id][-self.max_history_length:]
    
    def _record_access(self, memory_id: str, timestamp: datetime) -> None:
        """Record an access to a memory for frequency calculation.
        
        Args:
            memory_id: ID of the memory
            timestamp: Time of access
        """
        if memory_id not in self.access_history:
            self.access_history[memory_id] = []
        
        self.access_history[memory_id].append({
            "timestamp": timestamp,
            "attention": 0.0  # Default attention level
        })
        
        # Trim history if needed
        if len(self.access_history[memory_id]) > self.max_history_length:
            self.access_history[memory_id] = self.access_history[memory_id][-self.max_history_length:]
    
    def _calculate_recency_score(self, memory: Any, current_time: datetime) -> float:
        """Calculate recency score based on when the memory was last accessed.
        
        Args:
            memory: Memory object
            current_time: Current time
            
        Returns:
            Recency score between 0.0 and 1.0
        """
        # Get last accessed time
        if hasattr(memory, "last_accessed") and memory.last_accessed:
            last_accessed = memory.last_accessed
        else:
            # Fall back to creation time
            if hasattr(memory, "timestamp"):
                last_accessed = memory.timestamp
            elif hasattr(memory, "created_at"):
                last_accessed = memory.created_at
            else:
                # No timestamp available
                return 0.5  # Default middle value
        
        # Convert to datetime if needed
        if isinstance(last_accessed, float):
            last_accessed = datetime.fromtimestamp(last_accessed)
        
        # Calculate time difference
        time_diff = current_time - last_accessed
        
        # Calculate decay factor using half-life formula
        decay = 0.5 ** (time_diff / self.recency_half_life)
        
        return decay
    
    def _calculate_frequency_score(self, memory_id: str) -> float:
        """Calculate frequency score based on how often the memory is accessed.
        
        Args:
            memory_id: ID of the memory
            
        Returns:
            Frequency score between 0.0 and 1.0
        """
        if memory_id not in self.access_history:
            return 0.0
        
        # Count accesses in the last week
        recent_count = 0
        week_ago = datetime.now() - timedelta(days=7)
        
        for access in self.access_history[memory_id]:
            if access["timestamp"] >= week_ago:
                recent_count += 1
        
        # Normalize score (0 to 10+ accesses maps to 0.0 to 1.0)
        return min(1.0, recent_count / 10.0)
    
    def _calculate_emotional_score(self, memory: Any) -> float:
        """Calculate emotional significance score.
        
        Args:
            memory: Memory object
            
        Returns:
            Emotional score between 0.0 and 1.0
        """
        # For episodes with emotion data
        if hasattr(memory, "emotions") and memory.emotions:
            # Calculate average emotion intensity
            intensities = [abs(value) for value in memory.emotions.values()]
            if intensities:
                return min(1.0, sum(intensities) / len(intensities))
        
        # For memories with importance field
        if hasattr(memory, "importance"):
            return float(memory.importance)
        
        return 0.5  # Default middle value
    
    def _calculate_explicit_score(self, memory: Any) -> float:
        """Calculate explicit importance score.
        
        Args:
            memory: Memory object
            
        Returns:
            Explicit importance score between 0.0 and 1.0
        """
        # For memories with explicit importance
        if hasattr(memory, "importance"):
            return float(memory.importance)
        
        # For memories with attributes that might contain importance
        if hasattr(memory, "attributes") and isinstance(memory.attributes, dict):
            if "importance" in memory.attributes:
                return float(memory.attributes["importance"])
        
        return 0.5  # Default middle value
    
    def _calculate_relevance_score(self, memory: Any, context: Dict[str, Any]) -> float:
        """Calculate contextual relevance score based on keyword and attribute matching.
        
        Args:
            memory: Memory object
            context: Current context
            
        Returns:
            Relevance score between 0.0 and 1.0
        """
        relevance = 0.0
        
        # Check for context matches in memory content
        if hasattr(memory, "content") and isinstance(memory.content, str):
            content = memory.content.lower()
            
            # Check for context keywords in content
            if "keywords" in context:
                for keyword in context["keywords"]:
                    if keyword.lower() in content:
                        relevance += 0.2
                        break
            
            # Check for context entities in content
            if "entities" in context:
                for entity in context["entities"]:
                    if entity.lower() in content:
                        relevance += 0.3
                        break
        
        # For concepts, check name and description
        if isinstance(memory, Concept):
            if "keywords" in context:
                for keyword in context["keywords"]:
                    if keyword.lower() in memory.name.lower() or \
                       (memory.description and keyword.lower() in memory.description.lower()):
                        relevance += 0.25
                        break
            
            # Check categories match
            if "categories" in context and hasattr(memory, "categories"):
                common_categories = set(context["categories"]) & set(memory.categories)
                if common_categories:
                    relevance += 0.2 * (len(common_categories) / len(memory.categories))
        
        # Check for context matches in memory attributes
        if hasattr(memory, "attributes") and isinstance(memory.attributes, dict):
            # Check for location match
            if "location" in context and "location" in memory.attributes:
                if context["location"] == memory.attributes["location"]:
                    relevance += 0.2
            
            # Check for participant match
            if "participants" in context and "participants" in memory.attributes:
                common_participants = set(context["participants"]) & set(memory.attributes["participants"])
                if common_participants:
                    relevance += 0.3 * (len(common_participants) / len(memory.attributes["participants"]))
        
        # Check for direct context match for episodes
        if isinstance(memory, Episode) and hasattr(memory, "context"):
            for key, value in context.items():
                if key in memory.context and memory.context[key] == value:
                    relevance += 0.2
        
        return min(1.0, relevance)
    
    def _calculate_semantic_score(self, memory: Any, context: Dict[str, Any]) -> float:
        """Calculate semantic similarity score using embeddings.
        
        Args:
            memory: Memory object
            context: Current context with embedding
            
        Returns:
            Semantic similarity score between 0.0 and 1.0
        """
        # Check if memory has embedding
        memory_embedding = None
        
        if hasattr(memory, "embedding") and memory.embedding is not None:
            memory_embedding = memory.embedding
        elif hasattr(memory, "attributes") and isinstance(memory.attributes, dict) and "embedding" in memory.attributes:
            memory_embedding = memory.attributes["embedding"]
        
        # If no embedding available, return default score
        if memory_embedding is None or "embedding" not in context:
            return 0.0
            
        # Calculate cosine similarity between embeddings
        context_embedding = context["embedding"]
        
        # Ensure both are normalized
        norm1 = np.linalg.norm(memory_embedding)
        if norm1 > 0:
            memory_embedding = memory_embedding / norm1
            
        norm2 = np.linalg.norm(context_embedding)
        if norm2 > 0:
            context_embedding = context_embedding / norm2
            
        # Calculate cosine similarity
        similarity = np.dot(memory_embedding, context_embedding)
        
        # Scale similarity to prioritize high similarities
        # This applies a curve that emphasizes high similarities
        # (e.g., 0.9->0.95, 0.8->0.75, 0.7->0.55, etc.)
        if similarity > 0.5:
            scaled_similarity = 0.5 + (similarity - 0.5) ** 0.7
        else:
            scaled_similarity = 0.5 * (similarity / 0.5) ** 1.3
            
        return max(0.0, min(1.0, scaled_similarity))
        
    def _calculate_attention_score(self, memory_id: str) -> float:
        """Calculate user attention score.
        
        Args:
            memory_id: ID of the memory
            
        Returns:
            User attention score between 0.0 and 1.0
        """
        if memory_id not in self.access_history:
            return 0.0
        
        # Calculate average attention level from recent accesses
        attention_sum = 0.0
        attention_count = 0
        
        month_ago = datetime.now() - timedelta(days=30)
        
        for access in self.access_history[memory_id]:
            if access["timestamp"] >= month_ago and "attention" in access:
                attention_sum += access["attention"]
                attention_count += 1
        
        if attention_count == 0:
            return 0.0
        
        return attention_sum / attention_count
