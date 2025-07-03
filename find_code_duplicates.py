#!/usr/bin/env python
"""
ALEJO Code Duplicate Finder

This script scans the ALEJO project to identify duplicate code files.
It uses file hashing to detect identical files and excludes empty files.
"""

import os
import hashlib
import argparse
from pathlib import Path
from collections import defaultdict
import json
from typing import Dict, List, Set, Tuple


def get_file_hash(filepath: str, block_size: int = 65536) -> str:
    """
    Calculate the SHA-256 hash of a file.
    
    Args:
        filepath: Path to the file
        block_size: Size of blocks to read for large files
        
    Returns:
        Hexadecimal string representation of the file hash
    """
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as file:
        buf = file.read(block_size)
        while len(buf) > 0:
            hasher.update(buf)
            buf = file.read(block_size)
    return hasher.hexdigest()


def is_empty_file(filepath: str) -> bool:
    """
    Check if a file is empty or contains only whitespace.
    
    Args:
        filepath: Path to the file
        
    Returns:
        True if the file is empty or contains only whitespace
    """
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read().strip()
            return len(content) == 0
    except:
        # If we can't read it as text, it's not empty
        return False


def find_duplicate_files(directory: str, exclude_dirs: List[str] = None, 
                         file_extensions: List[str] = None, 
                         min_size: int = 10) -> Dict[str, List[str]]:
    """
    Find duplicate files in a directory based on content hash.
    
    Args:
        directory: Root directory to scan
        exclude_dirs: List of directory names to exclude (e.g., '.git', 'node_modules')
        file_extensions: List of file extensions to include (e.g., '.py', '.js')
        min_size: Minimum file size in bytes to consider (to exclude empty files)
        
    Returns:
        Dictionary mapping file hashes to lists of duplicate file paths
    """
    if exclude_dirs is None:
        exclude_dirs = ['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'backups']
    
    hash_to_files = defaultdict(list)
    root_path = Path(directory)
    
    # Track progress
    total_files = 0
    processed_files = 0
    
    # First count total files for progress reporting
    for root, dirs, files in os.walk(directory):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file_extensions and not any(file.endswith(ext) for ext in file_extensions):
                continue
            
            filepath = os.path.join(root, file)
            try:
                if os.path.getsize(filepath) >= min_size:
                    total_files += 1
            except:
                pass
    
    print(f"Scanning {total_files} files for duplicates...")
    
    # Now process files
    for root, dirs, files in os.walk(directory):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file_extensions and not any(file.endswith(ext) for ext in file_extensions):
                continue
                
            filepath = os.path.join(root, file)
            try:
                # Skip files smaller than min_size
                if os.path.getsize(filepath) < min_size:
                    continue
                    
                # Skip empty files
                if is_empty_file(filepath):
                    continue
                
                file_hash = get_file_hash(filepath)
                hash_to_files[file_hash].append(filepath)
                
                processed_files += 1
                if processed_files % 50 == 0 or processed_files == total_files:
                    print(f"Processed {processed_files}/{total_files} files ({processed_files/total_files*100:.1f}%)")
                    
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
    
    # Filter out unique files (no duplicates)
    return {hash_val: file_list for hash_val, file_list in hash_to_files.items() if len(file_list) > 1}


def analyze_duplicates(duplicates: Dict[str, List[str]]) -> Tuple[Dict, Dict]:
    """
    Analyze duplicate files to identify patterns and suggest refactoring.
    
    Args:
        duplicates: Dictionary of file hashes to lists of duplicate file paths
        
    Returns:
        Tuple of (duplicate_stats, refactoring_suggestions)
    """
    duplicate_stats = {
        "total_duplicate_groups": len(duplicates),
        "total_duplicate_files": sum(len(files) - 1 for files in duplicates.values()),
        "extension_stats": defaultdict(int),
        "directory_stats": defaultdict(int)
    }
    
    refactoring_suggestions = {}
    
    for hash_val, file_list in duplicates.items():
        # Count by extension
        for filepath in file_list:
            ext = os.path.splitext(filepath)[1] or "no_extension"
            duplicate_stats["extension_stats"][ext] += 1
            
            # Count by directory structure
            parts = Path(filepath).parts
            if len(parts) > 2:  # Skip root directory
                module_path = os.path.join(*parts[1:3])  # First two levels of directory
                duplicate_stats["directory_stats"][module_path] += 1
        
        # Generate refactoring suggestions
        if len(file_list) > 1:
            # For Python files, suggest creating a common module
            if all(f.endswith('.py') for f in file_list):
                # Find common parent directory
                paths = [Path(f) for f in file_list]
                common_parents = set.intersection(*[set(p.parts[:-1]) for p in paths])
                
                if common_parents:
                    common_parent = os.path.join(*list(common_parents))
                    module_name = Path(file_list[0]).stem
                    suggestion = f"Create a common module '{module_name}' in '{common_parent}' and import it in all locations"
                else:
                    suggestion = "Move duplicate code to a common utility module and import where needed"
            else:
                suggestion = "Consider keeping one copy and referencing it from other locations"
            
            refactoring_suggestions[hash_val] = {
                "files": file_list,
                "suggestion": suggestion
            }
    
    return dict(duplicate_stats), refactoring_suggestions


def print_file_content_preview(filepath: str, max_lines: int = 5) -> None:
    """
    Print a preview of the file content.
    
    Args:
        filepath: Path to the file
        max_lines: Maximum number of lines to print
    """
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()[:max_lines]
            print(f"\nPreview of {filepath}:")
            for line in lines:
                print(f"  {line.rstrip()}")
            if len(lines) == max_lines:
                print("  ...")
    except Exception as e:
        print(f"  Could not read file: {e}")


def main():
    parser = argparse.ArgumentParser(description="Find duplicate code files in the ALEJO project")
    parser.add_argument("--directory", "-d", default=".", help="Root directory to scan")
    parser.add_argument("--exclude", "-e", nargs="+", 
                        default=['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'backups', 'logs', 'tests/reports'],
                        help="Directories to exclude")
    parser.add_argument("--extensions", "-x", nargs="+", default=['.py', '.js', '.html', '.css'],
                        help="File extensions to include")
    parser.add_argument("--min-size", "-m", type=int, default=50,
                        help="Minimum file size in bytes to consider")
    parser.add_argument("--output", "-o", default="code_duplicates_report.json",
                        help="Output JSON file for the duplicate report")
    parser.add_argument("--show-content", "-s", action="store_true",
                        help="Show preview of duplicate file content")
    args = parser.parse_args()
    
    print(f"Scanning directory: {args.directory}")
    print(f"Including only files with extensions: {', '.join(args.extensions)}")
    print(f"Excluding directories: {', '.join(args.exclude)}")
    print(f"Minimum file size: {args.min_size} bytes")
    
    duplicates = find_duplicate_files(
        args.directory, 
        exclude_dirs=args.exclude,
        file_extensions=args.extensions,
        min_size=args.min_size
    )
    
    if not duplicates:
        print("No duplicate code files found!")
        return
    
    print(f"\nFound {len(duplicates)} groups of duplicate code files:")
    total_duplicates = sum(len(files) - 1 for files in duplicates.values())
    print(f"Total duplicate files: {total_duplicates}")
    
    # Analyze duplicates
    stats, suggestions = analyze_duplicates(duplicates)
    
    # Print some stats
    print("\nDuplicate file extensions:")
    for ext, count in sorted(stats["extension_stats"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {ext}: {count} files")
    
    print("\nDuplicate files by directory:")
    for directory, count in sorted(stats["directory_stats"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {directory}: {count} files")
    
    # Save detailed report to JSON
    report = {
        "duplicate_groups": {h: files for h, files in duplicates.items()},
        "statistics": stats,
        "refactoring_suggestions": suggestions
    }
    
    with open(args.output, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDetailed report saved to {args.output}")
    
    # Print example of duplicates
    print("\nDuplicate code groups:")
    for i, (hash_val, file_list) in enumerate(duplicates.items()):
        print(f"\nGroup {i+1} (hash: {hash_val[:8]}...):")
        for file in file_list:
            print(f"  {file}")
        
        suggestion = suggestions[hash_val]["suggestion"]
        print(f"  Refactoring suggestion: {suggestion}")
        
        if args.show_content and i < 3:  # Show content for first 3 groups only
            print_file_content_preview(file_list[0])


if __name__ == "__main__":
    main()
