import gc
import os
import sys
import time
import unittest
from unittest.mock import MagicMock, patch

from alejo.utils.exceptions import (
    APIError,
    ConnectionError,
    LLMServiceError,
    MemoryError,
    NetworkError,
    PermissionError,
    TimeoutError,
)

# Add project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import secrets  # More secure for cryptographic purposes

from alejo.utils.error_handling import ErrorTracker, get_error_tracker, handle_errors


class TestErrorTracker(unittest.TestCase):
    """Unit tests for the ErrorTracker class."""

    @patch("alejo.utils.error_handling.Path.mkdir")
    @patch(
        "alejo.utils.error_handling.ErrorTracker._load_error_counts", return_value={}
    )
    def setUp(self, mock_load_counts, mock_mkdir):
        """Set up a fresh ErrorTracker instance for each test."""
        # Let the tracker auto-detect the test environment
        self.tracker = ErrorTracker()
        # Prevent file writing during tests
        self.tracker._save_error_counts = MagicMock()

    def test_01_initialization_in_test_mode(self):
        """Test that the ErrorTracker initializes correctly and auto-detects test mode."""
        self.assertIsNotNone(self.tracker)
        self.assertTrue(
            self.tracker.test_mode,
            "Tracker should auto-detect the unittest environment.",
        )
        self.assertEqual(self.tracker.error_counts, {})
        self.assertTrue(all(self.tracker.component_health.values()))

    def test_02_track_error_increments_count(self):
        """Test that tracking an error increments the correct counter."""
        error_key = "test_component:test_type"
        self.tracker.track_error(
            "test_component", "test_type", ValueError("Test error")
        )
        self.assertEqual(self.tracker.error_counts.get(error_key), 1)
        self.tracker.track_error(
            "test_component", "test_type", ValueError("Another error")
        )
        self.assertEqual(self.tracker.error_counts.get(error_key), 2)

    def test_03_component_becomes_unhealthy_at_threshold(self):
        """Test that a component's health changes when the error threshold is met."""
        # For this test, we must explicitly disable test_mode
        self.tracker.test_mode = False
        component = "command_processor"
        error_type = "test_error"
        threshold = self.tracker.thresholds[component]

        self.assertTrue(
            self.tracker.component_health[component],
            "Component should be healthy initially.",
        )

        # Log errors up to one BEFORE the threshold
        for i in range(threshold - 1):
            self.tracker.track_error(component, error_type, Exception(f"Error {i + 1}"))
            self.assertTrue(
                self.tracker.component_health[component],
                f"Component should be healthy after {i + 1} errors.",
            )

        # Log the final error that MEETS the threshold
        self.tracker.track_error(component, error_type, Exception(f"Error {threshold}"))
        self.assertFalse(
            self.tracker.component_health[component],
            "Component should become unhealthy exactly at the threshold.",
        )

    def test_04_health_does_not_change_in_default_test_mode(self):
        """Test that component health is not affected when in the default test mode."""
        # The tracker is already in test mode by default when run via unittest
        self.assertTrue(self.tracker.test_mode)
        component = "command_processor"
        threshold = self.tracker.thresholds[component]

        # Log errors far exceeding the threshold
        for _ in range(threshold + 5):
            self.tracker.track_error(component, "test_error", Exception("An error"))

        # Component should remain healthy because we are in test mode
        self.assertTrue(
            self.tracker.component_health[component],
            "Component health should not change in test mode.",
        )


class TestHandleErrorsDecorator(unittest.TestCase):
    """Unit tests for the @handle_errors decorator."""

    @patch("alejo.utils.error_handling.get_error_tracker")
    def test_01_decorator_calls_function_and_returns_value(self, mock_get_tracker):
        """Test that the decorator calls the function and returns its value when no error occurs."""
        mock_tracker = MagicMock()
        mock_get_tracker.return_value = mock_tracker

        @handle_errors(component="test_component")
        def sample_function(x, y):
            return x + y

        result = sample_function(2, 3)

        self.assertEqual(result, 5)
        mock_tracker.track_error.assert_not_called()

    @patch("alejo.utils.error_handling.get_error_tracker")
    def test_02_decorator_catches_exception_and_logs_error(self, mock_get_tracker):
        """Test that the decorator catches an exception and calls track_error."""
        mock_tracker = MagicMock()
        mock_get_tracker.return_value = mock_tracker
        test_exception = ValueError("Something went wrong")

        @handle_errors(component="test_component", category="test_failure")
        def failing_function():
            raise test_exception

        # The decorator should re-raise the exception
        with self.assertRaises(ValueError) as context:
            failing_function()

        self.assertEqual(str(context.exception), "Something went wrong")
        mock_tracker.track_error.assert_called_once()

        # Verify the arguments passed to track_error
        mock_tracker.track_error.assert_called_once_with(
            "test_component",
            "test_failure",
            test_exception,
            {"function": "failing_function", "args": "()", "kwargs": "{}"},
        )


class TestRecoveryStrategies(unittest.TestCase):
    """Unit tests for error recovery strategies."""

    @patch("alejo.utils.error_handling.Path.mkdir")
    @patch(
        "alejo.utils.error_handling.ErrorTracker._load_error_counts", return_value={}
    )
    def setUp(self, mock_load_counts, mock_mkdir):
        self.tracker = ErrorTracker()
        self.tracker._save_error_counts = MagicMock()

    @patch("time.sleep")
    def test_01_connection_recovery(self, mock_sleep):
        """Test connection error recovery strategy."""
        error = ConnectionError("Connection lost")
        context = {"retry_count": 0, "max_retries": 3}

        result = self.tracker._recover_connection(error, context)

        self.assertIsInstance(result, dict)
        self.assertIn("success", result)
        self.assertIn("actions", result)
        self.assertTrue(result["success"])
        mock_sleep.assert_called_once()
        self.assertTrue(any("backoff_wait" in action for action in result["actions"]))

    def test_02_memory_recovery(self):
        """Test memory error recovery strategy."""
        error = MemoryError("Out of memory")
        mock_cache = MagicMock()
        context = {"current_usage": 90, "cache_size": 50, "cache": mock_cache}

        # Mock gc.collect() to track if it was called
        with patch("gc.collect") as mock_gc:
            result = self.tracker._recover_memory(error, context)

            # Verify recovery attempt was made
            self.assertIsInstance(result, dict)
            self.assertIn("success", result)
            self.assertIn("actions", result)
            self.assertTrue(result["success"])

            # Verify garbage collection was called
            mock_gc.assert_called_once()
            mock_cache.clear.assert_called_once()

            # Verify actions taken
            self.assertIn("garbage_collection", result["actions"])
            self.assertIn("cleared_cache", result["actions"])

    def test_03_permission_recovery(self):
        """Test permission error recovery strategy."""
        error = PermissionError("Access denied")
        context = {
            "resource": "/test/path",
            "alternative_paths": ["/alt/path1", "/alt/path2"],
            "elevate_permissions": lambda x: True,
        }

        result = self.tracker._recover_permission(error, context)

        self.assertIsInstance(result, dict)
        self.assertIn("success", result)
        self.assertIn("actions", result)

    def test_04_network_recovery(self):
        """Test network error recovery strategy."""
        error = TimeoutError("Network timeout")
        context = {
            "retry_count": 0,
            "max_retries": 3,
            "client": MagicMock(reset_pool=MagicMock()),
        }

        result = self.tracker._recover_network(error, context)

        self.assertIsInstance(result, dict)
        self.assertIn("success", result)
        self.assertIn("actions", result)
        self.assertTrue(result["success"])
        self.assertIn("retry", result["actions"])
        self.assertTrue(any("backoff_" in action for action in result["actions"]))

    @patch("time.sleep")
    def test_05_llm_service_recovery(self, mock_sleep):
        """Test LLM service error recovery strategy."""
        error = APIError("API rate limit exceeded")
        mock_service = MagicMock()
        mock_service.rotate_api_key = MagicMock()
        mock_service.clear_context = MagicMock()
        context = {
            "retry_count": 0,
            "max_retries": 3,
            "api_keys": ["key1", "key2"],
            "service": mock_service,
        }

        result = self.tracker._recover_llm_service(error, context)

        self.assertIsInstance(result, dict)
        self.assertIn("success", result)
        self.assertIn("actions", result)


class TestErrorTrackerIntegration(unittest.TestCase):
    """Integration tests for error tracking and recovery."""

    @patch("alejo.utils.error_handling.Path.mkdir")
    @patch(
        "alejo.utils.error_handling.ErrorTracker._load_error_counts", return_value={}
    )
    def setUp(self, mock_load_counts, mock_mkdir):
        self.tracker = ErrorTracker()
        self.tracker._save_error_counts = MagicMock()

    @patch("time.sleep")
    def test_01_error_tracking_with_recovery(self, mock_sleep):
        """Test complete error tracking flow with recovery attempt."""
        component = "llm_service"
        error_type = "llm_service"
        error = APIError("Rate limit exceeded")
        mock_service = MagicMock()
        mock_service.rotate_api_key = MagicMock()
        mock_service.clear_context = MagicMock()
        context = {
            "retry_count": 0,
            "max_retries": 3,
            "api_keys": ["key1", "key2"],
            "service": mock_service,
        }

        result = self.tracker.track_error(component, error_type, error, context)

        self.assertIsInstance(result, dict)
        self.assertIn("error", result)
        self.assertIn("recovery", result)

        # Verify error info
        self.assertEqual(result["error"]["component"], component)
        self.assertEqual(result["error"]["category"], error_type)
        self.assertEqual(result["error"]["message"], str(error))
        self.assertIsInstance(result["error"]["timestamp"], float)

        # Verify recovery info
        self.assertIsInstance(result["recovery"], dict)
        self.assertIn("success", result["recovery"])
        self.assertTrue(result["recovery"]["success"])
        self.assertIn("actions", result["recovery"])

    def test_02_decorator_with_recovery(self):
        """Test error handling decorator with recovery attempt."""

        @handle_errors(component="llm_service", category="llm_service")
        def api_call(context):
            raise APIError("Rate limit exceeded")

        mock_service = MagicMock()
        mock_service.rotate_api_key = MagicMock()
        mock_service.clear_context = MagicMock()
        context = {
            "retry_count": 0,
            "max_retries": 3,
            "api_keys": ["key1", "key2"],
            "service": mock_service,
        }

        with self.assertRaises(APIError):
            api_call(context)


if __name__ == "__main__":
    unittest.main()
