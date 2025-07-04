/**
 * ALEJO Empathy Core Tests
 * 
 * This test suite validates the empathy core module functionality, including:
 * - Emotion detection from text
 * - Emotional state tracking and temporal decay
 * - Empathetic response generation
 * - Event subscriptions and publications
 */

import { 
  initialize,
  detectEmotions,
  getEmotionalState,
  updateEmotionalState,
  generateEmpatheticResponse,
  resetEmotionalData
} from '../../../src/personalization/emotional/empathy-core.js';

// Mock dependencies
vi.mock('../../../src/core/events.js', () => ({
  subscribe: vi.fn(),
  publish: vi.fn()
}));

vi.mock('../../../src/security/privacy-guard.js', () => ({
  getSecureData: vi.fn().mockResolvedValue(null),
  setSecureData: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../src/security/audit-trail.js', () => ({
  log: vi.fn()
}));

describe('Empathy Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await initialize();
      expect(result).toBe(true);
    });
  });
  
  describe('Emotion Detection', () => {
    test('should detect joy in positive text', async () => {
      const text = "I'm so happy and excited about this amazing news!";
      const emotions = await detectEmotions(text);
      
      expect(emotions).toBeDefined();
      expect(emotions.primary).toBeDefined();
      expect(emotions.primary.joy).toBeGreaterThan(0.5);
    });
    
    test('should detect sadness in negative text', async () => {
      const text = "I feel so disappointed and upset about what happened.";
      const emotions = await detectEmotions(text);
      
      expect(emotions).toBeDefined();
      expect(emotions.primary).toBeDefined();
      expect(emotions.primary.sadness).toBeGreaterThan(0.3);
    });
    
    test('should detect anger in frustrated text', async () => {
      const text = "This is absolutely infuriating! I can't believe they would do that!";
      const emotions = await detectEmotions(text);
      
      expect(emotions).toBeDefined();
      expect(emotions.primary).toBeDefined();
      expect(emotions.primary.anger).toBeGreaterThan(0.4);
    });
    
    test('should handle neutral text', async () => {
      const text = "The meeting is scheduled for tomorrow at 2pm.";
      const emotions = await detectEmotions(text);
      
      expect(emotions).toBeDefined();
      expect(emotions.primary).toBeDefined();
      // No emotion should be particularly strong
      Object.values(emotions.primary).forEach(value => {
        expect(value).toBeLessThan(0.4);
      });
    });
  });
  
  describe('Emotional State Management', () => {
    const userId = 'test-user-123';
    
    test('should return default emotional state for new user', async () => {
      const state = await getEmotionalState(userId);
      
      expect(state).toBeDefined();
      expect(state.primary).toBeDefined();
      expect(state.history).toBeInstanceOf(Array);
      expect(state.history.length).toBe(0);
    });
    
    test('should update emotional state', async () => {
      const emotions = {
        joy: 0.8,
        sadness: 0.1,
        anger: 0.05,
        fear: 0.05,
        surprise: 0.2,
        disgust: 0.0,
        trust: 0.6,
        anticipation: 0.4
      };
      
      await updateEmotionalState(userId, emotions);
      const state = await getEmotionalState(userId);
      
      expect(state.primary.joy).toBeCloseTo(0.8, 1);
      expect(state.history.length).toBe(1);
    });
    
    test('should reset emotional data', async () => {
      // First update state
      const emotions = { joy: 0.8, sadness: 0.1 };
      await updateEmotionalState(userId, emotions);
      
      // Then reset
      await resetEmotionalData(userId);
      
      // Check if reset worked
      const state = await getEmotionalState(userId);
      expect(state.primary.joy).toBeLessThan(0.2); // Default values should be low
      expect(state.history.length).toBe(0);
    });
  });
  
  describe('Empathetic Response Generation', () => {
    const userId = 'test-user-456';
    
    test('should generate empathetic response for happy context', async () => {
      // Set up a joyful emotional state
      await updateEmotionalState(userId, { joy: 0.9 });
      
      const originalResponse = "Here's the information you requested.";
      const context = { topic: 'achievement' };
      
      const empathicResponse = await generateEmpatheticResponse(userId, originalResponse, context);
      
      expect(empathicResponse).not.toBe(originalResponse);
      expect(empathicResponse.length).toBeGreaterThan(originalResponse.length);
    });
    
    test('should generate empathetic response for sad context', async () => {
      // Set up a sad emotional state
      await updateEmotionalState(userId, { sadness: 0.8 });
      
      const originalResponse = "Here's the information you requested.";
      const context = { topic: 'loss' };
      
      const empathicResponse = await generateEmpatheticResponse(userId, originalResponse, context);
      
      expect(empathicResponse).not.toBe(originalResponse);
      expect(empathicResponse.length).toBeGreaterThan(originalResponse.length);
    });
    
    test('should not modify response if no strong emotions detected', async () => {
      // Set up a neutral emotional state
      await updateEmotionalState(userId, { 
        joy: 0.1, sadness: 0.1, anger: 0.1, 
        fear: 0.1, surprise: 0.1, disgust: 0.1,
        trust: 0.1, anticipation: 0.1
      });
      
      const originalResponse = "Here's the information you requested.";
      const context = { topic: 'general' };
      
      const empathicResponse = await generateEmpatheticResponse(userId, originalResponse, context);
      
      // Should be similar to original since no strong emotions to respond to
      expect(empathicResponse).toBe(originalResponse);
    });
  });
});
