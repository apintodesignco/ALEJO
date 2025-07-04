# ALEJO Gesture System

## Overview

The ALEJO Gesture System provides intuitive, hands-free interaction through a WebSocket-based architecture. This system enables users to control the ALEJO platform using natural hand gestures, enhancing accessibility and user experience.

## Architecture

The gesture system consists of the following components:

1. **Frontend Gesture Controller**: JavaScript-based gesture detection and classification that runs in the browser
2. **WebSocket Handler**: Backend service that processes gesture events and communicates with the ALEJO brain
3. **Accessibility Layer**: Ensures the gesture interface is accessible to all users
4. **Event Bus Integration**: Connects gesture events to the ALEJO event system

## Quick Start

### Running with Docker Compose

The simplest way to run the complete gesture system is using Docker Compose:

```bash

# Start the entire ALEJO system including gesture support

docker-compose up

# Start only the gesture WebSocket service

docker-compose up gesture_websocket
```text

### Running Standalone

For development or testing, you can run the gesture system standalone:

```bash

# Run the complete gesture system (web server + WebSocket handler)

python start_gesture_system.py

# Run with custom configuration

ALEJO_WEBSOCKET_PORT=9000 ALEJO_ACCESSIBILITY_LEVEL=enhanced python start_gesture_system.py
```text

## Testing

We provide comprehensive testing tools for the gesture system:

### Automated Test Script

```bash

# Run the automated test script

python test_gesture_system.py

# Test against a custom WebSocket endpoint

python test_gesture_system.py --url=ws://your-host:port
```text

### Unit and Integration Tests

```bash

# Unit tests for gesture components

python -m pytest tests/unit/interaction/test_gesture_websocket.py -v

# Integration tests for the WebSocket handler

python -m pytest tests/integration/test_gesture_websocket.py -v

# End-to-end tests for the complete gesture system

python -m pytest tests/e2e/test_gesture_interface.py -v
```text

## Configuration

The gesture system can be configured using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALEJO_GESTURE_ENABLED` | `true` | Enable/disable the gesture system |
| `ALEJO_WEBSOCKET_PORT` | `8765` | Port for the WebSocket server |
| `ALEJO_ACCESSIBILITY_LEVEL` | `standard` | Accessibility level (`basic`, `standard`, `enhanced`) |
| `ALEJO_LOCAL_INFERENCE` | `1` | Use local inference for gesture processing |

## Accessing the Gesture Interface

Once the system is running, access the gesture-enabled interface at:

[<http://localhost:8000/gestures](http://localhost:8000/gesture>s)

## Supported Gestures

The ALEJO gesture system supports the following gestures:

- **Swipe** (left, right, up, down): Navigate between sections
- **Tap**: Select an item or activate a control
- **Pinch**: Zoom in/out or adjust scale
- **Rotate**: Rotate elements or adjust circular controls

## Accessibility Features

The gesture system includes several accessibility features:

- **ARIA Live Regions**: Announce gesture recognition and system status
- **Keyboard Alternatives**: All gesture actions can be performed with keyboard shortcuts
- **Focus Management**: Enhanced focus control for screen readers
- **Customizable Sensitivity**: Adjust gesture recognition sensitivity
- **Visual Feedback**: Clear visual indicators for gesture recognition

## Troubleshooting

### WebSocket Connection Issues

If you're experiencing connection issues:

1. Verify the WebSocket server is running: `docker-compose ps gesture_websocket`
2. Check the logs: `docker-compose logs gesture_websocket`
3. Ensure the port is accessible: `curl <http://localhost:8765/health`>
4. Test the connection directly: `python test_gesture_system.py`

### Gesture Recognition Problems

If gestures aren't being recognized correctly:

1. Check browser console for JavaScript errors
2. Verify camera permissions are granted
3. Adjust lighting conditions for better hand tracking
4. Try adjusting sensitivity settings in the UI

## Development

To extend the gesture system:

1. Add new gesture types in `alejo/static/js/gesture-controller.js`
2. Register handlers in `alejo/handlers/gesture_websocket_handler.py`
3. Update the frontend UI in `alejo/templates/gesture_enabled_interface.html`
4. Add tests for new functionality

## CI/CD Integration

The gesture system is fully integrated into the ALEJO CI/CD pipeline:

- Unit tests run on every commit
- Integration tests verify WebSocket communication
- End-to-end tests validate the complete gesture experience
- Performance benchmarks ensure responsive gesture recognition

For more detailed information, see the [GESTURE_SYSTEM.md](./GESTURE_SYSTEM.md) documentation.
