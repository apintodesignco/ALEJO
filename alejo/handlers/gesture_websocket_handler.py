import asyncio
import json
import logging

# Import the event bus from ALEJO components (update the import path as necessary)
try:
    from alejo.core.event_bus import EventBus
except ImportError:
    class EventBus:
        def __init__(self):
            self.subscribers = {}
        def subscribe(self, event_type, callback):
            if event_type not in self.subscribers:
                self.subscribers[event_type] = []
            self.subscribers[event_type].append(callback)
        def publish(self, event_type, data):
            if event_type in self.subscribers:
                for callback in self.subscribers[event_type]:
                    callback(data)

# A production-grade handler for gesture WebSocket events
class GestureWebSocketHandler:
    def __init__(self, config_manager=None, event_bus=None):
        self.config_manager = config_manager
        self.event_bus = event_bus or EventBus()

    async def handler(self, websocket, path):
        logger = logging.getLogger("GestureWebSocketHandler")
        if not logger.hasHandlers():
            logging.basicConfig(level=logging.DEBUG)
        logger.info(f"New WebSocket connection from {websocket.remote_address}")
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.debug(f"Received message: {data}")
                    await self.process_message(data, websocket)
                except json.JSONDecodeError:
                    logger.error("Invalid JSON message received from %s", websocket.remote_address)
                    await websocket.send(json.dumps({
                        "status": "error",
                        "message": "Invalid JSON format"
                    }))
        except Exception as e:
            logger.error("Error in gesture websocket handler: %s", e)
        finally:
            logger.info(f"WebSocket connection closed for {websocket.remote_address}")

    async def process_message(self, data, websocket):
        logger = logging.getLogger("GestureWebSocketHandler")
        if not logger.hasHandlers():
            logging.basicConfig(level=logging.DEBUG)
        if "type" in data:
            logger.info(f"Processing gesture event: {data}")
            self.event_bus.publish("gesture_event", data)
            response = {"status": "received", "type": data.get("type")}
            try:
                await websocket.send(json.dumps(response))
                logger.debug(f"Sent acknowledgment: {response}")
            except Exception as send_error:
                logger.error("Error sending acknowledgment: %s", send_error)
        else:
            logger.warning("Unknown message format received: %s", data)
            response = {"status": "error", "message": "Invalid message format"}
            await websocket.send(json.dumps(response))

if __name__ == "__main__":
    import websockets

    async def main():
        handler_instance = GestureWebSocketHandler()
        async with websockets.serve(handler_instance.handler, "localhost", 8765):
            logging.basicConfig(level=logging.DEBUG)
            print("Gesture WebSocket server started on ws://localhost:8765")
            await asyncio.Future()  # run forever

    asyncio.run(main())

# Import the event bus from ALEJO components (update the import path as necessary)
try:
    from alejo.core.event_bus import EventBus
except ImportError:
    class EventBus:
        def __init__(self):
            self.subscribers = {}
        def subscribe(self, event_type, callback):
            if event_type not in self.subscribers:
                self.subscribers[event_type] = []
            self.subscribers[event_type].append(callback)
        def publish(self, event_type, data):
            if event_type in self.subscribers:
                for callback in self.subscribers[event_type]:
                    callback(data)

# A production-grade handler for gesture WebSocket events
class GestureWebSocketHandler:
    def __init__(self, config_manager=None, event_bus=None):
        self.config_manager = config_manager
        self.event_bus = event_bus or EventBus()

    async def handler(self, websocket, path):
        logger = logging.getLogger("GestureWebSocketHandler")
        if not logger.hasHandlers():
            logging.basicConfig(level=logging.DEBUG)
        logger.info(f"New WebSocket connection from {websocket.remote_address}")
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.debug(f"Received message: {data}")
                    await self.process_message(data, websocket)
                except json.JSONDecodeError:
                    logger.error("Invalid JSON message received from %s", websocket.remote_address)
                    await websocket.send(json.dumps({
                        "status": "error",
                        "message": "Invalid JSON format"
                    }))
        except Exception as e:
            logger.error("Error in gesture websocket handler: %s", e)
        finally:
            logger.info(f"WebSocket connection closed for {websocket.remote_address}")

    async def process_message(self, data, websocket):
        logger = logging.getLogger("GestureWebSocketHandler")
        if not logger.hasHandlers():
            logging.basicConfig(level=logging.DEBUG)
        if "type" in data:
            logger.info(f"Processing gesture event: {data}")
            self.event_bus.publish("gesture_event", data)
            response = {"status": "received", "type": data.get("type")}
            try:
                await websocket.send(json.dumps(response))
                logger.debug(f"Sent acknowledgment: {response}")
            except Exception as send_error:
                logger.error("Error sending acknowledgment: %s", send_error)
        else:
            logger.warning("Unknown message format received: %s", data)
            response = {"status": "error", "message": "Invalid message format"}
            await websocket.send(json.dumps(response))

if __name__ == "__main__":
    import websockets

    async def main():
        handler_instance = GestureWebSocketHandler()
        async with websockets.serve(handler_instance.handler, "localhost", 8765):
            logging.basicConfig(level=logging.DEBUG)
            print("Gesture WebSocket server started on ws://localhost:8765")
            await asyncio.Future()  # run forever

    asyncio.run(main())

except ImportError:

    class EventBus:
        def __init__(self):
            self.subscribers = {}

        def subscribe(self, event_type, callback):
            if event_type not in self.subscribers:
                self.subscribers[event_type] = []
            self.subscribers[event_type].append(callback)

        def publish(self, event_type, data):
            if event_type in self.subscribers:
                for callback in self.subscribers[event_type]:
                    callback(data)

# A production-grade handler for gesture WebSocket events
class GestureWebSocketHandler:
    def __init__(self, config_manager=None, event_bus=None):
        self.config_manager = config_manager
        self.event_bus = event_bus or EventBus()

    async def handler(self, websocket, path):
    import logging
    logger = logging.getLogger('GestureWebSocketHandler')
    if not logger.hasHandlers():
        logging.basicConfig(level=logging.DEBUG)
    logger.info(f"New WebSocket connection from {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.debug(f"Received message: {data}")
                await self.process_message(data, websocket)
            except json.JSONDecodeError:
                logger.error("Invalid JSON message received from %s", websocket.remote_address)
                await websocket.send(json.dumps({'status': 'error', 'message': 'Invalid JSON format'}))
    except Exception as e:
        logger.error("Error in gesture websocket handler: %s", e)
    finally:
        logger.info(f"WebSocket connection closed for {websocket.remote_address}")

    import logging
    logger = logging.getLogger('GestureWebSocketHandler')
    if not logger.hasHandlers():
        logging.basicConfig(level=logging.DEBUG)
    logger.info(f"New WebSocket connection from {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.debug(f"Received message: {data}")
                await self.process_message(data, websocket)
            except json.JSONDecodeError:
                logger.error("Invalid JSON message received from %s", websocket.remote_address)
                await websocket.send(json.dumps({'status': 'error', 'message': 'Invalid JSON format'}))
    except Exception as e:
        logger.error("Error in gesture websocket handler: %s", e)
    finally:
        logger.info(f"WebSocket connection closed for {websocket.remote_address}")

        """Handle incoming WebSocket connections and messages."""
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data, websocket)
                except json.JSONDecodeError:
                    print('Invalid JSON message received.')
        except Exception as e:
            print('Error in gesture websocket handler:', e)

    async def process_message(self, data, websocket):
    import logging
    logger = logging.getLogger('GestureWebSocketHandler')
    if not logger.hasHandlers():
        logging.basicConfig(level=logging.DEBUG)
    if 'type' in data:
        logger.info(f"Processing gesture event: {data}")
        self.event_bus.publish('gesture_event', data)
        response = {'status': 'received', 'type': data.get('type')}
        try:
            await websocket.send(json.dumps(response))
            logger.debug(f"Sent acknowledgment: {response}")
        except Exception as send_error:
            logger.error("Error sending acknowledgment: %s", send_error)
    else:
        logger.warning("Unknown message format received: %s", data)
        response = {'status': 'error', 'message': 'Invalid message format'}
        await websocket.send(json.dumps(response))

    import logging
    logger = logging.getLogger('GestureWebSocketHandler')
    if not logger.hasHandlers():
        logging.basicConfig(level=logging.DEBUG)
    if 'type' in data:
        logger.info(f"Processing gesture event: {data}")
        # Publish the event on the event bus
        self.event_bus.publish('gesture_event', data)
        # Send acknowledgment back
        response = {'status': 'received', 'type': data.get('type')}
        try:
            await websocket.send(json.dumps(response))
            logger.debug(f"Sent acknowledgment: {response}")
        except Exception as send_error:
            logger.error("Error sending acknowledgment: %s", send_error)
    else:
        logger.warning("Unknown message format received: %s", data)
        response = {'status': 'error', 'message': 'Invalid message format'}
        await websocket.send(json.dumps(response))

        """Process the received gesture event message and publish it via the event bus."""
        if 'type' in data:
            print('Received gesture event:', data)
            # Publish the event on the event bus
            self.event_bus.publish('gesture_event', data)
            # Optionally, send acknowledgment back
            response = {'status': 'received', 'type': data.get('type')}
            await websocket.send(json.dumps(response))
        else:
            print('Unknown message format:', data)
            response = {'status': 'error', 'message': 'Invalid message format'}
            await websocket.send(json.dumps(response))

# If this module is run directly, start a simple WebSocket server for testing purposes.
if __name__ == '__main__':
    import websockets

    async def main():
        handler_instance = GestureWebSocketHandler()
        async with websockets.serve(handler_instance.handler, 'localhost', 8765):
            print('Gesture WebSocket server started on ws://localhost:8765')
            await asyncio.Future()  # run forever

    asyncio.run(main())
