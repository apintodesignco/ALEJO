"""
Tests for ALEJO's emotional memory system.
"""

import pytest
import asyncio
from datetime import datetime
from typing import Dict, Any

from alejo.cognitive.memory.models import EmotionalState, EmotionalMemoryItem
from alejo.cognitive.memory.emotional_memory import EmotionalMemory
from alejo.core.events import Event, EventType
import secrets  # More secure for cryptographic purposes

class TestEmotionalMemory:
    """Unit tests for EmotionalMemory class."""
    
    async def test_01_emotional_state_update(self, event_bus):
        """Test updating emotional state."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Update with positive emotion
        item_id = await memory.update_emotional_state(
            valence=0.8,
            arousal=0.6,
            dominance=0.4,
            source="test",
            context={"situation": "success"}
        )
        
        assert item_id is not None
        
        # Check current state
        state = await memory.get_current_state()
        assert state.valence > 0
        assert state.arousal > 0
        assert state.dominance > 0
        
        # Update with negative emotion
        await memory.update_emotional_state(
            valence=-0.7,
            arousal=0.8,
            dominance=-0.3,
            source="test",
            context={"situation": "failure"}
        )
        
        # Check state changed
        new_state = await memory.get_current_state()
        assert new_state.valence < state.valence
        assert new_state.arousal > state.arousal
        assert new_state.dominance < state.dominance
        
        await memory.stop()
        
    async def test_02_emotional_memory_history(self, event_bus):
        """Test emotional memory history tracking."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Create multiple emotional memories
        emotions = [
            (0.8, 0.6, 0.4, "joy"),
            (-0.7, 0.8, -0.3, "anger"),
            (0.6, -0.2, 0.5, "contentment"),
            (-0.8, -0.4, -0.6, "sadness")
        ]
        
        for valence, arousal, dominance, emotion in emotions:
            await memory.update_emotional_state(
                valence=valence,
                arousal=arousal,
                dominance=dominance,
                source="test",
                context={"emotion": emotion}
            )
            
        # Check history
        history = await memory.get_emotional_history(limit=10)
        assert len(history) == len(emotions)
        
        # Check order (most recent first)
        assert history[-1].context["emotion"] == "sadness"
        assert history[0].context["emotion"] == "joy"
        
        # Test filtering by source
        test_history = await memory.get_emotional_history(source="test")
        assert len(test_history) == len(emotions)
        
        other_history = await memory.get_emotional_history(source="other")
        assert len(other_history) == 0
        
        await memory.stop()
        
    async def test_03_relationship_context(self, event_bus):
        """Test relationship context management."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Create relationship context
        entity_id = "person_123"
        context = {
            "name": "John",
            "relationship": "friend",
            "trust_level": 0.8,
            "shared_experiences": ["meeting_1", "activity_2"]
        }
        
        await memory.update_relationship_context(entity_id, context)
        
        # Get context
        stored_context = await memory.get_relationship_context(entity_id)
        assert stored_context is not None
        assert stored_context["name"] == "John"
        assert stored_context["trust_level"] == 0.8
        
        # Update context
        update = {
            "trust_level": 0.9,
            "shared_experiences": ["meeting_1", "activity_2", "event_3"]
        }
        
        await memory.update_relationship_context(entity_id, update)
        
        # Check updated context
        updated_context = await memory.get_relationship_context(entity_id)
        assert updated_context["trust_level"] == 0.9
        assert len(updated_context["shared_experiences"]) == 3
        
        await memory.stop()
        
    async def test_04_memory_event_handling(self, event_bus):
        """Test handling of memory events."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Simulate memory event with emotional content
        event = Event(
            type=EventType.MEMORY,
            source="working_memory",
            payload={
                "action": "focus",
                "content": {
                    "text": "Received good news",
                    "emotional_valence": 0.8,
                    "emotional_arousal": 0.6,
                    "emotional_dominance": 0.4
                },
                "context": {"situation": "news"}
            }
        )
        
        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing
        
        # Check emotional state was updated
        state = await memory.get_current_state()
        assert state.valence > 0
        assert state.arousal > 0
        assert state.dominance > 0
        
        await memory.stop()
        
    async def test_05_perception_event_handling(self, event_bus):
        """Test handling of perception events."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Simulate perception event
        event = Event(
            type=EventType.PERCEPTION,
            source="vision",
            payload={
                "emotion": {
                    "valence": -0.6,
                    "arousal": 0.7,
                    "dominance": -0.2
                },
                "context": {"observed": "facial_expression"}
            }
        )
        
        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing
        
        # Check emotional state was updated
        state = await memory.get_current_state()
        assert state.valence < 0
        assert state.arousal > 0
        assert state.dominance < 0
        
        # Check history
        history = await memory.get_emotional_history(limit=1)
        assert len(history) == 1
        assert history[0].source == "vision"
        
        await memory.stop()
        
    async def test_06_emotional_state_intensity(self, event_bus):
        """Test emotional state intensity calculations."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Test neutral state
        state = await memory.get_current_state()
        assert state.get_intensity() == 0
        
        # Test high intensity state
        await memory.update_emotional_state(
            valence=1.0,
            arousal=1.0,
            dominance=1.0,
            source="test"
        )
        
        state = await memory.get_current_state()
        assert state.get_intensity() == 1.0
        
        # Test medium intensity state
        await memory.update_emotional_state(
            valence=0.5,
            arousal=0.5,
            dominance=0.5,
            source="test"
        )
        
        state = await memory.get_current_state()
        assert 0.4 < state.get_intensity() < 0.6
        
        await memory.stop()
        
    async def test_07_invalid_emotional_values(self, event_bus):
        """Test handling of invalid emotional values."""
        memory = EmotionalMemory(event_bus)
        await memory.start()
        
        # Test values outside valid range
        with pytest.raises(ValueError):
            await memory.update_emotional_state(
                valence=1.5,  # Invalid: > 1
                arousal=0.5,
                dominance=0.5,
                source="test"
            )
            
        with pytest.raises(ValueError):
            await memory.update_emotional_state(
                valence=0.5,
                arousal=-1.5,  # Invalid: < -1
                dominance=0.5,
                source="test"
            )
            
        # Verify state unchanged
        state = await memory.get_current_state()
        assert state.valence == 0
        assert state.arousal == 0
        assert state.dominance == 0
        
        await memory.stop()