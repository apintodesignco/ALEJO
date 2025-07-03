"""
Logical Consistency Validator

This module provides functionality to validate the logical consistency of new information
against the foundation facts database. It ensures that ALEJO's reasoning remains sound
by detecting contradictions and logical inconsistencies.

Features:
- Validation of statements against foundation facts
- Detection of logical contradictions
- Confidence scoring for logical consistency
- Explanation of validation results
"""

import re
from typing import Dict, List, Set, Tuple, Any, Optional, Union
import logging
from enum import Enum

from alejo.cognitive.reasoning.truth_core.foundation_facts import FoundationFactsDB, FoundationFact
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class ValidationResult(Enum):
    """Possible results of logical validation"""
    CONSISTENT = "consistent"           # Statement is logically consistent with facts
    CONTRADICTORY = "contradictory"     # Statement contradicts known facts
    UNCERTAIN = "uncertain"             # Cannot determine consistency
    TAUTOLOGY = "tautology"             # Statement is always true by definition
    CONTINGENT = "contingent"           # Statement depends on context


class LogicalRelation(Enum):
    """Types of logical relations between statements"""
    IDENTICAL = "identical"             # Statements are identical
    ENTAILMENT = "entailment"           # One statement entails the other
    CONTRADICTION = "contradiction"     # Statements contradict each other
    INDEPENDENCE = "independence"       # Statements are logically independent


class ValidationExplanation:
    """
    Explanation for a validation result
    """
    def __init__(
        self,
        result: ValidationResult,
        confidence: float,
        related_facts: List[FoundationFact] = None,
        explanation: str = "",
        logical_path: List[Dict[str, Any]] = None
    ):
        """
        Initialize a validation explanation
        
        Args:
            result: The validation result
            confidence: Confidence in the result (0.0 to 1.0)
            related_facts: Foundation facts related to this validation
            explanation: Human-readable explanation
            logical_path: Step-by-step logical reasoning path
        """
        self.result = result
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.related_facts = related_facts or []
        self.explanation = explanation
        self.logical_path = logical_path or []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert explanation to dictionary"""
        return {
            "result": self.result.value,
            "confidence": self.confidence,
            "related_facts": [fact.fact_id for fact in self.related_facts],
            "explanation": self.explanation,
            "logical_path": self.logical_path
        }


class LogicalConsistencyValidator:
    """
    Validates the logical consistency of statements against foundation facts
    """
    def __init__(self, facts_db: FoundationFactsDB):
        """
        Initialize the logical consistency validator
        
        Args:
            facts_db: Foundation facts database
        """
        self.facts_db = facts_db
        logger.info("Logical Consistency Validator initialized")
    
    @handle_exceptions
    def validate_statement(self, statement: str) -> ValidationExplanation:
        """
        Validate a statement against foundation facts
        
        Args:
            statement: Statement to validate
            
        Returns:
            ValidationExplanation with result and reasoning
        """
        # This is a simplified implementation
        # A more sophisticated implementation would use NLP and formal logic
        
        # Extract keywords from statement
        keywords = self._extract_keywords(statement)
        
        # Find potentially relevant facts
        relevant_facts = self._find_relevant_facts(keywords)
        
        if not relevant_facts:
            # No relevant facts found, can't determine consistency
            return ValidationExplanation(
                result=ValidationResult.UNCERTAIN,
                confidence=0.5,
                explanation="No relevant foundation facts found to validate this statement."
            )
        
        # Check for direct contradictions (simplified approach)
        contradictions = self._find_contradictions(statement, relevant_facts)
        
        if contradictions:
            return ValidationExplanation(
                result=ValidationResult.CONTRADICTORY,
                confidence=max(fact.confidence for fact in contradictions),
                related_facts=contradictions,
                explanation=f"Statement contradicts {len(contradictions)} foundation facts.",
                logical_path=[{"step": "contradiction_detection", "details": self._summarize_contradictions(statement, contradictions)}]
            )
        
        # Check for tautologies (simplified)
        if self._is_tautology(statement):
            return ValidationExplanation(
                result=ValidationResult.TAUTOLOGY,
                confidence=1.0,
                explanation="Statement is a logical tautology (always true by definition)."
            )
        
        # If no contradictions found, assume consistent but with moderate confidence
        return ValidationExplanation(
            result=ValidationResult.CONSISTENT,
            confidence=0.7,
            related_facts=relevant_facts[:3],  # Include top 3 most relevant facts
            explanation="Statement appears consistent with foundation facts."
        )
    
    @handle_exceptions
    def compare_statements(self, statement1: str, statement2: str) -> Tuple[LogicalRelation, float]:
        """
        Compare two statements to determine their logical relationship
        
        Args:
            statement1: First statement
            statement2: Second statement
            
        Returns:
            Tuple of (logical relation, confidence)
        """
        # Simplified implementation
        # Check for identical statements
        if self._normalize_statement(statement1) == self._normalize_statement(statement2):
            return LogicalRelation.IDENTICAL, 1.0
        
        # Check for direct contradictions (very simplified)
        if self._are_contradictory(statement1, statement2):
            return LogicalRelation.CONTRADICTION, 0.7
        
        # Check for entailment (simplified)
        entailment_score = self._check_entailment(statement1, statement2)
        if entailment_score > 0.7:
            return LogicalRelation.ENTAILMENT, entailment_score
        
        # Default to independence
        return LogicalRelation.INDEPENDENCE, 0.6
    
    @handle_exceptions
    def validate_inference(self, premises: List[str], conclusion: str) -> ValidationExplanation:
        """
        Validate if a conclusion logically follows from premises
        
        Args:
            premises: List of premise statements
            conclusion: Conclusion statement
            
        Returns:
            ValidationExplanation with result and reasoning
        """
        # Simplified implementation
        # Validate each premise
        premise_validations = [self.validate_statement(premise) for premise in premises]
        
        # Check if any premise is contradictory
        contradictory_premises = [
            i for i, validation in enumerate(premise_validations)
            if validation.result == ValidationResult.CONTRADICTORY
        ]
        
        if contradictory_premises:
            return ValidationExplanation(
                result=ValidationResult.CONTRADICTORY,
                confidence=0.8,
                explanation=f"Premise {contradictory_premises[0]+1} contradicts foundation facts.",
                logical_path=[{"step": "premise_validation", "details": "Contradictory premise detected"}]
            )
        
        # Validate conclusion
        conclusion_validation = self.validate_statement(conclusion)
        
        # Check if conclusion is consistent with premises
        # This is a very simplified approach
        for i, premise in enumerate(premises):
            relation, confidence = self.compare_statements(premise, conclusion)
            if relation == LogicalRelation.ENTAILMENT and confidence > 0.7:
                return ValidationExplanation(
                    result=ValidationResult.CONSISTENT,
                    confidence=confidence,
                    explanation=f"Conclusion follows from premise {i+1}.",
                    logical_path=[
                        {"step": "entailment_check", "details": f"Premise {i+1} entails conclusion"}
                    ]
                )
        
        # If no direct entailment found, return uncertain
        return ValidationExplanation(
            result=ValidationResult.UNCERTAIN,
            confidence=0.5,
            explanation="Cannot determine if conclusion follows from premises.",
            logical_path=[{"step": "entailment_check", "details": "No clear entailment path found"}]
        )
    
    def _extract_keywords(self, statement: str) -> Set[str]:
        """Extract keywords from a statement"""
        # Simple implementation - split by spaces and remove common words
        common_words = {"a", "an", "the", "is", "are", "in", "on", "at", "by", "for", "with", "about"}
        words = statement.lower().split()
        return {word for word in words if word not in common_words and len(word) > 2}
    
    def _find_relevant_facts(self, keywords: Set[str]) -> List[FoundationFact]:
        """Find facts relevant to the given keywords"""
        return self.facts_db.search_by_keywords(list(keywords))
    
    def _find_contradictions(self, statement: str, facts: List[FoundationFact]) -> List[FoundationFact]:
        """Find facts that contradict the statement"""
        # Simplified implementation
        # In a real system, this would use more sophisticated NLP and logical reasoning
        contradictions = []
        
        # Check for simple negation patterns
        statement_lower = statement.lower()
        
        for fact in facts:
            fact_lower = fact.statement.lower()
            
            # Check for direct contradictions using simple patterns
            if self._are_contradictory(statement_lower, fact_lower):
                contradictions.append(fact)
        
        return contradictions
    
    def _are_contradictory(self, statement1: str, statement2: str) -> bool:
        """Check if two statements are contradictory"""
        # Very simplified implementation
        # Check for simple negation patterns
        
        # Normalize statements
        s1 = self._normalize_statement(statement1)
        s2 = self._normalize_statement(statement2)
        
        # Check for direct negation
        negation_patterns = [
            (r"is ", r"is not "),
            (r"are ", r"are not "),
            (r"can ", r"cannot "),
            (r"will ", r"will not "),
            (r"has ", r"has not "),
            (r"does ", r"does not "),
            (r"do ", r"do not "),
        ]
        
        for pattern, negation in negation_patterns:
            if (pattern in s1 and s1.replace(pattern, negation) == s2) or \
               (pattern in s2 and s2.replace(pattern, negation) == s1):
                return True
        
        return False
    
    def _normalize_statement(self, statement: str) -> str:
        """Normalize a statement for comparison"""
        # Convert to lowercase
        s = statement.lower()
        
        # Replace contractions
        contractions = {
            "isn't": "is not",
            "aren't": "are not",
            "can't": "cannot",
            "won't": "will not",
            "don't": "do not",
            "doesn't": "does not",
            "hasn't": "has not",
            "haven't": "have not",
            "shouldn't": "should not",
            "wouldn't": "would not",
            "couldn't": "could not",
        }
        
        for contraction, expansion in contractions.items():
            s = s.replace(contraction, expansion)
        
        # Remove punctuation
        s = re.sub(r'[^\w\s]', '', s)
        
        # Remove extra whitespace
        s = re.sub(r'\s+', ' ', s).strip()
        
        return s
    
    def _is_tautology(self, statement: str) -> bool:
        """Check if a statement is a logical tautology"""
        # Simplified implementation
        # Check for common tautological patterns
        
        s = self._normalize_statement(statement)
        
        tautology_patterns = [
            r"(.*) is (.*) or (.*) is not (.*)",
            r"if (.*) then (.*) or if not (.*) then not (.*)",
            r"(.*) is identical to (.*)",
            r"(.*) equals (.*)",
        ]
        
        for pattern in tautology_patterns:
            match = re.match(pattern, s)
            if match:
                groups = match.groups()
                if len(groups) >= 4 and groups[0] == groups[2] and groups[1] == groups[3]:
                    return True
                elif len(groups) >= 2 and groups[0] == groups[1]:
                    return True
        
        return False
    
    def _check_entailment(self, statement1: str, statement2: str) -> float:
        """
        Check if statement1 entails statement2
        
        Returns:
            float: Confidence score for entailment (0.0 to 1.0)
        """
        # Simplified implementation
        # In a real system, this would use more sophisticated NLP and logical reasoning
        
        # Check for subset relationship in keywords
        keywords1 = self._extract_keywords(statement1)
        keywords2 = self._extract_keywords(statement2)
        
        if keywords2.issubset(keywords1):
            return 0.6
        
        # Check for specific entailment patterns
        s1 = self._normalize_statement(statement1)
        s2 = self._normalize_statement(statement2)
        
        # "All X are Y" entails "Some X are Y"
        if s1.startswith("all ") and s2.startswith("some "):
            s1_remainder = s1[4:]
            s2_remainder = s2[5:]
            if s1_remainder == s2_remainder:
                return 0.9
        
        # "X is Y and Z" entails "X is Y"
        if " and " in s1:
            parts = s1.split(" and ")
            for part in parts:
                if part.strip() == s2:
                    return 0.9
        
        # Default: low confidence
        return 0.3
    
    def _summarize_contradictions(self, statement: str, contradicting_facts: List[FoundationFact]) -> List[Dict[str, str]]:
        """Summarize contradictions for explanation"""
        summaries = []
        
        for fact in contradicting_facts:
            summaries.append({
                "statement": statement,
                "contradicting_fact": fact.statement,
                "fact_id": fact.fact_id,
                "confidence": str(fact.confidence)
            })
        
        return summaries
