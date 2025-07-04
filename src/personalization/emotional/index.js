/**
 * index.js - Emotional Intelligence Module
 * 
 * Provides a unified interface to ALEJO's emotional intelligence capabilities,
 * integrating empathy modeling, mood detection, and relationship management.
 * 
 * This module serves as the entry point for all emotional intelligence features
 * and coordinates the interaction between the various emotional components.
 */
import * as empathyCore from './empathy-core.js';
import * as moodDetector from './mood-detector.js';
import * as relationship from './relationship.js';
import { subscribe, publish } from '../../core/events.js';
import * as auditTrail from '../../security/audit-trail.js';

// Emotional intelligence configuration
const config = {
  // How strongly emotional intelligence affects responses (0-1)
  adaptationStrength: 0.7,
  
  // Whether to enable empathetic responses
  enableEmpathy: true,
  
  // Whether to enable mood-based adaptations
  enableMoodDetection: true,
  
  // Whether to enable relationship continuity
  enableRelationship: true,
  
  // Minimum confidence threshold for applying emotional adaptations
  confidenceThreshold: 0.4
};

/**
 * Initialize the emotional intelligence module and all its components.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    console.log('Initializing ALEJO emotional intelligence module...');
    
    // Initialize all submodules
    const empathyInitialized = await empathyCore.initialize();
    const moodInitialized = await moodDetector.initialize();
    const relationshipInitialized = await relationship.initialize();
    
    if (!empathyInitialized || !moodInitialized || !relationshipInitialized) {
      console.error('Failed to initialize one or more emotional intelligence components');
      return false;
    }
    
    // Subscribe to configuration updates
    subscribe('config:updated', ({ section, settings }) => {
      if (section === 'emotional' || section === 'personalization') {
        updateConfiguration(settings);
      }
    });
    
    // Subscribe to conversation response events to enhance with emotional intelligence
    subscribe('conversation:response:pre', async ({ userId, response, context }) => {
      if (!config.enableEmpathy) return;
      
      try {
        // Generate empathetic response
        const empatheticResponse = await empathyCore.generateEmpatheticResponse(
          userId, 
          response, 
          context
        );
        
        // Publish the enhanced response
        publish('conversation:response:enhanced', {
          userId,
          originalResponse: response,
          enhancedResponse: empatheticResponse,
          enhancementType: 'empathy',
          context
        });
      } catch (error) {
        console.error('Error enhancing response with empathy:', error);
        auditTrail.log('emotional:empathy:error', { userId, error: error.message });
      }
    });
    
    // Subscribe to conversation start events to add continuity
    subscribe('conversation:start', async ({ userId, context }) => {
      if (!config.enableRelationship) return;
      
      try {
        // Generate continuity prompt
        const continuityPrompt = await relationship.generateContinuityPrompt(userId);
        
        if (continuityPrompt) {
          // Publish continuity context
          publish('conversation:context:added', {
            userId,
            contextType: 'continuity',
            contextData: { continuityPrompt },
            context
          });
        }
      } catch (error) {
        console.error('Error generating conversation continuity:', error);
        auditTrail.log('emotional:continuity:error', { userId, error: error.message });
      }
    });
    
    // Subscribe to multimodal input events for comprehensive mood detection
    subscribe('input:multimodal', async ({ userId, text, expressions, voiceTone, context }) => {
      if (!config.enableMoodDetection) return;
      
      try {
        // Process mood from all available inputs
        const moodResult = await moodDetector.processMoodInput(
          userId, 
          { text, expressions, voiceTone }, 
          context
        );
        
        // Only apply mood adaptations if confidence exceeds threshold
        if (moodResult.confidence >= config.confidenceThreshold) {
          // Publish mood context
          publish('conversation:context:added', {
            userId,
            contextType: 'mood',
            contextData: { 
              mood: moodResult.dimensions,
              category: moodResult.category,
              confidence: moodResult.confidence
            },
            context
          });
        }
      } catch (error) {
        console.error('Error processing mood input:', error);
        auditTrail.log('emotional:mood:error', { userId, error: error.message });
      }
    });
    
    // Log successful initialization
    console.log('ALEJO emotional intelligence module initialized successfully');
    auditTrail.log('emotional:initialized', { 
      components: ['empathy-core', 'mood-detector', 'relationship'],
      config: { ...config }
    });
    
    // Publish initialization event
    publish('emotional:initialized', { 
      status: 'success',
      components: ['empathy-core', 'mood-detector', 'relationship']
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing emotional intelligence module:', error);
    auditTrail.log('emotional:initialization:error', { error: error.message });
    return false;
  }
}

/**
 * Update emotional intelligence configuration.
 * @param {Object} settings - New configuration settings
 */
function updateConfiguration(settings) {
  if (settings.adaptationStrength !== undefined) {
    config.adaptationStrength = Math.min(1, Math.max(0, settings.adaptationStrength));
  }
  
  if (settings.enableEmpathy !== undefined) {
    config.enableEmpathy = !!settings.enableEmpathy;
  }
  
  if (settings.enableMoodDetection !== undefined) {
    config.enableMoodDetection = !!settings.enableMoodDetection;
  }
  
  if (settings.enableRelationship !== undefined) {
    config.enableRelationship = !!settings.enableRelationship;
  }
  
  if (settings.confidenceThreshold !== undefined) {
    config.confidenceThreshold = Math.min(1, Math.max(0, settings.confidenceThreshold));
  }
  
  // Log configuration update
  auditTrail.log('emotional:config:updated', { newConfig: { ...config } });
}

/**
 * Get the current emotional state for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Combined emotional state
 */
export async function getEmotionalState(userId) {
  try {
    // Get data from all emotional components
    const [emotions, mood, relationshipData] = await Promise.all([
      empathyCore.getEmotionalState(userId),
      moodDetector.getMoodProfile(userId),
      relationship.getRelationshipData(userId)
    ]);
    
    // Return combined emotional intelligence data
    return {
      emotions,
      mood,
      relationship: {
        stage: relationshipData.stage,
        dimensions: relationshipData.dimensions
      }
    };
  } catch (error) {
    console.error('Error getting emotional state:', error);
    auditTrail.log('emotional:state:get:error', { userId, error: error.message });
    return null;
  }
}

/**
 * Process user input through all emotional intelligence components.
 * @param {string} userId - User identifier
 * @param {Object} input - User input data
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} Processing results
 */
export async function processInput(userId, input, context = {}) {
  try {
    const results = {
      empathy: null,
      mood: null,
      relationship: null
    };
    
    // Process through mood detector
    if (config.enableMoodDetection) {
      results.mood = await moodDetector.processMoodInput(userId, input, context);
    }
    
    // Update relationship if text input is available
    if (config.enableRelationship && input.text) {
      // Determine interaction type
      let interactionType = 'conversation';
      if (input.text.includes('?')) {
        interactionType = 'query';
      }
      
      results.relationship = await relationship.updateRelationship(userId, {
        type: interactionType,
        timestamp: Date.now(),
        topic: context.topic
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error processing input through emotional intelligence:', error);
    auditTrail.log('emotional:process:error', { userId, error: error.message });
    return null;
  }
}

/**
 * Enhance a response with emotional intelligence.
 * @param {string} userId - User identifier
 * @param {string} response - Original response text
 * @param {Object} context - Response context
 * @returns {Promise<string>} Enhanced response
 */
export async function enhanceResponse(userId, response, context = {}) {
  try {
    let enhancedResponse = response;
    
    // Apply empathetic enhancement if enabled
    if (config.enableEmpathy) {
      enhancedResponse = await empathyCore.generateEmpatheticResponse(
        userId, 
        enhancedResponse, 
        context
      );
    }
    
    // Apply relationship-based rapport strategies
    if (config.enableRelationship) {
      const rapportStrategies = await relationship.getRapportStrategies(userId);
      
      // Apply rapport strategies based on relationship stage
      // (This is a simplified implementation - in a real system, this would
      // involve more sophisticated NLP transformations)
      
      // Add personal references if appropriate
      if (rapportStrategies.personalReferences && context.personalReferences) {
        // Example of adding a personal reference
        const personalReference = context.personalReferences[0];
        if (personalReference) {
          enhancedResponse = `As we discussed about ${personalReference}, ${enhancedResponse}`;
        }
      }
      
      // Adjust formality based on relationship
      if (rapportStrategies.formality === 'casual' && !enhancedResponse.includes('Hey') && !enhancedResponse.includes('Hi')) {
        enhancedResponse = enhancedResponse.replace(/^(I |The |This |Here |There )/, 'Hey, $1');
      }
    }
    
    return enhancedResponse;
  } catch (error) {
    console.error('Error enhancing response with emotional intelligence:', error);
    auditTrail.log('emotional:enhance:error', { userId, error: error.message });
    return response; // Return original response on error
  }
}

/**
 * Get rapport building strategies for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Rapport strategies
 */
export async function getRapportStrategies(userId) {
  try {
    return await relationship.getRapportStrategies(userId);
  } catch (error) {
    console.error('Error getting rapport strategies:', error);
    auditTrail.log('emotional:rapport:error', { userId, error: error.message });
    return null;
  }
}

/**
 * Generate a conversation continuity prompt.
 * @param {string} userId - User identifier
 * @returns {Promise<string>} Continuity prompt
 */
export async function getContinuityPrompt(userId) {
  try {
    return await relationship.generateContinuityPrompt(userId);
  } catch (error) {
    console.error('Error getting continuity prompt:', error);
    auditTrail.log('emotional:continuity:error', { userId, error: error.message });
    return '';
  }
}

/**
 * Reset all emotional data for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
export async function resetEmotionalData(userId) {
  try {
    await empathyCore.resetEmotionalData(userId);
    // Add reset functions for other components as they're implemented
    
    auditTrail.log('emotional:reset', { userId });
    return true;
  } catch (error) {
    console.error('Error resetting emotional data:', error);
    auditTrail.log('emotional:reset:error', { userId, error: error.message });
    return false;
  }
}
