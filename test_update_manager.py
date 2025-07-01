#!/usr/bin/env python3
"""
Test script for ALEJO Update Manager
This script tests the functionality of the update manager to ensure it works correctly.
"""

import os
import sys
import shutil
import tempfile
import unittest
import subprocess
from pathlib import Path
from unittest import mock

# Import the update manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from update_manager import UpdateManager


class TestUpdateManager(unittest.TestCase):
    """Test cases for the ALEJO Update Manager"""
    
    def setUp(self):
        """Set up test environment"""
        # Create a temporary directory for testing
        self.test_dir = tempfile.mkdtemp(prefix="alejo_update_test_")
        self.original_dir = os.getcwd()
        
        # Create a mock git repository structure
        os.makedirs(os.path.join(self.test_dir, ".git"))
        
        # Change to the test directory
        os.chdir(self.test_dir)
        
        # Create test config
        self.test_config = {
            "check_interval_hours": 0,  # Always check
            "force_update": True
        }
    
    def tearDown(self):
        """Clean up test environment"""
        # Change back to the original directory
        os.chdir(self.original_dir)
        
        # Remove the temporary directory
        shutil.rmtree(self.test_dir)
    
    @mock.patch('subprocess.run')
    def test_is_git_repo(self, mock_run):
        """Test the is_git_repo method"""
        update_manager = UpdateManager(self.test_config)
        self.assertTrue(update_manager.is_git_repo())
        
        # Remove .git directory and test again
        shutil.rmtree(os.path.join(self.test_dir, ".git"))
        self.assertFalse(update_manager.is_git_repo())
    
    @mock.patch('subprocess.run')
    def test_check_for_updates_no_updates(self, mock_run):
        """Test checking for updates when none are available"""
        # Mock subprocess responses
        mock_run.side_effect = [
            # git rev-parse HEAD
            mock.Mock(stdout="abcd1234", stderr="", returncode=0),
            # git fetch
            mock.Mock(stdout="", stderr="", returncode=0),
            # git rev-parse origin/main
            mock.Mock(stdout="abcd1234", stderr="", returncode=0)
        ]
        
        update_manager = UpdateManager(self.test_config)
        update_available, current, latest = update_manager.check_for_updates()
        
        self.assertFalse(update_available)
        self.assertEqual(current, "abcd1234")
        self.assertEqual(latest, "abcd1234")
    
    @mock.patch('subprocess.run')
    def test_check_for_updates_available(self, mock_run):
        """Test checking for updates when updates are available"""
        # Mock subprocess responses
        mock_run.side_effect = [
            # git rev-parse HEAD
            mock.Mock(stdout="abcd1234", stderr="", returncode=0),
            # git fetch
            mock.Mock(stdout="", stderr="", returncode=0),
            # git rev-parse origin/main
            mock.Mock(stdout="efgh5678", stderr="", returncode=0)
        ]
        
        update_manager = UpdateManager(self.test_config)
        update_available, current, latest = update_manager.check_for_updates()
        
        self.assertTrue(update_available)
        self.assertEqual(current, "abcd1234")
        self.assertEqual(latest, "efgh5678")
    
    @mock.patch('subprocess.run')
    @mock.patch('shutil.copytree')
    @mock.patch('shutil.copy2')
    def test_backup_restore(self, mock_copy2, mock_copytree, mock_run):
        """Test backup and restore functionality"""
        update_manager = UpdateManager(self.test_config)
        
        # Create some test files
        with open("test_file.txt", "w") as f:
            f.write("test content")
        os.makedirs("test_dir")
        with open(os.path.join("test_dir", "test_sub.txt"), "w") as f:
            f.write("test subcontent")
        
        # Test backup
        backup_dir = update_manager.backup_current_version()
        self.assertIsNotNone(backup_dir)
        
        # Verify the mocks were called appropriately
        mock_copytree.assert_called()
        mock_copy2.assert_called()
        
        # Test restore
        update_manager.restore_backup(backup_dir)
    
    @mock.patch('subprocess.run')
    def test_apply_update_success(self, mock_run):
        """Test successful update application"""
        # Mock subprocess responses
        mock_run.side_effect = [
            # git pull
            mock.Mock(stdout="Updated files", stderr="", returncode=0),
            # pip install
            mock.Mock(stdout="Successfully installed", stderr="", returncode=0)
        ]
        
        update_manager = UpdateManager(self.test_config)
        
        # Mock backup_current_version
        with mock.patch.object(
            UpdateManager, 'backup_current_version', 
            return_value=os.path.join(self.test_dir, "backup")
        ):
            # Create requirements.txt for testing dependency updates
            with open("requirements.txt", "w") as f:
                f.write("pytest==6.2.5")
                
            result = update_manager.apply_update()
            self.assertTrue(result)
    
    @mock.patch('subprocess.run')
    def test_apply_update_failure(self, mock_run):
        """Test failed update application"""
        # Mock subprocess responses for failure
        mock_run.side_effect = [
            # git pull - fails
            mock.Mock(stdout="", stderr="Failed to pull", returncode=1)
        ]
        
        update_manager = UpdateManager(self.test_config)
        
        # Mock backup and restore methods
        with mock.patch.object(
            UpdateManager, 'backup_current_version', 
            return_value=os.path.join(self.test_dir, "backup")
        ):
            with mock.patch.object(UpdateManager, 'restore_backup') as mock_restore:
                result = update_manager.apply_update()
                self.assertFalse(result)
                # Verify restore was called
                mock_restore.assert_called_once()
    
    def test_should_check_for_updates(self):
        """Test the logic for determining if updates should be checked"""
        # Force update should always return True
        config = {"force_update": True, "check_interval_hours": 24}
        update_manager = UpdateManager(config)
        self.assertTrue(update_manager.should_check_for_updates())
        
        # Missing cache file should return True
        config = {"force_update": False, "check_interval_hours": 24}
        update_manager = UpdateManager(config)
        self.assertTrue(update_manager.should_check_for_updates())
        
        # Recent check should return False
        update_manager.update_check_cache()
        self.assertFalse(update_manager.should_check_for_updates())
        
        # Set very short interval to test True result
        config = {"force_update": False, "check_interval_hours": 0}
        update_manager = UpdateManager(config)
        update_manager.update_check_cache()
        self.assertTrue(update_manager.should_check_for_updates())


if __name__ == "__main__":
    unittest.main()