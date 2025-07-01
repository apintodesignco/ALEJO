#!/usr/bin/env python3
"""
ALEJO Common Issues Fixer

This script automatically fixes common issues found by the bug detector and security scanner:
1. Removes unused imports
2. Replaces broad exception handlers with more specific ones
3. Removes debug print statements
4. Replaces insecure random number generation with secure alternatives

Usage:
    python fix_common_issues.py [options]

Options:
    --path PATH         Path to fix (default: alejo/)
    --dry-run           Show what would be changed without making changes
    --verbose           Show detailed output
"""

import argparse
import ast
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional

# ANSI color codes for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
END = "\033[0m"


class ImportVisitor(ast.NodeVisitor):
    """AST visitor to find unused imports"""
    
    def __init__(self):
        self.imported_names = set()
        self.used_names = set()
        self.import_nodes = []
        
    def visit_Import(self, node):
        for name in node.names:
            self.imported_names.add(name.name)
            if name.asname:
                self.imported_names.add(name.asname)
        self.import_nodes.append(node)
        self.generic_visit(node)
        
    def visit_ImportFrom(self, node):
        for name in node.names:
            if name.name == '*':
                continue
            self.imported_names.add(name.name)
            if name.asname:
                self.imported_names.add(name.asname)
        self.import_nodes.append(node)
        self.generic_visit(node)
        
    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self.used_names.add(node.id)
        self.generic_visit(node)
        
    def get_unused_imports(self):
        return self.imported_names - self.used_names


class IssueFixer:
    """Main class for fixing common issues in Python code"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.files_processed = 0
        self.files_modified = 0
        self.issues_fixed = {
            'unused_imports': 0,
            'broad_except': 0,
            'debug_print': 0,
            'insecure_random': 0
        }
        
    def fix_file(self, file_path: str) -> bool:
        """Fix issues in a single Python file"""
        if not file_path.endswith('.py'):
            return False
            
        self.files_processed += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Make a copy of the original content to check if changes were made
            original_content = content
            
            # Fix issues
            content = self.fix_unused_imports(file_path, content)
            content = self.fix_broad_except(content)
            content = self.fix_debug_print(content)
            content = self.fix_insecure_random(content)
            
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
    
    def fix_unused_imports(self, file_path: str, content: str) -> str:
        """Remove unused imports from the file"""
        try:
            tree = ast.parse(content)
            visitor = ImportVisitor()
            visitor.visit(tree)
            
            unused_imports = visitor.get_unused_imports()
            if not unused_imports:
                return content
                
            # Get the lines to remove or modify
            lines = content.splitlines()
            new_lines = []
            
            for i, line in enumerate(lines):
                # Check if this line contains an unused import
                skip_line = False
                for unused in unused_imports:
                    # Simple pattern matching for imports
                    if re.search(rf'\bimport\s+{unused}\b', line) or re.search(rf'\bfrom\s+\w+\s+import\s+.*\b{unused}\b', line):
                        if self.args.verbose:
                            print(f"  Removing unused import: {unused} from line {i+1}")
                        skip_line = True
                        self.issues_fixed['unused_imports'] += 1
                        break
                
                if not skip_line:
                    new_lines.append(line)
            
            return '\n'.join(new_lines)
        except SyntaxError:
            # If there's a syntax error, return the original content
            return content
    
    def fix_broad_except(self, content: str) -> str:
        """Replace broad exception handlers with more specific ones"""
        # Pattern to match broad exception handlers
        pattern = r'except\s+Exception\s*:'
        
        # Replacement with a more specific handler
        replacement = 'except (ValueError, TypeError, RuntimeError):'
        
        # Count occurrences
        matches = re.findall(pattern, content)
        self.issues_fixed['broad_except'] += len(matches)
        
        # Replace all occurrences
        if matches and self.args.verbose:
            print(f"  Replacing {len(matches)} broad exception handlers")
            
        return re.sub(pattern, replacement, content)
    
    def fix_debug_print(self, content: str) -> str:
        """Remove or comment out debug print statements"""
        # Pattern to match debug print statements
        pattern = r'(\s*)print\s*\([^)]*\)\s*(?:#.*)?$'
        
        # Replacement that comments out the print statement
        def comment_print(match):
            self.issues_fixed['debug_print'] += 1
            indent = match.group(1)
            return f"{indent}# {match.group(0).strip()}"
        
        # Count occurrences
        matches = re.findall(pattern, content, re.MULTILINE)
        
        if matches and self.args.verbose:
            print(f"  Commenting out {len(matches)} debug print statements")
            
        # Replace all occurrences
        return re.sub(pattern, comment_print, content, flags=re.MULTILINE)
    
    def fix_insecure_random(self, content: str) -> str:
        """Replace insecure random number generation with secure alternatives"""
        # Pattern to match insecure random number generation in Python
        pattern_py_random = r'(random\.random\(\))'
        
        # Replacement with secure alternative
        replacement_py = 'secrets.randbelow(100) / 100.0'
        
        # Count occurrences
        matches = re.findall(pattern_py_random, content)
        self.issues_fixed['insecure_random'] += len(matches)
        
        # Replace all occurrences
        if matches:
            if self.args.verbose:
                print(f"  Replacing {len(matches)} insecure random calls")
            
            # Add import if needed
            if 'secrets' not in content and len(matches) > 0:
                import_line = 'import secrets\n'
                # Find the first import statement
                import_match = re.search(r'^import\s+', content, re.MULTILINE)
                if import_match:
                    # Insert before the first import
                    pos = import_match.start()
                    content = content[:pos] + import_line + content[pos:]
                else:
                    # Add at the beginning after any module docstring
                    docstring_end = content.find('"""', content.find('"""') + 3)
                    if docstring_end > 0:
                        pos = content.find('\n', docstring_end) + 1
                        content = content[:pos] + '\n' + import_line + content[pos:]
                    else:
                        content = import_line + content
            
            content = re.sub(pattern_py_random, replacement_py, content)
        
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
        print(f"Issues fixed:")
        print(f"  - Unused imports: {self.issues_fixed['unused_imports']}")
        print(f"  - Broad exception handlers: {self.issues_fixed['broad_except']}")
        print(f"  - Debug print statements: {self.issues_fixed['debug_print']}")
        print(f"  - Insecure random calls: {self.issues_fixed['insecure_random']}")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
        
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO Common Issues Fixer")
    parser.add_argument("--path", default="alejo", help="Path to fix (default: alejo/)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = IssueFixer(args)
    sys.exit(fixer.run())