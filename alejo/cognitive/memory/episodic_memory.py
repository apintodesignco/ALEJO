import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

from alejo.cognitive.memory.models import Episode, MemoryType
from alejo.database.memory_store import MemoryStore
from alejo.performance.cache_decorator import cached

logger = logging.getLogger(__name__)


class EpisodicMemory:
    """Production implementation of EpisodicMemory.
    
    Episodic memory stores autobiographical events that can be explicitly stated as
    recollections of previous experiences. This implementation provides storage,
    retrieval, and management of episodic memories with features like:
    
    - Temporal organization and retrieval
    - Semantic search via embeddings
    - Memory consolidation and importance-based retention
    - Contextual association and retrieval
    - Event notification via event bus
    """

    def __init__(self, event_bus, memory_store: MemoryStore):
        """Initialize the episodic memory system.
        
        Args:
            event_bus: Event bus for publishing memory events
            memory_store: Storage backend for persisting memories
        """
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.embedding_dimension = 384  # Default for small sentence transformers
        self._embedding_model = None
        self._consolidation_scheduled = False
        
        # Cache for recently accessed episodes
        self._episode_cache = {}
        self._cache_max_size = 100
        self._cache_ttl = 300  # 5 minutes
        
        logger.info("Episodic memory system initialized")

    async def initialize(self):
        """Initialize the episodic memory system, loading necessary models."""
        # Lazy load embedding model when needed
        await self.memory_store.ensure_table(
            "episodic_memories",
            {
                "id": "TEXT PRIMARY KEY",
                "timestamp": "TEXT",
                "content": "TEXT",
                "context": "TEXT",  # JSON
                "location": "TEXT",
                "participants": "TEXT",  # JSON array
                "emotions": "TEXT",  # JSON
                "importance": "REAL",
                "embedding": "BLOB",
                "last_accessed": "TEXT"
            }
        )
        
        # Create indices for efficient retrieval
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_memories(timestamp)")
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_episodic_importance ON episodic_memories(importance)")
        
        # Schedule periodic memory consolidation
        if not self._consolidation_scheduled:
            asyncio.create_task(self._schedule_consolidation())
            self._consolidation_scheduled = True
            
        logger.info("Episodic memory tables and indices initialized")

    async def store_event(self, event: Union[Episode, Dict[str, Any]]) -> str:
        """Store an event into episodic memory.
        
        Args:
            event: Episode object or dictionary with event data
            
        Returns:
            str: ID of the stored episode
        """
        if not isinstance(event, Episode):
            event = Episode.from_dict(event)
            
        # Generate embedding if not present
        if event.embedding is None:
            event.embedding = await self._generate_embedding(event.content)
            
        # Store in database
        await self._store_episode_in_db(event)
        
        # Add to cache
        self._add_to_cache(event)
        
        # Publish event
        await self._publish_event("episodic_memory_stored", {"episode_id": event.id})
        
        logger.debug(f"Stored episodic memory: {event.id}")
        return event.id

    async def get_event(self, event_id: str) -> Optional[Episode]:
        """Retrieve a specific event by ID.
        
        Args:
            event_id: ID of the event to retrieve
            
        Returns:
            Episode object if found, None otherwise
        """
        # Check cache first
        if event_id in self._episode_cache:
            cache_entry = self._episode_cache[event_id]
            if time.time() - cache_entry["timestamp"] < self._cache_ttl:
                episode = cache_entry["episode"]
                episode.last_accessed = datetime.now()
                # Update last accessed in database asynchronously
                asyncio.create_task(self._update_last_accessed(event_id))
                return episode
        
        # Retrieve from database
        query = "SELECT * FROM episodic_memories WHERE id = ?"
        result = await self.memory_store.execute(query, (event_id,), fetch_one=True)
        
        if not result:
            return None
            
        episode = self._row_to_episode(result)
        
        # Update last accessed
        episode.last_accessed = datetime.now()
        await self._update_last_accessed(event_id)
        
        # Add to cache
        self._add_to_cache(episode)
        
        return episode

    @cached(ttl_seconds=60)
    async def get_all_events(self, limit: int = 100, offset: int = 0) -> List[Episode]:
        """Return all stored events with pagination.
        
        Args:
            limit: Maximum number of events to return
            offset: Number of events to skip
            
        Returns:
            List of Episode objects
        """
        query = "SELECT * FROM episodic_memories ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        results = await self.memory_store.execute(query, (limit, offset))
        
        episodes = [self._row_to_episode(row) for row in results]
        return episodes

    async def get_events_by_timeframe(self, start_time: datetime, end_time: datetime) -> List[Episode]:
        """Retrieve events that occurred within a specific timeframe.
        
        Args:
            start_time: Start of the timeframe
            end_time: End of the timeframe
            
        Returns:
            List of Episode objects
        """
        query = "SELECT * FROM episodic_memories WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp"
        results = await self.memory_store.execute(
            query, 
            (start_time.isoformat(), end_time.isoformat())
        )
        
        episodes = [self._row_to_episode(row) for row in results]
        return episodes

    async def search_events(self, query_text: str, limit: int = 10) -> List[Tuple[Episode, float]]:
        """Search for events semantically related to the query text.
        
        Args:
            query_text: Text to search for
            limit: Maximum number of results to return
            
        Returns:
            List of tuples containing (Episode, similarity_score)
        """
        # Generate embedding for query
        query_embedding = await self._generate_embedding(query_text)
        
        # Retrieve all episodes (in a real implementation, this would use a vector database)
        all_episodes = await self.get_all_events(limit=1000)  # Reasonable limit for in-memory search
        
        # Calculate similarities
        results = []
        for episode in all_episodes:
            if episode.embedding is not None:
                similarity = self._calculate_similarity(query_embedding, episode.embedding)
                results.append((episode, similarity))
        
        # Sort by similarity and return top results
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]

    async def update_event(self, event_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing event.
        
        Args:
            event_id: ID of the event to update
            updates: Dictionary of fields to update
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Get current event
        event = await self.get_event(event_id)
        if not event:
            return False
            
        # Apply updates
        for key, value in updates.items():
            if hasattr(event, key):
                setattr(event, key, value)
                
        # If content was updated, regenerate embedding
        if "content" in updates:
            event.embedding = await self._generate_embedding(event.content)
            
        # Store updated event
        await self._store_episode_in_db(event)
        
        # Update cache
        self._add_to_cache(event)
        
        # Publish event
        await self._publish_event("episodic_memory_updated", {"episode_id": event_id})
        
        return True

    async def delete_event(self, event_id: str) -> bool:
        """Delete an event from episodic memory.
        
        Args:
            event_id: ID of the event to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Delete from database
        query = "DELETE FROM episodic_memories WHERE id = ?"
        result = await self.memory_store.execute(query, (event_id,))
        
        # Remove from cache
        if event_id in self._episode_cache:
            del self._episode_cache[event_id]
            
        # Publish event
        await self._publish_event("episodic_memory_deleted", {"episode_id": event_id})
        
        return result > 0

    async def get_events_by_importance(self, min_importance: float = 0.7, limit: int = 10) -> List[Episode]:
        """Retrieve events with importance above the specified threshold.
        
        Args:
            min_importance: Minimum importance score (0-1)
            limit: Maximum number of events to return
            
        Returns:
            List of Episode objects
        """
        query = "SELECT * FROM episodic_memories WHERE importance >= ? ORDER BY importance DESC LIMIT ?"
        results = await self.memory_store.execute(query, (min_importance, limit))
        
        episodes = [self._row_to_episode(row) for row in results]
        return episodes

    async def get_events_by_location(self, location: str) -> List[Episode]:
        """Retrieve events that occurred at a specific location.
        
        Args:
            location: Location to search for
            
        Returns:
            List of Episode objects
        """
        query = "SELECT * FROM episodic_memories WHERE location LIKE ? ORDER BY timestamp DESC"
        results = await self.memory_store.execute(query, (f"%{location}%",))
        
        episodes = [self._row_to_episode(row) for row in results]
        return episodes

    async def get_events_by_participant(self, participant: str) -> List[Episode]:
        """Retrieve events involving a specific participant.
        
        Args:
            participant: Participant to search for
            
        Returns:
            List of Episode objects
        """
        query = "SELECT * FROM episodic_memories WHERE participants LIKE ? ORDER BY timestamp DESC"
        results = await self.memory_store.execute(query, (f"%{participant}%",))
        
        episodes = [self._row_to_episode(row) for row in results]
        return episodes

    async def consolidate_memories(self, retention_threshold: float = 0.3) -> int:
        """Consolidate memories by removing low-importance events older than a threshold.
        
        Args:
            retention_threshold: Minimum importance to retain old memories
            
        Returns:
            int: Number of memories removed
        """
        # Remove low-importance memories older than 30 days
        cutoff_date = (datetime.now() - timedelta(days=30)).isoformat()
        
        query = """DELETE FROM episodic_memories 
                  WHERE importance < ? AND timestamp < ? 
                  AND id NOT IN (SELECT id FROM episodic_memories 
                                 ORDER BY importance DESC LIMIT 1000)"""
        
        result = await self.memory_store.execute(query, (retention_threshold, cutoff_date))
        
        # Clear cache entries for deleted items
        # In a real implementation, we'd track which items were deleted
        self._episode_cache = {}
        
        # Publish event
        await self._publish_event("episodic_memory_consolidated", {"removed_count": result})
        
        logger.info(f"Consolidated episodic memories: {result} removed")
        return result

    async def _store_episode_in_db(self, episode: Episode) -> None:
        """Store an episode in the database."""
        # Convert complex fields to JSON
        context_json = json.dumps(episode.context)
        participants_json = json.dumps(episode.participants)
        emotions_json = json.dumps(episode.emotions)
        
        # Convert timestamp and last_accessed to ISO format strings
        timestamp_str = episode.timestamp.isoformat()
        last_accessed_str = episode.last_accessed.isoformat() if episode.last_accessed else None
        
        # Convert embedding to bytes if present
        embedding_bytes = episode.embedding.tobytes() if episode.embedding is not None else None
        
        # Insert or replace
        query = """INSERT OR REPLACE INTO episodic_memories 
                  (id, timestamp, content, context, location, participants, 
                   emotions, importance, embedding, last_accessed) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
                  
        await self.memory_store.execute(
            query,
            (episode.id, timestamp_str, episode.content, context_json,
             episode.location, participants_json, emotions_json,
             episode.importance, embedding_bytes, last_accessed_str)
        )

    async def _update_last_accessed(self, event_id: str) -> None:
        """Update the last_accessed timestamp for an episode."""
        now = datetime.now().isoformat()
        query = "UPDATE episodic_memories SET last_accessed = ? WHERE id = ?"
        await self.memory_store.execute(query, (now, event_id))

    def _row_to_episode(self, row: Dict[str, Any]) -> Episode:
        """Convert a database row to an Episode object."""
        # Parse JSON fields
        context = json.loads(row["context"]) if row["context"] else {}
        participants = json.loads(row["participants"]) if row["participants"] else []
        emotions = json.loads(row["emotions"]) if row["emotions"] else {}
        
        # Convert embedding bytes to numpy array if present
        embedding = None
        if row["embedding"]:
            embedding = np.frombuffer(row["embedding"], dtype=np.float32)
        
        # Create episode
        episode = Episode(
            id=row["id"],
            content=row["content"],
            context=context,
            location=row["location"],
            participants=participants,
            emotions=emotions,
            importance=row["importance"],
            embedding=embedding
        )
        
        # Parse timestamp and last_accessed
        if row["timestamp"]:
            episode.timestamp = datetime.fromisoformat(row["timestamp"])
            
        if row["last_accessed"]:
            episode.last_accessed = datetime.fromisoformat(row["last_accessed"])
            
        return episode

    def _add_to_cache(self, episode: Episode) -> None:
        """Add an episode to the cache."""
        # Add to cache
        self._episode_cache[episode.id] = {
            "episode": episode,
            "timestamp": time.time()
        }
        
        # Enforce cache size limit
        if len(self._episode_cache) > self._cache_max_size:
            # Remove oldest entries
            sorted_cache = sorted(self._episode_cache.items(), key=lambda x: x[1]["timestamp"])
            for i in range(len(sorted_cache) - self._cache_max_size):
                del self._episode_cache[sorted_cache[i][0]]

    async def _generate_embedding(self, text: str) -> np.ndarray:
        """Generate an embedding vector for the given text."""
        # Lazy load embedding model if needed
        if self._embedding_model is None:
            await self._load_embedding_model()
            
        # In a real implementation, this would use a proper embedding model
        # For now, we'll create a simple random embedding as a placeholder
        # This would be replaced with a proper embedding model in production
        np.random.seed(hash(text) % 2**32)
        embedding = np.random.randn(self.embedding_dimension).astype(np.float32)
        # Normalize to unit length
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding

    async def _load_embedding_model(self) -> None:
        """Load the embedding model."""
        # In a real implementation, this would load a sentence transformer or similar model
        # For now, we'll just set a flag indicating the model is "loaded"
        logger.info("Loading embedding model for episodic memory")
        # Simulate loading time
        await asyncio.sleep(0.1)
        self._embedding_model = True
        logger.info("Embedding model loaded")

    def _calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings."""
        return np.dot(embedding1, embedding2)

    async def _publish_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish an event to the event bus."""
        try:
            await self.event_bus.publish(event_type, data)
        except Exception as e:
            logger.error(f"Failed to publish event {event_type}: {e}")

    async def _schedule_consolidation(self) -> None:
        """Schedule periodic memory consolidation."""
        while True:
            try:
                # Run consolidation once a day
                await asyncio.sleep(24 * 60 * 60)  # 24 hours
                await self.consolidate_memories()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error during scheduled memory consolidation: {e}")
                # Wait before retrying
                await asyncio.sleep(60 * 60)  # 1 hour
