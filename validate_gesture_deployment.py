#!/usr/bin/env python3
"""
ALEJO Gesture System Deployment Validation Script
Validates that all components of the gesture system are properly deployed and functioning
"""
import argparse
import asyncio
import json
import logging
import os
import sys
import time
import aiohttp
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

logger = logging.getLogger("gesture_validation")

# Default URLs and endpoints
DEFAULT_WS_URL = "ws://localhost:8765"
DEFAULT_WEB_URL = "http://localhost:8000"
DEFAULT_REDIS_URL = "redis://localhost:6379/0"


class GestureSystemValidator:
    """Validates the ALEJO gesture system deployment."""
    
    def __init__(self, ws_url=DEFAULT_WS_URL, web_url=DEFAULT_WEB_URL, redis_url=DEFAULT_REDIS_URL):
        """Initialize the validator with the given URLs."""
        self.ws_url = ws_url
        self.web_url = web_url
        self.redis_url = redis_url
        self.validation_results = {
            "websocket_server": False,
            "web_server": False,
            "redis_connection": False,
            "gesture_endpoint": False,
            "static_files": False,
            "websocket_communication": False
        }
    
    async def validate_web_server(self):
        """Validate that the web server is running."""
        logger.info(f"Validating web server at {self.web_url}...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.web_url}/health", timeout=5) as response:
                    if response.status == 200:
                        logger.info("✅ Web server is running")
                        self.validation_results["web_server"] = True
                        return True
                    else:
                        logger.error(f"❌ Web server returned status {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ Error connecting to web server: {e}")
            return False
    
    async def validate_websocket_server(self):
        """Validate that the WebSocket server is running."""
        logger.info(f"Validating WebSocket server at {self.ws_url}...")
        
        try:
            # Try to connect to the WebSocket server
            async with websockets.connect(self.ws_url, timeout=5) as websocket:
                logger.info("✅ WebSocket server is running")
                self.validation_results["websocket_server"] = True
                return True
        except Exception as e:
            logger.error(f"❌ Error connecting to WebSocket server: {e}")
            return False
    
    async def validate_redis_connection(self):
        """Validate that Redis is running and accessible."""
        logger.info(f"Validating Redis connection at {self.redis_url}...")
        
        try:
            import redis.asyncio as redis
            
            # Connect to Redis
            r = redis.from_url(self.redis_url)
            await r.ping()
            
            # Set a test value
            test_key = "alejo:gesture:validation:test"
            test_value = f"test_{time.time()}"
            await r.set(test_key, test_value)
            
            # Get the test value
            retrieved_value = await r.get(test_key)
            
            # Clean up
            await r.delete(test_key)
            await r.close()
            
            if retrieved_value.decode() == test_value:
                logger.info("✅ Redis connection is working")
                self.validation_results["redis_connection"] = True
                return True
            else:
                logger.error("❌ Redis test value mismatch")
                return False
                
        except ImportError:
            logger.error("❌ Redis module not installed. Install with: pip install redis")
            return False
        except Exception as e:
            logger.error(f"❌ Error connecting to Redis: {e}")
            return False
    
    async def validate_gesture_endpoint(self):
        """Validate that the gesture endpoint is accessible."""
        logger.info(f"Validating gesture endpoint at {self.web_url}/gestures...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.web_url}/gestures", timeout=5) as response:
                    if response.status == 200:
                        # Check that the response contains expected content
                        text = await response.text()
                        if "gesture-area" in text and "gesture-controller.js" in text:
                            logger.info("✅ Gesture endpoint is accessible and contains expected content")
                            self.validation_results["gesture_endpoint"] = True
                            return True
                        else:
                            logger.error("❌ Gesture endpoint response does not contain expected content")
                            return False
                    else:
                        logger.error(f"❌ Gesture endpoint returned status {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ Error accessing gesture endpoint: {e}")
            return False
    
    async def validate_static_files(self):
        """Validate that static files for the gesture system are accessible."""
        logger.info(f"Validating static files at {self.web_url}/static/js/gesture-controller.js...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.web_url}/static/js/gesture-controller.js", timeout=5) as response:
                    if response.status == 200:
                        logger.info("✅ Static files are accessible")
                        self.validation_results["static_files"] = True
                        return True
                    else:
                        logger.error(f"❌ Static files returned status {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ Error accessing static files: {e}")
            return False
    
    async def validate_websocket_communication(self):
        """Validate WebSocket communication by sending a ping and receiving a pong."""
        logger.info(f"Validating WebSocket communication at {self.ws_url}...")
        
        try:
            async with websockets.connect(self.ws_url) as websocket:
                # Send a ping message
                ping_message = {
                    "type": "ping",
                    "timestamp": time.time()
                }
                await websocket.send(json.dumps(ping_message))
                
                # Wait for a response
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                
                # Check that we got a pong response
                if response_data.get("type") == "pong":
                    logger.info("✅ WebSocket communication is working")
                    self.validation_results["websocket_communication"] = True
                    return True
                else:
                    logger.error("❌ WebSocket communication test failed: Did not receive pong response")
                    return False
        except Exception as e:
            logger.error(f"❌ Error in WebSocket communication: {e}")
            return False
    
    async def validate_all(self):
        """Run all validation checks."""
        logger.info("=" * 50)
        logger.info("ALEJO GESTURE SYSTEM DEPLOYMENT VALIDATION")
        logger.info("=" * 50)
        
        # Run all validation checks
        await self.validate_web_server()
        await self.validate_websocket_server()
        await self.validate_redis_connection()
        await self.validate_gesture_endpoint()
        await self.validate_static_files()
        await self.validate_websocket_communication()
        
        # Print summary
        logger.info("=" * 50)
        logger.info("VALIDATION SUMMARY")
        logger.info("=" * 50)
        
        all_passed = True
        for check, result in self.validation_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{status}: {check}")
            if not result:
                all_passed = False
        
        logger.info("=" * 50)
        if all_passed:
            logger.info("✅ ALL CHECKS PASSED! The gesture system is deployed correctly.")
        else:
            logger.info("❌ SOME CHECKS FAILED. Please review the issues above.")
        
        return all_passed


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Validate ALEJO Gesture System Deployment")
    parser.add_argument("--ws-url", default=DEFAULT_WS_URL, help=f"WebSocket URL (default: {DEFAULT_WS_URL})")
    parser.add_argument("--web-url", default=DEFAULT_WEB_URL, help=f"Web server URL (default: {DEFAULT_WEB_URL})")
    parser.add_argument("--redis-url", default=DEFAULT_REDIS_URL, help=f"Redis URL (default: {DEFAULT_REDIS_URL})")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    
    # Create validator with provided URLs
    validator = GestureSystemValidator(
        ws_url=args.ws_url,
        web_url=args.web_url,
        redis_url=args.redis_url
    )
    
    # Run validation
    try:
        success = asyncio.run(validator.validate_all())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Validation interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)
