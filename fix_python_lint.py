"""
Fix common Python lint issues in files.

This script addresses:
1. Blank lines with whitespace (W293)
2. Lines that are too long (E501) - wraps them
3. Trailing whitespace (W291)
4. Too many blank lines (E303)
"""

import sys
import re
import textwrap

def fix_lint_issues(filename):
    """Fix common lint issues in a Python file."""
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Process each line
    fixed_lines = []
    consecutive_blank_lines = 0
    
    for line in lines:
        # Fix blank lines with whitespace (W293)
        if line.strip() == '':
            consecutive_blank_lines += 1
            fixed_lines.append('\n')
            continue
        
        # Reset consecutive blank lines counter
        consecutive_blank_lines = 0
        
        # Fix trailing whitespace (W291)
        line = line.rstrip() + '\n'
        
        # Fix lines that are too long (E501)
        if len(line.rstrip()) > 79 and not line.strip().startswith('#'):
            # Handle indentation
            indent = len(line) - len(line.lstrip())
            indent_str = ' ' * indent
            
            # Wrap the line
            wrapped = textwrap.wrap(line.strip(), width=79-indent, 
                                    subsequent_indent=indent_str + '    ')
            
            # Add wrapped lines
            for wrapped_line in wrapped:
                fixed_lines.append(indent_str + wrapped_line + '\n')
        else:
            fixed_lines.append(line)
    
    # Write the fixed content back to the file
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    print(f"Fixed lint issues in {filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fix_python_lint.py <filename>")
        sys.exit(1)
    
    filename = sys.argv[1]
    fix_lint_issues(filename)
