"""
Tests for the LLM Integration module
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

from alejo.llm_client.base import LLMResponse, ModelCapability
from alejo.llm_client.integration import LLMIntegration
from alejo.utils.exceptions import ModelError


# Mock classes
class MockBrain:
    """Mock ALEJO Brain for testing"""

    def __init__(self):
        self.event_bus = MockEventBus()
        self.memory_store = MockMemoryStore()


class MockEventBus:
    """Mock EventBus for testing"""

    def __init__(self):
        self.handlers = {}
        self.events_fired = []

    def register(self, event_name, handler):
        """Register an event handler"""
        if event_name not in self.handlers:
            self.handlers[event_name] = []
        self.handlers[event_name].append(handler)

    def fire(self, event_name, data=None):
        """Fire an event"""
        self.events_fired.append((event_name, data))
        if event_name in self.handlers:
            for handler in self.handlers[event_name]:
                asyncio.create_task(handler(data or {}))


class MockMemoryStore:
    """Mock MemoryStore for testing"""

    def __init__(self):
        self.memories = []
        self.search_results = []

    async def add(self, content, source=None, metadata=None):
        """Add a memory"""
        memory = {"content": content, "source": source, "metadata": metadata or {}}
        self.memories.append(memory)
        return {"id": f"mem_{len(self.memories)}"}

    async def search_by_embedding(self, embedding, limit=10, threshold=0.7):
        """Search by embedding"""
        return self.search_results or []

    def set_search_results(self, results):
        """Set search results for testing"""
        self.search_results = results


class MockLocalLLMProvider:
    """Mock LocalLLMProvider for testing"""

    def __init__(self):
        self.generate_text_called = False
        self.generate_chat_response_called = False
        self.get_embeddings_called = False
        self.get_available_models_called = False
        self.download_model_called = False

    async def generate_text(self, prompt, task_type="general", **kwargs):
        """Mock generate_text method"""
        self.generate_text_called = True
        self.last_prompt = prompt
        self.last_task_type = task_type
        self.last_kwargs = kwargs

        return LLMResponse(
            text=f"Generated text for task type {task_type}: {prompt[:20]}...",
            usage={
                "prompt_tokens": len(prompt) // 4,
                "completion_tokens": 50,
                "total_tokens": len(prompt) // 4 + 50,
            },
            model="mock-model",
            finish_reason="stop",
        )

    async def generate_chat_response(self, messages, task_type="general", **kwargs):
        """Mock generate_chat_response method"""
        self.generate_chat_response_called = True
        self.last_messages = messages
        self.last_task_type = task_type
        self.last_kwargs = kwargs

        return LLMResponse(
            text="Response to chat conversation",
            usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
            model="mock-model",
            finish_reason="stop",
        )

    async def get_embeddings(self, text, **kwargs):
        """Mock get_embeddings method"""
        self.get_embeddings_called = True
        self.last_text = text
        self.last_kwargs = kwargs

        if isinstance(text, list):
            return [[0.1, 0.2, 0.3] for _ in text]
        else:
            return [0.1, 0.2, 0.3]

    async def get_available_models(self):
        """Mock get_available_models method"""
        self.get_available_models_called = True

        return {
            "lightweight": {
                "name": "Lightweight Model",
                "model_id": "lightweight-model",
                "is_downloaded": True,
            },
            "standard": {
                "name": "Standard Model",
                "model_id": "standard-model",
                "is_downloaded": True,
            },
        }

    async def download_model(self, tier_id):
        """Mock download_model method"""
        self.download_model_called = True
        self.last_tier_id = tier_id

        return {"success": True, "model_id": f"{tier_id}-model", "tier": tier_id}


# Fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Clean up
    import shutil

    shutil.rmtree(temp_dir)


@pytest.fixture
def config_file(temp_dir):
    """Create a temporary config file"""
    config = {
        "memory_integration": True,
        "default_task_types": {
            "generate_text": "general",
            "generate_chat_response": "general",
            "get_embeddings": "embeddings",
            "code_generation": "code",
            "creative_writing": "creative",
            "reasoning": "reasoning",
        },
        "memory_context_window": 5,
        "memory_relevance_threshold": 0.8,
    }

    config_path = os.path.join(temp_dir, "llm_integration_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f)

    return config_path


@pytest.fixture
def mock_brain():
    """Create a mock brain"""
    return MockBrain()


@pytest.fixture
def mock_provider():
    """Create a mock provider"""
    return MockLocalLLMProvider()


@pytest.fixture
def llm_integration(mock_brain, mock_provider, config_file, monkeypatch):
    """Create an LLMIntegration with mocked components"""
    # Mock the LLMClientFactory.get_local_provider method
    monkeypatch.setattr(
        "alejo.llm_client.factory.LLMClientFactory.get_local_provider",
        lambda: mock_provider,
    )

    # Create integration
    integration = LLMIntegration(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        memory_store=mock_brain.memory_store,
        config_path=config_file,
    )

    return integration


# Tests
@pytest.mark.asyncio
async def test_initialization(mock_brain, mock_provider, config_file, monkeypatch):
    """Test initialization with config file"""
    # Mock the LLMClientFactory.get_local_provider method
    monkeypatch.setattr(
        "alejo.llm_client.factory.LLMClientFactory.get_local_provider",
        lambda: mock_provider,
    )

    # Create integration
    integration = LLMIntegration(brain=mock_brain, config_path=config_file)

    # Check that config was loaded
    assert integration.config["memory_integration"] is True
    assert integration.config["default_task_types"]["generate_text"] == "general"
    assert integration.config["memory_context_window"] == 5
    assert integration.config["memory_relevance_threshold"] == 0.8

    # Check that event handlers were registered
    assert "brain.generate_text" in mock_brain.event_bus.handlers
    assert "brain.generate_chat_response" in mock_brain.event_bus.handlers
    assert "brain.get_embeddings" in mock_brain.event_bus.handlers
    assert "brain.code_generation" in mock_brain.event_bus.handlers
    assert "brain.creative_writing" in mock_brain.event_bus.handlers
    assert "brain.reasoning" in mock_brain.event_bus.handlers
    assert "brain.get_available_models" in mock_brain.event_bus.handlers
    assert "brain.download_model" in mock_brain.event_bus.handlers


@pytest.mark.asyncio
async def test_handle_generate_text(llm_integration, mock_provider):
    """Test handling generate_text event"""
    # Call handler
    result = await llm_integration.handle_generate_text(
        {"prompt": "This is a test prompt", "temperature": 0.8}
    )

    # Check that provider was called
    assert mock_provider.generate_text_called
    assert mock_provider.last_prompt == "This is a test prompt"
    assert mock_provider.last_task_type == "general"
    assert mock_provider.last_kwargs["temperature"] == 0.8

    # Check result
    assert "text" in result
    assert "usage" in result
    assert "model" in result
    assert "finish_reason" in result
    assert "Generated text for task type general" in result["text"]

    # Check that memory was added
    assert len(llm_integration.memory_store.memories) == 1
    assert (
        "Generated response to 'This is a test prompt'"
        in llm_integration.memory_store.memories[0]["content"]
    )


@pytest.mark.asyncio
async def test_handle_generate_text_with_memory(llm_integration, mock_provider):
    """Test handling generate_text event with memory integration"""
    # Set up mock memory search results
    llm_integration.memory_store.set_search_results(
        [
            {"content": "Memory 1: Important context"},
            {"content": "Memory 2: More context"},
        ]
    )

    # Call handler
    result = await llm_integration.handle_generate_text(
        {"prompt": "This is a test prompt", "use_memory": True}
    )

    # Check that provider was called with enriched prompt
    assert mock_provider.generate_text_called
    assert "Relevant context from memory" in mock_provider.last_prompt
    assert "Memory 1: Important context" in mock_provider.last_prompt
    assert "Memory 2: More context" in mock_provider.last_prompt
    assert "This is a test prompt" in mock_provider.last_prompt

    # Check result
    assert "text" in result
    assert "Generated text for task type general" in result["text"]


@pytest.mark.asyncio
async def test_handle_generate_chat_response(llm_integration, mock_provider):
    """Test handling generate_chat_response event"""
    # Call handler
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, how are you?"},
    ]

    result = await llm_integration.handle_generate_chat_response(
        {"messages": messages, "temperature": 0.7}
    )

    # Check that provider was called
    assert mock_provider.generate_chat_response_called
    assert mock_provider.last_messages == messages
    assert mock_provider.last_task_type == "general"
    assert mock_provider.last_kwargs["temperature"] == 0.7

    # Check result
    assert "text" in result
    assert "usage" in result
    assert "model" in result
    assert "finish_reason" in result
    assert "Response to chat conversation" in result["text"]

    # Check that memory was added
    assert len(llm_integration.memory_store.memories) == 1
    assert (
        "Chat: User said 'Hello, how are you?'"
        in llm_integration.memory_store.memories[0]["content"]
    )


@pytest.mark.asyncio
async def test_handle_get_embeddings(llm_integration, mock_provider):
    """Test handling get_embeddings event"""
    # Call handler
    result = await llm_integration.handle_get_embeddings({"text": "This is a test"})

    # Check that provider was called
    assert mock_provider.get_embeddings_called
    assert mock_provider.last_text == "This is a test"

    # Check result
    assert "embeddings" in result
    assert result["embeddings"] == [0.1, 0.2, 0.3]


@pytest.mark.asyncio
async def test_handle_code_generation(llm_integration, mock_provider):
    """Test handling code_generation event"""
    # Call handler
    result = await llm_integration.handle_code_generation(
        {"prompt": "Write a function to calculate factorial"}
    )

    # Check that provider was called
    assert mock_provider.generate_text_called
    assert "Generate code for the following task" in mock_provider.last_prompt
    assert "Write a function to calculate factorial" in mock_provider.last_prompt
    assert mock_provider.last_task_type == "code"

    # Check result
    assert "code" in result
    assert "usage" in result
    assert "model" in result


@pytest.mark.asyncio
async def test_handle_creative_writing(llm_integration, mock_provider):
    """Test handling creative_writing event"""
    # Call handler
    result = await llm_integration.handle_creative_writing(
        {"prompt": "Write a short story about a robot"}
    )

    # Check that provider was called
    assert mock_provider.generate_text_called
    assert mock_provider.last_prompt == "Write a short story about a robot"
    assert mock_provider.last_task_type == "creative"

    # Check result
    assert "text" in result
    assert "usage" in result
    assert "model" in result


@pytest.mark.asyncio
async def test_handle_reasoning(llm_integration, mock_provider):
    """Test handling reasoning event"""
    # Call handler
    result = await llm_integration.handle_reasoning(
        {"prompt": "Solve this logic puzzle"}
    )

    # Check that provider was called
    assert mock_provider.generate_text_called
    assert "Think step by step about the following problem" in mock_provider.last_prompt
    assert "Solve this logic puzzle" in mock_provider.last_prompt
    assert mock_provider.last_task_type == "reasoning"

    # Check result
    assert "reasoning" in result
    assert "usage" in result
    assert "model" in result


@pytest.mark.asyncio
async def test_handle_get_available_models(llm_integration, mock_provider):
    """Test handling get_available_models event"""
    # Call handler
    result = await llm_integration.handle_get_available_models({})

    # Check that provider was called
    assert mock_provider.get_available_models_called

    # Check result
    assert "models" in result
    assert "lightweight" in result["models"]
    assert "standard" in result["models"]


@pytest.mark.asyncio
async def test_handle_download_model(llm_integration, mock_provider):
    """Test handling download_model event"""
    # Call handler
    result = await llm_integration.handle_download_model({"tier_id": "performance"})

    # Check that provider was called
    assert mock_provider.download_model_called
    assert mock_provider.last_tier_id == "performance"

    # Check result
    assert result["success"]
    assert result["model_id"] == "performance-model"
    assert result["tier"] == "performance"


@pytest.mark.asyncio
async def test_error_handling(llm_integration, mock_provider):
    """Test error handling"""
    # Create a failing scenario
    mock_provider.generate_text = AsyncMock(side_effect=Exception("Test error"))

    # Process should handle the error and re-raise as ModelError
    with pytest.raises(ModelError):
        await llm_integration.handle_generate_text({"prompt": "This should fail"})


@pytest.mark.asyncio
async def test_memory_integration_disabled(llm_integration, mock_provider):
    """Test with memory integration disabled"""
    # Disable memory integration
    llm_integration.config["memory_integration"] = False

    # Set up mock memory search results
    llm_integration.memory_store.set_search_results(
        [
            {"content": "Memory 1: Important context"},
            {"content": "Memory 2: More context"},
        ]
    )

    # Call handler
    result = await llm_integration.handle_generate_text(
        {"prompt": "This is a test prompt", "use_memory": True}
    )

    # Check that provider was called with original prompt (not enriched)
    assert mock_provider.generate_text_called
    assert mock_provider.last_prompt == "This is a test prompt"

    # Check that no memory was added
    assert len(llm_integration.memory_store.memories) == 0


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
