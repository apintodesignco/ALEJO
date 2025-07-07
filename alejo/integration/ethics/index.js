/**
 * ALEJO Ethics Module
 * 
 * This module exports the ethics components of ALEJO, including
 * boundary enforcement, value alignment, and transparency.
 * 
 * @module alejo/integration/ethics
 */

import { BoundaryEnforcer, BOUNDARY_CATEGORIES, ENFORCEMENT_LEVELS } from './boundary_enforcer.js';
import { ValueAlignment, VALUE_DOMAINS, ALIGNMENT_LEVELS, PREFERENCE_SOURCES } from './value_alignment.js';
import { Transparency, TRANSPARENCY_CATEGORIES, DETAIL_LEVELS, EXPLANATION_FORMATS } from './transparency.js';

// Export individual components
export { 
  BoundaryEnforcer, 
  boundaryEnforcer,
  BOUNDARY_CATEGORIES, 
  ENFORCEMENT_LEVELS 
} from './boundary_enforcer.js';

export { 
  ValueAlignment, 
  valueAlignment,
  VALUE_DOMAINS, 
  ALIGNMENT_LEVELS, 
  PREFERENCE_SOURCES 
} from './value_alignment.js';

export { 
  Transparency, 
  transparency,
  TRANSPARENCY_CATEGORIES, 
  DETAIL_LEVELS, 
  EXPLANATION_FORMATS 
} from './transparency.js';

/**
 * Ethics Manager class that provides a unified interface to all ethics components
 */
class EthicsManager {
  /**
   * Create a new EthicsManager instance
   */
  constructor() {
    this.boundaryEnforcer = null;
    this.valueAlignment = null;
    this.transparency = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the ethics manager and its components
   * @param {Object} options - Configuration options
   * @param {Object} options.boundaries - Boundary enforcer options
   * @param {Object} options.values - Value alignment options
   * @param {Object} options.transparency - Transparency options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    try {
      // Import components dynamically
      const boundaryModule = await import('./boundary_enforcer.js');
      const valueModule = await import('./value_alignment.js');
      const transparencyModule = await import('./transparency.js');
      
      // Initialize boundary enforcer
      this.boundaryEnforcer = boundaryModule.boundaryEnforcer;
      if (options.boundaries) {
        this.boundaryEnforcer.updateConfiguration(options.boundaries);
      }
      
      // Initialize value alignment
      this.valueAlignment = valueModule.valueAlignment;
      if (options.values) {
        this.valueAlignment.updateConfiguration(options.values);
      }
      
      // Initialize transparency
      this.transparency = transparencyModule.transparency;
      if (options.transparency) {
        this.transparency.updateConfiguration(options.transparency);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize ethics manager:', error);
      return false;
    }
  }
  
  /**
   * Check if content respects ethical boundaries
   * @param {string} content - Content to check
   * @param {Array<string>} categories - Boundary categories to check
   * @returns {Object} - Boundary check result
   */
  checkBoundaries(content, categories = null) {
    if (!this.initialized || !this.boundaryEnforcer) {
      throw new Error('Ethics manager not initialized');
    }
    
    return this.boundaryEnforcer.checkBoundaries(content, categories);
  }
  
  /**
   * Check if content aligns with user values
   * @param {string} content - Content to check
   * @param {Array<string>} domains - Value domains to check
   * @returns {Object} - Value alignment check result
   */
  checkValueAlignment(content, domains = null) {
    if (!this.initialized || !this.valueAlignment) {
      throw new Error('Ethics manager not initialized');
    }
    
    return this.valueAlignment.checkValueAlignment(content, domains);
  }
  
  /**
   * Generate an explanation for a transparency category
   * @param {string} category - Transparency category
   * @param {Object} data - Data to include in the explanation
   * @param {Object} options - Explanation options
   * @returns {string|Object} - Generated explanation
   */
  generateExplanation(category, data = {}, options = {}) {
    if (!this.initialized || !this.transparency) {
      throw new Error('Ethics manager not initialized');
    }
    
    return this.transparency.generateExplanation(category, data, options);
  }
  
  /**
   * Create a safe response that respects boundaries and aligns with values
   * @param {string} content - Original content
   * @param {Object} options - Options for response creation
   * @returns {Object} - Safe response
   */
  createSafeResponse(content, options = {}) {
    if (!this.initialized) {
      throw new Error('Ethics manager not initialized');
    }
    
    // Check boundaries
    const boundaryCheck = this.boundaryEnforcer.checkBoundaries(content);
    
    // Check value alignment
    const alignmentCheck = this.valueAlignment.checkValueAlignment(content);
    
    // Determine if content is safe
    const isSafe = boundaryCheck.allowed && alignmentCheck.aligned;
    
    // Create response
    const response = {
      original: content,
      safe: isSafe,
      modified: content,
      boundaries: boundaryCheck,
      alignment: alignmentCheck,
      explanation: null
    };
    
    // Handle unsafe content
    if (!isSafe) {
      // Get alternative content if available
      if (!boundaryCheck.allowed && boundaryCheck.safeAlternative) {
        response.modified = boundaryCheck.safeAlternative;
      } else if (!alignmentCheck.aligned && alignmentCheck.misalignments.length > 0) {
        const misalignedDomains = alignmentCheck.misalignments.map(m => m.domain);
        const alternatives = this.valueAlignment.provideValueAlignedAlternatives(content, misalignedDomains);
        
        if (alternatives.length > 0) {
          response.modified = alternatives[0];
        }
      }
      
      // Generate explanation if requested
      if (options.includeExplanation) {
        response.explanation = this.transparency.generateExplanation(
          TRANSPARENCY_CATEGORIES.DECISION_MAKING,
          {
            decision: 'content_modification',
            reason: !boundaryCheck.allowed ? 
              `Content violated boundaries: ${boundaryCheck.violations.map(v => v.category).join(', ')}` : 
              `Content misaligned with values: ${alignmentCheck.misalignments.map(m => m.domain).join(', ')}`
          }
        );
      }
    }
    
    return response;
  }
  
  /**
   * Get the ethics status
   * @returns {Object} - Ethics status
   */
  getEthicsStatus() {
    if (!this.initialized) {
      throw new Error('Ethics manager not initialized');
    }
    
    return {
      initialized: this.initialized,
      boundaries: {
        enabled: this.boundaryEnforcer.options.enabled,
        strictMode: this.boundaryEnforcer.options.strictMode,
        categories: Object.keys(BOUNDARY_CATEGORIES)
      },
      values: {
        enableLearning: this.valueAlignment.options.enableLearning,
        strictAlignment: this.valueAlignment.options.strictAlignment,
        domains: Object.keys(VALUE_DOMAINS)
      },
      transparency: {
        defaultDetailLevel: this.transparency.options.defaultDetailLevel,
        defaultFormat: this.transparency.options.defaultFormat,
        categories: Object.keys(TRANSPARENCY_CATEGORIES)
      }
    };
  }
  
  /**
   * Update ethics configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    if (!this.initialized) {
      throw new Error('Ethics manager not initialized');
    }
    
    if (newConfig.boundaries) {
      this.boundaryEnforcer.updateConfiguration(newConfig.boundaries);
    }
    
    if (newConfig.values) {
      this.valueAlignment.updateConfiguration(newConfig.values);
    }
    
    if (newConfig.transparency) {
      this.transparency.updateConfiguration(newConfig.transparency);
    }
  }
}

// Create and export default instance
const ethicsManager = new EthicsManager();
export { ethicsManager };
