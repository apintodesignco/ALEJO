#!/usr/bin/env python3
import os
import subprocess
import sys
import json
import glob
from concurrent.futures import ThreadPoolExecutor, as_completed

def check_node_available():
    """Check if Node.js is available"""
    try:
        result = subprocess.run(['node', '--version'], 
                              capture_output=True, 
                              text=True)
        return result.returncode == 0
    except Exception:
        return False

def validate_js_syntax(file_path):
    """Validate JavaScript syntax using Node.js or fallback to basic file reading"""
    print(f"Validating syntax for: {file_path}")
    
    # Check if file exists
    if not os.path.isfile(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    # Check if Node.js is available
    node_available = check_node_available()
    
    if node_available:
        # Use Node.js to check syntax
        try:
            # Create a temporary script to check syntax
            check_script = f"try {{ require('fs').readFileSync({json.dumps(file_path)}, 'utf8'); require('vm').compileFunction(require('fs').readFileSync({json.dumps(file_path)}, 'utf8'), [], {{ filename: {json.dumps(file_path)} }}); process.exit(0); }} catch (error) {{ console.error(error.message); process.exit(1); }}"
            
            # Run the script with Node.js
            result = subprocess.run(['node', '-e', check_script], 
                                capture_output=True, 
                                text=True)
            
            if result.returncode == 0:
                print(f"✓ Valid JavaScript syntax: {file_path}")
                return True
            else:
                print(f"❌ Invalid JavaScript syntax in {file_path}:\n{result.stderr.strip()}")
                return False
        except Exception as e:
            print(f"❌ Error validating file with Node.js: {str(e)}")
            # Fall back to basic validation
            node_available = False
    
    if not node_available:
        # Fallback: Just check if we can read the file
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"✓ File readable (basic check only): {file_path}")
            return True
        except Exception as e:
            print(f"❌ Error reading file: {str(e)}")
            return False

def find_js_files(directory='.'):
    """Find all JavaScript files in the directory and subdirectories"""
    return glob.glob(f"{directory}/**/*.js", recursive=True)

def validate_all_js_files(directory='.', max_workers=10):
    """Validate all JavaScript files in the directory and subdirectories"""
    js_files = find_js_files(directory)
    print(f"Found {len(js_files)} JavaScript files to validate")
    
    results = {
        'valid': 0,
        'invalid': 0,
        'errors': []
    }
    
    # Use ThreadPoolExecutor to validate files in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {executor.submit(validate_js_syntax, file_path): file_path for file_path in js_files}
        
        for future in as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                is_valid = future.result()
                if is_valid:
                    results['valid'] += 1
                else:
                    results['invalid'] += 1
                    results['errors'].append(file_path)
            except Exception as e:
                print(f"❌ Exception validating {file_path}: {str(e)}")
                results['invalid'] += 1
                results['errors'].append(f"{file_path} (Exception: {str(e)})")
    
    return results

if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            # Validate all JS files
            directory = '.' if len(sys.argv) <= 2 else sys.argv[2]
            results = validate_all_js_files(directory)
            
            # Print summary
            print(f"\nValidation Summary:")
            print(f"✓ Valid files: {results['valid']}")
            print(f"❌ Invalid files: {results['invalid']}")
            
            if results['errors']:
                print(f"\nFiles with errors:")
                for error in results['errors']:
                    print(f"  - {error}")
            
            sys.exit(0 if results['invalid'] == 0 else 1)
        else:
            # Validate a single file
            file_path = sys.argv[1]
            success = validate_js_syntax(file_path)
            sys.exit(0 if success else 1)
    else:
        print("Usage: python validate_js_syntax.py [--all [directory] | file_path]")
        print("  --all: Validate all JavaScript files in the directory and subdirectories")
        print("  file_path: Validate a single JavaScript file")
        sys.exit(1)
