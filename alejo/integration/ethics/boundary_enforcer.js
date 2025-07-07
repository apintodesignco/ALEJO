/**
 * ALEJO Boundary Enforcer
 * 
 * This module prevents harmful behavior or reasoning by enforcing ethical
 * boundaries and content filtering across ALEJO's operations.
 * 
 * @module alejo/integration/ethics/boundary_enforcer
 */

import EventEmitter from 'events';
import { auditTrail } from '../security/audit_trail.js';
import { consentEnforcer } from '../security/consent_enforcer.js';

// Boundary categories
const BOUNDARY_CATEGORIES = {
  SAFETY: 'safety',               // Physical or psychological safety
  LEGAL: 'legal',                 // Legal compliance
  PRIVACY: 'privacy',             // Privacy protection
  ETHICS: 'ethics',               // Ethical considerations
  CONTENT: 'content',             // Content appropriateness
  BEHAVIOR: 'behavior',           // Behavioral boundaries
  TECHNICAL: 'technical'          // Technical limitations
};

// Enforcement levels
const ENFORCEMENT_LEVELS = {
  BLOCK: 'block',                 // Block the action entirely
  WARN: 'warn',                   // Warn but allow with acknowledgment
  MONITOR: 'monitor',             // Allow but log for review
  INFORM: 'inform'                // Inform user of boundary
};

// Response formats
const RESPONSE_FORMATS = {
  TEXT: 'text',                   // Plain text response
  HTML: 'html',                   // HTML formatted response
  JSON: 'json',                   // JSON structured response
  INTERNAL: 'internal'            // Internal system response
};

/**
 * BoundaryEnforcer class that manages ethical boundaries
 */
class BoundaryEnforcer extends EventEmitter {
  /**
   * Create a new BoundaryEnforcer instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictMode - Whether to use strict boundary enforcement
   * @param {Object} options.defaultEnforcementLevels - Default enforcement levels by category
   * @param {boolean} options.enableAudit - Whether to enable audit logging
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      strictMode: true,
      enableAudit: true,
      userConfigurable: true,
      defaultResponseFormat: RESPONSE_FORMATS.TEXT,
      defaultEnforcementLevels: {
        [BOUNDARY_CATEGORIES.SAFETY]: ENFORCEMENT_LEVELS.BLOCK,
        [BOUNDARY_CATEGORIES.LEGAL]: ENFORCEMENT_LEVELS.BLOCK,
        [BOUNDARY_CATEGORIES.PRIVACY]: ENFORCEMENT_LEVELS.BLOCK,
        [BOUNDARY_CATEGORIES.ETHICS]: ENFORCEMENT_LEVELS.WARN,
        [BOUNDARY_CATEGORIES.CONTENT]: ENFORCEMENT_LEVELS.WARN,
        [BOUNDARY_CATEGORIES.BEHAVIOR]: ENFORCEMENT_LEVELS.MONITOR,
        [BOUNDARY_CATEGORIES.TECHNICAL]: ENFORCEMENT_LEVELS.INFORM
      },
      ...options
    };
    
    // Initialize boundary rules
    this.boundaryRules = new Map();
    
    // Initialize default rules
    this._initDefaultRules();
    
    // Initialize event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize default boundary rules
   * @private
   */
  _initDefaultRules() {
    // Safety rules
    this._addRule(BOUNDARY_CATEGORIES.SAFETY, 'physical_harm', {
      description: 'Content that could cause physical harm',
      patterns: [
        /how to (make|create|build) (bomb|explosive|weapon|poison)/i,
        /how to (harm|hurt|injure|kill)/i,
        /(suicide|self-harm) (method|technique|instruction)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'This content could potentially cause physical harm and cannot be provided.'
    });
    
    this._addRule(BOUNDARY_CATEGORIES.SAFETY, 'self_harm', {
      description: 'Content promoting self-harm or suicide',
      patterns: [
        /(ways|methods|how) to (commit suicide|harm (yourself|myself|oneself))/i,
        /(suicide|self-harm) (instruction|guide|method)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'I cannot provide information that could promote self-harm. If you or someone you know is struggling, please contact a mental health professional or crisis helpline.'
    });
    
    // Legal rules
    this._addRule(BOUNDARY_CATEGORIES.LEGAL, 'illegal_activity', {
      description: 'Content that promotes illegal activities',
      patterns: [
        /how to (hack|steal|defraud|counterfeit)/i,
        /(evade|avoid) (taxes|law enforcement)/i,
        /access (private|restricted|confidential) (data|information|system)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'I cannot provide information about illegal activities.'
    });
    
    // Privacy rules
    this._addRule(BOUNDARY_CATEGORIES.PRIVACY, 'data_protection', {
      description: 'Content that could compromise data protection',
      patterns: [
        /bypass (authentication|security|encryption)/i,
        /(steal|obtain) (password|credential|token)/i,
        /access (without permission|unauthorized)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'I cannot provide information that could compromise data protection or security.'
    });
    
    // Ethics rules
    this._addRule(BOUNDARY_CATEGORIES.ETHICS, 'discrimination', {
      description: 'Content that promotes discrimination',
      patterns: [
        /(superiority|inferiority) of (race|gender|religion|ethnicity)/i,
        /(hate|discriminate) against (group|community|people)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'I cannot provide content that promotes discrimination or hatred.'
    });
    
    // Content rules
    this._addRule(BOUNDARY_CATEGORIES.CONTENT, 'adult_content', {
      description: 'Adult or explicit content',
      patterns: [
        /(explicit|pornographic|sexual) (content|material|image)/i,
        /(generate|create) (nude|sexual|explicit) (image|picture|content)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
      response: 'I cannot provide or generate explicit adult content.'
    });
    
    // Behavior rules
    this._addRule(BOUNDARY_CATEGORIES.BEHAVIOR, 'impersonation', {
      description: 'Impersonation of individuals or entities',
      patterns: [
        /pretend to be (someone else|another person|entity)/i,
        /(impersonate|pose as) (person|company|organization)/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.WARN,
      response: 'Impersonation can be problematic and potentially harmful. Please reconsider this request.'
    });
    
    // Technical rules
    this._addRule(BOUNDARY_CATEGORIES.TECHNICAL, 'resource_limits', {
      description: 'Requests exceeding system resource limits',
      patterns: [
        /(generate|create) (very large|massive|huge) (file|dataset|content)/i,
        /(process|analyze) (gigabytes|terabytes) of data/i
      ],
      enforcementLevel: ENFORCEMENT_LEVELS.INFORM,
      response: 'This request may exceed system resource limits and might not be completable.'
    });
  }
  
  /**
   * Add a boundary rule
   * @private
   * @param {string} category - Boundary category
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} ruleConfig - Rule configuration
   */
  _addRule(category, ruleId, ruleConfig) {
    const fullRuleId = `${category}.${ruleId}`;
    this.boundaryRules.set(fullRuleId, {
      category,
      id: ruleId,
      ...ruleConfig
    });
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
    
    // Listen for rule updates
    this.on('rules:update', (ruleUpdates) => {
      this._handleRuleUpdates(ruleUpdates);
    });
  }
  
  /**
   * Check content against boundary rules
   * @param {string} content - Content to check
   * @param {Object} context - Additional context about the content
   * @param {string} responseFormat - Format for response messages
   * @returns {Object} - Check result
   */
  checkBoundaries(content, context = {}, responseFormat = this.options.defaultResponseFormat) {
    const result = {
      allowed: true,
      boundaries: [],
      warnings: [],
      enforcementActions: []
    };
    
    // Skip empty content
    if (!content || content.trim() === '') {
      return result;
    }
    
    // Check each rule
    for (const [ruleId, rule] of this.boundaryRules.entries()) {
      // Skip disabled rules
      if (rule.disabled) {
        continue;
      }
      
      // Check if content matches rule patterns
      let matched = false;
      
      if (rule.patterns) {
        for (const pattern of rule.patterns) {
          if (pattern.test(content)) {
            matched = true;
            break;
          }
        }
      }
      
      // If rule matched, apply enforcement
      if (matched) {
        // Get effective enforcement level (context may override default)
        const enforcementLevel = this._getEffectiveEnforcementLevel(rule, context);
        
        // Add boundary information
        result.boundaries.push({
          category: rule.category,
          ruleId: rule.id,
          description: rule.description
        });
        
        // Apply enforcement action based on level
        switch (enforcementLevel) {
          case ENFORCEMENT_LEVELS.BLOCK:
            result.allowed = false;
            result.enforcementActions.push({
              action: 'block',
              ruleId: rule.id,
              category: rule.category,
              response: this._formatResponse(rule.response, responseFormat)
            });
            break;
          case ENFORCEMENT_LEVELS.WARN:
            result.warnings.push({
              ruleId: rule.id,
              category: rule.category,
              response: this._formatResponse(rule.response, responseFormat)
            });
            break;
          case ENFORCEMENT_LEVELS.MONITOR:
            // Just log the event, don't modify result
            break;
          case ENFORCEMENT_LEVELS.INFORM:
            result.enforcementActions.push({
              action: 'inform',
              ruleId: rule.id,
              category: rule.category,
              response: this._formatResponse(rule.response, responseFormat)
            });
            break;
        }
        
        // Log the boundary check if audit is enabled
        if (this.options.enableAudit) {
          this._logBoundaryCheck(rule, enforcementLevel, content, context);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Format response based on requested format
   * @private
   * @param {string} response - Response message
   * @param {string} format - Response format
   * @returns {string|Object} - Formatted response
   */
  _formatResponse(response, format) {
    switch (format) {
      case RESPONSE_FORMATS.HTML:
        return `<div class="alejo-boundary-message">${response}</div>`;
      case RESPONSE_FORMATS.JSON:
        return { message: response, type: 'boundary_enforcement' };
      case RESPONSE_FORMATS.INTERNAL:
        return { 
          message: response, 
          type: 'boundary_enforcement',
          internal: true
        };
      case RESPONSE_FORMATS.TEXT:
      default:
        return response;
    }
  }
  
  /**
   * Get effective enforcement level based on rule and context
   * @private
   * @param {Object} rule - Boundary rule
   * @param {Object} context - Context information
   * @returns {string} - Effective enforcement level
   */
  _getEffectiveEnforcementLevel(rule, context) {
    // Context can override default enforcement level
    if (context.enforcementOverrides && 
        context.enforcementOverrides[rule.category] || 
        context.enforcementOverrides[`${rule.category}.${rule.id}`]) {
      return context.enforcementOverrides[rule.category] || 
             context.enforcementOverrides[`${rule.category}.${rule.id}`];
    }
    
    // Use rule-specific level if available
    if (rule.enforcementLevel) {
      return rule.enforcementLevel;
    }
    
    // Fall back to category default
    return this.options.defaultEnforcementLevels[rule.category] || 
           ENFORCEMENT_LEVELS.WARN;
  }
  
  /**
   * Log boundary check to audit trail
   * @private
   * @param {Object} rule - Boundary rule
   * @param {string} enforcementLevel - Enforcement level applied
   * @param {string} content - Content that was checked
   * @param {Object} context - Additional context
   */
  _logBoundaryCheck(rule, enforcementLevel, content, context) {
    try {
      auditTrail.logEvent('security', {
        action: 'boundary_check',
        category: rule.category,
        ruleId: rule.id,
        enforcementLevel,
        contentExcerpt: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        contentLength: content.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging boundary check to audit trail:', error);
      
      // Fallback to local event emission
      this.emit('boundary:check', {
        rule: `${rule.category}.${rule.id}`,
        enforcementLevel,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle rule updates
   * @private
   * @param {Array|Object} ruleUpdates - Updates to apply to rules
   */
  _handleRuleUpdates(ruleUpdates) {
    // Handle array of updates
    if (Array.isArray(ruleUpdates)) {
      ruleUpdates.forEach(update => this._applyRuleUpdate(update));
    } 
    // Handle single update
    else if (typeof ruleUpdates === 'object') {
      this._applyRuleUpdate(ruleUpdates);
    }
    
    // Log the update
    if (this.options.enableAudit) {
      try {
        auditTrail.logEvent('system', {
          action: 'boundary_rules_updated',
          updateCount: Array.isArray(ruleUpdates) ? ruleUpdates.length : 1,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error logging rule updates to audit trail:', error);
      }
    }
    
    // Emit rules updated event
    this.emit('rules:updated');
  }
  
  /**
   * Apply a single rule update
   * @private
   * @param {Object} update - Rule update
   */
  _applyRuleUpdate(update) {
    if (!update || !update.ruleId) {
      console.error('Invalid rule update:', update);
      return;
    }
    
    const { ruleId, category, action, config } = update;
    const fullRuleId = category ? `${category}.${ruleId}` : ruleId;
    
    switch (action) {
      case 'add':
        if (category && config) {
          this._addRule(category, ruleId, config);
        }
        break;
      case 'update':
        if (this.boundaryRules.has(fullRuleId) && config) {
          const existingRule = this.boundaryRules.get(fullRuleId);
          this.boundaryRules.set(fullRuleId, {
            ...existingRule,
            ...config
          });
        }
        break;
      case 'disable':
        if (this.boundaryRules.has(fullRuleId)) {
          const existingRule = this.boundaryRules.get(fullRuleId);
          this.boundaryRules.set(fullRuleId, {
            ...existingRule,
            disabled: true
          });
        }
        break;
      case 'enable':
        if (this.boundaryRules.has(fullRuleId)) {
          const existingRule = this.boundaryRules.get(fullRuleId);
          this.boundaryRules.set(fullRuleId, {
            ...existingRule,
            disabled: false
          });
        }
        break;
      case 'delete':
        this.boundaryRules.delete(fullRuleId);
        break;
      default:
        console.error(`Unknown rule update action: ${action}`);
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
   * Get all boundary rules
   * @param {string} category - Optional category filter
   * @returns {Array} - Boundary rules
   */
  getBoundaryRules(category = null) {
    const rules = [];
    
    for (const [ruleId, rule] of this.boundaryRules.entries()) {
      if (!category || rule.category === category) {
        rules.push({
          id: ruleId,
          ...rule
        });
      }
    }
    
    return rules;
  }
  
  /**
   * Get user-configurable boundary settings
   * @returns {Object} - User-configurable settings
   */
  getUserConfigurableSettings() {
    if (!this.options.userConfigurable) {
      return null;
    }
    
    const settings = {
      enforcementLevels: { ...this.options.defaultEnforcementLevels },
      categories: Object.values(BOUNDARY_CATEGORIES),
      levels: Object.values(ENFORCEMENT_LEVELS)
    };
    
    return settings;
  }
  
  /**
   * Update user boundary preferences
   * @param {Object} preferences - User preferences
   * @returns {boolean} - Whether the update was successful
   */
  updateUserPreferences(preferences) {
    if (!this.options.userConfigurable) {
      return false;
    }
    
    try {
      // Update enforcement levels
      if (preferences.enforcementLevels) {
        Object.entries(preferences.enforcementLevels).forEach(([category, level]) => {
          if (BOUNDARY_CATEGORIES[category.toUpperCase()] && 
              ENFORCEMENT_LEVELS[level.toUpperCase()]) {
            this.options.defaultEnforcementLevels[category] = level;
          }
        });
      }
      
      // Log the update
      if (this.options.enableAudit) {
        auditTrail.logEvent('user', {
          action: 'boundary_preferences_updated',
          timestamp: new Date().toISOString()
        });
      }
      
      // Emit preferences updated event
      this.emit('preferences:updated', this.options.defaultEnforcementLevels);
      
      return true;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }
  }
  
  /**
   * Check if a specific boundary is active
   * @param {string} category - Boundary category
   * @param {string} ruleId - Rule ID (optional)
   * @returns {boolean} - Whether the boundary is active
   */
  isBoundaryActive(category, ruleId = null) {
    if (ruleId) {
      const fullRuleId = `${category}.${ruleId}`;
      const rule = this.boundaryRules.get(fullRuleId);
      return rule && !rule.disabled;
    }
    
    // Check if any rules in the category are active
    for (const rule of this.boundaryRules.values()) {
      if (rule.category === category && !rule.disabled) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Create a safe response when boundary is violated
   * @param {Object} boundaryResult - Result from checkBoundaries
   * @param {string} defaultResponse - Default response if allowed
   * @param {string} format - Response format
   * @returns {string|Object} - Safe response
   */
  createSafeResponse(boundaryResult, defaultResponse, format = this.options.defaultResponseFormat) {
    if (boundaryResult.allowed) {
      // If there are warnings, include them with the response
      if (boundaryResult.warnings.length > 0) {
        const warnings = boundaryResult.warnings.map(w => w.response);
        
        switch (format) {
          case RESPONSE_FORMATS.HTML:
            return `
              <div class="alejo-warning-container">
                <div class="alejo-warnings">
                  ${warnings.map(w => `<div class="alejo-warning">${w}</div>`).join('')}
                </div>
                <div class="alejo-response">${defaultResponse}</div>
              </div>
            `;
          case RESPONSE_FORMATS.JSON:
            return {
              warnings,
              response: defaultResponse
            };
          case RESPONSE_FORMATS.INTERNAL:
            return {
              warnings,
              response: defaultResponse,
              internal: true
            };
          case RESPONSE_FORMATS.TEXT:
          default:
            return `${warnings.join('\n\n')}\n\n${defaultResponse}`;
        }
      }
      
      // No warnings, return default response
      return defaultResponse;
    } else {
      // Not allowed, return the first block action response
      const blockAction = boundaryResult.enforcementActions.find(a => a.action === 'block');
      
      if (blockAction) {
        return blockAction.response;
      }
      
      // Fallback generic response
      const genericResponse = "I'm sorry, but I cannot provide that information due to ethical boundaries.";
      
      switch (format) {
        case RESPONSE_FORMATS.HTML:
          return `<div class="alejo-boundary-block">${genericResponse}</div>`;
        case RESPONSE_FORMATS.JSON:
          return { 
            error: "boundary_violation", 
            message: genericResponse 
          };
        case RESPONSE_FORMATS.INTERNAL:
          return { 
            error: "boundary_violation", 
            message: genericResponse,
            internal: true
          };
        case RESPONSE_FORMATS.TEXT:
        default:
          return genericResponse;
      }
    }
  }
}

// Export constants and class
export {
  BOUNDARY_CATEGORIES,
  ENFORCEMENT_LEVELS,
  RESPONSE_FORMATS,
  BoundaryEnforcer
};

// Create and export default instance
const boundaryEnforcer = new BoundaryEnforcer();
export { boundaryEnforcer };
