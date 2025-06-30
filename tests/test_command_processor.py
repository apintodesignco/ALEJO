import unittest
import os
import sys
from pathlib import Path
import shutil
from unittest.mock import patch

# Add project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.commands import CommandProcessor

class TestCommandProcessor(unittest.TestCase):
    """Unit tests for the CommandProcessor"""

    def setUp(self):
        """Set up a test environment before each test."""
        self.test_dir = Path("test_unit_output")
        self.test_dir.mkdir(exist_ok=True)
        # We initialize CommandProcessor directly for unit testing its methods
        self.cmd_processor = CommandProcessor()

    def tearDown(self):
        """Clean up the test environment after each test."""
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    def test_handle_create_file(self):
        """Test the internal _handle_create_file method."""
        test_file = self.test_dir / "new_test_file.txt"
        
        # Ensure the file does not exist before the test
        self.assertFalse(test_file.exists())

        # Call the internal method directly
        result = self.cmd_processor._handle_create_file(str(test_file))

        # Verify the result
        self.assertIn("Created file", result)
        self.assertTrue(test_file.exists(), "_handle_create_file did not create the file.")

    def test_handle_delete_file(self):
        """Test the internal _handle_delete_file method."""
        test_file = self.test_dir / "file_to_delete.txt"
        test_file.touch() # Create the file to be deleted

        self.assertTrue(test_file.exists())

        result = self.cmd_processor._handle_delete_file(str(test_file))

        self.assertIn("Deleted file", result)
        self.assertFalse(test_file.exists(), "_handle_delete_file did not delete the file.")

    def test_handle_rename_file(self):
        """Test the internal _handle_rename_file method."""
        original_file = self.test_dir / "original.txt"
        renamed_file = self.test_dir / "renamed.txt"
        original_file.touch()

        self.assertTrue(original_file.exists())
        self.assertFalse(renamed_file.exists())

        # _handle_rename_file expects a single string argument like "source to target"
        args_string = f"{original_file} to {renamed_file}"
        result = self.cmd_processor._handle_rename_file(args_string)

        self.assertIn("Renamed file", result)
        self.assertFalse(original_file.exists(), "Original file still exists after rename.")
        self.assertTrue(renamed_file.exists(), "Renamed file was not created.")

    @patch('alejo.commands.os.startfile')
    def test_handle_open_file_windows(self, mock_os_startfile):
        """Test the internal _handle_open_file method on Windows."""
        test_file = self.test_dir / "file_to_open.txt"
        test_file.touch()

        result = self.cmd_processor._handle_open_file(str(test_file))

        self.assertIn("Opening file", result)
        # On Windows, os.startfile is expected to be called with the absolute path.
        mock_os_startfile.assert_called_once_with(str(test_file.resolve()))


if __name__ == '__main__':
    unittest.main()
