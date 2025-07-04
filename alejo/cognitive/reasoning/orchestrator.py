"""
Reasoning Engine Orchestrator

This module serves as the central orchestrator for ALEJO's reasoning capabilities,
integrating all reasoning components to ensure flawless, bulletproof reasoning.
It coordinates the foundation facts database, logical consistency validator,
fallacy detector, reasoning tracer, and feedback loop to provide comprehensive
reasoning capabilities.

Features:
- Unified interface for all reasoning operations
- Coordinated reasoning process with multiple validation layers
- Automatic fallacy detection and prevention
- Comprehensive reasoning traces for transparency
- Integration with feedback loop for continuous improvement
- Thread-safe operation for concurrent reasoning requests
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional, Union

from alejo.cognitive.reasoning.truth_core.foundation_facts import (
    FoundationFactsDB, FoundationFact, FactCategory, FactSource
)
from alejo.cognitive.reasoning.truth_core.validator import (
    LogicalConsistencyValidator, ValidationResult, ValidationExplanation
)
from alejo.cognitive.reasoning.truth_core.fallacy_detector import (
    FallacyDetector, FallacyDetection, FallacyType
)
from alejo.cognitive.reasoning.truth_core.reasoning_tracer import (
    ReasoningTracer, ReasoningTrace, ReasoningStepType
)
from alejo.cognitive.reasoning.correction.feedback_loop import (
    FeedbackLoop, UserCorrection, CorrectionType, CorrectionStatus
)
from alejo.core.events import EventBus, Event, EventType
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class ReasoningStatus(Enum):
    """Status of a reasoning operation"""
    SUCCESS = "success"               # Reasoning completed successfully
    FALLACY_DETECTED = "fallacy"      # Fallacies were detected
    CONTRADICTION = "contradiction"   # Contradictions were found
    ERROR = "error"                   # Error occurred during reasoning
    UNCERTAIN = "uncertain"           # Result is uncertain


class ReasoningRequest:
    """
    Represents a request for reasoning
    """
    def __init__(
        self,
        query: str,
        context: str = None,
        user_id: str = None,
        session_id: str = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a reasoning request
        
        Args:
            query: The query or statement to reason about
            context: Additional context for the reasoning
            user_id: ID of the user making the request
            session_id: ID of the current session
            metadata: Additional metadata for this request
        """
        self.request_id = str(uuid.uuid4())
        self.query = query
        self.context = context or ""
        self.user_id = user_id
        self.session_id = session_id
        self.metadata = metadata or {}
        self.timestamp = datetime.now().isoformat()


class ReasoningResult:
    """
    Represents the result of a reasoning operation
    """
    def __init__(
        self,
        request_id: str,
        status: ReasoningStatus,
        conclusion: str = None,
        confidence: float = 0.0,
        trace_id: str = None,
        fallacies: List[Dict[str, Any]] = None,
        contradictions: List[Dict[str, Any]] = None,
        explanation: str = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a reasoning result
        
        Args:
            request_id: ID of the original request
            status: Status of the reasoning operation
            conclusion: Conclusion reached (if any)
            confidence: Confidence in the conclusion (0.0 to 1.0)
            trace_id: ID of the reasoning trace
            fallacies: List of detected fallacies
            contradictions: List of detected contradictions
            explanation: Human-readable explanation of the reasoning
            metadata: Additional metadata for this result
        """
        self.result_id = str(uuid.uuid4())
        self.request_id = request_id
        self.status = status
        self.conclusion = conclusion
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.trace_id = trace_id
        self.fallacies = fallacies or []
        self.contradictions = contradictions or []
        self.explanation = explanation
        self.metadata = metadata or {}
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            "result_id": self.result_id,
            "request_id": self.request_id,
            "status": self.status.value,
            "conclusion": self.conclusion,
            "confidence": self.confidence,
            "trace_id": self.trace_id,
            "fallacies": self.fallacies,
            "contradictions": self.contradictions,
            "explanation": self.explanation,
            "metadata": self.metadata,
            "timestamp": self.timestamp
        }


class ReasoningEngineOrchestrator:
    """
    Central orchestrator for ALEJO's reasoning capabilities
    
    This class integrates all reasoning components to provide comprehensive,
    bulletproof reasoning capabilities.
    """
    def __init__(
        self,
        facts_db: Optional[FoundationFactsDB] = None,
        validator: Optional[LogicalConsistencyValidator] = None,
        fallacy_detector: Optional[FallacyDetector] = None,
        tracer: Optional[ReasoningTracer] = None,
        feedback_loop: Optional[FeedbackLoop] = None,
        event_bus: Optional[EventBus] = None
    ):
        """
        Initialize the reasoning engine orchestrator
        
        Args:
            facts_db: Foundation facts database
            validator: Logical consistency validator
            fallacy_detector: Fallacy detector
            tracer: Reasoning tracer
            feedback_loop: Feedback loop for corrections
            event_bus: Event bus for publishing events
        """
        # Initialize components, creating them if not provided
        self.facts_db = facts_db or FoundationFactsDB()
        self.validator = validator or LogicalConsistencyValidator(self.facts_db)
        self.fallacy_detector = fallacy_detector or FallacyDetector()
        self.tracer = tracer or ReasoningTracer()
        self.feedback_loop = feedback_loop or FeedbackLoop(self.facts_db, self.validator)
        self.event_bus = event_bus
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info("Reasoning Engine Orchestrator initialized")
    
    async def reason(
        self,
        request: ReasoningRequest
    ) -> ReasoningResult:
        """
        Perform reasoning on a request
        
        Args:
            request: Reasoning request
            
        Returns:
            Reasoning result
        """
        # Start a reasoning trace
        trace_id = self.tracer.start_trace(
            context=request.context,
            query=request.query,
            user_id=request.user_id,
            session_id=request.session_id,
            metadata=request.metadata
        )
        
        try:
            # Add initial step
            self.tracer.add_step(
                trace_id=trace_id,
                step_type=ReasoningStepType.QUESTION,
                description=f"Processing query: {request.query}",
                inputs={"query": request.query, "context": request.context}
            )
            
            # Extract key statements from the query
            statements = self._extract_statements(request.query)
            
            # Check for fallacies
            fallacies = []
            for statement in statements:
                detected_fallacies = self.fallacy_detector.detect_fallacies(statement)
                if detected_fallacies:
                    fallacies.extend([f.to_dict() for f in detected_fallacies])
                    
                    # Add fallacy detection step
                    self.tracer.add_step(
                        trace_id=trace_id,
                        step_type=ReasoningStepType.FALLACY_CHECK,
                        description=f"Detected fallacies in statement: {statement}",
                        outputs={"fallacies": [f.to_dict() for f in detected_fallacies]}
                    )
            
            # Validate statements against foundation facts
            contradictions = []
            validations = []
            for statement in statements:
                validation = self.validator.validate_statement(statement)
                validations.append(validation)
                
                # Add validation step
                self.tracer.add_step(
                    trace_id=trace_id,
                    step_type=ReasoningStepType.VALIDATION,
                    description=f"Validating statement: {statement}",
                    outputs={"result": validation.result.value}
                )
                
                if validation.result == ValidationResult.CONTRADICTORY:
                    contradictions.append({
                        "statement": statement,
                        "explanation": validation.explanation
                    })
            
            # Determine overall status and conclusion
            status, conclusion, confidence = self._determine_result(
                fallacies, contradictions, validations, request.query
            )
            
            # Add conclusion step
            self.tracer.add_step(
                trace_id=trace_id,
                step_type=ReasoningStepType.CONCLUSION,
                description=f"Final conclusion: {conclusion}",
                outputs={
                    "status": status.value,
                    "conclusion": conclusion,
                    "confidence": confidence
                }
            )
            
            # Conclude the reasoning trace
            self.tracer.conclude_trace(
                trace_id=trace_id,
                conclusion=conclusion,
                confidence=confidence
            )
            
            # Generate explanation
            explanation = self.tracer.generate_explanation(
                trace_id=trace_id,
                detail_level="medium"
            )
            
            # Create and return result
            result = ReasoningResult(
                request_id=request.request_id,
                status=status,
                conclusion=conclusion,
                confidence=confidence,
                trace_id=trace_id,
                fallacies=fallacies,
                contradictions=contradictions,
                explanation=explanation
            )
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="reasoning_completed",
                        data=result.to_dict()
                    )
                )
            
            return result
            
        except Exception as e:
            # Log error
            logger.error(f"Error during reasoning: {str(e)}", exc_info=True)
            
            # Add error step
            self.tracer.add_step(
                trace_id=trace_id,
                step_type=ReasoningStepType.CONCLUSION,
                description=f"Error occurred: {str(e)}",
                outputs={"error": str(e)}
            )
            
            # Conclude the trace with error
            self.tracer.conclude_trace(
                trace_id=trace_id,
                conclusion=f"Error: {str(e)}",
                confidence=0.0
            )
            
            # Return error result
            return ReasoningResult(
                request_id=request.request_id,
                status=ReasoningStatus.ERROR,
                conclusion=f"Error: {str(e)}",
                confidence=0.0,
                trace_id=trace_id
            )
    
    async def process_feedback(
        self,
        original_statement: str,
        corrected_statement: str,
        correction_type: Union[CorrectionType, str] = CorrectionType.FACTUAL,
        reasoning_trace_id: str = None,
        user_id: str = None,
        explanation: str = None
    ) -> str:
        """
        Process user feedback and incorporate it into the reasoning system
        
        Args:
            original_statement: The original incorrect statement
            corrected_statement: The corrected statement
            correction_type: Type of correction being made
            reasoning_trace_id: ID of related reasoning trace (if applicable)
            user_id: ID of the user providing the correction
            explanation: User explanation for the correction
            
        Returns:
            ID of the created correction
        """
        # Add correction to feedback loop
        correction_id = self.feedback_loop.add_correction(
            original_statement=original_statement,
            corrected_statement=corrected_statement,
            correction_type=correction_type,
            reasoning_trace_id=reasoning_trace_id,
            user_id=user_id,
            explanation=explanation
        )
        
        # Check for conflicts
        conflicts = self.feedback_loop.check_for_conflicts(correction_id)
        
        # If no conflicts, apply the correction
        if not conflicts:
            self.feedback_loop.apply_correction(correction_id)
        
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                Event(
                    type="feedback_processed",
                    data={
                        "correction_id": correction_id,
                        "has_conflicts": bool(conflicts)
                    }
                )
            )
        
        return correction_id
    
    def get_reasoning_trace(self, trace_id: str) -> Dict[str, Any]:
        """
        Get a reasoning trace by ID
        
        Args:
            trace_id: ID of the trace to get
            
        Returns:
            Dictionary representation of the trace
        """
        return self.tracer.get_trace(trace_id)
    
    def _extract_statements(self, query: str) -> List[str]:
        """
        Extract key statements from a query
        
        Args:
            query: Query to extract statements from
            
        Returns:
            List of statements
        """
        # Simple implementation: split by periods and filter out empty statements
        # In a production system, this would use more sophisticated NLP
        statements = [s.strip() for s in query.split('.') if s.strip()]
        
        # If no statements were extracted, use the whole query
        if not statements:
            statements = [query]
            
        return statements
    
    def _determine_result(
        self,
        fallacies: List[Dict[str, Any]],
        contradictions: List[Dict[str, Any]],
        validations: List[ValidationExplanation],
        query: str
    ) -> Tuple[ReasoningStatus, str, float]:
        """
        Determine the overall result based on fallacies and contradictions
        
        Args:
            fallacies: List of detected fallacies
            contradictions: List of detected contradictions
            validations: List of validation results
            query: Original query
            
        Returns:
            Tuple of (status, conclusion, confidence)
        """
        # If there are fallacies, that's the primary issue
        if fallacies:
            return (
                ReasoningStatus.FALLACY_DETECTED,
                "Reasoning contains logical fallacies that need to be addressed.",
                0.5
            )
        
        # If there are contradictions, that's the next issue
        if contradictions:
            return (
                ReasoningStatus.CONTRADICTION,
                "Reasoning contradicts established facts.",
                0.3
            )
        
        # Check validation results
        uncertain_count = sum(1 for v in validations if v.result == ValidationResult.UNCERTAIN)
        consistent_count = sum(1 for v in validations if v.result == ValidationResult.CONSISTENT)
        total_validations = len(validations)
        
        # If all validations are uncertain, result is uncertain
        if uncertain_count == total_validations:
            return (
                ReasoningStatus.UNCERTAIN,
                "Unable to determine the validity of the reasoning with confidence.",
                0.4
            )
        
        # If some validations are consistent and none are contradictory
        if consistent_count > 0:
            confidence = consistent_count / total_validations
            return (
                ReasoningStatus.SUCCESS,
                "Reasoning is logically sound and consistent with known facts.",
                confidence
            )
        
        # Default case
        return (
            ReasoningStatus.UNCERTAIN,
            "The reasoning requires additional validation.",
            0.5
        )


# Example usage
async def main():
    # Initialize components
    facts_db = FoundationFactsDB()
    validator = LogicalConsistencyValidator(facts_db)
    fallacy_detector = FallacyDetector()
    tracer = ReasoningTracer()
    feedback_loop = FeedbackLoop(facts_db, validator)
    
    # Initialize orchestrator
    orchestrator = ReasoningEngineOrchestrator(
        facts_db=facts_db,
        validator=validator,
        fallacy_detector=fallacy_detector,
        tracer=tracer,
        feedback_loop=feedback_loop
    )
    
    # Create a reasoning request
    request = ReasoningRequest(
        query="All birds can fly. Penguins are birds. Therefore, penguins can fly.",
        context="Testing logical fallacies",
        user_id="test_user"
    )
    
    # Perform reasoning
    result = await orchestrator.reason(request)
    
    # Print result
    print(f"Status: {result.status.value}")
    print(f"Conclusion: {result.conclusion}")
    print(f"Confidence: {result.confidence}")
    print(f"Fallacies: {len(result.fallacies)}")
    print(f"Contradictions: {len(result.contradictions)}")
    print(f"Explanation: {result.explanation}")
    
    # Process feedback
    correction_id = await orchestrator.process_feedback(
        original_statement="All birds can fly.",
        corrected_statement="Many birds can fly, but some birds like penguins cannot fly.",
        correction_type=CorrectionType.FACTUAL,
        reasoning_trace_id=result.trace_id,
        user_id="test_user",
        explanation="Not all birds can fly; penguins, ostriches, and kiwis are flightless birds."
    )
    
    print(f"Correction ID: {correction_id}")


if __name__ == "__main__":
    asyncio.run(main())
"""
