#!/usr/bin/env python3
"""
ALEJO Pseudorandom Security Fix

This script fixes insecure random number generation in Python files by:
1. Replacing standard 'random' module usage with 'secrets' module for security-sensitive operations
2. Documenting safer alternatives for cryptographic purposes
3. Preserving non-security related random usage

Usage:
    python fix_random_issues.py [options]

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


class RandomSecurityFixer:
    """Main class for fixing insecure random number generation in Python code"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.files_processed = 0
        self.files_modified = 0
        self.issues_fixed = 0
        self.security_terms = [
            'token', 'key', 'secret', 'password', 'hash', 'salt', 'crypto', 'secure',
            'auth', 'authentication', 'session', 'id', 'uuid', 'identifier', 'nonce'
        ]
        
    def fix_file(self, file_path: str) -> bool:
        """Fix random issues in a single Python file"""
        if not file_path.endswith('.py'):
            return False
            
        self.files_processed += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
                
            # Make a copy of the original content to check if changes were made
            original_content = content
            modified_lines = []
            has_random_import = False
            has_secrets_import = False
            security_context = False
            
            # First pass: Check for imports and security context
            for line in lines:
                if re.search(r'import\s+random\b|from\s+random\s+import', line):
                    has_random_import = True
                
                if re.search(r'import\s+secrets\b|from\s+secrets\s+import', line):
                    has_secrets_import = True
                    
                # Check if file deals with security
                for term in self.security_terms:
                    if term in line.lower() and not line.strip().startswith('#'):
                        security_context = True
                        break
            
            # Second pass: Fix issues
            for i, line in enumerate(lines):
                fixed_line = line
                
                # Skip comments
                if line.strip().startswith('#'):
                    modified_lines.append(line)
                    continue
                
                # Check for security-sensitive random usage
                if security_context:
                    # Replace random.random() with secrets.randbelow() / 2**32 or similar
                    fixed_line = re.sub(
                        r'random\.random\(\)',
                        r'secrets.randbelow(2**32) / (2**32)',
                        fixed_line
                    )
                    
                    # Replace random.randint with secrets.randbelow
                    randint_pattern = r'random\.randint\((\d+),\s*(\d+)\)'
                    match = re.search(randint_pattern, fixed_line)
                    if match:
                        min_val, max_val = match.groups()
                        range_val = int(max_val) - int(min_val) + 1
                        replacement = f"(secrets.randbelow({range_val}) + {min_val})"
                        fixed_line = re.sub(randint_pattern, replacement, fixed_line)
                    
                    # Replace random.choice with secrets.choice
                    fixed_line = re.sub(
                        r'random\.choice\(([^)]+)\)',
                        r'secrets.choice(\1)',
                        fixed_line
                    )
                
                # Check if the line was modified
                if fixed_line != line:
                    self.issues_fixed += 1
                    
                modified_lines.append(fixed_line)
            
            # Add secrets import if needed
            if self.issues_fixed > 0 and not has_secrets_import:
                if has_random_import:
                    # Add secrets import next to random import
                    for i, line in enumerate(modified_lines):
                        if re.search(r'import\s+random\b', line):
                            modified_lines[i] = line + "\nimport secrets  # More secure for cryptographic purposes"
                            break
                        elif re.search(r'from\s+random\s+import', line):
                            modified_lines[i] = line + "\nimport secrets  # More secure for cryptographic purposes"
                            break
                else:
                    # Add secrets import at the top of the file, after other imports
                    import_section_end = 0
                    for i, line in enumerate(modified_lines):
                        if re.match(r'import\s+|from\s+.+\s+import', line):
                            import_section_end = i + 1
                    
                    modified_lines.insert(import_section_end, "import secrets  # More secure for cryptographic purposes")
            
            # Join lines back into content
            modified_content = '\n'.join(modified_lines)
            
            # Check if content was modified
            if modified_content != original_content:
                self.files_modified += 1
                if not self.args.dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(modified_content)
                    print(f"{GREEN}✓ Fixed random module issues in {file_path}{END}")
                else:
                    print(f"{BLUE}Would fix random module issues in {file_path}{END}")
                return True
            else:
                if self.args.verbose:
                    print(f"{BLUE}No random module issues to fix in {file_path}{END}")
                return False
                
        except Exception as e:
            print(f"{RED}Error processing {file_path}: {str(e)}{END}")
            return False
    
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
                        if file.endswith('.py'):
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
        print(f"Random module issues fixed: {self.issues_fixed}")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
        
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO Random Security Fixer")
    parser.add_argument("--path", default=".", help="Path to fix (default: .)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = RandomSecurityFixer(args)
    sys.exit(fixer.run())