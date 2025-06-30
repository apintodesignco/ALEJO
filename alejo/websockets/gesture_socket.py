"""
Gesture WebSocket Handler for ALEJO

This module provides WebSocket communication for gesture recognition,
connecting the client-side gesture detection with the backend gesture integration.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional, List, Set

import websockets
from websockets.server import WebSocketServerProtocol

from ..ui.gesture_integration import GestureIntegration
from ..events.event_bus import EventBus
from ..config.config_manager import ConfigManager

logger = logging.getLogger(__name__)


class GestureWebSocketHandler:
    """
    WebSocket handler for gesture recognition and communication
    
    This class:
    1. Manages WebSocket connections from clients
    2. Processes incoming gesture events
    3. Forwards events to the GestureIntegration module
    4. Sends UI updates and feedback to connected clients
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None, 
                 config_manager: Optional[ConfigManager] = None):
        """
        Initialize the gesture WebSocket handler
        
        Args:
            event_bus: Event bus for publishing and subscribing to events
            config_manager: Configuration manager for settings
        """
        self.event_bus = event_bus
        self.config_manager = config_manager
        self.gesture_integration = GestureIntegration(config_manager, event_bus)
        
        # Active connections
        self.connections: Set[WebSocketServerProtocol] = set()
        
        # Register event handlers
        if event_bus:
            self._register_event_handlers()
    
    def _register_event_handlers(self) -> None:
        """Register handlers for relevant events"""
        self.event_bus.subscribe("ui.gesture.feedback", self._handle_gesture_feedback)
        self.event_bus.subscribe("ui.update", self._handle_ui_update)
        self.event_bus.subscribe("config.updated.gesture", self._handle_config_update)
    
    async def handler(self, websocket: WebSocketServerProtocol, path: str) -> None:
        """
        Handle WebSocket connections
        
        Args:
            websocket: WebSocket connection
            path: Connection path
        """
        # Register connection
        self.connections.add(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"New gesture WebSocket connection from {client_info}")
        
        try:
            # Handle messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._process_message(websocket, data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON received from {client_info}")
                except Exception as e:
                    logger.error(f"Error processing message from {client_info}: {e}")
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket connection closed for {client_info}")
        finally:
            # Unregister connection
            self.connections.remove(websocket)
    
    async def _process_message(self, websocket: WebSocketServerProtocol, 
                              data: Dict[str, Any]) -> None:
        """
        Process incoming WebSocket messages
        
        Args:
            websocket: WebSocket connection
            data: Message data
        """
        message_type = data.get("type")
        
        if message_type == "client_ready":
            await self._handle_client_ready(websocket, data)
        elif message_type == "gesture_event":
            await self._handle_gesture_event(websocket, data)
        elif message_type == "gesture_sequence":
            await self._handle_gesture_sequence(websocket, data)
        elif message_type == "register_elements":
            await self._handle_register_elements(websocket, data)
        else:
            logger.warning(f"Unknown message type: {message_type}")
    
    async def _handle_client_ready(self, websocket: WebSocketServerProtocol, 
                                  data: Dict[str, Any]) -> None:
        """
        Handle client ready message
        
        Args:
            websocket: WebSocket connection
            data: Message data
        """
        client_info = data.get("clientInfo", {})
        logger.info(f"Client ready: {client_info}")
        
        # Send current configuration
        if self.config_manager:
            config = self.config_manager.get_config("gesture_arpeggiator")
            if config:
                await self._send_message(websocket, {
                    "type": "config_update",
                    "config": config
                })
        
        # Notify system about client connection
        if self.event_bus:
            await self.event_bus.publish("gesture.client.connected", {
                "client_info": client_info
            })
    
    async def _handle_gesture_event(self, websocket: WebSocketServerProtocol, 
                                   data: Dict[str, Any]) -> None:
        """
        Handle gesture event message
        
        Args:
            websocket: WebSocket connection
            data: Message data
        """
        gesture = data.get("gesture", {})
        logger.debug(f"Received gesture event: {gesture}")
        
        # Forward to event bus
        if self.event_bus and gesture:
            await self.event_bus.publish("gesture.detected", gesture)
            
            # Send acknowledgment
            await self._send_message(websocket, {
                "type": "gesture_ack",
                "gesture_id": gesture.get("timestamp")
            })
    
    async def _handle_gesture_sequence(self, websocket: WebSocketServerProtocol, 
                                      data: Dict[str, Any]) -> None:
        """
        Handle gesture sequence message
        
        Args:
            websocket: WebSocket connection
            data: Message data
        """
        sequence = data.get("sequence", [])
        logger.debug(f"Received gesture sequence: {len(sequence)} gestures")
        
        # Forward to event bus
        if self.event_bus and sequence:
            await self.event_bus.publish("gesture.sequence.detected", {
                "gestures": sequence
            })
            
            # Send acknowledgment
            await self._send_message(websocket, {
                "type": "sequence_ack",
                "sequence_length": len(sequence)
            })
    
    async def _handle_register_elements(self, websocket: WebSocketServerProtocol, 
                                       data: Dict[str, Any]) -> None:
        """
        Handle register elements message
        
        Args:
            websocket: WebSocket connection
            data: Message data
        """
        elements = data.get("elements", [])
        logger.debug(f"Registering {len(elements)} gesture elements")
        
        # Forward to gesture integration
        await self.gesture_integration.register_gesture_elements(elements)
        
        # Send acknowledgment
        await self._send_message(websocket, {
            "type": "elements_registered",
            "count": len(elements)
        })
    
    async def _handle_gesture_feedback(self, event: Dict[str, Any]) -> None:
        """
        Handle gesture feedback events
        
        Args:
            event: Gesture feedback event
        """
        feedback = event.get("feedback", {})
        
        # Broadcast to all connections
        await self._broadcast_message({
            "type": "gesture_feedback",
            "feedback": feedback
        })
    
    async def _handle_ui_update(self, event: Dict[str, Any]) -> None:
        """
        Handle UI update events
        
        Args:
            event: UI update event
        """
        update = event.get("update", {})
        
        # Broadcast to all connections
        await self._broadcast_message({
            "type": "ui_update",
            "update": update
        })
    
    async def _handle_config_update(self, event: Dict[str, Any]) -> None:
        """
        Handle configuration update events
        
        Args:
            event: Configuration update event
        """
        config = event.get("config", {})
        
        # Broadcast to all connections
        await self._broadcast_message({
            "type": "config_update",
            "config": config
        })
    
    async def _send_message(self, websocket: WebSocketServerProtocol, 
                           message: Dict[str, Any]) -> None:
        """
        Send a message to a WebSocket connection
        
        Args:
            websocket: WebSocket connection
            message: Message to send
        """
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            logger.debug("Connection closed while sending message")
        except Exception as e:
            logger.error(f"Error sending message: {e}")
    
    async def _broadcast_message(self, message: Dict[str, Any]) -> None:
        """
        Broadcast a message to all connected clients
        
        Args:
            message: Message to broadcast
        """
        if not self.connections:
            return
            
        message_json = json.dumps(message)
        await asyncio.gather(
            *[self._send_message(conn, message) for conn in self.connections],
            return_exceptions=True
        )


# Factory function to create a handler
def create_gesture_websocket_handler(event_bus=None, config_manager=None):
    """
    Create a gesture WebSocket handler
    
    Args:
        event_bus: Event bus for publishing and subscribing to events
        config_manager: Configuration manager for settings
        
    Returns:
        WebSocket handler function
    """
    handler = GestureWebSocketHandler(event_bus, config_manager)
    return handler.handler


# Export public API
__all__ = ["GestureWebSocketHandler", "create_gesture_websocket_handler"]
