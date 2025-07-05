"""
ALEJO Test Utilities Module
This module provides common utilities for all ALEJO tests.
"""

import os
import sys
import json
import time
import secrets
import logging
from datetime import datetime
from pathlib import Path

# Add project root to path to ensure imports work correctly
PROJECT_ROOT = Path(__file__).parent.parent.parent.absolute()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Configure logging for tests
def setup_test_logging(test_name=None):
    """Set up logging for tests with proper formatting and file output"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = PROJECT_ROOT / "tests" / "reports"
    log_dir.mkdir(exist_ok=True, parents=True)
    
    if test_name:
        log_file = log_dir / f"alejo_test_{test_name}_{timestamp}.log"
    else:
        log_file = log_dir / f"alejo_test_{timestamp}.log"
    
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    
    return logging.getLogger("alejo_test")

# Test data helpers
def get_test_data_path(relative_path):
    """Get the absolute path to a test data file"""
    test_data_dir = PROJECT_ROOT / "tests" / "data"
    return test_data_dir / relative_path

def load_test_json(relative_path):
    """Load JSON test data from a file"""
    data_path = get_test_data_path(relative_path)
    with open(data_path, 'r', encoding='utf-8') as f:
        return json.load(f)

# Test performance measurement
class PerformanceTimer:
    """Simple timer for measuring test performance"""
    def __init__(self, name=None):
        self.name = name or "Operation"
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        duration = self.end_time - self.start_time
        print(f"{self.name} took {duration:.4f} seconds")
        return False  # Don't suppress exceptions
    
    def reset(self):
        """Reset the timer"""
        self.start_time = None
        self.end_time = None
    
    def get_duration(self):
        """Get the duration in seconds"""
        if self.start_time is None or self.end_time is None:
            return None
        return self.end_time - self.start_time

# Security test helpers
def generate_test_token():
    """Generate a secure random token for testing"""
    return secrets.token_hex(16)

def generate_test_password():
    """Generate a secure random password for testing"""
    return secrets.token_urlsafe(12)

# Test environment helpers
def is_ci_environment():
    """Check if tests are running in a CI environment"""
    return os.environ.get("CI", "false").lower() == "true"

def skip_in_ci(func):
    """Decorator to skip a test in CI environments"""
    def wrapper(*args, **kwargs):
        if is_ci_environment():
            print(f"Skipping {func.__name__} in CI environment")
            return None
        return func(*args, **kwargs)
    return wrapper
