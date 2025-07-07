/**
 * ALEJO Multimodal Fusion System
 * 
 * This module integrates multiple input modalities (eye tracking, gestures, voice, etc.)
 * to provide a unified and adaptive interaction system for users with varying abilities.
 * 
 * Features:
 * - Dynamic input prioritization based on user capabilities
 * - Context-aware modality switching
 * - Confidence-based input fusion
 * - Conflict resolution between modalities
 * - Adaptive feedback mechanisms
 * 
 * @module personalization/accessibility/multimodal-fusion
 */

import { publish, subscribe, unsubscribe } from '../../events.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('multimodal-fusion');

// Module state
let initialized = false;
let activeModalities = {
  eye: false,
  gesture: false,
  voice: false,
  switch: false,
  touch: false
};

// Configuration
let config = {
  // Default priorities (higher number = higher priority)
  defaultPriorities: {
    eye: 3,
    gesture: 4,
    voice: 2,
    switch: 1,
    touch: 5
  },
  // Confidence thresholds for each modality (0-1)
  confidenceThresholds: {
    eye: 0.6,
    gesture: 0.7,
    voice: 0.8,
    switch: 0.9,
    touch: 0.5
  },
  // Fusion strategy: 'priority', 'confidence', 'weighted', 'voting'
  fusionStrategy: 'weighted',
  // Context awareness
  contextAwareness: true,
  // Conflict resolution timeout (ms)
  conflictTimeout: 1000,
  // Debug mode
  debug: false
};

// Current user profile
let userProfile = {
  hasLimitedMobility: false,
  canUseHands: true,
  canUseVoice: true,
  canUseEyes: true,
  preferredInputMethod: 'gesture',
  // Custom priorities based on user capabilities
  priorities: { ...config.defaultPriorities }
};

// Input buffers for fusion
const inputBuffers = {
  eye: [],
  gesture: [],
  voice: [],
  switch: [],
  touch: []
};

// Maximum buffer size
const MAX_BUFFER_SIZE = 10;

// Timeout IDs for conflict resolution
const timeoutIds = {};

/**
 * Initialize the multimodal fusion system
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
async function initialize(options = {}) {
  try {
    logger.info('Initializing multimodal fusion system');
    
    // Update configuration
    config = {
      ...config,
      ...options
    };
    
    // Subscribe to input events
    subscribe('eye:gaze:updated', handleEyeInput);
    subscribe('eye:dwell:completed', handleEyeAction);
    subscribe('gesture:detected', handleGestureInput);
    subscribe('voice:command:detected', handleVoiceInput);
    subscribe('switch:activated', handleSwitchInput);
    subscribe('touch:detected', handleTouchInput);
    
    // Subscribe to modality status events
    subscribe('eye:system:status', updateModalityStatus('eye'));
    subscribe('gesture:system:status', updateModalityStatus('gesture'));
    subscribe('voice:system:status', updateModalityStatus('voice'));
    subscribe('switch:system:status', updateModalityStatus('switch'));
    subscribe('touch:system:status', updateModalityStatus('touch'));
    
    // Subscribe to user profile updates
    subscribe('accessibility:mobility:profile_updated', handleProfileUpdate);
    subscribe('settings:updated:accessibility', handleAccessibilitySettingsUpdate);
    
    // Subscribe to context changes
    subscribe('system:context:changed', handleContextChange);
    
    // Request current user profile
    requestUserProfile();
    
    initialized = true;
    logger.info('Multimodal fusion system initialized');
    
    // Publish initialization event
    publish('accessibility:multimodal:initialized', { timestamp: Date.now() });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize multimodal fusion system', error);
    return false;
  }
}

/**
 * Request current user profile from settings
 */
function requestUserProfile() {
  publish('settings:request', {
    category: 'accessibility',
    key: 'mobilityProfile',
    callback: (profile) => {
      if (profile) {
        handleProfileUpdate({ profile });
      }
    }
  });
}

/**
 * Update modality status
 * @param {string} modality - Modality name
 * @returns {Function} - Event handler
 */
function updateModalityStatus(modality) {
  return (data) => {
    if (data && typeof data.active === 'boolean') {
      activeModalities[modality] = data.active;
      logger.debug(`${modality} modality is now ${data.active ? 'active' : 'inactive'}`);
    }
  };
}

/**
 * Handle eye tracking input
 * @param {Object} data - Eye tracking data
 */
function handleEyeInput(data) {
  if (!initialized || !activeModalities.eye) return;
  
  // Add to buffer
  addToBuffer('eye', {
    type: 'gaze',
    x: data.x,
    y: data.y,
    confidence: data.confidence,
    timestamp: data.timestamp
  });
}

/**
 * Handle eye action (e.g., dwell click)
 * @param {Object} data - Eye action data
 */
function handleEyeAction(data) {
  if (!initialized || !activeModalities.eye) return;
  
  // Process as a command
  processCommand({
    modality: 'eye',
    type: 'click',
    position: { x: data.x, y: data.y },
    confidence: 0.9, // Dwell clicks have high confidence
    timestamp: data.timestamp
  });
}

/**
 * Handle gesture input
 * @param {Object} data - Gesture data
 */
function handleGestureInput(data) {
  if (!initialized || !activeModalities.gesture) return;
  
  // Add to buffer
  addToBuffer('gesture', {
    type: data.type,
    name: data.name,
    confidence: data.confidence,
    timestamp: data.timestamp
  });
  
  // Process as a command if confidence is high enough
  if (data.confidence >= config.confidenceThresholds.gesture) {
    processCommand({
      modality: 'gesture',
      type: data.type,
      name: data.name,
      confidence: data.confidence,
      timestamp: data.timestamp
    });
  }
}

/**
 * Handle voice input
 * @param {Object} data - Voice command data
 */
function handleVoiceInput(data) {
  if (!initialized || !activeModalities.voice) return;
  
  // Add to buffer
  addToBuffer('voice', {
    command: data.command,
    confidence: data.confidence,
    timestamp: data.timestamp
  });
  
  // Process as a command if confidence is high enough
  if (data.confidence >= config.confidenceThresholds.voice) {
    processCommand({
      modality: 'voice',
      type: 'command',
      command: data.command,
      confidence: data.confidence,
      timestamp: data.timestamp
    });
  }
}

/**
 * Handle switch input
 * @param {Object} data - Switch data
 */
function handleSwitchInput(data) {
  if (!initialized || !activeModalities.switch) return;
  
  // Process immediately (switches are usually binary and intentional)
  processCommand({
    modality: 'switch',
    type: 'switch',
    id: data.id,
    state: data.state,
    confidence: 1.0,
    timestamp: data.timestamp
  });
}

/**
 * Handle touch input
 * @param {Object} data - Touch data
 */
function handleTouchInput(data) {
  if (!initialized || !activeModalities.touch) return;
  
  // Process immediately (touches are usually intentional)
  processCommand({
    modality: 'touch',
    type: data.type, // 'tap', 'swipe', etc.
    position: data.position,
    confidence: 0.95,
    timestamp: data.timestamp
  });
}

/**
 * Add input to modality buffer
 * @param {string} modality - Modality name
 * @param {Object} data - Input data
 */
function addToBuffer(modality, data) {
  // Add to buffer
  inputBuffers[modality].push(data);
  
  // Trim buffer if needed
  if (inputBuffers[modality].length > MAX_BUFFER_SIZE) {
    inputBuffers[modality].shift();
  }
}

/**
 * Process a command from any modality
 * @param {Object} command - Command data
 */
function processCommand(command) {
  // Skip if confidence is below threshold
  if (command.confidence < config.confidenceThresholds[command.modality]) {
    logger.debug(`${command.modality} command rejected due to low confidence: ${command.confidence}`);
    return;
  }
  
  // Check for conflicts with recent commands
  const conflictingCommand = checkForConflicts(command);
  
  if (conflictingCommand) {
    // Handle conflict
    resolveConflict(command, conflictingCommand);
  } else {
    // No conflict, execute command
    executeCommand(command);
  }
}

/**
 * Check for conflicts with recent commands from other modalities
 * @param {Object} command - Current command
 * @returns {Object|null} - Conflicting command or null
 */
function checkForConflicts(command) {
  // Look for recent commands (within conflict timeout) that might conflict
  const now = Date.now();
  const conflictWindow = now - config.conflictTimeout;
  
  // Check all modalities except the current one
  for (const modality in inputBuffers) {
    if (modality === command.modality) continue;
    
    // Look for recent commands in this modality
    const recentCommands = inputBuffers[modality].filter(input => 
      input.timestamp >= conflictWindow
    );
    
    // Check if any command conflicts with the current one
    for (const recentCommand of recentCommands) {
      if (commandsConflict(command, { ...recentCommand, modality })) {
        return { ...recentCommand, modality };
      }
    }
  }
  
  return null;
}

/**
 * Determine if two commands conflict
 * @param {Object} cmd1 - First command
 * @param {Object} cmd2 - Second command
 * @returns {boolean} - True if commands conflict
 */
function commandsConflict(cmd1, cmd2) {
  // Simple implementation - commands of the same type might conflict
  // A more sophisticated implementation would check semantics
  return cmd1.type === cmd2.type;
}

/**
 * Resolve conflict between commands
 * @param {Object} newCommand - New command
 * @param {Object} existingCommand - Existing command
 */
function resolveConflict(newCommand, existingCommand) {
  logger.debug(`Resolving conflict between ${newCommand.modality} and ${existingCommand.modality} commands`);
  
  // Get priorities
  const newPriority = userProfile.priorities[newCommand.modality];
  const existingPriority = userProfile.priorities[existingCommand.modality];
  
  // Compare priorities
  if (newPriority > existingPriority) {
    // New command has higher priority
    logger.debug(`${newCommand.modality} command takes precedence (higher priority)`);
    executeCommand(newCommand);
  } else if (newPriority < existingPriority) {
    // Existing command has higher priority
    logger.debug(`${existingCommand.modality} command retained (higher priority)`);
    // Do nothing, existing command already executed
  } else {
    // Equal priority, use confidence
    if (newCommand.confidence > existingCommand.confidence) {
      logger.debug(`${newCommand.modality} command takes precedence (higher confidence)`);
      executeCommand(newCommand);
    } else {
      logger.debug(`${existingCommand.modality} command retained (higher or equal confidence)`);
      // Do nothing, existing command already executed
    }
  }
}

/**
 * Execute a command
 * @param {Object} command - Command to execute
 */
function executeCommand(command) {
  logger.info(`Executing ${command.modality} command: ${JSON.stringify(command)}`);
  
  // Publish the command for other modules to handle
  publish('accessibility:multimodal:command', {
    ...command,
    processed: true,
    timestamp: Date.now()
  });
  
  // Specific handling based on command type
  switch (command.type) {
    case 'click':
      publish('ui:action:click', {
        x: command.position.x,
        y: command.position.y,
        source: command.modality,
        timestamp: command.timestamp
      });
      break;
      
    case 'swipe':
      publish('ui:action:swipe', {
        direction: command.direction,
        source: command.modality,
        timestamp: command.timestamp
      });
      break;
      
    case 'command':
      publish('system:command:execute', {
        command: command.command,
        source: command.modality,
        timestamp: command.timestamp
      });
      break;
      
    default:
      // Generic command handling
      publish(`${command.modality}:command:executed`, command);
  }
}

/**
 * Handle user profile updates
 * @param {Object} data - Profile data
 */
function handleProfileUpdate(data) {
  if (!data || !data.profile) return;
  
  const profile = data.profile;
  
  // Update user profile
  userProfile = {
    ...userProfile,
    hasLimitedMobility: profile.hasLimitedMobility || false,
    canUseHands: profile.canUseHands !== undefined ? profile.canUseHands : true,
    canUseVoice: profile.canUseVoice !== undefined ? profile.canUseVoice : true,
    canUseEyes: profile.canUseEyes !== undefined ? profile.canUseEyes : true,
    preferredInputMethod: profile.preferredInputMethod || 'gesture'
  };
  
  // Update priorities based on user capabilities
  updatePriorities();
  
  logger.info('User profile updated, priorities adjusted');
  
  if (config.debug) {
    logger.debug('Updated user profile:', userProfile);
    logger.debug('Updated priorities:', userProfile.priorities);
  }
}

/**
 * Handle accessibility settings updates
 * @param {Object} data - Settings data
 */
function handleAccessibilitySettingsUpdate(data) {
  if (!data) return;
  
  // Check for multimodal fusion settings
  if (data.multimodalFusion) {
    // Update configuration
    config = {
      ...config,
      ...data.multimodalFusion
    };
    
    logger.info('Multimodal fusion settings updated');
  }
  
  // Check for mobility profile
  if (data.mobilityProfile) {
    handleProfileUpdate({ profile: data.mobilityProfile });
  }
}

/**
 * Update input priorities based on user capabilities
 */
function updatePriorities() {
  // Start with default priorities
  const priorities = { ...config.defaultPriorities };
  
  // Adjust based on user capabilities
  if (!userProfile.canUseHands) {
    // Can't use hands, lower gesture and touch priority
    priorities.gesture = 1;
    priorities.touch = 1;
    
    // Increase eye and voice priority
    priorities.eye = 5;
    priorities.voice = 4;
  } else if (userProfile.hasLimitedMobility) {
    // Limited mobility, adjust gesture priority
    priorities.gesture = 3;
    
    // Slightly increase eye and voice priority
    priorities.eye = 4;
    priorities.voice = 3;
  }
  
  // Adjust based on preferred input method
  if (userProfile.preferredInputMethod) {
    // Boost the preferred method
    priorities[userProfile.preferredInputMethod] += 1;
  }
  
  // Update user profile priorities
  userProfile.priorities = priorities;
}

/**
 * Handle context changes
 * @param {Object} data - Context data
 */
function handleContextChange(data) {
  if (!config.contextAwareness || !data || !data.context) return;
  
  const { context } = data;
  
  // Adjust priorities based on context
  const tempPriorities = { ...userProfile.priorities };
  
  switch (context) {
    case 'driving':
      // Prioritize voice and eye tracking when driving
      tempPriorities.voice += 2;
      tempPriorities.eye += 1;
      tempPriorities.gesture -= 1;
      tempPriorities.touch -= 2;
      break;
      
    case 'meeting':
      // Prioritize gesture and touch in meetings (less disruptive)
      tempPriorities.gesture += 1;
      tempPriorities.touch += 1;
      tempPriorities.voice -= 2;
      break;
      
    case 'home':
      // Balanced priorities at home
      // No changes needed
      break;
      
    case 'public':
      // In public, reduce voice priority
      tempPriorities.voice -= 1;
      tempPriorities.gesture += 1;
      break;
      
    default:
      // No changes for unknown contexts
  }
  
  // Apply temporary context-based priorities
  userProfile.contextPriorities = tempPriorities;
  
  logger.info(`Context changed to '${context}', priorities adjusted temporarily`);
  
  if (config.debug) {
    logger.debug('Context-adjusted priorities:', tempPriorities);
  }
}

/**
 * Get the current active modalities
 * @returns {Object} - Active modalities
 */
function getActiveModalities() {
  return { ...activeModalities };
}

/**
 * Get the current user profile
 * @returns {Object} - User profile
 */
function getUserProfile() {
  return { ...userProfile };
}

/**
 * Clean up resources
 * @returns {boolean} - Success status
 */
function cleanup() {
  try {
    // Unsubscribe from events
    unsubscribe('eye:gaze:updated', handleEyeInput);
    unsubscribe('eye:dwell:completed', handleEyeAction);
    unsubscribe('gesture:detected', handleGestureInput);
    unsubscribe('voice:command:detected', handleVoiceInput);
    unsubscribe('switch:activated', handleSwitchInput);
    unsubscribe('touch:detected', handleTouchInput);
    
    unsubscribe('eye:system:status', updateModalityStatus('eye'));
    unsubscribe('gesture:system:status', updateModalityStatus('gesture'));
    unsubscribe('voice:system:status', updateModalityStatus('voice'));
    unsubscribe('switch:system:status', updateModalityStatus('switch'));
    unsubscribe('touch:system:status', updateModalityStatus('touch'));
    
    unsubscribe('accessibility:mobility:profile_updated', handleProfileUpdate);
    unsubscribe('settings:updated:accessibility', handleAccessibilitySettingsUpdate);
    unsubscribe('system:context:changed', handleContextChange);
    
    // Clear state
    initialized = false;
    
    // Clear buffers
    for (const modality in inputBuffers) {
      inputBuffers[modality] = [];
    }
    
    // Clear timeouts
    for (const id in timeoutIds) {
      clearTimeout(timeoutIds[id]);
    }
    
    logger.info('Multimodal fusion system cleaned up');
    return true;
  } catch (error) {
    logger.error('Failed to clean up multimodal fusion system', error);
    return false;
  }
}

// Export public API
export default {
  initialize,
  getActiveModalities,
  getUserProfile,
  cleanup
};
