/**
 * relationship.js
 * 
 * Manages conversation continuity across sessions and builds relationship context.
 * This module works with empathy-core.js and mood-detector.js to provide a
 * complete emotional intelligence system for ALEJO.
 * 
 * Features:
 * - Conversation continuity tracking
 * - Relationship stage modeling
 * - Interaction pattern analysis
 * - Rapport building strategies
 * - Conversation memory integration
 */
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';
import * as personalGraph from '../memory/personal-graph.js';
import * as memoryCurator from '../memory/memory-curator.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'relationship:';
const RELATIONSHIP_DATA_KEY = 'data';
const CONVERSATION_HISTORY_KEY = 'conversations';

// Relationship stages
const RELATIONSHIP_STAGES = {
  INITIAL: 'initial',           // First few interactions
  ACQUAINTANCE: 'acquaintance', // Basic familiarity established
  FAMILIAR: 'familiar',         // Regular interactions, knows preferences
  ESTABLISHED: 'established',   // Strong rapport, deeper understanding
  TRUSTED: 'trusted'            // High trust, personalized relationship
};

// Relationship dimensions
const RELATIONSHIP_DIMENSIONS = {
  familiarity: 0,      // 0-1: How well ALEJO knows the user
  trust: 0,            // 0-1: Level of trust established
  rapport: 0,          // 0-1: Quality of communication and understanding
  engagement: 0,       // 0-1: User's level of engagement with ALEJO
  satisfaction: 0,     // 0-1: User's satisfaction with interactions
  consistency: 0       // 0-1: Consistency of interactions over time
};

// Interaction types for analysis
const INTERACTION_TYPES = {
  QUERY: 'query',               // User asking for information
  INSTRUCTION: 'instruction',   // User giving a command
  CONVERSATION: 'conversation', // Casual conversation
  FEEDBACK: 'feedback',         // User providing feedback
  EMOTIONAL: 'emotional',       // Emotionally charged interaction
  PERSONAL: 'personal'          // Sharing personal information
};

// In-memory cache of user relationship data
const userRelationships = new Map(); // userId -> relationship data
const conversationHistory = new Map(); // userId -> conversation summaries

/**
 * Initialize or retrieve relationship data for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's relationship data
 */
async function getRelationshipData(userId) {
  try {
    if (!userRelationships.has(userId)) {
      // Load from secure storage or initialize
      const storedData = await loadRelationshipData(userId);
      
      if (storedData) {
        userRelationships.set(userId, storedData);
      } else {
        // Initialize new relationship
        const initialData = {
          dimensions: { ...RELATIONSHIP_DIMENSIONS },
          stage: RELATIONSHIP_STAGES.INITIAL,
          interactionCount: 0,
          lastInteraction: Date.now(),
          firstInteraction: Date.now(),
          topicPreferences: {},
          interactionPatterns: {},
          sessionCount: 1,
          currentSessionStart: Date.now()
        };
        
        userRelationships.set(userId, initialData);
        await saveRelationshipData(userId, initialData);
      }
    }
    
    return { ...userRelationships.get(userId) };
  } catch (error) {
    console.error('Error getting relationship data:', error);
    auditTrail.log('relationship:data:error', { userId, error: error.message });
    
    // Return default data if error
    return {
      dimensions: { ...RELATIONSHIP_DIMENSIONS },
      stage: RELATIONSHIP_STAGES.INITIAL,
      interactionCount: 0,
      lastInteraction: Date.now(),
      firstInteraction: Date.now(),
      topicPreferences: {},
      interactionPatterns: {},
      sessionCount: 1,
      currentSessionStart: Date.now()
    };
  }
}

/**
 * Update relationship data after an interaction.
 * @param {string} userId - User identifier
 * @param {Object} interaction - Interaction details
 * @returns {Promise<Object>} Updated relationship data
 */
async function updateRelationship(userId, interaction) {
  try {
    // Get current relationship data
    const relationshipData = await getRelationshipData(userId);
    
    // Update basic metrics
    relationshipData.interactionCount++;
    relationshipData.lastInteraction = Date.now();
    
    // Calculate session information
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const timeSinceLastInteraction = relationshipData.lastInteraction - 
                                    (interaction.timestamp || Date.now());
    
    // Check if this is a new session
    if (timeSinceLastInteraction > SESSION_TIMEOUT) {
      relationshipData.sessionCount++;
      relationshipData.currentSessionStart = Date.now();
    }
    
    // Update topic preferences
    if (interaction.topic) {
      relationshipData.topicPreferences[interaction.topic] = 
        (relationshipData.topicPreferences[interaction.topic] || 0) + 1;
    }
    
    // Update interaction patterns
    if (interaction.type) {
      relationshipData.interactionPatterns[interaction.type] = 
        (relationshipData.interactionPatterns[interaction.type] || 0) + 1;
    }
    
    // Update relationship dimensions
    updateRelationshipDimensions(relationshipData, interaction);
    
    // Update relationship stage if needed
    updateRelationshipStage(relationshipData);
    
    // Save updated data
    userRelationships.set(userId, relationshipData);
    await saveRelationshipData(userId, relationshipData);
    
    // Log relationship update
    auditTrail.log('relationship:updated', {
      userId,
      stage: relationshipData.stage,
      interactionCount: relationshipData.interactionCount
    });
    
    // Publish relationship updated event
    publish('relationship:updated', {
      userId,
      relationship: {
        stage: relationshipData.stage,
        dimensions: { ...relationshipData.dimensions }
      }
    });
    
    return relationshipData;
  } catch (error) {
    console.error('Error updating relationship:', error);
    auditTrail.log('relationship:update:error', { userId, error: error.message });
    return null;
  }
}

/**
 * Update relationship dimensions based on interaction.
 * @param {Object} relationshipData - Current relationship data
 * @param {Object} interaction - Interaction details
 */
function updateRelationshipDimensions(relationshipData, interaction) {
  const dimensions = relationshipData.dimensions;
  
  // Update familiarity (increases with each interaction, faster for personal interactions)
  const familiarityIncrement = interaction.type === INTERACTION_TYPES.PERSONAL ? 0.03 : 0.01;
  dimensions.familiarity = Math.min(1.0, dimensions.familiarity + familiarityIncrement);
  
  // Update trust based on interaction type and feedback
  if (interaction.feedback) {
    // Positive feedback increases trust
    if (interaction.feedback.sentiment > 0) {
      dimensions.trust = Math.min(1.0, dimensions.trust + 0.05);
    } 
    // Negative feedback slightly decreases trust
    else if (interaction.feedback.sentiment < 0) {
      dimensions.trust = Math.max(0, dimensions.trust - 0.02);
    }
  }
  
  // Update rapport based on emotional resonance
  if (interaction.emotionalResonance) {
    dimensions.rapport = Math.min(1.0, dimensions.rapport + 
                                (interaction.emotionalResonance * 0.1));
  } else {
    // Small default increase
    dimensions.rapport = Math.min(1.0, dimensions.rapport + 0.005);
  }
  
  // Update engagement based on interaction frequency and depth
  const timeSinceFirst = Date.now() - relationshipData.firstInteraction;
  const daysActive = timeSinceFirst / (24 * 60 * 60 * 1000);
  
  if (daysActive > 0) {
    // Higher engagement for frequent interactions over time
    const interactionsPerDay = relationshipData.interactionCount / daysActive;
    dimensions.engagement = Math.min(1.0, 0.3 + (interactionsPerDay * 0.1));
  } else {
    dimensions.engagement = Math.min(1.0, dimensions.engagement + 0.01);
  }
  
  // Update satisfaction based on feedback or default small increase
  if (interaction.feedback && interaction.feedback.satisfaction !== undefined) {
    // Direct satisfaction feedback
    dimensions.satisfaction = 
      (dimensions.satisfaction * 0.8) + (interaction.feedback.satisfaction * 0.2);
  } else {
    // Small default increase (assumption of adequate satisfaction if no negative feedback)
    dimensions.satisfaction = Math.min(1.0, dimensions.satisfaction + 0.005);
  }
  
  // Update consistency based on interaction patterns
  const patternTypes = Object.keys(relationshipData.interactionPatterns).length;
  const totalInteractions = relationshipData.interactionCount;
  
  if (totalInteractions > 5) {
    // Higher consistency when interaction patterns are established
    dimensions.consistency = Math.min(1.0, 0.2 + 
                                    (patternTypes / 6) + 
                                    (Math.min(100, totalInteractions) / 200));
  } else {
    dimensions.consistency = Math.min(1.0, dimensions.consistency + 0.01);
  }
}

/**
 * Update relationship stage based on dimensions and interaction count.
 * @param {Object} relationshipData - Current relationship data
 */
function updateRelationshipStage(relationshipData) {
  const dimensions = relationshipData.dimensions;
  const interactionCount = relationshipData.interactionCount;
  
  // Calculate overall relationship strength
  const relationshipStrength = 
    (dimensions.familiarity * 0.2) +
    (dimensions.trust * 0.3) +
    (dimensions.rapport * 0.2) +
    (dimensions.engagement * 0.1) +
    (dimensions.satisfaction * 0.1) +
    (dimensions.consistency * 0.1);
  
  // Update stage based on relationship strength and minimum interaction counts
  if (relationshipStrength > 0.8 && interactionCount > 50) {
    relationshipData.stage = RELATIONSHIP_STAGES.TRUSTED;
  } else if (relationshipStrength > 0.6 && interactionCount > 30) {
    relationshipData.stage = RELATIONSHIP_STAGES.ESTABLISHED;
  } else if (relationshipStrength > 0.4 && interactionCount > 15) {
    relationshipData.stage = RELATIONSHIP_STAGES.FAMILIAR;
  } else if (relationshipStrength > 0.2 && interactionCount > 5) {
    relationshipData.stage = RELATIONSHIP_STAGES.ACQUAINTANCE;
  } else {
    relationshipData.stage = RELATIONSHIP_STAGES.INITIAL;
  }
}

/**
 * Record a conversation summary for continuity.
 * @param {string} userId - User identifier
 * @param {Object} conversation - Conversation details
 * @returns {Promise<boolean>} Success status
 */
export async function recordConversation(userId, conversation) {
  try {
    // Get current conversation history
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, await loadConversationHistory(userId) || []);
    }
    
    const history = conversationHistory.get(userId);
    
    // Create conversation summary
    const summary = {
      id: conversation.id || `conv-${Date.now()}`,
      timestamp: conversation.timestamp || Date.now(),
      topics: conversation.topics || [],
      duration: conversation.duration || 0,
      messageCount: conversation.messageCount || 0,
      summary: conversation.summary || '',
      sentiment: conversation.sentiment || 0,
      keyPoints: conversation.keyPoints || []
    };
    
    // Add to history
    history.push(summary);
    
    // Keep history to a reasonable size (last 50 conversations)
    if (history.length > 50) {
      history.shift();
    }
    
    // Save updated history
    conversationHistory.set(userId, history);
    await saveConversationHistory(userId, history);
    
    // Create memory for significant conversations
    if (conversation.significant || 
        conversation.duration > 300000 || // 5+ minutes
        conversation.messageCount > 10) {
      
      // Create a memory entry for this conversation
      await memoryCurator.createMemory({
        userId,
        type: 'conversation',
        content: summary.summary,
        importance: calculateConversationImportance(summary),
        entities: conversation.entities || [],
        context: {
          timestamp: summary.timestamp,
          topics: summary.topics,
          keyPoints: summary.keyPoints
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error recording conversation:', error);
    auditTrail.log('relationship:conversation:error', { userId, error: error.message });
    return false;
  }
}

/**
 * Calculate importance of a conversation for memory purposes.
 * @param {Object} conversation - Conversation summary
 * @returns {number} Importance score (0-1)
 */
function calculateConversationImportance(conversation) {
  let importance = 0.3; // Base importance
  
  // Longer conversations are more important
  if (conversation.duration > 600000) { // 10+ minutes
    importance += 0.2;
  } else if (conversation.duration > 300000) { // 5+ minutes
    importance += 0.1;
  }
  
  // More messages indicate more important conversations
  if (conversation.messageCount > 20) {
    importance += 0.2;
  } else if (conversation.messageCount > 10) {
    importance += 0.1;
  }
  
  // Strong sentiment (positive or negative) indicates importance
  if (Math.abs(conversation.sentiment) > 0.7) {
    importance += 0.2;
  } else if (Math.abs(conversation.sentiment) > 0.4) {
    importance += 0.1;
  }
  
  // More topics indicate a broader, potentially more important conversation
  if (conversation.topics && conversation.topics.length > 3) {
    importance += 0.1;
  }
  
  // More key points indicate a more substantial conversation
  if (conversation.keyPoints && conversation.keyPoints.length > 5) {
    importance += 0.1;
  }
  
  return Math.min(1.0, importance);
}

/**
 * Get recent conversation history for a user.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of conversations to return
 * @returns {Promise<Array>} Recent conversation summaries
 */
export async function getRecentConversations(userId, limit = 5) {
  try {
    // Load from storage if not in memory
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, await loadConversationHistory(userId) || []);
    }
    
    const history = conversationHistory.get(userId);
    
    // Return most recent conversations up to the limit
    return history.slice(-limit).reverse();
  } catch (error) {
    console.error('Error getting conversation history:', error);
    auditTrail.log('relationship:conversations:get:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Generate a conversation continuity prompt based on relationship and history.
 * @param {string} userId - User identifier
 * @returns {Promise<string>} Continuity prompt for conversation
 */
export async function generateContinuityPrompt(userId) {
  try {
    // Get relationship data and conversation history
    const relationshipData = await getRelationshipData(userId);
    const recentConversations = await getRecentConversations(userId, 3);
    
    // Start with appropriate greeting based on relationship stage
    let prompt = '';
    
    switch (relationshipData.stage) {
      case RELATIONSHIP_STAGES.TRUSTED:
        prompt = "Continuing our ongoing conversation. ";
        break;
      case RELATIONSHIP_STAGES.ESTABLISHED:
        prompt = "Based on our previous conversations, ";
        break;
      case RELATIONSHIP_STAGES.FAMILIAR:
        prompt = "Considering what we've discussed before, ";
        break;
      case RELATIONSHIP_STAGES.ACQUAINTANCE:
        prompt = "From our previous interaction, ";
        break;
      default:
        return ''; // No continuity prompt for initial stage
    }
    
    // Add recent conversation context if available
    if (recentConversations.length > 0) {
      const latestConversation = recentConversations[0];
      
      // Add time context
      const hoursSince = (Date.now() - latestConversation.timestamp) / (60 * 60 * 1000);
      
      if (hoursSince < 1) {
        prompt += "In our conversation just now, ";
      } else if (hoursSince < 24) {
        prompt += `In our conversation ${Math.round(hoursSince)} hours ago, `;
      } else {
        const daysSince = Math.round(hoursSince / 24);
        prompt += `In our conversation ${daysSince} days ago, `;
      }
      
      // Add topic context
      if (latestConversation.topics && latestConversation.topics.length > 0) {
        prompt += `we discussed ${latestConversation.topics.slice(0, 2).join(', ')}. `;
      }
      
      // Add key points if available
      if (latestConversation.keyPoints && latestConversation.keyPoints.length > 0) {
        prompt += "Key points included: " + 
                 latestConversation.keyPoints.slice(0, 2).join('; ') + ". ";
      }
    }
    
    // Add relationship-appropriate continuation
    switch (relationshipData.stage) {
      case RELATIONSHIP_STAGES.TRUSTED:
        prompt += "I'll continue with our established context and preferences.";
        break;
      case RELATIONSHIP_STAGES.ESTABLISHED:
        prompt += "I'll keep your preferences and our previous discussions in mind.";
        break;
      case RELATIONSHIP_STAGES.FAMILIAR:
        prompt += "I'll incorporate what I've learned about your preferences.";
        break;
      case RELATIONSHIP_STAGES.ACQUAINTANCE:
        prompt += "I'll build on what we've discussed so far.";
        break;
    }
    
    return prompt;
  } catch (error) {
    console.error('Error generating continuity prompt:', error);
    auditTrail.log('relationship:continuity:error', { userId, error: error.message });
    return '';
  }
}

/**
 * Get rapport building strategies based on relationship stage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Rapport strategies
 */
export async function getRapportStrategies(userId) {
  try {
    const relationshipData = await getRelationshipData(userId);
    
    // Default strategies
    const strategies = {
      personalReferences: false,
      sharedContext: false,
      emotionalResonance: false,
      selfDisclosure: false,
      humorLevel: 'minimal',
      formality: 'neutral'
    };
    
    // Adjust strategies based on relationship stage
    switch (relationshipData.stage) {
      case RELATIONSHIP_STAGES.TRUSTED:
        strategies.personalReferences = true;
        strategies.sharedContext = true;
        strategies.emotionalResonance = true;
        strategies.selfDisclosure = true;
        strategies.humorLevel = 'appropriate';
        strategies.formality = 'casual';
        break;
        
      case RELATIONSHIP_STAGES.ESTABLISHED:
        strategies.personalReferences = true;
        strategies.sharedContext = true;
        strategies.emotionalResonance = true;
        strategies.selfDisclosure = false;
        strategies.humorLevel = 'moderate';
        strategies.formality = 'casual';
        break;
        
      case RELATIONSHIP_STAGES.FAMILIAR:
        strategies.personalReferences = true;
        strategies.sharedContext = true;
        strategies.emotionalResonance = false;
        strategies.selfDisclosure = false;
        strategies.humorLevel = 'light';
        strategies.formality = 'semi-casual';
        break;
        
      case RELATIONSHIP_STAGES.ACQUAINTANCE:
        strategies.personalReferences = false;
        strategies.sharedContext = true;
        strategies.emotionalResonance = false;
        strategies.selfDisclosure = false;
        strategies.humorLevel = 'minimal';
        strategies.formality = 'semi-formal';
        break;
        
      default: // INITIAL
        strategies.personalReferences = false;
        strategies.sharedContext = false;
        strategies.emotionalResonance = false;
        strategies.selfDisclosure = false;
        strategies.humorLevel = 'none';
        strategies.formality = 'formal';
    }
    
    return strategies;
  } catch (error) {
    console.error('Error getting rapport strategies:', error);
    auditTrail.log('relationship:rapport:error', { userId, error: error.message });
    
    // Return default strategies on error
    return {
      personalReferences: false,
      sharedContext: false,
      emotionalResonance: false,
      selfDisclosure: false,
      humorLevel: 'minimal',
      formality: 'neutral'
    };
  }
}

/**
 * Load relationship data from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's relationship data
 */
async function loadRelationshipData(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${RELATIONSHIP_DATA_KEY}`
    );
  } catch (error) {
    console.error('Error loading relationship data:', error);
    return null;
  }
}

/**
 * Save relationship data to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} data - Relationship data to save
 * @returns {Promise<boolean>} Success status
 */
async function saveRelationshipData(userId, data) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${RELATIONSHIP_DATA_KEY}`,
      data
    );
  } catch (error) {
    console.error('Error saving relationship data:', error);
    return false;
  }
}

/**
 * Load conversation history from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User's conversation history
 */
async function loadConversationHistory(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${CONVERSATION_HISTORY_KEY}`
    ) || [];
  } catch (error) {
    console.error('Error loading conversation history:', error);
    return [];
  }
}

/**
 * Save conversation history to secure storage.
 * @param {string} userId - User identifier
 * @param {Array} history - Conversation history to save
 * @returns {Promise<boolean>} Success status
 */
async function saveConversationHistory(userId, history) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${CONVERSATION_HISTORY_KEY}`,
      history
    );
  } catch (error) {
    console.error('Error saving conversation history:', error);
    return false;
  }
}

/**
 * Initialize the relationship module by subscribing to events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    // Subscribe to conversation message events
    subscribe('conversation:message', async ({ userId, message, context }) => {
      // Determine interaction type
      let interactionType = INTERACTION_TYPES.CONVERSATION;
      
      if (message.includes('?')) {
        interactionType = INTERACTION_TYPES.QUERY;
      } else if (message.toLowerCase().startsWith('please') || 
                message.toLowerCase().includes('could you') ||
                message.toLowerCase().includes('would you')) {
        interactionType = INTERACTION_TYPES.INSTRUCTION;
      }
      
      // Update relationship based on interaction
      await updateRelationship(userId, {
        type: interactionType,
        timestamp: Date.now(),
        topic: context.topic
      });
    });
    
    // Subscribe to conversation end events
    subscribe('conversation:ended', async ({ userId, conversation }) => {
      // Record conversation summary
      await recordConversation(userId, conversation);
    });
    
    // Subscribe to user feedback events
    subscribe('user:feedback', async ({ userId, feedback, context }) => {
      // Update relationship based on feedback
      await updateRelationship(userId, {
        type: INTERACTION_TYPES.FEEDBACK,
        timestamp: Date.now(),
        feedback: {
          sentiment: feedback.sentiment || 0,
          satisfaction: feedback.satisfaction
        }
      });
    });
    
    // Subscribe to emotional state updates
    subscribe('emotional:state:updated', async ({ userId, dominantEmotion, context }) => {
      // Update relationship with emotional resonance data
      if (context.responseEmotionalMatch) {
        await updateRelationship(userId, {
          type: INTERACTION_TYPES.EMOTIONAL,
          timestamp: Date.now(),
          emotionalResonance: context.responseEmotionalMatch
        });
      }
    });
    
    // Subscribe to personal information sharing events
    subscribe('memory:personal:added', async ({ userId, entity, context }) => {
      // Update relationship when user shares personal information
      await updateRelationship(userId, {
        type: INTERACTION_TYPES.PERSONAL,
        timestamp: Date.now(),
        topic: entity.type
      });
    });
    
    publish('relationship:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing relationship module:', error);
    return false;
  }
}
