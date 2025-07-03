"""
Feedback Loop

This module enables users to correct ALEJO's reasoning processes and have those
corrections incorporated into future reasoning. It helps the system learn from
mistakes and improve its reasoning capabilities over time.

Features:
- Recording and processing user corrections
- Applying corrections to foundation facts and reasoning
- Learning from user feedback to improve future reasoning
- Persistence of corrections for long-term learning
"""

import json
import logging
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Set

from alejo.cognitive.reasoning.truth_core.foundation_facts import FoundationFactsDB, FactSource
from alejo.cognitive.reasoning.truth_core.validator import LogicalConsistencyValidator
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class CorrectionType(Enum):
    """Types of corrections that can be applied to reasoning"""
    FACTUAL = "factual"                # Correcting a factual error
    LOGICAL = "logical"                # Correcting a logical error
    CONTEXTUAL = "contextual"          # Adding missing context
    CLARIFICATION = "clarification"    # Clarifying ambiguity
    PREFERENCE = "preference"          # User preference adjustment


class CorrectionStatus(Enum):
    """Status of a correction in the feedback loop"""
    PENDING = "pending"                # Correction is pending review
    APPLIED = "applied"                # Correction has been applied
    REJECTED = "rejected"              # Correction was rejected
    CONFLICT = "conflict"              # Correction conflicts with existing knowledge


class UserCorrection:
    """
    Represents a correction provided by a user to improve reasoning
    """
    def __init__(
        self,
        correction_id: str = None,
        original_statement: str = "",
        corrected_statement: str = "",
        correction_type: CorrectionType = CorrectionType.FACTUAL,
        reasoning_trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        explanation: Optional[str] = None,
        source: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a user correction
        
        Args:
            correction_id: Unique identifier for this correction
            original_statement: The original incorrect statement
            corrected_statement: The corrected statement
            correction_type: Type of correction being made
            reasoning_trace_id: ID of related reasoning trace (if applicable)
            user_id: ID of the user providing the correction
            explanation: User explanation for the correction
            source: Source of the correction (e.g., URL, reference)
            metadata: Additional metadata for this correction
        """
        self.id = correction_id or str(uuid.uuid4())
        self.original_statement = original_statement
        self.corrected_statement = corrected_statement
        self.correction_type = correction_type
        self.reasoning_trace_id = reasoning_trace_id
        self.user_id = user_id
        self.explanation = explanation
        self.source = source
        self.metadata = metadata or {}
        self.created_at = datetime.now().isoformat()
        self.status = CorrectionStatus.PENDING
        self.applied_at = None
        self.rejection_reason = None
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert the correction to a dictionary for storage"""
        return {
            "id": self.id,
            "original_statement": self.original_statement,
            "corrected_statement": self.corrected_statement,
            "correction_type": self.correction_type.value,
            "reasoning_trace_id": self.reasoning_trace_id,
            "user_id": self.user_id,
            "explanation": self.explanation,
            "source": self.source,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "status": self.status.value,
            "applied_at": self.applied_at,
            "rejection_reason": self.rejection_reason
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserCorrection':
        """Create a correction from a dictionary"""
        correction = cls(
            correction_id=data.get("id"),
            original_statement=data.get("original_statement", ""),
            corrected_statement=data.get("corrected_statement", ""),
            correction_type=CorrectionType(data.get("correction_type", CorrectionType.FACTUAL.value)),
            reasoning_trace_id=data.get("reasoning_trace_id"),
            user_id=data.get("user_id"),
            explanation=data.get("explanation"),
            source=data.get("source"),
            metadata=data.get("metadata", {})
        )
        correction.created_at = data.get("created_at", datetime.now().isoformat())
        correction.status = CorrectionStatus(data.get("status", CorrectionStatus.PENDING.value))
        correction.applied_at = data.get("applied_at")
        correction.rejection_reason = data.get("rejection_reason")
        return correction


class FeedbackLoop:
    """
    System for incorporating user corrections into ALEJO's reasoning
    """
    def __init__(
        self,
        facts_db: FoundationFactsDB,
        validator: LogicalConsistencyValidator = None,
        event_bus: EventBus = None
    ):
        """
        Initialize the feedback loop
        
        Args:
            facts_db: Foundation facts database
            validator: Logical consistency validator
            event_bus: Event bus for publishing feedback events
        """
        self.facts_db = facts_db
        self.validator = validator or LogicalConsistencyValidator(facts_db)
        self.event_bus = event_bus
        self.corrections: Dict[str, UserCorrection] = {}
        self.storage_path = self._get_storage_path()
        self._ensure_storage_path_exists()
        self._load_corrections()
        logger.info("Feedback Loop initialized")
    
    def _get_storage_path(self) -> Path:
        """Get the path for storing corrections"""
        home_dir = Path.home()
        alejo_dir = home_dir / ".alejo" / "cognitive" / "reasoning" / "corrections"
        return alejo_dir
    
    def _ensure_storage_path_exists(self) -> None:
        """Ensure the storage path exists"""
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    @handle_exceptions("Failed to add user correction")
    def add_correction(
        self,
        original_statement: str,
        corrected_statement: str,
        correction_type: Union[CorrectionType, str] = CorrectionType.FACTUAL,
        reasoning_trace_id: str = None,
        user_id: str = None,
        explanation: str = None,
        source: str = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Add a user correction to the feedback loop
        
        Args:
            original_statement: The original incorrect statement
            corrected_statement: The corrected statement
            correction_type: Type of correction being made
            reasoning_trace_id: ID of related reasoning trace (if applicable)
            user_id: ID of the user providing the correction
            explanation: User explanation for the correction
            source: Source of the correction (e.g., URL, reference)
            metadata: Additional metadata for this correction
            
        Returns:
            ID of the created correction
        """
        # Convert string to enum if needed
        if isinstance(correction_type, str):
            correction_type = CorrectionType(correction_type)
        
        # Create correction object
        correction = UserCorrection(
            original_statement=original_statement,
            corrected_statement=corrected_statement,
            correction_type=correction_type,
            reasoning_trace_id=reasoning_trace_id,
            user_id=user_id,
            explanation=explanation,
            source=source,
            metadata=metadata
        )
        
        # Add to corrections
        self.corrections[correction.id] = correction
        
        # Save the correction
        self._save_correction(correction)
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.REASONING_CORRECTION_ADDED,
                {
                    "correction_id": correction.id,
                    "correction_type": correction_type.value,
                    "user_id": user_id
                }
            )
        
        logger.info(f"Added user correction: {correction.id}")
        return correction.id
    
    @handle_exceptions("Failed to apply correction")
    def apply_correction(self, correction_id: str) -> bool:
        """
        Apply a correction to the knowledge base
        
        Args:
            correction_id: ID of the correction to apply
            
        Returns:
            True if applied successfully, False otherwise
        """
        if correction_id not in self.corrections:
            logger.warning(f"Correction not found: {correction_id}")
            return False
        
        correction = self.corrections[correction_id]
        
        # Skip if already applied
        if correction.status == CorrectionStatus.APPLIED:
            logger.info(f"Correction already applied: {correction_id}")
            return True
        
        # Apply based on correction type
        success = False
        
        if correction.correction_type == CorrectionType.FACTUAL:
            # For factual corrections, update the facts database
            source = FactSource.USER_CORRECTION
            
            if correction.source:
                source_details = f"User correction: {correction.source}"
            elif correction.explanation:
                source_details = f"User explanation: {correction.explanation}"
            else:
                source_details = "User correction"
            
            # Add the corrected fact
            fact_id = self.facts_db.add_fact(
                statement=correction.corrected_statement,
                source=source,
                source_details=source_details,
                user_id=correction.user_id,
                importance=0.8,  # User corrections are fairly important
                confidence=0.9   # High confidence in user corrections
            )
            
            success = fact_id is not None
            
        elif correction.correction_type == CorrectionType.LOGICAL:
            # For logical corrections, we need more complex handling
            # This would involve updating reasoning patterns
            # For now, we just log it
            logger.info(f"Logical correction applied: {correction.id}")
            success = True
            
        elif correction.correction_type == CorrectionType.CONTEXTUAL:
            # For contextual corrections, add the context to the facts database
            context_fact = f"Context for '{correction.original_statement}': {correction.corrected_statement}"
            
            fact_id = self.facts_db.add_fact(
                statement=context_fact,
                source=FactSource.USER_CORRECTION,
                source_details="User-provided context",
                user_id=correction.user_id,
                importance=0.7,
                confidence=0.9
            )
            
            success = fact_id is not None
            
        else:
            # For other correction types, just log and mark as applied
            logger.info(f"Applied correction of type {correction.correction_type.value}: {correction.id}")
            success = True
        
        if success:
            # Update correction status
            correction.status = CorrectionStatus.APPLIED
            correction.applied_at = datetime.now().isoformat()
            
            # Save the updated correction
            self._save_correction(correction)
            
            # Publish event
            if self.event_bus:
                self.event_bus.publish(
                    EventType.REASONING_CORRECTION_APPLIED,
                    {
                        "correction_id": correction.id,
                        "correction_type": correction.correction_type.value,
                        "user_id": correction.user_id
                    }
                )
            
            logger.info(f"Correction applied successfully: {correction.id}")
            
        return success
    
    @handle_exceptions("Failed to reject correction")
    def reject_correction(self, correction_id: str, reason: str = None) -> bool:
        """
        Reject a correction
        
        Args:
            correction_id: ID of the correction to reject
            reason: Reason for rejection
            
        Returns:
            True if rejected successfully, False otherwise
        """
        if correction_id not in self.corrections:
            logger.warning(f"Correction not found: {correction_id}")
            return False
        
        correction = self.corrections[correction_id]
        
        # Update correction status
        correction.status = CorrectionStatus.REJECTED
        correction.rejection_reason = reason
        
        # Save the updated correction
        self._save_correction(correction)
        
        # Publish event
        if self.event_bus:
            self.event_bus.publish(
                EventType.REASONING_CORRECTION_REJECTED,
                {
                    "correction_id": correction.id,
                    "reason": reason,
                    "user_id": correction.user_id
                }
            )
        
        logger.info(f"Correction rejected: {correction.id}")
        return True
    
    @handle_exceptions("Failed to get correction")
    def get_correction(self, correction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a correction by ID
        
        Args:
            correction_id: ID of the correction to get
            
        Returns:
            Dictionary representation of the correction or None if not found
        """
        if correction_id not in self.corrections:
            return None
        
        return self.corrections[correction_id].to_dict()
    
    @handle_exceptions("Failed to list corrections")
    def list_corrections(
        self,
        user_id: str = None,
        status: Union[CorrectionStatus, str] = None,
        correction_type: Union[CorrectionType, str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List corrections matching the given criteria
        
        Args:
            user_id: Filter by user ID
            status: Filter by correction status
            correction_type: Filter by correction type
            limit: Maximum number of corrections to return
            
        Returns:
            List of correction dictionaries
        """
        # Convert string to enum if needed
        if isinstance(status, str):
            status = CorrectionStatus(status)
        
        if isinstance(correction_type, str):
            correction_type = CorrectionType(correction_type)
        
        results = []
        
        for correction in self.corrections.values():
            # Apply filters
            if user_id and correction.user_id != user_id:
                continue
                
            if status and correction.status != status:
                continue
                
            if correction_type and correction.correction_type != correction_type:
                continue
            
            # Add to results
            results.append(correction.to_dict())
            
            # Limit results
            if len(results) >= limit:
                break
        
        return results
    
    @handle_exceptions("Failed to batch apply corrections")
    def batch_apply_corrections(self, user_id: str = None) -> Dict[str, int]:
        """
        Apply all pending corrections for a user
        
        Args:
            user_id: Optional user ID to filter corrections
            
        Returns:
            Dictionary with counts of applied, failed, and skipped corrections
        """
        results = {
            "applied": 0,
            "failed": 0,
            "skipped": 0
        }
        
        for correction_id, correction in self.corrections.items():
            # Skip if not pending
            if correction.status != CorrectionStatus.PENDING:
                results["skipped"] += 1
                continue
            
            # Skip if user_id provided and doesn't match
            if user_id and correction.user_id != user_id:
                results["skipped"] += 1
                continue
            
            # Apply the correction
            success = self.apply_correction(correction_id)
            
            if success:
                results["applied"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    def _save_correction(self, correction: UserCorrection) -> None:
        """Save a correction to storage"""
        file_path = self.storage_path / f"{correction.id}.json"
        
        with open(file_path, "w") as f:
            json.dump(correction.to_dict(), f, indent=2)
    
    def _load_corrections(self) -> None:
        """Load corrections from storage"""
        if not self.storage_path.exists():
            return
        
        for file_path in self.storage_path.glob("*.json"):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                
                correction = UserCorrection.from_dict(data)
                self.corrections[correction.id] = correction
                
            except Exception as e:
                logger.error(f"Failed to load correction from {file_path}: {str(e)}")
        
        logger.info(f"Loaded {len(self.corrections)} corrections")

    @handle_exceptions("Failed to check for conflicting correction")
    def check_for_conflicts(self, correction_id: str) -> List[Dict[str, Any]]:
        """
        Check if a correction conflicts with existing knowledge
        
        Args:
            correction_id: ID of the correction to check
            
        Returns:
            List of conflicting facts or corrections
        """
        if correction_id not in self.corrections:
            logger.warning(f"Correction not found: {correction_id}")
            return []
        
        correction = self.corrections[correction_id]
        conflicts = []
        
        # Check against facts database
        relevant_facts = self.facts_db.search_facts(correction.original_statement)
        
        for fact in relevant_facts:
            # Use validator to check if statements are contradictory
            if self.validator._are_contradictory(correction.corrected_statement, fact.statement):
                conflicts.append({
                    "type": "fact",
                    "id": fact.id,
                    "statement": fact.statement,
                    "confidence": fact.confidence,
                    "source": fact.source.value
                })
        
        # Check against other corrections
        for other_id, other in self.corrections.items():
            if other_id == correction_id:
                continue
                
            # Only check applied corrections
            if other.status != CorrectionStatus.APPLIED:
                continue
                
            # Check if corrected statements contradict
            if self.validator._are_contradictory(correction.corrected_statement, other.corrected_statement):
                conflicts.append({
                    "type": "correction",
                    "id": other.id,
                    "original_statement": other.original_statement,
                    "corrected_statement": other.corrected_statement,
                    "user_id": other.user_id,
                    "created_at": other.created_at
                })
        
        return conflicts
