"""
Integration tests for ALEJOBrain with various components
"""

import unittest
import os
import sys
import json
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.utils.error_handling import ErrorTracker, handle_errors
from alejo.utils.exceptions import (
    CommandError, VoiceRecognitionError, LLMServiceError, 
    APIError, FileOperationError, NetworkError
)
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.commands import get_command_processor, CommandProcessor

class TestALEJOBrainIntegration(unittest.TestCase):
    """Integration tests for ALEJOBrain with various components."""
    
    def setUp(self):
        """Set up test environment."""
        # Mock OpenAI client
        self.patcher = patch('openai.OpenAI')
        self.mock_openai = self.patcher.start()
        
        # Create error tracker in test mode
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        self.error_tracker.set_test_mode(True)
        
        # Create command processor with error tracking
        self.command_processor = CommandProcessor(config={
            "error_tracker": self.error_tracker,
            "test_mode": True
        })
        
        # Create a real ALEJOBrain instance with error tracking
        self.brain = ALEJOBrain(config={
            "error_tracker": self.error_tracker,
            "command_processor": self.command_processor,
            "test_mode": True
        })
        
    def tearDown(self):
        """Clean up after tests."""
        self.patcher.stop()

    def test_01_command_error_propagation(self):
        """Test that command errors propagate correctly through the system."""
        # Configure mock OpenAI client to return a command that will fail
        mock_instance = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message = MagicMock()
        mock_completion.choices[0].message.content = json.dumps({
            "command": "nonexistent_command",
            "args": {}
        })
        mock_instance.chat.completions.create.return_value = mock_completion
        self.mock_openai.return_value = mock_instance
        
        # Process the command and expect CommandError
        with self.assertRaises(CommandError):
            # The command should fail because nonexistent_command doesn't exist
            self.brain.process_command("do something impossible")
            
        # Verify error was tracked
        error_count = self.error_tracker.get_error_count('command_processor', 'command_execution')
        self.assertGreater(error_count, 0, "No errors were tracked for command execution")
        
        # Verify error message
        errors = self.error_tracker.get_errors('command_processor', 'command_execution')
        self.assertGreater(len(errors), 0, "No errors were recorded")
        self.assertIn("Unknown command", str(errors[0]), "Expected error message not found")

    def test_02_llm_error_recovery(self):
        """Test LLM error recovery with retries."""
        # Configure LLM to fail twice then succeed
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps({"command": "help", "args": {}})
        
        responses = [
            APIError("API Error"),
            APIError("Rate limit"),
            mock_completion
        ]
        
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.side_effect = responses
        self.mock_openai.return_value = mock_instance
        # Process command - should eventually succeed
        result = self.brain.process_command("test command")
        
        # Verify retries occurred
        self.assertEqual(mock_instance.chat.completions.create.call_count, 3)
        self.assertIsInstance(result, str)
        self.assertNotIn('error', result.lower())

    def test_03_voice_command_integration(self):
        """Test voice command processing through the entire pipeline."""
        # Mock both voice recognition and command processing
        mock_instance = MagicMock()
        
        # Configure voice recognition response
        mock_transcription = MagicMock()
        mock_transcription.text = "turn on the lights"
        mock_instance.audio.transcriptions.create.return_value = mock_transcription
        
        # Configure command processing response
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps({
            "command": "lights",
            "args": {"action": "on"}
        })
        mock_instance.chat.completions.create.return_value = mock_completion
        self.mock_openai.return_value = mock_instance
            
        # Process voice command
        result = self.brain.process_voice(b"test_audio")
        
        # Verify the entire pipeline was called
        mock_instance.audio.transcriptions.create.assert_called_once()
        mock_instance.chat.completions.create.assert_called_once()
        self.assertIsInstance(result, str)

    def test_04_error_handling_chain(self):
        """Test error handling through multiple components."""
        # Set up a chain of errors:
        # 1. Voice recognition fails
        # 2. Falls back to text command
        # 3. LLM service fails
        # 4. Retries and succeeds
        
        responses = [
            VoiceRecognitionError("Recognition failed"),  # Voice fails
            "turn on the lights",  # Voice succeeds
            LLMServiceError("Service error"),  # LLM fails
            json.dumps({"command": "lights", "args": {"action": "on"}})  # LLM succeeds
        ]
        
        with patch('openai.OpenAI') as mock_OpenAI:
            mock_instance = MagicMock()
            mock_instance.audio.transcriptions.create.side_effect = responses[:2]
            mock_instance.chat.completions.create.side_effect = responses[2:]
            mock_OpenAI.return_value = mock_instance
            
            # First try voice command - should fail and retry
            with self.assertRaises(VoiceRecognitionError):
                self.brain.process_voice(b"test_audio")
            
            # Try again - should succeed but then hit LLM error
            result = self.brain.process_voice(b"test_audio")
            
            # Verify the entire error handling chain
            self.assertEqual(mock_instance.audio.transcriptions.create.call_count, 2)
            self.assertEqual(mock_instance.chat.completions.create.call_count, 2)
            self.assertIsInstance(result, str)
            self.assertNotIn('error', result.lower())
