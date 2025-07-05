"""
ALEJO Personalization Memory Integration

This module integrates the personalization engine with ALEJO's cognitive memory systems,
allowing for personalized memory storage, retrieval, and reasoning.
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from alejo.cognitive.memory.models import (
    Concept,
    Episode,
    MemoryType,
    Relationship,
    RelationshipType,
    WorkingMemoryItem,
)


class PersonalizedMemoryManager:
    """
    Manages the integration between personalization systems and memory components.
    
    This class serves as the bridge between user-specific personalization data
    and ALEJO's cognitive memory systems, ensuring that memories are properly
    contextualized with user preferences, patterns, and personal information.
    """
    
    def __init__(
        self,
        working_memory,
        episodic_memory,
        semantic_memory,
        preference_model,
        secure_vault
    ):
        """
        Initialize the personalized memory manager.
        
        Args:
            working_memory: Working memory component
            episodic_memory: Episodic memory component
            semantic_memory: Semantic memory component
            preference_model: User preference model
            secure_vault: Secure storage for personal data
        """
        self.working_memory = working_memory
        self.episodic_memory = episodic_memory
        self.semantic_memory = semantic_memory
        self.preference_model = preference_model
        self.secure_vault = secure_vault
        
    async def store_personal_experience(
        self,
        content: Any,
        context: Dict[str, Any],
        importance: float = 0.5,
        emotion_data: Optional[Dict[str, float]] = None
    ) -> str:
        """
        Store a personal experience in memory with appropriate personalization.
        
        Args:
            content: The content of the experience
            context: Contextual information about the experience
            importance: Subjective importance of the experience (0.0-1.0)
            emotion_data: Emotional response data associated with the experience
            
        Returns:
            The ID of the stored episode
        """
        # Enrich context with personalization data
        enriched_context = await self._enrich_context(context)
        
        # Create and store the episode
        episode = Episode(
            content=content,
            context=enriched_context,
            importance=importance,
            emotions=emotion_data or {},
            source="personalization_engine"
        )
        
        episode_id = await self.episodic_memory.store_episode(episode)
        
        # Focus on this in working memory
        await self.working_memory.focus_on(
            content=content,
            source="personalization_engine",
            context=enriched_context
        )
        
        # Update preference model based on this experience
        await self.preference_model.update_from_experience(content, enriched_context)
        
        return episode_id
    
    async def retrieve_personalized_memories(
        self,
        query: str,
        context: Dict[str, Any],
        limit: int = 5
    ) -> List[Episode]:
        """
        Retrieve memories that are most relevant to the current personalized context.
        
        Args:
            query: Search query
            context: Current context
            limit: Maximum number of memories to retrieve
            
        Returns:
            List of relevant episodes
        """
        # Enrich the query with personalization data
        personalized_query = await self._personalize_query(query, context)
        
        # Retrieve relevant episodes
        episodes = await self.episodic_memory.search(
            query=personalized_query,
            limit=limit
        )
        
        # Boost activation of these memories in working memory
        for episode in episodes:
            await self.working_memory.focus_on(
                content={"memory_recall": episode.id},
                source="personalization_engine",
                context=context
            )
        
        return episodes
    
    async def form_personal_concepts(self) -> List[Concept]:
        """
        Form personal concepts from recurring patterns in episodic memory.
        
        Returns:
            List of newly formed concepts
        """
        # Get recent episodes
        episodes = await self.episodic_memory.get_recent_episodes(limit=100)
        
        # Analyze patterns in episodes
        patterns = await self._analyze_patterns(episodes)
        
        # Form concepts from patterns
        concepts = []
        for pattern_name, pattern_data in patterns.items():
            if pattern_data["confidence"] > 0.7:
                concept = Concept(
                    name=pattern_name,
                    description=pattern_data["description"],
                    attributes=pattern_data["attributes"],
                    confidence=pattern_data["confidence"],
                    source="personalization_engine"
                )
                
                concept_id = await self.semantic_memory.store_concept(concept)
                concept.id = concept_id
                concepts.append(concept)
                
                # Create relationships between this concept and related concepts
                for related_concept_id in pattern_data.get("related_concepts", []):
                    relationship = Relationship(
                        source_id=concept_id,
                        target_id=related_concept_id,
                        relationship_type=RelationshipType.RELATED_TO,
                        strength=0.8
                    )
                    await self.semantic_memory.store_relationship(relationship)
        
        return concepts
    
    async def _enrich_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich context with personalization data.
        
        Args:
            context: Original context
            
        Returns:
            Enriched context with personalization data
        """
        enriched = context.copy()
        
        # Add user preferences if available
        user_preferences = await self.preference_model.get_preferences()
        if user_preferences:
            enriched["user_preferences"] = user_preferences
        
        # Add personal entities if relevant
        personal_entities = await self.secure_vault.get_relevant_entities(context)
        if personal_entities:
            enriched["personal_entities"] = personal_entities
        
        # Add current emotional state if available
        emotional_state = await self.preference_model.get_emotional_state()
        if emotional_state:
            enriched["emotional_state"] = emotional_state
        
        return enriched
    
    async def _personalize_query(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> str:
        """
        Personalize a query based on user preferences and context.
        
        Args:
            query: Original query
            context: Current context
            
        Returns:
            Personalized query
        """
        # Get user preferences
        preferences = await self.preference_model.get_preferences()
        
        # Enhance query with personal context
        # This is a simplified implementation - in practice, this would use
        # more sophisticated NLP techniques to incorporate preferences
        personalized_terms = []
        
        if "interests" in preferences:
            for interest in preferences["interests"]:
                if interest.lower() in query.lower():
                    personalized_terms.append(interest)
        
        if personalized_terms:
            enhanced_query = f"{query} {' '.join(personalized_terms)}"
        else:
            enhanced_query = query
            
        return enhanced_query
    
    async def _analyze_patterns(self, episodes: List[Episode]) -> Dict[str, Dict]:
        """
        Analyze patterns in episodes to identify recurring themes.
        
        Args:
            episodes: List of episodes to analyze
            
        Returns:
            Dictionary of identified patterns
        """
        # This is a placeholder for more sophisticated pattern analysis
        # In a real implementation, this would use clustering, topic modeling, etc.
        patterns = {}
        
        # Simple frequency analysis of contexts
        context_counts = {}
        for episode in episodes:
            for key, value in episode.context.items():
                if isinstance(value, (str, int, float, bool)):
                    context_key = f"{key}:{value}"
                    if context_key not in context_counts:
                        context_counts[context_key] = 0
                    context_counts[context_key] += 1
        
        # Form patterns from frequent contexts
        for context_key, count in context_counts.items():
            if count >= 3:  # Threshold for pattern formation
                key, value = context_key.split(":", 1)
                pattern_name = f"frequent_{key}"
                
                if pattern_name not in patterns:
                    patterns[pattern_name] = {
                        "description": f"Frequently observed {key}",
                        "attributes": {},
                        "confidence": min(count / 10, 0.9),  # Cap at 0.9
                        "related_concepts": []
                    }
                
                patterns[pattern_name]["attributes"][value] = count
        
        return patterns
