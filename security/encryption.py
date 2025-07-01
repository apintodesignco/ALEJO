"""
ALEJO Data Encryption

This module provides utilities for encrypting sensitive data at rest.
It implements best practices for secure data storage including:
- AES-256 encryption for sensitive data
- Secure key generation and management
- Simple interfaces for encryption/decryption operations
"""

import base64
import os
import json
import logging
from pathlib import Path
from typing import Any, Dict, Union, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

class DataEncryption:
    """
    Utility for encrypting and decrypting sensitive data at rest.
    
    This class provides methods for securely storing sensitive data
    using strong encryption. It can be used to protect:
    - API keys and credentials
    - User personal information
    - Configuration data containing sensitive values
    - Any data that requires confidentiality
    """
    
    DEFAULT_KEY_FILE = ".alejo_encryption_key"
    DEFAULT_SALT_FILE = ".alejo_encryption_salt"
    
    def __init__(
        self, 
        key_file: Optional[Union[str, Path]] = None,
        salt_file: Optional[Union[str, Path]] = None,
        password: Optional[str] = None
    ):
        """
        Initialize the encryption utility.
        
        Args:
            key_file: Path to the encryption key file. If not provided, will use default.
            salt_file: Path to the salt file. If not provided, will use default.
            password: Optional password for deriving encryption key.
                      If not provided, will use key file directly.
        """
        self.key_file = Path(key_file) if key_file else Path.home() / self.DEFAULT_KEY_FILE
        self.salt_file = Path(salt_file) if salt_file else Path.home() / self.DEFAULT_SALT_FILE
        self.password = password
        
        self._initialize_keys()
        logger.debug("DataEncryption initialized")
    
    def _initialize_keys(self) -> None:
        """Initialize encryption keys, generating them if they don't exist."""
        if self.password:
            # If a password is provided, use it with the salt to derive the key
            if not self.salt_file.exists():
                salt = os.urandom(16)
                with open(self.salt_file, 'wb') as f:
                    f.write(salt)
                logger.info(f"Generated new salt file at {self.salt_file}")
            else:
                with open(self.salt_file, 'rb') as f:
                    salt = f.read()
            
            # Derive the key from the password and salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.password.encode()))
            
        else:
            # If no password is provided, use or generate a key file
            if not self.key_file.exists():
                key = Fernet.generate_key()
                with open(self.key_file, 'wb') as f:
                    f.write(key)
                # Secure the key file permissions
                os.chmod(self.key_file, 0o600)  # Read/write for owner only
                logger.info(f"Generated new encryption key at {self.key_file}")
            else:
                with open(self.key_file, 'rb') as f:
                    key = f.read()
        
        # Initialize the Fernet cipher with the key
        self.cipher = Fernet(key)
    
    def encrypt(self, data: Union[str, bytes, dict]) -> str:
        """
        Encrypt data using the initialized key.
        
        Args:
            data: The data to encrypt. Can be string, bytes, or dict.
                  Dicts are automatically serialized to JSON.
        
        Returns:
            Base64-encoded encrypted data as a string.
        """
        if isinstance(data, dict):
            # Convert dict to JSON string
            data = json.dumps(data)
        
        if isinstance(data, str):
            # Convert string to bytes
            data = data.encode('utf-8')
        
        # Encrypt the data
        encrypted_data = self.cipher.encrypt(data)
        
        # Return as a base64-encoded string for easy storage
        return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')
    
    def decrypt(self, encrypted_data: str, as_dict: bool = False) -> Union[str, dict]:
        """
        Decrypt data that was encrypted with this utility.
        
        Args:
            encrypted_data: Base64-encoded encrypted data string.
            as_dict: If True, attempts to parse the decrypted data as JSON.
        
        Returns:
            Decrypted data as a string or dict if as_dict is True.
        """
        try:
            # Decode the base64 string
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data)
            
            # Decrypt the data
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            
            # Convert bytes to string
            decrypted_str = decrypted_bytes.decode('utf-8')
            
            # Parse as JSON if requested
            if as_dict:
                return json.loads(decrypted_str)
            else:
                return decrypted_str
                
        except Exception as e:
            logger.error(f"Failed to decrypt data: {str(e)}")
            raise ValueError("Failed to decrypt data. The data may be corrupted or the key is incorrect.")
    
    def encrypt_file(self, input_file: Union[str, Path], output_file: Optional[Union[str, Path]] = None) -> Path:
        """
        Encrypt an entire file.
        
        Args:
            input_file: Path to the file to encrypt.
            output_file: Path to save the encrypted file. If not provided,
                         will append '.encrypted' to the input file name.
        
        Returns:
            Path to the encrypted file.
        """
        input_path = Path(input_file)
        if output_file:
            output_path = Path(output_file)
        else:
            output_path = input_path.with_suffix(input_path.suffix + '.encrypted')
        
        try:
            # Read the file
            with open(input_path, 'rb') as f:
                file_data = f.read()
            
            # Encrypt the file contents
            encrypted_data = self.cipher.encrypt(file_data)
            
            # Write the encrypted data
            with open(output_path, 'wb') as f:
                f.write(encrypted_data)
            
            logger.info(f"File encrypted: {input_path} → {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to encrypt file {input_path}: {str(e)}")
            raise
    
    def decrypt_file(self, input_file: Union[str, Path], output_file: Optional[Union[str, Path]] = None) -> Path:
        """
        Decrypt an encrypted file.
        
        Args:
            input_file: Path to the encrypted file.
            output_file: Path to save the decrypted file. If not provided,
                         will remove '.encrypted' from the input file name if present,
                         or append '.decrypted' if not.
        
        Returns:
            Path to the decrypted file.
        """
        input_path = Path(input_file)
        
        if output_file:
            output_path = Path(output_file)
        else:
            # If the file ends with .encrypted, remove it
            if input_path.suffix == '.encrypted':
                output_path = input_path.with_suffix('')
            else:
                # Otherwise, add .decrypted suffix
                output_path = input_path.with_suffix(input_path.suffix + '.decrypted')
        
        try:
            # Read the encrypted file
            with open(input_path, 'rb') as f:
                encrypted_data = f.read()
            
            # Decrypt the file contents
            decrypted_data = self.cipher.decrypt(encrypted_data)
            
            # Write the decrypted data
            with open(output_path, 'wb') as f:
                f.write(decrypted_data)
            
            logger.info(f"File decrypted: {input_path} → {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to decrypt file {input_path}: {str(e)}")
            raise


class SecureConfig:
    """
    Secure configuration manager for ALEJO.
    
    This class provides a way to store and retrieve configuration
    with sensitive values encrypted. It can be used as a replacement
    for standard configuration files when they contain sensitive data.
    """
    
    def __init__(
        self, 
        config_file: Union[str, Path],
        encryption: Optional[DataEncryption] = None,
        password: Optional[str] = None,
        secure_fields: Optional[list] = None
    ):
        """
        Initialize the secure configuration manager.
        
        Args:
            config_file: Path to the configuration file.
            encryption: DataEncryption instance. If not provided, one will be created.
            password: Optional password for encryption. Used if encryption is not provided.
            secure_fields: List of field names that should be encrypted.
                          If None, all fields will be stored in plaintext.
        """
        self.config_file = Path(config_file)
        self.encryption = encryption or DataEncryption(password=password)
        self.secure_fields = secure_fields or []
        self.config = {}
        
        # Load config if it exists
        if self.config_file.exists():
            self.load()
    
    def load(self) -> Dict[str, Any]:
        """
        Load the configuration from disk.
        
        Returns:
            The loaded configuration.
        """
        try:
            with open(self.config_file, 'r') as f:
                config_data = json.load(f)
            
            # Decrypt any encrypted fields
            for key, value in config_data.items():
                if key in self.secure_fields and isinstance(value, str) and value.startswith('ENCRYPTED:'):
                    # Extract the encrypted part
                    encrypted_value = value[10:]  # Remove 'ENCRYPTED:' prefix
                    try:
                        # Decrypt the value
                        self.config[key] = self.encryption.decrypt(encrypted_value)
                    except Exception as e:
                        logger.error(f"Failed to decrypt config value for {key}: {str(e)}")
                        self.config[key] = value  # Keep the encrypted value if decryption fails
                else:
                    # Store plaintext value
                    self.config[key] = value
                    
            logger.debug(f"Loaded configuration from {self.config_file}")
            return self.config
            
        except Exception as e:
            logger.error(f"Failed to load configuration from {self.config_file}: {str(e)}")
            return {}
    
    def save(self) -> None:
        """Save the configuration to disk, encrypting sensitive fields."""
        try:
            # Create a copy of the config with encrypted fields
            config_to_save = {}
            
            for key, value in self.config.items():
                if key in self.secure_fields and value:
                    # Encrypt and prefix the value
                    encrypted_value = self.encryption.encrypt(value)
                    config_to_save[key] = f"ENCRYPTED:{encrypted_value}"
                else:
                    # Store plaintext value
                    config_to_save[key] = value
            
            # Create parent directory if it doesn't exist
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Write the config
            with open(self.config_file, 'w') as f:
                json.dump(config_to_save, f, indent=2)
            
            # Secure the config file permissions
            os.chmod(self.config_file, 0o600)  # Read/write for owner only
            
            logger.info(f"Saved configuration to {self.config_file}")
            
        except Exception as e:
            logger.error(f"Failed to save configuration to {self.config_file}: {str(e)}")
            raise
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value.
        
        Args:
            key: The key to look up.
            default: Value to return if key is not found.
        
        Returns:
            The configuration value or default if not found.
        """
        return self.config.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """
        Set a configuration value.
        
        Args:
            key: The key to set.
            value: The value to set.
        """
        self.config[key] = value
    
    def update(self, new_values: Dict[str, Any]) -> None:
        """
        Update multiple configuration values at once.
        
        Args:
            new_values: Dictionary of values to update.
        """
        self.config.update(new_values)
    
    def __getitem__(self, key):
        return self.config[key]
    
    def __setitem__(self, key, value):
        self.config[key] = value
    
    def __contains__(self, key):
        return key in self.config
