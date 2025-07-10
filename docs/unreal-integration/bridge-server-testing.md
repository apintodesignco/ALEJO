# ALEJO Bridge Server Testing Guide

This guide covers testing the Node.js bridge server component of the ALEJO Unreal Engine integration, which handles communication between Unreal Engine and the ALEJO core modules.

## Overview

The bridge server testing suite verifies:

1. HTTP API functionality
2. WebSocket communication
3. Text and voice processing
4. Accessibility settings management
5. Resource mode handling
6. Custom event propagation

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- Jest testing framework

## Running the Tests

Navigate to the test directory:

```bash
cd test/unreal-integration
```

Install test dependencies if needed:

```bash
npm install
```

Run the tests:

```bash
npm test
```

For specific test groups:

```bash
npm test -- -t "WebSocket"
```

## Test Structure

The server bridge tests are organized in `server-bridge-test.js` with the following structure:

```javascript
describe('ALEJO Bridge Server', () => {
  // Top-level test group
  
  describe('HTTP API', () => {
    // HTTP endpoint tests
  });
  
  describe('WebSocket Communication', () => {
    // WebSocket connection tests
  });
  
  describe('Text Processing', () => {
    // Text processing tests
  });
  
  describe('Voice Processing', () => {
    // Voice command and streaming tests
  });
  
  describe('Accessibility Features', () => {
    // Accessibility settings tests
  });
  
  describe('Resource Management', () => {
    // Resource mode tests
  });
  
  describe('Custom Events', () => {
    // Custom event tests
  });
});
```

## Test Implementation Details

### HTTP API Tests

```javascript
describe('HTTP API', () => {
  test('should return 200 OK on health check endpoint', async () => {
    const response = await fetch('http://localhost:3031/health');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
  
  test('should return version information', async () => {
    const response = await fetch('http://localhost:3031/version');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.version).toBeDefined();
    expect(data.buildDate).toBeDefined();
  });
  
  test('should have proper security headers', async () => {
    const response = await fetch('http://localhost:3031/health');
    expect(response.headers.get('content-security-policy')).toBeDefined();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
```

### WebSocket Communication Tests

```javascript
describe('WebSocket Communication', () => {
  let client;
  
  beforeEach(() => {
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
  });
  
  test('should establish WebSocket connection', (done) => {
    client.on('open', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
      done();
    });
  });
  
  test('should receive connection confirmation', (done) => {
    client.on('open', () => {
      // Connection opened
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      expect(message.type).toBe('connected');
      expect(message.data).toBeDefined();
      expect(message.data.serverId).toBeDefined();
      done();
    });
  });
  
  test('should handle ping/pong', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'ping' }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'pong') {
        expect(message.data).toBeDefined();
        expect(message.data.timestamp).toBeDefined();
        done();
      }
    });
  });
});
```

### Text Processing Tests

```javascript
describe('Text Processing', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mock ALEJO core
    mockALEJOCore = {
      textProcessing: {
        processText: jest.fn().mockResolvedValue({
          result: 'Processed text result',
          confidence: 0.95
        })
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should process text and return result', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'processText',
        data: {
          text: 'Hello ALEJO',
          context: { source: 'test' }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'textResult') {
        expect(message.data).toBeDefined();
        expect(message.data.result).toBe('Processed text result');
        expect(message.data.confidence).toBe(0.95);
        expect(mockALEJOCore.textProcessing.processText).toHaveBeenCalledWith(
          'Hello ALEJO',
          { source: 'test' }
        );
        done();
      }
    });
  });
  
  test('should handle text processing errors', (done) => {
    // Override mock to throw error
    mockALEJOCore.textProcessing.processText = jest.fn().mockRejectedValue(
      new Error('Processing failed')
    );
    
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'processText',
        data: {
          text: 'Hello ALEJO',
          context: { source: 'test' }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'error') {
        expect(message.data).toBeDefined();
        expect(message.data.message).toBe('Processing failed');
        expect(message.data.source).toBe('textProcessing');
        done();
      }
    });
  });
});
```

### Voice Processing Tests

```javascript
describe('Voice Processing', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mock ALEJO core
    mockALEJOCore = {
      voiceProcessing: {
        processCommand: jest.fn().mockResolvedValue({
          result: 'Processed voice command',
          confidence: 0.85
        }),
        startStreaming: jest.fn(),
        stopStreaming: jest.fn(),
        onVoiceActivity: jest.fn()
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should process voice command', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'processVoiceCommand',
        data: {
          command: 'Open inventory',
          context: { source: 'game_ui' }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'voiceResult') {
        expect(message.data).toBeDefined();
        expect(message.data.result).toBe('Processed voice command');
        expect(message.data.confidence).toBe(0.85);
        expect(mockALEJOCore.voiceProcessing.processCommand).toHaveBeenCalledWith(
          'Open inventory',
          { source: 'game_ui' }
        );
        done();
      }
    });
  });
  
  test('should start and stop voice streaming', (done) => {
    let streamStarted = false;
    
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'startVoiceStreaming',
        data: {
          context: { source: 'game_ui' }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.type === 'voiceStreamingStarted') {
        streamStarted = true;
        expect(mockALEJOCore.voiceProcessing.startStreaming).toHaveBeenCalled();
        
        // Now stop streaming
        client.send(JSON.stringify({
          type: 'stopVoiceStreaming',
          data: {}
        }));
      }
      
      if (message.type === 'voiceStreamingStopped' && streamStarted) {
        expect(mockALEJOCore.voiceProcessing.stopStreaming).toHaveBeenCalled();
        done();
      }
    });
  });
  
  test('should emit voice activity events', (done) => {
    // Register voice activity callback
    let activityCallback;
    mockALEJOCore.voiceProcessing.onVoiceActivity = jest.fn((callback) => {
      activityCallback = callback;
    });
    
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'startVoiceStreaming',
        data: {
          context: { source: 'game_ui' }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.type === 'voiceStreamingStarted') {
        // Simulate voice activity
        activityCallback({
          confidence: 0.75,
          isSpeaking: true,
          isFinal: false
        });
      }
      
      if (message.type === 'voiceActivity') {
        expect(message.data).toBeDefined();
        expect(message.data.confidence).toBe(0.75);
        expect(message.data.isSpeaking).toBe(true);
        expect(message.data.isFinal).toBe(false);
        done();
      }
    });
  });
});
```

### Accessibility Tests

```javascript
describe('Accessibility Features', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mock ALEJO core
    mockALEJOCore = {
      accessibility: {
        updateSettings: jest.fn().mockResolvedValue({
          success: true,
          settings: {
            screenReaderEnabled: true,
            highContrastMode: true,
            fontScaleFactor: 1.5,
            colorBlindType: 'deuteranopia'
          }
        }),
        announceToScreenReader: jest.fn()
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should update accessibility settings', (done) => {
    const settings = {
      screenReaderEnabled: true,
      highContrastMode: true,
      fontScaleFactor: 1.5,
      colorBlindType: 'deuteranopia',
      reducedMotion: true,
      keyboardNavigationEnabled: true
    };
    
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'updateAccessibilitySettings',
        data: { settings }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'accessibilitySettingsUpdated') {
        expect(message.data).toBeDefined();
        expect(message.data.success).toBe(true);
        expect(message.data.settings).toBeDefined();
        expect(mockALEJOCore.accessibility.updateSettings).toHaveBeenCalledWith(settings);
        done();
      }
    });
  });
  
  test('should announce to screen reader', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'announceToScreenReader',
        data: {
          text: 'This is a test announcement',
          interrupt: true
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'screenReaderAnnouncement') {
        expect(message.data).toBeDefined();
        expect(message.data.success).toBe(true);
        expect(mockALEJOCore.accessibility.announceToScreenReader).toHaveBeenCalledWith(
          'This is a test announcement', 
          true
        );
        done();
      }
    });
  });
});
```

### Resource Management Tests

```javascript
describe('Resource Management', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mock ALEJO core
    mockALEJOCore = {
      resourceManager: {
        setResourceMode: jest.fn().mockResolvedValue({
          success: true,
          mode: 'medium'
        }),
        getCurrentResourceMode: jest.fn().mockReturnValue('medium'),
        registerResourceConsumer: jest.fn(),
        onResourceModeChanged: jest.fn()
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should set resource mode', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'setResourceMode',
        data: { mode: 'high' }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'resourceModeChanged') {
        expect(message.data).toBeDefined();
        expect(message.data.success).toBe(true);
        expect(message.data.mode).toBe('medium'); // Return from mock
        expect(mockALEJOCore.resourceManager.setResourceMode).toHaveBeenCalledWith('high');
        done();
      }
    });
  });
  
  test('should register as resource consumer', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'registerResourceConsumer',
        data: { 
          name: 'unrealEngine',
          priority: 'high',
          requirements: {
            cpu: 'medium',
            memory: 'high',
            gpu: 'high'
          }
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'resourceConsumerRegistered') {
        expect(message.data).toBeDefined();
        expect(message.data.success).toBe(true);
        expect(mockALEJOCore.resourceManager.registerResourceConsumer).toHaveBeenCalledWith(
          'unrealEngine',
          'high',
          expect.objectContaining({
            cpu: 'medium',
            memory: 'high',
            gpu: 'high'
          })
        );
        done();
      }
    });
  });
  
  test('should emit resource mode changed events', (done) => {
    // Register resource mode callback
    let modeCallback;
    mockALEJOCore.resourceManager.onResourceModeChanged = jest.fn((callback) => {
      modeCallback = callback;
    });
    
    client.on('open', () => {
      // Connection established
      
      // Wait a bit then trigger the resource mode changed event
      setTimeout(() => {
        if (modeCallback) {
          modeCallback('low');
        }
      }, 100);
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.type === 'resourceModeChanged' && 
          message.data && 
          message.data.mode === 'low') {
        expect(message.data.success).toBe(true);
        done();
      }
    });
  });
});
```

### Custom Event Tests

```javascript
describe('Custom Events', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mock ALEJO core
    mockALEJOCore = {
      eventBus: {
        emit: jest.fn().mockReturnValue(true),
        on: jest.fn()
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should emit custom events', (done) => {
    const eventName = 'game.levelCompleted';
    const eventData = { level: 5, score: 1000 };
    
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'customEvent',
        data: {
          eventName,
          eventData
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'customEventSent') {
        expect(message.data).toBeDefined();
        expect(message.data.success).toBe(true);
        expect(message.data.eventName).toBe(eventName);
        expect(mockALEJOCore.eventBus.emit).toHaveBeenCalledWith(
          eventName,
          eventData
        );
        done();
      }
    });
  });
  
  test('should receive custom events from core', (done) => {
    // Register event callback
    let eventCallback;
    mockALEJOCore.eventBus.on = jest.fn((name, callback) => {
      if (name === 'unreal.events') {
        eventCallback = callback;
      }
    });
    
    client.on('open', () => {
      // Connection established
      
      // Wait a bit then trigger the custom event
      setTimeout(() => {
        if (eventCallback) {
          eventCallback('ai.decision', { decision: 'attack', confidence: 0.8 });
        }
      }, 100);
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.type === 'customEvent') {
        expect(message.data).toBeDefined();
        expect(message.data.eventName).toBe('ai.decision');
        expect(message.data.eventData).toBeDefined();
        expect(message.data.eventData.decision).toBe('attack');
        expect(message.data.eventData.confidence).toBe(0.8);
        done();
      }
    });
  });
});
```

## Writing Custom Tests

To add your own tests, follow these guidelines:

1. **Test Structure**: Group related tests using `describe` blocks
2. **Test Setup**: Use `beforeEach` to create a clean environment for each test
3. **Mocking**: Use Jest mock functions for ALEJO core modules
4. **Async Testing**: Use `done` callback or `async/await` for asynchronous tests
5. **WebSocket Testing**: Wait for connection before sending messages

Example template for custom tests:

```javascript
describe('My Custom Feature', () => {
  let client;
  let mockALEJOCore;
  
  beforeEach(() => {
    // Setup mocks
    mockALEJOCore = {
      myModule: {
        myFunction: jest.fn().mockResolvedValue({
          result: 'Success'
        })
      }
    };
    
    // Create server with mock
    server = createTestServer(mockALEJOCore);
    
    // Create test client
    client = new WebSocket('ws://localhost:3031');
  });
  
  afterEach(() => {
    // Clean up
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
    }
    server.close();
  });
  
  test('should handle my feature correctly', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'myFeature',
        data: {
          param1: 'value1',
          param2: 'value2'
        }
      }));
    });
    
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'myFeatureResult') {
        expect(message.data).toBeDefined();
        expect(message.data.result).toBe('Success');
        expect(mockALEJOCore.myModule.myFunction).toHaveBeenCalledWith(
          'value1',
          'value2'
        );
        done();
      }
    });
  });
});
```

## Test Coverage

To generate test coverage reports:

```bash
npm test -- --coverage
```

This creates a coverage report in the `coverage` directory showing:

- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

Aim for at least 80% coverage across all metrics.

## Troubleshooting Tests

### Common Issues

1. **WebSocket Connection Failures**
   - Ensure the test server is running on port 3031
   - Check for port conflicts
   - Verify WebSocket URL format

2. **Timeout Errors**
   - Increase Jest timeout: `jest.setTimeout(10000)`
   - Check for missing `done()` calls in async tests
   - Verify event handlers are properly registered

3. **Mock Function Issues**
   - Ensure mocks are reset between tests
   - Verify mock implementation matches expected behavior
   - Check mock function parameters

### Debug Logging

Enable debug logging for tests:

```javascript
// At the top of your test file
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Use in tests
client.on('message', (data) => {
  debugLog('Received message:', data);
  // Test assertions
});
```

## Security Testing

### WebSocket Origin Restriction

Test that the server enforces WebSocket origin restrictions:

```javascript
test('should reject connections with invalid origin', (done) => {
  // Create WebSocket with invalid origin header
  const clientWithInvalidOrigin = new WebSocket('ws://localhost:3031', {
    headers: {
      'Origin': 'https://malicious-site.com'
    }
  });
  
  clientWithInvalidOrigin.on('error', (error) => {
    expect(error).toBeDefined();
    done();
  });
  
  // Should not connect
  clientWithInvalidOrigin.on('open', () => {
    fail('Should not connect with invalid origin');
    done();
  });
});
```

### Security Headers

Test that the server sends appropriate security headers:

```javascript
test('should set all required security headers', async () => {
  const response = await fetch('http://localhost:3031/health');
  
  // Content Security Policy
  expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  
  // Other security headers
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
  expect(response.headers.get('strict-transport-security')).toBeDefined();
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});
```

## Conclusion

This testing guide provides a comprehensive approach to testing the ALEJO bridge server. By following these practices, you can ensure reliable communication between Unreal Engine and ALEJO core modules while maintaining security, privacy, and accessibility requirements.

Remember to run these tests regularly during development and as part of your CI/CD pipeline to catch issues early.
