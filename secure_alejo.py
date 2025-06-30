#!/usr/bin/env python3
"""
ALEJO Secure Integration Module
Provides a unified interface for all ALEJO security features
"""

import os
import sys
import logging
import argparse
from pathlib import Path
from typing import Dict, Optional, Any, List, Union

# Import ALEJO modules
from core.security.security_manager import SecurityManager
from core.security.mfa import MFAManager
from core.security.sso_integration import SSOIntegration
from core.vision.secure_camera_integration import SecureCameraIntegration
from core.testing.secure_browser_testing import SecureBrowserTesting
from test_browser_compatibility import BrowserCompatibilityTester

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("alejo.secure")

class SecureALEJO:
    """
    Secure ALEJO Integration
    Provides a unified interface for all ALEJO security features
    """
    
    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize Secure ALEJO
        
        Args:
            config_file: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_file)
        
        # Initialize security components
        self._init_components()
        
        logger.info("Secure ALEJO initialized")
    
    def _load_config(self, config_file: Optional[str]) -> Dict[str, Any]:
        """
        Load configuration from file
        
        Args:
            config_file: Path to configuration file
            
        Returns:
            Configuration dictionary
        """
        config = {
            "security_level": "high",
            "data_dir": "./alejo_secure_data",
            "audit_log_dir": "./alejo_audit_logs",
            "vision_dir": "./alejo_vision_data",
            "results_dir": "./alejo_test_results",
            "mfa": {
                "storage_path": "./alejo_mfa_data",
                "totp_issuer": "ALEJO"
            },
            "sso": {
                "provider": "okta",
                "redirect_uri": "http://localhost:8000/callback"
            }
        }
        
        # Load from file if provided
        if config_file:
            try:
                import json
                with open(config_file, 'r') as f:
                    file_config = json.load(f)
                    # Update config with file values
                    self._update_dict(config, file_config)
            except Exception as e:
                logger.error(f"Error loading config file: {e}")
        
        # Create directories
        for dir_key in ["data_dir", "audit_log_dir", "vision_dir", "results_dir"]:
            Path(config[dir_key]).mkdir(parents=True, exist_ok=True)
        
        Path(config["mfa"]["storage_path"]).mkdir(parents=True, exist_ok=True)
        
        return config
    
    def _update_dict(self, target: Dict, source: Dict) -> None:
        """
        Recursively update dictionary
        
        Args:
            target: Target dictionary
            source: Source dictionary
        """
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._update_dict(target[key], value)
            else:
                target[key] = value
    
    def _init_components(self) -> None:
        """Initialize security components"""
        # Get encryption key from environment
        encryption_key = os.environ.get("ALEJO_ENCRYPTION_KEY")
        
        # Initialize security manager
        self.security_manager = SecurityManager({
            "security_level": self.config["security_level"],
            "encryption_key": encryption_key,
            "audit_log_dir": self.config["audit_log_dir"]
        })
        
        # Initialize MFA manager
        self.mfa_manager = MFAManager(
            self.config["mfa"],
            self.security_manager.audit_logger
        )
        
        # Initialize SSO integration if configured
        if "client_id" in self.config["sso"] and "client_secret" in self.config["sso"]:
            self.sso_integration = SSOIntegration(
                self.config["sso"],
                self.security_manager.audit_logger
            )
        else:
            self.sso_integration = None
        
        # Initialize secure camera integration
        self.camera = SecureCameraIntegration({
            "storage_path": self.config["vision_dir"],
            "require_auth": True,
            "data_classification": "confidential"
        }, self.security_manager)
        
        # Initialize secure browser testing
        self.browser_testing = SecureBrowserTesting({
            "results_dir": self.config["results_dir"],
            "require_auth": True,
            "data_classification": "confidential"
        }, self.security_manager)
    
    def authenticate(self, username: str, password: str, mfa_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticate a user
        
        Args:
            username: Username
            password: Password
            mfa_code: MFA code (if enabled)
            
        Returns:
            Authentication result
        """
        # First authenticate with password
        session = self.security_manager.authenticate(username, password)
        if not session:
            return {"success": False, "error": "Invalid username or password"}
        
        # Check if MFA is enabled
        mfa_status = self.mfa_manager.is_mfa_enabled(username)
        
        # If MFA is enabled, verify code
        if mfa_status["any_enabled"]:
            if not mfa_code:
                return {"success": False, "error": "MFA code required", "mfa_required": True}
            
            # Try TOTP first
            if mfa_status["totp_enabled"]:
                if self.mfa_manager.verify_totp(username, mfa_code):
                    return {"success": True, "session": session}
            
            # Try backup code
            if mfa_status["backup_enabled"]:
                if self.mfa_manager.verify_backup_code(username, mfa_code):
                    return {"success": True, "session": session}
            
            return {"success": False, "error": "Invalid MFA code"}
        
        # If MFA is not enabled, just return session
        return {"success": True, "session": session}
    
    def authenticate_sso(self, code: str) -> Dict[str, Any]:
        """
        Authenticate a user with SSO
        
        Args:
            code: Authorization code from SSO provider
            
        Returns:
            Authentication result
        """
        if not self.sso_integration:
            return {"success": False, "error": "SSO not configured"}
        
        # Exchange code for tokens
        result = self.sso_integration.exchange_code(code)
        
        if "error" in result:
            return {"success": False, "error": result["error"]}
        
        # Create a session
        session = {
            "session_id": str(result.get("id_token", "")),
            "username": result.get("email", ""),
            "role": result.get("alejo_role", "viewer")
        }
        
        return {"success": True, "session": session, "sso_data": result}
    
    def get_sso_auth_url(self) -> str:
        """
        Get SSO authorization URL
        
        Returns:
            SSO authorization URL
        """
        if not self.sso_integration:
            return ""
        
        return self.sso_integration.get_auth_url()
    
    def setup_mfa(self, username: str) -> Dict[str, Any]:
        """
        Set up MFA for a user
        
        Args:
            username: Username
            
        Returns:
            MFA setup information
        """
        # Set up TOTP
        totp_setup = self.mfa_manager.setup_totp(username)
        
        # Generate backup codes
        backup_codes = self.mfa_manager.generate_backup_codes(username)
        
        return {
            "totp": totp_setup,
            "backup_codes": backup_codes
        }
    
    def run_secure_browser_tests(self, url: str, browsers: List[str] = None) -> Dict[str, Any]:
        """
        Run secure browser tests
        
        Args:
            url: URL to test
            browsers: List of browsers to test
            
        Returns:
            Test results
        """
        return self.browser_testing.run_browser_tests(url, browsers)
    
    def capture_secure_screenshot(self, filename: Optional[str] = None) -> bool:
        """
        Capture a secure screenshot
        
        Args:
            filename: Filename to save screenshot
            
        Returns:
            True if screenshot was captured, False otherwise
        """
        # Initialize camera if needed
        if not self.camera.is_initialized:
            if not self.camera.initialize_camera():
                return False
        
        # Capture screenshot
        image = self.camera.capture_screenshot(filename)
        
        return image is not None
    
    def compare_secure_images(self, image1: str, image2: str) -> Dict[str, Any]:
        """
        Compare two secure images
        
        Args:
            image1: First image
            image2: Second image
            
        Returns:
            Comparison result
        """
        # Initialize camera if needed
        if not self.camera.is_initialized:
            if not self.camera.initialize_camera():
                return {"success": False, "error": "Failed to initialize camera"}
        
        # Compare images
        similar, score, diff_image = self.camera.compare_images(image1, image2)
        
        return {
            "success": True,
            "similar": similar,
            "score": score,
            "has_diff_image": diff_image is not None
        }
    
    def encrypt_data(self, data: str) -> bytes:
        """
        Encrypt data
        
        Args:
            data: Data to encrypt
            
        Returns:
            Encrypted data
        """
        return self.security_manager.encrypt_data(data)
    
    def decrypt_data(self, encrypted_data: bytes) -> str:
        """
        Decrypt data
        
        Args:
            encrypted_data: Data to decrypt
            
        Returns:
            Decrypted data
        """
        return self.security_manager.decrypt_data(encrypted_data)
    
    def encrypt_file(self, input_file: Union[str, Path]) -> Path:
        """
        Encrypt a file
        
        Args:
            input_file: Path to file to encrypt
            
        Returns:
            Path to encrypted file
        """
        return self.security_manager.encrypt_file(input_file)
    
    def decrypt_file(self, input_file: Union[str, Path], output_file: Optional[Union[str, Path]] = None) -> Path:
        """
        Decrypt a file
        
        Args:
            input_file: Path to file to decrypt
            output_file: Path to save decrypted file
            
        Returns:
            Path to decrypted file
        """
        return self.security_manager.decrypt_file(input_file, output_file)
    
    def log_event(self, event_type: str, user: str, details: Dict[str, Any], severity: str = "INFO") -> Optional[str]:
        """
        Log an audit event
        
        Args:
            event_type: Type of event
            user: Username or system component that triggered the event
            details: Additional details about the event
            severity: Severity level
            
        Returns:
            Event ID if logged, None otherwise
        """
        return self.security_manager.log_event(event_type, user, details, severity)
    
    def get_security_status(self) -> Dict[str, Any]:
        """
        Get security status
        
        Returns:
            Security status
        """
        status = self.security_manager.get_security_status()
        
        # Add MFA status
        status["mfa_enabled"] = self.mfa_manager is not None
        
        # Add SSO status
        status["sso_enabled"] = self.sso_integration is not None
        if self.sso_integration:
            status["sso_provider"] = self.config["sso"]["provider"]
        
        # Add camera status
        status["camera_enabled"] = self.camera is not None
        
        # Add browser testing status
        status["secure_browser_testing_enabled"] = self.browser_testing is not None
        
        return status


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="ALEJO Secure Integration")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--status", action="store_true", help="Show security status")
    parser.add_argument("--test-url", help="URL to test with secure browser testing")
    parser.add_argument("--encrypt", help="Encrypt a file")
    parser.add_argument("--decrypt", help="Decrypt a file")
    parser.add_argument("--output", help="Output file for decryption")
    
    args = parser.parse_args()
    
    # Initialize Secure ALEJO
    secure_alejo = SecureALEJO(args.config)
    
    # Show security status
    if args.status:
        status = secure_alejo.get_security_status()
        import json
        print(json.dumps(status, indent=2))
    
    # Run browser tests
    if args.test_url:
        results = secure_alejo.run_secure_browser_tests(args.test_url)
        import json
        print(json.dumps(results, indent=2))
    
    # Encrypt file
    if args.encrypt:
        encrypted_file = secure_alejo.encrypt_file(args.encrypt)
        print(f"File encrypted: {encrypted_file}")
    
    # Decrypt file
    if args.decrypt:
        decrypted_file = secure_alejo.decrypt_file(args.decrypt, args.output)
        print(f"File decrypted: {decrypted_file}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
