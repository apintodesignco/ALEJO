"""
ALEJO - Advanced Language and Execution Joint Operator
Security encryption module for protecting sensitive data
"""

import os
import base64
from typing import Any, Dict, Optional, Union
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class EncryptionManager:
    """
    Manages encryption and decryption of sensitive data using Fernet symmetric encryption
    
    This class provides a secure way to encrypt and decrypt data using a key derived
    from a password and salt. It uses PBKDF2 for key derivation and Fernet for
    symmetric encryption.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EncryptionManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        # Default salt - in production, this should be stored securely
        self._default_salt = os.environ.get(
            "ALEJO_ENCRYPTION_SALT", 
            b"ALEJO_DEFAULT_SALT_CHANGE_IN_PRODUCTION"
        )
        if isinstance(self._default_salt, str):
            self._default_salt = self._default_salt.encode()
            
        # Default password - in production, this should be stored securely
        self._default_password = os.environ.get(
            "ALEJO_ENCRYPTION_PASSWORD", 
            "ALEJO_DEFAULT_PASSWORD_CHANGE_IN_PRODUCTION"
        )
        if isinstance(self._default_password, str):
            self._default_password = self._default_password.encode()
            
        self._cipher = self._create_cipher(self._default_password, self._default_salt)
        self._initialized = True
    
    def _derive_key(self, password: bytes, salt: bytes) -> bytes:
        """
        Derive a key from password and salt using PBKDF2
        
        Args:
            password: Password bytes
            salt: Salt bytes
            
        Returns:
            Derived key as bytes
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password))
    
    def _create_cipher(self, password: bytes, salt: bytes) -> Fernet:
        """
        Create a Fernet cipher using derived key
        
        Args:
            password: Password bytes
            salt: Salt bytes
            
        Returns:
            Fernet cipher
        """
        key = self._derive_key(password, salt)
        return Fernet(key)
    
    def encrypt(self, data: Union[str, bytes, Dict[str, Any]]) -> bytes:
        """
        Encrypt data using the default cipher
        
        Args:
            data: Data to encrypt (string, bytes, or dictionary)
            
        Returns:
            Encrypted data as bytes
        """
        if isinstance(data, dict):
            import json
            data = json.dumps(data).encode()
        elif isinstance(data, str):
            data = data.encode()
            
        return self._cipher.encrypt(data)
    
    def decrypt(self, encrypted_data: bytes) -> bytes:
        """
        Decrypt data using the default cipher
        
        Args:
            encrypted_data: Encrypted data as bytes
            
        Returns:
            Decrypted data as bytes
        """
        return self._cipher.decrypt(encrypted_data)
    
    def decrypt_to_string(self, encrypted_data: bytes) -> str:
        """
        Decrypt data and return as string
        
        Args:
            encrypted_data: Encrypted data as bytes
            
        Returns:
            Decrypted data as string
        """
        return self.decrypt(encrypted_data).decode()
    
    def decrypt_to_dict(self, encrypted_data: bytes) -> Dict[str, Any]:
        """
        Decrypt data and return as dictionary
        
        Args:
            encrypted_data: Encrypted data as bytes
            
        Returns:
            Decrypted data as dictionary
        """
        import json
        return json.loads(self.decrypt(encrypted_data))
    
    def set_encryption_key(self, password: Union[str, bytes], salt: Optional[bytes] = None) -> None:
        """
        Set a new encryption key
        
        Args:
            password: New password
            salt: Optional new salt (uses default if not provided)
        """
        if isinstance(password, str):
            password = password.encode()
            
        salt = salt or self._default_salt
        self._cipher = self._create_cipher(password, salt)


# Singleton instance
_encryption_manager = EncryptionManager()


def encrypt_data(data: Union[str, bytes, Dict[str, Any]]) -> bytes:
    """
    Encrypt data using the default encryption manager
    
    Args:
        data: Data to encrypt (string, bytes, or dictionary)
        
    Returns:
        Encrypted data as bytes
    """
    return _encryption_manager.encrypt(data)


def decrypt_data(encrypted_data: bytes) -> bytes:
    """
    Decrypt data using the default encryption manager
    
    Args:
        encrypted_data: Encrypted data as bytes
        
    Returns:
        Decrypted data as bytes
    """
    return _encryption_manager.decrypt(encrypted_data)


def decrypt_to_string(encrypted_data: bytes) -> str:
    """
    Decrypt data and return as string
    
    Args:
        encrypted_data: Encrypted data as bytes
        
    Returns:
        Decrypted data as string
    """
    return _encryption_manager.decrypt_to_string(encrypted_data)


def decrypt_to_dict(encrypted_data: bytes) -> Dict[str, Any]:
    """
    Decrypt data and return as dictionary
    
    Args:
        encrypted_data: Encrypted data as bytes
        
    Returns:
        Decrypted data as dictionary
    """
    return _encryption_manager.decrypt_to_dict(encrypted_data)


def set_encryption_key(password: Union[str, bytes], salt: Optional[bytes] = None) -> None:
    """
    Set a new encryption key for the default encryption manager
    
    Args:
        password: New password
        salt: Optional new salt (uses default if not provided)
    """
    _encryption_manager.set_encryption_key(password, salt)
