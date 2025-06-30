"""
Hybrid Retrieval System for ALEJO
Combines RAG (Retrieval-Augmented Generation) and CAG (Context-Augmented Generation)
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Union, Literal
from dataclasses import dataclass
import time
import json

from ...core.event_bus import EventBus
from ...llm_client.base import BaseLLMClient, LLMResponse
from ...llm_client.factory import LLMClientFactory
from ...database.memory_store import MemoryStore
from ..memory.semantic_memory import SemanticMemory
from .rag_system import RAGSystem, RAGConfig, RetrievalResult
from .cag_system import CAGSystem, CAGConfig
from .cloud_cache import CloudCache

logger = logging.getLogger(__name__)

# Define retrieval modes
RetrievalMode = Literal["rag", "cag", "hybrid", "auto"]

@dataclass
class HybridConfig:
    """Configuration for the hybrid retrieval system"""
    default_mode: RetrievalMode = "auto"
    rag_config: Optional[RAGConfig] = None
    cag_config: Optional[CAGConfig] = None
    hybrid_weight_rag: float = 0.5  # Weight for RAG in hybrid mode (0-1)
    auto_selection_threshold: float = 0.6  # Threshold for auto mode selection
    use_cloud_cache: bool = False
    cache_path: str = str(os.path.expanduser("~/.alejo/cache/hybrid"))
    
    def __post_init__(self):
        """Initialize default configs if not provided"""
        self.rag_config = self.rag_config or RAGConfig()
        self.cag_config = self.cag_config or CAGConfig()
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)

class HybridRetrievalSystem:
    """
    Hybrid Retrieval System
    Combines RAG and CAG approaches for optimal information retrieval and context awareness
    """
    
    def __init__(
        self, 
        event_bus: EventBus,
        memory_store: Optional[MemoryStore] = None,
        semantic_memory: Optional[SemanticMemory] = None,
        llm_client: Optional[BaseLLMClient] = None,
        config: Optional[HybridConfig] = None,
        cloud_cache: Optional[CloudCache] = None
    ):
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.semantic_memory = semantic_memory
        self.llm_client = llm_client or LLMClientFactory.create_client()
        self.config = config or HybridConfig()
        self.cloud_cache = cloud_cache
        
        # Set use_cloud_cache in component configs
        if self.config.rag_config:
            self.config.rag_config.use_cloud_cache = self.config.use_cloud_cache
        if self.config.cag_config:
            self.config.cag_config.use_cloud_cache = self.config.use_cloud_cache
        
        # Initialize subsystems
        self.rag_system = RAGSystem(
            event_bus=self.event_bus,
            memory_store=self.memory_store,
            semantic_memory=self.semantic_memory,
            llm_client=self.llm_client,
            config=self.config.rag_config,
            cloud_cache=self.cloud_cache
        )
        
        self.cag_system = CAGSystem(
            event_bus=self.event_bus,
            llm_client=self.llm_client,
            config=self.config.cag_config,
            cloud_cache=self.cloud_cache
        )
        
        # Current mode and history
        self.current_mode: RetrievalMode = self.config.default_mode
        self.mode_success_rates = {
            "rag": 0.5,  # Start with neutral values
            "cag": 0.5,
            "hybrid": 0.5
        }
        
        # Register event handlers
        self.event_bus.subscribe("hybrid_retrieval.query", self._handle_query)
        self.event_bus.subscribe("hybrid_retrieval.set_mode", self._handle_set_mode)
        self.event_bus.subscribe("hybrid_retrieval.feedback", self._handle_feedback)
    
    async def determine_best_mode(self, query: str) -> RetrievalMode:
        """
        Determine best retrieval mode for the query
        
        In production, this would use a more sophisticated algorithm based on:
        1. Query characteristics (length, complexity, topic)
        2. Historical success rates with similar queries
        3. Available context and knowledge
        """
        if self.current_mode != "auto":
            return self.current_mode
            
        try:
            # Simple heuristic for demonstration
            # Check if query is context-dependent
            context_indicators = ["previous", "earlier", "last time", "you said",
                                 "continue", "follow up", "remember when"]
            
            has_context_indicators = any(i in query.lower() for i in context_indicators)
            
            # Check if query is knowledge-dependent
            knowledge_indicators = ["what is", "how does", "explain", "define",
                                   "who", "when", "where", "history", "facts about"]
                                   
            has_knowledge_indicators = any(i in query.lower() for i in knowledge_indicators)
            
            # Make decision based on indicators
            if has_context_indicators and not has_knowledge_indicators:
                # Context-heavy query
                return "cag" if self.mode_success_rates["cag"] > self.config.auto_selection_threshold else "hybrid"
            elif has_knowledge_indicators and not has_context_indicators:
                # Knowledge-heavy query
                return "rag" if self.mode_success_rates["rag"] > self.config.auto_selection_threshold else "hybrid"
            else:
                # Mixed or unclear query
                # Choose mode with highest success rate
                best_mode = max(self.mode_success_rates.items(), key=lambda x: x[1])
                return best_mode[0] if best_mode[1] > self.config.auto_selection_threshold else "hybrid"
                
        except Exception as e:
            logger.error(f"Error determining retrieval mode: {e}")
            return "hybrid"  # Safe default
    
    async def generate_response(self, query: str, mode: Optional[RetrievalMode] = None) -> LLMResponse:
        """
        Generate response using the specified or auto-selected retrieval mode
        
        Args:
            query: The user query
            mode: Optional mode override
            
        Returns:
            LLMResponse with content and metadata
        """
        use_mode = mode or await self.determine_best_mode(query)
        
        # Add mode to event bus for monitoring
        await self.event_bus.publish("metrics.retrieval_mode", {
            "mode": use_mode,
            "query": query,
            "timestamp": time.time()
        })
        
        try:
            response = None
            start_time = time.time()
            
            if use_mode == "rag":
                # Use RAG only
                response = await self.rag_system.generate_with_rag(query)
                
                # Still add to CAG context for future reference
                if response:
                    self.cag_system.add_context(query, "user", "hybrid_rag_query")
                    self.cag_system.add_context(response.content, "assistant", "hybrid_rag_response")
                    
            elif use_mode == "cag":
                # Use CAG only
                response = await self.cag_system.generate_with_cag(query)
                
                # Still capture in RAG if useful information
                if response and len(query) > 10:
                    asyncio.create_task(self.rag_system.add_document(
                        content=f"Q: {query}\nA: {response.content}",
                        source="hybrid_cag_qa",
                        metadata={"query": query, "timestamp": time.time()}
                    ))
                    
            elif use_mode == "hybrid":
                # Use both with weighted combination
                # Get augmented prompts from both systems
                rag_prompt = await self.rag_system.augment_prompt(query)
                cag_prompt = await self.cag_system.augment_prompt(query)
                
                # Create hybrid prompt
                weight_rag = self.config.hybrid_weight_rag
                weight_cag = 1.0 - weight_rag
                
                # Extract the RAG context and CAG context
                rag_context = rag_prompt.split(f"respond to: {query}")[0] if f"respond to: {query}" in rag_prompt else ""
                cag_context = cag_prompt.split(f"respond to: {query}")[0] if f"respond to: {query}" in cag_prompt else ""
                
                hybrid_prompt = "Combine the following two context sources to provide the most helpful response:\n\n"
                
                if weight_rag >= 0.3:
                    hybrid_prompt += f"RETRIEVED INFORMATION ({int(weight_rag*100)}% weight):\n{rag_context}\n\n"
                    
                if weight_cag >= 0.3:
                    hybrid_prompt += f"CONVERSATION CONTEXT ({int(weight_cag*100)}% weight):\n{cag_context}\n\n"
                    
                hybrid_prompt += f"Based on the above weighted information sources, please respond to: {query}"
                
                # Generate response
                response = await self.llm_client.generate_text(hybrid_prompt)
                
                # Update both systems with the response
                if response:
                    self.cag_system.add_context(query, "user", "hybrid_query")
                    self.cag_system.add_context(response.content, "assistant", "hybrid_response")
                    
                    asyncio.create_task(self.rag_system.add_document(
                        content=f"Q: {query}\nA: {response.content}",
                        source="hybrid_qa",
                        metadata={"query": query, "timestamp": time.time()}
                    ))
            
            # Fallback to direct generation if something went wrong
            if not response:
                logger.warning(f"Fallback to direct generation for mode {use_mode}")
                response = await self.llm_client.generate_text(query)
                
            # Add metadata about the retrieval process
            elapsed_time = time.time() - start_time
            if response:
                if not response.metadata:
                    response.metadata = {}
                    
                response.metadata.update({
                    "retrieval_mode": use_mode,
                    "retrieval_time": elapsed_time,
                    "hybrid_weight_rag": self.config.hybrid_weight_rag if use_mode == "hybrid" else None
                })
                
            return response
                
        except Exception as e:
            logger.error(f"Error generating response with mode {use_mode}: {e}")
            # Final fallback
            return await self.llm_client.generate_text(query)
    
    def set_mode(self, mode: RetrievalMode) -> bool:
        """Set the retrieval mode"""
        if mode not in ["rag", "cag", "hybrid", "auto"]:
            return False
            
        self.current_mode = mode
        logger.info(f"Set retrieval mode to {mode}")
        return True
    
    def update_success_rate(self, mode: RetrievalMode, success: bool, magnitude: float = 0.1):
        """Update success rate for a mode based on feedback"""
        if mode not in self.mode_success_rates:
            return
            
        # Get current rate
        current_rate = self.mode_success_rates[mode]
        
        # Update with exponential moving average
        if success:
            # Increase success rate
            new_rate = current_rate + magnitude * (1 - current_rate)
        else:
            # Decrease success rate
            new_rate = current_rate - magnitude * current_rate
            
        # Ensure rate stays in [0.1, 0.99] range
        self.mode_success_rates[mode] = max(0.1, min(0.99, new_rate))
        
        logger.info(f"Updated success rate for {mode}: {current_rate:.2f} -> {self.mode_success_rates[mode]:.2f}")
    
    async def sync_with_semantic_memory(self) -> bool:
        """Sync RAG with semantic memory"""
        return await self.rag_system.sync_with_semantic_memory()
    
    async def _handle_query(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle hybrid retrieval query event"""
        query = data.get('query')
        mode = data.get('mode')
        
        if not query:
            return {'error': 'Missing query parameter'}
            
        response = await self.generate_response(query, mode)
        return {
            'response': response.content,
            'model': response.model,
            'usage': response.usage,
            'metadata': response.metadata
        }
    
    async def _handle_set_mode(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle set mode event"""
        mode = data.get('mode')
        
        if not mode:
            return {'error': 'Missing mode parameter'}
            
        success = self.set_mode(mode)
        return {'success': success, 'mode': self.current_mode}
    
    async def _handle_feedback(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle feedback event"""
        mode = data.get('mode')
        success = data.get('success')
        magnitude = data.get('magnitude', 0.1)
        
        if mode is None or success is None:
            return {'error': 'Missing mode or success parameter'}
            
        self.update_success_rate(mode, success, magnitude)
        return {'success': True, 'updated_rate': self.mode_success_rates.get(mode)}
