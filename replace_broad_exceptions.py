#!/usr/bin/env python3
"""
Replace broad exception handlers in the ALEJO codebase.
This script analyzes and optionally modifies Python files to replace 'except Exception:'
patterns with more specific exception handlers based on the context.

Usage:
    python replace_broad_exceptions.py [--path PATH] [--dry-run] [--verbose] [--file FILE]
"""

import argparse
import ast
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional


class ContextAnalyzer:
    """Analyzes code context to suggest appropriate exception types"""
    
    # Maps common operations to appropriate exception types
    OPERATION_TO_EXCEPTION = {
        # File operations
        'open': ['FileNotFoundError', 'PermissionError', 'IOError'],
        'read': ['IOError', 'UnicodeDecodeError'],
        'write': ['IOError', 'PermissionError'],
        
        # Network operations
        'requests': ['requests.exceptions.RequestException', 'requests.exceptions.ConnectionError', 
                    'requests.exceptions.Timeout', 'requests.exceptions.HTTPError'],
        'socket': ['socket.error', 'ConnectionRefusedError', 'ConnectionResetError', 'TimeoutError'],
        'urllib': ['urllib.error.URLError', 'urllib.error.HTTPError'],
        'http': ['http.client.HTTPException'],
        
        # Database operations
        'sqlite': ['sqlite3.Error', 'sqlite3.IntegrityError', 'sqlite3.OperationalError'],
        'mysql': ['mysql.connector.Error', 'mysql.connector.IntegrityError'],
        'psycopg2': ['psycopg2.Error', 'psycopg2.DatabaseError', 'psycopg2.IntegrityError'],
        'sqlalchemy': ['sqlalchemy.exc.SQLAlchemyError', 'sqlalchemy.exc.IntegrityError', 'sqlalchemy.exc.OperationalError'],
        'redis': ['redis.exceptions.RedisError', 'redis.exceptions.ConnectionError', 'redis.exceptions.TimeoutError'],
        
        # JSON operations
        'json': ['json.JSONDecodeError'],
        
        # OS operations
        'os': ['OSError', 'PermissionError', 'FileNotFoundError'],
        'subprocess': ['subprocess.SubprocessError', 'subprocess.CalledProcessError'],
        
        # Threading/Async
        'asyncio': ['asyncio.CancelledError', 'asyncio.TimeoutError', 'asyncio.InvalidStateError'],
        'threading': ['RuntimeError'],
        
        # Data processing
        'numpy': ['numpy.AxisError', 'numpy.linalg.LinAlgError', 'ValueError'],
        'pandas': ['pandas.errors.EmptyDataError', 'pandas.errors.ParserError', 'ValueError'],
        
        # Image processing
        'PIL': ['PIL.UnidentifiedImageError', 'PIL.Image.DecompressionBombError'],
        'cv2': ['cv2.error'],
        
        # Web frameworks
        'flask': ['werkzeug.exceptions.HTTPException'],
        'django': ['django.core.exceptions.ObjectDoesNotExist', 'django.db.Error'],
        'fastapi': ['fastapi.HTTPException', 'pydantic.ValidationError'],
        
        # ML/AI libraries
        'torch': ['torch.cuda.OutOfMemoryError', 'RuntimeError'],
        'tensorflow': ['tensorflow.errors.OpError', 'tensorflow.errors.ResourceExhaustedError'],
        
        # Generic operations
        'index': ['IndexError'],
        'key': ['KeyError'],
        'attribute': ['AttributeError'],
        'type': ['TypeError'],
        'value': ['ValueError'],
        'import': ['ImportError', 'ModuleNotFoundError'],
        'assertion': ['AssertionError'],
        'memory': ['MemoryError'],
        'name': ['NameError'],
        'zero': ['ZeroDivisionError'],
        'runtime': ['RuntimeError'],
    }
    
    def analyze_try_block(self, code_str: str, try_line: int) -> List[str]:
        """Analyze the try block to suggest appropriate exception types"""
        lines = code_str.split('\n')
        
        # Find the try block
        try_block_start = try_line
        try_block_end = try_line
        
        # Find the start of the try block
        while try_block_start >= 0 and 'try:' not in lines[try_block_start]:
            try_block_start -= 1
            
        if try_block_start < 0:
            return ['ValueError', 'TypeError']  # Default if we can't find the try block
            
        # Find the end of the try block (before the except)
        indent_level = len(lines[try_block_start]) - len(lines[try_block_start].lstrip())
        try_block_end = try_block_start + 1
        while try_block_end < len(lines) and (
               'except' not in lines[try_block_end] or 
               len(lines[try_block_end]) - len(lines[try_block_end].lstrip()) > indent_level):
            try_block_end += 1
            
        # Extract the try block content
        try_content = '\n'.join(lines[try_block_start+1:try_block_end])
        
        # Look for patterns suggesting specific exceptions
        suggested_exceptions = []
        
        for op, exceptions in self.OPERATION_TO_EXCEPTION.items():
            if op in try_content:
                suggested_exceptions.extend(exceptions)
                
        # If we found JSON operations
        if 'json.loads' in try_content or 'json.dumps' in try_content:
            suggested_exceptions.append('json.JSONDecodeError')
            
        # If we found file operations
        if re.search(r'open\([\'\"]', try_content):
            suggested_exceptions.extend(['FileNotFoundError', 'PermissionError'])
            
        # If we found dict access with square brackets
        if re.search(r'\w+\[\w+\]', try_content):
            suggested_exceptions.append('KeyError')
            
        # If we found list/array indexing
        if re.search(r'\w+\[\d+\]', try_content):
            suggested_exceptions.append('IndexError')
            
        # If we found attribute access
        if re.search(r'\w+\.\w+', try_content):
            suggested_exceptions.append('AttributeError')
            
        # If we found type conversions
        if re.search(r'int\(|float\(|str\(', try_content):
            suggested_exceptions.append('ValueError')
            
        # If we found division
        if re.search(r'/|\s+\/\s+', try_content):
            suggested_exceptions.append('ZeroDivisionError')
            
        # Remove duplicates while preserving order
        unique_exceptions = []
        for exc in suggested_exceptions:
            if exc not in unique_exceptions:
                unique_exceptions.append(exc)
                
        # If we couldn't find anything specific
        if not unique_exceptions:
            unique_exceptions = ['ValueError', 'TypeError', 'RuntimeError']
            
        return unique_exceptions


class BroadExceptionReplacer:
    """Finds and replaces broad exception handlers"""
    
    def __init__(self, dry_run: bool = True, verbose: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose
        if verbose:
            print(f"BroadExceptionReplacer initialized with dry_run={dry_run}")
        self.context_analyzer = ContextAnalyzer()
        
    def find_and_analyze(self, file_path: str) -> List[Tuple[int, List[str]]]:
        """Find broad exceptions and analyze what specific types should replace them"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # First pass: use AST to find line numbers of broad except handlers
            tree = ast.parse(content)
            visitor = BroadExceptionVisitor()
            visitor.visit(tree)
            
            # Second pass: analyze the context around each broad except
            results = []
            for line_number in visitor.broad_excepts:
                suggested_exceptions = self.context_analyzer.analyze_try_block(content, line_number)
                results.append((line_number, suggested_exceptions))
                
            return results
        except Exception as e:
            if self.verbose:
                print(f"Error analyzing {file_path}: {str(e)}")
            return []
            
    def replace_in_file(self, file_path: str, line_exceptions_map: List[Tuple[int, List[str]]]) -> bool:
        """Replace broad exception handlers with specific ones in the file"""
        try:
            if self.verbose:
                print(f"Attempting to replace exceptions in {file_path} (dry_run={self.dry_run})")
                
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            modified = False
            for line_num, exceptions in line_exceptions_map:
                # Account for 0-indexing in line arrays vs 1-indexing in AST
                idx = line_num - 1
                if idx >= 0 and idx < len(lines) and 'except Exception:' in lines[idx]:
                    # Use the first two suggested exceptions to avoid overly complex handlers
                    if exceptions:
                        exc_list = ', '.join(exceptions[:2])
                        lines[idx] = lines[idx].replace('except Exception:', f'except ({exc_list}):')
                        modified = True
                        if self.verbose:
                            print(f"  Modified line {line_num}: {lines[idx].strip()}")
                        
            # Apply changes if modified and not in dry-run mode
            if modified:
                if not self.dry_run:
                    if self.verbose:
                        print(f"Applying changes to {file_path}")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.writelines(lines)
                    return True
                else:
                    if self.verbose:
                        print(f"Would apply changes to {file_path} (dry run mode)")
                    return False
            else:
                if self.verbose:
                    print(f"No changes needed in {file_path}")
                return False
        except Exception as e:
            if self.verbose:
                print(f"Error replacing exceptions in {file_path}: {str(e)}")
            return False


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


def process_file(file_path: str, dry_run: bool = True, verbose: bool = False) -> Dict[str, any]:
    """Process a single file to find and optionally replace broad exception handlers"""
    if verbose:
        print(f"Processing file with dry_run={dry_run}")
    
    replacer = BroadExceptionReplacer(dry_run, verbose)
    
    # Find and analyze
    exception_locations = replacer.find_and_analyze(file_path)
    
    if not exception_locations:
        return {'file': file_path, 'count': 0, 'modified': False, 'details': []}
        
    # Replace if needed
    modified = replacer.replace_in_file(file_path, exception_locations)
    
    details = []
    for line, exceptions in exception_locations:
        exc_str = ', '.join(exceptions[:2]) if exceptions else 'No suggestion'
        details.append({'line': line, 'suggested': exc_str})
        
    return {
        'file': file_path,
        'count': len(exception_locations),
        'modified': modified,
        'details': details
    }


def process_directory(directory: str, dry_run: bool = True, verbose: bool = False) -> List[Dict[str, any]]:
    """Process all Python files in a directory recursively"""
    if verbose:
        print(f"Processing directory {directory} with dry_run={dry_run}")
        
    results = []
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                result = process_file(file_path, dry_run, verbose)
                if result['count'] > 0:
                    results.append(result)
                    
    return results


def main():
    parser = argparse.ArgumentParser(description='Replace broad exception handlers with specific ones')
    parser.add_argument('--path', default='alejo', help='Path to scan (default: alejo)')
    parser.add_argument('--dry-run', action='store_true', help='Only analyze without modifying files')
    parser.add_argument('--apply', action='store_true', help='Apply changes (disables dry-run mode)')
    parser.add_argument('--verbose', action='store_true', help='Show detailed output')
    parser.add_argument('--file', help='Process a single file instead of a directory')
    args = parser.parse_args()
    
    # If --apply is specified, disable dry-run mode
    dry_run = not args.apply
    
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File '{args.file}' does not exist")
            return 1
            
        print(f"Processing file {args.file}...")
        print(f"Dry run mode: {dry_run}")
        result = process_file(args.file, dry_run, args.verbose)
        if result['count'] > 0:
            print(f"\n{result['file']}:")
            for detail in result['details']:
                print(f"  Line {detail['line']}: except Exception: -> except ({detail['suggested']}):")
                
        print(f"\nFound {result['count']} broad exception handlers")
        if not dry_run:
            print(f"Modified: {'Yes' if result['modified'] else 'No'}")
    else:
        if not os.path.exists(args.path):
            print(f"Error: Path '{args.path}' does not exist")
            return 1
            
        print(f"Processing directory {args.path}...")
        results = process_directory(args.path, dry_run, args.verbose)
        
        total_files = 0
        total_broad_excepts = 0
        total_modified = 0
        
        for result in results:
            if result['count'] > 0:
                total_files += 1
                total_broad_excepts += result['count']
                if result['modified']:
                    total_modified += 1
                    
                print(f"\n{result['file']}:")
                for detail in result['details']:
                    print(f"  Line {detail['line']}: except Exception: -> except ({detail['suggested']}):")
        
        print(f"\nFound {total_broad_excepts} broad exception handlers in {total_files} files")
        if not dry_run:
            print(f"Modified {total_modified} files")
        
        if dry_run:
            print("\nThis was a dry run. No files were modified.")
            print("Run with --apply to apply the changes.")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())