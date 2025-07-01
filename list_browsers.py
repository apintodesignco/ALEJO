#!/usr/bin/env python3
"""
ALEJO Browser Detector
Lists browsers installed on the system that can be used for compatibility testing
"""
import os
import sys
import winreg
from pathlib import Path

def detect_browsers_from_registry():
    """Detect browsers using Windows registry"""
    installed_browsers = {}
    
    # Browser configurations
    browsers = {
        'chrome': {
            'name': 'Google Chrome',
            'windows_path': r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            'reg_path': r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
        },
        'firefox': {
            'name': 'Mozilla Firefox',
            'windows_path': r'C:\Program Files\Mozilla Firefox\firefox.exe',
            'reg_path': r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe"
        },
        'edge': {
            'name': 'Microsoft Edge',
            'windows_path': r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            'reg_path': r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
        }
    }
    
    # Check registry for each browser
    for browser_id, browser_info in browsers.items():
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, browser_info['reg_path']) as key:
                browser_path = winreg.QueryValue(key, None)
                if os.path.exists(browser_path):
                    installed_browsers[browser_id] = {
                        'name': browser_info['name'],
                        'path': browser_path
                    }
        except (FileNotFoundError, PermissionError):
            pass
    
    # If registry lookup failed, try common paths
    for browser_id, browser_info in browsers.items():
        if browser_id not in installed_browsers:
            # Try the default path
            if os.path.exists(browser_info['windows_path']):
                installed_browsers[browser_id] = {
                    'name': browser_info['name'],
                    'path': browser_info['windows_path']
                }
                continue
            
            # Try alternative paths for Windows
            alt_paths = [
                browser_info['windows_path'].replace('Program Files', 'Program Files (x86)'),
                browser_info['windows_path'].replace('Program Files (x86)', 'Program Files')
            ]
            
            for alt_path in alt_paths:
                if os.path.exists(alt_path):
                    installed_browsers[browser_id] = {
                        'name': browser_info['name'],
                        'path': alt_path
                    }
                    break
    
    return installed_browsers

def main():
    """Main entry point"""
    print("\nDetected browsers:")
    
    if sys.platform.startswith('win'):
        browsers = detect_browsers_from_registry()
        
        if browsers:
            for browser_id, browser_info in browsers.items():
                print(f"  - {browser_info['name']} ({browser_info['path']})")
        else:
            print("  No supported browsers detected.")
    else:
        print("  This script currently only supports Windows.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())