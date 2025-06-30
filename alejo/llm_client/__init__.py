"""
ALEJO LLM Client Module
Generic interface for different LLM providers (OpenAI, Ollama, etc.)
"""

from .base import BaseLLMClient, LLMResponse, LLMConfig, LLMError, ModelCapability
from .openai_client import OpenAIClient
from .ollama_client import OllamaClient
from .factory import LLMClientFactory

__all__ = [
    'BaseLLMClient',
    'LLMResponse',
    'LLMConfig',
    'LLMError',
    'ModelCapability',
    'OpenAIClient',
    'OllamaClient',
    'LLMClientFactory'
]
