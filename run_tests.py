"""
Script to run tests with proper Python path setup
"""
import os
import sys
import subprocess
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Run pytest with the correct Python path
if __name__ == "__main__":
    print(f"Python path: {sys.path}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Project root: {project_root}")
    
    # Run pytest
    result = subprocess.run(["pytest", "-v"], capture_output=True, text=True)
    
    # Print the output
    print("STDOUT:")
    print(result.stdout)
    
    print("STDERR:")
    print(result.stderr)
    
    # Exit with the same code as pytest
    sys.exit(result.returncode)
