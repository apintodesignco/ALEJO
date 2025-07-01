"""
Integration tests for connecting the Hybrid Retrieval System to ALEJO Brain
"""

import os
import sys
import pytest
import asyncio
import json
from unittest.mock import MagicMock, patch
import tempfile
import shutil

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from alejo.core.event_bus import EventBus
from alejo.llm_client.base import BaseLLMClient, LLMResponse
from alejo.database.memory_store import MemoryStore, Memory
from alejo.cognitive.memory.semantic_memory import SemanticMemory, Concept
from alejo.cognitive.retrieval.integration import RetrievalIntegration
from alejo.cognitive.retrieval.cloud_cache import CloudStorageProvider
import secrets  # More secure for cryptographic purposes

# Mock classes for testing
class MockLLMClient(BaseLLMClient):
    """Mock LLM client for testing"""
    
    def __init__(self):
        self.responses = {
            "What is ALEJO?": "ALEJO is an advanced AI assistant with emotional intelligence.",
            "Tell me about RAG": "RAG (Retrieval-Augmented Generation) enhances LLM responses with relevant information.",
            "What did I ask earlier?": "You asked about ALEJO and RAG in our previous conversation."
        }
        self.embedding_dim = 768
    
    async def generate_text(self, prompt, **kwargs):
        """Generate mock text response"""
        # Simple keyword matching for testing
        for key, response in self.responses.items():
            if key.lower() in prompt.lower():
                return LLMResponse(
                    content=response,
                    model="mock-llm",
                    usage={"prompt_tokens": len(prompt), "completion_tokens": len(response)},
                    metadata={"mock": True}
                )
        
        # Default response
        return LLMResponse(
            content="I don't have specific information about that.",
            model="mock-llm",
            usage={"prompt_tokens": len(prompt), "completion_tokens": 30},
            metadata={"mock": True}
        )
    
    async def generate_embeddings(self, texts):
        """Generate mock embeddings"""
        # Return simple mock embeddings for testing
        return [[0.1] * self.embedding_dim for _ in texts]

class MockMemoryStore(MemoryStore):
    """Mock memory store for testing"""
    
    def __init__(self):
        self.memories = []
    
    async def initialize(self):
        """Initialize the memory store"""
        return True
    
    async def store_memory(self, memory):
        """Store a memory"""
        self.memories.append(memory)
        return True
    
    async def get_memory(self, memory_id):
        """Get a memory by ID"""
        for memory in self.memories:
            if memory.id == memory_id:
                return memory
        return None
    
    async def get_recent_memories(self, memory_type=None, limit=10):
        """Get recent memories"""
        filtered = self.memories
        if memory_type:
            filtered = [m for m in filtered if m.memory_type == memory_type]
        return filtered[:limit]

class MockSemanticMemory(SemanticMemory):
    """Mock semantic memory for testing"""
    
    def __init__(self):
        self.concepts = {}
    
    async def initialize(self):
        """Initialize semantic memory"""
        return True
    
    async def add_concept(self, concept):
        """Add a concept"""
        self.concepts[concept.name] = concept
        return True
    
    async def get_concept(self, name):
        """Get a concept by name"""
        return self.concepts.get(name)
    
    async def get_all_concepts(self):
        """Get all concepts"""
        return list(self.concepts.values())

# Patch the LLMClientFactory
@pytest.fixture
def patch_llm_factory():
    """Patch the LLMClientFactory to return our mock client"""
    with patch('alejo.llm_client.factory.LLMClientFactory.create_client') as mock_factory:
        mock_factory.return_value = MockLLMClient()
        yield mock_factory

@pytest.fixture
def temp_dir():
    """Create a temporary directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def config_path(temp_dir):
    """Create a temporary config path"""
    return os.path.join(temp_dir, "retrieval_config.json")

@pytest.fixture
def event_bus():
    """Create a mock event bus"""
    mock_event_bus = MagicMock(spec=EventBus)
    
    # Mock the publish and subscribe methods
    async def mock_publish(event_type, data=None):
        return {"success": True}
    
    mock_event_bus.publish = mock_publish
    mock_event_bus.subscribe = MagicMock()
    
    return mock_event_bus

@pytest.fixture
def memory_store():
    """Create a mock memory store"""
    store = MockMemoryStore()
    
    # Add some test memories
    store.memories = [
        Memory(
            id="1",
            content="ALEJO is an AI assistant with emotional intelligence.",
            memory_type="factual",
            timestamp=1624000000.0
        ),
        Memory(
            id="2",
            content="User asked about RAG and CAG systems.",
            memory_type="interaction",
            timestamp=1624001000.0
        )
    ]
    
    return store

@pytest.fixture
def semantic_memory():
    """Create a mock semantic memory"""
    memory = MockSemanticMemory()
    
    # Add some test concepts
    memory.concepts = {
        "ALEJO": Concept(
            name="ALEJO",
            attributes={
                "type": "AI assistant",
                "capabilities": ["emotional intelligence", "multimodal reasoning"]
            },
            relationships=[
                {"type": "uses", "target": "RAG"},
                {"type": "uses", "target": "CAG"}
            ],
            confidence=0.9,
            source="system"
        ),
        "RAG": Concept(
            name="RAG",
            attributes={
                "full_name": "Retrieval-Augmented Generation",
                "purpose": "Enhance LLM responses with relevant information"
            },
            relationships=[
                {"type": "used_by", "target": "ALEJO"}
            ],
            confidence=0.8,
            source="learning"
        )
    }
    
    return memory

@pytest.fixture
def retrieval_integration(event_bus, memory_store, semantic_memory, config_path, patch_llm_factory):
    """Create a retrieval integration instance"""
    integration = RetrievalIntegration(
        event_bus=event_bus,
        memory_store=memory_store,
        semantic_memory=semantic_memory,
        config_path=config_path
    )
    
    return integration

@pytest.mark.asyncio
async def test_integration_initialization(retrieval_integration):
    """Test initialization of retrieval integration"""
    # Check that components are initialized
    assert retrieval_integration.hybrid_system is not None
    assert retrieval_integration.cloud_cache is not None
    
    # Check that event handlers are registered
    assert retrieval_integration.event_bus.subscribe.call_count >= 4

@pytest.mark.asyncio
async def test_integration_query(retrieval_integration):
    """Test querying through the integration"""
    # Test direct query method
    response = await retrieval_integration.query("What is ALEJO?")
    
    assert response is not None
    assert "content" in response
    assert "ALEJO" in response["content"]
    assert "retrieval_mode" in response

    # Test event-based query
    result = await retrieval_integration._handle_brain_query({
        "query": "Tell me about RAG"
    })
    
    assert result is not None
    assert "response" in result
    assert "RAG" in result["response"]
    assert "metadata" in result

@pytest.mark.asyncio
async def test_integration_learn(retrieval_integration):
    """Test learning through the integration"""
    # Test direct learn method
    success = await retrieval_integration.learn(
        content="CAG (Context-Augmented Generation) maintains conversation context.",
        source="test",
        metadata={"test": True}
    )
    
    assert success is True
    
    # Test event-based learn
    result = await retrieval_integration._handle_brain_learn({
        "content": "Hybrid retrieval combines RAG and CAG approaches.",
        "source": "test",
        "metadata": {"test": True}
    })
    
    assert result is not None
    assert result.get("success") is True

@pytest.mark.asyncio
async def test_integration_with_semantic_memory(retrieval_integration):
    """Test integration with semantic memory"""
    # Initialize from memory
    success = await retrieval_integration.initialize_from_memory()
    assert success is True
    
    # Test that concepts were added to RAG
    response = await retrieval_integration.query("What is RAG?")
    assert "RAG" in response["content"]
    
    # Test sync memory event
    result = await retrieval_integration._handle_sync_memory({})
    assert result.get("success") is True

@pytest.mark.asyncio
async def test_integration_mode_setting(retrieval_integration):
    """Test setting retrieval mode"""
    # Test setting mode through event
    result = await retrieval_integration._handle_set_mode({
        "mode": "rag"
    })
    
    assert result is not None
    assert result.get("success") is True
    assert result.get("mode") == "rag"
    
    # Verify mode was set in hybrid system
    assert retrieval_integration.hybrid_system.current_mode == "rag"
    
    # Test setting invalid mode
    result = await retrieval_integration._handle_set_mode({
        "mode": "invalid"
    })
    
    assert result is not None
    assert result.get("success") is False
    
    # Verify mode was not changed
    assert retrieval_integration.hybrid_system.current_mode == "rag"

@pytest.mark.asyncio
async def test_integration_config_persistence(retrieval_integration, config_path):
    """Test configuration persistence"""
    # Change a config value
    retrieval_integration.config["retrieval_mode"] = "cag"
    
    # Save config
    success = retrieval_integration._save_config()
    assert success is True
    
    # Verify file was created
    assert os.path.exists(config_path)
    
    # Load config in a new instance
    new_integration = RetrievalIntegration(
        event_bus=retrieval_integration.event_bus,
        memory_store=retrieval_integration.memory_store,
        semantic_memory=retrieval_integration.semantic_memory,
        config_path=config_path
    )
    
    # Verify config was loaded
    assert new_integration.config["retrieval_mode"] == "cag"

@pytest.mark.asyncio
async def test_integration_shutdown(retrieval_integration):
    """Test shutdown procedure"""
    # Mock the cloud cache shutdown
    retrieval_integration.cloud_cache.shutdown = MagicMock()
    
    # Call shutdown
    retrieval_integration.shutdown()
    
    # Verify cloud cache shutdown was called
    assert retrieval_integration.cloud_cache.shutdown.called