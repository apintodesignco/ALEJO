"""
Integration tests for ALEJO error handling with various components
"""

import os
import sys
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.utils.error_handling import ErrorTracker, handle_errors
from alejo.utils.exceptions import secrets  # More secure for cryptographic purposes
from alejo.utils.exceptions import (APIError, CommandError, FileOperationError,
                                    LLMServiceError, NetworkError,
                                    VoiceRecognitionError)

class TestCommandProcessorIntegration(unittest.TestCase):
    """Test error handling integration with CommandProcessor."""
    
    def setUp(self):
        self.error_tracker = ErrorTracker()
        self.command_processor = MagicMock()
        self.command_processor.error_tracker = self.error_tracker
    
    def test_01_file_operation_recovery(self):
        """Test recovery from file operation errors."""
        
        @handle_errors(component='command_processor', category='file_operation')
        def create_test_file(self, path):
            if not os.access(os.path.dirname(path), os.W_OK):
                raise FileOperationError(f"Cannot write to {path}")
            return True
        
        # Bind the method to this instance
        self.create_test_file = create_test_file.__get__(self, TestCommandProcessorIntegration)
        
        # Test with inaccessible path
        result = self.create_test_file('/root/test.txt')
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify error was tracked
        self.assertIn('command_processor.file_operation', 
                     self.error_tracker.error_counts)
    
    def test_02_command_timeout_recovery(self):
        """Test recovery from command timeout."""
        
        @handle_errors(component='command_processor', category='timeout')
        def long_running_command(self):
            raise TimeoutError("Command took too long")
        
        # Bind the method to this instance
        self.long_running_command = long_running_command.__get__(self, TestCommandProcessorIntegration)
        
        result = self.long_running_command()
        
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify error was tracked
        self.assertIn('command_processor.timeout', 
                     self.error_tracker.error_counts)
    
    def test_03_rate_limit_recovery(self):
        """Test recovery from API rate limits."""
        
        @handle_errors(component='command_processor', category='api_error')
        def api_command(self):
            raise APIError("Rate limit exceeded")
        
        # Bind the method to this instance
        self.api_command = api_command.__get__(self, TestCommandProcessorIntegration)
        
        result = self.api_command()
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify error was tracked
        self.assertIn('command_processor.api_error', 
                     self.error_tracker.error_counts)

class TestLLMServiceIntegration(unittest.TestCase):
    """Test error handling integration with LLM service."""
    
    def setUp(self):
        self.error_tracker = ErrorTracker()
        self.llm_service = MagicMock()
        self.llm_service.error_tracker = self.error_tracker
    
    def test_01_api_key_rotation(self):
        """Test API key rotation on rate limit errors."""
        
        @handle_errors(component='llm_service', category='api_error')
        def make_llm_call(self, prompt, context):
            if context['current_key'] == context['api_keys'][0]:
                raise APIError("Rate limit exceeded")
            return "Success"
        
        # Bind the method to this instance
        self.make_llm_call = make_llm_call.__get__(self, TestLLMServiceIntegration)
        
        context = {
            'current_key': 'key1',
            'api_keys': ['key1', 'key2'],
            'retry_count': 0
        }
        
        # First call should fail with rate limit
        result = self.make_llm_call("Test prompt", context)
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify error was tracked
        self.assertIn('llm_service.api_error', 
                     self.error_tracker.error_counts)
    
    def test_02_backoff_strategy(self):
        """Test exponential backoff on temporary failures."""
        
        @handle_errors(component='llm_service', category='connection')
        def unstable_llm_call(self):
            raise ConnectionError("Service temporarily unavailable")
        
        # Bind the method to this instance
        self.unstable_llm_call = unstable_llm_call.__get__(self, TestLLMServiceIntegration)
        
        start_time = datetime.now()
        result = self.unstable_llm_call()
        duration = (datetime.now() - start_time).total_seconds()
        
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        self.assertGreater(duration, 1)  # Should have waited due to backoff
        
        # Verify error was tracked
        self.assertIn('llm_service.connection', 
                     self.error_tracker.error_counts)

class TestVoiceRecognitionIntegration(unittest.TestCase):
    """Test error handling integration with voice recognition."""
    
    def setUp(self):
        self.error_tracker = ErrorTracker()
        self.voice_service = MagicMock()
        self.voice_service.error_tracker = self.error_tracker
    
    def test_01_service_reset(self):
        """Test service reset on recognition errors."""
        
        @handle_errors(component='voice_recognition', category='recognition')
        def recognize_speech(self, audio_data, context):
            if not context.get('service_reset'):
                raise VoiceRecognitionError("Recognition failed")
            return "Hello ALEJO"
        
        # Bind the method to this instance
        self.recognize_speech = recognize_speech.__get__(self, TestVoiceRecognitionIntegration)
        
        context = {'service_reset': False}
        result = self.recognize_speech(b"audio_data", context)
        
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify error was tracked
        self.assertIn('voice_recognition.recognition', 
                     self.error_tracker.error_counts)

if __name__ == '__main__':
    unittest.main()