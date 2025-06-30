#!/usr/bin/env python3
"""
ALEJO Browser Compatibility Tester
Provides comprehensive browser compatibility testing capabilities
"""

import os
import sys
import time
import json
import logging
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Tuple
from datetime import datetime

# Import Selenium components
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.webdriver.edge.options import Options as EdgeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.firefox.service import Service as FirefoxService
    from selenium.webdriver.edge.service import Service as EdgeService
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import WebDriverException, TimeoutException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

# Import browser detector
from ..browser_detection import BrowserDetector

logger = logging.getLogger("alejo.testing.browser_testing")

class BrowserCompatibilityTester:
    """
    Browser compatibility testing for ALEJO
    
    This class provides methods to test web applications across different browsers
    and report compatibility issues. It integrates with the BrowserDetector to
    find installed browsers and their WebDrivers.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the browser compatibility tester
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        self.results_dir = Path(self.config.get("results_dir", "test_results"))
        self.results_dir.mkdir(exist_ok=True)
        self.timeout = self.config.get("timeout", 30)
        self.headless = self.config.get("headless", True)
        
        # Initialize browser detector
        self.browser_detector = BrowserDetector(self.config)
        
        # Check Selenium availability
        if not SELENIUM_AVAILABLE:
            logger.error("Selenium is not available. Please install it with: pip install selenium")
        
        # Configure logging
        self._setup_logging()
        
        logger.info("Browser compatibility tester initialized")
    
    def _setup_logging(self):
        """Configure logging for the browser compatibility tester"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def run_tests(self, url: str, browsers: List[str] = None, test_name: str = None) -> Dict[str, Any]:
        """
        Run compatibility tests on a URL using specified browsers
        
        Args:
            url: URL to test
            browsers: List of browsers to test with (e.g., ["chrome", "firefox"])
            test_name: Name for this test run
            
        Returns:
            Dictionary with test results
        """
        if not SELENIUM_AVAILABLE:
            return {"error": "Selenium is not available"}
        
        # Generate test name if not provided
        if not test_name:
            test_name = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Detect browsers if not specified
        if not browsers:
            self.browser_detector.detect_browsers()
            browsers = list(self.browser_detector.detected_browsers.keys())
        
        if not browsers:
            logger.error("No browsers detected or specified")
            return {"error": "No browsers detected or specified"}
        
        logger.info(f"Running compatibility tests on {url} with browsers: {', '.join(browsers)}")
        
        # Create results directory for this test
        test_dir = self.results_dir / test_name
        test_dir.mkdir(exist_ok=True)
        
        # Run tests for each browser
        results = {
            "test_name": test_name,
            "url": url,
            "timestamp": datetime.now().isoformat(),
            "browsers": {}
        }
        
        for browser in browsers:
            browser_result = self._run_browser_test(browser, url, test_dir)
            results["browsers"][browser] = browser_result
        
        # Save overall results
        results_file = test_dir / "results.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Test results saved to {results_file}")
        
        return results
    
    def _run_browser_test(self, browser: str, url: str, test_dir: Path) -> Dict[str, Any]:
        """
        Run a test on a specific browser
        
        Args:
            browser: Browser name
            url: URL to test
            test_dir: Directory to save results
            
        Returns:
            Dictionary with browser-specific test results
        """
        logger.info(f"Testing {url} with {browser}")
        
        result = {
            "browser": browser,
            "success": False,
            "error": None,
            "screenshot": None,
            "load_time": None,
            "page_title": None,
            "page_source_length": None,
            "elements_found": {}
        }
        
        driver = None
        start_time = time.time()
        
        try:
            # Initialize WebDriver for the browser
            driver = self._initialize_webdriver(browser)
            if not driver:
                result["error"] = f"Failed to initialize {browser} WebDriver"
                return result
            
            # Navigate to the URL
            driver.get(url)
            
            # Wait for page to load
            WebDriverWait(driver, self.timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Calculate load time
            load_time = time.time() - start_time
            result["load_time"] = round(load_time, 2)
            
            # Get page information
            result["page_title"] = driver.title
            result["page_source_length"] = len(driver.page_source)
            
            # Count common elements
            for element in ["div", "p", "a", "img", "button", "input", "form"]:
                result["elements_found"][element] = len(driver.find_elements(By.TAG_NAME, element))
            
            # Take screenshot
            screenshot_file = f"{browser}_screenshot.png"
            screenshot_path = test_dir / screenshot_file
            driver.save_screenshot(str(screenshot_path))
            result["screenshot"] = str(screenshot_path)
            
            # Mark as successful
            result["success"] = True
            logger.info(f"Successfully tested {url} with {browser}")
            
        except TimeoutException:
            result["error"] = f"Timeout waiting for page to load in {browser}"
            logger.error(result["error"])
            
        except WebDriverException as e:
            result["error"] = f"WebDriver error in {browser}: {str(e)}"
            logger.error(result["error"])
            
        except Exception as e:
            result["error"] = f"Error testing {url} with {browser}: {str(e)}"
            logger.error(result["error"])
            
        finally:
            # Close the WebDriver
            if driver:
                try:
                    driver.quit()
                except:
                    pass
        
        # Save browser-specific results
        browser_results_file = test_dir / f"{browser}_results.json"
        with open(browser_results_file, "w") as f:
            json.dump(result, f, indent=2)
        
        return result
    
    def _initialize_webdriver(self, browser: str) -> Optional[webdriver.Remote]:
        """
        Initialize a WebDriver for a specific browser
        
        Args:
            browser: Browser name
            
        Returns:
            WebDriver instance or None if initialization failed
        """
        if not SELENIUM_AVAILABLE:
            logger.error("Selenium is not available")
            return None
        
        # Get browser path and WebDriver path
        browser_path = self.browser_detector.detected_browsers.get(browser)
        webdriver_path = self.browser_detector.get_webdriver_path(browser)
        
        if not browser_path:
            logger.error(f"Browser {browser} not found")
            return None
        
        if not webdriver_path:
            logger.error(f"WebDriver for {browser} not found")
            return None
        
        try:
            # Initialize WebDriver based on browser type
            if browser == "chrome":
                options = ChromeOptions()
                if self.headless:
                    options.add_argument("--headless")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.binary_location = browser_path
                
                service = ChromeService(executable_path=webdriver_path)
                driver = webdriver.Chrome(service=service, options=options)
                
            elif browser == "firefox":
                options = FirefoxOptions()
                if self.headless:
                    options.add_argument("--headless")
                options.binary_location = browser_path
                
                service = FirefoxService(executable_path=webdriver_path)
                driver = webdriver.Firefox(service=service, options=options)
                
            elif browser == "edge":
                options = EdgeOptions()
                if self.headless:
                    options.add_argument("--headless")
                options.binary_location = browser_path
                
                service = EdgeService(executable_path=webdriver_path)
                driver = webdriver.Edge(service=service, options=options)
                
            else:
                logger.error(f"Unsupported browser: {browser}")
                return None
            
            # Set window size and timeout
            driver.set_window_size(1920, 1080)
            driver.set_page_load_timeout(self.timeout)
            
            return driver
            
        except Exception as e:
            logger.error(f"Error initializing {browser} WebDriver: {e}")
            return None
    
    def compare_results(self, test_name1: str, test_name2: str) -> Dict[str, Any]:
        """
        Compare results from two test runs
        
        Args:
            test_name1: Name of first test run
            test_name2: Name of second test run
            
        Returns:
            Dictionary with comparison results
        """
        # Load results from both test runs
        results1 = self._load_test_results(test_name1)
        results2 = self._load_test_results(test_name2)
        
        if not results1 or not results2:
            return {"error": "Could not load test results"}
        
        # Compare results
        comparison = {
            "test1": test_name1,
            "test2": test_name2,
            "url1": results1.get("url"),
            "url2": results2.get("url"),
            "browsers": {}
        }
        
        # Find common browsers
        common_browsers = set(results1.get("browsers", {}).keys()) & set(results2.get("browsers", {}).keys())
        
        for browser in common_browsers:
            browser_result1 = results1["browsers"][browser]
            browser_result2 = results2["browsers"][browser]
            
            # Compare browser results
            browser_comparison = {
                "success1": browser_result1.get("success"),
                "success2": browser_result2.get("success"),
                "load_time1": browser_result1.get("load_time"),
                "load_time2": browser_result2.get("load_time"),
                "load_time_diff": None,
                "page_title_match": browser_result1.get("page_title") == browser_result2.get("page_title"),
                "element_count_diff": {}
            }
            
            # Calculate load time difference
            if browser_result1.get("load_time") and browser_result2.get("load_time"):
                browser_comparison["load_time_diff"] = round(browser_result2["load_time"] - browser_result1["load_time"], 2)
            
            # Compare element counts
            for element in set(browser_result1.get("elements_found", {}).keys()) | set(browser_result2.get("elements_found", {}).keys()):
                count1 = browser_result1.get("elements_found", {}).get(element, 0)
                count2 = browser_result2.get("elements_found", {}).get(element, 0)
                browser_comparison["element_count_diff"][element] = count2 - count1
            
            comparison["browsers"][browser] = browser_comparison
        
        return comparison
    
    def _load_test_results(self, test_name: str) -> Optional[Dict[str, Any]]:
        """
        Load test results from a previous test run
        
        Args:
            test_name: Name of the test run
            
        Returns:
            Dictionary with test results or None if not found
        """
        results_file = self.results_dir / test_name / "results.json"
        
        if not results_file.exists():
            logger.error(f"Results file not found: {results_file}")
            return None
        
        try:
            with open(results_file, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading results file: {e}")
            return None
    
    def get_test_summary(self, test_name: str) -> Dict[str, Any]:
        """
        Get a summary of test results
        
        Args:
            test_name: Name of the test run
            
        Returns:
            Dictionary with test summary
        """
        results = self._load_test_results(test_name)
        
        if not results:
            return {"error": "Could not load test results"}
        
        summary = {
            "test_name": test_name,
            "url": results.get("url"),
            "timestamp": results.get("timestamp"),
            "browsers_tested": len(results.get("browsers", {})),
            "browsers_success": sum(1 for browser in results.get("browsers", {}).values() if browser.get("success")),
            "browsers_failed": sum(1 for browser in results.get("browsers", {}).values() if not browser.get("success")),
            "average_load_time": None,
            "browser_details": {}
        }
        
        # Calculate average load time
        load_times = [browser.get("load_time") for browser in results.get("browsers", {}).values() 
                     if browser.get("load_time") is not None]
        if load_times:
            summary["average_load_time"] = round(sum(load_times) / len(load_times), 2)
        
        # Add browser details
        for browser_name, browser_result in results.get("browsers", {}).items():
            summary["browser_details"][browser_name] = {
                "success": browser_result.get("success"),
                "load_time": browser_result.get("load_time"),
                "error": browser_result.get("error")
            }
        
        return summary
    
    def print_test_summary(self, test_name: str):
        """
        Print a summary of test results
        
        Args:
            test_name: Name of the test run
        """
        summary = self.get_test_summary(test_name)
        
        if "error" in summary:
            print(f"Error: {summary['error']}")
            return
        
        print("\n=== Browser Compatibility Test Summary ===\n")
        print(f"Test Name: {summary['test_name']}")
        print(f"URL: {summary['url']}")
        print(f"Timestamp: {summary['timestamp']}")
        print(f"Browsers Tested: {summary['browsers_tested']}")
        print(f"Successful: {summary['browsers_success']}")
        print(f"Failed: {summary['browsers_failed']}")
        
        if summary['average_load_time'] is not None:
            print(f"Average Load Time: {summary['average_load_time']} seconds")
        
        print("\nBrowser Details:")
        for browser_name, details in summary['browser_details'].items():
            status = "✓ Success" if details['success'] else f"✗ Failed: {details['error']}"
            load_time = f"{details['load_time']} seconds" if details['load_time'] is not None else "N/A"
            print(f"  {browser_name.capitalize()}: {status} (Load Time: {load_time})")
        
        print()
