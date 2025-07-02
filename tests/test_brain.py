import json
import os
import secrets  # More secure for cryptographic purposes
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

from alejo.utils.exceptions import CommandError, LLMServiceError, VoiceRecognitionError
from alejo.utils.metrics import ErrorMetrics
from alejo.utils.monitoring import ErrorMonitor

# Add project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TestALEJOBrain(unittest.TestCase):
    """Unit tests for the ALEJOBrain"""

    def setUp(self):
        # Clear any cached imports
        modules_to_clear = [
            "alejo.brain",
            "alejo.commands",
            "alejo.brain.alejo_brain",
            "alejo.utils",
            "alejo.utils.error_handling",
            "alejo.utils.metrics",
            "alejo.utils.monitoring",
            "alejo.utils.exceptions",
        ]
        for module in modules_to_clear:
            if module in sys.modules:
                del sys.modules[module]

    def test_brain_initialization_with_context_managers(self):
        """Test brain initialization using 'with patch' to avoid decorator issues."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_llm_instance = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                # Finally patch OpenAI
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class *while mocks are active*
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Perform assertions
                    self.assertTrue(brain.initialized)
                    mock_get_cmd_proc.assert_called_once()
                    self.assertEqual(brain.command_processor, mock_cmd_processor)
                    self.assertEqual(brain.llm_client, mock_llm_instance)

    def test_process_command_executes_successfully(self):
        """Test that a command from a mocked LLM is executed correctly."""
        with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
            mock_commands = MagicMock()
        mock_commands.get_command_processor = MagicMock(return_value=MagicMock())
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch("openai.OpenAI") as mock_OpenAI_class:
                # Configure mocks
                mock_cmd_processor = MagicMock()
                mock_get_cmd_processor.return_value = mock_cmd_processor

                mock_llm_instance = MagicMock()
                mock_OpenAI_class.return_value = mock_llm_instance

                # Import and initialize
                from alejo.brain import ALEJOBrain

                brain = ALEJOBrain()

                # Configure mock LLM response
                mock_llm_instance.chat.completions.create.return_value.choices[
                    0
                ].message.content = '{"command": "test", "args": "test args"}'

                # Configure mock command processor response
                mock_cmd_processor.execute_command.return_value = (
                    "Command executed successfully"
                )

                # Test successful command execution
                result = brain.process_command("test command")
                self.assertIsInstance(result, str)
                self.assertEqual(result, "Command executed successfully")

                # Verify the command processor was called correctly
                mock_cmd_processor.execute_command.assert_called_once_with(
                    "test", "test args"
                )

    def test_error_handling_llm_failure(self):
        """Test error handling when LLM service fails."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)
        mock_llm_instance = MagicMock()

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # Configure LLM to raise an error
        mock_llm_instance.chat.completions.create.side_effect = LLMServiceError(
            "LLM service failed"
        )

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process a command and expect a user-friendly error message
                    result = brain.process_command("test command")
                    self.assertEqual(
                        result,
                        "I seem to be having trouble connecting to my reasoning core at the moment.",
                    )

    def test_error_handling_command_failure(self):
        """Test error handling when command execution fails."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)
        mock_llm_instance = MagicMock()

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # Configure LLM response
        mock_llm_instance.chat.completions.create.return_value.choices[
            0
        ].message.content = json.dumps(
            {"command": "test_command", "args": {"arg1": "value1"}}
        )

        # Configure command processor to raise an error
        mock_cmd_processor.execute_command.side_effect = CommandError("Command failed")

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process a command and expect it to raise CommandError
                    with self.assertRaises(CommandError) as cm:
                        brain.process_command("do something")

                    # Verify the error message
                    self.assertEqual(str(cm.exception), "Command failed")

                    # Verify command processor was called correctly
                    mock_cmd_processor.execute_command.assert_called_once_with(
                        "test_command", {"arg1": "value1"}
                    )

    def test_error_handling_voice_failure(self):
        """Test error handling when voice processing fails."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)
        mock_llm_instance = MagicMock()

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # Configure LLM to raise an error during transcription
        mock_llm_instance.audio.transcriptions.create.side_effect = Exception(
            "Transcription failed"
        )

        # Mock the logger to avoid actual logging in tests
        with patch("logging.getLogger"):
            # First patch the environment variables and sys.modules
            with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
                with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                    with patch(
                        "alejo.llm_client.local_client.LocalLLMClient",
                        return_value=mock_llm_instance,
                    ):
                        # Import and initialize the class
                        from alejo.brain import ALEJOBrain

                        brain = ALEJOBrain()

                        # Process voice command and expect it to raise VoiceRecognitionError
                        with self.assertRaises(VoiceRecognitionError) as cm:
                            brain.process_voice(b"test_audio")

                        # Verify the error message
                        self.assertIn(
                            "Voice recognition failed: Transcription failed",
                            str(cm.exception),
                        )

                        # Verify the transcription was attempted with correct parameters
                        mock_llm_instance.audio.transcriptions.create.assert_called_once_with(
                            model="whisper-1",
                            file=("audio.wav", b"test_audio"),
                            response_format="text",
                        )

    def test_successful_voice_processing(self):
        """Test that voice processing works correctly."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)
        mock_llm_instance = MagicMock()

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # Configure LLM responses
        # First for transcription
        mock_llm_instance.audio.transcriptions.create.return_value = (
            "turn on the lights"
        )
        # Then for command processing
        mock_llm_instance.chat.completions.create.return_value.choices[
            0
        ].message.content = json.dumps({"command": "lights", "args": {"action": "on"}})

        # Configure command processor response
        mock_cmd_processor.execute_command.return_value = "Lights turned on"

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process voice command
                    result = brain.process_voice(b"test_audio")

                    # Verify the transcription was called correctly
                    mock_llm_instance.audio.transcriptions.create.assert_called_once()
                    self.assertEqual(result, "Lights turned on")

                    # Verify command processor was called correctly
                    mock_cmd_processor.execute_command.assert_called_once_with(
                        "lights", {"action": "on"}
                    )

    def test_health_status_reporting(self):
        """Test that health status reporting works correctly."""
        with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
            mock_commands = MagicMock()
        mock_commands.get_command_processor = MagicMock(return_value=MagicMock())
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch("openai.OpenAI") as mock_OpenAI_class:
                with patch("alejo.utils.metrics.get_metrics") as mock_get_metrics:
                    with patch(
                        "alejo.utils.monitoring.get_monitor"
                    ) as mock_get_monitor:
                        # Configure mocks
                        mock_metrics = MagicMock()
                        mock_metrics.get_performance_report.return_value = {
                            "overall_stats": {"total_recoveries": 10}
                        }
                        mock_get_metrics.return_value = mock_metrics

                        mock_monitor = MagicMock()
                        mock_monitor.get_error_stats.return_value = {
                            "counts": {"brain.llm": 2}
                        }
                        mock_monitor.is_component_healthy.return_value = True
                        mock_get_monitor.return_value = mock_monitor

                        # Import and initialize
                        from alejo.brain import ALEJOBrain

                        brain = ALEJOBrain()

                        # Test health status
                        health_status = brain.get_health_status()

                        # Verify health status
                        self.assertTrue(health_status["healthy"])
                        self.assertEqual(health_status["error_counts"]["brain.llm"], 2)
                        self.assertEqual(
                            health_status["recovery_stats"]["total_recoveries"], 10
                        )

                        # Verify monitor and metrics were queried

        # Configure LLM response
        mock_llm_instance.chat.completions.create.return_value.choices[
            0
        ].message.content = json.dumps(
            {"command": "test_command", "args": {"arg1": "value1"}}
        )

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process a command
                    result = brain.process_command("do something")

                    # Verify command was executed
                    mock_cmd_processor.execute_command.assert_called_once_with(
                        "test_command", {"arg1": "value1"}
                    )

    def test_process_command_handles_natural_language_response(self):
        """Test that a natural language response from the LLM is handled correctly."""
        # Create mocks
        mock_cmd_processor = MagicMock()
        mock_get_cmd_proc = MagicMock(return_value=mock_cmd_processor)
        mock_llm_instance = MagicMock()

        # Create a mock commands module
        mock_commands = types.ModuleType("alejo.commands")
        mock_commands.get_command_processor = mock_get_cmd_proc

        # Configure LLM response
        mock_llm_instance.chat.completions.create.return_value.choices[
            0
        ].message.content = "This is a natural language response"

        # First patch the environment variables and sys.modules
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
                with patch(
                    "alejo.llm_client.local_client.LocalLLMClient",
                    return_value=mock_llm_instance,
                ):
                    # Import and initialize the class
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process a command
                    result = brain.process_command("tell me about yourself")

                    # Verify response was handled correctly
                    self.assertEqual(result, "This is a natural language response")
                    mock_response = MagicMock()
                    mock_response.choices[0].message.content = "{malformed json"
                    mock_llm_instance.chat.completions.create.return_value = (
                        mock_response
                    )

                    # Initialize brain
                    from alejo.brain import ALEJOBrain

                    brain = ALEJOBrain()

                    # Process a command
                    final_response = brain.process_command("do something")

                # 4. Assertions
                # The command processor should NOT have been called
                mock_cmd_processor.execute_command.assert_not_called()
                # The final response should be an error message
                self.assertIn("error", final_response.lower())


def test_process_command_relays_execution_failure_message(self):
    """Test that a failure message from the command processor is relayed correctly."""
    with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
        mock_commands = MagicMock()
        mock_commands.get_command_processor = MagicMock(return_value=MagicMock())
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch("openai.OpenAI") as mock_OpenAI_class:
                # 1. Configure mocks
                mock_cmd_processor = MagicMock()
                mock_get_cmd_processor.return_value = mock_cmd_processor

                mock_llm_instance = MagicMock()
                mock_OpenAI_class.return_value = mock_llm_instance

                # Mock the LLM's response to be a valid command
                valid_command_json = (
                    '{"command": "delete_file", "args": "protected.txt"}'
                )
                mock_response = MagicMock()
                mock_response.choices[0].message.content = valid_command_json
                mock_llm_instance.chat.completions.create.return_value = mock_response

                # Mock the command processor to return a failure message
                failure_message = "Failed to delete file: Permission denied"
                mock_cmd_processor.execute_command.return_value = failure_message

                # 2. Initialize brain
                from alejo.brain import ALEJOBrain

                brain = ALEJOBrain()

                # 3. Process a command
                final_response = brain.process_command("delete the protected file")

                # 4. Assertions
                # The command processor should have been called
                mock_cmd_processor.execute_command.assert_called_once_with(
                    "delete_file", "protected.txt"
                )
                # The final response should be the failure message from the processor
                self.assertEqual(final_response, failure_message)

    def test_process_command_handles_llm_query_failure(self):
        """Test that an exception during the LLM query is handled gracefully."""
        with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
            mock_commands = MagicMock()
        mock_commands.get_command_processor = MagicMock(return_value=MagicMock())
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch("openai.OpenAI") as mock_OpenAI_class:
                # 1. Configure mocks
                mock_cmd_processor = MagicMock()
                mock_get_cmd_processor.return_value = mock_cmd_processor

                mock_llm_instance = MagicMock()
                mock_OpenAI_class.return_value = mock_llm_instance

                # Mock the LLM client to raise an exception
                error_message = "API connection failed"
                mock_llm_instance.chat.completions.create.side_effect = Exception(
                    error_message
                )

                # 2. Initialize brain
                from alejo.brain import ALEJOBrain

                brain = ALEJOBrain()

                # 3. Process a command
                final_response = brain.process_command("any command")

                # 4. Assertions
                # The command processor should NOT have been called
                mock_cmd_processor.execute_command.assert_not_called()
                # The final response should be the specific error message for LLM failure
                self.assertEqual(
                    final_response,
                    "I seem to be having trouble connecting to my reasoning core at the moment.",
                )

    def test_process_command_relays_decorator_error_message(self):
        """Test that a user-friendly error from the decorator is relayed correctly."""
        with patch.dict(os.environ, {"ALEJO_LOCAL_INFERENCE": "1"}):
            mock_commands = MagicMock()
        mock_commands.get_command_processor = MagicMock(return_value=MagicMock())
        with patch.dict("sys.modules", {"alejo.commands": mock_commands}):
            with patch("openai.OpenAI") as mock_OpenAI_class:
                # 1. Configure mocks
                mock_cmd_processor = MagicMock()
                mock_get_cmd_processor.return_value = mock_cmd_processor

                mock_llm_instance = MagicMock()
                mock_OpenAI_class.return_value = mock_llm_instance

                # Mock the LLM's response to be a valid command
                valid_command_json = (
                    '{"command": "create_file", "args": "/unauthorized/path/file.txt"}'
                )
                mock_response = MagicMock()
                mock_response.choices[0].message.content = valid_command_json
                mock_llm_instance.chat.completions.create.return_value = mock_response

                # Mock the command processor to return a decorator-generated error message
                error_message = "An unexpected error occurred: [Errno 13] Permission denied: '/unauthorized/path/file.txt'"
                mock_cmd_processor.execute_command.return_value = error_message

                # 2. Initialize brain
                from alejo.brain import ALEJOBrain

                brain = ALEJOBrain()

                # 3. Process a command
                final_response = brain.process_command(
                    "create a file in a forbidden directory"
                )

                # 4. Assertions
                mock_cmd_processor.execute_command.assert_called_once_with(
                    "create_file", "/unauthorized/path/file.txt"
                )
                self.assertEqual(final_response, error_message)


if __name__ == "__main__":
    unittest.main()
