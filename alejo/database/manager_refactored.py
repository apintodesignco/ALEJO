"""
ALEJO Database Manager

This module provides optimized database operations for ALEJO's persistent storage needs.
It implements query optimization techniques including:
- Prepared statements
- Connection pooling
- Query result caching
- Index management
- Transaction batching
"""

import os
import sqlite3
import time
import threading
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from functools import lru_cache
from contextlib import contextmanager

from alejo.database.cache_integration import DatabaseCacheManager, db_cached

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Optimized database manager for ALEJO.
    
    This class provides efficient database operations with:
    - Connection pooling for concurrent access
    - Prepared statements for query optimization
    - Query result caching for frequently accessed data
    - Automatic index management
    - Transaction batching for bulk operations
    """
    
    # SQL statements for table creation
    CREATE_TABLES_SQL = {
        'memories': '''
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                memory_type TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP,
                importance REAL DEFAULT 0.5,
                UNIQUE(user_id, memory_type, content)
            )
        ''',
        'relationships': '''
            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                trust_level REAL DEFAULT 0.5,
                rapport_level REAL DEFAULT 0.5,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, relationship_type)
            )
        ''',
        'preferences': '''
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                preference_key TEXT NOT NULL,
                preference_value TEXT NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, preference_key)
            )
        ''',
        'indexes': '''
            CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, memory_type);
            CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
            CREATE INDEX IF NOT EXISTS idx_relationships_user ON relationships(user_id);
            CREATE INDEX IF NOT EXISTS idx_preferences_user ON preferences(user_id);
        '''
    }
    
    def __init__(self, db_path: str = None, config: Dict[str, Any] = None):
        """
        Initialize the database manager.
        
        Args:
            db_path: Path to the SQLite database file. If None, uses in-memory database.
            config: Configuration options for the database.
        """
        self.db_path = db_path or ':memory:'
        self.config = config or {}
        
        # Connection pool settings
        self.pool_size = self.config.get('pool_size', 5)
        self.pool = []
        self.pool_lock = threading.Lock()
        
        # Initialize advanced caching system
        cache_config = self.config.get('cache', {})
        self.cache_manager = DatabaseCacheManager(
            cache_enabled=cache_config.get('enabled', True),
            memory_ttl=cache_config.get('memory_ttl', 300),
            persistent_ttl=cache_config.get('persistent_ttl', 3600),
            memory_max_size=cache_config.get('memory_max_size', 5000),
            persistent_max_size=cache_config.get('persistent_max_size', 10000),
            eviction_policy=cache_config.get('eviction_policy', 'LRU'),
            use_persistent=cache_config.get('use_persistent', False),
            encrypt_persistent=cache_config.get('encrypt_persistent', True)
        )
        
        # Initialize database
        self._initialize_db()
        
    def _initialize_db(self):
        """Initialize the database with required tables and indexes."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Create tables if they don't exist
            for table_sql in self.CREATE_TABLES_SQL.values():
                cursor.execute(table_sql)
            
            conn.commit()
            logger.info(f"Database initialized at {self.db_path}")
    
    @contextmanager
    def _get_connection(self):
        """
        Get a database connection from the pool or create a new one.
        
        This method implements connection pooling for improved performance.
        """
        connection = None
        
        # Try to get a connection from the pool
        with self.pool_lock:
            if self.pool:
                connection = self.pool.pop()
        
        # Create a new connection if none available in the pool
        if connection is None:
            connection = sqlite3.connect(
                self.db_path,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
            )
            connection.row_factory = sqlite3.Row
        
        try:
            # Optimize connection
            connection.execute("PRAGMA journal_mode = WAL")  # Write-Ahead Logging for better concurrency
            connection.execute("PRAGMA synchronous = NORMAL")  # Balance between safety and speed
            connection.execute("PRAGMA cache_size = 10000")  # Larger cache for better performance
            connection.execute("PRAGMA temp_store = MEMORY")  # Store temp tables in memory
            
            yield connection
        finally:
            # Return connection to the pool if not closed
            if connection:
                try:
                    # Reset connection state
                    connection.rollback()
                    
                    # Add back to the pool if we haven't reached max size
                    with self.pool_lock:
                        if len(self.pool) < self.pool_size:
                            self.pool.append(connection)
                        else:
                            connection.close()
                except Exception:
                    # If there's an error, don't return to pool
                    try:
                        connection.close()
                    except Exception:
                        pass
    
    @db_cached(ttl=300, memory_only=True)
    def store_memory(self, user_id: str, memory_type: str, content: str, 
                    embedding: Optional[bytes] = None, importance: float = 0.5) -> int:
        """
        Store a memory in the database.
        
        Args:
            user_id: User identifier
            memory_type: Type of memory (e.g., 'episodic', 'semantic')
            content: Memory content
            embedding: Vector embedding of the memory content
            importance: Importance score (0.0 to 1.0)
            
        Returns:
            ID of the stored memory
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Use prepared statement for better performance and security
            cursor.execute(
                '''
                INSERT OR REPLACE INTO memories 
                (user_id, memory_type, content, embedding, importance, last_accessed)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''',
                (user_id, memory_type, content, embedding, importance)
            )
            
            conn.commit()
            
            # Invalidate any cached queries that might be affected
            self.cache_manager.invalidate_pattern(f"retrieve_memories:{user_id}")
            
            return cursor.lastrowid
    
    @db_cached(ttl=300)
    def retrieve_memories(self, user_id: str, memory_type: Optional[str] = None, 
                         limit: int = 100, offset: int = 0,
                         min_importance: float = 0.0) -> List[Dict[str, Any]]:
        """
        Retrieve memories from the database with optimized query.
        
        Args:
            user_id: User identifier
            memory_type: Type of memory to retrieve (optional)
            limit: Maximum number of memories to retrieve
            offset: Number of memories to skip
            min_importance: Minimum importance score
            
        Returns:
            List of memory dictionaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Build query based on parameters
            query = "SELECT * FROM memories WHERE user_id = ?"
            params = [user_id]
            
            if memory_type:
                query += " AND memory_type = ?"
                params.append(memory_type)
                
            if min_importance > 0:
                query += " AND importance >= ?"
                params.append(min_importance)
                
            # Add ordering and limits
            query += " ORDER BY importance DESC, last_accessed DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            # Execute optimized query
            cursor.execute(query, params)
            
            # Update last_accessed timestamp for retrieved memories
            memory_ids = [row['id'] for row in cursor.fetchall()]
            if memory_ids:
                id_placeholders = ','.join('?' for _ in memory_ids)
                cursor.execute(
                    f"UPDATE memories SET last_accessed = CURRENT_TIMESTAMP WHERE id IN ({id_placeholders})",
                    memory_ids
                )
                conn.commit()
            
            # Re-execute to get updated rows
            cursor.execute(query, params)
            
            # Convert to dictionaries
            return [dict(row) for row in cursor.fetchall()]
    
    @db_cached(ttl=300, invalidate_on_write=True)
    def update_relationship_data(self, user_id: str, relationship_type: str, 
                               trust_level: float, rapport_level: float) -> None:
        """
        Update relationship data in the database.
        
        Args:
            user_id: User identifier
            relationship_type: Type of relationship
            trust_level: Trust level (0.0 to 1.0)
            rapport_level: Rapport level (0.0 to 1.0)
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                '''
                INSERT OR REPLACE INTO relationships
                (user_id, relationship_type, trust_level, rapport_level, last_updated)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''',
                (user_id, relationship_type, trust_level, rapport_level)
            )
            
            conn.commit()
            
            # Invalidate related cache entries
            self.cache_manager.invalidate_pattern(f"get_relationship_data:{user_id}")
    
    @db_cached(ttl=600)
    def get_relationship_data(self, user_id: str, relationship_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get relationship data from the database.
        
        Args:
            user_id: User identifier
            relationship_type: Type of relationship (optional)
            
        Returns:
            List of relationship dictionaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM relationships WHERE user_id = ?"
            params = [user_id]
            
            if relationship_type:
                query += " AND relationship_type = ?"
                params.append(relationship_type)
                
            cursor.execute(query, params)
            
            return [dict(row) for row in cursor.fetchall()]
    
    @db_cached(ttl=300, invalidate_on_write=True)
    def set_user_preference(self, user_id: str, preference_key: str, preference_value: str) -> None:
        """
        Set a user preference in the database.
        
        Args:
            user_id: User identifier
            preference_key: Preference key
            preference_value: Preference value
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                '''
                INSERT OR REPLACE INTO preferences
                (user_id, preference_key, preference_value, last_updated)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ''',
                (user_id, preference_key, preference_value)
            )
            
            conn.commit()
            
            # Invalidate related cache entries
            self.cache_manager.invalidate_pattern(f"get_user_preferences:{user_id}")
    
    @db_cached(ttl=600)
    def get_user_preferences(self, user_id: str, preference_key: Optional[str] = None) -> Dict[str, str]:
        """
        Get user preferences from the database.
        
        Args:
            user_id: User identifier
            preference_key: Specific preference key to retrieve (optional)
            
        Returns:
            Dictionary of preference key-value pairs
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT preference_key, preference_value FROM preferences WHERE user_id = ?"
            params = [user_id]
            
            if preference_key:
                query += " AND preference_key = ?"
                params.append(preference_key)
                
            cursor.execute(query, params)
            
            return {row['preference_key']: row['preference_value'] for row in cursor.fetchall()}
    
    def optimize_database(self) -> None:
        """
        Perform database optimization operations.
        
        This includes:
        - Analyzing tables for better query planning
        - Rebuilding indexes for optimal performance
        - Vacuuming to reclaim unused space
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Analyze tables for better query planning
            cursor.execute("ANALYZE")
            
            # Rebuild indexes
            cursor.execute("REINDEX")
            
            # Vacuum to reclaim space and defragment
            cursor.execute("VACUUM")
            
            conn.commit()
            
            logger.info("Database optimization completed")
    
    def batch_operation(self, operations: List[Tuple[str, List[Any]]]) -> None:
        """
        Execute multiple operations in a single transaction for better performance.
        
        Args:
            operations: List of (query, params) tuples
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            for query, params in operations:
                cursor.execute(query, params)
                
            conn.commit()
            
            # Clear all cache after batch operations as they could affect multiple queries
            self.cache_manager.invalidate_all()
    
    def close(self) -> None:
        """Close all database connections in the pool."""
        with self.pool_lock:
            for conn in self.pool:
                try:
                    conn.close()
                except Exception:
                    pass
            self.pool = []
