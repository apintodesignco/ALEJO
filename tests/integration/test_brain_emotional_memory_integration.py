"""Integration tests for ALEJOBrain and EmotionalMemory integration.

This test suite verifies that the ALEJOBrain properly integrates with the enhanced
EmotionalMemory component, including initialization, event handling, and emotional
context incorporation in responses.
"""
import os
import sys
import asyncio
import unittest
import tempfile
import json
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timedelta

# Add project root to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from alejo.brain.alejo_brain import ALEJOBrain
from alejo.emotional_intelligence.emotional_memory import EmotionalMemory
from alejo.emotional_intelligence.processor import EmotionalProcessor
from alejo.ethical.framework import EthicalFramework
from alejo.events.event_bus import EventBus
from alejo.config.manager import ConfigManager
from alejo.llm_client.response import LLMResponse
import secrets  # More secure for cryptographic purposes


class TestBrainEmotionalMemoryIntegration(unittest.TestCase):
    """Test the integration between ALEJOBrain and EmotionalMemory."""

    def setUp(self):
        """Set up test environment before each test."""
        # Create a temporary database file for testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix='.db')
        
        # Mock configuration
        self.config = {
            "emotional_intelligence": {
                "db_path": self.temp_db_path,
                "user_id": "test_user",
                "enable_logging": True
            },
            "llm": {
                "provider": "mock_provider",
                "model": "mock_model"
            }
        }
        
        # Create event bus
        self.event_bus = EventBus()
        
        # Create config manager with test config
        self.config_manager = ConfigManager()
        self.config_manager.load_config = MagicMock(return_value=self.config)
        
        # Create brain with mocked components
        self.brain = None  # Will be initialized in each test
        
    def tearDown(self):
        """Clean up after each test."""
        # Close and remove the temporary database
        if hasattr(self, 'temp_db_fd') and self.temp_db_fd:
            os.close(self.temp_db_fd)
        if hasattr(self, 'temp_db_path') and os.path.exists(self.temp_db_path):
            os.unlink(self.temp_db_path)
            
        # Clean up any remaining brain resources
        if self.brain:
            asyncio.run(self.brain.shutdown())
            self.brain = None

    async def async_setup(self):
        """Asynchronous setup for tests."""
        # Create brain with mocked components
        self.brain = ALEJOBrain(
            config=self.config,
            event_bus=self.event_bus,
            config_manager=self.config_manager
        )
        
        # Mock LLM client
        self.brain.llm_client = AsyncMock()
        self.brain.llm_client.generate.return_value = "Mocked response"
        self.brain.llm_client.generate_text.return_value = LLMResponse(
            content="Mocked text response",
            model="mock_model",
            metadata={}
        )
        self.brain.llm_client.generate_chat_response.return_value = LLMResponse(
            content="Mocked chat response",
            model="mock_model",
            metadata={}
        )
        
        # Mock emotional processor
        self.brain.emotional_processor = MagicMock()
        self.brain.emotional_processor.analyze_text.return_value = {
            "primary_emotion": "joy",
            "valence": 0.8,
            "arousal": 0.6,
            "confidence": 0.9
        }
        self.brain.emotional_processor.enhance_response.return_value = "Enhanced response"
        
        # Mock ethical framework
        self.brain.ethical_framework = MagicMock()
        self.brain.ethical_framework.evaluate_decision.return_value = True
        self.brain.ethical_framework.validate_response.return_value = "Validated response"
        self.brain.ethical_framework.modify_response.return_value = "Modified response"
        
        # Initialize brain components
        await self.brain.initialize()

    def test_brain_initialization(self):
        """Test that ALEJOBrain properly initializes EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Verify that brain is initialized
            self.assertTrue(self.brain.initialized)
            
            # Verify that emotional memory is initialized
            self.assertIsNotNone(self.brain.emotional_memory)
            
            # Check that event subscriptions are set up
            self.assertIn("emotional.update", self.event_bus._subscribers)
            self.assertIn("llm.response", self.event_bus._subscribers)
            
        asyncio.run(run_test())

    def test_process_input_with_emotional_memory(self):
        """Test that process_input properly uses EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
                return_value={"joy": 0.8, "trust": 0.7}
            )
            self.brain.emotional_memory.get_relationship_context = AsyncMock(
                return_value={"trust": 0.6, "rapport": 0.5}
            )
            self.brain.emotional_memory.store_interaction = AsyncMock()
            self.brain.emotional_memory.update_relationship = AsyncMock()
            
            # Process input
            response = await self.brain.process_input("Hello, how are you?")
            
            # Verify that emotional memory methods were called
            self.brain.emotional_memory.get_current_emotional_state.assert_called_once()
            self.brain.emotional_memory.get_relationship_context.assert_called_once()
            self.brain.emotional_memory.store_interaction.assert_called_once()
            self.brain.emotional_memory.update_relationship.assert_called_once()
            
            # Verify that response was processed through emotional components
            self.assertEqual(response, "Enhanced response")
            
        asyncio.run(run_test())

    def test_generate_text_with_emotional_memory(self):
        """Test that generate_text properly uses EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
                return_value={"joy": 0.8, "trust": 0.7}
            )
            self.brain.emotional_memory.get_relationship_context = AsyncMock(
                return_value={"trust": 0.6, "rapport": 0.5}
            )
            self.brain.emotional_memory.get_emotional_patterns = AsyncMock(
                return_value=[{"pattern": "joy_morning", "confidence": 0.8}]
            )
            self.brain.emotional_memory.get_nostalgic_memories = AsyncMock(
                return_value=[{"memory": "past_joy", "timestamp": "2023-01-01"}]
            )
            self.brain.emotional_memory.store_interaction = AsyncMock()
            self.brain.emotional_memory.update_relationship = AsyncMock()
            
            # Generate text
            response = await self.brain.generate_text("Tell me a story")
            
            # Verify that emotional memory methods were called
            self.brain.emotional_memory.get_current_emotional_state.assert_called_once()
            self.brain.emotional_memory.get_relationship_context.assert_called_once()
            self.brain.emotional_memory.get_emotional_patterns.assert_called_once()
            self.brain.emotional_memory.get_nostalgic_memories.assert_called_once()
            self.brain.emotional_memory.store_interaction.assert_called_once()
            self.brain.emotional_memory.update_relationship.assert_called_once()
            
            # Verify that response includes emotional context
            self.assertIn("emotional_context", response.metadata)
            self.assertEqual(response.content, "Enhanced response")
            
        asyncio.run(run_test())

    def test_generate_chat_response_with_emotional_memory(self):
        """Test that generate_chat_response properly uses EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
                return_value={"joy": 0.8, "trust": 0.7}
            )
            self.brain.emotional_memory.get_relationship_context = AsyncMock(
                return_value={"trust": 0.6, "rapport": 0.5}
            )
            self.brain.emotional_memory.get_emotional_patterns = AsyncMock(
                return_value=[{"pattern": "joy_morning", "confidence": 0.8}]
            )
            self.brain.emotional_memory.get_similar_memories = AsyncMock(
                return_value=[{"memory": "similar_chat", "timestamp": "2023-01-01"}]
            )
            self.brain.emotional_memory.store_interaction = AsyncMock()
            self.brain.emotional_memory.update_relationship = AsyncMock()
            
            # Generate chat response
            messages = [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there"},
                {"role": "user", "content": "How are you?"}
            ]
            response = await self.brain.generate_chat_response(messages)
            
            # Verify that emotional memory methods were called
            self.brain.emotional_memory.get_current_emotional_state.assert_called_once()
            self.brain.emotional_memory.get_relationship_context.assert_called_once()
            self.brain.emotional_memory.get_emotional_patterns.assert_called_once()
            self.brain.emotional_memory.get_similar_memories.assert_called_once()
            self.brain.emotional_memory.store_interaction.assert_called_once()
            self.brain.emotional_memory.update_relationship.assert_called_once()
            
            # Verify that response includes emotional context
            self.assertIn("emotional_context", response.metadata)
            self.assertEqual(response.content, "Enhanced response")
            
        asyncio.run(run_test())

    def test_generate_stream_with_emotional_memory(self):
        """Test that generate_stream properly uses EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
                return_value={"joy": 0.8, "trust": 0.7}
            )
            self.brain.emotional_memory.get_relationship_context = AsyncMock(
                return_value={"trust": 0.6, "rapport": 0.5}
            )
            self.brain.emotional_memory.store_interaction = AsyncMock()
            self.brain.emotional_memory.update_relationship = AsyncMock()
            
            # Mock stream generation
            async def mock_stream():
                chunks = ["Hello", " world", "!"]
                for chunk in chunks:
                    yield chunk
            
            self.brain.llm_client.generate_stream = mock_stream
            
            # Generate stream
            chunks = []
            async for chunk in self.brain.generate_stream("Tell me a story"):
                chunks.append(chunk)
                
            # Wait for async tasks to complete
            await asyncio.sleep(0.1)
            
            # Verify that emotional memory methods were called
            self.brain.emotional_memory.get_current_emotional_state.assert_called_once()
            self.brain.emotional_memory.get_relationship_context.assert_called_once()
            
            # Verify that chunks were yielded correctly
            self.assertEqual(chunks, ["Hello", " world", "!"])
            
        asyncio.run(run_test())

    def test_event_handling(self):
        """Test that ALEJOBrain properly handles events related to EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory._handle_emotional_update = AsyncMock()
            
            # Emit an emotional update event
            await self.event_bus.emit("emotional.update", {"emotion": "joy", "value": 0.8})
            
            # Verify that emotional memory handler was called
            self.brain.emotional_memory._handle_emotional_update.assert_called_once()
            
        asyncio.run(run_test())

    def test_shutdown_with_emotional_memory(self):
        """Test that ALEJOBrain properly shuts down EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory methods
            self.brain.emotional_memory.update_relationship = AsyncMock()
            self.brain.emotional_memory.store_emotional_context = AsyncMock()
            self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
                return_value={"joy": 0.8, "trust": 0.7}
            )
            
            # Shut down brain
            await self.brain.shutdown()
            
            # Verify that emotional memory methods were called
            self.brain.emotional_memory.update_relationship.assert_called_once()
            self.brain.emotional_memory.store_emotional_context.assert_called_once()
            self.brain.emotional_memory.get_current_emotional_state.assert_called_once()
            
            # Verify that brain is no longer initialized
            self.assertFalse(self.brain.initialized)
            
        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()