"""
Integration tests for the Hybrid Retrieval System
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
from alejo.cognitive.retrieval.rag_system import RAGSystem, RAGConfig
from alejo.cognitive.retrieval.cag_system import CAGSystem, CAGConfig
from alejo.cognitive.retrieval.hybrid_retrieval import HybridRetrievalSystem, HybridConfig
from alejo.cognitive.retrieval.cloud_cache import CloudCache, CloudCacheConfig, CloudStorageProvider

# Mock LLM client for testing
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

@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache files"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

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
def mock_llm_client():
    """Create a mock LLM client"""
    return MockLLMClient()

@pytest.fixture
def cloud_cache(temp_cache_dir):
    """Create a cloud cache instance"""
    config = CloudCacheConfig(
        provider=CloudStorageProvider.LOCAL,
        cache_dir=os.path.join(temp_cache_dir, "cloud_cache"),
        max_cache_size_mb=10,
        sync_interval_seconds=1,
        enabled=True
    )
    return CloudCache(config)

@pytest.fixture
def rag_system(event_bus, mock_llm_client, temp_cache_dir, cloud_cache):
    """Create a RAG system instance"""
    config = RAGConfig(
        vector_dim=768,
        top_k=3,
        relevance_threshold=0.5,
        index_path=os.path.join(temp_cache_dir, "rag_index"),
        cache_size_mb=5,
        use_cloud_cache=True
    )
    return RAGSystem(
        event_bus=event_bus,
        llm_client=mock_llm_client,
        config=config,
        cloud_cache=cloud_cache
    )

@pytest.fixture
def cag_system(event_bus, mock_llm_client, temp_cache_dir, cloud_cache):
    """Create a CAG system instance"""
    config = CAGConfig(
        max_context_items=10,
        max_tokens=1000,
        cache_path=os.path.join(temp_cache_dir, "cag_context")
    )
    return CAGSystem(
        event_bus=event_bus,
        llm_client=mock_llm_client,
        config=config,
        cloud_cache=cloud_cache
    )

@pytest.fixture
def hybrid_system(event_bus, mock_llm_client, rag_system, cag_system, cloud_cache):
    """Create a hybrid retrieval system instance"""
    config = HybridConfig(
        default_mode="auto",
        hybrid_weight_rag=0.6,
        use_cloud_cache=True
    )
    
    # Create system with direct references to existing RAG and CAG
    system = HybridRetrievalSystem(
        event_bus=event_bus,
        llm_client=mock_llm_client,
        config=config,
        cloud_cache=cloud_cache
    )
    
    # Replace the auto-created systems with our fixtures
    system.rag_system = rag_system
    system.cag_system = cag_system
    
    return system

@pytest.mark.asyncio
async def test_rag_document_addition(rag_system):
    """Test adding documents to RAG system"""
    # Add test documents
    success = await rag_system.add_document(
        content="ALEJO is an AI assistant with emotional intelligence and multimodal capabilities.",
        source="test",
        metadata={"test": True}
    )
    
    assert success is True
    assert rag_system.index.ntotal == 1
    assert len(rag_system.document_map) == 1

@pytest.mark.asyncio
async def test_rag_retrieval(rag_system):
    """Test retrieving documents from RAG system"""
    # Add test documents
    await rag_system.add_document(
        content="ALEJO is an AI assistant with emotional intelligence and multimodal capabilities.",
        source="test1"
    )
    await rag_system.add_document(
        content="RAG (Retrieval-Augmented Generation) enhances LLM responses with relevant information.",
        source="test2"
    )
    
    # Test retrieval
    results = await rag_system.retrieve("What is ALEJO?")
    assert len(results) > 0
    assert "ALEJO" in results[0].content
    
    results = await rag_system.retrieve("Tell me about RAG")
    assert len(results) > 0
    assert "RAG" in results[0].content

@pytest.mark.asyncio
async def test_cag_context_management(cag_system):
    """Test CAG context management"""
    # Add context items
    cag_system.add_context("Hello, I'm a user", "user", "test")
    cag_system.add_context("Hi there! I'm ALEJO", "assistant", "test")
    
    assert len(cag_system.context) == 2
    
    # Get context for prompt
    context_str = cag_system.get_context_for_prompt("What can you do?")
    assert "Hello, I'm a user" in context_str
    assert "Hi there! I'm ALEJO" in context_str

@pytest.mark.asyncio
async def test_hybrid_mode_selection(hybrid_system):
    """Test hybrid mode selection"""
    # Test with different queries
    mode = await hybrid_system.determine_best_mode("What is the history of RAG?")
    assert mode in ["rag", "hybrid", "auto"]
    
    mode = await hybrid_system.determine_best_mode("You said something earlier about ALEJO")
    assert mode in ["cag", "hybrid", "auto"]
    
    # Test mode setting
    assert hybrid_system.set_mode("rag") is True
    assert hybrid_system.current_mode == "rag"
    
    assert hybrid_system.set_mode("invalid") is False
    assert hybrid_system.current_mode == "rag"  # Unchanged

@pytest.mark.asyncio
async def test_hybrid_response_generation(hybrid_system):
    """Test generating responses with hybrid system"""
    # Add some data to both systems
    await hybrid_system.rag_system.add_document(
        content="ALEJO is an AI assistant with emotional intelligence and multimodal capabilities.",
        source="test_rag"
    )
    
    hybrid_system.cag_system.add_context(
        "User asked about ALEJO's capabilities", 
        "user", 
        "test_cag"
    )
    
    # Test with different modes
    hybrid_system.set_mode("rag")
    response_rag = await hybrid_system.generate_response("What is ALEJO?")
    assert response_rag is not None
    assert response_rag.metadata.get("retrieval_mode") == "rag"
    
    hybrid_system.set_mode("cag")
    response_cag = await hybrid_system.generate_response("What is ALEJO?")
    assert response_cag is not None
    assert response_cag.metadata.get("retrieval_mode") == "cag"
    
    hybrid_system.set_mode("hybrid")
    response_hybrid = await hybrid_system.generate_response("What is ALEJO?")
    assert response_hybrid is not None
    assert response_hybrid.metadata.get("retrieval_mode") == "hybrid"

@pytest.mark.asyncio
async def test_cloud_cache_integration(hybrid_system, temp_cache_dir):
    """Test cloud cache integration"""
    # Create a test file
    test_file_path = os.path.join(temp_cache_dir, "test_file.txt")
    with open(test_file_path, "w") as f:
        f.write("Test content")
    
    # Test upload
    success = hybrid_system.cloud_cache.upload(test_file_path, "test_remote.txt", sync=True)
    assert success is True
    
    # Test exists
    exists = hybrid_system.cloud_cache.exists("test_remote.txt")
    assert exists is True
    
    # Test download
    download_path = os.path.join(temp_cache_dir, "downloaded.txt")
    success = hybrid_system.cloud_cache.download("test_remote.txt", download_path, sync=True)
    assert success is True
    assert os.path.exists(download_path)
    
    # Verify content
    with open(download_path, "r") as f:
        content = f.read()
    assert content == "Test content"

@pytest.mark.asyncio
async def test_event_handling(hybrid_system, event_bus):
    """Test event handling"""
    # Mock the event handlers
    hybrid_system._handle_query = MagicMock()
    hybrid_system._handle_set_mode = MagicMock()
    hybrid_system._handle_feedback = MagicMock()
    
    # Verify event subscriptions
    assert event_bus.subscribe.call_count >= 3
    
    # Check that the correct handlers were registered
    subscription_calls = event_bus.subscribe.call_args_list
    subscription_events = [call[0][0] for call in subscription_calls]
    
    assert "hybrid_retrieval.query" in subscription_events
    assert "hybrid_retrieval.set_mode" in subscription_events
    assert "hybrid_retrieval.feedback" in subscription_events
