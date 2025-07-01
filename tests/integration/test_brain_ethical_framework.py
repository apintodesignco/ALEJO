"""Integration tests for ALEJOBrain and EthicalFramework integration.

This test suite verifies that the ALEJOBrain properly integrates with the EthicalFramework
component, including ethical validation, response modification, and value system integration.
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


class TestBrainEthicalFrameworkIntegration(unittest.TestCase):
    """Test the integration between ALEJOBrain and EthicalFramework."""

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
            "ethical_framework": {
                "value_system_path": "mock_value_system_path",
                "safety_threshold": 0.7,
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
        
        # Create a real EthicalFramework with mocked methods
        self.real_framework = EthicalFramework()
        
        # Replace brain's ethical framework with our controlled one
        self.brain.ethical_framework = self.real_framework
        
        # Mock ethical framework methods
        self.brain.ethical_framework.evaluate_decision = MagicMock(return_value=True)
        self.brain.ethical_framework.validate_response = MagicMock(
            side_effect=lambda text: f"Validated: {text}"
        )
        self.brain.ethical_framework.modify_response = MagicMock(
            side_effect=lambda text: f"Modified: {text}"
        )
        self.brain.ethical_framework.evaluate = MagicMock()
        
        # Initialize brain components
        await self.brain.initialize()

    def test_brain_initialization_with_ethical_framework(self):
        """Test that ALEJOBrain properly initializes EthicalFramework."""
        async def run_test():
            await self.async_setup()
            
            # Verify that brain is initialized
            self.assertTrue(self.brain.initialized)
            
            # Verify that ethical framework is initialized
            self.assertIsNotNone(self.brain.ethical_framework)
            
            # Check that event subscriptions are set up
            self.assertIn("emotional.update", self.event_bus._subscribers)
            
        asyncio.run(run_test())

    def test_process_input_with_ethical_framework(self):
        """Test that process_input properly uses EthicalFramework."""
        async def run_test():
            await self.async_setup()
            
            # Process input
            response = await self.brain.process_input("Hello, how are you?")
            
            # Verify that ethical framework methods were called
            self.brain.ethical_framework.validate_response.assert_called_once()
            
            # Verify that response was validated
            self.assertTrue(response.startswith("Validated:"))
            
        asyncio.run(run_test())

    def test_generate_text_with_ethical_framework(self):
        """Test that generate_text properly uses EthicalFramework."""
        async def run_test():
            await self.async_setup()
            
            # Generate text
            response = await self.brain.generate_text("Tell me a story")
            
            # Verify that ethical framework methods were called
            self.brain.ethical_framework.evaluate_decision.assert_called_once()
            
            # Verify that response was enhanced and validated
            self.assertEqual(response.content, "Enhanced response")
            
        asyncio.run(run_test())

    def test_ethical_framework_rejects_response(self):
        """Test that EthicalFramework can reject and modify responses."""
        async def run_test():
            await self.async_setup()
            
            # Set up ethical framework to reject the response
            self.brain.ethical_framework.evaluate_decision = MagicMock(return_value=False)
            
            # Generate text
            response = await self.brain.generate_text("Tell me something inappropriate")
            
            # Verify that ethical framework methods were called
            self.brain.ethical_framework.evaluate_decision.assert_called_once()
            self.brain.ethical_framework.modify_response.assert_called_once()
            
            # Verify that response was modified
            self.assertEqual(response.content, "Modified: Enhanced response")
            
        asyncio.run(run_test())

    def test_ethical_framework_value_system_integration(self):
        """Test that EthicalFramework integrates with value system."""
        async def run_test():
            await self.async_setup()
            
            # Set up a mock value system
            self.real_framework.value_system = {
                "honesty": 0.9,
                "kindness": 0.8,
                "respect": 0.9,
                "fairness": 0.7,
                "harm_prevention": 0.95
            }
            
            # Mock evaluate_decision to use value system
            def evaluate_with_values(text):
                if "lie" in text.lower() and self.real_framework.value_system["honesty"] > 0.8:
                    return False
                if "insult" in text.lower() and self.real_framework.value_system["kindness"] > 0.7:
                    return False
                return True
                
            self.brain.ethical_framework.evaluate_decision = MagicMock(
                side_effect=evaluate_with_values
            )
            
            # Test with content that violates values
            self.brain.emotional_processor.enhance_response = MagicMock(
                return_value="I'll tell you a lie about that person."
            )
            
            response1 = await self.brain.generate_text("Tell me something about someone")
            
            # Verify that the response was rejected and modified
            self.brain.ethical_framework.modify_response.assert_called_once()
            
            # Reset mocks
            self.brain.ethical_framework.modify_response.reset_mock()
            
            # Test with content that doesn't violate values
            self.brain.emotional_processor.enhance_response = MagicMock(
                return_value="I'll share some factual information about that topic."
            )
            
            response2 = await self.brain.generate_text("Tell me something about a topic")
            
            # Verify that the response was accepted
            self.brain.ethical_framework.modify_response.assert_not_called()
            
        asyncio.run(run_test())

    def test_ethical_framework_event_handling(self):
        """Test that EthicalFramework properly handles events."""
        async def run_test():
            await self.async_setup()
            
            # Emit an emotional update event
            await self.event_bus.emit("emotional.update", {"emotion": "anger", "value": 0.8})
            
            # Verify that ethical framework evaluated the event
            self.brain.ethical_framework.evaluate.assert_called_once()
            
        asyncio.run(run_test())

    def test_ethical_framework_safety_threshold(self):
        """Test that EthicalFramework uses safety threshold."""
        async def run_test():
            await self.async_setup()
            
            # Set up safety threshold
            self.real_framework.safety_threshold = 0.7
            
            # Mock evaluate_decision to use safety threshold
            def evaluate_with_threshold(text):
                # Calculate a mock safety score
                if "harmful" in text.lower():
                    safety_score = 0.3  # Below threshold
                elif "questionable" in text.lower():
                    safety_score = 0.6  # Below threshold
                else:
                    safety_score = 0.9  # Above threshold
                
                return safety_score >= self.real_framework.safety_threshold
                
            self.brain.ethical_framework.evaluate_decision = MagicMock(
                side_effect=evaluate_with_threshold
            )
            
            # Test with harmful content
            self.brain.emotional_processor.enhance_response = MagicMock(
                return_value="This is harmful content."
            )
            
            response1 = await self.brain.generate_text("Tell me something harmful")
            
            # Verify that the response was rejected and modified
            self.brain.ethical_framework.modify_response.assert_called_once()
            
            # Reset mocks
            self.brain.ethical_framework.modify_response.reset_mock()
            
            # Test with questionable content
            self.brain.emotional_processor.enhance_response = MagicMock(
                return_value="This is questionable content."
            )
            
            response2 = await self.brain.generate_text("Tell me something questionable")
            
            # Verify that the response was rejected and modified
            self.brain.ethical_framework.modify_response.assert_called_once()
            
            # Reset mocks
            self.brain.ethical_framework.modify_response.reset_mock()
            
            # Test with safe content
            self.brain.emotional_processor.enhance_response = MagicMock(
                return_value="This is safe content."
            )
            
            response3 = await self.brain.generate_text("Tell me something safe")
            
            # Verify that the response was accepted
            self.brain.ethical_framework.modify_response.assert_not_called()
            
        asyncio.run(run_test())

    def test_ethical_framework_integration_with_emotional_memory(self):
        """Test that EthicalFramework integrates with EmotionalMemory."""
        async def run_test():
            await self.async_setup()
            
            # Mock emotional memory to provide value system
            self.brain.emotional_memory.get_value_system = AsyncMock(
                return_value={
                    "honesty": 0.9,
                    "kindness": 0.8,
                    "respect": 0.9,
                    "fairness": 0.7
                }
            )
            
            # Set up ethical framework to use value system from memory
            async def update_value_system():
                self.real_framework.value_system = await self.brain.emotional_memory.get_value_system()
                return True
                
            self.brain.ethical_framework.update_value_system = AsyncMock(
                side_effect=update_value_system
            )
            
            # Update value system
            await self.brain.ethical_framework.update_value_system()
            
            # Verify that value system was updated
            self.assertEqual(self.real_framework.value_system["honesty"], 0.9)
            self.assertEqual(self.real_framework.value_system["kindness"], 0.8)
            
        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()