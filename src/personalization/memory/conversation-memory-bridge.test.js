/**
 * @file conversation-memory-bridge.test.js
 * @description Integration tests for the conversation memory bridge
 */

import * as ConversationMemoryBridge from './conversation-memory-bridge.js';
import * as ConversationContext from '../text/conversation-context.js';
import * as ShortTermMemory from './short-term-memory.js';
import * as MemoryCurator from './memory-curator.js';
import { EventBus } from '../../core/event-bus.js';
import { getResourceAllocationManager } from '../../performance/resource-allocation-manager.js';

// Mock dependencies
jest.mock('../text/conversation-context.js');
jest.mock('./short-term-memory.js');
jest.mock('./memory-curator.js');
jest.mock('../../core/event-bus.js');
jest.mock('../../performance/resource-allocation-manager.js');
jest.mock('../../core/logging.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Conversation Memory Bridge', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock EventBus
    EventBus.subscribe = jest.fn();
    EventBus.unsubscribe = jest.fn();
    EventBus.publish = jest.fn();
    
    // Mock ShortTermMemory
    ShortTermMemory.initialize = jest.fn().mockResolvedValue(true);
    ShortTermMemory.shutdown = jest.fn().mockResolvedValue(true);
    ShortTermMemory.isInitialized = true;
    ShortTermMemory.storeConversationContext = jest.fn().mockResolvedValue(true);
    ShortTermMemory.retrieveConversationContext = jest.fn().mockImplementation(id => {
      if (id === 'test-conversation') {
        return Promise.resolve({
          conversationId: 'test-conversation',
          history: [
            { role: 'user', text: 'Hello' },
            { role: 'system', text: 'Hi there' }
          ],
          lastInteraction: Date.now() - 3600000, // 1 hour ago
          turnCount: 2,
          currentTopic: 'greeting'
        });
      }
      return Promise.resolve(null);
    });
    ShortTermMemory.getAllKeys = jest.fn().mockResolvedValue([
      'conversation:test-conversation',
      'preference:theme'
    ]);
    ShortTermMemory.retrieveMemory = jest.fn().mockImplementation(key => {
      if (key === 'conversation:test-conversation') {
        return Promise.resolve({
          conversationId: 'test-conversation',
          history: [{ role: 'user', text: 'Hello' }, { role: 'system', text: 'Hi there' }],
          lastInteraction: Date.now() - 3600000,
          turnCount: 2
        });
      }
      return Promise.resolve(null);
    });
    ShortTermMemory.userId = 'test-user';
    
    // Mock ConversationContext
    ConversationContext.initialize = jest.fn().mockResolvedValue(true);
    ConversationContext.isInitialized = true;
    ConversationContext.getCurrentContext = jest.fn().mockReturnValue({
      conversationId: 'current-conversation',
      history: [{ role: 'user', text: 'How are you?' }],
      lastInteraction: Date.now(),
      turnCount: 1
    });
    ConversationContext.getConversationById = jest.fn().mockImplementation(id => {
      if (id === 'test-conversation') {
        return {
          conversationId: 'test-conversation',
          history: [{ role: 'user', text: 'Hello' }, { role: 'system', text: 'Hi there' }],
          lastInteraction: Date.now() - 3600000,
          turnCount: 2
        };
      }
      return null;
    });
    ConversationContext.getConversations = jest.fn().mockReturnValue([
      {
        id: 'current-conversation',
        lastInteraction: Date.now(),
        turnCount: 1,
        topic: null,
        source: 'active'
      }
    ]);
    ConversationContext.createNewConversation = jest.fn().mockReturnValue('test-conversation');
    ConversationContext.addMessage = jest.fn().mockResolvedValue(true);
    ConversationContext.updateEntities = jest.fn();
    ConversationContext.setCurrentTopic = jest.fn();
    
    // Mock MemoryCurator
    MemoryCurator.retrieveMemories = jest.fn().mockImplementation((userId, options) => {
      if (options.types && options.types.includes('conversation')) {
        return Promise.resolve([
          {
            id: 'memory-1',
            content: {
              conversationId: 'old-conversation',
              history: [{ role: 'user', text: 'Previous conversation' }],
              lastInteraction: Date.now() - 86400000, // 1 day ago
              turnCount: 3,
              currentTopic: 'previous topic'
            },
            importance: 3.5
          }
        ]);
      }
      return Promise.resolve([]);
    });
    
    // Mock Resource Manager
    getResourceAllocationManager.mockReturnValue({
      getCurrentMode: jest.fn().mockReturnValue('normal')
    });
    
    // Mock setInterval and clearInterval
    jest.useFakeTimers();
  });
  
  afterEach(async () => {
    // Restore timers
    jest.useRealTimers();
    
    // Shutdown if initialized
    if (ConversationMemoryBridge.isInitialized) {
      await ConversationMemoryBridge.shutdown();
    }
  });
  
  // Test initialization
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await ConversationMemoryBridge.initialize();
      expect(result).toBe(true);
      expect(EventBus.subscribe).toHaveBeenCalledTimes(4);
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:conversation-bridge:initialized',
        expect.any(Object)
      );
    });
    
    it('should initialize dependencies if needed', async () => {
      ShortTermMemory.isInitialized = false;
      ConversationContext.isInitialized = false;
      
      const result = await ConversationMemoryBridge.initialize({
        userId: 'test-user'
      });
      
      expect(result).toBe(true);
      expect(ShortTermMemory.initialize).toHaveBeenCalledWith({
        userId: 'test-user'
      });
      expect(ConversationContext.initialize).toHaveBeenCalled();
    });
    
    it('should attempt to restore recent conversation on initialization', async () => {
      // Override the mock to simulate a successful restoration
      ShortTermMemory.getAllKeys = jest.fn().mockResolvedValue(['conversation:recent-convo']);
      ShortTermMemory.retrieveMemory = jest.fn().mockResolvedValue({
        conversationId: 'recent-convo',
        history: [{ role: 'user', text: 'Recent message' }],
        lastInteraction: Date.now() - 1000, // Just 1 second ago
        turnCount: 1
      });
      
      const result = await ConversationMemoryBridge.initialize();
      expect(result).toBe(true);
      
      // Wait for restore to complete (it's called asynchronously after initialization)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that restoration was attempted
      expect(ConversationContext.createNewConversation).toHaveBeenCalled();
      expect(ConversationContext.addMessage).toHaveBeenCalled();
    });
  });
  
  // Test conversation history retrieval
  describe('getConversationHistory', () => {
    beforeEach(async () => {
      await ConversationMemoryBridge.initialize();
    });
    
    it('should retrieve conversation history from short-term memory', async () => {
      const result = await ConversationMemoryBridge.getConversationHistory('test-conversation');
      
      expect(ShortTermMemory.retrieveConversationContext).toHaveBeenCalledWith('test-conversation');
      expect(result).toEqual({
        conversationId: 'test-conversation',
        history: [
          { role: 'user', text: 'Hello' },
          { role: 'system', text: 'Hi there' }
        ],
        lastInteraction: expect.any(Number),
        turnCount: 2,
        currentTopic: 'greeting'
      });
    });
    
    it('should retrieve conversation history from long-term memory if not in short-term', async () => {
      // Override the mock to simulate not found in short-term
      ShortTermMemory.retrieveConversationContext = jest.fn().mockResolvedValue(null);
      
      const result = await ConversationMemoryBridge.getConversationHistory('old-conversation');
      
      expect(ShortTermMemory.retrieveConversationContext).toHaveBeenCalledWith('old-conversation');
      expect(MemoryCurator.retrieveMemories).toHaveBeenCalledWith('test-user', {
        types: ['conversation'],
        entities: ['old-conversation'],
        limit: 1
      });
      
      // The result should come from long-term memory (memoryGetter mock)
      expect(result).toEqual({
        conversationId: 'old-conversation',
        history: [{ role: 'user', text: 'Previous conversation' }],
        lastInteraction: expect.any(Number),
        turnCount: 3,
        currentTopic: 'previous topic'
      });
    });
  });
  
  // Test finding recent conversations
  describe('findRecentConversations', () => {
    beforeEach(async () => {
      await ConversationMemoryBridge.initialize();
    });
    
    it('should combine and deduplicate conversations from all sources', async () => {
      const result = await ConversationMemoryBridge.findRecentConversations();
      
      // Should call the required methods
      expect(ConversationContext.getConversations).toHaveBeenCalled();
      expect(ShortTermMemory.getAllKeys).toHaveBeenCalled();
      expect(MemoryCurator.retrieveMemories).toHaveBeenCalled();
      
      // Should have a combined result with no duplicates
      expect(result.length).toBe(2); // current-conversation and old-conversation
      expect(result[0].id).toBe('current-conversation'); // Most recent first
      expect(result[1].id).toBe('old-conversation');
    });
    
    it('should respect limit option', async () => {
      const result = await ConversationMemoryBridge.findRecentConversations({ limit: 1 });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('current-conversation'); // Most recent only
    });
  });
  
  // Test conversation restoration
  describe('restoreConversation', () => {
    beforeEach(async () => {
      await ConversationMemoryBridge.initialize();
    });
    
    it('should restore a conversation by ID', async () => {
      const result = await ConversationMemoryBridge.restoreConversation('test-conversation');
      
      expect(result).toBe(true);
      expect(ConversationContext.createNewConversation).toHaveBeenCalledWith('test-conversation');
      expect(ConversationContext.addMessage).toHaveBeenCalled();
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:conversation:restored',
        expect.objectContaining({
          conversationId: 'test-conversation',
          messageCount: 2
        })
      );
    });
    
    it('should restore topic and entities if available', async () => {
      // Mock a conversation with topic and entities
      ShortTermMemory.retrieveConversationContext = jest.fn().mockResolvedValue({
        conversationId: 'test-conversation',
        history: [{ role: 'user', text: 'Hello' }],
        currentTopic: 'important-topic',
        entities: new Map([['person', 'Alice']])
      });
      
      const result = await ConversationMemoryBridge.restoreConversation('test-conversation');
      
      expect(result).toBe(true);
      expect(ConversationContext.setCurrentTopic).toHaveBeenCalledWith('important-topic');
      expect(ConversationContext.updateEntities).toHaveBeenCalledWith(
        expect.any(Map)
      );
    });
    
    it('should return false if conversation not found', async () => {
      // Override the mock to simulate not found
      ShortTermMemory.retrieveConversationContext = jest.fn().mockResolvedValue(null);
      MemoryCurator.retrieveMemories = jest.fn().mockResolvedValue([]);
      
      const result = await ConversationMemoryBridge.restoreConversation('non-existent');
      
      expect(result).toBe(false);
      expect(ConversationContext.createNewConversation).not.toHaveBeenCalled();
    });
  });
  
  // Test sync functionality
  describe('conversation syncing', () => {
    beforeEach(async () => {
      await ConversationMemoryBridge.initialize();
    });
    
    it('should sync on message added event', () => {
      // Simulate message added event
      const handler = EventBus.subscribe.mock.calls.find(
        call => call[0] === 'conversation:message-added'
      )[1];
      
      handler({ message: { text: 'New message' } });
      
      // Should call storeConversationContext
      expect(ShortTermMemory.storeConversationContext).toHaveBeenCalled();
    });
    
    it('should sync on new conversation event', () => {
      // Simulate new conversation event
      const handler = EventBus.subscribe.mock.calls.find(
        call => call[0] === 'conversation:new-conversation'
      )[1];
      
      handler({ conversationId: 'new-convo' });
      
      // Should call storeConversationContext for the current conversation
      expect(ShortTermMemory.storeConversationContext).toHaveBeenCalled();
    });
    
    it('should sync periodically via interval', () => {
      // Advance timers to trigger interval
      jest.advanceTimersByTime(30000); // 30 seconds
      
      // Should have called storeConversationContext
      expect(ShortTermMemory.storeConversationContext).toHaveBeenCalled();
    });
  });
  
  // Test shutdown
  describe('shutdown', () => {
    beforeEach(async () => {
      await ConversationMemoryBridge.initialize();
    });
    
    it('should shut down properly', async () => {
      const result = await ConversationMemoryBridge.shutdown();
      
      expect(result).toBe(true);
      expect(EventBus.unsubscribe).toHaveBeenCalledTimes(4);
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:conversation-bridge:shutdown',
        expect.any(Object)
      );
      
      // Should perform final sync
      expect(ShortTermMemory.storeConversationContext).toHaveBeenCalled();
    });
    
    it('should clear intervals during shutdown', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const result = await ConversationMemoryBridge.shutdown();
      
      expect(result).toBe(true);
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
