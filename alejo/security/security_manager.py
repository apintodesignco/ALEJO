#!/usr/bin/env python3
"""
ALEJO Security Manager
Provides a unified interface for all security features in ALEJO
"""

import os
import logging
from typing import Dict, Optional, Any, Union, List, Tuple
from pathlib import Path

logger = logging.getLogger("alejo.security.manager")

class SecurityManager:
    """
    Provides a unified interface for all security features in ALEJO
    
    This class coordinates all security-related functionality:
    - Encryption for data at rest and in transit
    - Access control with role-based permissions
    - Multi-factor authentication
    - Audit logging with tamper-evident logs
    - Secure storage for sensitive data
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the security manager
        
        Args:
            config: Configuration dictionary with the following options:
                - security_level: Security level (low, medium, high, max)
                - encryption_key: Key for encryption
                - access_control_config: Path to access control configuration
                - audit_log_dir: Directory for audit logs
        """
        self.config = config or {}
        self.security_level = self.config.get("security_level", "medium")
        
        # Initialize components based on security level
        self._init_components()
        
        logger.info(f"Security manager initialized with security level: {self.security_level}")
    
    def _init_components(self):
        """Initialize security components based on security level"""
        # Import security modules here to avoid circular imports
        from .encryption import AlejoEncryption
        from .access_control import AccessControl
        from .audit_logging import AuditLogger
        from .mfa import MFAManager
        from .sso_integration import SSOIntegration
        
        # Get configuration values
        encryption_config = {
            "encryption_key": self.config.get("encryption_key") or os.environ.get("ALEJO_ENCRYPTION_KEY")
        }
        
        access_control_config = self.config.get("access_control_config", {})
        audit_log_config = {
            "log_dir": self.config.get("audit_log_dir", "audit_logs")
        }
        mfa_config = self.config.get("mfa_config", {})
        sso_config = self.config.get("sso_config", {})
        
        # Initialize encryption
        self.encryption = AlejoEncryption(encryption_config)
        
        # Initialize access control if security level is medium or higher
        if self.security_level in ["medium", "high", "max"]:
            self.access_control = AccessControl(access_control_config)
        else:
            self.access_control = None
            
        # Initialize audit logging if security level is medium or higher
        if self.security_level in ["medium", "high", "max"]:
            self.audit_logger = AuditLogger(audit_log_config)
        else:
            self.audit_logger = None
            
        # Initialize MFA if security level is high or max
        if self.security_level in ["high", "max"]:
            self.mfa_manager = MFAManager(mfa_config)
        else:
            self.mfa_manager = None
            
        # Initialize SSO integration if configured
        if sso_config:
            self.sso_integration = SSOIntegration(sso_config)
        else:
            self.sso_integration = None
    
    # Encryption methods
    
    def encrypt_data(self, data: Union[str, bytes]) -> bytes:
        """
        Encrypt data
        
        Args:
            data: Data to encrypt (string or bytes)
            
        Returns:
            Encrypted data
        """
        return self.encryption.encrypt_data(data)
    
    def decrypt_data(self, encrypted_data: bytes) -> bytes:
        """
        Decrypt data
        
        Args:
            encrypted_data: Data to decrypt
            
        Returns:
            Decrypted data as bytes
        """
        return self.encryption.decrypt_data(encrypted_data)
    
    def encrypt_file(self, input_file: Union[str, Path], output_file: Optional[Union[str, Path]] = None) -> str:
        """
        Encrypt a file
        
        Args:
            input_file: Path to file to encrypt
            output_file: Path to save encrypted file
            
        Returns:
            Path to encrypted file
        """
        return self.encryption.encrypt_file(str(input_file), str(output_file) if output_file else None)
    
    def decrypt_file(self, input_file: Union[str, Path], output_file: Optional[Union[str, Path]] = None) -> str:
        """
        Decrypt a file
        
        Args:
            input_file: Path to encrypted file
            output_file: Path to save decrypted file
            
        Returns:
            Path to decrypted file
        """
        return self.encryption.decrypt_file(str(input_file), str(output_file) if output_file else None)
    
    # Access control methods
    
    def authenticate(self, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticate a user
        
        Args:
            username: Username
            password: Password
            
        Returns:
            Authentication result with session information if successful
        """
        if not self.access_control:
            # If access control is disabled, return a default session
            return {
                "success": True,
                "session": {
                    "session_id": "default-session",
                    "username": username,
                    "roles": ["user"],
                    "permissions": ["*"]
                },
                "mfa_required": False
            }
        
        # Authenticate with access control
        session_id = self.access_control.authenticate(username, password)
        
        if not session_id:
            return {
                "success": False,
                "message": "Invalid username or password"
            }
        
        # Check if MFA is required
        if session_id == "MFA_REQUIRED":
            return {
                "success": True,
                "mfa_required": True,
                "username": username
            }
        
        # Get session information
        session = self.access_control.check_session(session_id)
        
        return {
            "success": True,
            "session": {
                "session_id": session_id,
                "username": username,
                "roles": [session["role"]],
                "permissions": self.access_control.roles.get(session["role"], [])
            },
            "mfa_required": False
        }
    
    def check_permission(self, session_id: str, permission: str) -> bool:
        """
        Check if a session has a specific permission
        
        Args:
            session_id: Session ID
            permission: Permission to check
            
        Returns:
            True if session has permission, False otherwise
        """
        if not self.access_control:
            return True
            
        return self.access_control.check_permission(session_id, permission)
    
    def get_user_roles(self, username: str) -> List[str]:
        """
        Get roles for a user
        
        Args:
            username: Username
            
        Returns:
            List of roles
        """
        if not self.access_control:
            return ["user"]
            
        return self.access_control.get_user_roles(username)
    
    # Audit logging methods
    
    def log_event(self, event_type: str, username: str, details: Dict[str, Any] = None, level: str = "INFO") -> bool:
        """
        Log a security event
        
        Args:
            event_type: Type of event
            username: Username associated with the event
            details: Additional event data
            level: Log level (INFO, WARNING, ERROR)
            
        Returns:
            True if event was logged successfully, False otherwise
        """
        if not self.audit_logger:
            # If audit logging is disabled, just log to regular logger
            log_message = f"SECURITY EVENT: {event_type} by {username} - {details}"
            if level == "WARNING":
                logger.warning(log_message)
            elif level == "ERROR":
                logger.error(log_message)
            else:
                logger.info(log_message)
            return True
            
        return self.audit_logger.log_event(event_type, username, details or {}, level)
    
    def get_audit_logs(self, start_time: str = None, end_time: str = None, 
                  event_types: List[str] = None, username: str = None) -> List[Dict[str, Any]]:
        """
        Get audit logs with optional filtering
        
        Args:
            start_time: ISO format start time filter
            end_time: ISO format end time filter
            event_types: List of event types to include
            username: Username filter
            
        Returns:
            List of audit log entries
        """
        if not self.audit_logger:
            return []
            
        return self.audit_logger.get_logs(start_time, end_time, event_types, username)
    
    # Security status and utilities
    
    def get_security_status(self) -> Dict[str, Any]:
        """
        Get current security status
        
        Returns:
            Dictionary with security status information
        """
        status = {
            "security_level": self.security_level,
            "encryption_enabled": self.encryption is not None,
            "access_control_enabled": self.access_control is not None,
            "audit_logging_enabled": self.audit_logger is not None
        }
        
        # Add additional status information based on security level
        if self.security_level in ["high", "max"]:
            status.update({
                "mfa_enabled": True,
                "session_timeout": 30,  # minutes
                "password_complexity": "high"
            })
        elif self.security_level == "medium":
            status.update({
                "mfa_enabled": False,
                "session_timeout": 60,  # minutes
                "password_complexity": "medium"
            })
        else:
            status.update({
                "mfa_enabled": False,
                "session_timeout": 120,  # minutes
                "password_complexity": "low"
            })
            
        return status
    
    def generate_secure_token(self, length: int = 32) -> str:
        """
        Generate a secure random token
        
        Args:
            length: Length of token in bytes
            
        Returns:
            Secure random token as hex string
        """
        import secrets
        return secrets.token_hex(length)
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password securely
        
        Args:
            password: Password to hash
            
        Returns:
            Hashed password
        """
        if not self.access_control:
            import hashlib
            return hashlib.sha256(password.encode()).hexdigest()
            
        return self.encryption.hash_password(password)
