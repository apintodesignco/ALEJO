#!/usr/bin/env python3
"""
ALEJO Secure Browser Testing Adapter
Adapts the SecureBrowserTesting class to work with our new SecurityManager implementation
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union, Any

from .secure_browser_testing import SecureBrowserTesting

logger = logging.getLogger("alejo.testing.secure_browser_testing_adapter")

class SecureBrowserTestingAdapter:
    """
    Adapter for the SecureBrowserTesting class to work with our new SecurityManager implementation
    
    This class wraps the SecureBrowserTesting class and adapts its interface to work with
    the new SecurityManager implementation.
    """
    
    def __init__(self, security_manager=None, config: Dict = None):
        """
        Initialize the secure browser testing adapter
        
        Args:
            security_manager: Security manager instance for security features
            config: Optional configuration dictionary with settings
        """
        self.security_manager = security_manager
        self.config = config or {}
        
        # Create a dictionary-like wrapper for the security manager to maintain compatibility
        self.security_manager_wrapper = SecurityManagerWrapper(security_manager) if security_manager else None
        
        # Initialize the secure browser testing with our wrapper
        self.secure_testing = SecureBrowserTesting(
            config=self.config,
            security_manager=self.security_manager_wrapper
        )
        
        logger.info("Secure browser testing adapter initialized")
    
    def check_permission(self, session_id: str, permission: str) -> bool:
        """
        Check if a user has a specific permission
        
        Args:
            session_id: Session ID for authentication
            permission: Permission to check
            
        Returns:
            True if the user has the permission, False otherwise
        """
        if not self.security_manager:
            # Default to allowing access if no security manager is available
            return True
        
        try:
            # Use the access_control module to check permissions
            return self.security_manager.access_control.check_permission(session_id, permission)
        except Exception as e:
            logger.error(f"Error checking permission: {e}")
            return False
    
    def run_secure_test(self, session_id: str, url: str, test_name: str, 
                        browsers: List[str] = None, headless: bool = False, 
                        timeout: int = 30) -> Dict[str, Any]:
        """
        Run a secure browser test
        
        Args:
            session_id: Session ID for authentication
            url: URL to test
            test_name: Name for this test run
            browsers: List of browsers to test with
            headless: Whether to run in headless mode
            timeout: Timeout in seconds
            
        Returns:
            Dictionary with test results
        """
        # Extract username from session if available
        username = None
        if self.security_manager:
            try:
                session_info = self.security_manager.access_control.get_session_info(session_id)
                if session_info:
                    username = session_info.get('username')
            except Exception:
                pass
        
        # Update config with headless and timeout settings
        config_update = {'headless': headless, 'timeout': timeout}
        self.secure_testing.config.update(config_update)
        
        # Run the test
        return self.secure_testing.run_secure_test(
            url=url,
            browsers=browsers,
            session_id=session_id,
            username=username,
            test_name=test_name
        )
    
    def store_test_results(self, test_name: str, results: Dict[str, Any]) -> bool:
        """
        Store test results securely
        
        Args:
            test_name: Name of the test
            results: Test results to store
            
        Returns:
            True if results were stored successfully, False otherwise
        """
        # Add test name to results if not present
        if "test_name" not in results:
            results["test_name"] = test_name
            
        # Store the results
        return self.secure_testing._store_results_securely(results)
    
    def retrieve_test_results(self, session_id: str, test_name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve test results
        
        Args:
            session_id: Session ID for authentication
            test_name: Name of the test
            
        Returns:
            Dictionary with test results or None if retrieval failed
        """
        # Find the most recent file for this test
        secure_dir = Path("secure_test_results")
        if not secure_dir.exists():
            return None
            
        matching_files = list(secure_dir.glob(f"secure_test_{test_name}_*.enc"))
        if not matching_files:
            return None
            
        # Sort by modification time (most recent first)
        matching_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        latest_file = matching_files[0].name
        
        # Extract username from session if available
        username = None
        if self.security_manager:
            try:
                session_info = self.security_manager.access_control.get_session_info(session_id)
                if session_info:
                    username = session_info.get('username')
            except Exception:
                pass
        
        # Retrieve the results
        return self.secure_testing.retrieve_secure_results(
            filename=latest_file,
            session_id=session_id,
            username=username
        )
    
    def get_encrypted_results(self, test_name: str) -> Optional[bytes]:
        """
        Get encrypted test results
        
        Args:
            test_name: Name of the test
            
        Returns:
            Encrypted test results or None if not found
        """
        # Find the most recent file for this test
        secure_dir = Path("secure_test_results")
        if not secure_dir.exists():
            return None
            
        matching_files = list(secure_dir.glob(f"secure_test_{test_name}_*.enc"))
        if not matching_files:
            return None
            
        # Sort by modification time (most recent first)
        matching_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        latest_file = matching_files[0]
        
        # Read the encrypted data
        try:
            with open(latest_file, "rb") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading encrypted results: {e}")
            return None


class SecurityManagerWrapper:
    """
    Wrapper for the SecurityManager to provide a dictionary-like interface
    
    This class wraps the SecurityManager to provide the interface expected by
    the SecureBrowserTesting class.
    """
    
    def __init__(self, security_manager):
        """
        Initialize the security manager wrapper
        
        Args:
            security_manager: Security manager instance to wrap
        """
        self.security_manager = security_manager
    
    def get(self, key, default=None):
        """
        Get a value from the security manager
        
        Args:
            key: Key to get
            default: Default value if key not found
            
        Returns:
            Value for the key or default if not found
        """
        # Map keys to security manager methods
        if key == "encrypt_data":
            return self.security_manager.encrypt_data
        elif key == "decrypt_data":
            return self.security_manager.decrypt_data
        elif key == "check_permission":
            # This is a bit tricky as our implementation might differ
            # We'll provide a compatible method
            return lambda session_id, permission: self.security_manager.access_control.check_permission(session_id, permission)
        elif key == "log_event":
            # Map to our audit logger
            return lambda event_type, username, data, level="INFO": self.security_manager.log_audit_event(
                event_type=event_type,
                username=username,
                event_data=data,
                severity=level
            )
        else:
            return default
    
    def __getitem__(self, key):
        """
        Get a value from the security manager using dictionary syntax
        
        Args:
            key: Key to get
            
        Returns:
            Value for the key
            
        Raises:
            KeyError: If key not found
        """
        value = self.get(key)
        if value is None:
            raise KeyError(key)
        return value
    
    def __contains__(self, key):
        """
        Check if a key exists in the security manager
        
        Args:
            key: Key to check
            
        Returns:
            True if the key exists, False otherwise
        """
        return self.get(key) is not None
