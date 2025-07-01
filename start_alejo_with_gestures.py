#!/usr/bin/env python3
"""
ALEJO Production Startup Script with Gesture System Integration
Launches all ALEJO services including the gesture system in a production environment
"""
import argparse
import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Import update manager
try:
    from update_manager import UpdateManager
    UPDATE_MANAGER_AVAILABLE = True
except ImportError:
    UPDATE_MANAGER_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_production.log')
    ]
)

logger = logging.getLogger("alejo_production")

# Service configuration
SERVICES = {
    "redis": {
        "name": "Redis Database",
        "docker_service": "redis",
        "health_check": ["redis-cli", "ping"],
        "required": True,
        "startup_order": 1
    },
    "brain": {
        "name": "ALEJO Brain",
        "docker_service": "brain",
        "health_check": ["curl", "-f", "http://localhost:5000/health"],
        "required": True,
        "startup_order": 2
    },
    "emotional": {
        "name": "Emotional Intelligence",
        "docker_service": "emotional",
        "health_check": ["curl", "-f", "http://localhost:5001/health"],
        "required": False,
        "startup_order": 3
    },
    "memory": {
        "name": "Memory Service",
        "docker_service": "memory",
        "health_check": ["curl", "-f", "http://localhost:5002/health"],
        "required": True,
        "startup_order": 4
    },
    "command": {
        "name": "Command Processor",
        "docker_service": "command_processor",
        "health_check": ["curl", "-f", "http://localhost:5003/health"],
        "required": True,
        "startup_order": 5
    },
    "gesture": {
        "name": "Gesture WebSocket",
        "docker_service": "gesture_websocket",
        "health_check": ["curl", "-f", "http://localhost:8765/health"],
        "required": False,
        "startup_order": 6
    },
    "web": {
        "name": "Web Interface",
        "docker_service": "web",
        "health_check": ["curl", "-f", "http://localhost:8000/health"],
        "required": True,
        "startup_order": 7
    }
}


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Start ALEJO with gesture system integration"
    )
    # Add update-related command line arguments
    parser.add_argument(
        "--skip-updates",
        action="store_true",
        help="Skip checking for updates before starting"
    )
    parser.add_argument("--mode", choices=["docker", "local"], default="docker",
                        help="Deployment mode (docker or local)")
    parser.add_argument("--services", nargs="+", choices=list(SERVICES.keys()) + ["all"],
                        default=["all"], help="Services to start")
    parser.add_argument("--no-gesture", action="store_true",
                        help="Disable gesture system")
    parser.add_argument("--accessibility", choices=["basic", "standard", "enhanced"],
                        default="enhanced", help="Accessibility level for gesture system")
    parser.add_argument("--web-port", type=int, default=8000,
                        help="Web server port")
    parser.add_argument("--ws-port", type=int, default=8765,
                        help="WebSocket server port")
    parser.add_argument("--no-browser", action="store_true",
                        help="Don't open browser automatically")
    parser.add_argument("--validate", action="store_true",
                        help="Validate deployment after startup")
    return parser.parse_args()


def setup_environment(args):
    """Set up environment variables for ALEJO services."""
    logger.info("Setting up environment variables...")
    
    # Load from .env file if it exists
    env_path = Path('.env')
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)
        logger.info("Loaded environment from .env file")
    
    # Set required environment variables
    os.environ["ALEJO_WEB_PORT"] = str(args.web_port)
    os.environ["ALEJO_WEBSOCKET_PORT"] = str(args.ws_port)
    
    # Gesture system configuration
    if args.no_gesture:
        os.environ["ALEJO_GESTURE_ENABLED"] = "false"
    else:
        os.environ["ALEJO_GESTURE_ENABLED"] = "true"
        os.environ["ALEJO_ACCESSIBILITY_LEVEL"] = args.accessibility
        os.environ["ALEJO_LOCAL_INFERENCE"] = "1"
    
    # Set production mode
    os.environ["ALEJO_ENV"] = "production"
    
    logger.info("Environment variables set")


def check_docker_available():
    """Check if Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        return result.returncode == 0
    except Exception:
        return False


def check_docker_compose_available():
    """Check if Docker Compose is available."""
    try:
        result = subprocess.run(
            ["docker-compose", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        return result.returncode == 0
    except Exception:
        return False


def start_docker_services(services_to_start):
    """Start services using Docker Compose."""
    logger.info("Starting Docker services...")
    
    if not check_docker_available():
        logger.error("Docker is not available. Please install Docker and try again.")
        return False
    
    if not check_docker_compose_available():
        logger.error("Docker Compose is not available. Please install Docker Compose and try again.")
        return False
    
    # Check if docker-compose.yml exists
    if not Path("docker-compose.yml").exists():
        logger.error("docker-compose.yml not found. Please make sure you're in the ALEJO directory.")
        return False
    
    # Start services in order
    ordered_services = sorted(
        [(name, config) for name, config in SERVICES.items() if name in services_to_start],
        key=lambda x: x[1]["startup_order"]
    )
    
    for name, config in ordered_services:
        logger.info(f"Starting {config['name']}...")
        
        try:
            subprocess.run(
                ["docker-compose", "up", "-d", config["docker_service"]],
                check=True
            )
            
            # Wait for service to be healthy
            healthy = wait_for_service_health(config["health_check"], timeout=30)
            
            if healthy:
                logger.info(f"✅ {config['name']} started successfully")
            else:
                logger.error(f"❌ {config['name']} failed to start or become healthy")
                if config["required"]:
                    logger.error(f"Required service {config['name']} failed to start. Aborting.")
                    return False
        except subprocess.SubprocessError as e:
            logger.error(f"❌ Error starting {config['name']}: {e}")
            if config["required"]:
                logger.error(f"Required service {config['name']} failed to start. Aborting.")
                return False
    
    logger.info("✅ All Docker services started successfully")
    return True


def start_local_services(services_to_start):
    """Start services locally using Python scripts."""
    logger.info("Starting local services...")
    
    # Start Redis if needed
    if "redis" in services_to_start:
        logger.info("Starting Redis...")
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
                subprocess.Popen(
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
                    logger.error("❌ Failed to start Redis server")
                    return False
                
                logger.info("✅ Redis server started")
            else:
                logger.info("✅ Redis server is already running")
        except Exception as e:
            logger.error(f"❌ Error starting Redis: {e}")
            return False
    
    # Start the gesture system if needed
    if "gesture" in services_to_start:
        logger.info("Starting gesture system...")
        try:
            # Start the gesture system in a separate process
            subprocess.Popen(
                [sys.executable, "start_gesture_system.py", "--no-browser"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for the gesture system to start
            time.sleep(5)
            
            # Check if the gesture system is running
            ws_port = os.environ.get("ALEJO_WEBSOCKET_PORT", "8765")
            result = subprocess.run(
                ["curl", "-f", f"http://localhost:{ws_port}/health"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            if result.returncode == 0:
                logger.info("✅ Gesture system started successfully")
            else:
                logger.warning("⚠️ Gesture system may not have started correctly")
        except Exception as e:
            logger.error(f"❌ Error starting gesture system: {e}")
            # Don't return False here, as the gesture system is optional
    
    # Start the main ALEJO system
    logger.info("Starting main ALEJO system...")
    try:
        subprocess.Popen(
            [sys.executable, "run_alejo.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for the web server to start
        time.sleep(5)
        
        # Check if the web server is running
        web_port = os.environ.get("ALEJO_WEB_PORT", "8000")
        result = subprocess.run(
            ["curl", "-f", f"http://localhost:{web_port}/health"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if result.returncode == 0:
            logger.info("✅ ALEJO web server started successfully")
            return True
        else:
            logger.error("❌ ALEJO web server failed to start")
            return False
    except Exception as e:
        logger.error(f"❌ Error starting ALEJO system: {e}")
        return False


def wait_for_service_health(health_check_cmd, timeout=30):
    """Wait for a service to become healthy."""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            result = subprocess.run(
                health_check_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False
            )
            
            if result.returncode == 0:
                return True
        except Exception:
            pass
        
        time.sleep(1)
    
    return False


def open_browser(web_port):
    """Open the browser to the ALEJO interface."""
    import webbrowser
    
    # Open the main interface
    main_url = f"http://localhost:{web_port}"
    logger.info(f"Opening browser to {main_url}")
    webbrowser.open(main_url)
    
    # Also open the gesture interface
    if os.environ.get("ALEJO_GESTURE_ENABLED") == "true":
        gesture_url = f"http://localhost:{web_port}/gestures"
        logger.info(f"Opening browser to gesture interface: {gesture_url}")
        webbrowser.open_new_tab(gesture_url)


async def validate_deployment(web_port, ws_port):
    """Validate that the deployment is working correctly."""
    logger.info("Validating deployment...")
    
    try:
        # Import the validation module
        from validate_gesture_deployment import GestureSystemValidator
        
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
    except ImportError:
        logger.error("❌ Validation module not found. Make sure validate_gesture_deployment.py exists.")
        return False
    except Exception as e:
        logger.error(f"❌ Error during validation: {e}")
        return False


async def main():
    """Main entry point."""
    args = parse_arguments()
    
    logger.info("=" * 50)
    logger.info("ALEJO PRODUCTION STARTUP WITH GESTURE SYSTEM")
    logger.info("=" * 50)
    
    # Check for updates before starting services
    if UPDATE_MANAGER_AVAILABLE and not args.skip_updates:
        logger.info("Checking for ALEJO updates...")
        try:
            update_manager = UpdateManager()
            update_success = update_manager.run_update_check(auto_apply=True)
            if not update_success:
                logger.error("Update process encountered errors. Starting with current version.")
            else:
                logger.info("Update check completed successfully.")
        except Exception as e:
            logger.error(f"Error during update process: {str(e)}")
            logger.info("Continuing with current version...")
    
    # Set up environment
    setup_environment(args)
    
    # Determine which services to start
    services_to_start = []
    if "all" in args.services:
        services_to_start = list(SERVICES.keys())
    else:
        services_to_start = args.services
    
    # Remove gesture service if --no-gesture is specified
    if args.no_gesture and "gesture" in services_to_start:
        services_to_start.remove("gesture")
    
    # Start services
    success = False
    if args.mode == "docker":
        success = start_docker_services(services_to_start)
    else:
        success = start_local_services(services_to_start)
    
    if not success:
        logger.error("Failed to start ALEJO services. Please check the logs for details.")
        return 1
    
    # Display access information
    web_port = args.web_port
    ws_port = args.ws_port
    
    logger.info("=" * 50)
    logger.info("ALEJO SYSTEM STARTED SUCCESSFULLY")
    logger.info("=" * 50)
    logger.info(f"Web Interface:     http://localhost:{web_port}")
    
    if not args.no_gesture:
        logger.info(f"Gesture Interface: http://localhost:{web_port}/gestures")
        logger.info(f"WebSocket Server:  ws://localhost:{ws_port}")
    
    logger.info("=" * 50)
    
    # Open browser if requested
    if not args.no_browser:
        open_browser(web_port)
    
    # Validate deployment if requested
    if args.validate and not args.no_gesture:
        await validate_deployment(web_port, ws_port)
    
    # Keep the script running to maintain log output
    try:
        while True:
            await asyncio.sleep(3600)  # Sleep for an hour
    except asyncio.CancelledError:
        logger.info("Main task cancelled")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Startup interrupted by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)