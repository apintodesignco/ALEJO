#!/usr/bin/env python3
"""
ALEJO Security Vulnerability Fixer

This script orchestrates all security fixes for ALEJO:
1. JavaScript security fixes (Math.random, setTimeout, etc.)
2. Insecure localStorage usage
3. Insecure random number generation
4. Other security best practices

Usage:
    python fix_security_vulnerabilities.py [options]

Options:
    --path PATH         Path to fix (default: .)
    --js-only           Only fix JavaScript issues
    --py-only           Only fix Python issues
    --fix-type TYPE     Specific fix type: random, localStorage, setTimeout, all (default: all)
    --dry-run           Show what would be changed without making changes
    --verbose           Show detailed output
    --scan-only         Only scan for issues without fixing
"""

import argparse
import os
import sys
import importlib.util
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# ANSI color codes for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
END = "\033[0m"


class SecurityVulnerabilityFixer:
    """Main class for coordinating security fixes"""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.fix_results = {
            'js_issues': {'processed': 0, 'modified': 0, 'issues_fixed': 0},
            'localStorage_issues': {'processed': 0, 'modified': 0, 'issues_fixed': 0},
            'setTimeout_issues': {'processed': 0, 'modified': 0, 'issues_fixed': 0},
            'random_issues': {'processed': 0, 'modified': 0, 'issues_fixed': 0},
            'security_scan': {'total_issues': 0, 'by_severity': {}}
        }
        
    def load_module(self, name: str, path: str):
        """Load a Python module from file path"""
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
        
    def fix_js_issues(self) -> int:
        """Fix JavaScript issues"""
        print(f"{BLUE}Running JavaScript security fixes...{END}")
        
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_js_issues.py')
        
        if not os.path.exists(script_path):
            print(f"{YELLOW}Warning: fix_js_issues.py not found. Skipping JavaScript fixes.{END}")
            return 0
            
        try:
            fix_js = self.load_module('fix_js_issues', script_path)
            args = argparse.Namespace(
                path=self.args.path,
                dry_run=self.args.dry_run,
                verbose=self.args.verbose
            )
            fixer = fix_js.JSIssueFixer(args)
            result = fixer.run()
            
            # Collect results
            self.fix_results['js_issues']['processed'] = fixer.files_processed
            self.fix_results['js_issues']['modified'] = fixer.files_modified
            for issue_type, count in fixer.issues_fixed.items():
                self.fix_results['js_issues']['issues_fixed'] += count
                
            return result
        except Exception as e:
            print(f"{RED}Error running JavaScript fixes: {str(e)}{END}")
            return 1
    
    def fix_localStorage_issues(self) -> int:
        """Fix localStorage security issues"""
        print(f"{BLUE}Running localStorage security fixes...{END}")
        
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_localstorage_issues.py')
        
        if not os.path.exists(script_path):
            print(f"{YELLOW}Warning: fix_localstorage_issues.py not found. Skipping localStorage fixes.{END}")
            return 0
            
        try:
            fix_ls = self.load_module('fix_localstorage_issues', script_path)
            args = argparse.Namespace(
                path=self.args.path,
                dry_run=self.args.dry_run,
                verbose=self.args.verbose
            )
            fixer = fix_ls.LocalStorageSecurityFixer(args)
            result = fixer.run()
            
            # Collect results
            self.fix_results['localStorage_issues']['processed'] = fixer.files_processed
            self.fix_results['localStorage_issues']['modified'] = fixer.files_modified
            self.fix_results['localStorage_issues']['issues_fixed'] = fixer.issues_fixed
                
            return result
        except Exception as e:
            print(f"{RED}Error running localStorage fixes: {str(e)}{END}")
            return 1
    
    def fix_setTimeout_issues(self) -> int:
        """Fix setTimeout security issues"""
        print(f"{BLUE}Running setTimeout security fixes...{END}")
        
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_settimeout_issues.py')
        
        if not os.path.exists(script_path):
            print(f"{YELLOW}Warning: fix_settimeout_issues.py not found. Skipping setTimeout fixes.{END}")
            return 0
            
        try:
            fix_st = self.load_module('fix_settimeout_issues', script_path)
            args = argparse.Namespace(
                path=self.args.path,
                dry_run=self.args.dry_run,
                verbose=self.args.verbose
            )
            fixer = fix_st.SetTimeoutSecurityFixer(args)
            result = fixer.run()
            
            # Collect results
            self.fix_results['setTimeout_issues']['processed'] = fixer.files_processed
            self.fix_results['setTimeout_issues']['modified'] = fixer.files_modified
            self.fix_results['setTimeout_issues']['issues_fixed'] = fixer.issues_fixed
                
            return result
        except Exception as e:
            print(f"{RED}Error running setTimeout fixes: {str(e)}{END}")
            return 1
            
    def fix_random_issues(self) -> int:
        """Fix random number generation security issues"""
        print(f"{BLUE}Running random module security fixes...{END}")
        
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_random_issues.py')
        
        if not os.path.exists(script_path):
            print(f"{YELLOW}Warning: fix_random_issues.py not found. Skipping random module fixes.{END}")
            return 0
            
        try:
            fix_rnd = self.load_module('fix_random_issues', script_path)
            args = argparse.Namespace(
                path=self.args.path,
                dry_run=self.args.dry_run,
                verbose=self.args.verbose
            )
            fixer = fix_rnd.RandomSecurityFixer(args)
            result = fixer.run()
            
            # Collect results
            self.fix_results['random_issues']['processed'] = fixer.files_processed
            self.fix_results['random_issues']['modified'] = fixer.files_modified
            self.fix_results['random_issues']['issues_fixed'] = fixer.issues_fixed
                
            return result
        except Exception as e:
            print(f"{RED}Error running random module fixes: {str(e)}{END}")
            return 1
    
    def run_security_scan(self) -> int:
        """Run security scan to find vulnerabilities"""
        print(f"{BLUE}Running security scan...{END}")
        
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'focused_security_scan.py')
        
        if not os.path.exists(script_path):
            print(f"{YELLOW}Warning: focused_security_scan.py not found. Skipping security scan.{END}")
            return 0
            
        try:
            output_file = os.path.join("test_reports", f"security_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            
            cmd = [
                sys.executable,
                script_path,
                "--path", self.args.path,
                "--output", output_file
            ]
            
            if self.args.verbose:
                cmd.append("--verbose")
                
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"{RED}Security scan failed with error code {result.returncode}{END}")
                if result.stderr:
                    print(f"{RED}Error: {result.stderr}{END}")
                return result.returncode
                
            # Parse results
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    content = f.read()
                    
                # Extract issue counts
                for line in content.split('\n'):
                    if "Total vulnerabilities found:" in line:
                        try:
                            self.fix_results['security_scan']['total_issues'] = int(line.split(':')[1].strip())
                        except:
                            pass
                    elif line.strip().startswith("Critical:"):
                        try:
                            self.fix_results['security_scan']['by_severity']['Critical'] = int(line.split(':')[1].strip())
                        except:
                            pass
                    elif line.strip().startswith("High:"):
                        try:
                            self.fix_results['security_scan']['by_severity']['High'] = int(line.split(':')[1].strip())
                        except:
                            pass
                    elif line.strip().startswith("Medium:"):
                        try:
                            self.fix_results['security_scan']['by_severity']['Medium'] = int(line.split(':')[1].strip())
                        except:
                            pass
                    elif line.strip().startswith("Low:"):
                        try:
                            self.fix_results['security_scan']['by_severity']['Low'] = int(line.split(':')[1].strip())
                        except:
                            pass
                    elif line.strip().startswith("Info:"):
                        try:
                            self.fix_results['security_scan']['by_severity']['Info'] = int(line.split(':')[1].strip())
                        except:
                            pass
                
                print(f"{GREEN}Security scan completed. Results saved to {output_file}{END}")
            
            return 0
        except Exception as e:
            print(f"{RED}Error running security scan: {str(e)}{END}")
            return 1
    
    def run(self) -> int:
        """Run all security fixes"""
        # Validate path exists
        if not os.path.exists(self.args.path):
            print(f"{RED}Error: Path '{self.args.path}' does not exist{END}")
            return 1
        
        start_time = datetime.now()
        exit_code = 0
        
        print(f"{BOLD}ALEJO Security Vulnerability Fixer{END}")
        print(f"Starting security fixes at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Target path: {self.args.path}")
        print(f"Options: {'Dry run, ' if self.args.dry_run else ''}{'Verbose, ' if self.args.verbose else ''}{'Scan only' if self.args.scan_only else 'Fix'}")
        print(f"Fix types: {self.args.fix_type}")
        print("=" * 80)
        
        # Always run security scan first if not in fix_type mode
        if self.args.scan_only or self.args.fix_type == 'all':
            scan_result = self.run_security_scan()
            exit_code = max(exit_code, scan_result)
            
            # If scan only, exit after scan
            if self.args.scan_only:
                self.print_summary()
                return exit_code
        
        # Run appropriate fixes based on options
        if self.args.js_only or not self.args.py_only:
            if self.args.fix_type in ['all', 'js']:
                js_result = self.fix_js_issues()
                exit_code = max(exit_code, js_result)
                
            if self.args.fix_type in ['all', 'localStorage']:
                ls_result = self.fix_localStorage_issues()
                exit_code = max(exit_code, ls_result)
                
            if self.args.fix_type in ['all', 'setTimeout']:
                st_result = self.fix_setTimeout_issues()
                exit_code = max(exit_code, st_result)
        
        if self.args.py_only or not self.args.js_only:
            if self.args.fix_type in ['all', 'random']:
                rnd_result = self.fix_random_issues()
                exit_code = max(exit_code, rnd_result)
        
        # Run security scan again after fixes if not in scan_only mode
        if not self.args.scan_only and self.args.fix_type == 'all':
            print(f"{BLUE}Running post-fix security scan to verify improvements...{END}")
            scan_result = self.run_security_scan()
            exit_code = max(exit_code, scan_result)
        
        self.print_summary()
        
        end_time = datetime.now()
        duration = end_time - start_time
        print(f"\nSecurity fix process completed in {duration.total_seconds():.2f} seconds")
        
        if self.args.dry_run:
            print(f"\n{YELLOW}This was a dry run. No files were actually modified.{END}")
            print(f"{YELLOW}Run without --dry-run to apply the changes.{END}")
            
        return exit_code
    
    def print_summary(self) -> None:
        """Print a summary of all fixes"""
        print(f"\n{BOLD}Security Fix Summary:{END}")
        
        if self.fix_results['security_scan']['total_issues'] > 0:
            print(f"\nSecurity scan found {self.fix_results['security_scan']['total_issues']} issues:")
            for severity, count in self.fix_results['security_scan']['by_severity'].items():
                print(f"  - {severity}: {count}")
                
        if not self.args.scan_only:
            print("\nFixes applied:")
            
            if self.args.js_only or not self.args.py_only:
                if self.args.fix_type in ['all', 'js']:
                    print(f"  - JavaScript issues:")
                    print(f"    * Files processed: {self.fix_results['js_issues']['processed']}")
                    print(f"    * Files modified: {self.fix_results['js_issues']['modified']}")
                    print(f"    * Issues fixed: {self.fix_results['js_issues']['issues_fixed']}")
                    
                if self.args.fix_type in ['all', 'localStorage']:
                    print(f"  - LocalStorage issues:")
                    print(f"    * Files processed: {self.fix_results['localStorage_issues']['processed']}")
                    print(f"    * Files modified: {self.fix_results['localStorage_issues']['modified']}")
                    print(f"    * Issues fixed: {self.fix_results['localStorage_issues']['issues_fixed']}")
                    
                if self.args.fix_type in ['all', 'setTimeout']:
                    print(f"  - SetTimeout issues:")
                    print(f"    * Files processed: {self.fix_results['setTimeout_issues']['processed']}")
                    print(f"    * Files modified: {self.fix_results['setTimeout_issues']['modified']}")
                    print(f"    * Issues fixed: {self.fix_results['setTimeout_issues']['issues_fixed']}")
            
            if self.args.py_only or not self.args.js_only:
                if self.args.fix_type in ['all', 'random']:
                    print(f"  - Random module issues:")
                    print(f"    * Files processed: {self.fix_results['random_issues']['processed']}")
                    print(f"    * Files modified: {self.fix_results['random_issues']['modified']}")
                    print(f"    * Issues fixed: {self.fix_results['random_issues']['issues_fixed']}")
        
        # Calculate total fixes
        total_processed = 0
        total_modified = 0
        total_fixed = 0
        
        for fix_type, results in self.fix_results.items():
            if fix_type != 'security_scan':
                total_processed += results['processed']
                total_modified += results['modified'] 
                total_fixed += results['issues_fixed']
        
        print(f"\n{BOLD}Total:{END}")
        print(f"  - Files processed: {total_processed}")
        print(f"  - Files modified: {total_modified}")
        print(f"  - Security issues fixed: {total_fixed}")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO Security Vulnerability Fixer")
    parser.add_argument("--path", default=".", help="Path to fix (default: .)")
    parser.add_argument("--js-only", action="store_true", help="Only fix JavaScript issues")
    parser.add_argument("--py-only", action="store_true", help="Only fix Python issues")
    parser.add_argument("--fix-type", default="all", choices=["random", "localStorage", "setTimeout", "js", "all"], 
                      help="Specific fix type (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("--scan-only", action="store_true", help="Only scan for issues without fixing")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    fixer = SecurityVulnerabilityFixer(args)
    sys.exit(fixer.run())