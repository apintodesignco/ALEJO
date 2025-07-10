/**
 * @file short-term-memory.test.js
 * @description Unit tests for the ALEJO short-term memory system
 */

import * as ShortTermMemory from './short-term-memory.js';
import * as ConversationContext from '../text/conversation-context.js';
import * as MemoryCurator from './memory-curator.js';
import * as PrivacyGuard from '../../integration/security/privacy-guard.js';
import { EventBus } from '../../core/event-bus.js';
import { getResourceAllocationManager } from '../../performance/resource-allocation-manager.js';

// Mock dependencies
jest.mock('../text/conversation-context.js');
jest.mock('./memory-curator.js');
jest.mock('../../integration/security/privacy-guard.js');
jest.mock('../../core/event-bus.js');
jest.mock('../../performance/resource-allocation-manager.js');

describe('Short-Term Memory System', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    
    // Mock window.crypto
    global.window = {
      crypto: {
        subtle: {
          generateKey: jest.fn().mockResolvedValue('mock-crypto-key'),
          encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
          decrypt: jest.fn().mockResolvedValue(new TextEncoder().encode(JSON.stringify({ data: 'mock-data' })))
        },
        getRandomValues: jest.fn().mockImplementation(arr => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        })
      }
    };
    
    // Mock EventBus
    EventBus.subscribe = jest.fn();
    EventBus.unsubscribe = jest.fn();
    EventBus.publish = jest.fn();
    
    // Mock ConversationContext
    ConversationContext.getCurrentContext = jest.fn().mockReturnValue({
      conversationId: 'test-conversation',
      history: [
        { role: 'user', text: 'Hello' },
        { role: 'system', text: 'Hi there' }
      ],
      lastInteraction: Date.now(),
      turnCount: 2
    });
    
    // Mock PrivacyGuard
    PrivacyGuard.encryptData = jest.fn().mockImplementation(data => {
      return Promise.resolve(`encrypted-${JSON.stringify(data)}`);
    });
    PrivacyGuard.decryptData = jest.fn().mockImplementation(data => {
      if (typeof data === 'string' && data.startsWith('encrypted-')) {
        const jsonStr = data.substring(10);
        return Promise.resolve(JSON.parse(jsonStr));
      }
      return Promise.resolve(data);
    });
    
    // Mock Resource Manager
    getResourceAllocationManager.mockReturnValue({
      getCurrentMode: jest.fn().mockReturnValue('normal'),
      registerConsumer: jest.fn(),
      unregisterConsumer: jest.fn()
    });
  });
  
  afterEach(async () => {
    // Shut down the system if it was initialized
    if (ShortTermMemory.isInitialized) {
      await ShortTermMemory.shutdown({ persistMemory: false });
    }
  });
  
  // Test initialization
  describe('initialize', () => {
    it('should initialize successfully with default options', async () => {
      const result = await ShortTermMemory.initialize();
      expect(result).toBe(true);
      expect(EventBus.subscribe).toHaveBeenCalledTimes(4);
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:short-term:initialized', 
        expect.objectContaining({ sessionId: expect.any(String) })
      );
    });
    
    it('should load persisted memory if available', async () => {
      const mockMemoryData = {
        items: [
          { 
            key: 'preference:test-preference',
            value: { value: 'test-value' },
            importance: 3.0,
            timestamp: Date.now(),
            encrypted: false,
            accessCount: 0
          }
        ]
      };
      
      global.localStorage.getItem.mockReturnValue('mock-encrypted-data');
      PrivacyGuard.decryptData.mockResolvedValueOnce(mockMemoryData);
      
      const result = await ShortTermMemory.initialize();
      expect(result).toBe(true);
      expect(global.localStorage.getItem).toHaveBeenCalled();
      expect(PrivacyGuard.decryptData).toHaveBeenCalledWith('mock-encrypted-data');
    });
    
    it('should return true if already initialized', async () => {
      await ShortTermMemory.initialize();
      const result = await ShortTermMemory.initialize();
      expect(result).toBe(true);
      expect(EventBus.subscribe).toHaveBeenCalledTimes(4); // Only called in the first initialization
    });
  });
  
  // Test memory operations
  describe('memory operations', () => {
    beforeEach(async () => {
      await ShortTermMemory.initialize();
    });
    
    it('should store and retrieve memory items', async () => {
      const testKey = 'test-key';
      const testValue = { foo: 'bar' };
      
      await ShortTermMemory.storeMemory(testKey, testValue);
      const retrieved = await ShortTermMemory.retrieveMemory(testKey);
      
      expect(retrieved).toEqual(testValue);
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:short-term:item-stored',
        { key: testKey }
      );
    });
    
    it('should encrypt sensitive memory items', async () => {
      const testKey = 'sensitive-key';
      const testValue = { sensitive: 'data' };
      
      await ShortTermMemory.storeMemory(testKey, testValue, { encrypt: true });
      
      expect(PrivacyGuard.encryptData).toHaveBeenCalledWith(testValue);
      
      const retrieved = await ShortTermMemory.retrieveMemory(testKey);
      expect(PrivacyGuard.decryptData).toHaveBeenCalled();
      expect(retrieved).toEqual(testValue);
    });
    
    it('should track access counts for memory items', async () => {
      const testKey = 'access-count-test';
      const testValue = { counter: 'test' };
      
      await ShortTermMemory.storeMemory(testKey, testValue);
      
      // Access multiple times
      await ShortTermMemory.retrieveMemory(testKey);
      await ShortTermMemory.retrieveMemory(testKey);
      await ShortTermMemory.retrieveMemory(testKey);
      
      // Each retrieval should publish an event
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:short-term:item-accessed',
        expect.objectContaining({ 
          key: testKey,
          accessCount: 3 // Third access
        })
      );
    });
    
    it('should respect memory expiration', async () => {
      const testKey = 'expiring-test';
      const testValue = { expiring: 'soon' };
      
      // Set expiration to 100ms in the future
      const expiresAt = Date.now() + 100;
      await ShortTermMemory.storeMemory(testKey, testValue, { expiresAt });
      
      // Should be available immediately
      let retrieved = await ShortTermMemory.retrieveMemory(testKey);
      expect(retrieved).toEqual(testValue);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired now
      retrieved = await ShortTermMemory.retrieveMemory(testKey);
      expect(retrieved).toBeNull();
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:short-term:item-expired',
        { key: testKey }
      );
    });
  });
  
  // Test conversation context integration
  describe('conversation context integration', () => {
    beforeEach(async () => {
      await ShortTermMemory.initialize();
    });
    
    it('should store conversation context', async () => {
      const mockContext = {
        conversationId: 'context-test',
        history: [
          { role: 'user', text: 'What is your name?' },
          { role: 'system', text: 'My name is ALEJO.' }
        ],
        lastInteraction: Date.now()
      };
      
      ConversationContext.getCurrentContext.mockReturnValue(mockContext);
      
      const result = await ShortTermMemory.storeConversationContext();
      expect(result).toBe(true);
      
      // Context should be stored with encryption
      expect(PrivacyGuard.encryptData).toHaveBeenCalled();
    });
    
    it('should retrieve conversation context', async () => {
      const conversationId = 'retrieve-context-test';
      const mockContext = { history: [{ text: 'Test message' }] };
      
      // Pre-store a mock context
      await ShortTermMemory.storeMemory(`conversation:${conversationId}`, mockContext);
      
      const result = await ShortTermMemory.retrieveConversationContext(conversationId);
      expect(result).toEqual(mockContext);
    });
  });
  
  // Test preference storage
  describe('preference storage', () => {
    beforeEach(async () => {
      await ShortTermMemory.initialize();
    });
    
    it('should store and retrieve preferences', async () => {
      const preferenceKey = 'theme';
      const preferenceValue = 'dark';
      
      await ShortTermMemory.storePreference(preferenceKey, preferenceValue);
      const retrieved = await ShortTermMemory.retrievePreference(preferenceKey);
      
      expect(retrieved).toBe(preferenceValue);
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:preference:updated',
        expect.objectContaining({ key: preferenceKey })
      );
    });
    
    it('should encrypt sensitive preferences', async () => {
      const preferenceKey = 'apiKey';
      const preferenceValue = 'secret-api-key-12345';
      
      await ShortTermMemory.storePreference(preferenceKey, preferenceValue, { sensitive: true });
      
      expect(PrivacyGuard.encryptData).toHaveBeenCalled();
      
      const retrieved = await ShortTermMemory.retrievePreference(preferenceKey);
      expect(PrivacyGuard.decryptData).toHaveBeenCalled();
      expect(retrieved).toBe(preferenceValue);
    });
  });
  
  // Test memory evaluation
  describe('memory evaluation', () => {
    beforeEach(async () => {
      await ShortTermMemory.initialize();
      
      // Mock the current time for consistent testing
      jest.spyOn(Date, 'now').mockImplementation(() => 1625097600000); // 2021-07-01
    });
    
    afterEach(() => {
      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
    });
    
    it('should evaluate memories for long-term storage', async () => {
      const highImportanceKey = 'high-importance';
      const lowImportanceKey = 'low-importance';
      
      // Store memories with different importance and timestamps
      await ShortTermMemory.storeMemory(highImportanceKey, { data: 'important' }, {
        importance: 4.0, // HIGH importance
        timestamp: Date.now() - (20 * 60 * 1000) // 20 minutes ago
      });
      
      await ShortTermMemory.storeMemory(lowImportanceKey, { data: 'not-so-important' }, {
        importance: 1.5, // Between TRIVIAL and LOW
        timestamp: Date.now() - (20 * 60 * 1000) // 20 minutes ago
      });
      
      // Should only move the high importance memory to long-term
      const result = await ShortTermMemory.evaluateMemoriesForLongTerm();
      
      expect(MemoryCurator.createMemory).toHaveBeenCalledWith(
        expect.any(String), // userId
        expect.objectContaining({
          content: { data: 'important' },
          importance: 4.0
        })
      );
      
      expect(MemoryCurator.createMemory).not.toHaveBeenCalledWith(
        expect.any(String), // userId
        expect.objectContaining({
          content: { data: 'not-so-important' }
        })
      );
    });
  });
  
  // Test shutdown
  describe('shutdown', () => {
    beforeEach(async () => {
      await ShortTermMemory.initialize();
    });
    
    it('should persist memory during shutdown if enabled', async () => {
      // Store a test item
      await ShortTermMemory.storeMemory('shutdown-test', { value: 'test' });
      
      // Shutdown with persistence
      const result = await ShortTermMemory.shutdown({ persistMemory: true });
      expect(result).toBe(true);
      
      // Memory should be persisted
      expect(PrivacyGuard.encryptData).toHaveBeenCalled();
      expect(global.localStorage.setItem).toHaveBeenCalled();
      
      // Events should be unsubscribed
      expect(EventBus.unsubscribe).toHaveBeenCalledTimes(4);
      
      // Shutdown event should be published
      expect(EventBus.publish).toHaveBeenCalledWith(
        'memory:short-term:shutdown',
        expect.objectContaining({ sessionEnd: expect.any(Number) })
      );
    });
    
    it('should not persist memory during shutdown if disabled', async () => {
      // Store a test item
      await ShortTermMemory.storeMemory('no-persist-test', { value: 'test' });
      
      // Shutdown without persistence
      const result = await ShortTermMemory.shutdown({ persistMemory: false });
      expect(result).toBe(true);
      
      // Memory should not be persisted
      expect(global.localStorage.setItem).not.toHaveBeenCalled();
    });
    
    it('should return true when called on uninitialized system', async () => {
      // First shutdown to make it uninitialized
      await ShortTermMemory.shutdown();
      
      // Clear mock history
      jest.clearAllMocks();
      
      // Try shutting down again
      const result = await ShortTermMemory.shutdown();
      expect(result).toBe(true);
      
      // No events should be unsubscribed or published
      expect(EventBus.unsubscribe).not.toHaveBeenCalled();
      expect(EventBus.publish).not.toHaveBeenCalled();
    });
  });
});
