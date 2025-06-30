"""
ALEJO Ethical Framework
Handles value-based decision making and ethical principles enforcement.
"""

import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
import json
from datetime import datetime

from ...core.events import Event, EventType
from ...utils.error_handling import handle_errors

@dataclass
class EthicalPrinciple:
    """Represents an ethical principle with its importance and context."""
    id: str
    name: str
    description: str
    importance: float  # 0 to 1
    category: str
    examples: List[Dict[str, Any]]
    constraints: List[str]

@dataclass
class ValueSystem:
    """Represents the system of values and their relationships."""
    principles: Dict[str, EthicalPrinciple]
    relationships: Dict[str, List[str]]  # principle_id -> related principle_ids
    priorities: Dict[str, float]  # principle_id -> priority weight

@dataclass
class EthicalDecision:
    """Records an ethical decision and its reasoning."""
    id: str
    timestamp: str
    context: Dict[str, Any]
    options: List[Dict[str, Any]]
    chosen_option: Dict[str, Any]
    principles_applied: List[str]
    reasoning: str
    feedback: Optional[Dict[str, Any]] = None

class EthicalFramework:
    """
    Manages ethical decision making and value alignment.
    
    Features:
    - Value-based decision making
    - Ethical principles enforcement
    - Learning from feedback
    - Contextual ethics application
    """
    
    def __init__(self, event_bus=None, config: Dict[str, Any] = None):
        """
        Initialize ethical framework.
        
        Args:
            event_bus: Event bus for system communication
            config: Configuration options
        """
        self.event_bus = event_bus
        self.config = config or {}
        
        # Initialize value system with core principles
        self.value_system = self._init_value_system()
        
        # Decision history
        self.decisions: List[EthicalDecision] = []
        
        # Learning parameters
        self.learning_rate = self.config.get('learning_rate', 0.1)
        self.feedback_threshold = self.config.get('feedback_threshold', 0.7)
        
    def _init_value_system(self) -> ValueSystem:
        """Initialize the core value system."""
        principles = {
            'beneficence': EthicalPrinciple(
                id='beneficence',
                name='Beneficence',
                description='Act in the best interest of users and society',
                importance=0.9,
                category='core',
                examples=[
                    {'action': 'Provide helpful information', 'alignment': 1.0},
                    {'action': 'Protect user privacy', 'alignment': 0.9}
                ],
                constraints=[
                    'Never intentionally cause harm',
                    'Prioritize user wellbeing'
                ]
            ),
            'autonomy': EthicalPrinciple(
                id='autonomy',
                name='Autonomy',
                description='Respect user independence and self-determination',
                importance=0.85,
                category='core',
                examples=[
                    {'action': 'Allow user to make informed choices', 'alignment': 1.0},
                    {'action': 'Be transparent about capabilities', 'alignment': 0.9}
                ],
                constraints=[
                    'Never manipulate or deceive',
                    'Respect user choices'
                ]
            ),
            'justice': EthicalPrinciple(
                id='justice',
                name='Justice',
                description='Treat all users fairly and equally',
                importance=0.8,
                category='core',
                examples=[
                    {'action': 'Provide equal access to features', 'alignment': 1.0},
                    {'action': 'Apply rules consistently', 'alignment': 0.9}
                ],
                constraints=[
                    'No discrimination',
                    'Fair resource allocation'
                ]
            ),
            'non_maleficence': EthicalPrinciple(
                id='non_maleficence',
                name='Non-maleficence',
                description='Avoid causing harm',
                importance=0.95,
                category='core',
                examples=[
                    {'action': 'Prevent misuse of information', 'alignment': 1.0},
                    {'action': 'Protect user safety', 'alignment': 0.9}
                ],
                constraints=[
                    'No harmful actions',
                    'Minimize negative impacts'
                ]
            ),
            'privacy': EthicalPrinciple(
                id='privacy',
                name='Privacy',
                description='Protect user privacy and data',
                importance=0.9,
                category='operational',
                examples=[
                    {'action': 'Secure data handling', 'alignment': 1.0},
                    {'action': 'Minimal data collection', 'alignment': 0.9}
                ],
                constraints=[
                    'No unauthorized data sharing',
                    'Data minimization'
                ]
            )
        }
        
        # Define relationships between principles
        relationships = {
            'beneficence': ['non_maleficence', 'justice'],
            'autonomy': ['privacy', 'justice'],
            'justice': ['beneficence', 'autonomy'],
            'non_maleficence': ['beneficence', 'privacy'],
            'privacy': ['autonomy', 'non_maleficence']
        }
        
        # Set initial priorities
        priorities = {p.id: p.importance for p in principles.values()}
        
        return ValueSystem(principles, relationships, priorities)
        
    async def start(self):
        """Start ethical framework and subscribe to events."""
        if self.event_bus:
            await self.event_bus.subscribe(EventType.DECISION, self._handle_decision)
            await self.event_bus.subscribe(EventType.FEEDBACK, self._handle_feedback)
            
    async def stop(self):
        """Stop ethical framework and cleanup."""
        if self.event_bus:
            await self.event_bus.unsubscribe(EventType.DECISION, self._handle_decision)
            await self.event_bus.unsubscribe(EventType.FEEDBACK, self._handle_feedback)
            
    @handle_errors(component='ethical_framework')
    async def evaluate_action(self,
                            action: Dict[str, Any],
                            context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate an action against ethical principles.
        
        Args:
            action: Proposed action details
            context: Current context
            
        Returns:
            Evaluation results with ethical analysis
        """
        scores = {}
        violations = []
        
        for principle in self.value_system.principles.values():
            # Check against principle constraints
            for constraint in principle.constraints:
                if self._violates_constraint(action, constraint):
                    violations.append({
                        'principle': principle.id,
                        'constraint': constraint
                    })
                    
            # Score alignment with principle
            score = self._calculate_alignment(action, principle, context)
            scores[principle.id] = score
            
        # Calculate weighted average score
        total_score = 0
        total_weight = 0
        for principle_id, score in scores.items():
            weight = self.value_system.priorities[principle_id]
            total_score += score * weight
            total_weight += weight
            
        ethical_score = total_score / total_weight if total_weight > 0 else 0
        
        return {
            'ethical_score': ethical_score,
            'principle_scores': scores,
            'violations': violations,
            'approved': ethical_score >= self.config.get('approval_threshold', 0.7) and not violations
        }
        
    @handle_errors(component='ethical_framework')
    async def make_decision(self,
                          options: List[Dict[str, Any]],
                          context: Dict[str, Any]) -> EthicalDecision:
        """
        Make an ethical decision among options.
        
        Args:
            options: List of possible actions
            context: Current context
            
        Returns:
            Decision with chosen option and reasoning
        """
        evaluations = []
        for option in options:
            eval_result = await self.evaluate_action(option, context)
            evaluations.append((option, eval_result))
            
        # Sort by ethical score, filtering out options with violations
        valid_options = [(opt, eval_) for opt, eval_ in evaluations if not eval_['violations']]
        if not valid_options:
            raise ValueError("No ethically valid options available")
            
        chosen_option, best_eval = max(valid_options, key=lambda x: x[1]['ethical_score'])
        
        # Create decision record
        decision = EthicalDecision(
            id=f"decision_{len(self.decisions)}",
            timestamp=datetime.now().isoformat(),
            context=context,
            options=options,
            chosen_option=chosen_option,
            principles_applied=[p.id for p in self.value_system.principles.values()],
            reasoning=self._generate_reasoning(chosen_option, best_eval)
        )
        
        self.decisions.append(decision)
        return decision
        
    @handle_errors(component='ethical_framework')
    async def learn_from_feedback(self, decision_id: str, feedback: Dict[str, Any]):
        """
        Update ethical framework based on decision feedback.
        
        Args:
            decision_id: ID of the decision
            feedback: Feedback information
        """
        # Find the decision
        decision = next((d for d in self.decisions if d.id == decision_id), None)
        if not decision:
            raise ValueError(f"Decision {decision_id} not found")
            
        # Update decision with feedback
        decision.feedback = feedback
        
        # Adjust principle priorities based on feedback
        if 'principle_feedback' in feedback:
            for principle_id, rating in feedback['principle_feedback'].items():
                if principle_id in self.value_system.priorities:
                    current = self.value_system.priorities[principle_id]
                    adjustment = (rating - 0.5) * self.learning_rate
                    self.value_system.priorities[principle_id] = max(0.1, min(1.0, current + adjustment))
                    
    def _violates_constraint(self, action: Dict[str, Any], constraint: str) -> bool:
        """Check if an action violates an ethical constraint."""
        # Implementation would depend on constraint checking logic
        # This is a placeholder that could be expanded based on specific constraints
        return False
        
    def _calculate_alignment(self,
                           action: Dict[str, Any],
                           principle: EthicalPrinciple,
                           context: Dict[str, Any]) -> float:
        """Calculate how well an action aligns with a principle."""
        # Compare action with principle examples
        alignments = []
        for example in principle.examples:
            similarity = self._calculate_similarity(action, example['action'])
            alignments.append(similarity * example['alignment'])
            
        return max(alignments) if alignments else 0.5
        
    def _calculate_similarity(self, action1: Any, action2: Any) -> float:
        """Calculate similarity between two actions."""
        # This would be implemented with more sophisticated similarity metrics
        # Current implementation is a placeholder
        return 0.5
        
    def _generate_reasoning(self, option: Dict[str, Any], evaluation: Dict[str, Any]) -> str:
        """Generate explanation for ethical decision."""
        parts = [
            f"Selected option with ethical score: {evaluation['ethical_score']:.2f}",
            "Principle alignment:"
        ]
        
        for principle_id, score in evaluation['principle_scores'].items():
            principle = self.value_system.principles[principle_id]
            parts.append(f"- {principle.name}: {score:.2f}")
            
        return "\n".join(parts)
        
    async def _handle_decision(self, event: Event):
        """Handle decision events."""
        if 'options' in event.payload:
            decision = await self.make_decision(
                event.payload['options'],
                event.payload.get('context', {})
            )
            
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.DECISION,
                        source='ethical_framework',
                        payload={
                            'action': 'decision_made',
                            'decision': asdict(decision)
                        }
                    )
                )
                
    async def _handle_feedback(self, event: Event):
        """Handle feedback events."""
        if 'decision_id' in event.payload and 'feedback' in event.payload:
            await self.learn_from_feedback(
                event.payload['decision_id'],
                event.payload['feedback']
            )
