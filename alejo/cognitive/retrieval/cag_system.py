"""
CAG (Context-Augmented Generation) System for ALEJO
Enhances LLM responses by maintaining rich contextual awareness
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Union, Tuple, Deque
from collections import deque
from dataclasses import dataclass
import time
import json
from datetime import datetime

from ...core.event_bus import EventBus
from ...llm_client.base import BaseLLMClient, LLMResponse
from ...llm_client.factory import LLMClientFactory
from .cloud_cache import CloudCache

logger = logging.getLogger(__name__)

@dataclass
class ContextItem:
    """A single item in the context history"""
    content: str
    role: str  # 'system', 'user', 'assistant', or 'context'
    source: str
    importance: float
    timestamp: float
    metadata: Dict[str, Any]

@dataclass
class CAGConfig:
    """Configuration for the CAG system"""
    max_context_items: int = 20  # Maximum items in context window
    max_tokens: int = 6000  # Approximate max token count for context
    recency_weight: float = 0.6  # Weight for recency in importance calculation
    relevance_weight: float = 0.4  # Weight for relevance in importance calculation
    context_decay_rate: float = 0.95  # Rate at which context importance decays
    summary_interval: int = 10  # Number of exchanges before summarizing
    cache_path: str = str(os.path.expanduser("~/.alejo/cache/cag_context"))
    
    def __post_init__(self):
        """Create necessary directories"""
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)

class CAGSystem:
    """
    Context-Augmented Generation System
    Enhances LLM responses by maintaining rich contextual awareness over time
    """
    
    def __init__(
        self, 
        event_bus: EventBus,
        llm_client: Optional[BaseLLMClient] = None,
        config: Optional[CAGConfig] = None,
        cloud_cache: Optional[CloudCache] = None
    ):
        self.event_bus = event_bus
        self.llm_client = llm_client or LLMClientFactory.create_client()
        self.config = config or CAGConfig()
        self.cloud_cache = cloud_cache
        
        # Context window (ordered by importance and recency)
        self.context: List[ContextItem] = []
        self.exchange_count = 0  # Count exchanges for summarization timing
        self.conversation_id = str(int(time.time()))  # Unique ID for this conversation
        
        # Initialize system
        self._initialize()
        
        # Register event handlers
        self.event_bus.subscribe("context.add", self._handle_add_context)
        self.event_bus.subscribe("context.query", self._handle_query_context)
        
    def _initialize(self):
        """Initialize the CAG system"""
        try:
            self._load_context()
        except Exception as e:
            logger.error(f"Failed to initialize CAG system: {e}")
            # Start with empty context as fallback
            self.context = []
    
    def _load_context(self):
        """Load existing context or create new one"""
        context_file = f"{self.config.cache_path}_{self.conversation_id}.json"
        
        # Try cloud cache first if enabled
        if self.cloud_cache:
            try:
                logger.info("Attempting to load context from cloud cache")
                cloud_context_file = f"cag_context_{self.conversation_id}.json"
                
                if self.cloud_cache.exists(cloud_context_file):
                    # Download from cloud
                    self.cloud_cache.download(cloud_context_file, context_file)
                    logger.info("Successfully loaded context from cloud cache")
            except Exception as e:
                logger.warning(f"Failed to load context from cloud cache: {e}")
        
        # Try local file
        if os.path.exists(context_file):
            try:
                with open(context_file, 'r') as f:
                    context_data = json.load(f)
                
                self.context = [
                    ContextItem(**item) for item in context_data['context']
                ]
                self.exchange_count = context_data.get('exchange_count', 0)
                logger.info(f"Loaded existing context with {len(self.context)} items")
                return
            except Exception as e:
                logger.warning(f"Failed to load existing context: {e}")
                
        # Start with empty context if loading failed
        self.context = []
        self.exchange_count = 0
        logger.info("Started with new empty context")
    
    def _save_context(self):
        """Save context to disk"""
        try:
            context_file = f"{self.config.cache_path}_{self.conversation_id}.json"
            
            # Save locally first
            context_data = {
                'context': [
                    {
                        'content': item.content,
                        'role': item.role,
                        'source': item.source,
                        'importance': item.importance,
                        'timestamp': item.timestamp,
                        'metadata': item.metadata
                    }
                    for item in self.context
                ],
                'exchange_count': self.exchange_count,
                'conversation_id': self.conversation_id,
                'last_updated': time.time()
            }
            
            with open(context_file, 'w') as f:
                json.dump(context_data, f, indent=2)
            
            logger.info(f"Saved context with {len(self.context)} items")
            
            # Upload to cloud if enabled
            if self.cloud_cache:
                try:
                    logger.info("Uploading context to cloud cache")
                    cloud_context_file = f"cag_context_{self.conversation_id}.json"
                    self.cloud_cache.upload(context_file, cloud_context_file)
                    logger.info("Successfully uploaded context to cloud cache")
                except Exception as e:
                    logger.warning(f"Failed to upload context to cloud cache: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to save context: {e}")
    
    def _calculate_importance(
        self, 
        content: str, 
        role: str, 
        recency: float = 1.0,
        relevance: float = 0.5
    ) -> float:
        """
        Calculate importance score for a context item
        
        Args:
            content: The content text
            role: The role of the content provider
            recency: Recency factor (1.0 is most recent, decreases with age)
            relevance: Relevance to current query (0.0-1.0)
            
        Returns:
            Importance score (0.0-1.0)
        """
        # Base importance by role
        role_importance = {
            'system': 0.9,
            'user': 0.8, 
            'assistant': 0.7,
            'context': 0.5
        }.get(role, 0.5)
        
        # Calculate combined importance
        recency_component = recency * self.config.recency_weight
        relevance_component = relevance * self.config.relevance_weight
        role_component = role_importance * 0.2  # 20% weight to role
        
        # Combine components (normalized to 0-1)
        importance = recency_component + relevance_component + role_component
        return min(1.0, max(0.0, importance))
    
    def _update_context_importance(self, query: Optional[str] = None):
        """Update importance scores for all context items"""
        # If no items, nothing to do
        if not self.context:
            return
            
        now = time.time()
        newest_timestamp = max(item.timestamp for item in self.context)
        oldest_timestamp = min(item.timestamp for item in self.context)
        time_range = max(1.0, newest_timestamp - oldest_timestamp)
        
        for item in self.context:
            # Calculate recency (normalize to 0-1)
            age = now - item.timestamp
            recency = 1.0 - min(1.0, age / (time_range * 2))
            
            # Calculate relevance if query provided
            relevance = 0.5  # Default middle relevance
            if query:
                # Simple relevance based on term overlap
                # In production, this would use embeddings
                query_terms = set(query.lower().split())
                content_terms = set(item.content.lower().split())
                
                if query_terms and content_terms:
                    overlap = len(query_terms.intersection(content_terms))
                    relevance = min(1.0, overlap / len(query_terms) if query_terms else 0)
            
            # Decay existing importance
            current_importance = item.importance * self.config.context_decay_rate
            
            # Calculate new importance
            new_importance = self._calculate_importance(
                item.content,
                item.role,
                recency,
                relevance
            )
            
            # Update with weighted combination
            item.importance = 0.7 * new_importance + 0.3 * current_importance
    
    def add_context(
        self,
        content: str,
        role: str,
        source: str = "interaction",
        metadata: Dict[str, Any] = None
    ):
        """Add new item to context"""
        if not content or not role:
            return False
            
        # Create context item
        item = ContextItem(
            content=content,
            role=role,
            source=source,
            importance=self._calculate_importance(content, role),
            timestamp=time.time(),
            metadata=metadata or {}
        )
        
        # Add to context
        self.context.append(item)
        
        # Update exchange count
        if role in ('user', 'assistant'):
            self.exchange_count += 1
            
        # Trim context if needed
        self._trim_context()
        
        # Check if summarization is needed
        if self.exchange_count > 0 and self.exchange_count % self.config.summary_interval == 0:
            asyncio.create_task(self._summarize_context())
            
        # Save context periodically
        if self.exchange_count % 3 == 0:
            self._save_context()
            
        return True
    
    def _trim_context(self):
        """Trim context to fit within limits"""
        if len(self.context) <= self.config.max_context_items:
            return
            
        # Update importance scores before trimming
        self._update_context_importance()
        
        # Sort by importance (highest first)
        self.context.sort(key=lambda x: x.importance, reverse=True)
        
        # Keep only the most important items
        self.context = self.context[:self.config.max_context_items]
        
    async def _summarize_context(self):
        """Summarize older context to save space"""
        if len(self.context) < self.config.summary_interval:
            return
            
        try:
            # Identify older items to summarize
            cutoff = len(self.context) // 2
            to_summarize = self.context[:cutoff]
            
            if not to_summarize:
                return
                
            # Format content for summarization
            content_to_summarize = "\n\n".join([
                f"{item.role.upper()}: {item.content}"
                for item in to_summarize
            ])
            
            # Generate summary
            prompt = f"Please summarize the following conversation concisely, " \
                    f"preserving key information, context, and decisions:\n\n" \
                    f"{content_to_summarize}"
                    
            response = await self.llm_client.generate_text(prompt, max_tokens=500)
            
            if response and response.content:
                # Create summary item
                summary_item = ContextItem(
                    content=response.content,
                    role="context",
                    source="summary",
                    importance=0.8,  # High importance for summaries
                    timestamp=time.time(),
                    metadata={
                        "summary_of": [item.source for item in to_summarize],
                        "summary_count": len(to_summarize),
                        "original_timestamps": [item.timestamp for item in to_summarize]
                    }
                )
                
                # Remove summarized items and add summary
                self.context = [summary_item] + self.context[cutoff:]
                
                logger.info(f"Summarized {len(to_summarize)} context items")
                
        except Exception as e:
            logger.error(f"Failed to summarize context: {e}")
    
    def get_context_for_prompt(self, query: Optional[str] = None) -> str:
        """Get formatted context for prompt enhancement"""
        # Update importance based on query
        self._update_context_importance(query)
        
        # Sort by importance
        sorted_context = sorted(self.context, key=lambda x: x.importance, reverse=True)
        
        # Format context
        formatted_context = "Context:\n"
        
        for item in sorted_context:
            formatted_context += f"[{item.role.upper()}] {item.content}\n\n"
            
        return formatted_context
    
    async def augment_prompt(self, prompt: str) -> str:
        """Augment prompt with context"""
        context_str = self.get_context_for_prompt(prompt)
        
        # Add the new user query to context
        self.add_context(
            content=prompt,
            role="user",
            source="query",
            metadata={"timestamp": time.time()}
        )
        
        # Combine with original prompt
        augmented_prompt = f"{context_str}\n---\nBased on the above context, please respond to: {prompt}"
        
        return augmented_prompt
    
    async def generate_with_cag(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate response using CAG-augmented prompt"""
        try:
            augmented_prompt = await self.augment_prompt(prompt)
            response = await self.llm_client.generate_text(augmented_prompt, **kwargs)
            
            # Add assistant response to context
            if response and response.content:
                self.add_context(
                    content=response.content,
                    role="assistant",
                    source="response",
                    metadata={
                        "model": response.model,
                        "usage": response.usage
                    }
                )
                
            return response
            
        except Exception as e:
            logger.error(f"Failed to generate with CAG: {e}")
            # Fallback to regular generation
            return await self.llm_client.generate_text(prompt, **kwargs)
    
    async def _handle_add_context(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle add context event"""
        content = data.get('content')
        role = data.get('role', 'context')
        source = data.get('source', 'event')
        metadata = data.get('metadata', {})
        
        if not content:
            return {'error': 'Missing content parameter'}
            
        success = self.add_context(content, role, source, metadata)
        return {'success': success}
    
    async def _handle_query_context(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle context query event"""
        query = data.get('query')
        if not query:
            return {'error': 'Missing query parameter'}
            
        response = await self.generate_with_cag(query)
        return {
            'response': response.content,
            'model': response.model,
            'usage': response.usage
        }
        
    def new_conversation(self):
        """Start a new conversation context"""
        # Save current context first
        self._save_context()
        
        # Create new conversation
        self.context = []
        self.exchange_count = 0
        self.conversation_id = str(int(time.time()))
        
        logger.info(f"Started new conversation with ID {self.conversation_id}")
        return self.conversation_id
    
    def load_conversation(self, conversation_id: str) -> bool:
        """Load a previous conversation context"""
        old_context = self.context
        old_exchange_count = self.exchange_count
        old_conversation_id = self.conversation_id
        
        try:
            self.conversation_id = conversation_id
            self._load_context()
            
            if not self.context:
                # Failed to load, restore old context
                self.context = old_context
                self.exchange_count = old_exchange_count
                self.conversation_id = old_conversation_id
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to load conversation {conversation_id}: {e}")
            # Restore old context
            self.context = old_context
            self.exchange_count = old_exchange_count
            self.conversation_id = old_conversation_id
            return False
