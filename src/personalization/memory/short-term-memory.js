/**
 * ALEJO Short-Term Memory System
 * 
 * Bridges conversation context with long-term memory storage to provide:
 * - Conversation persistence across sessions
 * - Short-term preference tracking
 * - Recent context retrieval for multi-session interactions
 * - Memory importance evaluation for potential long-term storage
 * 
 * Features:
 * - Local-first: All context and memory operations happen on device
 * - Privacy-respecting: Uses privacy-guard for sensitive data protection
 * - Resource-efficient: Adapts memory depth based on system resources
 * - Accessibility-first: Preserves context important for accessibility needs
 */

import { EventBus } from '../../core/event-bus.js';
import * as ConversationContext from '../text/conversation-context.js';
import * as MemoryCurator from './memory-curator.js';
import * as PrivacyGuard from '../../integration/security/privacy-guard.js';
import { getResourceAllocationManager } from '../../performance/resource-allocation-manager.js';

// Module state
let isInitialized = false;
let sessionId = null;
let userId = null;
let shortTermMemory = new Map();
let persistenceEnabled = true;
let sessionStartTime = null;
let resourceManager = null;
let memoryFlushInterval = null;
const MEMORY_FLUSH_INTERVAL = 60000; // 1 minute

// Memory importance thresholds
const IMPORTANCE_THRESHOLDS = {
  TRIVIAL: 1.0,    // Not worth remembering long-term
  LOW: 2.0,        // Might be worth remembering
  MEDIUM: 3.0,     // Should be remembered
  HIGH: 4.0,       // Important to remember
  CRITICAL: 5.0    // Must be remembered
};

/**
 * Initialize the short-term memory system
 * @param {Object} options Configuration options
 * @param {string} [options.userId] User identifier
 * @param {boolean} [options.persistenceEnabled=true] Whether to persist memory between sessions
 * @param {number} [options.flushInterval] How often to evaluate memories for long-term storage (ms)
 * @returns {Promise<boolean>} Initialization success
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    return true;
  }
  
  try {
    // Set configuration
    userId = options.userId || 'default-user';
    persistenceEnabled = options.persistenceEnabled !== false;
    const flushInterval = options.flushInterval || MEMORY_FLUSH_INTERVAL;
    
    // Get resource manager
    resourceManager = getResourceAllocationManager();
    
    // Create a new session
    sessionId = generateSessionId();
    sessionStartTime = Date.now();
    
    // Initialize dependencies if needed
    if (!ConversationContext.isInitialized) {
      await ConversationContext.initialize();
    }
    
    // Load persisted short-term memory if enabled
    if (persistenceEnabled) {
      await loadPersistedMemory();
    }
    
    // Set up memory evaluation interval
    if (flushInterval > 0) {
      memoryFlushInterval = setInterval(() => {
        evaluateMemoriesForLongTerm().catch(err => {
          console.error('Error evaluating memories for long-term storage:', err);
        });
      }, flushInterval);
    }
    
    // Subscribe to relevant events
    EventBus.subscribe('conversation:message-added', handleNewMessage);
    EventBus.subscribe('conversation:context-changed', handleContextChange);
    EventBus.subscribe('user:preference-updated', handlePreferenceUpdate);
    EventBus.subscribe('resources:mode-changed', handleResourceModeChange);
    
    isInitialized = true;
    EventBus.publish('memory:short-term:initialized', { sessionId });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize short-term memory system:', error);
    return false;
  }
}

/**
 * Shutdown the short-term memory system
 * @param {Object} options Shutdown options
 * @param {boolean} [options.persistMemory=true] Whether to persist memory before shutdown
 * @returns {Promise<boolean>} Shutdown success
 */
export async function shutdown(options = {}) {
  if (!isInitialized) {
    return true;
  }
  
  try {
    const persistMemory = options.persistMemory !== false;
    
    // Clear the memory evaluation interval
    if (memoryFlushInterval) {
      clearInterval(memoryFlushInterval);
      memoryFlushInterval = null;
    }
    
    // Unsubscribe from events
    EventBus.unsubscribe('conversation:message-added', handleNewMessage);
    EventBus.unsubscribe('conversation:context-changed', handleContextChange);
    EventBus.unsubscribe('user:preference-updated', handlePreferenceUpdate);
    EventBus.unsubscribe('resources:mode-changed', handleResourceModeChange);
    
    // Perform final evaluation of memories for long-term storage
    await evaluateMemoriesForLongTerm();
    
    // Persist memory before shutdown if enabled
    if (persistMemory && persistenceEnabled) {
      await persistShortTermMemory();
    }
    
    // Reset state
    shortTermMemory.clear();
    sessionId = null;
    isInitialized = false;
    
    EventBus.publish('memory:short-term:shutdown', { sessionEnd: Date.now() });
    
    return true;
  } catch (error) {
    console.error('Error during short-term memory shutdown:', error);
    return false;
  }
}

/**
 * Store a memory item in short-term memory
 * @param {string} key Memory key
 * @param {any} value Memory value
 * @param {Object} options Storage options
 * @param {number} [options.importance=IMPORTANCE_THRESHOLDS.LOW] Memory importance
 * @param {boolean} [options.encrypt=false] Whether to encrypt the value
 * @param {number} [options.expiresAt] Timestamp when this memory should expire
 * @returns {Promise<boolean>} Storage success
 */
export async function storeMemory(key, value, options = {}) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    const importance = options.importance || IMPORTANCE_THRESHOLDS.LOW;
    const timestamp = Date.now();
    const expiresAt = options.expiresAt || null;
    
    let storedValue = value;
    if (options.encrypt) {
      storedValue = await PrivacyGuard.encryptData(value);
    }
    
    const memoryItem = {
      key,
      value: storedValue,
      importance,
      timestamp,
      expiresAt,
      encrypted: options.encrypt === true,
      accessCount: 0,
      lastAccessed: null,
    };
    
    shortTermMemory.set(key, memoryItem);
    
    EventBus.publish('memory:short-term:item-stored', { key });
    
    return true;
  } catch (error) {
    console.error(`Error storing memory item '${key}':`, error);
    return false;
  }
}

/**
 * Retrieve a memory item from short-term memory
 * @param {string} key Memory key
 * @returns {Promise<any>} Memory value or null if not found
 */
export async function retrieveMemory(key) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    if (!shortTermMemory.has(key)) {
      return null;
    }
    
    const memoryItem = shortTermMemory.get(key);
    
    // Check if memory has expired
    if (memoryItem.expiresAt && memoryItem.expiresAt < Date.now()) {
      shortTermMemory.delete(key);
      EventBus.publish('memory:short-term:item-expired', { key });
      return null;
    }
    
    // Update access statistics
    memoryItem.accessCount++;
    memoryItem.lastAccessed = Date.now();
    shortTermMemory.set(key, memoryItem);
    
    // Decrypt if necessary
    let value = memoryItem.value;
    if (memoryItem.encrypted) {
      value = await PrivacyGuard.decryptData(value);
    }
    
    EventBus.publish('memory:short-term:item-accessed', { 
      key, 
      accessCount: memoryItem.accessCount 
    });
    
    return value;
  } catch (error) {
    console.error(`Error retrieving memory item '${key}':`, error);
    return null;
  }
}

/**
 * Store the current conversation context in short-term memory
 * @param {Object} options Storage options
 * @param {number} [options.importance] Override the calculated importance
 * @returns {Promise<boolean>} Storage success
 */
export async function storeConversationContext(options = {}) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    const context = ConversationContext.getCurrentContext();
    if (!context) {
      return false;
    }
    
    // Calculate importance based on conversation content
    const calculatedImportance = calculateConversationImportance(context);
    const importance = options.importance || calculatedImportance;
    
    // Store with conversation ID as key
    const key = `conversation:${context.conversationId}`;
    await storeMemory(key, context, {
      importance,
      encrypt: true,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 week expiry for conversations
    });
    
    return true;
  } catch (error) {
    console.error('Error storing conversation context:', error);
    return false;
  }
}

/**
 * Retrieve a conversation context by ID
 * @param {string} conversationId Conversation ID
 * @returns {Promise<Object>} Conversation context or null if not found
 */
export async function retrieveConversationContext(conversationId) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    const key = `conversation:${conversationId}`;
    return await retrieveMemory(key);
  } catch (error) {
    console.error(`Error retrieving conversation context '${conversationId}':`, error);
    return null;
  }
}

/**
 * Store user preference in short-term memory
 * @param {string} preferenceKey Preference key
 * @param {any} preferenceValue Preference value
 * @param {Object} options Storage options
 * @param {boolean} [options.sensitive=false] Whether this preference contains sensitive data
 * @returns {Promise<boolean>} Storage success
 */
export async function storePreference(preferenceKey, preferenceValue, options = {}) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    const key = `preference:${preferenceKey}`;
    const sensitive = options.sensitive === true;
    
    await storeMemory(key, preferenceValue, {
      importance: IMPORTANCE_THRESHOLDS.MEDIUM,
      encrypt: sensitive,
    });
    
    EventBus.publish('memory:preference:updated', { 
      key: preferenceKey,
      sensitive
    });
    
    return true;
  } catch (error) {
    console.error(`Error storing preference '${preferenceKey}':`, error);
    return false;
  }
}

/**
 * Retrieve user preference from short-term memory
 * @param {string} preferenceKey Preference key
 * @returns {Promise<any>} Preference value or null if not found
 */
export async function retrievePreference(preferenceKey) {
  if (!isInitialized) {
    throw new Error('Short-term memory system not initialized');
  }
  
  try {
    const key = `preference:${preferenceKey}`;
    return await retrieveMemory(key);
  } catch (error) {
    console.error(`Error retrieving preference '${preferenceKey}':`, error);
    return null;
  }
}

/**
 * Evaluate all memories for potential long-term storage
 * @returns {Promise<number>} Number of memories moved to long-term storage
 */
export async function evaluateMemoriesForLongTerm() {
  if (!isInitialized) {
    return 0;
  }
  
  try {
    let movedCount = 0;
    const now = Date.now();
    
    for (const [key, item] of shortTermMemory.entries()) {
      // Skip items that are too recent (less than 10 minutes old)
      if (now - item.timestamp < 10 * 60 * 1000) {
        continue;
      }
      
      // Evaluate importance and decide whether to move to long-term memory
      if (shouldMoveToLongTerm(item)) {
        // Decrypt first if needed
        let value = item.value;
        if (item.encrypted) {
          value = await PrivacyGuard.decryptData(value);
        }
        
        // Determine memory type based on key prefix
        const memoryType = getMemoryTypeFromKey(key);
        
        // Create memory in long-term storage
        await MemoryCurator.createMemory(userId, {
          type: memoryType,
          content: value,
          importance: item.importance,
          context: {
            sessionId,
            timestamp: item.timestamp,
            accessCount: item.accessCount,
            source: 'short-term-memory'
          }
        });
        
        movedCount++;
        
        // Delete from short-term memory if it's a conversation (to save space)
        // but keep preferences in short-term for quick access
        if (key.startsWith('conversation:')) {
          shortTermMemory.delete(key);
        }
      }
    }
    
    if (movedCount > 0) {
      EventBus.publish('memory:short-term:items-promoted', { 
        count: movedCount 
      });
    }
    
    return movedCount;
  } catch (error) {
    console.error('Error evaluating memories for long-term storage:', error);
    return 0;
  }
}

// --- Event handlers ---

/**
 * Handle new conversation messages
 * @private
 * @param {Object} data Event data
 */
function handleNewMessage(data) {
  if (!data || !data.message) return;
  
  // Store context after each message
  storeConversationContext().catch(err => {
    console.error('Error storing conversation context after new message:', err);
  });
  
  // Extract and store any preferences mentioned in the message
  extractPreferencesFromMessage(data.message).catch(err => {
    console.error('Error extracting preferences from message:', err);
  });
}

/**
 * Handle conversation context changes
 * @private
 * @param {Object} data Event data
 */
function handleContextChange(data) {
  // Store updated context
  storeConversationContext().catch(err => {
    console.error('Error storing conversation context after context change:', err);
  });
}

/**
 * Handle user preference updates
 * @private
 * @param {Object} data Event data
 */
function handlePreferenceUpdate(data) {
  if (!data || !data.key || data.value === undefined) return;
  
  storePreference(data.key, data.value, {
    sensitive: data.sensitive === true
  }).catch(err => {
    console.error(`Error storing updated preference '${data.key}':`, err);
  });
}

/**
 * Handle resource mode changes
 * @private
 * @param {Object} data Event data
 */
function handleResourceModeChange(data) {
  if (!data || !data.mode) return;
  
  // Adjust memory retention based on available resources
  adjustMemoryRetentionForResourceMode(data.mode).catch(err => {
    console.error('Error adjusting memory retention for resource mode:', err);
  });
}

// --- Helper functions ---

/**
 * Generate a unique session ID
 * @private
 * @returns {string} Unique session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Calculate importance of a conversation context
 * @private
 * @param {Object} context Conversation context
 * @returns {number} Importance score
 */
function calculateConversationImportance(context) {
  if (!context || !context.history || context.history.length === 0) {
    return IMPORTANCE_THRESHOLDS.TRIVIAL;
  }
  
  // Factors that increase importance:
  // 1. Number of turns (longer conversations are more important)
  // 2. Presence of questions or explicit preferences
  // 3. Recent activity (more recent conversations are more important)
  
  let importance = IMPORTANCE_THRESHOLDS.LOW;
  
  // Adjust based on conversation length
  if (context.history.length >= 10) {
    importance += 1.0;
  } else if (context.history.length >= 5) {
    importance += 0.5;
  }
  
  // Adjust based on unanswered questions
  if (context.unansweredQuestions && context.unansweredQuestions.length > 0) {
    importance += 0.5;
  }
  
  // Adjust based on pending followups
  if (context.pendingFollowups && context.pendingFollowups.length > 0) {
    importance += 0.5;
  }
  
  // Adjust based on recency
  const now = Date.now();
  if (context.lastInteraction && now - context.lastInteraction < 60 * 60 * 1000) {
    // If interaction was within the last hour
    importance += 0.5;
  }
  
  return Math.min(importance, IMPORTANCE_THRESHOLDS.CRITICAL);
}

/**
 * Determine if a memory should be moved to long-term storage
 * @private
 * @param {Object} memoryItem Memory item
 * @returns {boolean} Whether to move to long-term storage
 */
function shouldMoveToLongTerm(memoryItem) {
  if (!memoryItem) return false;
  
  // Always move high and critical importance memories
  if (memoryItem.importance >= IMPORTANCE_THRESHOLDS.HIGH) {
    return true;
  }
  
  // Never move trivial memories
  if (memoryItem.importance <= IMPORTANCE_THRESHOLDS.TRIVIAL) {
    return false;
  }
  
  // Consider access frequency for medium importance
  if (memoryItem.importance >= IMPORTANCE_THRESHOLDS.MEDIUM && 
      memoryItem.accessCount >= 3) {
    return true;
  }
  
  // Consider age for low and medium importance
  const age = Date.now() - memoryItem.timestamp;
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (memoryItem.importance >= IMPORTANCE_THRESHOLDS.MEDIUM && 
      age >= 2 * oneDayMs) {
    // Medium importance and older than 2 days
    return true;
  }
  
  if (memoryItem.importance >= IMPORTANCE_THRESHOLDS.LOW && 
      age >= 5 * oneDayMs && 
      memoryItem.accessCount >= 2) {
    // Low importance, older than 5 days, accessed at least twice
    return true;
  }
  
  return false;
}

/**
 * Extract memory type from key
 * @private
 * @param {string} key Memory key
 * @returns {string} Memory type
 */
function getMemoryTypeFromKey(key) {
  if (key.startsWith('conversation:')) {
    return 'conversation';
  } else if (key.startsWith('preference:')) {
    return 'preference';
  } else if (key.startsWith('entity:')) {
    return 'entity';
  }
  return 'general';
}

/**
 * Extract preferences from a message
 * @private
 * @param {Object} message Message object
 * @returns {Promise<number>} Number of preferences extracted
 */
async function extractPreferencesFromMessage(message) {
  if (!message || !message.text) {
    return 0;
  }
  
  // This is a simplified implementation
  // In a production system, this would use NLP to identify preferences
  
  const text = message.text.toLowerCase();
  let count = 0;
  
  // Simple pattern matching for explicit preferences
  const preferencePatterns = [
    { pattern: /i (like|love|prefer|enjoy) ([\w\s]+)/i, type: 'like' },
    { pattern: /i (dislike|hate|don't like|do not like) ([\w\s]+)/i, type: 'dislike' },
    { pattern: /my favorite ([\w\s]+) is ([\w\s]+)/i, type: 'favorite' },
  ];
  
  for (const { pattern, type } of preferencePatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[2].trim();
      const key = `${type}:${value.replace(/\s+/g, '-')}`;
      
      await storePreference(key, {
        type,
        value,
        confidence: 0.7,
        source: 'conversation-extraction'
      });
      
      count++;
    }
  }
  
  return count;
}

/**
 * Adjust memory retention based on available resources
 * @private
 * @param {string} mode Resource mode
 * @returns {Promise<number>} Number of items pruned
 */
async function adjustMemoryRetentionForResourceMode(mode) {
  if (shortTermMemory.size === 0) {
    return 0;
  }
  
  // Define retention policies for different resource modes
  const retentionPolicies = {
    'minimal': {
      maxItems: 10,
      maxAgeMs: 1 * 60 * 60 * 1000, // 1 hour
      minImportance: IMPORTANCE_THRESHOLDS.HIGH
    },
    'reduced': {
      maxItems: 50,
      maxAgeMs: 24 * 60 * 60 * 1000, // 1 day
      minImportance: IMPORTANCE_THRESHOLDS.MEDIUM
    },
    'normal': {
      maxItems: 200,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 1 week
      minImportance: IMPORTANCE_THRESHOLDS.LOW
    },
    'extended': {
      maxItems: 1000,
      maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      minImportance: IMPORTANCE_THRESHOLDS.TRIVIAL
    }
  };
  
  const policy = retentionPolicies[mode] || retentionPolicies.normal;
  
  // First try to move important items to long-term storage
  await evaluateMemoriesForLongTerm();
  
  // Then prune items based on policy
  let prunedCount = 0;
  const now = Date.now();
  
  // Items to delete (we collect first, then delete to avoid modifying during iteration)
  const itemsToDelete = [];
  
  // First identify items that don't meet minimum importance threshold
  for (const [key, item] of shortTermMemory.entries()) {
    if (item.importance < policy.minImportance) {
      itemsToDelete.push(key);
      continue;
    }
    
    // Check age
    if (now - item.timestamp > policy.maxAgeMs) {
      itemsToDelete.push(key);
      continue;
    }
  }
  
  // If we still have too many items, remove oldest items
  if (shortTermMemory.size - itemsToDelete.length > policy.maxItems) {
    // Sort remaining items by timestamp (oldest first)
    const remainingItems = Array.from(shortTermMemory.entries())
      .filter(([key]) => !itemsToDelete.includes(key))
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Add oldest items to the delete list
    const excessCount = (shortTermMemory.size - itemsToDelete.length) - policy.maxItems;
    for (let i = 0; i < excessCount && i < remainingItems.length; i++) {
      itemsToDelete.push(remainingItems[i][0]);
    }
  }
  
  // Delete the identified items
  for (const key of itemsToDelete) {
    shortTermMemory.delete(key);
    prunedCount++;
  }
  
  if (prunedCount > 0) {
    EventBus.publish('memory:short-term:items-pruned', {
      count: prunedCount,
      mode,
      remaining: shortTermMemory.size
    });
  }
  
  return prunedCount;
}

/**
 * Load persisted short-term memory from storage
 * @private
 * @returns {Promise<boolean>} Success status
 */
async function loadPersistedMemory() {
  try {
    const key = `short-term-memory:${userId}`;
    
    // Try to get encrypted data from localStorage
    const encryptedData = localStorage.getItem(key);
    if (!encryptedData) {
      return false;
    }
    
    // Decrypt the data
    const memoryData = await PrivacyGuard.decryptData(encryptedData);
    
    // Restore memory items
    if (memoryData && Array.isArray(memoryData.items)) {
      for (const item of memoryData.items) {
        if (item && item.key) {
          shortTermMemory.set(item.key, item);
        }
      }
    }
    
    EventBus.publish('memory:short-term:loaded', {
      itemCount: shortTermMemory.size
    });
    
    return true;
  } catch (error) {
    console.error('Error loading persisted short-term memory:', error);
    return false;
  }
}

/**
 * Persist short-term memory to storage
 * @private
 * @returns {Promise<boolean>} Success status
 */
async function persistShortTermMemory() {
  try {
    if (shortTermMemory.size === 0) {
      return true;
    }
    
    const key = `short-term-memory:${userId}`;
    const memoryData = {
      items: Array.from(shortTermMemory.values()),
      timestamp: Date.now(),
      sessionId
    };
    
    // Encrypt the data
    const encryptedData = await PrivacyGuard.encryptData(memoryData);
    
    // Store in localStorage
    localStorage.setItem(key, encryptedData);
    
    EventBus.publish('memory:short-term:persisted', {
      itemCount: shortTermMemory.size
    });
    
    return true;
  } catch (error) {
    console.error('Error persisting short-term memory:', error);
    return false;
  }
}

export default {
  initialize,
  shutdown,
  storeMemory,
  retrieveMemory,
  storeConversationContext,
  retrieveConversationContext,
  storePreference,
  retrievePreference,
  evaluateMemoriesForLongTerm
};
