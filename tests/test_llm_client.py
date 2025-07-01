"""
Tests for the LLM client system
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List

from alejo.llm_client import (
    LLMClientFactory,
    BaseLLMClient,
    LLMConfig,
    LLMResponse,
    LLMError,
    OpenAIClient,
    OllamaClient
)
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.exceptions import LLMServiceError
import secrets  # More secure for cryptographic purposes

@pytest.fixture
def mock_llm_config() -> Dict[str, Any]:
    """Fixture for LLM configuration"""
    return {
        "provider": "ollama",
        "model_name": "llama2:7b-chat",
        "max_tokens": 1000,
        "temperature": 0.7
    }

@pytest.fixture
def mock_brain_config(mock_llm_config) -> Dict[str, Any]:
    """Fixture for brain configuration"""
    return {
        "llm": mock_llm_config,
        "db_path": ":memory:"
    }

@pytest.fixture
async def mock_ollama_client():
    """Fixture for mocked Ollama client"""
    client = AsyncMock(spec=OllamaClient)
    client.generate_text.return_value = LLMResponse(
        content="Test response",
        model="llama2:7b-chat",
        usage={"total_tokens": 10}
    )
    return client

@pytest.fixture
async def mock_openai_client():
    """Fixture for mocked OpenAI client"""
    client = AsyncMock(spec=OpenAIClient)
    client.generate_text.return_value = LLMResponse(
        content="Test response",
        model="gpt-3.5-turbo",
        usage={"total_tokens": 10}
    )
    return client

class TestLLMClientFactory:
    """Tests for the LLM client factory"""
    
    def test_create_local_client(self):
        """Test creating a Local Llama client"""
        from alejo.llm_client.local_client import LocalLLMClient
        client = LLMClientFactory.create_client("local")
        assert isinstance(client, LocalLLMClient)
        
    def test_skip_ollama_client(self):
        """Skip Ollama client test – optional provider disabled in CI"""
        import pytest
        pytest.skip("Ollama provider disabled in CI")
        
    def test_invalid_provider(self):
        """Test error handling for invalid provider"""
        with pytest.raises(ValueError):
            LLMClientFactory.create_client("invalid_provider")
            
    def test_config_override(self):
        """Test configuration override"""
        config = {"model_name": "custom-model"}
        client = LLMClientFactory.create_client("ollama", config)
        assert client.config.model_name == "custom-model"

class TestALEJOBrainLLM:
    """Tests for ALEJO brain's LLM integration"""
    
    @pytest.mark.asyncio
    async def test_generate_text(self, mock_ollama_client, mock_brain_config):
        """Test text generation"""
        with patch("alejo.llm_client.factory.LLMClientFactory.create_client", 
                  return_value=mock_ollama_client):
            brain = ALEJOBrain(mock_brain_config)
            response = await brain.generate_text("Test prompt")
            assert response.content == "Test response"
            mock_ollama_client.generate_text.assert_called_once_with(
                "Test prompt"
            )
            
    @pytest.mark.asyncio
    async def test_generate_chat_response(self, mock_ollama_client, mock_brain_config):
        """Test chat response generation"""
        messages = [{"role": "user", "content": "Hello"}]
        with patch("alejo.llm_client.factory.LLMClientFactory.create_client",
                  return_value=mock_ollama_client):
            brain = ALEJOBrain(mock_brain_config)
            response = await brain.generate_chat_response(messages)
            assert response.content == "Test response"
            mock_ollama_client.generate_chat_response.assert_called_once_with(
                messages
            )
            
    @pytest.mark.asyncio
    async def test_llm_error_handling(self, mock_ollama_client, mock_brain_config):
        """Test error handling for LLM failures"""
        mock_ollama_client.generate_text.side_effect = LLMError(
            "Test error",
            "ollama",
            "test_error"
        )
        with patch("alejo.llm_client.factory.LLMClientFactory.create_client",
                  return_value=mock_ollama_client):
            brain = ALEJOBrain(mock_brain_config)
            with pytest.raises(LLMServiceError):
                await brain.generate_text("Test prompt")

    @pytest.mark.asyncio
    async def test_stream_generation(self, mock_ollama_client, mock_brain_config):
        """Test streaming response generation"""
        mock_ollama_client.generate_stream.return_value = (
            chunk for chunk in ["Test", " stream", " response"]
        )
        with patch("alejo.llm_client.factory.LLMClientFactory.create_client",
                  return_value=mock_ollama_client):
            brain = ALEJOBrain(mock_brain_config)
            chunks = []
            async for chunk in brain.generate_stream("Test prompt"):
                chunks.append(chunk)
            assert "".join(chunks) == "Test stream response"
            mock_ollama_client.generate_stream.assert_called_once_with(
                "Test prompt"
            )

class TestLLMClients:
    """Tests for individual LLM client implementations"""
    
    @pytest.mark.asyncio
    async def test_ollama_client_retry(self, mock_brain_config):
        """Test Ollama client retry mechanism"""
        config = LLMConfig(**mock_brain_config["llm"])
        client = OllamaClient(config)
        
        # Mock the _make_request method to fail twice then succeed
        side_effects = [
            LLMError("Attempt 1", "ollama", "test"),
            LLMError("Attempt 2", "ollama", "test"),
            {"response": "Success", "eval_count": 10}
        ]
        with patch.object(client, "_make_request", side_effect=side_effects):
            response = await client.generate_text("Test")
            assert response.content == "Success"
            
    @pytest.mark.asyncio
    async def test_openai_client_embeddings(self, mock_brain_config):
        """Test OpenAI client embeddings"""
        config = LLMConfig(**{**mock_brain_config["llm"], "provider": "openai"})
        client = OpenAIClient(config)
        
        mock_embeddings = [[0.1, 0.2, 0.3]]
        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_openai.return_value.embeddings.create.return_value.data = [
                Mock(embedding=mock_embeddings[0])
            ]
            embeddings = await client.get_embeddings("Test text")
            assert embeddings == mock_embeddings