"""
Integration tests for ALEJO's memory system components.
Tests interaction between Working Memory, Episodic Memory, and Semantic Memory.
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any

from alejo.cognitive.memory.models import Episode, Concept, Relationship, WorkingMemoryItem
from alejo.core.events import Event, EventType
from alejo.utils.error_handling import handle_errors

class TestMemorySystemIntegration:
    """Integration tests for memory system components working together."""
    
    async def test_01_working_to_episodic_memory_flow(self, working_memory, episodic_memory, event_bus):
        """Test that focused items in working memory get stored as episodes."""
        # Create test data
        content = {"text": "The sky is blue", "confidence": 0.95}
        source = "visual_processor"
        context = {"location": "outdoors", "time": datetime.now().isoformat()}
        
        # Focus item in working memory
        item_id = await working_memory.focus_on(content, source, context)
        assert item_id is not None
        
        # Verify working memory state
        items = await working_memory.get_active_items()
        assert len(items) == 1
        assert items[0].id == item_id
        
        # Wait for event propagation
        await asyncio.sleep(0.1)
        
        # Verify episode was created
        episodes = await episodic_memory.get_recent_episodes(limit=1)
        assert len(episodes) == 1
        assert episodes[0].content["text"] == content["text"]
        assert episodes[0].source == source
        
    async def test_02_episodic_to_semantic_memory_flow(self, episodic_memory, semantic_memory, event_bus):
        """Test that repeated episodes form semantic concepts and relationships."""
        # Create multiple similar episodes
        sky_episodes = [
            Episode(
                content={"text": "The sky is blue", "confidence": 0.95},
                source="visual_processor",
                context={"time": datetime.now().isoformat(), "weather": "clear"}
            ),
            Episode(
                content={"text": "The sky appears blue", "confidence": 0.92},
                source="visual_processor",
                context={"time": (datetime.now() + timedelta(hours=1)).isoformat(), "weather": "clear"}
            ),
            Episode(
                content={"text": "Blue sky observed", "confidence": 0.88},
                source="visual_processor",
                context={"time": (datetime.now() + timedelta(hours=2)).isoformat(), "weather": "clear"}
            )
        ]
        
        # Store episodes
        for episode in sky_episodes:
            await episodic_memory.store_episode(episode)
            
        # Wait for processing
        await asyncio.sleep(0.1)
        
        # Verify semantic concepts were formed
        concepts = await semantic_memory.get_concepts(query="sky")
        assert len(concepts) > 0
        sky_concept = concepts[0]
        assert "blue" in sky_concept.attributes
        
        # Verify relationships
        relationships = await semantic_memory.get_relationships(sky_concept.id)
        assert len(relationships) > 0
        assert any(r.predicate == "has_color" for r in relationships)
        
    async def test_03_semantic_to_working_memory_flow(self, working_memory, semantic_memory, event_bus):
        """Test that semantic knowledge influences working memory focus."""
        # Create semantic concepts
        sky_concept = Concept(name="sky", attributes={"color": "blue", "location": "above"})
        blue_concept = Concept(name="blue", attributes={"type": "color", "wavelength": "440-490nm"})
        
        await semantic_memory.store_concept(sky_concept)
        await semantic_memory.store_concept(blue_concept)
        await semantic_memory.store_relationship(
            Relationship(
                source_id=sky_concept.id,
                target_id=blue_concept.id,
                predicate="has_color"
            )
        )
        
        # Create new observation
        content = {"text": "Looking at the sky", "confidence": 0.9}
        source = "visual_processor"
        context = {"location": "outdoors", "time": datetime.now().isoformat()}
        
        # Focus in working memory
        item_id = await working_memory.focus_on(content, source, context)
        
        # Wait for processing
        await asyncio.sleep(0.1)
        
        # Verify semantic knowledge was activated
        items = await working_memory.get_active_items()
        assert len(items) > 1  # Should have original item plus semantic activations
        
        # Verify semantic attributes are present
        semantic_items = [i for i in items if i.source == "semantic_memory"]
        assert len(semantic_items) > 0
        assert any("blue" in str(i.content) for i in semantic_items)
        
    async def test_04_concurrent_memory_operations(self, working_memory, episodic_memory, semantic_memory, event_bus):
        """Test concurrent operations across memory systems."""
        # Create multiple concurrent tasks
        tasks = []
        
        # Working memory tasks
        for i in range(5):
            content = {f"task_{i}": f"content_{i}"}
            tasks.append(working_memory.focus_on(content, "test", {"index": i}))
            
        # Episodic memory tasks
        for i in range(5):
            episode = Episode(
                content={f"episode_{i}": f"content_{i}"},
                source="test",
                context={"index": i}
            )
            tasks.append(episodic_memory.store_episode(episode))
            
        # Semantic memory tasks
        for i in range(5):
            concept = Concept(name=f"concept_{i}", attributes={"index": i})
            tasks.append(semantic_memory.store_concept(concept))
            
        # Run all tasks concurrently
        await asyncio.gather(*tasks)
        
        # Verify results
        working_items = await working_memory.get_active_items()
        assert len(working_items) == 5
        
        episodes = await episodic_memory.get_recent_episodes(limit=10)
        assert len(episodes) >= 5
        
        all_concepts = await semantic_memory.get_all_concepts()
        assert len(all_concepts) >= 5
        
    async def test_05_memory_error_handling(self, working_memory, episodic_memory, semantic_memory, event_bus):
        """Test error handling and recovery across memory systems."""
        # Test invalid episode format
        with pytest.raises(Exception):
            await episodic_memory.store_episode({"invalid": "format"})
            
        # Verify working memory still functions
        item_id = await working_memory.focus_on({"text": "test"}, "test", {})
        assert item_id is not None
        
        # Test invalid concept format
        with pytest.raises(Exception):
            await semantic_memory.store_concept({"invalid": "format"})
            
        # Verify episodic memory still functions
        episode = Episode(content={"text": "test"}, source="test", context={})
        episode_id = await episodic_memory.store_episode(episode)
        assert episode_id is not None
        
    async def test_06_memory_cleanup_and_decay(self, working_memory, episodic_memory, event_bus):
        """Test memory cleanup and decay mechanisms."""
        # Fill working memory
        for i in range(10):
            await working_memory.focus_on(
                content={f"item_{i}": f"content_{i}"},
                source="test",
                context={},
                importance=0.1 * i
            )
            
        # Verify least important items are removed first
        items = await working_memory.get_active_items()
        assert len(items) <= working_memory.capacity
        
        # Items should be ordered by importance
        importances = [i.importance for i in items]
        assert importances == sorted(importances, reverse=True)
        
        # Test decay over time
        await asyncio.sleep(0.5)  # Allow some decay time
        
        updated_items = await working_memory.get_active_items()
        assert len(updated_items) <= len(items)  # Should have decayed
        
        # Verify activation values have decreased
        for old, new in zip(items, updated_items):
            if old.id == new.id:
                assert new.activation <= old.activation
