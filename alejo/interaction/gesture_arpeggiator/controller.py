"""
Gesture Arpeggiator Controller

This module implements the controller for ALEJO's gesture-based arpeggiator
and drum machine system, handling HTTP endpoints and WebSocket connections.
"""

import logging
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from pydantic import BaseModel

from alejo.core.security import get_current_user, User
from alejo.interaction.gesture_arpeggiator.service import GestureArpeggiatorService

logger = logging.getLogger(__name__)

class ArpeggiatorSettings(BaseModel):
    """Settings for the arpeggiator"""
    bpm: int = 120
    scale: str = "major"
    root_note: str = "C4"
    octave_range: int = 2
    pattern: str = "up"
    volume: float = 0.8
    
class DrumSettings(BaseModel):
    """Settings for the drum machine"""
    pattern_id: int = 0
    volume: float = 0.8
    swing: float = 0.0
    
class VisualizerSettings(BaseModel):
    """Settings for the audio-reactive visualizer"""
    theme: str = "default"
    sensitivity: float = 0.5
    particle_count: int = 1000
    
class GestureArpeggiatorController:
    """Controller for the Gesture Arpeggiator feature"""
    
    def __init__(self, service: GestureArpeggiatorService):
        """
        Initialize the controller
        
        Args:
            service: The gesture arpeggiator service
        """
        self.service = service
        self.router = APIRouter(prefix="/gesture-arpeggiator", tags=["gesture-arpeggiator"])
        self.active_connections: Dict[str, WebSocket] = {}
        self._setup_routes()
        
    def _setup_routes(self):
        """Set up the API routes"""
        
        @self.router.get("/status")
        async def get_status(current_user: User = Depends(get_current_user)):
            """Get the current status of the gesture arpeggiator"""
            return {
                "is_active": self.service.is_active(),
                "connected_clients": len(self.active_connections),
                "arpeggiator": self.service.get_arpeggiator_settings(),
                "drums": self.service.get_drum_settings(),
                "visualizer": self.service.get_visualizer_settings()
            }
            
        @self.router.post("/start")
        async def start_arpeggiator(current_user: User = Depends(get_current_user)):
            """Start the gesture arpeggiator"""
            await self.service.start()
            return {"status": "started"}
            
        @self.router.post("/stop")
        async def stop_arpeggiator(current_user: User = Depends(get_current_user)):
            """Stop the gesture arpeggiator"""
            await self.service.stop()
            return {"status": "stopped"}
            
        @self.router.post("/arpeggiator/settings")
        async def update_arpeggiator_settings(
            settings: ArpeggiatorSettings,
            current_user: User = Depends(get_current_user)
        ):
            """Update the arpeggiator settings"""
            await self.service.update_arpeggiator_settings(settings.dict())
            return {"status": "updated"}
            
        @self.router.post("/drums/settings")
        async def update_drum_settings(
            settings: DrumSettings,
            current_user: User = Depends(get_current_user)
        ):
            """Update the drum machine settings"""
            await self.service.update_drum_settings(settings.dict())
            return {"status": "updated"}
            
        @self.router.post("/visualizer/settings")
        async def update_visualizer_settings(
            settings: VisualizerSettings,
            current_user: User = Depends(get_current_user)
        ):
            """Update the visualizer settings"""
            await self.service.update_visualizer_settings(settings.dict())
            return {"status": "updated"}
            
        @self.router.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            """WebSocket endpoint for real-time hand tracking data"""
            await websocket.accept()
            connection_id = str(id(websocket))
            self.active_connections[connection_id] = websocket
            
            try:
                await self._handle_websocket(websocket, connection_id)
            except WebSocketDisconnect:
                self._remove_connection(connection_id)
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                self._remove_connection(connection_id)
                
    async def _handle_websocket(self, websocket: WebSocket, connection_id: str):
        """
        Handle WebSocket communication
        
        Args:
            websocket: The WebSocket connection
            connection_id: Unique identifier for the connection
        """
        while True:
            data = await websocket.receive_json()
            
            # Process hand tracking data
            if "handData" in data:
                await self.service.process_hand_data(data["handData"])
                
                # Send back audio and visualization state
                state = self.service.get_current_state()
                await websocket.send_json(state)
                
                # Broadcast to all other clients
                await self._broadcast_state(state, exclude=connection_id)
            
            # Process control commands
            elif "command" in data:
                await self._process_command(data, websocket)
                
    async def _process_command(self, data: Dict, websocket: WebSocket):
        """
        Process a command received via WebSocket
        
        Args:
            data: The command data
            websocket: The WebSocket connection
        """
        command = data.get("command")
        params = data.get("params", {})
        
        if command == "start":
            await self.service.start()
        elif command == "stop":
            await self.service.stop()
        elif command == "update_arpeggiator":
            await self.service.update_arpeggiator_settings(params)
        elif command == "update_drums":
            await self.service.update_drum_settings(params)
        elif command == "update_visualizer":
            await self.service.update_visualizer_settings(params)
        
        # Send updated state back to the client
        state = self.service.get_current_state()
        await websocket.send_json(state)
        
    async def _broadcast_state(self, state: Dict, exclude: Optional[str] = None):
        """
        Broadcast state to all connected clients
        
        Args:
            state: The state to broadcast
            exclude: Optional connection ID to exclude
        """
        for conn_id, websocket in self.active_connections.items():
            if exclude and conn_id == exclude:
                continue
                
            try:
                await websocket.send_json(state)
            except Exception as e:
                logger.error(f"Error broadcasting to {conn_id}: {e}")
                self._remove_connection(conn_id)
                
    def _remove_connection(self, connection_id: str):
        """
        Remove a WebSocket connection
        
        Args:
            connection_id: The connection ID to remove
        """
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
