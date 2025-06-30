#!/usr/bin/env python3
"""
ALEJO Browser Testing Example
Demonstrates how to use the consolidated browser testing modules
"""

import os
import sys
import json
import logging
from pathlib import Path

# Add parent directory to path to allow importing alejo package
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import ALEJO modules
from alejo.testing.browser_detection import BrowserDetector
from alejo.testing.browser_testing import BrowserCompatibilityTester, BrowserTestRunner
from alejo.testing.secure_browser_testing import SecureBrowserTesting
from alejo.security.security_manager import SecurityManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("alejo.examples.browser_testing")

def detect_and_display_browsers():
    """Detect installed browsers and display information"""
    print("\n=== Detecting Installed Browsers ===\n")
    
    # Create browser detector
    detector = BrowserDetector()
    
    # Detect browsers
    browsers = detector.detect_browsers()
    
    # Get browser information
    browser_info = detector.get_browser_info()
    
    # Display browser information
    print(f"Detected {len(browsers)} browsers:")
    for browser, info in browser_info.items():
        print(f"\n- {browser.capitalize()}:")
        print(f"  Path: {info['path']}")
        print(f"  Version: {info['version']}")
        print(f"  WebDriver: {info['webdriver_path']}")
    
    return browsers

def run_basic_compatibility_test(url, browsers=None):
    """Run a basic browser compatibility test"""
    print(f"\n=== Running Basic Compatibility Test for {url} ===\n")
    
    # Create configuration
    config = {
        "headless": True,  # Run browsers in headless mode
        "timeout": 30,     # Set page load timeout to 30 seconds
        "screenshot_dir": "screenshots",  # Directory to store screenshots
        "results_dir": "test_results"     # Directory to store test results
    }
    
    # Create compatibility tester
    tester = BrowserCompatibilityTester(config)
    
    # Run tests
    test_name = "basic_test"
    results = tester.run_tests(url, browsers, test_name)
    
    # Print test summary
    tester.print_test_summary(test_name)
    
    return results

def run_comprehensive_tests(urls, browsers=None):
    """Run comprehensive tests on multiple URLs"""
    print(f"\n=== Running Comprehensive Tests on {len(urls)} URLs ===\n")
    
    # Create configuration
    config = {
        "headless": True,
        "timeout": 30,
        "screenshot_dir": "screenshots",
        "results_dir": "test_results"
    }
    
    # Create test runner
    runner = BrowserTestRunner(config)
    
    # Run comprehensive tests
    results = runner.run_comprehensive_tests(urls, browsers)
    
    # Print test summary
    runner.print_test_summary(results)
    
    return results

def run_scenario_tests():
    """Run tests with different scenarios"""
    print("\n=== Running Scenario Tests ===\n")
    
    # Create configuration
    config = {
        "headless": True,
        "timeout": 30,
        "screenshot_dir": "screenshots",
        "results_dir": "test_results"
    }
    
    # Create test runner
    runner = BrowserTestRunner(config)
    
    # Define test scenarios
    scenarios = [
        {
            "name": "desktop_scenario",
            "url": "https://example.com",
            "browsers": ["chrome", "firefox"],
            "config": {
                "window_size": (1920, 1080),
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        },
        {
            "name": "mobile_scenario",
            "url": "https://example.com",
            "browsers": ["chrome"],
            "config": {
                "window_size": (375, 812),
                "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            }
        }
    ]
    
    # Run scenario tests
    results = runner.run_scenario_tests(scenarios)
    
    # Print test summary
    runner.print_test_summary(results)
    
    return results

def run_regression_test(baseline_url, test_url, browsers=None):
    """Run regression test comparing baseline and test URLs"""
    print(f"\n=== Running Regression Test ===\n")
    print(f"Baseline URL: {baseline_url}")
    print(f"Test URL: {test_url}")
    
    # Create configuration
    config = {
        "headless": True,
        "timeout": 30,
        "screenshot_dir": "screenshots",
        "results_dir": "test_results"
    }
    
    # Create test runner
    runner = BrowserTestRunner(config)
    
    # Run regression test
    results = runner.run_regression_tests(baseline_url, test_url, browsers)
    
    # Print test summary
    runner.print_test_summary(results)
    
    return results

def run_secure_browser_test(url, browsers=None):
    """Run a secure browser test with security features"""
    print(f"\n=== Running Secure Browser Test for {url} ===\n")
    
    # Create security manager
    security_config = {
        "security_level": "medium",
        "encryption_key": os.environ.get("ALEJO_ENCRYPTION_KEY", "test_key_for_example_only")
    }
    security_manager = SecurityManager(security_config)
    
    # Create configuration
    config = {
        "headless": True,
        "timeout": 30,
        "screenshot_dir": "secure_screenshots",
        "results_dir": "secure_test_results"
    }
    
    # Create secure browser testing
    secure_tester = SecureBrowserTesting(config, security_manager)
    
    # Run secure test
    results = secure_tester.run_secure_test(
        url,
        browsers=browsers,
        session_id="example_session",
        username="example_user",
        test_name="secure_test"
    )
    
    # Print results
    print("\n=== Secure Test Results ===\n")
    if "error" in results:
        print(f"Error: {results['error']}")
    else:
        print(f"URL: {results['url']}")
        print(f"Test Name: {results['test_name']}")
        print(f"Browsers Tested: {len(results['browsers'])}")
        
        for browser, browser_result in results['browsers'].items():
            print(f"\n- {browser.capitalize()}:")
            print(f"  Success: {browser_result['success']}")
            if browser_result['success']:
                print(f"  Page Title: {browser_result['page_title']}")
                print(f"  Load Time: {browser_result['load_time']:.2f} seconds")
                print(f"  Elements Found: {browser_result['elements_found']}")
            else:
                print(f"  Error: {browser_result.get('error', 'Unknown error')}")
    
    return results

def main():
    """Main function"""
    print("=== ALEJO Browser Testing Example ===")
    
    # Detect installed browsers
    browsers = detect_and_display_browsers()
    
    # Ask user which test to run
    print("\nAvailable tests:")
    print("1. Basic Compatibility Test")
    print("2. Comprehensive Tests")
    print("3. Scenario Tests")
    print("4. Regression Test")
    print("5. Secure Browser Test")
    print("6. Run All Tests")
    
    choice = input("\nEnter test number to run (1-6): ")
    
    # URLs for testing
    test_url = "https://example.com"
    test_urls = ["https://example.com", "https://www.python.org", "https://www.selenium.dev"]
    
    # Run selected test
    if choice == "1":
        run_basic_compatibility_test(test_url)
    elif choice == "2":
        run_comprehensive_tests(test_urls)
    elif choice == "3":
        run_scenario_tests()
    elif choice == "4":
        run_regression_test("https://example.com", "https://www.example.org")
    elif choice == "5":
        run_secure_browser_test(test_url)
    elif choice == "6":
        print("\n=== Running All Tests ===")
        run_basic_compatibility_test(test_url)
        run_comprehensive_tests(test_urls)
        run_scenario_tests()
        run_regression_test("https://example.com", "https://www.example.org")
        run_secure_browser_test(test_url)
    else:
        print("Invalid choice. Exiting.")
        return 1
    
    print("\n=== Browser Testing Example Complete ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())
