#!/usr/bin/env python3
"""
Verify Selenium Integration for ALEJO Browser Compatibility Testing.
This script performs a comprehensive verification of the Selenium WebDriver integration.
"""
import os
import sys
import time
import json
import logging
import traceback
from pathlib import Path
from datetime import datetime

# Import Selenium components
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except ImportError:
    pass  # Will be handled in check_dependencies()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("verify_selenium_integration.log")
    ]
)
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if required dependencies are installed"""
    dependencies = {
        'selenium': False,
        'webdriver_manager': False
    }
    
    # Check Selenium
    try:
        import selenium
        dependencies['selenium'] = True
        logger.info(f"Selenium is installed (version {selenium.__version__})")
    except ImportError as e:
        logger.error(f"Selenium is not installed: {e}")
    
    # Check webdriver-manager
    try:
        import webdriver_manager
        dependencies['webdriver_manager'] = True
        logger.info(f"webdriver-manager is installed (version {webdriver_manager.__version__})")
    except ImportError as e:
        logger.error(f"webdriver-manager is not installed: {e}")
    
    return dependencies

def import_module(script_path):
    """Import the browser compatibility testing module"""
    try:
        # Add the script directory to the Python path
        sys.path.insert(0, str(Path(script_path).parent))
        
        # Load the module
        import importlib.util
        spec = importlib.util.spec_from_file_location("test_browser_compatibility", script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        logger.info("Module loaded successfully")
        return module
    except Exception as e:
        logger.error(f"Failed to load module: {e}")
        traceback.print_exc()
        return None

def verify_selenium_flag(module):
    """Verify the SELENIUM_AVAILABLE flag"""
    try:
        selenium_available = getattr(module, 'SELENIUM_AVAILABLE', None)
        logger.info(f"SELENIUM_AVAILABLE flag: {selenium_available}")
        return selenium_available is True
    except Exception as e:
        logger.error(f"Error verifying SELENIUM_AVAILABLE flag: {e}")
        return False

def verify_browser_detection(tester):
    """Verify browser detection"""
    try:
        logger.info("Verifying browser detection")
        browsers = tester.detect_installed_browsers()
        
        if not browsers:
            logger.error("No browsers detected")
            return False
        
        logger.info(f"Detected {len(browsers)} browsers:")
        for browser_id, browser_info in browsers.items():
            logger.info(f"  - {browser_info['name']}: {browser_info.get('detected_path', 'Unknown path')}")
        
        return True
    except Exception as e:
        logger.error(f"Error verifying browser detection: {e}")
        return False

def verify_webdriver_initialization(tester, browsers):
    """Verify WebDriver initialization for each browser"""
    success = True
    
    for browser_id, browser_info in browsers.items():
        try:
            logger.info(f"Verifying WebDriver initialization for {browser_info['name']}")
            
            driver = tester._initialize_webdriver(browser_id, browser_info)
            
            if not driver:
                logger.error(f"Failed to initialize WebDriver for {browser_info['name']}")
                success = False
                continue
            
            logger.info(f"WebDriver initialized for {browser_info['name']}")
            
            # Test basic functionality
            try:
                driver.get("https://www.example.com")
                logger.info(f"Navigated to example.com with {browser_info['name']}")
                
                # Check page title
                if "Example Domain" in driver.title:
                    logger.info(f"Page title is correct: {driver.title}")
                else:
                    logger.warning(f"Page title is incorrect: {driver.title}")
                
                # Find an element
                try:
                    heading = driver.find_element(By.TAG_NAME, "h1")
                    logger.info(f"Found heading: {heading.text}")
                except Exception as e:
                    logger.error(f"Failed to find heading: {e}")
                    success = False
                
                # Check CSS property
                try:
                    font_family = heading.value_of_css_property("font-family")
                    logger.info(f"Font family: {font_family}")
                except Exception as e:
                    logger.error(f"Failed to get CSS property: {e}")
                    success = False
            except Exception as e:
                logger.error(f"Error during test with {browser_info['name']}: {e}")
                success = False
            finally:
                # Quit the driver
                driver.quit()
                logger.info(f"WebDriver for {browser_info['name']} quit successfully")
        except Exception as e:
            logger.error(f"Error verifying WebDriver initialization for {browser_info['name']}: {e}")
            success = False
    
    return success

def verify_run_selenium_test(tester, browsers):
    """Verify the _run_selenium_test method"""
    success = True
    
    for browser_id, browser_info in browsers.items():
        try:
            logger.info(f"Verifying _run_selenium_test for {browser_info['name']}")
            
            # Create a test case
            test_case = {
                'name': 'Verification Test',
                'url': 'https://www.example.com',
                'elements_to_check': [
                    'h1',
                    'p'
                ],
                'css_properties_to_check': [
                    {'property': 'font-family', 'selector': 'h1'},
                    {'property': 'color', 'selector': 'p'}
                ]
            }
            
            # Initialize WebDriver
            driver = tester._initialize_webdriver(browser_id, browser_info)
            
            if not driver:
                logger.error(f"Failed to initialize WebDriver for {browser_info['name']}")
                success = False
                continue
            
            try:
                # Run the test with base_url parameter
                base_url = "https://www.example.com"
                result = tester._run_selenium_test(driver, test_case, base_url)
                
                if result:
                    logger.info(f"Test case with {browser_info['name']} completed successfully")
                    logger.info(f"Result: {json.dumps(result, indent=2)}")
                else:
                    logger.error(f"Test case with {browser_info['name']} failed")
                    success = False
            except Exception as e:
                logger.error(f"Error during test case with {browser_info['name']}: {e}")
                success = False
            finally:
                # Quit the driver
                driver.quit()
                logger.info(f"WebDriver for {browser_info['name']} quit successfully")
        except Exception as e:
            logger.error(f"Error verifying _run_selenium_test for {browser_info['name']}: {e}")
            success = False
    
    return success

def verify_cleanup(tester):
    """Verify the _cleanup_webdrivers method"""
    try:
        logger.info("Verifying _cleanup_webdrivers")
        
        # Ensure the webdrivers attribute exists and is empty
        if not hasattr(tester, 'webdrivers'):
            tester.webdrivers = {}
        else:
            tester.webdrivers.clear()
        
        # Detect browsers
        browsers = tester.detect_installed_browsers()
        
        # Initialize WebDrivers for each browser
        for browser_id, browser_info in list(browsers.items())[:2]:  # Only test with first two browsers
            driver = tester._initialize_webdriver(browser_id, browser_info)
            if driver:
                logger.info(f"WebDriver initialized for {browser_info['name']}")
                # Store the driver in the tester's webdrivers dictionary
                tester.webdrivers[browser_id] = driver
        
        # Verify webdrivers were initialized
        if not tester.webdrivers:
            logger.error("No WebDrivers were initialized")
            return False
        
        # Get the count before cleanup
        webdriver_count = len(tester.webdrivers)
        logger.info(f"Cleaning up {webdriver_count} WebDriver instances...")
        
        # Clean up WebDrivers
        tester._cleanup_webdrivers()
        
        # Check if all WebDrivers were cleaned up
        if tester.webdrivers:
            logger.error(f"WebDrivers were not cleaned up. {len(tester.webdrivers)} drivers remain.")
            return False
        else:
            logger.info("All WebDrivers were successfully cleaned up")
            return True
    except Exception as e:
        logger.error(f"Error verifying _cleanup_webdrivers: {e}")
        traceback.print_exc()
        return False

def verify_run_browser_tests(tester):
    """Verify the run_browser_tests method"""
    try:
        logger.info("Verifying run_browser_tests")
        
        # Create a test case that matches the expected format
        test_cases = [{
            'name': 'Verification Test',
            'url': 'https://www.example.com',
            'elements_to_check': [
                'h1',
                'p'
            ],
            'css_properties_to_check': [
                {'property': 'font-family', 'selector': 'h1'},
                {'property': 'color', 'selector': 'p'}
            ]
        }]
        
        # Run the tests
        browsers = tester.detect_installed_browsers()
        browser_ids = list(browsers.keys())[:1]  # Only test with first browser
        
        # Set up the base_url parameter
        base_url = "https://www.example.com"
        port = 5000  # Use a numeric port
        
        # Ensure webdrivers attribute exists and is empty
        if not hasattr(tester, 'webdrivers'):
            tester.webdrivers = {}
        else:
            tester.webdrivers.clear()
        
        # Call run_browser_tests directly with base_url to avoid starting a server
        logger.info(f"Running browser tests with base_url={base_url}")
        results = tester.run_browser_tests(test_cases=test_cases, browsers_to_test=browser_ids, port=port, base_url=base_url)
        
        if not results:
            logger.error("No results returned from run_browser_tests")
            return False
        
        # Check if results have the expected structure
        if 'browsers_tested' not in results or 'test_results' not in results or 'summary' not in results:
            logger.error("Results missing expected structure")
            logger.info(f"Results: {json.dumps(results, indent=2)}")
            return False
        
        # Check if test results were recorded for the browser
        if browser_ids[0] not in results['test_results']:
            logger.error(f"No test results for {browser_ids[0]}")
            return False
        
        # Check if the test case was executed
        if 'Verification Test' not in results['test_results'][browser_ids[0]]:
            logger.error("Test case 'Verification Test' was not executed")
            return False
        
        logger.info(f"Results: {json.dumps(results, indent=2)}")
        return True
    except Exception as e:
        logger.error(f"Error verifying run_browser_tests: {e}")
        traceback.print_exc()
        return False

def generate_report(results):
    """Generate a verification report"""
    report_path = Path("selenium_verification_report.html")
    
    # Calculate overall status
    overall_status = "PASSED" if all(results.values()) else "FAILED"
    
    # Generate HTML report
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Selenium Integration Verification Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        .summary {{ margin: 20px 0; padding: 10px; border-radius: 5px; }}
        .passed {{ background-color: #dff0d8; color: #3c763d; }}
        .failed {{ background-color: #f2dede; color: #a94442; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .status-passed {{ color: green; font-weight: bold; }}
        .status-failed {{ color: red; font-weight: bold; }}
    </style>
</head>
<body>
    <h1>Selenium Integration Verification Report</h1>
    <div class="summary {overall_status.lower()}">
        <h2>Overall Status: {overall_status}</h2>
        <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    
    <h2>Verification Results</h2>
    <table>
        <tr>
            <th>Check</th>
            <th>Status</th>
        </tr>
"""
    
    for check, status in results.items():
        status_text = "PASSED" if status else "FAILED"
        status_class = "status-passed" if status else "status-failed"
        html += f"""
        <tr>
            <td>{check}</td>
            <td class="{status_class}">{status_text}</td>
        </tr>
"""
    
    html += """
    </table>
</body>
</html>
"""
    
    with open(report_path, "w") as f:
        f.write(html)
    
    logger.info(f"Verification report generated: {report_path.absolute()}")
    return report_path

def main():
    """Main function"""
    logger.info("Starting Selenium integration verification")
    
    # Check dependencies
    dependencies = check_dependencies()
    if not all(dependencies.values()):
        logger.error("Missing dependencies. Please install Selenium and webdriver-manager.")
        return 1
    
    # Import the module
    script_path = Path("test_browser_compatibility.py").absolute()
    if not script_path.exists():
        logger.error(f"Script not found at {script_path}")
        return 1
    
    module = import_module(script_path)
    if not module:
        return 1
    
    # Create a tester instance
    tester = module.BrowserCompatibilityTester()
    
    # Run verification checks
    verification_results = {}
    
    # Verify SELENIUM_AVAILABLE flag
    verification_results["SELENIUM_AVAILABLE Flag"] = verify_selenium_flag(module)
    
    # Verify browser detection
    browser_detection_result = verify_browser_detection(tester)
    verification_results["Browser Detection"] = browser_detection_result
    
    if browser_detection_result:
        browsers = tester.detect_installed_browsers()
        
        # Verify WebDriver initialization
        verification_results["WebDriver Initialization"] = verify_webdriver_initialization(tester, browsers)
        
        # Verify _run_selenium_test method
        verification_results["_run_selenium_test Method"] = verify_run_selenium_test(tester, browsers)
        
        # Verify cleanup
        verification_results["_cleanup_webdrivers Method"] = verify_cleanup(tester)
        
        # Verify run_browser_tests method
        verification_results["run_browser_tests Method"] = verify_run_browser_tests(tester)
    
    # Generate report
    report_path = generate_report(verification_results)
    
    # Print summary
    logger.info("Verification Summary:")
    for check, status in verification_results.items():
        status_text = "PASSED" if status else "FAILED"
        logger.info(f"  - {check}: {status_text}")
    
    overall_status = all(verification_results.values())
    if overall_status:
        logger.info("All verification checks passed!")
        return 0
    else:
        logger.error("Some verification checks failed. See the report for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())