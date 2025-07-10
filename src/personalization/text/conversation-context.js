/**
 * ALEJO Conversation Context Manager
 * 
 * Maintains conversation state and context across multiple turns.
 * Features:
 * - Context tracking for multi-turn conversations
 * - Reference resolution (pronouns, implied subjects)
 * - Conversation history management
 * - Context-based suggestion generation
 * - Memory integration for personalized responses
 * 
 * Follows ALEJO's core principles:
 * - Local-first: All context processing happens on device
 * - Privacy-respecting: No conversation data sent to external services
 * - Resource-efficient: Adaptive history length based on available resources
 * - Accessibility-first: Context aware of accessibility needs
 */

import { EventBus } from '../../core/event-bus.js';
import { getCurrentResourceMode } from './performance-integration.js';
import { ResourceMode } from '../../performance/resource-manager.js';
import { SecurityManager } from '../../security/index.js';

// Module state
let isInitialized = false;
let maxHistoryLength = 10; // Default history length
let conversationId = null;
const conversations = new Map(); // Store multiple conversations

// Default context structure
const DEFAULT_CONTEXT = {
  history: [],
  entities: new Map(), // Named entities referenced in conversation
  currentTopic: null,
  lastIntent: null,
  referenceMap: {}, // Map pronouns to their referents
  conversationStart: null,
  lastInteraction: null,
  turnCount: 0,
  unansweredQuestions: [], // Track questions that haven't been answered
  pendingFollowups: [] // Potential follow-up queries or topics
};

/**
 * Initialize the conversation context manager
 * @param {Object} options - Configuration options
 * @param {number} [options.maxHistoryLength] - Maximum conversation history length
 * @returns {Promise<boolean>} Initialization success
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    console.warn('Conversation context manager already initialized');
    return true;
  }

  console.log('Initializing ALEJO Conversation Context Manager');

  try {
    // Set history length based on options or resource mode
    maxHistoryLength = options.maxHistoryLength || getHistoryLengthForResourceMode();

    // Set up event listeners
    EventBus.subscribe('text:analyzed', handleTextAnalysis);
    EventBus.subscribe('conversation:reset', resetConversation);
    EventBus.subscribe('conversation:switch', switchConversation);

    // Create initial conversation
    createNewConversation();
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Conversation Context Manager:', error);
    return false;
  }
}

/**
 * Shutdown the conversation context manager
 */
export async function shutdown() {
  if (!isInitialized) return;

  console.log('Shutting down ALEJO Conversation Context Manager');

  // Unsubscribe from events
  EventBus.unsubscribe('text:analyzed', handleTextAnalysis);
  EventBus.unsubscribe('conversation:reset', resetConversation);
  EventBus.unsubscribe('conversation:switch', switchConversation);

  // Archive conversations if needed
  if (SecurityManager && typeof SecurityManager.archiveConversations === 'function') {
    try {
      await SecurityManager.archiveConversations(Array.from(conversations.values()));
    } catch (error) {
      console.error('Failed to archive conversations:', error);
    }
  }

  isInitialized = false;
}

/**
 * Get the current conversation context
 * @returns {Object} Current conversation context
 */
export function getCurrentContext() {
  if (!isInitialized || !conversationId || !conversations.has(conversationId)) {
    return null;
  }

  return structuredClone(conversations.get(conversationId));
}

/**
 * Add a message to the current conversation
 * @param {Object} message - Message to add
 * @param {string} message.text - Message text
 * @param {string} message.role - Message role ('user' or 'system')
 * @param {Object} [message.analysis] - Analysis results for the message
 * @param {number} [message.timestamp] - Message timestamp
 * @returns {Object} Updated context
 */
export function addMessage(message) {
  if (!isInitialized) {
    throw new Error('Conversation context manager not initialized');
  }

  if (!conversationId || !conversations.has(conversationId)) {
    createNewConversation();
  }

  const context = conversations.get(conversationId);
  const timestamp = message.timestamp || Date.now();

  // Create message object
  const messageObject = {
    id: generateMessageId(),
    text: message.text,
    role: message.role || 'user',
    timestamp,
    analysis: message.analysis || null
  };

  // Add to history
  context.history.push(messageObject);

  // Maintain max history length
  if (context.history.length > maxHistoryLength) {
    context.history.shift();
  }

  // Update context metadata
  context.lastInteraction = timestamp;
  context.turnCount++;
  
  // If this is a user message with analysis, update context based on analysis
  if (message.role === 'user' && message.analysis) {
    updateContextFromAnalysis(context, message.analysis);
  }

  // Save updated context
  conversations.set(conversationId, context);

  // Emit event for context update
  EventBus.publish('conversation:context:updated', {
    conversationId,
    context: structuredClone(context)
  });

  return structuredClone(context);
}

/**
 * Create a new conversation
 * @param {string} [id] - Optional conversation ID
 * @returns {string} New conversation ID
 */
export function createNewConversation(id = null) {
  const newId = id || generateConversationId();
  const now = Date.now();

  const newContext = {
    ...DEFAULT_CONTEXT,
    conversationStart: now,
    lastInteraction: now,
    history: []
  };

  conversations.set(newId, newContext);
  conversationId = newId;

  // Emit event for new conversation
  EventBus.publish('conversation:created', {
    conversationId: newId,
    timestamp: now
  });

  return newId;
}

/**
 * Reset the current conversation
 */
export function resetConversation() {
  if (!isInitialized) return;

  if (conversationId && conversations.has(conversationId)) {
    const archivedConversation = conversations.get(conversationId);
    
    // Archive the conversation if security manager is available
    if (SecurityManager && typeof SecurityManager.archiveConversation === 'function') {
      SecurityManager.archiveConversation(conversationId, archivedConversation);
    }
  }

  // Create new conversation with same ID
  createNewConversation(conversationId);
}

/**
 * Switch to another conversation
 * @param {string} id - Conversation ID to switch to
 * @returns {boolean} Success
 */
export function switchConversation(id) {
  if (!isInitialized) {
    throw new Error('Conversation context manager not initialized');
  }

  if (!id || !conversations.has(id)) {
    return false;
  }

  conversationId = id;
  
  // Emit event for context update
  EventBus.publish('conversation:context:updated', {
    conversationId,
    context: structuredClone(conversations.get(conversationId))
  });

  return true;
}

/**
 * Get all active conversations
 * @returns {Array} List of conversation IDs and summaries
 */
export function getConversations() {
  if (!isInitialized) {
    return [];
  }

  return Array.from(conversations.entries()).map(([id, context]) => {
    const lastMessage = context.history.length > 0
      ? context.history[context.history.length - 1].text
      : null;

    return {
      id,
      started: context.conversationStart,
      lastActivity: context.lastInteraction,
      messageCount: context.history.length,
      lastMessage
    };
  });
}

/**
 * Resolve references in text based on conversation context
 * @param {string} text - Text with references to resolve
 * @returns {Object} Resolution results
 */
export function resolveReferences(text) {
  if (!isInitialized || !conversationId || !conversations.has(conversationId)) {
    return { resolvedText: text, references: [] };
  }

  const context = conversations.get(conversationId);
  const references = [];
  
  // Simple pronoun resolution
  let resolvedText = text;
  
  // Map of pronouns to look for
  const pronounMap = {
    'it': null,
    'they': null,
    'them': null,
    'their': null,
    'this': null,
    'that': null,
    'these': null,
    'those': null,
    'he': null,
    'him': null,
    'his': null,
    'she': null,
    'her': null,
    'hers': null
  };
  
  // Check for pronouns in text
  const words = text.toLowerCase().split(/\s+/);
  const foundPronouns = words.filter(word => pronounMap.hasOwnProperty(word.replace(/[^\w]/g, '')));
  
  if (foundPronouns.length > 0) {
    // Get referents from context
    foundPronouns.forEach(pronoun => {
      const normalizedPronoun = pronoun.replace(/[^\w]/g, '');
      
      if (context.referenceMap[normalizedPronoun]) {
        references.push({
          pronoun: normalizedPronoun,
          referent: context.referenceMap[normalizedPronoun]
        });
      }
    });
  }
  
  return {
    resolvedText,
    references
  };
}

/**
 * Generate suggestions based on conversation context
 * @param {number} [count=3] - Number of suggestions to generate
 * @returns {Array} List of suggested responses or questions
 */
export function generateSuggestions(count = 3) {
  if (!isInitialized || !conversationId || !conversations.has(conversationId)) {
    return [];
  }

  const context = conversations.get(conversationId);
  const suggestions = [];

  // Check for unanswered questions
  if (context.unansweredQuestions.length > 0) {
    // Suggest answers to the most recent unanswered questions
    context.unansweredQuestions.slice(-2).forEach(question => {
      suggestions.push({
        type: 'answer',
        question,
        text: `About "${question.text.substring(0, 30)}..."`
      });
    });
  }

  // Check for pending follow-ups
  if (context.pendingFollowups.length > 0) {
    // Suggest follow-ups based on conversation
    context.pendingFollowups.slice(-3).forEach(followup => {
      suggestions.push({
        type: 'followup',
        text: followup
      });
    });
  }

  // If we have a current topic, suggest continuing the topic
  if (context.currentTopic) {
    suggestions.push({
      type: 'topic',
      topic: context.currentTopic,
      text: `Tell me more about ${context.currentTopic}`
    });
  }

  // Return the requested number of suggestions
  return suggestions.slice(0, count);
}

// --- Private helper functions ---

/**
 * Generate a unique conversation ID
 * @private
 * @returns {string} Unique ID
 */
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique message ID
 * @private
 * @returns {string} Unique ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Update context based on text analysis
 * @private
 * @param {Object} context - Conversation context
 * @param {Object} analysis - Text analysis results
 */
function updateContextFromAnalysis(context, analysis) {
  // Update last intent if available
  if (analysis.intents && analysis.intents.length > 0) {
    context.lastIntent = analysis.intents[0].intent;
  }

  // Update entities
  if (analysis.entities && analysis.entities.length > 0) {
    analysis.entities.forEach(entity => {
      context.entities.set(entity.value, {
        type: entity.type,
        value: entity.value,
        lastMentioned: Date.now()
      });
    });
  }

  // Check for questions
  const isQuestion = analysis.intents.some(intent => intent.intent === 'QUESTION');
  if (isQuestion) {
    context.unansweredQuestions.push({
      text: analysis.originalText,
      timestamp: Date.now()
    });

    // Limit unanswered questions list
    if (context.unansweredQuestions.length > 5) {
      context.unansweredQuestions.shift();
    }
  }

  // Update reference map for pronouns
  // Very simple approach: most recent entity becomes "it"
  if (analysis.entities && analysis.entities.length > 0) {
    const mostRecentEntity = analysis.entities[0];
    
    // Set different pronouns based on entity type
    if (mostRecentEntity.type === 'PERSON_NAME') {
      // Simplistic approach - would need more sophisticated gender determination in reality
      context.referenceMap['he'] = mostRecentEntity.value;
      context.referenceMap['him'] = mostRecentEntity.value;
      context.referenceMap['his'] = mostRecentEntity.value;
      context.referenceMap['she'] = mostRecentEntity.value;
      context.referenceMap['her'] = mostRecentEntity.value;
    } else {
      context.referenceMap['it'] = mostRecentEntity.value;
      context.referenceMap['this'] = mostRecentEntity.value;
      context.referenceMap['that'] = mostRecentEntity.value;
    }
  }

  // Extract current topic from key phrases or entities
  if (analysis.keyPhrases && analysis.keyPhrases.length > 0) {
    context.currentTopic = analysis.keyPhrases[0];
  } else if (analysis.entities && analysis.entities.length > 0) {
    context.currentTopic = analysis.entities[0].value;
  }

  // Generate potential follow-ups based on the analysis
  generatePotentialFollowups(context, analysis);
}

/**
 * Generate potential follow-up questions or topics
 * @private
 * @param {Object} context - Conversation context
 * @param {Object} analysis - Text analysis results
 */
function generatePotentialFollowups(context, analysis) {
  // Clear previous follow-ups when we detect a new topic
  if (context.currentTopic && context.history.length > 1) {
    const previousMessage = context.history[context.history.length - 2];
    if (previousMessage && previousMessage.analysis && 
        previousMessage.analysis.keyPhrases && 
        !previousMessage.analysis.keyPhrases.includes(context.currentTopic)) {
      context.pendingFollowups = [];
    }
  }

  // Generate follow-ups based on entities
  if (analysis.entities && analysis.entities.length > 0) {
    analysis.entities.forEach(entity => {
      if (entity.type === 'PERSON_NAME') {
        context.pendingFollowups.push(`Tell me more about ${entity.value}`);
      } else if (entity.type === 'LOCATION') {
        context.pendingFollowups.push(`What do you know about ${entity.value}?`);
      }
    });
  }

  // Generate follow-ups based on detected intents
  if (analysis.intents && analysis.intents.length > 0) {
    const intent = analysis.intents[0].intent;
    
    if (intent === 'INFORMATION') {
      context.pendingFollowups.push('Would you like to know more details?');
    } else if (intent === 'HELP') {
      context.pendingFollowups.push('Is there anything specific you need help with?');
    }
  }

  // Limit pending follow-ups
  if (context.pendingFollowups.length > 5) {
    // Keep only the most recent ones
    context.pendingFollowups = context.pendingFollowups.slice(-5);
  }
}

/**
 * Handle text analysis event
 * @private
 * @param {Object} data - Event data
 */
function handleTextAnalysis(data) {
  if (!data || !data.text || !data.analysis) return;
  
  // Add message with analysis to the current conversation
  addMessage({
    text: data.text,
    analysis: data.analysis,
    role: 'user',
    timestamp: data.analysis.timestamp
  });
}

/**
 * Get appropriate history length based on resource mode
 * @private
 * @returns {number} History length
 */
function getHistoryLengthForResourceMode() {
  const resourceMode = getCurrentResourceMode();
  
  switch (resourceMode) {
    case ResourceMode.LOW:
      return 5; // Minimal history in low resource mode
    case ResourceMode.CRITICAL:
      return 3; // Very minimal history in critical resource mode
    case ResourceMode.NORMAL:
      return 10; // Standard history length
    case ResourceMode.HIGH:
      return 20; // Extended history in high resource mode
    default:
      return 10;
  }
}

/**
 * Update the maximum history length
 * @param {number} length - New maximum history length
 */
export function setMaxHistoryLength(length) {
  if (typeof length !== 'number' || length < 1) {
    throw new Error('Invalid history length. Must be a positive number');
  }
  
  maxHistoryLength = length;
  console.log(`Conversation history length set to: ${length}`);
  
  // Trim existing conversations if needed
  conversations.forEach((context, id) => {
    if (context.history.length > maxHistoryLength) {
      context.history = context.history.slice(-maxHistoryLength);
      conversations.set(id, context);
    }
  });
}
