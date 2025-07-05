/**
 * ALEJO Privacy Guard
 * 
 * This module ensures personal data remains protected throughout ALEJO's operations
 * by implementing privacy controls, data filtering, and consent enforcement.
 * 
 * @module alejo/integration/security/privacy_guard
 */

import EventEmitter from 'events';
import { consentEnforcer } from './consent_enforcer.js';

// Privacy sensitivity levels
const SENSITIVITY_LEVELS = {
  PUBLIC: 0,      // Non-sensitive data, can be shared freely
  LOW: 1,         // Minimally sensitive, can be used with basic protections
  MEDIUM: 2,      // Moderately sensitive, requires proper handling
  HIGH: 3,        // Highly sensitive, requires strict protections
  CRITICAL: 4     // Extremely sensitive, maximum protection required
};

// Data categories for privacy classification
const DATA_CATEGORIES = {
  IDENTITY: 'identity',           // Name, email, phone, etc.
  BIOMETRIC: 'biometric',         // Face, voice, fingerprints
  LOCATION: 'location',           // Geographic location data
  BEHAVIORAL: 'behavioral',       // Usage patterns, preferences
  CONTENT: 'content',             // User-generated content
  FINANCIAL: 'financial',         // Payment info, financial data
  HEALTH: 'health',               // Health-related information
  SOCIAL: 'social',               // Social connections, relationships
  DEVICE: 'device',               // Device identifiers, IP address
  COMMUNICATION: 'communication'  // Messages, emails, calls
};

// Privacy operations
const PRIVACY_OPERATIONS = {
  FILTER: 'filter',               // Remove sensitive data
  ANONYMIZE: 'anonymize',         // Replace with anonymous values
  PSEUDONYMIZE: 'pseudonymize',   // Replace with consistent pseudonyms
  ENCRYPT: 'encrypt',             // Encrypt sensitive data
  REDACT: 'redact',               // Replace with placeholder
  AGGREGATE: 'aggregate'          // Use only in aggregate form
};

/**
 * PrivacyGuard class that manages privacy protection
 */
class PrivacyGuard extends EventEmitter {
  /**
   * Create a new PrivacyGuard instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictMode - Whether to use strict privacy protection
   * @param {Object} options.defaultSensitivity - Default sensitivity mapping for data types
   * @param {boolean} options.enforceConsent - Whether to enforce consent requirements
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      strictMode: true,
      enforceConsent: true,
      defaultThreshold: SENSITIVITY_LEVELS.LOW,
      defaultSensitivity: {
        [DATA_CATEGORIES.IDENTITY]: SENSITIVITY_LEVELS.HIGH,
        [DATA_CATEGORIES.BIOMETRIC]: SENSITIVITY_LEVELS.CRITICAL,
        [DATA_CATEGORIES.LOCATION]: SENSITIVITY_LEVELS.HIGH,
        [DATA_CATEGORIES.BEHAVIORAL]: SENSITIVITY_LEVELS.MEDIUM,
        [DATA_CATEGORIES.CONTENT]: SENSITIVITY_LEVELS.MEDIUM,
        [DATA_CATEGORIES.FINANCIAL]: SENSITIVITY_LEVELS.CRITICAL,
        [DATA_CATEGORIES.HEALTH]: SENSITIVITY_LEVELS.CRITICAL,
        [DATA_CATEGORIES.SOCIAL]: SENSITIVITY_LEVELS.MEDIUM,
        [DATA_CATEGORIES.DEVICE]: SENSITIVITY_LEVELS.MEDIUM,
        [DATA_CATEGORIES.COMMUNICATION]: SENSITIVITY_LEVELS.HIGH
      },
      ...options
    };
    
    // Initialize patterns for sensitive data detection
    this._initSensitiveDataPatterns();
    
    // Initialize event listeners
    this._initEventListeners();
    
    // Initialize audit trail
    this.auditTrail = [];
    this.auditEnabled = true;
  }
  
  /**
   * Initialize patterns for sensitive data detection
   * @private
   */
  _initSensitiveDataPatterns() {
    this.sensitiveDataPatterns = {
      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      
      // Phone numbers (various formats)
      phone: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
      
      // Social Security Numbers (US)
      ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
      
      // Credit card numbers
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
      
      // IP addresses
      ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
      
      // Street addresses (simplified)
      streetAddress: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|court|ct|lane|ln|way|parkway|pkwy)\b/i,
      
      // GPS coordinates
      gpsCoords: /\b[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\b/,
      
      // Dates of birth
      dob: /\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/
    };
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
    
    // Listen for consent changes
    this.on('consent:update', (consentData) => {
      this._handleConsentUpdate(consentData);
    });
  }
  
  /**
   * Filter sensitive data from input
   * @param {string} dataType - Type of data being filtered
   * @param {Object|string} data - Data to filter
   * @param {Object} options - Filtering options
   * @param {number} options.sensitivityThreshold - Minimum sensitivity level to filter
   * @param {Array<string>} options.allowedCategories - Categories allowed to pass through
   * @param {string} options.operation - Privacy operation to perform
   * @returns {Object|string} - Filtered data
   */
  filterSensitiveData(dataType, data, options = {}) {
    // Default options
    const filterOptions = {
      sensitivityThreshold: this.options.defaultThreshold,
      allowedCategories: [],
      operation: PRIVACY_OPERATIONS.FILTER,
      ...options
    };
    
    // Check if consent is required and enforced
    if (this.options.enforceConsent) {
      try {
        const hasConsent = this._checkConsent(dataType);
        if (!hasConsent) {
          // If no consent, apply strictest filtering
          filterOptions.sensitivityThreshold = SENSITIVITY_LEVELS.PUBLIC;
          filterOptions.operation = PRIVACY_OPERATIONS.REDACT;
        }
      } catch (error) {
        console.error('Error checking consent:', error);
        // Default to strict filtering on consent check error
        filterOptions.sensitivityThreshold = SENSITIVITY_LEVELS.PUBLIC;
      }
    }
    
    // Process based on data type
    if (typeof data === 'string') {
      return this._filterStringData(data, filterOptions);
    } else if (typeof data === 'object' && data !== null) {
      return this._filterObjectData(data, filterOptions);
    }
    
    // Return unchanged for unsupported types
    return data;
  }
  
  /**
   * Filter sensitive data from string
   * @private
   * @param {string} text - Text to filter
   * @param {Object} options - Filtering options
   * @returns {string} - Filtered text
   */
  _filterStringData(text, options) {
    let filteredText = text;
    
    // Apply pattern-based filtering
    Object.entries(this.sensitiveDataPatterns).forEach(([patternName, pattern]) => {
      const category = this._mapPatternToCategory(patternName);
      const sensitivity = this._getCategorySensitivity(category);
      
      // Check if this category should be filtered
      if (sensitivity >= options.sensitivityThreshold && 
          !options.allowedCategories.includes(category)) {
        
        // Apply the selected privacy operation
        switch (options.operation) {
          case PRIVACY_OPERATIONS.REDACT:
            filteredText = filteredText.replace(pattern, '[REDACTED]');
            break;
          case PRIVACY_OPERATIONS.ANONYMIZE:
            filteredText = filteredText.replace(pattern, `[ANONYMIZED ${category.toUpperCase()}]`);
            break;
          case PRIVACY_OPERATIONS.PSEUDONYMIZE:
            filteredText = this._pseudonymizeMatch(filteredText, pattern, category);
            break;
          case PRIVACY_OPERATIONS.FILTER:
          default:
            filteredText = filteredText.replace(pattern, '[FILTERED]');
        }
      }
    });
    
    // Log the filtering operation if audit is enabled
    if (this.auditEnabled) {
      this._logPrivacyOperation('string_filter', {
        operation: options.operation,
        threshold: options.sensitivityThreshold,
        inputLength: text.length,
        outputLength: filteredText.length,
        wasModified: text !== filteredText
      });
    }
    
    return filteredText;
  }
  
  /**
   * Filter sensitive data from object
   * @private
   * @param {Object} data - Object to filter
   * @param {Object} options - Filtering options
   * @returns {Object} - Filtered object
   */
  _filterObjectData(data, options) {
    // Create a deep copy to avoid modifying the original
    const filteredData = JSON.parse(JSON.stringify(data));
    let modified = false;
    
    // Process each property recursively
    const processObject = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        const category = this._inferCategoryFromKey(key);
        const sensitivity = this._getCategorySensitivity(category);
        
        // Check if this category should be filtered
        if (sensitivity >= options.sensitivityThreshold && 
            !options.allowedCategories.includes(category)) {
          
          // Handle based on value type
          if (typeof value === 'string') {
            // Apply the selected privacy operation to string values
            switch (options.operation) {
              case PRIVACY_OPERATIONS.REDACT:
                obj[key] = '[REDACTED]';
                modified = true;
                break;
              case PRIVACY_OPERATIONS.ANONYMIZE:
                obj[key] = `[ANONYMIZED ${category.toUpperCase()}]`;
                modified = true;
                break;
              case PRIVACY_OPERATIONS.PSEUDONYMIZE:
                obj[key] = this._generatePseudonym(value, category);
                modified = true;
                break;
              case PRIVACY_OPERATIONS.ENCRYPT:
                obj[key] = `[ENCRYPTED]`;  // Actual encryption would happen here
                modified = true;
                break;
              case PRIVACY_OPERATIONS.FILTER:
              default:
                delete obj[key];
                modified = true;
            }
          } else if (typeof value === 'object' && value !== null) {
            // Recursively process nested objects
            processObject(value, currentPath);
          } else {
            // For non-string primitives in sensitive fields
            switch (options.operation) {
              case PRIVACY_OPERATIONS.REDACT:
              case PRIVACY_OPERATIONS.ANONYMIZE:
                obj[key] = `[PROTECTED]`;
                modified = true;
                break;
              case PRIVACY_OPERATIONS.FILTER:
              default:
                delete obj[key];
                modified = true;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          // Continue processing non-sensitive objects
          processObject(value, currentPath);
        } else if (typeof value === 'string') {
          // Check string values for sensitive patterns
          const filteredString = this._filterStringData(value, options);
          if (filteredString !== value) {
            obj[key] = filteredString;
            modified = true;
          }
        }
      });
      
      return obj;
    };
    
    // Process the root object
    processObject(filteredData);
    
    // Log the filtering operation if audit is enabled
    if (this.auditEnabled) {
      this._logPrivacyOperation('object_filter', {
        operation: options.operation,
        threshold: options.sensitivityThreshold,
        wasModified: modified
      });
    }
    
    return filteredData;
  }
  
  /**
   * Map pattern name to data category
   * @private
   * @param {string} patternName - Name of the pattern
   * @returns {string} - Data category
   */
  _mapPatternToCategory(patternName) {
    const categoryMap = {
      email: DATA_CATEGORIES.IDENTITY,
      phone: DATA_CATEGORIES.IDENTITY,
      ssn: DATA_CATEGORIES.IDENTITY,
      creditCard: DATA_CATEGORIES.FINANCIAL,
      ipAddress: DATA_CATEGORIES.DEVICE,
      streetAddress: DATA_CATEGORIES.LOCATION,
      gpsCoords: DATA_CATEGORIES.LOCATION,
      dob: DATA_CATEGORIES.IDENTITY
    };
    
    return categoryMap[patternName] || DATA_CATEGORIES.CONTENT;
  }
  
  /**
   * Infer data category from object key
   * @private
   * @param {string} key - Object key
   * @returns {string} - Data category
   */
  _inferCategoryFromKey(key) {
    // Convert key to lowercase for case-insensitive matching
    const lowerKey = key.toLowerCase();
    
    // Identity fields
    if (/name|email|phone|ssn|social|passport|id|username|user_id|account/.test(lowerKey)) {
      return DATA_CATEGORIES.IDENTITY;
    }
    
    // Biometric fields
    if (/face|voice|fingerprint|retina|biometric|recognition/.test(lowerKey)) {
      return DATA_CATEGORIES.BIOMETRIC;
    }
    
    // Location fields
    if (/location|address|gps|coord|latitude|longitude|city|state|country|zip|postal/.test(lowerKey)) {
      return DATA_CATEGORIES.LOCATION;
    }
    
    // Behavioral fields
    if (/preference|behavior|habit|history|usage|activity|pattern|interest/.test(lowerKey)) {
      return DATA_CATEGORIES.BEHAVIORAL;
    }
    
    // Content fields
    if (/content|message|post|comment|text|description|note/.test(lowerKey)) {
      return DATA_CATEGORIES.CONTENT;
    }
    
    // Financial fields
    if (/payment|card|bank|financial|money|transaction|credit|debit|invoice|price|cost/.test(lowerKey)) {
      return DATA_CATEGORIES.FINANCIAL;
    }
    
    // Health fields
    if (/health|medical|doctor|patient|diagnosis|treatment|medication|condition/.test(lowerKey)) {
      return DATA_CATEGORIES.HEALTH;
    }
    
    // Social fields
    if (/friend|contact|connection|social|network|relation|family|colleague/.test(lowerKey)) {
      return DATA_CATEGORIES.SOCIAL;
    }
    
    // Device fields
    if (/device|ip|mac|hardware|browser|system|platform|agent/.test(lowerKey)) {
      return DATA_CATEGORIES.DEVICE;
    }
    
    // Communication fields
    if (/message|email|chat|call|communication|conversation|thread/.test(lowerKey)) {
      return DATA_CATEGORIES.COMMUNICATION;
    }
    
    // Default to content for unknown keys
    return DATA_CATEGORIES.CONTENT;
  }
  
  /**
   * Get sensitivity level for a data category
   * @private
   * @param {string} category - Data category
   * @returns {number} - Sensitivity level
   */
  _getCategorySensitivity(category) {
    return this.options.defaultSensitivity[category] || SENSITIVITY_LEVELS.MEDIUM;
  }
  
  /**
   * Generate a pseudonym for a value
   * @private
   * @param {string} value - Original value
   * @param {string} category - Data category
   * @returns {string} - Pseudonym
   */
  _generatePseudonym(value, category) {
    // In a real implementation, this would use a consistent hashing algorithm
    // to generate the same pseudonym for the same input value
    // For this example, we'll just use a placeholder
    return `[PSEUDONYM-${category.toUpperCase()}]`;
  }
  
  /**
   * Pseudonymize matches in text
   * @private
   * @param {string} text - Text to process
   * @param {RegExp} pattern - Pattern to match
   * @param {string} category - Data category
   * @returns {string} - Processed text
   */
  _pseudonymizeMatch(text, pattern, category) {
    return text.replace(pattern, (match) => {
      return this._generatePseudonym(match, category);
    });
  }
  
  /**
   * Check if consent has been given for processing a data type
   * @private
   * @param {string} dataType - Type of data
   * @returns {boolean} - Whether consent has been given
   */
  _checkConsent(dataType) {
    try {
      return consentEnforcer.checkConsent(dataType);
    } catch (error) {
      console.error('Error checking consent:', error);
      // Default to no consent on error
      return false;
    }
  }
  
  /**
   * Handle consent update
   * @private
   * @param {Object} consentData - Updated consent data
   */
  _handleConsentUpdate(consentData) {
    // Log the consent update
    if (this.auditEnabled) {
      this._logPrivacyOperation('consent_update', {
        consentUpdated: true,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Log privacy operation to audit trail
   * @private
   * @param {string} operation - Operation name
   * @param {Object} details - Operation details
   */
  _logPrivacyOperation(operation, details) {
    if (!this.auditEnabled) {
      return;
    }
    
    this.auditTrail.push({
      operation,
      timestamp: new Date().toISOString(),
      details
    });
    
    // Limit audit trail size
    if (this.auditTrail.length > 1000) {
      this.auditTrail.shift();
    }
    
    // Emit audit event
    this.emit('privacy:audit', {
      operation,
      timestamp: new Date().toISOString(),
      details
    });
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
   * Get current privacy settings
   * @returns {Object} - Current privacy settings
   */
  getPrivacySettings() {
    return {
      strictMode: this.options.strictMode,
      enforceConsent: this.options.enforceConsent,
      defaultThreshold: this.options.defaultThreshold,
      sensitivityLevels: { ...this.options.defaultSensitivity }
    };
  }
  
  /**
   * Enable or disable audit trail
   * @param {boolean} enabled - Whether audit trail should be enabled
   */
  setAuditEnabled(enabled) {
    this.auditEnabled = !!enabled;
  }
  
  /**
   * Get audit trail
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Audit trail entries
   */
  getAuditTrail(limit = 100) {
    return this.auditTrail.slice(-limit);
  }
  
  /**
   * Clear audit trail
   */
  clearAuditTrail() {
    this.auditTrail = [];
    this.emit('privacy:audit:cleared');
  }
}

// Export constants and class
export {
  SENSITIVITY_LEVELS,
  DATA_CATEGORIES,
  PRIVACY_OPERATIONS,
  PrivacyGuard
};

// Create and export default instance
const privacyGuard = new PrivacyGuard();
export { privacyGuard };
