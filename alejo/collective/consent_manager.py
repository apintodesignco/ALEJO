"""
Consent Manager for ALEJO Collective Learning
Manages user consent for data collection and sharing
"""

import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import asyncio

from ..core.config_manager import ConfigManager

logger = logging.getLogger("alejo.collective.consent_manager")

class ConsentManager:
    """
    Manages user consent for the collective learning system
    
    Responsibilities:
    - Track user consent status
    - Provide clear information about data collection
    - Allow users to opt in/out at any time
    - Persist consent settings
    """
    
    def __init__(self, config_manager: ConfigManager):
        """Initialize consent manager"""
        self.config_manager = config_manager
        self.consent_status = False
        self.consent_timestamp = None
        self.consent_version = "1.0.0"
        self.consent_data = {}
        self._load_consent_status()
        
    def _load_consent_status(self):
        """Load consent status from configuration"""
        try:
            collective_config = self.config_manager.get_config("collective_learning", {})
            consent_data = collective_config.get("consent", {})
            
            self.consent_status = consent_data.get("status", False)
            
            # Parse timestamp if it exists
            timestamp_str = consent_data.get("timestamp")
            if timestamp_str:
                try:
                    self.consent_timestamp = datetime.fromisoformat(timestamp_str)
                except (ValueError, TypeError):
                    self.consent_timestamp = None
            
            self.consent_version = consent_data.get("version", self.consent_version)
            self.consent_data = consent_data
            
            logger.info(f"Loaded consent status: {self.consent_status}")
        except Exception as e:
            logger.error(f"Error loading consent status: {e}")
            self.consent_status = False
    
    def has_user_consent(self) -> bool:
        """
        Check if user has given consent for data collection
        
        Returns:
            True if consent granted, False otherwise
        """
        return self.consent_status
    
    def set_user_consent(self, status: bool, data: Optional[Dict[str, Any]] = None) -> bool:
        """
        Set user consent status
        
        Args:
            status: True to grant consent, False to revoke
            data: Additional consent data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.consent_status = status
            self.consent_timestamp = datetime.now()
            
            # Update consent data
            self.consent_data = {
                "status": status,
                "timestamp": self.consent_timestamp.isoformat(),
                "version": self.consent_version
            }
            
            # Add any additional data
            if data:
                self.consent_data.update(data)
            
            # Save to configuration
            collective_config = self.config_manager.get_config("collective_learning", {})
            collective_config["consent"] = self.consent_data
            self.config_manager.set_config("collective_learning", collective_config)
            self.config_manager.save_config()
            
            logger.info(f"User consent updated: {status}")
            
            # Emit event asynchronously
            asyncio.create_task(self._emit_consent_updated_event())
            
            return True
        except Exception as e:
            logger.error(f"Error setting user consent: {e}")
            return False
    
    async def _emit_consent_updated_event(self):
        """Emit event when consent status is updated"""
        try:
            # Import here to avoid circular imports
            from ..core.event_bus import EventType, Event
            from ..core.alejo_brain import ALEJOBrain
            
            brain = ALEJOBrain.get_instance()
            if brain and brain.event_bus:
                event = Event(
                    type=EventType.USER_CONSENT_UPDATED,
                    payload={
                        "consent_status": self.consent_status,
                        "timestamp": self.consent_timestamp.isoformat() if self.consent_timestamp else None,
                        "version": self.consent_version
                    },
                    source="consent_manager"
                )
                await brain.event_bus.emit(event)
        except Exception as e:
            logger.error(f"Error emitting consent updated event: {e}")
    
    def get_consent_details(self) -> Dict[str, Any]:
        """
        Get detailed consent information
        
        Returns:
            Dictionary with consent details
        """
        return {
            "status": self.consent_status,
            "timestamp": self.consent_timestamp.isoformat() if self.consent_timestamp else None,
            "version": self.consent_version,
            "data": self.consent_data
        }
        
    def is_consent_current(self) -> bool:
        """
        Check if consent is current or needs renewal
        
        Returns:
            True if consent is current, False if needs renewal
        """
        if not self.consent_status:
            return False
            
        # Check if consent version matches current version
        return self.consent_version == "1.0.0"
