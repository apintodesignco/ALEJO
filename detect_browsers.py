#!/usr/bin/env python3
"""
Simple Browser Detection Script
Detects installed browsers and writes results to a file
"""
import os
import sys
import json
from datetime import datetime

def main():
    """Main function to detect browsers and write results"""
    # Define browser paths based on platform
    if sys.platform.startswith('win'):
        browsers = {
            'Chrome': [
                r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
            ],
            'Firefox': [
                r'C:\Program Files\Mozilla Firefox\firefox.exe',
                r'C:\Program Files (x86)\Mozilla Firefox\firefox.exe'
            ],
            'Edge': [
                r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
            ]
        }
    else:
        # Just placeholder for non-Windows platforms
        browsers = {}
        
    # Check which browsers are installed
    installed = {}
    for name, paths in browsers.items():
        for path in paths:
            if os.path.exists(path):
                installed[name] = path
                break
    
    # Write results to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"browser_detection_{timestamp}.txt"
    
    with open(output_file, 'w') as f:
        f.write("Detected browsers:\n")
        if installed:
            for name, path in installed.items():
                f.write(f"  - {name}: {path}\n")
        else:
            f.write("  No supported browsers detected.\n")
    
    # Also write as JSON for programmatic use
    with open(f"browser_detection_{timestamp}.json", 'w') as f:
        json.dump(installed, f, indent=2)
    
    print(f"Browser detection complete. Results written to {output_file}")
    print("Detected browsers:")
    
    if installed:
        for name in installed:
            print(f"  - {name}")
    else:
        print("  No supported browsers detected.")

if __name__ == "__main__":
    main()