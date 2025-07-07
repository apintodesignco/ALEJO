/**
 * ALEJO Value Alignment
 * 
 * This module ensures that ALEJO's outputs align with the user's values
 * and preferences, providing personalized ethical guidance based on
 * the user's expressed value system.
 * 
 * @module alejo/integration/ethics/value_alignment
 */

import EventEmitter from 'events';
import { auditTrail } from '../security/audit_trail.js';
import { consentEnforcer, CONSENT_CATEGORIES } from '../security/consent_enforcer.js';

// Value domains that can be personalized
const VALUE_DOMAINS = {
  AUTONOMY: 'autonomy',           // User control and independence
  PRIVACY: 'privacy',             // Information privacy and data protection
  TRANSPARENCY: 'transparency',   // Explainability and visibility
  FAIRNESS: 'fairness',           // Equitable and unbiased treatment
  WELLBEING: 'wellbeing',         // Physical and psychological wellbeing
  SUSTAINABILITY: 'sustainability', // Environmental and social sustainability
  DIVERSITY: 'diversity',         // Cultural and perspective diversity
  ACCURACY: 'accuracy',           // Factual correctness and precision
  EFFICIENCY: 'efficiency',       // Resource and time optimization
  CREATIVITY: 'creativity'        // Innovation and creative expression
};

// Value alignment levels
const ALIGNMENT_LEVELS = {
  CRITICAL: 'critical',           // Must align perfectly (non-negotiable)
  HIGH: 'high',                   // Strong alignment required
  MEDIUM: 'medium',               // Moderate alignment required
  LOW: 'low',                     // Slight alignment preferred
  NEUTRAL: 'neutral'              // No specific alignment required
};

// Value preference sources
const PREFERENCE_SOURCES = {
  EXPLICIT: 'explicit',           // Directly specified by user
  INFERRED: 'inferred',           // Inferred from user behavior
  DEFAULT: 'default'              // System default values
};

/**
 * ValueAlignment class that manages value alignment
 */
class ValueAlignment extends EventEmitter {
  /**
   * Create a new ValueAlignment instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.enableLearning - Whether to learn from user feedback
   * @param {boolean} options.strictAlignment - Whether to enforce strict alignment
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enableLearning: true,
      strictAlignment: false,
      defaultAlignmentLevel: ALIGNMENT_LEVELS.MEDIUM,
      enableAudit: true,
      requireConsentForLearning: true,
      ...options
    };
    
    // Initialize value preferences
    this.valuePreferences = new Map();
    
    // Initialize default preferences
    this._initDefaultPreferences();
    
    // Initialize event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize default value preferences
   * @private
   */
  _initDefaultPreferences() {
    // Set default preferences for each value domain
    Object.values(VALUE_DOMAINS).forEach(domain => {
      this.valuePreferences.set(domain, {
        level: this.options.defaultAlignmentLevel,
        source: PREFERENCE_SOURCES.DEFAULT,
        lastUpdated: new Date().toISOString(),
        examples: []
      });
    });
    
    // Set some specific defaults that differ from the general default
    this.valuePreferences.set(VALUE_DOMAINS.PRIVACY, {
      level: ALIGNMENT_LEVELS.HIGH,
      source: PREFERENCE_SOURCES.DEFAULT,
      lastUpdated: new Date().toISOString(),
      examples: ['Minimize data collection', 'Respect confidentiality']
    });
    
    this.valuePreferences.set(VALUE_DOMAINS.AUTONOMY, {
      level: ALIGNMENT_LEVELS.HIGH,
      source: PREFERENCE_SOURCES.DEFAULT,
      lastUpdated: new Date().toISOString(),
      examples: ['Provide options', 'Respect user decisions']
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
    
    // Listen for user feedback
    this.on('feedback:received', (feedback) => {
      if (this.options.enableLearning) {
        this._processUserFeedback(feedback);
      }
    });
  }
  
  /**
   * Set a value preference
   * @param {string} domain - Value domain
   * @param {string} level - Alignment level
   * @param {Object} options - Additional options
   * @param {string} options.source - Source of the preference
   * @param {Array<string>} options.examples - Examples of the value in action
   * @returns {boolean} - Whether the preference was set successfully
   */
  setValuePreference(domain, level, options = {}) {
    // Validate domain
    if (!VALUE_DOMAINS[domain.toUpperCase()]) {
      console.error(`Invalid value domain: ${domain}`);
      return false;
    }
    
    // Validate level
    if (!ALIGNMENT_LEVELS[level.toUpperCase()]) {
      console.error(`Invalid alignment level: ${level}`);
      return false;
    }
    
    // Check if this is an explicit update and requires consent
    if (options.source === PREFERENCE_SOURCES.EXPLICIT && 
        this.options.requireConsentForLearning) {
      const hasConsent = consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION);
      if (!hasConsent) {
        console.error('Cannot set explicit value preference without personalization consent');
        return false;
      }
    }
    
    // Get normalized domain
    const normalizedDomain = VALUE_DOMAINS[domain.toUpperCase()];
    
    // Get existing preference or create new one
    const existingPref = this.valuePreferences.get(normalizedDomain) || {
      level: this.options.defaultAlignmentLevel,
      source: PREFERENCE_SOURCES.DEFAULT,
      examples: []
    };
    
    // Update preference
    const updatedPref = {
      ...existingPref,
      level: ALIGNMENT_LEVELS[level.toUpperCase()],
      source: options.source || existingPref.source,
      lastUpdated: new Date().toISOString()
    };
    
    // Add examples if provided
    if (options.examples && Array.isArray(options.examples)) {
      updatedPref.examples = [...new Set([...existingPref.examples, ...options.examples])];
    }
    
    // Set updated preference
    this.valuePreferences.set(normalizedDomain, updatedPref);
    
    // Log the update if audit is enabled
    if (this.options.enableAudit) {
      this._logValueUpdate(normalizedDomain, updatedPref);
    }
    
    // Emit value updated event
    this.emit('value:updated', {
      domain: normalizedDomain,
      level: updatedPref.level,
      source: updatedPref.source
    });
    
    return true;
  }
  
  /**
   * Get a value preference
   * @param {string} domain - Value domain
   * @returns {Object|null} - Value preference
   */
  getValuePreference(domain) {
    // Validate domain
    if (!VALUE_DOMAINS[domain.toUpperCase()]) {
      console.error(`Invalid value domain: ${domain}`);
      return null;
    }
    
    // Get normalized domain
    const normalizedDomain = VALUE_DOMAINS[domain.toUpperCase()];
    
    // Return preference
    return this.valuePreferences.get(normalizedDomain) || null;
  }
  
  /**
   * Get all value preferences
   * @returns {Object} - All value preferences
   */
  getAllValuePreferences() {
    const preferences = {};
    
    for (const [domain, pref] of this.valuePreferences.entries()) {
      preferences[domain] = { ...pref };
    }
    
    return preferences;
  }
  
  /**
   * Check if content aligns with user values
   * @param {string} content - Content to check
   * @param {Array<string>} domains - Value domains to check against
   * @returns {Object} - Alignment check result
   */
  checkValueAlignment(content, domains = null) {
    const result = {
      aligned: true,
      misalignments: [],
      alignmentScore: 1.0
    };
    
    // Skip empty content
    if (!content || content.trim() === '') {
      return result;
    }
    
    // Determine domains to check
    const domainsToCheck = domains ? 
      domains.filter(d => VALUE_DOMAINS[d.toUpperCase()]) : 
      Object.values(VALUE_DOMAINS);
    
    // Check each domain
    const domainResults = domainsToCheck.map(domain => {
      return this._checkDomainAlignment(domain, content);
    });
    
    // Process results
    const misalignments = domainResults.filter(r => !r.aligned);
    
    if (misalignments.length > 0) {
      result.aligned = false;
      result.misalignments = misalignments;
      
      // Calculate alignment score (average of domain scores)
      const totalScore = domainResults.reduce((sum, r) => sum + r.score, 0);
      result.alignmentScore = totalScore / domainResults.length;
    }
    
    return result;
  }
  
  /**
   * Check alignment for a specific domain
   * @private
   * @param {string} domain - Value domain
   * @param {string} content - Content to check
   * @returns {Object} - Domain alignment result
   */
  _checkDomainAlignment(domain, content) {
    // Get preference for domain
    const preference = this.valuePreferences.get(domain);
    
    if (!preference) {
      return {
        domain,
        aligned: true,
        score: 1.0,
        level: ALIGNMENT_LEVELS.NEUTRAL
      };
    }
    
    // Simple mock implementation - in a real system, this would use
    // more sophisticated analysis based on the content and domain
    let alignmentScore = 1.0;
    let aligned = true;
    
    // For demonstration, we'll use a simple keyword-based approach
    // In a real implementation, this would use more sophisticated NLP
    if (domain === VALUE_DOMAINS.PRIVACY) {
      const privacyKeywords = [
        { term: 'tracking', negative: true },
        { term: 'monitoring', negative: true },
        { term: 'surveillance', negative: true },
        { term: 'data collection', negative: true },
        { term: 'anonymized', positive: true },
        { term: 'encrypted', positive: true },
        { term: 'confidential', positive: true },
        { term: 'consent', positive: true }
      ];
      
      alignmentScore = this._calculateKeywordScore(content, privacyKeywords);
    } else if (domain === VALUE_DOMAINS.AUTONOMY) {
      const autonomyKeywords = [
        { term: 'force', negative: true },
        { term: 'must', negative: true },
        { term: 'required', negative: true },
        { term: 'no choice', negative: true },
        { term: 'option', positive: true },
        { term: 'choice', positive: true },
        { term: 'decide', positive: true },
        { term: 'control', positive: true }
      ];
      
      alignmentScore = this._calculateKeywordScore(content, autonomyKeywords);
    }
    // Add similar checks for other domains
    
    // Determine if aligned based on preference level and score
    switch (preference.level) {
      case ALIGNMENT_LEVELS.CRITICAL:
        aligned = alignmentScore >= 0.95;
        break;
      case ALIGNMENT_LEVELS.HIGH:
        aligned = alignmentScore >= 0.8;
        break;
      case ALIGNMENT_LEVELS.MEDIUM:
        aligned = alignmentScore >= 0.6;
        break;
      case ALIGNMENT_LEVELS.LOW:
        aligned = alignmentScore >= 0.4;
        break;
      case ALIGNMENT_LEVELS.NEUTRAL:
      default:
        aligned = true;
    }
    
    return {
      domain,
      aligned,
      score: alignmentScore,
      level: preference.level
    };
  }
  
  /**
   * Calculate keyword-based alignment score
   * @private
   * @param {string} content - Content to check
   * @param {Array<Object>} keywords - Keywords to check
   * @returns {number} - Alignment score
   */
  _calculateKeywordScore(content, keywords) {
    const lowerContent = content.toLowerCase();
    let positiveMatches = 0;
    let negativeMatches = 0;
    
    keywords.forEach(keyword => {
      const matches = (lowerContent.match(new RegExp(keyword.term, 'g')) || []).length;
      
      if (keyword.positive) {
        positiveMatches += matches;
      } else if (keyword.negative) {
        negativeMatches += matches;
      }
    });
    
    const totalMatches = positiveMatches + negativeMatches;
    
    if (totalMatches === 0) {
      return 1.0; // No matches, assume aligned
    }
    
    return Math.max(0, Math.min(1, positiveMatches / totalMatches));
  }
  
  /**
   * Process user feedback to learn value preferences
   * @private
   * @param {Object} feedback - User feedback
   */
  _processUserFeedback(feedback) {
    // Check consent for learning
    if (this.options.requireConsentForLearning) {
      const hasConsent = consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION);
      if (!hasConsent) {
        return;
      }
    }
    
    // Extract domain and sentiment from feedback
    const { domain, sentiment, content } = feedback;
    
    if (!domain || !VALUE_DOMAINS[domain.toUpperCase()]) {
      return;
    }
    
    // Get normalized domain
    const normalizedDomain = VALUE_DOMAINS[domain.toUpperCase()];
    
    // Get current preference
    const currentPref = this.valuePreferences.get(normalizedDomain);
    
    if (!currentPref) {
      return;
    }
    
    // Update preference based on sentiment
    let newLevel = currentPref.level;
    
    if (sentiment === 'positive') {
      // Strengthen preference if positive feedback
      switch (currentPref.level) {
        case ALIGNMENT_LEVELS.NEUTRAL:
          newLevel = ALIGNMENT_LEVELS.LOW;
          break;
        case ALIGNMENT_LEVELS.LOW:
          newLevel = ALIGNMENT_LEVELS.MEDIUM;
          break;
        case ALIGNMENT_LEVELS.MEDIUM:
          newLevel = ALIGNMENT_LEVELS.HIGH;
          break;
        case ALIGNMENT_LEVELS.HIGH:
          newLevel = ALIGNMENT_LEVELS.CRITICAL;
          break;
      }
    } else if (sentiment === 'negative') {
      // Weaken preference if negative feedback
      switch (currentPref.level) {
        case ALIGNMENT_LEVELS.CRITICAL:
          newLevel = ALIGNMENT_LEVELS.HIGH;
          break;
        case ALIGNMENT_LEVELS.HIGH:
          newLevel = ALIGNMENT_LEVELS.MEDIUM;
          break;
        case ALIGNMENT_LEVELS.MEDIUM:
          newLevel = ALIGNMENT_LEVELS.LOW;
          break;
        case ALIGNMENT_LEVELS.LOW:
          newLevel = ALIGNMENT_LEVELS.NEUTRAL;
          break;
      }
    }
    
    // Update preference
    this.setValuePreference(normalizedDomain, newLevel, {
      source: PREFERENCE_SOURCES.INFERRED,
      examples: content ? [content] : []
    });
  }
  
  /**
   * Log value preference update to audit trail
   * @private
   * @param {string} domain - Value domain
   * @param {Object} preference - Updated preference
   */
  _logValueUpdate(domain, preference) {
    try {
      auditTrail.logEvent('user', {
        action: 'value_preference_updated',
        domain,
        level: preference.level,
        source: preference.source,
        timestamp: preference.lastUpdated
      });
    } catch (error) {
      console.error('Error logging value update to audit trail:', error);
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
   * Provide value-aligned alternatives for content
   * @param {string} content - Original content
   * @param {Array<string>} misalignedDomains - Domains that are misaligned
   * @returns {Array<string>} - Alternative content suggestions
   */
  provideValueAlignedAlternatives(content, misalignedDomains) {
    // In a real implementation, this would use more sophisticated
    // techniques to generate alternatives that better align with values
    
    const alternatives = [];
    
    // Simple mock implementation for demonstration
    if (misalignedDomains.includes(VALUE_DOMAINS.PRIVACY)) {
      const privacyAlternative = content
        .replace(/tracking/g, 'anonymous analytics')
        .replace(/monitor/g, 'observe')
        .replace(/collect data/g, 'gather anonymous information');
      
      alternatives.push(privacyAlternative);
    }
    
    if (misalignedDomains.includes(VALUE_DOMAINS.AUTONOMY)) {
      const autonomyAlternative = content
        .replace(/must/g, 'may want to')
        .replace(/required/g, 'recommended')
        .replace(/have to/g, 'could consider');
      
      alternatives.push(autonomyAlternative);
    }
    
    return alternatives;
  }
  
  /**
   * Export value preferences
   * @returns {Object} - Exportable value preferences
   */
  exportValuePreferences() {
    const exportData = {
      preferences: this.getAllValuePreferences(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return exportData;
  }
  
  /**
   * Import value preferences
   * @param {Object} importData - Value preferences to import
   * @returns {boolean} - Whether the import was successful
   */
  importValuePreferences(importData) {
    if (!importData || !importData.preferences) {
      return false;
    }
    
    try {
      // Import each preference
      Object.entries(importData.preferences).forEach(([domain, pref]) => {
        if (VALUE_DOMAINS[domain.toUpperCase()]) {
          this.valuePreferences.set(domain, { ...pref });
        }
      });
      
      // Log the import
      if (this.options.enableAudit) {
        auditTrail.logEvent('system', {
          action: 'value_preferences_imported',
          timestamp: new Date().toISOString()
        });
      }
      
      // Emit preferences imported event
      this.emit('preferences:imported');
      
      return true;
    } catch (error) {
      console.error('Error importing value preferences:', error);
      return false;
    }
  }
  
  /**
   * Reset value preferences to defaults
   * @returns {boolean} - Whether the reset was successful
   */
  resetValuePreferences() {
    try {
      // Reset to defaults
      this._initDefaultPreferences();
      
      // Log the reset
      if (this.options.enableAudit) {
        auditTrail.logEvent('system', {
          action: 'value_preferences_reset',
          timestamp: new Date().toISOString()
        });
      }
      
      // Emit preferences reset event
      this.emit('preferences:reset');
      
      return true;
    } catch (error) {
      console.error('Error resetting value preferences:', error);
      return false;
    }
  }
}

// Export constants and class
export {
  VALUE_DOMAINS,
  ALIGNMENT_LEVELS,
  PREFERENCE_SOURCES,
  ValueAlignment
};

// Create and export default instance
const valueAlignment = new ValueAlignment();
export { valueAlignment };
