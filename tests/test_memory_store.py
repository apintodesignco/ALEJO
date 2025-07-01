"""
Tests for ALEJO's memory storage system
"""

import pytest
import pytest_asyncio
import os
import numpy as np
import json
import time
from pathlib import Path
from dataclasses import dataclass
from alejo.database.memory_store import MemoryStore
from .mocks.event_bus import MockEventBus
import secrets  # More secure for cryptographic purposes

# Mock classes for testing
@dataclass
class Episode:
    """Mock episodic memory for testing"""
    content: any
    context: dict
    emotions: dict
    timestamp: float
    importance: float
    tags: list
    connections: list

@dataclass
class Concept:
    """Mock semantic concept for testing"""
    name: str
    attributes: dict
    relationships: dict
    confidence: float
    source: str
    last_updated: float
    embedding: np.ndarray

@dataclass
class Relationship:
    """Mock semantic relationship for testing"""
    type: str
    source_concept: str
    target_concept: str
    attributes: dict
    confidence: float
    bidirectional: bool = False

@pytest_asyncio.fixture
async def memory_store():
    """Create a test memory store"""
    # Use temporary test database
    test_db = "test_memory.db"
    
    # Ensure clean state
    if os.path.exists(test_db):
        os.remove(test_db)
        
    store = MemoryStore(test_db)
    await store.initialize()
    
    yield store
    
    # Cleanup
    await store.close()
    if os.path.exists(test_db):
        os.remove(test_db)

@pytest.fixture
def sample_episode():
    """Create a sample episodic memory"""
    return Episode(
        content="Test experience",
        context={"location": "test", "activity": "testing"},
        emotions={"joy": 0.8, "interest": 0.6},
        timestamp=time.time(),
        importance=0.9,
        tags=["test", "memory"],
        connections=[]
    )

@pytest.fixture
def sample_concept():
    """Create a sample semantic concept"""
    return Concept(
        name="test_concept",
        attributes={"color": "blue", "size": "large"},
        relationships={},
        confidence=0.8,
        source="testing",
        last_updated=time.time(),
        embedding=np.random.rand(256)
    )

class TestMemoryStore:
    """Test memory storage functionality"""
    
    @pytest.mark.asyncio
    async def test_initialization(self, memory_store):
        """Test database initialization"""
        assert memory_store.setup_complete
        assert os.path.exists(memory_store.db_path)
        
    @pytest.mark.asyncio
    async def test_save_episode(self, memory_store, sample_episode):
        """Test saving episodic memory"""
        # Save episode
        episode_id = await memory_store.save_episode(sample_episode)
        assert episode_id is not None
        
        # Retrieve and verify
        retrieved = await memory_store.get_episode(episode_id)
        assert retrieved is not None
        assert retrieved.content == sample_episode.content
        assert retrieved.context == sample_episode.context
        assert retrieved.emotions == sample_episode.emotions
        assert abs(retrieved.timestamp - sample_episode.timestamp) < 0.1
        assert retrieved.importance == sample_episode.importance
        assert retrieved.tags == sample_episode.tags
        
    @pytest.mark.asyncio
    async def test_save_concept(self, memory_store, sample_concept):
        """Test saving semantic concept"""
        # Save concept
        concept_id = await memory_store.save_concept(sample_concept)
        assert concept_id == sample_concept.name
        
        # Retrieve and verify
        retrieved = await memory_store.get_concept(concept_id)
        assert retrieved is not None
        assert retrieved.name == sample_concept.name
        assert retrieved.attributes == sample_concept.attributes
        assert retrieved.confidence == sample_concept.confidence
        assert retrieved.source == sample_concept.source
        assert np.array_equal(retrieved.embedding, sample_concept.embedding)
        
    @pytest.mark.asyncio
    async def test_save_relationship(self, memory_store, sample_concept):
        """Test saving semantic relationship"""
        # Create two concepts
        concept1 = sample_concept
        concept2 = Concept(
            name="related_concept",
            attributes={"type": "related"},
            relationships={},
            confidence=0.7,
            source="testing",
            last_updated=time.time(),
            embedding=np.random.rand(256)
        )
        
        # Save concepts
        await memory_store.save_concept(concept1)
        await memory_store.save_concept(concept2)
        
        # Create and save relationship
        relationship = Relationship(
            type="similar_to",
            source_concept=concept1.name,
            target_concept=concept2.name,
            attributes={"strength": 0.8},
            confidence=0.9,
            bidirectional=True
        )
        
        rel_id = await memory_store.save_relationship(relationship)
        assert rel_id is not None
        
    @pytest.mark.asyncio
    async def test_get_recent_episodes(self, memory_store, sample_episode):
        """Test retrieving recent episodes"""
        # Save multiple episodes
        episodes = []
        for i in range(5):
            episode = Episode(
                content=f"Test {i}",
                context={"index": i},
                emotions={"joy": 0.5},
                timestamp=time.time() + i,
                importance=0.8,
                tags=["test"],
                connections=[]
            )
            episodes.append(episode)
            await memory_store.save_episode(episode)
            
        # Retrieve recent
        recent = await memory_store.get_recent_episodes(limit=3)
        assert len(recent) == 3
        assert recent[0].content == "Test 4"  # Most recent first
        
    @pytest.mark.asyncio
    async def test_error_handling(self, memory_store):
        """Test error handling"""
        # Test invalid episode ID
        retrieved = await memory_store.get_episode("nonexistent")
        assert retrieved is None
        
        # Test invalid concept name
        retrieved = await memory_store.get_concept("nonexistent")
        assert retrieved is None