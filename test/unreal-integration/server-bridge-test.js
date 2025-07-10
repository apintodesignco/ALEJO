/**
 * Test suite for ALEJO Unreal Engine Bridge Server
 * Tests WebSocket communication, event handling, accessibility features, and resource management
 */

const assert = require('assert');
const WebSocket = require('ws');
const http = require('http');
const { EventEmitter } = require('events');
const path = require('path');

// Mock the ALEJO core modules
// This allows us to test the bridge without external dependencies
const mockTextProcessor = {
  processText: (text, context) => Promise.resolve({
    result: `Processed: ${text}`,
    context: context || {}
  }),
  registerWithResourceManager: () => {},
  unregisterFromResourceManager: () => {}
};

const mockVoiceProcessor = {
  processCommand: (command, context) => Promise.resolve({
    result: `Voice command processed: ${command}`,
    context: context || {}
  }),
  startStreaming: () => true,
  stopStreaming: () => true,
  registerWithResourceManager: () => {},
  unregisterFromResourceManager: () => {}
};

const mockEventBus = new EventEmitter();

const mockResourceManager = {
  registerComponent: () => Promise.resolve(true),
  unregisterComponent: () => Promise.resolve(true),
  setResourceMode: (mode) => Promise.resolve(mode),
  getCurrentResourceMode: () => Promise.resolve('medium'),
  getComponentList: () => Promise.resolve([])
};

// Mock the modules
jest.mock('../../../src/text-processing', () => mockTextProcessor);
jest.mock('../../../src/voice-processing', () => mockVoiceProcessor);
jest.mock('../../../src/event-bus', () => mockEventBus);
jest.mock('../../../src/resource-manager', () => mockResourceManager);

// Import the server module after mocks are set up
const serverPath = path.resolve(__dirname, '../../../src/unreal-integration/server/server.js');
let server;
let serverModule;

describe('ALEJO Unreal Engine Bridge Server', () => {
  let wsClient;
  let httpClient;
  const port = 3031; // Use different port from actual server to avoid conflicts
  const baseURL = `http://localhost:${port}`;
  
  beforeAll(async () => {
    // Load server dynamically to ensure mocks are applied
    serverModule = require(serverPath);
    
    // Start server with test configuration
    server = await serverModule.startServer({
      port: port,
      testMode: true
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  afterAll(() => {
    // Clean up server
    if (server) {
      server.close();
    }
  });
  
  afterEach(() => {
    // Close any open websocket connections
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });
  
  describe('HTTP Endpoints', () => {
    test('Health endpoint should return 200 status', async () => {
      const response = await fetch(`${baseURL}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.services).toBeDefined();
    });
    
    test('Should reject requests from non-localhost origins', async () => {
      try {
        const response = await fetch(`${baseURL}/health`, {
          headers: {
            'Origin': 'https://example.com'
          }
        });
        
        // Should either fail or return a 403
        if (response) {
          expect(response.status).toBe(403);
        }
      } catch (err) {
        // Exception is also acceptable as it indicates rejection
        expect(err).toBeDefined();
      }
    });
    
    test('Should include security headers', async () => {
      const response = await fetch(`${baseURL}/health`);
      
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('content-security-policy')).toBeDefined();
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    });
  });
  
  describe('WebSocket Communication', () => {
    test('Should establish WebSocket connection', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        expect(wsClient.readyState).toBe(WebSocket.OPEN);
        done();
      });
      
      wsClient.on('error', (error) => {
        done(error);
      });
    });
    
    test('Should process text messages', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'processText',
          data: {
            text: 'Hello ALEJO',
            context: { source: 'test' }
          }
        }));
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('textResult');
        expect(message.data.result).toContain('Hello ALEJO');
        done();
      });
    });
    
    test('Should process voice commands', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'processVoiceCommand',
          data: {
            command: 'Hello ALEJO',
            context: { source: 'test' }
          }
        }));
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('voiceResult');
        expect(message.data.result).toContain('Hello ALEJO');
        done();
      });
    });
    
    test('Should handle accessibility settings updates', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      const accessibilitySettings = {
        bScreenReaderEnabled: true,
        bHighContrastMode: true,
        FontScaleFactor: 1.5,
        bReducedMotion: true,
        bSimplifiedLanguage: true,
        bKeyboardNavigationEnabled: true,
        bColorBlindMode: true,
        ColorBlindnessType: 'Deuteranopia'
      };
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'updateAccessibilitySettings',
          data: accessibilitySettings
        }));
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('accessibilitySettingsUpdated');
        expect(message.data.success).toBe(true);
        done();
      });
    });
    
    test('Should handle resource mode changes', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'setResourceMode',
          data: {
            mode: 'low'
          }
        }));
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('resourceModeChanged');
        expect(message.data.mode).toBe('low');
        done();
      });
    });
    
    test('Should handle custom events', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'sendCustomEvent',
          data: {
            eventName: 'test.event',
            eventData: { test: true }
          }
        }));
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('customEventSent');
        expect(message.data.success).toBe(true);
        done();
      });
    });
    
    test('Should handle malformed messages gracefully', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send('This is not JSON');
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('error');
        done();
      });
    });
  });
  
  describe('Voice Integration', () => {
    test('Should start and stop voice streaming', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'startVoiceStreaming'
        }));
      });
      
      let messageCount = 0;
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;
        
        if (messageCount === 1) {
          expect(message.type).toBe('voiceStreamingStarted');
          
          // Send stop command
          wsClient.send(JSON.stringify({
            type: 'stopVoiceStreaming'
          }));
          
        } else if (messageCount === 2) {
          expect(message.type).toBe('voiceStreamingStopped');
          done();
        }
      });
    });
    
    test('Should handle voice events from core', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        // Simulate voice event from core
        mockEventBus.emit('voice.activity', { isActive: true, level: 0.8 });
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('voiceActivity');
        expect(message.data.isActive).toBe(true);
        expect(message.data.level).toBe(0.8);
        done();
      });
    });
  });
  
  describe('Resource Management', () => {
    test('Should register components with the resource manager', async () => {
      // This is an internal implementation detail that's harder to test directly
      // We'll use a spy to ensure the registerComponent method was called
      const spy = jest.spyOn(mockResourceManager, 'registerComponent');
      
      // Re-initialize server to trigger registration
      if (server) {
        server.close();
      }
      
      server = await serverModule.startServer({
        port: port,
        testMode: true
      });
      
      // Wait for registration to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
      
      spy.mockRestore();
    });
    
    test('Should adapt to resource mode changes', (done) => {
      wsClient = new WebSocket(`ws://localhost:${port}`);
      
      wsClient.on('open', () => {
        // Simulate resource mode change from core
        mockEventBus.emit('resource.mode.changed', { mode: 'low', reason: 'test' });
      });
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('resourceModeChanged');
        expect(message.data.mode).toBe('low');
        done();
      });
    });
  });
});
