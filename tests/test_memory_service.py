"""
Unit tests for the memory service, focusing on context matching functionality
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from alejo.services.memory_service import MemoryService, MemoryRecord
import secrets  # More secure for cryptographic purposes

@pytest.fixture
def memory_service():
    """Create a memory service instance for testing"""
    service = MemoryService(
        redis_url="redis://localhost:6379/1",  # Use different DB for testing
        db_url="sqlite:///:memory:"  # Use in-memory SQLite for testing
    )
    return service

@pytest.fixture
def sample_memories(memory_service):
    """Create some sample memories for testing"""
    memories = []
    base_time = datetime.utcnow()
    
    # Create memories with different contexts
    test_data = [
        {
            "type": "conversation",
            "content": {"text": "Hello world"},
            "context": {
                "location": "office",
                "participants": ["user1", "user2"],
                "timestamp": base_time.isoformat(),
                "tags": ["greeting", "casual"]
            },
            "importance": 0.7
        },
        {
            "type": "conversation",
            "content": {"text": "Project discussion"},
            "context": {
                "location": "office",
                "participants": ["user1", "user3"],
                "timestamp": (base_time - timedelta(hours=2)).isoformat(),
                "project": {
                    "name": "ALEJO",
                    "phase": "development"
                }
            },
            "importance": 0.8
        },
        {
            "type": "task",
            "content": {"action": "Code review"},
            "context": {
                "location": "remote",
                "participants": ["user2"],
                "timestamp": (base_time - timedelta(days=1)).isoformat(),
                "project": {
                    "name": "ALEJO",
                    "phase": "review"
                }
            },
            "importance": 0.6
        }
    ]
    
    # Store test memories
    for data in test_data:
        asyncio.run(memory_service.store_memory(
            type=data["type"],
            content=data["content"],
            context=data["context"],
            importance=data["importance"]
        ))
        
    return test_data

@pytest.mark.asyncio
async def test_exact_context_match(memory_service, sample_memories):
    """Test exact matching of context values"""
    context = {"location": "office"}
    results = await memory_service.retrieve_memory(context=context)
    assert len(results) == 2
    assert all(r["context"]["location"] == "office" for r in results)

@pytest.mark.asyncio
async def test_partial_context_match(memory_service, sample_memories):
    """Test partial matching of context values"""
    context = {
        "project": {
            "name": "ALEJO"
        }
    }
    results = await memory_service.retrieve_memory(context=context)
    assert len(results) == 2
    assert all("project" in r["context"] and r["context"]["project"]["name"] == "ALEJO" 
              for r in results)

@pytest.mark.asyncio
async def test_list_context_match(memory_service, sample_memories):
    """Test matching of list/set values in context"""
    context = {
        "participants": ["user1"]
    }
    results = await memory_service.retrieve_memory(context=context)
    assert len(results) == 2
    assert all("user1" in r["context"]["participants"] for r in results)

@pytest.mark.asyncio
async def test_time_based_context_match(memory_service, sample_memories):
    """Test time-based context matching with decay"""
    base_time = datetime.utcnow()
    
    # Search for memories within the last hour
    recent_context = {
        "timestamp": base_time.isoformat()
    }
    recent_results = await memory_service.retrieve_memory(context=recent_context)
    
    # Search for memories from a day ago
    old_context = {
        "timestamp": (base_time - timedelta(days=1)).isoformat()
    }
    old_results = await memory_service.retrieve_memory(context=old_context)
    
    # Recent memories should be scored higher
    assert len(recent_results) > 0
    assert len(old_results) > 0
    assert recent_results[0]["id"] != old_results[0]["id"]

@pytest.mark.asyncio
async def test_combined_context_match(memory_service, sample_memories):
    """Test matching with multiple context criteria"""
    context = {
        "location": "office",
        "participants": ["user1"],
        "project": {
            "name": "ALEJO"
        }
    }
    results = await memory_service.retrieve_memory(context=context)
    assert len(results) == 1
    assert results[0]["context"]["location"] == "office"
    assert "user1" in results[0]["context"]["participants"]
    assert results[0]["context"]["project"]["name"] == "ALEJO"

@pytest.mark.asyncio
async def test_no_matching_context(memory_service, sample_memories):
    """Test behavior when no memories match the context"""
    context = {
        "location": "nonexistent",
        "participants": ["unknown"]
    }
    results = await memory_service.retrieve_memory(context=context)
    assert len(results) == 0

@pytest.mark.asyncio
async def test_empty_context(memory_service, sample_memories):
    """Test retrieval with empty context"""
    results = await memory_service.retrieve_memory(context={})
    assert len(results) > 0
    # Should return memories ordered by importance
    importances = [r["importance"] for r in results]
    assert importances == sorted(importances, reverse=True)