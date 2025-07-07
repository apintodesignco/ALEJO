/**
 * ALEJO Mobility Assistance Module
 * 
 * This module provides accessibility features for users with limited mobility,
 * integrating eye tracking with gesture recognition to enable control of ALEJO
 * through eye movements and minimal gestures.
 * 
 * Features:
 * - Eye-controlled gesture recognition for users with limited mobility
 * - Automatic detection of mobility limitations
 * - Adaptive interface based on user's mobility capabilities
 * - Integration with sign language and gesture recognition systems
 */

import { publish, subscribe } from '../../core/events.js';
import { getLogger } from '../../utils/logger.js';
import * as eyeProcessor from '../../biometrics/eye/eye-processor.js';
import { toggleFeature, getFeatureStatus } from './adaptive-feature-manager.js';
import { auditTrail } from '../../core/logging/audit-trail.js';

const logger = getLogger('mobility-assistance');

// Module state
let initialized = false;
let eyeControlEnabled = false;
let dwellClickEnabled = false;
let adaptiveModeActive = false;
let userMobilityProfile = {
  hasLimitedMobility: false,
  canUseHands: true,
  preferredInputMethod: 'standard', // standard, eye, voice, switch, hybrid
  lastDetectedMovement: Date.now()
};

// Configuration
const config = {
  // Eye control settings
  eyeControl: {
    enabled: false,
    dwellTime: 1000, // ms to trigger a click
    sensitivityLevel: 'medium', // low, medium, high
    calibrationRequired: true,
    useEnhancedPrecision: true
  },
  
  // Gesture recognition settings for limited mobility
  gestureRecognition: {
    enabled: true,
    sensitivityLevel: 'high', // low, medium, high
    detectMinimalMovements: true,
    allowPartialGestures: true
  },
  
  // Automatic detection settings
  autoDetection: {
    enabled: true,
    inactivityThreshold: 60000, // 1 minute without detected hand movements
    confirmationRequired: true
  },
  
  // UI adaptations
  uiAdaptations: {
    largerTargets: true,
    reducedMotion: true,
    simplifiedControls: true,
    highContrastElements: false
  }
};

/**
 * Initialize the mobility assistance module
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  if (initialized) {
    logger.info('Mobility assistance module already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing mobility assistance module');
    
    // Merge configuration options
    Object.assign(config, options);
    
    // Initialize eye processor if not already initialized
    if (!eyeProcessor.isInitialized()) {
      await eyeProcessor.initialize({
        processingInterval: 50, // Faster processing for responsive control
        accessibility: {
          highContrastMode: config.uiAdaptations.highContrastElements,
          largerTargets: config.uiAdaptations.largerTargets
        }
      });
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Register commands
    registerAccessibilityCommands();
    
    // Publish initialization event
    publish('accessibility:mobility:initialized', { config });
    
    initialized = true;
    logger.info('Mobility assistance module initialized successfully');
    
    // Start automatic detection if enabled
    if (config.autoDetection.enabled) {
      startMobilityDetection();
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize mobility assistance module', error);
    auditTrail.log({
      action: 'mobility_assistance_initialization_failed',
      details: { error: error.message },
      component: 'accessibility',
      level: 'error'
    });
    return false;
  }
}

/**
 * Set up event listeners for mobility assistance
 * @private
 */
function setupEventListeners() {
  // Listen for eye tracking events
  subscribe('eye:gaze:update', handleGazeUpdate);
  subscribe('eye:blink:detected', handleBlinkDetected);
  subscribe('eye:dwell:completed', handleDwellCompleted);
  
  // Listen for gesture events
  subscribe('gesture:detected', handleGestureDetected);
  subscribe('gesture:landmarks', handleHandLandmarks);
  
  // Listen for sign language events
  subscribe('sign_language:sign_recognized', handleSignRecognized);
  
  // Listen for system events
  subscribe('system:user:changed', handleUserChanged);
  subscribe('system:session:started', checkUserMobilityProfile);
  
  // Listen for accessibility settings changes
  subscribe('accessibility:settings:changed', handleAccessibilitySettingsChanged);
  
  logger.info('Mobility assistance event listeners registered');
}

/**
 * Register accessibility commands for mobility assistance
 * @private
 */
function registerAccessibilityCommands() {
  // Register voice commands for mobility assistance
  subscribe('voice:command:detected', (event) => {
    const command = event.command.toLowerCase();
    
    // Eye control commands
    if (command === 'enable eye control' || command === 'turn on eye control') {
      enableEyeControl(true);
      publish('accessibility:announcement', { message: 'Eye control enabled' });
    } else if (command === 'disable eye control' || command === 'turn off eye control') {
      enableEyeControl(false);
      publish('accessibility:announcement', { message: 'Eye control disabled' });
    }
    
    // Dwell click commands
    else if (command === 'enable dwell clicks' || command === 'turn on dwell clicks') {
      enableDwellClick(true);
      publish('accessibility:announcement', { message: 'Dwell clicks enabled' });
    } else if (command === 'disable dwell clicks' || command === 'turn off dwell clicks') {
      enableDwellClick(false);
      publish('accessibility:announcement', { message: 'Dwell clicks disabled' });
    }
    
    // Adaptive mode commands
    else if (command === 'enable adaptive mode' || command === 'turn on adaptive mode') {
      enableAdaptiveMode(true);
      publish('accessibility:announcement', { message: 'Adaptive mode enabled' });
    } else if (command === 'disable adaptive mode' || command === 'turn off adaptive mode') {
      enableAdaptiveMode(false);
      publish('accessibility:announcement', { message: 'Adaptive mode disabled' });
    }
  });
  
  logger.info('Mobility assistance commands registered');
}

/**
 * Start automatic detection of mobility limitations
 * @private
 */
function startMobilityDetection() {
  logger.info('Starting automatic mobility detection');
  
  // Set up interval to check for inactivity
  const detectionInterval = setInterval(() => {
    const timeSinceLastMovement = Date.now() - userMobilityProfile.lastDetectedMovement;
    
    // If no hand movements detected for the threshold period, suggest mobility assistance
    if (timeSinceLastMovement > config.autoDetection.inactivityThreshold && 
        !userMobilityProfile.hasLimitedMobility) {
      
      // If confirmation is required, ask the user
      if (config.autoDetection.confirmationRequired) {
        publish('accessibility:mobility:detection', {
          detected: true,
          requiresConfirmation: true,
          message: 'ALEJO has detected you may benefit from mobility assistance features. Would you like to enable them?'
        });
      } else {
        // Otherwise, enable automatically
        setMobilityProfile({
          hasLimitedMobility: true,
          preferredInputMethod: 'hybrid'
        });
        enableAdaptiveMode(true);
      }
    }
  }, 10000); // Check every 10 seconds
  
  // Clean up on module deactivation
  subscribe('accessibility:mobility:deactivated', () => {
    clearInterval(detectionInterval);
  });
}

/**
 * Handle gaze update events from eye tracking
 * @param {Object} data - Gaze data
 * @private
 */
function handleGazeUpdate(data) {
  if (!eyeControlEnabled) return;
  
  // Process gaze data for control
  const { x, y, confidence } = data;
  
  // Only process high-confidence gaze points
  if (confidence < 0.7) return;
  
  // Publish cursor position for eye control
  publish('accessibility:mobility:cursor', { x, y, source: 'eye' });
  
  // If in adaptive mode, check if this should trigger a gesture
  if (adaptiveModeActive) {
    checkEyeGestureMapping(x, y);
  }
}

/**
 * Handle blink detection events
 * @param {Object} data - Blink data
 * @private
 */
function handleBlinkDetected(data) {
  if (!eyeControlEnabled) return;
  
  // Use blinks as clicks if enabled
  if (data.duration > 300 && data.duration < 1000) { // Intentional blink
    publish('accessibility:mobility:action', { 
      type: 'click',
      source: 'eye_blink'
    });
  }
}

/**
 * Handle dwell completion events
 * @param {Object} data - Dwell data
 * @private
 */
function handleDwellCompleted(data) {
  if (!dwellClickEnabled) return;
  
  // Trigger click action at the dwell position
  publish('accessibility:mobility:action', { 
    type: 'click',
    x: data.x,
    y: data.y,
    source: 'eye_dwell'
  });
}

/**
 * Handle gesture detection events
 * @param {Object} data - Gesture data
 * @private
 */
function handleGestureDetected(data) {
  // Update last movement timestamp
  userMobilityProfile.lastDetectedMovement = Date.now();
  
  // If in adaptive mode, adjust gesture sensitivity based on user's capabilities
  if (adaptiveModeActive && userMobilityProfile.hasLimitedMobility) {
    // Lower the confidence threshold for users with limited mobility
    if (data.confidence >= 0.4) { // Lower threshold than standard
      // Map minimal gestures to full commands
      mapMinimalGestureToCommand(data.gesture, data.confidence);
    }
  }
}

/**
 * Handle hand landmarks events
 * @param {Object} data - Hand landmarks data
 * @private
 */
function handleHandLandmarks(data) {
  // Update last movement timestamp when hand landmarks are detected
  if (data.hands && data.hands.length > 0) {
    userMobilityProfile.lastDetectedMovement = Date.now();
    
    // If user has limited mobility, analyze the extent of movement
    if (userMobilityProfile.hasLimitedMobility) {
      analyzeMovementCapabilities(data.hands);
    }
  }
}

/**
 * Handle sign language recognition events
 * @param {Object} data - Sign recognition data
 * @private
 */
function handleSignRecognized(data) {
  // Update last movement timestamp
  userMobilityProfile.lastDetectedMovement = Date.now();
  
  // If in adaptive mode, adjust sign recognition sensitivity
  if (adaptiveModeActive && userMobilityProfile.hasLimitedMobility) {
    // Process sign with adjusted confidence for limited mobility users
    processAdaptedSign(data);
  }
}

/**
 * Handle user change events
 * @param {Object} data - User data
 * @private
 */
function handleUserChanged(data) {
  // Reset and check mobility profile for the new user
  checkUserMobilityProfile();
}

/**
 * Handle accessibility settings changes
 * @param {Object} data - Settings data
 * @private
 */
function handleAccessibilitySettingsChanged(data) {
  // Update configuration based on settings changes
  if (data.mobility) {
    if (data.mobility.eyeControl !== undefined) {
      enableEyeControl(data.mobility.eyeControl);
    }
    
    if (data.mobility.dwellClick !== undefined) {
      enableDwellClick(data.mobility.dwellClick);
    }
    
    if (data.mobility.adaptiveMode !== undefined) {
      enableAdaptiveMode(data.mobility.adaptiveMode);
    }
  }
}

/**
 * Enable or disable eye control
 * @param {boolean} enable - Whether to enable eye control
 * @public
 */
export function enableEyeControl(enable) {
  eyeControlEnabled = enable;
  config.eyeControl.enabled = enable;
  
  if (enable) {
    // Start eye tracking if not already started
    eyeProcessor.startProcessing();
    
    // Publish event
    publish('accessibility:mobility:eye_control', { enabled: true });
    
    logger.info('Eye control enabled');
  } else {
    // Don't stop eye tracking as it might be used by other systems
    
    // Publish event
    publish('accessibility:mobility:eye_control', { enabled: false });
    
    logger.info('Eye control disabled');
  }
}

/**
 * Enable or disable dwell click
 * @param {boolean} enable - Whether to enable dwell click
 * @public
 */
export function enableDwellClick(enable) {
  dwellClickEnabled = enable;
  
  // Configure eye processor for dwell detection
  eyeProcessor.updateConfig({
    detectDwells: enable,
    dwellTime: config.eyeControl.dwellTime
  });
  
  // Publish event
  publish('accessibility:mobility:dwell_click', { enabled: enable });
  
  logger.info(`Dwell click ${enable ? 'enabled' : 'disabled'}`);
}

/**
 * Enable or disable adaptive mode
 * @param {boolean} enable - Whether to enable adaptive mode
 * @public
 */
export function enableAdaptiveMode(enable) {
  adaptiveModeActive = enable;
  
  if (enable) {
    // Configure systems for adaptive mode
    configureAdaptiveMode();
    
    // Publish event
    publish('accessibility:mobility:adaptive_mode', { enabled: true });
    
    logger.info('Adaptive mode enabled');
  } else {
    // Reset to standard configuration
    resetToStandardMode();
    
    // Publish event
    publish('accessibility:mobility:adaptive_mode', { enabled: false });
    
    logger.info('Adaptive mode disabled');
  }
}

/**
 * Configure systems for adaptive mode
 * @private
 */
function configureAdaptiveMode() {
  // Configure gesture recognition for adaptive mode
  publish('gesture:update_config', {
    sensitivityLevel: 'high',
    detectMinimalMovements: true,
    allowPartialGestures: true
  });
  
  // Configure sign language processing for adaptive mode
  publish('sign_language:update_config', {
    confidenceThreshold: 0.4, // Lower threshold for recognition
    adaptToLimitedMobility: true
  });
  
  // Configure UI for adaptive mode
  publish('ui:update_config', {
    largerTargets: config.uiAdaptations.largerTargets,
    reducedMotion: config.uiAdaptations.reducedMotion,
    simplifiedControls: config.uiAdaptations.simplifiedControls
  });
}

/**
 * Reset to standard mode configuration
 * @private
 */
function resetToStandardMode() {
  // Reset gesture recognition config
  publish('gesture:update_config', {
    sensitivityLevel: 'medium',
    detectMinimalMovements: false,
    allowPartialGestures: false
  });
  
  // Reset sign language processing config
  publish('sign_language:update_config', {
    confidenceThreshold: 0.7, // Standard threshold
    adaptToLimitedMobility: false
  });
  
  // Reset UI config
  publish('ui:update_config', {
    largerTargets: false,
    reducedMotion: false,
    simplifiedControls: false
  });
}

/**
 * Check and load user mobility profile
 * @private
 */
function checkUserMobilityProfile() {
  // Try to load user mobility profile from settings
  publish('settings:request', { 
    category: 'accessibility',
    key: 'mobilityProfile',
    callback: (profile) => {
      if (profile) {
        userMobilityProfile = profile;
        
        // If user has limited mobility, enable adaptive features
        if (profile.hasLimitedMobility && !adaptiveModeActive) {
          enableAdaptiveMode(true);
        }
      }
    }
  });
}

/**
 * Set user mobility profile
 * @param {Object} profile - Mobility profile data
 * @public
 */
export function setMobilityProfile(profile) {
  userMobilityProfile = {
    ...userMobilityProfile,
    ...profile
  };
  
  // Save profile to settings
  publish('settings:update', {
    category: 'accessibility',
    key: 'mobilityProfile',
    value: userMobilityProfile
  });
  
  // Log profile change
  auditTrail.log({
    action: 'mobility_profile_updated',
    details: { profile: userMobilityProfile },
    component: 'accessibility',
    level: 'info'
  });
  
  // Publish event
  publish('accessibility:mobility:profile_updated', { profile: userMobilityProfile });
}

/**
 * Map minimal gestures to full commands for users with limited mobility
 * @param {string} gesture - Detected gesture
 * @param {number} confidence - Gesture confidence
 * @private
 */
function mapMinimalGestureToCommand(gesture, confidence) {
  // Map minimal movements to standard gestures based on user's capabilities
  let mappedGesture = gesture;
  let mappedConfidence = confidence;
  
  // Enhance confidence for users with limited mobility
  if (userMobilityProfile.hasLimitedMobility) {
    mappedConfidence = Math.min(confidence * 1.5, 1.0);
  }
  
  // Map partial gestures to full gestures if needed
  if (config.gestureRecognition.allowPartialGestures) {
    if (gesture === 'partial_open_hand') {
      mappedGesture = 'open_hand';
    } else if (gesture === 'partial_closed_fist') {
      mappedGesture = 'closed_fist';
    } else if (gesture === 'partial_pointing') {
      mappedGesture = 'pointing';
    }
  }
  
  // Publish the mapped gesture
  if (mappedGesture !== gesture || mappedConfidence !== confidence) {
    publish('gesture:mapped', {
      originalGesture: gesture,
      mappedGesture: mappedGesture,
      originalConfidence: confidence,
      mappedConfidence: mappedConfidence,
      source: 'mobility_assistance'
    });
  }
}

/**
 * Analyze movement capabilities from hand landmarks
 * @param {Array} hands - Hand landmarks data
 * @private
 */
function analyzeMovementCapabilities(hands) {
  // Analyze the range and precision of movement
  // This helps adapt the system to the user's specific capabilities
  
  // Implementation would analyze movement patterns over time
  // and update the user's mobility profile accordingly
}

/**
 * Process adapted sign for users with limited mobility
 * @param {Object} signData - Sign recognition data
 * @private
 */
function processAdaptedSign(signData) {
  // Adapt sign language recognition for users with limited mobility
  
  // Implementation would adjust confidence thresholds and
  // map partial signs to full signs based on user's capabilities
}

/**
 * Map eye gaze to gestures for users who cannot use hands
 * @param {number} x - Gaze X coordinate
 * @param {number} y - Gaze Y coordinate
 * @private
 */
function checkEyeGestureMapping(x, y) {
  // For users who cannot use hands at all, map eye movements to gestures
  if (userMobilityProfile.hasLimitedMobility && !userMobilityProfile.canUseHands) {
    // Implementation would map specific gaze patterns to gestures
    // For example, looking at specific screen regions could trigger commands
  }
}

/**
 * Clean up resources
 * @public
 */
export function cleanup() {
  // Unsubscribe from events
  // Implementation would unsubscribe from all events
  
  logger.info('Mobility assistance module cleaned up');
}

// Export public API
export default {
  initialize,
  enableEyeControl,
  enableDwellClick,
  enableAdaptiveMode,
  setMobilityProfile,
  cleanup
};
