/**
 * ALEJO Consent Enforcer
 * 
 * This module manages user consent for all personalization features,
 * ensuring that ALEJO respects privacy preferences and maintains
 * transparent data usage practices.
 * 
 * @module alejo/integration/security/consent_enforcer
 */

import EventEmitter from 'events';
import { auditTrail } from './audit_trail.js';

// Consent categories
const CONSENT_CATEGORIES = {
  PERSONALIZATION: 'personalization',   // Personalized experiences
  VOICE: 'voice',                       // Voice recognition and processing
  VISION: 'vision',                     // Visual/facial recognition
  LOCATION: 'location',                 // Location data usage
  BEHAVIORAL: 'behavioral',             // Behavior tracking and analysis
  STORAGE: 'storage',                   // Data storage (local/cloud)
  THIRD_PARTY: 'third_party',           // Sharing with third parties
  ANALYTICS: 'analytics',               // Usage analytics
  BIOMETRIC: 'biometric',               // Biometric data processing
  MEMORY: 'memory'                      // Long-term memory storage
};

// Consent status values
const CONSENT_STATUS = {
  GRANTED: 'granted',           // User explicitly granted consent
  DENIED: 'denied',             // User explicitly denied consent
  UNKNOWN: 'unknown',           // No explicit consent decision yet
  EXPIRED: 'expired',           // Previous consent has expired
  WITHDRAWN: 'withdrawn'        // User has withdrawn previous consent
};

/**
 * ConsentEnforcer class that manages user consent
 */
class ConsentEnforcer extends EventEmitter {
  /**
   * Create a new ConsentEnforcer instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictMode - Whether to use strict consent enforcement
   * @param {number} options.consentDuration - Default consent duration in days
   * @param {boolean} options.requireExplicitConsent - Whether to require explicit consent
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      strictMode: true,
      consentDuration: 365, // 1 year default
      requireExplicitConsent: true,
      enableAudit: true,
      ...options
    };
    
    // Initialize consent storage
    this.consentStore = new Map();
    
    // Default consent settings
    this.defaultConsent = {
      [CONSENT_CATEGORIES.PERSONALIZATION]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.VOICE]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.VISION]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.LOCATION]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.BEHAVIORAL]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.STORAGE]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.THIRD_PARTY]: CONSENT_STATUS.DENIED, // Default deny for third-party sharing
      [CONSENT_CATEGORIES.ANALYTICS]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.BIOMETRIC]: CONSENT_STATUS.UNKNOWN,
      [CONSENT_CATEGORIES.MEMORY]: CONSENT_STATUS.UNKNOWN
    };
    
    // Initialize with default consent
    Object.entries(this.defaultConsent).forEach(([category, status]) => {
      this.consentStore.set(category, {
        status,
        timestamp: null,
        expiration: null,
        source: 'default'
      });
    });
    
    // Initialize event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Listen for configuration changes
    this.on('config:update', (newConfig) => {
      this.updateConfiguration(newConfig);
    });
  }
  
  /**
   * Update user consent for a specific category
   * @param {string} category - Consent category
   * @param {string} status - Consent status
   * @param {Object} options - Additional options
   * @param {number} options.durationDays - Duration in days for this consent
   * @param {string} options.source - Source of the consent update
   * @returns {boolean} - Whether the consent was successfully updated
   */
  updateConsent(category, status, options = {}) {
    // Validate category
    if (!CONSENT_CATEGORIES[category.toUpperCase()] && category !== 'all') {
      console.error(`Invalid consent category: ${category}`);
      return false;
    }
    
    // Validate status
    if (!Object.values(CONSENT_STATUS).includes(status)) {
      console.error(`Invalid consent status: ${status}`);
      return false;
    }
    
    const now = new Date();
    const durationDays = options.durationDays || this.options.consentDuration;
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + durationDays);
    
    const consentData = {
      status,
      timestamp: now.toISOString(),
      expiration: expiration.toISOString(),
      source: options.source || 'user'
    };
    
    // Handle 'all' category special case
    if (category === 'all') {
      Object.keys(CONSENT_CATEGORIES).forEach(cat => {
        const catKey = CONSENT_CATEGORIES[cat];
        this.consentStore.set(catKey, { ...consentData });
      });
    } else {
      // Update specific category
      this.consentStore.set(category, consentData);
    }
    
    // Log the consent update
    if (this.options.enableAudit) {
      this._logConsentOperation('update', {
        category: category === 'all' ? 'all' : category,
        status,
        expiration: expiration.toISOString(),
        source: options.source || 'user'
      });
    }
    
    // Emit consent updated event
    this.emit('consent:updated', {
      category: category === 'all' ? 'all' : category,
      status,
      timestamp: now.toISOString()
    });
    
    return true;
  }
  
  /**
   * Check if consent has been given for a specific category
   * @param {string} category - Consent category
   * @param {boolean} strictCheck - Whether to perform strict checking
   * @returns {boolean} - Whether consent has been granted
   */
  checkConsent(category, strictCheck = null) {
    // Use instance strictMode if not explicitly provided
    const useStrictCheck = strictCheck !== null ? strictCheck : this.options.strictMode;
    
    // Validate category
    if (!CONSENT_CATEGORIES[category.toUpperCase()]) {
      console.error(`Invalid consent category: ${category}`);
      return false;
    }
    
    const consentData = this.consentStore.get(category);
    
    // If no consent data found, use default
    if (!consentData) {
      return this.defaultConsent[category] === CONSENT_STATUS.GRANTED;
    }
    
    // Check if consent has expired
    if (consentData.expiration) {
      const now = new Date();
      const expiration = new Date(consentData.expiration);
      
      if (now > expiration) {
        // Update status to expired
        this.consentStore.set(category, {
          ...consentData,
          status: CONSENT_STATUS.EXPIRED
        });
        
        // In strict mode, expired consent means no consent
        if (useStrictCheck) {
          return false;
        }
      }
    }
    
    // In strict mode, only explicit GRANTED is considered consent
    if (useStrictCheck) {
      return consentData.status === CONSENT_STATUS.GRANTED;
    }
    
    // In non-strict mode, anything except DENIED or WITHDRAWN is considered consent
    return ![CONSENT_STATUS.DENIED, CONSENT_STATUS.WITHDRAWN].includes(consentData.status);
  }
  
  /**
   * Get consent status for a specific category
   * @param {string} category - Consent category
   * @returns {Object} - Consent status data
   */
  getConsentStatus(category) {
    // Validate category
    if (!CONSENT_CATEGORIES[category.toUpperCase()]) {
      console.error(`Invalid consent category: ${category}`);
      return null;
    }
    
    const consentData = this.consentStore.get(category);
    
    // If no consent data found, use default
    if (!consentData) {
      return {
        status: this.defaultConsent[category],
        timestamp: null,
        expiration: null,
        source: 'default'
      };
    }
    
    return { ...consentData };
  }
  
  /**
   * Get all consent statuses
   * @returns {Object} - All consent statuses
   */
  getAllConsents() {
    const result = {};
    
    Object.values(CONSENT_CATEGORIES).forEach(category => {
      result[category] = this.getConsentStatus(category);
    });
    
    return result;
  }
  
  /**
   * Withdraw consent for a specific category
   * @param {string} category - Consent category
   * @param {Object} options - Additional options
   * @returns {boolean} - Whether the consent was successfully withdrawn
   */
  withdrawConsent(category, options = {}) {
    return this.updateConsent(category, CONSENT_STATUS.WITHDRAWN, {
      source: options.source || 'user_withdrawal'
    });
  }
  
  /**
   * Reset consent to default for a specific category
   * @param {string} category - Consent category
   * @returns {boolean} - Whether the consent was successfully reset
   */
  resetConsent(category) {
    // Validate category
    if (!CONSENT_CATEGORIES[category.toUpperCase()] && category !== 'all') {
      console.error(`Invalid consent category: ${category}`);
      return false;
    }
    
    // Handle 'all' category special case
    if (category === 'all') {
      Object.entries(this.defaultConsent).forEach(([cat, status]) => {
        this.consentStore.set(cat, {
          status,
          timestamp: new Date().toISOString(),
          expiration: null,
          source: 'reset'
        });
      });
    } else {
      // Reset specific category
      const defaultStatus = this.defaultConsent[category] || CONSENT_STATUS.UNKNOWN;
      this.consentStore.set(category, {
        status: defaultStatus,
        timestamp: new Date().toISOString(),
        expiration: null,
        source: 'reset'
      });
    }
    
    // Log the consent reset
    if (this.options.enableAudit) {
      this._logConsentOperation('reset', {
        category: category === 'all' ? 'all' : category
      });
    }
    
    // Emit consent reset event
    this.emit('consent:reset', {
      category: category === 'all' ? 'all' : category,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
  
  /**
   * Check if explicit consent is required for a data type
   * @param {string} dataType - Type of data
   * @returns {boolean} - Whether explicit consent is required
   */
  requiresExplicitConsent(dataType) {
    // Map data types to consent categories
    const categoryMap = {
      'voice': CONSENT_CATEGORIES.VOICE,
      'audio': CONSENT_CATEGORIES.VOICE,
      'speech': CONSENT_CATEGORIES.VOICE,
      'face': CONSENT_CATEGORIES.VISION,
      'image': CONSENT_CATEGORIES.VISION,
      'video': CONSENT_CATEGORIES.VISION,
      'location': CONSENT_CATEGORIES.LOCATION,
      'gps': CONSENT_CATEGORIES.LOCATION,
      'behavior': CONSENT_CATEGORIES.BEHAVIORAL,
      'preference': CONSENT_CATEGORIES.BEHAVIORAL,
      'usage': CONSENT_CATEGORIES.BEHAVIORAL,
      'biometric': CONSENT_CATEGORIES.BIOMETRIC,
      'fingerprint': CONSENT_CATEGORIES.BIOMETRIC,
      'memory': CONSENT_CATEGORIES.MEMORY,
      'personal': CONSENT_CATEGORIES.PERSONALIZATION
    };
    
    // Find matching category for data type
    let category = null;
    for (const [key, value] of Object.entries(categoryMap)) {
      if (dataType.toLowerCase().includes(key)) {
        category = value;
        break;
      }
    }
    
    // If no specific category found, default to personalization
    if (!category) {
      category = CONSENT_CATEGORIES.PERSONALIZATION;
    }
    
    // Check if this category requires explicit consent
    if (!this.options.requireExplicitConsent) {
      return false;
    }
    
    // These categories always require explicit consent
    const alwaysRequireConsent = [
      CONSENT_CATEGORIES.BIOMETRIC,
      CONSENT_CATEGORIES.VOICE,
      CONSENT_CATEGORIES.VISION,
      CONSENT_CATEGORIES.LOCATION
    ];
    
    return alwaysRequireConsent.includes(category);
  }
  
  /**
   * Log consent operation to audit trail
   * @private
   * @param {string} operation - Operation name
   * @param {Object} details - Operation details
   */
  _logConsentOperation(operation, details) {
    if (!this.options.enableAudit) {
      return;
    }
    
    try {
      auditTrail.logEvent('consent', {
        operation,
        timestamp: new Date().toISOString(),
        details
      });
    } catch (error) {
      console.error('Error logging to audit trail:', error);
      
      // Fallback to local event emission
      this.emit('consent:audit', {
        operation,
        timestamp: new Date().toISOString(),
        details
      });
    }
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    this.options = {
      ...this.options,
      ...newConfig
    };
    
    // Emit configuration updated event
    this.emit('config:updated', this.options);
  }
  
  /**
   * Export consent data
   * @returns {Object} - Exportable consent data
   */
  exportConsentData() {
    const exportData = {
      consents: {},
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Convert Map to plain object
    for (const [category, data] of this.consentStore.entries()) {
      exportData.consents[category] = { ...data };
    }
    
    return exportData;
  }
  
  /**
   * Import consent data
   * @param {Object} importData - Consent data to import
   * @returns {boolean} - Whether the import was successful
   */
  importConsentData(importData) {
    if (!importData || !importData.consents || !importData.timestamp) {
      console.error('Invalid consent data format');
      return false;
    }
    
    try {
      // Clear existing consent store
      this.consentStore.clear();
      
      // Import consents
      Object.entries(importData.consents).forEach(([category, data]) => {
        this.consentStore.set(category, { ...data });
      });
      
      // Log the import operation
      if (this.options.enableAudit) {
        this._logConsentOperation('import', {
          timestamp: importData.timestamp,
          version: importData.version || 'unknown'
        });
      }
      
      // Emit consent imported event
      this.emit('consent:imported', {
        timestamp: new Date().toISOString(),
        source: importData.timestamp
      });
      
      return true;
    } catch (error) {
      console.error('Error importing consent data:', error);
      return false;
    }
  }
}

// Export constants and class
export {
  CONSENT_CATEGORIES,
  CONSENT_STATUS,
  ConsentEnforcer
};

// Create and export default instance
const consentEnforcer = new ConsentEnforcer();
export { consentEnforcer };
