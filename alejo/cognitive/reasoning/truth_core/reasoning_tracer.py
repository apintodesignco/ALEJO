"""
Reasoning Tracer

This module provides a system for tracing and recording the reasoning steps
taken by ALEJO during inference and decision-making processes. It ensures
transparency by creating detailed audit trails of reasoning chains.

Features:
- Recording of reasoning steps and decision points
- Visualization of reasoning chains
- Explanation generation for decisions
- Persistence of reasoning traces for later review
"""

import json
import uuid
import time
import logging
from typing import Dict, List, Any, Optional, Union
from enum import Enum
from datetime import datetime
from pathlib import Path
import os

from alejo.core.events import EventBus, Event
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class ReasoningStepType(Enum):
    """Types of reasoning steps"""
    FACT_RETRIEVAL = "fact_retrieval"       # Retrieving facts from knowledge base
    INFERENCE = "inference"                 # Drawing an inference
    VALIDATION = "validation"               # Validating a statement
    CONTRADICTION = "contradiction"         # Detecting a contradiction
    QUESTION = "question"                   # Asking a question
    ASSUMPTION = "assumption"               # Making an assumption
    CONCLUSION = "conclusion"               # Reaching a conclusion
    FALLACY_CHECK = "fallacy_check"         # Checking for logical fallacies


class ReasoningStep:
    """
    Represents a single step in a reasoning process
    """
    def __init__(
        self,
        step_type: ReasoningStepType,
        description: str,
        inputs: Dict[str, Any] = None,
        outputs: Dict[str, Any] = None,
        confidence: float = 1.0,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a reasoning step
        
        Args:
            step_type: Type of reasoning step
            description: Human-readable description of the step
            inputs: Input data for this step
            outputs: Output data from this step
            confidence: Confidence level for this step (0.0 to 1.0)
            metadata: Additional metadata for this step
        """
        self.step_id = str(uuid.uuid4())
        self.step_type = step_type
        self.description = description
        self.inputs = inputs or {}
        self.outputs = outputs or {}
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.metadata = metadata or {}
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert step to dictionary"""
        return {
            "step_id": self.step_id,
            "step_type": self.step_type.value,
            "description": self.description,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "timestamp": self.timestamp
        }


class ReasoningTrace:
    """
    A complete trace of reasoning steps for a single reasoning process
    """
    def __init__(
        self,
        context: str,
        query: str = None,
        user_id: str = None,
        session_id: str = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a reasoning trace
        
        Args:
            context: Context in which reasoning is performed
            query: Original query or problem statement
            user_id: ID of the user (if applicable)
            session_id: ID of the session (if applicable)
            metadata: Additional metadata for this trace
        """
        self.trace_id = str(uuid.uuid4())
        self.context = context
        self.query = query
        self.user_id = user_id
        self.session_id = session_id
        self.metadata = metadata or {}
        self.steps: List[ReasoningStep] = []
        self.start_time = datetime.now().isoformat()
        self.end_time = None
        self.conclusion = None
        self.confidence = None
    
    def add_step(self, step: ReasoningStep) -> str:
        """
        Add a reasoning step to the trace
        
        Args:
            step: Reasoning step to add
            
        Returns:
            ID of the added step
        """
        self.steps.append(step)
        return step.step_id
    
    def create_step(
        self,
        step_type: ReasoningStepType,
        description: str,
        inputs: Dict[str, Any] = None,
        outputs: Dict[str, Any] = None,
        confidence: float = 1.0,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create and add a reasoning step
        
        Args:
            step_type: Type of reasoning step
            description: Human-readable description of the step
            inputs: Input data for this step
            outputs: Output data from this step
            confidence: Confidence level for this step (0.0 to 1.0)
            metadata: Additional metadata for this step
            
        Returns:
            ID of the created step
        """
        step = ReasoningStep(
            step_type=step_type,
            description=description,
            inputs=inputs,
            outputs=outputs,
            confidence=confidence,
            metadata=metadata
        )
        return self.add_step(step)
    
    def conclude(self, conclusion: str, confidence: float) -> None:
        """
        Mark the trace as concluded
        
        Args:
            conclusion: Final conclusion of the reasoning process
            confidence: Overall confidence in the conclusion (0.0 to 1.0)
        """
        self.conclusion = conclusion
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.end_time = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert trace to dictionary"""
        return {
            "trace_id": self.trace_id,
            "context": self.context,
            "query": self.query,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "metadata": self.metadata,
            "steps": [step.to_dict() for step in self.steps],
            "start_time": self.start_time,
            "end_time": self.end_time,
            "conclusion": self.conclusion,
            "confidence": self.confidence
        }


class ReasoningTracer:
    """
    System for tracing reasoning processes
    """
    def __init__(self, event_bus: Optional[EventBus] = None):
        """
        Initialize the reasoning tracer
        
        Args:
            event_bus: Event bus for publishing trace events
        """
        self.event_bus = event_bus
        self.active_traces: Dict[str, ReasoningTrace] = {}
        self.storage_path = self._get_storage_path()
        self._ensure_storage_path_exists()
        logger.info("Reasoning Tracer initialized")
    
    def _get_storage_path(self) -> Path:
        """Get the path for storing reasoning traces"""
        home_dir = Path.home()
        return home_dir / ".alejo" / "cognitive" / "traces"
    
    def _ensure_storage_path_exists(self) -> None:
        """Ensure the storage path exists"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    @handle_exceptions
    def start_trace(
        self,
        context: str,
        query: str = None,
        user_id: str = None,
        session_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Start a new reasoning trace
        
        Args:
            context: Context in which reasoning is performed
            query: Original query or problem statement
            user_id: ID of the user (if applicable)
            session_id: ID of the session (if applicable)
            metadata: Additional metadata for this trace
            
        Returns:
            ID of the created trace
        """
        trace = ReasoningTrace(
            context=context,
            query=query,
            user_id=user_id,
            session_id=session_id,
            metadata=metadata
        )
        
        self.active_traces[trace.trace_id] = trace
        
        if self.event_bus:
            self.event_bus.publish(
                Event(
                    "reasoning.trace.started",
                    {
                        "trace_id": trace.trace_id,
                        "context": context,
                        "query": query,
                        "user_id": user_id,
                        "session_id": session_id
                    }
                )
            )
        
        return trace.trace_id
    
    @handle_exceptions
    def add_step(
        self,
        trace_id: str,
        step_type: ReasoningStepType,
        description: str,
        inputs: Dict[str, Any] = None,
        outputs: Dict[str, Any] = None,
        confidence: float = 1.0,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Add a step to an active reasoning trace
        
        Args:
            trace_id: ID of the trace to add the step to
            step_type: Type of reasoning step
            description: Human-readable description of the step
            inputs: Input data for this step
            outputs: Output data from this step
            confidence: Confidence level for this step (0.0 to 1.0)
            metadata: Additional metadata for this step
            
        Returns:
            ID of the created step
        """
        if trace_id not in self.active_traces:
            raise ValueError(f"No active trace with ID {trace_id}")
        
        trace = self.active_traces[trace_id]
        step_id = trace.create_step(
            step_type=step_type,
            description=description,
            inputs=inputs,
            outputs=outputs,
            confidence=confidence,
            metadata=metadata
        )
        
        if self.event_bus:
            self.event_bus.publish(
                Event(
                    "reasoning.trace.step_added",
                    {
                        "trace_id": trace_id,
                        "step_id": step_id,
                        "step_type": step_type.value,
                        "description": description
                    }
                )
            )
        
        return step_id
    
    @handle_exceptions
    def conclude_trace(
        self,
        trace_id: str,
        conclusion: str,
        confidence: float
    ) -> Dict[str, Any]:
        """
        Conclude a reasoning trace
        
        Args:
            trace_id: ID of the trace to conclude
            conclusion: Final conclusion of the reasoning process
            confidence: Overall confidence in the conclusion (0.0 to 1.0)
            
        Returns:
            Dictionary representation of the completed trace
        """
        if trace_id not in self.active_traces:
            raise ValueError(f"No active trace with ID {trace_id}")
        
        trace = self.active_traces[trace_id]
        trace.conclude(conclusion=conclusion, confidence=confidence)
        
        # Save the trace
        trace_dict = trace.to_dict()
        self._save_trace(trace_dict)
        
        if self.event_bus:
            self.event_bus.publish(
                Event(
                    "reasoning.trace.concluded",
                    {
                        "trace_id": trace_id,
                        "conclusion": conclusion,
                        "confidence": confidence
                    }
                )
            )
        
        # Remove from active traces
        del self.active_traces[trace_id]
        
        return trace_dict
    
    @handle_exceptions
    def get_trace(self, trace_id: str) -> Dict[str, Any]:
        """
        Get a trace by ID
        
        Args:
            trace_id: ID of the trace to get
            
        Returns:
            Dictionary representation of the trace
        """
        # Check active traces first
        if trace_id in self.active_traces:
            return self.active_traces[trace_id].to_dict()
        
        # Check saved traces
        trace_path = self.storage_path / f"{trace_id}.json"
        if trace_path.exists():
            with open(trace_path, "r", encoding="utf-8") as f:
                return json.load(f)
        
        raise ValueError(f"No trace found with ID {trace_id}")
    
    @handle_exceptions
    def list_traces(
        self,
        user_id: str = None,
        session_id: str = None,
        start_date: str = None,
        end_date: str = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List traces matching the given criteria
        
        Args:
            user_id: Filter by user ID
            session_id: Filter by session ID
            start_date: Filter by start date (ISO format)
            end_date: Filter by end date (ISO format)
            limit: Maximum number of traces to return
            
        Returns:
            List of trace summaries
        """
        # Get all trace files
        trace_files = list(self.storage_path.glob("*.json"))
        
        # Sort by modification time (newest first)
        trace_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        
        results = []
        for trace_file in trace_files[:limit]:
            try:
                with open(trace_file, "r", encoding="utf-8") as f:
                    trace = json.load(f)
                
                # Apply filters
                if user_id and trace.get("user_id") != user_id:
                    continue
                
                if session_id and trace.get("session_id") != session_id:
                    continue
                
                if start_date and trace.get("start_time", "") < start_date:
                    continue
                
                if end_date and trace.get("start_time", "") > end_date:
                    continue
                
                # Add summary to results
                results.append({
                    "trace_id": trace.get("trace_id"),
                    "context": trace.get("context"),
                    "query": trace.get("query"),
                    "start_time": trace.get("start_time"),
                    "end_time": trace.get("end_time"),
                    "conclusion": trace.get("conclusion"),
                    "confidence": trace.get("confidence"),
                    "step_count": len(trace.get("steps", []))
                })
                
                if len(results) >= limit:
                    break
                    
            except Exception as e:
                logger.error(f"Error reading trace file {trace_file}: {e}")
        
        return results
    
    @handle_exceptions
    def _save_trace(self, trace: Dict[str, Any]) -> None:
        """
        Save a trace to storage
        
        Args:
            trace: Trace dictionary to save
        """
        trace_id = trace.get("trace_id")
        if not trace_id:
            raise ValueError("Trace has no ID")
        
        trace_path = self.storage_path / f"{trace_id}.json"
        
        with open(trace_path, "w", encoding="utf-8") as f:
            json.dump(trace, f, indent=2)
    
    @handle_exceptions
    def generate_explanation(self, trace_id: str, detail_level: str = "medium") -> str:
        """
        Generate a human-readable explanation of a reasoning trace
        
        Args:
            trace_id: ID of the trace to explain
            detail_level: Level of detail ("low", "medium", "high")
            
        Returns:
            Human-readable explanation
        """
        trace_dict = self.get_trace(trace_id)
        
        if not trace_dict:
            return "No trace found with the given ID."
        
        # Generate explanation based on detail level
        if detail_level == "low":
            return self._generate_low_detail_explanation(trace_dict)
        elif detail_level == "high":
            return self._generate_high_detail_explanation(trace_dict)
        else:  # medium is default
            return self._generate_medium_detail_explanation(trace_dict)
    
    def _generate_low_detail_explanation(self, trace: Dict[str, Any]) -> str:
        """Generate a low-detail explanation"""
        query = trace.get("query", "")
        conclusion = trace.get("conclusion", "")
        confidence = trace.get("confidence", 0)
        
        explanation = f"Query: {query}\n\n"
        explanation += f"Conclusion: {conclusion}\n"
        explanation += f"Confidence: {confidence:.2f}\n"
        
        return explanation
    
    def _generate_medium_detail_explanation(self, trace: Dict[str, Any]) -> str:
        """Generate a medium-detail explanation"""
        query = trace.get("query", "")
        conclusion = trace.get("conclusion", "")
        confidence = trace.get("confidence", 0)
        steps = trace.get("steps", [])
        
        explanation = f"Query: {query}\n\n"
        explanation += "Reasoning process:\n"
        
        for i, step in enumerate(steps):
            step_type = step.get("step_type", "")
            description = step.get("description", "")
            step_confidence = step.get("confidence", 1.0)
            
            explanation += f"{i+1}. [{step_type}] {description} (confidence: {step_confidence:.2f})\n"
        
        explanation += f"\nConclusion: {conclusion}\n"
        explanation += f"Overall confidence: {confidence:.2f}\n"
        
        return explanation
    
    def _generate_high_detail_explanation(self, trace: Dict[str, Any]) -> str:
        """Generate a high-detail explanation"""
        query = trace.get("query", "")
        context = trace.get("context", "")
        conclusion = trace.get("conclusion", "")
        confidence = trace.get("confidence", 0)
        steps = trace.get("steps", [])
        
        explanation = f"Context: {context}\n"
        explanation += f"Query: {query}\n\n"
        explanation += "Detailed reasoning process:\n"
        
        for i, step in enumerate(steps):
            step_type = step.get("step_type", "")
            description = step.get("description", "")
            step_confidence = step.get("confidence", 1.0)
            inputs = step.get("inputs", {})
            outputs = step.get("outputs", {})
            
            explanation += f"\nStep {i+1}: [{step_type}] {description}\n"
            explanation += f"Confidence: {step_confidence:.2f}\n"
            
            if inputs:
                explanation += "Inputs:\n"
                for k, v in inputs.items():
                    explanation += f"  - {k}: {v}\n"
            
            if outputs:
                explanation += "Outputs:\n"
                for k, v in outputs.items():
                    explanation += f"  - {k}: {v}\n"
        
        explanation += f"\nFinal conclusion: {conclusion}\n"
        explanation += f"Overall confidence: {confidence:.2f}\n"
        
        return explanation
