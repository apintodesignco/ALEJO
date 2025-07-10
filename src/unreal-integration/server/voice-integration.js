/**
 * ALEJO Voice Integration for Unreal Engine
 * Connects Unreal Engine's voice input with ALEJO's voice command processing
 */

const path = require('path');
const { registerWithResourceManager, unregisterFromResourceManager, RESOURCE_PRIORITY } = 
    require('../../resource-manager');
const { processVoiceCommand } = require('../../personalization/voice/command-processor');
const { emitEvent, registerEventListener } = require('../../event-bus');

// Component identifiers for resource management
const COMPONENT_IDS = {
  VOICE_UNREAL_BRIDGE: 'alejo.unreal.voice_bridge',
  VOICE_STREAMING: 'alejo.unreal.voice_streaming'
};

// Track registration status
let isRegistered = false;
let resourceRegistrations = [];
let currentResourceMode = 'normal';

/**
 * Initialize voice integration
 * @param {Object} io - Socket.IO server instance
 */
function initializeVoiceIntegration(io) {
  // Register with resource manager
  registerWithResourceManager();

  // Set up voice command event handlers
  io.on('connection', (socket) => {
    // Handle incoming voice commands from Unreal Engine
    socket.on('voice.command', async (data) => {
      try {
        const { command, context = {} } = data;
        
        // Log the received command
        console.log(`[ALEJO Unreal] Voice command received: ${command}`);
        
        // Emit event for the voice system
        emitEvent('voice.command.received', { command, source: 'unreal', context });
        
        // Process command through ALEJO's voice command processor
        const result = await processVoiceCommand(command, context);
        
        // Send result back to Unreal Engine
        socket.emit('voice.response', { response: result.response, actions: result.actions || [] });
        
        // Log the response
        console.log(`[ALEJO Unreal] Voice response sent: ${result.response}`);
      } catch (error) {
        console.error('[ALEJO Unreal] Error processing voice command:', error);
        socket.emit('voice.error', { error: error.message });
      }
    });

    // Handle voice streaming (for real-time voice recognition)
    socket.on('voice.stream.start', () => {
      // Only enable voice streaming in normal or high resource modes
      if (currentResourceMode === 'low') {
        socket.emit('voice.stream.error', { 
          error: 'Voice streaming not available in low resource mode',
          resourceMode: currentResourceMode
        });
        return;
      }
      
      socket.emit('voice.stream.ready');
      console.log('[ALEJO Unreal] Voice streaming started');
    });
    
    socket.on('voice.stream.data', async (data) => {
      try {
        // Process streaming audio data through ALEJO's voice recognition
        // This is a stub - actual implementation would depend on voice recognition module
        // For now, just acknowledge receipt
        socket.emit('voice.stream.ack');
      } catch (error) {
        console.error('[ALEJO Unreal] Error processing voice stream:', error);
        socket.emit('voice.stream.error', { error: error.message });
      }
    });
    
    socket.on('voice.stream.stop', () => {
      console.log('[ALEJO Unreal] Voice streaming stopped');
      socket.emit('voice.stream.complete');
    });
  });

  // Set up listeners for voice system events to forward to Unreal Engine
  setupVoiceEventForwarding(io);
}

/**
 * Set up forwarding of ALEJO voice events to Unreal Engine
 * @param {Object} io - Socket.IO server instance
 */
function setupVoiceEventForwarding(io) {
  // Forward voice recognition events
  registerEventListener('voice.recognition.started', (data) => {
    io.emit('alejo.event', { type: 'voice.recognition.started', data });
  });
  
  registerEventListener('voice.recognition.completed', (data) => {
    io.emit('alejo.event', { type: 'voice.recognition.completed', data });
  });
  
  // Forward voice synthesis events
  registerEventListener('voice.synthesis.started', (data) => {
    io.emit('alejo.event', { type: 'voice.synthesis.started', data });
  });
  
  registerEventListener('voice.synthesis.completed', (data) => {
    io.emit('alejo.event', { type: 'voice.synthesis.completed', data });
  });
  
  // Forward accessibility-related voice events
  registerEventListener('voice.accessibility.announcement', (data) => {
    io.emit('alejo.event', { type: 'accessibility.announcement', data });
  });
}

/**
 * Register with ALEJO's Resource Allocation Manager
 */
function registerWithResourceManager() {
  if (isRegistered) return;
  
  // Register voice bridge (high priority for accessibility)
  const voiceBridgeReg = registerWithResourceManager(
    COMPONENT_IDS.VOICE_UNREAL_BRIDGE,
    RESOURCE_PRIORITY.HIGH, // High priority for accessibility
    (newMode) => handleResourceModeChange(newMode)
  );
  
  // Register voice streaming (medium priority)
  const voiceStreamingReg = registerWithResourceManager(
    COMPONENT_IDS.VOICE_STREAMING,
    RESOURCE_PRIORITY.MEDIUM,
    (newMode) => handleResourceModeChange(newMode)
  );
  
  resourceRegistrations.push(voiceBridgeReg, voiceStreamingReg);
  isRegistered = true;
  
  console.log('[ALEJO Unreal] Voice integration registered with Resource Manager');
}

/**
 * Unregister from ALEJO's Resource Allocation Manager
 */
function unregisterFromResourceManager() {
  if (!isRegistered) return;
  
  resourceRegistrations.forEach(reg => unregisterFromResourceManager(reg));
  resourceRegistrations = [];
  isRegistered = false;
  
  console.log('[ALEJO Unreal] Voice integration unregistered from Resource Manager');
}

/**
 * Handle changes in resource mode
 * @param {string} newMode - New resource mode ('low', 'normal', or 'high')
 */
function handleResourceModeChange(newMode) {
  const previousMode = currentResourceMode;
  currentResourceMode = newMode;
  
  console.log(`[ALEJO Unreal] Resource mode changed: ${previousMode} -> ${currentResourceMode}`);
  
  // Forward resource mode change to all connected clients
  emitEvent('resource.mode.changed', { previousMode, currentMode: newMode });
  
  // Apply resource mode-specific adaptations
  switch (newMode) {
    case 'low':
      // Disable streaming voice in low resource mode
      console.log('[ALEJO Unreal] Voice streaming disabled in low resource mode');
      break;
      
    case 'normal':
      // Enable basic voice features
      console.log('[ALEJO Unreal] Voice features enabled with standard quality');
      break;
      
    case 'high':
      // Enable all voice features with highest quality
      console.log('[ALEJO Unreal] All voice features enabled with highest quality');
      break;
  }
}

/**
 * Get current resource mode
 * @returns {string} Current resource mode
 */
function getCurrentResourceMode() {
  return currentResourceMode;
}

module.exports = {
  initializeVoiceIntegration,
  getCurrentResourceMode,
  registerWithResourceManager,
  unregisterFromResourceManager
};
