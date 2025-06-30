"""
LLM Integration Module for ALEJO Brain

This module provides integration between the ALEJO Brain and local LLM providers,
enabling seamless access to language model capabilities through a unified interface.
It handles event registration, memory integration, and configuration management.

Features:
- Event-driven architecture for LLM operations
- Memory integration for context-aware responses
- Support for text generation, chat, and embeddings
- Dynamic model selection based on task requirements
- Comprehensive error handling and logging
"""

import os
import sys
import json
import asyncio
import logging
from typing import Dict, List, Optional, Union, Any, Tuple
from pathlib import Path

from .factory import LLMClientFactory
from .base import LLMResponse, ModelCapability
from .local_provider import LocalLLMProvider
from ..utils.error_handling import handle_errors, error_handler
from ..utils.exceptions import ModelError, ConfigurationError
from ..core.event_bus import EventBus
from ..core.memory_store import MemoryStore

logger = logging.getLogger(__name__)

class LLMIntegration:
    """
    Integration between ALEJO Brain and LLM capabilities
    
    This class provides a unified interface for the ALEJO Brain to access
    language model capabilities, handling event registration, memory integration,
    and configuration management.
    """
    
    def __init__(
        self,
        brain,  # ALEJOBrain instance
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        config_path: Optional[str] = None
    ):
        """
        Initialize the LLM integration
        
        Args:
            brain: ALEJOBrain instance
            event_bus: EventBus instance
            memory_store: MemoryStore instance
            config_path: Path to configuration file
        """
        self.brain = brain
        self.event_bus = event_bus or brain.event_bus
        self.memory_store = memory_store or brain.memory_store
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Get local LLM provider
        self.provider = LLMClientFactory.get_local_provider()
        
        # Register event handlers
        self._register_event_handlers()
        
        logger.info("LLM Integration initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "memory_integration": True,
            "default_task_types": {
                "generate_text": "general",
                "generate_chat_response": "general",
                "get_embeddings": "embeddings",
                "code_generation": "code",
                "creative_writing": "creative",
                "reasoning": "reasoning"
            },
            "memory_context_window": 10,  # Number of recent memories to include
            "memory_relevance_threshold": 0.7  # Minimum relevance score for memories
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    config.update(loaded_config)
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        # Text generation events
        self.event_bus.register("brain.generate_text", self.handle_generate_text)
        self.event_bus.register("brain.generate_chat_response", self.handle_generate_chat_response)
        self.event_bus.register("brain.get_embeddings", self.handle_get_embeddings)
        
        # Task-specific events
        self.event_bus.register("brain.code_generation", self.handle_code_generation)
        self.event_bus.register("brain.creative_writing", self.handle_creative_writing)
        self.event_bus.register("brain.reasoning", self.handle_reasoning)
        
        # Model management events
        self.event_bus.register("brain.get_available_models", self.handle_get_available_models)
        self.event_bus.register("brain.download_model", self.handle_download_model)
        
        logger.info("LLM Integration event handlers registered")
    
    async def _get_relevant_memories(self, query: str) -> List[Dict[str, Any]]:
        """Get relevant memories for a query"""
        if not self.config["memory_integration"]:
            return []
        
        try:
            # Get embeddings for the query
            query_embedding = await self.provider.get_embeddings(query)
            
            # Search memory store for relevant memories
            memories = await self.memory_store.search_by_embedding(
                embedding=query_embedding,
                limit=self.config["memory_context_window"],
                threshold=self.config["memory_relevance_threshold"]
            )
            
            return memories
        except Exception as e:
            logger.error(f"Failed to get relevant memories: {e}")
            return []
    
    async def _enrich_prompt_with_memories(self, prompt: str) -> str:
        """Enrich a prompt with relevant memories"""
        memories = await self._get_relevant_memories(prompt)
        
        if not memories:
            return prompt
        
        # Format memories as context
        memory_context = "\n\nRelevant context from memory:\n"
        for i, memory in enumerate(memories, 1):
            memory_context += f"{i}. {memory['content']}\n"
        
        # Add to prompt
        enriched_prompt = f"{memory_context}\n\n{prompt}"
        return enriched_prompt
    
    @error_handler(ModelError)
    async def handle_generate_text(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle generate_text event
        
        Args:
            data: Event data with prompt and optional parameters
            
        Returns:
            Response with generated text
        """
        prompt = data.get("prompt", "")
        if not prompt:
            raise ValueError("Prompt is required")
        
        # Get task type
        task_type = data.get("task_type", self.config["default_task_types"]["generate_text"])
        
        # Enrich prompt with memories if enabled
        if self.config["memory_integration"] and data.get("use_memory", True):
            prompt = await self._enrich_prompt_with_memories(prompt)
        
        # Generate text
        response = await self.provider.generate_text(
            prompt=prompt,
            task_type=task_type,
            **{k: v for k, v in data.items() if k not in ["prompt", "task_type", "use_memory"]}
        )
        
        # Store response in memory if significant
        if self.config["memory_integration"] and len(response.text) > 50:
            await self.memory_store.add(
                content=f"Generated response to '{prompt[:50]}...': {response.text[:100]}...",
                source="llm_integration",
                metadata={
                    "type": "generated_text",
                    "task_type": task_type,
                    "prompt_length": len(prompt),
                    "response_length": len(response.text)
                }
            )
        
        return {
            "text": response.text,
            "usage": response.usage,
            "model": response.model,
            "finish_reason": response.finish_reason
        }
    
    @error_handler(ModelError)
    async def handle_generate_chat_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle generate_chat_response event
        
        Args:
            data: Event data with messages and optional parameters
            
        Returns:
            Response with generated text
        """
        messages = data.get("messages", [])
        if not messages:
            raise ValueError("Messages are required")
        
        # Get task type
        task_type = data.get("task_type", self.config["default_task_types"]["generate_chat_response"])
        
        # Generate chat response
        response = await self.provider.generate_chat_response(
            messages=messages,
            task_type=task_type,
            **{k: v for k, v in data.items() if k not in ["messages", "task_type"]}
        )
        
        # Store last message and response in memory if significant
        if self.config["memory_integration"] and len(response.text) > 50 and messages:
            last_message = messages[-1]["content"]
            await self.memory_store.add(
                content=f"Chat: User said '{last_message[:50]}...' and system responded '{response.text[:100]}...'",
                source="llm_integration",
                metadata={
                    "type": "chat_response",
                    "task_type": task_type,
                    "message_count": len(messages),
                    "response_length": len(response.text)
                }
            )
        
        return {
            "text": response.text,
            "usage": response.usage,
            "model": response.model,
            "finish_reason": response.finish_reason
        }
    
    @error_handler(ModelError)
    async def handle_get_embeddings(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle get_embeddings event
        
        Args:
            data: Event data with text to embed
            
        Returns:
            Response with embeddings
        """
        text = data.get("text")
        if text is None:
            raise ValueError("Text is required")
        
        # Get embeddings
        embeddings = await self.provider.get_embeddings(
            text=text,
            **{k: v for k, v in data.items() if k != "text"}
        )
        
        return {"embeddings": embeddings}
    
    @error_handler(ModelError)
    async def handle_code_generation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle code_generation event
        
        Args:
            data: Event data with prompt and optional parameters
            
        Returns:
            Response with generated code
        """
        prompt = data.get("prompt", "")
        if not prompt:
            raise ValueError("Prompt is required")
        
        # Enhance prompt for code generation
        code_prompt = f"Generate code for the following task. Provide only the code without explanations unless specifically asked for comments:\n\n{prompt}"
        
        # Generate code
        response = await self.provider.generate_text(
            prompt=code_prompt,
            task_type=self.config["default_task_types"]["code_generation"],
            **{k: v for k, v in data.items() if k != "prompt"}
        )
        
        return {
            "code": response.text,
            "usage": response.usage,
            "model": response.model
        }
    
    @error_handler(ModelError)
    async def handle_creative_writing(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle creative_writing event
        
        Args:
            data: Event data with prompt and optional parameters
            
        Returns:
            Response with creative text
        """
        prompt = data.get("prompt", "")
        if not prompt:
            raise ValueError("Prompt is required")
        
        # Generate creative text
        response = await self.provider.generate_text(
            prompt=prompt,
            task_type=self.config["default_task_types"]["creative_writing"],
            **{k: v for k, v in data.items() if k != "prompt"}
        )
        
        return {
            "text": response.text,
            "usage": response.usage,
            "model": response.model
        }
    
    @error_handler(ModelError)
    async def handle_reasoning(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle reasoning event
        
        Args:
            data: Event data with prompt and optional parameters
            
        Returns:
            Response with reasoning
        """
        prompt = data.get("prompt", "")
        if not prompt:
            raise ValueError("Prompt is required")
        
        # Enhance prompt for reasoning
        reasoning_prompt = f"Think step by step about the following problem:\n\n{prompt}\n\nReasoning:"
        
        # Generate reasoning
        response = await self.provider.generate_text(
            prompt=reasoning_prompt,
            task_type=self.config["default_task_types"]["reasoning"],
            **{k: v for k, v in data.items() if k != "prompt"}
        )
        
        return {
            "reasoning": response.text,
            "usage": response.usage,
            "model": response.model
        }
    
    @error_handler(ModelError)
    async def handle_get_available_models(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle get_available_models event
        
        Args:
            data: Event data (unused)
            
        Returns:
            Response with available models
        """
        models_info = await self.provider.get_available_models()
        return {"models": models_info}
    
    @error_handler(ModelError)
    async def handle_download_model(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle download_model event
        
        Args:
            data: Event data with tier_id
            
        Returns:
            Response with download status
        """
        tier_id = data.get("tier_id")
        if not tier_id:
            raise ValueError("tier_id is required")
        
        result = await self.provider.download_model(tier_id=tier_id)
        return result
