/**
 * ALEJO Accessibility Memory Bridge
 * 
 * Provides a bridge between JavaScript frontend and Python accessibility memory module.
 * Enables storing and retrieving accessibility preferences, patterns, and adaptations.
 */

import { PythonBridge } from '../../utils/python-bridge.js';
import { publish, subscribe, unsubscribe } from '../../core/events.js';
import { getLogger } from '../../utils/logging.js';

const logger = getLogger('accessibility-memory-bridge');

/**
 * Bridge for communicating with Python accessibility memory module
 */
export class AccessibilityMemoryBridge {
  /**
   * Create a new Accessibility Memory Bridge
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      module: 'alejo.cognitive.memory.accessibility_memory',
      className: 'AccessibilityMemory',
      ...options
    };
    
    this.bridge = new PythonBridge({
      module: this.options.module,
      className: this.options.className,
      ...options
    });
    
    this.isInitialized = false;
    this.eventHandlers = {};
  }
  
  /**
   * Initialize the bridge and connect to the Python memory module
   * @returns {Promise} - Resolves when connected and initialized
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      logger.info('Initializing accessibility memory bridge');
      await this.bridge.initialize();
      
      // Register event handlers
      this._setupEventHandlers();
      
      this.isInitialized = true;
      publish('accessibility:memory:initialized', { success: true });
      logger.info('Accessibility memory bridge initialized');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize accessibility memory bridge', error);
      publish('accessibility:memory:initialized', { 
        success: false, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Shut down the bridge
   * @returns {Promise} - Resolves when shut down
   */
  async shutdown() {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      logger.info('Shutting down accessibility memory bridge');
      
      // Unregister event handlers
      this._removeEventHandlers();
      
      // Close Python bridge
      await this.bridge.close();
      
      this.isInitialized = false;
      logger.info('Accessibility memory bridge shut down');
      
      return true;
    } catch (error) {
      logger.error('Error shutting down accessibility memory bridge', error);
      throw error;
    }
  }
  
  /**
   * Set up event handlers for accessibility events
   * @private
   */
  _setupEventHandlers() {
    // Feature usage events
    this.eventHandlers['accessibility:feature:used'] = this._handleFeatureUsed.bind(this);
    subscribe('accessibility:feature:used', this.eventHandlers['accessibility:feature:used']);
    
    // Preference change events
    this.eventHandlers['accessibility:preference:changed'] = this._handlePreferenceChanged.bind(this);
    subscribe('accessibility:preference:changed', this.eventHandlers['accessibility:preference:changed']);
    
    // Effectiveness feedback events
    this.eventHandlers['accessibility:effectiveness:feedback'] = this._handleEffectivenessFeedback.bind(this);
    subscribe('accessibility:effectiveness:feedback', this.eventHandlers['accessibility:effectiveness:feedback']);
    
    // Context change events
    this.eventHandlers['user:context:changed'] = this._handleContextChanged.bind(this);
    subscribe('user:context:changed', this.eventHandlers['user:context:changed']);
    
    // Fatigue detection events
    this.eventHandlers['user:fatigue:detected'] = this._handleFatigueDetected.bind(this);
    subscribe('user:fatigue:detected', this.eventHandlers['user:fatigue:detected']);
  }
  
  /**
   * Remove event handlers
   * @private
   */
  _removeEventHandlers() {
    Object.entries(this.eventHandlers).forEach(([event, handler]) => {
      unsubscribe(event, handler);
    });
    
    this.eventHandlers = {};
  }
  
  /**
   * Handle feature usage events
   * @private
   */
  async _handleFeatureUsed(event) {
    try {
      await this.bridge.callMethod('_on_feature_used', [event]);
    } catch (error) {
      logger.error('Error handling feature used event', error);
    }
  }
  
  /**
   * Handle preference change events
   * @private
   */
  async _handlePreferenceChanged(event) {
    try {
      await this.bridge.callMethod('_on_preference_changed', [event]);
    } catch (error) {
      logger.error('Error handling preference changed event', error);
    }
  }
  
  /**
   * Handle effectiveness feedback events
   * @private
   */
  async _handleEffectivenessFeedback(event) {
    try {
      await this.bridge.callMethod('_on_effectiveness_feedback', [event]);
    } catch (error) {
      logger.error('Error handling effectiveness feedback event', error);
    }
  }
  
  /**
   * Handle context change events
   * @private
   */
  async _handleContextChanged(event) {
    try {
      await this.bridge.callMethod('_on_context_changed', [event]);
    } catch (error) {
      logger.error('Error handling context changed event', error);
    }
  }
  
  /**
   * Handle fatigue detection events
   * @private
   */
  async _handleFatigueDetected(event) {
    try {
      await this.bridge.callMethod('_on_fatigue_detected', [event]);
    } catch (error) {
      logger.error('Error handling fatigue detected event', error);
    }
  }
  
  /**
   * Get preferred settings for a feature based on memory
   * @param {String} featureId - ID of the feature to get settings for
   * @param {String} modality - Optional modality to filter by
   * @param {Object} context - Optional context to consider
   * @returns {Promise<Object>} - Preferred settings
   */
  async getPreferredSettings(featureId, modality = null, context = null) {
    try {
      return await this.bridge.callMethod('get_preferred_settings', [featureId, modality, context]);
    } catch (error) {
      logger.error(`Error getting preferred settings for ${featureId}`, error);
      return {};
    }
  }
  
  /**
   * Get adaptation recommendations based on memory patterns
   * @param {String} modality - Optional modality to filter by
   * @param {Object} context - Optional context to consider
   * @returns {Promise<Array>} - List of adaptation recommendations
   */
  async getAdaptationRecommendations(modality = null, context = null) {
    try {
      return await this.bridge.callMethod('get_adaptation_recommendations', [modality, context]);
    } catch (error) {
      logger.error('Error getting adaptation recommendations', error);
      return [];
    }
  }
  
  /**
   * Record a successful adaptation for future reference
   * @param {String} featureId - ID of the adapted feature
   * @param {String} modality - Modality that was adapted
   * @param {Object} context - Context in which adaptation was successful
   * @param {Object} preferences - Settings that worked well
   * @returns {Promise<Boolean>} - Success status
   */
  async recordSuccessfulAdaptation(featureId, modality, context = null, preferences = null) {
    try {
      await this.bridge.callMethod('record_successful_adaptation', [featureId, modality, context, preferences]);
      return true;
    } catch (error) {
      logger.error(`Error recording successful adaptation for ${featureId}`, error);
      return false;
    }
  }
}

// Export singleton instance
let instance = null;

/**
 * Get the accessibility memory bridge instance
 * @param {Object} options - Optional configuration
 * @returns {AccessibilityMemoryBridge} - Singleton instance
 */
export function getAccessibilityMemoryBridge(options = {}) {
  if (!instance) {
    instance = new AccessibilityMemoryBridge(options);
  }
  return instance;
}
