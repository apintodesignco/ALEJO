"""
Integration tests for the ALEJOBrain with enhanced MultimodalProcessor fusion.

Tests the integration between ALEJOBrain and the enhanced MultimodalProcessor
with Darwin Gödel Machine self-evolution and LoRA hot-swap capabilities.
"""

import os
import sys
import unittest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
import tempfile
import base64
from pathlib import Path
import json
import io

# Add the parent directory to the path so we can import the alejo package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.events import EventBus
from alejo.utils.exceptions import MultimodalError
from alejo.multimodal.integration import MultimodalIntegration


class TestBrainMultimodalIntegration(unittest.TestCase):
    """Test the integration between ALEJOBrain and MultimodalProcessor."""

    def setUp(self):
        """Set up test environment."""
        self.event_bus = EventBus()
        self.config = {
            "multimodal": {
                "models": {
                    "vlm": {
                        "model_name": "llava-v1.6-mistral-7b-q4_k_m.gguf",
                        "context_size": 2048
                    },
                    "clip": {
                        "enabled": True
                    }
                },
                "self_evolution": {
                    "enabled": True,
                    "verification_timeout": 30.0
                },
                "lora": {
                    "enabled": True,
                    "adapters_dir": "test_adapters"
                },
                "enable_self_evolution": False,  # Disable for testing
                "enable_lora": False  # Disable for testing
            }
        }
        
        # Create a temporary directory for models
        self.temp_dir = tempfile.TemporaryDirectory()
        self.models_dir = self.temp_dir.name
        self.config["models_dir"] = self.models_dir
        
        # Create brain with mocked components
        with patch('alejo.brain.alejo_brain.LLMClientFactory'), \
             patch('alejo.brain.alejo_brain.EmotionalMemory'), \
             patch('alejo.brain.alejo_brain.EmotionalProcessor'), \
             patch('alejo.brain.alejo_brain.EthicalFramework'), \
             patch('alejo.brain.alejo_brain.AdaptiveEmotionalProcessor'), \
             patch('alejo.brain.alejo_brain.get_command_processor'):
            self.brain = ALEJOBrain(config=self.config, event_bus=self.event_bus)
        
    def tearDown(self):
        """Clean up after tests."""
        # Clean up the temporary directory
        self.temp_dir.cleanup()
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    async def test_multimodal_setup(self, mock_integration_class):
        """Test that the multimodal components are set up correctly."""
        # Mock the integration class
        mock_integration = AsyncMock()
        mock_integration_class.return_value = mock_integration
        
        # Call the setup method
        await self.brain._setup_multimodal()
        
        # Check that the integration was created with the correct parameters
        mock_integration_class.assert_called_once()
        self.assertEqual(self.brain.multimodal_integration, mock_integration)
        mock_integration.initialize.assert_called_once()
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    @patch('alejo.brain.alejo_brain.ALEJOBrain._get_emotional_context')
    @patch('alejo.brain.alejo_brain.ALEJOBrain._setup_multimodal')
    async def test_process_multimodal_input(self, mock_setup, mock_get_emotional, mock_integration_class):
        """Test processing multimodal input."""
        # Mock the integration class
        mock_integration = AsyncMock()
        mock_integration_class.return_value = mock_integration
        
        # Mock the emotional context
        mock_get_emotional.return_value = {"emotion": "neutral", "intensity": 0.5}
        
        # Mock the emotional processor
        self.brain.emotional_processor = AsyncMock()
        self.brain.emotional_processor.enhance_response = AsyncMock(return_value="Enhanced response")
        
        # Set up the integration
        self.brain.multimodal_integration = mock_integration
        
        # Mock the process_text_image method
        mock_integration.process_text_image = AsyncMock(return_value={
            "success": True,
            "result": {
                "answer": "This is a test image",
                "confidence": 0.9,
                "processing_time": 0.5
            }
        })
        
        # Process multimodal input
        result = await self.brain.process_multimodal_input("What is in this image?", "test_image_data")
        
        # Check the result
        self.assertTrue(result["success"])
        self.assertEqual(result["response"], "Enhanced response")
        self.assertEqual(result["raw_result"]["answer"], "This is a test image")
        self.assertEqual(result["processing_time"], 0.5)
        
        # Test with error
        mock_integration.process_text_image = AsyncMock(return_value={
            "success": False,
            "error": "Test error"
        })
        
        # Process multimodal input with error
        result = await self.brain.process_multimodal_input("What is in this image?", "test_image_data")
        
        # Check the result
        self.assertFalse(result["success"])
        self.assertIn("Test error", result["response"])
        self.assertEqual(result["error"], "Test error")
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    @patch('alejo.brain.alejo_brain.ALEJOBrain._setup_multimodal')
    async def test_optimize_component(self, mock_setup, mock_integration_class):
        """Test optimizing a component with Darwin Gödel Machine."""
        # Mock the integration class
        mock_integration = AsyncMock()
        mock_integration_class.return_value = mock_integration
        
        # Set up the integration
        self.brain.multimodal_integration = mock_integration
        
        # Mock the optimize_component method
        mock_integration.optimize_component = AsyncMock(return_value={
            "success": True,
            "component": "test_component",
            "original_code": "def test(): pass",
            "optimized_code": "def test(): return True",
            "expected_improvement": 0.25
        })
        
        # Optimize a component
        result = await self.brain.optimize_component("test_component", "def test(): pass")
        
        # Check the result
        self.assertTrue(result["success"])
        self.assertEqual(result["component"], "test_component")
        self.assertEqual(result["original_code"], "def test(): pass")
        self.assertEqual(result["optimized_code"], "def test(): return True")
        self.assertEqual(result["expected_improvement"], 0.25)
        
        # Test with error
        mock_integration.optimize_component = AsyncMock(return_value={
            "success": False,
            "error": "Test error"
        })
        
        # Optimize a component with error
        result = await self.brain.optimize_component("test_component", "def test(): pass")
        
        # Check the result
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Test error")
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    @patch('alejo.brain.alejo_brain.ALEJOBrain._setup_multimodal')
    async def test_hot_swap_model(self, mock_setup, mock_integration_class):
        """Test hot-swapping a model or LoRA adapter."""
        # Mock the integration class
        mock_integration = AsyncMock()
        mock_integration_class.return_value = mock_integration
        
        # Set up the integration
        self.brain.multimodal_integration = mock_integration
        
        # Mock the hot_swap_model method
        mock_integration.hot_swap_model = AsyncMock(return_value={
            "success": True,
            "model_id": "test_model",
            "task_type": "vqa",
            "message": "Model hot-swapped successfully"
        })
        
        # Hot-swap a model
        result = await self.brain.hot_swap_model("test_model", "vqa")
        
        # Check the result
        self.assertTrue(result["success"])
        self.assertEqual(result["model_id"], "test_model")
        self.assertEqual(result["task_type"], "vqa")
        self.assertEqual(result["message"], "Model hot-swapped successfully")
        
        # Test with error
        mock_integration.hot_swap_model = AsyncMock(return_value={
            "success": False,
            "error": "Test error"
        })
        
        # Hot-swap a model with error
        result = await self.brain.hot_swap_model("test_model", "vqa")
        
        # Check the result
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Test error")
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    async def test_process_multimodal_result(self, mock_integration_class):
        """Test processing multimodal result events."""
        # Mock the event bus
        self.brain.event_bus = AsyncMock()
        self.brain.event_bus.emit = AsyncMock()
        
        # Call the process_multimodal_result method
        await self.brain._process_multimodal_result({
            "query_id": "test_query",
            "success": True,
            "result": {"answer": "Test answer"}
        })
        
        # Check that the event was emitted
        self.brain.event_bus.emit.assert_called_once_with("brain.processing_result", {
            "type": "multimodal",
            "query_id": "test_query",
            "success": True,
            "result": {"answer": "Test answer"}
        })
        
    @patch('alejo.multimodal.integration.MultimodalIntegration')
    async def test_shutdown(self, mock_integration_class):
        """Test shutting down the brain with multimodal components."""
        # Mock the integration
        mock_integration = AsyncMock()
        self.brain.multimodal_integration = mock_integration
        
        # Call the shutdown method
        await self.brain.shutdown()
        
        # Check that the integration was shut down
        mock_integration.shutdown.assert_called_once()


if __name__ == '__main__':
    unittest.main()
