"""ALEJO - Advanced Language and Execution Joint Operator
Ethical Framework - Core ethical reasoning and decision-making components
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple, Any, Union, Callable
from uuid import uuid4

from alejo.cognitive.ethical.value_system import ValueSystem, ValuePriority
from alejo.cognitive.ethical.principles import PrincipleRegistry
from alejo.cognitive.ethical.decisions import EthicalDecision, Alternative, DecisionRegistry

logger = logging.getLogger(__name__)


class EthicalFramework:
    """
    Main ethical framework for decision making based on principles and values.
    
    This class integrates the ValueSystem, PrincipleRegistry, and DecisionRegistry
    to provide a comprehensive ethical reasoning and decision-making system.
    """
    
    def __init__(self, event_bus=None):
        """Initialize the ethical framework.
        
        Args:
            event_bus: Optional event bus for publishing ethical events
        """
        self.event_bus = event_bus
        self.value_system = ValueSystem(event_bus=event_bus)
        self.principle_registry = PrincipleRegistry(event_bus=event_bus)
        self.decision_registry = DecisionRegistry(event_bus=event_bus)
        self._lock = asyncio.Lock()
        
        logger.info("Ethical framework initialized")
        
    async def initialize(self):
        """Initialize the ethical framework components."""
        # This method can be used for any async initialization tasks
        # Currently, the component constructors handle their own initialization
        pass
        
    async def evaluate_action(self, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate an action against ethical principles.
        
        Args:
            action: Description of the action to evaluate
            context: Context in which the action would be performed
            
        Returns:
            Dictionary with evaluation results
        """
        # Create a decision with a single alternative
        decision = EthicalDecision(context=context)
        
        # Add the action as an alternative
        alternative = Alternative(
            name=action.get("name", "Proposed Action"),
            description=action.get("description", ""),
            impacts=action.get("impacts", {}),
            metadata=action.get("metadata", {})
        )
        
        decision.add_alternative(alternative)
        
        # Get all principles
        principles = await self.principle_registry.get_all_principles()
        
        # Evaluate the alternative
        await decision.evaluate_alternative(alternative.id, principles, self.value_system)
        
        # Store the decision
        await self.decision_registry.add_decision(decision)
        
        # Return evaluation results
        return {
            "decision_id": decision.id,
            "alternative_id": alternative.id,
            "evaluations": decision.evaluations.get(alternative.id, {}),
            "timestamp": datetime.now().isoformat()
        }
        
    async def make_ethical_decision(self, context: Dict[str, Any], 
                                  alternatives: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Make an ethical decision given multiple alternatives.
        
        Args:
            context: Context in which the decision is being made
            alternatives: List of alternative actions to consider
            
        Returns:
            Dictionary with the selected alternative and decision details
        """
        # Create a decision
        decision = EthicalDecision(context=context)
        
        # Add alternatives
        for alt_data in alternatives:
            alternative = Alternative(
                name=alt_data.get("name", ""),
                description=alt_data.get("description", ""),
                impacts=alt_data.get("impacts", {}),
                metadata=alt_data.get("metadata", {})
            )
            decision.add_alternative(alternative)
            
        # Get all principles
        principles = await self.principle_registry.get_all_principles()
        
        # Evaluate all alternatives
        await decision.evaluate_all_alternatives(principles, self.value_system)
        
        # Get principle weights from value system
        principle_weights = {}
        for principle in principles:
            weight = 1.0  # Default weight
            
            # Adjust weight based on related values
            for value_id, value_weight in principle.value_weights.items():
                value = await self.value_system.get_value(value_id)
                if value:
                    priority_factor = {
                        ValuePriority.CRITICAL: 2.0,
                        ValuePriority.HIGH: 1.5,
                        ValuePriority.MEDIUM: 1.0,
                        ValuePriority.LOW: 0.5
                    }.get(value.priority, 1.0)
                    
                    weight += value_weight * priority_factor
                    
            principle_weights[principle.id] = weight
            
        # Get best alternative
        best_alt = await decision.get_best_alternative(principle_weights)
        
        # Store the decision
        await self.decision_registry.add_decision(decision)
        
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.decision.made",
                {
                    "decision_id": decision.id,
                    "selected_alternative": best_alt.to_dict() if best_alt else None,
                    "context": context
                },
                "ethical_framework"
            )
            
        # Return decision results
        return {
            "decision_id": decision.id,
            "selected_alternative": best_alt.to_dict() if best_alt else None,
            "alternatives": [alt.to_dict() for alt in decision.alternatives],
            "evaluations": decision.evaluations,
            "rationale": decision.decision_rationale,
            "timestamp": datetime.now().isoformat()
        }
        
    async def check_ethical_compliance(self, action: Dict[str, Any], 
                                    threshold: float = 0.7) -> Dict[str, Any]:
        """Check if an action complies with ethical standards.
        
        Args:
            action: Description of the action to check
            threshold: Minimum score to be considered compliant
            
        Returns:
            Dictionary with compliance results
        """
        # Evaluate the action
        evaluation = await self.evaluate_action(action, {"compliance_check": True})
        
        # Calculate average score
        scores = evaluation.get("evaluations", {}).values()
        avg_score = sum(scores) / len(scores) if scores else 0.0
        
        # Determine compliance
        compliant = avg_score >= threshold
        
        # Return results
        return {
            "compliant": compliant,
            "score": avg_score,
            "threshold": threshold,
            "evaluation": evaluation,
            "timestamp": datetime.now().isoformat()
        }
        
    async def get_ethical_explanation(self, decision_id: str) -> Dict[str, Any]:
        """Get a detailed explanation of an ethical decision.
        
        Args:
            decision_id: ID of the decision to explain
            
        Returns:
            Dictionary with explanation details
        """
        # Get the decision
        decision = await self.decision_registry.get_decision(decision_id)
        if not decision:
            return {"error": f"Decision {decision_id} not found"}
            
        # Get principles used in evaluation
        principle_ids = set()
        for scores in decision.evaluations.values():
            principle_ids.update(scores.keys())
            
        principles = {}
        for pid in principle_ids:
            principle = await self.principle_registry.get_principle(pid)
            if principle:
                principles[pid] = {
                    "name": principle.name,
                    "description": principle.description,
                    "category": principle.category.name if hasattr(principle.category, "name") else principle.category
                }
                
        # Build explanation
        explanation = {
            "decision_id": decision.id,
            "context": decision.context,
            "alternatives": [alt.to_dict() for alt in decision.alternatives],
            "evaluations": decision.evaluations,
            "principles": principles,
            "selected_alternative_id": decision.selected_alternative_id,
            "rationale": decision.decision_rationale,
            "created_at": decision.created_at.isoformat()
        }
        
        return explanation
        
    async def add_custom_principle(self, principle_data: Dict[str, Any]) -> str:
        """Add a custom ethical principle to the framework.
        
        Args:
            principle_data: Dictionary with principle details
            
        Returns:
            ID of the added principle
        """
        return await self.principle_registry.add_principle(principle_data)
        
    async def get_value_conflicts(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify potential value conflicts in a given context.
        
        Args:
            context: Context to analyze for value conflicts
            
        Returns:
            List of identified value conflicts
        """
        # This is a placeholder for more sophisticated conflict detection
        # In a real implementation, this would analyze the context and identify
        # specific values that might be in conflict
        
        conflicts = []
        
        # Example implementation - detect conflicts based on context keywords
        values = await self.value_system.get_all_values()
        
        # Group values by category
        values_by_category = {}
        for value in values:
            if value.category not in values_by_category:
                values_by_category[value.category] = []
            values_by_category[value.category].append(value)
            
        # Check for potential conflicts between privacy and transparency
        if "privacy" in context.get("concerns", []) and "transparency" in context.get("concerns", []):
            privacy_values = [v for v in values if "privacy" in v.name.lower()]
            transparency_values = [v for v in values if "transparency" in v.name.lower()]
            
            if privacy_values and transparency_values:
                conflicts.append({
                    "values": [v.to_dict() for v in privacy_values + transparency_values],
                    "description": "Potential conflict between privacy and transparency requirements",
                    "severity": "medium"
                })
                
        # Check for conflicts between autonomy and beneficence
        if "autonomy" in context.get("concerns", []) and "welfare" in context.get("concerns", []):
            autonomy_values = [v for v in values if "autonomy" in v.name.lower()]
            beneficence_values = [v for v in values if "beneficence" in v.name.lower() or "welfare" in v.name.lower()]
            
            if autonomy_values and beneficence_values:
                conflicts.append({
                    "values": [v.to_dict() for v in autonomy_values + beneficence_values],
                    "description": "Potential conflict between respecting autonomy and ensuring welfare",
                    "severity": "high"
                })
                
        return conflicts
