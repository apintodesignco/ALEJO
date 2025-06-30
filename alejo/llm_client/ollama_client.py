"""
Ollama LLM Client Implementation
Provides integration with locally running Ollama models
"""

import json
import asyncio
import aiohttp
from typing import Dict, Any, List, Union, Generator, Optional, AsyncGenerator
import logging
from .base import (
    BaseLLMClient, 
    LLMConfig, 
    LLMResponse, 
    LLMError,
    ModelCapability
)

logger = logging.getLogger(__name__)

class OllamaConfig(LLMConfig):
    """Ollama-specific configuration"""
    def __init__(
        self,
        model_name: str = "llama2:7b-chat",
        base_url: str = "http://localhost:11434",
        **kwargs
    ):
        super().__init__(model_name=model_name, **kwargs)
        self.base_url = base_url
        # Set Ollama-specific capabilities
        self.capabilities = [
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CHAT,
            ModelCapability.CODE,
            ModelCapability.STREAMING
        ]

class OllamaClient(BaseLLMClient):
    """Client for interacting with local Ollama models"""
    
    def __init__(self, config: Optional[OllamaConfig] = None):
        super().__init__(config or OllamaConfig())
        self.session = None
        self._ensure_config_type()
        
    def _ensure_config_type(self):
        """Ensure config is OllamaConfig"""
        if not isinstance(self.config, OllamaConfig):
            self.config = OllamaConfig(**self.config.__dict__)

    async def _init_session(self):
        """Initialize aiohttp session if needed"""
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def _close_session(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()
            self.session = None

    async def _make_request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        stream: bool = False
    ) -> Union[Dict[str, Any], aiohttp.StreamReader]:
        """Make HTTP request to Ollama API"""
        await self._init_session()
        
        url = f"{self.config.base_url}/{endpoint}"
        start_time = asyncio.get_event_loop().time()
        
        try:
            async with self.session.post(url, json=payload) as response:
                if not response.ok:
                    error_text = await response.text()
                    raise LLMError(
                        f"Ollama API error: {error_text}",
                        "ollama",
                        "api_error"
                    )
                
                if stream:
                    return response.content
                else:
                    result = await response.json()
                    return result
        except aiohttp.ClientError as e:
            raise LLMError(
                f"Failed to connect to Ollama: {str(e)}",
                "ollama",
                "connection_error",
                e
            )
        finally:
            latency = asyncio.get_event_loop().time() - start_time
            self._update_metrics(start_time, success=True)
            logger.debug(f"Ollama request completed in {latency:.2f}s")

    async def _process_stream(self, stream: aiohttp.StreamReader) -> AsyncGenerator[Dict[str, Any], None]:
        """Process streaming response from Ollama"""
        async for line in stream:
            if line:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse Ollama response: {e}")

    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate text using Ollama model"""
        payload = {
            "model": self.config.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "top_p": kwargs.get("top_p", self.config.top_p),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens)
            }
        }

        response = await self._handle_retry(
            self._make_request,
            "api/generate",
            payload
        )

        return LLMResponse(
            content=response["response"],
            model=self.config.model_name,
            usage={
                "prompt_tokens": response.get("prompt_eval_count", 0),
                "completion_tokens": response.get("eval_count", 0),
                "total_tokens": response.get("prompt_eval_count", 0) + response.get("eval_count", 0)
            },
            finish_reason="stop",
            metadata={
                "raw_response": response
            }
        )

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> LLMResponse:
        """Generate chat response using Ollama model"""
        # Convert messages to Ollama format
        formatted_prompt = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                formatted_prompt += f"[INST]System: {content}[/INST]\n"
            elif role == "assistant":
                formatted_prompt += f"Assistant: {content}\n"
            else:
                formatted_prompt += f"Human: {content}\n"
        
        formatted_prompt += "Assistant:"

        return await self.generate_text(formatted_prompt, **kwargs)

    async def generate_stream(
        self,
        prompt: Union[str, List[Dict[str, str]]],
        **kwargs
    ) -> AsyncGenerator[LLMResponse, None]:
        """Stream responses from Ollama model"""
        if isinstance(prompt, list):
            # Convert chat messages to formatted prompt
            formatted_prompt = ""
            for msg in prompt:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    formatted_prompt += f"[INST]System: {content}[/INST]\n"
                elif role == "assistant":
                    formatted_prompt += f"Assistant: {content}\n"
                else:
                    formatted_prompt += f"Human: {content}\n"
            prompt = formatted_prompt + "Assistant:"

        payload = {
            "model": self.config.model_name,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "top_p": kwargs.get("top_p", self.config.top_p),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens)
            }
        }

        stream = await self._make_request("api/generate", payload, stream=True)
        async for line in stream.iter_lines():
            if line:
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        yield LLMResponse(
                            content=chunk["response"],
                            model=self.config.model_name,
                            usage={
                                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                                "completion_tokens": chunk.get("eval_count", 0),
                                "total_tokens": chunk.get("total_eval_count", 0)
                            },
                            finish_reason="continue" if not chunk.get("done", False) else "stop",
                            metadata={
                                "raw_response": chunk
                            }
                        )
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse streaming response: {e}")

    async def get_embeddings(self, text: Union[str, List[str]], **kwargs) -> List[List[float]]:
        """Get embeddings using Ollama model"""
        raise NotImplementedError("Embeddings not yet supported by Ollama")

    async def __aenter__(self):
        """Async context manager entry"""
        await self._init_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self._close_session()
        await super().__aexit__(exc_type, exc_val, exc_tb)
