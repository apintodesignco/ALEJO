#!/usr/bin/env python
"""
ALEJO Duplicate File Finder

This script scans the ALEJO project to identify duplicate files based on content.
It uses file hashing to detect identical files regardless of name or location.
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


def find_duplicate_files(directory: str, exclude_dirs: List[str] = None, 
                         file_extensions: List[str] = None) -> Dict[str, List[str]]:
    """
    Find duplicate files in a directory based on content hash.
    
    Args:
        directory: Root directory to scan
        exclude_dirs: List of directory names to exclude (e.g., '.git', 'node_modules')
        file_extensions: List of file extensions to include (e.g., '.py', '.js')
        
    Returns:
        Dictionary mapping file hashes to lists of duplicate file paths
    """
    if exclude_dirs is None:
        exclude_dirs = ['.git', 'node_modules', '__pycache__', '.venv', 'venv']
    
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
            total_files += 1
    
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
                file_hash = get_file_hash(filepath)
                hash_to_files[file_hash].append(filepath)
                
                processed_files += 1
                if processed_files % 100 == 0 or processed_files == total_files:
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
            
            # Count by top-level directory
            top_dir = Path(filepath).parts[1] if len(Path(filepath).parts) > 1 else "root"
            duplicate_stats["directory_stats"][top_dir] += 1
        
        # Generate refactoring suggestions
        if len(file_list) > 1:
            # Simple suggestion: keep the file with the shortest path
            shortest_path = min(file_list, key=len)
            other_paths = [p for p in file_list if p != shortest_path]
            
            refactoring_suggestions[hash_val] = {
                "keep": shortest_path,
                "remove_or_refactor": other_paths,
                "suggestion": "Consider keeping the file with the shortest path and refactoring others to import/reference it"
            }
    
    return dict(duplicate_stats), refactoring_suggestions


def main():
    parser = argparse.ArgumentParser(description="Find duplicate files in the ALEJO project")
    parser.add_argument("--directory", "-d", default=".", help="Root directory to scan")
    parser.add_argument("--exclude", "-e", nargs="+", default=None, 
                        help="Directories to exclude (default: .git, node_modules, __pycache__, .venv, venv)")
    parser.add_argument("--extensions", "-x", nargs="+", default=None,
                        help="File extensions to include (e.g., .py .js)")
    parser.add_argument("--output", "-o", default="duplicate_files_report.json",
                        help="Output JSON file for the duplicate report")
    args = parser.parse_args()
    
    print(f"Scanning directory: {args.directory}")
    if args.extensions:
        print(f"Including only files with extensions: {', '.join(args.extensions)}")
    if args.exclude:
        print(f"Excluding directories: {', '.join(args.exclude)}")
    
    duplicates = find_duplicate_files(
        args.directory, 
        exclude_dirs=args.exclude,
        file_extensions=args.extensions
    )
    
    if not duplicates:
        print("No duplicate files found!")
        return
    
    print(f"\nFound {len(duplicates)} groups of duplicate files:")
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
    print("\nExample duplicate groups:")
    for i, (hash_val, file_list) in enumerate(list(duplicates.items())[:3]):
        print(f"\nGroup {i+1} (hash: {hash_val[:8]}...):")
        for file in file_list:
            print(f"  {file}")
        
        suggestion = suggestions[hash_val]
        print(f"  Suggestion: Keep {suggestion['keep']}")
    
    if len(duplicates) > 3:
        print(f"\n... and {len(duplicates) - 3} more groups. See the JSON report for details.")


if __name__ == "__main__":
    main()
