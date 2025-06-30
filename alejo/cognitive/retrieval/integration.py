"""
Integration module for connecting the Hybrid Retrieval System to ALEJO Brain
"""

import os
import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
import json
import time

from ...core.event_bus import EventBus
from ...database.memory_store import MemoryStore
from ...llm_client.factory import LLMClientFactory
from ..memory.semantic_memory import SemanticMemory
from .rag_system import RAGSystem, RAGConfig
from .cag_system import CAGSystem, CAGConfig
from .hybrid_retrieval import HybridRetrievalSystem, HybridConfig, RetrievalMode
from .cloud_cache import CloudCache, CloudCacheConfig, CloudStorageProvider

logger = logging.getLogger(__name__)

class RetrievalIntegration:
    """
    Integration class for connecting the Hybrid Retrieval System to ALEJO Brain
    
    This class serves as the main interface for the brain to leverage
    both RAG and CAG capabilities through a unified API.
    """
    
    def __init__(
        self, 
        event_bus: EventBus,
        memory_store: Optional[MemoryStore] = None,
        semantic_memory: Optional[SemanticMemory] = None,
        config_path: Optional[str] = None
    ):
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.semantic_memory = semantic_memory
        self.config_path = config_path or os.path.expanduser("~/.alejo/config/retrieval_config.json")
        
        # Load configuration
        self.config = self._load_config()
        
        # Initialize components
        self.llm_client = LLMClientFactory.create_client()
        self.cloud_cache = self._initialize_cloud_cache()
        self.hybrid_system = self._initialize_hybrid_system()
        
        # Register event handlers
        self._register_event_handlers()
        
        logger.info("Retrieval integration initialized")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        default_config = {
            "retrieval_mode": "auto",
            "rag": {
                "vector_dim": 768,
                "top_k": 5,
                "relevance_threshold": 0.6,
                "index_path": os.path.expanduser("~/.alejo/cache/rag_index"),
                "cache_size_mb": 500
            },
            "cag": {
                "max_context_items": 20,
                "max_tokens": 6000,
                "cache_path": os.path.expanduser("~/.alejo/cache/cag_context")
            },
            "hybrid": {
                "hybrid_weight_rag": 0.5,
                "auto_selection_threshold": 0.6
            },
            "cloud_cache": {
                "enabled": True,
                "provider": "local",
                "max_cache_size_mb": 1000,
                "sync_interval_seconds": 300
            }
        }
        
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    loaded_config = json.load(f)
                    
                # Merge with defaults
                for section in default_config:
                    if section in loaded_config and isinstance(loaded_config[section], dict):
                        default_config[section].update(loaded_config[section])
                    elif section in loaded_config:
                        default_config[section] = loaded_config[section]
                
                logger.info(f"Loaded retrieval configuration from {self.config_path}")
                return default_config
        except Exception as e:
            logger.error(f"Failed to load retrieval configuration: {e}")
        
        # Save default config if no config exists
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            logger.info(f"Created default retrieval configuration at {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save default retrieval configuration: {e}")
        
        return default_config
    
    def _initialize_cloud_cache(self) -> CloudCache:
        """Initialize cloud cache based on configuration"""
        cache_config = self.config.get("cloud_cache", {})
        
        # Map provider string to enum
        provider_map = {
            "google_drive": CloudStorageProvider.GOOGLE_DRIVE,
            "dropbox": CloudStorageProvider.DROPBOX,
            "onedrive": CloudStorageProvider.ONEDRIVE,
            "local": CloudStorageProvider.LOCAL
        }
        
        provider_str = cache_config.get("provider", "local")
        provider = provider_map.get(provider_str, CloudStorageProvider.LOCAL)
        
        config = CloudCacheConfig(
            provider=provider,
            cache_dir=os.path.expanduser("~/.alejo/cloud_cache"),
            credentials_path=cache_config.get("credentials_path"),
            max_cache_size_mb=cache_config.get("max_cache_size_mb", 1000),
            sync_interval_seconds=cache_config.get("sync_interval_seconds", 300),
            enabled=cache_config.get("enabled", True)
        )
        
        return CloudCache(config)
    
    def _initialize_hybrid_system(self) -> HybridRetrievalSystem:
        """Initialize the hybrid retrieval system"""
        # Create RAG config
        rag_config = RAGConfig(
            vector_dim=self.config["rag"].get("vector_dim", 768),
            top_k=self.config["rag"].get("top_k", 5),
            relevance_threshold=self.config["rag"].get("relevance_threshold", 0.6),
            index_path=self.config["rag"].get("index_path"),
            cache_size_mb=self.config["rag"].get("cache_size_mb", 500),
            use_cloud_cache=self.config["cloud_cache"].get("enabled", True)
        )
        
        # Create CAG config
        cag_config = CAGConfig(
            max_context_items=self.config["cag"].get("max_context_items", 20),
            max_tokens=self.config["cag"].get("max_tokens", 6000),
            cache_path=self.config["cag"].get("cache_path")
        )
        
        # Create hybrid config
        hybrid_config = HybridConfig(
            default_mode=self.config.get("retrieval_mode", "auto"),
            rag_config=rag_config,
            cag_config=cag_config,
            hybrid_weight_rag=self.config["hybrid"].get("hybrid_weight_rag", 0.5),
            auto_selection_threshold=self.config["hybrid"].get("auto_selection_threshold", 0.6),
            use_cloud_cache=self.config["cloud_cache"].get("enabled", True)
        )
        
        # Create hybrid system
        return HybridRetrievalSystem(
            event_bus=self.event_bus,
            memory_store=self.memory_store,
            semantic_memory=self.semantic_memory,
            llm_client=self.llm_client,
            config=hybrid_config,
            cloud_cache=self.cloud_cache
        )
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("brain.query", self._handle_brain_query)
        self.event_bus.subscribe("brain.learn", self._handle_brain_learn)
        self.event_bus.subscribe("retrieval.set_mode", self._handle_set_mode)
        self.event_bus.subscribe("retrieval.sync_memory", self._handle_sync_memory)
    
    async def _handle_brain_query(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain query event"""
        query = data.get("query")
        mode = data.get("retrieval_mode")
        
        if not query:
            return {"error": "Missing query parameter"}
        
        try:
            # Generate response using hybrid system
            response = await self.hybrid_system.generate_response(query, mode)
            
            return {
                "response": response.content,
                "model": response.model,
                "usage": response.usage,
                "metadata": {
                    "retrieval_mode": response.metadata.get("retrieval_mode"),
                    "retrieval_time": response.metadata.get("retrieval_time")
                }
            }
        except Exception as e:
            logger.error(f"Error handling brain query: {e}")
            return {"error": f"Failed to process query: {str(e)}"}
    
    async def _handle_brain_learn(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain learn event"""
        content = data.get("content")
        source = data.get("source", "brain")
        metadata = data.get("metadata", {})
        
        if not content:
            return {"error": "Missing content parameter"}
        
        try:
            # Add to RAG system
            success = await self.hybrid_system.rag_system.add_document(
                content=content,
                source=source,
                metadata=metadata
            )
            
            # Also add to CAG context if it's a conversation
            if source in ["conversation", "user_input", "assistant_response"]:
                role = "user" if source == "user_input" else "assistant"
                self.hybrid_system.cag_system.add_context(
                    content=content,
                    role=role,
                    source=source,
                    metadata=metadata
                )
            
            return {"success": success}
        except Exception as e:
            logger.error(f"Error handling brain learn: {e}")
            return {"error": f"Failed to learn content: {str(e)}"}
    
    async def _handle_set_mode(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle set mode event"""
        mode = data.get("mode")
        
        if not mode:
            return {"error": "Missing mode parameter"}
        
        try:
            # Set mode in hybrid system
            success = self.hybrid_system.set_mode(mode)
            
            if success:
                # Update config
                self.config["retrieval_mode"] = mode
                self._save_config()
            
            return {"success": success, "mode": self.hybrid_system.current_mode}
        except Exception as e:
            logger.error(f"Error handling set mode: {e}")
            return {"error": f"Failed to set mode: {str(e)}"}
    
    async def _handle_sync_memory(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle sync memory event"""
        try:
            # Sync RAG with semantic memory
            success = await self.hybrid_system.sync_with_semantic_memory()
            return {"success": success}
        except Exception as e:
            logger.error(f"Error handling sync memory: {e}")
            return {"error": f"Failed to sync memory: {str(e)}"}
    
    def _save_config(self):
        """Save current configuration to file"""
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            logger.info(f"Saved retrieval configuration to {self.config_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save retrieval configuration: {e}")
            return False
    
    async def initialize_from_memory(self) -> bool:
        """Initialize retrieval systems from existing memory"""
        try:
            if self.semantic_memory:
                # Sync with semantic memory
                await self.hybrid_system.sync_with_semantic_memory()
                
            if self.memory_store:
                # Get recent memories
                memories = await self.memory_store.get_recent_memories(limit=100)
                
                # Add to RAG and CAG
                for memory in memories:
                    await self.hybrid_system.rag_system.add_document(
                        content=memory.content,
                        source=f"memory_{memory.memory_type}",
                        metadata={
                            "memory_id": memory.id,
                            "memory_type": memory.memory_type,
                            "timestamp": memory.timestamp
                        }
                    )
            
            return True
        except Exception as e:
            logger.error(f"Error initializing from memory: {e}")
            return False
    
    def shutdown(self):
        """Shutdown the retrieval integration"""
        try:
            # Save any pending changes
            self._save_config()
            
            # Shutdown cloud cache
            if self.cloud_cache:
                self.cloud_cache.shutdown()
                
            logger.info("Retrieval integration shutdown complete")
        except Exception as e:
            logger.error(f"Error during retrieval integration shutdown: {e}")
            
    async def query(self, query_text: str, mode: Optional[RetrievalMode] = None) -> Dict[str, Any]:
        """
        Direct query method for use by the brain
        
        Args:
            query_text: The query text
            mode: Optional retrieval mode override
            
        Returns:
            Dictionary with response and metadata
        """
        try:
            response = await self.hybrid_system.generate_response(query_text, mode)
            
            return {
                "content": response.content,
                "model": response.model,
                "retrieval_mode": response.metadata.get("retrieval_mode"),
                "retrieval_time": response.metadata.get("retrieval_time")
            }
        except Exception as e:
            logger.error(f"Error in direct query: {e}")
            return {
                "content": f"Error processing query: {str(e)}",
                "error": str(e)
            }
    
    async def learn(self, content: str, source: str, metadata: Dict[str, Any] = None) -> bool:
        """
        Direct learn method for use by the brain
        
        Args:
            content: The content to learn
            source: Source of the content
            metadata: Optional metadata
            
        Returns:
            Success status
        """
        try:
            return await self.hybrid_system.rag_system.add_document(
                content=content,
                source=source,
                metadata=metadata or {}
            )
        except Exception as e:
            logger.error(f"Error in direct learn: {e}")
            return False
