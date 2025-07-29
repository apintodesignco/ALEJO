import os
import sys
import json
import hashlib
from pathlib import Path
from collections import defaultdict

# Configuration
IGNORE_DIRS = [
    "__pycache__",
    "node_modules",
    ".git",
    "venv",
    "env",
    "dist",
    "build",
    "backups",
    ".vscode",
    ".idea"
]

IGNORE_FILES = [
    ".gitignore",
    "package-lock.json",
    "yarn.lock"
]

IGNORE_EXTENSIONS = [
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".ico",
    # Videos
    ".mp4", ".mov", ".avi", ".mkv",
    # Audio
    ".mp3", ".wav", ".ogg",
    # Archives
    ".zip", ".rar", ".7z", ".tar", ".gz",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    # Binaries
    ".exe", ".dll", ".so", ".obj", ".lib", ".a",
    # Databases
    ".db", ".sqlite3"
]

def hash_file_content(file_path):
    """Generate a hash of the file content"""
    with open(file_path, 'rb') as f:
        content = f.read()
        return hashlib.sha256(content).hexdigest()

def find_duplicate_files(root_dir):
    """Find duplicate files based on content hash"""
    file_hashes = defaultdict(list)
    
    print("Starting file scan...")
    for root, dirs, files in os.walk(root_dir):
        print(f"Scanning: {root}", end='\r')
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for filename in files:
            if filename in IGNORE_FILES:
                continue
            
            if any(filename.endswith(ext) for ext in IGNORE_EXTENSIONS):
                continue
                
            file_path = os.path.join(root, filename)
            
            try:
                file_hash = hash_file_content(file_path)
                file_hashes[file_hash].append(file_path)
            except Exception as e:
                print(f"\nError processing {file_path}: {e}")
    
    print("\nFile scan complete.")
    # Filter out unique files
    duplicate_groups = {h: paths for h, paths in file_hashes.items() if len(paths) > 1}
    
    return duplicate_groups

def main():
    """Main function"""
    root_dir = os.getcwd()
    
    print(f"Analyzing code duplication in {root_dir}...")
    
    duplicate_groups = find_duplicate_files(root_dir)
    
    # Count duplicates
    total_duplicate_groups = len(duplicate_groups)
    total_duplicate_files = sum(len(paths) - 1 for paths in duplicate_groups.values())
    
    print(f"Found {total_duplicate_groups} duplicate groups with {total_duplicate_files} duplicate files")
    
    # Print duplicate groups
    if total_duplicate_groups > 0:
        for hash_val, paths in duplicate_groups.items():
            print(f"\nDuplicate group (hash: {hash_val[:7]}):")
            for path in paths:
                print(f"  {path}")

if __name__ == "__main__":
    main()
