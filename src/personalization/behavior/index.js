/**
 * Behavior Module Index
 * 
 * This module integrates ALEJO's behavior personalization components:
 * - Pattern learning for communication style analysis
 * - Preference modeling for implicit preference detection
 * - Response adaptation based on user communication patterns
 * - Preference normalization and relationship integration
 * 
 * The behavior module enables ALEJO to learn from user interactions and
 * adapt its responses to match the user's communication style and preferences.
 */

import * as patternLearner from './pattern-learner.js';
import * as adaptor from './adaptor.js';
import * as preferenceModel from './preference-model.js';
import * as preferenceNormalization from './preference-normalization.js';
import * as preferenceRelationshipIntegration from './preference-relationship-integration.js';
import { auditTrail } from '../../security/audit-trail.js';
import { eventBus } from '../../core/event-bus.js';

/**
 * Initialize the behavior module and all its components.
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  const startTime = performance.now();
  
  auditTrail.log('behavior_module:initializing', {
    timestamp: new Date().toISOString(),
    options
  });
  
  const results = {
    patternLearner: false,
    adaptor: false,
    preferenceModel: false,
    preferenceNormalization: false,
    preferenceRelationshipIntegration: false
  };
  
  try {
    // Initialize pattern learner
    results.patternLearner = await patternLearner.initialize(options);
    
    // Initialize adaptor
    results.adaptor = await adaptor.initialize(options);
    
    // Initialize preference model
    results.preferenceModel = await preferenceModel.initialize(options);
    
    // Initialize preference normalization
    if (options.enablePreferenceNormalization !== false) {
      results.preferenceNormalization = await preferenceNormalization.initialize(options);
    }
    
    // Initialize preference relationship integration
    if (options.enablePreferenceRelationshipIntegration !== false) {
      results.preferenceRelationshipIntegration = await preferenceRelationshipIntegration.initialize(options);
    }
    
    const duration = performance.now() - startTime;
    
    // Log successful initialization
    auditTrail.log('behavior_module:initialized', {
      timestamp: new Date().toISOString(),
      duration,
      results
    });
    
    // Emit initialization event
    eventBus.emit('behavior_module:initialized', {
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
    auditTrail.log('behavior_module:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    // Emit error event
    eventBus.emit('behavior_module:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    throw new Error(`Behavior module initialization failed: ${error.message}`);
  }
}

/**
 * Shutdown the behavior module and all its components.
 * @returns {Promise<boolean>} Success status
 */
export async function shutdown() {
  const startTime = performance.now();
  
  auditTrail.log('behavior_module:shutting_down', {
    timestamp: new Date().toISOString()
  });
  
  try {
    // Shutdown components with available shutdown methods
    if (typeof patternLearner.shutdown === 'function') {
      await patternLearner.shutdown();
    }
    
    if (typeof adaptor.shutdown === 'function') {
      await adaptor.shutdown();
    }
    
    if (typeof preferenceModel.shutdown === 'function') {
      await preferenceModel.shutdown();
    }
    
    if (typeof preferenceNormalization.shutdown === 'function') {
      await preferenceNormalization.shutdown();
    }
    
    if (typeof preferenceRelationshipIntegration.shutdown === 'function') {
      await preferenceRelationshipIntegration.shutdown();
    }
    
    const duration = performance.now() - startTime;
    
    // Log successful shutdown
    auditTrail.log('behavior_module:shutdown_complete', {
      timestamp: new Date().toISOString(),
      duration
    });
    
    // Emit shutdown event
    eventBus.emit('behavior_module:shutdown_complete', {
      timestamp: new Date().toISOString(),
      duration
    });
    
    return true;
  } catch (error) {
    // Log shutdown error
    auditTrail.log('behavior_module:shutdown_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    // Emit error event
    eventBus.emit('behavior_module:shutdown_error', {
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    return false;
  }
}

/**
 * Record a user message for pattern learning and preference detection.
 * @param {string} userId - User identifier
 * @param {string} message - Message content
 * @param {Object} context - Optional context information
 * @returns {Promise<boolean>} Success status
 */
export async function recordUserMessage(userId, message, context = {}) {
  try {
    // Record message for pattern learning
    await patternLearner.recordMessage(userId, message, context);
    
    // Detect preferences from message
    await preferenceModel.detectPreferencesFromMessage(userId, message, context);
    
    return true;
  } catch (error) {
    auditTrail.log('behavior_module:record_message_error', {
      userId,
      error: error.message
    });
    return false;
  }
}

/**
 * Adapt a response based on user's communication patterns.
 * @param {string} userId - User identifier
 * @param {string} response - Original response
 * @param {Object} context - Optional context information
 * @returns {Promise<string>} Adapted response
 */
export async function adaptResponse(userId, response, context = {}) {
  try {
    return await adaptor.adaptResponse(userId, response, context);
  } catch (error) {
    auditTrail.log('behavior_module:adapt_response_error', {
      userId,
      error: error.message
    });
    return response; // Return original response if adaptation fails
  }
}

/**
 * Get user's communication style metrics.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Style metrics
 */
export async function getStyleMetrics(userId) {
  return patternLearner.getStyleMetrics(userId);
}

/**
 * Get user's preference model.
 * @param {string} userId - User identifier
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} User's preference model
 */
export async function getPreferenceModel(userId, options = {}) {
  return preferenceModel.getPreferenceModel(userId, options);
}

/**
 * Set a user preference explicitly.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {string} category - Preference category
 * @returns {Promise<boolean>} Success status
 */
export async function setPreference(userId, key, value, category) {
  return preferenceModel.setPreference(userId, key, value, category);
}

/**
 * Get a specific user preference.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} defaultValue - Default value if preference not found
 * @param {Object} options - Additional options
 * @returns {Promise<*>} Preference value
 */
export async function getPreference(userId, key, defaultValue = null, options = {}) {
  return preferenceModel.getPreference(userId, key, defaultValue, options);
}

/**
 * Reset all learned patterns for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
export async function resetPatterns(userId) {
  return patternLearner.resetPatterns(userId);
}

// Export components for direct access if needed
export { patternLearner, adaptor, preferenceModel, preferenceNormalization, preferenceRelationshipIntegration };
