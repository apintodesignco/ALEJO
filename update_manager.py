#!/usr/bin/env python3
"""
ALEJO Update Manager
Automatically checks for and applies updates before ALEJO starts.
"""

import os
import sys
import json
import time
import logging
import subprocess
import tempfile
import shutil
from pathlib import Path
import urllib.request
import urllib.error
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("alejo_update.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("alejo.update_manager")

class UpdateManager:
    """
    Manages automatic updates for ALEJO system
    
    This class checks for updates from the main repository and applies them
    if available, ensuring users always have the latest security fixes and features.
    """
    
    def __init__(self, config=None):
        """
        Initialize the Update Manager
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        self.repo_url = self.config.get("repo_url", "https://github.com/apintodesignco/ALEJO.git")
        self.branch = self.config.get("branch", "main")
        self.alejo_dir = Path(os.path.dirname(os.path.abspath(__file__)))
        self.update_cache_file = self.alejo_dir / ".update_cache"
        self.update_lock_file = self.alejo_dir / ".update_lock"
        self.check_interval = self.config.get("check_interval_hours", 4)  # Check every 4 hours by default
        self.force_update = self.config.get("force_update", False)
        
    def should_check_for_updates(self):
        """
        Determine if we should check for updates based on last check time
        
        Returns:
            bool: True if we should check, False otherwise
        """
        if self.force_update:
            return True
            
        if not self.update_cache_file.exists():
            return True
            
        try:
            with open(self.update_cache_file, "r") as f:
                cache = json.load(f)
                last_check = datetime.fromisoformat(cache.get("last_check", "2000-01-01T00:00:00"))
                now = datetime.now()
                
                if now - last_check > timedelta(hours=self.check_interval):
                    return True
                    
                return False
        except (json.JSONDecodeError, ValueError, IOError):
            return True
    
    def update_check_cache(self, update_available=False, version=None):
        """Update the cache file with current check information"""
        cache = {
            "last_check": datetime.now().isoformat(),
            "update_available": update_available,
            "current_version": version or "unknown"
        }
        
        with open(self.update_cache_file, "w") as f:
            json.dump(cache, f)
    
    def is_git_repo(self):
        """Check if the current directory is a git repository"""
        return (self.alejo_dir / ".git").exists()
    
    def check_for_updates(self):
        """
        Check if updates are available
        
        Returns:
            tuple: (update_available, current_version, latest_version)
        """
        if not self.is_git_repo():
            logger.warning("Not a git repository, cannot check for updates")
            return False, "unknown", "unknown"
            
        try:
            # Create a lock file to prevent concurrent update checks
            if self.update_lock_file.exists():
                # If lock file is older than 10 minutes, it's probably stale
                if time.time() - os.path.getmtime(self.update_lock_file) > 600:
                    os.remove(self.update_lock_file)
                else:
                    logger.info("Update check already in progress, skipping")
                    return False, "unknown", "unknown"
                    
            with open(self.update_lock_file, "w") as f:
                f.write(str(time.time()))
            
            # Get current commit hash
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.alejo_dir,
                capture_output=True,
                text=True
            )
            current_version = result.stdout.strip()
            
            # Fetch from remote
            subprocess.run(
                ["git", "fetch", "origin", self.branch],
                cwd=self.alejo_dir,
                capture_output=True
            )
            
            # Get latest commit hash
            result = subprocess.run(
                ["git", "rev-parse", f"origin/{self.branch}"],
                cwd=self.alejo_dir,
                capture_output=True,
                text=True
            )
            latest_version = result.stdout.strip()
            
            update_available = current_version != latest_version
            self.update_check_cache(update_available, current_version)
            
            return update_available, current_version, latest_version
            
        except Exception as e:
            logger.error(f"Error checking for updates: {str(e)}")
            return False, "unknown", "unknown"
        finally:
            # Always remove the lock file
            if self.update_lock_file.exists():
                os.remove(self.update_lock_file)
    
    def backup_current_version(self):
        """Create a backup of the current ALEJO installation"""
        backup_dir = tempfile.mkdtemp(prefix="alejo_backup_")
        logger.info(f"Backing up current ALEJO installation to {backup_dir}")
        
        try:
            # Copy all files except .git directory
            for item in self.alejo_dir.glob("*"):
                if item.name == ".git" or item.name.startswith("venv"):
                    continue
                    
                if item.is_dir():
                    shutil.copytree(item, Path(backup_dir) / item.name)
                else:
                    shutil.copy2(item, Path(backup_dir) / item.name)
                    
            return backup_dir
        except Exception as e:
            logger.error(f"Error backing up ALEJO: {str(e)}")
            return None
    
    def apply_update(self):
        """
        Apply available updates
        
        Returns:
            bool: True if update was successful, False otherwise
        """
        if not self.is_git_repo():
            logger.warning("Not a git repository, cannot apply updates")
            return False
            
        # Backup current version
        backup_dir = self.backup_current_version()
        if not backup_dir:
            return False
            
        try:
            # Pull the latest changes
            logger.info("Pulling latest changes from repository")
            result = subprocess.run(
                ["git", "pull", "origin", self.branch],
                cwd=self.alejo_dir,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Error pulling updates: {result.stderr}")
                self.restore_backup(backup_dir)
                return False
                
            # Check for dependency changes
            requirements_file = self.alejo_dir / "requirements.txt"
            if requirements_file.exists():
                logger.info("Updating dependencies")
                result = subprocess.run(
                    [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                    cwd=self.alejo_dir,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    logger.warning(f"Error updating dependencies: {result.stderr}")
                    # Continue anyway, as this might not be critical
            
            # Update database schema if needed
            self.update_database_schema()
            
            logger.info("Update completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error applying update: {str(e)}")
            self.restore_backup(backup_dir)
            return False
            
    def restore_backup(self, backup_dir):
        """Restore ALEJO from backup in case of update failure"""
        if not backup_dir or not os.path.exists(backup_dir):
            return
            
        logger.info(f"Restoring ALEJO from backup {backup_dir}")
        
        try:
            # Remove all files except .git directory
            for item in self.alejo_dir.glob("*"):
                if item.name == ".git" or item.name.startswith("venv"):
                    continue
                    
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    os.remove(item)
                    
            # Copy all files from backup
            for item in Path(backup_dir).glob("*"):
                if item.is_dir():
                    shutil.copytree(item, self.alejo_dir / item.name)
                else:
                    shutil.copy2(item, self.alejo_dir / item.name)
                    
            logger.info("Restore completed successfully")
            
        except Exception as e:
            logger.error(f"Error restoring backup: {str(e)}")
    
    def update_database_schema(self):
        """Update database schema if necessary"""
        # This would typically check for migration scripts and run them
        # For now, we'll just check if there's a migrate.py script and run it
        migrate_script = self.alejo_dir / "migrate.py"
        if migrate_script.exists():
            logger.info("Running database migration script")
            try:
                subprocess.run(
                    [sys.executable, "migrate.py"],
                    cwd=self.alejo_dir,
                    capture_output=True,
                    text=True
                )
            except Exception as e:
                logger.warning(f"Error running migration script: {str(e)}")
    
    def run_update_check(self, auto_apply=True):
        """
        Run a full update check and optionally apply updates
        
        Args:
            auto_apply: Whether to automatically apply updates if available
            
        Returns:
            bool: True if system is up to date, False if update failed
        """
        if not self.should_check_for_updates():
            logger.info("Update check was performed recently, skipping")
            return True
            
        logger.info("Checking for ALEJO updates")
        update_available, current_version, latest_version = self.check_for_updates()
        
        if update_available:
            logger.info(f"Update available: {current_version[:7]} -> {latest_version[:7]}")
            
            if auto_apply:
                logger.info("Applying update automatically")
                return self.apply_update()
            else:
                logger.info("Update available but not applying automatically")
                return True
        else:
            logger.info("ALEJO is up to date")
            return True

def main():
    """Main entry point when script is run directly"""
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="ALEJO Update Manager")
    parser.add_argument("--check-only", action="store_true", help="Only check for updates, don't apply them")
    parser.add_argument("--force", action="store_true", help="Force update check even if done recently")
    args = parser.parse_args()
    
    # Create update manager
    config = {"force_update": args.force}
    update_manager = UpdateManager(config)
    
    # Run update check
    update_manager.run_update_check(auto_apply=not args.check_only)

if __name__ == "__main__":
    main()