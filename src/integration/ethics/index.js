/**
 * ALEJO Ethics Module
 * 
 * Main entry point for the ALEJO ethics layer. Coordinates ethical components
 * to ensure ALEJO behaves according to user values and provides transparency.
 */

import * as valueAlignment from './value-alignment.js';
import * as transparency from './transparency.js';
import * as boundaryEnforcer from './boundary-enforcer.js';
import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';

// State management
let initialized = false;

/**
 * Initialize the ethics module
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Ethics Module');
  
  if (initialized) {
    console.warn('Ethics Module already initialized');
    return true;
  }
  
  try {
    // Initialize security module if not already done
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    // Initialize value alignment system
    const valueAlignmentInitialized = await valueAlignment.initialize({
      userId: options.userId || 'anonymous',
      threshold: options.alignmentThreshold
    });
    
    if (!valueAlignmentInitialized) {
      console.error('Failed to initialize Value Alignment System');
    }
    
    // Initialize transparency system
    const transparencyInitialized = await transparency.initialize({
      userId: options.userId || 'anonymous',
      explanationLevel: options.explanationLevel
    });
    
    if (!transparencyInitialized) {
      console.error('Failed to initialize Transparency System');
    }
    // Initialize boundary enforcer
    const boundaryEnforcerInitialized = await boundaryEnforcer.initialize(options);
    if (!boundaryEnforcerInitialized) {
      console.error('Failed to initialize Boundary Enforcer');
    }
    
    // Register for relevant events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    
    initialized = true;
    publish('ethics:initialized', { 
      success: true,
      components: {
        valueAlignment: valueAlignmentInitialized,
        transparency: transparencyInitialized,
        boundaryEnforcer: boundaryEnforcerInitialized
      }
    });
    
    // Log initialization
    if (security && typeof security.logSecureEvent === 'function') {
      security.logSecureEvent('ethics:initialized', {
        components: {
          valueAlignment: valueAlignmentInitialized,
          transparency: transparencyInitialized,
          boundaryEnforcer: boundaryEnforcerInitialized
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Ethics Module:', error);
    publish('ethics:error', { 
      component: 'ethics-module',
      message: error.message
    });
    return false;
  }
}

/**
 * Check if a response aligns with user values
 * @param {string} content - Content to check
 * @returns {Promise<Object>} Alignment check results
 */
export async function checkValueAlignment(content) {
  if (!initialized) {
    await initialize();
  }
  
  return valueAlignment.checkAlignment(content);
}

/**
 * Generate an explanation for a decision
 * @param {Object} decision - Decision to explain
 * @param {Object} options - Explanation options
 * @returns {Promise<string>} Explanation
 */
export async function explainDecision(decision, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  return transparency.explainDecision(decision, options);
}

/**
 * Generate a data usage report
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Data usage report
 */
export async function generateDataReport(options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  return transparency.generateDataReport(options);
}

/**
 * Get the user's value framework
 * @returns {Promise<Object>} Value framework
 */
export async function getValueFramework() {
  if (!initialized) {
    await initialize();
  }
  
  return valueAlignment.getValueFramework();
}

/**
 * Update a value domain's importance
 * @param {string} domainId - Value domain ID
 * @param {number} importance - Importance score (0-1)
 * @returns {Promise<boolean>} Success status
 */
export async function updateValueImportance(domainId, importance) {
  if (!initialized) {
    await initialize();
  }
  
  return valueAlignment.updateValueImportance(domainId, importance);
}

/**
 * Set transparency explanation level
 * @param {string} level - Explanation level
 * @returns {Promise<boolean>} Success status
 */
export async function setExplanationLevel(level) {
  if (!initialized) {
    await initialize();
  }
  
  return transparency.setExplanationLevel(level);
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
async function handleUserLogin(data) {
  if (data?.userId) {
    // Reinitialize with user-specific settings
    await initialize({ userId: data.userId });
  }
}

/**
 * Handle user logout event
 */
async function handleUserLogout() {
  // Reset to anonymous state
  await initialize({ userId: 'anonymous' });
}

// Export all submodules for direct access when needed
export {
  valueAlignment,
  transparency,
  boundaryEnforcer
};
