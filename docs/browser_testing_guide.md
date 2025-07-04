# ALEJO Browser Testing Guide

This guide explains how to use ALEJO's consolidated browser testing modules for comprehensive web application testing.

## Overview

ALEJO's browser testing framework provides a unified approach to browser detection, compatibility testing, and secure test execution. The framework consists of the following key components:

1. **Browser Detection** - Detects installed browsers and WebDrivers across platforms
2. **Browser Compatibility Testing** - Tests web applications across multiple browsers
3. **Browser Test Runner** - Runs comprehensive test scenarios and comparisons
4. **Secure Browser Testing** - Integrates security features with browser testing

## Installation

Ensure you have the required dependencies installed:

```bash
pip install -r requirements-full.txt
```

The browser testing modules require Selenium WebDriver executables for each browser you want to test with. Make sure the WebDriver executables are in your system PATH or specify their locations in your configuration.

## Browser Detection

The `BrowserDetector` class provides cross-platform browser detection capabilities:

```python
from alejo.testing.browser_detection import BrowserDetector

# Create detector
detector = BrowserDetector()

# Detect installed browsers
browsers = detector.detect_browsers()
print(f"Detected browsers: {list(browsers.keys())}")

# Get detailed browser information
browser_info = detector.get_browser_info()
for browser, info in browser_info.items():
    print(f"{browser}: {info['version']} at {info['path']}")
    print(f"WebDriver: {info['webdriver_path']}")

# Print formatted browser information
detector.print_browser_info()
```

## Browser Compatibility Testing

The `BrowserCompatibilityTester` class provides functionality to test web applications across multiple browsers:

```python
from alejo.testing.browser_testing import BrowserCompatibilityTester

# Create configuration
config = {
    "headless": True,      # Run browsers in headless mode
    "timeout": 30,         # Page load timeout in seconds
    "screenshot_dir": "screenshots",  # Directory for screenshots
    "results_dir": "test_results"     # Directory for test results
}

# Create tester
tester = BrowserCompatibilityTester(config)

# Run tests on a URL with specific browsers
url = "https://example.com"
browsers = ["chrome", "firefox"]  # Leave empty to use all detected browsers
test_name = "example_test"

results = tester.run_tests(url, browsers, test_name)

# Print test summary
tester.print_test_summary(test_name)

# Compare two test runs
comparison = tester.compare_test_results("test1", "test2")
tester.print_comparison_summary(comparison)
```

## Browser Test Runner

The `BrowserTestRunner` class provides advanced testing capabilities for running comprehensive tests:

```python
from alejo.testing.browser_testing import BrowserTestRunner

# Create configuration

config = {
    "headless": True,
    "timeout": 30,
    "screenshot_dir": "screenshots",
    "results_dir": "test_results"
}

# Create test runner

runner = BrowserTestRunner(config)

# Run comprehensive tests on multiple URLs

urls = ["<https://example.com",> "<https://www.python.org"]>
browsers = ["chrome", "firefox"]  # Optional
results = runner.run_comprehensive_tests(urls, browsers)

# Print test summary

runner.print_test_summary(results)

# Run scenario tests

scenarios = [
    {
        "name": "desktop_scenario",
        "url": "<https://example.com",>
        "browsers": ["chrome", "firefox"],
        "config": {
            "window_size": (1920, 1080),
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    },
    {
        "name": "mobile_scenario",
        "url": "<https://example.com",>
        "browsers": ["chrome"],
        "config": {
            "window_size": (375, 812),
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)"
        }
    }
]
results = runner.run_scenario_tests(scenarios)

# Run regression tests comparing baseline and test URLs

baseline_url = "https://example.com"
test_url = "https://staging.example.com"
results = runner.run_regression_tests(baseline_url, test_url, browsers)
```text

## Secure Browser Testing

The `SecureBrowserTesting` class integrates security features with browser testing:

```python
from alejo.testing.secure_browser_testing import SecureBrowserTesting
from alejo.security.security_manager import SecurityManager

# Create security manager

security_config = {
    "security_level": "medium",
    "encryption_key": "your_encryption_key"  # Use environment variable in production
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

url = "<https://example.com">
browsers = ["chrome", "firefox"]  # Optional
results = secure_tester.run_secure_test(
    url,
    browsers=browsers,
    session_id="user_session_id",
    username="username",
    test_name="secure_test"
)

# Run secure comprehensive tests

urls = ["<https://example.com",> "<https://www.python.org"]>
results = secure_tester.run_secure_comprehensive_tests(
    urls,
    browsers=browsers,
    session_id="user_session_id",
    username="username"
)

# List secure test results

results_info = secure_tester.list_secure_results(
    session_id="user_session_id",
    username="username"
)

# Retrieve secure test results

results = secure_tester.retrieve_secure_results(
    "secure_test_20230101_123456.enc",
    session_id="user_session_id",
    username="username"
)
```text

## Command-Line Interface

ALEJO provides a command-line interface for browser testing:

```bash

# Detect installed browsers

python -m alejo-browser-test detect

# Test a URL with specific browsers

python -m alejo-browser-test test <https://example.com> --browsers chrome firefox --headless

# Run comprehensive tests on multiple URLs

python -m alejo-browser-test comprehensive <https://example.com> <https://www.python.org> --browsers chrome firefox

# List test results

python -m alejo-browser-test list

# Show test results

python -m alejo-browser-test show test_20230101_123456
```text

## Test Results

Test results are saved in JSON format in the specified results directory. Each test run creates a subdirectory with the test name and timestamp. The results include:

- URL tested
- Test name and timestamp
- Browser-specific results:
  - Success/failure status
  - Page title
  - Load time
  - Screenshot path
  - Elements found (links, images, forms, etc.)
  - Any errors encountered

## Best Practices

1. **WebDriver Management**: Ensure WebDriver executables are compatible with your browser versions
2. **Headless Mode**: Use headless mode for CI/CD pipelines and automated testing
3. **Timeouts**: Set appropriate timeouts based on expected page load times
4. **Screenshots**: Enable screenshots to help diagnose test failures
5. **Secure Testing**: Use the secure testing module for sensitive applications
6. **Regression Testing**: Regularly compare test results to detect regressions
7. **Scenario Testing**: Define different scenarios to test various user experiences

## Troubleshooting

Common issues and solutions:

1. **WebDriver not found**: Ensure WebDriver executables are in your PATH or specify their locations
2. **Browser crashes**: Check browser and WebDriver compatibility
3. **Timeouts**: Increase the timeout value for slow-loading pages
4. **Element not found**: Use the screenshot to verify page structure
5. **Security errors**: Verify security manager configuration and permissions

## Example Usage

See the `examples/browser_testing_example.py` script for a complete example of using the browser testing modules.

## API Reference

### BrowserDetector

- `detect_browsers()`: Detects installed browsers
- `get_browser_version(browser)`: Gets version of a specific browser
- `get_webdriver_path(browser)`: Gets WebDriver path for a browser
- `get_browser_info()`: Gets comprehensive browser information
- `print_browser_info()`: Prints formatted browser information

### BrowserCompatibilityTester

- `get_available_browsers()`: Gets available browsers for testing
- `run_tests(url, browsers, test_name)`: Runs tests on a URL
- `get_test_summary(test_name)`: Gets summary of a test run
- `compare_test_results(test1, test2)`: Compares two test runs
- `print_test_summary(test_name)`: Prints test summary
- `print_comparison_summary(comparison)`: Prints comparison summary

### BrowserTestRunner

- `run_comprehensive_tests(urls, browsers)`: Runs tests on multiple URLs
- `run_scenario_tests(scenarios)`: Runs tests with different scenarios
- `run_regression_tests(baseline_url, test_url, browsers)`: Runs regression tests
- `print_test_summary(results)`: Prints test summary

### SecureBrowserTesting

- `run_secure_test(url, browsers, session_id, username, test_name)`: Runs secure test
- `run_secure_comprehensive_tests(urls, browsers, session_id, username)`: Runs secure comprehensive tests
- `list_secure_results(session_id, username)`: Lists secure test results
- `retrieve_secure_results(filename, session_id, username)`: Retrieves secure test results
