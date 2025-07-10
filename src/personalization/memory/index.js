/**
 * @file index.js
 * @description Memory system exports for ALEJO
 * 
 * This file exports the memory system components including:
 * - Short-term memory for temporary storage
 * - Memory curator for long-term storage
 * - Conversation memory bridge for linking conversation context with memory
 * - Entity tracker for identifying important entities
 * - Personal graph for relationship modeling
 */

import ShortTermMemory from './short-term-memory.js';
import * as MemoryCurator from './memory-curator.js';
import ConversationMemoryBridge from './conversation-memory-bridge.js';
import * as EntityTracker from './entity-tracker.js';
import * as PersonalGraph from './personal-graph.js';

// Export individual components
export { 
  ShortTermMemory,
  MemoryCurator,
  ConversationMemoryBridge,
  EntityTracker,
  PersonalGraph
};

// Export memory system initialization function
export async function initialize(options = {}) {
  const results = {
    shortTermMemory: false,
    memoryCurator: false,
    conversationBridge: false,
    entityTracker: false,
    personalGraph: false
  };

  // Initialize short-term memory
  try {
    results.shortTermMemory = await ShortTermMemory.initialize(options);
  } catch (error) {
    console.error('Failed to initialize short-term memory:', error);
  }

  // Initialize memory curator
  try {
    results.memoryCurator = await MemoryCurator.initialize(options);
  } catch (error) {
    console.error('Failed to initialize memory curator:', error);
  }

  // Initialize conversation memory bridge
  try {
    results.conversationBridge = await ConversationMemoryBridge.initialize({
      ...options,
      userId: options.userId || 'default-user'
    });
  } catch (error) {
    console.error('Failed to initialize conversation memory bridge:', error);
  }

  // Initialize entity tracker
  if (EntityTracker.initialize) {
    try {
      results.entityTracker = await EntityTracker.initialize(options);
    } catch (error) {
      console.error('Failed to initialize entity tracker:', error);
    }
  }

  // Initialize personal graph
  if (PersonalGraph.initialize) {
    try {
      results.personalGraph = await PersonalGraph.initialize(options);
    } catch (error) {
      console.error('Failed to initialize personal graph:', error);
    }
  }

  // Return initialization results
  return {
    success: Object.values(results).some(result => result === true),
    results
  };
}

// Export memory system shutdown function
export async function shutdown(options = {}) {
  const results = {
    shortTermMemory: false,
    memoryCurator: false,
    conversationBridge: false,
    entityTracker: false,
    personalGraph: false
  };

  // Shutdown in reverse initialization order
  
  // Shutdown personal graph
  if (PersonalGraph.shutdown) {
    try {
      results.personalGraph = await PersonalGraph.shutdown(options);
    } catch (error) {
      console.error('Failed to shutdown personal graph:', error);
    }
  }

  // Shutdown entity tracker
  if (EntityTracker.shutdown) {
    try {
      results.entityTracker = await EntityTracker.shutdown(options);
    } catch (error) {
      console.error('Failed to shutdown entity tracker:', error);
    }
  }

  // Shutdown conversation memory bridge
  try {
    results.conversationBridge = await ConversationMemoryBridge.shutdown(options);
  } catch (error) {
    console.error('Failed to shutdown conversation memory bridge:', error);
  }

  // Shutdown memory curator
  if (MemoryCurator.shutdown) {
    try {
      results.memoryCurator = await MemoryCurator.shutdown(options);
    } catch (error) {
      console.error('Failed to shutdown memory curator:', error);
    }
  }

  // Shutdown short-term memory
  try {
    results.shortTermMemory = await ShortTermMemory.shutdown({
      ...options,
      persistMemory: options.persistMemory !== false
    });
  } catch (error) {
    console.error('Failed to shutdown short-term memory:', error);
  }

  // Return shutdown results
  return {
    success: Object.values(results).some(result => result === true),
    results
  };
}

export default {
  initialize,
  shutdown,
  ShortTermMemory,
  MemoryCurator,
  ConversationMemoryBridge,
  EntityTracker,
  PersonalGraph
};
