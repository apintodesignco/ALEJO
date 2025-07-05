/**
 * ALEJO Context Engine
 * 
 * This module provides environmental awareness and contextual understanding
 * to enhance ALEJO's responses and decision-making capabilities.
 * 
 * @module alejo/integration/fusion/context_engine
 */

import EventEmitter from 'events';
import { confidenceScorer } from '../../reasoning/explanation/confidence_scorer.js';
import { privacyGuard } from '../security/privacy_guard.js';

// Context types
const CONTEXT_TYPES = {
  ENVIRONMENTAL: 'environmental', // Physical environment (location, time, weather)
  DEVICE: 'device',               // Device capabilities and state
  USER: 'user',                   // User state and preferences
  CONVERSATION: 'conversation',   // Conversation history and state
  TASK: 'task',                   // Current task or activity
  SOCIAL: 'social'                // Social context (presence of others)
};

// Context sources
const CONTEXT_SOURCES = {
  SENSORS: 'sensors',             // Physical sensors (camera, microphone, etc.)
  USER_INPUT: 'user_input',       // Explicit user input
  INFERENCE: 'inference',         // Inferred from other context
  HISTORY: 'history',             // Historical data
  EXTERNAL_API: 'external_api'    // External API data (weather, time, etc.)
};

/**
 * ContextEngine class that manages contextual information
 */
class ContextEngine extends EventEmitter {
  /**
   * Create a new ContextEngine instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.enablePrivacyFiltering - Whether to enable privacy filtering
   * @param {number} options.contextRetentionTime - How long to retain context in ms
   * @param {boolean} options.enableContextInference - Whether to enable context inference
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enablePrivacyFiltering: true,
      contextRetentionTime: 30 * 60 * 1000, // 30 minutes
      enableContextInference: true,
      confidenceThreshold: 0.6,
      ...options
    };
    
    // Initialize context storage
    this.contextStore = new Map();
    
    // Initialize event listeners
    this._initEventListeners();
    
    // Context update interval (clean expired context)
    this.updateInterval = setInterval(() => {
      this._cleanExpiredContext();
    }, 60000); // Check every minute
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Listen for context updates
    this.on('context:update', (contextType, data) => {
      this._processContextUpdate(contextType, data);
    });
    
    // Listen for context requests
    this.on('context:request', (contextTypes, callback) => {
      const context = this.getContext(contextTypes);
      if (typeof callback === 'function') {
        callback(context);
      }
    });
    
    // Listen for configuration changes
    this.on('config:update', (newConfig) => {
      this.updateConfiguration(newConfig);
    });
  }
  
  /**
   * Update context with new information
   * @param {string} contextType - Type of context (from CONTEXT_TYPES)
   * @param {Object} data - Context data
   * @param {string} source - Source of the context (from CONTEXT_SOURCES)
   * @param {number} confidence - Confidence in the context data (0-1)
   * @returns {boolean} - Whether the context was successfully updated
   */
  updateContext(contextType, data, source = CONTEXT_SOURCES.USER_INPUT, confidence = 1.0) {
    if (!CONTEXT_TYPES[contextType.toUpperCase()]) {
      console.error(`Invalid context type: ${contextType}`);
      return false;
    }
    
    // Apply privacy filtering if enabled
    let processedData = data;
    if (this.options.enablePrivacyFiltering) {
      processedData = this._applyPrivacyFiltering(contextType, data);
    }
    
    // Create or update context entry
    const now = Date.now();
    const contextEntry = this.contextStore.get(contextType) || {
      data: {},
      sources: {},
      confidences: {},
      timestamps: {},
      lastUpdated: now,
      created: now
    };
    
    // Update with new data
    if (typeof processedData === 'object') {
      Object.entries(processedData).forEach(([key, value]) => {
        contextEntry.data[key] = value;
        contextEntry.sources[key] = source;
        contextEntry.confidences[key] = confidence;
        contextEntry.timestamps[key] = now;
      });
    } else {
      // Handle primitive data types
      contextEntry.data = processedData;
      contextEntry.sources = source;
      contextEntry.confidences = confidence;
      contextEntry.timestamps = now;
    }
    
    contextEntry.lastUpdated = now;
    this.contextStore.set(contextType, contextEntry);
    
    // Emit context updated event
    this.emit('context:updated', contextType, processedData);
    
    // Perform context inference if enabled
    if (this.options.enableContextInference) {
      this._inferAdditionalContext(contextType, processedData, source);
    }
    
    return true;
  }
  
  /**
   * Apply privacy filtering to context data
   * @private
   * @param {string} contextType - Type of context
   * @param {Object} data - Context data
   * @returns {Object} - Filtered data
   */
  _applyPrivacyFiltering(contextType, data) {
    try {
      return privacyGuard.filterSensitiveData(contextType, data);
    } catch (error) {
      console.error('Error applying privacy filtering:', error);
      return data; // Return original data if filtering fails
    }
  }
  
  /**
   * Process context update
   * @private
   * @param {string} contextType - Type of context
   * @param {Object} data - Context data
   */
  _processContextUpdate(contextType, data) {
    // Additional processing can be added here
    // For now, just log the update
    console.debug(`Context updated: ${contextType}`);
  }
  
  /**
   * Infer additional context from existing context
   * @private
   * @param {string} contextType - Type of context that was updated
   * @param {Object} data - Context data that was updated
   * @param {string} source - Source of the context update
   */
  _inferAdditionalContext(contextType, data, source) {
    // Example: Infer time of day from timestamp
    if (contextType === CONTEXT_TYPES.ENVIRONMENTAL && data.timestamp) {
      const date = new Date(data.timestamp);
      const hour = date.getHours();
      
      let timeOfDay;
      if (hour >= 5 && hour < 12) {
        timeOfDay = 'morning';
      } else if (hour >= 12 && hour < 17) {
        timeOfDay = 'afternoon';
      } else if (hour >= 17 && hour < 22) {
        timeOfDay = 'evening';
      } else {
        timeOfDay = 'night';
      }
      
      this.updateContext(
        CONTEXT_TYPES.ENVIRONMENTAL,
        { timeOfDay },
        CONTEXT_SOURCES.INFERENCE,
        0.9
      );
    }
    
    // Example: Infer user activity from device state
    if (contextType === CONTEXT_TYPES.DEVICE && data.screenState === 'on' && data.appInForeground) {
      this.updateContext(
        CONTEXT_TYPES.USER,
        { activity: 'using_device', activeApp: data.appInForeground },
        CONTEXT_SOURCES.INFERENCE,
        0.7
      );
    }
  }
  
  /**
   * Get context of specified types
   * @param {string|Array<string>} contextTypes - Type(s) of context to retrieve
   * @param {Object} options - Retrieval options
   * @param {number} options.minConfidence - Minimum confidence threshold
   * @param {number} options.maxAge - Maximum age of context in ms
   * @returns {Object} - Context data
   */
  getContext(contextTypes, options = {}) {
    const result = {};
    const now = Date.now();
    const types = Array.isArray(contextTypes) ? contextTypes : [contextTypes];
    
    const minConfidence = options.minConfidence || this.options.confidenceThreshold;
    const maxAge = options.maxAge || this.options.contextRetentionTime;
    
    // If no specific types are requested, return all context
    const typesToRetrieve = types.length > 0 ? types : Object.values(CONTEXT_TYPES);
    
    typesToRetrieve.forEach(type => {
      const contextEntry = this.contextStore.get(type);
      if (!contextEntry) {
        return;
      }
      
      // Check if context is still valid
      if (now - contextEntry.lastUpdated > maxAge) {
        return;
      }
      
      // Filter by confidence if object
      if (typeof contextEntry.data === 'object') {
        const filteredData = {};
        
        Object.entries(contextEntry.data).forEach(([key, value]) => {
          const confidence = contextEntry.confidences[key] || 0;
          const timestamp = contextEntry.timestamps[key] || 0;
          
          // Check confidence and age
          if (confidence >= minConfidence && (now - timestamp <= maxAge)) {
            filteredData[key] = value;
          }
        });
        
        if (Object.keys(filteredData).length > 0) {
          result[type] = filteredData;
        }
      } else {
        // Handle primitive data types
        const confidence = contextEntry.confidences || 0;
        
        if (confidence >= minConfidence) {
          result[type] = contextEntry.data;
        }
      }
    });
    
    return result;
  }
  
  /**
   * Get all available context
   * @param {Object} options - Retrieval options
   * @returns {Object} - All context data
   */
  getAllContext(options = {}) {
    return this.getContext([], options);
  }
  
  /**
   * Clean expired context
   * @private
   */
  _cleanExpiredContext() {
    const now = Date.now();
    const maxAge = this.options.contextRetentionTime;
    
    for (const [type, contextEntry] of this.contextStore.entries()) {
      // Remove entire context type if it's too old
      if (now - contextEntry.lastUpdated > maxAge) {
        this.contextStore.delete(type);
        continue;
      }
      
      // For object data, remove individual expired entries
      if (typeof contextEntry.data === 'object') {
        let updated = false;
        
        Object.keys(contextEntry.data).forEach(key => {
          const timestamp = contextEntry.timestamps[key] || 0;
          
          if (now - timestamp > maxAge) {
            delete contextEntry.data[key];
            delete contextEntry.sources[key];
            delete contextEntry.confidences[key];
            delete contextEntry.timestamps[key];
            updated = true;
          }
        });
        
        // If we removed some entries, update the context
        if (updated) {
          if (Object.keys(contextEntry.data).length === 0) {
            // Remove empty context
            this.contextStore.delete(type);
          } else {
            // Update last updated timestamp
            contextEntry.lastUpdated = now;
            this.contextStore.set(type, contextEntry);
          }
        }
      }
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
   * Clear all context
   */
  clearContext() {
    this.contextStore.clear();
    this.emit('context:cleared');
  }
  
  /**
   * Clear specific context type
   * @param {string} contextType - Type of context to clear
   */
  clearContextType(contextType) {
    if (this.contextStore.has(contextType)) {
      this.contextStore.delete(contextType);
      this.emit('context:cleared:type', contextType);
    }
  }
  
  /**
   * Get context freshness information
   * @returns {Object} - Freshness information for each context type
   */
  getContextFreshness() {
    const now = Date.now();
    const result = {};
    
    for (const [type, contextEntry] of this.contextStore.entries()) {
      const age = now - contextEntry.lastUpdated;
      const ageSeconds = Math.round(age / 1000);
      
      result[type] = {
        ageMs: age,
        ageSeconds,
        isFresh: age <= this.options.contextRetentionTime,
        lastUpdated: new Date(contextEntry.lastUpdated).toISOString()
      };
    }
    
    return result;
  }
  
  /**
   * Clean up resources when done
   */
  destroy() {
    clearInterval(this.updateInterval);
    this.removeAllListeners();
    this.contextStore.clear();
  }
}

// Export constants and class
export {
  CONTEXT_TYPES,
  CONTEXT_SOURCES,
  ContextEngine
};

// Create and export default instance
const defaultContextEngine = new ContextEngine();
export default defaultContextEngine;
