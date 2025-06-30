#!/usr/bin/env python3
"""
ALEJO Multi-Factor Authentication Module
Provides MFA capabilities including TOTP and backup codes
"""

import os
import time
import base64
import logging
import secrets
import qrcode
from io import BytesIO
from typing import Dict, List, Optional, Union, Any, Tuple

import pyotp

logger = logging.getLogger("alejo.security.mfa")

class MFAManager:
    """
    ALEJO MFA Manager for multi-factor authentication
    
    This class provides methods for generating and validating TOTP codes,
    managing backup codes, and QR code generation for MFA setup.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the MFA manager
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        
        # MFA settings
        self.issuer_name = self.config.get("issuer_name", "ALEJO")
        self.backup_code_count = self.config.get("backup_code_count", 10)
        self.backup_code_length = self.config.get("backup_code_length", 8)
        
        # User MFA data (in-memory for now)
        self.user_mfa = {}
        
        # Configure logging
        self._setup_logging()
        
        logger.info("MFA manager initialized")
    
    def _setup_logging(self):
        """Configure logging for the MFA manager"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def generate_secret(self) -> str:
        """
        Generate a new TOTP secret
        
        Returns:
            Base32-encoded secret key
        """
        return pyotp.random_base32()
    
    def generate_totp_uri(self, username: str, secret: str) -> str:
        """
        Generate a TOTP URI for QR code generation
        
        Args:
            username: Username
            secret: TOTP secret
            
        Returns:
            TOTP URI
        """
        return pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name=self.issuer_name
        )
    
    def generate_qr_code(self, uri: str) -> bytes:
        """
        Generate a QR code image for a TOTP URI
        
        Args:
            uri: TOTP URI
            
        Returns:
            QR code image as bytes
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert image to bytes
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()
    
    def generate_backup_codes(self) -> List[str]:
        """
        Generate backup codes
        
        Returns:
            List of backup codes
        """
        codes = []
        for _ in range(self.backup_code_count):
            code = ''.join(secrets.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') for _ in range(self.backup_code_length))
            codes.append(code)
        
        return codes
    
    def setup_mfa(self, username: str) -> Dict:
        """
        Set up MFA for a user
        
        Args:
            username: Username
            
        Returns:
            Dictionary with MFA setup information
        """
        # Generate a new TOTP secret
        secret = self.generate_secret()
        
        # Generate a TOTP URI
        uri = self.generate_totp_uri(username, secret)
        
        # Generate backup codes
        backup_codes = self.generate_backup_codes()
        
        # Store MFA data
        self.user_mfa[username] = {
            "secret": secret,
            "backup_codes": backup_codes,
            "enabled": False,
            "setup_time": time.time()
        }
        
        # Generate QR code
        qr_code = self.generate_qr_code(uri)
        
        logger.info(f"MFA setup initiated for user {username}")
        
        return {
            "secret": secret,
            "uri": uri,
            "backup_codes": backup_codes,
            "qr_code": base64.b64encode(qr_code).decode('utf-8')
        }
    
    def verify_totp(self, username: str, code: str) -> bool:
        """
        Verify a TOTP code
        
        Args:
            username: Username
            code: TOTP code
            
        Returns:
            True if the code is valid, False otherwise
        """
        if username not in self.user_mfa:
            logger.warning(f"TOTP verification failed: User {username} not found")
            return False
        
        user_data = self.user_mfa[username]
        
        # Check if MFA is enabled
        if not user_data.get("enabled", False):
            logger.warning(f"TOTP verification failed: MFA not enabled for user {username}")
            return False
        
        # Get the secret
        secret = user_data["secret"]
        
        # Verify the code
        totp = pyotp.TOTP(secret)
        valid = totp.verify(code)
        
        if valid:
            logger.info(f"TOTP verification successful for user {username}")
        else:
            logger.warning(f"TOTP verification failed: Invalid code for user {username}")
        
        return valid
    
    def verify_backup_code(self, username: str, code: str) -> bool:
        """
        Verify a backup code
        
        Args:
            username: Username
            code: Backup code
            
        Returns:
            True if the code is valid, False otherwise
        """
        if username not in self.user_mfa:
            logger.warning(f"Backup code verification failed: User {username} not found")
            return False
        
        user_data = self.user_mfa[username]
        
        # Check if MFA is enabled
        if not user_data.get("enabled", False):
            logger.warning(f"Backup code verification failed: MFA not enabled for user {username}")
            return False
        
        # Get the backup codes
        backup_codes = user_data["backup_codes"]
        
        # Check if the code is valid
        if code in backup_codes:
            # Remove the used code
            backup_codes.remove(code)
            
            logger.info(f"Backup code verification successful for user {username}")
            return True
        
        logger.warning(f"Backup code verification failed: Invalid code for user {username}")
        return False
    
    def enable_mfa(self, username: str, code: str) -> bool:
        """
        Enable MFA for a user after verification
        
        Args:
            username: Username
            code: TOTP code for verification
            
        Returns:
            True if MFA was enabled successfully, False otherwise
        """
        if username not in self.user_mfa:
            logger.warning(f"MFA enablement failed: User {username} not found")
            return False
        
        user_data = self.user_mfa[username]
        
        # Get the secret
        secret = user_data["secret"]
        
        # Verify the code
        totp = pyotp.TOTP(secret)
        valid = totp.verify(code)
        
        if valid:
            # Enable MFA
            user_data["enabled"] = True
            
            logger.info(f"MFA enabled for user {username}")
            return True
        
        logger.warning(f"MFA enablement failed: Invalid code for user {username}")
        return False
    
    def disable_mfa(self, username: str) -> bool:
        """
        Disable MFA for a user
        
        Args:
            username: Username
            
        Returns:
            True if MFA was disabled successfully, False otherwise
        """
        if username not in self.user_mfa:
            logger.warning(f"MFA disablement failed: User {username} not found")
            return False
        
        # Disable MFA
        self.user_mfa[username]["enabled"] = False
        
        logger.info(f"MFA disabled for user {username}")
        return True
    
    def is_mfa_enabled(self, username: str) -> bool:
        """
        Check if MFA is enabled for a user
        
        Args:
            username: Username
            
        Returns:
            True if MFA is enabled, False otherwise
        """
        if username not in self.user_mfa:
            return False
        
        return self.user_mfa[username].get("enabled", False)
    
    def generate_new_backup_codes(self, username: str) -> Optional[List[str]]:
        """
        Generate new backup codes for a user
        
        Args:
            username: Username
            
        Returns:
            List of new backup codes if successful, None otherwise
        """
        if username not in self.user_mfa:
            logger.warning(f"Backup code generation failed: User {username} not found")
            return None
        
        # Generate new backup codes
        backup_codes = self.generate_backup_codes()
        
        # Update the user data
        self.user_mfa[username]["backup_codes"] = backup_codes
        
        logger.info(f"New backup codes generated for user {username}")
        return backup_codes
