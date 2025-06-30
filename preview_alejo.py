#!/usr/bin/env python3
"""
ALEJO Preview Server

This script starts a web server to preview ALEJO with the new startup sequence.
It provides a secure way to run ALEJO locally while allowing controlled internet access
for self-improvement capabilities.
"""

import os
import sys
import logging
import argparse
import asyncio
import webbrowser
import threading
import time
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_preview.log')
    ]
)

logger = logging.getLogger(__name__)

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Create FastAPI app
app = FastAPI(title="ALEJO Preview", description="Preview server for ALEJO")

# Create templates directory if it doesn't exist
templates_dir = Path("templates")
templates_dir.mkdir(exist_ok=True)

# Create static directory if it doesn't exist
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)

# Set up templates
templates = Jinja2Templates(directory="templates")

# Create a simple HTML template for the preview
with open(templates_dir / "index.html", "w") as f:
    f.write("""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALEJO Preview</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #000;
            color: #00FFFF;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .container {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            text-shadow: 0 0 10px #00FFFF;
        }
        .subtitle {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #CCCCCC;
        }
        .startup-btn {
            background-color: transparent;
            color: #00FFFF;
            border: 2px solid #00FFFF;
            padding: 12px 24px;
            font-size: 1.2rem;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 20px;
        }
        .startup-btn:hover {
            background-color: rgba(0, 255, 255, 0.2);
            box-shadow: 0 0 15px #00FFFF;
        }
        .status {
            margin-top: 20px;
            font-size: 1.1rem;
            color: #CCCCCC;
        }
        .circle {
            width: 300px;
            height: 300px;
            border-radius: 50%;
            border: 2px solid #00FFFF;
            position: absolute;
            opacity: 0;
            z-index: -1;
        }
        .pulse {
            animation: pulse 4s infinite;
        }
        @keyframes pulse {
            0% {
                transform: scale(0.8);
                opacity: 0.3;
            }
            50% {
                transform: scale(1.2);
                opacity: 0.1;
            }
            100% {
                transform: scale(0.8);
                opacity: 0.3;
            }
        }
        .console {
            background-color: #111;
            border: 1px solid #333;
            padding: 10px;
            font-family: monospace;
            width: 80%;
            height: 200px;
            overflow-y: auto;
            margin-top: 20px;
            color: #00FF00;
        }
        .console p {
            margin: 0;
            padding: 2px 0;
        }
        .loading {
            display: none;
            margin-top: 20px;
        }
        .loading:after {
            content: '.';
            animation: dots 1.5s steps(5, end) infinite;
        }
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60% { content: '...'; }
            80%, 100% { content: ''; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="circle pulse"></div>
        <h1>A.L.E.J.O.</h1>
        <div class="subtitle">Defender | Helper | Protector of Mankind</div>
        
        <button id="startupBtn" class="startup-btn">Initiate Startup Sequence</button>
        
        <div id="loading" class="loading">Initializing ALEJO</div>
        
        <div id="status" class="status"></div>
        
        <div id="console" class="console">
            <p>> ALEJO Preview Server initialized</p>
            <p>> Ready to start...</p>
        </div>
    </div>

    <script>
        const startupBtn = document.getElementById('startupBtn');
        const loading = document.getElementById('loading');
        const status = document.getElementById('status');
        const consoleElem = document.getElementById('console');
        
        let socket;
        
        function addConsoleMessage(message) {
            const p = document.createElement('p');
            p.textContent = '> ' + message;
            consoleElem.appendChild(p);
            consoleElem.scrollTop = consoleElem.scrollHeight;
        }
        
        startupBtn.addEventListener('click', () => {
            startupBtn.disabled = true;
            loading.style.display = 'block';
            status.textContent = 'Connecting to ALEJO...';
            
            // Connect to WebSocket
            socket = new WebSocket(`ws://${window.location.host}/ws`);
            
            socket.onopen = () => {
                addConsoleMessage('WebSocket connection established');
                socket.send(JSON.stringify({action: 'start_alejo'}));
            };
            
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'status') {
                    status.textContent = data.message;
                    addConsoleMessage(data.message);
                }
                
                if (data.type === 'complete') {
                    loading.style.display = 'none';
                    status.textContent = 'ALEJO is ready!';
                    startupBtn.textContent = 'Restart ALEJO';
                    startupBtn.disabled = false;
                }
            };
            
            socket.onclose = () => {
                addConsoleMessage('WebSocket connection closed');
                loading.style.display = 'none';
                startupBtn.disabled = false;
            };
            
            socket.onerror = (error) => {
                addConsoleMessage('WebSocket error: ' + error);
                loading.style.display = 'none';
                startupBtn.disabled = false;
            };
        });
    </script>
</body>
</html>
    """)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# WebSocket connections
active_connections = []

@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    """Serve the main page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("action") == "start_alejo":
                # Start ALEJO in a separate thread
                threading.Thread(
                    target=start_alejo_process,
                    args=(websocket,),
                    daemon=True
                ).start()
                
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def send_status(websocket, message):
    """Send a status message to the client"""
    await websocket.send_json({"type": "status", "message": message})

async def send_complete(websocket):
    """Send a completion message to the client"""
    await websocket.send_json({"type": "complete"})

def start_alejo_process(websocket):
    """Start the ALEJO process"""
    asyncio.run(alejo_startup_sequence(websocket))

async def alejo_startup_sequence(websocket):
    """Run the ALEJO startup sequence"""
    try:
        # Import the startup sequence
        from alejo.ui.startup_sequence import run_startup_sequence
        
        # Send status updates
        await send_status(websocket, "Initializing ALEJO core systems...")
        await asyncio.sleep(1)
        
        await send_status(websocket, "Loading neural networks...")
        await asyncio.sleep(1)
        
        await send_status(websocket, "Calibrating emotional intelligence...")
        await asyncio.sleep(1)
        
        await send_status(websocket, "Starting self-evolution manager...")
        await asyncio.sleep(1)
        
        await send_status(websocket, "Launching startup sequence...")
        
        # Run the actual startup sequence
        try:
            await run_startup_sequence()
            await send_status(websocket, "Startup sequence completed successfully")
        except Exception as e:
            logger.error(f"Error in startup sequence: {e}", exc_info=True)
            await send_status(websocket, f"Error in startup sequence: {str(e)}")
        
        # Send completion message
        await send_complete(websocket)
        
    except Exception as e:
        logger.error(f"Error starting ALEJO: {e}", exc_info=True)
        await send_status(websocket, f"Error: {str(e)}")
        await send_complete(websocket)

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='ALEJO Preview Server')
    parser.add_argument('--port', type=int, default=8080, help='Web server port (default: 8080)')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Web server host (default: 127.0.0.1)')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    return parser.parse_args()

def open_browser(url):
    """Open the web browser after a short delay"""
    def _open_browser():
        logger.info(f"Opening browser at {url}")
        webbrowser.open(url)
        
    threading.Timer(2.0, _open_browser).start()

def main():
    """Main entry point"""
    args = parse_arguments()
    
    # Set log level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug mode enabled")
    
    # Start the web server
    url = f"http://{args.host}:{args.port}"
    logger.info(f"Starting ALEJO Preview Server at {url}")
    
    # Open browser if not disabled
    if not args.no_browser:
        open_browser(url)
    
    # Start Uvicorn server
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
