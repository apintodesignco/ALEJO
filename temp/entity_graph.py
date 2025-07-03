"""
ALEJO Personal Entity Graph

This module implements a graph-based memory system for tracking relationships
between people, places, preferences, and other entities important to the user.
The entity graph serves as a foundation for personalized interactions and
contextual understanding with semantic embedding-based similarity search and
relationship importance weighting.
"""

import json
import logging
import os
import time
import asyncio
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import networkx as nx
import numpy as np

from alejo.cognitive.memory.models import Relationship, RelationshipType
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_errors

# Import SentenceTransformer for embedding generation
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("sentence-transformers not available, falling back to random embeddings")

logger = logging.getLogger(__name__)


class EntityType(Enum):
    """Types of entities in the personal entity graph."""
    PERSON = "person"
    PLACE = "place"
    ORGANIZATION = "organization"
    CONCEPT = "concept"
    PREFERENCE = "preference"
    EVENT = "event"
    OBJECT = "object"
    CUSTOM = "custom"


class EntityImportance(Enum):
    """Importance levels for entities in the personal graph."""
    CRITICAL = 5  # Essential entities (e.g., immediate family)
    HIGH = 4      # Very important entities (e.g., close friends)
    MEDIUM = 3    # Moderately important entities (e.g., colleagues)
    LOW = 2       # Less important entities (e.g., acquaintances)
    MINIMAL = 1   # Minimal importance (e.g., mentioned once)


class Entity:
    """
    Represents an entity in the personal entity graph.
    
    Entities can be people, places, organizations, or other concepts that
    are important to the user and form their personal knowledge network.
    """
    
    def __init__(
        self,
        entity_id: str = None,
        name: str = "",
        entity_type: EntityType = EntityType.CUSTOM,
        attributes: Dict[str, Any] = None,
        importance: EntityImportance = EntityImportance.MEDIUM,
        first_encountered: datetime = None,
        last_encountered: datetime = None,
        embedding: Optional[np.ndarray] = None,
        source: Optional[str] = None
    ):
        """Initialize an entity.
        
        Args:
            entity_id: Unique identifier for this entity
            name: Human-readable name for this entity
            entity_type: Type of entity (person, place, etc.)
            attributes: Additional attributes for this entity
            importance: Importance level of this entity to the user
            first_encountered: When this entity was first encountered
            last_encountered: When this entity was last encountered
            embedding: Vector representation of this entity
            source: Source of information about this entity
        """
        self.id = entity_id or f"{int(time.time())}_{hash(name)}"
        self.name = name
        self.entity_type = entity_type
        self.attributes = attributes or {}
        self.importance = importance
        self.first_encountered = first_encountered or datetime.now()
        self.last_encountered = last_encountered or datetime.now()
        self.embedding = embedding
        self.source = source
        self.encounter_count = 1
    
    def update_importance(self, new_importance: Optional[EntityImportance] = None, 
                          increment: bool = False) -> None:
        """Update the importance of this entity.
        
        Args:
            new_importance: New importance level to set
            increment: Whether to increment the importance level
        """
        if new_importance:
            self.importance = new_importance
        elif increment and self.importance.value < EntityImportance.CRITICAL.value:
            # Find the next higher importance level
            next_level = min(EntityImportance.CRITICAL.value, self.importance.value + 1)
            self.importance = EntityImportance(next_level)
    
    def record_encounter(self, timestamp: datetime = None) -> None:
        """Record an encounter with this entity.
        
        Args:
            timestamp: When the encounter occurred
        """
        self.last_encountered = timestamp or datetime.now()
        self.encounter_count += 1
        
        # Potentially increase importance based on frequency of encounters
        if self.encounter_count >= 10 and self.importance.value < EntityImportance.HIGH.value:
            self.update_importance(increment=True)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the entity to a dictionary for storage."""
        result = {
            "id": self.id,
            "name": self.name,
            "entity_type": self.entity_type.value,
            "attributes": self.attributes,
            "importance": self.importance.value,
            "first_encountered": self.first_encountered.isoformat(),
            "last_encountered": self.last_encountered.isoformat(),
            "encounter_count": self.encounter_count,
            "source": self.source
        }
        
        # Only include embedding if it exists
        if self.embedding is not None:
            result["embedding"] = self.embedding.tolist()
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Entity':
        """Create an entity from a dictionary.
        
        Args:
            data: Dictionary representation of an entity
            
        Returns:
            Entity object
        """
        entity = cls(
            entity_id=data.get("id"),
            name=data.get("name", ""),
            entity_type=EntityType(data.get("entity_type", EntityType.CUSTOM.value)),
            attributes=data.get("attributes", {}),
            importance=EntityImportance(data.get("importance", EntityImportance.MEDIUM.value)),
            first_encountered=datetime.fromisoformat(data.get("first_encountered", datetime.now().isoformat())),
            last_encountered=datetime.fromisoformat(data.get("last_encountered", datetime.now().isoformat())),
            source=data.get("source")
        )
        
        entity.encounter_count = data.get("encounter_count", 1)
        
        # Convert embedding back to numpy array if it exists
        if "embedding" in data and data["embedding"]:
            entity.embedding = np.array(data["embedding"])
            
        return entity


class PersonalEntityGraph:
    """
    Personal entity graph for tracking relationships between entities important to the user.
    
    This graph connects people, places, preferences, and other entities in the user's life,
    allowing ALEJO to understand relationships and context for personalized interactions.
    """
    
    def __init__(self, event_bus: EventBus = None):
        """Initialize the personal entity graph.
        
        Args:
            event_bus: Event bus for publishing graph events
        """
        self.graph = nx.DiGraph()
        self.event_bus = event_bus
        self.storage_path = self._get_storage_path()
        self.embedding_dimension = 384  # Default for small sentence transformers
        self._embedding_model = None
        self._embedding_model_name = 'all-MiniLM-L6-v2'  # Default model
        
        # Cache for recently accessed entities
        self._entity_cache = {}
        self._cache_max_size = 100
        self._cache_ttl = 600  # 10 minutes
        
        # Load existing graph if available
        self._load_graph()
        
        logger.info("Personal entity graph initialized with %d entities and %d relationships", 
                   self.graph.number_of_nodes(), self.graph.number_of_edges())
    
    def _get_storage_path(self) -> str:
        """Get the path for storing the entity graph.
        
        Returns:
            Path to the entity graph storage directory
        """
        home_dir = Path.home()
        alejo_dir = home_dir / ".alejo" / "cognitive" / "memory"
        alejo_dir.mkdir(parents=True, exist_ok=True)
        return str(alejo_dir)
    
    @handle_errors("Failed to add entity to graph")
    def add_entity(self, entity: Entity) -> str:
        """Add an entity to the graph.
        
        Args:
            entity: Entity to add
            
        Returns:
            ID of the added entity
        """
        # Check if entity already exists
        if entity.id in self.graph.nodes:
            existing_entity = self.get_entity(entity.id)
            existing_entity.record_encounter()
            self.graph.nodes[entity.id]["data"] = existing_entity
            logger.info("Updated existing entity: %s", entity.name)
            
            if self.event_bus:
                self.event_bus.publish(
                    EventType.MEMORY_UPDATED,
                    {"entity_id": entity.id, "entity_name": entity.name}
                )
            
            return entity.id
        
        # Add new entity
        self.graph.add_node(entity.id, data=entity)
        logger.info("Added new entity: %s (%s)", entity.name, entity.entity_type.value)
        
        # Add to cache
        self._entity_cache[entity.id] = {
            "entity": entity,
            "timestamp": time.time()
        }
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.MEMORY_CREATED,
                {"entity_id": entity.id, "entity_name": entity.name}
            )
        
        # Save the updated graph
        self._save_graph()
        
        return entity.id
    
    @handle_errors("Failed to add relationship to graph")
    def add_relationship(self, source_id: str, target_id: str, 
                        relationship_type: Union[RelationshipType, str],
                        attributes: Dict[str, Any] = None,
                        strength: float = 1.0) -> str:
        """Add a relationship between two entities.
        
        Args:
            source_id: ID of the source entity
            target_id: ID of the target entity
            relationship_type: Type of relationship
            attributes: Additional attributes for this relationship
            strength: Strength of the relationship (0.0 to 1.0)
            
        Returns:
            ID of the created relationship
            
        Raises:
            ValueError: If source or target entity doesn't exist
        """
        # Verify entities exist
        if source_id not in self.graph.nodes:
            raise ValueError(f"Source entity {source_id} does not exist")
        if target_id not in self.graph.nodes:
            raise ValueError(f"Target entity {target_id} does not exist")
        
        # Create relationship
        relationship = Relationship(
            source_id=source_id,
            target_id=target_id,
            relationship_type=relationship_type,
            attributes=attributes or {},
            strength=strength
        )
        
        # Add edge to graph
        self.graph.add_edge(source_id, target_id, 
                           key=relationship.id, 
                           type=relationship_type,
                           data=relationship)
        
        logger.info("Added relationship: %s -[%s]-> %s", 
                   self.graph.nodes[source_id]["data"].name,
                   relationship_type,
                   self.graph.nodes[target_id]["data"].name)
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.RELATIONSHIP_CREATED,
                {
                    "relationship_id": relationship.id,
                    "source_id": source_id,
                    "target_id": target_id,
                    "type": str(relationship_type)
                }
            )
        
        # Save the updated graph
        self._save_graph()
        
        return relationship.id
    
    @handle_errors("Failed to get entity from graph")
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get an entity by ID.
        
        Args:
            entity_id: ID of the entity to get
            
        Returns:
            Entity object or None if not found
        """
        # Check cache first
        if entity_id in self._entity_cache:
            cache_entry = self._entity_cache[entity_id]
            # Update timestamp to keep in cache longer
            cache_entry["timestamp"] = time.time()
            return cache_entry["entity"]
        
        # Check graph
        if entity_id in self.graph.nodes:
            entity = self.graph.nodes[entity_id]["data"]
            
            # Add to cache
            self._entity_cache[entity_id] = {
                "entity": entity,
                "timestamp": time.time()
            }
            
            # Clean cache if needed
            if len(self._entity_cache) > self._cache_max_size:
                self._clean_cache()
                
            return entity
            
        return None
    
    @handle_errors("Failed to get entities by type")
    def get_entities_by_type(self, entity_type: EntityType) -> List[Entity]:
        """Get all entities of a specific type.
        
        Args:
            entity_type: Type of entities to get
            
        Returns:
            List of entities of the specified type
        """
        entities = []
        
        for node_id in self.graph.nodes:
            entity = self.graph.nodes[node_id]["data"]
            if entity.entity_type == entity_type:
                entities.append(entity)
                
        return entities
    
    @handle_errors("Failed to get entities by importance")
    def get_entities_by_importance(self, min_importance: EntityImportance) -> List[Entity]:
        """Get all entities with at least the specified importance.
        
        Args:
            min_importance: Minimum importance level
            
        Returns:
            List of entities with at least the specified importance
        """
        entities = []
        
        for node_id in self.graph.nodes:
            entity = self.graph.nodes[node_id]["data"]
            if entity.importance.value >= min_importance.value:
                entities.append(entity)
                
        # Sort by importance (highest first)
        entities.sort(key=lambda e: e.importance.value, reverse=True)
                
        return entities
    
    @handle_errors("Failed to get relationships")
    def get_relationships(self, source_id: str = None, target_id: str = None,
                         relationship_type: RelationshipType = None) -> List[Relationship]:
        """Get relationships by source, target, or type.
        
        Args:
            source_id: Source entity ID (optional)
            target_id: Target entity ID (optional)
            relationship_type: Relationship type (optional)
            
        Returns:
            List of matching relationships
        """
        relationships = []
        
        # Get all edges from graph
        for source, target, edge_data in self.graph.edges(data=True):
            relationship = edge_data.get("data")
            if relationship is None:
                continue
                
            # Check if this relationship matches the filters
            matches = True
            if source_id and source != source_id:
                matches = False
            if target_id and target != target_id:
                matches = False
            if relationship_type and relationship.relationship_type != relationship_type:
                matches = False
                
            if matches:
                relationships.append(relationship)
                
        return relationships
    
    @handle_errors("Failed to search entities")
    def search_entities(self, query: str, limit: int = 10) -> List[Entity]:
        """Search for entities by name or attributes.
        
        Args:
            query: Search query
            limit: Maximum number of results to return
            
        Returns:
            List of matching entities
        """
        results = []
        query = query.lower()
        
        for node_id in self.graph.nodes:
            entity = self.graph.nodes[node_id]["data"]
            
            # Check name
            if query in entity.name.lower():
                results.append(entity)
                continue
                
            # Check attributes
            for key, value in entity.attributes.items():
                if isinstance(value, str) and query in value.lower():
                    results.append(entity)
                    break
            
            # Limit results
            if len(results) >= limit:
                break
                
        return results
        
    @handle_errors("Failed to search entities by embedding")
    async def search_entities_by_embedding(self, text: str, limit: int = 10, threshold: float = 0.6) -> List[Tuple[Entity, float]]:
        """Search for entities using semantic similarity with embeddings.
        
        Args:
            text: Text to compare entities against
            limit: Maximum number of results to return
            threshold: Minimum similarity threshold (0.0 to 1.0)
            
        Returns:
            List of tuples containing (entity, similarity_score)
        """
        # Generate embedding for the query text
        query_embedding = await self._generate_embedding(text)
        
        # Calculate similarity with all entities that have embeddings
        similarities = []
        
        for node_id in self.graph.nodes:
            entity = self.graph.nodes[node_id]["data"]
            
            # Skip entities without embeddings
            if entity.embedding is None:
                continue
                
            # Calculate cosine similarity
            similarity = np.dot(query_embedding, entity.embedding)
            
            # Only include entities above the threshold
            if similarity >= threshold:
                similarities.append((entity, similarity))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Limit results
        return similarities[:limit]
        
    @handle_errors("Failed to calculate relationship importance")
    async def calculate_relationship_importance(self, source_id: str, target_id: str) -> float:
        """Calculate the importance of a relationship using embedding similarity and other factors.
        
        Args:
            source_id: ID of the source entity
            target_id: ID of the target entity
            
        Returns:
            Importance score (0.0 to 1.0)
        """
        # Get the entities
        source_entity = self.get_entity(source_id)
        target_entity = self.get_entity(target_id)
        
        if not source_entity or not target_entity:
            return 0.0
            
        # Base importance from entity importance
        importance_score = (source_entity.importance.value + target_entity.importance.value) / 10.0
        
        # Check if both entities have embeddings
        if source_entity.embedding is not None and target_entity.embedding is not None:
            # Calculate semantic similarity
            similarity = np.dot(source_entity.embedding, target_entity.embedding)
            importance_score = 0.5 * importance_score + 0.5 * similarity
            
        # Check for existing relationship
        for _, _, edge_data in self.graph.edges(data=True):
            if edge_data.get("data") and edge_data["data"].source_id == source_id and edge_data["data"].target_id == target_id:
                relationship = edge_data["data"]
                # Factor in existing relationship strength
                importance_score = 0.7 * importance_score + 0.3 * relationship.strength
                
        return min(max(importance_score, 0.0), 1.0)  # Clamp to [0.0, 1.0]

    @handle_errors("Failed to update relationship importance")
    async def update_relationship_importance(self, source_id: str, target_id: str) -> bool:
        """Update the importance of a relationship using embedding similarity and other factors.
        
        Args:
            source_id: ID of the source entity
            target_id: ID of the target entity
            
        Returns:
            True if successful, False otherwise
        """
        # Calculate importance
        importance = await self.calculate_relationship_importance(source_id, target_id)
        
        # Find the relationship
        for s, t, key, edge_data in self.graph.edges(keys=True, data=True):
            if s == source_id and t == target_id and "data" in edge_data:
                relationship = edge_data["data"]
                # Update strength
                relationship.strength = importance
                edge_data["data"] = relationship
                
                # Save the updated graph
                self._save_graph()
                
                return True
                
        return False
    
    @handle_errors("Failed to update entity")
    def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> bool:
        """Update an entity's attributes.
        
        Args:
            entity_id: ID of the entity to update
            updates: Dictionary of updates to apply
            
        Returns:
            True if successful, False otherwise
        """
        if entity_id not in self.graph.nodes:
            return False
        
        entity = self.graph.nodes[entity_id]["data"]
        
        # Update name
        if "name" in updates:
            entity.name = updates["name"]
        
        # Update type
        if "entity_type" in updates:
            entity.entity_type = updates["entity_type"]
        
        # Update importance
        if "importance" in updates:
            entity.importance = updates["importance"]
        
        # Update or add attributes
        if "attributes" in updates and isinstance(updates["attributes"], dict):
            entity.attributes.update(updates["attributes"])
        
        # Record encounter
        entity.record_encounter()
        
        # Update in graph
        self.graph.nodes[entity_id]["data"] = entity
        
        # Update in cache
        if entity_id in self._entity_cache:
            self._entity_cache[entity_id] = {
                "entity": entity,
                "timestamp": time.time()
            }
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.MEMORY_UPDATED,
                {"entity_id": entity_id, "entity_name": entity.name}
            )
        
        # Save the updated graph
        self._save_graph()
        
        return True
    
    @handle_errors("Failed to delete entity")
    def delete_entity(self, entity_id: str) -> bool:
        """Delete an entity and all its relationships.
        
        Args:
            entity_id: ID of the entity to delete
            
        Returns:
            True if successful, False otherwise
        """
        if entity_id not in self.graph.nodes:
            return False
        
        # Get entity name for event
        entity_name = self.graph.nodes[entity_id]["data"].name
        
        # Remove from graph
        self.graph.remove_node(entity_id)
        
        # Remove from cache
        if entity_id in self._entity_cache:
            del self._entity_cache[entity_id]
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.MEMORY_DELETED,
                {"entity_id": entity_id, "entity_name": entity_name}
            )
        
        # Save the updated graph
        self._save_graph()
        
        return True
    
    @handle_errors("Failed to get graph statistics")
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the entity graph.
        
        Returns:
            Dictionary of statistics
        """
        # Count entities by type
        entity_counts = {}
        for entity_type in EntityType:
            entity_counts[entity_type.value] = len(self.get_entities_by_type(entity_type))
        
        # Count relationships by type
        relationship_counts = {}
        for _, _, edge_data in self.graph.edges(data=True):
            rel_type = str(edge_data["type"])
            relationship_counts[rel_type] = relationship_counts.get(rel_type, 0) + 1
        
        # Get most important entities
        important_entities = self.get_entities_by_importance(EntityImportance.HIGH)
        important_names = [e.name for e in important_entities[:5]]  # Top 5
        
        return {
            "total_entities": self.graph.number_of_nodes(),
            "total_relationships": self.graph.number_of_edges(),
            "entity_counts": entity_counts,
            "relationship_counts": relationship_counts,
            "important_entities": important_names,
            "density": nx.density(self.graph),
            "is_connected": nx.is_weakly_connected(self.graph) if self.graph.number_of_nodes() > 0 else False
        }
    
    def _clean_cache(self) -> None:
        """Clean the entity cache by removing old entries."""
        current_time = time.time()
        to_remove = []
        
        for entity_id, cache_entry in self._entity_cache.items():
            if current_time - cache_entry["timestamp"] > self._cache_ttl:
                to_remove.append(entity_id)
        
        for entity_id in to_remove:
            del self._entity_cache[entity_id]

    @handle_errors("Failed to load entity graph")
    def _load_graph(self):
        """Load the entity graph from disk."""
        graph_file = os.path.join(self.storage_path, "entity_graph.json")
        
        if not os.path.exists(graph_file):
            return
        
        try:
            # Load from file
            with open(graph_file, "r") as f:
                data = json.load(f)
            
            # Recreate graph from serialized data
            for node_data in data["nodes"]:
                entity = Entity(
                    entity_id=node_data["id"],
                    name=node_data["name"],
                    entity_type=EntityType(node_data["type"]),
                    attributes=node_data["attributes"],
                    importance=EntityImportance(node_data["importance"]),
                    first_encountered=datetime.fromisoformat(node_data["first_encountered"]),
                    last_encountered=datetime.fromisoformat(node_data["last_encountered"]),
                    embedding=np.array(node_data["embedding"]) if node_data.get("embedding") else None,
                    source=node_data.get("source")
                )
                entity.encounter_count = node_data.get("encounter_count", 1)
                self.graph.add_node(entity.id, data=entity)
            
            # Add edges (relationships)
            for edge_data in data["edges"]:
                relationship = Relationship(
                    relationship_id=edge_data["id"],
                    source_id=edge_data["source"],
                    target_id=edge_data["target"],
                    relationship_type=RelationshipType(edge_data["type"]),
                    attributes=edge_data["attributes"],
                    strength=edge_data["strength"],
                    created_at=datetime.fromisoformat(edge_data["created_at"]),
                    last_updated=datetime.fromisoformat(edge_data["last_updated"])
                )
                self.graph.add_edge(
                    edge_data["source"],
                    edge_data["target"],
                    type=RelationshipType(edge_data["type"]),
                    data=relationship
                )
            
            logger.info("Loaded entity graph with %d entities and %d relationships",
                       self.graph.number_of_nodes(), self.graph.number_of_edges())
        except Exception as e:
            logger.error("Failed to load entity graph: %s", str(e))

    @handle_errors("Failed to save entity graph")
    def _save_graph(self) -> None:
        """Save the entity graph to disk."""
        # Ensure storage directory exists
        os.makedirs(self.storage_path, exist_ok=True)
        
        graph_file = os.path.join(self.storage_path, "entity_graph.json")
        
        # Prepare serializable data
        data = {
            "nodes": [],
            "edges": []
        }
        
        # Serialize nodes
        for node_id in self.graph.nodes:
            entity = self.graph.nodes[node_id]["data"]
            node_data = {
                "id": entity.id,
                "name": entity.name,
                "type": entity.entity_type.value,
                "attributes": entity.attributes,
                "importance": entity.importance.value,
                "first_encountered": entity.first_encountered.isoformat(),
                "last_encountered": entity.last_encountered.isoformat(),
                "encounter_count": entity.encounter_count,
                "embedding": entity.embedding.tolist() if entity.embedding is not None else None,
                "source": entity.source
            }
            data["nodes"].append(node_data)
        
        # Serialize edges
        for source_id, target_id, edge_data in self.graph.edges(data=True):
            relationship = edge_data["data"]
            edge_data = {
                "id": relationship.relationship_id,
                "source": relationship.source_id,
                "target": relationship.target_id,
                "type": relationship.relationship_type.value,
                "attributes": relationship.attributes,
                "strength": relationship.strength,
                "created_at": relationship.created_at.isoformat(),
                "last_updated": relationship.last_updated.isoformat()
            }
            data["edges"].append(edge_data)
        
        # Write to file
        with open(graph_file, "w") as f:
            json.dump(data, f, indent=2)
        
        logger.debug("Saved entity graph with %d entities and %d relationships",
                    len(data["nodes"]), len(data["edges"]))

    @handle_errors("Failed to generate embedding")
    async def _generate_embedding(self, text: str) -> np.ndarray:
        """Generate an embedding vector for the given text using sentence-transformers.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            Embedding vector as numpy array
        """
        loop = asyncio.get_event_loop()
        
        try:
            # Lazily load the embedding model when needed
            if self._embedding_model is None and SENTENCE_TRANSFORMERS_AVAILABLE:
                self._embedding_model = await loop.run_in_executor(
                    None,
                    lambda: SentenceTransformer(self._embedding_model_name)
                )
                logger.info(f"Loaded sentence transformer model: {self._embedding_model_name}")
            
            # If model is available, generate embedding
            if self._embedding_model is not None:
                vector = await loop.run_in_executor(
                    None,
                    lambda: self._embedding_model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
                )
                return vector.astype(np.float32)
        except Exception as e:
            logger.warning(f"Failed to generate embedding with sentence-transformers: {str(e)}")
            logger.warning("Falling back to random embedding")
        
        # Fallback to random embedding if model fails or is not available
        random_embedding = np.random.randn(self.embedding_dimension).astype(np.float32)
        # Normalize the random embedding
        norm = np.linalg.norm(random_embedding)
        if norm > 0:
            random_embedding = random_embedding / norm
        return random_embedding
