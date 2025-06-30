"""
Base LLM Client Interface
Defines the core interface and functionality for all LLM providers in ALEJO
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Union, Generator
from enum import Enum
import logging
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class ModelCapability(Enum):
    """Capabilities that a model might support"""
    TEXT_GENERATION = "text_generation"
    CHAT = "chat"
    CODE = "code"
    EMBEDDINGS = "embeddings"
    FUNCTION_CALLING = "function_calling"
    STREAMING = "streaming"

@dataclass
class LLMConfig:
    """Configuration for LLM clients"""
    model_name: str
    max_tokens: int = 2048
    temperature: float = 0.7
    top_p: float = 1.0
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    capabilities: List[ModelCapability] = field(default_factory=list)
    context_window: int = 4096
    retry_attempts: int = 3
    retry_delay: float = 1.0
    timeout: float = 30.0
    additional_params: Dict[str, Any] = field(default_factory=dict)

@dataclass
class LLMResponse:
    """Standardized response format across all LLM providers"""
    content: str
    model: str
    usage: Dict[str, int] = field(default_factory=dict)
    finish_reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    latency: float = 0.0
    
    @property
    def is_successful(self) -> bool:
        return bool(self.content and self.finish_reason != 'error')

    @property
    def token_usage(self) -> Dict[str, int]:
        return self.usage

class LLMError(Exception):
    """Base exception for LLM-related errors"""
    def __init__(self, message: str, provider: str, error_type: str, raw_error: Optional[Exception] = None):
        super().__init__(message)
        self.provider = provider
        self.error_type = error_type
        self.raw_error = raw_error

class BaseLLMClient(ABC):
    """Abstract base class for LLM clients"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self._executor = ThreadPoolExecutor(max_workers=3)
        self._last_call_time = 0.0
        self._call_count = 0
        self._error_count = 0
        
    @abstractmethod
    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate text from a prompt"""
        pass
    
    @abstractmethod
    async def generate_chat_response(self, 
                                   messages: List[Dict[str, str]], 
                                   **kwargs) -> LLMResponse:
        """Generate a response in a chat context"""
        pass
    
    @abstractmethod
    async def generate_stream(self, 
                            prompt: Union[str, List[Dict[str, str]]], 
                            **kwargs) -> Generator[str, None, None]:
        """Stream responses token by token"""
        pass
    
    @abstractmethod
    async def get_embeddings(self, text: Union[str, List[str]], **kwargs) -> List[List[float]]:
        """Get embeddings for text"""
        pass

    async def _handle_retry(self, 
                          func: callable, 
                          *args, 
                          **kwargs) -> Any:
        """Handle retries with exponential backoff"""
        last_error = None
        for attempt in range(self.config.retry_attempts):
            try:
                if attempt > 0:
                    delay = self.config.retry_delay * (2 ** (attempt - 1))
                    await asyncio.sleep(delay)
                return await func(*args, **kwargs)
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                self._error_count += 1
                continue
        raise LLMError(
            f"Failed after {self.config.retry_attempts} attempts",
            self.__class__.__name__,
            "retry_exhausted",
            last_error
        )

    def _update_metrics(self, start_time: float, success: bool = True):
        """Update usage metrics"""
        self._call_count += 1
        if not success:
            self._error_count += 1
        self._last_call_time = time.time()

    @property
    def health_check(self) -> Dict[str, Any]:
        """Get health metrics for this client"""
        return {
            "total_calls": self._call_count,
            "error_rate": self._error_count / max(1, self._call_count),
            "last_call_time": self._last_call_time,
            "provider": self.__class__.__name__,
            "model": self.config.model_name,
            "capabilities": [cap.value for cap in self.config.capabilities]
        }

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        self._executor.shutdown(wait=True)
