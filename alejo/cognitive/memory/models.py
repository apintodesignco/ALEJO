"""
ALEJO Cognitive Memory Models

This module defines the data models used by ALEJO's cognitive memory systems,
including episodic, semantic, and working memory components.
"""

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np


class MemoryType(Enum):
    """Types of memories in the cognitive system."""
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"
    EMOTIONAL = "emotional"


@dataclass
class Episode:
    """
    Represents an episodic memory - a specific event or experience.
    
    Episodic memories are autobiographical and context-specific, including
    information about what happened, when it happened, and where it happened.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    content: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    location: Optional[str] = None
    participants: List[str] = field(default_factory=list)
    emotions: Dict[str, float] = field(default_factory=dict)
    importance: float = 0.5
    embedding: Optional[np.ndarray] = None
    last_accessed: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the episode to a dictionary for storage."""
        result = {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "content": self.content,
            "context": self.context,
            "location": self.location,
            "participants": self.participants,
            "emotions": self.emotions,
            "importance": self.importance,
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None
        }
        
        if self.embedding is not None:
            result["embedding"] = self.embedding.tobytes()
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Episode':
        """Create an episode from a dictionary."""
        episode = cls(
            id=data.get("id", str(uuid.uuid4())),
            content=data.get("content", ""),
            context=data.get("context", {}),
            location=data.get("location"),
            participants=data.get("participants", []),
            emotions=data.get("emotions", {}),
            importance=data.get("importance", 0.5)
        )
        
        # Handle timestamp
        if "timestamp" in data:
            if isinstance(data["timestamp"], str):
                episode.timestamp = datetime.fromisoformat(data["timestamp"])
            else:
                episode.timestamp = data["timestamp"]
                
        # Handle last_accessed
        if "last_accessed" in data and data["last_accessed"]:
            if isinstance(data["last_accessed"], str):
                episode.last_accessed = datetime.fromisoformat(data["last_accessed"])
            else:
                episode.last_accessed = data["last_accessed"]
                
        # Handle embedding
        if "embedding" in data and data["embedding"]:
            if isinstance(data["embedding"], bytes):
                episode.embedding = np.frombuffer(data["embedding"], dtype=np.float32)
            else:
                episode.embedding = data["embedding"]
                
        return episode


@dataclass
class Concept:
    """
    Represents a semantic memory concept - a general fact or understanding.
    
    Semantic memories are general knowledge and facts about the world that
    aren't tied to specific experiences or contexts.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)
    categories: List[str] = field(default_factory=list)
    confidence: float = 1.0
    source: Optional[str] = None
    embedding: Optional[np.ndarray] = None
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the concept to a dictionary for storage."""
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "attributes": self.attributes,
            "categories": self.categories,
            "confidence": self.confidence,
            "source": self.source,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None
        }
        
        if self.embedding is not None:
            result["embedding"] = self.embedding.tobytes()
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Concept':
        """Create a concept from a dictionary."""
        concept = cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", ""),
            description=data.get("description", ""),
            attributes=data.get("attributes", {}),
            categories=data.get("categories", []),
            confidence=data.get("confidence", 1.0),
            source=data.get("source")
        )
        
        # Handle created_at
        if "created_at" in data:
            if isinstance(data["created_at"], str):
                concept.created_at = datetime.fromisoformat(data["created_at"])
            else:
                concept.created_at = data["created_at"]
                
        # Handle last_accessed
        if "last_accessed" in data and data["last_accessed"]:
            if isinstance(data["last_accessed"], str):
                concept.last_accessed = datetime.fromisoformat(data["last_accessed"])
            else:
                concept.last_accessed = data["last_accessed"]
                
        # Handle embedding
        if "embedding" in data and data["embedding"]:
            if isinstance(data["embedding"], bytes):
                concept.embedding = np.frombuffer(data["embedding"], dtype=np.float32)
            else:
                concept.embedding = data["embedding"]
                
        return concept


class RelationshipType(Enum):
    """Types of relationships between concepts or entities."""
    IS_A = "is_a"
    HAS_A = "has_a"
    PART_OF = "part_of"
    RELATED_TO = "related_to"
    CAUSES = "causes"
    PRECEDES = "precedes"
    FOLLOWS = "follows"
    SIMILAR_TO = "similar_to"
    OPPOSITE_OF = "opposite_of"
    LOCATED_IN = "located_in"
    CUSTOM = "custom"


@dataclass
class Relationship:
    """
    Represents a relationship between two concepts or entities.
    
    Relationships form the connections in semantic networks and knowledge graphs,
    allowing for inference and reasoning across concepts.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    target_id: str = ""
    relationship_type: Union[RelationshipType, str] = RelationshipType.RELATED_TO
    strength: float = 1.0
    attributes: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the relationship to a dictionary for storage."""
        rel_type = self.relationship_type
        if isinstance(rel_type, RelationshipType):
            rel_type = rel_type.value
            
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "relationship_type": rel_type,
            "strength": self.strength,
            "attributes": self.attributes,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Relationship':
        """Create a relationship from a dictionary."""
        # Handle relationship type
        rel_type = data.get("relationship_type", RelationshipType.RELATED_TO)
        if isinstance(rel_type, str):
            try:
                rel_type = RelationshipType(rel_type)
            except ValueError:
                # Custom relationship type
                pass
        
        relationship = cls(
            id=data.get("id", str(uuid.uuid4())),
            source_id=data.get("source_id", ""),
            target_id=data.get("target_id", ""),
            relationship_type=rel_type,
            strength=data.get("strength", 1.0),
            attributes=data.get("attributes", {})
        )
        
        # Handle created_at
        if "created_at" in data:
            if isinstance(data["created_at"], str):
                relationship.created_at = datetime.fromisoformat(data["created_at"])
            else:
                relationship.created_at = data["created_at"]
                
        # Handle last_accessed
        if "last_accessed" in data and data["last_accessed"]:
            if isinstance(data["last_accessed"], str):
                relationship.last_accessed = datetime.fromisoformat(data["last_accessed"])
            else:
                relationship.last_accessed = data["last_accessed"]
                
        return relationship


@dataclass
class WorkingMemoryItem:
    """
    Represents an item in working memory.
    
    Working memory items have activation levels that decay over time,
    and can be linked to episodic or semantic memories.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: Any = None
    content_type: str = "text"
    activation: float = 1.0
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    source_memory_id: Optional[str] = None
    source_memory_type: Optional[MemoryType] = None
    tags: List[str] = field(default_factory=list)
    
    def update_activation(self, decay_rate: float = 0.05) -> None:
        """
        Update the activation level based on time decay.
        
        Args:
            decay_rate: Rate at which activation decays per second
        """
        current_time = time.time()
        time_diff = current_time - self.last_accessed
        self.activation *= max(0.0, 1.0 - (decay_rate * time_diff))
        self.last_accessed = current_time
        
    def boost_activation(self, amount: float = 0.2) -> None:
        """
        Boost the activation level of this item.
        
        Args:
            amount: Amount to boost activation by
        """
        self.activation = min(1.0, self.activation + amount)
        self.last_accessed = time.time()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert the working memory item to a dictionary for storage."""
        result = {
            "id": self.id,
            "content": self.content,
            "content_type": self.content_type,
            "activation": self.activation,
            "created_at": self.created_at,
            "last_accessed": self.last_accessed,
            "tags": self.tags
        }
        
        if self.source_memory_id:
            result["source_memory_id"] = self.source_memory_id
            
        if self.source_memory_type:
            if isinstance(self.source_memory_type, MemoryType):
                result["source_memory_type"] = self.source_memory_type.value
            else:
                result["source_memory_type"] = self.source_memory_type
                
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WorkingMemoryItem':
        """Create a working memory item from a dictionary."""
        # Handle source memory type
        source_type = data.get("source_memory_type")
        if isinstance(source_type, str):
            try:
                source_type = MemoryType(source_type)
            except ValueError:
                pass
        
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            content=data.get("content"),
            content_type=data.get("content_type", "text"),
            activation=data.get("activation", 1.0),
            created_at=data.get("created_at", time.time()),
            last_accessed=data.get("last_accessed", time.time()),
            source_memory_id=data.get("source_memory_id"),
            source_memory_type=source_type,
            tags=data.get("tags", [])
        )
