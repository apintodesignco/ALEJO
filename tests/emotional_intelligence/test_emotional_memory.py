"""
Unit tests for the EmotionalMemory class.

Tests the functionality of the EmotionalMemory class, including initialization,
interaction storage, relationship updates, value system storage, and event handling.
"""

import os
import json
import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from alejo.emotional_intelligence.emotional_memory import EmotionalMemory
from alejo.emotional_intelligence.memory import EmotionalMemoryService
from alejo.utils.events import EventBus
from alejo.utils.exceptions import EmotionalMemoryError
import secrets  # More secure for cryptographic purposes


class TestEmotionalMemory:
    """Test suite for the EmotionalMemory class."""

    @pytest.fixture
    def event_bus(self):
        """Create a mock event bus."""
        mock_event_bus = MagicMock(spec=EventBus)
        mock_event_bus.emit = AsyncMock()
        mock_event_bus.subscribe = MagicMock()
        return mock_event_bus

    @pytest.fixture
    def memory_service(self):
        """Create a mock memory service."""
        mock_service = MagicMock(spec=EmotionalMemoryService)
        
        # Setup default return values
        mock_service.get_relationship_context.return_value = {
            "trust_level": 0.7,
            "rapport_level": 0.6,
            "interaction_count": 10,
            "last_interaction": datetime.now().isoformat()
        }
        
        mock_service.get_emotional_context.return_value = [{
            "context_type": "value_system",
            "context_data": {
                "honesty": 0.9,
                "kindness": 0.8
            }
        }]
        
        mock_service.get_recent_interactions.return_value = [{
            "emotional_data": {
                "valence": 0.5,
                "arousal": 0.6,
                "dominance": 0.4
            }
        }]
        
        return mock_service

    @pytest.fixture
    def emotional_memory(self, event_bus, memory_service):
        """Create an EmotionalMemory instance with mocked dependencies."""
        with patch('alejo.emotional_intelligence.emotional_memory.EmotionalMemoryService', 
                  return_value=memory_service):
            memory = EmotionalMemory(
                config={"default_user_id": "test_user"},
                event_bus=event_bus
            )
            return memory

    @pytest.mark.asyncio
    async def test_initialization(self, emotional_memory, event_bus, memory_service):
        """Test initialization of EmotionalMemory."""
        # Test initialization
        await emotional_memory.initialize()
        
        # Verify that the memory service was called
        memory_service.get_relationship_context.assert_called_once_with("test_user")
        memory_service.get_emotional_context.assert_called_once()
        memory_service.get_recent_interactions.assert_called_once()
        
        # Verify that the event was emitted
        event_bus.emit.assert_called_once()
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.initialized"
        assert args[1]["user_id"] == "test_user"
        
        # Verify that the state was updated
        assert emotional_memory.interaction_count == 10
        assert emotional_memory.initialized is True

    @pytest.mark.asyncio
    async def test_store_interaction(self, emotional_memory, event_bus, memory_service):
        """Test storing an interaction."""
        # Initialize
        await emotional_memory.initialize()
        
        # Store interaction
        await emotional_memory.store_interaction(
            interaction_type="greeting",
            emotional_data={
                "valence": 0.8,
                "arousal": 0.5,
                "dominance": 0.6
            },
            context={"location": "home"},
            response="Hello!",
            trigger="greeting",
            confidence=0.9
        )
        
        # Verify that the memory service was called
        memory_service.store_interaction.assert_called_once_with(
            user_id="test_user",
            interaction_type="greeting",
            emotional_data={
                "valence": 0.8,
                "arousal": 0.5,
                "dominance": 0.6
            },
            context={"location": "home"},
            response="Hello!",
            trigger="greeting",
            confidence=0.9
        )
        
        # Verify that the event was emitted
        assert event_bus.emit.call_count == 2  # First for init, second for store
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.interaction_stored"
        assert args[1]["interaction_type"] == "greeting"
        
        # Verify that the state was updated
        assert emotional_memory.interaction_count == 11
        assert emotional_memory.current_emotional_state["valence"] == 0.8

    @pytest.mark.asyncio
    async def test_update_relationship(self, emotional_memory, event_bus, memory_service):
        """Test updating relationship metrics."""
        # Initialize
        await emotional_memory.initialize()
        
        # Update relationship
        await emotional_memory.update_relationship(
            trust_delta=0.1,
            rapport_delta=0.2
        )
        
        # Verify that the memory service was called
        memory_service.update_relationship_metrics.assert_called_once_with(
            user_id="test_user",
            trust_delta=0.1,
            rapport_delta=0.2
        )
        
        # Verify that the event was emitted
        assert event_bus.emit.call_count == 2  # First for init, second for update
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.relationship_updated"
        assert "trust_level" in args[1]

    @pytest.mark.asyncio
    async def test_store_value(self, emotional_memory, event_bus, memory_service):
        """Test storing a value in the value system."""
        # Initialize
        await emotional_memory.initialize()
        
        # Store value
        await emotional_memory.store_value(
            value_name="honesty",
            value_level=0.95
        )
        
        # Verify that the memory service was called
        memory_service.store_emotional_context.assert_called_once_with(
            user_id="test_user",
            context_type="value_system",
            context_data=emotional_memory.value_system
        )
        
        # Verify that the event was emitted
        assert event_bus.emit.call_count == 2  # First for init, second for store
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.value_updated"
        assert args[1]["value_name"] == "honesty"
        assert args[1]["value_level"] == 0.95
        
        # Verify that the value was updated
        assert emotional_memory.value_system["honesty"] == 0.95

    @pytest.mark.asyncio
    async def test_get_emotional_context(self, emotional_memory, memory_service):
        """Test getting emotional context."""
        # Initialize
        await emotional_memory.initialize()
        
        # Get context
        context = await emotional_memory.get_emotional_context(context_type="value_system")
        
        # Verify that the memory service was called
        memory_service.get_emotional_context.assert_called_with(
            user_id="test_user",
            context_type="value_system"
        )
        
        # Verify the result
        assert context == memory_service.get_emotional_context.return_value

    @pytest.mark.asyncio
    async def test_get_emotional_summary(self, emotional_memory, memory_service):
        """Test getting emotional summary."""
        # Setup mock return value
        memory_service.get_emotional_summary.return_value = {
            "period": {"total_days": 7},
            "emotional_state": {"stability": 0.8}
        }
        
        # Initialize
        await emotional_memory.initialize()
        
        # Get summary
        summary = await emotional_memory.get_emotional_summary(days=7)
        
        # Verify that the memory service was called
        memory_service.get_emotional_summary.assert_called_once_with(
            user_id="test_user",
            days=7
        )
        
        # Verify the result
        assert summary["period"]["total_days"] == 7
        assert summary["emotional_state"]["stability"] == 0.8

    @pytest.mark.asyncio
    async def test_get_emotional_patterns(self, emotional_memory, memory_service):
        """Test getting emotional patterns."""
        # Setup mock return value
        memory_service.get_emotional_patterns.return_value = [
            {
                "type": "trend",
                "data": {"dimension": "valence", "trend": "increasing"},
                "confidence": 0.8
            }
        ]
        
        # Initialize
        await emotional_memory.initialize()
        
        # Get patterns
        patterns = await emotional_memory.get_emotional_patterns(
            pattern_types=["trend"],
            min_confidence=0.7
        )
        
        # Verify that the memory service was called
        memory_service.get_emotional_patterns.assert_called_once_with(
            user_id="test_user",
            pattern_types=["trend"],
            min_confidence=0.7
        )
        
        # Verify the result
        assert len(patterns) == 1
        assert patterns[0]["type"] == "trend"
        assert patterns[0]["confidence"] == 0.8

    @pytest.mark.asyncio
    async def test_get_nostalgic_memories(self, emotional_memory, memory_service):
        """Test getting nostalgic memories."""
        # Setup mock return value
        memory_service.get_nostalgic_memories.return_value = [
            {
                "timestamp": "2023-01-01T12:00:00",
                "dimensions": {"valence": 0.9, "temporal": 0.8},
                "context": {"location": "home"}
            }
        ]
        
        # Initialize
        await emotional_memory.initialize()
        
        # Get memories
        memories = await emotional_memory.get_nostalgic_memories(
            trigger="holiday",
            limit=5
        )
        
        # Verify that the memory service was called
        memory_service.get_nostalgic_memories.assert_called_once_with(
            trigger="holiday",
            limit=5
        )
        
        # Verify the result
        assert len(memories) == 1
        assert memories[0]["dimensions"]["valence"] == 0.9

    @pytest.mark.asyncio
    async def test_get_similar_memories(self, emotional_memory, memory_service):
        """Test getting similar memories."""
        # Setup mock return value
        memory_service.get_similar_memories.return_value = [
            {
                "timestamp": "2023-01-01T12:00:00",
                "dimensions": {"valence": 0.7},
                "context": {"location": "home"},
                "match_type": "trigger"
            }
        ]
        
        # Initialize
        await emotional_memory.initialize()
        
        # Get memories
        memories = await emotional_memory.get_similar_memories(
            trigger="greeting",
            context={"location": "home"},
            limit=5
        )
        
        # Verify that the memory service was called
        memory_service.get_similar_memories.assert_called_once_with(
            trigger="greeting",
            context={"location": "home"},
            limit=5
        )
        
        # Verify the result
        assert len(memories) == 1
        assert memories[0]["match_type"] == "trigger"

    @pytest.mark.asyncio
    async def test_clear_user_data(self, emotional_memory, event_bus, memory_service):
        """Test clearing user data."""
        # Initialize
        await emotional_memory.initialize()
        
        # Clear data
        await emotional_memory.clear_user_data()
        
        # Verify that the memory service was called
        memory_service.clear_user_data.assert_called_once_with("test_user")
        
        # Verify that the event was emitted
        assert event_bus.emit.call_count == 2  # First for init, second for clear
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.cleared"
        
        # Verify that the state was reset
        assert emotional_memory.interaction_count == 0
        assert emotional_memory.current_emotional_state["valence"] == 0.0

    @pytest.mark.asyncio
    async def test_switch_user(self, emotional_memory, event_bus, memory_service):
        """Test switching users."""
        # Initialize
        await emotional_memory.initialize()
        
        # Setup new mock return values for new user
        memory_service.get_relationship_context.return_value = {
            "trust_level": 0.5,
            "rapport_level": 0.4,
            "interaction_count": 5,
            "last_interaction": datetime.now().isoformat()
        }
        
        # Switch user
        await emotional_memory.switch_user("new_user")
        
        # Verify that the memory service was called
        memory_service.get_relationship_context.assert_called_with("new_user")
        
        # Verify that the event was emitted
        assert event_bus.emit.call_count == 2  # First for init, second for switch
        args, _ = event_bus.emit.call_args
        assert args[0] == "emotional.memory.user_switched"
        assert args[1]["user_id"] == "new_user"
        
        # Verify that the state was updated
        assert emotional_memory.current_user_id == "new_user"
        assert emotional_memory.interaction_count == 5

    @pytest.mark.asyncio
    async def test_event_handlers(self, emotional_memory, event_bus, memory_service):
        """Test event handlers."""
        # Initialize
        await emotional_memory.initialize()
        
        # Test emotional update handler
        event_data = {
            "interaction_type": "question",
            "emotional_data": {
                "valence": 0.6,
                "arousal": 0.7,
                "dominance": 0.5
            },
            "context": {"topic": "science"},
            "response": "Here's the answer",
            "trigger": "curiosity"
        }
        
        # Call handler directly
        await emotional_memory._handle_emotional_update(event_data)
        
        # Verify that the memory service was called
        memory_service.store_interaction.assert_called_once()
        
        # Test interaction complete handler
        event_data = {
            "trust_delta": 0.1,
            "rapport_delta": 0.2
        }
        
        # Reset mock
        memory_service.reset_mock()
        
        # Call handler directly
        await emotional_memory._handle_interaction_complete(event_data)
        
        # Verify that the memory service was called
        memory_service.update_relationship_metrics.assert_called_once()
        
        # Test value update handler
        event_data = {
            "value_name": "honesty",
            "value_level": 0.95
        }
        
        # Reset mock
        memory_service.reset_mock()
        
        # Call handler directly
        await emotional_memory._handle_value_update(event_data)
        
        # Verify that the memory service was called
        memory_service.store_emotional_context.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_handling(self, emotional_memory, memory_service):
        """Test error handling."""
        # Setup mock to raise exception
        memory_service.get_relationship_context.side_effect = Exception("Test error")
        
        # Test initialization error
        with pytest.raises(EmotionalMemoryError):
            await emotional_memory.initialize()
        
        # Reset mock
        memory_service.get_relationship_context.side_effect = None
        
        # Initialize successfully
        await emotional_memory.initialize()
        
        # Test store interaction error
        memory_service.store_interaction.side_effect = Exception("Test error")
        
        with pytest.raises(EmotionalMemoryError):
            await emotional_memory.store_interaction(
                interaction_type="greeting",
                emotional_data={"valence": 0.8},
                context={},
                response="Hello"
            )