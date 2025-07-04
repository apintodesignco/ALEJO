"""
Context Engine

This module implements ALEJO's contextual awareness capabilities, maintaining
and managing context across interactions to provide more coherent and
personalized responses.

The context engine tracks conversation history, user preferences, environmental
factors, and interaction state to enrich the multimodal fusion process and
improve ALEJO's understanding of user intent.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Union, Tuple, Set

from alejo.core.events import EventBus, Event
from alejo.cognitive.memory.relationship_memory import RelationshipMemory
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class ContextType(Enum):
    """Types of context information"""
    CONVERSATION = "conversation"  # Conversation history
    USER = "user"                  # User preferences and profile
    ENVIRONMENT = "environment"    # Environmental factors
    SYSTEM = "system"              # System state
    TASK = "task"                  # Current task or activity
    TEMPORAL = "temporal"          # Time-related context


class ContextPriority(Enum):
    """Priority levels for context information"""
    CRITICAL = 100  # Must be considered
    HIGH = 75       # Very important
    MEDIUM = 50     # Important
    LOW = 25        # Supplementary
    BACKGROUND = 0  # Ambient information


class ContextItem:
    """
    Represents a piece of context information
    """
    def __init__(
        self,
        context_type: ContextType,
        key: str,
        value: Any,
        source: str,
        priority: ContextPriority = ContextPriority.MEDIUM,
        expiration: Optional[datetime] = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a context item
        
        Args:
            context_type: Type of context
            key: Key for this context item
            value: Value of the context
            source: Source of this context information
            priority: Priority of this context
            expiration: When this context expires
            metadata: Additional metadata
        """
        self.item_id = f"{context_type.value}_{key}_{datetime.now().timestamp()}"
        self.context_type = context_type
        self.key = key
        self.value = value
        self.source = source
        self.priority = priority
        self.created_at = datetime.now()
        self.expiration = expiration
        self.metadata = metadata or {}
    
    def is_expired(self) -> bool:
        """Check if this context item has expired"""
        if not self.expiration:
            return False
        return datetime.now() > self.expiration
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context item to dictionary"""
        return {
            "item_id": self.item_id,
            "context_type": self.context_type.value,
            "key": self.key,
            "value": self.value,
            "source": self.source,
            "priority": self.priority.value,
            "created_at": self.created_at.isoformat(),
            "expiration": self.expiration.isoformat() if self.expiration else None,
            "metadata": self.metadata
        }


class ContextEngine:
    """
    Engine for managing contextual information
    
    This class maintains and manages context across interactions to provide
    more coherent and personalized responses.
    """
    def __init__(
        self,
        relationship_memory: Optional[RelationshipMemory] = None,
        event_bus: Optional[EventBus] = None,
        context_ttl_minutes: int = 30,
        max_conversation_items: int = 20
    ):
        """
        Initialize the context engine
        
        Args:
            relationship_memory: Memory system for persistent relationships
            event_bus: Event bus for publishing events
            context_ttl_minutes: Default time-to-live for context items in minutes
            max_conversation_items: Maximum number of conversation items to keep
        """
        self.relationship_memory = relationship_memory
        self.event_bus = event_bus
        self.context_ttl_minutes = context_ttl_minutes
        self.max_conversation_items = max_conversation_items
        
        # Context store by type and key
        self.context_store: Dict[ContextType, Dict[str, ContextItem]] = {
            context_type: {} for context_type in ContextType
        }
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info("Context Engine initialized")
    
    async def add_context(self, context_item: ContextItem) -> str:
        """
        Add a context item
        
        Args:
            context_item: The context item to add
            
        Returns:
            ID of the added context item
        """
        async with self._lock:
            # Set expiration if not provided
            if not context_item.expiration:
                context_item.expiration = datetime.now() + timedelta(minutes=self.context_ttl_minutes)
            
            # Add to store
            self.context_store[context_item.context_type][context_item.key] = context_item
            
            # Special handling for conversation context
            if context_item.context_type == ContextType.CONVERSATION:
                # Ensure we don't exceed max conversation items
                conversation_items = list(self.context_store[ContextType.CONVERSATION].values())
                if len(conversation_items) > self.max_conversation_items:
                    # Sort by creation time and remove oldest
                    conversation_items.sort(key=lambda x: x.created_at)
                    for item in conversation_items[:-self.max_conversation_items]:
                        del self.context_store[ContextType.CONVERSATION][item.key]
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="context_added",
                        data=context_item.to_dict()
                    )
                )
            
            return context_item.item_id
    
    def get_context(
        self,
        context_type: Optional[ContextType] = None,
        key: Optional[str] = None,
        include_expired: bool = False
    ) -> Union[ContextItem, Dict[str, ContextItem], Dict[ContextType, Dict[str, ContextItem]]]:
        """
        Get context items
        
        Args:
            context_type: Type of context to get (optional)
            key: Specific key to get (optional)
            include_expired: Whether to include expired items
            
        Returns:
            Context item(s) based on parameters
        """
        # Clean expired items first
        if not include_expired:
            self._clean_expired_items()
        
        # Get specific item
        if context_type and key:
            if key in self.context_store[context_type]:
                item = self.context_store[context_type][key]
                if include_expired or not item.is_expired():
                    return item
            return None
        
        # Get all items of a type
        if context_type:
            if include_expired:
                return self.context_store[context_type]
            else:
                return {
                    k: v for k, v in self.context_store[context_type].items()
                    if not v.is_expired()
                }
        
        # Get all items
        if include_expired:
            return self.context_store
        else:
            return {
                ct: {
                    k: v for k, v in items.items()
                    if not v.is_expired()
                }
                for ct, items in self.context_store.items()
            }
    
    async def update_context(
        self,
        context_type: ContextType,
        key: str,
        value: Any,
        source: Optional[str] = None,
        priority: Optional[ContextPriority] = None,
        expiration: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Update an existing context item
        
        Args:
            context_type: Type of context
            key: Key of the context item
            value: New value
            source: New source (optional)
            priority: New priority (optional)
            expiration: New expiration (optional)
            metadata: New metadata (optional)
            
        Returns:
            ID of the updated item, or None if not found
        """
        async with self._lock:
            if key not in self.context_store[context_type]:
                return None
            
            item = self.context_store[context_type][key]
            
            # Update fields
            item.value = value
            if source:
                item.source = source
            if priority:
                item.priority = priority
            if expiration:
                item.expiration = expiration
            if metadata:
                item.metadata.update(metadata)
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="context_updated",
                        data=item.to_dict()
                    )
                )
            
            return item.item_id
    
    async def remove_context(
        self,
        context_type: ContextType,
        key: str
    ) -> bool:
        """
        Remove a context item
        
        Args:
            context_type: Type of context
            key: Key of the context item
            
        Returns:
            True if removed, False if not found
        """
        async with self._lock:
            if key not in self.context_store[context_type]:
                return False
            
            # Get item for event
            item = self.context_store[context_type][key]
            
            # Remove item
            del self.context_store[context_type][key]
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="context_removed",
                        data=item.to_dict()
                    )
                )
            
            return True
    
    async def clear_context(
        self,
        context_type: Optional[ContextType] = None
    ) -> int:
        """
        Clear context items
        
        Args:
            context_type: Type of context to clear (optional, clears all if None)
            
        Returns:
            Number of items cleared
        """
        async with self._lock:
            count = 0
            
            if context_type:
                count = len(self.context_store[context_type])
                self.context_store[context_type] = {}
            else:
                for ct in ContextType:
                    count += len(self.context_store[ct])
                    self.context_store[ct] = {}
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="context_cleared",
                        data={"context_type": context_type.value if context_type else None, "count": count}
                    )
                )
            
            return count
    
    def get_enriched_context(self) -> Dict[str, Any]:
        """
        Get a flattened, enriched context for use in reasoning and response generation
        
        Returns:
            Dictionary of context information
        """
        # Clean expired items
        self._clean_expired_items()
        
        # Initialize result
        result = {}
        
        # Process each context type
        for context_type in ContextType:
            type_dict = {}
            
            # Get non-expired items for this type
            items = {
                k: v for k, v in self.context_store[context_type].items()
                if not v.is_expired()
            }
            
            # Sort by priority
            sorted_items = sorted(
                items.values(),
                key=lambda x: x.priority.value,
                reverse=True
            )
            
            # Add to type dictionary
            for item in sorted_items:
                type_dict[item.key] = item.value
            
            # Add type dictionary to result
            result[context_type.value] = type_dict
        
        # Add relationship information if available
        if self.relationship_memory:
            relationships = self.relationship_memory.get_active_relationships()
            if relationships:
                result["relationships"] = relationships
        
        return result
    
    def _clean_expired_items(self) -> int:
        """
        Remove expired items from the context store
        
        Returns:
            Number of items removed
        """
        count = 0
        
        for context_type in ContextType:
            expired_keys = [
                k for k, v in self.context_store[context_type].items()
                if v.is_expired()
            ]
            
            for key in expired_keys:
                del self.context_store[context_type][key]
                count += 1
        
        return count


# Example usage
async def main():
    # Initialize context engine
    context_engine = ContextEngine()
    
    # Add context items
    await context_engine.add_context(
        ContextItem(
            context_type=ContextType.USER,
            key="name",
            value="John Doe",
            source="user_profile",
            priority=ContextPriority.HIGH
        )
    )
    
    await context_engine.add_context(
        ContextItem(
            context_type=ContextType.ENVIRONMENT,
            key="location",
            value="New York",
            source="gps",
            priority=ContextPriority.MEDIUM
        )
    )
    
    await context_engine.add_context(
        ContextItem(
            context_type=ContextType.CONVERSATION,
            key="last_query",
            value="What's the weather like?",
            source="user_input",
            priority=ContextPriority.HIGH
        )
    )
    
    # Get enriched context
    enriched_context = context_engine.get_enriched_context()
    
    print(json.dumps(enriched_context, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
