#!/usr/bin/env python
"""
ALEJO ML Bridge WebSocket Server Launcher

This script starts the WebSocket server that bridges JavaScript frontend
and Python ML models for ALEJO's gesture recognition system.

Usage:
    python start_server.py [--port PORT] [--host HOST] [--debug]

Options:
    --port PORT     Port to run the server on (default: 8765)
    --host HOST     Host to bind the server to (default: localhost)
    --debug         Enable debug logging
"""

import os
import sys
import argparse
import logging
import signal
import asyncio
from websocket_server import WebSocketServer

# Configure logging
def setup_logging(debug=False):
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger('alejo.ml.bridge')

# Signal handler for graceful shutdown
def signal_handler(sig, frame):
    print("\nShutting down ALEJO ML Bridge WebSocket Server...")
    if hasattr(signal_handler, 'loop') and hasattr(signal_handler, 'server'):
        signal_handler.loop.create_task(signal_handler.server.shutdown())
    else:
        sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description='ALEJO ML Bridge WebSocket Server')
    parser.add_argument('--port', type=int, default=8765, help='Port to run the server on')
    parser.add_argument('--host', type=str, default='localhost', help='Host to bind the server to')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    logger = setup_logging(args.debug)
    logger.info(f"Starting ALEJO ML Bridge WebSocket Server on {args.host}:{args.port}")
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the server
    try:
        loop = asyncio.get_event_loop()
        server = WebSocketServer(args.host, args.port, loop=loop)
        
        # Store references for signal handler
        signal_handler.loop = loop
        signal_handler.server = server
        
        # Run the server
        loop.run_until_complete(server.start())
        loop.run_forever()
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)
    finally:
        logger.info("Server shutdown complete")
        loop.close()

if __name__ == "__main__":
    main()
