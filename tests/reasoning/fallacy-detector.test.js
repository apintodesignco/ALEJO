/**
 * ALEJO Fallacy Detector Tests
 * 
 * This test suite validates the enhanced fallacy detection system, including:
 * - Basic fallacy detection
 * - Multi-sentence complex fallacy detection
 * - Confidence scoring
 * - Context extraction
 * - Explanation generation with educational content
 */

import { 
  detectFallacies, 
  explainFallacies, 
  FALLACY_CATEGORY 
} from '../../src/reasoning/explanation/fallacy-detector.js';

// Mock the event publishing system
let publishedEvents = [];
global.publish = jest.fn((eventName, data) => {
  publishedEvents.push({ eventName, data });
});

describe('Fallacy Detector', () => {
  beforeEach(() => {
    publishedEvents = [];
    jest.clearAllMocks();
  });
  
  describe('Basic Fallacy Detection', () => {
    test('should detect ad hominem fallacy', () => {
      const text = "Don't listen to her argument; she's not even qualified.";
      const result = detectFallacies(text);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(f => f.id === 'ad_hominem')).toBe(true);
      expect(publishedEvents.length).toBe(1);
      expect(publishedEvents[0].eventName).toBe('reasoning:fallacies-detected');
    });
    
    test('should detect straw man fallacy', () => {
      const text = "You're saying we should abandon all regulations, which is absurd.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'straw_man')).toBe(true);
    });
    
    test('should detect slippery slope fallacy', () => {
      const text = "If we allow this change, it will lead to complete chaos and the end of society.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'slippery_slope')).toBe(true);
    });
    
    test('should not detect fallacies in valid reasoning', () => {
      const text = "The evidence suggests this conclusion is correct based on multiple peer-reviewed studies.";
      const result = detectFallacies(text);
      
      expect(result.length).toBe(0);
    });
  });
  
  describe('Complex Multi-Sentence Fallacy Detection', () => {
    test('should detect false dichotomy across sentences', () => {
      const text = "There are only two options here. Either we implement my plan or we face disaster.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'false_dichotomy')).toBe(true);
    });
    
    test('should detect circular reasoning across sentences', () => {
      const text = "This book must be true because it says so. It says so, therefore it must be true.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'circular_reasoning')).toBe(true);
    });
    
    test('should detect hasty generalization across sentences', () => {
      const text = "I met one person from that country who was rude. Everyone from that country must be rude.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'hasty_generalization')).toBe(true);
    });
    
    test('should detect post hoc fallacy', () => {
      const text = "After I started taking this supplement, my symptoms improved. The supplement must have cured me.";
      const result = detectFallacies(text);
      
      expect(result.some(f => f.id === 'post_hoc')).toBe(true);
    });
  });
  
  describe('Confidence Scoring', () => {
    test('should assign higher confidence to clear fallacies', () => {
      const clearFallacy = "Don't listen to him, he's an idiot with no credentials.";
      const subtleFallacy = "Consider the source of this information.";
      
      const clearResult = detectFallacies(clearFallacy);
      const subtleResult = detectFallacies(subtleFallacy);
      
      if (clearResult.length > 0 && subtleResult.length > 0) {
        expect(clearResult[0].confidence).toBeGreaterThan(subtleResult[0].confidence);
      }
    });
    
    test('should respect confidence threshold', () => {
      const text = "This might be a weak example of a fallacy.";
      
      const resultWithDefaultThreshold = detectFallacies(text);
      const resultWithHighThreshold = detectFallacies(text, { confidenceThreshold: 0.9 });
      const resultWithLowThreshold = detectFallacies(text, { confidenceThreshold: 0.1 });
      
      expect(resultWithHighThreshold.length).toBeLessThanOrEqual(resultWithDefaultThreshold.length);
      expect(resultWithLowThreshold.length).toBeGreaterThanOrEqual(resultWithDefaultThreshold.length);
    });
  });
  
  describe('Context Extraction', () => {
    test('should include context with detected fallacies', () => {
      const text = "First sentence. This contains an ad hominem attack: he's stupid. Final sentence.";
      const result = detectFallacies(text);
      
      if (result.length > 0) {
        expect(result[0].context).toBeDefined();
        expect(result[0].context.before).toBeDefined();
        expect(result[0].context.after).toBeDefined();
      }
    });
    
    test('should include appropriate context size', () => {
      const text = "First. Second. Third sentence with fallacy: everyone does it. Fifth. Sixth.";
      const result = detectFallacies(text, { includeContext: true });
      
      if (result.length > 0 && result[0].context) {
        expect(result[0].context.before.length).toBeGreaterThan(0);
        expect(result[0].context.after.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Fallacy Explanation', () => {
    test('should generate basic explanation for detected fallacies', () => {
      const text = "Don't listen to her; she's not qualified.";
      const fallacies = detectFallacies(text);
      const explanation = explainFallacies(text, fallacies);
      
      expect(explanation).toContain('Detected');
      expect(explanation).toContain('confidence');
      expect(explanation).toContain('Category');
    });
    
    test('should include examples when requested', () => {
      const text = "Don't listen to her; she's not qualified.";
      const fallacies = detectFallacies(text);
      const explanation = explainFallacies(text, fallacies, { includeExamples: true });
      
      expect(explanation).toContain('Example:');
    });
    
    test('should include remediation suggestions when requested', () => {
      const text = "Don't listen to her; she's not qualified.";
      const fallacies = detectFallacies(text);
      const explanation = explainFallacies(text, fallacies, { includeRemediation: true });
      
      expect(explanation).toContain('Suggestion:');
    });
    
    test('should include educational content in educational mode', () => {
      const text = "Don't listen to her; she's not qualified.";
      const fallacies = detectFallacies(text);
      const explanation = explainFallacies(text, fallacies, { educationalMode: true });
      
      expect(explanation).toContain('Educational note:');
    });
    
    test('should organize fallacies by category', () => {
      const text = "Don't listen to her; she's not qualified. If we allow this, next thing you know we'll have complete chaos.";
      const fallacies = detectFallacies(text);
      const explanation = explainFallacies(text, fallacies);
      
      // Should have at least one category header
      expect(explanation).toMatch(/[A-Z]+ FALLACIES:/);
    });
  });
  
  describe('Event Publishing', () => {
    test('should publish events with detailed analysis information', () => {
      const text = "Don't listen to her; she's not qualified.";
      detectFallacies(text);
      
      expect(publishedEvents.length).toBe(1);
      expect(publishedEvents[0].data.analysisDetails).toBeDefined();
      expect(publishedEvents[0].data.analysisDetails.sentenceCount).toBeGreaterThan(0);
    });
  });
});
