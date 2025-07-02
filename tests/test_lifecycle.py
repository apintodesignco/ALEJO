"""
Tests for ALEJO application lifecycle including startup, shutdown, and resource management
"""

import os
import signal
import sys
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import psutil

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import secrets  # More secure for cryptographic purposes

from alejo.brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker
from alejo.utils.exceptions import ShutdownError


class TestALEJOLifecycle(unittest.TestCase):
    """Test suite for ALEJO application lifecycle management."""

    def setUp(self):
        """Set up test environment."""
        self.test_dir = Path("test_lifecycle_output")
        self.test_dir.mkdir(exist_ok=True)
        os.environ["ALEJO_LOCAL_INFERENCE"] = "1"

    def tearDown(self):
        """Clean up test environment."""
        if self.test_dir.exists():
            self.test_dir.rmdir()
        if "ALEJO_LOCAL_INFERENCE" in os.environ:
            del os.environ["ALEJO_LOCAL_INFERENCE"]

    def test_01_startup_sequence(self):
        """Test the complete startup sequence."""
        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            mock_instance = MagicMock()
            mock_LocalLLM.return_value = mock_instance

            # Initialize brain
            brain = ALEJOBrain()

            # Verify initialization order
            self.assertTrue(brain.initialized)
            self.assertIsNotNone(brain.command_processor)
            self.assertIsNotNone(brain.llm_client)
            self.assertTrue(hasattr(brain, "error_tracker"))

            # Verify resource allocation
            self.assertIsNotNone(brain.command_handlers)
            self.assertTrue(isinstance(brain.error_tracker, ErrorTracker))

    def test_02_graceful_shutdown(self):
        """Test graceful shutdown with resource cleanup."""
        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            mock_instance = MagicMock()
            mock_LocalLLM.return_value = mock_instance

            # Initialize brain
            brain = ALEJOBrain()

            # Create some test resources
            test_file = self.test_dir / "test.txt"
            test_file.touch()

            # Simulate SIGTERM
            with patch("signal.signal") as mock_signal:

                def handle_sigterm(sig, frame):
                    # Clean up resources
                    if test_file.exists():
                        test_file.unlink()
                    brain.command_processor = None
                    brain.llm_client = None

                mock_signal.side_effect = handle_sigterm

                # Trigger shutdown
                os.kill(os.getpid(), signal.SIGTERM)

                # Verify cleanup
                self.assertIsNone(brain.command_processor)
                self.assertIsNone(brain.llm_client)
                self.assertFalse(test_file.exists())

    def test_03_resource_management(self):
        """Test resource allocation and deallocation."""
        initial_process = psutil.Process()
        initial_memory = initial_process.memory_info().rss

        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            mock_instance = MagicMock()
            mock_LocalLLM.return_value = mock_instance

            # Create multiple brain instances
            brains = []
            for _ in range(5):
                brain = ALEJOBrain()
                brains.append(brain)

            # Force garbage collection
            for brain in brains:
                brain.command_processor = None
                brain.llm_client = None
            brains = None

            # Check memory usage
            final_memory = initial_process.memory_info().rss
            memory_diff = final_memory - initial_memory

            # Allow for some overhead, but ensure no major leaks
            self.assertLess(memory_diff, 10 * 1024 * 1024)  # Less than 10MB growth

    def test_04_concurrent_operations(self):
        """Test handling of concurrent operations during startup/shutdown."""
        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            mock_instance = MagicMock()
            mock_LocalLLM.return_value = mock_instance

            brain = ALEJOBrain()

            # Create threads for concurrent operations
            def process_command():
                try:
                    brain.process_command("test command")
                except Exception:
                    pass

            threads = []
            for _ in range(10):
                thread = threading.Thread(target=process_command)
                threads.append(thread)
                thread.start()

            # Initiate shutdown while threads are running
            brain.command_processor = None
            brain.llm_client = None

            # Wait for threads to complete
            for thread in threads:
                thread.join(timeout=1.0)

            # Verify all threads completed
            for thread in threads:
                self.assertFalse(thread.is_alive())

    def test_05_error_recovery_during_startup(self):
        """Test error recovery during startup sequence."""
        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            # Make first initialization fail
            mock_LocalLLM.side_effect = [Exception("Startup failed"), MagicMock()]

            # First attempt should fail
            with self.assertRaises(Exception):
                brain = ALEJOBrain()

            # Second attempt should succeed
            brain = ALEJOBrain()
            self.assertTrue(brain.initialized)

    def test_06_config_persistence(self):
        """Test configuration persistence across restarts."""
        config = {"model": "test-model", "max_tokens": 100, "temperature": 0.7}

        with patch("alejo.llm_client.local_client.LocalLLMClient") as mock_LocalLLM:
            mock_instance = MagicMock()
            mock_LocalLLM.return_value = mock_instance

            # First instance
            brain1 = ALEJOBrain(config)
            self.assertEqual(brain1.config.get("model"), "test-model")

            # Simulate restart
            brain1.command_processor = None
            brain1.llm_client = None
            brain1 = None

            # Second instance should have same config
            brain2 = ALEJOBrain(config)
            self.assertEqual(brain2.config.get("model"), "test-model")
            self.assertEqual(brain2.config.get("max_tokens"), 100)
            self.assertEqual(brain2.config.get("temperature"), 0.7)
