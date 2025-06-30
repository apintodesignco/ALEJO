"""
Memory optimization and consistency management
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class MemoryStats:
    """Statistics for memory system"""
    total_memories: int = 0
    active_memories: int = 0
    archived_memories: int = 0
    memory_size_bytes: int = 0
    last_optimization: float = 0
    last_consistency_check: float = 0
    inconsistencies_found: int = 0

class MemoryOptimizer:
    """
    Optimizes memory storage and ensures consistency
    """
    
    def __init__(
        self,
        max_active_memories: int = 1000,
        optimization_interval: float = 3600,  # 1 hour
        consistency_check_interval: float = 1800,  # 30 minutes
        memory_ttl: float = 604800  # 7 days
    ):
        self.max_active_memories = max_active_memories
        self.optimization_interval = optimization_interval
        self.consistency_check_interval = consistency_check_interval
        self.memory_ttl = memory_ttl
        
        self.stats = MemoryStats()
        self._active_memories: Dict[str, Dict[str, Any]] = {}
        self._archived_memories: Dict[str, Dict[str, Any]] = {}
        self._memory_index: Dict[str, Set[str]] = {}  # topic -> memory_ids
        self._lock = asyncio.Lock()
        
    async def optimize_memories(self):
        """
        Optimize memory storage by archiving old memories
        """
        async with self._lock:
            current_time = time.time()
            
            # Skip if last optimization was recent
            if (current_time - self.stats.last_optimization) < self.optimization_interval:
                return
            
            logger.info("Starting memory optimization")
            
            # Find memories to archive
            to_archive = []
            for memory_id, memory in self._active_memories.items():
                age = current_time - memory["timestamp"]
                access_count = memory.get("access_count", 0)
                importance = memory.get("importance", 0.5)
                
                # Archive if old and unimportant
                if age > self.memory_ttl and importance < 0.7 and access_count < 5:
                    to_archive.append(memory_id)
                    
            # Archive memories
            for memory_id in to_archive:
                memory = self._active_memories.pop(memory_id)
                self._archived_memories[memory_id] = memory
                
                # Update indexes
                for topic in memory.get("topics", []):
                    if topic in self._memory_index:
                        self._memory_index[topic].remove(memory_id)
            
            # Update stats
            self.stats.total_memories = len(self._active_memories) + len(self._archived_memories)
            self.stats.active_memories = len(self._active_memories)
            self.stats.archived_memories = len(self._archived_memories)
            self.stats.last_optimization = current_time
            
            logger.info(f"Memory optimization complete. Archived {len(to_archive)} memories")
    
    async def check_consistency(self):
        """
        Check memory consistency and repair if needed
        """
        async with self._lock:
            current_time = time.time()
            
            # Skip if recent check
            if (current_time - self.stats.last_consistency_check) < self.consistency_check_interval:
                return
            
            logger.info("Starting memory consistency check")
            inconsistencies = 0
            
            # Check index consistency
            for topic, memory_ids in self._memory_index.items():
                for memory_id in list(memory_ids):
                    if (
                        memory_id not in self._active_memories
                        and memory_id not in self._archived_memories
                    ):
                        # Remove orphaned reference
                        memory_ids.remove(memory_id)
                        inconsistencies += 1
            
            # Check memory references
            for memory in list(self._active_memories.values()):
                for ref_id in memory.get("references", []):
                    if (
                        ref_id not in self._active_memories
                        and ref_id not in self._archived_memories
                    ):
                        # Remove invalid reference
                        memory["references"].remove(ref_id)
                        inconsistencies += 1
            
            # Update stats
            self.stats.last_consistency_check = current_time
            self.stats.inconsistencies_found = inconsistencies
            
            logger.info(f"Memory consistency check complete. Found {inconsistencies} issues")
    
    async def add_memory(self, memory: Dict[str, Any]) -> str:
        """
        Add new memory with optimization checks
        """
        async with self._lock:
            memory_id = memory.get("id") or str(time.time())
            
            # Check capacity
            if len(self._active_memories) >= self.max_active_memories:
                await self.optimize_memories()
            
            # Add memory
            self._active_memories[memory_id] = {
                **memory,
                "timestamp": time.time(),
                "access_count": 0
            }
            
            # Update indexes
            for topic in memory.get("topics", []):
                if topic not in self._memory_index:
                    self._memory_index[topic] = set()
                self._memory_index[topic].add(memory_id)
            
            return memory_id
    
    async def get_memory(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve memory with access tracking
        """
        async with self._lock:
            memory = self._active_memories.get(memory_id)
            
            if memory:
                # Update access count
                memory["access_count"] = memory.get("access_count", 0) + 1
                return memory
            
            # Check archived memories
            memory = self._archived_memories.get(memory_id)
            if memory:
                # Restore frequently accessed archived memories
                if memory.get("access_count", 0) > 10:
                    self._active_memories[memory_id] = memory
                    del self._archived_memories[memory_id]
                return memory
            
            return None
    
    async def update_memory(self, memory_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update memory with consistency checks
        """
        async with self._lock:
            memory = await self.get_memory(memory_id)
            if not memory:
                return False
            
            # Update memory
            memory.update(updates)
            memory["last_modified"] = time.time()
            
            # Update indexes if topics changed
            if "topics" in updates:
                old_topics = set(memory.get("topics", []))
                new_topics = set(updates["topics"])
                
                # Remove from old topics
                for topic in old_topics - new_topics:
                    if topic in self._memory_index:
                        self._memory_index[topic].remove(memory_id)
                
                # Add to new topics
                for topic in new_topics - old_topics:
                    if topic not in self._memory_index:
                        self._memory_index[topic] = set()
                    self._memory_index[topic].add(memory_id)
            
            return True
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get memory system statistics
        """
        return {
            "total_memories": self.stats.total_memories,
            "active_memories": self.stats.active_memories,
            "archived_memories": self.stats.archived_memories,
            "memory_size_bytes": self.stats.memory_size_bytes,
            "last_optimization": datetime.fromtimestamp(self.stats.last_optimization),
            "last_consistency_check": datetime.fromtimestamp(self.stats.last_consistency_check),
            "inconsistencies_found": self.stats.inconsistencies_found,
            "index_stats": {
                topic: len(memories)
                for topic, memories in self._memory_index.items()
            }
        }
