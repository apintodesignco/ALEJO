/**
 * ALEJO Emotional Memory Bridge
 * 
 * Provides a bridge between JavaScript frontend and Python emotional memory module.
 * Enables storing and retrieving emotional states, contexts, and relationship data.
 */

import { PythonBridge } from '../../utils/python-bridge.js';
import { publish, subscribe, unsubscribe } from '../../core/events.js';
import { getLogger } from '../../utils/logging.js';

const logger = getLogger('emotional-memory-bridge');

/**
 * Bridge for communicating with Python emotional memory module
 */
export class EmotionalMemoryBridge {
  /**
   * Create a new Emotional Memory Bridge
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      module: 'alejo.cognitive.memory.emotional_memory',
      className: 'EmotionalMemory',
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
      logger.info('Initializing emotional memory bridge');
      await this.bridge.initialize();
      
      // Subscribe to relevant events
      this.subscribeToEvents();
      
      this.isInitialized = true;
      logger.info('Emotional memory bridge initialized successfully');
      
      // Publish initialization event
      publish('emotional:memory:initialized', {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize emotional memory bridge', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to relevant events for emotional memory updates
   * @private
   */
  subscribeToEvents() {
    // Subscribe to emotional state updates
    this.eventHandlers.emotionalStateUpdate = this.handleEmotionalStateUpdate.bind(this);
    subscribe('emotional:state:updated', this.eventHandlers.emotionalStateUpdate);
    
    // Subscribe to perception events that might contain emotional data
    this.eventHandlers.perceptionEvent = this.handlePerceptionEvent.bind(this);
    subscribe('perception:event', this.eventHandlers.perceptionEvent);
    
    // Subscribe to interaction events for relationship context
    this.eventHandlers.interactionEvent = this.handleInteractionEvent.bind(this);
    subscribe('interaction:event', this.eventHandlers.interactionEvent);
    
    // Subscribe to memory events that might contain emotional content
    this.eventHandlers.memoryEvent = this.handleMemoryEvent.bind(this);
    subscribe('memory:event', this.eventHandlers.memoryEvent);
  }
  
  /**
   * Handle emotional state update events
   * @param {Object} data - Event data
   * @private
   */
  async handleEmotionalStateUpdate(data) {
    try {
      logger.debug('Handling emotional state update', data);
      await this.updateEmotionalState(
        data.valence,
        data.arousal,
        data.dominance,
        data.source || 'event',
        data.context || {}
      );
    } catch (error) {
      logger.error('Error handling emotional state update', error);
    }
  }
  
  /**
   * Handle perception events that might contain emotional data
   * @param {Object} data - Event data
   * @private
   */
  async handlePerceptionEvent(data) {
    try {
      // Only process perception events with emotional content
      if (!data.emotional || !data.emotional.valence) {
        return;
      }
      
      logger.debug('Processing perception event with emotional content', data);
      
      const emotional = data.emotional;
      await this.updateEmotionalState(
        emotional.valence,
        emotional.arousal,
        emotional.dominance,
        `perception:${data.type || 'unknown'}`,
        {
          perceptionType: data.type,
          confidence: emotional.confidence,
          ...emotional.context
        }
      );
    } catch (error) {
      logger.error('Error handling perception event', error);
    }
  }
  
  /**
   * Handle interaction events for relationship context
   * @param {Object} data - Event data
   * @private
   */
  async handleInteractionEvent(data) {
    try {
      // Only process interaction events with entity information
      if (!data.entityId) {
        return;
      }
      
      logger.debug('Processing interaction event for relationship context', data);
      
      // Update relationship context with interaction data
      await this.updateRelationshipContext(data.entityId, {
        lastInteraction: Date.now(),
        interactionType: data.type,
        ...data.context
      });
      
      // If the interaction has emotional content, update emotional state
      if (data.emotional) {
        await this.updateEmotionalState(
          data.emotional.valence,
          data.emotional.arousal,
          data.emotional.dominance,
          `interaction:${data.type || 'unknown'}`,
          {
            entityId: data.entityId,
            interactionType: data.type,
            ...data.emotional.context
          }
        );
      }
    } catch (error) {
      logger.error('Error handling interaction event', error);
    }
  }
  
  /**
   * Handle memory events that might contain emotional content
   * @param {Object} data - Event data
   * @private
   */
  async handleMemoryEvent(data) {
    try {
      // Only process memory events with emotional content
      if (!data.content || !data.content.emotional) {
        return;
      }
      
      logger.debug('Processing memory event with emotional content', data);
      
      const emotional = data.content.emotional;
      await this.updateEmotionalState(
        emotional.valence,
        emotional.arousal,
        emotional.dominance,
        `memory:${data.action || 'unknown'}`,
        {
          memoryAction: data.action,
          memoryType: data.memoryType,
          ...emotional.context
        }
      );
    } catch (error) {
      logger.error('Error handling memory event', error);
    }
  }
  
  /**
   * Update the current emotional state
   * @param {Number} valence - Emotional valence (-1.0 to 1.0)
   * @param {Number} arousal - Emotional arousal (-1.0 to 1.0)
   * @param {Number} dominance - Emotional dominance (-1.0 to 1.0)
   * @param {String} source - Source of the emotional state update
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} - Updated emotional state
   */
  async updateEmotionalState(valence, arousal, dominance, source = 'unknown', context = {}) {
    try {
      await this.ensureInitialized();
      
      logger.debug(`Updating emotional state: v=${valence}, a=${arousal}, d=${dominance}`, { source, context });
      
      const result = await this.bridge.callMethod('update_emotional_state', {
        valence,
        arousal,
        dominance,
        source,
        context
      });
      
      // Publish event with updated state
      publish('emotional:memory:state:updated', {
        valence,
        arousal,
        dominance,
        source,
        context,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to update emotional state', error);
      throw error;
    }
  }
  
  /**
   * Get the current emotional state
   * @returns {Promise<Object>} - Current emotional state
   */
  async getCurrentEmotionalState() {
    try {
      await this.ensureInitialized();
      return await this.bridge.callMethod('get_current_state');
    } catch (error) {
      logger.error('Failed to get current emotional state', error);
      throw error;
    }
  }
  
  /**
   * Get emotional history
   * @param {Object} options - Query options
   * @param {Number} options.limit - Maximum number of history items to retrieve
   * @param {String} options.source - Filter by source
   * @param {Number} options.minValence - Minimum valence threshold
   * @param {Number} options.maxValence - Maximum valence threshold
   * @param {Number} options.minArousal - Minimum arousal threshold
   * @param {Number} options.maxArousal - Maximum arousal threshold
   * @returns {Promise<Array>} - Emotional history items
   */
  async getEmotionalHistory(options = {}) {
    try {
      await this.ensureInitialized();
      return await this.bridge.callMethod('get_emotional_history', options);
    } catch (error) {
      logger.error('Failed to get emotional history', error);
      throw error;
    }
  }
  
  /**
   * Update relationship context for an entity
   * @param {String} entityId - ID of the entity
   * @param {Object} context - Context information to update
   * @returns {Promise<Object>} - Updated relationship context
   */
  async updateRelationshipContext(entityId, context) {
    try {
      await this.ensureInitialized();
      
      logger.debug(`Updating relationship context for entity ${entityId}`, context);
      
      const result = await this.bridge.callMethod('update_relationship_context', {
        entity_id: entityId,
        context
      });
      
      // Publish event with updated context
      publish('emotional:memory:relationship:updated', {
        entityId,
        context,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      logger.error(`Failed to update relationship context for entity ${entityId}`, error);
      throw error;
    }
  }
  
  /**
   * Get relationship context for an entity
   * @param {String} entityId - ID of the entity
   * @returns {Promise<Object>} - Relationship context
   */
  async getRelationshipContext(entityId) {
    try {
      await this.ensureInitialized();
      return await this.bridge.callMethod('get_relationship_context', {
        entity_id: entityId
      });
    } catch (error) {
      logger.error(`Failed to get relationship context for entity ${entityId}`, error);
      throw error;
    }
  }
  
  /**
   * Get emotional trend analysis
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Trend analysis results
   */
  async getEmotionalTrend(options = {}) {
    try {
      await this.ensureInitialized();
      return await this.bridge.callMethod('get_emotional_trend', options);
    } catch (error) {
      logger.error('Failed to get emotional trend analysis', error);
      throw error;
    }
  }
  
  /**
   * Ensure the bridge is initialized
   * @private
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  /**
   * Disconnect and clean up resources
   */
  async disconnect() {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      logger.info('Disconnecting emotional memory bridge');
      
      // Unsubscribe from events
      Object.entries(this.eventHandlers).forEach(([key, handler]) => {
        const eventName = key.replace(/([A-Z])/g, ':$1').toLowerCase();
        unsubscribe(eventName, handler);
      });
      
      await this.bridge.disconnect();
      this.isInitialized = false;
      
      logger.info('Emotional memory bridge disconnected');
    } catch (error) {
      logger.error('Error disconnecting emotional memory bridge', error);
      throw error;
    }
  }
}

// Export singleton instance
let instance = null;

/**
 * Get the emotional memory bridge instance
 * @param {Object} options - Optional configuration
 * @returns {EmotionalMemoryBridge} - Singleton instance
 */
export function getEmotionalMemoryBridge(options = {}) {
  if (!instance) {
    instance = new EmotionalMemoryBridge(options);
  }
  return instance;
}
