# ALEJO Unreal Engine Bridge API Documentation

This document describes the API endpoints and WebSocket events available for communication between ALEJO's core functionality and Unreal Engine.

## Core Principles

This integration follows ALEJO's core principles:

- **No External API Keys**: All functionality operates locally without external service dependencies
- **Accessibility First**: UI elements prioritize accessibility for users with disabilities
- **Local-First Architecture**: All processing remains on the user's device
- **Resource Efficiency**: Adaptive resource management based on system capabilities
- **Privacy Preserving**: No user data sent to external services

## REST API Endpoints

### Status Check

```
GET /status
```

Returns the current status of the ALEJO bridge server.

**Response:**
```json
{
  "status": "online",
  "unrealConnected": true|false,
  "timestamp": "ISO-8601 timestamp",
  "version": "1.0.0"
}
```

## WebSocket Events

The bridge primarily uses WebSocket (Socket.IO) for real-time communication between ALEJO and Unreal Engine.

### Connection Events

- `connection`: Fired when Unreal Engine connects to the bridge
- `disconnect`: Fired when Unreal Engine disconnects from the bridge

### From Unreal Engine to ALEJO

#### Text Processing

```javascript
socket.emit('process-text', {
  text: "User text input here",
  context: {
    // Optional context information
    sessionId: "unique-session-id",
    previousInteractions: [],
    userPreferences: {}
  }
});
```

#### Voice Command Processing

```javascript
socket.emit('process-voice-command', {
  command: "User voice command here",
  context: {
    // Optional context information
    sessionId: "unique-session-id",
    previousCommands: [],
    environmentContext: {}
  }
});
```

#### Accessibility Settings

```javascript
socket.emit('accessibility-settings', {
  highContrast: true,
  fontSize: 1.5,
  screenReader: true,
  signLanguage: false,
  vibrationFeedback: true
  // Other accessibility settings
});
```

#### Custom Events

```javascript
socket.emit('unreal-event', {
  type: "custom.event.type",
  data: {
    // Any custom event data
  }
});
```

### From ALEJO to Unreal Engine

#### Text Processing Response

```javascript
socket.on('text-processed', (result) => {
  // Handle processed text result
  // result = {
  //   response: "ALEJO's response text",
  //   intent: "detected.user.intent",
  //   entities: [],
  //   sentiment: "positive",
  //   suggestedActions: []
  // }
});

socket.on('text-processed-error', (error) => {
  // Handle error in text processing
});
```

#### Voice Processing Response

```javascript
socket.on('voice-processed', (result) => {
  // Handle processed voice command result
  // result = {
  //   response: "ALEJO's response text",
  //   command: "interpreted.command",
  //   success: true,
  //   actions: []
  // }
});

socket.on('voice-processed-error', (error) => {
  // Handle error in voice processing
});
```

#### ALEJO System Events

```javascript
socket.on('alejo-event', (event) => {
  // Handle ALEJO system events
  // event = {
  //   type: "event.type",
  //   data: {},
  //   timestamp: 1626562799000
  // }
});
```

#### Resource Mode Changes

```javascript
socket.on('resource-mode-change', (data) => {
  // Handle resource mode changes
  // data = { mode: "normal" | "low" | "high" }
});
```

## Error Handling

All API endpoints and WebSocket events include proper error handling with descriptive error messages. The bridge will never crash due to malformed requests or unexpected data.

## Security Considerations

- The bridge server only accepts connections from localhost
- All data is processed locally
- No user data is stored persistently unless explicitly requested
- Input validation is performed on all incoming data

## Example Usage (JavaScript)

```javascript
const socket = io('http://localhost:3030');

// Connect to ALEJO bridge
socket.on('connect', () => {
  console.log('Connected to ALEJO bridge');
});

// Process text input
socket.emit('process-text', { 
  text: 'What time is it?' 
});

// Listen for response
socket.on('text-processed', (response) => {
  console.log('ALEJO response:', response);
});

// Listen for ALEJO system events
socket.on('alejo-event', (event) => {
  console.log(`ALEJO event: ${event.type}`, event.data);
});
```
