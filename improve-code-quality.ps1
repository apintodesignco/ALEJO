# ALEJO Code Quality Improvement Script
# This script addresses code duplication, cleans up unnecessary files, and improves code organization

# Set error action preference to stop on any error
$ErrorActionPreference = "Stop"

# ANSI color codes for PowerShell output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success($message) {
    Write-ColorOutput Green "✓ $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "✗ $message"
}

function Write-Warning($message) {
    Write-ColorOutput Yellow "⚠ $message"
}

function Write-Section($title) {
    Write-Output ""
    Write-ColorOutput Cyan "=== $title ==="
    Write-Output ""
}

# Main function
function Main {
    Write-ColorOutput Cyan "ALEJO Code Quality Improvement"
    Write-ColorOutput Cyan "============================="
    Write-Output ""

    # Step 1: Clean up unnecessary backup files
    Clean-BackupFiles

    # Step 2: Fix empty files
    Fix-EmptyFiles

    # Step 3: Update code duplication report
    Update-CodeDuplicationReport

    # Step 4: Flatten nested code structures
    Flatten-NestedCode

    Write-Success "Code quality improvement completed successfully!"
}

# Clean up unnecessary backup files
function Clean-BackupFiles {
    Write-Section "Cleaning Up Backup Files"
    
    # List of backup file patterns to clean up
    $backupPatterns = @(
        "*.bak",
        "*.backup",
        "*.old",
        "*.tmp"
    )
    
    $totalRemoved = 0
    
    foreach ($pattern in $backupPatterns) {
        $files = Get-ChildItem -Path . -Filter $pattern -Recurse -File
        
        foreach ($file in $files) {
            # Skip files in the backups directory
            if ($file.FullName -like "*\backups\*") {
                continue
            }
            
            # Check if there's a corresponding non-backup file
            $originalPath = $file.FullName -replace "\.(bak|backup|old|tmp)$", ""
            
            if (Test-Path $originalPath) {
                Write-Output "Removing backup file: $($file.FullName)"
                Remove-Item $file.FullName -Force
                $totalRemoved++
            }
            else {
                Write-Warning "Skipping backup file without original: $($file.FullName)"
            }
        }
    }
    
    Write-Success "Removed $totalRemoved unnecessary backup files"
}

# Fix empty files
function Fix-EmptyFiles {
    Write-Section "Fixing Empty Files"
    
    # Find empty files
    $emptyFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { $_.Length -eq 0 }
    
    $totalFixed = 0
    
    foreach ($file in $emptyFiles) {
        # Skip files in certain directories
        if ($file.FullName -like "*\node_modules\*" -or 
            $file.FullName -like "*\.git\*" -or 
            $file.FullName -like "*\__pycache__\*") {
            continue
        }
        
        # Handle empty __init__.py files
        if ($file.Name -eq "__init__.py") {
            Write-Output "Fixing empty __init__.py file: $($file.FullName)"
            
            # Add proper content to empty __init__.py files
            $content = @"
"""
ALEJO Module
"""

# Import from common modules if needed
"@
            Set-Content -Path $file.FullName -Value $content
            $totalFixed++
        }
        # Handle empty JavaScript files
        elseif ($file.Extension -eq ".js") {
            Write-Output "Fixing empty JavaScript file: $($file.FullName)"
            
            # Add proper content to empty JS files
            $content = @"
/**
 * ALEJO JavaScript Module
 */

// Add implementation here
"@
            Set-Content -Path $file.FullName -Value $content
            $totalFixed++
        }
        # Handle other empty files
        else {
            Write-Warning "Found empty file: $($file.FullName)"
        }
    }
    
    Write-Success "Fixed $totalFixed empty files"
}

# Update code duplication report
function Update-CodeDuplicationReport {
    Write-Section "Updating Code Duplication Report"
    
    # Create a Python script to analyze code duplication
    $scriptPath = Join-Path $env:TEMP "analyze_code_duplication.py"
    
    $scriptContent = @"
"""
ALEJO Code Duplication Analyzer
This script analyzes the ALEJO codebase for code duplication and generates a report.
"""

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
    "backups"
]

IGNORE_FILES = [
    ".gitignore",
    "package-lock.json",
    "yarn.lock"
]

# File content hash function
def hash_file_content(file_path):
    """Generate a hash of the file content"""
    with open(file_path, 'rb') as f:
        content = f.read()
        return hashlib.sha256(content).hexdigest()

# Find duplicate files
def find_duplicate_files(root_dir):
    """Find duplicate files based on content hash"""
    file_hashes = defaultdict(list)
    
    for root, dirs, files in os.walk(root_dir):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for filename in files:
            if filename in IGNORE_FILES:
                continue
                
            file_path = os.path.join(root, filename)
            
            try:
                file_hash = hash_file_content(file_path)
                file_hashes[file_hash].append(file_path)
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
    
    # Filter out unique files
    duplicate_groups = {h: paths for h, paths in file_hashes.items() if len(paths) > 1}
    
    return duplicate_groups

# Generate statistics
def generate_statistics(duplicate_groups):
    """Generate statistics about duplicate files"""
    total_duplicate_groups = len(duplicate_groups)
    total_duplicate_files = sum(len(paths) - 1 for paths in duplicate_groups.values())
    
    extension_stats = defaultdict(int)
    directory_stats = defaultdict(int)
    
    for paths in duplicate_groups.values():
        for path in paths:
            _, ext = os.path.splitext(path)
            extension_stats[ext] += 1
            
            # Get top-level directory
            parts = path.split(os.sep)
            if len(parts) > 1:
                directory_stats[parts[0]] += 1
    
    return {
        "total_duplicate_groups": total_duplicate_groups,
        "total_duplicate_files": total_duplicate_files,
        "extension_stats": dict(extension_stats),
        "directory_stats": dict(directory_stats)
    }

# Generate refactoring suggestions
def generate_refactoring_suggestions(duplicate_groups):
    """Generate suggestions for refactoring duplicate files"""
    suggestions = {}
    
    for file_hash, paths in duplicate_groups.items():
        if len(paths) <= 1:
            continue
            
        # Find the shortest path as the one to keep
        shortest_path = min(paths, key=len)
        
        suggestions[file_hash] = {
            "keep": shortest_path,
            "remove_or_refactor": [p for p in paths if p != shortest_path],
            "suggestion": "Consider keeping the file with the shortest path and refactoring others to import/reference it"
        }
    
    return suggestions

# Main function
def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python analyze_code_duplication.py <root_dir>")
        sys.exit(1)
    
    root_dir = sys.argv[1]
    
    print(f"Analyzing code duplication in {root_dir}...")
    
    duplicate_groups = find_duplicate_files(root_dir)
    statistics = generate_statistics(duplicate_groups)
    refactoring_suggestions = generate_refactoring_suggestions(duplicate_groups)
    
    report = {
        "duplicate_groups": duplicate_groups,
        "statistics": statistics,
        "refactoring_suggestions": refactoring_suggestions
    }
    
    # Write report to file
    with open(os.path.join(root_dir, "code_duplicates_report.json"), 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Found {statistics['total_duplicate_groups']} duplicate groups with {statistics['total_duplicate_files']} duplicate files")
    print(f"Report written to {os.path.join(root_dir, 'code_duplicates_report.json')}")

if __name__ == "__main__":
    main()
"@
    
    Set-Content -Path $scriptPath -Value $scriptContent
    
    # Try to find Python
    $pythonPaths = @(
        "python",
        "python3",
        "C:\Python39\python.exe",
        "C:\Python310\python.exe",
        "C:\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python39\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    )
    
    $pythonFound = $false
    
    foreach ($pythonPath in $pythonPaths) {
        try {
            $pythonVersion = & $pythonPath --version 2>&1
            if ($pythonVersion -match "Python") {
                Write-Output "Found Python: $pythonPath ($pythonVersion)"
                
                # Run the code duplication analysis
                Write-Output "Running code duplication analysis..."
                & $pythonPath $scriptPath (Get-Location)
                
                $pythonFound = $true
                break
            }
        }
        catch {
            # Python not found at this path
        }
    }
    
    if (-not $pythonFound) {
        Write-Error "Python not found. Cannot update code duplication report."
    }
    else {
        Write-Success "Code duplication report updated"
    }
    
    # Clean up
    if (Test-Path $scriptPath) {
        Remove-Item $scriptPath
    }
}

# Flatten nested code structures
function Flatten-NestedCode {
    Write-Section "Flattening Nested Code Structures"
    
    # This is a complex task that would require more sophisticated analysis
    # For now, we'll just provide recommendations
    
    Write-Output "Recommendations for flattening nested code:"
    Write-Output "1. Use composition over inheritance to reduce class hierarchy depth"
    Write-Output "2. Extract deeply nested functions into separate modules"
    Write-Output "3. Use dependency injection to reduce tight coupling"
    Write-Output "4. Consider using the Strategy pattern for conditional logic"
    Write-Output "5. Implement the Command pattern for complex operations"
    
    Write-Warning "Manual code review is recommended for optimal flattening"
}

# Run the main function
Main
