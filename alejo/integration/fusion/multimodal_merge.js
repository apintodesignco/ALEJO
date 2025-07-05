/**
 * ALEJO Multimodal Fusion Module
 * 
 * This module combines inputs from different modalities (voice, vision, text)
 * to create a unified understanding of user intent and context.
 * 
 * @module alejo/integration/fusion/multimodal_merge
 */

import EventEmitter from 'events';
import { confidenceScorer } from '../../reasoning/explanation/confidence_scorer.js';
import { privacyGuard } from '../security/privacy_guard.js';

// Modality types supported by the fusion system
const MODALITY_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
  VISION: 'vision',
  GESTURE: 'gesture',
  ENVIRONMENTAL: 'environmental'
};

// Fusion strategies
const FUSION_STRATEGIES = {
  WEIGHTED_AVERAGE: 'weighted_average',
  PRIORITY_BASED: 'priority_based',
  CONFIDENCE_BASED: 'confidence_based',
  CONTEXT_DEPENDENT: 'context_dependent'
};

/**
 * MultimodalFusion class that combines inputs from different modalities
 */
class MultimodalFusion extends EventEmitter {
  /**
   * Create a new MultimodalFusion instance
   * @param {Object} options - Configuration options
   * @param {string} options.defaultStrategy - Default fusion strategy
   * @param {Object} options.modalityWeights - Weights for different modalities
   * @param {boolean} options.enablePrivacyFiltering - Whether to enable privacy filtering
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      defaultStrategy: FUSION_STRATEGIES.CONFIDENCE_BASED,
      modalityWeights: {
        [MODALITY_TYPES.TEXT]: 1.0,
        [MODALITY_TYPES.VOICE]: 0.8,
        [MODALITY_TYPES.VISION]: 0.7,
        [MODALITY_TYPES.GESTURE]: 0.6,
        [MODALITY_TYPES.ENVIRONMENTAL]: 0.4
      },
      enablePrivacyFiltering: true,
      ...options
    };
    
    this.inputs = new Map();
    this.fusionResult = null;
    this.fusionTimestamp = null;
    this.confidenceThreshold = 0.6;
    
    // Initialize event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Listen for new inputs from different modalities
    this.on('input', (modalityType, data) => {
      this._processInput(modalityType, data);
    });
    
    // Listen for fusion requests
    this.on('fusion:request', () => {
      this.performFusion();
    });
    
    // Listen for configuration changes
    this.on('config:update', (newConfig) => {
      this.updateConfiguration(newConfig);
    });
  }
  
  /**
   * Add input from a specific modality
   * @param {string} modalityType - Type of modality (text, voice, vision, etc.)
   * @param {Object} data - Input data from the modality
   * @param {number} data.confidence - Confidence score for this input (0-1)
   * @param {Object} data.content - Content of the input
   * @param {Object} data.metadata - Additional metadata about the input
   * @returns {boolean} - Whether the input was successfully added
   */
  addInput(modalityType, data) {
    if (!MODALITY_TYPES[modalityType.toUpperCase()]) {
      console.error(`Invalid modality type: ${modalityType}`);
      return false;
    }
    
    // Apply privacy filtering if enabled
    let processedData = data;
    if (this.options.enablePrivacyFiltering) {
      processedData = this._applyPrivacyFiltering(modalityType, data);
    }
    
    // Store the input
    this.inputs.set(modalityType, {
      data: processedData,
      timestamp: Date.now(),
      weight: this.options.modalityWeights[modalityType] || 0.5
    });
    
    // Emit input event
    this.emit('input', modalityType, processedData);
    
    return true;
  }
  
  /**
   * Apply privacy filtering to input data
   * @private
   * @param {string} modalityType - Type of modality
   * @param {Object} data - Input data
   * @returns {Object} - Filtered data
   */
  _applyPrivacyFiltering(modalityType, data) {
    try {
      return privacyGuard.filterSensitiveData(modalityType, data);
    } catch (error) {
      console.error('Error applying privacy filtering:', error);
      return data; // Return original data if filtering fails
    }
  }
  
  /**
   * Process input from a specific modality
   * @private
   * @param {string} modalityType - Type of modality
   * @param {Object} data - Input data
   */
  _processInput(modalityType, data) {
    // Check if we should perform fusion automatically
    if (this._shouldPerformFusion()) {
      this.performFusion();
    }
  }
  
  /**
   * Determine if fusion should be performed automatically
   * @private
   * @returns {boolean} - Whether fusion should be performed
   */
  _shouldPerformFusion() {
    // Perform fusion if we have inputs from multiple modalities
    return this.inputs.size >= 2;
  }
  
  /**
   * Perform fusion of all available inputs
   * @param {string} strategy - Fusion strategy to use (defaults to configured default)
   * @returns {Object} - Fusion result
   */
  performFusion(strategy = this.options.defaultStrategy) {
    if (this.inputs.size === 0) {
      console.warn('No inputs available for fusion');
      return null;
    }
    
    let fusionResult;
    
    switch (strategy) {
      case FUSION_STRATEGIES.WEIGHTED_AVERAGE:
        fusionResult = this._performWeightedAverageFusion();
        break;
      case FUSION_STRATEGIES.PRIORITY_BASED:
        fusionResult = this._performPriorityBasedFusion();
        break;
      case FUSION_STRATEGIES.CONFIDENCE_BASED:
        fusionResult = this._performConfidenceBasedFusion();
        break;
      case FUSION_STRATEGIES.CONTEXT_DEPENDENT:
        fusionResult = this._performContextDependentFusion();
        break;
      default:
        console.warn(`Unknown fusion strategy: ${strategy}, using confidence-based`);
        fusionResult = this._performConfidenceBasedFusion();
    }
    
    // Calculate overall confidence score
    fusionResult.confidence = this._calculateOverallConfidence(fusionResult);
    
    // Store the fusion result
    this.fusionResult = fusionResult;
    this.fusionTimestamp = Date.now();
    
    // Emit fusion result event
    this.emit('fusion:result', fusionResult);
    
    return fusionResult;
  }
  
  /**
   * Perform weighted average fusion
   * @private
   * @returns {Object} - Fusion result
   */
  _performWeightedAverageFusion() {
    const result = {
      content: {},
      metadata: {
        sources: [],
        weights: [],
        timestamp: Date.now()
      }
    };
    
    let totalWeight = 0;
    
    // Combine inputs based on weights
    for (const [modalityType, input] of this.inputs.entries()) {
      const { data, weight } = input;
      
      // Add source information
      result.metadata.sources.push(modalityType);
      result.metadata.weights.push(weight);
      
      // Combine content (simplified - in reality would be more complex)
      if (typeof data.content === 'object') {
        Object.entries(data.content).forEach(([key, value]) => {
          if (!result.content[key]) {
            result.content[key] = value * weight;
          } else {
            result.content[key] += value * weight;
          }
        });
      }
      
      totalWeight += weight;
    }
    
    // Normalize by total weight
    if (totalWeight > 0) {
      Object.keys(result.content).forEach(key => {
        result.content[key] /= totalWeight;
      });
    }
    
    return result;
  }
  
  /**
   * Perform priority-based fusion
   * @private
   * @returns {Object} - Fusion result
   */
  _performPriorityBasedFusion() {
    // Sort modalities by weight (priority)
    const sortedInputs = Array.from(this.inputs.entries())
      .sort((a, b) => b[1].weight - a[1].weight);
    
    // Use the highest priority input as the base
    const [topModalityType, topInput] = sortedInputs[0];
    
    const result = {
      content: { ...topInput.data.content },
      metadata: {
        primarySource: topModalityType,
        secondarySources: [],
        timestamp: Date.now()
      }
    };
    
    // Add information from secondary sources if not present in primary
    for (let i = 1; i < sortedInputs.length; i++) {
      const [modalityType, input] = sortedInputs[i];
      result.metadata.secondarySources.push(modalityType);
      
      // Add any missing information from secondary sources
      if (typeof input.data.content === 'object') {
        Object.entries(input.data.content).forEach(([key, value]) => {
          if (result.content[key] === undefined) {
            result.content[key] = value;
          }
        });
      }
    }
    
    return result;
  }
  
  /**
   * Perform confidence-based fusion
   * @private
   * @returns {Object} - Fusion result
   */
  _performConfidenceBasedFusion() {
    const result = {
      content: {},
      metadata: {
        sources: [],
        confidences: [],
        timestamp: Date.now()
      }
    };
    
    // For each potential content key, select the value with highest confidence
    const allKeys = new Set();
    const confidenceMap = new Map();
    
    // Collect all keys and their confidence values
    for (const [modalityType, input] of this.inputs.entries()) {
      const { data } = input;
      result.metadata.sources.push(modalityType);
      
      if (typeof data.content === 'object') {
        Object.keys(data.content).forEach(key => {
          allKeys.add(key);
        });
        
        // Store confidence for each key from this modality
        Object.entries(data.content).forEach(([key, value]) => {
          const confidence = data.confidence || 0.5;
          
          if (!confidenceMap.has(key) || confidenceMap.get(key).confidence < confidence) {
            confidenceMap.set(key, {
              value,
              confidence,
              source: modalityType
            });
          }
        });
      }
    }
    
    // Build result using highest confidence values
    allKeys.forEach(key => {
      if (confidenceMap.has(key)) {
        const { value, confidence, source } = confidenceMap.get(key);
        result.content[key] = value;
        
        // Store confidence information
        if (!result.metadata.confidences) {
          result.metadata.confidences = {};
        }
        result.metadata.confidences[key] = { confidence, source };
      }
    });
    
    return result;
  }
  
  /**
   * Perform context-dependent fusion
   * @private
   * @returns {Object} - Fusion result
   */
  _performContextDependentFusion() {
    // This is a more complex fusion strategy that would consider the current context
    // For now, we'll use confidence-based fusion as a fallback
    return this._performConfidenceBasedFusion();
  }
  
  /**
   * Calculate overall confidence score for fusion result
   * @private
   * @param {Object} fusionResult - Fusion result
   * @returns {number} - Overall confidence score (0-1)
   */
  _calculateOverallConfidence(fusionResult) {
    try {
      return confidenceScorer.calculateConfidence(fusionResult);
    } catch (error) {
      console.error('Error calculating confidence score:', error);
      
      // Fallback confidence calculation
      if (fusionResult.metadata.confidences) {
        const confidences = Object.values(fusionResult.metadata.confidences)
          .map(c => c.confidence);
        
        if (confidences.length > 0) {
          return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        }
      }
      
      return 0.5; // Default confidence
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
   * Clear all inputs
   */
  clearInputs() {
    this.inputs.clear();
    this.emit('inputs:cleared');
  }
  
  /**
   * Get the latest fusion result
   * @returns {Object} - Latest fusion result
   */
  getLatestFusionResult() {
    return this.fusionResult;
  }
  
  /**
   * Check if fusion result is recent enough
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {boolean} - Whether the fusion result is recent
   */
  isFusionResultRecent(maxAgeMs = 5000) {
    if (!this.fusionTimestamp) {
      return false;
    }
    
    return (Date.now() - this.fusionTimestamp) <= maxAgeMs;
  }
}

// Export constants and class
export {
  MODALITY_TYPES,
  FUSION_STRATEGIES,
  MultimodalFusion
};

// Create and export default instance
const defaultFusion = new MultimodalFusion();
export default defaultFusion;
