"""
DatabaseManager module for ALEJO
Provides persistent storage using SQLite for long-term memory and relationship data.
"""

import sqlite3
import os

class DatabaseManager:
    def __init__(self, db_path: str):
        """Initialize the database manager with the given SQLite database path."""
        self.db_path = db_path
        self.conn = None
        self._ensure_db()

    def _ensure_db(self):
        """Ensure the database exists and initialize tables if not."""
        db_exists = os.path.exists(self.db_path)
        self.conn = sqlite3.connect(self.db_path)
        if not db_exists:
            self._initialize_tables()

    def _initialize_tables(self):
        """Create necessary tables for long-term memory and relationships."""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS long_term_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def insert_memory(self, content: str) -> int:
        """Insert a new memory entry and return its ID."""
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO long_term_memory (content) VALUES (?)", (content,))
        self.conn.commit()
        return cursor.lastrowid

    def fetch_memory(self) -> list:
        """Fetch all memory entries."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM long_term_memory ORDER BY timestamp DESC")
        return cursor.fetchall()

    def insert_relationship(self, user_id: str, details: str) -> int:
        """Insert relationship data and return its ID."""
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO relationships (user_id, details) VALUES (?, ?)", (user_id, details))
        self.conn.commit()
        return cursor.lastrowid

    def fetch_relationships(self) -> list:
        """Fetch all relationship entries."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM relationships ORDER BY timestamp DESC")
        return cursor.fetchall()

    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
