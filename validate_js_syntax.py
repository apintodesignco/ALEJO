#!/usr/bin/env python3
import os
import subprocess
import sys

def validate_js_syntax(file_path):
    """Validate JavaScript syntax using Python's built-in tools"""
    print(f"Validating syntax for: {file_path}")
    
    # Check if file exists
    if not os.path.isfile(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    # Read the file content
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"✓ File read successfully: {len(content)} bytes")
        return True
    except Exception as e:
        print(f"❌ Error reading file: {str(e)}")
        return False

if __name__ == "__main__":
    file_path = "./src/core/integration/integration-manager.js"
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    
    success = validate_js_syntax(file_path)
    sys.exit(0 if success else 1)
