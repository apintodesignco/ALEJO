"""
Tests for ALEJO Vision Module
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import io
import base64
from PIL import Image
import numpy as np
import json

from alejo.vision.processor import VisionProcessor
from alejo.utils.exceptions import VisionError
from alejo.brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker

class TestVisionProcessor(unittest.TestCase):
    """Test cases for VisionProcessor"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = {
            "max_image_size": 512
        }
        # Mock OpenAI client
        self.mock_openai = patch("openai.OpenAI").start()
        self.mock_client = Mock()
        self.mock_openai.return_value = self.mock_client
        
        # Create test image
        self.test_image = Image.new('RGB', (100, 100), color='red')
        self.image_bytes = io.BytesIO()
        self.test_image.save(self.image_bytes, format='JPEG')
        self.image_bytes = self.image_bytes.getvalue()
        
        # Initialize processor
        self.processor = VisionProcessor(self.config)
        
    def tearDown(self):
        """Clean up after tests"""
        patch.stopall()
        
    def test_initialization(self):
        """Test VisionProcessor initialization"""
        self.assertTrue(self.processor.initialized)
        self.assertEqual(self.processor.config, self.config)
        
    def test_analyze_image_general(self):
        """Test general image analysis"""
        # Mock OpenAI vision response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "A red square image"
        mock_response.created = 1234567890
        self.mock_client.chat.completions.create.return_value = mock_response
        
        # Test analysis
        result = self.processor.analyze_image(self.image_bytes)
        
        # Verify result
        self.assertEqual(result["raw_response"], "A red square image")
        self.assertEqual(result["analysis_type"], "general")
        self.assertEqual(result["timestamp"], 1234567890)
        
    def test_detect_objects(self):
        """Test object detection"""
        # Mock OpenAI vision response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "red square: center of image"
        mock_response.created = 1234567890
        self.mock_client.chat.completions.create.return_value = mock_response
        
        # Test detection
        objects = self.processor.detect_objects(self.image_bytes)
        
        # Verify result
        self.assertEqual(len(objects), 1)
        self.assertEqual(objects[0]["name"], "red square")
        self.assertEqual(objects[0]["description"], "center of image")
        
    def test_extract_text(self):
        """Test text extraction"""
        # Mock OpenAI vision response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hello World"
        mock_response.created = 1234567890
        self.mock_client.chat.completions.create.return_value = mock_response
        
        # Test extraction
        text = self.processor.extract_text(self.image_bytes)
        
        # Verify result
        self.assertEqual(text, "Hello World")
        
    def test_analyze_scene(self):
        """Test scene analysis"""
        # Mock OpenAI vision response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "A simple red background"
        mock_response.created = 1234567890
        self.mock_client.chat.completions.create.return_value = mock_response
        
        # Test analysis
        result = self.processor.understand_scene(self.image_bytes)
        
        # Verify result
        self.assertEqual(result["description"], "A simple red background")
        self.assertEqual(result["summary"], "A simple red background")
        
    def test_preprocess_image(self):
        """Test image preprocessing"""
        # Create large test image
        large_image = Image.new('RGB', (2000, 2000), color='blue')
        
        # Preprocess image
        processed = self.processor._preprocess_image(large_image)
        
        # Verify size reduction
        self.assertLessEqual(max(processed.size), self.config["max_image_size"])
        
    @patch('time.sleep')
    def test_error_handling(self, mock_sleep):
        """Test error handling and recovery"""
        # Configure mock OpenAI client to raise an error
        self.mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        # Add recovery methods to mock client
        self.mock_client.rotate_api_key = MagicMock()
        self.mock_client.clear_context = MagicMock()
        
        # Configure error tracker
        self.processor.error_tracker = ErrorTracker()
        
        try:
            self.processor.analyze_image(self.image_bytes)
            self.fail("Expected VisionError to be raised")
        except VisionError as e:
            self.assertIn("Vision analysis failed", str(e))
            
            # Verify error was tracked
            error_key = 'llm_service:vision'
            self.assertIn(error_key, self.processor.error_tracker.error_counts)
            self.assertGreater(self.processor.error_tracker.error_counts[error_key], 0)
            
            # Verify service recovery actions
            self.mock_client.rotate_api_key.assert_called_once()
            self.mock_client.clear_context.assert_called_once()
            
            # Reset error counts
            self.processor.error_tracker.error_counts = {}
            
class TestALEJOBrainVision(unittest.TestCase):
    """Test cases for ALEJOBrain vision integration"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = {
            "max_image_size": 512
        }
        # Mock OpenAI client
        self.mock_openai = patch("openai.OpenAI").start()
        self.mock_client = Mock()
        self.mock_openai.return_value = self.mock_client
        
        # Create test image
        self.test_image = Image.new('RGB', (100, 100), color='red')
        self.image_bytes = io.BytesIO()
        self.test_image.save(self.image_bytes, format='JPEG')
        self.image_bytes = self.image_bytes.getvalue()
        
        # Initialize brain
        self.brain = ALEJOBrain(self.config)
        
    def tearDown(self):
        """Clean up after tests"""
        patch.stopall()
        
    def test_process_image(self):
        """Test image processing through brain"""
        # Mock vision response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "A red square image"
        mock_response.created = 1234567890
        self.mock_client.chat.completions.create.return_value = mock_response
        
        # Test processing
        result = self.brain.process_image(self.image_bytes)
        
        # Verify result
        self.assertIn("raw_response", result)
        self.assertEqual(result["raw_response"], "A red square image")
        
    def test_process_text_in_image(self):
        """Test processing text found in image"""
        # Mock vision response for text
        mock_vision_response = Mock()
        mock_vision_response.choices = [Mock()]
        mock_vision_response.choices[0].message.content = "show time"
        mock_vision_response.created = 1234567890
        
        # Mock LLM response for command
        mock_llm_response = Mock()
        mock_llm_response.choices = [Mock()]
        mock_llm_response.choices[0].message.content = "The current time is 10:00 AM"
        
        # Set up response sequence
        self.mock_client.chat.completions.create.side_effect = [
            mock_vision_response,  # For text extraction
            mock_llm_response     # For command processing
        ]
        
        # Test processing
        result = self.brain.extract_text(self.image_bytes)
        
        # Verify result
        self.assertEqual(result["text"], "show time")
        self.assertIn("command_result", result)
        
    def test_error_propagation(self):
        """Test error propagation through brain"""
        # Mock vision error
        self.mock_client.chat.completions.create.side_effect = Exception("Vision API Error")
        
        # Test error handling
        with self.assertRaises(VisionError):
            self.brain.process_image(self.image_bytes)
            
    def test_invalid_image_data(self):
        """Test handling of invalid image data"""
        # Test with various invalid inputs
        test_cases = [
            (b"invalid image data", "Failed to process image"),
            (None, "No image data provided"),
            (b"", "No image data provided")
        ]
        
        for invalid_data, expected_error in test_cases:
            with self.assertRaises(VisionError) as cm:
                self.brain.process_image(invalid_data)
                
            # Verify error message
            self.assertIn(expected_error, str(cm.exception))
            
            # Verify error was tracked
            error_key = 'vision_processor:validation'
            self.assertIn(error_key, self.brain.error_tracker.error_counts)
            self.assertGreater(self.brain.error_tracker.error_counts[error_key], 0)
            
            # Reset error count for next test
            self.brain.error_tracker.error_counts = {}
            
    def test_vision_not_initialized(self):
        """Test behavior when vision is not initialized"""
        # Create brain without vision
        brain = ALEJOBrain({"disable_vision": True})
        brain.vision_processor = None
        
        # Test vision methods and verify error tracking
        test_methods = [
            ('process_image', lambda: brain.process_image(self.image_bytes)),
            ('detect_objects', lambda: brain.detect_objects(self.image_bytes)),
            ('extract_text', lambda: brain.extract_text(self.image_bytes)),
            ('analyze_scene', lambda: brain.analyze_scene(self.image_bytes))
        ]
        
        for method_name, method in test_methods:
            with self.assertRaises(VisionError) as cm:
                method()
                
            # Verify error message
            self.assertIn('Vision processor not initialized', str(cm.exception))
            
            # Verify error was tracked
            error_key = 'vision_processor:initialization'
            self.assertIn(error_key, brain.error_tracker.error_counts)
            self.assertGreater(brain.error_tracker.error_counts[error_key], 0)
            
            # Reset error count for next test
            brain.error_tracker.error_counts = {}
            
if __name__ == '__main__':
    unittest.main()
