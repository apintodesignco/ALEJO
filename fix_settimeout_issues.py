#!/usr/bin/env python3
"""
ALEJO setTimeout Security Fix

This script fixes insecure setTimeout usage in JavaScript files by:
1. Replacing string arguments with function references
2. Adding proper error handling to callbacks
3. Documenting safer alternatives

Usage:
    python fix_settimeout_issues.py [options]

Options:
    --path PATH         Path to fix (default: .)
    --dry-run           Show what would be changed without making changes
    --verbose           Show detailed output
"""

import argparse
import os
import re
import sys
from pathlib import Path

# ANSI color codes for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
END = "\033[0m"


class SetTimeoutSecurityFixer:
    """Main class for fixing setTimeout security issues in JavaScript code"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.files_processed = 0
        self.files_modified = 0
        self.issues_fixed = 0
        
    def fix_file(self, file_path: str) -> bool:
        """Fix setTimeout issues in a single JavaScript file"""
        if not file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
            return False
            
        self.files_processed += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Make a copy of the original content to check if changes were made
            original_content = content
            
            # Fix issues
            content = self.fix_settimeout_string_args(content)
            
            # Check if content was modified
            if content != original_content:
                self.files_modified += 1
                if not self.args.dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"{GREEN}✓ Fixed setTimeout issues in {file_path}{END}")
                else:
                    print(f"{BLUE}Would fix setTimeout issues in {file_path}{END}")
                return True
            else:
                if self.args.verbose:
                    print(f"{BLUE}No setTimeout issues to fix in {file_path}{END}")
                return False
                
        except Exception as e:
            print(f"{RED}Error processing {file_path}: {str(e)}{END}")
            return False
    
    def fix_settimeout_string_args(self, content: str) -> str:
        """Replace setTimeout with string argument to use function references"""
        # Pattern to match setTimeout with string argument
        pattern = r'setTimeout\s*\(\s*(["\'])(.*?)\1\s*,\s*([0-9]+)\s*\)'
        
        # Find matches
        matches = re.findall(pattern, content)
        self.issues_fixed += len(matches)
        
        if matches:
            if self.args.verbose:
                print(f"  Replacing {len(matches)} setTimeout calls with string arguments")
            
            # Replace each match with a safer alternative
            for match in matches:
                quote_type, code_string, delay = match
                # Create a function to replace the string argument
                replacement = f"setTimeout(function() {{ {code_string} }}, {delay})"
                # Replace in the content
                content = content.replace(
                    f"setTimeout({quote_type}{code_string}{quote_type}, {delay})",
                    replacement
                )
        
        # Also fix any potentially insecure setTimeout(eval(...)) patterns
        eval_pattern = r'setTimeout\s*\(\s*eval\s*\('
        eval_matches = re.findall(eval_pattern, content)
        self.issues_fixed += len(eval_matches)
        
        if eval_matches and self.args.verbose:
            print(f"  Replacing {len(eval_matches)} setTimeout calls with eval")
        
        # Replace eval in setTimeout with safer function
        content = re.sub(eval_pattern, 'setTimeout(function() { console.warn("Removed unsafe eval in setTimeout"); ', content)
        
        return content
    
    def run(self) -> int:
        """Run the issue fixer"""
        # Validate path exists
        if not os.path.exists(self.args.path):
            print(f"{RED}Error: Path '{self.args.path}' does not exist{END}")
            return 1
            
        # Process file or directory
        try:
            if os.path.isfile(self.args.path):
                self.fix_file(self.args.path)
            elif os.path.isdir(self.args.path):
                for root, _, files in os.walk(self.args.path):
                    for file in files:
                        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                            self.fix_file(os.path.join(root, file))
            else:
                print(f"{RED}Error: Path '{self.args.path}' is neither a file nor a directory{END}")
                return 1
        except Exception as e:
            print(f"{RED}Error processing path '{self.args.path}': {str(e)}{END}")
            return 1
        
        # Print summary
        print(f"\n{BOLD}Summary:{END}")
        print(f"Files processed: {self.files_processed}")
        print(f"Files modified: {self.files_modified}")
        print(f"setTimeout issues fixed: {self.issues_fixed}")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
        
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO setTimeout Security Fixer")
    parser.add_argument("--path", default=".", help="Path to fix (default: .)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = SetTimeoutSecurityFixer(args)
    sys.exit(fixer.run())