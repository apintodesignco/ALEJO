"""
Semantic Memory System for ALEJO
Handles storage and retrieval of factual knowledge and conceptual relationships.
"""

from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass
import numpy as np
import logging
from ...core.event_bus import EventBus
from ...database.memory_store import MemoryStore

logger = logging.getLogger(__name__)

from .models import Concept, Relationship

class SemanticMemory:
    """
    Manages semantic knowledge with features essential for AGI:
    - Concept hierarchy
    - Relationship networks
    - Knowledge integration
    - Inference capabilities
    - Confidence tracking
    - Source attribution
    """
    
    def __init__(self, event_bus: EventBus, memory_store: MemoryStore):
        self.event_bus = event_bus
        self.store = memory_store
        self.confidence_threshold = 0.6
        self.similarity_threshold = 0.8
        
        # Register event handlers
        self.event_bus.subscribe("knowledge.learn", self._handle_learn_request)
        self.event_bus.subscribe("knowledge.query", self._handle_query_request)
        
    async def learn_concept(
        self,
        name: str,
        attributes: Dict[str, Any],
        source: str,
        confidence: float = 0.7
    ) -> str:
        """
        Learn a new concept or update existing one
        Returns: concept_id
        """
        try:
            # Check for existing concept
            existing = await self.store.get_concept(name)
            
            if existing:
                # Update existing concept
                updated = self._merge_concept_knowledge(
                    existing,
                    attributes,
                    source,
                    confidence
                )
                concept_id = await self.store.update_concept(updated)
            else:
                # Create new concept
                embedding = self._generate_concept_embedding(name, attributes)
                concept = Concept(
                    name=name,
                    attributes=attributes,
                    relationships={},
                    confidence=confidence,
                    source=source,
                    last_updated=time.time(),
                    embedding=embedding
                )
                concept_id = await self.store.save_concept(concept)
                
            logger.info(f"Learned/updated concept: {name}")
            return concept_id
            
        except Exception as e:
            logger.error(f"Failed to learn concept: {str(e)}")
            raise
            
    async def add_relationship(
        self,
        relationship: str,
        source_concept: str,
        target_concept: str,
        attributes: Dict[str, Any] = None,
        confidence: float = 0.7,
        bidirectional: bool = False
    ):
        """Add a relationship between concepts"""
        try:
            # Verify concepts exist
            source = await self.store.get_concept(source_concept)
            target = await self.store.get_concept(target_concept)
            
            if not (source and target):
                raise ValueError("Both concepts must exist")
                
            # Create relationship
            rel = Relationship(
                type=relationship,
                source_concept=source_concept,
                target_concept=target_concept,
                attributes=attributes or {},
                confidence=confidence,
                bidirectional=bidirectional
            )
            
            # Store relationship
            await self.store.save_relationship(rel)
            
            # Update concept relationships
            source.relationships.setdefault(relationship, []).append(target_concept)
            await self.store.update_concept(source)
            
            if bidirectional:
                target.relationships.setdefault(relationship, []).append(source_concept)
                await self.store.update_concept(target)
                
            logger.info(f"Added relationship: {source_concept} -{relationship}-> {target_concept}")
            
        except Exception as e:
            logger.error(f"Failed to add relationship: {str(e)}")
            raise
            
    async def query_knowledge(
        self,
        query: str,
        context: Dict[str, Any] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Query semantic knowledge
        Returns: List of relevant concepts and their relationships
        """
        try:
            # Generate query embedding
            query_embedding = self._generate_concept_embedding(query, context or {})
            
            # Get candidate concepts
            candidates = await self.store.get_all_concepts()
            
            # Calculate relevance scores
            scored_concepts = [
                (concept, self._calculate_similarity(concept.embedding, query_embedding))
                for concept in candidates
            ]
            
            # Filter and sort by relevance
            relevant_concepts = [
                self._format_concept_result(concept)
                for concept, score in scored_concepts
                if score >= self.similarity_threshold
            ]
            relevant_concepts.sort(key=lambda x: x['confidence'], reverse=True)
            
            return relevant_concepts[:limit]
            
        except Exception as e:
            logger.error(f"Failed to query knowledge: {str(e)}")
            raise
            
    def _merge_concept_knowledge(
        self,
        existing: Concept,
        new_attributes: Dict[str, Any],
        source: str,
        confidence: float
    ) -> Concept:
        """Merge new knowledge into existing concept"""
        # Update attributes with higher confidence information
        for key, value in new_attributes.items():
            if key not in existing.attributes or confidence > existing.confidence:
                existing.attributes[key] = value
                
        # Update metadata
        existing.confidence = max(existing.confidence, confidence)
        existing.source = source if confidence > existing.confidence else existing.source
        existing.last_updated = time.time()
        existing.embedding = self._generate_concept_embedding(
            existing.name,
            existing.attributes
        )
        
        return existing
        
    def _generate_concept_embedding(
        self,
        name: str,
        attributes: Dict[str, Any]
    ) -> np.ndarray:
        """Generate vector embedding for a concept using multiple techniques.
        
        Combines:
        1. Text encoding of concept name
        2. Hierarchical attribute encoding
        3. Contextual relationship encoding
        4. Type-specific feature extraction
        
        Args:
            name: Name of the concept
            attributes: Dictionary of concept attributes
            
        Returns:
            np.ndarray: 256-dimensional embedding vector
        """
        try:
            # Initialize embedding components
            text_embedding = self._encode_text(name)
            attr_embedding = self._encode_attributes(attributes)
            context_embedding = self._encode_context(attributes)
            
            # Combine embeddings with learned weights
            weights = {
                'text': 0.4,
                'attributes': 0.4,
                'context': 0.2
            }
            
            combined_embedding = (
                weights['text'] * text_embedding +
                weights['attributes'] * attr_embedding +
                weights['context'] * context_embedding
            )
            
            # Normalize the final embedding
            normalized = combined_embedding / np.linalg.norm(combined_embedding)
            return normalized
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            # Fallback to simple text encoding if something fails
            return self._encode_text(name)
            
    def _encode_text(self, text: str) -> np.ndarray:
        """Encode text into a vector using character and word-level features."""
        # Initialize a zero vector
        embedding_size = 256
        embedding = np.zeros(embedding_size)
        
        # Character-level encoding
        for i, char in enumerate(text.lower()):
            # Use character ASCII value to influence specific dimensions
            pos = hash(char) % (embedding_size // 4)
            embedding[pos] += ord(char) / 128.0  # Normalize ASCII values
            
        # Word-level encoding
        words = text.split()
        for word in words:
            # Use word hash to influence different dimensions
            word_hash = hash(word) % (embedding_size // 2)
            embedding[embedding_size//4 + word_hash] += 1.0
            
        # Add positional encoding
        for i in range(min(len(text), embedding_size//8)):
            pos = embedding_size//2 + i
            embedding[pos] = (i + 1) / len(text)
            
        return embedding
        
    def _encode_attributes(self, attributes: Dict[str, Any]) -> np.ndarray:
        """Encode concept attributes into a vector representation."""
        embedding_size = 256
        embedding = np.zeros(embedding_size)
        
        # Process each attribute
        for i, (key, value) in enumerate(attributes.items()):
            # Encode attribute key
            key_embedding = self._encode_text(str(key))
            
            # Encode attribute value based on type
            if isinstance(value, (int, float)):
                # Numerical values get direct representation
                pos = hash(key) % (embedding_size // 4)
                embedding[pos] = float(value)
            elif isinstance(value, bool):
                # Boolean values influence specific dimensions
                pos = hash(key) % (embedding_size // 4)
                embedding[pos] = 1.0 if value else -1.0
            elif isinstance(value, str):
                # Text values get encoded and contribute to later dimensions
                value_embedding = self._encode_text(value)
                start_pos = (embedding_size // 2) + (i % (embedding_size // 4))
                end_pos = min(start_pos + 32, embedding_size)
                embedding[start_pos:end_pos] += value_embedding[:end_pos-start_pos]
            elif isinstance(value, (list, set)):
                # Collections get aggregated encoding
                for item in value:
                    item_embedding = self._encode_text(str(item))
                    embedding += item_embedding * 0.1  # Reduced influence for collection items
                    
        return embedding
        
    def _encode_context(self, attributes: Dict[str, Any]) -> np.ndarray:
        """Encode contextual relationships and metadata."""
        embedding_size = 256
        embedding = np.zeros(embedding_size)
        
        # Encode type information if available
        if 'type' in attributes:
            type_embedding = self._encode_text(str(attributes['type']))
            embedding[:64] += type_embedding[:64]
            
        # Encode category hierarchies
        if 'category' in attributes:
            categories = attributes['category']
            if isinstance(categories, str):
                categories = [categories]
            for i, category in enumerate(categories):
                category_embedding = self._encode_text(category)
                start = 64 + (i % 64)
                embedding[start:start+32] += category_embedding[:32]
                
        # Encode temporal aspects if available
        if 'timestamp' in attributes:
            try:
                timestamp = float(attributes['timestamp'])
                # Convert timestamp to periodic signals
                embedding[-64:] += np.sin(np.linspace(0, 10, 64) * timestamp)
            except (ValueError, TypeError):
                pass
                
        return embedding
        
    def _calculate_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray
    ) -> float:
        """Calculate similarity between concept embeddings"""
        return float(np.dot(embedding1, embedding2) / 
               (np.linalg.norm(embedding1) * np.linalg.norm(embedding2)))
        
    def _format_concept_result(self, concept: Concept) -> Dict[str, Any]:
        """Format concept for query results"""
        return {
            'name': concept.name,
            'attributes': concept.attributes,
            'relationships': concept.relationships,
            'confidence': concept.confidence,
            'source': concept.source,
            'last_updated': concept.last_updated
        }
        
    async def _handle_learn_request(self, data: Dict[str, Any]):
        """Handle knowledge learning requests from event bus"""
        await self.learn_concept(
            data['name'],
            data['attributes'],
            data['source'],
            data.get('confidence', 0.7)
        )
        
    async def _handle_query_request(self, data: Dict[str, Any]):
        """Handle knowledge query requests from event bus"""
        results = await self.query_knowledge(
            data['query'],
            data.get('context'),
            data.get('limit', 5)
        )
        await self.event_bus.publish(
            "knowledge.query.result",
            {"results": results}
        )
