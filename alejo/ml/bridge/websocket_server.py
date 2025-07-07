"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
WebSocket Bridge Server - Bridge between JavaScript frontend and Python ML models
"""

import os
import sys
import json
import logging
import asyncio
import importlib
import traceback
import websockets
import uuid
from typing import Dict, Any, Optional, List, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("alejo.ml.bridge")

class PythonBridgeServer:
    """
    WebSocket server that bridges JavaScript frontend with Python ML models.
    
    This server allows the frontend to:
    1. Create instances of Python classes
    2. Call methods on those instances
    3. Receive events from Python code
    """
    
    def __init__(self, host: str = 'localhost', port: int = 8765):
        """
        Initialize the bridge server.
        
        Args:
            host: Host to bind the server to
            port: Port to bind the server to
        """
        self.host = host
        self.port = port
        self.instances = {}  # instance_id -> instance
        self.clients = set()
        self.server = None
        
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"Starting Python bridge server on {self.host}:{self.port}")
        self.server = await websockets.serve(self.handle_client, self.host, self.port)
        logger.info("Server started")
        
    async def stop(self):
        """Stop the WebSocket server"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("Server stopped")
            
    async def handle_client(self, websocket, path):
        """
        Handle a WebSocket client connection.
        
        Args:
            websocket: WebSocket connection
            path: Connection path
        """
        client_id = str(uuid.uuid4())
        logger.info(f"New client connected: {client_id}")
        self.clients.add(websocket)
        
        try:
            async for message in websocket:
                try:
                    # Parse the message
                    data = json.loads(message)
                    request_id = data.get('id')
                    method = data.get('method')
                    params = data.get('params', {})
                    
                    # Process the request
                    if method == 'create_instance':
                        result = self.create_instance(params.get('module'), params.get('class_name'))
                    elif method == 'destroy_instance':
                        result = self.destroy_instance(params.get('instance_id'))
                    elif method == 'call_method':
                        result = await self.call_method(
                            params.get('instance_id'),
                            params.get('method'),
                            params.get('args', [])
                        )
                    else:
                        result = {'error': f"Unknown method: {method}"}
                    
                    # Send the response
                    response = {
                        'id': request_id,
                        'result': result
                    }
                    await websocket.send(json.dumps(response))
                    
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON: {message}")
                    await websocket.send(json.dumps({
                        'id': None,
                        'error': 'Invalid JSON'
                    }))
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    logger.error(traceback.format_exc())
                    await websocket.send(json.dumps({
                        'id': data.get('id'),
                        'error': str(e)
                    }))
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_id}")
        finally:
            self.clients.remove(websocket)
            
    def create_instance(self, module_name: str, class_name: str) -> Dict[str, Any]:
        """
        Create an instance of a Python class.
        
        Args:
            module_name: Name of the module to import
            class_name: Name of the class to instantiate
            
        Returns:
            Dictionary with instance ID
        """
        try:
            # Import the module
            module = importlib.import_module(module_name)
            
            # Get the class
            cls = getattr(module, class_name)
            
            # Create an instance
            instance = cls()
            
            # Generate an ID
            instance_id = str(uuid.uuid4())
            
            # Store the instance
            self.instances[instance_id] = instance
            
            logger.info(f"Created instance of {module_name}.{class_name} with ID {instance_id}")
            
            return {
                'success': True,
                'instance_id': instance_id
            }
        except Exception as e:
            logger.error(f"Error creating instance: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
            
    def destroy_instance(self, instance_id: str) -> Dict[str, Any]:
        """
        Destroy an instance.
        
        Args:
            instance_id: ID of the instance to destroy
            
        Returns:
            Dictionary with success status
        """
        if instance_id in self.instances:
            # Call cleanup method if available
            instance = self.instances[instance_id]
            if hasattr(instance, 'cleanup') and callable(instance.cleanup):
                try:
                    instance.cleanup()
                except Exception as e:
                    logger.error(f"Error cleaning up instance {instance_id}: {e}")
            
            # Remove the instance
            del self.instances[instance_id]
            logger.info(f"Destroyed instance {instance_id}")
            
            return {'success': True}
        else:
            return {
                'success': False,
                'error': f"Instance {instance_id} not found"
            }
            
    async def call_method(self, instance_id: str, method_name: str, args: List) -> Dict[str, Any]:
        """
        Call a method on an instance.
        
        Args:
            instance_id: ID of the instance
            method_name: Name of the method to call
            args: Arguments to pass to the method
            
        Returns:
            Dictionary with method result
        """
        if instance_id not in self.instances:
            return {
                'success': False,
                'error': f"Instance {instance_id} not found"
            }
            
        instance = self.instances[instance_id]
        
        if not hasattr(instance, method_name) or not callable(getattr(instance, method_name)):
            return {
                'success': False,
                'error': f"Method {method_name} not found on instance {instance_id}"
            }
            
        try:
            # Get the method
            method = getattr(instance, method_name)
            
            # Call the method
            result = method(*args)
            
            # Handle async methods
            if asyncio.iscoroutine(result):
                result = await result
                
            # Convert numpy arrays to lists for JSON serialization
            result = self._convert_numpy(result)
                
            return result
        except Exception as e:
            logger.error(f"Error calling method {method_name} on instance {instance_id}: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
            
    def _convert_numpy(self, obj):
        """
        Convert numpy arrays to lists for JSON serialization.
        
        Args:
            obj: Object to convert
            
        Returns:
            Converted object
        """
        import numpy as np
        
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.generic):
            return obj.item()
        elif isinstance(obj, dict):
            return {k: self._convert_numpy(v) for k, v in obj.items()}
        elif isinstance(obj, list) or isinstance(obj, tuple):
            return [self._convert_numpy(item) for item in obj]
        else:
            return obj
            
    async def send_event(self, event: str, data: Dict[str, Any] = None):
        """
        Send an event to all connected clients.
        
        Args:
            event: Event name
            data: Event data
        """
        message = {
            'type': 'event',
            'event': event,
            'data': data or {}
        }
        
        json_message = json.dumps(message)
        
        await asyncio.gather(*[
            client.send(json_message)
            for client in self.clients
        ])

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ALEJO Python Bridge Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to bind to')
    args = parser.parse_args()
    
    # Create and start the server
    server = PythonBridgeServer(args.host, args.port)
    
    # Set up event loop
    loop = asyncio.get_event_loop()
    
    try:
        # Start the server
        loop.run_until_complete(server.start())
        
        # Run forever
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        # Stop the server
        loop.run_until_complete(server.stop())
        loop.close()

if __name__ == '__main__':
    main()
