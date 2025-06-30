"""
User Preferences Service for ALEJO

This module provides functionality to store and retrieve user preferences
such as favorite music, images, and other personalization options.
"""

import os
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, List, Union
import threading

logger = logging.getLogger(__name__)

class UserPreferences:
    """
    Manages user preferences for ALEJO
    """
    
    def __init__(self, preferences_file: Optional[str] = None):
        """
        Initialize the user preferences manager
        
        Args:
            preferences_file: Path to the preferences file, or None to use default
        """
        if preferences_file is None:
            # Use default location in user's home directory
            self.preferences_dir = Path(os.path.expanduser("~")) / ".alejo"
            self.preferences_file = self.preferences_dir / "preferences.json"
        else:
            self.preferences_file = Path(preferences_file)
            self.preferences_dir = self.preferences_file.parent
        
        # Create directory if it doesn't exist
        os.makedirs(self.preferences_dir, exist_ok=True)
        
        # Load preferences
        self.preferences = {}
        self._lock = threading.RLock()
        self._load_preferences()
    
    def _load_preferences(self):
        """Load preferences from file"""
        try:
            if self.preferences_file.exists():
                with open(self.preferences_file, "r") as f:
                    self.preferences = json.load(f)
                logger.info(f"Loaded preferences from {self.preferences_file}")
            else:
                logger.info(f"No preferences file found at {self.preferences_file}, using defaults")
                self.preferences = {
                    "theme": "auto",
                    "notifications_enabled": True,
                    "comfort_responses_enabled": True,
                    "favorite_music": "",
                    "favorite_images": "",
                    "comfort_threshold": 0.65,
                    "comfort_cooldown": 300  # 5 minutes
                }
                # Save default preferences
                self._save_preferences()
        except Exception as e:
            logger.error(f"Error loading preferences: {e}")
            # Use default preferences
            self.preferences = {
                "theme": "auto",
                "notifications_enabled": True,
                "comfort_responses_enabled": True,
                "favorite_music": "",
                "favorite_images": "",
                "comfort_threshold": 0.65,
                "comfort_cooldown": 300  # 5 minutes
            }
    
    def _save_preferences(self):
        """Save preferences to file"""
        try:
            with open(self.preferences_file, "w") as f:
                json.dump(self.preferences, f, indent=2)
            logger.info(f"Saved preferences to {self.preferences_file}")
        except Exception as e:
            logger.error(f"Error saving preferences: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a preference value
        
        Args:
            key: Preference key
            default: Default value if key doesn't exist
            
        Returns:
            The preference value or default
        """
        with self._lock:
            return self.preferences.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """
        Set a preference value
        
        Args:
            key: Preference key
            value: Preference value
        """
        with self._lock:
            self.preferences[key] = value
            self._save_preferences()
    
    def get_all(self) -> Dict[str, Any]:
        """
        Get all preferences
        
        Returns:
            Dictionary of all preferences
        """
        with self._lock:
            return dict(self.preferences)
    
    def set_multiple(self, preferences: Dict[str, Any]) -> None:
        """
        Set multiple preferences at once
        
        Args:
            preferences: Dictionary of preferences to set
        """
        with self._lock:
            self.preferences.update(preferences)
            self._save_preferences()
    
    def clear(self, key: str) -> None:
        """
        Clear a preference
        
        Args:
            key: Preference key to clear
        """
        with self._lock:
            if key in self.preferences:
                del self.preferences[key]
                self._save_preferences()
    
    def reset_to_defaults(self) -> None:
        """Reset all preferences to defaults"""
        with self._lock:
            self.preferences = {
                "theme": "auto",
                "notifications_enabled": True,
                "comfort_responses_enabled": True,
                "favorite_music": "",
                "favorite_images": "",
                "comfort_threshold": 0.65,
                "comfort_cooldown": 300  # 5 minutes
            }
            self._save_preferences()


# Singleton instance
_user_preferences = None

def get_user_preferences() -> UserPreferences:
    """Get the singleton user preferences instance"""
    global _user_preferences
    if _user_preferences is None:
        _user_preferences = UserPreferences()
    return _user_preferences
