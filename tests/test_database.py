import os
import secrets  # More secure for cryptographic purposes
import unittest
from unittest.mock import MagicMock, patch

from alejo.database.manager import DatabaseManager


class TestDatabaseManager(unittest.TestCase):
    """Test database management capabilities for ALEJO"""

    def setUp(self):
        self.db_path = ":memory:"  # Use in-memory database for testing
        self.db_manager = DatabaseManager(db_path=self.db_path, config={})

    def tearDown(self):
        self.db_manager.close()

    def test_store_and_retrieve_memory(self):
        """Test storing and retrieving long-term memory"""
        user_id = "test_user"
        memory_type = "test_memory"
        content = "This is a test memory"

        self.db_manager.store_memory(user_id, memory_type, content)
        memories = self.db_manager.retrieve_memories(user_id, memory_type, limit=1)

        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["user_id"], user_id)
        self.assertEqual(memories[0]["memory_type"], memory_type)
        self.assertEqual(memories[0]["content"], content)

    def test_update_and_get_relationship_data(self):
        """Test updating and retrieving relationship data"""
        user_id = "test_user"
        relationship_type = "test_relationship"
        trust_level = 0.7
        rapport_level = 0.8

        self.db_manager.update_relationship_data(
            user_id, relationship_type, trust_level, rapport_level
        )
        relationship_data = self.db_manager.get_relationship_data(
            user_id, relationship_type
        )

        self.assertEqual(len(relationship_data), 1)
        self.assertEqual(relationship_data[0]["user_id"], user_id)
        self.assertEqual(relationship_data[0]["relationship_type"], relationship_type)
        self.assertEqual(relationship_data[0]["trust_level"], trust_level)
        self.assertEqual(relationship_data[0]["rapport_level"], rapport_level)

    def test_set_and_get_user_preferences(self):
        """Test setting and retrieving user preferences"""
        user_id = "test_user"
        preference_key = "theme"
        preference_value = "dark"

        self.db_manager.set_user_preference(user_id, preference_key, preference_value)
        preferences = self.db_manager.get_user_preferences(user_id, preference_key)

        self.assertEqual(preferences.get(preference_key), preference_value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
