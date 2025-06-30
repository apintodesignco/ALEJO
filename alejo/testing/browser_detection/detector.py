#!/usr/bin/env python3
"""
ALEJO Browser Detector
Unified browser detection functionality for ALEJO
"""

import os
import sys
import logging
import platform
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple

logger = logging.getLogger("alejo.testing.browser_detection")

class BrowserDetector:
    """
    Unified browser detection for ALEJO
    
    This class provides methods to detect installed browsers on the system
    and find their executable paths. It supports Chrome, Firefox, Edge, Safari,
    and other browsers on Windows, macOS, and Linux.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the browser detector
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        self.system = platform.system().lower()
        self.detected_browsers = {}
        self.browser_versions = {}
        
        # Configure logging
        self._setup_logging()
        
        logger.info(f"Browser detector initialized on {self.system}")
    
    def _setup_logging(self):
        """Configure logging for the browser detector"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def detect_browsers(self) -> Dict[str, str]:
        """
        Detect all installed browsers on the system
        
        Returns:
            Dictionary mapping browser names to their executable paths
        """
        logger.info("Detecting installed browsers")
        
        self.detected_browsers = {}
        
        # Detect browsers based on the operating system
        if self.system == "windows":
            self._detect_windows_browsers()
        elif self.system == "darwin":
            self._detect_macos_browsers()
        elif self.system == "linux":
            self._detect_linux_browsers()
        else:
            logger.warning(f"Unsupported operating system: {self.system}")
        
        # Log detected browsers
        if self.detected_browsers:
            logger.info(f"Detected browsers: {', '.join(self.detected_browsers.keys())}")
        else:
            logger.warning("No browsers detected")
        
        return self.detected_browsers
    
    def _detect_windows_browsers(self):
        """Detect browsers on Windows"""
        # Chrome
        chrome_paths = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe")
        ]
        self._check_browser_paths("chrome", chrome_paths)
        
        # Firefox
        firefox_paths = [
            os.path.expandvars(r"%ProgramFiles%\Mozilla Firefox\firefox.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe")
        ]
        self._check_browser_paths("firefox", firefox_paths)
        
        # Edge
        edge_paths = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
        ]
        self._check_browser_paths("edge", edge_paths)
    
    def _detect_macos_browsers(self):
        """Detect browsers on macOS"""
        # Chrome
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            f"/Users/{os.getlogin()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        ]
        self._check_browser_paths("chrome", chrome_paths)
        
        # Firefox
        firefox_paths = [
            "/Applications/Firefox.app/Contents/MacOS/firefox",
            f"/Users/{os.getlogin()}/Applications/Firefox.app/Contents/MacOS/firefox"
        ]
        self._check_browser_paths("firefox", firefox_paths)
        
        # Safari
        safari_paths = [
            "/Applications/Safari.app/Contents/MacOS/Safari"
        ]
        self._check_browser_paths("safari", safari_paths)
        
        # Edge
        edge_paths = [
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            f"/Users/{os.getlogin()}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        ]
        self._check_browser_paths("edge", edge_paths)
    
    def _detect_linux_browsers(self):
        """Detect browsers on Linux"""
        # Use which command to find browser executables
        for browser in ["google-chrome", "chrome", "chromium", "firefox", "mozilla", "microsoft-edge"]:
            try:
                result = subprocess.run(["which", browser], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    path = result.stdout.strip()
                    
                    # Map to standard browser names
                    if browser in ["google-chrome", "chrome", "chromium"]:
                        self.detected_browsers["chrome"] = path
                    elif browser in ["firefox", "mozilla"]:
                        self.detected_browsers["firefox"] = path
                    elif browser == "microsoft-edge":
                        self.detected_browsers["edge"] = path
            except Exception as e:
                logger.debug(f"Error detecting {browser}: {e}")
    
    def _check_browser_paths(self, browser_name: str, paths: List[str]):
        """
        Check if a browser exists at any of the given paths
        
        Args:
            browser_name: Name of the browser
            paths: List of possible paths to the browser executable
        """
        for path in paths:
            if os.path.isfile(path):
                self.detected_browsers[browser_name] = path
                break
    
    def get_browser_version(self, browser_name: str) -> Optional[str]:
        """
        Get the version of a detected browser
        
        Args:
            browser_name: Name of the browser
            
        Returns:
            Browser version string or None if not detected
        """
        # Check if we've already detected this browser
        if browser_name not in self.detected_browsers:
            logger.warning(f"Browser {browser_name} not detected")
            return None
        
        # Check if we've already got the version
        if browser_name in self.browser_versions:
            return self.browser_versions[browser_name]
        
        browser_path = self.detected_browsers[browser_name]
        version = None
        
        try:
            # Different version commands for different browsers
            if browser_name == "chrome":
                args = [browser_path, "--version"]
            elif browser_name == "firefox":
                args = [browser_path, "--version"]
            elif browser_name == "edge":
                args = [browser_path, "--version"]
            else:
                logger.warning(f"Unknown browser: {browser_name}")
                return None
            
            result = subprocess.run(args, capture_output=True, text=True)
            if result.returncode == 0:
                output = result.stdout.strip()
                
                # Extract version from output
                if browser_name == "chrome":
                    # Output format: "Google Chrome XX.X.XXXX.XX"
                    parts = output.split()
                    if len(parts) >= 3:
                        version = parts[2]
                elif browser_name == "firefox":
                    # Output format: "Mozilla Firefox XX.X"
                    parts = output.split()
                    if len(parts) >= 3:
                        version = parts[2]
                elif browser_name == "edge":
                    # Output format: "Microsoft Edge XX.X.XXXX.XX"
                    parts = output.split()
                    if len(parts) >= 3:
                        version = parts[2]
        except Exception as e:
            logger.error(f"Error getting {browser_name} version: {e}")
        
        if version:
            self.browser_versions[browser_name] = version
            logger.info(f"Detected {browser_name} version: {version}")
        else:
            logger.warning(f"Could not determine {browser_name} version")
        
        return version
    
    def get_webdriver_path(self, browser_name: str) -> Optional[str]:
        """
        Get the path to the WebDriver for a browser
        
        Args:
            browser_name: Name of the browser
            
        Returns:
            Path to the WebDriver or None if not found
        """
        # Check if WebDriver is in PATH
        webdriver_name = self._get_webdriver_executable_name(browser_name)
        if not webdriver_name:
            logger.warning(f"Unknown browser: {browser_name}")
            return None
        
        try:
            # Check if WebDriver is in PATH
            if self.system == "windows":
                result = subprocess.run(["where", webdriver_name], capture_output=True, text=True)
            else:
                result = subprocess.run(["which", webdriver_name], capture_output=True, text=True)
                
            if result.returncode == 0 and result.stdout.strip():
                path = result.stdout.strip().split("\n")[0]
                logger.info(f"Found {webdriver_name} at: {path}")
                return path
        except Exception as e:
            logger.debug(f"Error finding {webdriver_name} in PATH: {e}")
        
        # Check common locations
        common_paths = self._get_common_webdriver_paths(browser_name)
        for path in common_paths:
            if os.path.isfile(path):
                logger.info(f"Found {webdriver_name} at: {path}")
                return path
        
        logger.warning(f"Could not find {webdriver_name}")
        return None
    
    def _get_webdriver_executable_name(self, browser_name: str) -> Optional[str]:
        """
        Get the executable name for a browser's WebDriver
        
        Args:
            browser_name: Name of the browser
            
        Returns:
            WebDriver executable name or None if unknown
        """
        if self.system == "windows":
            if browser_name == "chrome":
                return "chromedriver.exe"
            elif browser_name == "firefox":
                return "geckodriver.exe"
            elif browser_name == "edge":
                return "msedgedriver.exe"
        else:
            if browser_name == "chrome":
                return "chromedriver"
            elif browser_name == "firefox":
                return "geckodriver"
            elif browser_name == "edge":
                return "msedgedriver"
        
        return None
    
    def _get_common_webdriver_paths(self, browser_name: str) -> List[str]:
        """
        Get common paths for a browser's WebDriver
        
        Args:
            browser_name: Name of the browser
            
        Returns:
            List of common paths for the WebDriver
        """
        webdriver_name = self._get_webdriver_executable_name(browser_name)
        if not webdriver_name:
            return []
        
        paths = []
        
        # Current directory
        paths.append(os.path.join(os.getcwd(), webdriver_name))
        
        # Drivers directory
        paths.append(os.path.join(os.getcwd(), "drivers", webdriver_name))
        
        # User home directory
        paths.append(os.path.join(os.path.expanduser("~"), webdriver_name))
        paths.append(os.path.join(os.path.expanduser("~"), "drivers", webdriver_name))
        
        # System paths
        if self.system == "windows":
            paths.append(os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "WebDrivers", webdriver_name))
            paths.append(os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "WebDrivers", webdriver_name))
            paths.append(os.path.join(os.environ.get("LocalAppData", ""), "WebDrivers", webdriver_name))
        elif self.system == "darwin":
            paths.append(f"/usr/local/bin/{webdriver_name}")
            paths.append(f"/opt/homebrew/bin/{webdriver_name}")
        elif self.system == "linux":
            paths.append(f"/usr/local/bin/{webdriver_name}")
            paths.append(f"/usr/bin/{webdriver_name}")
        
        return paths
    
    def get_browser_info(self) -> Dict[str, Dict[str, str]]:
        """
        Get comprehensive information about all detected browsers
        
        Returns:
            Dictionary with browser information
        """
        info = {}
        
        # Detect browsers if not already done
        if not self.detected_browsers:
            self.detect_browsers()
        
        # Get information for each browser
        for browser_name, browser_path in self.detected_browsers.items():
            version = self.get_browser_version(browser_name)
            webdriver_path = self.get_webdriver_path(browser_name)
            
            info[browser_name] = {
                "path": browser_path,
                "version": version or "Unknown",
                "webdriver_path": webdriver_path or "Not found"
            }
        
        return info
    
    def print_browser_info(self):
        """Print information about all detected browsers"""
        info = self.get_browser_info()
        
        print("\n=== Detected Browsers ===\n")
        
        if not info:
            print("No browsers detected")
            return
        
        for browser_name, browser_info in info.items():
            print(f"Browser: {browser_name.capitalize()}")
            print(f"  Path: {browser_info['path']}")
            print(f"  Version: {browser_info['version']}")
            print(f"  WebDriver: {browser_info['webdriver_path']}")
            print()
