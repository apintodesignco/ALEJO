#!/usr/bin/env python3
"""
Markdown Linter Auto-fix Tool for ALEJO Project

This script automatically fixes common markdown linting issues:
1. Add blank lines around headings (MD022)
2. Add blank lines around lists (MD032)
3. Add blank lines around fenced code blocks (MD031)
4. Fix bare URLs by wrapping them in angle brackets (MD034)
5. Add language specifiers to fenced code blocks (MD040)
6. Remove trailing spaces (MD009)

Usage:
    python fix_markdown_lint.py [directory]
    
If no directory is specified, it will process all markdown files in the current directory.
"""

import os
import re
import sys
import argparse
from pathlib import Path


def fix_blanks_around_headings(content):
    """Fix MD022: Headings should be surrounded by blank lines."""
    lines = content.split('\n')
    result = []
    
    for i, line in enumerate(lines):
        # Check if this line is a heading
        if re.match(r'^#{1,6}\s+.+', line):
            # If not at the beginning and previous line is not blank, add a blank line
            if i > 0 and lines[i-1].strip():
                result.append('')
            
            result.append(line)
            
            # If not at the end and next line is not blank, add a blank line
            if i < len(lines) - 1 and lines[i+1].strip():
                result.append('')
        else:
            result.append(line)
    
    return '\n'.join(result)


def fix_blanks_around_lists(content):
    """Fix MD032: Lists should be surrounded by blank lines."""
    lines = content.split('\n')
    result = []
    
    for i, line in enumerate(lines):
        # Check if this line is the start of a list item
        if re.match(r'^(\s*[-*+]|\s*\d+\.)\s+.+', line):
            # If not at the beginning and previous line is not blank and not a list item
            if i > 0 and lines[i-1].strip() and not re.match(r'^(\s*[-*+]|\s*\d+\.)\s+.+', lines[i-1]):
                result.append('')
            
            result.append(line)
            
            # If not at the end and next line is not blank and not a list item
            if i < len(lines) - 1 and lines[i+1].strip() and not re.match(r'^(\s*[-*+]|\s*\d+\.)\s+.+', lines[i+1]):
                result.append('')
        else:
            result.append(line)
    
    return '\n'.join(result)


def fix_blanks_around_fences(content):
    """Fix MD031: Fenced code blocks should be surrounded by blank lines."""
    lines = content.split('\n')
    result = []
    in_code_block = False
    
    for i, line in enumerate(lines):
        # Check for code fence markers
        if re.match(r'^```', line):
            in_code_block = not in_code_block
            
            if in_code_block:  # Start of code block
                # If not at the beginning and previous line is not blank, add a blank line
                if i > 0 and lines[i-1].strip():
                    result.append('')
            else:  # End of code block
                result.append(line)
                # If not at the end and next line is not blank, add a blank line
                if i < len(lines) - 1 and lines[i+1].strip():
                    result.append('')
                continue
        
        result.append(line)
    
    return '\n'.join(result)


def fix_bare_urls(content):
    """Fix MD034: Bare URLs should be wrapped in angle brackets."""
    # Regex to match URLs not already in markdown link format or angle brackets
    url_pattern = r'(?<!\]\()(?<!<)(https?://[^\s\)>]+)(?!\))(?!>)'
    return re.sub(url_pattern, r'<\1>', content)


def fix_fenced_code_language(content):
    """Fix MD040: Fenced code blocks should have a language specified."""
    lines = content.split('\n')
    result = []
    
    for i, line in enumerate(lines):
        # Check for code fence start without language
        if re.match(r'^```\s*$', line):
            result.append('```text')
        else:
            result.append(line)
    
    return '\n'.join(result)


def fix_trailing_spaces(content):
    """Fix MD009: No trailing spaces."""
    lines = content.split('\n')
    result = []
    
    for line in lines:
        result.append(line.rstrip())
    
    return '\n'.join(result)


def fix_markdown_file(file_path):
    """Apply all fixes to a markdown file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply fixes
        content = fix_blanks_around_headings(content)
        content = fix_blanks_around_lists(content)
        content = fix_blanks_around_fences(content)
        content = fix_bare_urls(content)
        content = fix_fenced_code_language(content)
        content = fix_trailing_spaces(content)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Fixed: {file_path}")
        return True
    except Exception as e:
        print(f"❌ Error fixing {file_path}: {str(e)}")
        return False


def process_directory(directory):
    """Process all markdown files in a directory recursively."""
    fixed_count = 0
    error_count = 0
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.md'):
                file_path = os.path.join(root, file)
                if fix_markdown_file(file_path):
                    fixed_count += 1
                else:
                    error_count += 1
    
    return fixed_count, error_count


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Fix common markdown linting issues.')
    parser.add_argument('directory', nargs='?', default=os.getcwd(),
                        help='Directory to process (default: current directory)')
    args = parser.parse_args()
    
    directory = args.directory
    if not os.path.isdir(directory):
        print(f"Error: {directory} is not a valid directory")
        return 1
    
    print(f"Processing markdown files in {directory}...")
    fixed_count, error_count = process_directory(directory)
    
    print(f"\nSummary:")
    print(f"- {fixed_count} files fixed successfully")
    if error_count:
        print(f"- {error_count} files had errors")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
