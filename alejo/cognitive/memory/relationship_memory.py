"""
ALEJO Relationship Memory Builder

This module implements a long-term relationship memory system that builds and maintains
detailed memories of relationships between the user and other entities. It works with
the entity graph but focuses specifically on building rich, contextual memories of
interactions over time.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np

from alejo.cognitive.memory.entity_graph import PersonalEntityGraph, Entity, EntityType
from alejo.cognitive.memory.episodic_memory import EpisodicMemory
from alejo.cognitive.memory.models import Episode, MemoryType, Relationship, RelationshipType
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_errors

logger = logging.getLogger(__name__)


class InteractionType(Enum):
    """Types of interactions in relationship memories."""
    CONVERSATION = "conversation"
    ACTIVITY = "activity"
    SHARED_EXPERIENCE = "shared_experience"
    EMOTIONAL_EXCHANGE = "emotional_exchange"
    CONFLICT = "conflict"
    RESOLUTION = "resolution"
    SUPPORT = "support"
    COLLABORATION = "collaboration"
    CUSTOM = "custom"


class RelationshipMemory:
    """
    Long-term relationship memory builder for ALEJO.
    
    This system builds and maintains detailed memories of relationships between
    the user and other entities. It works with the entity graph but focuses
    specifically on building rich, contextual memories of interactions over time.
    
    Features:
    - Tracks relationship evolution over time
    - Identifies patterns in interactions
    - Maintains emotional context and sentiment
    - Provides relationship insights and summaries
    - Supports memory consolidation for long-term retention
    """
    
    def __init__(
        self, 
        entity_graph: PersonalEntityGraph,
        episodic_memory: EpisodicMemory,
        event_bus: EventBus = None
    ):
        """Initialize the relationship memory builder.
        
        Args:
            entity_graph: Personal entity graph for entity relationships
            episodic_memory: Episodic memory system for event retrieval
            event_bus: Event bus for publishing memory events
        """
        self.entity_graph = entity_graph
        self.episodic_memory = episodic_memory
        self.event_bus = event_bus
        
        # Cache for relationship summaries
        self._summary_cache = {}
        self._cache_max_size = 50
        self._cache_ttl = 3600  # 1 hour
        
        logger.info("Relationship memory builder initialized")
        
    async def record_interaction(
        self,
        entity_id: str,
        interaction_type: InteractionType,
        content: str,
        sentiment: float = 0.0,
        importance: float = 0.5,
        context: Dict[str, Any] = None,
        timestamp: datetime = None
    ) -> str:
        """Record an interaction with an entity.
        
        Args:
            entity_id: ID of the entity involved in the interaction
            interaction_type: Type of interaction
            content: Content of the interaction
            sentiment: Sentiment score (-1.0 to 1.0)
            importance: Importance of this interaction (0.0 to 1.0)
            context: Additional context for this interaction
            timestamp: When the interaction occurred
            
        Returns:
            ID of the created memory
        """
        try:
            # Validate entity exists
            entity = self.entity_graph.get_entity(entity_id)
            if not entity:
                logger.error(f"Cannot record interaction with non-existent entity: {entity_id}")
                return None
                
            # Record encounter in entity graph
            entity.record_encounter(timestamp)
            self.entity_graph.update_entity(entity_id, {"last_encountered": entity.last_encountered})
            
            # Create memory in episodic memory
            timestamp = timestamp or datetime.now()
            context = context or {}
            context["interaction_type"] = interaction_type.value
            context["entity_id"] = entity_id
            context["entity_name"] = entity.name
            context["entity_type"] = entity.entity_type.value
            context["sentiment"] = sentiment
            
            # Create episode
            memory_id = await self.episodic_memory.store_episode(
                content=content,
                memory_type=MemoryType.RELATIONSHIP,
                timestamp=timestamp,
                importance=importance,
                context=context
            )
            
            # Update relationship strength based on interaction
            self._update_relationship_strength(entity_id, sentiment, importance)
            
            # Publish event
            if self.event_bus:
                await self.event_bus.publish(
                    EventType.MEMORY_CREATED,
                    {
                        "memory_id": memory_id,
                        "memory_type": MemoryType.RELATIONSHIP.value,
                        "entity_id": entity_id,
                        "interaction_type": interaction_type.value
                    }
                )
                
            # Clear summary cache for this entity
            if entity_id in self._summary_cache:
                del self._summary_cache[entity_id]
                
            return memory_id
        except Exception as e:
            logger.error(f"Error recording interaction: {str(e)}")
            return None
            
    async def get_relationship_history(
        self,
        entity_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interaction_types: Optional[List[InteractionType]] = None,
        limit: int = 50,
        include_content: bool = True
    ) -> List[Dict[str, Any]]:
        """Get the history of interactions with an entity.
        
        Args:
            entity_id: ID of the entity
            start_date: Start date for history (optional)
            end_date: End date for history (optional)
            interaction_types: Types of interactions to include (optional)
            limit: Maximum number of interactions to return
            include_content: Whether to include full content
            
        Returns:
            List of interaction memories
        """
        try:
            # Validate entity exists
            entity = self.entity_graph.get_entity(entity_id)
            if not entity:
                logger.error(f"Cannot get history for non-existent entity: {entity_id}")
                return []
                
            # Prepare query
            query = {
                "context.entity_id": entity_id,
                "memory_type": MemoryType.RELATIONSHIP.value
            }
            
            # Add date filters
            if start_date:
                query["timestamp"] = {"$gte": start_date}
            if end_date:
                if "timestamp" not in query:
                    query["timestamp"] = {}
                query["timestamp"]["$lte"] = end_date
                
            # Add interaction type filter
            if interaction_types:
                query["context.interaction_type"] = {
                    "$in": [t.value for t in interaction_types]
                }
                
            # Get episodes
            episodes = await self.episodic_memory.search_episodes(
                query=query,
                sort_by="timestamp",
                sort_order="desc",
                limit=limit
            )
            
            # Format results
            results = []
            for episode in episodes:
                result = {
                    "memory_id": episode.id,
                    "timestamp": episode.timestamp,
                    "interaction_type": episode.context.get("interaction_type"),
                    "sentiment": episode.context.get("sentiment", 0.0),
                    "importance": episode.importance
                }
                
                if include_content:
                    result["content"] = episode.content
                    
                results.append(result)
                
            return results
        except Exception as e:
            logger.error(f"Error getting relationship history: {str(e)}")
            return []
            
    async def generate_relationship_summary(
        self,
        entity_id: str,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Generate a summary of the relationship with an entity.
        
        Args:
            entity_id: ID of the entity
            force_refresh: Whether to force a refresh of the summary
            
        Returns:
            Summary of the relationship
        """
        try:
            # Check cache first
            cache_key = f"summary_{entity_id}"
            if not force_refresh and cache_key in self._summary_cache:
                cache_entry = self._summary_cache[cache_key]
                if time.time() - cache_entry["timestamp"] < self._cache_ttl:
                    return cache_entry["data"]
                    
            # Validate entity exists
            entity = self.entity_graph.get_entity(entity_id)
            if not entity:
                logger.error(f"Cannot generate summary for non-existent entity: {entity_id}")
                return {}
                
            # Get relationship history
            history = await self.get_relationship_history(
                entity_id=entity_id,
                limit=100,
                include_content=True
            )
            
            if not history:
                return {
                    "entity_id": entity_id,
                    "entity_name": entity.name,
                    "relationship_duration": 0,
                    "interaction_count": 0,
                    "average_sentiment": 0.0,
                    "key_topics": [],
                    "recent_interactions": []
                }
                
            # Calculate relationship duration
            first_interaction = min(history, key=lambda x: x["timestamp"])
            last_interaction = max(history, key=lambda x: x["timestamp"])
            duration_days = (last_interaction["timestamp"] - first_interaction["timestamp"]).days
            
            # Calculate average sentiment
            sentiments = [h["sentiment"] for h in history if "sentiment" in h]
            avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0
            
            # Count interaction types
            interaction_counts = {}
            for h in history:
                interaction_type = h.get("interaction_type", "unknown")
                interaction_counts[interaction_type] = interaction_counts.get(interaction_type, 0) + 1
                
            # Extract key topics (simplified implementation)
            # In a production system, this would use NLP to extract topics
            key_topics = []
            
            # Get recent interactions
            recent_interactions = history[:5]
            
            # Create summary
            summary = {
                "entity_id": entity_id,
                "entity_name": entity.name,
                "entity_type": entity.entity_type.value,
                "relationship_duration_days": duration_days,
                "first_interaction": first_interaction["timestamp"].isoformat(),
                "last_interaction": last_interaction["timestamp"].isoformat(),
                "interaction_count": len(history),
                "interaction_types": interaction_counts,
                "average_sentiment": avg_sentiment,
                "key_topics": key_topics,
                "recent_interactions": [
                    {
                        "timestamp": i["timestamp"].isoformat(),
                        "interaction_type": i.get("interaction_type"),
                        "content": i.get("content", "")[:100] + "..." if len(i.get("content", "")) > 100 else i.get("content", "")
                    }
                    for i in recent_interactions
                ]
            }
            
            # Cache the summary
            self._summary_cache[cache_key] = {
                "timestamp": time.time(),
                "data": summary
            }
            
            # Clean cache if needed
            if len(self._summary_cache) > self._cache_max_size:
                self._clean_cache()
                
            return summary
        except Exception as e:
            logger.error(f"Error generating relationship summary: {str(e)}")
            return {}
            
    async def find_relationship_patterns(
        self,
        entity_id: str
    ) -> Dict[str, Any]:
        """Find patterns in the relationship with an entity.
        
        Args:
            entity_id: ID of the entity
            
        Returns:
            Dictionary of identified patterns
        """
        try:
            # Get relationship history
            history = await self.get_relationship_history(
                entity_id=entity_id,
                limit=200,
                include_content=False
            )
            
            if not history:
                return {"patterns": []}
                
            # Analyze sentiment trends
            sentiments = [(h["timestamp"], h.get("sentiment", 0.0)) for h in history]
            sentiments.sort(key=lambda x: x[0])
            
            # Check for sentiment trends
            sentiment_trend = "stable"
            if len(sentiments) >= 5:
                recent_avg = sum(s[1] for s in sentiments[-5:]) / 5
                older_avg = sum(s[1] for s in sentiments[:5]) / 5
                
                if recent_avg > older_avg + 0.2:
                    sentiment_trend = "improving"
                elif recent_avg < older_avg - 0.2:
                    sentiment_trend = "declining"
                    
            # Analyze interaction frequency
            timestamps = [h["timestamp"] for h in history]
            timestamps.sort()
            
            frequency_trend = "stable"
            if len(timestamps) >= 10:
                # Calculate average days between interactions
                intervals = [(timestamps[i] - timestamps[i-1]).days for i in range(1, len(timestamps))]
                
                recent_intervals = intervals[-5:] if len(intervals) >= 5 else intervals
                older_intervals = intervals[:5] if len(intervals) >= 5 else intervals
                
                recent_avg = sum(recent_intervals) / len(recent_intervals)
                older_avg = sum(older_intervals) / len(older_intervals)
                
                if recent_avg < older_avg * 0.8:
                    frequency_trend = "increasing"
                elif recent_avg > older_avg * 1.2:
                    frequency_trend = "decreasing"
                    
            # Identify common interaction types
            interaction_counts = {}
            for h in history:
                interaction_type = h.get("interaction_type", "unknown")
                interaction_counts[interaction_type] = interaction_counts.get(interaction_type, 0) + 1
                
            common_interactions = sorted(
                interaction_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            # Return patterns
            return {
                "patterns": [
                    {
                        "type": "sentiment_trend",
                        "value": sentiment_trend,
                        "confidence": 0.7
                    },
                    {
                        "type": "interaction_frequency",
                        "value": frequency_trend,
                        "confidence": 0.8
                    },
                    {
                        "type": "common_interactions",
                        "value": [i[0] for i in common_interactions],
                        "confidence": 0.9
                    }
                ]
            }
        except Exception as e:
            logger.error(f"Error finding relationship patterns: {str(e)}")
            return {"patterns": []}
            
    def _update_relationship_strength(
        self,
        entity_id: str,
        sentiment: float,
        importance: float
    ) -> None:
        """Update the strength of the relationship with an entity.
        
        Args:
            entity_id: ID of the entity
            sentiment: Sentiment of the interaction (-1.0 to 1.0)
            importance: Importance of the interaction (0.0 to 1.0)
        """
        try:
            # Get current relationship
            relationships = self.entity_graph.get_relationships(target_id=entity_id)
            
            if not relationships:
                # Create new relationship if none exists
                user_entity_id = "user"  # Placeholder for user entity ID
                self.entity_graph.add_relationship(
                    source_id=user_entity_id,
                    target_id=entity_id,
                    relationship_type=RelationshipType.KNOWS,
                    attributes={
                        "sentiment_history": [sentiment],
                        "last_interaction": datetime.now().isoformat()
                    },
                    strength=0.5  # Initial strength
                )
            else:
                # Update existing relationship
                relationship = relationships[0]
                
                # Get current attributes
                attributes = relationship.get("attributes", {})
                sentiment_history = attributes.get("sentiment_history", [])
                
                # Update sentiment history
                sentiment_history.append(sentiment)
                if len(sentiment_history) > 20:
                    sentiment_history = sentiment_history[-20:]
                    
                # Calculate new strength
                current_strength = relationship.get("strength", 0.5)
                sentiment_factor = (sentiment + 1) / 2  # Convert to 0-1 range
                
                # Weighted average of current strength and new interaction
                new_strength = (current_strength * 0.9) + (sentiment_factor * importance * 0.1)
                new_strength = max(0.1, min(1.0, new_strength))  # Clamp to 0.1-1.0
                
                # Update relationship
                self.entity_graph.update_relationship(
                    relationship["id"],
                    {
                        "strength": new_strength,
                        "attributes": {
                            "sentiment_history": sentiment_history,
                            "last_interaction": datetime.now().isoformat()
                        }
                    }
                )
        except Exception as e:
            logger.error(f"Error updating relationship strength: {str(e)}")
            
    def _clean_cache(self) -> None:
        """Clean the summary cache by removing old entries."""
        current_time = time.time()
        to_remove = []
        
        for key, entry in self._summary_cache.items():
            if current_time - entry["timestamp"] > self._cache_ttl:
                to_remove.append(key)
                
        for key in to_remove:
            del self._summary_cache[key]
            
        # If still too many entries, remove oldest
        if len(self._summary_cache) > self._cache_max_size:
            sorted_entries = sorted(
                self._summary_cache.items(),
                key=lambda x: x[1]["timestamp"]
            )
            
            to_remove = sorted_entries[:len(self._summary_cache) - self._cache_max_size]
            for key, _ in to_remove:
                del self._summary_cache[key]
                
    async def get_relationship_context(self, user_id: str, entity_id: str) -> Dict[str, Any]:
        """Get relationship context for an entity to inform preference adjustments.
        
        This function is used by the JavaScript preference system to adjust preference
        strength based on relationship context.
        
        Args:
            user_id: ID of the user
            entity_id: ID of the entity
            
        Returns:
            Dictionary with relationship context information
        """
        try:
            # Get entity information
            entity = self.entity_graph.get_entity(entity_id)
            if not entity:
                logger.warning(f"Entity not found: {entity_id}")
                return {}
                
            # Get relationship information
            relationships = self.entity_graph.get_relationships(target_id=entity_id)
            if not relationships:
                logger.info(f"No relationship found for entity: {entity_id}")
                return {
                    "entity_id": entity_id,
                    "entity_type": entity.entity_type.value if entity else "unknown",
                    "name": entity.name if entity else "unknown",
                    "strength": 0.0,
                    "sentiment": 0.0
                }
                
            # Get primary relationship
            relationship = relationships[0]
            
            # Get relationship attributes
            attributes = relationship.get("attributes", {})
            sentiment_history = attributes.get("sentiment_history", [])
            last_interaction = attributes.get("last_interaction")
            
            # Calculate average sentiment
            avg_sentiment = sum(sentiment_history) / len(sentiment_history) if sentiment_history else 0.0
            
            # Get interaction patterns
            patterns = await self.find_relationship_patterns(entity_id)
            
            # Create context object
            context = {
                "entity_id": entity_id,
                "entity_type": entity.entity_type.value if entity else "unknown",
                "name": entity.name if entity else "unknown",
                "strength": relationship.get("strength", 0.0),
                "sentiment": avg_sentiment,
                "last_interaction": last_interaction,
                "interaction_patterns": [{
                    "type": p["type"],
                    "value": p["value"],
                    "frequency": p["confidence"]
                } for p in patterns.get("patterns", [])]
            }
            
            return context
        except Exception as e:
            logger.error(f"Error getting relationship context: {str(e)}")
            return {}
            
    async def record_preference_interaction(
        self,
        user_id: str,
        entity_id: str,
        interaction_type: str,
        content: str,
        sentiment: float = 0.0,
        importance: float = 0.5,
        context: Dict[str, Any] = None
    ) -> str:
        """Record a preference-related interaction with an entity.
        
        This function is called from the JavaScript preference system when a preference
        is observed that relates to a specific entity.
        
        Args:
            user_id: ID of the user
            entity_id: ID of the entity
            interaction_type: Type of interaction (e.g., 'preference_update')
            content: Content of the interaction
            sentiment: Sentiment score (-1.0 to 1.0)
            importance: Importance of this interaction (0.0 to 1.0)
            context: Additional context for this interaction
            
        Returns:
            ID of the created memory
        """
        try:
            # Convert interaction type to enum
            interaction_enum = InteractionType.CUSTOM
            if hasattr(InteractionType, interaction_type.upper()):
                interaction_enum = getattr(InteractionType, interaction_type.upper())
                
            # Record the interaction using the existing method
            memory_id = await self.record_interaction(
                entity_id=entity_id,
                interaction_type=interaction_enum,
                content=content,
                sentiment=sentiment,
                importance=importance,
                context=context
            )
            
            return memory_id
        except Exception as e:
            logger.error(f"Error recording preference interaction: {str(e)}")
            return None
