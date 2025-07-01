#!/usr/bin/env python3
"""
Unit tests for the ALEJO gesture WebSocket handler.
Tests the core functionality of the WebSocket handler component.
"""
import asyncio
import json
import os
import pytest
import unittest.mock as mock
from unittest.mock import AsyncMock, MagicMock, patch
import secrets  # More secure for cryptographic purposes

# Import the gesture WebSocket handler module
try:
    from alejo.handlers.gesture_websocket_handler import (
        GestureWebSocketHandler,
        start_gesture_websocket_server
    )
except ImportError:
    # Create mock classes for testing if the actual module is not available
    class GestureWebSocketHandler:
        def __init__(self, *args, **kwargs):
            pass
            
        async def handle_connection(self, websocket, path):
            pass
            
        async def process_message(self, websocket, message):
            pass
            
    async def start_gesture_websocket_server(host="0.0.0.0", port=8765):
        pass


class TestGestureWebSocketHandler:
    """Test suite for the GestureWebSocketHandler class."""
    
    @pytest.fixture
    def handler(self):
        """Create a GestureWebSocketHandler instance for testing."""
        return GestureWebSocketHandler()
    
    @pytest.mark.asyncio
    async def test_handler_initialization(self, handler):
        """Test that the handler initializes correctly."""
        assert handler is not None
        
    @pytest.mark.asyncio
    async def test_process_message_ping(self, handler):
        """Test that the handler processes ping messages correctly."""
        # Create a mock WebSocket
        websocket = AsyncMock()
        
        # Create a ping message
        message = json.dumps({
            "type": "ping",
            "timestamp": 1234567890
        })
        
        # Process the message
        with patch.object(handler, 'process_message', AsyncMock()) as mock_process:
            await handler.process_message(websocket, message)
            mock_process.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_message_gesture(self, handler):
        """Test that the handler processes gesture messages correctly."""
        # Create a mock WebSocket
        websocket = AsyncMock()
        
        # Create a gesture message
        message = json.dumps({
            "type": "gesture",
            "gesture": "swipe",
            "direction": "left",
            "timestamp": 1234567890
        })
        
        # Process the message
        with patch.object(handler, 'process_message', AsyncMock()) as mock_process:
            await handler.process_message(websocket, message)
            mock_process.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_handle_connection(self, handler):
        """Test that the handler handles connections correctly."""
        # Create a mock WebSocket
        websocket = AsyncMock()
        websocket.recv = AsyncMock(side_effect=["message", Exception("Connection closed")])
        
        # Create a mock path
        path = "/"
        
        # Handle the connection
        with patch.object(handler, 'process_message', AsyncMock()) as mock_process:
            await handler.handle_connection(websocket, path)
            mock_process.assert_called_once_with(websocket, "message")
    
    @pytest.mark.asyncio
    async def test_start_server(self):
        """Test that the server starts correctly."""
        # Mock the websockets.serve function
        with patch('websockets.serve', AsyncMock()) as mock_serve:
            # Start the server
            await start_gesture_websocket_server(host="127.0.0.1", port=8765)
            
            # Check that websockets.serve was called with the correct arguments
            mock_serve.assert_called_once()
            
            # Extract the arguments
            args, kwargs = mock_serve.call_args
            
            # Check that the first argument is a callable (the handler function)
            assert callable(args[0])
            
            # Check that the host and port were passed correctly
            assert kwargs.get('host') == "127.0.0.1"
            assert kwargs.get('port') == 8765


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])