/**
 * Behavior Module Integration Tests
 * 
 * This test suite validates the integration of ALEJO's behavior personalization components:
 * - Pattern learning
 * - Preference modeling
 * - Response adaptation
 * - Module initialization and shutdown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as behaviorModule from '../../../src/personalization/behavior/index.js';
import { auditTrail } from '../../../src/security/audit-trail.js';
import { eventBus } from '../../../src/core/event-bus.js';

// Mock dependencies
vi.mock('../../../src/security/audit-trail.js', () => ({
  auditTrail: {
    log: vi.fn()
  }
}));

vi.mock('../../../src/core/event-bus.js', () => ({
  eventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

vi.mock('../../../src/personalization/behavior/pattern-learner.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  recordMessage: vi.fn().mockResolvedValue(true),
  getStyleMetrics: vi.fn().mockResolvedValue({
    formality: 0.7,
    verbosity: 0.5,
    emotionality: 0.3,
    complexity: 0.6,
    directness: 0.8,
    politeness: 0.7,
    humor: 0.4,
    questionFrequency: 0.2
  }),
  resetPatterns: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../src/personalization/behavior/adaptor.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  adaptResponse: vi.fn().mockImplementation((userId, response) => {
    // Simple mock adaptation that adds a greeting based on user ID
    return Promise.resolve(`[Adapted for ${userId}] ${response}`);
  })
}));

vi.mock('../../../src/personalization/behavior/preference-model.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  detectPreferencesFromMessage: vi.fn().mockResolvedValue(true),
  getPreferenceModel: vi.fn().mockResolvedValue({
    preferences: {
      'content:news': { value: 'technology', confidence: 0.8 },
      'interface:theme': { value: 'dark', confidence: 0.9 }
    }
  }),
  setPreference: vi.fn().mockResolvedValue(true),
  getPreference: vi.fn().mockImplementation((userId, key, defaultValue) => {
    const mockPreferences = {
      'content:news': 'technology',
      'interface:theme': 'dark'
    };
    return Promise.resolve(mockPreferences[key] || defaultValue);
  })
}));

vi.mock('../../../src/personalization/behavior/preference-normalization.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../src/personalization/behavior/preference-relationship-integration.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true)
}));

describe('Behavior Module Integration', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization and Shutdown', () => {
    it('should initialize all behavior components successfully', async () => {
      const result = await behaviorModule.initialize();
      
      expect(result.success).toBe(true);
      expect(result.results.patternLearner).toBe(true);
      expect(result.results.adaptor).toBe(true);
      expect(result.results.preferenceModel).toBe(true);
      expect(result.results.preferenceNormalization).toBe(true);
      expect(result.results.preferenceRelationshipIntegration).toBe(true);
      
      // Should log initialization
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:initializing',
        expect.any(Object)
      );
      
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:initialized',
        expect.any(Object)
      );
      
      // Should emit initialization event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior_module:initialized',
        expect.any(Object)
      );
    });
    
    it('should initialize with custom options', async () => {
      const options = {
        enablePreferenceNormalization: false,
        enablePreferenceRelationshipIntegration: false
      };
      
      const result = await behaviorModule.initialize(options);
      
      expect(result.success).toBe(true);
      expect(result.results.patternLearner).toBe(true);
      expect(result.results.adaptor).toBe(true);
      expect(result.results.preferenceModel).toBe(true);
      expect(result.results.preferenceNormalization).toBe(false);
      expect(result.results.preferenceRelationshipIntegration).toBe(false);
    });
    
    it('should handle initialization errors gracefully', async () => {
      // Mock pattern learner to fail
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      patternLearner.initialize.mockRejectedValueOnce(new Error('Pattern learner initialization failed'));
      
      await expect(behaviorModule.initialize()).rejects.toThrow('Behavior module initialization failed');
      
      // Should log error
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:initialization_error',
        expect.objectContaining({
          error: expect.any(String)
        })
      );
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior_module:initialization_error',
        expect.any(Object)
      );
    });
    
    it('should shutdown all components successfully', async () => {
      const result = await behaviorModule.shutdown();
      
      expect(result).toBe(true);
      
      // Should log shutdown
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:shutting_down',
        expect.any(Object)
      );
      
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:shutdown_complete',
        expect.any(Object)
      );
      
      // Should emit shutdown event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior_module:shutdown_complete',
        expect.any(Object)
      );
    });
    
    it('should handle shutdown errors gracefully', async () => {
      // Mock pattern learner to fail during shutdown
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      patternLearner.shutdown.mockRejectedValueOnce(new Error('Pattern learner shutdown failed'));
      
      const result = await behaviorModule.shutdown();
      
      expect(result).toBe(false);
      
      // Should log error
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:shutdown_error',
        expect.objectContaining({
          error: expect.any(String)
        })
      );
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior_module:shutdown_error',
        expect.any(Object)
      );
    });
  });
  
  describe('Message Recording and Pattern Learning', () => {
    beforeEach(async () => {
      await behaviorModule.initialize();
      vi.clearAllMocks(); // Clear initialization events
    });
    
    it('should record user messages for pattern learning', async () => {
      const message = "I prefer concise explanations with technical details.";
      const context = { timestamp: Date.now(), conversationId: 'conv-123' };
      
      const result = await behaviorModule.recordUserMessage(testUserId, message, context);
      
      expect(result).toBe(true);
      
      // Should call pattern learner
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      expect(patternLearner.recordMessage).toHaveBeenCalledWith(
        testUserId,
        message,
        context
      );
      
      // Should call preference detection
      const preferenceModel = await import('../../../src/personalization/behavior/preference-model.js');
      expect(preferenceModel.detectPreferencesFromMessage).toHaveBeenCalledWith(
        testUserId,
        message,
        context
      );
    });
    
    it('should handle message recording errors', async () => {
      // Mock pattern learner to fail
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      patternLearner.recordMessage.mockRejectedValueOnce(new Error('Recording failed'));
      
      const message = "This message will fail to record.";
      const result = await behaviorModule.recordUserMessage(testUserId, message);
      
      expect(result).toBe(false);
      
      // Should log error
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:record_message_error',
        expect.objectContaining({
          userId: testUserId,
          error: expect.any(String)
        })
      );
    });
    
    it('should retrieve user style metrics', async () => {
      const metrics = await behaviorModule.getStyleMetrics(testUserId);
      
      expect(metrics).toEqual({
        formality: 0.7,
        verbosity: 0.5,
        emotionality: 0.3,
        complexity: 0.6,
        directness: 0.8,
        politeness: 0.7,
        humor: 0.4,
        questionFrequency: 0.2
      });
      
      // Should call pattern learner
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      expect(patternLearner.getStyleMetrics).toHaveBeenCalledWith(testUserId);
    });
    
    it('should reset user patterns', async () => {
      const result = await behaviorModule.resetPatterns(testUserId);
      
      expect(result).toBe(true);
      
      // Should call pattern learner
      const patternLearner = await import('../../../src/personalization/behavior/pattern-learner.js');
      expect(patternLearner.resetPatterns).toHaveBeenCalledWith(testUserId);
    });
  });
  
  describe('Response Adaptation', () => {
    beforeEach(async () => {
      await behaviorModule.initialize();
      vi.clearAllMocks(); // Clear initialization events
    });
    
    it('should adapt responses based on user style', async () => {
      const originalResponse = "Here is the information you requested.";
      const context = { topic: 'technical', emotionalState: 'neutral' };
      
      const adaptedResponse = await behaviorModule.adaptResponse(testUserId, originalResponse, context);
      
      expect(adaptedResponse).toBe(`[Adapted for ${testUserId}] ${originalResponse}`);
      
      // Should call adaptor
      const adaptor = await import('../../../src/personalization/behavior/adaptor.js');
      expect(adaptor.adaptResponse).toHaveBeenCalledWith(
        testUserId,
        originalResponse,
        context
      );
    });
    
    it('should handle adaptation errors', async () => {
      // Mock adaptor to fail
      const adaptor = await import('../../../src/personalization/behavior/adaptor.js');
      adaptor.adaptResponse.mockRejectedValueOnce(new Error('Adaptation failed'));
      
      const originalResponse = "This response will fail to adapt.";
      const adaptedResponse = await behaviorModule.adaptResponse(testUserId, originalResponse);
      
      // Should return original response on error
      expect(adaptedResponse).toBe(originalResponse);
      
      // Should log error
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:adapt_response_error',
        expect.objectContaining({
          userId: testUserId,
          error: expect.any(String)
        })
      );
    });
  });
  
  describe('Preference Management', () => {
    beforeEach(async () => {
      await behaviorModule.initialize();
      vi.clearAllMocks(); // Clear initialization events
    });
    
    it('should get user preference model', async () => {
      const model = await behaviorModule.getPreferenceModel(testUserId);
      
      expect(model).toEqual({
        preferences: {
          'content:news': { value: 'technology', confidence: 0.8 },
          'interface:theme': { value: 'dark', confidence: 0.9 }
        }
      });
      
      // Should call preference model
      const preferenceModel = await import('../../../src/personalization/behavior/preference-model.js');
      expect(preferenceModel.getPreferenceModel).toHaveBeenCalledWith(testUserId, {});
    });
    
    it('should get specific user preference', async () => {
      const preference = await behaviorModule.getPreference(testUserId, 'content:news', 'general');
      
      expect(preference).toBe('technology');
      
      // Should call preference model
      const preferenceModel = await import('../../../src/personalization/behavior/preference-model.js');
      expect(preferenceModel.getPreference).toHaveBeenCalledWith(
        testUserId,
        'content:news',
        'general',
        {}
      );
    });
    
    it('should return default value for missing preference', async () => {
      const preference = await behaviorModule.getPreference(testUserId, 'nonexistent:key', 'default-value');
      
      expect(preference).toBe('default-value');
    });
    
    it('should set user preference', async () => {
      const result = await behaviorModule.setPreference(
        testUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      );
      
      expect(result).toBe(true);
      
      // Should call preference model
      const preferenceModel = await import('../../../src/personalization/behavior/preference-model.js');
      expect(preferenceModel.setPreference).toHaveBeenCalledWith(
        testUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      );
    });
  });
});
