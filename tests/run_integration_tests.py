"""
Test runner for ALEJO integration tests.
"""

import pytest
import asyncio
import sys
import os

def run_tests():
    """Run all integration tests."""
    test_files = [
        'test_brain_integration_new.py',
        'test_brain_integration_part2.py',
        'test_brain_integration_part3.py'
    ]
    
    # Add project root to Python path
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    sys.path.insert(0, project_root)
    
    # Run tests with pytest
    args = [
        '-v',  # Verbose output
        '--tb=short',  # Shorter traceback format
        '--asyncio-mode=auto'  # Handle async tests
    ] + test_files
    
    return pytest.main(args)

if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)
