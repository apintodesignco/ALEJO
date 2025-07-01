"""
Tests for ALEJO's working memory system
"""

import pytest
import pytest_asyncio
import asyncio
import time
import numpy as np
import sqlite3
import json
from pathlib import Path
from alejo.cognitive.memory.models import WorkingMemoryItem, Episode, Concept, Relationship
from alejo.cognitive.memory.working_memory import WorkingMemory
from alejo.cognitive.memory.episodic_memory import EpisodicMemory
from alejo.cognitive.memory.semantic_memory import SemanticMemory
from .mocks.event_bus import MockEventBus, Event, EventType
from alejo.database.memory_store import MemoryStore
from alejo.utils.exceptions import EventBusError
import secrets  # More secure for cryptographic purposes

@pytest_asyncio.fixture
async def memory_store(test_db_path):
    """Create a test memory store"""
    store = MemoryStore(test_db_path)
    await store.initialize()
    yield store
    await store.close()

@pytest.fixture
def event_bus():
    """Create a mock event bus"""
    return MockEventBus()

@pytest_asyncio.fixture
async def episodic_memory(event_bus, memory_store):
    """Create an episodic memory system"""
    return EpisodicMemory(event_bus, memory_store)

@pytest_asyncio.fixture
async def semantic_memory(event_bus, memory_store):
    """Create a semantic memory system"""
    return SemanticMemory(event_bus, memory_store)

@pytest_asyncio.fixture
async def working_memory(event_bus, episodic_memory, semantic_memory):
    """Create a working memory system"""
    return WorkingMemory(event_bus, episodic_memory, semantic_memory)

class TestWorkingMemory:
    """Test working memory functionality"""
    
    @pytest.mark.asyncio
    async def test_initialization(self, working_memory):
        """Test working memory initialization"""
        assert working_memory.capacity == 7  # Default capacity
        assert working_memory.decay_rate == 0.1
        assert working_memory.activation_threshold == 0.2
        
    @pytest.mark.asyncio
    async def test_focus(self, working_memory):
        """Test focusing on new items"""
        # Focus on test item
        item_id = await working_memory.focus_on(
            content="test item",
            source="sensory",
            context={"type": "test"},
            importance=1.0
        )
        
        assert item_id is not None
        
        # Verify item was added
        items = await working_memory.get_active_items()
        assert len(items) == 1
        assert items[0][1].content == "test item"
        
        # Verify event was published
        events = working_memory.event_bus.published_events
        assert len(events) == 1
        assert events[0].type == EventType.MEMORY
        assert events[0].payload["action"] == "focus"
        
    @pytest.mark.asyncio
    async def test_capacity_limit(self, working_memory):
        """Test working memory capacity limit"""
        # Add more items than capacity
        for i in range(10):
            await working_memory.focus_on(
                content=f"item {i}",
                source="sensory",
                context={"index": i},
                importance=1.0
            )
            
        # Verify only capacity items remain
        items = await working_memory.get_active_items()
        assert len(items) <= working_memory.capacity
        
        # Verify events were published
        events = [e for e in working_memory.event_bus.published_events 
                 if e.type == EventType.MEMORY and e.payload["action"] == "focus"]
        assert len(events) == 10
        
    @pytest.mark.asyncio
    async def test_activation_decay(self, working_memory):
        """Test activation decay over time"""
        # Add test item
        item_id = await working_memory.focus_on(
            content="decay test",
            source="sensory",
            context={"type": "decay"},
            importance=1.0
        )
        
        # Wait for decay
        await asyncio.sleep(2)
        
        # Get items after decay
        items = await working_memory.get_active_items()
        assert len(items) > 0
        assert items[0][1].activation < 1.0
        
    @pytest.mark.asyncio
    async def test_clear_item(self, working_memory):
        """Test clearing items from working memory"""
        # Add test items
        item_ids = []
        for i in range(3):
            item_id = await working_memory.focus_on(
                content=f"clear test {i}",
                source="sensory",
                context={"index": i},
                importance=1.0
            )
            item_ids.append(item_id)
            
        # Clear first item
        await working_memory.clear_item(item_ids[0])
        
        # Verify item was removed
        items = await working_memory.get_active_items()
        assert len(items) == 2
        
        # Verify clear event was published
        events = [e for e in working_memory.event_bus.published_events 
                 if e.type == EventType.MEMORY and e.payload["action"] == "clear"]
        assert len(events) == 1
        assert events[0].payload["item_id"] == item_ids[0]