/**
 * ALEJO Unreal Engine Integration - Backend Bridge Server
 * This server provides a bridge between ALEJO core functionality and Unreal Engine UI
 * 
 * Features:
 * - Exposes ALEJO functionality via WebSocket
 * - Handles resource allocation for ALEJO components
 * - Forwards events between ALEJO and Unreal Engine
 * - Prioritizes accessibility features
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { registerWithResourceManager, unregisterFromResourceManager, RESOURCE_PRIORITY } = require('../../resource-manager');
const { emitEvent, registerEventListener } = require('../../event-bus');
const textProcessor = require('../../text-processing');
const voiceProcessor = require('../../personalization/voice');
const securityManager = require('../../security-manager');
const { initializeVoiceIntegration } = require('./voice-integration');
const { ResourceAllocationManager } = require('../../core/resource/resource-manager');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:*", // Allow only local connections
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "localhost:*", "ws://localhost:*"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:*', // Only allow local origins
  credentials: true
}));

// Track connection state
let unrealConnected = false;
let eventBus = null;

// Initialize ALEJO core components needed for the bridge
async function initializeCore() {
  try {
    // Initialize event bus for inter-module communication
    eventBus = getEventBus();
    
    // Register with resource manager
    ResourceAllocationManager.registerComponent(
      'unreal-bridge-server',
      'Core system component that bridges ALEJO with Unreal Engine UI',
      3, // Medium-high priority
      onResourceModeChange
    );
    
    // Log successful initialization
    console.log('ALEJO core components initialized for Unreal bridge');
    return true;
  } catch (error) {
    console.error('Failed to initialize ALEJO core components:', error);
    return false;
  }
}

// Handle resource mode changes
function onResourceModeChange(newMode) {
  console.log(`Resource mode changed to ${newMode}, adapting Unreal bridge operation`);
  // Emit resource mode change to Unreal Engine
  if (unrealConnected) {
    io.emit('resource-mode-change', { mode: newMode });
  }
}

// API Routes
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    resourceMode: currentResourceMode,
    version: '1.0.0',
    services: {
      voice: true,
      text: true,
      accessibility: true
    }
  });
});

// Socket.IO Connection handling
io.on('connection', (socket) => {
  console.log('Unreal Engine client connected');
  unrealConnected = true;
  
  // Notify client of successful connection
  socket.emit('connect.success', {
    status: 'connected',
    resourceMode: currentResourceMode,
    serverTime: Date.now()
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Unreal Engine client disconnected');
    unrealConnected = false;
  });
  
  // Handle text processing requests
  socket.on('text.process', async (data) => {
    try {
      const result = await textProcessor.processText(data.text, data.context || {});
      socket.emit('text.response', result);
      
      // Log for analytics while respecting privacy
      console.log(`Text processed (length: ${data.text.length})`);
    } catch (error) {
      console.error('Error processing text:', error);
      socket.emit('error', { message: error.message, type: 'text.error' });
    }
  });
  
  // Handle voice command requests
  socket.on('voice.process', async (data) => {
    try {
      const result = await voiceProcessor.processVoiceCommand(data.command, data.context || {});
      socket.emit('voice.response', result);
      
      // Log for analytics while respecting privacy
      console.log(`Voice command processed (length: ${data.command.length})`);
    } catch (error) {
      console.error('Error processing voice command:', error);
      socket.emit('error', { message: error.message, type: 'voice.error' });
    }
  });
  
  // Register event forwarding from ALEJO's event bus to Unreal Engine
  if (eventBus) {
    // Set up event forwarding
    function setupEventForwarding() {
      // Forward ALEJO events to Unreal Engine
      registerEventListener('*', (eventType, eventData) => {
        // Don't forward internal system events
        if (eventType.startsWith('system.') || eventType.startsWith('debug.')) {
          return;
        }
        
        io.emit('alejo.event', { type: eventType, data: eventData });
      });
    }
    setupEventForwarding();
  }
  
  // Listen for events from Unreal Engine that need to be forwarded to ALEJO
  socket.on('unreal-event', async (data) => {
    if (eventBus && data && data.type) {
      // Forward the event to ALEJO's event bus
      eventBus.emit(data.type, data.data);
    }
  });
  
  // Handle accessibility settings updates
  socket.on('accessibility.update', (data) => {
    try {
      // Validate the accessibility settings object
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid accessibility settings format');
      }
      
      emitEvent('accessibility.settings.updated', data);
      socket.emit('accessibility.updated', { success: true });
      
      // Log accessibility setting update without logging actual settings (privacy)
      console.log('Accessibility settings updated');
    } catch (error) {
      console.error('Error updating accessibility settings:', error);
      socket.emit('error', { message: error.message, type: 'accessibility.error' });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3030;

// Initialize core components then start server
initializeCore().then(success => {
  if (success) {
    server.listen(PORT, () => {
      console.log(`ALEJO Unreal Engine bridge server running on port ${PORT}`);
      registerWithResourceManagement();
      setupEventForwarding();
      
      // Initialize voice integration with Socket.IO instance
      initializeVoiceIntegration(io);
      console.log('Voice integration initialized');
    });
  } else {
    console.error('Failed to initialize core components, server not started');
    process.exit(1);
  }
});

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('Shutting down ALEJO Unreal Bridge Server...');
  
  // Unregister from resource manager
  ResourceAllocationManager.unregisterComponent('unreal-bridge-server');
  
  // Close server connections
  server.close(() => {
    console.log('Server connections closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 5000);
}
