#!/usr/bin/env python3
"""
Development setup script for ALEJO
This script installs ALEJO in development mode and ensures all dependencies are installed
"""
import os
import sys
import subprocess
import platform

def main():
    """Run the development setup process"""
    print("Setting up ALEJO for development...")
    
    # Get the project root directory
    project_root = os.path.dirname(os.path.abspath(__file__))
    print(f"Project root: {project_root}")
    
    # Install the package in development mode
    print("Installing ALEJO in development mode...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-e", "."])
    
    # Install test dependencies
    print("Installing test dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pytest", "pytest-asyncio", "pytest-mock"])
    
    # Pin OpenAI version to 1.12.0 to avoid compatibility issues
    print("Pinning OpenAI version to 1.12.0...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openai==1.12.0"])
    
    print("\nALEJO development setup complete!")
    print("\nYou can now run tests with:")
    print("  pytest")
    print("\nOr start the application with:")
    print("  python -m alejo")

if __name__ == "__main__":
    main()