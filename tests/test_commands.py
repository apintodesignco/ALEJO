import unittest
import os
import sys
from unittest.mock import patch, MagicMock
import datetime

# Add project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.commands import CommandProcessor

class TestCommandProcessor(unittest.TestCase):
    """Unit tests for the CommandProcessor class."""

    def setUp(self):
        """Set up a fresh CommandProcessor instance for each test."""
        # We can pass a mock config if needed, but for now, default is fine
        self.processor = CommandProcessor()

    @patch('os.makedirs')
    @patch('alejo.commands.open', new_callable=unittest.mock.mock_open)
    def test_01_create_file_command_success(self, mock_open, mock_makedirs):
        """Test the 'create file' command handler for successful creation."""
        filename = "test_file.txt"
        command = f"create file {filename}"
        
        # The command processor resolves this to an absolute path
        expected_path = os.path.abspath(filename)
        expected_dir = os.path.dirname(expected_path)

        # Process the command
        result = self.processor.process_command(command)
        
        # Assert that the directory creation method was called with the correct path
        mock_makedirs.assert_called_once_with(expected_dir, exist_ok=True)
        
        # Assert that the open function was called with the absolute path
        mock_open.assert_called_once_with(expected_path, 'w')
        
        # Assert that the success message contains the absolute path
        self.assertEqual(result, f"Created file: {expected_path}")

    @patch('alejo.commands.webbrowser.open')
    def test_02_search_web_command_success(self, mock_web_open):
        """Test the 'search for' command handler for successful web search."""
        query = "how to write python"
        command = f"search for {query}"
        
        # The handler formats the query for a URL
        expected_url = f"https://www.google.com/search?q={'+'.join(query.split())}"
        
        # Process the command
        result = self.processor.process_command(command)
        
        # Assert that webbrowser.open was called with the correct URL
        mock_web_open.assert_called_once_with(expected_url)
        
        # Assert that the success message is returned
        self.assertEqual(result, f"Searching for: {query}")

    @patch('alejo.commands.datetime')
    def test_03_show_time_command_success(self, mock_datetime):
        """Test the 'show time' command handler."""
        # Setup a fixed time to be returned by datetime.now()
        fixed_time = datetime.datetime(2025, 6, 14, 13, 30, 0)
        mock_datetime.datetime.now.return_value = fixed_time
        
        command = "show time"
        
        # Process the command
        result = self.processor.process_command(command)
        
        # Assert that the success message is correctly formatted
        self.assertEqual(result, "The current time is: 13:30:00")

    @patch('os.makedirs')
    @patch('alejo.commands.open', new_callable=unittest.mock.mock_open)
    def test_04_create_file_command_failure(self, mock_open, mock_makedirs):
        """Test that the 'create file' command handles exceptions gracefully."""
        # Configure the mock for open() to raise an IOError
        error_message = "Permission denied"
        mock_open.side_effect = IOError(error_message)
        
        command = "create file failing_file.txt"
        
        # Process the command
        result = self.processor.process_command(command)
        
        # Assert that the failure message is returned
        self.assertEqual(result, f"Failed to create file: {error_message}")

    @patch('os.remove')
    @patch('os.path.exists', return_value=True)
    def test_05_delete_file_command_success(self, mock_exists, mock_remove):
        """Test the 'delete file' command handler for successful deletion."""
        filename = "file_to_delete.txt"
        command = f"delete file {filename}"
        expected_path = os.path.abspath(filename)

        # Process the command
        result = self.processor.process_command(command)

        # Assert that the existence check and remove were called with the correct path
        mock_exists.assert_called_once_with(expected_path)
        mock_remove.assert_called_once_with(expected_path)

        # Assert that the success message is returned
        self.assertEqual(result, f"Deleted file: {expected_path}")

    @patch('os.remove')
    @patch('os.path.exists', return_value=False)
    def test_06_delete_file_not_found(self, mock_exists, mock_remove):
        """Test the 'delete file' command when the file does not exist."""
        filename = "non_existent_file.txt"
        command = f"delete file {filename}"
        expected_path = os.path.abspath(filename)

        # Process the command
        result = self.processor.process_command(command)

        # Assert that the existence check was called
        mock_exists.assert_called_once_with(expected_path)

        # Assert that os.remove was NOT called
        mock_remove.assert_not_called()

        # Assert that the correct error message is returned
        self.assertEqual(result, f"File not found: {expected_path}")

    @patch('os.remove')
    @patch('os.path.exists')
    def test_07_delete_file_protected_path_failure(self, mock_exists, mock_remove):
        """Test that deleting a file in a protected path is denied."""
        # This path is configured as protected in the CommandProcessor
        protected_path = os.path.join("C:\\", "Windows", "System32", "some_file.dll")
        command = f"delete file {protected_path}"

        # Process the command
        result = self.processor.process_command(command)

        # Assert that no file system checks or operations were performed
        mock_exists.assert_not_called()
        mock_remove.assert_not_called()

        # Assert that the specific permission denied message is returned
        # The command processor lowercases the path argument, so we must assert against the lowercased version.
        self.assertEqual(result, f"Permission denied: Cannot access protected file {protected_path.lower()}")

    @patch('os.remove')
    @patch('os.path.exists', return_value=True)
    def test_08_delete_file_decorator_error_handling(self, mock_exists, mock_remove):
        """Test that the @handle_errors decorator catches and logs exceptions."""
        # 1. Setup mocks
        # Mock the error tracker on the processor instance to intercept calls
        self.processor.error_tracker = MagicMock()

        # Configure os.remove to raise an error to trigger the decorator
        error_message = "Permission denied"
        mock_remove.side_effect = PermissionError(error_message)

        filename = "locked_file.txt"
        command = f"delete file {filename}"
        expected_path = os.path.abspath(filename)

        # 2. Process the command
        result = self.processor.process_command(command)

        # 3. Assertions
        # Assert that the file system checks were performed as expected
        mock_exists.assert_called_once_with(expected_path)
        # The method retries 3 times on failure, so we expect 3 calls
        self.assertEqual(mock_remove.call_count, 3)
        mock_remove.assert_called_with(expected_path) # Verify the arguments of the last call

        # Assert that the error tracker was called exactly once by the decorator
        self.processor.error_tracker.track_error.assert_called_once()

        # Assert that the correct arguments were passed to the error tracker
        call_args, _ = self.processor.error_tracker.track_error.call_args
        self.assertEqual(call_args[0], "command_processor")  # component
        self.assertEqual(call_args[1], "file_operation")   # category
        self.assertIsInstance(call_args[2], PermissionError) # exception
        self.assertEqual(str(call_args[2]), error_message)

        # Assert that the user-friendly message from the decorator is returned
        self.assertEqual(result, f"An unexpected error occurred: {error_message}")

if __name__ == '__main__':
    unittest.main()
