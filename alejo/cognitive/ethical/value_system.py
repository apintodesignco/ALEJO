"""ALEJO - Advanced Language and Execution Joint Operator
Value System - Core component for managing and reasoning about ethical values
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Dict, List, Optional, Set, Tuple, Any, Union
from uuid import uuid4

logger = logging.getLogger(__name__)


class ValueCategory(Enum):
    """Categories of values for organizational purposes."""
    PERSONAL = auto()       # Individual preferences and personal values
    INTERPERSONAL = auto()  # Values related to relationships with others
    SOCIETAL = auto()       # Values related to society and community
    UNIVERSAL = auto()      # Universal ethical principles
    CUSTOM = auto()         # User-defined categories


class ValuePriority(Enum):
    """Priority levels for values to help with conflict resolution."""
    CRITICAL = 100    # Non-negotiable, must be upheld
    HIGH = 75         # Very important, rarely compromised
    MEDIUM = 50       # Important but can be balanced with others
    LOW = 25          # Considered but may yield to higher priorities
    FLEXIBLE = 10     # Considered when possible but easily overridden


@dataclass
class Value:
    """Represents a single ethical value with metadata."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    priority: Union[ValuePriority, int] = ValuePriority.MEDIUM
    category: ValueCategory = ValueCategory.PERSONAL
    source: str = "system"  # Where this value originated (system, user, learned)
    created_at: datetime = field(default_factory=datetime.now)
    modified_at: datetime = field(default_factory=datetime.now)
    attributes: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Convert priority to enum if it's an integer."""
        if isinstance(self.priority, int):
            # Map integer to closest ValuePriority
            if self.priority >= 90:
                self.priority = ValuePriority.CRITICAL
            elif self.priority >= 70:
                self.priority = ValuePriority.HIGH
            elif self.priority >= 40:
                self.priority = ValuePriority.MEDIUM
            elif self.priority >= 20:
                self.priority = ValuePriority.LOW
            else:
                self.priority = ValuePriority.FLEXIBLE
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert value to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority.name if isinstance(self.priority, ValuePriority) else self.priority,
            "priority_value": self.priority.value if isinstance(self.priority, ValuePriority) else self.priority,
            "category": self.category.name if isinstance(self.category, ValueCategory) else self.category,
            "source": self.source,
            "created_at": self.created_at.isoformat(),
            "modified_at": self.modified_at.isoformat(),
            "attributes": self.attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Value':
        """Create a Value from a dictionary representation."""
        # Handle priority conversion
        priority = data.get("priority")
        if isinstance(priority, str) and hasattr(ValuePriority, priority):
            priority = getattr(ValuePriority, priority)
        elif "priority_value" in data:
            priority = data["priority_value"]
            
        # Handle category conversion
        category = data.get("category")
        if isinstance(category, str) and hasattr(ValueCategory, category):
            category = getattr(ValueCategory, category)
        else:
            category = ValueCategory.CUSTOM
            
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
            priority=priority,
            category=category,
            source=data.get("source", "system"),
            created_at=created_at,
            modified_at=modified_at,
            attributes=data.get("attributes", {})
        )


class ValueConflict:
    """Represents a conflict between two or more values."""
    
    def __init__(self, values: List[Value], context: Dict[str, Any]):
        """Initialize a value conflict.
        
        Args:
            values: List of values in conflict
            context: Context information about the conflict
        """
        self.values = values
        self.context = context
        self.resolution: Optional[List[Value]] = None
        self.resolution_rationale: str = ""
        
    def resolve_by_priority(self) -> List[Value]:
        """Resolve conflict by prioritizing values with higher priority."""
        if not self.values:
            return []
            
        # Sort values by priority (highest first)
        sorted_values = sorted(
            self.values, 
            key=lambda v: v.priority.value if isinstance(v.priority, ValuePriority) else v.priority,
            reverse=True
        )
        
        # Get highest priority
        highest_priority = sorted_values[0].priority
        
        # Return all values with the highest priority
        result = [v for v in sorted_values if v.priority == highest_priority]
        
        self.resolution = result
        self.resolution_rationale = f"Resolved by selecting {len(result)} value(s) with highest priority {highest_priority}."
        
        return result
        
    def resolve_with_weights(self, weights: Dict[str, float]) -> List[Value]:
        """Resolve conflict using context-specific weights.
        
        Args:
            weights: Dictionary mapping value names or IDs to weights
            
        Returns:
            List of values in order of weighted importance
        """
        if not self.values:
            return []
            
        # Calculate weighted scores
        weighted_values = []
        for value in self.values:
            # Get base priority score
            base_score = value.priority.value if isinstance(value.priority, ValuePriority) else value.priority
            
            # Apply context-specific weight
            weight = weights.get(value.id, weights.get(value.name, 1.0))
            weighted_score = base_score * weight
            
            weighted_values.append((value, weighted_score))
            
        # Sort by weighted score
        sorted_values = [v[0] for v in sorted(weighted_values, key=lambda x: x[1], reverse=True)]
        
        self.resolution = sorted_values
        self.resolution_rationale = f"Resolved using context-specific weights: {weights}"
        
        return sorted_values


class ValueSystem:
    """Represents a system of values that guides ethical decision making.
    
    The ValueSystem manages a collection of ethical values with their priorities,
    categories, and relationships. It provides methods for adding, retrieving,
    and reasoning about values, as well as resolving conflicts between values.
    """
    
    def __init__(self, event_bus=None):
        """Initialize the value system.
        
        Args:
            event_bus: Optional event bus for publishing value-related events
        """
        self.values: Dict[str, Value] = {}
        self.event_bus = event_bus
        self._lock = asyncio.Lock()
        
        # Initialize with core values
        self._initialize_core_values()
        
        logger.info("Value system initialized")
        
    def _initialize_core_values(self):
        """Initialize the system with core ethical values."""
        core_values = [
            Value(
                name="Privacy",
                description="Respecting personal information and boundaries",
                priority=ValuePriority.HIGH,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Autonomy",
                description="Respecting individual freedom and self-determination",
                priority=ValuePriority.HIGH,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Transparency",
                description="Being open and honest about capabilities and limitations",
                priority=ValuePriority.HIGH,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Non-maleficence",
                description="Avoiding harm to users and others",
                priority=ValuePriority.CRITICAL,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Beneficence",
                description="Acting in the best interest of users and society",
                priority=ValuePriority.HIGH,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Justice",
                description="Treating all individuals fairly and equally",
                priority=ValuePriority.HIGH,
                category=ValueCategory.UNIVERSAL,
                source="system"
            ),
            Value(
                name="Reliability",
                description="Functioning consistently and as expected",
                priority=ValuePriority.MEDIUM,
                category=ValueCategory.UNIVERSAL,
                source="system"
            )
        ]
        
        for value in core_values:
            self.values[value.id] = value
            
    async def add_value(self, value: Union[Value, Dict[str, Any]]) -> str:
        """Add a value to the system.
        
        Args:
            value: Value object or dictionary representation
            
        Returns:
            ID of the added value
        """
        if isinstance(value, dict):
            value = Value.from_dict(value)
            
        async with self._lock:
            self.values[value.id] = value
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.value.added",
                {"value": value.to_dict()},
                "value_system"
            )
            
        logger.debug(f"Added value: {value.name} with priority {value.priority}")
        return value.id
        
    async def update_value(self, value_id: str, updates: Dict[str, Any]) -> Optional[Value]:
        """Update an existing value.
        
        Args:
            value_id: ID of the value to update
            updates: Dictionary of fields to update
            
        Returns:
            Updated Value object or None if not found
        """
        async with self._lock:
            if value_id not in self.values:
                logger.warning(f"Attempted to update non-existent value: {value_id}")
                return None
                
            value = self.values[value_id]
            
            # Update fields
            for key, new_value in updates.items():
                if hasattr(value, key):
                    setattr(value, key, new_value)
                    
            # Update modified timestamp
            value.modified_at = datetime.now()
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.value.updated",
                {"value": value.to_dict()},
                "value_system"
            )
            
        logger.debug(f"Updated value: {value.name}")
        return value
        
    async def remove_value(self, value_id: str) -> bool:
        """Remove a value from the system.
        
        Args:
            value_id: ID of the value to remove
            
        Returns:
            True if value was removed, False if not found
        """
        async with self._lock:
            if value_id not in self.values:
                return False
                
            value = self.values.pop(value_id)
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.value.removed",
                {"value_id": value_id, "value_name": value.name},
                "value_system"
            )
            
        logger.debug(f"Removed value: {value.name}")
        return True
        
    async def get_value(self, value_id: str) -> Optional[Value]:
        """Get a value by ID.
        
        Args:
            value_id: ID of the value to retrieve
            
        Returns:
            Value object or None if not found
        """
        return self.values.get(value_id)
        
    async def get_value_by_name(self, name: str) -> Optional[Value]:
        """Get a value by name.
        
        Args:
            name: Name of the value to retrieve
            
        Returns:
            Value object or None if not found
        """
        for value in self.values.values():
            if value.name.lower() == name.lower():
                return value
        return None
        
    async def get_values_by_category(self, category: ValueCategory) -> List[Value]:
        """Get all values in a specific category.
        
        Args:
            category: Category to filter by
            
        Returns:
            List of values in the specified category
        """
        return [v for v in self.values.values() if v.category == category]
        
    async def get_values_by_priority(self, priority: ValuePriority) -> List[Value]:
        """Get all values with a specific priority.
        
        Args:
            priority: Priority to filter by
            
        Returns:
            List of values with the specified priority
        """
        return [v for v in self.values.values() if v.priority == priority]
        
    async def get_all_values(self) -> List[Value]:
        """Get all values in the system.
        
        Returns:
            List of all values
        """
        return list(self.values.values())
        
    async def resolve_value_conflict(self, value_ids: List[str], context: Dict[str, Any]) -> List[Value]:
        """Resolve a conflict between multiple values.
        
        Args:
            value_ids: List of value IDs in conflict
            context: Context information about the conflict
            
        Returns:
            List of values in order of resolution priority
        """
        # Get the values involved in the conflict
        values = [self.values.get(vid) for vid in value_ids if vid in self.values]
        values = [v for v in values if v is not None]
        
        if not values:
            logger.warning("Attempted to resolve conflict with no valid values")
            return []
            
        # Create conflict object
        conflict = ValueConflict(values, context)
        
        # Check if context provides specific weights
        if "value_weights" in context:
            resolution = conflict.resolve_with_weights(context["value_weights"])
        else:
            resolution = conflict.resolve_by_priority()
            
        # Publish event if event bus is available
        if self.event_bus:
            await self.event_bus.publish(
                "ethical.value.conflict_resolved",
                {
                    "values": [v.to_dict() for v in values],
                    "resolution": [v.to_dict() for v in resolution],
                    "rationale": conflict.resolution_rationale,
                    "context": context
                },
                "value_system"
            )
            
        logger.info(f"Resolved value conflict with rationale: {conflict.resolution_rationale}")
        return resolution
        
    async def export_to_dict(self) -> Dict[str, Any]:
        """Export the entire value system to a dictionary.
        
        Returns:
            Dictionary representation of the value system
        """
        return {
            "values": {vid: value.to_dict() for vid, value in self.values.items()}
        }
        
    @classmethod
    async def import_from_dict(cls, data: Dict[str, Any], event_bus=None) -> 'ValueSystem':
        """Create a ValueSystem from a dictionary representation.
        
        Args:
            data: Dictionary representation of a value system
            event_bus: Optional event bus for the new value system
            
        Returns:
            New ValueSystem instance
        """
        value_system = cls(event_bus)
        
        # Clear default values
        value_system.values.clear()
        
        # Import values
        if "values" in data:
            for value_dict in data["values"].values():
                value = Value.from_dict(value_dict)
                value_system.values[value.id] = value
                
        return value_system
