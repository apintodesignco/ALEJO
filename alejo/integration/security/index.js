/**
 * ALEJO Security Layer
 * 
 * This module exports all security-related components for ALEJO's integration layer,
 * providing a unified interface for security features across the application.
 * 
 * @module alejo/integration/security
 */

// Import security components
import { auditTrail, AUDIT_EVENT_TYPES, AUDIT_SEVERITY } from './audit_trail.js';
import { consentEnforcer, CONSENT_CATEGORIES, CONSENT_STATUS } from './consent_enforcer.js';
import { privacyGuard, SENSITIVITY_LEVELS, DATA_CATEGORIES, PRIVACY_OPERATIONS } from './privacy_guard.js';

// Import ethics components
import { boundaryEnforcer, BOUNDARY_CATEGORIES, ENFORCEMENT_LEVELS, RESPONSE_FORMATS } from '../ethics/boundary_enforcer.js';
import { valueAlignment, VALUE_DOMAINS, ALIGNMENT_LEVELS } from '../ethics/value_alignment.js';
import { transparency, TRANSPARENCY_CATEGORIES, DETAIL_LEVELS } from '../ethics/transparency.js';
import { ethicsManager } from '../ethics/index.js';

/**
 * Security manager that provides a unified interface to all security components
 */
class SecurityManager {
  /**
   * Create a new SecurityManager instance
   */
  constructor() {
    this.initialized = false;
    this.components = {
      auditTrail,
      consentEnforcer,
      privacyGuard,
      boundaryEnforcer,
      valueAlignment,
      transparency,
      ethicsManager
    };
  }
  
  /**
   * Initialize all security components
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    try {
      // Apply configuration to components
      if (options.audit) {
        this.components.auditTrail.updateConfiguration(options.audit);
      }
      
      if (options.consent) {
        this.components.consentEnforcer.updateConfiguration(options.consent);
      }
      
      if (options.privacy) {
        this.components.privacyGuard.updateConfiguration(options.privacy);
      }
      
      if (options.boundaries) {
        this.components.boundaryEnforcer.updateConfiguration(options.boundaries);
      }
      
      if (options.values) {
        this.components.valueAlignment.updateConfiguration(options.values);
      }
      
      if (options.transparency) {
        this.components.transparency.updateConfiguration(options.transparency);
      }
      
      // Initialize ethics manager if not already initialized
      if (!this.components.ethicsManager.initialized) {
        await this.components.ethicsManager.initialize({
          boundaries: options.boundaries,
          values: options.values,
          transparency: options.transparency
        });
      }
      
      // Log initialization
      this.components.auditTrail.logEvent('system', {
        action: 'security_layer_initialized',
        severity: AUDIT_SEVERITY.INFO,
        timestamp: new Date().toISOString()
      });
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing security layer:', error);
      return false;
    }
  }
  
  /**
   * Check if content respects all security boundaries
   * @param {string} content - Content to check
   * @param {Object} context - Additional context
   * @returns {Object} - Security check result
   */
  checkSecurityBoundaries(content, context = {}) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    // Check boundary enforcement
    const boundaryResult = this.components.boundaryEnforcer.checkBoundaries(
      content, 
      context,
      RESPONSE_FORMATS.INTERNAL
    );
    
    return {
      allowed: boundaryResult.allowed,
      boundaries: boundaryResult.boundaries,
      warnings: boundaryResult.warnings,
      enforcementActions: boundaryResult.enforcementActions
    };
  }
  
  /**
   * Filter sensitive data from content
   * @param {string} dataType - Type of data
   * @param {Object|string} data - Data to filter
   * @param {Object} options - Filtering options
   * @returns {Object|string} - Filtered data
   */
  filterSensitiveData(dataType, data, options = {}) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.privacyGuard.filterSensitiveData(dataType, data, options);
  }
  
  /**
   * Check if consent has been given for a specific category
   * @param {string} category - Consent category
   * @returns {boolean} - Whether consent has been granted
   */
  checkConsent(category) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.consentEnforcer.checkConsent(category);
  }
  
  /**
   * Check if content aligns with user values
   * @param {string} content - Content to check
   * @param {Array<string>} domains - Value domains to check against
   * @returns {Object} - Value alignment check result
   */
  checkValueAlignment(content, domains = null) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.valueAlignment.checkValueAlignment(content, domains);
  }
  
  /**
   * Generate an explanation for a transparency category
   * @param {string} category - Transparency category
   * @param {Object} data - Data to include in the explanation
   * @param {Object} options - Explanation options
   * @returns {string|Object} - Generated explanation
   */
  generateExplanation(category, data = {}, options = {}) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.transparency.generateExplanation(category, data, options);
  }
  
  /**
   * Create a safe response that respects boundaries and aligns with values
   * @param {string} content - Original content
   * @param {Object} options - Options for response creation
   * @returns {Object} - Safe response
   */
  createSafeResponse(content, options = {}) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.ethicsManager.createSafeResponse(content, options);
  }
  
  /**
   * Log a security event
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   * @returns {string} - ID of the audit entry
   */
  logSecurityEvent(eventType, eventData) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    return this.components.auditTrail.logEvent(eventType, eventData);
  }
  
  /**
   * Create a safe response that respects security boundaries
   * @param {string} content - Original content
   * @param {Object} context - Additional context
   * @param {string} defaultResponse - Default response if allowed
   * @returns {string|Object} - Safe response
   */
  createSafeResponse(content, context, defaultResponse) {
    if (!this.initialized) {
      console.warn('Security layer not initialized');
    }
    
    // Check boundaries
    const boundaryResult = this.components.boundaryEnforcer.checkBoundaries(
      content, 
      context
    );
    
    // Create safe response
    return this.components.boundaryEnforcer.createSafeResponse(
      boundaryResult,
      defaultResponse
    );
  }
  
  /**
   * Get the security status
   * @returns {Object} - Security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      audit: {
        enabled: this.components.auditTrail.options.enabled,
        entryCount: this.components.auditTrail.getAuditEntries().length
      },
      consent: {
        strictMode: this.components.consentEnforcer.options.strictMode,
        categories: Object.keys(CONSENT_CATEGORIES)
      },
      privacy: {
        strictMode: this.components.privacyGuard.options.strictMode,
        defaultSensitivityLevel: this.components.privacyGuard.options.defaultSensitivityLevel
      },
      boundaries: {
        enabled: this.components.boundaryEnforcer.options.enabled,
        strictMode: this.components.boundaryEnforcer.options.strictMode,
        categories: Object.keys(BOUNDARY_CATEGORIES)
      },
      values: {
        enableLearning: this.components.valueAlignment.options.enableLearning,
        strictAlignment: this.components.valueAlignment.options.strictAlignment,
        domains: Object.keys(VALUE_DOMAINS)
      },
      transparency: {
        defaultDetailLevel: this.components.transparency.options.defaultDetailLevel,
        defaultFormat: this.components.transparency.options.defaultFormat,
        categories: Object.keys(TRANSPARENCY_CATEGORIES)
      },
      ethics: {
        initialized: this.components.ethicsManager.initialized
      }
    };
  }
}

// Create and export default instance
const securityManager = new SecurityManager();

// Export all components and constants
export {
  securityManager,
  auditTrail,
  consentEnforcer,
  privacyGuard,
  boundaryEnforcer,
  valueAlignment,
  transparency,
  ethicsManager,
  AUDIT_EVENT_TYPES,
  AUDIT_SEVERITY,
  CONSENT_CATEGORIES,
  CONSENT_STATUS,
  SENSITIVITY_LEVELS,
  DATA_CATEGORIES,
  PRIVACY_OPERATIONS,
  BOUNDARY_CATEGORIES,
  ENFORCEMENT_LEVELS,
  RESPONSE_FORMATS,
  VALUE_DOMAINS,
  ALIGNMENT_LEVELS,
  TRANSPARENCY_CATEGORIES,
  DETAIL_LEVELS
};
