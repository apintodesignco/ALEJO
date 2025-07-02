/**
 * ALEJO Security Module
 * 
 * Main entry point for the ALEJO security layer. Coordinates and initializes all 
 * security-related components, providing a unified interface for data protection,
 * audit logging, and consent management.
 */

import * as privacyGuard from './privacy-guard.js';
import * as auditTrail from './audit-trail.js';
import * as consentManager from './consent-manager.js';
import { publish, subscribe } from '../core/events.js';

// State management
let initialized = false;
let securityLevel = 'standard'; // 'minimal', 'standard', 'enhanced'

/**
 * Initialize the security module
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Security Module');
  
  if (initialized) {
    console.warn('Security Module already initialized');
    return true;
  }
  
  try {
    // Set security level
    securityLevel = options.securityLevel || 'standard';
    
    // Order matters - Privacy Guard first, then Audit Trail, then Consent Manager
    // This ensures each component can rely on services provided by the previous ones
    
    // Initialize Privacy Guard (encryption & secure storage)
    const privacyInitialized = await privacyGuard.initialize({
      userIdentifier: options.userId || 'anonymous'
    });
    
    if (!privacyInitialized) {
      console.error('Failed to initialize Privacy Guard');
      publish('security:error', { 
        component: 'privacy-guard',
        message: 'Initialization failed' 
      });
    }
    
    // Initialize Audit Trail (secure logging)
    const auditInitialized = await auditTrail.initialize({
      enabled: options.auditEnabled !== false,
      privacyLevel: mapSecurityToPrivacyLevel(securityLevel),
      userId: options.userId || 'anonymous'
    });
    
    if (!auditInitialized) {
      console.error('Failed to initialize Audit Trail');
      publish('security:error', { 
        component: 'audit-trail',
        message: 'Initialization failed' 
      });
    }
    
    // Initialize Consent Manager (permission controls)
    const consentInitialized = await consentManager.initialize({
      userId: options.userId || 'anonymous'
    });
    
    if (!consentInitialized) {
      console.error('Failed to initialize Consent Manager');
      publish('security:error', { 
        component: 'consent-manager',
        message: 'Initialization failed' 
      });
    }
    
    // Register for global events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    subscribe('security:level:change', handleSecurityLevelChange);
    
    initialized = true;
    publish('security:initialized', { 
      success: true,
      components: {
        privacyGuard: privacyInitialized,
        auditTrail: auditInitialized,
        consentManager: consentInitialized
      }
    });
    
    // Log successful initialization
    auditTrail.logEvent('security:initialized', {
      securityLevel,
      components: {
        privacyGuard: privacyInitialized,
        auditTrail: auditInitialized,
        consentManager: consentInitialized
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Security Module:', error);
    publish('security:error', { 
      component: 'security-module',
      message: error.message
    });
    return false;
  }
}

/**
 * Map security level to privacy level for audit trail
 * @param {string} level - Security level
 * @returns {string} Privacy level
 */
function mapSecurityToPrivacyLevel(level) {
  switch (level) {
    case 'minimal':
      return 'minimal';
    case 'standard':
      return 'standard';
    case 'enhanced':
      return 'detailed';
    default:
      return 'standard';
  }
}

/**
 * Set the security level
 * @param {string} level - Security level ('minimal', 'standard', 'enhanced')
 * @returns {boolean} Success status
 */
export function setSecurityLevel(level) {
  const validLevels = ['minimal', 'standard', 'enhanced'];
  if (!validLevels.includes(level)) {
    console.error(`Invalid security level: ${level}`);
    return false;
  }
  
  securityLevel = level;
  
  // Update privacy level in audit trail
  if (auditTrail) {
    auditTrail.setPrivacyLevel(mapSecurityToPrivacyLevel(level));
  }
  
  publish('security:level:changed', { level });
  
  // Log the change
  if (auditTrail) {
    auditTrail.logEvent('security:level:changed', { level });
  }
  
  return true;
}

/**
 * Check if a feature is allowed based on consent
 * @param {string} featureId - Feature identifier
 * @returns {boolean} Whether feature is allowed
 */
export function isFeatureAllowed(featureId) {
  if (!initialized) {
    console.warn('Security Module not initialized, denying feature access');
    return false;
  }
  
  return consentManager.hasConsent(featureId);
}

/**
 * Securely store data
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @param {Object} options - Storage options
 * @returns {Promise<boolean>} Success status
 */
export async function secureStore(key, data, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // First check consent
    const consentFeature = options.consentFeature;
    if (consentFeature && !consentManager.hasConsent(consentFeature)) {
      console.error(`Consent not granted for feature: ${consentFeature}`);
      return false;
    }
    
    const result = await privacyGuard.secureStore(key, data, options);
    
    // Log the action
    auditTrail.logEvent('security:data:stored', { 
      key,
      feature: options.consentFeature,
      category: options.category
    });
    
    return result;
  } catch (error) {
    console.error('Secure storage failed:', error);
    return false;
  }
}

/**
 * Retrieve securely stored data
 * @param {string} key - Storage key
 * @param {Object} options - Retrieval options
 * @returns {Promise<any>} Retrieved data
 */
export async function secureRetrieve(key, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    // First check consent
    const consentFeature = options.consentFeature;
    if (consentFeature && !consentManager.hasConsent(consentFeature)) {
      console.error(`Consent not granted for feature: ${consentFeature}`);
      return null;
    }
    
    const result = await privacyGuard.secureRetrieve(key);
    
    // Log the action
    auditTrail.logEvent('security:data:retrieved', { 
      key,
      feature: options.consentFeature
    });
    
    return result;
  } catch (error) {
    console.error('Secure retrieval failed:', error);
    return null;
  }
}

/**
 * Delete securely stored data
 * @param {string} key - Storage key
 * @param {Object} options - Deletion options
 * @returns {Promise<boolean>} Success status
 */
export async function secureDelete(key, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  try {
    const result = await privacyGuard.secureDelete(key);
    
    // Log the action
    auditTrail.logEvent('security:data:deleted', { 
      key,
      feature: options.consentFeature
    });
    
    return result;
  } catch (error) {
    console.error('Secure deletion failed:', error);
    return false;
  }
}

/**
 * Log an event securely
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data
 * @returns {Promise<boolean>} Success status
 */
export async function logSecureEvent(eventType, eventData = {}) {
  if (!initialized) {
    await initialize();
  }
  
  return auditTrail.logEvent(eventType, eventData);
}

/**
 * Export user's security data (for data portability/GDPR compliance)
 * @returns {Promise<Object>} Exported security data
 */
export async function exportUserData() {
  if (!initialized) {
    await initialize();
  }
  
  // Gather data from all components
  const consentData = consentManager.exportConsent();
  
  let auditData = {};
  try {
    auditData = JSON.parse(await auditTrail.exportUserLogs());
  } catch (e) {
    console.error('Failed to export audit logs:', e);
  }
  
  // Construct export package
  return {
    exportDate: new Date().toISOString(),
    userId: consentData.userId,
    securityLevel,
    consent: consentData,
    auditTrail: auditData
  };
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
async function handleUserLogin(data) {
  if (data?.userId) {
    // Reinitialize with user-specific settings
    await initialize({ 
      userId: data.userId,
      securityLevel
    });
  }
}

/**
 * Handle user logout event
 */
async function handleUserLogout() {
  // Reset to anonymous state
  await initialize({
    userId: 'anonymous',
    securityLevel
  });
}

/**
 * Handle security level change event
 * @param {Object} data - Event data
 */
function handleSecurityLevelChange(data) {
  if (data?.level) {
    setSecurityLevel(data.level);
  }
}

// Export all submodules for direct access when needed
export {
  privacyGuard,
  auditTrail,
  consentManager
};
