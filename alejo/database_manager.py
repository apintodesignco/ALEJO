import sqlite3
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages persistent storage using SQLite."""

    def __init__(self, db_path='alejo.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._setup_tables()

    def _setup_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                data TEXT
            )
        ''')
        self.conn.commit()
        logger.info("Database tables set up.")

    def insert_interaction(self, data: str):
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO interactions (data) VALUES (?)", (data,))
        self.conn.commit()
        logger.info("Interaction inserted.")

    def fetch_interactions(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM interactions")
        return cursor.fetchall()

    def close(self):
        self.conn.close()
        logger.info("Database connection closed.")
