"""
ALEJO Web Module (aiohttp-based)
Provides asynchronous web interface capabilities for ALEJO
"""

import logging
import asyncio
from aiohttp import web

__all__ = ['start_web_interface']

logger = logging.getLogger("alejo.web")

# Default HTML template for the web interface
DEFAULT_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALEJO - Advanced Language and Execution Jarvis Operator</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #000;
            color: #00FFFF;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .container {
            position: relative;
            width: 100%;
            max-width: 800px;
            text-align: center;
        }
        h1 {
            font-size: 48px;
            margin-bottom: 10px;
            text-shadow: 0 0 10px #00FFFF;
        }
        /* p tag for subtitle was here, removed as per user request */
        .circle {
            position: absolute;
            border: 2px solid #00FFFF;
            border-radius: 50%;
            opacity: 0.7;
        }
        #circle1 { width: 200px; height: 200px; animation: pulse 4s infinite; }
        #circle2 { width: 300px; height: 300px; animation: pulse 6s infinite; }
        #circle3 { width: 400px; height: 400px; animation: pulse 8s infinite; }
        #circle4 { width: 500px; height: 500px; animation: pulse 10s infinite; }
        #circle5 { width: 600px; height: 600px; animation: pulse 12s infinite; }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.05); opacity: 0.5; }
            100% { transform: scale(1); opacity: 0.7; }
        }
        
        .content {
            position: relative;
            z-index: 10;
        }
        
        .chat-container {
            width: 100%;
            max-width: 600px;
            background-color: rgba(0, 0, 0, 0.7);
            border: 1px solid #00FFFF;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .chat-messages {
            height: 300px;
            overflow-y: auto;
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #00FFFF;
            border-radius: 5px;
            text-align: left;
        }
        
        .chat-input {
            display: flex;
        }
        
        .chat-input input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid #00FFFF;
            background-color: rgba(0, 0, 0, 0.5);
            color: #00FFFF;
            border-radius: 5px 0 0 5px;
        }
        
        .chat-input button {
            padding: 10px 20px;
            background-color: #00FFFF;
            color: #000;
            border: none;
            border-radius: 0 5px 5px 0;
            cursor: pointer;
        }
        
        .user-message {
            color: white;
            margin-bottom: 10px;
        }
        
        .alejo-message {
            color: #00FFFF;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="circle" id="circle1" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div class="circle" id="circle2" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div class="circle" id="circle3" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div class="circle" id="circle4" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div class="circle" id="circle5" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        
        <div class="content">
            <h1>A.L.E.J.O.</h1>
            
            <div class="chat-container">
                <div class="chat-messages" id="chat-messages">
                    <div class="alejo-message">Welcome sir, I am Ah-lay-ho. Always learning, evolving, Jarvis, operations. How can I help?</div>
                </div>
                <div class="chat-input">
                    <input type="text" id="user-input" placeholder="Type your message...">
                    <button onclick="sendMessage()">Send</button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        async function sendMessage() {
            const userInput = document.getElementById('user-input');
            const chatMessages = document.getElementById('chat-messages');
            const userQuery = userInput.value.trim();
            
            if (userQuery !== '') {
                const userMessageDiv = document.createElement('div');
                userMessageDiv.className = 'user-message';
                userMessageDiv.textContent = 'You: ' + userQuery;
                chatMessages.appendChild(userMessageDiv);
                userInput.value = '';
                
                try {
                    const response = await fetch('/api/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: userQuery })
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    
                    const alejoMessageDiv = document.createElement('div');
                    alejoMessageDiv.className = 'alejo-message';
                    alejoMessageDiv.textContent = 'ALEJO: ' + (data.response || "Sorry, I couldn't process that.");
                    chatMessages.appendChild(alejoMessageDiv);

                } catch (error) {
                    console.error('Error sending/receiving message:', error);
                    const alejoMessageDiv = document.createElement('div');
                    alejoMessageDiv.className = 'alejo-message';
                    alejoMessageDiv.textContent = 'ALEJO: Error communicating with server.';
                    chatMessages.appendChild(alejoMessageDiv);
                } finally {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        }
        
        document.getElementById('user-input').addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
"""

async def handle_index(request):
    """Serve the main HTML page."""
    return web.Response(text=DEFAULT_HTML, content_type='text/html')

async def handle_api_query(request):
    """Handle API queries to ALEJO's brain."""
    try:
        data = await request.json()
        query = data.get('query')
        if not query:
            logger.warning("API query request received without a 'query' field.")
            return web.json_response({'error': 'Query not provided'}, status=400)

        brain = request.app['alejo_brain']
        logger.info(f"Processing API query: '{query}'")
        
        # In a truly async application, brain.process_command would ideally be async
        # or run in a thread pool executor if it's CPU-bound.
        # For now, we call it directly, assuming it's not excessively blocking.
        response_text = brain.process_command(query)
        logger.info(f"API query response: '{response_text}'")
        
        return web.json_response({'response': response_text})
    except Exception as e:
        logger.error(f"Error processing API query: {e}", exc_info=True)
        return web.json_response({'error': 'Internal server error while processing query.'}, status=500)

async def handle_health(request):
    """Serve a health check endpoint."""
    return web.json_response({'status': 'ok'})

async def start_web_interface(brain, host='0.0.0.0', port=5000, config=None, test_mode=False):
    """
    Start the ALEJO web interface using aiohttp.
    
    Args:
        brain: ALEJO brain instance.
        host: Host to bind the web server to (default: '0.0.0.0').
        port: Port to bind the web server to (default: 5000).
        config: Optional configuration dictionary.
        test_mode: If True, initialize without starting actual web server.
        
    Returns:
        aiohttp.web.AppRunner instance if successful, None otherwise.
    """
    config = config or {}
    # Use the explicitly passed host and port parameters instead of config values
    # This ensures command-line arguments take precedence

    app = web.Application()
    app['alejo_brain'] = brain # Make brain accessible to handlers

    app.router.add_get('/', handle_index)
    app.router.add_post('/api/query', handle_api_query)
    app.router.add_get('/health', handle_health)

    runner = web.AppRunner(app)
    
    if test_mode:
        logger.info(f"Web interface initialized in test mode (no server started)")
        return runner
    
    try:
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        logger.info(f"aiohttp web server started successfully at http://{host}:{port}")
        return runner # Return the runner for cleanup
    except OSError as e: # Specific error for port already in use, etc.
        logger.error(f"Failed to start aiohttp web server on {host}:{port}. OSError: {e}", exc_info=True)
        await runner.cleanup() # Cleanup any resources allocated by AppRunner
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while starting aiohttp web server on {host}:{port}: {e}", exc_info=True)
        await runner.cleanup()
        return None
