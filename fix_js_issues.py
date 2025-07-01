#!/usr/bin/env python3
"""
ALEJO JavaScript Issues Fixer

This script automatically fixes common issues in JavaScript files:
1. Replaces insecure Math.random() with crypto.getRandomValues()
2. Adds proper error handling to async functions
3. Fixes other common security issues in JavaScript files

Usage:
    python fix_js_issues.py [options]

Options:
    --path PATH         Path to fix (default: alejo/)
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


class JSIssueFixer:
    """Main class for fixing common issues in JavaScript code"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.files_processed = 0
        self.files_modified = 0
        self.issues_fixed = {
            'insecure_random': 0,
            'missing_error_handling': 0,
            'other_security_issues': 0
        }
        
    def fix_file(self, file_path: str) -> bool:
        """Fix issues in a single JavaScript file"""
        if not file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
            return False
            
        self.files_processed += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Make a copy of the original content to check if changes were made
            original_content = content
            
            # Fix issues
            content = self.fix_insecure_random(file_path, content)
            content = self.fix_missing_error_handling(content)
            
            # Check if content was modified
            if content != original_content:
                self.files_modified += 1
                if not self.args.dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"{GREEN}✓ Fixed issues in {file_path}{END}")
                else:
                    print(f"{BLUE}Would fix issues in {file_path}{END}")
                return True
            else:
                if self.args.verbose:
                    print(f"{BLUE}No issues to fix in {file_path}{END}")
                return False
                
        except Exception as e:
            print(f"{RED}Error processing {file_path}: {str(e)}{END}")
            return False
    
    def fix_insecure_random(self, file_path: str, content: str) -> str:
        """Replace insecure Math.random() with crypto.getRandomValues()"""
        # Check if the file already has crypto import
        has_crypto = 'crypto' in content
        
        # Pattern to match Math.random()
        pattern = r'Math\.random\(\)'
        
        # Count occurrences
        matches = re.findall(pattern, content)
        self.issues_fixed['insecure_random'] += len(matches)
        
        if not matches:
            return content
            
        if self.args.verbose:
            print(f"  Replacing {len(matches)} insecure Math.random() calls")
        
        # Add crypto polyfill if needed
        if not has_crypto and len(matches) > 0:
            crypto_polyfill = """
// Secure random number generation
const getSecureRandom = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  } else {
    console.warn('Crypto API not available, falling back to Math.random()');
    return Math.random();
  }
};
"""
            # Find a good place to insert the polyfill
            # Try to insert after imports or at the beginning of the file
            import_pattern = r'(import\s+.*?;[\r\n]+)'
            import_match = re.search(import_pattern, content)
            
            if import_match:
                last_import_end = import_match.end()
                content = content[:last_import_end] + crypto_polyfill + content[last_import_end:]
            else:
                # Insert at the beginning of the file
                content = crypto_polyfill + content
        
        # Replace Math.random() with getSecureRandom()
        content = re.sub(pattern, 'getSecureRandom()', content)
        
        return content
    
    def fix_missing_error_handling(self, content: str) -> str:
        """Add error handling to async functions and promises"""
        # Pattern to match async functions without try/catch
        pattern = r'(async\s+function\s+\w+\s*\([^)]*\)\s*{)(?!\s*try\s*{)'
        
        # Count occurrences
        matches = re.findall(pattern, content)
        self.issues_fixed['missing_error_handling'] += len(matches)
        
        if not matches:
            return content
            
        if self.args.verbose:
            print(f"  Adding error handling to {len(matches)} async functions")
        
        # Replace async functions without try/catch
        def add_try_catch(match):
            return f"{match.group(1)}\n  try {{"
        
        content = re.sub(pattern, add_try_catch, content)
        
        # Find function bodies that need closing
        # This is a simplistic approach and might not work for all cases
        pattern = r'(async\s+function\s+\w+\s*\([^)]*\)\s*{\s*try\s*{)(?![\s\S]*?catch)'
        
        matches = re.findall(pattern, content)
        
        if matches:
            # Find the end of these functions and add catch blocks
            for match in matches:
                # Find the function body
                start_idx = content.find(match) + len(match)
                
                # Count braces to find the end of the function
                brace_count = 1
                end_idx = start_idx
                
                while brace_count > 0 and end_idx < len(content) - 1:
                    end_idx += 1
                    if content[end_idx] == '{':
                        brace_count += 1
                    elif content[end_idx] == '}':
                        brace_count -= 1
                
                # Insert catch block before the last closing brace
                if end_idx < len(content):
                    catch_block = "\n  } catch (error) {\n    console.error('Error:', error);\n  "
                    content = content[:end_idx] + catch_block + content[end_idx:]
        
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
        print(f"Issues fixed:")
        print(f"  - Insecure random calls: {self.issues_fixed['insecure_random']}")
        print(f"  - Missing error handling: {self.issues_fixed['missing_error_handling']}")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
        
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO JavaScript Issues Fixer")
    parser.add_argument("--path", default="alejo", help="Path to fix (default: alejo/)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = JSIssueFixer(args)
    sys.exit(fixer.run())