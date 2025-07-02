#!/usr/bin/env python3
"""
ALEJO Security Scanner

This script performs security scanning on the ALEJO codebase to identify potential
security vulnerabilities, hardcoded secrets, and other security issues.
"""

import os
import sys
import re
import json
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('security_validation.log')
    ]
)

logger = logging.getLogger(__name__)

class AlejoSecurityScanner:
    """Security scanner for ALEJO codebase."""
    
    def __init__(self, project_root: Optional[str] = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.absolute()
        self.issues_found = 0
        self.files_scanned = 0
        self.report_data = {
            "summary": {
                "files_scanned": 0,
                "issues_found": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0
            },
            "issues": []
        }
    
    def scan_for_secrets(self) -> List[Dict[str, Any]]:
        """Scan for hardcoded secrets in the codebase."""
        logger.info("Scanning for hardcoded secrets...")
        
        issues = []
        secret_patterns = [
            (r'password\s*=\s*[\'"][^\'"]{8,}[\'"]', 'Potential hardcoded password'),
            (r'api[_\-]?key\s*=\s*[\'"][^\'"]{8,}[\'"]', 'Potential API key'),
            (r'secret\s*=\s*[\'"][^\'"]{8,}[\'"]', 'Potential secret'),
            (r'token\s*=\s*[\'"][^\'"]{8,}[\'"]', 'Potential token'),
        ]
        
        excluded_dirs = ['node_modules', 'venv', '.git', '__pycache__', 'tests']
        
        for root, dirs, files in os.walk(self.project_root):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.json', '.yml', '.yaml', '.env')):
                    file_path = os.path.join(root, file)
                    self.files_scanned += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                            for pattern, description in secret_patterns:
                                matches = re.finditer(pattern, content, re.IGNORECASE)
                                for match in matches:
                                    # Check if this is a false positive (e.g., in a comment or test)
                                    line_start = content.rfind('\n', 0, match.start()) + 1
                                    line_end = content.find('\n', match.start())
                                    if line_end == -1:
                                        line_end = len(content)
                                    line = content[line_start:line_end]
                                    
                                    # Skip if it's in a comment
                                    if '//' in line[:match.start() - line_start] or '#' in line[:match.start() - line_start]:
                                        continue
                                    
                                    # Calculate line number
                                    line_number = content[:match.start()].count('\n') + 1
                                    
                                    issue = {
                                        "file": os.path.relpath(file_path, self.project_root),
                                        "line": line_number,
                                        "description": description,
                                        "severity": "high",
                                        "code": line.strip()
                                    }
                                    issues.append(issue)
                                    self.issues_found += 1
                                    self.report_data["summary"]["high"] += 1
                                    logger.warning(f"Potential secret found in {file_path}:{line_number}")
                    except Exception as e:
                        logger.error(f"Error scanning {file_path}: {str(e)}")
        
        self.report_data["summary"]["files_scanned"] = self.files_scanned
        self.report_data["summary"]["issues_found"] = self.issues_found
        self.report_data["issues"].extend(issues)
        
        return issues
    
    def scan_for_vulnerabilities(self) -> List[Dict[str, Any]]:
        """Scan for common security vulnerabilities."""
        logger.info("Scanning for security vulnerabilities...")
        
        issues = []
        vulnerability_patterns = [
            # JavaScript vulnerabilities
            (r'eval\s*\(', 'Use of eval() can lead to code injection vulnerabilities', 'js'),
            (r'document\.write\s*\(', 'Use of document.write can lead to XSS vulnerabilities', 'js'),
            (r'innerHTML\s*=', 'Direct manipulation of innerHTML can lead to XSS vulnerabilities', 'js'),
            (r'dangerouslySetInnerHTML', 'React\'s dangerouslySetInnerHTML can lead to XSS if not used carefully', 'js'),
            
            # Python vulnerabilities
            (r'subprocess\.call\s*\(.*shell\s*=\s*True', 'Subprocess with shell=True can lead to command injection', 'py'),
            (r'pickle\.loads', 'Unpickling data can lead to remote code execution', 'py'),
            (r'yaml\.load\s*\((?!.*Loader)', 'Unsafe YAML loading can lead to code execution', 'py'),
            (r'exec\s*\(', 'Use of exec() can lead to code injection vulnerabilities', 'py'),
        ]
        
        excluded_dirs = ['node_modules', 'venv', '.git', '__pycache__', 'tests']
        
        for root, dirs, files in os.walk(self.project_root):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            
            for file in files:
                file_ext = os.path.splitext(file)[1][1:]
                file_path = os.path.join(root, file)
                
                if file_ext in ['py', 'js', 'ts', 'jsx', 'tsx']:
                    self.files_scanned += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                            for pattern, description, lang in vulnerability_patterns:
                                if file_ext == lang or (file_ext in ['ts', 'jsx', 'tsx'] and lang == 'js'):
                                    matches = re.finditer(pattern, content)
                                    for match in matches:
                                        # Calculate line number
                                        line_number = content[:match.start()].count('\n') + 1
                                        
                                        # Get the line of code
                                        line_start = content.rfind('\n', 0, match.start()) + 1
                                        line_end = content.find('\n', match.start())
                                        if line_end == -1:
                                            line_end = len(content)
                                        line = content[line_start:line_end]
                                        
                                        issue = {
                                            "file": os.path.relpath(file_path, self.project_root),
                                            "line": line_number,
                                            "description": description,
                                            "severity": "medium",
                                            "code": line.strip()
                                        }
                                        issues.append(issue)
                                        self.issues_found += 1
                                        self.report_data["summary"]["medium"] += 1
                                        logger.warning(f"Potential vulnerability found in {file_path}:{line_number}")
                    except Exception as e:
                        logger.error(f"Error scanning {file_path}: {str(e)}")
        
        self.report_data["issues"].extend(issues)
        return issues
    
    def scan_for_insecure_configurations(self) -> List[Dict[str, Any]]:
        """Scan for insecure configurations."""
        logger.info("Scanning for insecure configurations...")
        
        issues = []
        config_files = [
            ('package.json', r'"dependencies":\s*{[^}]*"[^"]*vulnerable-package[^"]*":\s*"[^"]*"'),
            ('.env', r'DEBUG\s*=\s*True'),
            ('docker-compose.yml', r'ports:\s*-\s*"27017:27017"'),  # Exposed MongoDB port
        ]
        
        for root, _, files in os.walk(self.project_root):
            for file_pattern, issue_pattern in config_files:
                for file in files:
                    if file == file_pattern:
                        file_path = os.path.join(root, file)
                        self.files_scanned += 1
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                
                                matches = re.finditer(issue_pattern, content)
                                for match in matches:
                                    # Calculate line number
                                    line_number = content[:match.start()].count('\n') + 1
                                    
                                    # Get the line of code
                                    line_start = content.rfind('\n', 0, match.start()) + 1
                                    line_end = content.find('\n', match.start())
                                    if line_end == -1:
                                        line_end = len(content)
                                    line = content[line_start:line_end]
                                    
                                    issue = {
                                        "file": os.path.relpath(file_path, self.project_root),
                                        "line": line_number,
                                        "description": f"Potentially insecure configuration in {file}",
                                        "severity": "medium",
                                        "code": line.strip()
                                    }
                                    issues.append(issue)
                                    self.issues_found += 1
                                    self.report_data["summary"]["medium"] += 1
                                    logger.warning(f"Insecure configuration found in {file_path}:{line_number}")
                        except Exception as e:
                            logger.error(f"Error scanning {file_path}: {str(e)}")
        
        self.report_data["issues"].extend(issues)
        return issues
    
    def run_full_scan(self) -> Dict[str, Any]:
        """Run a full security scan."""
        logger.info("Starting full security scan...")
        
        self.scan_for_secrets()
        self.scan_for_vulnerabilities()
        self.scan_for_insecure_configurations()
        
        logger.info(f"Security scan complete. Scanned {self.files_scanned} files, found {self.issues_found} issues.")
        return self.report_data
    
    def generate_report(self, output_file: str = "security_report.json") -> None:
        """Generate a JSON report of security issues."""
        report_path = os.path.join(self.project_root, output_file)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.report_data, f, indent=2)
        
        logger.info(f"Security report generated at {report_path}")


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='ALEJO Security Scanner')
    parser.add_argument('--ci', action='store_true', help='Run in CI mode (exit with error code if issues found)')
    parser.add_argument('--report', action='store_true', help='Generate a JSON report')
    parser.add_argument('--output', default='security_report.json', help='Output file for the report')
    parser.add_argument('--path', help='Path to the project root')
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_arguments()
    
    scanner = AlejoSecurityScanner(args.path)
    report = scanner.run_full_scan()
    
    if args.report:
        scanner.generate_report(args.output)
    
    if args.ci and scanner.issues_found > 0:
        sys.exit(1)
    
    sys.exit(0)


if __name__ == "__main__":
    main()
