import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np

from alejo.cognitive.memory.models import Concept, MemoryType, Relationship, RelationshipType
from alejo.database.memory_store import MemoryStore
from alejo.performance.cache_decorator import cached

logger = logging.getLogger(__name__)


class SemanticMemory:
    """Production implementation of SemanticMemory.
    
    Semantic memory stores general knowledge, facts, and concepts that aren't tied to
    specific experiences. This implementation provides storage, retrieval, and management
    of semantic knowledge with features like:
    
    - Concept storage and retrieval
    - Relationship management (knowledge graph)
    - Semantic search via embeddings
    - Inference through graph traversal
    - Event notification via event bus
    """

    def __init__(self, event_bus, memory_store: MemoryStore):
        """Initialize the semantic memory system.
        
        Args:
            event_bus: Event bus for publishing memory events
            memory_store: Storage backend for persisting memories
        """
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.embedding_dimension = 384  # Default for small sentence transformers
        self._embedding_model = None
        
        # Cache for recently accessed concepts and relationships
        self._concept_cache = {}
        self._relationship_cache = {}
        self._cache_max_size = 200
        self._cache_ttl = 600  # 10 minutes
        
        logger.info("Semantic memory system initialized")
        
    async def initialize(self):
        """Initialize the semantic memory system, creating necessary tables and indices."""
        # Create concepts table
        await self.memory_store.ensure_table(
            "semantic_concepts",
            {
                "id": "TEXT PRIMARY KEY",
                "name": "TEXT",
                "description": "TEXT",
                "attributes": "TEXT",  # JSON
                "categories": "TEXT",  # JSON array
                "confidence": "REAL",
                "source": "TEXT",
                "embedding": "BLOB",
                "created_at": "TEXT",
                "last_accessed": "TEXT"
            }
        )
        
        # Create relationships table
        await self.memory_store.ensure_table(
            "semantic_relationships",
            {
                "id": "TEXT PRIMARY KEY",
                "source_id": "TEXT",
                "target_id": "TEXT",
                "relationship_type": "TEXT",
                "strength": "REAL",
                "attributes": "TEXT",  # JSON
                "created_at": "TEXT",
                "last_accessed": "TEXT",
                "FOREIGN KEY (source_id)": "REFERENCES semantic_concepts(id) ON DELETE CASCADE",
                "FOREIGN KEY (target_id)": "REFERENCES semantic_concepts(id) ON DELETE CASCADE"
            }
        )
        
        # Create indices for efficient retrieval
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_semantic_concept_name ON semantic_concepts(name)")
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_semantic_relationship_source ON semantic_relationships(source_id)")
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_semantic_relationship_target ON semantic_relationships(target_id)")
        await self.memory_store.execute(
            "CREATE INDEX IF NOT EXISTS idx_semantic_relationship_type ON semantic_relationships(relationship_type)")
            
        logger.info("Semantic memory tables and indices initialized")
        
    async def add_concept(self, concept: Union[Concept, Dict[str, Any]]) -> str:
        """Add a concept to semantic memory.
        
        Args:
            concept: Concept object or dictionary with concept data
            
        Returns:
            str: ID of the stored concept
        """
        if not isinstance(concept, Concept):
            concept = Concept.from_dict(concept)
            
        # Generate embedding if not present
        if concept.embedding is None and concept.description:
            concept.embedding = await self._generate_embedding(concept.description)
            
        # Store in database
        await self._store_concept_in_db(concept)
        
        # Add to cache
        self._add_to_concept_cache(concept)
        
        # Publish event
        await self._publish_event("semantic_concept_added", {"concept_id": concept.id})
        
        logger.debug(f"Added semantic concept: {concept.id} - {concept.name}")
        return concept.id
        
    async def get_concept(self, concept_id: str) -> Optional[Concept]:
        """Retrieve a specific concept by ID.
        
        Args:
            concept_id: ID of the concept to retrieve
            
        Returns:
            Concept object if found, None otherwise
        """
        # Check cache first
        if concept_id in self._concept_cache:
            cache_entry = self._concept_cache[concept_id]
            if time.time() - cache_entry["timestamp"] < self._cache_ttl:
                concept = cache_entry["concept"]
                concept.last_accessed = datetime.now()
                # Update last accessed in database asynchronously
                asyncio.create_task(self._update_concept_last_accessed(concept_id))
                return concept
        
        # Retrieve from database
        query = "SELECT * FROM semantic_concepts WHERE id = ?"
        result = await self.memory_store.execute(query, (concept_id,), fetch_one=True)
        
        if not result:
            return None
            
        concept = self._row_to_concept(result)
        
        # Update last accessed
        concept.last_accessed = datetime.now()
        await self._update_concept_last_accessed(concept_id)
        
        # Add to cache
        self._add_to_concept_cache(concept)
        
        return concept
        
    async def get_concept_by_name(self, name: str) -> Optional[Concept]:
        """Retrieve a concept by its name.
        
        Args:
            name: Name of the concept to retrieve
            
        Returns:
            Concept object if found, None otherwise
        """
        query = "SELECT * FROM semantic_concepts WHERE name = ? COLLATE NOCASE"
        result = await self.memory_store.execute(query, (name,), fetch_one=True)
        
        if not result:
            return None
            
        concept = self._row_to_concept(result)
        
        # Update last accessed
        concept.last_accessed = datetime.now()
        await self._update_concept_last_accessed(concept.id)
        
        # Add to cache
        self._add_to_concept_cache(concept)
        
        return concept
        
    @cached(ttl_seconds=60)
    async def get_all_concepts(self, limit: int = 100, offset: int = 0) -> List[Concept]:
        """Return all stored concepts with pagination.
        
        Args:
            limit: Maximum number of concepts to return
            offset: Number of concepts to skip
            
        Returns:
            List of Concept objects
        """
        query = "SELECT * FROM semantic_concepts ORDER BY name LIMIT ? OFFSET ?"
        results = await self.memory_store.execute(query, (limit, offset))
        
        concepts = [self._row_to_concept(row) for row in results]
        return concepts
        
    async def update_concept(self, concept_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing concept.
        
        Args:
            concept_id: ID of the concept to update
            updates: Dictionary of fields to update
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Get current concept
        concept = await self.get_concept(concept_id)
        if not concept:
            return False
            
        # Apply updates
        for key, value in updates.items():
            if hasattr(concept, key):
                setattr(concept, key, value)
                
        # If description was updated, regenerate embedding
        if "description" in updates:
            concept.embedding = await self._generate_embedding(concept.description)
            
        # Store updated concept
        await self._store_concept_in_db(concept)
        
        # Update cache
        self._add_to_concept_cache(concept)
        
        # Publish event
        await self._publish_event("semantic_concept_updated", {"concept_id": concept_id})
        
        return True
        
    async def delete_concept(self, concept_id: str) -> bool:
        """Delete a concept from semantic memory.
        
        Args:
            concept_id: ID of the concept to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Delete from database
        query = "DELETE FROM semantic_concepts WHERE id = ?"
        result = await self.memory_store.execute(query, (concept_id,))
        
        # Remove from cache
        if concept_id in self._concept_cache:
            del self._concept_cache[concept_id]
            
        # Publish event
        await self._publish_event("semantic_concept_deleted", {"concept_id": concept_id})
        
        return result > 0
        
    async def add_relationship(self, relationship: Union[Relationship, Dict[str, Any]]) -> str:
        """Add a relationship between two concepts.
        
        Args:
            relationship: Relationship object or dictionary with relationship data
            
        Returns:
            str: ID of the stored relationship
        """
        if not isinstance(relationship, Relationship):
            relationship = Relationship.from_dict(relationship)
            
        # Verify that both source and target concepts exist
        source_concept = await self.get_concept(relationship.source_id)
        target_concept = await self.get_concept(relationship.target_id)
        
        if not source_concept or not target_concept:
            raise ValueError("Both source and target concepts must exist")
            
        # Store in database
        await self._store_relationship_in_db(relationship)
        
        # Add to cache
        self._add_to_relationship_cache(relationship)
        
        # Publish event
        await self._publish_event("semantic_relationship_added", {
            "relationship_id": relationship.id,
            "source_id": relationship.source_id,
            "target_id": relationship.target_id
        })
        
        logger.debug(f"Added semantic relationship: {relationship.id} - {relationship.relationship_type}")
        return relationship.id
        
    async def get_relationship(self, relationship_id: str) -> Optional[Relationship]:
        """Retrieve a specific relationship by ID.
        
        Args:
            relationship_id: ID of the relationship to retrieve
            
        Returns:
            Relationship object if found, None otherwise
        """
        # Check cache first
        if relationship_id in self._relationship_cache:
            cache_entry = self._relationship_cache[relationship_id]
            if time.time() - cache_entry["timestamp"] < self._cache_ttl:
                relationship = cache_entry["relationship"]
                relationship.last_accessed = datetime.now()
                # Update last accessed in database asynchronously
                asyncio.create_task(self._update_relationship_last_accessed(relationship_id))
                return relationship
        
        # Retrieve from database
        query = "SELECT * FROM semantic_relationships WHERE id = ?"
        result = await self.memory_store.execute(query, (relationship_id,), fetch_one=True)
        
        if not result:
            return None
            
        relationship = self._row_to_relationship(result)
        
        # Update last accessed
        relationship.last_accessed = datetime.now()
        await self._update_relationship_last_accessed(relationship_id)
        
        # Add to cache
        self._add_to_relationship_cache(relationship)
        
        return relationship
        
    async def get_relationships_for_concept(self, concept_id: str, relationship_type: Optional[Union[RelationshipType, str]] = None) -> List[Relationship]:
        """Get all relationships for a specific concept.
        
        Args:
            concept_id: ID of the concept
            relationship_type: Optional filter for relationship type
            
        Returns:
            List of Relationship objects
        """
        if relationship_type:
            if isinstance(relationship_type, RelationshipType):
                relationship_type = relationship_type.value
                
            query = """SELECT * FROM semantic_relationships 
                      WHERE (source_id = ? OR target_id = ?) AND relationship_type = ?
                      ORDER BY strength DESC"""
            results = await self.memory_store.execute(query, (concept_id, concept_id, relationship_type))
        else:
            query = """SELECT * FROM semantic_relationships 
                      WHERE source_id = ? OR target_id = ?
                      ORDER BY strength DESC"""
            results = await self.memory_store.execute(query, (concept_id, concept_id))
        
        relationships = [self._row_to_relationship(row) for row in results]
        return relationships
        
    async def get_related_concepts(self, concept_id: str, relationship_type: Optional[Union[RelationshipType, str]] = None) -> List[Tuple[Concept, Relationship]]:
        """Get all concepts related to a specific concept.
        
        Args:
            concept_id: ID of the concept
            relationship_type: Optional filter for relationship type
            
        Returns:
            List of tuples containing (related_concept, relationship)
        """
        relationships = await self.get_relationships_for_concept(concept_id, relationship_type)
        
        related_concepts = []
        for rel in relationships:
            related_id = rel.target_id if rel.source_id == concept_id else rel.source_id
            related_concept = await self.get_concept(related_id)
            if related_concept:
                related_concepts.append((related_concept, rel))
                
        return related_concepts
        
    async def search_concepts(self, query_text: str, limit: int = 10) -> List[Tuple[Concept, float]]:
        """Search for concepts semantically related to the query text.
        
        Args:
            query_text: Text to search for
            limit: Maximum number of results to return
            
        Returns:
            List of tuples containing (Concept, similarity_score)
        """
        # Generate embedding for query
        query_embedding = await self._generate_embedding(query_text)
        
        # First try exact name match
        name_query = "SELECT * FROM semantic_concepts WHERE name LIKE ? LIMIT ?"
        name_results = await self.memory_store.execute(name_query, (f"%{query_text}%", limit))
        
        exact_matches = [self._row_to_concept(row) for row in name_results]
        
        # Then try semantic search
        # In a real implementation, this would use a vector database
        all_concepts = await self.get_all_concepts(limit=1000)  # Reasonable limit for in-memory search
        
        # Calculate similarities
        results = []
        for concept in all_concepts:
            if concept.embedding is not None:
                similarity = self._calculate_similarity(query_embedding, concept.embedding)
                # Add to results if not already in exact matches
                if not any(concept.id == match.id for match in exact_matches):
                    results.append((concept, similarity))
        
        # Sort by similarity and get top results
        results.sort(key=lambda x: x[1], reverse=True)
        semantic_results = results[:max(0, limit - len(exact_matches))]
        
        # Combine results, with exact matches first
        combined_results = [(concept, 1.0) for concept in exact_matches] + semantic_results
        return combined_results[:limit]
        
    async def update_relationship(self, relationship_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing relationship.
        
        Args:
            relationship_id: ID of the relationship to update
            updates: Dictionary of fields to update
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Get current relationship
        relationship = await self.get_relationship(relationship_id)
        if not relationship:
            return False
            
        # Apply updates
        for key, value in updates.items():
            if hasattr(relationship, key):
                setattr(relationship, key, value)
                
        # Store updated relationship
        await self._store_relationship_in_db(relationship)
        
        # Update cache
        self._add_to_relationship_cache(relationship)
        
        # Publish event
        await self._publish_event("semantic_relationship_updated", {"relationship_id": relationship_id})
        
        return True
        
    async def delete_relationship(self, relationship_id: str) -> bool:
        """Delete a relationship from semantic memory.
        
        Args:
            relationship_id: ID of the relationship to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Delete from database
        query = "DELETE FROM semantic_relationships WHERE id = ?"
        result = await self.memory_store.execute(query, (relationship_id,))
        
        # Remove from cache
        if relationship_id in self._relationship_cache:
            del self._relationship_cache[relationship_id]
            
        # Publish event
        await self._publish_event("semantic_relationship_deleted", {"relationship_id": relationship_id})
        
        return result > 0
        
    async def get_knowledge_graph(self, central_concept_id: str = None, depth: int = 2) -> Dict[str, Any]:
        """Generate a knowledge graph centered on a specific concept.
        
        Args:
            central_concept_id: ID of the central concept (optional)
            depth: How many relationship hops to include
            
        Returns:
            Dictionary with nodes and edges representing the knowledge graph
        """
        nodes = {}
        edges = {}
        
        # If no central concept specified, get the most frequently accessed concepts
        if not central_concept_id:
            query = "SELECT * FROM semantic_concepts ORDER BY last_accessed DESC LIMIT 1"
            result = await self.memory_store.execute(query, fetch_one=True)
            if result:
                central_concept_id = result["id"]
            else:
                # No concepts in database
                return {"nodes": [], "edges": []}
        
        # BFS to build the graph
        queue = [(central_concept_id, 0)]  # (concept_id, current_depth)
        visited = set()
        
        while queue:
            current_id, current_depth = queue.pop(0)
            
            if current_id in visited:
                continue
                
            visited.add(current_id)
            
            # Get concept
            concept = await self.get_concept(current_id)
            if not concept:
                continue
                
            # Add to nodes
            nodes[current_id] = {
                "id": concept.id,
                "name": concept.name,
                "description": concept.description,
                "categories": concept.categories
            }
            
            # If we've reached max depth, don't explore further
            if current_depth >= depth:
                continue
                
            # Get relationships
            relationships = await self.get_relationships_for_concept(current_id)
            
            for rel in relationships:
                # Add edge
                edges[rel.id] = {
                    "id": rel.id,
                    "source": rel.source_id,
                    "target": rel.target_id,
                    "type": rel.relationship_type if isinstance(rel.relationship_type, str) else rel.relationship_type.value,
                    "strength": rel.strength
                }
                
                # Add connected concept to queue
                next_id = rel.target_id if rel.source_id == current_id else rel.source_id
                if next_id not in visited:
                    queue.append((next_id, current_depth + 1))
        
        return {
            "nodes": list(nodes.values()),
            "edges": list(edges.values())
        }
        
    async def consolidate_knowledge(self):
        """Consolidate semantic knowledge by identifying patterns and creating new concepts/relationships.
        
        This is a periodic task that analyzes the semantic network to identify patterns,
        redundancies, and opportunities for knowledge consolidation.
        """
        # Get all concepts and relationships
        all_concepts = await self.get_all_concepts(limit=1000)  # Reasonable limit
        
        # Find similar concepts that might be duplicates
        for i, concept1 in enumerate(all_concepts):
            if not concept1.embedding:
                continue
                
            for concept2 in all_concepts[i+1:]:
                if not concept2.embedding:
                    continue
                    
                similarity = self._calculate_similarity(concept1.embedding, concept2.embedding)
                
                # If concepts are very similar, create a relationship between them
                if similarity > 0.9 and similarity < 0.99:  # Not identical but very similar
                    # Check if relationship already exists
                    existing_relationships = await self.get_relationships_for_concept(concept1.id)
                    if not any(r.source_id == concept1.id and r.target_id == concept2.id or 
                              r.source_id == concept2.id and r.target_id == concept1.id 
                              for r in existing_relationships):
                        # Create new relationship
                        relationship = Relationship(
                            source_id=concept1.id,
                            target_id=concept2.id,
                            relationship_type=RelationshipType.SIMILAR_TO,
                            strength=similarity
                        )
                        await self.add_relationship(relationship)
                        
        # Publish event
        await self._publish_event("semantic_knowledge_consolidated", {})
        
        logger.info("Semantic knowledge consolidation completed")
        
    # Helper methods
    
    def _add_to_concept_cache(self, concept: Concept):
        """Add a concept to the in-memory cache."""
        self._concept_cache[concept.id] = {
            "concept": concept,
            "timestamp": time.time()
        }
        
        # Ensure cache doesn't grow too large
        if len(self._concept_cache) > self._max_cache_size:
            # Remove oldest entries
            oldest = sorted(self._concept_cache.items(), key=lambda x: x[1]["timestamp"])
            for i in range(len(self._concept_cache) - self._max_cache_size):
                if i < len(oldest):
                    del self._concept_cache[oldest[i][0]]
                    
    def _add_to_relationship_cache(self, relationship: Relationship):
        """Add a relationship to the in-memory cache."""
        self._relationship_cache[relationship.id] = {
            "relationship": relationship,
            "timestamp": time.time()
        }
        
        # Ensure cache doesn't grow too large
        if len(self._relationship_cache) > self._max_cache_size:
            # Remove oldest entries
            oldest = sorted(self._relationship_cache.items(), key=lambda x: x[1]["timestamp"])
            for i in range(len(self._relationship_cache) - self._max_cache_size):
                if i < len(oldest):
                    del self._relationship_cache[oldest[i][0]]
                    
    async def _store_concept_in_db(self, concept: Concept):
        """Store a concept in the database."""
        # Convert attributes and categories to JSON
        attributes_json = json.dumps(concept.attributes)
        categories_json = json.dumps(concept.categories)
        
        # Convert embedding to bytes if present
        embedding_bytes = None
        if concept.embedding is not None:
            embedding_bytes = concept.embedding.tobytes()
        
        # Prepare data
        data = {
            "id": concept.id,
            "name": concept.name,
            "description": concept.description,
            "attributes": attributes_json,
            "categories": categories_json,
            "confidence": concept.confidence,
            "source": concept.source,
            "embedding": embedding_bytes,
            "created_at": concept.created_at.isoformat(),
            "last_accessed": concept.last_accessed.isoformat()
        }
        
        # Insert or update
        query = """INSERT OR REPLACE INTO semantic_concepts 
                  (id, name, description, attributes, categories, confidence, source, embedding, created_at, last_accessed) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
                  
        await self.memory_store.execute(
            query, 
            (data["id"], data["name"], data["description"], data["attributes"], 
             data["categories"], data["confidence"], data["source"], data["embedding"],
             data["created_at"], data["last_accessed"])
        )
        
    async def _store_relationship_in_db(self, relationship: Relationship):
        """Store a relationship in the database."""
        # Convert attributes to JSON
        attributes_json = json.dumps(relationship.attributes)
        
        # Convert relationship type to string if it's an enum
        rel_type = relationship.relationship_type
        if isinstance(rel_type, RelationshipType):
            rel_type = rel_type.value
        
        # Prepare data
        data = {
            "id": relationship.id,
            "source_id": relationship.source_id,
            "target_id": relationship.target_id,
            "relationship_type": rel_type,
            "strength": relationship.strength,
            "attributes": attributes_json,
            "created_at": relationship.created_at.isoformat(),
            "last_accessed": relationship.last_accessed.isoformat()
        }
        
        # Insert or update
        query = """INSERT OR REPLACE INTO semantic_relationships 
                  (id, source_id, target_id, relationship_type, strength, attributes, created_at, last_accessed) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""
                  
        await self.memory_store.execute(
            query, 
            (data["id"], data["source_id"], data["target_id"], data["relationship_type"], 
             data["strength"], data["attributes"], data["created_at"], data["last_accessed"])
        )
        
    def _row_to_concept(self, row) -> Concept:
        """Convert a database row to a Concept object."""
        # Parse JSON fields
        attributes = json.loads(row["attributes"]) if row["attributes"] else {}
        categories = json.loads(row["categories"]) if row["categories"] else []
        
        # Parse embedding if present
        embedding = None
        if row["embedding"]:
            embedding = np.frombuffer(row["embedding"], dtype=np.float32)
        
        # Create concept
        concept = Concept(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            attributes=attributes,
            categories=categories,
            confidence=row["confidence"],
            source=row["source"],
            embedding=embedding,
            created_at=datetime.fromisoformat(row["created_at"]),
            last_accessed=datetime.fromisoformat(row["last_accessed"])
        )
        
        return concept
        
    def _row_to_relationship(self, row) -> Relationship:
        """Convert a database row to a Relationship object."""
        # Parse JSON fields
        attributes = json.loads(row["attributes"]) if row["attributes"] else {}
        
        # Parse relationship type
        try:
            relationship_type = RelationshipType(row["relationship_type"])
        except ValueError:
            relationship_type = row["relationship_type"]
        
        # Create relationship
        relationship = Relationship(
            id=row["id"],
            source_id=row["source_id"],
            target_id=row["target_id"],
            relationship_type=relationship_type,
            strength=row["strength"],
            attributes=attributes,
            created_at=datetime.fromisoformat(row["created_at"]),
            last_accessed=datetime.fromisoformat(row["last_accessed"])
        )
        
        return relationship
        
    async def _update_concept_last_accessed(self, concept_id: str):
        """Update the last_accessed timestamp for a concept."""
        now = datetime.now().isoformat()
        query = "UPDATE semantic_concepts SET last_accessed = ? WHERE id = ?"
        await self.memory_store.execute(query, (now, concept_id))
        
    async def _update_relationship_last_accessed(self, relationship_id: str):
        """Update the last_accessed timestamp for a relationship."""
        now = datetime.now().isoformat()
        query = "UPDATE semantic_relationships SET last_accessed = ? WHERE id = ?"
        await self.memory_store.execute(query, (now, relationship_id))
        
    async def _generate_embedding(self, text: str) -> np.ndarray:
        """Generate an embedding vector for the given text.
        
        In a production implementation, this would use a proper embedding model.
        For now, we use a simple placeholder that generates random vectors.
        """
        # TODO: Replace with actual embedding model
        # This is a placeholder that generates a random vector of the right dimensionality
        vector = np.random.rand(384).astype(np.float32)  # 384-dim embedding
        
        # Normalize to unit length
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
            
        return vector
        
    def _calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings."""
        if embedding1 is None or embedding2 is None:
            return 0.0
            
        # Ensure both are normalized
        norm1 = np.linalg.norm(embedding1)
        if norm1 > 0:
            embedding1 = embedding1 / norm1
            
        norm2 = np.linalg.norm(embedding2)
        if norm2 > 0:
            embedding2 = embedding2 / norm2
            
        # Calculate cosine similarity
        similarity = np.dot(embedding1, embedding2)
        return float(similarity)
        
    async def _publish_event(self, event_type: str, event_data: Dict[str, Any]):
        """Publish an event to the event bus."""
        try:
            if self.event_bus:
                await self.event_bus.publish(event_type, event_data)
        except Exception as e:
            logger.error(f"Error publishing event {event_type}: {e}")
            
    async def start_periodic_tasks(self):
        """Start periodic tasks for semantic memory maintenance."""
        # Schedule knowledge consolidation task
        asyncio.create_task(self._periodic_knowledge_consolidation())
        
    async def _periodic_knowledge_consolidation(self):
        """Periodically consolidate semantic knowledge."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                await self.consolidate_knowledge()
            except Exception as e:
                logger.error(f"Error in periodic knowledge consolidation: {e}")
                await asyncio.sleep(60)  # Wait a bit before retrying
