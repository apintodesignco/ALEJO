"""
Tests for the LocalLLMProvider module
"""

import asyncio
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

from alejo.llm_client.base import LLMResponse, ModelCapability
from alejo.llm_client.local_provider import LocalLLMProvider, ModelInstance
from alejo.utils.exceptions import ModelError


# Mock classes
class MockLocalLLMClient:
    """Mock LocalLLMClient for testing"""

    def __init__(self, config=None):
        self.config = config
        self.generate_text_called = False
        self.generate_chat_response_called = False
        self.get_embeddings_called = False

    async def generate_text(self, prompt, **kwargs):
        """Mock generate_text method"""
        self.generate_text_called = True
        self.last_prompt = prompt
        self.last_kwargs = kwargs

        return LLMResponse(
            text="Generated text for: " + prompt[:20] + "...",
            usage={
                "prompt_tokens": len(prompt) // 4,
                "completion_tokens": 50,
                "total_tokens": len(prompt) // 4 + 50,
            },
            model="mock-model",
            finish_reason="stop",
        )

    async def generate_chat_response(self, messages, **kwargs):
        """Mock generate_chat_response method"""
        self.generate_chat_response_called = True
        self.last_messages = messages
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


class MockModelManager:
    """Mock ModelManager for testing"""

    def __init__(self, models_dir=None):
        self.models_dir = models_dir or Path.home() / ".alejo" / "models"
        self.download_called = False
        self.system_specs = {"ram_gb": 16.0, "gpu_vram_gb": 8.0, "free_disk_gb": 100.0}

    def get_compatible_tiers(self, model_type="llm"):
        """Mock get_compatible_tiers method"""
        return ["lightweight", "standard"]

    def download_model(self, tier, force=False):
        """Mock download_model method"""
        self.download_called = True
        self.last_tier = tier
        self.last_force = force

        # Simulate successful download
        return True


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
        "default_model_tiers": {
            "general": "standard",
            "code": "standard",
            "creative": "standard",
            "reasoning": "performance",
            "embeddings": "lightweight",
        },
        "gpu_acceleration": True,
        "context_window": 4096,
        "temperature": 0.7,
        "top_p": 0.9,
    }

    config_path = os.path.join(temp_dir, "local_provider_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f)

    return config_path


@pytest.fixture
def mock_model_manager():
    """Create a mock model manager"""
    return MockModelManager()


@pytest.fixture
def local_provider(monkeypatch):
    """Create a LocalLLMProvider with mocked components"""
    # Mock the ModelManager class
    monkeypatch.setattr(
        "alejo.llm_client.local_provider.ModelManager", MockModelManager
    )

    # Mock the LocalLLMClient class
    monkeypatch.setattr(
        "alejo.llm_client.local_provider.LocalLLMClient", MockLocalLLMClient
    )

    # Create provider
    provider = LocalLLMProvider(max_loaded_models=2, unload_after_minutes=0.1)

    yield provider

    # Cleanup
    provider.shutdown()


# Tests
@pytest.mark.asyncio
async def test_initialization(config_file):
    """Test initialization with config file"""
    with patch("alejo.llm_client.local_provider.ModelManager") as mock_manager_class:
        mock_manager = MagicMock()
        mock_manager_class.return_value = mock_manager

        # Create provider
        provider = LocalLLMProvider(config_path=config_file)

        # Check that model manager was initialized
        assert mock_manager_class.called

        # Check that config was loaded
        assert provider.config["default_model_tiers"]["general"] == "standard"
        assert provider.config["temperature"] == 0.7

        # Cleanup
        provider.shutdown()


@pytest.mark.asyncio
async def test_get_model_for_task(local_provider):
    """Test getting a model for a task"""
    # Get model for general task
    model_instance = await local_provider.get_model_for_task(task_type="general")

    # Check model instance
    assert isinstance(model_instance, ModelInstance)
    assert model_instance.in_use
    assert "standard" in model_instance.tier

    # End use
    model_instance.end_use()

    # Get model for embeddings task
    model_instance = await local_provider.get_model_for_task(
        task_type="embeddings", required_capabilities=[ModelCapability.EMBEDDINGS]
    )

    # Check model instance
    assert isinstance(model_instance, ModelInstance)
    assert model_instance.in_use
    assert "lightweight" in model_instance.tier

    # End use
    model_instance.end_use()


@pytest.mark.asyncio
async def test_generate_text(local_provider):
    """Test generating text"""
    # Generate text
    response = await local_provider.generate_text(
        prompt="This is a test prompt", task_type="general", temperature=0.8
    )

    # Check response
    assert isinstance(response, LLMResponse)
    assert "Generated text for:" in response.text

    # Check that model was marked as no longer in use
    model_id = list(local_provider._loaded_models.keys())[0]
    assert not local_provider._loaded_models[model_id].in_use


@pytest.mark.asyncio
async def test_generate_chat_response(local_provider):
    """Test generating chat response"""
    # Generate chat response
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, how are you?"},
    ]

    response = await local_provider.generate_chat_response(
        messages=messages, task_type="general"
    )

    # Check response
    assert isinstance(response, LLMResponse)
    assert "Response to chat conversation" in response.text

    # Check that model was marked as no longer in use
    model_id = list(local_provider._loaded_models.keys())[0]
    assert not local_provider._loaded_models[model_id].in_use


@pytest.mark.asyncio
async def test_get_embeddings(local_provider):
    """Test getting embeddings"""
    # Get embeddings for single text
    embeddings = await local_provider.get_embeddings(text="This is a test")

    # Check embeddings
    assert isinstance(embeddings, list)
    assert len(embeddings) == 3  # Our mock returns [0.1, 0.2, 0.3]

    # Get embeddings for multiple texts
    texts = ["Text 1", "Text 2", "Text 3"]
    embeddings = await local_provider.get_embeddings(text=texts)

    # Check embeddings
    assert isinstance(embeddings, list)
    assert len(embeddings) == 3  # One embedding per text
    assert len(embeddings[0]) == 3  # Each embedding is [0.1, 0.2, 0.3]


@pytest.mark.asyncio
async def test_model_cleanup(local_provider):
    """Test automatic model cleanup"""
    # Get model for general task
    model_instance = await local_provider.get_model_for_task(task_type="general")
    model_instance.end_use()

    # Get model for embeddings task
    model_instance = await local_provider.get_model_for_task(task_type="embeddings")
    model_instance.end_use()

    # Check that we have two models loaded
    assert len(local_provider._loaded_models) == 2

    # Wait for cleanup (unload_after_minutes is set to 0.1 in fixture)
    await asyncio.sleep(7)  # Wait for cleanup task to run

    # Check that models were unloaded
    assert len(local_provider._loaded_models) == 0


@pytest.mark.asyncio
async def test_model_limit(local_provider):
    """Test model limit enforcement"""
    # Set max loaded models to 1
    local_provider.max_loaded_models = 1

    # Get model for general task
    model_instance1 = await local_provider.get_model_for_task(task_type="general")

    # Keep this model in use
    model_instance1.start_use()

    # Get model for embeddings task
    model_instance2 = await local_provider.get_model_for_task(task_type="embeddings")

    # Check that we still have only one model loaded
    assert len(local_provider._loaded_models) == 1

    # End use of both models
    model_instance1.end_use()
    model_instance2.end_use()


@pytest.mark.asyncio
async def test_get_available_models(local_provider):
    """Test getting available models"""
    # Get available models
    models_info = await local_provider.get_available_models()

    # Check models info
    assert isinstance(models_info, dict)
    assert "lightweight" in models_info
    assert "standard" in models_info

    # Check model properties
    assert "name" in models_info["lightweight"]
    assert "model_id" in models_info["lightweight"]
    assert "is_downloaded" in models_info["lightweight"]


@pytest.mark.asyncio
async def test_download_model(local_provider):
    """Test downloading a model"""
    # Download model
    result = await local_provider.download_model(tier_id="lightweight")

    # Check result
    assert result["success"]
    assert "model_id" in result
    assert "path" in result


@pytest.mark.asyncio
async def test_error_handling(local_provider):
    """Test error handling"""
    # Create a failing scenario
    with patch.object(
        local_provider, "_load_model_for_task", side_effect=Exception("Test error")
    ):
        # Process should handle the error and re-raise as ModelError
        with pytest.raises(ModelError):
            await local_provider.generate_text(prompt="This should fail")


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
