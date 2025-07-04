/**
 * memory-curator.js
 * 
 * Long-term relationship memory building and autobiographical memory timeline for ALEJO.
 * 
 * Features:
 * - Persistent memory storage with temporal organization
 * - Memory importance weighting and retrieval
 * - Contextual memory associations
 * - Memory consolidation and summarization
 * - Secure integration with privacy-guard.js
 * - Event-driven memory creation and retrieval
 */
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';
import { getNode, getEdges, upsertNode, addEdge } from './personal-graph.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'memory:';
const MEMORY_TIMELINE_KEY = 'timeline';
const MEMORY_IMPORTANCE_KEY = 'importance';

// Memory types
const MEMORY_TYPES = {
  CONVERSATION: 'conversation',
  EVENT: 'event',
  PREFERENCE: 'preference',
  RELATIONSHIP: 'relationship',
  ACHIEVEMENT: 'achievement',
  MILESTONE: 'milestone'
};

// Importance levels
const IMPORTANCE_LEVELS = {
  CRITICAL: 5,   // Life-changing events, core identity information
  HIGH: 4,       // Significant personal details, strong preferences
  MEDIUM: 3,     // Regular interactions, stated preferences
  LOW: 2,        // Casual mentions, implied preferences
  TRIVIAL: 1     // Background details, may be forgotten
};

// In-memory cache of user memories
const userMemories = new Map(); // userId -> array of memories
const userMemoryIndex = new Map(); // userId -> { entityId -> [memoryIds] }
const userMemoryImportance = new Map(); // userId -> { memoryId -> importance }

/**
 * Create a new memory for a user.
 * @param {string} userId - User identifier
 * @param {string} type - Memory type from MEMORY_TYPES
 * @param {Object} content - Memory content
 * @param {Object} context - Optional context information
 * @param {number} importance - Importance level from IMPORTANCE_LEVELS
 * @returns {Promise<string>} Memory ID
 */
export async function createMemory(userId, type, content, context = {}, importance = IMPORTANCE_LEVELS.MEDIUM) {
  try {
    // Generate a unique memory ID
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Create memory object
    const memory = {
      id: memoryId,
      type,
      content,
      context,
      created: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      source: context.source || 'direct',
      entities: extractEntities(content, context)
    };
    
    // Initialize user memory structures if needed
    if (!userMemories.has(userId)) {
      userMemories.set(userId, await loadUserMemories(userId) || []);
      userMemoryIndex.set(userId, {});
      userMemoryImportance.set(userId, await loadMemoryImportance(userId) || {});
    }
    
    // Add to in-memory cache
    const memories = userMemories.get(userId);
    memories.push(memory);
    
    // Update memory index for each entity
    const index = userMemoryIndex.get(userId);
    memory.entities.forEach(entity => {
      if (!index[entity]) {
        index[entity] = [];
      }
      index[entity].push(memoryId);
      
      // Create relationship between user and entity in personal graph
      upsertNode(entity, 'entity', { lastMentioned: Date.now() });
      addEdge(userId, entity, 'remembers');
    });
    
    // Set memory importance
    const importanceMap = userMemoryImportance.get(userId);
    importanceMap[memoryId] = importance;
    
    // Save to secure storage
    await saveUserMemories(userId, memories);
    await saveMemoryImportance(userId, importanceMap);
    
    // Log memory creation
    auditTrail.log('memory:created', {
      userId,
      memoryId,
      type,
      importance,
      entityCount: memory.entities.length
    });
    
    // Publish memory creation event
    publish('memory:created', {
      userId,
      memoryId,
      type,
      importance
    });
    
    return memoryId;
  } catch (error) {
    console.error('Error creating memory:', error);
    auditTrail.log('memory:creation:error', { userId, error: error.message });
    throw error;
  }
}

/**
 * Retrieve memories for a user based on various filters.
 * @param {string} userId - User identifier
 * @param {Object} options - Retrieval options
 * @param {string[]} [options.types] - Memory types to include
 * @param {string[]} [options.entities] - Entities to filter by
 * @param {number} [options.minImportance] - Minimum importance level
 * @param {number} [options.limit] - Maximum number of memories to return
 * @param {boolean} [options.recent] - Sort by recency (true) or importance (false)
 * @returns {Promise<Array>} Matching memories
 */
export async function retrieveMemories(userId, options = {}) {
  try {
    // Load memories if not in cache
    if (!userMemories.has(userId)) {
      userMemories.set(userId, await loadUserMemories(userId) || []);
      userMemoryImportance.set(userId, await loadMemoryImportance(userId) || {});
    }
    
    const memories = userMemories.get(userId);
    const importanceMap = userMemoryImportance.get(userId);
    
    // Start with all memories
    let result = [...memories];
    
    // Apply type filter
    if (options.types && options.types.length > 0) {
      result = result.filter(memory => options.types.includes(memory.type));
    }
    
    // Apply entity filter
    if (options.entities && options.entities.length > 0) {
      result = result.filter(memory => 
        options.entities.some(entity => memory.entities.includes(entity))
      );
    }
    
    // Apply importance filter
    if (typeof options.minImportance === 'number') {
      result = result.filter(memory => 
        (importanceMap[memory.id] || IMPORTANCE_LEVELS.MEDIUM) >= options.minImportance
      );
    }
    
    // Sort by recency or importance
    if (options.recent) {
      result.sort((a, b) => b.created - a.created);
    } else {
      result.sort((a, b) => 
        (importanceMap[b.id] || IMPORTANCE_LEVELS.MEDIUM) - 
        (importanceMap[a.id] || IMPORTANCE_LEVELS.MEDIUM)
      );
    }
    
    // Apply limit
    if (typeof options.limit === 'number' && options.limit > 0) {
      result = result.slice(0, options.limit);
    }
    
    // Update access information for retrieved memories
    const now = Date.now();
    result.forEach(memory => {
      memory.lastAccessed = now;
      memory.accessCount += 1;
    });
    
    // Save updated access information
    await saveUserMemories(userId, memories);
    
    // Log memory retrieval
    auditTrail.log('memory:retrieved', {
      userId,
      count: result.length,
      filters: { ...options }
    });
    
    return result;
  } catch (error) {
    console.error('Error retrieving memories:', error);
    auditTrail.log('memory:retrieval:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Update memory importance.
 * @param {string} userId - User identifier
 * @param {string} memoryId - Memory identifier
 * @param {number} importance - New importance level
 * @returns {Promise<boolean>} Success status
 */
export async function updateMemoryImportance(userId, memoryId, importance) {
  try {
    // Load importance map if not in cache
    if (!userMemoryImportance.has(userId)) {
      userMemoryImportance.set(userId, await loadMemoryImportance(userId) || {});
    }
    
    const importanceMap = userMemoryImportance.get(userId);
    
    // Update importance
    importanceMap[memoryId] = importance;
    
    // Save to secure storage
    await saveMemoryImportance(userId, importanceMap);
    
    // Log importance update
    auditTrail.log('memory:importance:updated', {
      userId,
      memoryId,
      importance
    });
    
    return true;
  } catch (error) {
    console.error('Error updating memory importance:', error);
    auditTrail.log('memory:importance:update:error', { userId, memoryId, error: error.message });
    return false;
  }
}

/**
 * Generate a memory timeline for a user.
 * @param {string} userId - User identifier
 * @param {Object} options - Timeline options
 * @param {number} [options.startTime] - Start timestamp
 * @param {number} [options.endTime] - End timestamp
 * @param {string[]} [options.types] - Memory types to include
 * @param {number} [options.minImportance] - Minimum importance level
 * @returns {Promise<Array>} Timeline entries
 */
export async function generateTimeline(userId, options = {}) {
  try {
    const memories = await retrieveMemories(userId, {
      types: options.types,
      minImportance: options.minImportance,
      recent: true
    });
    
    // Filter by time range
    let timeline = memories;
    if (options.startTime) {
      timeline = timeline.filter(memory => memory.created >= options.startTime);
    }
    if (options.endTime) {
      timeline = timeline.filter(memory => memory.created <= options.endTime);
    }
    
    // Group by day for timeline view
    const groupedByDay = timeline.reduce((groups, memory) => {
      const date = new Date(memory.created).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(memory);
      return groups;
    }, {});
    
    // Convert to array of day entries
    const result = Object.entries(groupedByDay).map(([date, memories]) => ({
      date,
      memories: memories.sort((a, b) => a.created - b.created)
    }));
    
    // Sort by date
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return result;
  } catch (error) {
    console.error('Error generating timeline:', error);
    auditTrail.log('memory:timeline:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Generate a summary of memories related to a specific entity.
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @returns {Promise<Object>} Entity memory summary
 */
export async function generateEntitySummary(userId, entityId) {
  try {
    // Get memories related to this entity
    const memories = await retrieveMemories(userId, {
      entities: [entityId]
    });
    
    if (memories.length === 0) {
      return null;
    }
    
    // Get entity node from personal graph
    const entityNode = getNode(entityId);
    const entityEdges = getEdges(entityId);
    
    // Count memory types
    const typeCounts = memories.reduce((counts, memory) => {
      counts[memory.type] = (counts[memory.type] || 0) + 1;
      return counts;
    }, {});
    
    // Find first and most recent memory
    const firstMemory = memories.reduce((earliest, memory) => 
      memory.created < earliest.created ? memory : earliest, memories[0]);
    
    const mostRecentMemory = memories.reduce((latest, memory) => 
      memory.created > latest.created ? memory : latest, memories[0]);
    
    // Calculate average importance
    const importanceMap = userMemoryImportance.get(userId) || {};
    const totalImportance = memories.reduce((sum, memory) => 
      sum + (importanceMap[memory.id] || IMPORTANCE_LEVELS.MEDIUM), 0);
    const averageImportance = totalImportance / memories.length;
    
    return {
      entityId,
      entityType: entityNode?.type || 'unknown',
      firstMentioned: firstMemory.created,
      lastMentioned: mostRecentMemory.created,
      memoryCount: memories.length,
      typeCounts,
      averageImportance,
      relationshipCount: entityEdges.length,
      topMemories: memories
        .sort((a, b) => (importanceMap[b.id] || 0) - (importanceMap[a.id] || 0))
        .slice(0, 3)
    };
  } catch (error) {
    console.error('Error generating entity summary:', error);
    auditTrail.log('memory:entity:summary:error', { userId, entityId, error: error.message });
    return null;
  }
}

/**
 * Extract entities from memory content and context.
 * @param {Object} content - Memory content
 * @param {Object} context - Memory context
 * @returns {Array<string>} Extracted entities
 */
function extractEntities(content, context) {
  const entities = new Set();
  
  // Extract from content text if it's a string
  if (typeof content === 'string') {
    // Extract people (simple regex for "FirstName LastName")
    const peopleMatches = content.match(/\b([A-Z][a-z]+\s[A-Z][a-z]+)\b/g) || [];
    peopleMatches.forEach(match => entities.add(match));
    
    // Extract places (simple regex for locations after "in" or "at")
    const placeMatches = content.match(/\b(in|at)\s([A-Z][a-z]+)\b/g) || [];
    placeMatches.forEach(match => {
      const place = match.split(/\s+/)[1];
      if (place) entities.add(place);
    });
    
    // Extract dates
    const dateMatches = content.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\b/g) || [];
    dateMatches.forEach(match => entities.add(match));
  }
  
  // Extract from structured content
  if (content && typeof content === 'object') {
    // Extract people
    if (content.people) {
      (Array.isArray(content.people) ? content.people : [content.people])
        .forEach(person => entities.add(person));
    }
    
    // Extract places
    if (content.places) {
      (Array.isArray(content.places) ? content.places : [content.places])
        .forEach(place => entities.add(place));
    }
    
    // Extract topics
    if (content.topics) {
      (Array.isArray(content.topics) ? content.topics : [content.topics])
        .forEach(topic => entities.add(topic));
    }
  }
  
  // Extract from context
  if (context) {
    if (context.entities && Array.isArray(context.entities)) {
      context.entities.forEach(entity => entities.add(entity));
    }
    
    if (context.location) {
      entities.add(context.location);
    }
    
    if (context.topic) {
      entities.add(context.topic);
    }
  }
  
  return Array.from(entities);
}

/**
 * Consolidate memories by merging similar ones and removing duplicates.
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Number of consolidated memories
 */
export async function consolidateMemories(userId) {
  try {
    // Load memories if not in cache
    if (!userMemories.has(userId)) {
      userMemories.set(userId, await loadUserMemories(userId) || []);
      userMemoryImportance.set(userId, await loadMemoryImportance(userId) || {});
    }
    
    const memories = userMemories.get(userId);
    const importanceMap = userMemoryImportance.get(userId);
    
    // Group similar memories (same type and entities with close timestamps)
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < memories.length; i++) {
      if (processed.has(i)) continue;
      
      const memory = memories[i];
      const group = [i];
      processed.add(i);
      
      // Find similar memories
      for (let j = i + 1; j < memories.length; j++) {
        if (processed.has(j)) continue;
        
        const otherMemory = memories[j];
        
        // Check if memories are similar
        if (memory.type === otherMemory.type &&
            Math.abs(memory.created - otherMemory.created) < 3600000 && // Within 1 hour
            hasCommonEntities(memory.entities, otherMemory.entities)) {
          group.push(j);
          processed.add(j);
        }
      }
      
      if (group.length > 1) {
        groups.push(group);
      }
    }
    
    // Merge similar memory groups
    let consolidatedCount = 0;
    
    for (const group of groups) {
      // Skip single-memory groups
      if (group.length <= 1) continue;
      
      // Get memories in this group
      const groupMemories = group.map(index => memories[index]);
      
      // Create a consolidated memory
      const primaryIndex = group[0];
      const primaryMemory = memories[primaryIndex];
      
      // Merge entities
      const allEntities = new Set();
      groupMemories.forEach(memory => {
        memory.entities.forEach(entity => allEntities.add(entity));
      });
      
      // Update primary memory
      primaryMemory.entities = Array.from(allEntities);
      primaryMemory.consolidated = true;
      primaryMemory.consolidatedFrom = group.slice(1).map(index => memories[index].id);
      
      // Find highest importance in the group
      const highestImportance = Math.max(
        ...group.map(index => importanceMap[memories[index].id] || IMPORTANCE_LEVELS.MEDIUM)
      );
      
      // Update importance of consolidated memory
      importanceMap[primaryMemory.id] = highestImportance;
      
      // Remove other memories in the group (except primary)
      for (let i = 1; i < group.length; i++) {
        const index = group[i];
        const memoryId = memories[index].id;
        
        // Mark as removed but keep in array (will be filtered on save)
        memories[index].removed = true;
        memories[index].consolidatedInto = primaryMemory.id;
        
        // Remove from importance map
        delete importanceMap[memoryId];
        
        consolidatedCount++;
      }
    }
    
    // Filter out removed memories
    const updatedMemories = memories.filter(memory => !memory.removed);
    
    // Save consolidated memories
    if (consolidatedCount > 0) {
      await saveUserMemories(userId, updatedMemories);
      await saveMemoryImportance(userId, importanceMap);
      
      // Update in-memory cache
      userMemories.set(userId, updatedMemories);
      
      // Log consolidation
      auditTrail.log('memory:consolidated', {
        userId,
        consolidatedCount,
        remainingCount: updatedMemories.length
      });
    }
    
    return consolidatedCount;
  } catch (error) {
    console.error('Error consolidating memories:', error);
    auditTrail.log('memory:consolidation:error', { userId, error: error.message });
    return 0;
  }
}

/**
 * Check if two entity arrays have common elements.
 * @param {Array} entities1 - First entity array
 * @param {Array} entities2 - Second entity array
 * @returns {boolean} True if arrays have common elements
 */
function hasCommonEntities(entities1, entities2) {
  return entities1.some(entity => entities2.includes(entity));
}

/**
 * Load user memories from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User memories
 */
async function loadUserMemories(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MEMORY_TIMELINE_KEY}`
    ) || [];
  } catch (error) {
    console.error('Error loading user memories:', error);
    return [];
  }
}

/**
 * Save user memories to secure storage.
 * @param {string} userId - User identifier
 * @param {Array} memories - User memories
 * @returns {Promise<boolean>} Success status
 */
async function saveUserMemories(userId, memories) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MEMORY_TIMELINE_KEY}`,
      memories
    );
  } catch (error) {
    console.error('Error saving user memories:', error);
    return false;
  }
}

/**
 * Load memory importance from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Memory importance map
 */
async function loadMemoryImportance(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MEMORY_IMPORTANCE_KEY}`
    ) || {};
  } catch (error) {
    console.error('Error loading memory importance:', error);
    return {};
  }
}

/**
 * Save memory importance to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} importanceMap - Memory importance map
 * @returns {Promise<boolean>} Success status
 */
async function saveMemoryImportance(userId, importanceMap) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MEMORY_IMPORTANCE_KEY}`,
      importanceMap
    );
  } catch (error) {
    console.error('Error saving memory importance:', error);
    return false;
  }
}

/**
 * Initialize the memory curator by subscribing to events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    // Subscribe to conversation events to create memories
    subscribe('conversation:message', async ({ userId, message, context }) => {
      // Create a conversation memory
      await createMemory(
        userId,
        MEMORY_TYPES.CONVERSATION,
        message,
        { ...context, source: 'conversation' },
        IMPORTANCE_LEVELS.LOW // Default importance for conversations
      );
    });
    
    // Subscribe to user preference events
    subscribe('user:preference:updated', async ({ userId, preference, value }) => {
      // Create a preference memory
      await createMemory(
        userId,
        MEMORY_TYPES.PREFERENCE,
        { preference, value },
        { source: 'preference' },
        IMPORTANCE_LEVELS.MEDIUM
      );
    });
    
    // Subscribe to relationship events
    subscribe('memory:edge-added', async ({ from, to, relation }) => {
      if (relation === 'knows' || relation === 'visited') {
        // Create a relationship memory
        await createMemory(
          from,
          MEMORY_TYPES.RELATIONSHIP,
          { entity: to, relation },
          { source: 'relationship' },
          IMPORTANCE_LEVELS.MEDIUM
        );
      }
    });
    
    // Subscribe to milestone events
    subscribe('user:milestone', async ({ userId, milestone, details }) => {
      // Create a milestone memory
      await createMemory(
        userId,
        MEMORY_TYPES.MILESTONE,
        { milestone, ...details },
        { source: 'milestone' },
        IMPORTANCE_LEVELS.HIGH
      );
    });
    
    // Schedule periodic memory consolidation
    setInterval(async () => {
      // Get all users with memories
      const userIds = Array.from(userMemories.keys());
      
      // Consolidate memories for each user
      for (const userId of userIds) {
        await consolidateMemories(userId);
      }
    }, 24 * 60 * 60 * 1000); // Run once per day
    
    publish('memory:curator:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing memory curator:', error);
    return false;
  }
}
