"""
Tests for ALEJO's accessibility memory system.
"""

import asyncio
import secrets
from datetime import datetime
from typing import Any, Dict

import pytest
from alejo.cognitive.memory.accessibility_memory import AccessibilityMemory, AccessibilityMemoryItem
from alejo.cognitive.memory.models import MemoryType
from alejo.core.events import Event, EventType


class MockMemoryStore:
    """Mock memory store for testing."""
    
    def __init__(self):
        self.data = {}
        
    def get(self, key, default=None):
        return self.data.get(key, default)
        
    def set(self, key, value):
        self.data[key] = value
        return True


class MockEventBus:
    """Mock event bus for testing."""
    
    def __init__(self):
        self.subscribers = {}
        self.published_events = []
        
    def subscribe(self, event_type, callback):
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
        
    def unsubscribe(self, event_type, callback):
        if event_type in self.subscribers:
            if callback in self.subscribers[event_type]:
                self.subscribers[event_type].remove(callback)
                
    def publish(self, event_type, data=None):
        self.published_events.append((event_type, data))
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                asyncio.create_task(callback(data))


class MockWorkingMemory:
    """Mock working memory for testing."""
    
    def __init__(self):
        self.references = []
        
    async def add_reference(self, type, reference_id, content, metadata=None):
        self.references.append({
            "type": type,
            "reference_id": reference_id,
            "content": content,
            "metadata": metadata or {}
        })
        return reference_id


class TestAccessibilityMemory:
    """Unit tests for AccessibilityMemory class."""
    
    @pytest.fixture
    def memory_store(self):
        return MockMemoryStore()
        
    @pytest.fixture
    def event_bus(self):
        return MockEventBus()
        
    @pytest.fixture
    def working_memory(self):
        return MockWorkingMemory()
        
    @pytest.fixture
    async def memory(self, memory_store, event_bus, working_memory):
        memory = AccessibilityMemory(memory_store, event_bus, working_memory)
        await memory.start()
        yield memory
        await memory.stop()
        
    async def test_01_feature_used_event(self, memory):
        """Test handling of feature used events."""
        # Simulate feature used event
        await memory._on_feature_used({
            "feature_id": "eye_tracking",
            "modality": "visual",
            "context": {"lighting": "dim", "noise_level": "low"}
        })
        
        # Check that memory was created
        items = memory.find_by_feature_and_modality("eye_tracking", "visual")
        assert len(items) == 1
        
        item = items[0]
        assert item.feature_id == "eye_tracking"
        assert item.modality == "visual"
        assert item.context["lighting"] == "dim"
        assert item.context["noise_level"] == "low"
        assert item.access_count == 1
        
        # Check that working memory reference was created
        assert len(memory.working_memory.references) == 1
        reference = memory.working_memory.references[0]
        assert reference["type"] == MemoryType.ACCESSIBILITY
        assert reference["content"].startswith("Accessibility feature eye_tracking")
        
    async def test_02_preference_changed_event(self, memory):
        """Test handling of preference changed events."""
        # Simulate preference changed event
        await memory._on_preference_changed({
            "feature_id": "voice_commands",
            "modality": "auditory",
            "preferences": {"volume": 0.8, "speed": 1.2}
        })
        
        # Check that memory was created
        items = memory.find_by_feature_and_modality("voice_commands", "auditory")
        assert len(items) == 1
        
        item = items[0]
        assert item.feature_id == "voice_commands"
        assert item.modality == "auditory"
        assert item.preferences["volume"] == 0.8
        assert item.preferences["speed"] == 1.2
        
        # Update preference
        await memory._on_preference_changed({
            "feature_id": "voice_commands",
            "modality": "auditory",
            "preferences": {"volume": 0.9}
        })
        
        # Check that preference was updated
        items = memory.find_by_feature_and_modality("voice_commands", "auditory")
        assert len(items) == 1
        
        item = items[0]
        assert item.preferences["volume"] == 0.9
        assert item.preferences["speed"] == 1.2
        
    async def test_03_effectiveness_feedback(self, memory):
        """Test handling of effectiveness feedback."""
        # Create memory item first
        await memory._on_feature_used({
            "feature_id": "gesture_recognition",
            "modality": "motor",
            "context": {"lighting": "bright"}
        })
        
        # Simulate effectiveness feedback
        await memory._on_effectiveness_feedback({
            "feature_id": "gesture_recognition",
            "modality": "motor",
            "effectiveness": 0.3
        })
        
        # Check that effectiveness was updated
        items = memory.find_by_feature_and_modality("gesture_recognition", "motor")
        assert len(items) == 1
        
        item = items[0]
        # Should be blend of default (0.5) and new value (0.3)
        expected = (0.5 * 0.7) + (0.3 * 0.3)
        assert abs(item.effectiveness - expected) < 0.001
        
        # Check that adaptation need was recorded (low effectiveness)
        assert len(memory.adaptation_history) == 1
        adaptation = memory.adaptation_history[0]
        assert adaptation["feature_id"] == "gesture_recognition"
        assert adaptation["modality"] == "motor"
        
    async def test_04_context_changed(self, memory):
        """Test handling of context changed events."""
        # Create memory items first
        await memory._on_feature_used({
            "feature_id": "eye_tracking",
            "modality": "visual",
            "context": {"lighting": "dim", "noise_level": "low"}
        })
        
        await memory._on_feature_used({
            "feature_id": "voice_commands",
            "modality": "auditory",
            "context": {"noise_level": "low"}
        })
        
        # Simulate context changed event
        await memory._on_context_changed({
            "context": {"lighting": "bright", "noise_level": "high"}
        })
        
        # Check that context was updated in relevant memories
        items = memory.find_by_feature_and_modality("eye_tracking", "visual")
        assert items[0].context["lighting"] == "bright"
        assert items[0].context["noise_level"] == "high"
        
        items = memory.find_by_feature_and_modality("voice_commands", "auditory")
        assert "lighting" not in items[0].context
        assert items[0].context["noise_level"] == "high"
        
    async def test_05_fatigue_detection(self, memory):
        """Test handling of fatigue detection events."""
        # Simulate fatigue detection event
        await memory._on_fatigue_detected({
            "level": 0.7,
            "modality": "visual"
        })
        
        # Check that adaptation need was recorded
        assert len(memory.adaptation_history) == 1
        adaptation = memory.adaptation_history[0]
        assert adaptation["feature_id"] == "fatigue_adaptation"
        assert adaptation["modality"] == "visual"
        assert adaptation["effectiveness"] == 0.3  # 1.0 - 0.7
        assert adaptation["context"]["fatigue_level"] == 0.7
        
    async def test_06_get_preferred_settings(self, memory):
        """Test retrieving preferred settings."""
        # Create memory items with different preferences
        await memory._on_preference_changed({
            "feature_id": "dwell_click",
            "modality": "visual",
            "preferences": {"dwell_time": 1000, "sensitivity": 0.7}
        })
        
        # Create another with different context
        item_id = f"acc_mem_dwell_click_visual_{int(datetime.now().timestamp())}"
        item = AccessibilityMemoryItem(
            id=item_id,
            feature_id="dwell_click",
            modality="visual",
            context={"lighting": "dim"},
            preferences={"dwell_time": 1500, "sensitivity": 0.5},
            effectiveness=0.9
        )
        memory._add_item_to_indices(item)
        
        # Get preferred settings without context
        settings = await memory.get_preferred_settings("dwell_click", "visual")
        assert settings["dwell_time"] == 1000
        assert settings["sensitivity"] == 0.7
        
        # Get preferred settings with context
        settings = await memory.get_preferred_settings(
            "dwell_click", "visual", {"lighting": "dim"}
        )
        assert settings["dwell_time"] == 1500
        assert settings["sensitivity"] == 0.5
        
    async def test_07_get_adaptation_recommendations(self, memory):
        """Test getting adaptation recommendations."""
        # Add some adaptation history
        memory._record_adaptation_need(
            feature_id="eye_tracking",
            modality="visual",
            effectiveness=0.3,
            context={"lighting": "dim"}
        )
        
        memory._record_adaptation_need(
            feature_id="eye_tracking",
            modality="visual",
            effectiveness=0.4,
            context={"lighting": "dim"}
        )
        
        memory._record_adaptation_need(
            feature_id="voice_commands",
            modality="auditory",
            effectiveness=0.2,
            context={"noise_level": "high"}
        )
        
        # Get recommendations
        recommendations = await memory.get_adaptation_recommendations()
        assert len(recommendations) == 2
        
        # Should be sorted by frequency and effectiveness
        assert recommendations[0]["feature_id"] == "eye_tracking"
        assert recommendations[0]["modality"] == "visual"
        assert recommendations[0]["frequency"] == 2
        
        assert recommendations[1]["feature_id"] == "voice_commands"
        assert recommendations[1]["modality"] == "auditory"
        assert recommendations[1]["frequency"] == 1
        
        # Filter by modality
        recommendations = await memory.get_adaptation_recommendations(modality="auditory")
        assert len(recommendations) == 1
        assert recommendations[0]["feature_id"] == "voice_commands"
        
    async def test_08_record_successful_adaptation(self, memory):
        """Test recording successful adaptations."""
        # Record successful adaptation
        await memory.record_successful_adaptation(
            feature_id="dwell_click",
            modality="visual",
            context={"lighting": "bright"},
            preferences={"dwell_time": 800, "sensitivity": 0.8}
        )
        
        # Check that memory was created
        items = memory.find_by_feature_and_modality("dwell_click", "visual")
        assert len(items) == 1
        
        item = items[0]
        assert item.feature_id == "dwell_click"
        assert item.modality == "visual"
        assert item.context["lighting"] == "bright"
        assert item.preferences["dwell_time"] == 800
        assert item.preferences["sensitivity"] == 0.8
        assert item.effectiveness == 0.8
        
        # Check that event was published
        assert len(memory.event_bus.published_events) == 1
        event_type, data = memory.event_bus.published_events[0]
        assert event_type == "accessibility:adaptation:successful"
        assert data["feature_id"] == "dwell_click"
        
    async def test_09_persistence(self, memory, memory_store):
        """Test that memories are persisted."""
        # Create some memories
        await memory._on_feature_used({
            "feature_id": "eye_tracking",
            "modality": "visual",
            "context": {"lighting": "dim"}
        })
        
        await memory._on_preference_changed({
            "feature_id": "voice_commands",
            "modality": "auditory",
            "preferences": {"volume": 0.8}
        })
        
        # Stop memory system to trigger save
        await memory.stop()
        
        # Check that memories were saved
        stored_items = memory_store.get("accessibility_memories", {})
        assert len(stored_items) == 2
        
        # Create new memory system and load from store
        new_memory = AccessibilityMemory(memory_store)
        await new_memory.start()
        
        # Check that memories were loaded
        assert len(new_memory.items) == 2
        assert len(new_memory.find_by_feature_and_modality("eye_tracking", "visual")) == 1
        assert len(new_memory.find_by_feature_and_modality("voice_commands", "auditory")) == 1
