"""ALEJO - Advanced Language and Execution Joint Operator
Ethical Decisions - Implementation of ethical decision making components
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Dict, List, Optional, Set, Tuple, Any, Union, Callable
from uuid import uuid4

from alejo.cognitive.ethical.principles import EthicalPrinciple, PrincipleRegistry
from alejo.cognitive.ethical.value_system import Value, ValueSystem

logger = logging.getLogger(__name__)


class DecisionImpact(Enum):
    """Impact levels for decisions."""
    HIGH_POSITIVE = 3    # Significant positive impact
    MEDIUM_POSITIVE = 2  # Moderate positive impact
    LOW_POSITIVE = 1     # Slight positive impact
    NEUTRAL = 0          # No significant impact
    LOW_NEGATIVE = -1    # Slight negative impact
    MEDIUM_NEGATIVE = -2 # Moderate negative impact
    HIGH_NEGATIVE = -3   # Significant negative impact


@dataclass
class Alternative:
    """Represents a possible alternative in an ethical decision."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    impacts: Dict[str, DecisionImpact] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert alternative to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "impacts": {k: v.name if isinstance(v, DecisionImpact) else v 
                       for k, v in self.impacts.items()},
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Alternative':
        """Create an Alternative from a dictionary representation."""
        # Convert impact strings to enum values
        impacts = {}
        for k, v in data.get("impacts", {}).items():
            if isinstance(v, str) and hasattr(DecisionImpact, v):
                impacts[k] = getattr(DecisionImpact, v)
            else:
                impacts[k] = v
                
        return cls(
            id=data.get("id", str(uuid4())),
            name=data.get("name", ""),
            description=data.get("description", ""),
            impacts=impacts,
            metadata=data.get("metadata", {})
        )


class EthicalDecision:
    """
    Represents an ethical decision with alternatives and their evaluations.
    
    An ethical decision involves evaluating multiple alternatives against
    ethical principles and values to determine the most ethically sound option.
    """
    
    def __init__(self, context: Dict[str, Any], alternatives: Optional[List[Alternative]] = None):
        """Initialize an ethical decision.
        
        Args:
            context: Context information for the decision
            alternatives: Optional list of alternatives to consider
        """
        self.id = str(uuid4())
        self.context = context
        self.alternatives = alternatives or []
        self.evaluations: Dict[str, Dict[str, float]] = {}  # Alternative ID -> {Principle ID -> score}
        self.created_at = datetime.now()
        self.decision_made = False
        self.selected_alternative_id: Optional[str] = None
        self.decision_rationale: str = ""
        
    def add_alternative(self, alternative: Union[Alternative, Dict[str, Any]]) -> str:
        """Add a possible alternative to the decision.
        
        Args:
            alternative: Alternative object or dictionary representation
            
        Returns:
            ID of the added alternative
        """
        if isinstance(alternative, dict):
            alternative = Alternative.from_dict(alternative)
            
        self.alternatives.append(alternative)
        return alternative.id
        
    async def evaluate_alternative(self, alternative_id: str, principles: List[EthicalPrinciple], 
                                  value_system: Optional[ValueSystem] = None) -> Dict[str, float]:
        """Evaluate an alternative against ethical principles.
        
        Args:
            alternative_id: ID of the alternative to evaluate
            principles: List of principles to evaluate against
            value_system: Optional value system to use for evaluation
            
        Returns:
            Dictionary mapping principle IDs to scores
        """
        # Find the alternative
        alternative = next((a for a in self.alternatives if a.id == alternative_id), None)
        if not alternative:
            logger.warning(f"Cannot evaluate non-existent alternative: {alternative_id}")
            return {}
            
        # Create context for evaluation
        eval_context = {
            **self.context,
            "alternative": alternative.to_dict(),
            "impacts": alternative.impacts
        }
        
        # Evaluate against each principle
        scores = {}
        for principle in principles:
            score = await self._evaluate_with_principle(principle, eval_context, value_system)
            scores[principle.id] = score
            
        # Store evaluation results
        self.evaluations[alternative_id] = scores
        
        return scores
        
    async def _evaluate_with_principle(self, principle: EthicalPrinciple, context: Dict[str, Any],
                                     value_system: Optional[ValueSystem] = None) -> float:
        """Evaluate a context with a specific principle.
        
        Args:
            principle: Principle to evaluate with
            context: Context to evaluate
            value_system: Optional value system to use
            
        Returns:
            Score between 0.0 and 1.0
        """
        try:
            return principle.evaluate(context, value_system)
        except Exception as e:
            logger.error(f"Error evaluating principle {principle.name}: {e}", exc_info=True)
            return 0.5  # Neutral score on error
        
    async def evaluate_all_alternatives(self, principles: List[EthicalPrinciple],
                                      value_system: Optional[ValueSystem] = None) -> Dict[str, Dict[str, float]]:
        """Evaluate all alternatives against all principles.
        
        Args:
            principles: List of principles to evaluate against
            value_system: Optional value system to use for evaluation
            
        Returns:
            Dictionary mapping alternative IDs to dictionaries of principle scores
        """
        results = {}
        for alternative in self.alternatives:
            scores = await self.evaluate_alternative(alternative.id, principles, value_system)
            results[alternative.id] = scores
            
        return results
        
    async def get_best_alternative(self, principle_weights: Optional[Dict[str, float]] = None) -> Optional[Alternative]:
        """Get the best alternative based on ethical evaluations.
        
        Args:
            principle_weights: Optional dictionary mapping principle IDs to weights
            
        Returns:
            Best alternative or None if no evaluations exist
        """
        if not self.evaluations or not self.alternatives:
            return None
            
        # Default weights are equal
        if not principle_weights:
            principle_ids = set()
            for scores in self.evaluations.values():
                principle_ids.update(scores.keys())
            principle_weights = {pid: 1.0 for pid in principle_ids}
            
        # Calculate weighted scores for each alternative
        weighted_scores = {}
        for alt_id, scores in self.evaluations.items():
            total_score = 0.0
            total_weight = 0.0
            
            for principle_id, score in scores.items():
                weight = principle_weights.get(principle_id, 1.0)
                total_score += score * weight
                total_weight += weight
                
            if total_weight > 0:
                weighted_scores[alt_id] = total_score / total_weight
            else:
                weighted_scores[alt_id] = 0.0
                
        # Find alternative with highest score
        if not weighted_scores:
            return None
            
        best_alt_id = max(weighted_scores.items(), key=lambda x: x[1])[0]
        best_alt = next((a for a in self.alternatives if a.id == best_alt_id), None)
        
        # Record the decision
        if best_alt:
            self.decision_made = True
            self.selected_alternative_id = best_alt_id
            self.decision_rationale = f"Selected alternative '{best_alt.name}' with highest weighted score: {weighted_scores[best_alt_id]:.2f}"
            
        return best_alt
        
    def get_alternative_by_id(self, alternative_id: str) -> Optional[Alternative]:
        """Get an alternative by ID.
        
        Args:
            alternative_id: ID of the alternative to retrieve
            
        Returns:
            Alternative object or None if not found
        """
        return next((a for a in self.alternatives if a.id == alternative_id), None)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert decision to dictionary representation."""
        return {
            "id": self.id,
            "context": self.context,
            "alternatives": [alt.to_dict() for alt in self.alternatives],
            "evaluations": self.evaluations,
            "created_at": self.created_at.isoformat(),
            "decision_made": self.decision_made,
            "selected_alternative_id": self.selected_alternative_id,
            "decision_rationale": self.decision_rationale
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EthicalDecision':
        """Create an EthicalDecision from a dictionary representation."""
        decision = cls(
            context=data.get("context", {}),
            alternatives=[Alternative.from_dict(alt) for alt in data.get("alternatives", [])]
        )
        
        decision.id = data.get("id", str(uuid4()))
        decision.evaluations = data.get("evaluations", {})
        
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            decision.created_at = datetime.fromisoformat(created_at)
            
        decision.decision_made = data.get("decision_made", False)
        decision.selected_alternative_id = data.get("selected_alternative_id")
        decision.decision_rationale = data.get("decision_rationale", "")
        
        return decision


class DecisionRegistry:
    """Registry for tracking and retrieving ethical decisions."""
    
    def __init__(self, event_bus=None, max_decisions=100):
        """Initialize the decision registry.
        
        Args:
            event_bus: Optional event bus for publishing decision-related events
            max_decisions: Maximum number of decisions to keep in memory
        """
        self.decisions: Dict[str, EthicalDecision] = {}
        self.event_bus = event_bus
        self.max_decisions = max_decisions
        self._lock = asyncio.Lock()
        
        logger.info("Decision registry initialized")
        
    async def add_decision(self, decision: EthicalDecision) -> str:
        """Add a decision to the registry.
        
        Args:
            decision: Decision to add
            
        Returns:
            ID of the added decision
        """
        async with self._lock:
            self.decisions[decision.id] = decision
            
            # Enforce size limit
            if len(self.decisions) > self.max_decisions:
                # Remove oldest decisions
                sorted_decisions = sorted(
                    self.decisions.items(),
                    key=lambda x: x[1].created_at
                )
                
                # Keep only the newest max_decisions
                to_remove = len(self.decisions) - self.max_decisions
                for i in range(to_remove):
                    del self.decisions[sorted_decisions[i][0]]
                    
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.decision.added",
                {"decision_id": decision.id},
                "decision_registry"
            )
            
        logger.debug(f"Added decision: {decision.id}")
        return decision.id
        
    async def get_decision(self, decision_id: str) -> Optional[EthicalDecision]:
        """Get a decision by ID.
        
        Args:
            decision_id: ID of the decision to retrieve
            
        Returns:
            Decision object or None if not found
        """
        return self.decisions.get(decision_id)
        
    async def get_recent_decisions(self, limit: int = 10) -> List[EthicalDecision]:
        """Get the most recent decisions.
        
        Args:
            limit: Maximum number of decisions to return
            
        Returns:
            List of recent decisions, newest first
        """
        sorted_decisions = sorted(
            self.decisions.values(),
            key=lambda d: d.created_at,
            reverse=True
        )
        
        return sorted_decisions[:limit]
        
    async def update_decision(self, decision_id: str, updates: Dict[str, Any]) -> Optional[EthicalDecision]:
        """Update an existing decision.
        
        Args:
            decision_id: ID of the decision to update
            updates: Dictionary of fields to update
            
        Returns:
            Updated decision or None if not found
        """
        async with self._lock:
            if decision_id not in self.decisions:
                return None
                
            decision = self.decisions[decision_id]
            
            # Update fields
            for key, value in updates.items():
                if hasattr(decision, key):
                    setattr(decision, key, value)
                    
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.decision.updated",
                {"decision_id": decision_id},
                "decision_registry"
            )
            
        logger.debug(f"Updated decision: {decision_id}")
        return decision
