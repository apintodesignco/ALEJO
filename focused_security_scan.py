#!/usr/bin/env python3
"""
ALEJO Focused Security Scanner
This script performs targeted security scanning for specific vulnerabilities
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Set, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class SecurityIssue:
    """Represents a detected security issue"""
    severity: str  # 'critical', 'high', 'medium', 'low', 'info'
    issue_type: str  # Type of security issue
    file_path: str  # Path to the file containing the issue
    line_number: int  # Line number in file
    line_content: str  # Content of the problematic line
    description: str  # Description of the issue
    remediation: str  # Suggested remediation

class SecurityScanner:
    """Performs security scanning on ALEJO codebase"""
    
    def __init__(self, base_dir: str, output_file: Optional[str] = None, exclude_dirs: Optional[List[str]] = None):
        """Initialize the scanner"""
        self.base_dir = Path(base_dir)
        self.output_file = output_file
        self.exclude_dirs = exclude_dirs or []
        self.issues: List[SecurityIssue] = []
        
        # Regular expression patterns for finding vulnerabilities
        self.patterns = {
            # JavaScript patterns
            'js_setTimeout_string': (r'setTimeout\s*\(\s*["\']', 'DynamicCodeExecution',
                                      'setTimeout with string argument can lead to code injection',
                                      'Replace string evaluation with function references'),
            
            'js_localStorage_sensitive': (r'localStorage\.(get|set)Item\s*\(\s*["\'].*?(password|token|key|secret|auth)',
                                         'LocalStorage',
                                         'Storing sensitive data in localStorage is insecure',
                                         'Use secure storage mechanisms like httpOnly cookies or session storage'),
            
            # Python patterns
            'py_random': (r'(?:^|\s+)random\.(random|randint|choice|shuffle)',
                         'PseudoRandom',
                         'Pseudo-random number generator used - not suitable for security purposes',
                         'Use secrets module for security-sensitive randomness needs'),
                         
            'py_literal_eval': (r'(?:^|\s+)ast\.literal_eval\s*\(',
                           'SafeEvalAlternative',
                           'Using ast.literal_eval (safe alternative to eval)',
                           'This is a safe alternative to eval, but verify input is properly validated'),
            
            'py_eval': (r'(?:^|\s+)eval\s*\((?!.*\bast\.literal_eval\b)',
                       'DynamicCodeExecution',
                       'Use of eval() can lead to code injection',
                       'Replace with safer alternatives like JSON parsing or static code'),
            
            'py_sql_query': (r'(?:execute|executemany)\s*\(\s*["\']\s*(SELECT|UPDATE|DELETE|INSERT)\b',
                             'SQLQuery',
                             'SQL query detected - ensure parameterized queries are used',
                             'Use parameterized queries with placeholders for all user input')
        }
    
    def scan_file(self, file_path: Path) -> List[SecurityIssue]:
        """Scan a single file for security issues"""
        issues = []
        
        # Skip if file doesn't exist or is a directory
        if not file_path.exists() or not file_path.is_file():
            return issues
        
        # Determine file type
        extension = file_path.suffix.lower()
        
        # Skip certain files
        if extension in ['.pyc', '.git', '.png', '.jpg', '.wav', '.mp3', '.ttf']:
            return issues
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                
                for i, line in enumerate(lines, 1):
                    line_issues = self._check_line(file_path, extension, i, line)
                    issues.extend(line_issues)
                    
            return issues
        except Exception as e:
            print(f"Error scanning file {file_path}: {str(e)}")
            return issues
    
    def _check_line(self, file_path: Path, extension: str, line_number: int, line: str) -> List[SecurityIssue]:
        """Check a single line for security issues"""
        issues = []
        
        # Apply appropriate patterns based on file type
        for pattern_name, (pattern, issue_type, description, remediation) in self.patterns.items():
            # Skip patterns that don't apply to this file type
            if extension == '.py' and pattern_name.startswith('js_'):
                continue
            if extension in ['.js', '.html'] and pattern_name.startswith('py_'):
                continue
                
            # Check if pattern matches
            if re.search(pattern, line, re.IGNORECASE):
                # Determine severity
                severity = 'medium'
                if 'critical' in description.lower() or 'injection' in description.lower():
                    severity = 'high'
                if 'pseudo' in description.lower():
                    severity = 'low'
                
                # Create issue
                issue = SecurityIssue(
                    severity=severity,
                    issue_type=issue_type,
                    file_path=str(file_path.relative_to(self.base_dir)),
                    line_number=line_number,
                    line_content=line.strip(),
                    description=description,
                    remediation=remediation
                )
                issues.append(issue)
                
        return issues
    
    def scan_directory(self, dir_path: Path) -> List[SecurityIssue]:
        """Recursively scan a directory for security issues"""
        issues = []
        
        # Standard directories to exclude
        standard_excludes = ['__pycache__', 'node_modules', 'venv', 'env', '.git']
        
        # Combine standard excludes with user-specified excludes
        all_excludes = standard_excludes + self.exclude_dirs
        
        try:
            for item in dir_path.iterdir():
                # Skip excluded directories
                if item.is_dir() and (item.name.startswith('.') or item.name in all_excludes or 
                                     any(exclude in str(item.relative_to(self.base_dir)) for exclude in self.exclude_dirs)):
                    continue
                    
                if item.is_file():
                    file_issues = self.scan_file(item)
                    issues.extend(file_issues)
                elif item.is_dir():
                    dir_issues = self.scan_directory(item)
                    issues.extend(dir_issues)
        except Exception as e:
            print(f"Error scanning directory {dir_path}: {str(e)}")
        
        return issues
    
    def run_scan(self) -> List[SecurityIssue]:
        """Run the security scan on the entire codebase"""
        print(f"Starting security scan in {self.base_dir}...")
        start_time = datetime.now()
        
        # Scan the base directory
        self.issues = self.scan_directory(self.base_dir)
        
        # Sort issues by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        self.issues.sort(key=lambda x: (severity_order.get(x.severity, 99), x.file_path, x.line_number))
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        print(f"Scan completed in {duration:.2f} seconds.")
        print(f"Found {len(self.issues)} potential security issues.")
        
        # Count issues by severity
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        for issue in self.issues:
            severity_counts[issue.severity] += 1
            
        # Print summary
        for severity, count in severity_counts.items():
            print(f"  {severity.title()}: {count}")
            
        return self.issues
    
    def generate_report(self) -> str:
        """Generate a report of the security issues found"""
        report = []
        report.append("=" * 80)
        report.append("ALEJO Security Scan Report")
        report.append("=" * 80)
        
        # Count files and lines scanned
        file_count = 0
        line_count = 0
        
        for root, _, files in os.walk(self.base_dir):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in ['.py', '.js', '.html', '.css', '.md']:
                    file_count += 1
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            line_count += len(f.readlines())
                    except:
                        pass
        
        report.append(f"Files analyzed: {file_count}")
        report.append(f"Lines of code analyzed: {line_count}")
        
        # Count issues by severity
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        for issue in self.issues:
            severity_counts[issue.severity] += 1
            
        report.append(f"Total vulnerabilities found: {len(self.issues)}")
        for severity, count in severity_counts.items():
            report.append(f"  {severity.title()}: {count}")
        report.append("=" * 80)
        report.append("")
        
        # Group issues by file
        issues_by_file = {}
        for issue in self.issues:
            if issue.file_path not in issues_by_file:
                issues_by_file[issue.file_path] = []
            issues_by_file[issue.file_path].append(issue)
            
        # Generate report for each file
        for file_path, issues in issues_by_file.items():
            report.append(f"File: {file_path}")
            report.append("-" * 80)
            
            for issue in issues:
                report.append(f"[{issue.severity.upper()}] {issue.issue_type} line {issue.line_number}")
                report.append(f"    {issue.description}")
                report.append(f"    Code: {issue.line_content}")
                report.append(f"    Remediation: {issue.remediation}")
                report.append("")
                
            report.append("")
            
        return "\n".join(report)
    
    def save_report(self, report: str) -> None:
        """Save the report to a file"""
        if self.output_file:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"Report saved to {self.output_file}")
        else:
            print(report)

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='ALEJO Focused Security Scanner')
    parser.add_argument('--path', '-p', required=True,
                      help='Path to the directory to scan')
    parser.add_argument('--output', '-o',
                      help='Path to the output report file')
    parser.add_argument('--exclude', '-e', action='append', default=[],
                      help='Directory or pattern to exclude from scanning (can be used multiple times)')
    parser.add_argument('--ci', action='store_true',
                      help='Run in CI mode (fails on any high or critical issues)')
    args = parser.parse_args()
    
    scanner = SecurityScanner(args.path, args.output, args.exclude)
    issues = scanner.run_scan()
    report = scanner.generate_report()
    scanner.save_report(report)
    
    # Print summary for CI systems
    if args.ci:
        high_critical_count = sum(1 for issue in issues if issue.severity in ['critical', 'high'])
        if high_critical_count > 0:
            print(f"\nCI CHECK FAILED: Found {high_critical_count} high/critical security issues")
        else:
            print("\nCI CHECK PASSED: No high/critical security issues found")
    
    # Return non-zero exit code if critical or high severity issues are found
    for issue in issues:
        if issue.severity in ['critical', 'high']:
            return 1
            
    return 0

if __name__ == "__main__":
    sys.exit(main())