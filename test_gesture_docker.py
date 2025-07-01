#!/usr/bin/env python3
"""
ALEJO Gesture System Docker Integration Test Script
Tests the gesture system components in a Docker Compose environment
"""
import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
import time
import websockets
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("gesture_docker_test")

# Default WebSocket URL
DEFAULT_WS_URL = "ws://localhost:8765"
DEFAULT_HEALTH_URL = "http://localhost:8765/health"
DEFAULT_WEB_URL = "http://localhost:8000/gestures"

# Test gestures to send
TEST_GESTURES = [
    {
        "type": "gesture",
        "gesture": "swipe",
        "direction": "left",
        "timestamp": None  # Will be set at runtime
    },
    {
        "type": "gesture",
        "gesture": "tap",
        "position": {"x": 100, "y": 100},
        "timestamp": None  # Will be set at runtime
    }
]


def check_docker_running():
    """Check if Docker is running and available."""
    try:
        result = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False
        )
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Error checking Docker status: {e}")
        return False


def check_docker_compose_file():
    """Check if docker-compose.yml exists and contains gesture_websocket service."""
    docker_compose_path = Path("docker-compose.yml")
    
    if not docker_compose_path.exists():
        logger.error("docker-compose.yml not found")
        return False
    
    try:
        with open(docker_compose_path, "r") as f:
            content = f.read()
            if "gesture_websocket" not in content:
                logger.error("gesture_websocket service not found in docker-compose.yml")
                return False
            return True
    except Exception as e:
        logger.error(f"Error reading docker-compose.yml: {e}")
        return False


def start_gesture_services():
    """Start the gesture WebSocket service using Docker Compose."""
    logger.info("Starting gesture WebSocket service...")
    
    try:
        # Start Redis and gesture_websocket services
        subprocess.run(
            ["docker-compose", "up", "-d", "redis", "gesture_websocket"],
            check=True
        )
        
        # Wait for services to be ready
        time.sleep(5)
        
        # Check if services are running
        result = subprocess.run(
            ["docker-compose", "ps", "gesture_websocket"],
            stdout=subprocess.PIPE,
            text=True,
            check=True
        )
        
        if "Up" in result.stdout:
            logger.info("✅ Gesture WebSocket service is running")
            return True
        else:
            logger.error("❌ Gesture WebSocket service failed to start")
            return False
            
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Error starting services: {e}")
        return False


def stop_gesture_services():
    """Stop the gesture WebSocket service."""
    logger.info("Stopping gesture WebSocket service...")
    
    try:
        subprocess.run(
            ["docker-compose", "stop", "gesture_websocket"],
            check=True
        )
        logger.info("✅ Gesture WebSocket service stopped")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Error stopping services: {e}")
        return False


async def check_health_endpoint(url=DEFAULT_HEALTH_URL):
    """Check if the health endpoint is responding."""
    import aiohttp
    
    logger.info(f"Checking health endpoint at {url}...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=5) as response:
                if response.status == 200:
                    logger.info("✅ Health endpoint is responding")
                    return True
                else:
                    logger.error(f"❌ Health endpoint returned status {response.status}")
                    return False
    except Exception as e:
        logger.error(f"❌ Error checking health endpoint: {e}")
        return False


async def test_websocket_connection(url=DEFAULT_WS_URL):
    """Test the WebSocket connection to the gesture handler."""
    logger.info(f"Testing WebSocket connection to {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            # Send a ping message
            ping_message = {
                "type": "ping",
                "timestamp": time.time()
            }
            logger.info(f"Sending: {ping_message}")
            await websocket.send(json.dumps(ping_message))
            
            # Wait for a response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            logger.info(f"Received: {response_data}")
            
            # Check that we got a pong response
            if response_data.get("type") == "pong":
                logger.info("✅ Ping test successful!")
                return True
            else:
                logger.error("❌ Ping test failed: Did not receive pong response")
                return False
                
    except (websockets.exceptions.ConnectionError, asyncio.TimeoutError) as e:
        logger.error(f"❌ Connection test failed: {e}")
        return False


async def test_gesture_events(url=DEFAULT_WS_URL):
    """Test sending gesture events to the WebSocket handler."""
    logger.info(f"Testing gesture events on {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            success_count = 0
            
            for gesture in TEST_GESTURES:
                # Update the timestamp
                gesture["timestamp"] = time.time()
                
                # Send the gesture
                logger.info(f"Sending gesture: {gesture['gesture']}")
                await websocket.send(json.dumps(gesture))
                
                # Wait for a response
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                logger.info(f"Received: {response_data}")
                
                # Check that we got an acknowledgment
                if response_data.get("type") == "ack" and response_data.get("gesture") == gesture["gesture"]:
                    logger.info(f"✅ {gesture['gesture']} gesture test successful!")
                    success_count += 1
                else:
                    logger.error(f"❌ {gesture['gesture']} gesture test failed")
            
            logger.info(f"Gesture tests completed: {success_count}/{len(TEST_GESTURES)} successful")
            return success_count == len(TEST_GESTURES)
                
    except (websockets.exceptions.ConnectionError, asyncio.TimeoutError) as e:
        logger.error(f"❌ Gesture test failed: {e}")
        return False


async def run_tests():
    """Run all tests for the gesture system in Docker environment."""
    logger.info("=" * 50)
    logger.info("ALEJO GESTURE SYSTEM DOCKER INTEGRATION TEST")
    logger.info("=" * 50)
    
    # Check Docker prerequisites
    if not check_docker_running():
        logger.error("Docker is not running. Please start Docker and try again.")
        return False
    
    if not check_docker_compose_file():
        logger.error("Docker Compose file check failed. Please verify your docker-compose.yml file.")
        return False
    
    # Start services
    if not start_gesture_services():
        logger.error("Failed to start gesture services. Aborting tests.")
        return False
    
    try:
        # Check health endpoint
        health_ok = await check_health_endpoint()
        if not health_ok:
            logger.warning("Health endpoint check failed, but continuing with tests...")
        
        # Test WebSocket connection
        connection_ok = await test_websocket_connection()
        if not connection_ok:
            logger.error("WebSocket connection test failed. Make sure the gesture WebSocket handler is running.")
            return False
        
        # Test gesture events
        gestures_ok = await test_gesture_events()
        if not gestures_ok:
            logger.error("Gesture events test failed. Check the gesture handler logs for details.")
            return False
        
        logger.info("=" * 50)
        logger.info("✅ All tests passed! The gesture system is working correctly in Docker.")
        logger.info("=" * 50)
        logger.info(f"You can access the gesture interface at: {DEFAULT_WEB_URL}")
        return True
        
    finally:
        # Stop services
        stop_gesture_services()


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Test ALEJO Gesture System in Docker environment")
    parser.add_argument("--ws-url", default=DEFAULT_WS_URL, help=f"WebSocket URL (default: {DEFAULT_WS_URL})")
    parser.add_argument("--health-url", default=DEFAULT_HEALTH_URL, help=f"Health endpoint URL (default: {DEFAULT_HEALTH_URL})")
    parser.add_argument("--no-cleanup", action="store_true", help="Don't stop services after testing")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    
    # Update default URLs if provided
    DEFAULT_WS_URL = args.ws_url
    DEFAULT_HEALTH_URL = args.health_url
    
    # Run the tests
    try:
        success = asyncio.run(run_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Test interrupted by user.")
        if not args.no_cleanup:
            stop_gesture_services()
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        if not args.no_cleanup:
            stop_gesture_services()
        sys.exit(1)