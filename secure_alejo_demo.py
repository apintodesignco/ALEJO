#!/usr/bin/env python3
"""
ALEJO Security Features Demo
Demonstrates the security hardening features implemented in Phase 1
"""

import os
import sys
import time
import logging
import argparse
from pathlib import Path
from typing import Dict, Optional, Any, List, Union

# Import ALEJO secure integration
from secure_alejo import SecureALEJO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("alejo.demo")

def demo_encryption(secure_alejo: SecureALEJO):
    """
    Demonstrate encryption features
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Encryption Demo ===")
    
    # Create a test file
    test_file = Path("./demo_data/test_file.txt")
    test_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(test_file, "w") as f:
        f.write("This is a test file for encryption demo.\n")
        f.write("It contains sensitive information that should be encrypted.\n")
        f.write("ALEJO security features keep this data safe.\n")
    
    logger.info(f"Created test file: {test_file}")
    
    # Encrypt text
    sensitive_text = "This is sensitive information that needs to be encrypted"
    encrypted_text = secure_alejo.encrypt_data(sensitive_text)
    logger.info(f"Encrypted text: {encrypted_text}")
    
    # Decrypt text
    decrypted_text = secure_alejo.decrypt_data(encrypted_text)
    logger.info(f"Decrypted text: {decrypted_text}")
    assert decrypted_text == sensitive_text
    
    # Encrypt file
    encrypted_file = secure_alejo.encrypt_file(test_file)
    logger.info(f"Encrypted file: {encrypted_file}")
    
    # Decrypt file
    decrypted_file = Path("./demo_data/decrypted_file.txt")
    secure_alejo.decrypt_file(encrypted_file, decrypted_file)
    logger.info(f"Decrypted file: {decrypted_file}")
    
    # Verify content
    with open(decrypted_file, "r") as f:
        content = f.read()
    
    with open(test_file, "r") as f:
        original = f.read()
    
    assert content == original
    logger.info("Encryption demo completed successfully")

def demo_access_control(secure_alejo: SecureALEJO):
    """
    Demonstrate access control features
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Access Control Demo ===")
    
    # Authenticate as admin
    auth_result = secure_alejo.authenticate("admin", "admin")
    logger.info(f"Admin authentication: {auth_result}")
    
    if auth_result.get("success"):
        session = auth_result.get("session", {})
        session_id = session.get("session_id")
        
        # Check permissions
        has_admin = secure_alejo.security_manager.has_permission(session_id, "admin")
        has_read = secure_alejo.security_manager.has_permission(session_id, "read")
        has_write = secure_alejo.security_manager.has_permission(session_id, "write")
        
        logger.info(f"Admin permissions: admin={has_admin}, read={has_read}, write={has_write}")
    
    # Try invalid authentication
    invalid_auth = secure_alejo.authenticate("admin", "wrong_password")
    logger.info(f"Invalid authentication: {invalid_auth}")
    
    logger.info("Access control demo completed")

def demo_audit_logging(secure_alejo: SecureALEJO):
    """
    Demonstrate audit logging features
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Audit Logging Demo ===")
    
    # Log various events
    event_types = ["login", "file_access", "configuration_change", "security_alert"]
    severities = ["INFO", "INFO", "WARNING", "ERROR"]
    
    for i, (event_type, severity) in enumerate(zip(event_types, severities)):
        details = {
            "user_ip": f"192.168.1.{i+1}",
            "resource": f"/api/resource/{i+1}",
            "action": event_type
        }
        
        event_id = secure_alejo.log_event(
            event_type,
            "demo_user",
            details,
            severity
        )
        
        logger.info(f"Logged {severity} event: {event_type} with ID {event_id}")
    
    # Wait for logs to be written
    time.sleep(0.5)
    
    # Get security status to verify audit logging
    status = secure_alejo.get_security_status()
    if "audit_logging" in status:
        logger.info(f"Audit logging status: {status['audit_logging']}")
    
    logger.info("Audit logging demo completed")

def demo_secure_browser_testing(secure_alejo: SecureALEJO):
    """
    Demonstrate secure browser testing features
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Secure Browser Testing Demo ===")
    
    # Detect browsers
    browsers = secure_alejo.browser_testing.detect_browsers()
    logger.info(f"Detected browsers: {list(browsers.keys())}")
    
    # Run a test if browsers are available
    if browsers:
        # Take first browser for demo
        browser = list(browsers.keys())[0]
        logger.info(f"Running test with browser: {browser}")
        
        # Run test
        results = secure_alejo.run_secure_browser_tests(
            "https://www.example.com",
            [browser]
        )
        
        logger.info(f"Test completed with ID: {results.get('test_id')}")
        
        # Retrieve test results
        if "test_id" in results:
            retrieved = secure_alejo.browser_testing.retrieve_test_results(results["test_id"])
            if retrieved:
                logger.info(f"Retrieved test results for URL: {retrieved.get('url')}")
    else:
        logger.warning("No browsers detected, skipping browser test")
    
    logger.info("Secure browser testing demo completed")

def demo_secure_camera(secure_alejo: SecureALEJO):
    """
    Demonstrate secure camera features
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Secure Camera Demo ===")
    
    try:
        # Initialize camera
        if not secure_alejo.camera.is_initialized:
            initialized = secure_alejo.camera.initialize_camera()
            if not initialized:
                logger.warning("Failed to initialize camera, skipping camera demo")
                return
        
        # Capture screenshot
        filename = "demo_screenshot.png"
        captured = secure_alejo.capture_secure_screenshot(filename)
        
        if captured:
            logger.info(f"Captured secure screenshot: {filename}")
            
            # Capture another screenshot for comparison
            time.sleep(1)
            filename2 = "demo_screenshot2.png"
            captured2 = secure_alejo.capture_secure_screenshot(filename2)
            
            if captured2:
                logger.info(f"Captured second screenshot: {filename2}")
                
                # Compare screenshots
                comparison = secure_alejo.compare_secure_images(filename, filename2)
                logger.info(f"Image comparison result: {comparison}")
        else:
            logger.warning("Failed to capture screenshot")
        
        # Release camera
        secure_alejo.camera.release()
        
    except Exception as e:
        logger.warning(f"Camera demo error: {e}")
    
    logger.info("Secure camera demo completed")

def demo_security_status(secure_alejo: SecureALEJO):
    """
    Demonstrate security status reporting
    
    Args:
        secure_alejo: SecureALEJO instance
    """
    logger.info("=== Security Status Demo ===")
    
    # Get security status
    status = secure_alejo.get_security_status()
    
    # Print status
    import json
    logger.info(f"Security status: {json.dumps(status, indent=2)}")
    
    logger.info("Security status demo completed")

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="ALEJO Security Features Demo")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--demo", choices=["all", "encryption", "access", "audit", "browser", "camera", "status"],
                        default="all", help="Demo to run")
    
    args = parser.parse_args()
    
    logger.info("Starting ALEJO Security Features Demo")
    
    # Initialize Secure ALEJO
    secure_alejo = SecureALEJO(args.config)
    
    # Run selected demo
    if args.demo in ["all", "encryption"]:
        demo_encryption(secure_alejo)
    
    if args.demo in ["all", "access"]:
        demo_access_control(secure_alejo)
    
    if args.demo in ["all", "audit"]:
        demo_audit_logging(secure_alejo)
    
    if args.demo in ["all", "browser"]:
        demo_secure_browser_testing(secure_alejo)
    
    if args.demo in ["all", "camera"]:
        demo_secure_camera(secure_alejo)
    
    if args.demo in ["all", "status"]:
        demo_security_status(secure_alejo)
    
    logger.info("ALEJO Security Features Demo completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
