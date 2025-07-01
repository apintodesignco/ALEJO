#!/usr/bin/env python3
"""
Find remaining broad exception handlers in the ALEJO codebase.
This script analyzes Python files to find 'except Exception:' patterns that may need to be replaced
with more specific exception handling.

Usage:
    python find_broad_except.py [--path PATH] [--verbose]
"""

import argparse
import ast
import os
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple


class BroadExceptionVisitor(ast.NodeVisitor):
    """AST visitor to find broad exception handlers"""
    
    def __init__(self):
        self.broad_excepts = []
        
    def visit_ExceptHandler(self, node):
        # Check if this is a broad exception handler
        if isinstance(node.type, ast.Name) and node.type.id == 'Exception':
            line_number = node.lineno
            self.broad_excepts.append(line_number)
        self.generic_visit(node)


def analyze_file(file_path: str, verbose: bool = False) -> List[int]:
    """Analyze a file for broad exception handlers"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        tree = ast.parse(content)
        visitor = BroadExceptionVisitor()
        visitor.visit(tree)
        
        if visitor.broad_excepts and verbose:
            print(f"Found {len(visitor.broad_excepts)} broad exception handlers in {file_path}")
            for line in visitor.broad_excepts:
                print(f"  Line {line}: except Exception:")
                
        return visitor.broad_excepts
    except SyntaxError:
        if verbose:
            print(f"Syntax error in {file_path}, skipping")
        return []
    except Exception as e:
        if verbose:
            print(f"Error analyzing {file_path}: {str(e)}")
        return []


def scan_directory(directory: str, verbose: bool = False) -> Dict[str, List[int]]:
    """Scan a directory for Python files with broad exception handlers"""
    results = {}
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                broad_excepts = analyze_file(file_path, verbose)
                if broad_excepts:
                    results[file_path] = broad_excepts
                    
    return results


def main():
    parser = argparse.ArgumentParser(description='Find broad exception handlers in Python code')
    parser.add_argument('--path', default='alejo', help='Path to scan (default: alejo)')
    parser.add_argument('--verbose', action='store_true', help='Show detailed output')
    args = parser.parse_args()
    
    if not os.path.exists(args.path):
        print(f"Error: Path '{args.path}' does not exist")
        return 1
        
    print(f"Scanning {args.path} for broad exception handlers...")
    results = scan_directory(args.path, args.verbose)
    
    total_files = 0
    total_broad_excepts = 0
    
    for file_path, broad_excepts in results.items():
        if broad_excepts:
            total_files += 1
            total_broad_excepts += len(broad_excepts)
            print(f"\n{file_path}:")
            for line in broad_excepts:
                print(f"  Line {line}: except Exception:")
    
    print(f"\nFound {total_broad_excepts} broad exception handlers in {total_files} files")
    print("Consider replacing these with more specific exception types.")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())