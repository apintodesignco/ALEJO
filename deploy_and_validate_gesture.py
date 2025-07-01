#!/usr/bin/env python3
"""
ALEJO Gesture System Deployment and Validation Script
Deploys the gesture system and validates that it's working correctly
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

logger = logging.getLogger("deploy_validate")

# Default settings
DEFAULT_MODE = "standalone"  # standalone or docker
DEFAULT_WEB_PORT = 8000
DEFAULT_WS_PORT = 8765
DEFAULT_ACCESSIBILITY_LEVEL = "enhanced"


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Deploy and validate the ALEJO gesture system")
    parser.add_argument("--mode", choices=["standalone", "docker"], default=DEFAULT_MODE,
                        help=f"Deployment mode (default: {DEFAULT_MODE})")
    parser.add_argument("--web-port", type=int, default=DEFAULT_WEB_PORT,
                        help=f"Web server port (default: {DEFAULT_WEB_PORT})")
    parser.add_argument("--ws-port", type=int, default=DEFAULT_WS_PORT,
                        help=f"WebSocket server port (default: {DEFAULT_WS_PORT})")
    parser.add_argument("--accessibility", choices=["basic", "standard", "enhanced"],
                        default=DEFAULT_ACCESSIBILITY_LEVEL,
                        help=f"Accessibility level (default: {DEFAULT_ACCESSIBILITY_LEVEL})")
    parser.add_argument("--no-browser", action="store_true",
                        help="Don't open browser automatically")
    parser.add_argument("--skip-validation", action="store_true",
                        help="Skip validation step")
    return parser.parse_args()


def check_prerequisites():
    """Check that all prerequisites are met."""
    logger.info("Checking prerequisites...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 9):
        logger.error("❌ Python 3.9+ is required")
        return False
    
    # Check required files
    required_files = [
        "start_gesture_system.py",
        "alejo/web/__init__.py",
        "alejo/templates/gesture_enabled_interface.html",
        "alejo/static/js/gesture-controller.js"
    ]
    
    for file_path in required_files:
        if not Path(file_path).exists():
            logger.error(f"❌ Required file not found: {file_path}")
            return False
    
    logger.info("✅ All prerequisites met")
    return True


def deploy_standalone(web_port, ws_port, accessibility_level, open_browser=True):
    """Deploy the gesture system in standalone mode."""
    logger.info("Deploying gesture system in standalone mode...")
    
    # Set environment variables
    env = os.environ.copy()
    env["ALEJO_GESTURE_ENABLED"] = "true"
    env["ALEJO_WEBSOCKET_PORT"] = str(ws_port)
    env["ALEJO_WEB_PORT"] = str(web_port)
    env["ALEJO_ACCESSIBILITY_LEVEL"] = accessibility_level
    env["ALEJO_LOCAL_INFERENCE"] = "1"
    
    # Build the command
    cmd = [sys.executable, "start_gesture_system.py"]
    if not open_browser:
        cmd.append("--no-browser")
    
    # Start the gesture system
    logger.info(f"Starting gesture system: {' '.join(cmd)}")
    process = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Wait for the system to start
    started = False
    start_time = time.time()
    timeout = 30  # seconds
    
    while time.time() - start_time < timeout:
        output = process.stdout.readline()
        if output:
            logger.info(output.strip())
            if "Server started at" in output:
                started = True
                break
    
    if not started:
        logger.error("❌ Failed to start gesture system within timeout")
        process.terminate()
        return None
    
    logger.info("✅ Gesture system started successfully")
    return process


def deploy_docker(web_port, ws_port, accessibility_level):
    """Deploy the gesture system using Docker Compose."""
    logger.info("Deploying gesture system using Docker Compose...")
    
    # Check if Docker is available
    try:
        subprocess.run(["docker", "--version"], check=True, stdout=subprocess.PIPE)
    except (subprocess.SubprocessError, FileNotFoundError):
        logger.error("❌ Docker is not installed or not in PATH")
        return False
    
    # Check if docker-compose is available
    try:
        subprocess.run(["docker-compose", "--version"], check=True, stdout=subprocess.PIPE)
    except (subprocess.SubprocessError, FileNotFoundError):
        logger.error("❌ Docker Compose is not installed or not in PATH")
        return False
    
    # Set environment variables for docker-compose
    env = os.environ.copy()
    env["ALEJO_GESTURE_ENABLED"] = "true"
    env["ALEJO_WEBSOCKET_PORT"] = str(ws_port)
    env["ALEJO_WEB_PORT"] = str(web_port)
    env["ALEJO_ACCESSIBILITY_LEVEL"] = accessibility_level
    
    # Start the services
    try:
        logger.info("Starting Docker services...")
        subprocess.run(
            ["docker-compose", "up", "-d", "redis", "brain", "gesture_websocket"],
            check=True,
            env=env
        )
        
        # Wait for services to be ready
        logger.info("Waiting for services to be ready...")
        time.sleep(10)
        
        # Check if services are running
        result = subprocess.run(
            ["docker-compose", "ps", "gesture_websocket"],
            stdout=subprocess.PIPE,
            text=True,
            check=True
        )
        
        if "Up" in result.stdout:
            logger.info("✅ Docker services started successfully")
            return True
        else:
            logger.error("❌ Docker services failed to start")
            return False
            
    except subprocess.SubprocessError as e:
        logger.error(f"❌ Error starting Docker services: {e}")
        return False


async def validate_deployment(web_port, ws_port):
    """Validate that the deployment is working correctly."""
    logger.info("Validating deployment...")
    
    # Import the validation module
    try:
        from validate_gesture_deployment import GestureSystemValidator
    except ImportError:
        logger.error("❌ Validation module not found. Make sure validate_gesture_deployment.py exists.")
        return False
    
    # Create validator
    validator = GestureSystemValidator(
        ws_url=f"ws://localhost:{ws_port}",
        web_url=f"http://localhost:{web_port}",
        redis_url="redis://localhost:6379/0"
    )
    
    # Run validation
    success = await validator.validate_all()
    
    if success:
        logger.info("✅ Validation completed successfully")
    else:
        logger.warning("⚠️ Some validation checks failed")
    
    return success


def open_browser(web_port):
    """Open the browser to the gesture interface."""
    import webbrowser
    url = f"http://localhost:{web_port}/gestures"
    logger.info(f"Opening browser to {url}")
    webbrowser.open(url)


async def main():
    """Main function."""
    args = parse_arguments()
    
    logger.info("=" * 50)
    logger.info("ALEJO GESTURE SYSTEM DEPLOYMENT AND VALIDATION")
    logger.info("=" * 50)
    
    # Check prerequisites
    if not check_prerequisites():
        logger.error("Prerequisites check failed. Aborting.")
        return 1
    
    # Deploy the system
    process = None
    if args.mode == "standalone":
        process = deploy_standalone(
            web_port=args.web_port,
            ws_port=args.ws_port,
            accessibility_level=args.accessibility,
            open_browser=not args.no_browser
        )
        if not process:
            return 1
    else:  # docker mode
        success = deploy_docker(
            web_port=args.web_port,
            ws_port=args.ws_port,
            accessibility_level=args.accessibility
        )
        if not success:
            return 1
        
        # Open browser if requested
        if not args.no_browser:
            open_browser(args.web_port)
    
    # Validate the deployment
    if not args.skip_validation:
        try:
            await validate_deployment(args.web_port, args.ws_port)
        except Exception as e:
            logger.error(f"❌ Validation error: {e}")
    
    # Keep the process running in standalone mode
    if args.mode == "standalone" and process:
        logger.info("=" * 50)
        logger.info("Gesture system is running. Press Ctrl+C to stop.")
        logger.info("=" * 50)
        
        try:
            while True:
                output = process.stdout.readline()
                if output:
                    print(output.strip())
                if process.poll() is not None:
                    break
        except KeyboardInterrupt:
            logger.info("Stopping gesture system...")
            process.terminate()
    
    logger.info("=" * 50)
    logger.info("Deployment completed!")
    logger.info(f"Access the gesture interface at: http://localhost:{args.web_port}/gestures")
    logger.info("=" * 50)
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("Operation interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)