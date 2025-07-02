#!/usr/bin/env python3
"""
Unit tests for the ALEJO Browser Detector module
"""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add parent directory to path to allow importing alejo package
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import secrets  # More secure for cryptographic purposes

from alejo.testing.browser_detection import BrowserDetector


class TestBrowserDetector(unittest.TestCase):
    """Test cases for the BrowserDetector class"""

    def setUp(self):
        """Set up test fixtures"""
        self.detector = BrowserDetector()

    def test_initialization(self):
        """Test detector initialization"""
        self.assertIsNotNone(self.detector)
        self.assertEqual(self.detector.system, sys.platform.lower())

    @patch("os.path.isfile")
    def test_windows_browser_detection(self, mock_isfile):
        """Test browser detection on Windows"""
        # Mock platform to be Windows
        with patch("platform.system", return_value="Windows"):
            # Mock file existence checks
            mock_isfile.side_effect = (
                lambda path: "chrome.exe" in path or "firefox.exe" in path
            )

            # Create a new detector with the mocked platform
            detector = BrowserDetector()
            browsers = detector.detect_browsers()

            # Check that Chrome and Firefox were detected
            self.assertIn("chrome", browsers)
            self.assertIn("firefox", browsers)
            self.assertNotIn(
                "edge", browsers
            )  # Edge should not be detected with our mock

    @patch("os.path.isfile")
    def test_macos_browser_detection(self, mock_isfile):
        """Test browser detection on macOS"""
        # Mock platform to be Darwin (macOS)
        with patch("platform.system", return_value="Darwin"):
            # Mock file existence checks
            mock_isfile.side_effect = (
                lambda path: "Google Chrome" in path or "Safari" in path
            )

            # Create a new detector with the mocked platform
            detector = BrowserDetector()
            browsers = detector.detect_browsers()

            # Check that Chrome and Safari were detected
            self.assertIn("chrome", browsers)
            self.assertIn("safari", browsers)
            self.assertNotIn(
                "firefox", browsers
            )  # Firefox should not be detected with our mock

    @patch("subprocess.run")
    def test_linux_browser_detection(self, mock_run):
        """Test browser detection on Linux"""
        # Mock platform to be Linux
        with patch("platform.system", return_value="Linux"):
            # Mock subprocess.run to return success for chrome and firefox
            def mock_which(cmd, **kwargs):
                result = MagicMock()
                if cmd[1] in ["google-chrome", "firefox"]:
                    result.returncode = 0
                    result.stdout = f"/usr/bin/{cmd[1]}\n"
                else:
                    result.returncode = 1
                    result.stdout = ""
                return result

            mock_run.side_effect = mock_which

            # Create a new detector with the mocked platform
            detector = BrowserDetector()
            browsers = detector.detect_browsers()

            # Check that Chrome and Firefox were detected
            self.assertIn("chrome", browsers)
            self.assertIn("firefox", browsers)
            self.assertNotIn(
                "edge", browsers
            )  # Edge should not be detected with our mock

    @patch("subprocess.run")
    def test_browser_version_detection(self, mock_run):
        """Test browser version detection"""
        # Mock browser detection
        with patch.object(BrowserDetector, "detect_browsers") as mock_detect:
            mock_detect.return_value = {
                "chrome": "/path/to/chrome",
                "firefox": "/path/to/firefox",
            }

            # Mock subprocess.run for version commands
            def mock_version_cmd(cmd, **kwargs):
                result = MagicMock()
                result.returncode = 0
                if "chrome" in cmd[0]:
                    result.stdout = "Google Chrome 90.0.4430.212"
                elif "firefox" in cmd[0]:
                    result.stdout = "Mozilla Firefox 88.0.1"
                return result

            mock_run.side_effect = mock_version_cmd

            # Create detector and get versions
            detector = BrowserDetector()
            chrome_version = detector.get_browser_version("chrome")
            firefox_version = detector.get_browser_version("firefox")

            # Check versions
            self.assertEqual(chrome_version, "90.0.4430.212")
            self.assertEqual(firefox_version, "88.0.1")

    @patch("subprocess.run")
    def test_webdriver_path_detection(self, mock_run):
        """Test WebDriver path detection"""

        # Mock subprocess.run for which/where commands
        def mock_which_cmd(cmd, **kwargs):
            result = MagicMock()
            if cmd[1] == "chromedriver" or cmd[1] == "chromedriver.exe":
                result.returncode = 0
                result.stdout = "/path/to/chromedriver\n"
            else:
                result.returncode = 1
                result.stdout = ""
            return result

        mock_run.side_effect = mock_which_cmd

        # Create detector and get WebDriver path
        detector = BrowserDetector()
        chromedriver_path = detector.get_webdriver_path("chrome")
        geckodriver_path = detector.get_webdriver_path("firefox")

        # Check paths
        self.assertEqual(chromedriver_path, "/path/to/chromedriver")
        self.assertIsNone(
            geckodriver_path
        )  # Should be None since our mock returns failure

    def test_browser_info(self):
        """Test getting comprehensive browser information"""
        # Mock methods
        with patch.object(
            BrowserDetector, "detect_browsers"
        ) as mock_detect, patch.object(
            BrowserDetector, "get_browser_version"
        ) as mock_version, patch.object(
            BrowserDetector, "get_webdriver_path"
        ) as mock_webdriver:

            mock_detect.return_value = {
                "chrome": "/path/to/chrome",
                "firefox": "/path/to/firefox",
            }
            mock_version.side_effect = lambda browser: (
                "100.0" if browser == "chrome" else "99.0"
            )
            mock_webdriver.side_effect = lambda browser: (
                "/path/to/chromedriver" if browser == "chrome" else None
            )

            # Get browser info
            detector = BrowserDetector()
            info = detector.get_browser_info()

            # Check info
            self.assertIn("chrome", info)
            self.assertIn("firefox", info)
            self.assertEqual(info["chrome"]["path"], "/path/to/chrome")
            self.assertEqual(info["chrome"]["version"], "100.0")
            self.assertEqual(info["chrome"]["webdriver_path"], "/path/to/chromedriver")
            self.assertEqual(info["firefox"]["path"], "/path/to/firefox")
            self.assertEqual(info["firefox"]["version"], "99.0")
            self.assertEqual(info["firefox"]["webdriver_path"], "Not found")


if __name__ == "__main__":
    unittest.main()
