"""
ALEJO Memory Service
Advanced memory management with distributed caching and long-term storage
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import redis
from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..core.event_bus import EventBus, Event, EventType
from ..utils.exceptions import MemoryError

logger = logging.getLogger(__name__)
Base = declarative_base()

class MemoryRecord(Base):
    """SQLAlchemy model for long-term memory storage"""
    __tablename__ = 'memories'
    
    id = Column(Integer, primary_key=True)
    type = Column(String(50))
    content = Column(JSON)
    context = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    importance = Column(Float)
    associations = Column(JSON)
    retrieval_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)

class MemoryService:
    """
    Enhanced memory service with distributed caching and contextual retrieval
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0",
                 db_url: str = "sqlite:///data/memory/alejo_memory.db"):
        self.redis_url = redis_url
        self.db_url = db_url
        self.redis = None
        self.engine = None
        self.db = None
        
    async def initialize(self):
        """Initialize Redis and SQLAlchemy connections with fallback modes"""
        try:
            # Ensure data directory exists
            db_path = Path(self.db_url.replace('sqlite:///', ''))
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Initialize Redis with retry
            retry_count = 3
            while retry_count > 0:
                try:
                    self.redis = redis.Redis.from_url(self.redis_url)
                    self.redis.ping()
                    break
                except (redis.ConnectionError, redis.ResponseError) as e:
                    retry_count -= 1
                    if retry_count == 0:
                        logger.warning(f"Redis connection failed: {e}. Using in-memory cache.")
                        self.redis = None
                    else:
                        await asyncio.sleep(1)
            
            # Initialize SQLAlchemy with retry
            retry_count = 3
            while retry_count > 0:
                try:
                    self.engine = create_engine(self.db_url)
                    Base.metadata.create_all(self.engine)
                    Session = sessionmaker(bind=self.engine)
                    self.db = Session()
                    break
                except Exception as e:
                    retry_count -= 1
                    if retry_count == 0:
                        logger.error(f"Database initialization failed: {e}")
                        raise
                    else:
                        await asyncio.sleep(1)
            
            # Initialize event bus
            self.event_bus = EventBus()
            
            # Memory cache settings
            self.cache_ttl = 3600  # 1 hour cache TTL
            self.max_cache_size = 1000
            
            # Initialize memory indices if Redis is available
            if self.redis:
                await self._init_indices()
            else:
                # Use in-memory fallback
                self.memory_cache = {}
                self.temporal_index = []
                self.importance_index = []
                self.type_index = {}
                
        except Exception as e:
            logger.error(f"Memory service initialization failed: {e}")
            raise
        
    async def start(self):
        """Start the memory service"""
        await self.event_bus.start()
        self.event_bus.subscribe(EventType.MEMORY, self._handle_memory_event)
        logger.info("Memory service started")
        
    async def stop(self):
        """Stop the memory service"""
        await self.event_bus.stop()
        self.db.close()
        logger.info("Memory service stopped")
        
    def _init_indices(self):
        """Initialize memory indices for faster retrieval"""
        try:
            self.redis.delete("memory_index:temporal")
            self.redis.delete("memory_index:importance")
            self.redis.delete("memory_index:type")
            
            # Rebuild indices from database
            memories = self.db.query(MemoryRecord).all()
            for memory in memories:
                self._index_memory(memory)
                
        except Exception as e:
            logger.error(f"Error initializing indices: {e}")
            
    def _index_memory(self, memory: MemoryRecord):
        """Index a memory for faster retrieval"""
        # Temporal index
        self.redis.zadd("memory_index:temporal", 
                       {str(memory.id): memory.timestamp.timestamp()})
        
        # Importance index
        self.redis.zadd("memory_index:importance",
                       {str(memory.id): memory.importance})
        
        # Type index
        self.redis.sadd(f"memory_index:type:{memory.type}", str(memory.id))
        
    async def store_memory(self, type: str, content: dict, context: dict = None,
                          importance: float = 0.5) -> int:
        """Store a new memory"""
        try:
            # Create memory record
            memory = MemoryRecord(
                type=type,
                content=content,
                context=context or {},
                importance=importance,
                associations={},
                last_accessed=datetime.utcnow()
            )
            
            # Store in database
            self.db.add(memory)
            self.db.commit()
            
            # Index the memory
            self._index_memory(memory)
            
            # Cache if important
            if importance > 0.7:
                self._cache_memory(memory)
                
            # Emit memory event
            await self.event_bus.emit_memory(
                memory_type=type,
                content={"id": memory.id, "content": content},
                source="memory_service"
            )
            
            return memory.id
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error storing memory: {e}")
            raise MemoryError(f"Failed to store memory: {e}")
            
    async def retrieve_memory(self, type: str = None, context: dict = None,
                            limit: int = 10) -> List[Dict]:
        """
        Retrieve memories based on type and context
        Uses both cache and database with smart retrieval
        """
        try:
            results = []
            
            # Check cache first for recent/important memories
            if type:
                cached_ids = self.redis.smembers(f"memory_index:type:{type}")
                for mem_id in cached_ids:
                    cached = self.redis.get(f"memory:{mem_id}")
                    if cached:
                        results.append(json.loads(cached))
                        
            # If we need more results, query database
            if len(results) < limit:
                query = self.db.query(MemoryRecord)
                if type:
                    query = query.filter(MemoryRecord.type == type)
                if context:
                    # Apply context-based filtering
                    matching_memories = []
                    for memory in query.all():
                        match_score = self._calculate_context_match(memory.context, context)
                        if match_score > 0.5:  # Threshold for context matching
                            matching_memories.append((memory, match_score))
                    
                    # Sort by match score and limit results
                    matching_memories.sort(key=lambda x: x[1], reverse=True)
                    query = [mem for mem, _ in matching_memories[:limit]]
                else:
                    query = query.all()
                    
                query = query.order_by(MemoryRecord.importance.desc())
                query = query.limit(limit - len(results))
                
                for memory in query.all():
                    memory.retrieval_count += 1
                    memory.last_accessed = datetime.utcnow()
                    results.append({
                        "id": memory.id,
                        "type": memory.type,
                        "content": memory.content,
                        "context": memory.context,
                        "importance": memory.importance,
                        "timestamp": memory.timestamp.isoformat()
                    })
                    
            self.db.commit()
            return results
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error retrieving memories: {e}")
            raise MemoryError(f"Failed to retrieve memories: {e}")
            
    def _calculate_context_match(self, memory_context: dict, query_context: dict) -> float:
        """Calculate how well a memory's context matches the query context
        
        Args:
            memory_context: The stored memory's context
            query_context: The context we're searching for
            
        Returns:
            float: Match score between 0 and 1
        """
        if not memory_context or not query_context:
            return 0.0
            
        total_score = 0.0
        total_weight = 0.0
        
        # Check exact matches for keys that exist in both contexts
        for key in set(memory_context.keys()) & set(query_context.keys()):
            weight = 1.0
            if isinstance(memory_context[key], (str, int, float, bool)):
                # Direct comparison for simple types
                if memory_context[key] == query_context[key]:
                    total_score += weight
            elif isinstance(memory_context[key], (list, set)):
                # Calculate overlap for collections
                mem_set = set(memory_context[key])
                query_set = set(query_context[key])
                if mem_set and query_set:
                    overlap = len(mem_set & query_set) / len(mem_set | query_set)
                    total_score += weight * overlap
            elif isinstance(memory_context[key], dict):
                # Recursive match for nested contexts
                nested_score = self._calculate_context_match(
                    memory_context[key], query_context[key])
                total_score += weight * nested_score
            total_weight += weight
            
        # Time-based matching if timestamps are present
        if 'timestamp' in memory_context and 'timestamp' in query_context:
            try:
                mem_time = datetime.fromisoformat(str(memory_context['timestamp']))
                query_time = datetime.fromisoformat(str(query_context['timestamp']))
                time_diff = abs((mem_time - query_time).total_seconds())
                time_score = 1.0 / (1.0 + time_diff/86400)  # Decay over 24 hours
                total_score += time_score
                total_weight += 1.0
            except (ValueError, TypeError):
                pass
                
        return total_score / total_weight if total_weight > 0 else 0.0

    def _cache_memory(self, memory: MemoryRecord):
        """Cache a memory in Redis"""
        try:
            memory_data = {
                "id": memory.id,
                "type": memory.type,
                "content": memory.content,
                "context": memory.context,
                "importance": memory.importance,
                "timestamp": memory.timestamp.isoformat()
            }
            
            # Store in Redis with TTL
            self.redis.setex(
                f"memory:{memory.id}",
                self.cache_ttl,
                json.dumps(memory_data)
            )
            
        except Exception as e:
            logger.error(f"Error caching memory: {e}")
            
    async def update_memory(self, memory_id: int, updates: dict) -> bool:
        """Update an existing memory"""
        try:
            memory = self.db.query(MemoryRecord).get(memory_id)
            if not memory:
                raise MemoryError(f"Memory {memory_id} not found")
                
            # Update fields
            for key, value in updates.items():
                if hasattr(memory, key):
                    setattr(memory, key, value)
                    
            memory.last_accessed = datetime.utcnow()
            self.db.commit()
            
            # Update cache and indices
            self._index_memory(memory)
            if memory.importance > 0.7:
                self._cache_memory(memory)
                
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating memory: {e}")
            raise MemoryError(f"Failed to update memory: {e}")
            
    async def _handle_memory_event(self, event: Event):
        """Handle incoming memory events"""
        try:
            if event.source == "memory_service":
                return  # Ignore own events
                
            if "store" in event.payload:
                await self.store_memory(
                    type=event.payload["type"],
                    content=event.payload["content"],
                    context=event.payload.get("context"),
                    importance=event.payload.get("importance", 0.5)
                )
                
        except Exception as e:
            logger.error(f"Error handling memory event: {e}")
            
    async def cleanup_old_memories(self, days_old: int = 30):
        """Clean up old, unimportant memories"""
        try:
            cutoff = datetime.utcnow() - timedelta(days=days_old)
            self.db.query(MemoryRecord).filter(
                MemoryRecord.timestamp < cutoff,
                MemoryRecord.importance < 0.3,
                MemoryRecord.retrieval_count < 2
            ).delete()
            
            self.db.commit()
            logger.info(f"Cleaned up memories older than {days_old} days")
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error cleaning up memories: {e}")
