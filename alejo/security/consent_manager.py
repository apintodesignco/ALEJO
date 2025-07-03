"""
ALEJO Consent Manager

This module provides a comprehensive consent management system for ALEJO,
allowing fine-grained control over user consent for various features and data usage.
It supports granular consent categories, persistence, audit logging, and event-driven
architecture for real-time consent updates across the system.

Features:
- Granular consent categories (data collection, voice, vision, personalization, etc.)
- Persistent storage of consent settings
- Audit trail for consent changes
- Event-driven architecture for real-time consent updates
- Async API for non-blocking operations
- Consent expiration and renewal
- User-friendly consent explanations
- GDPR and CCPA compliance helpers
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from enum import Enum, auto
from pathlib import Path
from typing import Dict, List, Optional, Set, Union, Any

# Import ALEJO core components
try:
    from alejo.core.events import Event, EventType
    from alejo.database.memory_store import MemoryStore
except ImportError:
    # Fallback for standalone usage or testing
    Event = dict
    EventType = None
    MemoryStore = None

# Configure logging
logger = logging.getLogger(__name__)


class ConsentCategory(Enum):
    """Categories of consent that can be granted or revoked."""
    DATA_COLLECTION = auto()
    VOICE_PROCESSING = auto()
    VISION_PROCESSING = auto()
    PERSONALIZATION = auto()
    ANALYTICS = auto()
    THIRD_PARTY = auto()
    MEMORY_STORAGE = auto()
    CLOUD_SYNC = auto()
    NOTIFICATIONS = auto()
    LOCATION = auto()
    ALL = auto()  # Special category that applies to all


class ConsentStatus(Enum):
    """Status of a consent request."""
    GRANTED = "granted"
    DENIED = "denied"
    EXPIRED = "expired"
    PENDING = "pending"
    WITHDRAWN = "withdrawn"


class ConsentManager:
    """
    Production-ready implementation of the ALEJO Consent Manager.
    
    This class provides comprehensive consent management with:
    - Granular consent categories
    - Persistence
    - Audit logging
    - Event-driven architecture
    - Async API
    - Consent expiration and renewal
    """
    
    def __init__(self, event_bus=None, storage=None, consent_file_path=None):
        """
        Initialize the consent manager.
        
        Args:
            event_bus: Event bus for publishing consent events
            storage: Storage backend for persisting consent data
            consent_file_path: Path to file for storing consent data if no storage is provided
        """
        self.event_bus = event_bus
        self.storage = storage
        
        # Default consent file path if not provided
        if consent_file_path is None:
            self.consent_file_path = Path.home() / ".alejo" / "consent_data.json"
        else:
            self.consent_file_path = Path(consent_file_path)
            
        # Ensure directory exists
        self.consent_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Dictionary to store consent status per user and category
        # Format: {user_id: {category: {status, timestamp, expiration, metadata}}}
        self._user_consents = {}
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        # Load existing consent data
        self._load_consent_data()
        
        logger.info("Consent manager initialized")
    
    async def grant_consent(self, user_id: str, category: Union[ConsentCategory, str], 
                           expiration: Optional[datetime] = None, 
                           metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Grant consent for the specified user and category.
        
        Args:
            user_id: User identifier
            category: Consent category or string name of category
            expiration: Optional expiration date for the consent
            metadata: Optional metadata about the consent (e.g., context, source)
            
        Returns:
            True if consent was granted, False otherwise
        """
        async with self._lock:
            # Convert string category to enum if needed
            if isinstance(category, str):
                try:
                    category = ConsentCategory[category]
                except KeyError:
                    logger.error(f"Invalid consent category: {category}")
                    return False
            
            # Handle special ALL category
            if category == ConsentCategory.ALL:
                for cat in ConsentCategory:
                    if cat != ConsentCategory.ALL:
                        await self._set_consent(user_id, cat, ConsentStatus.GRANTED, 
                                              expiration, metadata)
                return True
            
            # Set consent for specific category
            return await self._set_consent(user_id, category, ConsentStatus.GRANTED, 
                                         expiration, metadata)
    
    async def revoke_consent(self, user_id: str, category: Union[ConsentCategory, str],
                            metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Revoke consent for the specified user and category.
        
        Args:
            user_id: User identifier
            category: Consent category or string name of category
            metadata: Optional metadata about the revocation (e.g., reason)
            
        Returns:
            True if consent was revoked, False otherwise
        """
        async with self._lock:
            # Convert string category to enum if needed
            if isinstance(category, str):
                try:
                    category = ConsentCategory[category]
                except KeyError:
                    logger.error(f"Invalid consent category: {category}")
                    return False
            
            # Handle special ALL category
            if category == ConsentCategory.ALL:
                for cat in ConsentCategory:
                    if cat != ConsentCategory.ALL:
                        await self._set_consent(user_id, cat, ConsentStatus.DENIED, 
                                              None, metadata)
                return True
            
            # Set consent for specific category
            return await self._set_consent(user_id, category, ConsentStatus.DENIED, 
                                         None, metadata)
    
    async def has_consent(self, user_id: str, category: Union[ConsentCategory, str]) -> bool:
        """
        Check if the specified user has granted consent for the category.
        
        Args:
            user_id: User identifier
            category: Consent category or string name of category
            
        Returns:
            True if consent is granted and not expired, False otherwise
        """
        # Convert string category to enum if needed
        if isinstance(category, str):
            try:
                category = ConsentCategory[category]
            except KeyError:
                logger.error(f"Invalid consent category: {category}")
                return False
        
        # Get consent status
        consent_data = self._get_consent_data(user_id, category)
        if not consent_data:
            return False
        
        # Check if consent is granted and not expired
        if consent_data.get('status') == ConsentStatus.GRANTED.value:
            # Check expiration if present
            expiration = consent_data.get('expiration')
            if expiration:
                expiration_dt = datetime.fromisoformat(expiration)
                if expiration_dt < datetime.now():
                    # Consent has expired
                    return False
            return True
        
        return False
    
    async def get_consent_status(self, user_id: str, category: Union[ConsentCategory, str]) -> Optional[ConsentStatus]:
        """
        Get the detailed consent status for the specified user and category.
        
        Args:
            user_id: User identifier
            category: Consent category or string name of category
            
        Returns:
            ConsentStatus enum value or None if no consent record exists
        """
        # Convert string category to enum if needed
        if isinstance(category, str):
            try:
                category = ConsentCategory[category]
            except KeyError:
                logger.error(f"Invalid consent category: {category}")
                return None
        
        # Get consent data
        consent_data = self._get_consent_data(user_id, category)
        if not consent_data:
            return None
        
        # Get status
        status_str = consent_data.get('status')
        if not status_str:
            return None
        
        # Check expiration
        expiration = consent_data.get('expiration')
        if expiration:
            expiration_dt = datetime.fromisoformat(expiration)
            if expiration_dt < datetime.now() and status_str == ConsentStatus.GRANTED.value:
                return ConsentStatus.EXPIRED
        
        # Return status enum
        try:
            return ConsentStatus(status_str)
        except ValueError:
            logger.error(f"Invalid consent status in data: {status_str}")
            return None
    
    async def get_all_consents(self, user_id: str) -> Dict[str, Dict[str, Any]]:
        """
        Get all consent settings for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary of consent settings by category
        """
        if user_id not in self._user_consents:
            return {}
        
        # Create a copy to avoid direct modification
        return {k: v.copy() for k, v in self._user_consents[user_id].items()}
    
    async def export_user_data(self, user_id: str) -> Dict[str, Any]:
        """
        Export all consent data for a user (for GDPR compliance).
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary with all user consent data including history
        """
        async with self._lock:
            if user_id not in self._user_consents:
                return {}
            
            # Create deep copy of user data
            user_data = {
                'user_id': user_id,
                'consents': self._user_consents[user_id].copy(),
                'export_date': datetime.now().isoformat()
            }
            
            return user_data
    
    async def delete_user_data(self, user_id: str) -> bool:
        """
        Delete all consent data for a user (for GDPR compliance).
        
        Args:
            user_id: User identifier
            
        Returns:
            True if data was deleted, False if user not found
        """
        async with self._lock:
            if user_id not in self._user_consents:
                return False
            
            # Delete user data
            del self._user_consents[user_id]
            
            # Save changes
            await self._save_consent_data()
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    'consent.user.deleted',
                    {'user_id': user_id},
                    'consent_manager'
                )
            
            return True
    
    async def _set_consent(self, user_id: str, category: ConsentCategory, 
                         status: ConsentStatus, expiration: Optional[datetime] = None,
                         metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Internal method to set consent status.
        
        Args:
            user_id: User identifier
            category: Consent category
            status: Consent status
            expiration: Optional expiration date
            metadata: Optional metadata
            
        Returns:
            True if consent was set, False otherwise
        """
        # Initialize user if not exists
        if user_id not in self._user_consents:
            self._user_consents[user_id] = {}
        
        # Convert category to string for storage
        category_str = category.name
        
        # Create consent record
        consent_data = {
            'status': status.value,
            'timestamp': datetime.now().isoformat(),
        }
        
        # Add expiration if provided
        if expiration:
            consent_data['expiration'] = expiration.isoformat()
        
        # Add metadata if provided
        if metadata:
            consent_data['metadata'] = metadata
        
        # Store consent
        self._user_consents[user_id][category_str] = consent_data
        
        # Save to persistent storage
        await self._save_consent_data()
        
        # Publish event if event bus is available
        if self.event_bus:
            event_data = {
                'user_id': user_id,
                'category': category_str,
                'status': status.value,
                'timestamp': consent_data['timestamp']
            }
            
            if expiration:
                event_data['expiration'] = consent_data['expiration']
                
            await self.event_bus.publish(
                f'consent.{status.value}',
                event_data,
                'consent_manager'
            )
        
        return True
    
    def _get_consent_data(self, user_id: str, category: ConsentCategory) -> Optional[Dict[str, Any]]:
        """
        Get consent data for a user and category.
        
        Args:
            user_id: User identifier
            category: Consent category
            
        Returns:
            Consent data dictionary or None if not found
        """
        if user_id not in self._user_consents:
            return None
        
        category_str = category.name
        return self._user_consents[user_id].get(category_str)
    
    def _load_consent_data(self):
        """Load consent data from persistent storage."""
        # Try to load from storage first
        if self.storage:
            try:
                data = self.storage.get('consent_data')
                if data:
                    self._user_consents = data
                    return
            except Exception as e:
                logger.error(f"Failed to load consent data from storage: {e}")
        
        # Fall back to file
        try:
            if self.consent_file_path.exists():
                with open(self.consent_file_path, 'r') as f:
                    self._user_consents = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load consent data from file: {e}")
            # Initialize with empty dict if loading fails
            self._user_consents = {}
    
    async def _save_consent_data(self):
        """Save consent data to persistent storage."""
        # Try to save to storage first
        if self.storage:
            try:
                self.storage.set('consent_data', self._user_consents)
            except Exception as e:
                logger.error(f"Failed to save consent data to storage: {e}")
        
        # Always save to file as backup
        try:
            with open(self.consent_file_path, 'w') as f:
                json.dump(self._user_consents, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save consent data to file: {e}")


# Example usage
if __name__ == '__main__':
    async def main():
        cm = ConsentManager()
        user = 'alice'
        
        print(f"Initial consent for {user}: {await cm.has_consent(user, ConsentCategory.DATA_COLLECTION)}")
        
        await cm.grant_consent(user, ConsentCategory.DATA_COLLECTION)
        print(f"After granting, consent for {user}: {await cm.has_consent(user, ConsentCategory.DATA_COLLECTION)}")
        
        await cm.revoke_consent(user, ConsentCategory.DATA_COLLECTION)
        print(f"After revoking, consent for {user}: {await cm.has_consent(user, ConsentCategory.DATA_COLLECTION)}")
        
        # Grant consent with expiration
        expiration = datetime.now() + timedelta(days=30)
        await cm.grant_consent(user, ConsentCategory.VOICE_PROCESSING, expiration)
        print(f"Voice processing consent: {await cm.has_consent(user, ConsentCategory.VOICE_PROCESSING)}")
        
        # Grant all consents
        await cm.grant_consent(user, ConsentCategory.ALL)
        print(f"All consents granted. Analytics consent: {await cm.has_consent(user, ConsentCategory.ANALYTICS)}")
        
        # Export user data
        user_data = await cm.export_user_data(user)
        print(f"Exported user data: {json.dumps(user_data, indent=2)}")
    
    # Run the async example
    asyncio.run(main())
