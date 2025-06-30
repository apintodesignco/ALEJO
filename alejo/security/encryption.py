#!/usr/bin/env python3
"""
ALEJO Encryption Module
Provides secure encryption and decryption capabilities
"""

import os
import base64
import logging
import secrets
from typing import Dict, Optional, Union, Any, Tuple

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.fernet import Fernet

logger = logging.getLogger("alejo.security.encryption")

class AlejoEncryption:
    """
    ALEJO Encryption class for secure data encryption and decryption
    
    This class provides methods for encrypting and decrypting data using
    industry-standard encryption algorithms with proper key management.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the encryption module
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        
        # Get encryption key from config or environment variable
        self.encryption_key = self.config.get("encryption_key") or os.environ.get("ALEJO_ENCRYPTION_KEY")
        
        if not self.encryption_key:
            logger.warning("No encryption key provided, generating a temporary key")
            self.encryption_key = secrets.token_hex(32)
        
        # Initialize Fernet cipher for symmetric encryption
        self.fernet = self._initialize_fernet()
        
        # Configure logging
        self._setup_logging()
        
        logger.info("Encryption module initialized")
    
    def _setup_logging(self):
        """Configure logging for the encryption module"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def _initialize_fernet(self) -> Fernet:
        """
        Initialize Fernet cipher for symmetric encryption
        
        Returns:
            Fernet cipher instance
        """
        # Derive a proper key from the provided encryption key
        salt = b'alejo_encryption_salt'  # Fixed salt for key derivation
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        # Convert string key to bytes if needed
        key_bytes = self.encryption_key.encode() if isinstance(self.encryption_key, str) else self.encryption_key
        
        # Derive key and create Fernet instance
        key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
        return Fernet(key)
    
    def encrypt_data(self, data: Union[str, bytes]) -> bytes:
        """
        Encrypt data using Fernet symmetric encryption
        
        Args:
            data: Data to encrypt (string or bytes)
            
        Returns:
            Encrypted data as bytes
        """
        try:
            # Convert string to bytes if needed
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            # Encrypt the data
            encrypted_data = self.fernet.encrypt(data)
            
            logger.debug(f"Data encrypted successfully ({len(encrypted_data)} bytes)")
            return encrypted_data
            
        except Exception as e:
            logger.error(f"Error encrypting data: {e}")
            raise
    
    def decrypt_data(self, encrypted_data: bytes) -> bytes:
        """
        Decrypt data using Fernet symmetric encryption
        
        Args:
            encrypted_data: Encrypted data as bytes
            
        Returns:
            Decrypted data as bytes
        """
        try:
            # Decrypt the data
            decrypted_data = self.fernet.decrypt(encrypted_data)
            
            logger.debug(f"Data decrypted successfully ({len(decrypted_data)} bytes)")
            return decrypted_data
            
        except Exception as e:
            logger.error(f"Error decrypting data: {e}")
            raise
    
    def encrypt_file(self, input_file: str, output_file: str = None) -> str:
        """
        Encrypt a file
        
        Args:
            input_file: Path to the file to encrypt
            output_file: Path to save the encrypted file (default: input_file + '.enc')
            
        Returns:
            Path to the encrypted file
        """
        if not output_file:
            output_file = input_file + '.enc'
        
        try:
            # Read the file
            with open(input_file, 'rb') as f:
                file_data = f.read()
            
            # Encrypt the data
            encrypted_data = self.encrypt_data(file_data)
            
            # Write the encrypted data
            with open(output_file, 'wb') as f:
                f.write(encrypted_data)
            
            logger.info(f"File encrypted: {input_file} -> {output_file}")
            return output_file
            
        except Exception as e:
            logger.error(f"Error encrypting file {input_file}: {e}")
            raise
    
    def decrypt_file(self, input_file: str, output_file: str = None) -> str:
        """
        Decrypt a file
        
        Args:
            input_file: Path to the encrypted file
            output_file: Path to save the decrypted file (default: input_file without '.enc')
            
        Returns:
            Path to the decrypted file
        """
        if not output_file:
            if input_file.endswith('.enc'):
                output_file = input_file[:-4]
            else:
                output_file = input_file + '.dec'
        
        try:
            # Read the encrypted file
            with open(input_file, 'rb') as f:
                encrypted_data = f.read()
            
            # Decrypt the data
            decrypted_data = self.decrypt_data(encrypted_data)
            
            # Write the decrypted data
            with open(output_file, 'wb') as f:
                f.write(decrypted_data)
            
            logger.info(f"File decrypted: {input_file} -> {output_file}")
            return output_file
            
        except Exception as e:
            logger.error(f"Error decrypting file {input_file}: {e}")
            raise
    
    def generate_key(self) -> str:
        """
        Generate a new encryption key
        
        Returns:
            New encryption key as a hex string
        """
        key = secrets.token_hex(32)
        logger.info("New encryption key generated")
        return key
    
    def encrypt_dict(self, data: Dict) -> bytes:
        """
        Encrypt a dictionary
        
        Args:
            data: Dictionary to encrypt
            
        Returns:
            Encrypted data as bytes
        """
        import json
        json_data = json.dumps(data)
        return self.encrypt_data(json_data)
    
    def decrypt_dict(self, encrypted_data: bytes) -> Dict:
        """
        Decrypt a dictionary
        
        Args:
            encrypted_data: Encrypted data as bytes
            
        Returns:
            Decrypted dictionary
        """
        import json
        json_data = self.decrypt_data(encrypted_data).decode('utf-8')
        return json.loads(json_data)
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password using a secure one-way hash function
        
        Args:
            password: Password to hash
            
        Returns:
            Hashed password
        """
        import bcrypt
        
        # Generate a salt and hash the password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """
        Verify a password against a hash
        
        Args:
            password: Password to verify
            hashed_password: Hashed password to compare against
            
        Returns:
            True if the password matches, False otherwise
        """
        import bcrypt
        
        # Verify the password
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
