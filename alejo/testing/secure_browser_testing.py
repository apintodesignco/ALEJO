#!/usr/bin/env python3
"""
ALEJO Secure Browser Testing
Integrates security features with browser testing functionality
"""

import os
import sys
import json
import logging
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Tuple
from datetime import datetime

# Import browser testing components
from .browser_testing import BrowserCompatibilityTester, BrowserTestRunner

logger = logging.getLogger("alejo.testing.secure_browser_testing")

class SecureBrowserTesting:
    """
    Secure browser testing for ALEJO
    
    This class integrates security features with browser testing functionality,
    providing secure test execution, encrypted result storage, and access control.
    """
    
    def __init__(self, config: Dict = None, security_manager=None):
        """
        Initialize the secure browser testing module
        
        Args:
            config: Optional configuration dictionary with settings
            security_manager: Security manager instance for security features
        """
        self.config = config or {}
        self.security_manager = security_manager
        
        # Initialize browser testing components
        self.compatibility_tester = BrowserCompatibilityTester(self.config)
        self.test_runner = BrowserTestRunner(self.config)
        
        # Configure logging
        self._setup_logging()
        
        logger.info("Secure browser testing initialized")
    
    def _setup_logging(self):
        """Configure logging for secure browser testing"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def run_secure_test(self, url: str, browsers: List[str] = None, session_id: str = None, 
                       username: str = None, test_name: str = None) -> Dict[str, Any]:
        """
        Run a secure browser compatibility test
        
        Args:
            url: URL to test
            browsers: List of browsers to test with
            session_id: Session ID for authentication
            username: Username for audit logging
            test_name: Name for this test run
            
        Returns:
            Dictionary with test results
        """
        # Check permissions if security manager is available
        if self.security_manager and session_id:
            if not self.security_manager.check_permission(session_id, "run_browser_tests"):
                logger.error(f"Permission denied for session {session_id}")
                return {"error": "Permission denied"}
        
        # Log the test request
        if self.security_manager and username:
            self.security_manager.log_event(
                "browser_test_started",
                username,
                {"url": url, "browsers": browsers, "test_name": test_name},
                "INFO"
            )
        
        # Run the test
        try:
            results = self.compatibility_tester.run_tests(url, browsers, test_name)
            
            # Store results securely if security manager is available
            if self.security_manager:
                self._store_results_securely(results, username)
            
            # Log the test completion
            if self.security_manager and username:
                self.security_manager.log_event(
                    "browser_test_completed",
                    username,
                    {"url": url, "test_name": test_name, "success": True},
                    "INFO"
                )
            
            return results
            
        except Exception as e:
            logger.error(f"Error running secure browser test: {e}")
            
            # Log the test failure
            if self.security_manager and username:
                self.security_manager.log_event(
                    "browser_test_failed",
                    username,
                    {"url": url, "test_name": test_name, "error": str(e)},
                    "ERROR"
                )
            
            return {"error": str(e)}
    
    def run_secure_comprehensive_tests(self, urls: List[str], browsers: List[str] = None, 
                                     session_id: str = None, username: str = None) -> Dict[str, Any]:
        """
        Run secure comprehensive browser tests
        
        Args:
            urls: List of URLs to test
            browsers: List of browsers to test with
            session_id: Session ID for authentication
            username: Username for audit logging
            
        Returns:
            Dictionary with test results
        """
        # Check permissions if security manager is available
        if self.security_manager and session_id:
            if not self.security_manager.check_permission(session_id, "run_comprehensive_tests"):
                logger.error(f"Permission denied for session {session_id}")
                return {"error": "Permission denied"}
        
        # Log the test request
        if self.security_manager and username:
            self.security_manager.log_event(
                "comprehensive_tests_started",
                username,
                {"urls": urls, "browsers": browsers},
                "INFO"
            )
        
        # Run the tests
        try:
            results = self.test_runner.run_comprehensive_tests(urls, browsers)
            
            # Store results securely if security manager is available
            if self.security_manager:
                self._store_results_securely(results, username)
            
            # Log the test completion
            if self.security_manager and username:
                self.security_manager.log_event(
                    "comprehensive_tests_completed",
                    username,
                    {"urls_count": len(urls), "success": True},
                    "INFO"
                )
            
            return results
            
        except Exception as e:
            logger.error(f"Error running secure comprehensive tests: {e}")
            
            # Log the test failure
            if self.security_manager and username:
                self.security_manager.log_event(
                    "comprehensive_tests_failed",
                    username,
                    {"urls_count": len(urls), "error": str(e)},
                    "ERROR"
                )
            
            return {"error": str(e)}
    
    def _store_results_securely(self, results: Dict[str, Any], username: str = None) -> bool:
        """
        Store test results securely
        
        Args:
            results: Test results to store
            username: Username for audit logging
            
        Returns:
            True if results were stored successfully, False otherwise
        """
        if not self.security_manager:
            logger.warning("Security manager not available, results not stored securely")
            return False
        
        try:
            # Convert results to JSON string
            results_json = json.dumps(results)
            
            # Encrypt the results
            encrypted_results = self.security_manager.encrypt_data(results_json)
            
            # Generate a secure filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            test_name = results.get("test_name", "unknown_test")
            secure_filename = f"secure_test_{test_name}_{timestamp}.enc"
            
            # Create secure storage directory if it doesn't exist
            secure_dir = Path("secure_test_results")
            secure_dir.mkdir(exist_ok=True)
            
            # Write encrypted results to file
            with open(secure_dir / secure_filename, "wb") as f:
                f.write(encrypted_results)
            
            # Log the storage event
            if username:
                self.security_manager.log_event(
                    "test_results_stored",
                    username,
                    {"filename": secure_filename},
                    "INFO"
                )
            
            logger.info(f"Test results stored securely as {secure_filename}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing test results securely: {e}")
            return False
    
    def retrieve_secure_results(self, filename: str, session_id: str = None, 
                              username: str = None) -> Optional[Dict[str, Any]]:
        """
        Retrieve securely stored test results
        
        Args:
            filename: Name of the encrypted results file
            session_id: Session ID for authentication
            username: Username for audit logging
            
        Returns:
            Dictionary with test results or None if retrieval failed
        """
        if not self.security_manager:
            logger.error("Security manager not available, cannot retrieve secure results")
            return None
        
        # Check permissions if security manager is available
        if session_id:
            if not self.security_manager.check_permission(session_id, "retrieve_test_results"):
                logger.error(f"Permission denied for session {session_id}")
                return None
        
        try:
            # Construct the file path
            secure_dir = Path("secure_test_results")
            file_path = secure_dir / filename
            
            if not file_path.exists():
                logger.error(f"Secure results file not found: {filename}")
                return None
            
            # Read encrypted results
            with open(file_path, "rb") as f:
                encrypted_results = f.read()
            
            # Decrypt the results
            results_json = self.security_manager.decrypt_data(encrypted_results)
            
            # Parse JSON
            results = json.loads(results_json)
            
            # Log the retrieval event
            if username:
                self.security_manager.log_event(
                    "test_results_retrieved",
                    username,
                    {"filename": filename},
                    "INFO"
                )
            
            logger.info(f"Secure test results retrieved from {filename}")
            return results
            
        except Exception as e:
            logger.error(f"Error retrieving secure test results: {e}")
            return None
    
    def list_secure_results(self, session_id: str = None, username: str = None) -> List[Dict[str, Any]]:
        """
        List all securely stored test results
        
        Args:
            session_id: Session ID for authentication
            username: Username for audit logging
            
        Returns:
            List of dictionaries with information about stored results
        """
        if not self.security_manager:
            logger.error("Security manager not available, cannot list secure results")
            return []
        
        # Check permissions if security manager is available
        if session_id:
            if not self.security_manager.check_permission(session_id, "list_test_results"):
                logger.error(f"Permission denied for session {session_id}")
                return []
        
        try:
            # Create secure storage directory if it doesn't exist
            secure_dir = Path("secure_test_results")
            secure_dir.mkdir(exist_ok=True)
            
            # List all encrypted files
            result_files = list(secure_dir.glob("*.enc"))
            
            # Extract information from filenames
            results_info = []
            for file_path in result_files:
                filename = file_path.name
                file_info = {
                    "filename": filename,
                    "size": file_path.stat().st_size,
                    "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                }
                
                # Try to extract test name and timestamp from filename
                parts = filename.replace(".enc", "").split("_")
                if len(parts) >= 4 and parts[0] == "secure" and parts[1] == "test":
                    file_info["test_name"] = parts[2]
                    file_info["timestamp"] = "_".join(parts[3:])
                
                results_info.append(file_info)
            
            # Sort by modification time (newest first)
            results_info.sort(key=lambda x: x["modified"], reverse=True)
            
            # Log the list event
            if username:
                self.security_manager.log_event(
                    "test_results_listed",
                    username,
                    {"count": len(results_info)},
                    "INFO"
                )
            
            logger.info(f"Listed {len(results_info)} secure test results")
            return results_info
            
        except Exception as e:
            logger.error(f"Error listing secure test results: {e}")
            return []
