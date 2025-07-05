@echo off
echo Running ALEJO Comprehensive Tests
echo ================================
echo.

REM Define common paths where Python and Node.js might be installed
set "PYTHON_PATHS=C:\Python39\python.exe" "C:\Python310\python.exe" "C:\Python311\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python39\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python310\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python311\python.exe"
set "NODE_PATHS=C:\Program Files\nodejs\node.exe" "C:\Program Files (x86)\nodejs\node.exe" "C:\Users\magic\AppData\Roaming\nvm\v16.20.0\node.exe" "C:\Users\magic\AppData\Roaming\nvm\v18.16.0\node.exe"

REM Find Python
set PYTHON_FOUND=0
for %%p in (%PYTHON_PATHS%) do (
    if exist "%%p" (
        set PYTHON_PATH=%%p
        set PYTHON_FOUND=1
        echo Found Python: %%p
        goto :python_found
    )
)
:python_found

REM Find Node.js
set NODE_FOUND=0
for %%n in (%NODE_PATHS%) do (
    if exist "%%n" (
        set NODE_PATH=%%n
        set NODE_FOUND=1
        echo Found Node.js: %%n
        goto :node_found
    )
)
:node_found

echo.
echo === Running Code Duplication Analysis ===
if %PYTHON_FOUND% EQU 1 (
    echo Creating code duplication analyzer script...
    
    echo import os > code_duplication_analyzer.py
    echo import sys >> code_duplication_analyzer.py
    echo import json >> code_duplication_analyzer.py
    echo import hashlib >> code_duplication_analyzer.py
    echo from pathlib import Path >> code_duplication_analyzer.py
    echo from collections import defaultdict >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo # Configuration >> code_duplication_analyzer.py
    echo IGNORE_DIRS = [ >> code_duplication_analyzer.py
    echo     "__pycache__", >> code_duplication_analyzer.py
    echo     "node_modules", >> code_duplication_analyzer.py
    echo     ".git", >> code_duplication_analyzer.py
    echo     "venv", >> code_duplication_analyzer.py
    echo     "env", >> code_duplication_analyzer.py
    echo     "dist", >> code_duplication_analyzer.py
    echo     "build", >> code_duplication_analyzer.py
    echo     "backups" >> code_duplication_analyzer.py
    echo ] >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo IGNORE_FILES = [ >> code_duplication_analyzer.py
    echo     ".gitignore", >> code_duplication_analyzer.py
    echo     "package-lock.json", >> code_duplication_analyzer.py
    echo     "yarn.lock" >> code_duplication_analyzer.py
    echo ] >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo # File content hash function >> code_duplication_analyzer.py
    echo def hash_file_content(file_path): >> code_duplication_analyzer.py
    echo     """Generate a hash of the file content""" >> code_duplication_analyzer.py
    echo     with open(file_path, 'rb') as f: >> code_duplication_analyzer.py
    echo         content = f.read() >> code_duplication_analyzer.py
    echo         return hashlib.sha256(content).hexdigest() >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo # Find duplicate files >> code_duplication_analyzer.py
    echo def find_duplicate_files(root_dir): >> code_duplication_analyzer.py
    echo     """Find duplicate files based on content hash""" >> code_duplication_analyzer.py
    echo     file_hashes = defaultdict(list) >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     for root, dirs, files in os.walk(root_dir): >> code_duplication_analyzer.py
    echo         # Skip ignored directories >> code_duplication_analyzer.py
    echo         dirs[:] = [d for d in dirs if d not in IGNORE_DIRS] >> code_duplication_analyzer.py
    echo         >> code_duplication_analyzer.py
    echo         for filename in files: >> code_duplication_analyzer.py
    echo             if filename in IGNORE_FILES: >> code_duplication_analyzer.py
    echo                 continue >> code_duplication_analyzer.py
    echo                 >> code_duplication_analyzer.py
    echo             file_path = os.path.join(root, filename) >> code_duplication_analyzer.py
    echo             >> code_duplication_analyzer.py
    echo             try: >> code_duplication_analyzer.py
    echo                 file_hash = hash_file_content(file_path) >> code_duplication_analyzer.py
    echo                 file_hashes[file_hash].append(file_path) >> code_duplication_analyzer.py
    echo             except Exception as e: >> code_duplication_analyzer.py
    echo                 print(f"Error processing {file_path}: {e}") >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     # Filter out unique files >> code_duplication_analyzer.py
    echo     duplicate_groups = {h: paths for h, paths in file_hashes.items() if len(paths) > 1} >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     return duplicate_groups >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo # Main function >> code_duplication_analyzer.py
    echo def main(): >> code_duplication_analyzer.py
    echo     """Main function""" >> code_duplication_analyzer.py
    echo     root_dir = os.getcwd() >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     print(f"Analyzing code duplication in {root_dir}...") >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     duplicate_groups = find_duplicate_files(root_dir) >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     # Count duplicates >> code_duplication_analyzer.py
    echo     total_duplicate_groups = len(duplicate_groups) >> code_duplication_analyzer.py
    echo     total_duplicate_files = sum(len(paths) - 1 for paths in duplicate_groups.values()) >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     print(f"Found {total_duplicate_groups} duplicate groups with {total_duplicate_files} duplicate files") >> code_duplication_analyzer.py
    echo     >> code_duplication_analyzer.py
    echo     # Print duplicate groups >> code_duplication_analyzer.py
    echo     for hash_val, paths in duplicate_groups.items(): >> code_duplication_analyzer.py
    echo         print(f"\nDuplicate group:") >> code_duplication_analyzer.py
    echo         for path in paths: >> code_duplication_analyzer.py
    echo             print(f"  {path}") >> code_duplication_analyzer.py
    echo. >> code_duplication_analyzer.py
    echo if __name__ == "__main__": >> code_duplication_analyzer.py
    echo     main() >> code_duplication_analyzer.py
    
    echo Running code duplication analysis...
    "%PYTHON_PATH%" code_duplication_analyzer.py
    del code_duplication_analyzer.py
) else (
    echo Python not found, skipping code duplication analysis
)

echo.
echo === Running Python Tests ===
if %PYTHON_FOUND% EQU 1 (
    echo Running Python tests with %PYTHON_PATH%...
    "%PYTHON_PATH%" -m pytest tests/ -v
) else (
    echo Python not found, skipping Python tests
)

echo.
echo === Running Node.js Tests ===
if %NODE_FOUND% EQU 1 (
    echo Running Node.js tests with %NODE_PATH%...
    "%NODE_PATH%" tools/run_comprehensive_tests.js
) else (
    echo Node.js not found, skipping Node.js tests
)

echo.
echo === Running Security Tests ===
if %PYTHON_FOUND% EQU 1 (
    echo Running security tests...
    "%PYTHON_PATH%" tests/security/run_security_tests.py
) else (
    echo Python not found, skipping security tests
)

echo.
echo === Running Accessibility Tests ===
if %NODE_FOUND% EQU 1 (
    echo Running accessibility tests...
    "%NODE_PATH%" tests/accessibility/run_accessibility_tests.js
) else (
    echo Node.js not found, skipping accessibility tests
)

echo.
echo === Test Summary ===
echo Tests completed. Check the output above for any failures.
echo.

pause
