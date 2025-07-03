"""
Foundation Facts Database

This module provides a database for storing and managing foundation facts that
serve as the basis for ALEJO's reasoning capabilities. These facts represent
core truths that cannot be overridden and are used to validate new information.

The database supports:
- Adding new facts with source attribution and confidence levels
- Retrieving facts by category, confidence level, or keyword
- Validating new information against existing foundation facts
- Exporting and importing facts for backup and sharing
"""

import json
import os
import datetime
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple, Any, Union
import logging
from pathlib import Path

from alejo.core.events import EventBus
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)

class FactCategory(Enum):
    """Categories for foundation facts"""
    PHYSICAL = "physical"           # Physical laws, properties of matter
    MATHEMATICAL = "mathematical"    # Mathematical truths and axioms
    LOGICAL = "logical"             # Logical principles and rules
    TEMPORAL = "temporal"           # Time-related facts
    ETHICAL = "ethical"             # Ethical principles
    LINGUISTIC = "linguistic"       # Language rules and definitions
    COMMON_SENSE = "common_sense"   # Widely accepted common sense
    DOMAIN_SPECIFIC = "domain"      # Domain-specific knowledge


class FactSource(Enum):
    """Sources for foundation facts"""
    SYSTEM = "system"               # Built-in system knowledge
    EXPERT = "expert"               # Verified by domain experts
    SCIENTIFIC = "scientific"       # Based on scientific consensus
    LOGICAL_DERIVATION = "derived"  # Derived from other facts
    USER_VERIFIED = "user"          # Verified by the user


class FoundationFact:
    """
    Represents a single foundation fact in the knowledge base
    """
    def __init__(
        self,
        fact_id: str,
        statement: str,
        category: FactCategory,
        source: FactSource,
        confidence: float,
        related_facts: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime.datetime] = None,
        updated_at: Optional[datetime.datetime] = None
    ):
        """
        Initialize a foundation fact
        
        Args:
            fact_id: Unique identifier for the fact
            statement: The fact statement in natural language
            category: Category of the fact
            source: Source of the fact
            confidence: Confidence level (0.0 to 1.0)
            related_facts: List of related fact IDs
            metadata: Additional metadata about the fact
            created_at: Creation timestamp
            updated_at: Last update timestamp
        """
        self.fact_id = fact_id
        self.statement = statement
        self.category = category
        self.source = source
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.related_facts = related_facts or []
        self.metadata = metadata or {}
        self.created_at = created_at or datetime.datetime.now()
        self.updated_at = updated_at or self.created_at
        
        # Keywords extracted from the statement for faster searching
        self.keywords = self._extract_keywords(statement)
    
    def _extract_keywords(self, statement: str) -> Set[str]:
        """Extract keywords from the statement for search indexing"""
        # Simple implementation - split by spaces and remove common words
        common_words = {"a", "an", "the", "is", "are", "in", "on", "at", "by", "for", "with", "about"}
        words = statement.lower().split()
        return {word for word in words if word not in common_words and len(word) > 2}
    
    def update(self, **kwargs) -> None:
        """Update fact attributes"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert fact to dictionary for serialization"""
        return {
            "fact_id": self.fact_id,
            "statement": self.statement,
            "category": self.category.value,
            "source": self.source.value,
            "confidence": self.confidence,
            "related_facts": self.related_facts,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "keywords": list(self.keywords)
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FoundationFact':
        """Create fact from dictionary"""
        return cls(
            fact_id=data["fact_id"],
            statement=data["statement"],
            category=FactCategory(data["category"]),
            source=FactSource(data["source"]),
            confidence=data["confidence"],
            related_facts=data.get("related_facts", []),
            metadata=data.get("metadata", {}),
            created_at=datetime.datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.datetime.fromisoformat(data["updated_at"])
        )


class FoundationFactsDB:
    """
    Database for managing foundation facts
    """
    def __init__(self, storage_path: Optional[str] = None, event_bus=None):
        """
        Initialize the foundation facts database
        
        Args:
            storage_path: Path to store the facts database
            event_bus: EventBus instance for publishing events
        """
        self.facts: Dict[str, FoundationFact] = {}
        self.keyword_index: Dict[str, Set[str]] = {}  # Keyword -> fact_ids
        self.category_index: Dict[FactCategory, Set[str]] = {
            category: set() for category in FactCategory
        }
        self.source_index: Dict[FactSource, Set[str]] = {
            source: set() for source in FactSource
        }
        
        # Set default storage path if not provided
        if storage_path is None:
            base_dir = Path.home() / ".alejo" / "cognitive" / "facts"
            base_dir.mkdir(parents=True, exist_ok=True)
            self.storage_path = str(base_dir / "foundation_facts.json")
        else:
            self.storage_path = storage_path
        
        # Connect to event bus if provided
        self.event_bus = event_bus or EventBus()
        
        # Load initial facts if file exists
        self._load_facts()
        
        logger.info(f"Foundation Facts DB initialized with {len(self.facts)} facts")
    
    @handle_exceptions
    def add_fact(self, fact: FoundationFact) -> bool:
        """
        Add a new fact to the database
        
        Args:
            fact: The foundation fact to add
            
        Returns:
            bool: True if added successfully, False otherwise
        """
        if fact.fact_id in self.facts:
            logger.warning(f"Fact with ID {fact.fact_id} already exists")
            return False
        
        # Add to main storage
        self.facts[fact.fact_id] = fact
        
        # Update indexes
        for keyword in fact.keywords:
            if keyword not in self.keyword_index:
                self.keyword_index[keyword] = set()
            self.keyword_index[keyword].add(fact.fact_id)
        
        self.category_index[fact.category].add(fact.fact_id)
        self.source_index[fact.source].add(fact.fact_id)
        
        # Publish event
        self.event_bus.publish("foundation_fact_added", {"fact_id": fact.fact_id})
        
        # Save to disk
        self._save_facts()
        
        return True
    
    @handle_exceptions
    def get_fact(self, fact_id: str) -> Optional[FoundationFact]:
        """
        Retrieve a fact by its ID
        
        Args:
            fact_id: The ID of the fact to retrieve
            
        Returns:
            FoundationFact or None if not found
        """
        return self.facts.get(fact_id)
    
    @handle_exceptions
    def update_fact(self, fact_id: str, **kwargs) -> bool:
        """
        Update an existing fact
        
        Args:
            fact_id: ID of the fact to update
            **kwargs: Attributes to update
            
        Returns:
            bool: True if updated successfully, False otherwise
        """
        if fact_id not in self.facts:
            logger.warning(f"Fact with ID {fact_id} not found")
            return False
        
        fact = self.facts[fact_id]
        old_category = fact.category
        old_keywords = fact.keywords
        
        # Update the fact
        fact.update(**kwargs)
        
        # Update indexes if necessary
        if "statement" in kwargs:
            # Update keyword index
            new_keywords = fact.keywords
            keywords_to_remove = old_keywords - new_keywords
            keywords_to_add = new_keywords - old_keywords
            
            for keyword in keywords_to_remove:
                if keyword in self.keyword_index:
                    self.keyword_index[keyword].discard(fact_id)
                    if not self.keyword_index[keyword]:
                        del self.keyword_index[keyword]
            
            for keyword in keywords_to_add:
                if keyword not in self.keyword_index:
                    self.keyword_index[keyword] = set()
                self.keyword_index[keyword].add(fact_id)
        
        if "category" in kwargs and old_category != fact.category:
            # Update category index
            self.category_index[old_category].discard(fact_id)
            self.category_index[fact.category].add(fact_id)
        
        # Publish event
        self.event_bus.publish("foundation_fact_updated", {"fact_id": fact_id})
        
        # Save to disk
        self._save_facts()
        
        return True
    
    @handle_exceptions
    def delete_fact(self, fact_id: str) -> bool:
        """
        Delete a fact from the database
        
        Args:
            fact_id: ID of the fact to delete
            
        Returns:
            bool: True if deleted successfully, False otherwise
        """
        if fact_id not in self.facts:
            logger.warning(f"Fact with ID {fact_id} not found")
            return False
        
        fact = self.facts[fact_id]
        
        # Remove from indexes
        for keyword in fact.keywords:
            if keyword in self.keyword_index:
                self.keyword_index[keyword].discard(fact_id)
                if not self.keyword_index[keyword]:
                    del self.keyword_index[keyword]
        
        self.category_index[fact.category].discard(fact_id)
        self.source_index[fact.source].discard(fact_id)
        
        # Remove from main storage
        del self.facts[fact_id]
        
        # Publish event
        self.event_bus.publish("foundation_fact_deleted", {"fact_id": fact_id})
        
        # Save to disk
        self._save_facts()
        
        return True
    
    @handle_exceptions
    def search_by_keywords(self, keywords: List[str], match_all: bool = False) -> List[FoundationFact]:
        """
        Search facts by keywords
        
        Args:
            keywords: List of keywords to search for
            match_all: If True, all keywords must match; if False, any keyword can match
            
        Returns:
            List of matching facts
        """
        if not keywords:
            return []
        
        # Convert keywords to lowercase
        keywords = [k.lower() for k in keywords]
        
        # Find matching fact IDs
        matching_fact_ids = set()
        for i, keyword in enumerate(keywords):
            if keyword in self.keyword_index:
                if i == 0 or not match_all:
                    matching_fact_ids.update(self.keyword_index[keyword])
                else:
                    matching_fact_ids.intersection_update(self.keyword_index[keyword])
        
        # Return matching facts
        return [self.facts[fact_id] for fact_id in matching_fact_ids]
    
    @handle_exceptions
    def search_by_category(self, category: FactCategory) -> List[FoundationFact]:
        """
        Search facts by category
        
        Args:
            category: Category to search for
            
        Returns:
            List of matching facts
        """
        return [self.facts[fact_id] for fact_id in self.category_index[category]]
    
    @handle_exceptions
    def search_by_source(self, source: FactSource) -> List[FoundationFact]:
        """
        Search facts by source
        
        Args:
            source: Source to search for
            
        Returns:
            List of matching facts
        """
        return [self.facts[fact_id] for fact_id in self.source_index[source]]
    
    @handle_exceptions
    def search_by_confidence(self, min_confidence: float = 0.0, max_confidence: float = 1.0) -> List[FoundationFact]:
        """
        Search facts by confidence level
        
        Args:
            min_confidence: Minimum confidence level (inclusive)
            max_confidence: Maximum confidence level (inclusive)
            
        Returns:
            List of matching facts
        """
        return [
            fact for fact in self.facts.values()
            if min_confidence <= fact.confidence <= max_confidence
        ]
    
    @handle_exceptions
    def validate_statement(self, statement: str) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Validate a statement against foundation facts
        
        Args:
            statement: Statement to validate
            
        Returns:
            Tuple of (is_valid, list of conflicting facts with explanations)
        """
        # This is a simplified implementation
        # A more sophisticated implementation would use NLP and logical reasoning
        
        # Extract keywords from statement
        keywords = set(statement.lower().split())
        
        # Find potentially relevant facts
        relevant_facts = self.search_by_keywords(list(keywords))
        
        # For now, we'll just return that all statements are valid
        # In a real implementation, this would check for logical consistency
        return True, []
    
    @handle_exceptions
    def export_facts(self, output_path: Optional[str] = None) -> str:
        """
        Export all facts to a JSON file
        
        Args:
            output_path: Path to export to (defaults to storage_path)
            
        Returns:
            Path where facts were exported
        """
        output_path = output_path or self.storage_path
        self._save_facts(output_path)
        return output_path
    
    @handle_exceptions
    def import_facts(self, input_path: str, overwrite: bool = False) -> int:
        """
        Import facts from a JSON file
        
        Args:
            input_path: Path to import from
            overwrite: Whether to overwrite existing facts with the same ID
            
        Returns:
            Number of facts imported
        """
        if not os.path.exists(input_path):
            logger.error(f"Import file not found: {input_path}")
            return 0
        
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            imported_count = 0
            for fact_data in data:
                fact = FoundationFact.from_dict(fact_data)
                if fact.fact_id not in self.facts or overwrite:
                    if fact.fact_id in self.facts:
                        self.delete_fact(fact.fact_id)
                    self.add_fact(fact)
                    imported_count += 1
            
            logger.info(f"Imported {imported_count} facts from {input_path}")
            return imported_count
        
        except Exception as e:
            logger.error(f"Error importing facts: {str(e)}")
            return 0
    
    @handle_exceptions
    def get_all_facts(self) -> List[FoundationFact]:
        """Get all facts in the database"""
        return list(self.facts.values())
    
    @handle_exceptions
    def get_fact_count(self) -> int:
        """Get the total number of facts in the database"""
        return len(self.facts)
    
    @handle_exceptions
    def _save_facts(self, output_path: Optional[str] = None) -> None:
        """Save facts to disk"""
        output_path = output_path or self.storage_path
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(
                    [fact.to_dict() for fact in self.facts.values()],
                    f,
                    indent=2,
                    ensure_ascii=False
                )
            logger.info(f"Saved {len(self.facts)} facts to {output_path}")
        except Exception as e:
            logger.error(f"Error saving facts: {str(e)}")
    
    @handle_exceptions
    def _load_facts(self) -> None:
        """Load facts from disk"""
        if not os.path.exists(self.storage_path):
            logger.info(f"Facts file not found: {self.storage_path}")
            return
        
        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for fact_data in data:
                fact = FoundationFact.from_dict(fact_data)
                self.facts[fact.fact_id] = fact
                
                # Update indexes
                for keyword in fact.keywords:
                    if keyword not in self.keyword_index:
                        self.keyword_index[keyword] = set()
                    self.keyword_index[keyword].add(fact.fact_id)
                
                self.category_index[fact.category].add(fact.fact_id)
                self.source_index[fact.source].add(fact.fact_id)
            
            logger.info(f"Loaded {len(self.facts)} facts from {self.storage_path}")
        except Exception as e:
            logger.error(f"Error loading facts: {str(e)}")


# Initialize with some default facts
def initialize_default_facts() -> List[FoundationFact]:
    """Create a set of default foundation facts"""
    facts = []
    
    # Physical facts
    facts.append(FoundationFact(
        fact_id="physical_gravity",
        statement="Objects with mass attract each other with a force proportional to their masses and inversely proportional to the square of the distance between them",
        category=FactCategory.PHYSICAL,
        source=FactSource.SCIENTIFIC,
        confidence=1.0,
        metadata={"domain": "physics", "law": "Newton's law of universal gravitation"}
    ))
    
    facts.append(FoundationFact(
        fact_id="physical_conservation_energy",
        statement="Energy cannot be created or destroyed, only transformed from one form to another",
        category=FactCategory.PHYSICAL,
        source=FactSource.SCIENTIFIC,
        confidence=1.0,
        metadata={"domain": "physics", "law": "Conservation of energy"}
    ))
    
    # Mathematical facts
    facts.append(FoundationFact(
        fact_id="math_pythagorean",
        statement="In a right triangle, the square of the length of the hypotenuse equals the sum of the squares of the lengths of the other two sides",
        category=FactCategory.MATHEMATICAL,
        source=FactSource.SCIENTIFIC,
        confidence=1.0,
        metadata={"domain": "geometry", "theorem": "Pythagorean theorem"}
    ))
    
    # Logical facts
    facts.append(FoundationFact(
        fact_id="logic_non_contradiction",
        statement="A statement cannot be both true and false at the same time and in the same context",
        category=FactCategory.LOGICAL,
        source=FactSource.LOGICAL_DERIVATION,
        confidence=1.0,
        metadata={"domain": "logic", "principle": "Law of non-contradiction"}
    ))
    
    facts.append(FoundationFact(
        fact_id="logic_excluded_middle",
        statement="Every statement is either true or false",
        category=FactCategory.LOGICAL,
        source=FactSource.LOGICAL_DERIVATION,
        confidence=1.0,
        metadata={"domain": "logic", "principle": "Law of excluded middle"}
    ))
    
    # Temporal facts
    facts.append(FoundationFact(
        fact_id="temporal_causality",
        statement="A cause must precede its effect in time",
        category=FactCategory.TEMPORAL,
        source=FactSource.LOGICAL_DERIVATION,
        confidence=1.0,
        metadata={"domain": "causality", "principle": "Temporal precedence"}
    ))
    
    # Common sense facts
    facts.append(FoundationFact(
        fact_id="common_sense_water",
        statement="Water is wet",
        category=FactCategory.COMMON_SENSE,
        source=FactSource.SYSTEM,
        confidence=0.95,
        metadata={"domain": "everyday experience"}
    ))
    
    return facts
