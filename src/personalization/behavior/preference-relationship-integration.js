/**
 * ALEJO Preference-Relationship Integration Module
 * 
 * This module integrates the preference model with the relationship memory system,
 * allowing preferences to be contextualized based on relationship data.
 */

const { getPreferenceModel, savePreferenceModel } = require('./preference-persistence');
const { PREFERENCE_CATEGORIES, CONFIDENCE_LEVELS, DECAY_RATES, CONTEXT_FACTORS } = require('./preference-model');

/**
 * Python interop for relationship memory access
 */
const { PythonBridge } = require('../../core/integrations/python-bridge');
const pythonBridge = new PythonBridge();

/**
 * Get relationship context for an entity to inform preference adjustments
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @returns {Promise<Object>} Relationship context data
 */
async function getRelationshipContext(userId, entityId) {
  try {
    // Call Python relationship memory system
    const result = await pythonBridge.callPython(
      'alejo.cognitive.memory.relationship_memory',
      'get_relationship_context',
      [userId, entityId]
    );
    
    return result || {};
  } catch (error) {
    console.error('Error getting relationship context:', error);
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
 * @returns {Promise<boolean>} Success status
 */
async function updateRelationshipFromPreference(userId, entityId, key, value, strength) {
  try {
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
    
    // Record interaction in relationship memory
    await pythonBridge.callPython(
      'alejo.cognitive.memory.relationship_memory',
      'record_preference_interaction',
      [
        userId,
        entityId,
        'preference_update',
        `Preference update: ${key} = ${value}`,
        sentimentValue,
        strength,
        { preference_key: key, preference_value: value, preference_category: category }
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating relationship from preference:', error);
    return false;
  }
}

module.exports = {
  getRelationshipContext,
  adjustPreferenceByRelationship,
  detectPreferencesFromRelationship,
  updateRelationshipFromPreference
};
