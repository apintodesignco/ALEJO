#!/usr/bin/env python3
"""
ALEJO Gesture System CI/CD Test Runner
Runs all gesture system tests in a CI/CD environment
"""
import argparse
import asyncio
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("ci_test_runner")

# Test categories
TEST_CATEGORIES = {
    "unit": ["tests/unit/interaction/test_gesture_websocket.py"],
    "integration": ["tests/integration/test_gesture_websocket.py"],
    "e2e": ["tests/e2e/test_gesture_interface.py"],
    "all": []  # Will be populated with all tests
}

# Populate the "all" category
TEST_CATEGORIES["all"] = (
    TEST_CATEGORIES["unit"] + 
    TEST_CATEGORIES["integration"] + 
    TEST_CATEGORIES["e2e"]
)


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="ALEJO Gesture System CI/CD Test Runner")
    parser.add_argument("--category", choices=TEST_CATEGORIES.keys(), default="all",
                        help="Test category to run (default: all)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Enable verbose output")
    parser.add_argument("--junit-xml", type=str,
                        help="Generate JUnit XML report at the specified path")
    parser.add_argument("--html-report", type=str,
                        help="Generate HTML report at the specified path")
    parser.add_argument("--coverage", action="store_true",
                        help="Generate coverage report")
    return parser.parse_args()


def setup_environment():
    """Set up the environment for testing."""
    logger.info("Setting up test environment...")
    
    # Set required environment variables
    os.environ["ALEJO_GESTURE_ENABLED"] = "true"
    os.environ["ALEJO_WEBSOCKET_PORT"] = "8765"
    os.environ["ALEJO_ACCESSIBILITY_LEVEL"] = "enhanced"
    os.environ["ALEJO_LOCAL_INFERENCE"] = "1"
    os.environ["ALEJO_TESTING"] = "1"
    
    # Check for required test dependencies
    try:
        import pytest
        import pytest_asyncio
        import websockets
    except ImportError as e:
        logger.error(f"Missing required test dependency: {e}")
        logger.error("Please install required packages: pip install pytest pytest-asyncio websockets")
        return False
    
    # Check for e2e test dependencies
    if "e2e" in sys.argv:
        try:
            import pytest_playwright
        except ImportError:
            logger.error("Missing playwright dependency for E2E tests")
            logger.error("Please install: pip install pytest-playwright")
            logger.error("And then: playwright install")
            return False
    
    return True


def run_tests(category, verbose=False, junit_xml=None, html_report=None, coverage=False):
    """Run the specified test category."""
    logger.info(f"Running {category} tests...")
    
    # Get the tests to run
    tests = TEST_CATEGORIES.get(category, [])
    if not tests:
        logger.error(f"No tests found for category: {category}")
        return False
    
    # Build the pytest command
    cmd = [sys.executable, "-m", "pytest"]
    
    # Add verbosity
    if verbose:
        cmd.append("-v")
    
    # Add JUnit XML report
    if junit_xml:
        cmd.extend(["--junitxml", junit_xml])
    
    # Add HTML report
    if html_report:
        cmd.extend(["--html", html_report])
    
    # Add coverage
    if coverage:
        cmd.extend(["--cov=alejo", "--cov-report=term", "--cov-report=html:coverage_html"])
    
    # Add the tests
    cmd.extend(tests)
    
    # Run the tests
    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    
    # Check the result
    if result.returncode == 0:
        logger.info(f"✅ {category} tests passed!")
        return True
    else:
        logger.error(f"❌ {category} tests failed with exit code {result.returncode}")
        return False


def start_services_for_integration_tests():
    """Start required services for integration tests."""
    logger.info("Starting services for integration tests...")
    
    # Start Redis for integration tests
    redis_process = None
    try:
        # Check if Redis is already running
        redis_check = subprocess.run(
            ["redis-cli", "ping"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if redis_check.returncode != 0:
            # Start Redis server
            logger.info("Starting Redis server...")
            redis_process = subprocess.Popen(
                ["redis-server", "--port", "6379"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for Redis to start
            time.sleep(2)
            
            # Check if Redis started successfully
            redis_check = subprocess.run(
                ["redis-cli", "ping"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if redis_check.returncode != 0:
                logger.error("Failed to start Redis server")
                return None
            
            logger.info("Redis server started")
        else:
            logger.info("Redis server is already running")
    
    except Exception as e:
        logger.error(f"Error starting Redis: {e}")
        return None
    
    return redis_process


def stop_services(redis_process):
    """Stop services that were started for testing."""
    if redis_process:
        logger.info("Stopping Redis server...")
        redis_process.terminate()
        redis_process.wait()
        logger.info("Redis server stopped")


def main():
    """Main entry point."""
    args = parse_arguments()
    
    logger.info("=" * 50)
    logger.info("ALEJO GESTURE SYSTEM CI/CD TEST RUNNER")
    logger.info("=" * 50)
    
    # Set up the environment
    if not setup_environment():
        logger.error("Failed to set up test environment")
        return 1
    
    # Start services for integration tests if needed
    redis_process = None
    if args.category in ["integration", "all"]:
        redis_process = start_services_for_integration_tests()
    
    try:
        # Run the tests
        success = run_tests(
            category=args.category,
            verbose=args.verbose,
            junit_xml=args.junit_xml,
            html_report=args.html_report,
            coverage=args.coverage
        )
        
        # Print summary
        logger.info("=" * 50)
        if success:
            logger.info("✅ All tests passed!")
        else:
            logger.error("❌ Some tests failed")
        logger.info("=" * 50)
        
        return 0 if success else 1
        
    finally:
        # Stop services
        stop_services(redis_process)


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)