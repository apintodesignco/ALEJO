"""
Episodic Memory System for ALEJO
Handles storage and retrieval of experience-based memories with temporal and contextual information.
"""

import time
import numpy as np
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import json
import logging
from ...core.event_bus import EventBus
from ...database.memory_store import MemoryStore

logger = logging.getLogger(__name__)

from .models import Episode

class EpisodicMemory:
    """
    Manages episodic memories with features essential for AGI:
    - Temporal organization
    - Emotional association
    - Contextual binding
    - Importance-based retention
    - Memory consolidation
    - Associative recall
    """
    
    def __init__(self, event_bus: EventBus, memory_store: MemoryStore):
        self.event_bus = event_bus
        self.store = memory_store
        self.importance_threshold = 0.7
        self.max_memories = 10000  # Prevent unbounded growth
        self.consolidation_interval = 3600  # 1 hour
        self.last_consolidation = time.time()
        
        # Register event handlers
        self.event_bus.subscribe("memory.store", self._handle_store_request)
        self.event_bus.subscribe("memory.recall", self._handle_recall_request)
        
    async def store_experience(
        self,
        experience: Any,
        context: Dict[str, Any],
        emotions: Dict[str, float],
        tags: List[str] = None
    ) -> str:
        """
        Store a new experience in episodic memory
        Returns: memory_id if stored, None if filtered out
        """
        try:
            # Calculate importance score
            importance = await self._calculate_importance(experience, emotions, context)
            
            if importance < self.importance_threshold:
                logger.debug(f"Experience filtered out due to low importance: {importance}")
                return None
                
            # Create new episode
            episode = Episode(
                content=experience,
                context=context,
                emotions=emotions,
                timestamp=time.time(),
                importance=importance,
                tags=tags or [],
                connections=await self._find_related_memories(experience, context)
            )
            
            # Store in database
            memory_id = await self.store.save_episode(episode)
            
            # Trigger consolidation if needed
            await self._check_consolidation()
            
            logger.info(f"Stored new episodic memory with ID: {memory_id}")
            return memory_id
            
        except Exception as e:
            logger.error(f"Failed to store experience: {str(e)}")
            raise
            
    async def recall_relevant(
        self,
        context: Dict[str, Any],
        limit: int = 5,
        min_similarity: float = 0.7
    ) -> List[Episode]:
        """Recall memories relevant to current context"""
        try:
            # Get candidate memories
            candidates = await self.store.get_recent_episodes(100)
            
            # Calculate relevance scores
            scored_memories = [
                (memory, await self._calculate_relevance(memory, context))
                for memory in candidates
            ]
            
            # Filter and sort by relevance
            relevant_memories = [
                memory for memory, score in scored_memories
                if score >= min_similarity
            ]
            relevant_memories.sort(key=lambda x: x[1], reverse=True)
            
            return relevant_memories[:limit]
            
        except Exception as e:
            logger.error(f"Failed to recall memories: {str(e)}")
            raise
            
    async def _check_consolidation(self):
        """Check if memory consolidation is needed"""
        current_time = time.time()
        if current_time - self.last_consolidation >= self.consolidation_interval:
            await self._consolidate_memories()
            self.last_consolidation = current_time
            
    async def _consolidate_memories(self):
        """
        Consolidate memories by:
        - Removing redundant memories
        - Strengthening important connections
        - Pruning least important memories if over capacity
        """
        try:
            all_memories = await self.store.get_all_episodes()
            
            # Remove redundant memories
            unique_memories = await self._remove_redundant(all_memories)
            
            # Update connection strengths
            for memory in unique_memories:
                memory.connections = await self._update_connections(memory, unique_memories)
                
            # Prune if over capacity
            if len(unique_memories) > self.max_memories:
                unique_memories = self._prune_memories(unique_memories)
                
            # Save consolidated memories
            await self.store.save_consolidated_episodes(unique_memories)
            logger.info("Memory consolidation completed successfully")
            
        except Exception as e:
            logger.error(f"Memory consolidation failed: {str(e)}")
            raise
            
    async def _calculate_importance(
        self,
        experience: Any,
        emotions: Dict[str, float],
        context: Dict[str, Any]
    ) -> float:
        """Calculate importance score for an experience"""
        # Emotional intensity contribution
        emotional_intensity = sum(emotions.values()) / len(emotions)
        
        # Novelty contribution
        novelty = await self._calculate_novelty(experience, context)
        
        # Context significance
        context_significance = self._evaluate_context(context)
        
        # Weighted combination
        importance = (
            0.4 * emotional_intensity +
            0.4 * novelty +
            0.2 * context_significance
        )
        
        return min(1.0, importance)
        
    async def _calculate_novelty(self, experience: Any, context: Dict[str, Any]) -> float:
        """Calculate how novel an experience is based on content and context."""
        try:
            # Convert experience to string for comparison
            exp_str = str(experience)
            
            # Get recent memories for comparison
            recent_memories = await self.store.get_recent_episodes(50)
            
            # Calculate content similarity with recent memories
            content_similarities = []
            for memory in recent_memories:
                similarity = self._text_similarity(exp_str, str(memory.content))
                content_similarities.append(similarity)
                
            # Calculate context similarity
            context_similarities = []
            for memory in recent_memories:
                similarity = self._context_similarity(context, memory.context)
                context_similarities.append(similarity)
                
            # Combine similarities
            if content_similarities and context_similarities:
                avg_content_sim = sum(content_similarities) / len(content_similarities)
                avg_context_sim = sum(context_similarities) / len(context_similarities)
                # Novelty is inverse of similarity
                novelty = 1.0 - (0.7 * avg_content_sim + 0.3 * avg_context_sim)
            else:
                novelty = 1.0  # Completely novel if no recent memories
                
            return novelty
            
        except Exception as e:
            logger.error(f"Error calculating novelty: {e}")
            return 0.8  # Fallback to moderate novelty
            
    def _evaluate_context(self, context: Dict[str, Any]) -> float:
        """Evaluate the significance of the context based on multiple factors."""
        try:
            significance = 0.0
            total_weight = 0.0
            
            # Check for temporal significance
            if 'timestamp' in context:
                time_weight = 0.3
                # Recent events are more significant
                recency = 1.0 - min(1.0, (time.time() - context['timestamp']) / (24 * 3600))
                significance += time_weight * recency
                total_weight += time_weight
                
            # Check for emotional significance
            if 'emotions' in context:
                emotion_weight = 0.4
                emotional_intensity = sum(abs(v) for v in context['emotions'].values())
                normalized_intensity = min(1.0, emotional_intensity / len(context['emotions']))
                significance += emotion_weight * normalized_intensity
                total_weight += emotion_weight
                
            # Check for interaction significance
            if 'interaction_type' in context:
                interaction_weights = {
                    'critical': 1.0,
                    'important': 0.8,
                    'normal': 0.5,
                    'routine': 0.3
                }
                interaction_weight = 0.3
                interaction_value = interaction_weights.get(context['interaction_type'], 0.5)
                significance += interaction_weight * interaction_value
                total_weight += interaction_weight
                
            # Normalize final score
            return significance / total_weight if total_weight > 0 else 0.5
            
        except Exception as e:
            logger.error(f"Error evaluating context: {e}")
            return 0.7  # Fallback to moderate significance
            
    async def _find_related_memories(
        self,
        experience: Any,
        context: Dict[str, Any]
    ) -> List[str]:
        """Find IDs of related memories using multiple relationship types."""
        try:
            related_ids = set()
            
            # Get recent memories
            recent_memories = await self.store.get_recent_episodes(100)
            
            # Convert experience to string
            exp_str = str(experience)
            
            for memory in recent_memories:
                relationship_score = 0.0
                weights = {'content': 0.4, 'context': 0.3, 'temporal': 0.2, 'emotional': 0.1}
                
                # Content similarity
                content_sim = self._text_similarity(exp_str, str(memory.content))
                relationship_score += weights['content'] * content_sim
                
                # Context similarity
                context_sim = self._context_similarity(context, memory.context)
                relationship_score += weights['context'] * context_sim
                
                # Temporal proximity
                if 'timestamp' in context and hasattr(memory, 'timestamp'):
                    time_diff = abs(context['timestamp'] - memory.timestamp)
                    temporal_sim = 1.0 - min(1.0, time_diff / (24 * 3600))  # Within 24 hours
                    relationship_score += weights['temporal'] * temporal_sim
                    
                # Emotional similarity
                if 'emotions' in context and hasattr(memory, 'emotions'):
                    emotion_sim = self._emotional_similarity(
                        context['emotions'],
                        memory.emotions
                    )
                    relationship_score += weights['emotional'] * emotion_sim
                    
                # Add memory if relationship is strong enough
                if relationship_score >= 0.7:
                    related_ids.add(memory.id)
                    
            return list(related_ids)
            
        except Exception as e:
            logger.error(f"Error finding related memories: {e}")
            return []
            
    async def _calculate_relevance(self, memory: Episode, context: Dict[str, Any]) -> float:
        """Calculate context-based relevance using multiple factors."""
        try:
            relevance_score = 0.0
            weights = {
                'temporal': 0.3,
                'contextual': 0.4,
                'emotional': 0.2,
                'importance': 0.1
            }
            
            # Temporal relevance
            if 'timestamp' in context:
                time_diff = abs(context['timestamp'] - memory.timestamp)
                temporal_relevance = 1.0 - min(1.0, time_diff / (24 * 3600))
                relevance_score += weights['temporal'] * temporal_relevance
                
            # Contextual relevance
            context_sim = self._context_similarity(context, memory.context)
            relevance_score += weights['contextual'] * context_sim
            
            # Emotional relevance
            if 'emotions' in context:
                emotion_sim = self._emotional_similarity(
                    context['emotions'],
                    memory.emotions
                )
                relevance_score += weights['emotional'] * emotion_sim
                
            # Importance contribution
            relevance_score += weights['importance'] * memory.importance
            
            return relevance_score
            
        except Exception as e:
            logger.error(f"Error calculating relevance: {e}")
            return 0.5
            
    async def _remove_redundant(self, memories: List[Episode]) -> List[Episode]:
        """Remove redundant memories using clustering and similarity analysis."""
        try:
            unique_memories = []
            redundancy_threshold = 0.9
            
            # Sort by importance so we keep the most important version
            sorted_memories = sorted(
                memories,
                key=lambda x: x.importance,
                reverse=True
            )
            
            # Track which memories have been marked as redundant
            redundant = set()
            
            # Compare each memory with others
            for i, memory1 in enumerate(sorted_memories):
                if i in redundant:
                    continue
                    
                unique_memories.append(memory1)
                
                # Compare with remaining memories
                for j, memory2 in enumerate(sorted_memories[i+1:], start=i+1):
                    if j in redundant:
                        continue
                        
                    # Calculate overall similarity
                    content_sim = self._text_similarity(
                        str(memory1.content),
                        str(memory2.content)
                    )
                    context_sim = self._context_similarity(
                        memory1.context,
                        memory2.context
                    )
                    temporal_sim = 1.0 - min(
                        1.0,
                        abs(memory1.timestamp - memory2.timestamp) / (3600)
                    )
                    
                    # Weighted similarity score
                    similarity = (
                        0.5 * content_sim +
                        0.3 * context_sim +
                        0.2 * temporal_sim
                    )
                    
                    if similarity >= redundancy_threshold:
                        redundant.add(j)
                        
            return unique_memories
            
        except Exception as e:
            logger.error(f"Error removing redundant memories: {e}")
            return memories
            
    async def _update_connections(
        self,
        memory: Episode,
        all_memories: List[Episode]
    ) -> List[str]:
        """Update memory connections with strength weighting."""
        try:
            connections = {}
            connection_threshold = 0.6
            
            for other in all_memories:
                if other.id == memory.id:
                    continue
                    
                # Calculate connection strength
                content_sim = self._text_similarity(
                    str(memory.content),
                    str(other.content)
                )
                context_sim = self._context_similarity(
                    memory.context,
                    other.context
                )
                temporal_sim = 1.0 - min(
                    1.0,
                    abs(memory.timestamp - other.timestamp) / (24 * 3600)
                )
                emotional_sim = self._emotional_similarity(
                    memory.emotions,
                    other.emotions
                )
                
                # Calculate overall connection strength
                strength = (
                    0.4 * content_sim +
                    0.3 * context_sim +
                    0.2 * temporal_sim +
                    0.1 * emotional_sim
                )
                
                if strength >= connection_threshold:
                    connections[other.id] = strength
                    
            # Sort by strength and keep top connections
            sorted_connections = sorted(
                connections.items(),
                key=lambda x: x[1],
                reverse=True
            )
            
            return [conn[0] for conn in sorted_connections[:10]]
            
        except Exception as e:
            logger.error(f"Error updating connections: {e}")
            return memory.connections
            
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity using character and word-level features."""
        try:
            # Convert to lowercase for comparison
            text1 = text1.lower()
            text2 = text2.lower()
            
            # Word-level Jaccard similarity
            words1 = set(text1.split())
            words2 = set(text2.split())
            word_sim = len(words1.intersection(words2)) / len(words1.union(words2))
            
            # Character-level n-gram similarity
            def get_ngrams(text: str, n: int) -> set:
                return set(text[i:i+n] for i in range(len(text)-n+1))
                
            trigrams1 = get_ngrams(text1, 3)
            trigrams2 = get_ngrams(text2, 3)
            char_sim = len(trigrams1.intersection(trigrams2)) / len(trigrams1.union(trigrams2))
            
            # Combine similarities
            return 0.6 * word_sim + 0.4 * char_sim
            
        except Exception as e:
            logger.error(f"Error calculating text similarity: {e}")
            return 0.0
            
    def _context_similarity(self, context1: Dict[str, Any], context2: Dict[str, Any]) -> float:
        """Calculate similarity between two contexts."""
        try:
            similarity = 0.0
            total_weight = 0.0
            
            # Compare common keys
            common_keys = set(context1.keys()) & set(context2.keys())
            
            for key in common_keys:
                weight = {
                    'location': 0.3,
                    'activity': 0.3,
                    'participants': 0.2,
                    'time_of_day': 0.1,
                    'weather': 0.1
                }.get(key, 0.1)
                
                if isinstance(context1[key], (str, int, float)):
                    sim = 1.0 if context1[key] == context2[key] else 0.0
                elif isinstance(context1[key], dict):
                    sim = self._context_similarity(context1[key], context2[key])
                elif isinstance(context1[key], (list, set)):
                    common = set(context1[key]) & set(context2[key])
                    union = set(context1[key]) | set(context2[key])
                    sim = len(common) / len(union) if union else 0.0
                else:
                    continue
                    
                similarity += weight * sim
                total_weight += weight
                
            return similarity / total_weight if total_weight > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating context similarity: {e}")
            return 0.0
            
    def _emotional_similarity(self, emotions1: Dict[str, float], emotions2: Dict[str, float]) -> float:
        """Calculate similarity between emotional states."""
        try:
            # Get common emotions
            common_emotions = set(emotions1.keys()) & set(emotions2.keys())
            
            if not common_emotions:
                return 0.0
                
            # Calculate cosine similarity for common emotions
            dot_product = sum(emotions1[e] * emotions2[e] for e in common_emotions)
            norm1 = sum(emotions1[e]**2 for e in common_emotions) ** 0.5
            norm2 = sum(emotions2[e]**2 for e in common_emotions) ** 0.5
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
                
            return dot_product / (norm1 * norm2)
            
        except Exception as e:
            logger.error(f"Error calculating emotional similarity: {e}")
            return 0.0
        
    def _prune_memories(self, memories: List[Episode]) -> List[Episode]:
        """Prune least important memories"""
        sorted_memories = sorted(
            memories,
            key=lambda x: x.importance,
            reverse=True
        )
        return sorted_memories[:self.max_memories]
        
    async def _handle_store_request(self, data: Dict[str, Any]):
        """Handle memory store requests from event bus"""
        await self.store_experience(
            data['experience'],
            data['context'],
            data['emotions'],
            data.get('tags')
        )
        
    async def _handle_recall_request(self, data: Dict[str, Any]):
        """Handle memory recall requests from event bus"""
        memories = await self.recall_relevant(
            data['context'],
            data.get('limit', 5),
            data.get('min_similarity', 0.7)
        )
        await self.event_bus.publish(
            "memory.recall.result",
            {"memories": memories}
        )
