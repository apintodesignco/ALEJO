import asyncio
import heapq
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set, Union, Callable

import numpy as np

from alejo.cognitive.memory.models import WorkingMemoryItem, MemoryType
from alejo.performance.cache_decorator import cached

# Configure logging
logger = logging.getLogger(__name__)

class WorkingMemory:
    """Production implementation for WorkingMemory system with activation-based forgetting.
    
    Working memory maintains a limited set of items with activation levels that decay over time.
    Items with higher activation (more recent or accessed more frequently) remain in working memory,
    while items with lower activation are gradually forgotten. This mimics human working memory.
    
    Attributes:
        memory_store: Persistent storage for overflow items
        event_bus: Event bus for publishing memory events
        items: Dictionary of working memory items by ID
        capacity: Maximum number of active items to maintain in working memory
        decay_rate: Rate at which activation decays over time
        activation_boost: How much activation increases on access
        retention_threshold: Activation level below which items are removed
    """

    def __init__(self, memory_store=None, event_bus=None, capacity=7, 
                 decay_rate=0.05, activation_boost=0.5, retention_threshold=0.2):
        """Initialize the working memory system.
        
        Args:
            memory_store: Persistent storage for overflow items
            event_bus: Event bus for publishing memory events
            capacity: Maximum number of active items (Miller's 7±2)
            decay_rate: Rate at which activation decays over time
            activation_boost: How much activation increases on access
            retention_threshold: Activation level below which items are removed
        """
        self.memory_store = memory_store
        self.event_bus = event_bus
        self.items = {}
        self.capacity = capacity
        self.decay_rate = decay_rate
        self.activation_boost = activation_boost
        self.retention_threshold = retention_threshold
        self._last_decay_time = time.time()
        
        # Set for tracking IDs that need to be consolidated
        self._consolidation_queue = set()
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info(f"Working memory initialized with capacity {capacity}")
        
        # Start periodic decay task if running in event loop
        try:
            asyncio.get_event_loop().create_task(self._periodic_decay())
        except RuntimeError:
            logger.warning("No event loop running, skipping periodic decay task")
    
    async def add_item(self, item: WorkingMemoryItem) -> str:
        """Add an item to working memory with maximum activation.
        
        Args:
            item: The WorkingMemoryItem to add to working memory
            
        Returns:
            ID of the added item
        """
        async with self._lock:
            # Ensure the item has an ID
            if not item.id:
                item.id = item.generate_id()
                
            # Set initial activation level and timestamp
            item.activation = 1.0
            item.last_accessed = datetime.now()
            
            # Add to items dictionary
            self.items[item.id] = item
            
            # Check if we need to forget some items
            await self._manage_capacity()
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    "memory.working.item_added",
                    {"item_id": item.id, "item_type": item.item_type}
                )
            
            logger.debug(f"Added item {item.id} to working memory")
            return item.id
    
    async def get_item(self, item_id: str) -> Optional[WorkingMemoryItem]:
        """Get an item from working memory by ID.
        
        Args:
            item_id: ID of the item to retrieve
            
        Returns:
            WorkingMemoryItem if found, None otherwise
        """
        async with self._lock:
            # Check if item is in working memory
            item = self.items.get(item_id)
            
            if item:
                # Boost activation since item was accessed
                await self._boost_activation(item)
                return item
            
            # If not in working memory but we have memory store, try to retrieve from there
            if self.memory_store and item_id:
                try:
                    # Retrieve from memory store
                    stored_item = await self.memory_store.get(f"working_memory:{item_id}")
                    if stored_item:
                        # Convert from dictionary to WorkingMemoryItem
                        if isinstance(stored_item, dict):
                            item = WorkingMemoryItem.from_dict(stored_item)
                        else:
                            item = stored_item
                            
                        # Add back to working memory with boosted activation
                        item.activation = 1.0
                        item.last_accessed = datetime.now()
                        self.items[item_id] = item
                        
                        # Manage capacity since we added a new item
                        await self._manage_capacity()
                        
                        logger.debug(f"Retrieved item {item_id} from memory store")
                        return item
                except Exception as e:
                    logger.error(f"Error retrieving item {item_id} from memory store: {e}")
            
            return None
    
    async def get_items(self, limit: int = None, item_type: Optional[str] = None) -> List[WorkingMemoryItem]:
        """Get all items in working memory, optionally filtered and limited.
        
        Args:
            limit: Maximum number of items to return
            item_type: Filter by item type if provided
            
        Returns:
            List of WorkingMemoryItems
        """
        async with self._lock:
            # First apply decay to ensure activation levels are current
            await self._apply_decay()
            
            # Filter by type if needed
            if item_type:
                filtered_items = [item for item in self.items.values() 
                               if item.item_type == item_type]
            else:
                filtered_items = list(self.items.values())
                
            # Sort by activation (highest first)
            sorted_items = sorted(filtered_items, key=lambda x: x.activation, reverse=True)
            
            # Apply limit if needed
            if limit is not None and limit > 0:
                sorted_items = sorted_items[:limit]
                
            # Boost activation for all retrieved items
            for item in sorted_items:
                await self._boost_activation(item)
                
            return sorted_items
            
    @cached(ttl=60)
    async def search_by_content(self, query: str, limit: int = 5) -> List[WorkingMemoryItem]:
        """Search working memory items by content using embedding similarity.
        
        Args:
            query: Text query to search for
            limit: Maximum number of results to return
            
        Returns:
            List of WorkingMemoryItems matching the query
        """
        async with self._lock:
            # First update activation levels
            await self._apply_decay()
            
            if not self.items:
                return []
            
            # Generate query embedding
            query_embedding = await self._generate_embedding(query)
            if query_embedding is None:
                # Fall back to substring search if embedding generation fails
                results = [
                    item for item in self.items.values()
                    if query.lower() in item.content.lower()
                ]
                return sorted(results, key=lambda x: x.activation, reverse=True)[:limit]
                
            # Calculate similarity for all items
            similarities = []
            for item in self.items.values():
                # Generate embedding if it doesn't exist
                if item.embedding is None or len(item.embedding) == 0:
                    item.embedding = await self._generate_embedding(item.content)
                    
                # Calculate similarity if embedding exists
                if item.embedding is not None and len(item.embedding) > 0:
                    similarity = self._calculate_similarity(query_embedding, item.embedding)
                    similarities.append((similarity, item))
            
            # Sort by similarity (highest first)
            similarities.sort(reverse=True)
            
            # Get the top results
            results = [item for _, item in similarities[:limit]]
            
            # Boost activation for retrieved items
            for item in results:
                await self._boost_activation(item)
                
            return results
    
    async def remove_item(self, item_id: str) -> bool:
        """Explicitly remove an item from working memory.
        
        Args:
            item_id: ID of the item to remove
            
        Returns:
            True if item was removed, False otherwise
        """
        async with self._lock:
            if item_id in self.items:
                item = self.items.pop(item_id)
                
                # If the item has high activation and memory store is available,
                # store it before removing
                if self.memory_store and item.activation > self.retention_threshold:
                    try:
                        await self.memory_store.set(
                            f"working_memory:{item_id}", 
                            item.to_dict()
                        )
                        logger.debug(f"Stored item {item_id} in memory store before removal")
                    except Exception as e:
                        logger.error(f"Error storing item {item_id} in memory store: {e}")
                
                # Publish event if event bus is available
                if self.event_bus:
                    await self.event_bus.publish(
                        "memory.working.item_removed",
                        {"item_id": item_id}
                    )
                    
                logger.debug(f"Removed item {item_id} from working memory")
                return True
            return False

    # Internal helper methods
    
    async def _boost_activation(self, item: WorkingMemoryItem) -> None:
        """Boost the activation level of an item.
        
        Args:
            item: The item to boost activation for
        """
        # Update last accessed timestamp
        item.last_accessed = datetime.now()
        
        # Boost activation (capped at 1.0)
        item.activation = min(1.0, item.activation + self.activation_boost)
        
        # Add to consolidation queue if it's not already being consolidated
        self._consolidation_queue.add(item.id)
    
    async def _apply_decay(self) -> None:
        """Apply time-based decay to all items in working memory."""
        current_time = time.time()
        elapsed = current_time - self._last_decay_time
        
        # Only apply decay if enough time has passed
        if elapsed < 0.1:  # 100ms minimum to avoid excessive calculation
            return
            
        self._last_decay_time = current_time
        
        # Calculate decay factor based on elapsed time
        decay_factor = self.decay_rate * elapsed
        
        # Apply decay to all items
        forgotten_items = []
        for item_id, item in list(self.items.items()):
            item.activation = max(0.0, item.activation - decay_factor)
            
            # If activation drops below threshold, mark for removal
            if item.activation < self.retention_threshold:
                forgotten_items.append(item_id)
        
        # Remove forgotten items
        for item_id in forgotten_items:
            await self._forget_item(item_id)
    
    async def _forget_item(self, item_id: str) -> None:
        """Forget an item from working memory, potentially storing in long-term memory.
        
        Args:
            item_id: ID of the item to forget
        """
        if item_id in self.items:
            item = self.items.pop(item_id)
            
            # Store in memory store if available
            if self.memory_store:
                try:
                    await self.memory_store.set(
                        f"working_memory:{item_id}",
                        item.to_dict()
                    )
                    logger.debug(f"Moved item {item_id} from working memory to memory store")
                except Exception as e:
                    logger.error(f"Error storing forgotten item {item_id}: {e}")
            
            # Publish forget event
            if self.event_bus:
                await self.event_bus.publish(
                    "memory.working.item_forgotten",
                    {"item_id": item_id}
                )
    
    async def _manage_capacity(self) -> None:
        """Ensure working memory stays within capacity limits."""
        if len(self.items) <= self.capacity:
            return
            
        # First apply decay to ensure activation levels are current
        await self._apply_decay()
        
        # If still over capacity, forget lowest activation items
        if len(self.items) > self.capacity:
            # Sort items by activation (lowest first)
            sorted_items = sorted(
                self.items.items(),
                key=lambda x: x[1].activation
            )
            
            # Forget items until we're within capacity
            to_forget = len(self.items) - self.capacity
            for i in range(to_forget):
                if i < len(sorted_items):
                    item_id = sorted_items[i][0]
                    await self._forget_item(item_id)
    
    async def _periodic_decay(self) -> None:
        """Periodically apply decay to working memory items."""
        while True:
            try:
                # Apply decay to all items
                await self._apply_decay()
                
                # Process any items that need consolidation
                await self._process_consolidation_queue()
                
                # Sleep for a bit before next decay
                await asyncio.sleep(1.0)  # 1 second interval
                
            except asyncio.CancelledError:
                logger.info("Working memory periodic decay task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in working memory periodic decay: {e}")
                await asyncio.sleep(5.0)  # Sleep longer on error
    
    async def _process_consolidation_queue(self) -> None:
        """Process items in the consolidation queue, potentially storing in semantic memory."""
        if not self._consolidation_queue or not self.event_bus:
            return
            
        # Process each item in the queue
        for item_id in list(self._consolidation_queue):
            if item_id in self.items:
                item = self.items[item_id]
                
                # Only consolidate items accessed frequently
                if item.access_count > 3 and item.activation > 0.7:
                    try:
                        # Publish consolidation event for semantic memory to process
                        await self.event_bus.publish(
                            "memory.working.consolidate_item",
                            {
                                "item_id": item.id,
                                "content": item.content,
                                "metadata": item.metadata,
                                "item_type": item.item_type,
                                "source": "working_memory"
                            }
                        )
                        logger.debug(f"Requested consolidation for item {item_id}")
                    except Exception as e:
                        logger.error(f"Error publishing consolidation event: {e}")
                        
            # Remove from queue regardless of success
            self._consolidation_queue.discard(item_id)
    
    async def _generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate an embedding vector for text content.
        
        Args:
            text: The text to generate an embedding for
            
        Returns:
            List of floats representing the embedding vector, or None if generation fails
        """
        # This is a placeholder implementation. In a production system,
        # this would call a proper embedding service or model.
        # For now, we'll generate a simple pseudo-embedding based on character frequency.
        
        try:
            # Basic embedding approach - just to provide a working implementation
            # In production, replace with a proper embedding model or API call
            if not text or len(text) == 0:
                return np.zeros(128).tolist()
                
            # Character frequency as a simple encoding (just for demonstration)
            char_freq = {}
            for char in text.lower():
                if char in char_freq:
                    char_freq[char] += 1
                else:
                    char_freq[char] = 1
                    
            # Create a fixed-size vector from character frequencies
            base_vector = np.zeros(128)
            for i, char in enumerate(sorted(char_freq.keys())):
                if i < 128:
                    base_vector[i] = char_freq[char] / len(text)
                    
            # Normalize the vector
            norm = np.linalg.norm(base_vector)
            if norm > 0:
                base_vector = base_vector / norm
                
            return base_vector.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    def _calculate_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two embedding vectors.
        
        Args:
            vec1: First embedding vector
            vec2: Second embedding vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            # Convert to numpy arrays if they aren't already
            v1 = np.array(vec1)
            v2 = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(v1, v2)
            norm_v1 = np.linalg.norm(v1)
            norm_v2 = np.linalg.norm(v2)
            
            if norm_v1 == 0 or norm_v2 == 0:
                return 0.0
                
            return dot_product / (norm_v1 * norm_v2)
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
