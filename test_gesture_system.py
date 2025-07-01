#!/usr/bin/env python3
"""
ALEJO Gesture System Test Script
Provides a simple way to test the gesture system locally
"""
import asyncio
import json
import logging
import os
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

logger = logging.getLogger("gesture_test")

# Default WebSocket URL
DEFAULT_WS_URL = "ws://localhost:8765"

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
    },
    {
        "type": "gesture",
        "gesture": "pinch",
        "scale": 0.5,
        "timestamp": None  # Will be set at runtime
    },
    {
        "type": "gesture",
        "gesture": "rotate",
        "angle": 45,
        "timestamp": None  # Will be set at runtime
    }
]


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
    """Run all tests for the gesture system."""
    logger.info("=" * 50)
    logger.info("ALEJO GESTURE SYSTEM TEST")
    logger.info("=" * 50)
    
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
    logger.info("✅ All tests passed! The gesture system is working correctly.")
    logger.info("=" * 50)
    return True


def print_usage():
    """Print usage instructions."""
    print(f"""
ALEJO Gesture System Test Script
================================

Usage: python {sys.argv[0]} [options]

Options:
  --help          Show this help message and exit
  --url=URL       WebSocket URL to connect to (default: {DEFAULT_WS_URL})

Example:
  python {sys.argv[0]} --url=ws://localhost:8765
""")


if __name__ == "__main__":
    # Parse command line arguments
    ws_url = DEFAULT_WS_URL
    
    for arg in sys.argv[1:]:
        if arg == "--help":
            print_usage()
            sys.exit(0)
        elif arg.startswith("--url="):
            ws_url = arg.split("=", 1)[1]
    
    # Run the tests
    try:
        success = asyncio.run(run_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Test interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)
