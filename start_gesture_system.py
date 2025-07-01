#!/usr/bin/env python3
"""
ALEJO Gesture System Startup Script
Launches the ALEJO system with gesture interface enabled
"""
import os
import sys
import logging
import argparse
import asyncio
import signal
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_gesture_system.log')
    ]
)

logger = logging.getLogger(__name__)

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="ALEJO Gesture System Launcher")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind the web server to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the web server to")
    parser.add_argument("--ws-port", type=int, default=8765, help="Port for WebSocket server")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    return parser.parse_args()

def setup_environment():
    """Load environment variables and set defaults for gesture system."""
    # Load from .env file if it exists
    env_path = Path('.env')
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded environment from .env file")
    else:
        logger.warning(".env file not found, using default settings")
    
    # Set required environment variables for gesture system
    os.environ['ALEJO_GESTURE_ENABLED'] = os.environ.get('ALEJO_GESTURE_ENABLED', 'true')
    os.environ['ALEJO_WEBSOCKET_PORT'] = os.environ.get('ALEJO_WEBSOCKET_PORT', '8765')
    os.environ['ALEJO_ACCESSIBILITY_LEVEL'] = os.environ.get('ALEJO_ACCESSIBILITY_LEVEL', 'enhanced')
    os.environ['ALEJO_LOCAL_INFERENCE'] = os.environ.get('ALEJO_LOCAL_INFERENCE', '1')

async def start_gesture_websocket(ws_port):
    """Start the gesture WebSocket handler."""
    logger.info(f"Starting gesture WebSocket handler on port {ws_port}")
    
    # Import the gesture WebSocket handler module
    try:
        from alejo.handlers.gesture_websocket_handler import start_gesture_websocket_server
        
        # Start the WebSocket server
        await start_gesture_websocket_server(port=ws_port)
    except ImportError:
        logger.error("Failed to import gesture WebSocket handler. Make sure it's properly installed.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to start gesture WebSocket handler: {e}", exc_info=True)
        sys.exit(1)

async def start_web_server(host, port):
    """Start the ALEJO web server."""
    logger.info(f"Starting ALEJO web server on {host}:{port}")
    
    try:
        from alejo.web import start_web_interface
        from alejo.brain.alejo_brain import AlejoBrain
        
        # Initialize the brain
        brain = AlejoBrain()
        
        # Start the web interface
        runner = await start_web_interface(brain, host=host, port=port)
        if not runner:
            logger.error("Failed to start web interface")
            return None
        
        return runner
    except ImportError:
        logger.error("Failed to import required modules. Make sure ALEJO is properly installed.")
        return None
    except Exception as e:
        logger.error(f"Failed to start web server: {e}", exc_info=True)
        return None

def open_browser(url):
    """Open the browser to the gesture interface."""
    import webbrowser
    import time
    
    logger.info(f"Opening browser to {url}")
    time.sleep(2)  # Give the server a moment to start
    webbrowser.open(url)

async def main():
    """Main entry point for the gesture system launcher."""
    args = parse_arguments()
    setup_environment()
    
    # Start the web server
    web_runner = await start_web_server(args.host, args.port)
    if not web_runner:
        logger.error("Failed to start web server. Exiting.")
        return
    
    # Start the gesture WebSocket handler in a separate task
    websocket_task = asyncio.create_task(start_gesture_websocket(args.ws_port))
    
    # Open browser if requested
    if not args.no_browser:
        gesture_url = f"http://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.port}/gestures"
        open_browser(gesture_url)
    
    # Display access information
    logger.info("=" * 50)
    logger.info("ALEJO GESTURE SYSTEM")
    logger.info("=" * 50)
    logger.info(f"Web Interface:     http://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.port}")
    logger.info(f"Gesture Interface: http://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.port}/gestures")
    logger.info(f"WebSocket Server:  ws://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.ws_port}")
    logger.info("=" * 50)
    
    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_running_loop()
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown(web_runner, websocket_task)))
    
    try:
        # Keep the main task running
        while True:
            await asyncio.sleep(3600)  # Sleep for an hour
    except asyncio.CancelledError:
        logger.info("Main task cancelled")

async def shutdown(web_runner, websocket_task):
    """Gracefully shut down all services."""
    logger.info("Shutting down ALEJO gesture system...")
    
    # Cancel the WebSocket task
    if websocket_task and not websocket_task.done():
        websocket_task.cancel()
        try:
            await websocket_task
        except asyncio.CancelledError:
            logger.info("WebSocket server shut down")
    
    # Clean up the web runner
    if web_runner:
        await web_runner.cleanup()
        logger.info("Web server shut down")
    
    # Exit the program
    asyncio.get_event_loop().stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt. Exiting.")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)
