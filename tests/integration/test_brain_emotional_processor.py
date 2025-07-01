"""Integration tests for ALEJOBrain and EmotionalProcessor integration.

This test suite verifies that the ALEJOBrain properly integrates with the EmotionalProcessor
component, including emotional analysis, response enhancement, and event handling.
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


class TestBrainEmotionalProcessorIntegration(unittest.TestCase):
    """Test the integration between ALEJOBrain and EmotionalProcessor."""

    def setUp(self):
        """Set up test environment before each test."""
        # Create a temporary database file for testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix='.db')
        
        # Mock configuration
        self.config = {
            "emotional_intelligence": {
                "db_path": self.temp_db_path,
                "user_id": "test_user",
                "enable_logging": True,
                "processor": {
                    "model_path": "mock_model_path",
                    "personality_traits": {
                        "openness": 0.7,
                        "conscientiousness": 0.8,
                        "extraversion": 0.6,
                        "agreeableness": 0.9,
                        "neuroticism": 0.3
                    }
                }
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
        
        # Create a real EmotionalProcessor with mocked methods
        self.real_processor = EmotionalProcessor()
        
        # Replace brain's emotional processor with our controlled one
        self.brain.emotional_processor = self.real_processor
        
        # Mock emotional processor methods
        self.brain.emotional_processor.analyze_text = MagicMock(return_value={
            "primary_emotion": "joy",
            "secondary_emotion": "trust",
            "valence": 0.8,
            "arousal": 0.6,
            "dominance": 0.7,
            "confidence": 0.9,
            "emotions": {
                "joy": 0.8,
                "trust": 0.7,
                "anticipation": 0.5,
                "surprise": 0.3,
                "anger": 0.1,
                "fear": 0.1,
                "disgust": 0.1,
                "sadness": 0.1
            }
        })
        self.brain.emotional_processor.enhance_response = MagicMock(
            side_effect=lambda text: f"Enhanced: {text}"
        )
        self.brain.emotional_processor.process_text = MagicMock()
        
        # Mock emotional memory
        self.brain.emotional_memory = AsyncMock()
        self.brain.emotional_memory.get_current_emotional_state = AsyncMock(
            return_value={"joy": 0.8, "trust": 0.7}
        )
        self.brain.emotional_memory.get_relationship_context = AsyncMock(
            return_value={"trust": 0.6, "rapport": 0.5}
        )
        self.brain.emotional_memory.store_interaction = AsyncMock()
        self.brain.emotional_memory.update_relationship = AsyncMock()
        self.brain.emotional_memory.initialize = AsyncMock()
        
        # Mock ethical framework
        self.brain.ethical_framework = MagicMock()
        self.brain.ethical_framework.evaluate_decision.return_value = True
        self.brain.ethical_framework.validate_response.return_value = "Validated response"
        self.brain.ethical_framework.modify_response.return_value = "Modified response"
        
        # Initialize brain components
        await self.brain.initialize()

    def test_brain_initialization_with_emotional_processor(self):
        """Test that ALEJOBrain properly initializes EmotionalProcessor."""
        async def run_test():
            await self.async_setup()
            
            # Verify that brain is initialized
            self.assertTrue(self.brain.initialized)
            
            # Verify that emotional processor is initialized
            self.assertIsNotNone(self.brain.emotional_processor)
            
            # Check that event subscriptions are set up
            self.assertIn("llm.response", self.event_bus._subscribers)
            
        asyncio.run(run_test())

    def test_process_input_with_emotional_processor(self):
        """Test that process_input properly uses EmotionalProcessor."""
        async def run_test():
            await self.async_setup()
            
            # Process input
            response = await self.brain.process_input("Hello, how are you?")
            
            # Verify that emotional processor methods were called
            self.brain.emotional_processor.analyze_text.assert_called_with("Hello, how are you?")
            self.brain.emotional_processor.enhance_response.assert_called()
            
            # Verify that response was enhanced
            self.assertTrue(response.startswith("Enhanced:"))
            
        asyncio.run(run_test())

    def test_generate_text_with_emotional_processor(self):
        """Test that generate_text properly uses EmotionalProcessor."""
        async def run_test():
            await self.async_setup()
            
            # Generate text
            response = await self.brain.generate_text("Tell me a story")
            
            # Verify that emotional processor methods were called
            self.brain.emotional_processor.analyze_text.assert_any_call("Tell me a story")
            self.brain.emotional_processor.enhance_response.assert_called()
            
            # Verify that response includes emotional context
            self.assertIn("emotional_context", response.metadata)
            self.assertTrue(response.content.startswith("Enhanced:"))
            
        asyncio.run(run_test())

    def test_generate_chat_response_with_emotional_processor(self):
        """Test that generate_chat_response properly uses EmotionalProcessor."""
        async def run_test():
            await self.async_setup()
            
            # Generate chat response
            messages = [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there"},
                {"role": "user", "content": "How are you?"}
            ]
            response = await self.brain.generate_chat_response(messages)
            
            # Verify that emotional processor methods were called
            self.brain.emotional_processor.analyze_text.assert_any_call("How are you?")
            self.brain.emotional_processor.enhance_response.assert_called()
            
            # Verify that response includes emotional context
            self.assertIn("emotional_context", response.metadata)
            self.assertTrue(response.content.startswith("Enhanced:"))
            
        asyncio.run(run_test())

    def test_emotional_processor_personality_influence(self):
        """Test that EmotionalProcessor's personality traits influence responses."""
        async def run_test():
            await self.async_setup()
            
            # Set up personality traits
            self.real_processor.personality_traits = {
                "openness": 0.9,  # Very open to new experiences
                "conscientiousness": 0.8,
                "extraversion": 0.7,
                "agreeableness": 0.9,
                "neuroticism": 0.2
            }
            
            # Mock the enhance_response to use personality traits
            def enhanced_response_with_personality(text):
                traits = self.real_processor.personality_traits
                if traits["openness"] > 0.8:
                    return f"Creative and open response: {text}"
                elif traits["extraversion"] > 0.8:
                    return f"Enthusiastic response: {text}"
                else:
                    return f"Standard response: {text}"
                    
            self.brain.emotional_processor.enhance_response = MagicMock(
                side_effect=enhanced_response_with_personality
            )
            
            # Generate text
            response = await self.brain.generate_text("Tell me about space")
            
            # Verify that personality traits influenced the response
            self.assertTrue("Creative and open response" in response.content)
            
        asyncio.run(run_test())

    def test_emotional_processor_event_handling(self):
        """Test that EmotionalProcessor properly handles events."""
        async def run_test():
            await self.async_setup()
            
            # Emit an LLM response event
            await self.event_bus.emit("llm.response", {"response": "Hello world"})
            
            # Verify that emotional processor processed the text
            self.brain.emotional_processor.process_text.assert_called_with("Hello world")
            
        asyncio.run(run_test())

    def test_emotional_processor_adaptive_response(self):
        """Test that EmotionalProcessor adapts responses based on emotional context."""
        async def run_test():
            await self.async_setup()
            
            # First, establish a baseline emotional state
            self.brain.emotional_processor.analyze_text = MagicMock(return_value={
                "primary_emotion": "neutral",
                "valence": 0.5,
                "arousal": 0.5,
                "confidence": 0.9,
                "emotions": {"neutral": 0.8}
            })
            
            # Generate a baseline response
            baseline_response = await self.brain.generate_text("How's the weather?")
            
            # Now, simulate a more emotional state
            self.brain.emotional_processor.analyze_text = MagicMock(return_value={
                "primary_emotion": "joy",
                "valence": 0.9,
                "arousal": 0.8,
                "confidence": 0.9,
                "emotions": {"joy": 0.9, "trust": 0.7}
            })
            
            # Mock the enhance_response to adapt based on emotional state
            def adaptive_enhance(text):
                analysis = self.brain.emotional_processor.analyze_text("dummy")
                if analysis["valence"] > 0.8:
                    return f"Very positive response: {text}"
                elif analysis["valence"] < 0.3:
                    return f"Negative response: {text}"
                else:
                    return f"Neutral response: {text}"
                    
            self.brain.emotional_processor.enhance_response = MagicMock(
                side_effect=adaptive_enhance
            )
            
            # Generate a response with the new emotional state
            emotional_response = await self.brain.generate_text("How's the weather?")
            
            # Verify that the response was adapted based on emotional state
            self.assertTrue("Very positive response" in emotional_response.content)
            
        asyncio.run(run_test())

    def test_emotional_processor_integration_with_memory(self):
        """Test that EmotionalProcessor integrates with EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Process input
            await self.brain.process_input("I'm feeling happy today")
            
            # Verify that emotional analysis was stored in memory
            self.brain.emotional_memory.store_interaction.assert_called_once()
            
            # Check that the emotional data was passed correctly
            call_args = self.brain.emotional_memory.store_interaction.call_args[1]
            self.assertEqual(call_args["interaction_type"], "joy")
            self.assertEqual(call_args["emotional_data"]["primary_emotion"], "joy")
            
        asyncio.run(run_test())


if __name__ == "__main__":
    print("Running EmotionalProcessor integration tests...")
    unittest.main(verbosity=2)