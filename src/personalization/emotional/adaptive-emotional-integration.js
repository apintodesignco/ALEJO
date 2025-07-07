/**
 * ALEJO Adaptive Emotional Integration
 * 
 * Integrates the emotional memory system with multimodal fusion and UI systems
 * to provide personalized, emotionally intelligent experiences based on user emotional states,
 * relationship contexts, and interaction patterns.
 */

import { publish, subscribe, unsubscribe } from '../../core/events.js';
import { getLogger } from '../../utils/logging.js';
import { getEmotionalMemoryBridge } from './emotional-memory-bridge.js';
import { MultimodalFusionSystem } from '../../integration/fusion/multimodal-fusion.js';

const logger = getLogger('adaptive-emotional-integration');

/**
 * Integrates emotional memory with multimodal fusion for emotionally intelligent experiences
 */
export class AdaptiveEmotionalIntegration {
  /**
   * Create a new adaptive emotional integration
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      adaptationInterval: 30000, // Check for adaptations every 30 seconds
      contextUpdateInterval: 15000, // Update context every 15 seconds
      emotionalThreshold: 0.3, // Threshold for significant emotional changes
      ...options
    };
    
    this.memoryBridge = getEmotionalMemoryBridge();
    this.fusionSystem = options.fusionSystem || MultimodalFusionSystem.getInstance();
    
    this.isRunning = false;
    this.adaptationTimer = null;
    this.contextTimer = null;
    this.eventHandlers = {};
    
    this.currentContext = {
      emotionalState: null,
      relationshipContext: {},
      environmentFactors: {},
      userProfile: {}
    };
    
    this.adaptationHistory = [];
    this.activeAdaptations = new Map();
  }
  
  /**
   * Start the adaptive emotional integration
   * @returns {Promise<Boolean>} - Success status
   */
  async start() {
    if (this.isRunning) {
      return true;
    }
    
    try {
      logger.info('Starting adaptive emotional integration');
      
      // Initialize the emotional memory bridge
      await this.memoryBridge.initialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Initialize current context
      await this.updateCurrentContext();
      
      // Start timers
      this.startTimers();
      
      this.isRunning = true;
      
      // Publish started event
      publish('emotional:integration:started', {
        timestamp: Date.now()
      });
      
      logger.info('Adaptive emotional integration started successfully');
      return true;
    } catch (error) {
      logger.error('Failed to start adaptive emotional integration', error);
      return false;
    }
  }
  
  /**
   * Stop the adaptive emotional integration
   * @returns {Promise<Boolean>} - Success status
   */
  async stop() {
    if (!this.isRunning) {
      return true;
    }
    
    try {
      logger.info('Stopping adaptive emotional integration');
      
      // Stop timers
      this.stopTimers();
      
      // Unsubscribe from events
      this.unsubscribeFromEvents();
      
      this.isRunning = false;
      
      // Publish stopped event
      publish('emotional:integration:stopped', {
        timestamp: Date.now()
      });
      
      logger.info('Adaptive emotional integration stopped successfully');
      return true;
    } catch (error) {
      logger.error('Failed to stop adaptive emotional integration', error);
      return false;
    }
  }
  
  /**
   * Subscribe to relevant events
   * @private
   */
  subscribeToEvents() {
    // Subscribe to emotional state updates
    this.eventHandlers.emotionalStateUpdate = this.handleEmotionalStateUpdate.bind(this);
    subscribe('emotional:memory:state:updated', this.eventHandlers.emotionalStateUpdate);
    
    // Subscribe to relationship context updates
    this.eventHandlers.relationshipUpdate = this.handleRelationshipUpdate.bind(this);
    subscribe('emotional:memory:relationship:updated', this.eventHandlers.relationshipUpdate);
    
    // Subscribe to environment changes
    this.eventHandlers.environmentChange = this.handleEnvironmentChange.bind(this);
    subscribe('system:environment:change', this.eventHandlers.environmentChange);
    
    // Subscribe to user profile updates
    this.eventHandlers.userProfileUpdate = this.handleUserProfileUpdate.bind(this);
    subscribe('user:profile:updated', this.eventHandlers.userProfileUpdate);
    
    // Subscribe to UI events
    this.eventHandlers.uiEvent = this.handleUIEvent.bind(this);
    subscribe('ui:event', this.eventHandlers.uiEvent);
    
    // Subscribe to accessibility events for integration
    this.eventHandlers.accessibilityEvent = this.handleAccessibilityEvent.bind(this);
    subscribe('accessibility:feature:changed', this.eventHandlers.accessibilityEvent);
  }
  
  /**
   * Unsubscribe from events
   * @private
   */
  unsubscribeFromEvents() {
    unsubscribe('emotional:memory:state:updated', this.eventHandlers.emotionalStateUpdate);
    unsubscribe('emotional:memory:relationship:updated', this.eventHandlers.relationshipUpdate);
    unsubscribe('system:environment:change', this.eventHandlers.environmentChange);
    unsubscribe('user:profile:updated', this.eventHandlers.userProfileUpdate);
    unsubscribe('ui:event', this.eventHandlers.uiEvent);
    unsubscribe('accessibility:feature:changed', this.eventHandlers.accessibilityEvent);
  }
  
  /**
   * Start timers for periodic checks
   * @private
   */
  startTimers() {
    // Clear any existing timers
    this.stopTimers();
    
    // Start adaptation check timer
    this.adaptationTimer = setInterval(
      () => this.checkForAdaptations(),
      this.options.adaptationInterval
    );
    
    // Start context update timer
    this.contextTimer = setInterval(
      () => this.updateCurrentContext(),
      this.options.contextUpdateInterval
    );
  }
  
  /**
   * Stop timers
   * @private
   */
  stopTimers() {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
    
    if (this.contextTimer) {
      clearInterval(this.contextTimer);
      this.contextTimer = null;
    }
  }
  
  /**
   * Handle emotional state updates
   * @param {Object} data - Event data
   * @private
   */
  async handleEmotionalStateUpdate(data) {
    try {
      logger.debug('Handling emotional state update', data);
      
      // Update current context with new emotional state
      this.currentContext.emotionalState = {
        valence: data.valence,
        arousal: data.arousal,
        dominance: data.dominance,
        source: data.source,
        context: data.context,
        timestamp: data.timestamp
      };
      
      // Check for adaptations based on emotional state change
      await this.checkForAdaptations();
    } catch (error) {
      logger.error('Error handling emotional state update', error);
    }
  }
  
  /**
   * Handle relationship context updates
   * @param {Object} data - Event data
   * @private
   */
  async handleRelationshipUpdate(data) {
    try {
      logger.debug('Handling relationship context update', data);
      
      // Update current context with new relationship data
      this.currentContext.relationshipContext[data.entityId] = {
        ...this.currentContext.relationshipContext[data.entityId],
        ...data.context,
        lastUpdated: data.timestamp
      };
      
      // Check for adaptations based on relationship context change
      await this.checkForAdaptations();
    } catch (error) {
      logger.error('Error handling relationship context update', error);
    }
  }
  
  /**
   * Handle environment changes
   * @param {Object} data - Event data
   * @private
   */
  async handleEnvironmentChange(data) {
    try {
      logger.debug('Handling environment change', data);
      
      // Update current context with new environment data
      this.currentContext.environmentFactors = {
        ...this.currentContext.environmentFactors,
        ...data,
        lastUpdated: Date.now()
      };
      
      // Check for adaptations based on environment change
      await this.checkForAdaptations();
    } catch (error) {
      logger.error('Error handling environment change', error);
    }
  }
  
  /**
   * Handle user profile updates
   * @param {Object} data - Event data
   * @private
   */
  async handleUserProfileUpdate(data) {
    try {
      logger.debug('Handling user profile update', data);
      
      // Update current context with new user profile data
      this.currentContext.userProfile = {
        ...this.currentContext.userProfile,
        ...data,
        lastUpdated: Date.now()
      };
      
      // Check for adaptations based on user profile change
      await this.checkForAdaptations();
    } catch (error) {
      logger.error('Error handling user profile update', error);
    }
  }
  
  /**
   * Handle UI events
   * @param {Object} data - Event data
   * @private
   */
  async handleUIEvent(data) {
    try {
      // Only process UI events that might need emotional adaptation
      if (!data.type || !['interaction', 'feedback', 'error'].includes(data.type)) {
        return;
      }
      
      logger.debug('Handling UI event', data);
      
      // Check for adaptations based on UI event
      await this.checkForAdaptations({
        triggerType: 'ui',
        triggerData: data
      });
    } catch (error) {
      logger.error('Error handling UI event', error);
    }
  }
  
  /**
   * Handle accessibility events for integration
   * @param {Object} data - Event data
   * @private
   */
  async handleAccessibilityEvent(data) {
    try {
      logger.debug('Handling accessibility event', data);
      
      // Integrate accessibility changes with emotional adaptations
      if (data.feature && data.enabled !== undefined) {
        // Check if this accessibility feature should affect emotional adaptations
        await this.checkForAdaptations({
          triggerType: 'accessibility',
          triggerData: data
        });
      }
    } catch (error) {
      logger.error('Error handling accessibility event', error);
    }
  }
  
  /**
   * Update the current context with latest data
   * @returns {Promise<Object>} - Updated context
   * @private
   */
  async updateCurrentContext() {
    try {
      if (!this.isRunning) {
        return this.currentContext;
      }
      
      logger.debug('Updating current context');
      
      // Get current emotional state if not already set or outdated
      if (!this.currentContext.emotionalState || 
          Date.now() - this.currentContext.emotionalState.timestamp > 60000) {
        const emotionalState = await this.memoryBridge.getCurrentEmotionalState();
        if (emotionalState) {
          this.currentContext.emotionalState = {
            valence: emotionalState.valence,
            arousal: emotionalState.arousal,
            dominance: emotionalState.dominance,
            source: emotionalState.source,
            context: emotionalState.context,
            timestamp: Date.now()
          };
        }
      }
      
      // Get emotional trend analysis
      const trend = await this.memoryBridge.getEmotionalTrend();
      if (trend) {
        this.currentContext.emotionalTrend = trend;
      }
      
      // Publish context updated event
      publish('emotional:integration:context:updated', {
        context: this.currentContext,
        timestamp: Date.now()
      });
      
      return this.currentContext;
    } catch (error) {
      logger.error('Error updating current context', error);
      return this.currentContext;
    }
  }
  
  /**
   * Check for and apply emotional adaptations
   * @param {Object} options - Check options
   * @returns {Promise<Array>} - Applied adaptations
   */
  async checkForAdaptations(options = {}) {
    try {
      if (!this.isRunning) {
        return [];
      }
      
      logger.debug('Checking for emotional adaptations', options);
      
      // Get current emotional state if needed
      if (!this.currentContext.emotionalState) {
        await this.updateCurrentContext();
      }
      
      // Skip if no emotional state available
      if (!this.currentContext.emotionalState) {
        logger.debug('No emotional state available, skipping adaptation check');
        return [];
      }
      
      // Determine adaptations based on current context
      const adaptations = await this.determineAdaptations(options);
      
      // Apply adaptations
      const appliedAdaptations = await this.applyAdaptations(adaptations);
      
      // Record in history
      if (appliedAdaptations.length > 0) {
        this.recordAdaptationHistory(appliedAdaptations, options);
      }
      
      return appliedAdaptations;
    } catch (error) {
      logger.error('Error checking for adaptations', error);
      return [];
    }
  }
  
  /**
   * Determine appropriate adaptations based on current context
   * @param {Object} options - Determination options
   * @returns {Promise<Array>} - List of adaptations to apply
   * @private
   */
  async determineAdaptations(options = {}) {
    try {
      const adaptations = [];
      const emotionalState = this.currentContext.emotionalState;
      const threshold = this.options.emotionalThreshold;
      
      // Skip if no emotional state
      if (!emotionalState) {
        return adaptations;
      }
      
      // Check for negative valence (unpleasant emotions)
      if (emotionalState.valence < -threshold) {
        // High arousal negative emotion (anger, fear)
        if (emotionalState.arousal > threshold) {
          adaptations.push({
            type: 'ui:calming',
            priority: Math.abs(emotionalState.valence) * emotionalState.arousal,
            params: {
              reduceStimuli: true,
              simplifyInterface: true,
              offerSupport: true
            }
          });
        } 
        // Low arousal negative emotion (sadness, depression)
        else if (emotionalState.arousal < -threshold) {
          adaptations.push({
            type: 'ui:encouraging',
            priority: Math.abs(emotionalState.valence) * Math.abs(emotionalState.arousal),
            params: {
              increaseEngagement: true,
              positiveReinforcement: true,
              gentleGuidance: true
            }
          });
        }
      }
      // Check for positive valence (pleasant emotions)
      else if (emotionalState.valence > threshold) {
        // High arousal positive emotion (excitement, joy)
        if (emotionalState.arousal > threshold) {
          adaptations.push({
            type: 'ui:enhancing',
            priority: emotionalState.valence * emotionalState.arousal,
            params: {
              amplifyPositive: true,
              celebrateAchievements: true
            }
          });
        }
        // Low arousal positive emotion (contentment, relaxation)
        else if (emotionalState.arousal < -threshold) {
          adaptations.push({
            type: 'ui:maintaining',
            priority: emotionalState.valence * Math.abs(emotionalState.arousal),
            params: {
              preserveState: true,
              minimizeDisruption: true
            }
          });
        }
      }
      
      // Check for low dominance (feeling powerless)
      if (emotionalState.dominance < -threshold) {
        adaptations.push({
          type: 'ui:empowering',
          priority: Math.abs(emotionalState.dominance),
          params: {
            increaseControl: true,
            simplifyChoices: true,
            clearGuidance: true
          }
        });
      }
      
      // Add adaptations based on trigger type
      if (options.triggerType === 'ui' && options.triggerData) {
        if (options.triggerData.type === 'error') {
          adaptations.push({
            type: 'ui:supportive',
            priority: 0.8,
            params: {
              errorSupport: true,
              clearInstructions: true,
              reassurance: true
            }
          });
        }
      }
      
      // Add adaptations for accessibility integration
      if (options.triggerType === 'accessibility' && options.triggerData) {
        // Integrate emotional adaptations with accessibility features
        adaptations.push({
          type: 'accessibility:emotional',
          priority: 0.9,
          params: {
            feature: options.triggerData.feature,
            emotionalState: emotionalState,
            adaptFeedback: true
          }
        });
      }
      
      // Sort by priority
      return adaptations.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      logger.error('Error determining adaptations', error);
      return [];
    }
  }
  
  /**
   * Apply emotional adaptations
   * @param {Array} adaptations - Adaptations to apply
   * @returns {Promise<Array>} - Successfully applied adaptations
   * @private
   */
  async applyAdaptations(adaptations) {
    const appliedAdaptations = [];
    
    for (const adaptation of adaptations) {
      try {
        logger.debug(`Applying adaptation: ${adaptation.type}`, adaptation);
        
        // Check if this adaptation is already active
        const existingAdaptation = this.activeAdaptations.get(adaptation.type);
        if (existingAdaptation) {
          // Skip if the same adaptation is already active with higher priority
          if (existingAdaptation.priority >= adaptation.priority) {
            logger.debug(`Skipping adaptation ${adaptation.type}: already active with higher priority`);
            continue;
          }
          
          // Remove existing adaptation of the same type
          await this.removeAdaptation(adaptation.type);
        }
        
        // Apply the adaptation
        const success = await this.applyAdaptation(adaptation);
        
        if (success) {
          // Add to active adaptations
          this.activeAdaptations.set(adaptation.type, {
            ...adaptation,
            appliedAt: Date.now()
          });
          
          appliedAdaptations.push(adaptation);
          
          // Publish adaptation applied event
          publish('emotional:adaptation:applied', {
            adaptation,
            context: this.currentContext,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.error(`Error applying adaptation ${adaptation.type}`, error);
      }
    }
    
    return appliedAdaptations;
  }
  
  /**
   * Apply a specific adaptation
   * @param {Object} adaptation - Adaptation to apply
   * @returns {Promise<Boolean>} - Success status
   * @private
   */
  async applyAdaptation(adaptation) {
    try {
      switch (adaptation.type) {
        case 'ui:calming':
          // Apply calming UI adaptations
          publish('ui:adaptation:request', {
            type: 'calming',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'ui:encouraging':
          // Apply encouraging UI adaptations
          publish('ui:adaptation:request', {
            type: 'encouraging',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'ui:enhancing':
          // Apply enhancing UI adaptations
          publish('ui:adaptation:request', {
            type: 'enhancing',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'ui:maintaining':
          // Apply maintaining UI adaptations
          publish('ui:adaptation:request', {
            type: 'maintaining',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'ui:empowering':
          // Apply empowering UI adaptations
          publish('ui:adaptation:request', {
            type: 'empowering',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'ui:supportive':
          // Apply supportive UI adaptations
          publish('ui:adaptation:request', {
            type: 'supportive',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        case 'accessibility:emotional':
          // Apply emotional adaptations to accessibility features
          publish('accessibility:adaptation:request', {
            type: 'emotional',
            params: adaptation.params,
            priority: adaptation.priority,
            source: 'emotional-integration'
          });
          break;
          
        default:
          logger.warn(`Unknown adaptation type: ${adaptation.type}`);
          return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error applying adaptation ${adaptation.type}`, error);
      return false;
    }
  }
  
  /**
   * Remove an active adaptation
   * @param {String} adaptationType - Type of adaptation to remove
   * @returns {Promise<Boolean>} - Success status
   * @private
   */
  async removeAdaptation(adaptationType) {
    try {
      const adaptation = this.activeAdaptations.get(adaptationType);
      if (!adaptation) {
        return false;
      }
      
      logger.debug(`Removing adaptation: ${adaptationType}`, adaptation);
      
      // Publish adaptation removal request
      publish(`${adaptationType.split(':')[0]}:adaptation:remove`, {
        type: adaptationType.split(':')[1],
        source: 'emotional-integration',
        timestamp: Date.now()
      });
      
      // Remove from active adaptations
      this.activeAdaptations.delete(adaptationType);
      
      return true;
    } catch (error) {
      logger.error(`Error removing adaptation ${adaptationType}`, error);
      return false;
    }
  }
  
  /**
   * Record adaptation history
   * @param {Array} adaptations - Applied adaptations
   * @param {Object} options - Check options that triggered adaptations
   * @private
   */
  recordAdaptationHistory(adaptations, options) {
    try {
      // Add to history
      this.adaptationHistory.push({
        timestamp: Date.now(),
        adaptations,
        context: {
          emotionalState: this.currentContext.emotionalState,
          trigger: options.triggerType || 'periodic',
          triggerData: options.triggerData
        }
      });
      
      // Limit history size
      if (this.adaptationHistory.length > 100) {
        this.adaptationHistory = this.adaptationHistory.slice(-100);
      }
    } catch (error) {
      logger.error('Error recording adaptation history', error);
    }
  }
  
  /**
   * Get adaptation history
   * @param {Object} options - Query options
   * @returns {Array} - Adaptation history
   */
  getAdaptationHistory(options = {}) {
    try {
      let history = [...this.adaptationHistory];
      
      // Apply filters
      if (options.limit) {
        history = history.slice(-options.limit);
      }
      
      if (options.since) {
        history = history.filter(item => item.timestamp >= options.since);
      }
      
      if (options.adaptationType) {
        history = history.filter(item => 
          item.adaptations.some(a => a.type === options.adaptationType)
        );
      }
      
      return history;
    } catch (error) {
      logger.error('Error getting adaptation history', error);
      return [];
    }
  }
  
  /**
   * Get active adaptations
   * @returns {Array} - Currently active adaptations
   */
  getActiveAdaptations() {
    return Array.from(this.activeAdaptations.values());
  }
  
  /**
   * Get current emotional context
   * @returns {Object} - Current context
   */
  getCurrentContext() {
    return { ...this.currentContext };
  }
}

// Singleton instance
let instance = null;

/**
 * Get the adaptive emotional integration instance
 * @param {Object} options - Configuration options
 * @returns {AdaptiveEmotionalIntegration} - Singleton instance
 */
export function getAdaptiveEmotionalIntegration(options = {}) {
  if (!instance) {
    instance = new AdaptiveEmotionalIntegration(options);
  }
  return instance;
}
