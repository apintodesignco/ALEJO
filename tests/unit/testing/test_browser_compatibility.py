#!/usr/bin/env python3
"""
Unit tests for the ALEJO Browser Compatibility Tester module
"""
import json
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

# Add parent directory to path to allow importing alejo package
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import secrets  # More secure for cryptographic purposes

from alejo.testing.browser_testing import BrowserCompatibilityTester


class TestBrowserCompatibilityTester(unittest.TestCase):
    """Test cases for the BrowserCompatibilityTester class"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = {
            "headless": True,
            "timeout": 10,
            "screenshot_dir": "test_screenshots",
            "results_dir": "test_results",
        }
        self.tester = BrowserCompatibilityTester(self.config)

    def test_initialization(self):
        """Test tester initialization"""
        self.assertIsNotNone(self.tester)
        self.assertEqual(self.tester.config["headless"], True)
        self.assertEqual(self.tester.config["timeout"], 10)

    @patch("alejo.testing.browser_detection.BrowserDetector")
    def test_get_available_browsers(self, mock_detector):
        """Test getting available browsers"""
        # Mock browser detector
        mock_instance = mock_detector.return_value
        mock_instance.detect_browsers.return_value = {
            "chrome": "/path/to/chrome",
            "firefox": "/path/to/firefox",
        }

        # Get available browsers
        browsers = self.tester.get_available_browsers()

        # Check browsers
        self.assertIn("chrome", browsers)
        self.assertIn("firefox", browsers)
        self.assertEqual(len(browsers), 2)

    @patch("selenium.webdriver.Chrome")
    @patch("selenium.webdriver.Firefox")
    @patch("alejo.testing.browser_detection.BrowserDetector")
    def test_create_driver(self, mock_detector, mock_firefox, mock_chrome):
        """Test creating WebDriver instances"""
        # Mock browser detector
        mock_instance = mock_detector.return_value
        mock_instance.get_webdriver_path.side_effect = (
            lambda browser: f"/path/to/{browser}driver"
        )

        # Mock Chrome driver
        chrome_driver = MagicMock()
        mock_chrome.return_value = chrome_driver

        # Mock Firefox driver
        firefox_driver = MagicMock()
        mock_firefox.return_value = firefox_driver

        # Create drivers
        chrome_result = self.tester._create_driver("chrome")
        firefox_result = self.tester._create_driver("firefox")

        # Check drivers
        self.assertEqual(chrome_result, chrome_driver)
        self.assertEqual(firefox_result, firefox_driver)

        # Test unsupported browser
        with self.assertRaises(ValueError):
            self.tester._create_driver("unsupported")

    @patch("selenium.webdriver.Chrome")
    @patch("alejo.testing.browser_detection.BrowserDetector")
    def test_test_browser(self, mock_detector, mock_chrome):
        """Test testing a single browser"""
        # Mock browser detector
        mock_instance = mock_detector.return_value
        mock_instance.get_webdriver_path.return_value = "/path/to/chromedriver"

        # Mock Chrome driver
        chrome_driver = MagicMock()
        chrome_driver.title = "Test Page"
        chrome_driver.current_url = "https://example.com"
        chrome_driver.page_source = "<html><body>Test</body></html>"
        chrome_driver.get_screenshot_as_png.return_value = b"screenshot_data"
        chrome_driver.execute_script.return_value = 1000  # Navigation timing

        # Mock find_elements to return different counts for different element types
        def mock_find_elements(by, value):
            elements = []
            if value == "a":
                return [MagicMock()] * 5  # 5 links
            elif value == "img":
                return [MagicMock()] * 3  # 3 images
            else:
                return []

        chrome_driver.find_elements.side_effect = mock_find_elements
        mock_chrome.return_value = chrome_driver

        # Create mock Path for screenshots
        with patch("pathlib.Path.mkdir") as mock_mkdir, patch(
            "builtins.open", mock_open()
        ) as mock_file:

            # Test browser
            url = "https://example.com"
            result = self.tester._test_browser(url, "chrome", "test_run")

            # Check result
            self.assertTrue(result["success"])
            self.assertEqual(result["browser"], "chrome")
            self.assertEqual(result["url"], url)
            self.assertEqual(result["page_title"], "Test Page")
            self.assertIn("load_time", result)
            self.assertIn("elements_found", result)
            self.assertEqual(result["elements_found"]["links"], 5)
            self.assertEqual(result["elements_found"]["images"], 3)
            self.assertIn("screenshot", result)

    @patch("alejo.testing.browser_testing.BrowserCompatibilityTester._test_browser")
    @patch(
        "alejo.testing.browser_testing.BrowserCompatibilityTester.get_available_browsers"
    )
    def test_run_tests(self, mock_get_browsers, mock_test_browser):
        """Test running tests on multiple browsers"""
        # Mock available browsers
        mock_get_browsers.return_value = ["chrome", "firefox"]

        # Mock test_browser results
        def mock_test_results(url, browser, test_name):
            return {
                "success": True,
                "browser": browser,
                "url": url,
                "page_title": f"Test Page - {browser}",
                "load_time": 1.5 if browser == "chrome" else 2.0,
                "elements_found": {"links": 5, "images": 3},
                "screenshot": f"/path/to/{browser}_screenshot.png",
            }

        mock_test_browser.side_effect = mock_test_results

        # Mock json.dump
        with patch("json.dump") as mock_json_dump, patch(
            "pathlib.Path.mkdir"
        ) as mock_mkdir, patch("builtins.open", mock_open()) as mock_file:

            # Run tests
            url = "https://example.com"
            results = self.tester.run_tests(url, None, "test_run")

            # Check results
            self.assertEqual(results["url"], url)
            self.assertEqual(results["test_name"], "test_run")
            self.assertIn("browsers", results)
            self.assertEqual(len(results["browsers"]), 2)
            self.assertIn("chrome", results["browsers"])
            self.assertIn("firefox", results["browsers"])
            self.assertTrue(results["browsers"]["chrome"]["success"])
            self.assertTrue(results["browsers"]["firefox"]["success"])

    @patch("json.load")
    def test_get_test_summary(self, mock_json_load):
        """Test getting test summary"""
        # Mock json.load to return test results
        mock_results = {
            "url": "https://example.com",
            "test_name": "test_run",
            "browsers": {
                "chrome": {
                    "success": True,
                    "load_time": 1.5,
                    "page_title": "Test Page - Chrome",
                },
                "firefox": {"success": False, "error": "Timeout", "page_title": None},
            },
        }
        mock_json_load.return_value = mock_results

        # Mock open to allow reading the results file
        with patch("builtins.open", mock_open()) as mock_file, patch(
            "os.path.exists"
        ) as mock_exists:

            mock_exists.return_value = True

            # Get test summary
            summary = self.tester.get_test_summary("test_run")

            # Check summary
            self.assertEqual(summary["url"], "https://example.com")
            self.assertEqual(summary["test_name"], "test_run")
            self.assertEqual(summary["browsers_tested"], 2)
            self.assertEqual(summary["successful_tests"], 1)
            self.assertEqual(summary["failed_tests"], 1)

    @patch("alejo.testing.browser_testing.BrowserCompatibilityTester.get_test_summary")
    def test_compare_test_results(self, mock_get_summary):
        """Test comparing test results"""

        # Mock get_test_summary to return test results
        def mock_summary(test_name):
            if test_name == "test1":
                return {
                    "url": "https://example.com",
                    "test_name": "test1",
                    "browsers": {
                        "chrome": {
                            "success": True,
                            "load_time": 1.5,
                            "page_title": "Test Page",
                            "elements_found": {"links": 5, "images": 3},
                        },
                        "firefox": {
                            "success": True,
                            "load_time": 2.0,
                            "page_title": "Test Page",
                            "elements_found": {"links": 5, "images": 3},
                        },
                    },
                }
            else:
                return {
                    "url": "https://example.com",
                    "test_name": "test2",
                    "browsers": {
                        "chrome": {
                            "success": True,
                            "load_time": 1.2,
                            "page_title": "Test Page Updated",
                            "elements_found": {"links": 6, "images": 3},
                        },
                        "firefox": {
                            "success": False,
                            "error": "Timeout",
                            "page_title": None,
                            "elements_found": {},
                        },
                    },
                }

        mock_get_summary.side_effect = mock_summary

        # Compare test results
        comparison = self.tester.compare_test_results("test1", "test2")

        # Check comparison
        self.assertEqual(comparison["test1"], "test1")
        self.assertEqual(comparison["test2"], "test2")
        self.assertIn("browsers", comparison)
        self.assertIn("chrome", comparison["browsers"])
        self.assertIn("firefox", comparison["browsers"])
        self.assertTrue(comparison["browsers"]["chrome"]["test1_success"])
        self.assertTrue(comparison["browsers"]["chrome"]["test2_success"])
        self.assertTrue(comparison["browsers"]["firefox"]["test1_success"])
        self.assertFalse(comparison["browsers"]["firefox"]["test2_success"])
        self.assertEqual(
            comparison["browsers"]["chrome"]["load_time_diff"], -0.3
        )  # 1.2 - 1.5
        self.assertEqual(
            comparison["browsers"]["chrome"]["element_count_diff"]["links"], 1
        )  # 6 - 5


if __name__ == "__main__":
    unittest.main()
