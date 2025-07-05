/**
 * ALEJO Unreal Engine UI Interaction Controller
 * 
 * This module handles voice commands and gesture interactions specifically for
 * controlling Unreal Engine UI components. It provides a unified interface for
 * multimodal interaction with the ALEJO interface.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Command types
const COMMAND_TYPES = {
  NAVIGATION: 'navigation',
  SELECTION: 'selection',
  MANIPULATION: 'manipulation',
  SYSTEM: 'system'
};

// Default configuration
const DEFAULT_CONFIG = {
  enableVoiceCommands: true,
  enableGestureControl: true,
  voiceCommandConfidence: 0.7,
  gestureConfidence: 0.8,
  commandDebounceTime: 300, // ms
  multimodalFusion: true, // Combine voice + gesture for enhanced accuracy
  accessibilityMode: false
};

/**
 * Initializes the UI interaction controller
 * @param {Object} unrealUIRenderer - The initialized Unreal UI renderer
 * @param {Object} config - Interaction controller configuration
 * @returns {Promise<Object>} - Initialized interaction controller
 */
export async function initializeInteractionController(unrealUIRenderer, config = {}) {
  console.log('Initializing ALEJO Unreal Engine UI interaction controller');
  
  // Merge with default configuration
  const controllerConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  // Command registry for voice and gesture commands
  const commandRegistry = new Map();
  
  // Last command timestamp for debouncing
  let lastCommandTime = 0;
  
  try {
    // Register default voice commands
    if (controllerConfig.enableVoiceCommands) {
      registerDefaultVoiceCommands(commandRegistry);
    }
    
    // Register default gesture controls
    if (controllerConfig.enableGestureControl) {
      registerDefaultGestureControls(commandRegistry);
    }
    
    // Set up event listeners
    setupEventListeners(unrealUIRenderer, commandRegistry, controllerConfig);
    
    // Create interaction controller object
    const controller = {
      // Configuration
      config: controllerConfig,
      
      /**
       * Registers a new voice command
       * @param {string} command - Voice command phrase or pattern
       * @param {Function} handler - Command handler function
       * @param {string} type - Command type from COMMAND_TYPES
       * @returns {string} - Command ID
       */
      registerVoiceCommand(command, handler, type = COMMAND_TYPES.MANIPULATION) {
        const id = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        commandRegistry.set(id, {
          id,
          type: 'voice',
          command,
          commandType: type,
          handler,
          pattern: createCommandPattern(command)
        });
        
        return id;
      },
      
      /**
       * Registers a new gesture control
       * @param {string} gesture - Gesture type
       * @param {Function} handler - Gesture handler function
       * @param {string} type - Command type from COMMAND_TYPES
       * @returns {string} - Command ID
       */
      registerGestureControl(gesture, handler, type = COMMAND_TYPES.MANIPULATION) {
        const id = `gesture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        commandRegistry.set(id, {
          id,
          type: 'gesture',
          gesture,
          commandType: type,
          handler
        });
        
        return id;
      },
      
      /**
       * Unregisters a command by ID
       * @param {string} id - Command ID
       * @returns {boolean} - Whether command was unregistered
       */
      unregisterCommand(id) {
        return commandRegistry.delete(id);
      },
      
      /**
       * Processes a voice command
       * @param {string} command - Voice command text
       * @param {Object} context - Command context
       * @returns {Promise<boolean>} - Whether command was handled
       */
      async processVoiceCommand(command, context = {}) {
        if (!controllerConfig.enableVoiceCommands) {
          return false;
        }
        
        // Check for debounce
        const now = Date.now();
        if (now - lastCommandTime < controllerConfig.commandDebounceTime) {
          return false;
        }
        
        // Find matching command handlers
        const matches = findMatchingVoiceCommands(command, commandRegistry);
        
        if (matches.length > 0) {
          // Sort by match quality
          matches.sort((a, b) => b.score - a.score);
          
          // Take the best match
          const bestMatch = matches[0];
          
          // Update last command time
          lastCommandTime = now;
          
          // Execute handler
          try {
            const result = await bestMatch.handler(command, bestMatch.params, context);
            
            // Publish command executed event
            publish('unreal:ui:voice:executed', {
              command,
              commandId: bestMatch.id,
              params: bestMatch.params,
              result
            });
            
            return true;
          } catch (error) {
            console.error('Error executing voice command handler:', error);
            return false;
          }
        }
        
        return false;
      },
      
      /**
       * Processes a gesture
       * @param {string} gesture - Gesture type
       * @param {Object} params - Gesture parameters
       * @param {Object} context - Gesture context
       * @returns {Promise<boolean>} - Whether gesture was handled
       */
      async processGesture(gesture, params = {}, context = {}) {
        if (!controllerConfig.enableGestureControl) {
          return false;
        }
        
        // Check for debounce
        const now = Date.now();
        if (now - lastCommandTime < controllerConfig.commandDebounceTime) {
          return false;
        }
        
        // Find matching gesture handlers
        const matches = [];
        for (const [id, entry] of commandRegistry.entries()) {
          if (entry.type === 'gesture' && entry.gesture === gesture) {
            matches.push({ id, handler: entry.handler, score: 1.0 });
          }
        }
        
        if (matches.length > 0) {
          // Update last command time
          lastCommandTime = now;
          
          // Execute all matching handlers
          let handled = false;
          for (const match of matches) {
            try {
              const result = await match.handler(gesture, params, context);
              if (result) {
                handled = true;
                
                // Publish gesture executed event
                publish('unreal:ui:gesture:executed', {
                  gesture,
                  commandId: match.id,
                  params,
                  result
                });
              }
            } catch (error) {
              console.error('Error executing gesture handler:', error);
            }
          }
          
          return handled;
        }
        
        return false;
      },
      
      /**
       * Updates the interaction controller configuration
       * @param {Object} newConfig - New configuration options
       */
      updateConfig(newConfig) {
        Object.assign(controllerConfig, newConfig);
        
        // Re-register default commands if needed
        if (newConfig.enableVoiceCommands !== undefined && 
            newConfig.enableVoiceCommands !== DEFAULT_CONFIG.enableVoiceCommands) {
          if (newConfig.enableVoiceCommands) {
            registerDefaultVoiceCommands(commandRegistry);
          } else {
            // Remove voice commands
            for (const [id, entry] of commandRegistry.entries()) {
              if (entry.type === 'voice') {
                commandRegistry.delete(id);
              }
            }
          }
        }
        
        if (newConfig.enableGestureControl !== undefined && 
            newConfig.enableGestureControl !== DEFAULT_CONFIG.enableGestureControl) {
          if (newConfig.enableGestureControl) {
            registerDefaultGestureControls(commandRegistry);
          } else {
            // Remove gesture controls
            for (const [id, entry] of commandRegistry.entries()) {
              if (entry.type === 'gesture') {
                commandRegistry.delete(id);
              }
            }
          }
        }
      },
      
      /**
       * Gets all registered commands
       * @returns {Array<Object>} - Registered commands
       */
      getRegisteredCommands() {
        return Array.from(commandRegistry.values()).map(entry => ({
          id: entry.id,
          type: entry.type,
          commandType: entry.commandType,
          command: entry.command || entry.gesture
        }));
      },
      
      /**
       * Shuts down the interaction controller
       */
      shutdown() {
        console.log('Shutting down Unreal Engine UI interaction controller');
        
        // Clear command registry
        commandRegistry.clear();
        
        // Unsubscribe from events
        unsubscribeFromEvents();
      }
    };
    
    // Publish initialization success event
    publish('unreal:ui:interaction:initialized', { controller });
    
    return controller;
  } catch (error) {
    console.error('Failed to initialize Unreal Engine UI interaction controller:', error);
    publish('unreal:ui:interaction:error', { error });
    throw error;
  }
}

/**
 * Sets up event listeners for the interaction controller
 * @param {Object} unrealUIRenderer - Unreal UI renderer
 * @param {Map<string, Object>} commandRegistry - Command registry
 * @param {Object} config - Interaction controller configuration
 */
function setupEventListeners(unrealUIRenderer, commandRegistry, config) {
  // Listen for voice command events
  if (config.enableVoiceCommands) {
    subscribe('voice:command:detected', async (event) => {
      const command = event.command;
      const confidence = event.confidence || 1.0;
      
      // Check confidence threshold
      if (confidence >= config.voiceCommandConfidence) {
        // Find matching commands
        const matches = findMatchingVoiceCommands(command, commandRegistry);
        
        if (matches.length > 0) {
          // Sort by match quality
          matches.sort((a, b) => b.score - a.score);
          
          // Take the best match
          const bestMatch = matches[0];
          
          // Execute handler
          try {
            await bestMatch.handler(command, bestMatch.params, {
              confidence,
              source: 'voice:command:detected'
            });
            
            // Publish command executed event
            publish('unreal:ui:voice:executed', {
              command,
              commandId: bestMatch.id,
              params: bestMatch.params
            });
          } catch (error) {
            console.error('Error executing voice command handler:', error);
          }
        }
      }
    });
  }
  
  // Listen for gesture events
  if (config.enableGestureControl) {
    subscribe('gesture:detected', async (event) => {
      const gesture = event.gesture;
      const confidence = event.confidence || 1.0;
      const params = event.params || {};
      
      // Check confidence threshold
      if (confidence >= config.gestureConfidence) {
        // Find matching gesture handlers
        const matches = [];
        for (const [id, entry] of commandRegistry.entries()) {
          if (entry.type === 'gesture' && entry.gesture === gesture) {
            matches.push({ id, handler: entry.handler });
          }
        }
        
        // Execute all matching handlers
        for (const match of matches) {
          try {
            await match.handler(gesture, params, {
              confidence,
              source: 'gesture:detected'
            });
            
            // Publish gesture executed event
            publish('unreal:ui:gesture:executed', {
              gesture,
              commandId: match.id,
              params
            });
          } catch (error) {
            console.error('Error executing gesture handler:', error);
          }
        }
      }
    });
  }
  
  // Listen for multimodal fusion events if enabled
  if (config.multimodalFusion) {
    // Track recent voice commands and gestures for fusion
    const recentEvents = {
      voice: null,
      gesture: null
    };
    
    // Voice event listener for fusion
    subscribe('voice:command:detected', (event) => {
      recentEvents.voice = {
        command: event.command,
        confidence: event.confidence || 1.0,
        timestamp: Date.now()
      };
      
      // Check for fusion opportunity
      checkForMultimodalFusion(recentEvents, unrealUIRenderer, config);
    });
    
    // Gesture event listener for fusion
    subscribe('gesture:detected', (event) => {
      recentEvents.gesture = {
        gesture: event.gesture,
        params: event.params || {},
        confidence: event.confidence || 1.0,
        timestamp: Date.now()
      };
      
      // Check for fusion opportunity
      checkForMultimodalFusion(recentEvents, unrealUIRenderer, config);
    });
  }
}

/**
 * Checks for multimodal fusion opportunities
 * @param {Object} recentEvents - Recent voice and gesture events
 * @param {Object} unrealUIRenderer - Unreal UI renderer
 * @param {Object} config - Interaction controller configuration
 */
function checkForMultimodalFusion(recentEvents, unrealUIRenderer, config) {
  // Only proceed if we have both voice and gesture events
  if (!recentEvents.voice || !recentEvents.gesture) {
    return;
  }
  
  // Check if events are close enough in time (within 1.5 seconds)
  const timeDiff = Math.abs(recentEvents.voice.timestamp - recentEvents.gesture.timestamp);
  if (timeDiff > 1500) {
    return;
  }
  
  // Look for specific fusion patterns
  const voiceCommand = recentEvents.voice.command.toLowerCase();
  const gesture = recentEvents.gesture.gesture;
  
  // Example fusion: "select this" + pointing gesture
  if ((voiceCommand.includes('select') || voiceCommand.includes('click') || 
       voiceCommand.includes('this') || voiceCommand.includes('that')) && 
      (gesture === 'point' || gesture === 'tap')) {
    
    // Get pointing coordinates
    const coordinates = recentEvents.gesture.params.coordinates || { x: 0, y: 0, z: 0 };
    
    // Send fusion event
    publish('unreal:ui:multimodal:fusion', {
      type: 'selection',
      voice: recentEvents.voice,
      gesture: recentEvents.gesture,
      coordinates,
      confidence: (recentEvents.voice.confidence + recentEvents.gesture.confidence) / 2
    });
    
    // Clear recent events to prevent duplicate fusions
    recentEvents.voice = null;
    recentEvents.gesture = null;
  }
  
  // Example fusion: "move this" + grab gesture
  else if ((voiceCommand.includes('move') || voiceCommand.includes('drag')) && 
           (gesture === 'grab' || gesture === 'pinch')) {
    
    // Get grab coordinates
    const coordinates = recentEvents.gesture.params.coordinates || { x: 0, y: 0, z: 0 };
    
    // Send fusion event
    publish('unreal:ui:multimodal:fusion', {
      type: 'manipulation',
      action: 'move',
      voice: recentEvents.voice,
      gesture: recentEvents.gesture,
      coordinates,
      confidence: (recentEvents.voice.confidence + recentEvents.gesture.confidence) / 2
    });
    
    // Clear recent events to prevent duplicate fusions
    recentEvents.voice = null;
    recentEvents.gesture = null;
  }
  
  // Example fusion: "resize this" + pinch/spread gesture
  else if (voiceCommand.includes('resize') && 
           (gesture === 'pinch' || gesture === 'spread')) {
    
    // Get gesture parameters
    const params = recentEvents.gesture.params;
    
    // Send fusion event
    publish('unreal:ui:multimodal:fusion', {
      type: 'manipulation',
      action: 'resize',
      voice: recentEvents.voice,
      gesture: recentEvents.gesture,
      scale: gesture === 'spread' ? 1.1 : 0.9,
      params,
      confidence: (recentEvents.voice.confidence + recentEvents.gesture.confidence) / 2
    });
    
    // Clear recent events to prevent duplicate fusions
    recentEvents.voice = null;
    recentEvents.gesture = null;
  }
}

/**
 * Unsubscribes from events
 */
function unsubscribeFromEvents() {
  // In a real implementation, we would store subscription tokens and unsubscribe
  // For now, we rely on the event bus to handle cleanup
}

/**
 * Registers default voice commands
 * @param {Map<string, Object>} commandRegistry - Command registry
 */
function registerDefaultVoiceCommands(commandRegistry) {
  // Navigation commands
  registerCommand(
    commandRegistry,
    'voice',
    'open menu',
    async (command, params, context) => {
      publish('unreal:ui:action', { action: 'openMenu', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    'close menu',
    async (command, params, context) => {
      publish('unreal:ui:action', { action: 'closeMenu', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    'go back',
    async (command, params, context) => {
      publish('unreal:ui:action', { action: 'goBack', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    'go home',
    async (command, params, context) => {
      publish('unreal:ui:action', { action: 'goHome', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  // Selection commands
  registerCommand(
    commandRegistry,
    'voice',
    'select (this|that|item|option) {number}',
    async (command, params, context) => {
      const itemNumber = params.number ? parseInt(params.number) : null;
      publish('unreal:ui:action', { 
        action: 'select', 
        params: { itemNumber } 
      });
      return true;
    },
    COMMAND_TYPES.SELECTION
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    'click (here|there)',
    async (command, params, context) => {
      publish('unreal:ui:action', { action: 'click', params });
      return true;
    },
    COMMAND_TYPES.SELECTION
  );
  
  // Manipulation commands
  registerCommand(
    commandRegistry,
    'voice',
    'scroll (up|down)',
    async (command, params, context) => {
      const direction = command.includes('up') ? 'up' : 'down';
      publish('unreal:ui:action', { 
        action: 'scroll', 
        params: { direction } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    '(increase|decrease) size',
    async (command, params, context) => {
      const action = command.includes('increase') ? 'increaseSize' : 'decreaseSize';
      publish('unreal:ui:action', { action, params });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  // System commands
  registerCommand(
    commandRegistry,
    'voice',
    'change theme to {theme}',
    async (command, params, context) => {
      publish('unreal:ui:action', { 
        action: 'changeTheme', 
        params: { theme: params.theme } 
      });
      return true;
    },
    COMMAND_TYPES.SYSTEM
  );
  
  registerCommand(
    commandRegistry,
    'voice',
    'toggle (high contrast|dark mode)',
    async (command, params, context) => {
      const feature = command.includes('high contrast') ? 'highContrast' : 'darkMode';
      publish('unreal:ui:action', { 
        action: 'toggleAccessibility', 
        params: { feature } 
      });
      return true;
    },
    COMMAND_TYPES.SYSTEM
  );
}

/**
 * Registers default gesture controls
 * @param {Map<string, Object>} commandRegistry - Command registry
 */
function registerDefaultGestureControls(commandRegistry) {
  // Navigation gestures
  registerCommand(
    commandRegistry,
    'gesture',
    'swipe_left',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { action: 'goBack', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'swipe_right',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { action: 'goForward', params });
      return true;
    },
    COMMAND_TYPES.NAVIGATION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'swipe_up',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'scroll', 
        params: { direction: 'down' } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'swipe_down',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'scroll', 
        params: { direction: 'up' } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  // Selection gestures
  registerCommand(
    commandRegistry,
    'gesture',
    'tap',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'click', 
        params: { 
          coordinates: params.coordinates || { x: 0, y: 0, z: 0 } 
        } 
      });
      return true;
    },
    COMMAND_TYPES.SELECTION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'double_tap',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'doubleClick', 
        params: { 
          coordinates: params.coordinates || { x: 0, y: 0, z: 0 } 
        } 
      });
      return true;
    },
    COMMAND_TYPES.SELECTION
  );
  
  // Manipulation gestures
  registerCommand(
    commandRegistry,
    'gesture',
    'pinch',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'zoomOut', 
        params: { 
          scale: params.scale || 0.9,
          coordinates: params.coordinates || { x: 0, y: 0, z: 0 } 
        } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'spread',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'zoomIn', 
        params: { 
          scale: params.scale || 1.1,
          coordinates: params.coordinates || { x: 0, y: 0, z: 0 } 
        } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
  
  registerCommand(
    commandRegistry,
    'gesture',
    'rotate',
    async (gesture, params, context) => {
      publish('unreal:ui:action', { 
        action: 'rotate', 
        params: { 
          angle: params.angle || 0,
          coordinates: params.coordinates || { x: 0, y: 0, z: 0 } 
        } 
      });
      return true;
    },
    COMMAND_TYPES.MANIPULATION
  );
}

/**
 * Registers a command in the registry
 * @param {Map<string, Object>} registry - Command registry
 * @param {string} type - Command type ('voice' or 'gesture')
 * @param {string} command - Command pattern or gesture type
 * @param {Function} handler - Command handler
 * @param {string} commandType - Command category
 * @returns {string} - Command ID
 */
function registerCommand(registry, type, command, handler, commandType) {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (type === 'voice') {
    registry.set(id, {
      id,
      type,
      command,
      commandType,
      handler,
      pattern: createCommandPattern(command)
    });
  } else {
    registry.set(id, {
      id,
      type,
      gesture: command,
      commandType,
      handler
    });
  }
  
  return id;
}

/**
 * Creates a regex pattern from a command template
 * @param {string} command - Command template
 * @returns {Object} - Command pattern object
 */
function createCommandPattern(command) {
  // Replace parameter placeholders with capture groups
  let pattern = command.replace(/\{(\w+)\}/g, '(?<$1>[\\w\\s]+)');
  
  // Handle optional words
  pattern = pattern.replace(/\(([^|)]+)\|([^)]+)\)/g, '(?:$1|$2)');
  
  // Create regex
  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * Finds matching voice commands for a given input
 * @param {string} input - Voice input
 * @param {Map<string, Object>} registry - Command registry
 * @returns {Array<Object>} - Matching commands with scores
 */
function findMatchingVoiceCommands(input, registry) {
  const matches = [];
  
  // Normalize input
  const normalizedInput = input.toLowerCase().trim();
  
  // Check each voice command
  for (const [id, entry] of registry.entries()) {
    if (entry.type !== 'voice') {
      continue;
    }
    
    // Try exact match first
    if (entry.pattern.test(normalizedInput)) {
      // Extract parameters
      const match = normalizedInput.match(entry.pattern);
      const params = match.groups || {};
      
      matches.push({
        id,
        handler: entry.handler,
        score: 1.0,
        params
      });
    }
    // Try partial match
    else if (normalizedInput.includes(entry.command.toLowerCase())) {
      matches.push({
        id,
        handler: entry.handler,
        score: 0.8,
        params: {}
      });
    }
    // Try fuzzy match for commands with similar words
    else {
      const commandWords = entry.command.toLowerCase().split(/\s+/);
      const inputWords = normalizedInput.split(/\s+/);
      
      // Count matching words
      let matchingWords = 0;
      for (const word of inputWords) {
        if (commandWords.includes(word)) {
          matchingWords++;
        }
      }
      
      // Calculate match score
      const score = matchingWords / Math.max(commandWords.length, inputWords.length);
      
      // Add if score is above threshold
      if (score > 0.6) {
        matches.push({
          id,
          handler: entry.handler,
          score,
          params: {}
        });
      }
    }
  }
  
  return matches;
}

export default {
  initializeInteractionController,
  COMMAND_TYPES
};
