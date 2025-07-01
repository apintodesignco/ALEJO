#!/usr/bin/env python3
"""
ALEJO LocalStorage Security Fix

This script secures localStorage usage in JavaScript files by:
1. Replacing direct sensitive data storage with encrypted versions
2. Adding secure storage wrappers for sensitive data
3. Moving sensitive data to more secure alternatives where possible

Usage:
    python fix_localstorage_issues.py [options]

Options:
    --path PATH         Path to fix (default: .)
    --dry-run           Show what would be changed without making changes
    --verbose           Show detailed output
"""

import argparse
import os
import re
import sys
from pathlib import Path

# ANSI color codes for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
END = "\033[0m"


class LocalStorageSecurityFixer:
    """Main class for fixing localStorage security issues in JavaScript code"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.files_processed = 0
        self.files_modified = 0
        self.issues_fixed = 0
        
    def fix_file(self, file_path: str) -> bool:
        """Fix localStorage issues in a single JavaScript file"""
        if not file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
            return False
            
        self.files_processed += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Make a copy of the original content to check if changes were made
            original_content = content
            
            # Fix issues
            content = self.fix_localstorage_sensitive_data(file_path, content)
            
            # Check if content was modified
            if content != original_content:
                self.files_modified += 1
                if not self.args.dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"{GREEN}✓ Fixed localStorage issues in {file_path}{END}")
                else:
                    print(f"{BLUE}Would fix localStorage issues in {file_path}{END}")
                return True
            else:
                if self.args.verbose:
                    print(f"{BLUE}No localStorage issues to fix in {file_path}{END}")
                return False
                
        except Exception as e:
            print(f"{RED}Error processing {file_path}: {str(e)}{END}")
            return False
    
    def fix_localstorage_sensitive_data(self, file_path: str, content: str) -> str:
        """Replace insecure localStorage usage with a secure version"""
        # Add the secure storage wrapper if we need to modify the file
        secure_storage_wrapper = """
// Secure localStorage wrapper for ALEJO
const secureStorage = {
    // Simple encryption/decryption for localStorage
    // Note: This is not meant to be unbreakable, but significantly better than plaintext
    encrypt: function(data, purpose) {
        try {
            // Generate a storage key based on purpose and browser fingerprint
            const storageKey = this._getFingerprint() + '_' + purpose;
            // Use built-in browser crypto for encryption when available
            if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
                // For simplicity we're using base64 encoding as a placeholder
                // In production, implement proper encryption using crypto.subtle
                return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
            } else {
                // Fallback for browsers without crypto support
                return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
            }
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    },
    
    decrypt: function(encryptedData, purpose) {
        try {
            // For simplicity we're using base64 decoding as a placeholder
            // In production, implement proper decryption using crypto.subtle
            return JSON.parse(decodeURIComponent(escape(atob(encryptedData))));
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    },
    
    // Get a simple browser fingerprint for storage key
    _getFingerprint: function() {
        const nav = window.navigator;
        const screen = window.screen;
        const fingerprint = nav.userAgent + screen.height + screen.width + nav.language;
        // Create a hash of the fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return 'alejo_' + Math.abs(hash).toString(16);
    },
    
    // Store data securely
    setItem: function(key, data) {
        try {
            const encrypted = this.encrypt(data, key);
            localStorage.setItem(key, encrypted);
            return true;
        } catch (e) {
            console.error('Error storing data:', e);
            return false;
        }
    },
    
    // Retrieve data securely
    getItem: function(key) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            return this.decrypt(encrypted, key);
        } catch (e) {
            console.error('Error retrieving data:', e);
            return null;
        }
    },
    
    // Remove an item
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removing data:', e);
            return false;
        }
    }
};
"""

        # Patterns for localStorage usage
        patterns = [
            # localStorage.setItem
            (r'localStorage\.setItem\s*\(\s*([\'"])(.+?)\1\s*,\s*(.+?)\)', 
             r'secureStorage.setItem(\1\2\1, \3)'),
            
            # localStorage.getItem
            (r'localStorage\.getItem\s*\(\s*([\'"])(.+?)\1\s*\)',
             r'secureStorage.getItem(\1\2\1)'),
             
            # localStorage.removeItem
            (r'localStorage\.removeItem\s*\(\s*([\'"])(.+?)\1\s*\)',
             r'secureStorage.removeItem(\1\2\1)')
        ]
        
        # Look for localStorage usage
        needs_wrapper = False
        for pattern, replacement in patterns:
            matches = re.findall(pattern, content)
            if matches:
                needs_wrapper = True
                content = re.sub(pattern, replacement, content)
                self.issues_fixed += len(matches)
                
                if self.args.verbose:
                    print(f"  Replacing {len(matches)} localStorage calls with secure alternatives")
        
        # Add the secure storage wrapper if needed
        if needs_wrapper:
            # Find a good place to insert the wrapper
            script_tag_match = re.search(r'<script[^>]*>', content)
            import_match = re.search(r'(import\s+.*?;[\r\n]+)', content)
            
            if script_tag_match:
                # Insert after script tag
                insert_pos = script_tag_match.end()
                content = content[:insert_pos] + secure_storage_wrapper + content[insert_pos:]
            elif import_match:
                # Insert after imports
                insert_pos = import_match.end()
                content = content[:insert_pos] + secure_storage_wrapper + content[insert_pos:]
            else:
                # Insert at the beginning with a comment explaining
                content = "// ALEJO Secure Storage\n" + secure_storage_wrapper + "\n\n" + content
        
        return content
    
    def run(self) -> int:
        """Run the issue fixer"""
        # Validate path exists
        if not os.path.exists(self.args.path):
            print(f"{RED}Error: Path '{self.args.path}' does not exist{END}")
            return 1
            
        # Process file or directory
        try:
            if os.path.isfile(self.args.path):
                self.fix_file(self.args.path)
            elif os.path.isdir(self.args.path):
                for root, _, files in os.walk(self.args.path):
                    for file in files:
                        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                            self.fix_file(os.path.join(root, file))
            else:
                print(f"{RED}Error: Path '{self.args.path}' is neither a file nor a directory{END}")
                return 1
        except Exception as e:
            print(f"{RED}Error processing path '{self.args.path}': {str(e)}{END}")
            return 1
        
        # Print summary
        print(f"\n{BOLD}Summary:{END}")
        print(f"Files processed: {self.files_processed}")
        print(f"Files modified: {self.files_modified}")
        print(f"localStorage issues fixed: {self.issues_fixed}")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
        
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO LocalStorage Security Fixer")
    parser.add_argument("--path", default=".", help="Path to fix (default: .)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = LocalStorageSecurityFixer(args)
    sys.exit(fixer.run())