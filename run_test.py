#!/usr/bin/env python3
"""
Script to run a specific test and capture the output
"""
import os
import sys
import subprocess

def main():
    """Run the specified test and capture the output"""
    test_path = "tests/test_gaze_tracking.py::test_gaze_tracking_basic"
    output_file = "test_output.txt"
    
    # Run the test and capture the output
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_path, "-v"],
        capture_output=True,
        text=True
    )
    
    # Write the output to a file
    with open(output_file, "w") as f:
        f.write(f"Exit code: {result.returncode}\n")
        f.write(f"STDOUT:\n{result.stdout}\n")
        f.write(f"STDERR:\n{result.stderr}\n")
    
    print(f"Test output written to {output_file}")
    
    # Print a summary
    print(f"Test exit code: {result.returncode}")
    if result.returncode == 0:
        print("Test PASSED")
    else:
        print("Test FAILED")
        print("Error summary:")
        error_lines = [line for line in result.stderr.split('\n') if "Error" in line or "Exception" in line]
        for line in error_lines[:5]:  # Show first 5 error lines
            print(f"  {line}")

if __name__ == "__main__":
    main()