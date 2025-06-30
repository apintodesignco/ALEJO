"""
Collective Data Manager for ALEJO
Manages storage, retrieval, and synchronization of collective learning data using GitHub
as the central repository for collective intelligence.
"""

import logging
import json
import asyncio
import os
import subprocess
import base64
import hashlib
import tempfile
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime
from pathlib import Path
import sqlite3
import aiosqlite
import uuid
import aiohttp
import re

from ..core.config_manager import ConfigManager
from ..utils.exceptions import DataManagerError

logger = logging.getLogger("alejo.collective.data_manager")

class CollectiveDataManager:
    """
    Manages data for the collective learning system using GitHub as the central repository
    
    Responsibilities:
    - Store and retrieve insights using GitHub as the cloud storage
    - Manage local cache of collective data
    - Handle data synchronization with GitHub
    - Implement data retention and security policies
    - Ensure all data is properly anonymized before storage
    """
    
    def __init__(self, config_manager: ConfigManager):
        """Initialize data manager"""
        self.config_manager = config_manager
        self.data_dir = Path(config_manager.get_data_dir()) / "collective"
        self.data_dir.mkdir(exist_ok=True)
        
        self.db_path = self.data_dir / "collective_data.db"
        self.insights_path = self.data_dir / "insights"
        self.insights_path.mkdir(exist_ok=True)
        self.improvements_path = self.data_dir / "improvements"
        self.improvements_path.mkdir(exist_ok=True)
        
        # GitHub configuration
        github_config = self.config_manager.get_config("github", {})
        self.github_enabled = github_config.get("enabled", False)
        self.github_repo = github_config.get("repo", "")
        self.github_branch = github_config.get("branch", "collective-learning")
        self.github_token = github_config.get("token", "")
        self.github_insights_path = github_config.get("insights_path", "data/collective/insights")
        self.github_improvements_path = github_config.get("improvements_path", "data/collective/improvements")
        
        # Initialize local database for caching
        self._initialize_database()
        
    def _initialize_database(self):
        """Initialize SQLite database for collective data"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Create insights table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS insights (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                pattern_type TEXT NOT NULL,
                features TEXT NOT NULL,
                confidence REAL NOT NULL,
                creation_timestamp TEXT NOT NULL,
                metadata TEXT,
                source_hash TEXT NOT NULL,
                submitted INTEGER DEFAULT 0,
                submission_timestamp TEXT
            )
            ''')
            
            # Create improvements table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS improvements (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                module TEXT NOT NULL,
                description TEXT NOT NULL,
                data TEXT NOT NULL,
                version TEXT NOT NULL,
                creation_timestamp TEXT NOT NULL,
                applied INTEGER DEFAULT 0,
                application_timestamp TEXT
            )
            ''')
            
            # Create modules table to track module versions
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS module_versions (
                module TEXT PRIMARY KEY,
                version TEXT NOT NULL,
                last_updated TEXT NOT NULL
            )
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info("Collective data database initialized")
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
    
    async def _github_api_request(self, method: str, url: str, data: Optional[Dict] = None) -> Dict:
        """Make a GitHub API request
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            url: API endpoint URL
            data: Optional request data
            
        Returns:
            Response data as dictionary
        """
        if not self.github_enabled or not self.github_token:
            raise DataManagerError("GitHub integration is not enabled or configured")
            
        headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        base_url = "https://api.github.com"
        full_url = f"{base_url}/{url}" if not url.startswith("http") else url
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(method, full_url, headers=headers, json=data) as response:
                    response_data = await response.json()
                    
                    if response.status >= 400:
                        logger.error(f"GitHub API error: {response.status} - {response_data.get('message', 'Unknown error')}")
                        raise DataManagerError(f"GitHub API error: {response.status} - {response_data.get('message', 'Unknown error')}")
                        
                    return response_data
        except aiohttp.ClientError as e:
            logger.error(f"GitHub API request error: {e}")
            raise DataManagerError(f"GitHub API request error: {e}")
    
    async def _get_github_file(self, path: str) -> Tuple[Optional[str], Optional[str]]:
        """Get a file from GitHub
        
        Args:
            path: File path in the repository
            
        Returns:
            Tuple of (file content, SHA) or (None, None) if not found
        """
        try:
            url = f"repos/{self.github_repo}/contents/{path}?ref={self.github_branch}"
            response = await self._github_api_request("GET", url)
            
            if response and "content" in response:
                content = base64.b64decode(response["content"]).decode("utf-8")
                return content, response.get("sha")
                
            return None, None
        except DataManagerError:
            # File might not exist yet
            return None, None
        except Exception as e:
            logger.error(f"Error getting GitHub file {path}: {e}")
            return None, None
    
    async def _create_or_update_github_file(self, path: str, content: str, message: str, sha: Optional[str] = None) -> bool:
        """Create or update a file on GitHub
        
        Args:
            path: File path in the repository
            content: File content
            message: Commit message
            sha: SHA of the file if updating, None if creating
            
        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"repos/{self.github_repo}/contents/{path}"
            
            data = {
                "message": message,
                "content": base64.b64encode(content.encode()).decode(),
                "branch": self.github_branch
            }
            
            if sha:
                data["sha"] = sha
                
            await self._github_api_request("PUT", url, data)
            return True
        except Exception as e:
            logger.error(f"Error creating/updating GitHub file {path}: {e}")
            return False
    
    async def _ensure_branch_exists(self) -> bool:
        """Ensure the collective learning branch exists
        
        Returns:
            True if branch exists or was created, False otherwise
        """
        try:
            # Check if branch exists
            url = f"repos/{self.github_repo}/branches/{self.github_branch}"
            try:
                await self._github_api_request("GET", url)
                return True  # Branch exists
            except DataManagerError:
                # Branch doesn't exist, create it
                pass
                
            # Get default branch SHA
            url = f"repos/{self.github_repo}"
            repo_info = await self._github_api_request("GET", url)
            default_branch = repo_info.get("default_branch", "main")
            
            # Get the SHA of the latest commit on the default branch
            url = f"repos/{self.github_repo}/git/refs/heads/{default_branch}"
            ref_data = await self._github_api_request("GET", url)
            sha = ref_data["object"]["sha"]
            
            # Create new branch
            url = f"repos/{self.github_repo}/git/refs"
            data = {
                "ref": f"refs/heads/{self.github_branch}",
                "sha": sha
            }
            await self._github_api_request("POST", url, data)
            
            return True
        except Exception as e:
            logger.error(f"Error ensuring branch exists: {e}")
            return False
    
    async def store_insights(self, insights: List[Any]) -> bool:
        """
        Store insights in the local database and GitHub if enabled
        
        Args:
            insights: List of insights to store
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # First store in local database for caching
            async with aiosqlite.connect(str(self.db_path)) as db:
                for insight in insights:
                    # Convert insight to dict if it's not already
                    if hasattr(insight, '__dict__'):
                        data = insight.__dict__
                    else:
                        data = insight
                    
                    # Ensure we have an insight_id
                    insight_id = data.get('insight_id', str(uuid.uuid4()))
                    
                    # Convert complex objects to JSON
                    features = json.dumps(data.get('features', {}))
                    metadata = json.dumps(data.get('metadata', {}))
                    
                    # Get timestamp
                    timestamp = data.get('creation_timestamp')
                    if isinstance(timestamp, datetime):
                        timestamp = timestamp.isoformat()
                    
                    await db.execute(
                        '''
                        INSERT OR REPLACE INTO insights 
                        (id, category, pattern_type, features, confidence, creation_timestamp, metadata, source_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''',
                        (
                            insight_id,
                            data.get('category', 'unknown'),
                            data.get('pattern_type', 'unknown'),
                            features,
                            data.get('confidence', 0.0),
                            timestamp,
                            metadata,
                            data.get('source_hash', '')
                        )
                    )
                
                await db.commit()
            
            # If GitHub is enabled, also store there
            if self.github_enabled and self.github_token and self.github_repo:
                await self._store_insights_to_github(insights)
                
            logger.info(f"Stored {len(insights)} insights")
            return True
        except Exception as e:
            logger.error(f"Error storing insights: {e}")
            return False
            
    async def _store_insights_to_github(self, insights: List[Any]) -> bool:
        """
        Store insights to GitHub repository
        
        Args:
            insights: List of insights to store
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Ensure the branch exists
            if not await self._ensure_branch_exists():
                logger.error("Failed to ensure GitHub branch exists")
                return False
                
            # Group insights by category for better organization
            insights_by_category = {}
            for insight in insights:
                # Convert insight to dict if it's not already
                if hasattr(insight, '__dict__'):
                    data = insight.__dict__
                else:
                    data = insight
                    
                category = data.get('category', 'unknown')
                if category not in insights_by_category:
                    insights_by_category[category] = []
                    
                insights_by_category[category].append(data)
                
            # Store each category in its own file
            for category, category_insights in insights_by_category.items():
                # Generate a timestamp-based filename
                timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                filename = f"{category}-{timestamp}.json"
                path = f"{self.github_insights_path}/{category}/{filename}"
                
                # Create directory structure if needed
                directory = f"{self.github_insights_path}/{category}"
                await self._ensure_directory_exists(directory)
                
                # Anonymize insights before storing
                anonymized_insights = self._anonymize_insights(category_insights)
                
                # Convert to JSON and store
                content = json.dumps(anonymized_insights, indent=2)
                message = f"Add {len(anonymized_insights)} {category} insights from collective learning"
                
                if not await self._create_or_update_github_file(path, content, message):
                    logger.error(f"Failed to store {category} insights to GitHub")
                    return False
                    
            return True
        except Exception as e:
            logger.error(f"Error storing insights to GitHub: {e}")
            return False
            
    async def _ensure_directory_exists(self, directory_path: str) -> bool:
        """
        Ensure a directory exists in the GitHub repository
        
        Args:
            directory_path: Directory path to ensure exists
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if directory exists by trying to list its contents
            url = f"repos/{self.github_repo}/contents/{directory_path}?ref={self.github_branch}"
            try:
                await self._github_api_request("GET", url)
                return True  # Directory exists
            except DataManagerError:
                # Directory doesn't exist, create it with a .gitkeep file
                pass
                
            # Create .gitkeep file to create the directory
            path = f"{directory_path}/.gitkeep"
            message = f"Create directory structure for {directory_path}"
            return await self._create_or_update_github_file(path, "", message)
        except Exception as e:
            logger.error(f"Error ensuring directory exists: {e}")
            return False
            
    def _anonymize_insights(self, insights: List[Dict]) -> List[Dict]:
        """
        Anonymize insights before storing to GitHub
        
        Args:
            insights: List of insights to anonymize
            
        Returns:
            List of anonymized insights
        """
        anonymized = []
        for insight in insights:
            # Create a copy to avoid modifying the original
            anon_insight = insight.copy()
            
            # Remove any personally identifiable information
            if 'user_id' in anon_insight:
                # Replace with a hash to maintain consistency but remove identifiability
                anon_insight['user_id'] = hashlib.sha256(str(anon_insight['user_id']).encode()).hexdigest()[:16]
                
            if 'metadata' in anon_insight and isinstance(anon_insight['metadata'], dict):
                # Remove sensitive metadata fields
                for field in ['ip_address', 'email', 'name', 'location', 'device_id']:
                    if field in anon_insight['metadata']:
                        del anon_insight['metadata'][field]
            
            # Sanitize any content fields that might contain PII
            if 'content' in anon_insight and isinstance(anon_insight['content'], str):
                # Remove email addresses
                anon_insight['content'] = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', anon_insight['content'])
                # Remove phone numbers
                anon_insight['content'] = re.sub(r'\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b', '[PHONE]', anon_insight['content'])
                
            anonymized.append(anon_insight)
            
        return anonymized
    
    async def mark_insights_submitted(self, insights: List[Any]) -> bool:
        """
        Mark insights as submitted
        
        Args:
            insights: List of insights to mark
            
        Returns:
            True if successful, False otherwise
        """
        try:
            insight_ids = []
            for insight in insights:
                if hasattr(insight, 'insight_id'):
                    insight_ids.append(insight.insight_id)
                elif isinstance(insight, dict) and 'insight_id' in insight:
                    insight_ids.append(insight['insight_id'])
            
            if not insight_ids:
                return False
                
            timestamp = datetime.now().isoformat()
            
            async with aiosqlite.connect(str(self.db_path)) as db:
                placeholders = ','.join(['?' for _ in insight_ids])
                await db.execute(
                    f'''
                    UPDATE insights 
                    SET submitted = 1, submission_timestamp = ?
                    WHERE id IN ({placeholders})
                    ''',
                    [timestamp] + insight_ids
                )
                
                await db.commit()
                
            logger.info(f"Marked {len(insight_ids)} insights as submitted")
            return True
        except Exception as e:
            logger.error(f"Error marking insights as submitted: {e}")
            return False
    
    async def get_unsubmitted_insights(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get insights that haven't been submitted yet
        
        Args:
            limit: Maximum number of insights to return
            
        Returns:
            List of unsubmitted insights
        """
        insights = []
        try:
            async with aiosqlite.connect(str(self.db_path)) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    '''
                    SELECT * FROM insights
                    WHERE submitted = 0
                    ORDER BY creation_timestamp
                    LIMIT ?
                    ''',
                    (limit,)
                ) as cursor:
                    async for row in cursor:
                        insight = dict(row)
                        
                        # Parse JSON fields
                        insight['features'] = json.loads(insight['features'])
                        insight['metadata'] = json.loads(insight['metadata'])
                        
                        insights.append(insight)
                        
            logger.info(f"Retrieved {len(insights)} unsubmitted insights")
            return insights
        except Exception as e:
            logger.error(f"Error getting unsubmitted insights: {e}")
            return []
    
    async def store_improvement(self, improvement: Dict[str, Any]) -> bool:
        """
        Store an improvement in the database
        
        Args:
            improvement: Improvement data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Ensure we have an ID
            improvement_id = improvement.get('id', str(uuid.uuid4()))
            
            # Convert data to JSON
            data = json.dumps(improvement.get('data', {}))
            
            # Get timestamp
            timestamp = improvement.get('creation_timestamp')
            if isinstance(timestamp, datetime):
                timestamp = timestamp.isoformat()
            elif not timestamp:
                timestamp = datetime.now().isoformat()
            
            async with aiosqlite.connect(str(self.db_path)) as db:
                await db.execute(
                    '''
                    INSERT OR REPLACE INTO improvements 
                    (id, type, module, description, data, version, creation_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        improvement_id,
                        improvement.get('type', 'unknown'),
                        improvement.get('module', 'unknown'),
                        improvement.get('description', ''),
                        data,
                        improvement.get('version', '0.0.1'),
                        timestamp
                    )
                )
                
                await db.commit()
                
            # Also save as JSON file for backup
            file_path = self.improvements_path / f"{improvement_id}.json"
            with open(file_path, 'w') as f:
                json.dump(improvement, f, indent=2)
                
            logger.info(f"Stored improvement {improvement_id}")
            return True
        except Exception as e:
            logger.error(f"Error storing improvement: {e}")
            return False
    
    async def get_available_improvements(self) -> List[Dict[str, Any]]:
        """
        Get improvements that haven't been applied yet
        
        Returns:
            List of available improvements
        """
        improvements = []
        try:
            async with aiosqlite.connect(str(self.db_path)) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    '''
                    SELECT * FROM improvements
                    WHERE applied = 0
                    ORDER BY creation_timestamp
                    '''
                ) as cursor:
                    async for row in cursor:
                        improvement = dict(row)
                        
                        # Parse JSON fields
                        improvement['data'] = json.loads(improvement['data'])
                        
                        improvements.append(improvement)
                        
            logger.info(f"Retrieved {len(improvements)} available improvements")
            return improvements
        except Exception as e:
            logger.error(f"Error getting available improvements: {e}")
            return []
    
    async def mark_improvement_applied(self, improvement_id: str) -> bool:
        """
        Mark an improvement as applied
        
        Args:
            improvement_id: ID of the improvement
            
        Returns:
            True if successful, False otherwise
        """
        try:
            timestamp = datetime.now().isoformat()
            
            async with aiosqlite.connect(str(self.db_path)) as db:
                await db.execute(
                    '''
                    UPDATE improvements 
                    SET applied = 1, application_timestamp = ?
                    WHERE id = ?
                    ''',
                    (timestamp, improvement_id)
                )
                
                await db.commit()
                
            logger.info(f"Marked improvement {improvement_id} as applied")
            return True
        except Exception as e:
            logger.error(f"Error marking improvement as applied: {e}")
            return False
    
    async def update_module_version(self, module: str, version: str) -> bool:
        """
        Update the version of a module
        
        Args:
            module: Module name
            version: New version
            
        Returns:
            True if successful, False otherwise
        """
        try:
            timestamp = datetime.now().isoformat()
            
            async with aiosqlite.connect(str(self.db_path)) as db:
                await db.execute(
                    '''
                    INSERT OR REPLACE INTO module_versions 
                    (module, version, last_updated)
                    VALUES (?, ?, ?)
                    ''',
                    (module, version, timestamp)
                )
                
                await db.commit()
                
            logger.info(f"Updated module {module} to version {version}")
            return True
        except Exception as e:
            logger.error(f"Error updating module version: {e}")
            return False
    
    async def get_module_version(self, module: str) -> Optional[str]:
        """
        Get the current version of a module
        
        Args:
            module: Module name
            
        Returns:
            Module version or None if not found
        """
        try:
            async with aiosqlite.connect(str(self.db_path)) as db:
                async with db.execute(
                    '''
                    SELECT version FROM module_versions
                    WHERE module = ?
                    ''',
                    (module,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return row[0]
                    return None
        except Exception as e:
            logger.error(f"Error getting module version: {e}")
            return None
