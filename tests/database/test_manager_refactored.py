"""
Tests for the refactored DatabaseManager class.

This test suite verifies that the refactored DatabaseManager correctly
integrates with the advanced caching system while maintaining all
existing functionality.
"""

import os
import unittest
import tempfile
import sqlite3
from unittest.mock import patch, MagicMock

from alejo.database.manager_refactored import DatabaseManager
from alejo.database.cache_integration import DatabaseCacheManager


class TestDatabaseManagerRefactored(unittest.TestCase):
    """Test suite for the refactored DatabaseManager class."""
    
    def setUp(self):
        """Set up a test database for each test."""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        
        # Create a test database manager
        self.db_manager = DatabaseManager(db_path=self.db_path)
        
    def tearDown(self):
        """Clean up after each test."""
        self.db_manager.close()
        os.unlink(self.db_path)
        
    def test_initialization(self):
        """Test that the database manager initializes correctly."""
        # Verify that tables were created
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check if memories table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'")
            self.assertIsNotNone(cursor.fetchone())
            
            # Check if relationships table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='relationships'")
            self.assertIsNotNone(cursor.fetchone())
            
            # Check if preferences table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='preferences'")
            self.assertIsNotNone(cursor.fetchone())
            
        # Verify that the cache manager was initialized
        self.assertIsInstance(self.db_manager.cache_manager, DatabaseCacheManager)
        
    def test_store_and_retrieve_memory(self):
        """Test storing and retrieving memories."""
        # Store a test memory
        memory_id = self.db_manager.store_memory(
            user_id="test_user",
            memory_type="episodic",
            content="This is a test memory",
            importance=0.8
        )
        
        # Verify the memory was stored
        self.assertIsNotNone(memory_id)
        
        # Retrieve the memory
        memories = self.db_manager.retrieve_memories(
            user_id="test_user",
            memory_type="episodic"
        )
        
        # Verify the memory was retrieved correctly
        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["content"], "This is a test memory")
        self.assertEqual(memories[0]["importance"], 0.8)
        
    def test_relationship_data(self):
        """Test storing and retrieving relationship data."""
        # Update relationship data
        self.db_manager.update_relationship_data(
            user_id="test_user",
            relationship_type="friend",
            trust_level=0.9,
            rapport_level=0.8
        )
        
        # Retrieve relationship data
        relationships = self.db_manager.get_relationship_data(
            user_id="test_user",
            relationship_type="friend"
        )
        
        # Verify the relationship data was stored and retrieved correctly
        self.assertEqual(len(relationships), 1)
        self.assertEqual(relationships[0]["trust_level"], 0.9)
        self.assertEqual(relationships[0]["rapport_level"], 0.8)
        
    def test_user_preferences(self):
        """Test storing and retrieving user preferences."""
        # Set a user preference
        self.db_manager.set_user_preference(
            user_id="test_user",
            preference_key="theme",
            preference_value="dark"
        )
        
        # Get user preferences
        preferences = self.db_manager.get_user_preferences(
            user_id="test_user"
        )
        
        # Verify the preference was stored and retrieved correctly
        self.assertEqual(preferences["theme"], "dark")
        
    def test_batch_operation(self):
        """Test batch operations."""
        # Define a batch of operations
        operations = [
            (
                "INSERT INTO memories (user_id, memory_type, content, importance) VALUES (?, ?, ?, ?)",
                ["test_user", "semantic", "Memory 1", 0.5]
            ),
            (
                "INSERT INTO memories (user_id, memory_type, content, importance) VALUES (?, ?, ?, ?)",
                ["test_user", "semantic", "Memory 2", 0.7]
            )
        ]
        
        # Execute the batch operation
        self.db_manager.batch_operation(operations)
        
        # Verify the operations were executed
        memories = self.db_manager.retrieve_memories(
            user_id="test_user",
            memory_type="semantic"
        )
        
        self.assertEqual(len(memories), 2)
        
    @patch('alejo.database.cache_integration.DatabaseCacheManager.invalidate_pattern')
    def test_cache_invalidation(self, mock_invalidate):
        """Test that cache invalidation is called when data is modified."""
        # Store a memory
        self.db_manager.store_memory(
            user_id="test_user",
            memory_type="episodic",
            content="This is a test memory"
        )
        
        # Verify that cache invalidation was called
        mock_invalidate.assert_called_with("retrieve_memories:test_user")
        
    @patch('alejo.database.cache_integration.DatabaseCacheManager.invalidate_all')
    def test_batch_operation_invalidates_all_cache(self, mock_invalidate_all):
        """Test that batch operations invalidate all cache entries."""
        # Define a batch of operations
        operations = [
            (
                "INSERT INTO memories (user_id, memory_type, content, importance) VALUES (?, ?, ?, ?)",
                ["test_user", "semantic", "Memory 1", 0.5]
            )
        ]
        
        # Execute the batch operation
        self.db_manager.batch_operation(operations)
        
        # Verify that all cache entries were invalidated
        mock_invalidate_all.assert_called_once()
        
    def test_optimize_database(self):
        """Test database optimization."""
        # This is mostly a smoke test to ensure the method doesn't raise exceptions
        self.db_manager.optimize_database()


if __name__ == '__main__':
    unittest.main()
