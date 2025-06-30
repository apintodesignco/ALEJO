#!/usr/bin/env python3
"""
Automated Selenium Integration Fixer for ALEJO Browser Compatibility Testing.
This script runs a series of tests to verify and fix issues with Selenium WebDriver integration.
"""
import os
import sys
import time
import json
import logging
import traceback
import importlib.util
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("selenium_fix.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SeleniumIntegrationFixer:
    """Class to verify and fix Selenium WebDriver integration"""
    
    def __init__(self):
        """Initialize the fixer"""
        self.script_path = Path("test_browser_compatibility.py").absolute()
        self.issues = []
        self.fixes = []
        
        # Check if the script exists
        if not self.script_path.exists():
            logger.error(f"Script not found at {self.script_path}")
            sys.exit(1)
        
        # Load the module
        self.module = self._load_module()
        
        # Create a tester instance
        self.tester = self.module.BrowserCompatibilityTester()
    
    def _load_module(self):
        """Load the browser compatibility testing module"""
        try:
            # Add the script directory to the Python path
            sys.path.insert(0, str(self.script_path.parent))
            
            # Load the module
            spec = importlib.util.spec_from_file_location("test_browser_compatibility", self.script_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            logger.info("Module loaded successfully")
            return module
        except Exception as e:
            logger.error(f"Failed to load module: {e}")
            traceback.print_exc()
            sys.exit(1)
    
    def check_dependencies(self):
        """Check if required dependencies are installed"""
        logger.info("Checking dependencies")
        
        missing_dependencies = []
        
        # Check Selenium
        try:
            import selenium
            logger.info(f"Selenium is installed (version {selenium.__version__})")
        except ImportError:
            logger.error("Selenium is not installed")
            missing_dependencies.append("selenium")
        
        # Check webdriver-manager
        try:
            import webdriver_manager
            logger.info(f"webdriver-manager is installed (version {webdriver_manager.__version__})")
        except ImportError:
            logger.error("webdriver-manager is not installed")
            missing_dependencies.append("webdriver-manager")
        
        if missing_dependencies:
            logger.warning(f"Missing dependencies: {', '.join(missing_dependencies)}")
            
            # Install missing dependencies
            logger.info("Installing missing dependencies")
            
            for dependency in missing_dependencies:
                logger.info(f"Installing {dependency}")
                
                try:
                    import subprocess
                    subprocess.check_call([sys.executable, "-m", "pip", "install", dependency])
                    logger.info(f"{dependency} installed successfully")
                    self.fixes.append(f"Installed missing dependency: {dependency}")
                except Exception as e:
                    logger.error(f"Failed to install {dependency}: {e}")
                    self.issues.append(f"Failed to install dependency: {dependency}")
        
        return not missing_dependencies
    
    def check_selenium_flag(self):
        """Check if the SELENIUM_AVAILABLE flag is set correctly"""
        logger.info("Checking SELENIUM_AVAILABLE flag")
        
        try:
            import selenium
            
            if hasattr(self.module, "SELENIUM_AVAILABLE"):
                if self.module.SELENIUM_AVAILABLE:
                    logger.info("SELENIUM_AVAILABLE flag is set correctly")
                    return True
                else:
                    logger.warning("SELENIUM_AVAILABLE flag is False but Selenium is installed")
                    self.issues.append("SELENIUM_AVAILABLE flag is False but Selenium is installed")
                    return False
            else:
                logger.warning("SELENIUM_AVAILABLE flag not found in module")
                self.issues.append("SELENIUM_AVAILABLE flag not found in module")
                return False
        except ImportError:
            logger.error("Selenium is not installed")
            self.issues.append("Selenium is not installed")
            return False
    
    def check_webdriver_initialization(self):
        """Check if WebDriver initialization works correctly"""
        logger.info("Checking WebDriver initialization")
        
        # Detect installed browsers
        browsers = self.tester.detect_installed_browsers()
        
        if not browsers:
            logger.warning("No browsers detected")
            self.issues.append("No browsers detected for WebDriver initialization test")
            return False
        
        success = True
        
        # Test WebDriver initialization for each browser
        for browser_id, browser_info in browsers.items():
            logger.info(f"Testing WebDriver initialization for {browser_info['name']}")
            
            try:
                driver = self.tester._initialize_webdriver(browser_id, browser_info)
                
                if driver:
                    logger.info(f"WebDriver initialized successfully for {browser_info['name']}")
                    
                    # Test basic functionality
                    driver.get("https://www.example.com")
                    logger.info(f"Navigated to example.com with {browser_info['name']}")
                    
                    # Check page title
                    if "Example Domain" in driver.title:
                        logger.info(f"Page title is correct: {driver.title}")
                    else:
                        logger.warning(f"Page title is incorrect: {driver.title}")
                        self.issues.append(f"Incorrect page title with {browser_info['name']}: {driver.title}")
                        success = False
                    
                    # Quit the driver
                    driver.quit()
                    logger.info(f"WebDriver for {browser_info['name']} quit successfully")
                else:
                    logger.warning(f"WebDriver initialization failed for {browser_info['name']}")
                    self.issues.append(f"WebDriver initialization failed for {browser_info['name']}")
                    success = False
            except Exception as e:
                logger.error(f"Error initializing WebDriver for {browser_info['name']}: {e}")
                self.issues.append(f"Error initializing WebDriver for {browser_info['name']}: {e}")
                success = False
        
        return success
    
    def check_selenium_test_method(self):
        """Check if the _run_selenium_test method works correctly"""
        logger.info("Checking _run_selenium_test method")
        
        # Detect installed browsers
        browsers = self.tester.detect_installed_browsers()
        
        if not browsers:
            logger.warning("No browsers detected")
            self.issues.append("No browsers detected for _run_selenium_test test")
            return False
        
        success = True
        
        # Test _run_selenium_test method for each browser
        for browser_id, browser_info in browsers.items():
            logger.info(f"Testing _run_selenium_test method for {browser_info['name']}")
            
            try:
                # Create a simple test case
                test_case = {
                    'name': 'Simple Test',
                    'url': 'https://www.example.com',
                    'elements': [
                        {'selector': 'h1', 'name': 'Heading'}
                    ],
                    'css_properties': [
                        {'property': 'font-family', 'element': 'h1'}
                    ]
                }
                
                # Initialize WebDriver
                driver = self.tester._initialize_webdriver(browser_id, browser_info)
                
                if not driver:
                    logger.error(f"Failed to initialize WebDriver for {browser_info['name']}")
                    self.issues.append(f"Failed to initialize WebDriver for {browser_info['name']}")
                    success = False
                    continue
                
                try:
                    # Run the test
                    test_result = self.tester._run_selenium_test(driver, test_case)
                    
                    # Check the test result
                    if test_result:
                        logger.info(f"Test completed successfully with {browser_info['name']}")
                        
                        # Check if elements were found
                        if 'elements_found' in test_result and test_result['elements_found'].get('Heading'):
                            logger.info("Element 'Heading' was found")
                        else:
                            logger.warning("Element 'Heading' was not found")
                            self.issues.append(f"Element 'Heading' was not found with {browser_info['name']}")
                            success = False
                        
                        # Check if CSS properties were checked
                        if 'css_properties_supported' in test_result and 'font-family' in test_result['css_properties_supported']:
                            logger.info("CSS property 'font-family' was checked")
                        else:
                            logger.warning("CSS property 'font-family' was not checked")
                            self.issues.append(f"CSS property 'font-family' was not checked with {browser_info['name']}")
                            success = False
                    else:
                        logger.error(f"Test failed with {browser_info['name']}")
                        self.issues.append(f"Test failed with {browser_info['name']}")
                        success = False
                except Exception as e:
                    logger.error(f"Error running test with {browser_info['name']}: {e}")
                    self.issues.append(f"Error running test with {browser_info['name']}: {e}")
                    success = False
                finally:
                    # Quit the driver
                    driver.quit()
                    logger.info(f"WebDriver for {browser_info['name']} quit successfully")
            except Exception as e:
                logger.error(f"Error testing _run_selenium_test method for {browser_info['name']}: {e}")
                self.issues.append(f"Error testing _run_selenium_test method for {browser_info['name']}: {e}")
                success = False
        
        return success
    
    def check_cleanup_webdrivers(self):
        """Check if the _cleanup_webdrivers method works correctly"""
        logger.info("Checking _cleanup_webdrivers method")
        
        try:
            # Create a list of WebDriver instances
            browsers = self.tester.detect_installed_browsers()
            
            if not browsers:
                logger.warning("No browsers detected")
                self.issues.append("No browsers detected for _cleanup_webdrivers test")
                return False
            
            # Initialize WebDriver for each browser
            drivers = []
            for browser_id, browser_info in browsers.items():
                try:
                    driver = self.tester._initialize_webdriver(browser_id, browser_info)
                    if driver:
                        drivers.append(driver)
                        logger.info(f"WebDriver initialized for {browser_info['name']}")
                except Exception as e:
                    logger.error(f"Failed to initialize WebDriver for {browser_info['name']}: {e}")
            
            if not drivers:
                logger.warning("No WebDriver instances created")
                self.issues.append("No WebDriver instances created for _cleanup_webdrivers test")
                return False
            
            # Store the WebDriver instances in the tester
            self.tester.webdrivers = {}
            for i, driver in enumerate(drivers):
                self.tester.webdrivers[f"browser_{i}"] = driver
            
            # Call the _cleanup_webdrivers method
            logger.info("Calling _cleanup_webdrivers method")
            self.tester._cleanup_webdrivers()
            
            # Check if the WebDriver instances were cleaned up
            if not self.tester.webdrivers:
                logger.info("WebDriver instances cleaned up successfully")
                return True
            else:
                logger.warning("WebDriver instances not cleaned up")
                self.issues.append("WebDriver instances not cleaned up by _cleanup_webdrivers method")
                return False
        except Exception as e:
            logger.error(f"Error checking _cleanup_webdrivers method: {e}")
            self.issues.append(f"Error checking _cleanup_webdrivers method: {e}")
            return False
    
    def check_run_browser_tests(self):
        """Check if the run_browser_tests method works correctly"""
        logger.info("Checking run_browser_tests method")
        
        try:
            # Detect installed browsers
            browsers = self.tester.detect_installed_browsers()
            
            if not browsers:
                logger.warning("No browsers detected")
                self.issues.append("No browsers detected for run_browser_tests test")
                return False
            
            # Create a simple test case
            test_cases = [
                {
                    'name': 'Simple Test',
                    'url': 'https://www.example.com',
                    'elements': [
                        {'selector': 'h1', 'name': 'Heading'}
                    ],
                    'css_properties': [
                        {'property': 'font-family', 'element': 'h1'}
                    ]
                }
            ]
            
            # Run the tests
            logger.info("Running browser tests")
            results = self.tester.run_browser_tests(test_cases, list(browsers.keys()))
            
            if results:
                logger.info("Browser tests completed successfully")
                
                # Check if all browsers were tested
                if len(results) == len(browsers):
                    logger.info("All browsers were tested")
                else:
                    logger.warning(f"Not all browsers were tested: {len(results)} out of {len(browsers)}")
                    self.issues.append(f"Not all browsers were tested: {len(results)} out of {len(browsers)}")
                
                return True
            else:
                logger.error("Browser tests failed")
                self.issues.append("Browser tests failed")
                return False
        except Exception as e:
            logger.error(f"Error checking run_browser_tests method: {e}")
            self.issues.append(f"Error checking run_browser_tests method: {e}")
            return False
    
    def run_all_checks(self):
        """Run all checks"""
        logger.info("Running all checks")
        
        checks = [
            ("Dependencies", self.check_dependencies),
            ("SELENIUM_AVAILABLE flag", self.check_selenium_flag),
            ("WebDriver initialization", self.check_webdriver_initialization),
            ("_run_selenium_test method", self.check_selenium_test_method),
            ("_cleanup_webdrivers method", self.check_cleanup_webdrivers),
            ("run_browser_tests method", self.check_run_browser_tests)
        ]
        
        results = {}
        
        for name, check_func in checks:
            logger.info(f"Running check: {name}")
            start_time = time.time()
            success = check_func()
            end_time = time.time()
            
            results[name] = {
                "success": success,
                "duration": end_time - start_time
            }
            
            if success:
                logger.info(f"Check passed: {name}")
            else:
                logger.warning(f"Check failed: {name}")
        
        # Generate a report
        self.generate_report(results)
        
        # Check if all checks passed
        all_passed = all(result["success"] for result in results.values())
        
        if all_passed:
            logger.info("All checks passed!")
        else:
            logger.warning("Some checks failed. See the report for details.")
        
        return all_passed
    
    def generate_report(self, results):
        """Generate a report of the check results"""
        logger.info("Generating check report")
        
        # Create a results directory
        results_dir = Path("selenium_fix_results")
        results_dir.mkdir(exist_ok=True)
        
        # Save the results to a JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = results_dir / f"results_{timestamp}.json"
        
        report_data = {
            "timestamp": timestamp,
            "checks": results,
            "issues": self.issues,
            "fixes": self.fixes
        }
        
        with open(results_file, "w") as f:
            json.dump(report_data, f, indent=2)
        
        logger.info(f"Results saved to {results_file}")
        
        # Calculate statistics
        total_checks = len(results)
        passed_checks = sum(1 for result in results.values() if result["success"])
        failed_checks = total_checks - passed_checks
        
        logger.info(f"Total checks: {total_checks}")
        logger.info(f"Passed checks: {passed_checks}")
        logger.info(f"Failed checks: {failed_checks}")
        
        # Generate an HTML report
        html_file = results_dir / f"report_{timestamp}.html"
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALEJO Selenium Integration Check Report</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }}
        h1, h2, h3 {{
            color: #0066cc;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .summary {{
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .success {{
            color: #28a745;
        }}
        .failure {{
            color: #dc3545;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }}
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #f2f2f2;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .check-details {{
            margin-bottom: 30px;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
        }}
        .issues-list {{
            background-color: #fff0f0;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
        }}
        .fixes-list {{
            background-color: #f0fff0;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>ALEJO Selenium Integration Check Report</h1>
        <p>Generated on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
        
        <div class="summary">
            <h2>Summary</h2>
            <p>Total Checks: {total_checks}</p>
            <p class="success">Passed Checks: {passed_checks}</p>
            <p class="failure">Failed Checks: {failed_checks}</p>
            <p>Pass Rate: {passed_checks / total_checks * 100:.1f}%</p>
        </div>
        
        <h2>Check Results</h2>
        <table>
            <tr>
                <th>Check Name</th>
                <th>Status</th>
                <th>Duration (s)</th>
            </tr>
"""
        
        # Add rows for each check
        for name, result in results.items():
            status = "Success" if result["success"] else "Failure"
            status_class = "success" if result["success"] else "failure"
            duration = f"{result['duration']:.2f}"
            
            html += f"""
            <tr>
                <td>{name}</td>
                <td class="{status_class}">{status}</td>
                <td>{duration}</td>
            </tr>"""
        
        html += """
        </table>
        
        <h2>Check Details</h2>
"""
        
        # Add detailed section for each check
        for name, result in results.items():
            status = "Success" if result["success"] else "Failure"
            status_class = "success" if result["success"] else "failure"
            duration = f"{result['duration']:.2f}"
            
            html += f"""
        <div class="check-details">
            <h3>{name}</h3>
            <p class="{status_class}">Status: {status}</p>
            <p>Duration: {duration} seconds</p>
        </div>
"""
        
        # Add issues section
        if self.issues:
            html += """
        <h2 class="failure">Issues Found</h2>
        <div class="issues-list">
            <ul>
"""
            
            for issue in self.issues:
                html += f"""
                <li>{issue}</li>
"""
            
            html += """
            </ul>
        </div>
"""
        
        # Add fixes section
        if self.fixes:
            html += """
        <h2 class="success">Fixes Applied</h2>
        <div class="fixes-list">
            <ul>
"""
            
            for fix in self.fixes:
                html += f"""
                <li>{fix}</li>
"""
            
            html += """
            </ul>
        </div>
"""
        
        html += """
    </div>
</body>
</html>
"""
        
        # Write the HTML report to a file
        with open(html_file, "w") as f:
            f.write(html)
        
        logger.info(f"HTML report saved to {html_file}")
        
        return html_file

def main():
    """Main function"""
    logger.info("Starting Selenium integration checks")
    
    # Create a fixer
    fixer = SeleniumIntegrationFixer()
    
    # Run all checks
    success = fixer.run_all_checks()
    
    if success:
        logger.info("All Selenium integration checks passed!")
        return 0
    else:
        logger.warning("Some Selenium integration checks failed. See the report for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
