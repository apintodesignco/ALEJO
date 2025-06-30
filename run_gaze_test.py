#!/usr/bin/env python3
"""
Script to run the gaze tracking test and display the results
"""
import asyncio
import sys
import os
import pytest
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    """Run the gaze tracking test"""
    print("Running gaze tracking test...")
    
    # Run the test
    result = pytest.main(["-v", "tests/test_gaze_tracking.py"])
    
    # Print the result
    if result == 0:
        print("\n✅ Gaze tracking test PASSED!")
    else:
        print("\n❌ Gaze tracking test FAILED!")

if __name__ == "__main__":
    main()
