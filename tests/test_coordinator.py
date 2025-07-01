"""
ALEJO Test Coordinator
Manages comprehensive testing of ALEJO components and services
"""

import os
import sys
import time
import json
import asyncio
import unittest
import logging
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import ALEJO modules
from alejo.core.event_bus import EventBus, EventType
from scripts.setup_test_env import TestEnvironmentSetup
import secrets  # More secure for cryptographic purposes

logger = logging.getLogger(__name__)

class TestCoordinator:
    """
    Coordinates all testing activities for ALEJO
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize test coordinator
        
        Args:
            config_path: Path to test config file, defaults to standard location
        """
        self.project_root = project_root
        self.config_path = config_path or str(self.project_root / "tests" / "integration" / "test_config.json")
        self.report_dir = self.project_root / "tests" / "reports"
        self.report_dir.mkdir(exist_ok=True)
        
        self.load_config()
        self.setup_logging()
        
    def load_config(self):
        """Load test configuration"""
        try:
            with open(self.config_path) as f:
                self.config = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load test config: {e}")
            self.config = {
                "services": {},
                "test_settings": {
                    "parallel_tests": False,
                    "test_timeout": 60,
                    "retry_count": 2
                },
                "test_resources": {}
            }
            
    def setup_logging(self):
        """Configure logging for tests"""
        log_file = self.report_dir / f"alejo_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
        
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[file_handler, console_handler]
        )

    async def run_all_tests(self):
        """Run all test categories and handle failures gracefully."""
        start_time = time.time()

        # Setup test environment
        try:
            await self.setup_environment()
        except Exception as e:
            logger.critical(f"Test environment setup failed: {e}", exc_info=True)
            # If setup fails, we can't run tests
            return {
                "summary": {"status": "SETUP_FAILED", "error": str(e)},
                "details": {}
            }

        results = {}
        test_stages = {
            "unit": self.run_unit_tests,
            "component": self.run_component_tests,
            "integration": self.run_integration_tests,
            "system": self.run_system_tests,
        }

        for stage_name, stage_func in test_stages.items():
            try:
                results[stage_name] = await stage_func()
            except Exception as e:
                logger.error(f"{stage_name.capitalize()} tests failed to execute: {e}", exc_info=True)
                results[stage_name] = {
                    "summary": {"status": "EXECUTION_ERROR", "error": str(e)},
                    "details": {},
                }

        # Reformat results for reporting
        all_results = {
            "summary": {
                "timestamp": datetime.now().isoformat(),
                "duration": time.time() - start_time,
                "unit_tests": results.get("unit", {}).get("summary", {"status": "NOT_RUN"}),
                "component_tests": results.get("component", {}).get("summary", {"status": "NOT_RUN"}),
                "integration_tests": results.get("integration", {}).get("summary", {"status": "NOT_RUN"}),
                "system_tests": results.get("system", {}).get("summary", {"status": "NOT_RUN"}),
            },
            "details": {
                "unit": results.get("unit", {}).get("details", {}),
                "component": results.get("component", {}).get("details", {}),
                "integration": results.get("integration", {}).get("details", {}),
                "system": results.get("system", {}).get("details", {}),
            }
        }

        # Generate summary report
        self.generate_report(all_results)

        return all_results
        
    async def setup_environment(self):
        """Prepare the test environment"""
        logger.info("Setting up test environment...")
        setup = TestEnvironmentSetup()
        setup.setup()
        
    async def run_unit_tests(self):
        """Run unit tests"""
        logger.info("Running unit tests...")
        start_time = time.time()
        
        # Discover and run tests
        loader = unittest.TestLoader()
        suite = loader.discover(str(self.project_root / "tests" / "unit"))
        
        # Run tests
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        
        # Process results
        results = {
            "summary": {
                "total": result.testsRun,
                "passed": result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped),
                "failed": len(result.failures),
                "errors": len(result.errors),
                "skipped": len(result.skipped),
                "success_rate": (result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped)) / result.testsRun if result.testsRun > 0 else 0,
                "duration": time.time() - start_time
            },
            "details": {
                "failures": [str(test) for test, trace in result.failures],
                "errors": [str(test) for test, trace in result.errors]
            }
        }
        
        return results
        
    async def run_component_tests(self):
        """Run component tests"""
        logger.info("Running component tests...")
        start_time = time.time()
        
        # Components to test
        components = [
            "brain",
            "memory", 
            "voice",
            "vision", 
            "emotional_intelligence",
            "ui",
            "commands",
            "core"
        ]
        
        results = {
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0,
                "duration": 0
            },
            "details": {
                "components": {}
            }
        }
        
        # Run tests for each component
        for component in components:
            component_dir = self.project_root / "tests" / "components" / component
            if not component_dir.exists():
                logger.warning(f"No tests found for component: {component}")
                continue
                
            # Run component tests
            loader = unittest.TestLoader()
            suite = loader.discover(str(component_dir))
            result = unittest.TextTestRunner(verbosity=2).run(suite)
            
            # Add results
            component_result = {
                "total": result.testsRun,
                "passed": result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped),
                "failed": len(result.failures),
                "errors": len(result.errors),
                "skipped": len(result.skipped),
                "success_rate": (result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped)) / result.testsRun if result.testsRun > 0 else 0
            }
            
            results["details"]["components"][component] = component_result
            
            # Update summary
            results["summary"]["total"] += component_result["total"]
            results["summary"]["passed"] += component_result["passed"]
            results["summary"]["failed"] += component_result["failed"]
            results["summary"]["errors"] += component_result["errors"]
            results["summary"]["skipped"] += component_result["skipped"]
            
        # Calculate overall success rate
        if results["summary"]["total"] > 0:
            results["summary"]["success_rate"] = results["summary"]["passed"] / results["summary"]["total"]
            
        results["summary"]["duration"] = time.time() - start_time
        
        return results
        
    async def run_integration_tests(self):
        """Run integration tests"""
        logger.info("Running integration tests...")
        
        # Import here to avoid circular imports
        from tests.integration.test_runner import IntegrationTestRunner
        
        # Run integration tests
        test_runner = IntegrationTestRunner()
        results = await test_runner.run_tests()
        
        return results
        
    async def run_system_tests(self):
        """Run system-level tests"""
        logger.info("Running system tests...")
        start_time = time.time()
        
        # Test categories
        categories = [
            "end_to_end",
            "performance",
            "stress",
            "usability"
        ]
        
        # Initialize results
        results = {
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0,
                "duration": 0
            },
            "details": {
                "categories": {}
            }
        }
        
        # Check if system tests are available
        system_test_dir = self.project_root / "tests" / "system"
        if not system_test_dir.exists():
            logger.warning("No system tests found")
            return results
            
        # Run each test category
        for category in categories:
            category_dir = system_test_dir / category
            if not category_dir.exists():
                continue
                
            # Run category tests
            loader = unittest.TestLoader()
            suite = loader.discover(str(category_dir))
            result = unittest.TextTestRunner(verbosity=2).run(suite)
            
            # Record results
            category_result = {
                "total": result.testsRun,
                "passed": result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped),
                "failed": len(result.failures),
                "errors": len(result.errors),
                "skipped": len(result.skipped),
                "success_rate": (result.testsRun - len(result.errors) - len(result.failures) - len(result.skipped)) / result.testsRun if result.testsRun > 0 else 0
            }
            
            results["details"]["categories"][category] = category_result
            
            # Update summary
            results["summary"]["total"] += category_result["total"]
            results["summary"]["passed"] += category_result["passed"]
            results["summary"]["failed"] += category_result["failed"]
            results["summary"]["errors"] += category_result["errors"]
            results["summary"]["skipped"] += category_result["skipped"]
            
        # Calculate overall success rate
        if results["summary"]["total"] > 0:
            results["summary"]["success_rate"] = results["summary"]["passed"] / results["summary"]["total"]
            
        results["summary"]["duration"] = time.time() - start_time
        
        return results
        
    def generate_report(self, results):
        """Generate HTML test report"""
        report_file = self.report_dir / f"alejo_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        
        # Calculate overall stats
        total_tests = (
            results["summary"]["unit_tests"].get("total", 0) +
            results["summary"]["component_tests"].get("total", 0) +
            results["summary"]["integration_tests"].get("total_tests", 0) +
            results["summary"]["system_tests"].get("total", 0)
        )
        
        total_passed = (
            results["summary"]["unit_tests"].get("passed", 0) +
            results["summary"]["component_tests"].get("passed", 0) +
            results["summary"]["integration_tests"].get("total_services", 0) * 
                results["summary"]["integration_tests"].get("success_rate", 0) +
            results["summary"]["system_tests"].get("passed", 0)
        )
        
        overall_success_rate = total_passed / total_tests if total_tests > 0 else 0
        
        # Generate HTML
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>ALEJO Test Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #333366; }}
                .summary {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; }}
                .success {{ color: green; }}
                .failure {{ color: red; }}
                .warning {{ color: orange; }}
                table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #333366; color: white; }}
                tr:nth-child(even) {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>ALEJO Test Report</h1>
            <div class="summary">
                <h2>Summary</h2>
                <p>Timestamp: {results["summary"]["timestamp"]}</p>
                <p>Duration: {results["summary"]["duration"]:.2f} seconds</p>
                <p>Total Tests: {total_tests}</p>
                <p>Success Rate: <span class="{'success' if overall_success_rate > 0.9 else 'warning' if overall_success_rate > 0.7 else 'failure'}">{overall_success_rate*100:.1f}%</span></p>
            </div>
            
            <h2>Test Categories</h2>
            <table>
                <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Success Rate</th>
                </tr>
                <tr>
                    <td>Unit Tests</td>
                    <td>{results["summary"]["unit_tests"].get("total", 0)}</td>
                    <td>{results["summary"]["unit_tests"].get("passed", 0)}</td>
                    <td>{results["summary"]["unit_tests"].get("failed", 0) + results["summary"]["unit_tests"].get("errors", 0)}</td>
                    <td class="{'success' if results["summary"]["unit_tests"].get("success_rate", 0) > 0.9 else 'warning' if results["summary"]["unit_tests"].get("success_rate", 0) > 0.7 else 'failure'}">{results["summary"]["unit_tests"].get("success_rate", 0)*100:.1f}%</td>
                </tr>
                <tr>
                    <td>Component Tests</td>
                    <td>{results["summary"]["component_tests"].get("total", 0)}</td>
                    <td>{results["summary"]["component_tests"].get("passed", 0)}</td>
                    <td>{results["summary"]["component_tests"].get("failed", 0) + results["summary"]["component_tests"].get("errors", 0)}</td>
                    <td class="{'success' if results["summary"]["component_tests"].get("success_rate", 0) > 0.9 else 'warning' if results["summary"]["component_tests"].get("success_rate", 0) > 0.7 else 'failure'}">{results["summary"]["component_tests"].get("success_rate", 0)*100:.1f}%</td>
                </tr>
                <tr>
                    <td>Integration Tests</td>
                    <td>{results["summary"]["integration_tests"].get("total_tests", 0)}</td>
                    <td>{int(results["summary"]["integration_tests"].get("total_services", 0) * results["summary"]["integration_tests"].get("success_rate", 0))}</td>
                    <td>{int(results["summary"]["integration_tests"].get("total_services", 0) * (1-results["summary"]["integration_tests"].get("success_rate", 0)))}</td>
                    <td class="{'success' if results["summary"]["integration_tests"].get("success_rate", 0) > 0.9 else 'warning' if results["summary"]["integration_tests"].get("success_rate", 0) > 0.7 else 'failure'}">{results["summary"]["integration_tests"].get("success_rate", 0)*100:.1f}%</td>
                </tr>
                <tr>
                    <td>System Tests</td>
                    <td>{results["summary"]["system_tests"].get("total", 0)}</td>
                    <td>{results["summary"]["system_tests"].get("passed", 0)}</td>
                    <td>{results["summary"]["system_tests"].get("failed", 0) + results["summary"]["system_tests"].get("errors", 0)}</td>
                    <td class="{'success' if results["summary"]["system_tests"].get("success_rate", 0) > 0.9 else 'warning' if results["summary"]["system_tests"].get("success_rate", 0) > 0.7 else 'failure'}">{results["summary"]["system_tests"].get("success_rate", 0)*100:.1f}%</td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        # Save report
        with open(report_file, 'w') as f:
            f.write(html)
            
        logger.info(f"Test report generated at {report_file}")

async def main():
    """Entry point for the test coordinator"""
    logging.basicConfig(level=logging.INFO)
    
    coordinator = TestCoordinator()
    results = await coordinator.run_all_tests()
    
    # Print summary
    print("\n" + "=" * 50)
    print("ALEJO TEST SUMMARY")
    print("=" * 50)
    
    # Unit tests
    print(f"\nUnit Tests: {results['summary']['unit_tests']['total']} tests")
    print(f"Pass rate: {results['summary']['unit_tests']['success_rate']*100:.1f}%")
    
    # Component tests
    print(f"\nComponent Tests: {results['summary']['component_tests']['total']} tests")
    print(f"Pass rate: {results['summary']['component_tests']['success_rate']*100:.1f}%")
    
    # Integration tests
    print(f"\nIntegration Tests: {results['summary']['integration_tests']['total_tests']} tests")
    print(f"Services: {results['summary']['integration_tests']['total_services']}")
    print(f"Pass rate: {results['summary']['integration_tests']['success_rate']*100:.1f}%")
    
    # System tests
    print(f"\nSystem Tests: {results['summary']['system_tests']['total']} tests")
    if results['summary']['system_tests']['total'] > 0:
        print(f"Pass rate: {results['summary']['system_tests']['success_rate']*100:.1f}%")
    
    # Overall
    total_tests = (
        results["summary"]["unit_tests"].get("total", 0) +
        results["summary"]["component_tests"].get("total", 0) +
        results["summary"]["integration_tests"].get("total_tests", 0) +
        results["summary"]["system_tests"].get("total", 0)
    )
    
    total_passed = (
        results["summary"]["unit_tests"].get("passed", 0) +
        results["summary"]["component_tests"].get("passed", 0) +
        results["summary"]["integration_tests"].get("total_services", 0) * 
            results["summary"]["integration_tests"].get("success_rate", 0) +
        results["summary"]["system_tests"].get("passed", 0)
    )
    
    overall_success_rate = total_passed / total_tests if total_tests > 0 else 0
    
    print("\n" + "=" * 50)
    print(f"OVERALL: {total_tests} tests, {overall_success_rate*100:.1f}% pass rate")
    print("=" * 50)
    
    print(f"\nDetailed report available at: {coordinator.report_dir}")
    
    return 0 if overall_success_rate > 0.9 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))