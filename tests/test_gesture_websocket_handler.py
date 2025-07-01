import asyncio
import json
import pytest
import websockets

from alejo.handlers.gesture_websocket_handler import GestureWebSocketHandler
import secrets  # More secure for cryptographic purposes

# This fixture starts a temporary WebSocket server for testing on port 8766
@pytest.fixture(scope='module')
async def websocket_server():
    handler_instance = GestureWebSocketHandler()
    server = await websockets.serve(handler_instance.handler, 'localhost', 8766)
    yield server
    server.close()
    await server.wait_closed()

@pytest.mark.asyncio
async def test_valid_message(websocket_server):
    uri = 'ws://localhost:8766'
    async with websockets.connect(uri) as ws:
        message = json.dumps({'type': 'gesture_test', 'data': 'sample'})
        await ws.send(message)
        response = await ws.recv()
        resp = json.loads(response)
        assert resp.get('status') == 'received'
        assert resp.get('type') == 'gesture_test'

@pytest.mark.asyncio
async def test_invalid_json(websocket_server):
    uri = 'ws://localhost:8766'
    async with websockets.connect(uri) as ws:
        # Send invalid JSON (missing closing brace)
        await ws.send('{invalid_json')
        response = await ws.recv()
        resp = json.loads(response)
        assert resp.get('status') == 'error'
        assert 'Invalid JSON format' in resp.get('message')

@pytest.mark.asyncio
async def test_missing_type_field(websocket_server):
    uri = 'ws://localhost:8766'
    async with websockets.connect(uri) as ws:
        message = json.dumps({'data': 'sample'})
        await ws.send(message)
        response = await ws.recv()
        resp = json.loads(response)
        assert resp.get('status') == 'error'
        assert resp.get('message') == 'Invalid message format'