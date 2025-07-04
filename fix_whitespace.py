"""
Fix whitespace issues in Python files.
This script removes trailing whitespace and fixes blank lines with whitespace.
"""

import sys
import re

def fix_whitespace(filename):
    """Fix whitespace issues in a file."""
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace lines that are just whitespace with empty lines
    content = re.sub(r'^\s+$', '', content, flags=re.MULTILINE)
    
    # Remove trailing whitespace from all lines
    content = re.sub(r'[ \t]+$', '', content, flags=re.MULTILINE)
    
    # Write the fixed content back to the file
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed whitespace issues in {filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fix_whitespace.py <filename>")
        sys.exit(1)
    
    filename = sys.argv[1]
    fix_whitespace(filename)
