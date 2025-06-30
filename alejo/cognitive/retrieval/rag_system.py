"""
RAG (Retrieval-Augmented Generation) System for ALEJO
Enhances LLM responses with relevant information from semantic memory
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Union, Tuple
import numpy as np
from dataclasses import dataclass
from pathlib import Path
import faiss
import pickle
import time
import json
from datetime import datetime

from ...core.event_bus import EventBus
from ...database.memory_store import MemoryStore
from ...llm_client.base import BaseLLMClient, LLMResponse
from ...llm_client.factory import LLMClientFactory
from ..memory.semantic_memory import SemanticMemory
from .cloud_cache import CloudCache

logger = logging.getLogger(__name__)

@dataclass
class RetrievalResult:
    """Container for retrieval results"""
    content: str
    source: str
    relevance: float
    metadata: Dict[str, Any]
    timestamp: float

@dataclass
class RAGConfig:
    """Configuration for the RAG system"""
    vector_dim: int = 768  # Default embedding dimension
    top_k: int = 5  # Number of items to retrieve
    relevance_threshold: float = 0.6  # Minimum relevance score to include
    index_path: str = str(Path.home() / ".alejo" / "cache" / "rag_index")
    cache_size_mb: int = 500  # Default local cache size in MB
    use_cloud_cache: bool = False
    
    def __post_init__(self):
        """Create necessary directories"""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)

class RAGSystem:
    """
    Retrieval-Augmented Generation System
    Enhances LLM responses with relevant information from different sources
    """
    
    def __init__(
        self, 
        event_bus: EventBus,
        memory_store: Optional[MemoryStore] = None,
        semantic_memory: Optional[SemanticMemory] = None,
        llm_client: Optional[BaseLLMClient] = None,
        config: Optional[RAGConfig] = None,
        cloud_cache: Optional[CloudCache] = None
    ):
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.semantic_memory = semantic_memory
        self.llm_client = llm_client or LLMClientFactory.create_client()
        self.config = config or RAGConfig()
        self.cloud_cache = cloud_cache
        
        # Initialize vector index
        self.index = None
        self.document_map = {}  # Maps index IDs to document content
        self.last_index_update = 0
        
        # Initialize system
        self._initialize()
        
        # Register event handlers
        self.event_bus.subscribe("retrieval.query", self._handle_query_request)
        self.event_bus.subscribe("knowledge.learn", self._handle_knowledge_update)
        
    def _initialize(self):
        """Initialize the RAG system"""
        try:
            self._load_or_create_index()
        except Exception as e:
            logger.error(f"Failed to initialize RAG system: {e}")
            # Create empty index as fallback
            self._create_empty_index()
    
    def _load_or_create_index(self):
        """Load existing index or create a new one"""
        index_file = f"{self.config.index_path}.faiss"
        map_file = f"{self.config.index_path}.pickle"
        
        # Try cloud cache first if enabled
        if self.config.use_cloud_cache and self.cloud_cache:
            try:
                logger.info("Attempting to load index from cloud cache")
                cloud_index_file = "rag_index.faiss"
                cloud_map_file = "rag_index.pickle"
                
                if self.cloud_cache.exists(cloud_index_file) and self.cloud_cache.exists(cloud_map_file):
                    # Download from cloud
                    self.cloud_cache.download(cloud_index_file, index_file)
                    self.cloud_cache.download(cloud_map_file, map_file)
                    logger.info("Successfully loaded index from cloud cache")
            except Exception as e:
                logger.warning(f"Failed to load index from cloud cache: {e}")
        
        # Try local files
        if os.path.exists(index_file) and os.path.exists(map_file):
            try:
                self.index = faiss.read_index(index_file)
                with open(map_file, 'rb') as f:
                    self.document_map = pickle.load(f)
                self.last_index_update = os.path.getmtime(index_file)
                logger.info(f"Loaded existing RAG index with {self.index.ntotal} vectors")
                return
            except Exception as e:
                logger.warning(f"Failed to load existing index: {e}")
                
        # Create new index if loading failed
        self._create_empty_index()
    
    def _create_empty_index(self):
        """Create a new empty index"""
        self.index = faiss.IndexFlatL2(self.config.vector_dim)
        self.document_map = {}
        self.last_index_update = time.time()
        logger.info("Created new empty RAG index")
    
    def _save_index(self):
        """Save index to disk"""
        try:
            index_file = f"{self.config.index_path}.faiss"
            map_file = f"{self.config.index_path}.pickle"
            
            # Save locally first
            faiss.write_index(self.index, index_file)
            with open(map_file, 'wb') as f:
                pickle.dump(self.document_map, f)
            
            self.last_index_update = time.time()
            logger.info(f"Saved RAG index with {self.index.ntotal} vectors")
            
            # Upload to cloud if enabled
            if self.config.use_cloud_cache and self.cloud_cache:
                try:
                    logger.info("Uploading index to cloud cache")
                    self.cloud_cache.upload(index_file, "rag_index.faiss")
                    self.cloud_cache.upload(map_file, "rag_index.pickle")
                    logger.info("Successfully uploaded index to cloud cache")
                except Exception as e:
                    logger.warning(f"Failed to upload index to cloud cache: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to save index: {e}")
    
    async def _generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for text using LLM client"""
        try:
            embeddings = await self.llm_client.generate_embeddings([text])
            return np.array(embeddings[0], dtype=np.float32)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            # Return zero vector as fallback
            return np.zeros(self.config.vector_dim, dtype=np.float32)
    
    async def add_document(self, content: str, source: str, metadata: Dict[str, Any] = None):
        """Add a document to the RAG index"""
        try:
            # Generate embedding
            embedding = await self._generate_embedding(content)
            
            # Add to index
            index_id = self.index.ntotal
            self.index.add(embedding.reshape(1, -1))
            
            # Store document mapping
            self.document_map[index_id] = {
                'content': content,
                'source': source,
                'metadata': metadata or {},
                'timestamp': time.time()
            }
            
            # Save periodically
            if index_id % 10 == 0:
                self._save_index()
                
            logger.info(f"Added document to RAG index from source: {source}")
            return True
        except Exception as e:
            logger.error(f"Failed to add document to RAG index: {e}")
            return False
    
    async def retrieve(self, query: str, top_k: Optional[int] = None) -> List[RetrievalResult]:
        """Retrieve relevant documents for a query"""
        try:
            k = top_k or self.config.top_k
            
            # Generate query embedding
            query_embedding = await self._generate_embedding(query)
            
            # Search index
            if self.index.ntotal == 0:
                return []
                
            distances, indices = self.index.search(query_embedding.reshape(1, -1), min(k, self.index.ntotal))
            
            # Process results
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < 0:  # Invalid index
                    continue
                    
                # Calculate relevance score (convert distance to similarity)
                distance = distances[0][i]
                relevance = max(0, 1 - distance / 10)  # Normalize to [0,1]
                
                # Skip if below threshold
                if relevance < self.config.relevance_threshold:
                    continue
                
                # Get document data
                doc_data = self.document_map[int(idx)]
                
                results.append(RetrievalResult(
                    content=doc_data['content'],
                    source=doc_data['source'],
                    relevance=float(relevance),
                    metadata=doc_data['metadata'],
                    timestamp=doc_data['timestamp']
                ))
                
            return results
            
        except Exception as e:
            logger.error(f"Failed to retrieve documents: {e}")
            return []
    
    async def augment_prompt(self, prompt: str) -> str:
        """Augment prompt with relevant retrieved information"""
        try:
            # Retrieve relevant documents
            retrieved = await self.retrieve(prompt)
            
            if not retrieved:
                return prompt
                
            # Format retrieved information
            context = "\n---\nRelevant information:\n"
            for result in retrieved:
                context += f"[Source: {result.source}, Relevance: {result.relevance:.2f}]\n{result.content}\n\n"
            context += "---\n"
            
            # Combine with original prompt
            augmented_prompt = f"{context}\nUsing the information above if relevant, please respond to: {prompt}"
            
            return augmented_prompt
            
        except Exception as e:
            logger.error(f"Failed to augment prompt: {e}")
            return prompt
    
    async def generate_with_rag(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate response using RAG-augmented prompt"""
        try:
            augmented_prompt = await self.augment_prompt(prompt)
            return await self.llm_client.generate_text(augmented_prompt, **kwargs)
        except Exception as e:
            logger.error(f"Failed to generate with RAG: {e}")
            # Fallback to regular generation
            return await self.llm_client.generate_text(prompt, **kwargs)
    
    async def _handle_query_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle retrieval query event"""
        query = data.get('query')
        if not query:
            return {'error': 'Missing query parameter'}
            
        response = await self.generate_with_rag(query)
        return {
            'response': response.content,
            'model': response.model,
            'usage': response.usage
        }
    
    async def _handle_knowledge_update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle knowledge update event"""
        content = data.get('content')
        source = data.get('source', 'knowledge_update')
        metadata = data.get('metadata', {})
        
        if not content:
            return {'error': 'Missing content parameter'}
            
        success = await self.add_document(content, source, metadata)
        return {'success': success}
        
    async def sync_with_semantic_memory(self):
        """Sync RAG index with semantic memory contents"""
        if not self.semantic_memory:
            logger.warning("Cannot sync with semantic memory: not initialized")
            return False
            
        try:
            # Get all concepts from semantic memory
            concepts = await self.semantic_memory.get_all_concepts()
            
            # Add each concept to RAG index
            added_count = 0
            for concept in concepts:
                # Format concept as document
                content = f"Concept: {concept.name}\n"
                content += f"Attributes: {json.dumps(concept.attributes, indent=2)}\n"
                content += f"Relationships: {json.dumps(concept.relationships, indent=2)}"
                
                # Add to RAG
                success = await self.add_document(
                    content=content,
                    source=f"semantic_memory_{concept.name}",
                    metadata={
                        'type': 'concept',
                        'name': concept.name,
                        'confidence': concept.confidence,
                        'source': concept.source
                    }
                )
                
                if success:
                    added_count += 1
            
            logger.info(f"Synced {added_count} concepts from semantic memory to RAG index")
            
            # Save index after sync
            self._save_index()
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync with semantic memory: {e}")
            return False
    
    async def manage_cache_size(self):
        """Manage cache size to stay within limits"""
        try:
            # Check local cache size
            index_file = f"{self.config.index_path}.faiss"
            map_file = f"{self.config.index_path}.pickle"
            
            if os.path.exists(index_file) and os.path.exists(map_file):
                total_size_mb = (os.path.getsize(index_file) + os.path.getsize(map_file)) / (1024 * 1024)
                
                if total_size_mb > self.config.cache_size_mb:
                    logger.warning(f"Cache size ({total_size_mb:.2f}MB) exceeds limit ({self.config.cache_size_mb}MB)")
                    
                    # If cloud cache is available, prioritize keeping recent items and offloading the rest
                    if self.config.use_cloud_cache and self.cloud_cache:
                        # Strategy: Create a pruned index with only the most recent and relevant items
                        # This is a simplified implementation - a real one would be more sophisticated
                        
                        # For now, we'll just rebuild the index keeping only the most recent items
                        # Sort document map by timestamp
                        sorted_docs = sorted(
                            self.document_map.items(), 
                            key=lambda x: x[1]['timestamp'], 
                            reverse=True
                        )
                        
                        # Calculate how many items to keep (approximately half)
                        keep_count = len(sorted_docs) // 2
                        
                        # Create new index
                        new_index = faiss.IndexFlatL2(self.config.vector_dim)
                        new_doc_map = {}
                        
                        # Add most recent items to new index
                        for i, (old_id, doc) in enumerate(sorted_docs[:keep_count]):
                            # We need to retrieve the vector from the old index
                            # This is inefficient but works for this example
                            # In a real implementation, we would store the vectors separately
                            embedding = await self._generate_embedding(doc['content'])
                            new_index.add(embedding.reshape(1, -1))
                            new_doc_map[i] = doc
                        
                        # Replace old index with new one
                        self.index = new_index
                        self.document_map = new_doc_map
                        
                        # Save the pruned index
                        self._save_index()
                        
                        logger.info(f"Pruned cache from {len(sorted_docs)} to {keep_count} items")
                    
            return True
        
        except Exception as e:
            logger.error(f"Failed to manage cache size: {e}")
            return False
