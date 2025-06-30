"""
OpenAI LLM Client Implementation
Provides integration with OpenAI's API while conforming to our base interface
"""

import os
import asyncio
from typing import Dict, Any, List, Union, Generator, Optional
import logging
import time
from openai import AsyncOpenAI, APIError, RateLimitError
from .base import (
    BaseLLMClient,
    LLMConfig,
    LLMResponse,
    LLMError,
    ModelCapability
)

logger = logging.getLogger(__name__)

class OpenAIConfig(LLMConfig):
    """OpenAI-specific configuration"""
    def __init__(
        self,
        model_name: str = "gpt-3.5-turbo",
        api_key: Optional[str] = None,
        organization: Optional[str] = None,
        **kwargs
    ):
        super().__init__(model_name=model_name, **kwargs)
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.organization = organization
        # Set OpenAI-specific capabilities
        self.capabilities = [
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CHAT,
            ModelCapability.CODE,
            ModelCapability.EMBEDDINGS,
            ModelCapability.FUNCTION_CALLING,
            ModelCapability.STREAMING
        ]

class OpenAIClient(BaseLLMClient):
    """Client for interacting with OpenAI's API"""
    
    def __init__(self, config: Optional[OpenAIConfig] = None):
        super().__init__(config or OpenAIConfig())
        self._ensure_config_type()
        self.client = AsyncOpenAI(
            api_key=self.config.api_key,
            organization=self.config.organization,
            timeout=self.config.timeout
        )
        
    def _ensure_config_type(self):
        """Ensure config is OpenAIConfig"""
        if not isinstance(self.config, OpenAIConfig):
            self.config = OpenAIConfig(**self.config.__dict__)

    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate text using OpenAI's chat completion API"""
        messages = [{"role": "user", "content": prompt}]
        return await self.generate_chat_response(messages, **kwargs)

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> LLMResponse:
        """Generate chat response using OpenAI's chat completion API"""
        start_time = time.time()
        
        try:
            response = await self._handle_retry(
                self.client.chat.completions.create,
                model=self.config.model_name,
                messages=messages,
                temperature=kwargs.get("temperature", self.config.temperature),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                top_p=kwargs.get("top_p", self.config.top_p),
                presence_penalty=kwargs.get(
                    "presence_penalty",
                    self.config.presence_penalty
                ),
                frequency_penalty=kwargs.get(
                    "frequency_penalty",
                    self.config.frequency_penalty
                ),
                stream=False
            )
            
            # Convert API response to our standard format
            llm_response = LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                finish_reason=response.choices[0].finish_reason,
                metadata={
                    "id": response.id,
                    "created": response.created,
                    "raw_response": response.model_dump()
                },
                latency=time.time() - start_time
            )
            
            self._update_metrics(start_time, success=True)
            return llm_response
            
        except RateLimitError as e:
            self._update_metrics(start_time, success=False)
            raise LLMError(
                "Rate limit exceeded",
                "openai",
                "rate_limit",
                e
            )
        except APIError as e:
            self._update_metrics(start_time, success=False)
            raise LLMError(
                f"OpenAI API error: {str(e)}",
                "openai",
                "api_error",
                e
            )
        except Exception as e:
            self._update_metrics(start_time, success=False)
            raise LLMError(
                f"Unexpected error: {str(e)}",
                "openai",
                "unexpected",
                e
            )

    async def generate_stream(
        self,
        prompt: Union[str, List[Dict[str, str]]],
        **kwargs
    ) -> Generator[str, None, None]:
        """Stream responses from OpenAI's API"""
        messages = (
            [{"role": "user", "content": prompt}]
            if isinstance(prompt, str)
            else prompt
        )
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.config.model_name,
                messages=messages,
                temperature=kwargs.get("temperature", self.config.temperature),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                top_p=kwargs.get("top_p", self.config.top_p),
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            raise LLMError(
                f"Stream error: {str(e)}",
                "openai",
                "stream_error",
                e
            )

    async def get_embeddings(
        self,
        text: Union[str, List[str]],
        **kwargs
    ) -> List[List[float]]:
        """Get embeddings using OpenAI's embedding API"""
        try:
            # Handle both single strings and lists of strings
            texts = [text] if isinstance(text, str) else text
            
            response = await self.client.embeddings.create(
                model="text-embedding-ada-002",  # Currently the best model for embeddings
                input=texts
            )
            
            # Extract and return the embedding vectors
            return [item.embedding for item in response.data]
            
        except Exception as e:
            raise LLMError(
                f"Embedding error: {str(e)}",
                "openai",
                "embedding_error",
                e
            )

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await super().__aexit__(exc_type, exc_val, exc_tb)
