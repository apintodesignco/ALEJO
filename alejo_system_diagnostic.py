#!/usr/bin/env python3
"""
ALEJO System Diagnostic Tool

This script provides comprehensive diagnostics for the ALEJO system by:
1. Checking Python module availability
2. Verifying service health
3. Validating CI/CD pipeline requirements
4. Checking system configuration

Usage:
    python alejo_system_diagnostic.py [options]

Options:
    --ci                Run in CI mode (exit with error code on issues)
    --check-modules     Check Python module availability
    --check-services    Check microservice health
    --check-pipeline    Validate CI/CD pipeline requirements
    --check-config      Check system configuration
    --all               Run all checks (default)
    --report            Generate JSON report
    --output FILE       Output file for report (default: diagnostic_report.json)
    --verbose           Show detailed output
"""

import argparse
import importlib
import json
import logging
import os
import platform
import subprocess
import sys
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("alejo.system_diagnostic")

class AlejoSystemDiagnostic:
    def __init__(self, args):
        self.args = args
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "system_info": self.get_system_info(),
            "checks": {},
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "warnings": 0
            }
        }
    
    def get_system_info(self):
        """Gather system information"""
        return {
            "platform": platform.platform(),
            "python_version": sys.version,
            "python_path": sys.executable,
            "cwd": os.getcwd(),
            "environment": "CI" if self.args.ci else "Development"
        }
    
    def run_diagnostic(self):
        """Run the selected diagnostic checks"""
        if self.args.all or self.args.check_modules:
            self.check_modules()
        
        if self.args.all or self.args.check_services:
            self.check_services()
        
        if self.args.all or self.args.check_pipeline:
            self.check_pipeline()
        
        if self.args.all or self.args.check_config:
            self.check_config()
        
        self.summarize_results()
        
        if self.args.report:
            self.generate_report()
        
        # Return appropriate exit code in CI mode
        if self.args.ci and self.results["summary"]["failed"] > 0:
            return 1
        return 0
    
    def check_modules(self):
        """Check Python module availability"""
        logger.info("Checking Python module availability...")
        
        modules_to_check = [
            'alejo',
            'alejo.brain',
            'alejo.brain.alejo_brain',
            'alejo.emotional_intelligence',
            'alejo.emotional_intelligence.memory',
            'alejo.emotional_intelligence.processor',
            'alejo.emotional_intelligence.ethics',
            'alejo.services',
            'alejo.services.communication',
            'alejo.utils',
            'alejo.utils.error_handling'
        ]
        
        module_results = {
            "passed": [],
            "failed": []
        }
        
        for module in modules_to_check:
            try:
                importlib.import_module(module)
                logger.info(f"✅ Module {module} is available")
                module_results["passed"].append(module)
            except ImportError as e:
                logger.error(f"❌ Failed to import {module}: {e}")
                module_results["failed"].append({
                    "module": module,
                    "error": str(e)
                })
        
        self.results["checks"]["modules"] = {
            "total": len(modules_to_check),
            "passed": len(module_results["passed"]),
            "failed": len(module_results["failed"]),
            "details": module_results
        }
        
        self.results["summary"]["total"] += len(modules_to_check)
        self.results["summary"]["passed"] += len(module_results["passed"])
        self.results["summary"]["failed"] += len(module_results["failed"])
    
    def check_services(self):
        """Check microservice health"""
        logger.info("Checking microservice health...")
        
        # Import the service health check functionality
        try:
            sys.path.insert(0, os.getcwd())
            from service_health_check import check_service_health
            
            services = [
                {"name": "Brain Service", "endpoint": "http://localhost:8000/process"},
                {"name": "Emotional Intelligence", "endpoint": "http://localhost:8001/sentiment"},
                {"name": "Gesture System", "endpoint": "http://localhost:8002/gesture"}
            ]
            
            service_results = {
                "up": [],
                "down": []
            }
            
            for service in services:
                try:
                    if check_service_health(service["endpoint"], service["name"], timeout=2):
                        service_results["up"].append(service["name"])
                    else:
                        service_results["down"].append({
                            "service": service["name"],
                            "endpoint": service["endpoint"]
                        })
                except Exception as e:
                    logger.error(f"Error checking {service['name']}: {e}")
                    service_results["down"].append({
                        "service": service["name"],
                        "endpoint": service["endpoint"],
                        "error": str(e)
                    })
            
            self.results["checks"]["services"] = {
                "total": len(services),
                "up": len(service_results["up"]),
                "down": len(service_results["down"]),
                "details": service_results
            }
            
            self.results["summary"]["total"] += len(services)
            self.results["summary"]["passed"] += len(service_results["up"])
            self.results["summary"]["failed"] += len(service_results["down"])
            
        except ImportError:
            logger.warning("⚠️ Service health check module not available")
            self.results["checks"]["services"] = {
                "error": "Service health check module not available"
            }
            self.results["summary"]["warnings"] += 1
    
    def check_pipeline(self):
        """Check CI/CD pipeline requirements"""
        logger.info("Checking CI/CD pipeline requirements...")
        
        pipeline_checks = [
            {"name": "GitHub Actions workflow file", "path": ".github/workflows/alejo-ci-cd.yml"},
            {"name": "Security scanner", "path": "alejo_security_scanner.py"},
            {"name": "Comprehensive test runner", "path": "run_comprehensive_tests.py"},
            {"name": "Deployment script", "path": "deploy.py"}
        ]
        
        pipeline_results = {
            "passed": [],
            "failed": []
        }
        
        for check in pipeline_checks:
            if os.path.exists(check["path"]):
                logger.info(f"✅ {check['name']} exists at {check['path']}")
                pipeline_results["passed"].append(check["name"])
            else:
                logger.error(f"❌ {check['name']} not found at {check['path']}")
                pipeline_results["failed"].append({
                    "name": check["name"],
                    "path": check["path"]
                })
        
        # Check if security scanner is executable
        if os.path.exists("alejo_security_scanner.py"):
            try:
                # On Windows, we can't check executable permission directly
                # Instead, check if we can run it with Python
                if platform.system() == "Windows":
                    result = subprocess.run(
                        ["python", "-m", "alejo_security_scanner", "--help"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        timeout=5
                    )
                    is_executable = result.returncode == 0 or "usage" in result.stdout.lower() or "usage" in result.stderr.lower()
                else:
                    is_executable = os.access("alejo_security_scanner.py", os.X_OK)
                
                if is_executable:
                    logger.info("✅ Security scanner is executable")
                    pipeline_results["passed"].append("Security scanner executable")
                else:
                    logger.warning("⚠️ Security scanner is not executable")
                    pipeline_results["failed"].append({
                        "name": "Security scanner executable",
                        "path": "alejo_security_scanner.py",
                        "error": "Not executable"
                    })
            except Exception as e:
                logger.error(f"❌ Error checking security scanner: {e}")
                pipeline_results["failed"].append({
                    "name": "Security scanner executable",
                    "path": "alejo_security_scanner.py",
                    "error": str(e)
                })
        
        self.results["checks"]["pipeline"] = {
            "total": len(pipeline_checks) + 1,  # +1 for executable check
            "passed": len(pipeline_results["passed"]),
            "failed": len(pipeline_results["failed"]),
            "details": pipeline_results
        }
        
        self.results["summary"]["total"] += len(pipeline_checks) + 1
        self.results["summary"]["passed"] += len(pipeline_results["passed"])
        self.results["summary"]["failed"] += len(pipeline_results["failed"])
    
    def check_config(self):
        """Check system configuration"""
        logger.info("Checking system configuration...")
        
        config_checks = [
            {"name": "Environment variables", "check": self.check_env_vars},
            {"name": "Required directories", "check": self.check_directories},
            {"name": "Configuration files", "check": self.check_config_files}
        ]
        
        config_results = {
            "passed": [],
            "failed": [],
            "warnings": []
        }
        
        for check in config_checks:
            try:
                result = check["check"]()
                if result["status"] == "passed":
                    logger.info(f"✅ {check['name']} check passed")
                    config_results["passed"].append(check["name"])
                elif result["status"] == "warning":
                    logger.warning(f"⚠️ {check['name']} check has warnings")
                    config_results["warnings"].append({
                        "name": check["name"],
                        "details": result["details"]
                    })
                else:
                    logger.error(f"❌ {check['name']} check failed")
                    config_results["failed"].append({
                        "name": check["name"],
                        "details": result["details"]
                    })
            except Exception as e:
                logger.error(f"❌ Error during {check['name']} check: {e}")
                config_results["failed"].append({
                    "name": check["name"],
                    "error": str(e)
                })
        
        self.results["checks"]["config"] = {
            "total": len(config_checks),
            "passed": len(config_results["passed"]),
            "failed": len(config_results["failed"]),
            "warnings": len(config_results["warnings"]),
            "details": config_results
        }
        
        self.results["summary"]["total"] += len(config_checks)
        self.results["summary"]["passed"] += len(config_results["passed"])
        self.results["summary"]["failed"] += len(config_results["failed"])
        self.results["summary"]["warnings"] += len(config_results["warnings"])
    
    def check_env_vars(self):
        """Check required environment variables"""
        required_vars = ["ALEJO_ENV", "ALEJO_LOG_LEVEL"]
        optional_vars = ["ALEJO_DATA_DIR", "ALEJO_PORT"]
        
        missing_required = [var for var in required_vars if var not in os.environ]
        missing_optional = [var for var in optional_vars if var not in os.environ]
        
        if missing_required:
            return {
                "status": "failed",
                "details": {
                    "missing_required": missing_required,
                    "missing_optional": missing_optional
                }
            }
        elif missing_optional:
            return {
                "status": "warning",
                "details": {
                    "missing_optional": missing_optional
                }
            }
        else:
            return {"status": "passed"}
    
    def check_directories(self):
        """Check required directories"""
        required_dirs = ["alejo", "tests", "docs"]
        optional_dirs = ["data", "logs", "models"]
        
        missing_required = [dir for dir in required_dirs if not os.path.isdir(dir)]
        missing_optional = [dir for dir in optional_dirs if not os.path.isdir(dir)]
        
        if missing_required:
            return {
                "status": "failed",
                "details": {
                    "missing_required": missing_required,
                    "missing_optional": missing_optional
                }
            }
        elif missing_optional:
            return {
                "status": "warning",
                "details": {
                    "missing_optional": missing_optional
                }
            }
        else:
            return {"status": "passed"}
    
    def check_config_files(self):
        """Check configuration files"""
        required_files = [".env.example", "requirements.txt"]
        optional_files = ["setup.py", "README.md", "LICENSE"]
        
        missing_required = [file for file in required_files if not os.path.isfile(file)]
        missing_optional = [file for file in optional_files if not os.path.isfile(file)]
        
        if missing_required:
            return {
                "status": "failed",
                "details": {
                    "missing_required": missing_required,
                    "missing_optional": missing_optional
                }
            }
        elif missing_optional:
            return {
                "status": "warning",
                "details": {
                    "missing_optional": missing_optional
                }
            }
        else:
            return {"status": "passed"}
    
    def summarize_results(self):
        """Summarize diagnostic results"""
        logger.info("\n=== ALEJO System Diagnostic Summary ===")
        logger.info(f"Total checks: {self.results['summary']['total']}")
        logger.info(f"Passed: {self.results['summary']['passed']}")
        logger.info(f"Failed: {self.results['summary']['failed']}")
        logger.info(f"Warnings: {self.results['summary']['warnings']}")
        
        if self.results["summary"]["failed"] > 0:
            logger.error("❌ System diagnostic detected issues that need attention")
            if self.args.ci:
                logger.error("CI mode enabled - exiting with error code")
        elif self.results["summary"]["warnings"] > 0:
            logger.warning("⚠️ System diagnostic completed with warnings")
        else:
            logger.info("✅ All system diagnostic checks passed")
    
    def generate_report(self):
        """Generate diagnostic report"""
        output_file = self.args.output or "diagnostic_report.json"
        
        try:
            with open(output_file, 'w') as f:
                json.dump(self.results, f, indent=2)
            logger.info(f"Diagnostic report saved to {output_file}")
        except Exception as e:
            logger.error(f"Error generating report: {e}")


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO System Diagnostic Tool")
    parser.add_argument("--ci", action="store_true", help="Run in CI mode (exit with error code on issues)")
    parser.add_argument("--check-modules", action="store_true", help="Check Python module availability")
    parser.add_argument("--check-services", action="store_true", help="Check microservice health")
    parser.add_argument("--check-pipeline", action="store_true", help="Validate CI/CD pipeline requirements")
    parser.add_argument("--check-config", action="store_true", help="Check system configuration")
    parser.add_argument("--all", action="store_true", help="Run all checks (default)")
    parser.add_argument("--report", action="store_true", help="Generate JSON report")
    parser.add_argument("--output", help="Output file for report")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    
    args = parser.parse_args()
    
    # If no check type is specified, run all checks
    if not any([args.check_modules, args.check_services, args.check_pipeline, args.check_config]):
        args.all = True
    
    # Set log level based on verbosity
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    return args


if __name__ == "__main__":
    args = parse_args()
    diagnostic = AlejoSystemDiagnostic(args)
    sys.exit(diagnostic.run_diagnostic())
