/**
 * ALEJO Sign Language Bridge
 * 
 * This module bridges the sign language processor with the enhanced gesture recognition system,
 * allowing sign language recognition to benefit from the improved gesture detection capabilities.
 * 
 * @module sign-language-bridge
 * @author ALEJO Team
 * @version 1.0.0
 * @license MIT
 */

import { subscribe, publish } from '../../core/events.js';
import { auditTrail } from '../../core/logging/audit-trail.js';
import mobilityAssistance from '../accessibility/mobility-assistance.js';
import signLanguageProcessor from './sign-language-processor.js';

// Sign language gesture mappings
// Maps gesture IDs from the enhanced recognition system to sign language signs
const gestureToSignMap = {
  // Static gestures
  'open_palm': ['hello', 'five'],
  'closed_fist': ['yes', 'stop'],
  'pointing': ['you', 'there', 'that'],
  'victory': ['two', 'peace'],
  'thumbs_up': ['good', 'yes', 'ok'],
  'thumbs_down': ['bad', 'no', 'not_ok'],
  'pinch': ['small', 'little', 'precise'],
  
  // Dynamic gestures
  'swipe_right': ['next', 'future', 'right'],
  'swipe_left': ['previous', 'past', 'left'],
  'swipe_up': ['up', 'increase', 'more'],
  'swipe_down': ['down', 'decrease', 'less'],
  'circle': ['repeat', 'again', 'cycle'],
  'wave': ['hello', 'goodbye', 'attention'],
  'zoom_in': ['big', 'expand', 'grow'],
  'zoom_out': ['small', 'contract', 'shrink']
};

// ASL Fingerspelling mappings
// Maps hand configurations to ASL alphabet letters
const fingerspellingMap = {
  'asl_a': 'a',
  'asl_b': 'b',
  'asl_c': 'c',
  'asl_d': 'd',
  'asl_e': 'e',
  'asl_f': 'f',
  'asl_g': 'g',
  'asl_h': 'h',
  'asl_i': 'i',
  'asl_j': 'j',
  'asl_k': 'k',
  'asl_l': 'l',
  'asl_m': 'm',
  'asl_n': 'n',
  'asl_o': 'o',
  'asl_p': 'p',
  'asl_q': 'q',
  'asl_r': 'r',
  'asl_s': 's',
  'asl_t': 't',
  'asl_u': 'u',
  'asl_v': 'v',
  'asl_w': 'w',
  'asl_x': 'x',
  'asl_y': 'y',
  'asl_z': 'z'
};

// Track fingerspelling state
let currentFingerspelling = {
  active: false,
  letters: [],
  lastLetterTime: 0,
  timeoutId: null
};

// Configuration
export const config = {
  useEnhancedRecognition: true,
  confidenceThreshold: 0.7,
  fingerspellingTimeout: 2000, // ms to wait after last letter before completing a word
  enableFingerspelling: true,
  debugMode: false,
  enabled: true,
  adaptToLimitedMobility: false, // Whether to adapt to users with limited mobility
  mobilityAdaptations: {
    lowerConfidenceThreshold: 0.4,    // Lower threshold for users with limited mobility
    allowPartialSigns: true,          // Accept partial sign formations
    extendRecognitionTime: true,      // Give more time to complete signs
    simplifyGestureMappings: false    // Use simplified gesture-to-sign mappings
  }
};

/**
 * Initialize the sign language bridge
 * @returns {Promise<boolean>} Success status
 */
export async function initializeSignLanguageBridge() {
  try {
    // Subscribe to gesture events
    subscribe('gesture:detected', handleGestureDetected);
    subscribe('gesture:update', handleGestureUpdate);
    subscribe('gesture:end', handleGestureEnd);
    
    // Subscribe to configuration events
    subscribe('sign_language:update_config', handleConfigUpdate);
    
    // Subscribe to mobility assistance events
    subscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
    
    // Check if mobility assistance is active and adapt accordingly
    checkMobilityAssistanceStatus();
    
    auditTrail.log({
      action: 'sign_language_bridge_initialized',
      details: { config },
      component: 'sign_language',
      level: 'info'
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize sign language bridge:', error);
    return false;
  }
}

/**
 * Set up event subscriptions for gesture events
 */
function setupEventSubscriptions() {
  // Subscribe to gesture detection events
  subscribe('gesture:detected', handleGestureDetected);
  
  // Subscribe to gesture updates
  subscribe('gesture:update', handleGestureUpdate);
  
  // Subscribe to gesture end events
  subscribe('gesture:end', handleGestureEnd);
  
  // Subscribe to configuration changes
  subscribe('sign_language:config', handleConfigChange);
}

/**
 * Handle detected gestures and map them to sign language
 * @param {Object} data - Gesture data
 */
function handleGestureDetected(data) {
  if (!config.enabled || !config.useEnhancedRecognition) return;
  
  const { gesture, confidence, handLandmarks } = data;
  
  // Check if confidence meets threshold
  if (confidence < config.confidenceThreshold) return;
  
  // Check if this is a fingerspelling gesture
  if (gesture.startsWith('asl_')) {
    handleFingerspellingGesture(gesture, confidence);
    return;
  }
  
  // Map gesture to sign language sign
  const possibleSigns = gestureToSignMap[gesture];
  if (!possibleSigns || possibleSigns.length === 0) return;
  
  // For now, just use the first mapping
  // In a more advanced implementation, we would use context to select the most appropriate sign
  const signId = possibleSigns[0];
  
  // Emit sign recognized event
  const signData = {
    id: signId,
    confidence,
    gesture,
    timestamp: Date.now()
  };
  
  // Publish sign language event
  publish('sign_language:sign_recognized', signData);
  
  // Log sign recognition
  auditTrail.log({
    action: 'sign_language_recognized_from_gesture',
    details: {
      sign: signId,
      gesture,
      confidence
    },
    component: 'sign_language',
    level: 'info'
  });
}

/**
 * Handle fingerspelling gestures
 * @param {string} gesture - Gesture ID
 * @param {number} confidence - Detection confidence
 */
function handleFingerspellingGesture(gesture, confidence) {
  const letter = fingerspellingMap[gesture];
  if (!letter) return;
  
  const now = Date.now();
  
  // If we haven't seen a letter in a while, start a new word
  if (!currentFingerspelling.active || 
      now - currentFingerspelling.lastLetterTime > config.fingerspellingTimeout) {
    
    // If we had an active fingerspelling session, finalize it
    if (currentFingerspelling.active && currentFingerspelling.letters.length > 0) {
      finalizeCurrentFingerspelling();
    }
    
    // Start a new fingerspelling session
    currentFingerspelling = {
      active: true,
      letters: [letter],
      lastLetterTime: now,
      timeoutId: setTimeout(finalizeCurrentFingerspelling, config.fingerspellingTimeout)
    };
    
    // Publish fingerspelling started event
    publish('sign_language:fingerspelling_started', {
      letter,
      confidence
    });
    
  } else {
    // Add to current fingerspelling
    currentFingerspelling.letters.push(letter);
    currentFingerspelling.lastLetterTime = now;
    
    // Reset timeout
    clearTimeout(currentFingerspelling.timeoutId);
    currentFingerspelling.timeoutId = setTimeout(finalizeCurrentFingerspelling, config.fingerspellingTimeout);
    
    // Publish fingerspelling update event
    publish('sign_language:fingerspelling_update', {
      letters: currentFingerspelling.letters,
      currentWord: currentFingerspelling.letters.join(''),
      lastLetter: letter,
      confidence
    });
  }
}

/**
 * Finalize the current fingerspelling session
 */
function finalizeCurrentFingerspelling() {
  if (!currentFingerspelling.active || currentFingerspelling.letters.length === 0) return;
  
  const word = currentFingerspelling.letters.join('');
  
  // Publish fingerspelling completed event
  publish('sign_language:fingerspelling_completed', {
    word,
    letters: currentFingerspelling.letters
  });
  
  // Log fingerspelling completion
  auditTrail.log({
    action: 'fingerspelling_word_completed',
    details: {
      word,
      letterCount: currentFingerspelling.letters.length
    },
    component: 'sign_language',
    level: 'info'
  });
  
  // Reset fingerspelling state
  currentFingerspelling = {
    active: false,
    letters: [],
    lastLetterTime: 0,
    timeoutId: null
  };
}

/**
 * Handle gesture updates
 * @param {Object} data - Gesture update data
 */
function handleGestureUpdate(data) {
  // Currently not used for sign language, but could be used for continuous signs
}

/**
 * Handle gesture end events
 * @param {Object} data - Gesture end data
 */
function handleGestureEnd(data) {
  // Currently not used for sign language, but could be used for tracking sign completion
}

/**
 * Handle configuration updates
 * @param {Object} data - Configuration data
 * @private
 */
function handleConfigUpdate(data) {
  if (data) {
    Object.assign(config, data);
    
    auditTrail.log({
      action: 'sign_language_config_updated',
      details: { config },
      component: 'sign_language',
      level: 'info'
    });
  }
}

/**
 * Handle mobility profile updates
 * @param {Object} data - Mobility profile data
 * @private
 */
function handleMobilityProfileUpdate(data) {
  if (data && data.profile) {
    // Adapt sign language recognition based on mobility profile
    const { hasLimitedMobility, canUseHands, preferredInputMethod } = data.profile;
    
    // Enable mobility adaptations if user has limited mobility
    config.adaptToLimitedMobility = hasLimitedMobility;
    
    // If user can't use hands well, apply more aggressive adaptations
    if (hasLimitedMobility && !canUseHands) {
      config.confidenceThreshold = config.mobilityAdaptations.lowerConfidenceThreshold;
      config.mobilityAdaptations.simplifyGestureMappings = true;
    } else if (hasLimitedMobility) {
      // User has limited mobility but can use hands somewhat
      config.confidenceThreshold = (config.mobilityAdaptations.lowerConfidenceThreshold + 0.7) / 2;
      config.mobilityAdaptations.simplifyGestureMappings = false;
    } else {
      // User has full mobility
      config.confidenceThreshold = 0.7;
      config.mobilityAdaptations.simplifyGestureMappings = false;
    }
    
    auditTrail.log({
      action: 'sign_language_mobility_adaptation',
      details: { 
        mobilityProfile: data.profile,
        adaptedConfig: config 
      },
      component: 'sign_language',
      level: 'info'
    });
  }
}

/**
 * Check mobility assistance status and adapt sign language recognition
 * @private
 */
function checkMobilityAssistanceStatus() {
  // Request current mobility profile
  publish('settings:request', { 
    category: 'accessibility',
    key: 'mobilityProfile',
    callback: (profile) => {
      if (profile) {
        handleMobilityProfileUpdate({ profile });
      }
    }
  });
}

/**
 * Handle configuration changes
 * @param {Object} newConfig - New configuration
 */
function handleConfigChange(newConfig) {
  // Update configuration
  Object.assign(config, newConfig);
  
  // Log configuration change
  auditTrail.log({
    action: 'sign_language_bridge_config_updated',
    details: { config },
    component: 'sign_language',
    level: 'info'
  });
}

// Export configuration for external access
export { config };
