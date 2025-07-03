"""
ALEJO Privacy Guard

This module provides comprehensive privacy protection for ALEJO,
implementing encryption, secure data handling, and privacy-preserving
techniques to ensure user data remains protected.

Features:
- Data encryption for sensitive information
- Privacy-preserving data processing
- Secure data storage and retrieval
- Data minimization techniques
- Anonymization and pseudonymization
- Integration with consent management
- Secure deletion capabilities
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Import ALEJO core components
try:
    from alejo.core.events import Event, EventType
    from alejo.database.memory_store import MemoryStore
    from alejo.security.consent_manager import ConsentManager, ConsentCategory
except ImportError:
    # Fallback for standalone usage or testing
    Event = dict
    EventType = None
    MemoryStore = None
    ConsentManager = None
    ConsentCategory = None

# Configure logging
logger = logging.getLogger(__name__)


class PrivacyLevel(Enum):
    """Privacy levels for different types of data."""
    PUBLIC = 0      # No restrictions, can be shared freely
    INTERNAL = 1    # For internal use only, not shared outside ALEJO
    SENSITIVE = 2   # Requires explicit consent, encrypted at rest
    CRITICAL = 3    # Maximum protection, encrypted at rest and in memory


class EncryptionMethod(Enum):
    """Available encryption methods."""
    NONE = "none"
    AES_256 = "aes_256"
    FERNET = "fernet"
    CUSTOM = "custom"


class PrivacyGuard:
    """
    Production-ready implementation of ALEJO's Privacy Guard.
    
    This class provides comprehensive privacy protection with:
    - Data encryption for sensitive information
    - Privacy-preserving data processing
    - Secure data storage and retrieval
    - Data minimization techniques
    - Integration with consent management
    """
    
    def __init__(self, event_bus=None, storage=None, consent_manager=None, 
                 encryption_key_path=None, privacy_config_path=None):
        """
        Initialize the privacy guard.
        
        Args:
            event_bus: Event bus for publishing privacy events
            storage: Storage backend for persisting privacy data
            consent_manager: Consent manager for checking user consent
            encryption_key_path: Path to file for storing encryption keys
            privacy_config_path: Path to privacy configuration file
        """
        self.event_bus = event_bus
        self.storage = storage
        self.consent_manager = consent_manager
        
        # Default paths if not provided
        if encryption_key_path is None:
            self.encryption_key_path = Path.home() / ".alejo" / "security" / "encryption_keys.json"
        else:
            self.encryption_key_path = Path(encryption_key_path)
            
        if privacy_config_path is None:
            self.privacy_config_path = Path.home() / ".alejo" / "security" / "privacy_config.json"
        else:
            self.privacy_config_path = Path(privacy_config_path)
        
        # Ensure directories exist
        self.encryption_key_path.parent.mkdir(parents=True, exist_ok=True)
        self.privacy_config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Dictionary to store encryption keys
        self._encryption_keys = {}
        
        # Privacy configuration
        self._privacy_config = {}
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        # Load existing encryption keys and privacy configuration
        self._load_encryption_keys()
        self._load_privacy_config()
        
        logger.info("Privacy guard initialized")
    
    async def encrypt_data(self, data: Any, user_id: str, 
                          privacy_level: PrivacyLevel = PrivacyLevel.SENSITIVE,
                          metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Encrypt sensitive data.
        
        Args:
            data: Data to encrypt
            user_id: User identifier
            privacy_level: Privacy level for the data
            metadata: Optional metadata about the data
            
        Returns:
            Dictionary containing encrypted data and metadata
        """
        async with self._lock:
            # Check if encryption is needed based on privacy level
            if privacy_level in [PrivacyLevel.PUBLIC, PrivacyLevel.INTERNAL]:
                # No encryption needed for public or internal data
                return {
                    'data': data,
                    'encrypted': False,
                    'privacy_level': privacy_level.name,
                    'timestamp': datetime.now().isoformat()
                }
            
            # Check consent if consent manager is available
            if self.consent_manager:
                has_consent = await self.consent_manager.has_consent(
                    user_id, ConsentCategory.DATA_COLLECTION)
                if not has_consent:
                    logger.warning(f"User {user_id} has not granted consent for data collection")
                    # Return minimal data without the actual content
                    return {
                        'error': 'Consent not granted',
                        'privacy_level': privacy_level.name,
                        'timestamp': datetime.now().isoformat()
                    }
            
            # Serialize data to JSON if it's not a string
            if not isinstance(data, str):
                try:
                    data_str = json.dumps(data)
                except (TypeError, ValueError):
                    logger.error("Failed to serialize data to JSON")
                    return {
                        'error': 'Data serialization failed',
                        'privacy_level': privacy_level.name,
                        'timestamp': datetime.now().isoformat()
                    }
            else:
                data_str = data
            
            # Get or create encryption key for user
            encryption_key = await self._get_encryption_key(user_id)
            if not encryption_key:
                logger.error(f"Failed to get encryption key for user {user_id}")
                return {
                    'error': 'Encryption key not available',
                    'privacy_level': privacy_level.name,
                    'timestamp': datetime.now().isoformat()
                }
            
            # Encrypt data
            try:
                # Generate a random initialization vector
                iv = os.urandom(16)
                
                # Create cipher using key and IV
                from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
                from cryptography.hazmat.backends import default_backend
                
                cipher = Cipher(
                    algorithms.AES(encryption_key),
                    modes.CBC(iv),
                    backend=default_backend()
                )
                encryptor = cipher.encryptor()
                
                # Pad data to be a multiple of 16 bytes (AES block size)
                padded_data = self._pad_data(data_str.encode('utf-8'))
                
                # Encrypt data
                encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
                
                # Encode encrypted data and IV as base64
                encrypted_b64 = base64.b64encode(encrypted_data).decode('utf-8')
                iv_b64 = base64.b64encode(iv).decode('utf-8')
                
                # Create result
                result = {
                    'data': encrypted_b64,
                    'iv': iv_b64,
                    'encrypted': True,
                    'encryption_method': EncryptionMethod.AES_256.value,
                    'privacy_level': privacy_level.name,
                    'timestamp': datetime.now().isoformat()
                }
                
                # Add metadata if provided
                if metadata:
                    result['metadata'] = metadata
                
                return result
                
            except Exception as e:
                logger.error(f"Encryption failed: {e}")
                return {
                    'error': f'Encryption failed: {str(e)}',
                    'privacy_level': privacy_level.name,
                    'timestamp': datetime.now().isoformat()
                }
    
    async def decrypt_data(self, encrypted_data: Dict[str, Any], user_id: str) -> Any:
        """
        Decrypt encrypted data.
        
        Args:
            encrypted_data: Dictionary containing encrypted data and metadata
            user_id: User identifier
            
        Returns:
            Decrypted data
        """
        async with self._lock:
            # Check if data is actually encrypted
            if not encrypted_data.get('encrypted', False):
                # Data is not encrypted, return as is
                return encrypted_data.get('data')
            
            # Check for encryption method
            encryption_method = encrypted_data.get('encryption_method', EncryptionMethod.AES_256.value)
            
            # Get encryption key for user
            encryption_key = await self._get_encryption_key(user_id)
            if not encryption_key:
                logger.error(f"Failed to get encryption key for user {user_id}")
                raise ValueError("Encryption key not available")
            
            # Decrypt data based on encryption method
            if encryption_method == EncryptionMethod.AES_256.value:
                try:
                    # Get encrypted data and IV from base64
                    encrypted_bytes = base64.b64decode(encrypted_data['data'])
                    iv = base64.b64decode(encrypted_data['iv'])
                    
                    # Create cipher using key and IV
                    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
                    from cryptography.hazmat.backends import default_backend
                    
                    cipher = Cipher(
                        algorithms.AES(encryption_key),
                        modes.CBC(iv),
                        backend=default_backend()
                    )
                    decryptor = cipher.decryptor()
                    
                    # Decrypt data
                    decrypted_padded = decryptor.update(encrypted_bytes) + decryptor.finalize()
                    
                    # Remove padding
                    decrypted_bytes = self._unpad_data(decrypted_padded)
                    
                    # Decode bytes to string
                    decrypted_str = decrypted_bytes.decode('utf-8')
                    
                    # Try to parse as JSON
                    try:
                        return json.loads(decrypted_str)
                    except json.JSONDecodeError:
                        # Not JSON, return as string
                        return decrypted_str
                    
                except Exception as e:
                    logger.error(f"Decryption failed: {e}")
                    raise ValueError(f"Decryption failed: {str(e)}")
            else:
                logger.error(f"Unsupported encryption method: {encryption_method}")
                raise ValueError(f"Unsupported encryption method: {encryption_method}")
    
    async def anonymize_data(self, data: Dict[str, Any], 
                           fields_to_anonymize: List[str]) -> Dict[str, Any]:
        """
        Anonymize sensitive fields in data.
        
        Args:
            data: Data to anonymize
            fields_to_anonymize: List of field names to anonymize
            
        Returns:
            Anonymized data
        """
        if not isinstance(data, dict):
            logger.error("Data must be a dictionary for anonymization")
            return data
        
        # Create a copy to avoid modifying the original
        anonymized_data = data.copy()
        
        # Anonymize each specified field
        for field in fields_to_anonymize:
            if field in anonymized_data:
                # Hash the field value for anonymization
                if isinstance(anonymized_data[field], str):
                    anonymized_data[field] = self._hash_value(anonymized_data[field])
                elif isinstance(anonymized_data[field], (int, float)):
                    # Convert to string first for hashing
                    anonymized_data[field] = self._hash_value(str(anonymized_data[field]))
        
        return anonymized_data
    
    async def secure_delete(self, data_path: Union[str, Path], 
                          passes: int = 3) -> bool:
        """
        Securely delete a file by overwriting it multiple times.
        
        Args:
            data_path: Path to the file to delete
            passes: Number of overwrite passes
            
        Returns:
            True if deletion was successful, False otherwise
        """
        path = Path(data_path)
        if not path.exists() or not path.is_file():
            logger.error(f"File not found: {data_path}")
            return False
        
        try:
            # Get file size
            file_size = path.stat().st_size
            
            # Overwrite file multiple times
            for i in range(passes):
                with open(path, 'wb') as f:
                    # Use different patterns for each pass
                    if i % 3 == 0:
                        # All zeros
                        f.write(b'\x00' * file_size)
                    elif i % 3 == 1:
                        # All ones
                        f.write(b'\xFF' * file_size)
                    else:
                        # Random data
                        f.write(os.urandom(file_size))
            
            # Finally delete the file
            path.unlink()
            return True
            
        except Exception as e:
            logger.error(f"Secure deletion failed: {e}")
            return False
    
    async def get_privacy_settings(self, user_id: str) -> Dict[str, Any]:
        """
        Get privacy settings for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary of privacy settings
        """
        # Get user-specific privacy settings or default settings
        if user_id in self._privacy_config:
            return self._privacy_config[user_id].copy()
        else:
            # Return default settings
            return self._get_default_privacy_settings()
    
    async def update_privacy_settings(self, user_id: str, 
                                    settings: Dict[str, Any]) -> bool:
        """
        Update privacy settings for a user.
        
        Args:
            user_id: User identifier
            settings: New privacy settings
            
        Returns:
            True if settings were updated, False otherwise
        """
        async with self._lock:
            # Validate settings
            if not self._validate_privacy_settings(settings):
                logger.error(f"Invalid privacy settings for user {user_id}")
                return False
            
            # Update settings
            self._privacy_config[user_id] = settings
            
            # Save to persistent storage
            self._save_privacy_config()
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    'privacy.settings.updated',
                    {
                        'user_id': user_id,
                        'timestamp': datetime.now().isoformat()
                    },
                    'privacy_guard'
                )
            
            return True
    
    async def _get_encryption_key(self, user_id: str) -> bytes:
        """
        Get encryption key for a user, creating one if it doesn't exist.
        
        Args:
            user_id: User identifier
            
        Returns:
            Encryption key as bytes
        """
        # Check if key exists
        if user_id in self._encryption_keys:
            # Decode existing key from base64
            return base64.b64decode(self._encryption_keys[user_id])
        
        # Create new key
        new_key = secrets.token_bytes(32)  # 256 bits for AES-256
        
        # Store key as base64
        self._encryption_keys[user_id] = base64.b64encode(new_key).decode('utf-8')
        
        # Save to persistent storage
        self._save_encryption_keys()
        
        return new_key
    
    def _hash_value(self, value: str) -> str:
        """
        Hash a value for anonymization.
        
        Args:
            value: Value to hash
            
        Returns:
            Hashed value
        """
        # Use SHA-256 for hashing
        return hashlib.sha256(value.encode('utf-8')).hexdigest()
    
    def _pad_data(self, data: bytes) -> bytes:
        """
        Pad data to be a multiple of 16 bytes (AES block size).
        
        Args:
            data: Data to pad
            
        Returns:
            Padded data
        """
        block_size = 16
        padding_size = block_size - (len(data) % block_size)
        padding = bytes([padding_size] * padding_size)
        return data + padding
    
    def _unpad_data(self, data: bytes) -> bytes:
        """
        Remove padding from data.
        
        Args:
            data: Padded data
            
        Returns:
            Unpadded data
        """
        padding_size = data[-1]
        return data[:-padding_size]
    
    def _get_default_privacy_settings(self) -> Dict[str, Any]:
        """
        Get default privacy settings.
        
        Returns:
            Dictionary of default privacy settings
        """
        return {
            'data_retention': {
                'enabled': True,
                'retention_period_days': 90
            },
            'data_collection': {
                'analytics': False,
                'voice_processing': False,
                'vision_processing': False,
                'personalization': False
            },
            'encryption': {
                'method': EncryptionMethod.AES_256.value,
                'encrypt_at_rest': True,
                'encrypt_in_memory': False
            },
            'anonymization': {
                'enabled': True,
                'fields': ['ip_address', 'device_id', 'location']
            }
        }
    
    def _validate_privacy_settings(self, settings: Dict[str, Any]) -> bool:
        """
        Validate privacy settings.
        
        Args:
            settings: Privacy settings to validate
            
        Returns:
            True if settings are valid, False otherwise
        """
        # Check required sections
        required_sections = ['data_retention', 'data_collection', 'encryption', 'anonymization']
        for section in required_sections:
            if section not in settings:
                logger.error(f"Missing required section in privacy settings: {section}")
                return False
        
        # Validate data retention settings
        if not isinstance(settings['data_retention'].get('retention_period_days'), int):
            logger.error("Invalid data retention period")
            return False
        
        # Validate encryption settings
        encryption_method = settings['encryption'].get('method')
        if encryption_method not in [method.value for method in EncryptionMethod]:
            logger.error(f"Invalid encryption method: {encryption_method}")
            return False
        
        return True
    
    def _load_encryption_keys(self):
        """Load encryption keys from persistent storage."""
        try:
            if self.encryption_key_path.exists():
                with open(self.encryption_key_path, 'r') as f:
                    self._encryption_keys = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load encryption keys: {e}")
            # Initialize with empty dict if loading fails
            self._encryption_keys = {}
    
    def _save_encryption_keys(self):
        """Save encryption keys to persistent storage."""
        try:
            with open(self.encryption_key_path, 'w') as f:
                json.dump(self._encryption_keys, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save encryption keys: {e}")
    
    def _load_privacy_config(self):
        """Load privacy configuration from persistent storage."""
        try:
            if self.privacy_config_path.exists():
                with open(self.privacy_config_path, 'r') as f:
                    self._privacy_config = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load privacy configuration: {e}")
            # Initialize with empty dict if loading fails
            self._privacy_config = {}
    
    def _save_privacy_config(self):
        """Save privacy configuration to persistent storage."""
        try:
            with open(self.privacy_config_path, 'w') as f:
                json.dump(self._privacy_config, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save privacy configuration: {e}")


# Example usage
if __name__ == '__main__':
    async def main():
        # Create privacy guard
        pg = PrivacyGuard()
        
        # Example user
        user_id = 'alice'
        
        # Example sensitive data
        sensitive_data = {
            'name': 'Alice Smith',
            'email': 'alice@example.com',
            'ssn': '123-45-6789',
            'address': '123 Main St, Anytown, USA'
        }
        
        print(f"Original data: {sensitive_data}")
        
        # Encrypt data
        encrypted = await pg.encrypt_data(
            sensitive_data, 
            user_id, 
            PrivacyLevel.SENSITIVE
        )
        print(f"\nEncrypted data: {encrypted}")
        
        # Decrypt data
        decrypted = await pg.decrypt_data(encrypted, user_id)
        print(f"\nDecrypted data: {decrypted}")
        
        # Anonymize data
        anonymized = await pg.anonymize_data(
            sensitive_data, 
            ['ssn', 'email']
        )
        print(f"\nAnonymized data: {anonymized}")
        
        # Get privacy settings
        settings = await pg.get_privacy_settings(user_id)
        print(f"\nPrivacy settings: {settings}")
        
        # Update privacy settings
        new_settings = settings.copy()
        new_settings['data_collection']['analytics'] = True
        await pg.update_privacy_settings(user_id, new_settings)
        
        # Get updated settings
        updated_settings = await pg.get_privacy_settings(user_id)
        print(f"\nUpdated privacy settings: {updated_settings}")
    
    # Run the async example
    asyncio.run(main())
