"""
Memory Storage System for ALEJO
Provides persistent storage and efficient retrieval for all memory types.
"""

import asyncio
import json
import sqlite3
import numpy as np
from typing import Dict, List, Optional, Any
import logging
from pathlib import Path
from dataclasses import asdict
from ..models.memory_models import Episode, Concept, Relationship

logger = logging.getLogger(__name__)

class MemoryStore:
    """
    Manages persistent storage for all memory types with features for AGI:
    - Efficient storage and retrieval
    - Vector similarity search
    - Transaction support
    - Automatic indexing
    - Backup and recovery
    """
    
    def __init__(self, db_path: str = "alejo_memory.db"):
        self.db_path = db_path
        self.connection = None
        self.setup_complete = False
        
    async def initialize(self):
        """Initialize the database and create necessary tables"""
        try:
            # Ensure directory exists
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Connect to database
            self.connection = sqlite3.connect(self.db_path)
            
            # Create tables if they don't exist
            await self._create_tables()
            
            self.setup_complete = True
            logger.info("Memory store initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize memory store: {str(e)}")
            raise
            
    async def _create_tables(self):
        """Create necessary database tables"""
        cursor = self.connection.cursor()
        
        # Episodic memory table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS episodic_memories (
                id TEXT PRIMARY KEY,
                content TEXT,
                context TEXT,
                emotions TEXT,
                timestamp REAL,
                importance REAL,
                tags TEXT,
                connections TEXT
            )
        """)
        
        # Semantic memory tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS concepts (
                name TEXT PRIMARY KEY,
                attributes TEXT,
                relationships TEXT,
                confidence REAL,
                source TEXT,
                last_updated REAL,
                embedding BLOB
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                type TEXT,
                source_concept TEXT,
                target_concept TEXT,
                attributes TEXT,
                confidence REAL,
                bidirectional INTEGER,
                FOREIGN KEY(source_concept) REFERENCES concepts(name),
                FOREIGN KEY(target_concept) REFERENCES concepts(name)
            )
        """)
        
        # Create indices for better query performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_memories(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_concepts_confidence ON concepts(confidence)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)")
        
        self.connection.commit()
        
    async def save_episode(self, episode: Episode) -> str:
        """Save an episodic memory"""
        try:
            cursor = self.connection.cursor()
            
            # Generate unique ID
            episode_id = f"ep_{episode.timestamp}_{hash(str(episode.content))}"
            
            # Convert complex objects to JSON strings
            episode_data = {
                'id': episode_id,
                'content': json.dumps(episode.content),
                'context': json.dumps(episode.context),
                'emotions': json.dumps(episode.emotions),
                'timestamp': episode.timestamp,
                'importance': episode.importance,
                'tags': json.dumps(episode.tags),
                'connections': json.dumps(episode.connections)
            }
            
            # Insert or update
            cursor.execute("""
                INSERT OR REPLACE INTO episodic_memories
                (id, content, context, emotions, timestamp, importance, tags, connections)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, tuple(episode_data.values()))
            
            self.connection.commit()
            return episode_id
            
        except Exception as e:
            logger.error(f"Failed to save episode: {str(e)}")
            raise
            
    async def get_episode(self, episode_id: str) -> Optional[Episode]:
        """Retrieve a specific episodic memory"""
        try:
            cursor = self.connection.cursor()
            
            cursor.execute(
                "SELECT * FROM episodic_memories WHERE id = ?",
                (episode_id,)
            )
            row = cursor.fetchone()
            
            if row:
                return self._row_to_episode(row)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve episode: {str(e)}")
            raise
            
    async def get_recent_episodes(self, limit: int = 100) -> List[Episode]:
        """Get most recent episodic memories"""
        try:
            cursor = self.connection.cursor()
            
            cursor.execute(
                "SELECT * FROM episodic_memories ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            
            return [self._row_to_episode(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Failed to retrieve recent episodes: {str(e)}")
            raise
            
    async def save_concept(self, concept: Concept) -> str:
        """Save a semantic concept"""
        try:
            cursor = self.connection.cursor()
            
            concept_data = {
                'name': concept.name,
                'attributes': json.dumps(concept.attributes),
                'relationships': json.dumps(concept.relationships),
                'confidence': concept.confidence,
                'source': concept.source,
                'last_updated': concept.last_updated,
                'embedding': concept.embedding.tobytes()
            }
            
            cursor.execute("""
                INSERT OR REPLACE INTO concepts
                (name, attributes, relationships, confidence, source, last_updated, embedding)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, tuple(concept_data.values()))
            
            self.connection.commit()
            return concept.name
            
        except Exception as e:
            logger.error(f"Failed to save concept: {str(e)}")
            raise
            
    async def get_concept(self, name: str) -> Optional[Concept]:
        """Retrieve a specific concept"""
        try:
            cursor = self.connection.cursor()
            
            cursor.execute(
                "SELECT * FROM concepts WHERE name = ?",
                (name,)
            )
            row = cursor.fetchone()
            
            if row:
                return self._row_to_concept(row)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve concept: {str(e)}")
            raise
            
    async def save_relationship(self, relationship: Relationship) -> str:
        """Save a semantic relationship"""
        try:
            cursor = self.connection.cursor()
            
            # Generate unique ID
            rel_id = f"rel_{relationship.type}_{relationship.source_concept}_{relationship.target_concept}"
            
            rel_data = {
                'id': rel_id,
                'type': relationship.type,
                'source_concept': relationship.source_concept,
                'target_concept': relationship.target_concept,
                'attributes': json.dumps(relationship.attributes),
                'confidence': relationship.confidence,
                'bidirectional': 1 if relationship.bidirectional else 0
            }
            
            cursor.execute("""
                INSERT OR REPLACE INTO relationships
                (id, type, source_concept, target_concept, attributes, confidence, bidirectional)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, tuple(rel_data.values()))
            
            self.connection.commit()
            return rel_id
            
        except Exception as e:
            logger.error(f"Failed to save relationship: {str(e)}")
            raise
            
    def _row_to_episode(self, row) -> Episode:
        """Convert database row to Episode object"""
        return Episode(
            content=json.loads(row[1]),
            context=json.loads(row[2]),
            emotions=json.loads(row[3]),
            timestamp=row[4],
            importance=row[5],
            tags=json.loads(row[6]),
            connections=json.loads(row[7])
        )
        
    def _row_to_concept(self, row) -> Concept:
        """Convert database row to Concept object"""
        return Concept(
            name=row[0],
            attributes=json.loads(row[1]),
            relationships=json.loads(row[2]),
            confidence=row[3],
            source=row[4],
            last_updated=row[5],
            embedding=np.frombuffer(row[6])
        )
        
    async def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
            self.setup_complete = False
