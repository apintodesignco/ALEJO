#!/usr/bin/env python3
"""
ALEJO Access Control Module
Provides authentication, authorization, and session management
"""

import os
import time
import uuid
import logging
import secrets
import datetime
from typing import Dict, List, Optional, Union, Any, Tuple

import jwt
from passlib.hash import pbkdf2_sha256

logger = logging.getLogger("alejo.security.access_control")

class AccessControl:
    """
    ALEJO Access Control class for authentication and authorization
    
    This class provides methods for user authentication, session management,
    and permission-based access control.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the access control module
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        
        # Get JWT secret key from config or environment variable
        self.jwt_secret = self.config.get("jwt_secret") or os.environ.get("ALEJO_JWT_SECRET")
        
        if not self.jwt_secret:
            logger.warning("No JWT secret provided, generating a temporary secret")
            self.jwt_secret = secrets.token_hex(32)
        
        # Initialize user database (in-memory for now)
        self.users = self.config.get("users", {})
        
        # Initialize session database (in-memory for now)
        self.sessions = {}
        
        # Initialize role-based permissions
        self.roles = self.config.get("roles", {
            "admin": ["*"],  # Admin has all permissions
            "user": ["view_data", "run_browser_tests"],
            "guest": ["view_data"]
        })
        
        # Configure logging
        self._setup_logging()
        
        logger.info("Access control module initialized")
    
    def _setup_logging(self):
        """Configure logging for the access control module"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def register_user(self, username: str, password: str, role: str = "user") -> bool:
        """
        Register a new user
        
        Args:
            username: Username
            password: Password
            role: User role (default: "user")
            
        Returns:
            True if registration was successful, False otherwise
        """
        if username in self.users:
            logger.warning(f"User {username} already exists")
            return False
        
        # Hash the password
        password_hash = pbkdf2_sha256.hash(password)
        
        # Create the user
        self.users[username] = {
            "password_hash": password_hash,
            "role": role,
            "created_at": datetime.datetime.now().isoformat(),
            "mfa_enabled": False
        }
        
        logger.info(f"User {username} registered with role {role}")
        return True
    
    def authenticate(self, username: str, password: str) -> Optional[str]:
        """
        Authenticate a user
        
        Args:
            username: Username
            password: Password
            
        Returns:
            Session ID if authentication was successful, None otherwise
        """
        if username not in self.users:
            logger.warning(f"Authentication failed: User {username} not found")
            return None
        
        user = self.users[username]
        
        # Verify the password
        if not pbkdf2_sha256.verify(password, user["password_hash"]):
            logger.warning(f"Authentication failed: Invalid password for user {username}")
            return None
        
        # Check if MFA is required
        if user.get("mfa_enabled", False):
            logger.info(f"MFA required for user {username}")
            return "MFA_REQUIRED"
        
        # Create a session
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "username": username,
            "role": user["role"],
            "created_at": datetime.datetime.now().isoformat(),
            "expires_at": (datetime.datetime.now() + datetime.timedelta(hours=24)).isoformat()
        }
        
        logger.info(f"User {username} authenticated successfully")
        return session_id
    
    def verify_mfa(self, username: str, mfa_code: str) -> Optional[str]:
        """
        Verify MFA code
        
        Args:
            username: Username
            mfa_code: MFA code
            
        Returns:
            Session ID if verification was successful, None otherwise
        """
        if username not in self.users:
            logger.warning(f"MFA verification failed: User {username} not found")
            return None
        
        user = self.users[username]
        
        # Check if MFA is enabled
        if not user.get("mfa_enabled", False):
            logger.warning(f"MFA verification failed: MFA not enabled for user {username}")
            return None
        
        # Verify the MFA code (would use PyOTP in a real implementation)
        # For now, just check if the code is "123456" for testing
        if mfa_code != "123456":
            logger.warning(f"MFA verification failed: Invalid MFA code for user {username}")
            return None
        
        # Create a session
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "username": username,
            "role": user["role"],
            "created_at": datetime.datetime.now().isoformat(),
            "expires_at": (datetime.datetime.now() + datetime.timedelta(hours=24)).isoformat(),
            "mfa_verified": True
        }
        
        logger.info(f"MFA verification successful for user {username}")
        return session_id
    
    def check_session(self, session_id: str) -> Optional[Dict]:
        """
        Check if a session is valid
        
        Args:
            session_id: Session ID
            
        Returns:
            Session information if valid, None otherwise
        """
        if session_id not in self.sessions:
            logger.warning(f"Session check failed: Session {session_id} not found")
            return None
        
        session = self.sessions[session_id]
        
        # Check if the session has expired
        expires_at = datetime.datetime.fromisoformat(session["expires_at"])
        if expires_at < datetime.datetime.now():
            logger.warning(f"Session check failed: Session {session_id} has expired")
            del self.sessions[session_id]
            return None
        
        logger.debug(f"Session {session_id} is valid")
        return session
    
    def check_permission(self, session_id: str, permission: str) -> bool:
        """
        Check if a session has a specific permission
        
        Args:
            session_id: Session ID
            permission: Permission to check
            
        Returns:
            True if the session has the permission, False otherwise
        """
        session = self.check_session(session_id)
        if not session:
            logger.warning(f"Permission check failed: Invalid session {session_id}")
            return False
        
        role = session["role"]
        
        # Check if the role exists
        if role not in self.roles:
            logger.warning(f"Permission check failed: Role {role} not found")
            return False
        
        # Check if the role has the permission
        role_permissions = self.roles[role]
        if "*" in role_permissions or permission in role_permissions:
            logger.debug(f"Permission check passed: Session {session_id} has permission {permission}")
            return True
        
        logger.warning(f"Permission check failed: Session {session_id} does not have permission {permission}")
        return False
    
    def logout(self, session_id: str) -> bool:
        """
        Logout a user by invalidating their session
        
        Args:
            session_id: Session ID
            
        Returns:
            True if logout was successful, False otherwise
        """
        if session_id not in self.sessions:
            logger.warning(f"Logout failed: Session {session_id} not found")
            return False
        
        # Delete the session
        username = self.sessions[session_id]["username"]
        del self.sessions[session_id]
        
        logger.info(f"User {username} logged out successfully")
        return True
    
    def generate_token(self, username: str, expiration: int = 3600) -> str:
        """
        Generate a JWT token for a user
        
        Args:
            username: Username
            expiration: Token expiration time in seconds (default: 1 hour)
            
        Returns:
            JWT token
        """
        if username not in self.users:
            logger.warning(f"Token generation failed: User {username} not found")
            raise ValueError(f"User {username} not found")
        
        user = self.users[username]
        
        # Create the token payload
        payload = {
            "sub": username,
            "role": user["role"],
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=expiration)
        }
        
        # Generate the token
        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
        
        logger.info(f"Token generated for user {username}")
        return token
    
    def verify_token(self, token: str) -> Optional[Dict]:
        """
        Verify a JWT token
        
        Args:
            token: JWT token
            
        Returns:
            Token payload if valid, None otherwise
        """
        try:
            # Verify and decode the token
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            
            logger.debug(f"Token verified for user {payload.get('sub')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token verification failed: Token has expired")
            return None
            
        except jwt.InvalidTokenError as e:
            logger.warning(f"Token verification failed: {e}")
            return None
    
    def enable_mfa(self, username: str) -> Optional[str]:
        """
        Enable MFA for a user
        
        Args:
            username: Username
            
        Returns:
            MFA secret if successful, None otherwise
        """
        if username not in self.users:
            logger.warning(f"MFA enablement failed: User {username} not found")
            return None
        
        # Generate a MFA secret (would use PyOTP in a real implementation)
        mfa_secret = secrets.token_hex(16)
        
        # Update the user
        self.users[username]["mfa_enabled"] = True
        self.users[username]["mfa_secret"] = mfa_secret
        
        logger.info(f"MFA enabled for user {username}")
        return mfa_secret
    
    def disable_mfa(self, username: str) -> bool:
        """
        Disable MFA for a user
        
        Args:
            username: Username
            
        Returns:
            True if successful, False otherwise
        """
        if username not in self.users:
            logger.warning(f"MFA disablement failed: User {username} not found")
            return False
        
        # Update the user
        self.users[username]["mfa_enabled"] = False
        if "mfa_secret" in self.users[username]:
            del self.users[username]["mfa_secret"]
        
        logger.info(f"MFA disabled for user {username}")
        return True
