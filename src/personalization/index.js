/**
 * ALEJO Personalization Module
 * 
 * This module integrates all personalization components:
 * - Behavior: Communication style learning and adaptation
 * - Emotional: Empathy, mood detection, and relationship continuity
 * - Voice: Voice pattern recognition and synthesis
 * - Vision: Facial recognition and expression analysis
 * 
 * The personalization system enables ALEJO to learn from user interactions,
 * adapt its responses, and maintain continuity across sessions.
 */

import * as behavior from './behavior/index.js';
import * as emotional from './emotional/index.js';
import * as voice from './voice/index.js';
import * as vision from './vision/index.js';
import { auditTrail } from '../security/audit-trail.js';
import { eventBus } from '../core/event-bus.js';
import { consentManager } from '../security/consent-manager.js';
import { rbac } from '../security/rbac.js';

/**
 * Initialize the personalization module and all its components.
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  const startTime = performance.now();
  
  // Check for personalization consent
  if (options.userId && !consentManager.hasConsent(options.userId, 'personalization')) {
    auditTrail.log('personalization:consent_missing', {
      userId: options.userId,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: 'Personalization consent not granted',
      results: {}
    };
  }
  
  auditTrail.log('personalization:initializing', {
    timestamp: new Date().toISOString(),
    options
  });
  
  const results = {
    behavior: false,
    emotional: false,
    voice: false,
    vision: false
  };
  
  try {
    // Initialize behavior module
    results.behavior = await behavior.initialize(options);
    
    // Initialize emotional module
    results.emotional = await emotional.initialize(options);
    
    // Initialize voice module if enabled
    if (options.enableVoice !== false) {
      results.voice = await voice.initialize(options);
    }
    
    // Initialize vision module if enabled
    if (options.enableVision !== false) {
      results.vision = await vision.initialize(options);
    }
    
    const duration = performance.now() - startTime;
    
    // Log successful initialization
    auditTrail.log('personalization:initialized', {
      timestamp: new Date().toISOString(),
      duration,
      results
    });
    
    // Emit initialization event
    eventBus.emit('personalization:initialized', {
      timestamp: new Date().toISOString(),
      duration,
      results
    });
    
    return {
      success: Object.values(results).some(result => result === true),
      results,
      duration
    };
  } catch (error) {
    // Log initialization error
    auditTrail.log('personalization:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    // Emit error event
    eventBus.emit('personalization:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    throw new Error(`Personalization module initialization failed: ${error.message}`);
  }
}

/**
 * Shutdown the personalization module and all its components.
 * @returns {Promise<boolean>} Success status
 */
export async function shutdown() {
  const startTime = performance.now();
  
  auditTrail.log('personalization:shutting_down', {
    timestamp: new Date().toISOString()
  });
  
  try {
    // Shutdown components with available shutdown methods
    await Promise.all([
      behavior.shutdown(),
      emotional.shutdown(),
      typeof voice.shutdown === 'function' ? voice.shutdown() : Promise.resolve(),
      typeof vision.shutdown === 'function' ? vision.shutdown() : Promise.resolve()
    ]);
    
    const duration = performance.now() - startTime;
    
    // Log successful shutdown
    auditTrail.log('personalization:shutdown_complete', {
      timestamp: new Date().toISOString(),
      duration
    });
    
    // Emit shutdown event
    eventBus.emit('personalization:shutdown_complete', {
      timestamp: new Date().toISOString(),
      duration
    });
    
    return true;
  } catch (error) {
    // Log shutdown error
    auditTrail.log('personalization:shutdown_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    // Emit error event
    eventBus.emit('personalization:shutdown_error', {
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    return false;
  }
}

/**
 * Process a user message through all personalization components.
 * @param {string} userId - User identifier
 * @param {string} message - Message content
 * @param {Object} context - Optional context information
 * @returns {Promise<Object>} Processing results
 */
export async function processUserMessage(userId, message, context = {}) {
  // Check for personalization consent
  if (!consentManager.hasConsent(userId, 'personalization')) {
    return { success: false, error: 'Personalization consent not granted' };
  }
  
  // Check for permission
  if (!rbac.checkPermission(userId, 'personalization:process')) {
    auditTrail.log('security:permission_denied', {
      userId,
      permission: 'personalization:process',
      action: 'processUserMessage'
    });
    return { success: false, error: 'Permission denied' };
  }
  
  try {
    const results = {
      behavior: false,
      emotional: false,
      voice: false,
      vision: false
    };
    
    // Process with behavior module
    results.behavior = await behavior.recordUserMessage(userId, message, context);
    
    // Process with emotional module
    results.emotional = await emotional.processMessage(userId, message, context);
    
    // Process with voice module if audio context is provided
    if (context.audio && typeof voice.processAudio === 'function') {
      results.voice = await voice.processAudio(userId, context.audio, context);
    }
    
    // Process with vision module if visual context is provided
    if (context.visual && typeof vision.processVisual === 'function') {
      results.vision = await vision.processVisual(userId, context.visual, context);
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    auditTrail.log('personalization:process_error', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Adapt a response based on user's personalization profile.
 * @param {string} userId - User identifier
 * @param {string} response - Original response
 * @param {Object} context - Optional context information
 * @returns {Promise<string>} Adapted response
 */
export async function adaptResponse(userId, response, context = {}) {
  // Check for personalization consent
  if (!consentManager.hasConsent(userId, 'personalization')) {
    return response; // Return original response if no consent
  }
  
  try {
    let adaptedResponse = response;
    
    // Apply behavior adaptation
    adaptedResponse = await behavior.adaptResponse(userId, adaptedResponse, context);
    
    // Apply emotional adaptation
    if (typeof emotional.generateEmpatheticResponse === 'function') {
      adaptedResponse = await emotional.generateEmpatheticResponse(userId, adaptedResponse, context);
    }
    
    // Apply voice adaptation if synthesis context is provided
    if (context.synthesis && typeof voice.adaptSynthesis === 'function') {
      context.synthesisParams = await voice.adaptSynthesis(userId, context.synthesisParams || {}, context);
    }
    
    return adaptedResponse;
  } catch (error) {
    auditTrail.log('personalization:adapt_response_error', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return response; // Return original response on error
  }
}

/**
 * Get user's personalization profile.
 * @param {string} userId - User identifier
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} User's personalization profile
 */
export async function getPersonalizationProfile(userId, options = {}) {
  // Check for personalization consent
  if (!consentManager.hasConsent(userId, 'personalization')) {
    return { error: 'Personalization consent not granted' };
  }
  
  // Check for permission
  if (!rbac.checkPermission(userId, 'personalization:read')) {
    auditTrail.log('security:permission_denied', {
      userId,
      permission: 'personalization:read',
      action: 'getPersonalizationProfile'
    });
    return { error: 'Permission denied' };
  }
  
  try {
    const profile = {
      userId,
      timestamp: Date.now()
    };
    
    // Get behavior profile
    profile.behavior = {
      styleMetrics: await behavior.getStyleMetrics(userId),
      preferences: await behavior.getPreferenceModel(userId)
    };
    
    // Get emotional profile
    if (typeof emotional.getEmotionalState === 'function') {
      profile.emotional = {
        currentState: await emotional.getEmotionalState(userId),
        conversationMood: await emotional.analyzeConversationMood(userId)
      };
    }
    
    // Get voice profile if enabled
    if (options.includeVoice !== false && typeof voice.getVoiceProfile === 'function') {
      profile.voice = await voice.getVoiceProfile(userId);
    }
    
    // Get vision profile if enabled
    if (options.includeVision !== false && typeof vision.getVisionProfile === 'function') {
      profile.vision = await vision.getVisionProfile(userId);
    }
    
    return profile;
  } catch (error) {
    auditTrail.log('personalization:get_profile_error', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return { error: error.message };
  }
}

/**
 * Reset user's personalization data.
 * @param {string} userId - User identifier
 * @param {Object} options - Reset options
 * @returns {Promise<boolean>} Success status
 */
export async function resetPersonalizationData(userId, options = {}) {
  // Check for permission
  if (!rbac.checkPermission(userId, 'personalization:reset')) {
    auditTrail.log('security:permission_denied', {
      userId,
      permission: 'personalization:reset',
      action: 'resetPersonalizationData'
    });
    return false;
  }
  
  try {
    const results = {
      behavior: false,
      emotional: false,
      voice: false,
      vision: false
    };
    
    // Reset behavior data if not excluded
    if (options.excludeBehavior !== true) {
      results.behavior = await behavior.resetPatterns(userId);
    }
    
    // Reset emotional data if not excluded
    if (options.excludeEmotional !== true && typeof emotional.resetEmotionalData === 'function') {
      results.emotional = await emotional.resetEmotionalData(userId);
    }
    
    // Reset voice data if not excluded
    if (options.excludeVoice !== true && typeof voice.resetVoiceData === 'function') {
      results.voice = await voice.resetVoiceData(userId);
    }
    
    // Reset vision data if not excluded
    if (options.excludeVision !== true && typeof vision.resetVisionData === 'function') {
      results.vision = await vision.resetVisionData(userId);
    }
    
    // Log reset action
    auditTrail.log('personalization:data_reset', {
      userId,
      options,
      results
    });
    
    // Emit reset event
    eventBus.emit('personalization:data_reset', {
      userId,
      options,
      results
    });
    
    return Object.values(results).some(result => result === true);
  } catch (error) {
    auditTrail.log('personalization:reset_error', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

// Export individual modules for direct access
export { behavior, emotional, voice, vision };
