/**
 * @file conversation-memory-bridge.js
 * @description Bridges the conversation context manager with the short-term and long-term memory systems
 * 
 * This module provides integration between ALEJO's conversation handling and memory systems:
 * - Automatically persists conversation contexts to short-term memory
 * - Provides context retrieval from previous conversations
 * - Handles memory transitions between short-term and long-term storage
 * - Enables multi-session conversation continuity
 */

import { EventBus } from '../../core/event-bus.js';
import * as ConversationContext from '../text/conversation-context.js';
import * as ShortTermMemory from './short-term-memory.js';
import * as MemoryCurator from './memory-curator.js';
import { getResourceAllocationManager } from '../../performance/resource-allocation-manager.js';
import { logger } from '../../core/logging.js';

// Module state
let isInitialized = false;
let resourceManager = null;
let contextSyncInterval = null;
const CONTEXT_SYNC_INTERVAL = 30000; // 30 seconds

/**
 * Initialize the conversation memory bridge
 * @param {Object} options Configuration options
 * @param {string} [options.userId] User identifier
 * @param {number} [options.syncInterval] How often to sync conversation context (ms)
 * @returns {Promise<boolean>} Initialization success
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    return true;
  }
  
  try {
    logger.info('Initializing conversation memory bridge');
    
    // Get resource manager
    resourceManager = getResourceAllocationManager();
    
    // Initialize dependencies if needed
    if (!ShortTermMemory.isInitialized) {
      await ShortTermMemory.initialize({
        userId: options.userId
      });
    }
    
    if (!ConversationContext.isInitialized) {
      await ConversationContext.initialize();
    }
    
    // Set up context sync interval
    const syncInterval = options.syncInterval || CONTEXT_SYNC_INTERVAL;
    if (syncInterval > 0) {
      contextSyncInterval = setInterval(() => {
        syncConversationToMemory().catch(err => {
          logger.error('Error syncing conversation to memory:', err);
        });
      }, syncInterval);
    }
    
    // Subscribe to events
    EventBus.subscribe('conversation:message-added', handleMessageAdded);
    EventBus.subscribe('conversation:new-conversation', handleNewConversation);
    EventBus.subscribe('conversation:switched', handleConversationSwitched);
    EventBus.subscribe('memory:short-term:items-promoted', handleMemoryPromoted);
    
    isInitialized = true;
    EventBus.publish('memory:conversation-bridge:initialized', {});
    
    // Attempt to restore the most recent conversation
    restoreRecentConversation().catch(err => {
      logger.warn('Failed to restore recent conversation:', err);
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize conversation memory bridge:', error);
    return false;
  }
}

/**
 * Shutdown the conversation memory bridge
 * @returns {Promise<boolean>} Shutdown success
 */
export async function shutdown() {
  if (!isInitialized) {
    return true;
  }
  
  try {
    logger.info('Shutting down conversation memory bridge');
    
    // Clear intervals
    if (contextSyncInterval) {
      clearInterval(contextSyncInterval);
      contextSyncInterval = null;
    }
    
    // Unsubscribe from events
    EventBus.unsubscribe('conversation:message-added', handleMessageAdded);
    EventBus.unsubscribe('conversation:new-conversation', handleNewConversation);
    EventBus.unsubscribe('conversation:switched', handleConversationSwitched);
    EventBus.unsubscribe('memory:short-term:items-promoted', handleMemoryPromoted);
    
    // Final sync of conversation to memory
    await syncConversationToMemory();
    
    isInitialized = false;
    EventBus.publish('memory:conversation-bridge:shutdown', {});
    
    return true;
  } catch (error) {
    logger.error('Error shutting down conversation memory bridge:', error);
    return false;
  }
}

/**
 * Get conversation history by ID, searching both short-term and long-term memory
 * @param {string} conversationId Conversation ID to retrieve
 * @returns {Promise<Object>} Conversation context or null if not found
 */
export async function getConversationHistory(conversationId) {
  if (!isInitialized) {
    throw new Error('Conversation memory bridge not initialized');
  }
  
  try {
    // First try short-term memory
    const shortTermContext = await ShortTermMemory.retrieveConversationContext(conversationId);
    if (shortTermContext) {
      return shortTermContext;
    }
    
    // If not found, try long-term memory
    const memories = await MemoryCurator.retrieveMemories(ShortTermMemory.userId, {
      types: ['conversation'],
      entities: [conversationId],
      limit: 1
    });
    
    if (memories && memories.length > 0) {
      return memories[0].content;
    }
    
    return null;
  } catch (error) {
    logger.error(`Error retrieving conversation history for '${conversationId}':`, error);
    return null;
  }
}

/**
 * Find recent conversations across short-term and long-term memory
 * @param {Object} options Search options
 * @param {number} [options.limit=5] Maximum number of conversations to return
 * @param {number} [options.maxAgeDays=7] Maximum age of conversations in days
 * @returns {Promise<Array>} Array of conversation summaries
 */
export async function findRecentConversations(options = {}) {
  if (!isInitialized) {
    throw new Error('Conversation memory bridge not initialized');
  }
  
  const limit = options.limit || 5;
  const maxAgeDays = options.maxAgeDays || 7;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const minTimestamp = Date.now() - maxAgeMs;
  
  try {
    // Get current conversations from context manager
    const currentConversations = ConversationContext.getConversations();
    
    // Get conversations from short-term memory
    const shortTermConversations = [];
    const shortTermMemoryKeys = await ShortTermMemory.getAllKeys();
    
    for (const key of shortTermMemoryKeys) {
      if (key.startsWith('conversation:')) {
        const conversationId = key.substring(12); // Remove 'conversation:' prefix
        const context = await ShortTermMemory.retrieveMemory(key);
        
        if (context && context.lastInteraction > minTimestamp) {
          shortTermConversations.push({
            id: conversationId,
            lastInteraction: context.lastInteraction,
            turnCount: context.turnCount || 0,
            topic: context.currentTopic || null,
            source: 'short-term'
          });
        }
      }
    }
    
    // Get conversations from long-term memory
    const longTermConversations = await MemoryCurator.retrieveMemories(ShortTermMemory.userId, {
      types: ['conversation'],
      minTimestamp,
      limit: limit * 2,
      recent: true
    });
    
    const longTermMapped = longTermConversations.map(memory => ({
      id: memory.content.conversationId,
      lastInteraction: memory.content.lastInteraction,
      turnCount: memory.content.turnCount || 0,
      topic: memory.content.currentTopic || null,
      source: 'long-term',
      importance: memory.importance
    }));
    
    // Combine all sources and remove duplicates (preferring short-term versions)
    const allConversations = [
      ...currentConversations,
      ...shortTermConversations,
      ...longTermMapped
    ];
    
    // Remove duplicates (prefer current > short-term > long-term)
    const uniqueConversations = [];
    const seenIds = new Set();
    
    for (const conv of allConversations) {
      if (!seenIds.has(conv.id)) {
        uniqueConversations.push(conv);
        seenIds.add(conv.id);
      }
    }
    
    // Sort by recency and limit results
    uniqueConversations.sort((a, b) => b.lastInteraction - a.lastInteraction);
    return uniqueConversations.slice(0, limit);
  } catch (error) {
    logger.error('Error finding recent conversations:', error);
    return [];
  }
}

/**
 * Restore a previous conversation by ID
 * @param {string} conversationId Conversation ID to restore
 * @returns {Promise<boolean>} Success status
 */
export async function restoreConversation(conversationId) {
  if (!isInitialized) {
    throw new Error('Conversation memory bridge not initialized');
  }
  
  try {
    // Get the conversation history
    const context = await getConversationHistory(conversationId);
    if (!context) {
      logger.warn(`Conversation '${conversationId}' not found in memory`);
      return false;
    }
    
    // Create a new conversation with the same ID
    ConversationContext.createNewConversation(conversationId);
    
    // Restore history items (limited to prevent overwhelming the system)
    const historyLimit = getHistoryLimitForResourceMode();
    const historyToRestore = context.history.slice(-historyLimit);
    
    // Add each message to the conversation
    for (const message of historyToRestore) {
      await ConversationContext.addMessage(message);
    }
    
    // Update other context properties
    if (context.entities) {
      ConversationContext.updateEntities(context.entities);
    }
    
    if (context.currentTopic) {
      ConversationContext.setCurrentTopic(context.currentTopic);
    }
    
    EventBus.publish('memory:conversation:restored', {
      conversationId,
      messageCount: historyToRestore.length
    });
    
    return true;
  } catch (error) {
    logger.error(`Error restoring conversation '${conversationId}':`, error);
    return false;
  }
}

/**
 * Restore the most recent conversation
 * @returns {Promise<boolean>} Success status
 */
export async function restoreRecentConversation() {
  try {
    const recentConversations = await findRecentConversations({ limit: 1 });
    
    if (recentConversations.length === 0) {
      logger.info('No recent conversations found to restore');
      return false;
    }
    
    const mostRecent = recentConversations[0];
    return await restoreConversation(mostRecent.id);
  } catch (error) {
    logger.error('Error restoring recent conversation:', error);
    return false;
  }
}

// --- Event Handlers ---

/**
 * Handle message added event
 * @private
 * @param {Object} data Event data
 */
function handleMessageAdded(data) {
  if (!data || !data.message) return;
  
  // Sync the conversation to memory (don't await to avoid blocking)
  syncConversationToMemory().catch(err => {
    logger.error('Error syncing conversation after message added:', err);
  });
}

/**
 * Handle new conversation event
 * @private
 * @param {Object} data Event data
 */
function handleNewConversation(data) {
  if (!data || !data.conversationId) return;
  
  // When a new conversation starts, sync the previous one if it exists
  syncConversationToMemory().catch(err => {
    logger.error('Error syncing conversation after new conversation created:', err);
  });
}

/**
 * Handle conversation switched event
 * @private
 * @param {Object} data Event data
 */
function handleConversationSwitched(data) {
  if (!data || !data.from || !data.to) return;
  
  // When switching conversations, sync the previous one
  syncConversationToMemory(data.from).catch(err => {
    logger.error(`Error syncing conversation ${data.from} after switching:`, err);
  });
}

/**
 * Handle memory promoted event
 * @private
 * @param {Object} data Event data
 */
function handleMemoryPromoted(data) {
  // Memory was promoted to long-term storage
  // Nothing specific to do here, but we could log or track statistics
}

// --- Helper Functions ---

/**
 * Sync the current conversation to memory
 * @private
 * @param {string} [specificConversationId] Optional specific conversation ID to sync
 * @returns {Promise<boolean>} Success status
 */
async function syncConversationToMemory(specificConversationId) {
  try {
    const context = specificConversationId 
      ? ConversationContext.getConversationById(specificConversationId)
      : ConversationContext.getCurrentContext();
    
    if (!context) {
      return false;
    }
    
    // Store in short-term memory
    await ShortTermMemory.storeConversationContext({
      conversationId: context.conversationId
    });
    
    return true;
  } catch (error) {
    logger.error('Error syncing conversation to memory:', error);
    return false;
  }
}

/**
 * Get history limit based on current resource mode
 * @private
 * @returns {number} Maximum number of messages to restore
 */
function getHistoryLimitForResourceMode() {
  if (!resourceManager) {
    return 10; // Default fallback
  }
  
  const mode = resourceManager.getCurrentMode();
  
  switch (mode) {
    case 'minimal':
      return 5;
    case 'reduced':
      return 10;
    case 'normal':
      return 20;
    case 'extended':
      return 50;
    default:
      return 10;
  }
}

export default {
  initialize,
  shutdown,
  getConversationHistory,
  findRecentConversations,
  restoreConversation,
  restoreRecentConversation
};
