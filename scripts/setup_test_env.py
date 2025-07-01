"""
Test Environment Setup Script
Prepares the environment for ALEJO integration testing
"""

import os
import logging
from pathlib import Path
import subprocess
import sys
import shutil
import time

logger = logging.getLogger(__name__)

class TestEnvironmentSetup:
    """Sets up test environment for ALEJO services"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.data_dir = self.project_root / 'data'
        
    def setup(self):
        """Run full environment setup"""
        self.setup_directories()
        self.setup_redis()
        self.setup_sqlite()
        self.setup_test_config()
        
    def setup_directories(self):
        """Create necessary directories"""
        dirs = [
            self.data_dir,
            self.data_dir / 'memory',
            self.data_dir / 'emotional',
            self.data_dir / 'brain',
            self.data_dir / 'voice',
            self.data_dir / 'vision',
            self.data_dir / 'training',
            self.project_root / 'tests' / 'integration' / 'reports'
        ]
        
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")
            
    def setup_redis(self):
        """Setup Redis for testing"""
        try:
            # Check if Redis is running
            subprocess.run(['redis-cli', 'ping'], check=True, capture_output=True)
            logger.info("Redis is already running")
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.info("Starting Redis server...")
            
            if os.name == 'nt':  # Windows
                # Start Redis using Windows Subsystem for Linux
                subprocess.Popen(['wsl', 'redis-server'])
            else:
                # Start Redis directly on Unix
                subprocess.Popen(['redis-server'])
                
            # Wait for Redis to start
            time.sleep(2)
            logger.info("Redis server started")
            
    def setup_sqlite(self):
        """Setup SQLite databases"""
        db_files = {
            'memory': self.data_dir / 'memory' / 'alejo_memory.db',
            'emotional': self.data_dir / 'emotional' / 'emotional_memory.db',
            'brain': self.data_dir / 'brain' / 'brain_state.db'
        }
        
        for name, db_path in db_files.items():
            if db_path.exists():
                # Backup existing database
                backup_path = db_path.with_suffix('.db.bak')
                shutil.copy2(db_path, backup_path)
                logger.info(f"Backed up existing {name} database")
                
            # Create empty database
            db_path.touch()
            logger.info(f"Created {name} database at {db_path}")
            
    def setup_test_config(self):
        """Update test configuration"""
        config_path = self.project_root / 'tests' / 'integration' / 'test_config.json'
        if not config_path.exists():
            logger.error("Test config not found")
            return
            
        # Update database paths in config
        try:
            import json
            with open(config_path) as f:
                config = json.load(f)
                
            config['services']['memory']['db_path'] = str(self.data_dir / 'memory' / 'alejo_memory.db')
            config['services']['emotional']['db_path'] = str(self.data_dir / 'emotional' / 'emotional_memory.db')
            config['services']['brain']['db_path'] = str(self.data_dir / 'brain' / 'brain_state.db')
            
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
                
            logger.info("Updated test configuration")
            
        except Exception as e:
            logger.error(f"Error updating test config: {e}")

def main():
    """Main entry point"""
    logging.basicConfig(level=logging.INFO)
    
    setup = TestEnvironmentSetup()
    setup.setup()
    logger.info("Test environment setup complete")

if __name__ == '__main__':
    main()