"""
ALEJO Database Manager

This module implements database management capabilities for persistent storage
of long-term memory, relationship data, and user preferences.
"""

import logging
import sqlite3
from typing import Dict, Any, Optional, List

from ..utils.error_handling import handle_errors

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manager for database operations related to ALEJO's persistent storage"""
    
    def __init__(self, db_path: str, config: Optional[Dict[str, Any]] = None):
        """Initialize the database manager with a specific database path"""
        self.db_path = db_path
        self.config = config or {}
        self.conn = None
        self._initialize_database()
        logger.info(f"Database manager initialized with path: {db_path}")
    
    def _initialize_database(self):
        """Initialize the database connection and create necessary tables"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self._create_tables()
        except sqlite3.Error as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _create_tables(self):
        """Create the necessary tables if they don't exist"""
        try:
            cursor = self.conn.cursor()
            # Table for long-term memory
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS long_term_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Table for relationship data
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS relationship_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    trust_level REAL DEFAULT 0.5,
                    rapport_level REAL DEFAULT 0.5,
                    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Table for user preferences
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    preference_key TEXT NOT NULL,
                    preference_value TEXT NOT NULL
                )
            """)
            self.conn.commit()
            logger.info("Database tables created or already exist")
        except sqlite3.Error as e:
            logger.error(f"Failed to create tables: {e}")
            raise
    
    @handle_errors(component="database_manager", category="storage")
    def store_memory(self, user_id: str, memory_type: str, content: str):
        """Store a piece of long-term memory for a user"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO long_term_memory (user_id, memory_type, content)
                VALUES (?, ?, ?)
            """, (user_id, memory_type, content))
            self.conn.commit()
            logger.info(f"Stored memory for user {user_id}")
        except sqlite3.Error as e:
            logger.error(f"Error storing memory: {e}", exc_info=True)
            raise
    
    @handle_errors(component="database_manager", category="retrieval")
    def retrieve_memories(self, user_id: str, memory_type: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve memories for a user, optionally filtered by type"""
        try:
            cursor = self.conn.cursor()
            query = """
                SELECT id, user_id, memory_type, content, timestamp
                FROM long_term_memory
                WHERE user_id = ?
            """
            params = [user_id]
            if memory_type:
                query += " AND memory_type = ?"
                params.append(memory_type)
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [{
                "id": row[0],
                "user_id": row[1],
                "memory_type": row[2],
                "content": row[3],
                "timestamp": row[4]
            } for row in rows]
        except sqlite3.Error as e:
            logger.error(f"Error retrieving memories: {e}", exc_info=True)
            raise
    
    @handle_errors(component="database_manager", category="storage")
    def update_relationship_data(self, user_id: str, relationship_type: str, trust_level: float, rapport_level: float):
        """Update relationship data for a user"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO relationship_data 
                (user_id, relationship_type, trust_level, rapport_level, last_interaction)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (user_id, relationship_type, trust_level, rapport_level))
            self.conn.commit()
            logger.info(f"Updated relationship data for user {user_id}")
        except sqlite3.Error as e:
            logger.error(f"Error updating relationship data: {e}", exc_info=True)
            raise
    
    @handle_errors(component="database_manager", category="retrieval")
    def get_relationship_data(self, user_id: str, relationship_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve relationship data for a user, optionally filtered by type"""
        try:
            cursor = self.conn.cursor()
            query = """
                SELECT user_id, relationship_type, trust_level, rapport_level, last_interaction
                FROM relationship_data
                WHERE user_id = ?
            """
            params = [user_id]
            if relationship_type:
                query += " AND relationship_type = ?"
                params.append(relationship_type)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [{
                "user_id": row[0],
                "relationship_type": row[1],
                "trust_level": row[2],
                "rapport_level": row[3],
                "last_interaction": row[4]
            } for row in rows]
        except sqlite3.Error as e:
            logger.error(f"Error retrieving relationship data: {e}", exc_info=True)
            raise
    
    @handle_errors(component="database_manager", category="storage")
    def set_user_preference(self, user_id: str, preference_key: str, preference_value: str):
        """Set a user preference"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO user_preferences 
                (user_id, preference_key, preference_value)
                VALUES (?, ?, ?)
            """, (user_id, preference_key, preference_value))
            self.conn.commit()
            logger.info(f"Set preference {preference_key} for user {user_id}")
        except sqlite3.Error as e:
            logger.error(f"Error setting user preference: {e}", exc_info=True)
            raise
    
    @handle_errors(component="database_manager", category="retrieval")
    def get_user_preferences(self, user_id: str, preference_key: Optional[str] = None) -> Dict[str, str]:
        """Retrieve user preferences, optionally for a specific key"""
        try:
            cursor = self.conn.cursor()
            query = """
                SELECT preference_key, preference_value
                FROM user_preferences
                WHERE user_id = ?
            """
            params = [user_id]
            if preference_key:
                query += " AND preference_key = ?"
                params.append(preference_key)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return {row[0]: row[1] for row in rows}
        except sqlite3.Error as e:
            logger.error(f"Error retrieving user preferences: {e}", exc_info=True)
            raise
    
    def close(self):
        """Close the database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
