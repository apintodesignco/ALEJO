#!/usr/bin/env python3
"""
ALEJO Browser Test Runner
Provides comprehensive automated browser testing capabilities
"""

import os
import sys
import time
import json
import logging
import subprocess
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Union, Any, Tuple

# Import compatibility tester
from .compatibility import BrowserCompatibilityTester

logger = logging.getLogger("alejo.testing.browser_testing.runner")

class BrowserTestRunner:
    """
    Automated browser test runner for ALEJO
    
    This class provides methods to run comprehensive browser tests with different
    configurations and test scenarios. It integrates with the BrowserCompatibilityTester
    to run tests across multiple browsers and collect detailed results.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the browser test runner
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        self.results_dir = Path(self.config.get("results_dir", "test_results"))
        self.results_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.test_results = {}
        
        # Initialize compatibility tester
        self.compatibility_tester = BrowserCompatibilityTester(self.config)
        
        # Configure logging
        self._setup_logging()
        
        logger.info("Browser test runner initialized")
    
    def _setup_logging(self):
        """Configure logging for the browser test runner"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
            
            # Also log to file
            file_handler = logging.FileHandler("browser_tests.log")
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
    
    def run_comprehensive_tests(self, urls: List[str], browsers: List[str] = None) -> Dict[str, Any]:
        """
        Run comprehensive tests on multiple URLs and browsers
        
        Args:
            urls: List of URLs to test
            browsers: List of browsers to test with (e.g., ["chrome", "firefox"])
            
        Returns:
            Dictionary with comprehensive test results
        """
        test_name = f"comprehensive_{self.timestamp}"
        logger.info(f"Starting comprehensive tests with name: {test_name}")
        
        # Create test directory
        test_dir = self.results_dir / test_name
        test_dir.mkdir(exist_ok=True)
        
        # Initialize results
        results = {
            "test_name": test_name,
            "timestamp": datetime.now().isoformat(),
            "urls_tested": len(urls),
            "browsers_tested": 0,
            "total_tests": 0,
            "successful_tests": 0,
            "failed_tests": 0,
            "url_results": {}
        }
        
        # Run tests for each URL
        for url in urls:
            logger.info(f"Testing URL: {url}")
            
            try:
                # Run compatibility tests for this URL
                url_test_name = f"url_{len(results['url_results']) + 1}"
                url_result = self.compatibility_tester.run_tests(url, browsers, f"{test_name}/{url_test_name}")
                
                # Update results
                results["url_results"][url] = {
                    "test_name": url_test_name,
                    "browsers_tested": len(url_result.get("browsers", {})),
                    "successful_tests": sum(1 for browser in url_result.get("browsers", {}).values() if browser.get("success")),
                    "failed_tests": sum(1 for browser in url_result.get("browsers", {}).values() if not browser.get("success")),
                    "browser_results": url_result.get("browsers", {})
                }
                
                # Update overall statistics
                results["browsers_tested"] = max(results["browsers_tested"], len(url_result.get("browsers", {})))
                results["total_tests"] += len(url_result.get("browsers", {}))
                results["successful_tests"] += results["url_results"][url]["successful_tests"]
                results["failed_tests"] += results["url_results"][url]["failed_tests"]
                
            except Exception as e:
                logger.error(f"Error testing URL {url}: {e}")
                logger.error(traceback.format_exc())
                results["url_results"][url] = {
                    "error": str(e)
                }
        
        # Save overall results
        results_file = test_dir / "comprehensive_results.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Comprehensive test results saved to {results_file}")
        
        return results
    
    def run_scenario_tests(self, scenarios: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Run tests based on predefined scenarios
        
        Args:
            scenarios: List of scenario dictionaries, each with:
                - name: Scenario name
                - url: URL to test
                - browsers: List of browsers to test with
                - config: Additional configuration for this scenario
            
        Returns:
            Dictionary with scenario test results
        """
        test_name = f"scenarios_{self.timestamp}"
        logger.info(f"Starting scenario tests with name: {test_name}")
        
        # Create test directory
        test_dir = self.results_dir / test_name
        test_dir.mkdir(exist_ok=True)
        
        # Initialize results
        results = {
            "test_name": test_name,
            "timestamp": datetime.now().isoformat(),
            "scenarios_tested": len(scenarios),
            "total_tests": 0,
            "successful_tests": 0,
            "failed_tests": 0,
            "scenario_results": {}
        }
        
        # Run tests for each scenario
        for i, scenario in enumerate(scenarios):
            scenario_name = scenario.get("name", f"scenario_{i+1}")
            logger.info(f"Testing scenario: {scenario_name}")
            
            try:
                # Get scenario parameters
                url = scenario.get("url")
                browsers = scenario.get("browsers")
                scenario_config = scenario.get("config", {})
                
                if not url:
                    raise ValueError("Scenario must include a URL")
                
                # Update configuration for this scenario
                scenario_tester = BrowserCompatibilityTester({**self.config, **scenario_config})
                
                # Run compatibility tests for this scenario
                scenario_result = scenario_tester.run_tests(url, browsers, f"{test_name}/{scenario_name}")
                
                # Update results
                results["scenario_results"][scenario_name] = {
                    "url": url,
                    "browsers_tested": len(scenario_result.get("browsers", {})),
                    "successful_tests": sum(1 for browser in scenario_result.get("browsers", {}).values() if browser.get("success")),
                    "failed_tests": sum(1 for browser in scenario_result.get("browsers", {}).values() if not browser.get("success")),
                    "browser_results": scenario_result.get("browsers", {})
                }
                
                # Update overall statistics
                results["total_tests"] += len(scenario_result.get("browsers", {}))
                results["successful_tests"] += results["scenario_results"][scenario_name]["successful_tests"]
                results["failed_tests"] += results["scenario_results"][scenario_name]["failed_tests"]
                
            except Exception as e:
                logger.error(f"Error testing scenario {scenario_name}: {e}")
                logger.error(traceback.format_exc())
                results["scenario_results"][scenario_name] = {
                    "error": str(e)
                }
        
        # Save overall results
        results_file = test_dir / "scenario_results.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Scenario test results saved to {results_file}")
        
        return results
    
    def run_regression_tests(self, baseline_url: str, test_url: str, browsers: List[str] = None) -> Dict[str, Any]:
        """
        Run regression tests comparing a baseline URL with a test URL
        
        Args:
            baseline_url: Baseline URL to compare against
            test_url: URL to test
            browsers: List of browsers to test with
            
        Returns:
            Dictionary with regression test results
        """
        test_name = f"regression_{self.timestamp}"
        logger.info(f"Starting regression tests with name: {test_name}")
        
        # Create test directory
        test_dir = self.results_dir / test_name
        test_dir.mkdir(exist_ok=True)
        
        # Run tests for baseline URL
        logger.info(f"Testing baseline URL: {baseline_url}")
        baseline_result = self.compatibility_tester.run_tests(baseline_url, browsers, f"{test_name}/baseline")
        
        # Run tests for test URL
        logger.info(f"Testing test URL: {test_url}")
        test_result = self.compatibility_tester.run_tests(test_url, browsers, f"{test_name}/test")
        
        # Compare results
        comparison = self._compare_test_results(baseline_result, test_result)
        
        # Save comparison results
        comparison_file = test_dir / "regression_results.json"
        with open(comparison_file, "w") as f:
            json.dump(comparison, f, indent=2)
        
        logger.info(f"Regression test results saved to {comparison_file}")
        
        return comparison
    
    def _compare_test_results(self, baseline_result: Dict[str, Any], test_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two test results
        
        Args:
            baseline_result: Baseline test result
            test_result: Test result to compare
            
        Returns:
            Dictionary with comparison results
        """
        comparison = {
            "baseline_url": baseline_result.get("url"),
            "test_url": test_result.get("url"),
            "timestamp": datetime.now().isoformat(),
            "browsers": {}
        }
        
        # Find common browsers
        common_browsers = set(baseline_result.get("browsers", {}).keys()) & set(test_result.get("browsers", {}).keys())
        
        for browser in common_browsers:
            baseline_browser = baseline_result["browsers"][browser]
            test_browser = test_result["browsers"][browser]
            
            # Compare browser results
            browser_comparison = {
                "baseline_success": baseline_browser.get("success"),
                "test_success": test_browser.get("success"),
                "baseline_load_time": baseline_browser.get("load_time"),
                "test_load_time": test_browser.get("load_time"),
                "load_time_diff": None,
                "title_match": baseline_browser.get("page_title") == test_browser.get("page_title"),
                "element_count_diff": {}
            }
            
            # Calculate load time difference
            if baseline_browser.get("load_time") and test_browser.get("load_time"):
                browser_comparison["load_time_diff"] = round(test_browser["load_time"] - baseline_browser["load_time"], 2)
            
            # Compare element counts
            for element in set(baseline_browser.get("elements_found", {}).keys()) | set(test_browser.get("elements_found", {}).keys()):
                count1 = baseline_browser.get("elements_found", {}).get(element, 0)
                count2 = test_browser.get("elements_found", {}).get(element, 0)
                browser_comparison["element_count_diff"][element] = count2 - count1
            
            comparison["browsers"][browser] = browser_comparison
        
        return comparison
    
    def print_test_summary(self, results: Dict[str, Any]):
        """
        Print a summary of test results
        
        Args:
            results: Test results to summarize
        """
        print("\n=== Browser Test Summary ===\n")
        
        if "test_name" in results:
            print(f"Test Name: {results['test_name']}")
        
        if "timestamp" in results:
            print(f"Timestamp: {results['timestamp']}")
        
        # Print comprehensive test summary
        if "urls_tested" in results:
            print(f"\nURLs Tested: {results['urls_tested']}")
            print(f"Browsers Tested: {results['browsers_tested']}")
            print(f"Total Tests: {results['total_tests']}")
            print(f"Successful Tests: {results['successful_tests']}")
            print(f"Failed Tests: {results['failed_tests']}")
            
            print("\nURL Results:")
            for url, url_result in results.get("url_results", {}).items():
                if "error" in url_result:
                    print(f"  {url}: Error - {url_result['error']}")
                else:
                    success_rate = url_result["successful_tests"] / url_result["browsers_tested"] * 100 if url_result["browsers_tested"] > 0 else 0
                    print(f"  {url}: {success_rate:.1f}% success ({url_result['successful_tests']}/{url_result['browsers_tested']})")
        
        # Print scenario test summary
        elif "scenarios_tested" in results:
            print(f"\nScenarios Tested: {results['scenarios_tested']}")
            print(f"Total Tests: {results['total_tests']}")
            print(f"Successful Tests: {results['successful_tests']}")
            print(f"Failed Tests: {results['failed_tests']}")
            
            print("\nScenario Results:")
            for scenario_name, scenario_result in results.get("scenario_results", {}).items():
                if "error" in scenario_result:
                    print(f"  {scenario_name}: Error - {scenario_result['error']}")
                else:
                    success_rate = scenario_result["successful_tests"] / scenario_result["browsers_tested"] * 100 if scenario_result["browsers_tested"] > 0 else 0
                    print(f"  {scenario_name}: {success_rate:.1f}% success ({scenario_result['successful_tests']}/{scenario_result['browsers_tested']})")
                    print(f"    URL: {scenario_result['url']}")
        
        # Print regression test summary
        elif "baseline_url" in results:
            print(f"\nBaseline URL: {results['baseline_url']}")
            print(f"Test URL: {results['test_url']}")
            
            print("\nBrowser Comparisons:")
            for browser, comparison in results.get("browsers", {}).items():
                print(f"  {browser.capitalize()}:")
                baseline_status = "Success" if comparison.get("baseline_success") else "Failed"
                test_status = "Success" if comparison.get("test_success") else "Failed"
                print(f"    Baseline: {baseline_status}, Test: {test_status}")
                
                if comparison.get("load_time_diff") is not None:
                    diff = comparison["load_time_diff"]
                    faster_slower = "faster" if diff < 0 else "slower"
                    print(f"    Load Time: Test is {abs(diff):.2f}s {faster_slower} than baseline")
                
                print(f"    Title Match: {'Yes' if comparison.get('title_match') else 'No'}")
                
                # Show significant element count differences
                significant_diffs = {k: v for k, v in comparison.get("element_count_diff", {}).items() if abs(v) > 0}
                if significant_diffs:
                    print("    Element Count Differences:")
                    for element, diff in significant_diffs.items():
                        print(f"      {element}: {'+' if diff > 0 else ''}{diff}")
        
        print()
