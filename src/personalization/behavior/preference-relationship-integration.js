/**
 * ALEJO Preference-Relationship Integration Module
 * 
 * This module integrates the preference model with the relationship memory system,
 * allowing preferences to be contextualized based on relationship data.
 */
/**
 * Integration between preference model and relationship memory system
 * @module preference-relationship-integration
 */

// Import dependencies consistently using ES modules syntax
import { PythonBridge } from '../../core/integrations/python-bridge.js';
import { PREFERENCE_CATEGORIES, CONFIDENCE_LEVELS, DECAY_RATES, CONTEXT_FACTORS } from '../constants/preference-constants.js';
import { auditTrail } from '../../utils/audit-trail.js';
import { queueManager } from '../../utils/queue-manager.js';
import { relationshipCircuitBreaker } from '../../utils/circuit-breaker.js';
import { enqueueFailedRelationshipUpdate } from './relationship-update-queue.js';
import { relationshipCache } from '../../utils/cache-manager.js';
import { normalizePreferenceStrength } from './preference-normalization.js';

// Initialize services
const pythonBridge = new PythonBridge();

// Constants
const RETRY_QUEUE_NAME = 'relationship_updates';

/**
 * Get relationship context for an entity to inform preference adjustments
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.retryDelay - Delay between retries in ms
 * @param {boolean} options.bypassCache - Whether to bypass the cache
 * @returns {Promise<Object>} Relationship context data
 */
async function getRelationshipContext(userId, entityId, options = { maxRetries: 2, retryDelay: 300, bypassCache: false }) {
  const startTime = performance.now();
  const { maxRetries, retryDelay, bypassCache } = options;
  
  // Generate cache key
  const cacheKey = `${userId}:${entityId}`;
  
  // Check cache first unless bypassing
  if (!bypassCache) {
    const cachedContext = relationshipCache.get(cacheKey);
    if (cachedContext) {
      const duration = performance.now() - startTime;
      auditTrail.log('relationship:cache:hit', { userId, entityId, duration });
      return cachedContext;
    }
  }
  
  // Check if circuit breaker is open
  if (relationshipCircuitBreaker.isOpen()) {
    console.warn(`Circuit breaker open for relationship memory, using empty context for ${userId}:${entityId}`);
    auditTrail.log('relationship:circuit_breaker:skip', { userId, entityId });
    return {};
  }
  
  let attempts = 0;
  
  try {
    // Use circuit breaker to protect the call
    const result = await relationshipCircuitBreaker.execute(async () => {
      while (attempts <= maxRetries) {
        try {
          attempts++;
          
          // Call Python relationship memory system
          const result = await pythonBridge.callPython(
            'alejo.cognitive.memory.relationship_memory',
            'get_relationship_context',
            [userId, entityId]
          );
          
          // Log success metrics for monitoring
          if (attempts > 1) {
            console.info(`Retrieved relationship context after ${attempts} attempts`);
            auditTrail.log('relationship:retry:success', { userId, entityId, attempts });
          }
          
          return result || {};
        } catch (error) {
          const isLastAttempt = attempts > maxRetries;
          const logLevel = isLastAttempt ? 'error' : 'warn';
          console[logLevel](`Error getting relationship context (attempt ${attempts}/${maxRetries + 1}):`, error);
          
          // Add telemetry for errors
          auditTrail.log('relationship:error', { 
            userId, 
            entityId, 
            attempt: attempts,
            error: error.message,
            stack: error.stack
          });
          
          if (isLastAttempt) {
            throw error; // Let circuit breaker handle the failure
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
        }
      }
      
      throw new Error('Maximum retry attempts reached');
    });
    
    // Cache the successful result
    if (Object.keys(result).length > 0) {
      relationshipCache.set(cacheKey, result);
      
      // Log cache metrics
      const duration = performance.now() - startTime;
      auditTrail.log('relationship:cache:store', { 
        userId, 
        entityId, 
        duration,
        cacheStats: relationshipCache.getStats()
      });
    }
    
    return result;
  } catch (error) {
    console.error('Circuit breaker prevented relationship context lookup:', error);
    auditTrail.log('relationship:circuit_breaker:open', { 
      userId, 
      entityId,
      error: error.message 
    });
    return {};
  }
}

/**
 * Adjust preference strength based on relationship context
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @param {number} baseStrength - Base preference strength
 * @returns {Promise<number>} Adjusted preference strength
 */
async function adjustPreferenceByRelationship(userId, entityId, baseStrength) {
  try {
    let adjustedStrength = baseStrength;
    
    // Get relationship context from relationship memory
    const relationshipContext = await getRelationshipContext(userId, entityId);
    
    // No relationship data found
    if (!relationshipContext || !relationshipContext.strength) {
      return baseStrength;
    }
    
    // Apply relationship strength as a factor
    // Stronger relationships make preferences more significant
    const relationshipStrength = relationshipContext.strength || 0.5;
    const sentimentScore = relationshipContext.sentiment || 0;
    
    // Calculate relationship factor - higher for stronger relationships
    let relationshipFactor = 1.0;
    
    // Strong positive relationships amplify preferences
    if (relationshipStrength > 0.7 && sentimentScore > 0.3) {
      relationshipFactor = 1.2;
    }
    // Strong negative relationships can slightly diminish preferences
    else if (relationshipStrength > 0.5 && sentimentScore < -0.3) {
      relationshipFactor = 0.9;
    }
    // Weak relationships have less influence
    else if (relationshipStrength < 0.3) {
      relationshipFactor = 0.95;
    }
    
    // Apply the relationship factor
    adjustedStrength *= relationshipFactor;
    
    // Consider recency of interactions
    if (relationshipContext.lastInteraction) {
      const lastInteraction = new Date(relationshipContext.lastInteraction);
      const now = new Date();
      const daysSinceInteraction = (now - lastInteraction) / (1000 * 60 * 60 * 24);
      
      // Recent interactions have stronger influence
      if (daysSinceInteraction < 1) {
        adjustedStrength *= 1.1; // Boost for very recent interactions
      } else if (daysSinceInteraction > 30) {
        adjustedStrength *= 0.9; // Reduce for older interactions
      }
    }
    
    // Ensure strength stays within valid range
    return Math.max(0.1, Math.min(1.0, adjustedStrength));
  } catch (error) {
    console.error('Error adjusting preference by relationship:', error);
    return baseStrength; // Return original strength on error
  }
}

/**
 * Detect entity-related preferences from relationship data
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @returns {Promise<boolean>} Success status
 */
async function detectPreferencesFromRelationship(userId, entityId) {
  try {
    // Get relationship context
    const relationshipContext = await getRelationshipContext(userId, entityId);
    
    if (!relationshipContext) {
      return false;
    }
    
    const { entity_type, name, strength, sentiment, interaction_patterns } = relationshipContext;
    
    // Skip if insufficient data
    if (!entity_type || !name || typeof strength !== 'number') {
      return false;
    }
    
    // Import preference model functions
    const { observePreference } = require('./preference-model');
    
    // Record entity preference based on relationship strength and sentiment
    if (strength > 0.4) {
      // Determine preference strength from relationship data
      const preferenceStrength = Math.min(1.0, Math.max(0.3, strength));
      
      // Determine if this is a positive or negative preference
      if (sentiment > 0.2) {
        // Positive relationship
        await observePreference(
          userId,
          `relationship:liked:${entity_type}:${name}`,
          true,
          PREFERENCE_CATEGORIES.SOCIAL,
          'relationship_analysis',
          preferenceStrength,
          DECAY_RATES.SLOW
        );
      } else if (sentiment < -0.2) {
        // Negative relationship
        await observePreference(
          userId,
          `relationship:disliked:${entity_type}:${name}`,
          true,
          PREFERENCE_CATEGORIES.SOCIAL,
          'relationship_analysis',
          preferenceStrength,
          DECAY_RATES.SLOW
        );
      }
      
      // Record preferences based on interaction patterns
      if (interaction_patterns) {
        for (const pattern of interaction_patterns) {
          if (pattern.type && pattern.frequency > 0.3) {
            await observePreference(
              userId,
              `interaction:pattern:${pattern.type}:${entity_type}:${name}`,
              true,
              PREFERENCE_CATEGORIES.SOCIAL,
              'relationship_pattern_analysis',
              pattern.frequency,
              DECAY_RATES.STANDARD
            );
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error detecting preferences from relationship:', error);
    return false;
  }
}

/**
 * Update relationship data based on preference changes
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {number} strength - Preference strength
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {boolean} options.criticalUpdate - Whether this update is critical
 * @returns {Promise<boolean>} Success status
 */
async function updateRelationshipFromPreference(userId, entityId, key, value, strength, options = { maxRetries: 1, criticalUpdate: false }) {
  const startTime = performance.now();
  const { maxRetries, criticalUpdate } = options;
  
  if (!entityId) {
    return false;
  }
  
  // Determine sentiment from key if possible
  let sentimentValue = strength;
  const entityMatch = key.match(/relationship:(liked|disliked):(\w+):(.+)/);
  if (entityMatch) {
    const [, sentiment] = entityMatch;
    sentimentValue = sentiment === 'liked' ? strength : -strength;
  }
  
  // Check if circuit breaker is open
  if (relationshipCircuitBreaker.isOpen()) {
    console.warn(`Circuit breaker open for relationship memory, skipping update for ${userId}:${entityId}:${key}`);
    auditTrail.log('relationship:update:circuit_breaker:skip', { userId, entityId, key });
    
    // Queue critical updates even when circuit is open
    if (criticalUpdate) {
      console.info('Circuit open but queueing critical relationship update for later retry');
      try {
        await enqueueFailedRelationshipUpdate(userId, entityId, key, value, strength);
        auditTrail.log('relationship:update:queued', { userId, entityId, key, reason: 'circuit_open' });
      } catch (queueError) {
        console.error('Failed to enqueue relationship update:', queueError);
      }
    }
    
    return false;
  }
  
  try {
    // Use circuit breaker to protect the call
    return await relationshipCircuitBreaker.execute(async () => {
      let attempts = 0;
      
      while (attempts <= maxRetries) {
        try {
          attempts++;
          
          // Record interaction in relationship memory
          await pythonBridge.callPython(
            'alejo.cognitive.memory.relationship_memory',
            'record_preference_interaction',
            [
              userId,
              entityId,
              'preference_update',
              `User ${sentimentValue > 0 ? 'likes' : 'dislikes'} ${key}`,
              sentimentValue,
              0.7,  // Medium-high importance
              { preference_key: key, preference_value: value }
            ]
          );
          
          // Log performance data
          const duration = performance.now() - startTime;
          auditTrail.log('relationship:update:success', {
            userId,
            entityId,
            key,
            attempts,
            duration
          });
          
          return true;
        } catch (error) {
          const isLastAttempt = attempts > maxRetries;
          console.error(`Error updating relationship (attempt ${attempts}/${maxRetries + 1}):`, error);
          
          // Log the error for monitoring
          auditTrail.log('relationship:update:error', {
            userId,
            entityId,
            key,
            attempts,
            error: error.message
          });
          
          if (isLastAttempt) {
            throw error; // Let circuit breaker handle the failure
          }
          
          // Exponential backoff before retrying
          await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempts - 1)));
        }
      }
      
      throw new Error('Maximum retry attempts reached');
    });
  } catch (error) {
    console.error('Circuit breaker prevented relationship update:', error);
    auditTrail.log('relationship:update:circuit_breaker:open', { 
      userId, 
      entityId,
      key,
      error: error.message 
    });
    
    // For critical updates, enqueue for later retry with a background worker
    if (criticalUpdate) {
      try {
        // Queue the failed update for later processing
        await enqueueFailedRelationshipUpdate(userId, entityId, key, value, strength);
        auditTrail.log('relationship:update:queued', { userId, entityId, key, reason: 'circuit_failure' });
      } catch (queueError) {
        console.error('Failed to enqueue relationship update:', queueError);
      }
    }
    
    return false;
  }
}

module.exports = {
  getRelationshipContext,
  adjustPreferenceByRelationship,
  detectPreferencesFromRelationship,
  updateRelationshipFromPreference
};
