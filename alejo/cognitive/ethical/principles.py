"""ALEJO - Advanced Language and Execution Joint Operator
Ethical Principles - Implementation of ethical principles for decision making
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Dict, List, Optional, Set, Tuple, Any, Union, Callable
from uuid import uuid4

from alejo.cognitive.ethical.value_system import Value, ValueSystem

logger = logging.getLogger(__name__)


class PrincipleCategory(Enum):
    """Categories of ethical principles."""
    CONSEQUENTIALIST = auto()  # Focused on outcomes and consequences
    DEONTOLOGICAL = auto()     # Focused on duties, rights, and obligations
    VIRTUE_ETHICS = auto()     # Focused on character and virtues
    CARE_ETHICS = auto()       # Focused on relationships and care
    JUSTICE = auto()           # Focused on fairness and equality
    CUSTOM = auto()            # User-defined principles


@dataclass
class EthicalPrinciple:
    """
    Represents an ethical principle that can be applied in decision making.
    
    Ethical principles are more specific than values and provide concrete
    guidelines for evaluating actions and decisions.
    """
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    category: PrincipleCategory = PrincipleCategory.CUSTOM
    value_weights: Dict[str, float] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    modified_at: datetime = field(default_factory=datetime.now)
    attributes: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert principle to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.name if isinstance(self.category, PrincipleCategory) else self.category,
            "value_weights": self.value_weights,
            "created_at": self.created_at.isoformat(),
            "modified_at": self.modified_at.isoformat(),
            "attributes": self.attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EthicalPrinciple':
        """Create an EthicalPrinciple from a dictionary representation."""
        # Handle category conversion
        category = data.get("category")
        if isinstance(category, str) and hasattr(PrincipleCategory, category):
            category = getattr(PrincipleCategory, category)
        else:
            category = PrincipleCategory.CUSTOM
            
        # Handle datetime conversion
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        else:
            created_at = datetime.now()
            
        modified_at = data.get("modified_at")
        if isinstance(modified_at, str):
            modified_at = datetime.fromisoformat(modified_at)
        else:
            modified_at = datetime.now()
            
        return cls(
            id=data.get("id", str(uuid4())),
            name=data.get("name", ""),
            description=data.get("description", ""),
            category=category,
            value_weights=data.get("value_weights", {}),
            created_at=created_at,
            modified_at=modified_at,
            attributes=data.get("attributes", {})
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate this principle in a given context.
        
        This is a base implementation that should be overridden by specific principles.
        
        Args:
            context: The context to evaluate the principle in
            value_system: Optional value system to use for evaluation
            
        Returns:
            A score between 0.0 and 1.0 representing how well the context aligns with this principle
        """
        # Base implementation just returns a neutral score
        return 0.5


class UtilitarianPrinciple(EthicalPrinciple):
    """Principle that evaluates actions based on their consequences for overall well-being."""
    
    def __init__(self, **kwargs):
        super().__init__(
            name=kwargs.get("name", "Utilitarian Principle"),
            description=kwargs.get("description", "Maximize overall well-being and minimize harm"),
            category=PrincipleCategory.CONSEQUENTIALIST,
            **kwargs
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate based on utilitarian principles.
        
        Args:
            context: Must contain 'outcomes' with expected impacts on well-being
            value_system: Optional value system to use for evaluation
            
        Returns:
            Score between 0.0 and 1.0, with higher scores for greater overall well-being
        """
        if "outcomes" not in context:
            logger.warning("Cannot evaluate utilitarian principle without outcomes")
            return 0.5
            
        outcomes = context["outcomes"]
        
        # Calculate total well-being impact
        total_impact = 0.0
        num_entities = 0
        
        for entity, impact in outcomes.items():
            if isinstance(impact, (int, float)):
                total_impact += impact
                num_entities += 1
                
        if num_entities == 0:
            return 0.5
            
        # Normalize to 0-1 range
        avg_impact = total_impact / num_entities
        
        # Map from [-1, 1] to [0, 1] range
        normalized_score = (avg_impact + 1) / 2
        
        return max(0.0, min(1.0, normalized_score))


class DeontologicalPrinciple(EthicalPrinciple):
    """Principle that evaluates actions based on adherence to duties and rules."""
    
    def __init__(self, **kwargs):
        super().__init__(
            name=kwargs.get("name", "Deontological Principle"),
            description=kwargs.get("description", "Adhere to moral duties and respect rights"),
            category=PrincipleCategory.DEONTOLOGICAL,
            **kwargs
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate based on deontological principles.
        
        Args:
            context: Must contain 'duties' with duties and their fulfillment status
            value_system: Optional value system to use for evaluation
            
        Returns:
            Score between 0.0 and 1.0, with higher scores for better duty fulfillment
        """
        if "duties" not in context:
            logger.warning("Cannot evaluate deontological principle without duties")
            return 0.5
            
        duties = context["duties"]
        
        # Calculate duty fulfillment
        fulfilled = 0
        total = len(duties)
        
        if total == 0:
            return 0.5
            
        for duty, status in duties.items():
            if status:
                fulfilled += 1
                
        return fulfilled / total


class VirtueEthicsPrinciple(EthicalPrinciple):
    """Principle that evaluates actions based on character virtues."""
    
    def __init__(self, **kwargs):
        super().__init__(
            name=kwargs.get("name", "Virtue Ethics Principle"),
            description=kwargs.get("description", "Act according to virtuous character traits"),
            category=PrincipleCategory.VIRTUE_ETHICS,
            **kwargs
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate based on virtue ethics principles.
        
        Args:
            context: Must contain 'virtues' with virtues and their expression levels
            value_system: Optional value system to use for evaluation
            
        Returns:
            Score between 0.0 and 1.0, with higher scores for better virtue expression
        """
        if "virtues" not in context:
            logger.warning("Cannot evaluate virtue ethics principle without virtues")
            return 0.5
            
        virtues = context["virtues"]
        
        # Calculate virtue expression
        total_expression = 0.0
        num_virtues = len(virtues)
        
        if num_virtues == 0:
            return 0.5
            
        for virtue, expression in virtues.items():
            if isinstance(expression, (int, float)):
                total_expression += max(0.0, min(1.0, expression))
                
        return total_expression / num_virtues


class CareEthicsPrinciple(EthicalPrinciple):
    """Principle that evaluates actions based on care and relationships."""
    
    def __init__(self, **kwargs):
        super().__init__(
            name=kwargs.get("name", "Care Ethics Principle"),
            description=kwargs.get("description", "Prioritize care and maintenance of relationships"),
            category=PrincipleCategory.CARE_ETHICS,
            **kwargs
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate based on care ethics principles.
        
        Args:
            context: Must contain 'relationships' with relationship impacts
            value_system: Optional value system to use for evaluation
            
        Returns:
            Score between 0.0 and 1.0, with higher scores for better relationship care
        """
        if "relationships" not in context:
            logger.warning("Cannot evaluate care ethics principle without relationships")
            return 0.5
            
        relationships = context["relationships"]
        
        # Calculate relationship care
        total_care = 0.0
        num_relationships = len(relationships)
        
        if num_relationships == 0:
            return 0.5
            
        for relationship, care in relationships.items():
            if isinstance(care, (int, float)):
                total_care += max(0.0, min(1.0, care))
                
        return total_care / num_relationships


class JusticePrinciple(EthicalPrinciple):
    """Principle that evaluates actions based on fairness and equality."""
    
    def __init__(self, **kwargs):
        super().__init__(
            name=kwargs.get("name", "Justice Principle"),
            description=kwargs.get("description", "Ensure fair and equal treatment"),
            category=PrincipleCategory.JUSTICE,
            **kwargs
        )
    
    def evaluate(self, context: Dict[str, Any], value_system: Optional[ValueSystem] = None) -> float:
        """
        Evaluate based on justice principles.
        
        Args:
            context: Must contain 'fairness' with fairness metrics
            value_system: Optional value system to use for evaluation
            
        Returns:
            Score between 0.0 and 1.0, with higher scores for better fairness
        """
        if "fairness" not in context:
            logger.warning("Cannot evaluate justice principle without fairness metrics")
            return 0.5
            
        fairness = context["fairness"]
        
        # Calculate fairness score
        total_fairness = 0.0
        num_metrics = len(fairness)
        
        if num_metrics == 0:
            return 0.5
            
        for metric, value in fairness.items():
            if isinstance(value, (int, float)):
                total_fairness += max(0.0, min(1.0, value))
                
        return total_fairness / num_metrics


class PrincipleRegistry:
    """Registry of ethical principles available in the system."""
    
    def __init__(self, event_bus=None):
        """Initialize the principle registry.
        
        Args:
            event_bus: Optional event bus for publishing principle-related events
        """
        self.principles: Dict[str, EthicalPrinciple] = {}
        self.event_bus = event_bus
        self._lock = asyncio.Lock()
        
        # Initialize with core principles
        self._initialize_core_principles()
        
        logger.info("Principle registry initialized")
        
    def _initialize_core_principles(self):
        """Initialize the registry with core ethical principles."""
        core_principles = [
            UtilitarianPrinciple(),
            DeontologicalPrinciple(),
            VirtueEthicsPrinciple(),
            CareEthicsPrinciple(),
            JusticePrinciple(),
            EthicalPrinciple(
                name="Autonomy Principle",
                description="Respect individual autonomy and self-determination",
                category=PrincipleCategory.DEONTOLOGICAL
            ),
            EthicalPrinciple(
                name="Non-maleficence Principle",
                description="Avoid causing harm to others",
                category=PrincipleCategory.CONSEQUENTIALIST
            ),
            EthicalPrinciple(
                name="Beneficence Principle",
                description="Act to benefit others and promote well-being",
                category=PrincipleCategory.CONSEQUENTIALIST
            ),
            EthicalPrinciple(
                name="Privacy Principle",
                description="Respect and protect personal privacy",
                category=PrincipleCategory.DEONTOLOGICAL
            ),
            EthicalPrinciple(
                name="Transparency Principle",
                description="Be open and honest about actions and intentions",
                category=PrincipleCategory.VIRTUE_ETHICS
            )
        ]
        
        for principle in core_principles:
            self.principles[principle.id] = principle
            
    async def add_principle(self, principle: Union[EthicalPrinciple, Dict[str, Any]]) -> str:
        """Add a principle to the registry.
        
        Args:
            principle: Principle object or dictionary representation
            
        Returns:
            ID of the added principle
        """
        if isinstance(principle, dict):
            principle = EthicalPrinciple.from_dict(principle)
            
        async with self._lock:
            self.principles[principle.id] = principle
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.principle.added",
                {"principle": principle.to_dict()},
                "principle_registry"
            )
            
        logger.debug(f"Added principle: {principle.name}")
        return principle.id
        
    async def get_principle(self, principle_id: str) -> Optional[EthicalPrinciple]:
        """Get a principle by ID.
        
        Args:
            principle_id: ID of the principle to retrieve
            
        Returns:
            Principle object or None if not found
        """
        return self.principles.get(principle_id)
        
    async def get_principle_by_name(self, name: str) -> Optional[EthicalPrinciple]:
        """Get a principle by name.
        
        Args:
            name: Name of the principle to retrieve
            
        Returns:
            Principle object or None if not found
        """
        for principle in self.principles.values():
            if principle.name.lower() == name.lower():
                return principle
        return None
        
    async def get_principles_by_category(self, category: PrincipleCategory) -> List[EthicalPrinciple]:
        """Get all principles in a specific category.
        
        Args:
            category: Category to filter by
            
        Returns:
            List of principles in the specified category
        """
        return [p for p in self.principles.values() if p.category == category]
        
    async def get_all_principles(self) -> List[EthicalPrinciple]:
        """Get all principles in the registry.
        
        Returns:
            List of all principles
        """
        return list(self.principles.values())
        
    async def remove_principle(self, principle_id: str) -> bool:
        """Remove a principle from the registry.
        
        Args:
            principle_id: ID of the principle to remove
            
        Returns:
            True if principle was removed, False if not found
        """
        async with self._lock:
            if principle_id not in self.principles:
                return False
                
            principle = self.principles.pop(principle_id)
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.principle.removed",
                {"principle_id": principle_id, "principle_name": principle.name},
                "principle_registry"
            )
            
        logger.debug(f"Removed principle: {principle.name}")
        return True
