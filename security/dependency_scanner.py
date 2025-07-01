"""
ALEJO Dependency Security Scanner

This module provides utilities for scanning project dependencies for known security
vulnerabilities. It integrates with safety (Python) and npm audit (JavaScript)
to identify potentially vulnerable packages.
"""

import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple

logger = logging.getLogger(__name__)

class DependencyScanner:
    """
    Scanner for identifying security vulnerabilities in project dependencies.
    
    This class provides methods for scanning Python and JavaScript dependencies
    for known security vulnerabilities using industry standard tools.
    """
    
    def __init__(self, project_dir: Optional[Union[str, Path]] = None):
        """
        Initialize the dependency scanner.
        
        Args:
            project_dir: The project directory to scan. Defaults to current directory.
        """
        self.project_dir = Path(project_dir) if project_dir else Path.cwd()
        logger.info(f"Initializing dependency scanner for {self.project_dir}")
        
    def scan_python_dependencies(self) -> Dict[str, Any]:
        """
        Scan Python dependencies for vulnerabilities using safety.
        
        Returns:
            A dictionary containing scan results.
        """
        try:
            # Check if safety is installed
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "show", "safety"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
            except subprocess.CalledProcessError:
                logger.warning("Safety not installed. Installing...")
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "safety"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
                logger.info("Safety installed successfully")
            
            # Run safety check and capture output
            requirements_path = self.project_dir / "requirements.txt"
            
            if not requirements_path.exists():
                logger.warning(f"No requirements.txt found in {self.project_dir}")
                return {
                    "status": "error",
                    "message": f"No requirements.txt found in {self.project_dir}"
                }
            
            logger.info(f"Scanning Python dependencies in {requirements_path}")
            result = subprocess.run(
                [sys.executable, "-m", "safety", "check", "-r", str(requirements_path), "--json"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if result.returncode == 0:
                logger.info("No vulnerabilities found in Python dependencies")
                return {
                    "status": "success",
                    "vulnerabilities": []
                }
            else:
                try:
                    # Parse the JSON output from safety
                    vulnerabilities = json.loads(result.stdout)
                    logger.warning(f"Found {len(vulnerabilities)} vulnerable Python dependencies")
                    return {
                        "status": "warning",
                        "vulnerabilities": vulnerabilities
                    }
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse safety output: {result.stdout}")
                    return {
                        "status": "error",
                        "message": "Failed to parse safety output",
                        "raw_output": result.stdout
                    }
        except Exception as e:
            logger.error(f"Error scanning Python dependencies: {str(e)}")
            return {
                "status": "error",
                "message": f"Error scanning Python dependencies: {str(e)}"
            }
    
    def scan_js_dependencies(self) -> Dict[str, Any]:
        """
        Scan JavaScript dependencies for vulnerabilities using npm audit.
        
        Returns:
            A dictionary containing scan results.
        """
        try:
            package_json_path = self.project_dir / "package.json"
            
            if not package_json_path.exists():
                logger.warning(f"No package.json found in {self.project_dir}")
                return {
                    "status": "error",
                    "message": f"No package.json found in {self.project_dir}"
                }
            
            logger.info(f"Scanning JavaScript dependencies in {package_json_path}")
            
            # Check if npm is available
            try:
                subprocess.run(
                    ["npm", "--version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
            except (subprocess.CalledProcessError, FileNotFoundError):
                logger.error("npm not available. Cannot scan JavaScript dependencies.")
                return {
                    "status": "error",
                    "message": "npm not available. Cannot scan JavaScript dependencies."
                }
            
            # Run npm audit
            result = subprocess.run(
                ["npm", "audit", "--json"],
                cwd=self.project_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            try:
                # Parse the JSON output from npm audit
                audit_result = json.loads(result.stdout)
                
                # Extract vulnerabilities
                if "vulnerabilities" in audit_result:
                    vuln_count = len(audit_result["vulnerabilities"])
                    logger.warning(f"Found {vuln_count} vulnerable JavaScript dependencies")
                    return {
                        "status": "warning" if vuln_count > 0 else "success",
                        "vulnerabilities": audit_result["vulnerabilities"],
                        "summary": audit_result.get("metadata", {})
                    }
                else:
                    return {
                        "status": "success",
                        "vulnerabilities": []
                    }
            except json.JSONDecodeError:
                logger.error(f"Failed to parse npm audit output: {result.stdout}")
                return {
                    "status": "error",
                    "message": "Failed to parse npm audit output",
                    "raw_output": result.stdout
                }
        except Exception as e:
            logger.error(f"Error scanning JavaScript dependencies: {str(e)}")
            return {
                "status": "error",
                "message": f"Error scanning JavaScript dependencies: {str(e)}"
            }
    
    def scan_all_dependencies(self) -> Dict[str, Any]:
        """
        Scan both Python and JavaScript dependencies.
        
        Returns:
            A dictionary containing combined scan results.
        """
        python_results = self.scan_python_dependencies()
        js_results = self.scan_js_dependencies()
        
        # Combine results
        total_vulnerabilities = 0
        if python_results.get("status") == "warning":
            total_vulnerabilities += len(python_results.get("vulnerabilities", []))
        if js_results.get("status") == "warning":
            total_vulnerabilities += len(js_results.get("vulnerabilities", []))
        
        status = "error" if (python_results.get("status") == "error" or js_results.get("status") == "error") else \
                "warning" if total_vulnerabilities > 0 else "success"
        
        return {
            "status": status,
            "python": python_results,
            "javascript": js_results,
            "total_vulnerabilities": total_vulnerabilities
        }


def scan_project(project_dir: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """
    Convenience function to scan a project's dependencies.
    
    Args:
        project_dir: The project directory to scan.
        
    Returns:
        A dictionary containing scan results.
    """
    scanner = DependencyScanner(project_dir)
    return scanner.scan_all_dependencies()


def generate_report(scan_results: Dict[str, Any], output_file: Optional[Union[str, Path]] = None) -> Path:
    """
    Generate a human-readable report from scan results.
    
    Args:
        scan_results: The scan results from scan_project().
        output_file: Optional file to write the report to.
        
    Returns:
        Path to the report file.
    """
    if output_file:
        report_file = Path(output_file)
    else:
        timestamp = subprocess.check_output(["date", "+%Y%m%d-%H%M%S"]).decode().strip()
        report_file = Path(f"dependency_scan_{timestamp}.txt")
    
    with open(report_file, 'w') as f:
        f.write("="*80 + "\n")
        f.write("ALEJO Dependency Security Scan Report\n")
        f.write("="*80 + "\n\n")
        
        f.write(f"Status: {scan_results['status'].upper()}\n")
        f.write(f"Total Vulnerabilities: {scan_results['total_vulnerabilities']}\n\n")
        
        # Python results
        f.write("-"*80 + "\n")
        f.write("Python Dependencies\n")
        f.write("-"*80 + "\n")
        
        python_results = scan_results["python"]
        if python_results["status"] == "error":
            f.write(f"Error: {python_results.get('message', 'Unknown error')}\n")
        elif python_results["status"] == "warning":
            f.write(f"Found {len(python_results['vulnerabilities'])} vulnerabilities:\n\n")
            for vuln in python_results["vulnerabilities"]:
                f.write(f"Package: {vuln[0]}\n")
                f.write(f"Installed Version: {vuln[1]}\n")
                f.write(f"Vulnerable Version: {vuln[2]}\n")
                f.write(f"Description: {vuln[3]}\n")
                f.write("\n")
        else:
            f.write("No vulnerabilities found\n")
        
        # JavaScript results
        f.write("\n" + "-"*80 + "\n")
        f.write("JavaScript Dependencies\n")
        f.write("-"*80 + "\n")
        
        js_results = scan_results["javascript"]
        if js_results["status"] == "error":
            f.write(f"Error: {js_results.get('message', 'Unknown error')}\n")
        elif js_results["status"] == "warning":
            f.write(f"Found vulnerabilities:\n\n")
            for pkg_name, vuln in js_results.get("vulnerabilities", {}).items():
                f.write(f"Package: {pkg_name}\n")
                f.write(f"Severity: {vuln.get('severity', 'unknown')}\n")
                f.write(f"Path: {' > '.join(vuln.get('via', []))}\n")
                f.write("\n")
        else:
            f.write("No vulnerabilities found\n")
    
    logger.info(f"Dependency scan report saved to {report_file}")
    return report_file


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    import argparse
    parser = argparse.ArgumentParser(description="Scan project dependencies for security vulnerabilities")
    parser.add_argument("-p", "--path", help="Path to the project directory", default=".")
    parser.add_argument("-o", "--output", help="Output file for the report")
    args = parser.parse_args()
    
    print("Scanning dependencies for security vulnerabilities...")
    results = scan_project(args.path)
    
    report_path = generate_report(results, args.output)
    
    print(f"Scan complete! Found {results['total_vulnerabilities']} vulnerabilities.")
    print(f"Report saved to {report_path}")
    
    # Exit with error code if vulnerabilities found
    sys.exit(1 if results['total_vulnerabilities'] > 0 else 0)
