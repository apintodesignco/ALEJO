"""
Integration tests for the EmotionalMemory integration with ALEJOBrain.

Tests the interaction between ALEJOBrain and the EmotionalMemory component,
ensuring proper initialization, event handling, and data flow between components.
"""

import asyncio
import json
import os
import secrets  # More secure for cryptographic purposes
import tempfile
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.emotional_intelligence.emotional_memory import EmotionalMemory
from alejo.emotional_intelligence.memory import EmotionalMemoryService
from alejo.llm_client import LLMResponse
from alejo.utils.events import EventBus
from alejo.utils.exceptions import EmotionalMemoryError, LLMServiceError


class TestBrainEmotionalMemoryIntegration:
    """Test suite for ALEJOBrain and EmotionalMemory integration."""

    @pytest.fixture
    def event_bus(self):
        """Create a real event bus for integration testing."""
        return EventBus()

    @pytest.fixture
    def config(self):
        """Create a test configuration."""
        # Create a temporary database file for testing
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        temp_db.close()

        return {
            "default_user_id": "test_user",
            "db_path": temp_db.name,
            "llm": {"provider": "mock", "model": "mock-model"},
            "emotional_intelligence": {
                "enabled": True,
                "default_values": {"honesty": 0.9, "kindness": 0.8},
            },
        }

    @pytest.fixture
    def mock_llm_client(self):
        """Create a mock LLM client."""
        mock_client = MagicMock()
        mock_client.generate_text = AsyncMock(
            return_value=LLMResponse(
                text="This is a test response",
                metadata={"model": "mock-model", "tokens": 10},
            )
        )
        mock_client.generate_chat_response = AsyncMock(
            return_value=LLMResponse(
                text="This is a test chat response",
                metadata={"model": "mock-model", "tokens": 15},
            )
        )
        return mock_client

    @pytest.fixture
    def brain(self, event_bus, config, mock_llm_client):
        """Create an ALEJOBrain instance with real EmotionalMemory."""
        with patch(
            "alejo.brain.alejo_brain.LLMClientFactory.create_client",
            return_value=mock_llm_client,
        ):
            # Create a real EmotionalMemory instance
            emotional_memory = EmotionalMemory(config=config, event_bus=event_bus)

            # Create the brain with the real EmotionalMemory
            brain = ALEJOBrain(config=config, event_bus=event_bus)

            # Replace the auto-created EmotionalMemory with our test instance
            brain.emotional_memory = emotional_memory

            return brain

    @pytest.mark.asyncio
    async def test_brain_initialization_with_emotional_memory(self, brain):
        """Test that ALEJOBrain initializes with EmotionalMemory."""
        # Verify that EmotionalMemory is initialized
        assert brain.emotional_memory is not None
        assert isinstance(brain.emotional_memory, EmotionalMemory)

        # Initialize the brain asynchronously
        await brain.emotional_memory.initialize()

        # Verify that EmotionalMemory is initialized
        assert brain.emotional_memory.initialized is True
        assert brain.emotional_memory.current_user_id == "test_user"

    @pytest.mark.asyncio
    async def test_emotional_state_update_from_llm_response(self, brain, event_bus):
        """Test that emotional state is updated from LLM responses."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock the emotional processor's analyze method
        with patch.object(
            brain.emotional_processor,
            "analyze_text",
            return_value={
                "valence": 0.8,
                "arousal": 0.6,
                "dominance": 0.7,
                "primary_emotion": "happiness",
                "emotion_scores": {"happiness": 0.8, "surprise": 0.2},
                "confidence": 0.9,
            },
        ):
            # Emit an LLM response event
            await event_bus.emit(
                "llm.response",
                {
                    "text": "I'm feeling happy today!",
                    "metadata": {"model": "mock-model"},
                    "context": {"user_query": "How are you?"},
                },
            )

            # Allow time for event processing
            await asyncio.sleep(0.1)

            # Verify that the emotional state was updated
            emotional_state = await brain.emotional_memory.get_current_emotional_state()
            assert emotional_state["valence"] == 0.8
            assert emotional_state["primary_emotion"] == "happiness"

    @pytest.mark.asyncio
    async def test_store_interaction_during_text_processing(
        self, brain, mock_llm_client
    ):
        """Test that interactions are stored during text processing."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock the emotional processor
        with patch.object(
            brain.emotional_processor,
            "analyze_text",
            return_value={
                "valence": 0.7,
                "arousal": 0.5,
                "dominance": 0.6,
                "primary_emotion": "interest",
                "emotion_scores": {"interest": 0.7, "curiosity": 0.3},
                "confidence": 0.85,
            },
        ), patch.object(
            brain.emotional_memory, "store_interaction", AsyncMock()
        ) as mock_store:

            # Process text input
            response = await brain.process_text("Tell me about quantum physics")

            # Verify that store_interaction was called
            mock_store.assert_called_once()
            args, kwargs = mock_store.call_args
            assert kwargs["interaction_type"] == "interest"
            assert kwargs["emotional_data"]["valence"] == 0.7
            assert "quantum physics" in str(kwargs["context"])

    @pytest.mark.asyncio
    async def test_relationship_update_after_interaction(self, brain):
        """Test that relationship metrics are updated after interactions."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock the emotional processor and update_relationship
        with patch.object(
            brain.emotional_processor,
            "analyze_text",
            return_value={
                "valence": 0.9,
                "arousal": 0.7,
                "dominance": 0.6,
                "primary_emotion": "joy",
                "emotion_scores": {"joy": 0.9, "trust": 0.7},
                "confidence": 0.95,
            },
        ), patch.object(
            brain.emotional_memory, "update_relationship", AsyncMock()
        ) as mock_update:

            # Process a positive interaction
            response = await brain.process_text("You're very helpful, thank you!")

            # Verify that update_relationship was called with positive deltas
            mock_update.assert_called_once()
            args, kwargs = mock_update.call_args
            assert kwargs["trust_delta"] > 0
            assert kwargs["rapport_delta"] > 0

    @pytest.mark.asyncio
    async def test_emotional_context_in_llm_prompting(self, brain, mock_llm_client):
        """Test that emotional context is included in LLM prompting."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Set up emotional state
        brain.emotional_memory.current_emotional_state = {
            "valence": 0.8,
            "arousal": 0.6,
            "dominance": 0.7,
            "primary_emotion": "happiness",
            "emotion_scores": {"happiness": 0.8},
            "confidence": 0.9,
        }

        # Process text with emotional context
        await brain.generate_text("Hello there")

        # Verify that the LLM client was called with emotional context
        args, kwargs = mock_llm_client.generate_text.call_args
        prompt = args[0]
        assert "emotional" in prompt.lower() or "happiness" in prompt.lower()

    @pytest.mark.asyncio
    async def test_value_system_integration(self, brain):
        """Test that the value system is integrated with brain operations."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock store_value
        with patch.object(
            brain.emotional_memory, "store_value", AsyncMock()
        ) as mock_store:
            # Emit a value update event
            await brain.event_bus.emit(
                "value.update", {"value_name": "honesty", "value_level": 0.95}
            )

            # Allow time for event processing
            await asyncio.sleep(0.1)

            # Verify that store_value was called
            mock_store.assert_called_once()
            args, kwargs = mock_store.call_args
            assert kwargs["value_name"] == "honesty"
            assert kwargs["value_level"] == 0.95

    @pytest.mark.asyncio
    async def test_emotional_patterns_in_response_generation(self, brain):
        """Test that emotional patterns influence response generation."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock get_emotional_patterns to return patterns
        with patch.object(
            brain.emotional_memory,
            "get_emotional_patterns",
            AsyncMock(
                return_value=[
                    {
                        "type": "trend",
                        "data": {"dimension": "valence", "trend": "increasing"},
                        "confidence": 0.8,
                    }
                ]
            ),
        ), patch.object(
            brain.emotional_processor,
            "adjust_response",
            return_value="Adjusted response",
        ) as mock_adjust:

            # Generate a response
            response = await brain.generate_text("How are you feeling?")

            # Verify that the emotional processor was used to adjust the response
            mock_adjust.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_handling_in_emotional_memory_integration(
        self, brain, event_bus
    ):
        """Test error handling in emotional memory integration."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock store_interaction to raise an error
        with patch.object(
            brain.emotional_memory,
            "store_interaction",
            AsyncMock(side_effect=EmotionalMemoryError("Test error")),
        ):

            # Process text input (should not raise an exception)
            response = await brain.process_text("Hello there")

            # Verify that the response was still generated despite the error
            assert response is not None

    @pytest.mark.asyncio
    async def test_emotional_memory_persistence(self, brain, config):
        """Test that emotional memory data persists."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Store an interaction directly in the memory service
        memory_service = EmotionalMemoryService(config=config)
        memory_service.store_interaction(
            user_id="test_user",
            interaction_type="greeting",
            emotional_data={"valence": 0.8, "arousal": 0.6, "dominance": 0.7},
            context={"location": "test"},
            response="Hello!",
            trigger="greeting",
            confidence=0.9,
        )

        # Get recent interactions
        interactions = memory_service.get_recent_interactions("test_user")

        # Verify that the interaction was stored
        assert len(interactions) == 1
        assert interactions[0]["interaction_type"] == "greeting"

        # Clean up the test database
        os.unlink(config["db_path"])

    @pytest.mark.asyncio
    async def test_brain_shutdown_with_emotional_memory(self, brain):
        """Test that brain shutdown properly handles emotional memory."""
        # Initialize the brain
        await brain.emotional_memory.initialize()

        # Mock update_relationship
        with patch.object(
            brain.emotional_memory, "update_relationship", AsyncMock()
        ) as mock_update:
            # Shutdown the brain
            await brain.shutdown()

            # Verify that update_relationship was called to save final state
            mock_update.assert_called_once()
