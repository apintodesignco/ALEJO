/**
 * ALEJO Adaptive Memory Integration
 * 
 * Integrates the accessibility memory system with the multimodal fusion system
 * to provide personalized, adaptive accessibility experiences based on user patterns,
 * preferences, and context.
 */

import { publish, subscribe, unsubscribe } from '../../core/events.js';
import { getLogger } from '../../utils/logging.js';
import { getAccessibilityMemoryBridge } from './accessibility-memory-bridge.js';
import { MultimodalFusionSystem } from './multimodal-fusion.js';

const logger = getLogger('adaptive-memory-integration');

/**
 * Integrates accessibility memory with multimodal fusion for adaptive experiences
 */
export class AdaptiveMemoryIntegration {
  /**
   * Create a new adaptive memory integration
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      adaptationInterval: 60000, // Check for adaptations every minute
      contextUpdateInterval: 30000, // Update context every 30 seconds
      ...options
    };
    
    this.memoryBridge = getAccessibilityMemoryBridge();
    this.fusionSystem = options.fusionSystem || MultimodalFusionSystem.getInstance();
    
    this.isRunning = false;
    this.adaptationTimer = null;
    this.contextTimer = null;
    this.eventHandlers = {};
    
    this.currentContext = {};
    this.adaptationHistory = [];
    this.featureStates = new Map();
  }
  
  /**
   * Start the adaptive memory integration
   * @returns {Promise<Boolean>} - Success status
   */
  async start() {
    if (this.isRunning) {
      return true;
    }
    
    try {
      logger.info('Starting adaptive memory integration');
      
      // Initialize memory bridge if not already initialized
      if (!this.memoryBridge.isInitialized) {
        await this.memoryBridge.initialize();
      }
      
      // Set up event handlers
      this._setupEventHandlers();
      
      // Start adaptation timer
      this._startAdaptationTimer();
      
      // Start context update timer
      this._startContextTimer();
      
      this.isRunning = true;
      publish('accessibility:adaptive-memory:started', { success: true });
      logger.info('Adaptive memory integration started');
      
      // Initial adaptation check
      this._checkForAdaptations();
      
      return true;
    } catch (error) {
      logger.error('Failed to start adaptive memory integration', error);
      publish('accessibility:adaptive-memory:started', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * Stop the adaptive memory integration
   * @returns {Promise<Boolean>} - Success status
   */
  async stop() {
    if (!this.isRunning) {
      return true;
    }
    
    try {
      logger.info('Stopping adaptive memory integration');
      
      // Clear timers
      if (this.adaptationTimer) {
        clearInterval(this.adaptationTimer);
        this.adaptationTimer = null;
      }
      
      if (this.contextTimer) {
        clearInterval(this.contextTimer);
        this.contextTimer = null;
      }
      
      // Remove event handlers
      this._removeEventHandlers();
      
      this.isRunning = false;
      publish('accessibility:adaptive-memory:stopped', { success: true });
      logger.info('Adaptive memory integration stopped');
      
      return true;
    } catch (error) {
      logger.error('Error stopping adaptive memory integration', error);
      publish('accessibility:adaptive-memory:stopped', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Listen for feature state changes
    this.eventHandlers['accessibility:feature:state-changed'] = this._handleFeatureStateChanged.bind(this);
    subscribe('accessibility:feature:state-changed', this.eventHandlers['accessibility:feature:state-changed']);
    
    // Listen for successful adaptations
    this.eventHandlers['accessibility:adaptation:applied'] = this._handleAdaptationApplied.bind(this);
    subscribe('accessibility:adaptation:applied', this.eventHandlers['accessibility:adaptation:applied']);
    
    // Listen for user profile changes
    this.eventHandlers['user:profile:updated'] = this._handleUserProfileUpdated.bind(this);
    subscribe('user:profile:updated', this.eventHandlers['user:profile:updated']);
    
    // Listen for environment changes
    this.eventHandlers['system:environment:change'] = this._handleEnvironmentChange.bind(this);
    subscribe('system:environment:change', this.eventHandlers['system:environment:change']);
    
    // Listen for modality status changes
    this.eventHandlers['modality:status:changed'] = this._handleModalityStatusChanged.bind(this);
    subscribe('modality:status:changed', this.eventHandlers['modality:status:changed']);
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
   * Start the adaptation timer
   * @private
   */
  _startAdaptationTimer() {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
    }
    
    this.adaptationTimer = setInterval(() => {
      this._checkForAdaptations();
    }, this.options.adaptationInterval);
  }
  
  /**
   * Start the context update timer
   * @private
   */
  _startContextTimer() {
    if (this.contextTimer) {
      clearInterval(this.contextTimer);
    }
    
    this.contextTimer = setInterval(() => {
      this._updateCurrentContext();
    }, this.options.contextUpdateInterval);
  }
  
  /**
   * Handle feature state changes
   * @param {Object} event - Event data
   * @private
   */
  _handleFeatureStateChanged(event) {
    const { featureId, state, modality } = event;
    
    if (!featureId) {
      return;
    }
    
    // Update feature state
    this.featureStates.set(featureId, {
      state,
      modality,
      timestamp: Date.now()
    });
    
    // Send feature usage event if feature is enabled
    if (state === 'enabled' || state === true) {
      publish('accessibility:feature:used', {
        feature_id: featureId,
        modality,
        context: this.currentContext
      });
    }
  }
  
  /**
   * Handle adaptation applied events
   * @param {Object} event - Event data
   * @private
   */
  async _handleAdaptationApplied(event) {
    const { featureId, modality, settings, success } = event;
    
    if (!featureId || !success) {
      return;
    }
    
    // Record successful adaptation
    await this.memoryBridge.recordSuccessfulAdaptation(
      featureId,
      modality,
      this.currentContext,
      settings
    );
    
    // Add to adaptation history
    this.adaptationHistory.push({
      featureId,
      modality,
      settings,
      context: { ...this.currentContext },
      timestamp: Date.now()
    });
    
    // Keep history manageable
    if (this.adaptationHistory.length > 50) {
      this.adaptationHistory = this.adaptationHistory.slice(-50);
    }
    
    logger.debug(`Recorded successful adaptation for ${featureId}`);
  }
  
  /**
   * Handle user profile updates
   * @param {Object} event - Event data
   * @private
   */
  async _handleUserProfileUpdated(event) {
    const { profile } = event;
    
    if (!profile) {
      return;
    }
    
    // Update context with profile information
    if (profile.mobility) {
      this.currentContext.mobility_profile = profile.mobility;
    }
    
    if (profile.preferences) {
      this.currentContext.user_preferences = profile.preferences;
    }
    
    // Check for adaptations based on new profile
    await this._checkForAdaptations();
  }
  
  /**
   * Handle environment changes
   * @param {Object} event - Event data
   * @private
   */
  async _handleEnvironmentChange(event) {
    const { environment } = event;
    
    if (!environment) {
      return;
    }
    
    // Update context with environment information
    Object.entries(environment).forEach(([key, value]) => {
      this.currentContext[`environment_${key}`] = value;
    });
    
    // Publish context change
    publish('user:context:changed', {
      context: this.currentContext
    });
    
    // Check for adaptations based on new environment
    await this._checkForAdaptations();
  }
  
  /**
   * Handle modality status changes
   * @param {Object} event - Event data
   * @private
   */
  async _handleModalityStatusChanged(event) {
    const { modality, status, confidence } = event;
    
    if (!modality) {
      return;
    }
    
    // Update context with modality status
    this.currentContext[`modality_${modality}_status`] = status;
    if (confidence !== undefined) {
      this.currentContext[`modality_${modality}_confidence`] = confidence;
    }
    
    // Check for adaptations if a modality becomes unavailable
    if (status === 'unavailable' || status === false) {
      await this._checkForAdaptations();
    }
  }
  
  /**
   * Update the current context
   * @private
   */
  async _updateCurrentContext() {
    try {
      // Get system context
      const systemContext = await this._getSystemContext();
      
      // Update current context
      Object.entries(systemContext).forEach(([key, value]) => {
        this.currentContext[key] = value;
      });
      
      // Publish context change
      publish('user:context:changed', {
        context: this.currentContext
      });
    } catch (error) {
      logger.error('Error updating context', error);
    }
  }
  
  /**
   * Get system context
   * @returns {Promise<Object>} - System context
   * @private
   */
  async _getSystemContext() {
    const context = {};
    
    // Get time of day
    const now = new Date();
    const hours = now.getHours();
    
    if (hours >= 5 && hours < 12) {
      context.time_of_day = 'morning';
    } else if (hours >= 12 && hours < 17) {
      context.time_of_day = 'afternoon';
    } else if (hours >= 17 && hours < 22) {
      context.time_of_day = 'evening';
    } else {
      context.time_of_day = 'night';
    }
    
    // Get device information if available
    if (navigator && navigator.userAgent) {
      context.user_agent = navigator.userAgent;
      
      if (navigator.userAgent.match(/Mobile|Android|iPhone/i)) {
        context.device_type = 'mobile';
      } else if (navigator.userAgent.match(/Tablet|iPad/i)) {
        context.device_type = 'tablet';
      } else {
        context.device_type = 'desktop';
      }
    }
    
    // Get screen size if available
    if (window && window.innerWidth) {
      context.screen_width = window.innerWidth;
      context.screen_height = window.innerHeight;
      
      if (window.innerWidth < 768) {
        context.screen_size = 'small';
      } else if (window.innerWidth < 1200) {
        context.screen_size = 'medium';
      } else {
        context.screen_size = 'large';
      }
    }
    
    // Get modality statuses from fusion system
    if (this.fusionSystem) {
      const modalityStatuses = this.fusionSystem.getModalityStatuses();
      
      Object.entries(modalityStatuses).forEach(([modality, status]) => {
        context[`modality_${modality}_available`] = status.available;
        if (status.confidence !== undefined) {
          context[`modality_${modality}_confidence`] = status.confidence;
        }
      });
    }
    
    return context;
  }
  
  /**
   * Check for adaptations based on current context and memory
   * @private
   */
  async _checkForAdaptations() {
    try {
      logger.debug('Checking for adaptations');
      
      // Get adaptation recommendations from memory
      const recommendations = await this.memoryBridge.getAdaptationRecommendations(
        null, // All modalities
        this.currentContext
      );
      
      if (!recommendations || recommendations.length === 0) {
        logger.debug('No adaptation recommendations found');
        return;
      }
      
      logger.debug(`Found ${recommendations.length} adaptation recommendations`);
      
      // Process each recommendation
      for (const recommendation of recommendations) {
        await this._processAdaptationRecommendation(recommendation);
      }
    } catch (error) {
      logger.error('Error checking for adaptations', error);
    }
  }
  
  /**
   * Process an adaptation recommendation
   * @param {Object} recommendation - Adaptation recommendation
   * @private
   */
  async _processAdaptationRecommendation(recommendation) {
    const { feature_id, modality, effectiveness } = recommendation;
    
    // Skip if we've recently adapted this feature
    const recentAdaptation = this.adaptationHistory.find(a => 
      a.featureId === feature_id && 
      a.modality === modality &&
      (Date.now() - a.timestamp) < 3600000 // Within the last hour
    );
    
    if (recentAdaptation) {
      logger.debug(`Skipping recent adaptation for ${feature_id}`);
      return;
    }
    
    try {
      // Get preferred settings for this feature
      const settings = await this.memoryBridge.getPreferredSettings(
        feature_id,
        modality,
        this.currentContext
      );
      
      if (!settings || Object.keys(settings).length === 0) {
        logger.debug(`No preferred settings found for ${feature_id}`);
        return;
      }
      
      // Apply adaptation
      publish('accessibility:adaptation:requested', {
        feature_id,
        modality,
        settings,
        context: this.currentContext,
        effectiveness,
        source: 'memory'
      });
      
      logger.info(`Requested adaptation for ${feature_id} with ${modality}`);
    } catch (error) {
      logger.error(`Error processing adaptation for ${feature_id}`, error);
    }
  }
  
  /**
   * Get preferred settings for a feature
   * @param {String} featureId - Feature ID
   * @param {String} modality - Optional modality
   * @returns {Promise<Object>} - Preferred settings
   */
  async getPreferredSettings(featureId, modality = null) {
    return await this.memoryBridge.getPreferredSettings(
      featureId,
      modality,
      this.currentContext
    );
  }
  
  /**
   * Get current context
   * @returns {Object} - Current context
   */
  getCurrentContext() {
    return { ...this.currentContext };
  }
  
  /**
   * Get adaptation history
   * @returns {Array} - Adaptation history
   */
  getAdaptationHistory() {
    return [...this.adaptationHistory];
  }
  
  /**
   * Force an adaptation check
   * @returns {Promise<Boolean>} - Success status
   */
  async forceAdaptationCheck() {
    try {
      await this._checkForAdaptations();
      return true;
    } catch (error) {
      logger.error('Error forcing adaptation check', error);
      return false;
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get the adaptive memory integration instance
 * @param {Object} options - Configuration options
 * @returns {AdaptiveMemoryIntegration} - Singleton instance
 */
export function getAdaptiveMemoryIntegration(options = {}) {
  if (!instance) {
    instance = new AdaptiveMemoryIntegration(options);
  }
  return instance;
}
