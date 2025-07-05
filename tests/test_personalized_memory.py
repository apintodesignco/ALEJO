"""
Tests for ALEJO's personalized memory integration.

These tests verify that the personalization engine correctly integrates
with ALEJO's cognitive memory systems.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict

import pytest
from alejo.cognitive.memory.models import (
    Concept,
    Episode,
    Relationship,
    WorkingMemoryItem,
)
from alejo.personalization.memory_integration import PersonalizedMemoryManager
from alejo.personalization.models import PreferenceModel, SecureVault


class MockPreferenceModel:
    """Mock implementation of the preference model for testing."""
    
    def __init__(self):
        self.preferences = {
            "interests": ["technology", "music", "nature"],
            "communication_style": "detailed",
            "privacy_level": "high"
        }
        self.emotional_state = {
            "valence": 0.7,  # Positive
            "arousal": 0.3,  # Calm
            "dominance": 0.6  # Moderate control
        }
        self.experience_log = []
    
    async def get_preferences(self):
        """Get user preferences."""
        return self.preferences
    
    async def get_emotional_state(self):
        """Get current emotional state."""
        return self.emotional_state
    
    async def update_from_experience(self, content, context):
        """Update preferences based on experience."""
        self.experience_log.append({
            "content": content,
            "context": context,
            "timestamp": datetime.now().isoformat()
        })
        return True


class MockSecureVault:
    """Mock implementation of the secure vault for testing."""
    
    def __init__(self):
        self.personal_entities = {
            "people": [
                {"name": "Alice", "relationship": "friend"},
                {"name": "Bob", "relationship": "colleague"}
            ],
            "places": [
                {"name": "Home", "importance": "high"},
                {"name": "Office", "importance": "medium"}
            ],
            "events": [
                {"name": "Birthday", "date": "2025-08-15"}
            ]
        }
    
    async def get_relevant_entities(self, context):
        """Get personal entities relevant to the context."""
        relevant = {}
        
        # Simple keyword matching for testing
        context_str = json.dumps(context).lower()
        
        if "friend" in context_str or "alice" in context_str:
            relevant["people"] = [self.personal_entities["people"][0]]
        
        if "work" in context_str or "office" in context_str:
            relevant["places"] = [self.personal_entities["places"][1]]
        
        return relevant


@pytest.fixture
async def preference_model():
    """Fixture for preference model."""
    return MockPreferenceModel()


@pytest.fixture
async def secure_vault():
    """Fixture for secure vault."""
    return MockSecureVault()


@pytest.fixture
async def personalized_memory_manager(working_memory, episodic_memory, semantic_memory, preference_model, secure_vault):
    """Fixture for personalized memory manager."""
    return PersonalizedMemoryManager(
        working_memory=working_memory,
        episodic_memory=episodic_memory,
        semantic_memory=semantic_memory,
        preference_model=preference_model,
        secure_vault=secure_vault
    )


class TestPersonalizedMemory:
    """Tests for personalized memory integration."""
    
    async def test_store_personal_experience(self, personalized_memory_manager, episodic_memory):
        """Test storing a personal experience with personalization."""
        # Store a personal experience
        content = {"text": "I enjoyed the concert last night", "sentiment": "positive"}
        context = {"location": "concert hall", "activity": "music"}
        
        episode_id = await personalized_memory_manager.store_personal_experience(
            content=content,
            context=context,
            importance=0.8,
            emotion_data={"joy": 0.9, "excitement": 0.8}
        )
        
        # Verify the episode was stored
        episode = await episodic_memory.get_episode(episode_id)
        assert episode is not None
        assert episode.content == content
        assert "user_preferences" in episode.context
        assert episode.importance == 0.8
        assert episode.emotions["joy"] == 0.9
    
    async def test_retrieve_personalized_memories(self, personalized_memory_manager, episodic_memory):
        """Test retrieving memories with personalization."""
        # Create test episodes
        episodes = [
            Episode(
                content={"text": "Listened to jazz music", "sentiment": "positive"},
                context={"activity": "music", "genre": "jazz"},
                source="user_input"
            ),
            Episode(
                content={"text": "Worked on coding project", "sentiment": "neutral"},
                context={"activity": "technology", "project": "ALEJO"},
                source="user_input"
            ),
            Episode(
                content={"text": "Went hiking in the mountains", "sentiment": "positive"},
                context={"activity": "nature", "location": "mountains"},
                source="user_input"
            )
        ]
        
        # Store episodes
        for episode in episodes:
            await episodic_memory.store_episode(episode)
        
        # Retrieve personalized memories
        retrieved = await personalized_memory_manager.retrieve_personalized_memories(
            query="music",
            context={"current_activity": "relaxing"}
        )
        
        # Verify retrieval
        assert len(retrieved) > 0
        assert any("music" in str(episode.content) for episode in retrieved)
    
    async def test_form_personal_concepts(self, personalized_memory_manager, episodic_memory, semantic_memory):
        """Test forming personal concepts from episodic memories."""
        # Create multiple similar episodes
        music_episodes = [
            Episode(
                content={"text": "Listened to jazz music", "sentiment": "positive"},
                context={"activity": "music", "genre": "jazz"},
                source="user_input"
            ),
            Episode(
                content={"text": "Enjoyed classical concert", "sentiment": "positive"},
                context={"activity": "music", "genre": "classical"},
                source="user_input"
            ),
            Episode(
                content={"text": "Played piano for an hour", "sentiment": "positive"},
                context={"activity": "music", "instrument": "piano"},
                source="user_input"
            )
        ]
        
        # Store episodes
        for episode in music_episodes:
            await episodic_memory.store_episode(episode)
        
        # Form concepts
        concepts = await personalized_memory_manager.form_personal_concepts()
        
        # Verify concept formation
        assert len(concepts) > 0
        
        # Check if a music-related concept was formed
        music_concepts = [c for c in concepts if "music" in c.name.lower() or "activity" in c.name.lower()]
        assert len(music_concepts) > 0
    
    async def test_context_enrichment(self, personalized_memory_manager):
        """Test context enrichment with personalization data."""
        # Original context
        context = {
            "location": "office",
            "activity": "meeting",
            "participants": ["team members"]
        }
        
        # Enrich context
        enriched = await personalized_memory_manager._enrich_context(context)
        
        # Verify enrichment
        assert "user_preferences" in enriched
        assert "personal_entities" in enriched
        assert any(entity["name"] == "Office" for entity in enriched["personal_entities"].get("places", []))
    
    async def test_query_personalization(self, personalized_memory_manager):
        """Test query personalization based on preferences."""
        # Original query
        query = "music recommendations"
        context = {"current_activity": "relaxing"}
        
        # Personalize query
        personalized = await personalized_memory_manager._personalize_query(query, context)
        
        # Verify personalization
        assert "music" in personalized
        assert len(personalized) > len(query)  # Query should be enhanced
