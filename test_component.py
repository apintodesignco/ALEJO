#!/usr/bin/env python3
"""
ALEJO Component Tester

A tool to test specific components of ALEJO in isolation.

Usage:
    python test_component.py [component] [options]

Components:
    voice       Test voice recognition and synthesis
    vision      Test computer vision capabilities
    brain       Test core AI brain functionality
    gesture     Test gesture recognition system
    emotional   Test emotional intelligence system
    ethical     Test ethical framework
    all         Test all components (default)

Options:
    --unit-only     Run only unit tests
    --mock-deps     Mock all dependencies
    --verbose       Show detailed output
    --skip-setup    Skip environment setup
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

# Add the project root to the Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# ANSI color codes for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
END = "\033[0m"


class ComponentTester:
    """Main class for testing specific ALEJO components in isolation"""
    
    def __init__(self, args):
        self.args = args
        self.start_time = time.time()
        self.results = {}
        self.errors = []
        
        # Create output directory if it doesn't exist
        self.output_dir = "test_reports"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def print_header(self, message):
        """Print a formatted header message"""
        print(f"\n{BOLD}{BLUE}{'=' * 80}{END}")
        print(f"{BOLD}{BLUE}= {message}{END}")
        print(f"{BOLD}{BLUE}{'=' * 80}{END}\n")
    
    def run_command(self, command, name, fail_on_error=False):
        """Run a shell command and capture output"""
        if self.args.verbose:
            print(f"Running: {' '.join(command)}")
        
        start = time.time()
        try:
            process = subprocess.run(command, capture_output=True, text=True)
            duration = time.time() - start
            
            self.results[name] = {
                "returncode": process.returncode,
                "duration": duration,
                "command": " ".join(command)
            }
            
            if process.returncode != 0:
                error_msg = f"Command failed: {' '.join(command)}"
                if process.stderr:
                    error_msg += f"\nError: {process.stderr}"
                if process.stdout and self.args.verbose:
                    error_msg += f"\nOutput: {process.stdout}"
                self.errors.append(error_msg)
                print(f"{YELLOW}! {name} failed with exit code {process.returncode}{END}")
                if fail_on_error:
                    print(f"{RED}{error_msg}{END}")
                    sys.exit(process.returncode)
            elif self.args.verbose:
                print(f"{GREEN}✓ {name} completed successfully{END}")
                if process.stdout:
                    print(process.stdout)
            
            return process.returncode, process.stdout, process.stderr
        except Exception as e:
            duration = time.time() - start
            error_msg = f"Error running command: {' '.join(command)}\nError: {str(e)}"
            self.errors.append(error_msg)
            self.results[name] = {
                "returncode": 1,
                "duration": duration,
                "command": " ".join(command),
                "error": str(e)
            }
            print(f"{RED}✗ {name} failed with exception: {str(e)}{END}")
            if fail_on_error:
                print(f"{RED}{error_msg}{END}")
                sys.exit(1)
            return 1, "", str(e)
    
    def setup_test_environment(self):
        """Set up the test environment with mocks if needed"""
        if self.args.skip_setup:
            return
            
        self.print_header(f"Setting up test environment for {self.args.component}")
        
        # Create environment variables for mocking
        if self.args.mock_deps:
            os.environ["ALEJO_MOCK_DEPENDENCIES"] = "1"
            print(f"{BLUE}Using mocked dependencies{END}")
        
        # Component-specific setup
        if self.args.component == "voice":
            # Setup voice testing environment
            if self.args.mock_deps:
                os.environ["ALEJO_MOCK_AUDIO"] = "1"
            
        elif self.args.component == "vision":
            # Setup vision testing environment
            if self.args.mock_deps:
                os.environ["ALEJO_MOCK_CAMERA"] = "1"
                
        elif self.args.component == "brain":
            # Setup brain testing environment
            if self.args.mock_deps:
                os.environ["ALEJO_MOCK_LLM"] = "1"
                
        elif self.args.component == "gesture":
            # Setup gesture testing environment
            if self.args.mock_deps:
                os.environ["ALEJO_MOCK_MEDIAPIPE"] = "1"
    
    def run_component_test(self):
        """Run tests for the specified component"""
        component = self.args.component
        
        self.print_header(f"Testing {component.upper()} component")
        
        # Build the pytest command
        cmd = ["python", "-m", "pytest"]
        
        # Add component-specific test paths
        if component == "voice":
            cmd.extend(["tests/unit/voice/"])
            if not self.args.unit_only:
                cmd.extend(["tests/integration/voice/"])
                
        elif component == "vision":
            cmd.extend(["tests/unit/vision/"])
            if not self.args.unit_only:
                cmd.extend(["tests/integration/vision/"])
                
        elif component == "brain":
            cmd.extend(["tests/unit/brain/"])
            if not self.args.unit_only:
                cmd.extend(["tests/integration/brain/"])
                
        elif component == "emotional":
            cmd.extend(["tests/unit/emotional/"])
            if not self.args.unit_only:
                cmd.extend(["tests/integration/emotional/"])
                
        elif component == "ethical":
            cmd.extend(["tests/unit/ethical/"])
            if not self.args.unit_only:
                cmd.extend(["tests/integration/ethical/"])
                
        elif component == "gesture":
            # Gesture system has its own test script
            return self.run_command(["python", "ci_test_gesture_system.py"], "gesture_tests")
            
        elif component == "all":
            if self.args.unit_only:
                cmd.extend(["tests/unit/"])
            else:
                cmd.extend(["tests/unit/", "tests/integration/"])
        
        # Add verbosity flag if requested
        if self.args.verbose:
            cmd.append("-v")
            
        # Add JUnit XML output for CI integration
        output_file = os.path.join(self.output_dir, f"{component}_test_results.xml")
        cmd.append(f"--junitxml={output_file}")
        
        # Run the tests
        return self.run_command(cmd, f"{component}_tests")
    
    def run_minimal_test(self):
        """Run a minimal test to verify the component can be imported"""
        component = self.args.component
        
        self.print_header(f"Running minimal import test for {component.upper()}")
        
        # Create a temporary test file
        test_file = "temp_minimal_test.py"
        with open(test_file, "w") as f:
            f.write(f"""
import sys
import os
import pytest

def test_can_import_{component}():
    try:
        if "{component}" == "voice":
            from alejo.voice import VoiceInput, VoiceOutput
            assert VoiceInput is not None
            assert VoiceOutput is not None
        elif "{component}" == "vision":
            from alejo.vision import VisionProcessor
            assert VisionProcessor is not None
        elif "{component}" == "brain":
            from alejo.brain import ALEJOBrain
            assert ALEJOBrain is not None
        elif "{component}" == "emotional":
            from alejo.emotional import EmotionalProcessor
            assert EmotionalProcessor is not None
        elif "{component}" == "ethical":
            from alejo.ethical import EthicalFramework
            assert EthicalFramework is not None
        elif "{component}" == "gesture":
            from alejo.interaction.gesture_arpeggiator import GestureArpeggiator
            assert GestureArpeggiator is not None
        elif "{component}" == "all":
            import alejo
            assert alejo is not None
        print("Import successful")
    except Exception as e:
        print(f"Import failed: {{e}}")
        raise
""")
        
        # Run the minimal test
        cmd = ["python", "-m", "pytest", test_file, "-v"]
        result = self.run_command(cmd, f"{component}_minimal_test")
        
        # Clean up
        try:
            os.remove(test_file)
        except:
            pass
            
        return result
    
    def print_summary(self):
        """Print test summary"""
        total_duration = time.time() - self.start_time
        
        self.print_header("Test Summary")
        print(f"{BOLD}Component:{END} {self.args.component}")
        print(f"{BOLD}Total Duration:{END} {total_duration:.2f} seconds")
        print(f"{BOLD}Tests Run:{END} {len(self.results)}")
        
        # Count failures
        failures = sum(1 for result in self.results.values() if result.get("returncode", 0) != 0)
        print(f"{BOLD}Failures:{END} {failures}")
        
        # Print errors
        if self.errors:
            print(f"\n{BOLD}{RED}Errors ({len(self.errors)}):{END}")
            for error in self.errors:
                print(f"  - {error}")
        
        # Final status
        if failures == 0 and not self.errors:
            print(f"\n{GREEN}{BOLD}All tests passed successfully!{END}")
        else:
            print(f"\n{RED}{BOLD}Some tests failed. Please review the reports in {self.output_dir}{END}")
    
    def run(self):
        """Run the component tests"""
        try:
            # Set up the test environment
            self.setup_test_environment()
            
            # Run a minimal test first to check if imports work
            minimal_result = self.run_minimal_test()
            
            # If minimal test passes, run the full component test
            if minimal_result[0] == 0:
                self.run_component_test()
            else:
                print(f"{RED}Minimal test failed. Skipping full component test.{END}")
                
            # Print summary
            self.print_summary()
            
            # Return non-zero exit code if any test failed
            return 1 if any(result.get("returncode", 0) != 0 for result in self.results.values()) else 0
            
        except KeyboardInterrupt:
            print(f"\n{YELLOW}Testing interrupted by user{END}")
            return 130
        except Exception as e:
            print(f"\n{RED}Error running tests: {str(e)}{END}")
            return 1


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="ALEJO Component Tester")
    parser.add_argument("component", choices=["voice", "vision", "brain", "gesture", 
                                            "emotional", "ethical", "all"],
                      default="all", nargs="?",
                      help="Component to test")
    parser.add_argument("--unit-only", action="store_true", 
                      help="Run only unit tests")
    parser.add_argument("--mock-deps", action="store_true",
                      help="Mock all dependencies")
    parser.add_argument("--verbose", action="store_true",
                      help="Show detailed output")
    parser.add_argument("--skip-setup", action="store_true",
                      help="Skip environment setup")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    tester = ComponentTester(args)
    sys.exit(tester.run())