"""
ALEJO Autobiographical Timeline

This module implements a chronological timeline of autobiographical memories,
allowing for temporal organization and retrieval of personal experiences.
It works with the episodic memory system but provides specialized temporal
indexing and retrieval capabilities.
"""

import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from alejo.cognitive.memory.episodic_memory import EpisodicMemory
from alejo.cognitive.memory.models import Episode, MemoryType
from alejo.core.events import EventBus, EventType
from alejo.utils.error_handling import handle_errors

logger = logging.getLogger(__name__)


class TimeScale(Enum):
    """Time scales for autobiographical timeline."""
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"
    CUSTOM = "custom"


class TimelineEvent:
    """Represents a significant event in the autobiographical timeline."""
    
    def __init__(
        self,
        event_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        importance: float = 0.5,
        memory_ids: List[str] = None,
        tags: List[str] = None,
        location: Optional[str] = None,
        people: List[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """Initialize a timeline event.
        
        Args:
            event_id: Unique identifier for this event
            title: Short title for the event
            description: Longer description of the event
            start_time: When the event started
            end_time: When the event ended (optional)
            importance: Importance of this event (0.0 to 1.0)
            memory_ids: IDs of related memories
            tags: Tags for categorizing this event
            location: Where the event occurred
            people: People involved in the event
            metadata: Additional metadata for this event
        """
        self.id = event_id
        self.title = title
        self.description = description
        self.start_time = start_time
        self.end_time = end_time or start_time
        self.importance = importance
        self.memory_ids = memory_ids or []
        self.tags = tags or []
        self.location = location
        self.people = people or []
        self.metadata = metadata or {}
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert the timeline event to a dictionary.
        
        Returns:
            Dictionary representation of the event
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "importance": self.importance,
            "memory_ids": self.memory_ids,
            "tags": self.tags,
            "location": self.location,
            "people": self.people,
            "metadata": self.metadata
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TimelineEvent':
        """Create a timeline event from a dictionary.
        
        Args:
            data: Dictionary representation of an event
            
        Returns:
            TimelineEvent object
        """
        return cls(
            event_id=data["id"],
            title=data["title"],
            description=data["description"],
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(data["end_time"]),
            importance=data["importance"],
            memory_ids=data["memory_ids"],
            tags=data["tags"],
            location=data["location"],
            people=data["people"],
            metadata=data["metadata"]
        )


class AutobiographicalTimeline:
    """
    Autobiographical timeline for organizing memories chronologically.
    
    This system provides temporal organization and retrieval of personal experiences,
    allowing for navigation through memories based on time periods and significant events.
    
    Features:
    - Chronological organization of memories
    - Identification of significant life events
    - Temporal clustering of related memories
    - Timeline visualization support
    - Memory retrieval by time periods
    """
    
    def __init__(
        self,
        episodic_memory: EpisodicMemory,
        event_bus: EventBus = None
    ):
        """Initialize the autobiographical timeline.
        
        Args:
            episodic_memory: Episodic memory system for memory retrieval
            event_bus: Event bus for publishing timeline events
        """
        self.episodic_memory = episodic_memory
        self.event_bus = event_bus
        self._timeline_events = {}  # event_id -> TimelineEvent
        self._time_index = {}  # year -> month -> day -> [event_ids]
        
        logger.info("Autobiographical timeline initialized")
        
    async def add_event(self, event: TimelineEvent) -> str:
        """Add an event to the timeline.
        
        Args:
            event: Timeline event to add
            
        Returns:
            ID of the added event
        """
        try:
            # Store the event
            self._timeline_events[event.id] = event
            
            # Update time index
            self._index_event(event)
            
            # Publish event
            if self.event_bus:
                await self.event_bus.publish(
                    EventType.TIMELINE_EVENT_ADDED,
                    {
                        "event_id": event.id,
                        "title": event.title,
                        "start_time": event.start_time.isoformat()
                    }
                )
                
            return event.id
        except Exception as e:
            logger.error(f"Error adding timeline event: {str(e)}")
            return None
            
    async def get_event(self, event_id: str) -> Optional[TimelineEvent]:
        """Get a timeline event by ID.
        
        Args:
            event_id: ID of the event to get
            
        Returns:
            Timeline event or None if not found
        """
        return self._timeline_events.get(event_id)
        
    async def update_event(
        self,
        event_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a timeline event.
        
        Args:
            event_id: ID of the event to update
            updates: Dictionary of updates to apply
            
        Returns:
            True if successful, False otherwise
        """
        try:
            event = self._timeline_events.get(event_id)
            if not event:
                logger.error(f"Cannot update non-existent event: {event_id}")
                return False
                
            # Remove from time index
            self._remove_from_index(event)
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(event, key):
                    # Handle datetime conversions
                    if key in ["start_time", "end_time"] and isinstance(value, str):
                        value = datetime.fromisoformat(value)
                    setattr(event, key, value)
                    
            # Update time index
            self._index_event(event)
            
            # Publish event
            if self.event_bus:
                await self.event_bus.publish(
                    EventType.TIMELINE_EVENT_UPDATED,
                    {
                        "event_id": event.id,
                        "title": event.title,
                        "start_time": event.start_time.isoformat()
                    }
                )
                
            return True
        except Exception as e:
            logger.error(f"Error updating timeline event: {str(e)}")
            return False
            
    async def delete_event(self, event_id: str) -> bool:
        """Delete a timeline event.
        
        Args:
            event_id: ID of the event to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            event = self._timeline_events.get(event_id)
            if not event:
                logger.error(f"Cannot delete non-existent event: {event_id}")
                return False
                
            # Remove from time index
            self._remove_from_index(event)
            
            # Remove from events
            del self._timeline_events[event_id]
            
            # Publish event
            if self.event_bus:
                await self.event_bus.publish(
                    EventType.TIMELINE_EVENT_DELETED,
                    {
                        "event_id": event_id
                    }
                )
                
            return True
        except Exception as e:
            logger.error(f"Error deleting timeline event: {str(e)}")
            return False
            
    async def get_events_by_time_range(
        self,
        start_time: datetime,
        end_time: datetime,
        tags: Optional[List[str]] = None,
        min_importance: float = 0.0
    ) -> List[TimelineEvent]:
        """Get events within a time range.
        
        Args:
            start_time: Start of time range
            end_time: End of time range
            tags: Filter by tags (optional)
            min_importance: Minimum importance threshold
            
        Returns:
            List of timeline events
        """
        try:
            # Get all event IDs in the time range
            event_ids = set()
            
            # Iterate through years, months, days in range
            current_date = start_time.date()
            end_date = end_time.date()
            
            while current_date <= end_date:
                year = current_date.year
                month = current_date.month
                day = current_date.day
                
                # Get events for this day
                if year in self._time_index and month in self._time_index[year] and day in self._time_index[year][month]:
                    event_ids.update(self._time_index[year][month][day])
                    
                current_date += timedelta(days=1)
                
            # Filter events
            events = []
            for event_id in event_ids:
                event = self._timeline_events[event_id]
                
                # Check if event overlaps with time range
                if event.end_time < start_time or event.start_time > end_time:
                    continue
                    
                # Check importance
                if event.importance < min_importance:
                    continue
                    
                # Check tags
                if tags and not any(tag in event.tags for tag in tags):
                    continue
                    
                events.append(event)
                
            # Sort by start time
            events.sort(key=lambda e: e.start_time)
            
            return events
        except Exception as e:
            logger.error(f"Error getting events by time range: {str(e)}")
            return []
            
    async def get_events_by_tag(
        self,
        tags: List[str],
        limit: int = 50
    ) -> List[TimelineEvent]:
        """Get events by tag.
        
        Args:
            tags: Tags to filter by
            limit: Maximum number of events to return
            
        Returns:
            List of timeline events
        """
        try:
            events = []
            
            for event in self._timeline_events.values():
                if any(tag in event.tags for tag in tags):
                    events.append(event)
                    
                    if len(events) >= limit:
                        break
                        
            # Sort by start time
            events.sort(key=lambda e: e.start_time, reverse=True)
            
            return events
        except Exception as e:
            logger.error(f"Error getting events by tag: {str(e)}")
            return []
            
    async def get_significant_events(
        self,
        min_importance: float = 0.7,
        limit: int = 10
    ) -> List[TimelineEvent]:
        """Get significant events from the timeline.
        
        Args:
            min_importance: Minimum importance threshold
            limit: Maximum number of events to return
            
        Returns:
            List of significant timeline events
        """
        try:
            events = []
            
            for event in self._timeline_events.values():
                if event.importance >= min_importance:
                    events.append(event)
                    
            # Sort by importance, then by recency
            events.sort(key=lambda e: (e.importance, e.start_time), reverse=True)
            
            return events[:limit]
        except Exception as e:
            logger.error(f"Error getting significant events: {str(e)}")
            return []
            
    async def create_event_from_memories(
        self,
        title: str,
        memory_ids: List[str],
        tags: List[str] = None,
        importance: float = None
    ) -> str:
        """Create a timeline event from a set of memories.
        
        Args:
            title: Title for the event
            memory_ids: IDs of memories to include
            tags: Tags for the event
            importance: Importance override (if None, calculated from memories)
            
        Returns:
            ID of the created event
        """
        try:
            # Get memories
            memories = []
            for memory_id in memory_ids:
                memory = await self.episodic_memory.get_episode(memory_id)
                if memory:
                    memories.append(memory)
                    
            if not memories:
                logger.error("Cannot create event with no valid memories")
                return None
                
            # Determine time range
            start_time = min(memory.timestamp for memory in memories)
            end_time = max(memory.timestamp for memory in memories)
            
            # Calculate importance if not provided
            if importance is None:
                importance = sum(memory.importance for memory in memories) / len(memories)
                
            # Create description from memory contents
            description = f"Event containing {len(memories)} memories from {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}."
            
            # Extract people and location if available
            people = set()
            locations = set()
            
            for memory in memories:
                context = memory.context or {}
                
                if "people" in context and isinstance(context["people"], list):
                    people.update(context["people"])
                    
                if "location" in context:
                    locations.add(context["location"])
                    
            # Create event
            event_id = f"event_{int(time.time())}_{hash(title)}"
            event = TimelineEvent(
                event_id=event_id,
                title=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                importance=importance,
                memory_ids=memory_ids,
                tags=tags or [],
                location=next(iter(locations), None),
                people=list(people)
            )
            
            # Add to timeline
            await self.add_event(event)
            
            return event_id
        except Exception as e:
            logger.error(f"Error creating event from memories: {str(e)}")
            return None
            
    def _index_event(self, event: TimelineEvent) -> None:
        """Index an event in the time index.
        
        Args:
            event: Event to index
        """
        # Index by start date
        start_date = event.start_time.date()
        year = start_date.year
        month = start_date.month
        day = start_date.day
        
        # Create index entries if needed
        if year not in self._time_index:
            self._time_index[year] = {}
            
        if month not in self._time_index[year]:
            self._time_index[year][month] = {}
            
        if day not in self._time_index[year][month]:
            self._time_index[year][month][day] = set()
            
        # Add to index
        self._time_index[year][month][day].add(event.id)
        
        # If event spans multiple days, index those too
        if event.end_time.date() > start_date:
            current_date = start_date + timedelta(days=1)
            end_date = event.end_time.date()
            
            while current_date <= end_date:
                year = current_date.year
                month = current_date.month
                day = current_date.day
                
                # Create index entries if needed
                if year not in self._time_index:
                    self._time_index[year] = {}
                    
                if month not in self._time_index[year]:
                    self._time_index[year][month] = {}
                    
                if day not in self._time_index[year][month]:
                    self._time_index[year][month][day] = set()
                    
                # Add to index
                self._time_index[year][month][day].add(event.id)
                
                current_date += timedelta(days=1)
                
    def _remove_from_index(self, event: TimelineEvent) -> None:
        """Remove an event from the time index.
        
        Args:
            event: Event to remove
        """
        # Remove from start date to end date
        current_date = event.start_time.date()
        end_date = event.end_time.date()
        
        while current_date <= end_date:
            year = current_date.year
            month = current_date.month
            day = current_date.day
            
            # Remove from index if it exists
            if (year in self._time_index and 
                month in self._time_index[year] and 
                day in self._time_index[year][month] and
                event.id in self._time_index[year][month][day]):
                
                self._time_index[year][month][day].remove(event.id)
                
                # Clean up empty entries
                if not self._time_index[year][month][day]:
                    del self._time_index[year][month][day]
                    
                if not self._time_index[year][month]:
                    del self._time_index[year][month]
                    
                if not self._time_index[year]:
                    del self._time_index[year]
                    
            current_date += timedelta(days=1)
