/**
 * ALEJO Reasoning Engine Integration Tests
 * 
 * This test suite validates the integration between different components
 * of the reasoning engine, including:
 * - Logical consistency validation
 * - Inference validation
 * - Fallacy detection
 * - Explanation generation
 */

// Import from actual implementations
import { validateConsistency, validateInference } from '../../src/reasoning/truth-core/validity-checker.js';
import { detectFallacies, explainFallacies } from '../../src/reasoning/explanation/fallacy-detector.js';
import { resolveConflicts } from '../../src/reasoning/correction/conflict-resolver.js';
import { checkContradiction } from '../../src/reasoning/truth-core/foundation-facts.js';

// Mock the event publishing system
let publishedEvents = [];
global.publish = jest.fn((eventName, data) => {
  publishedEvents.push({ eventName, data });
});

describe('Reasoning Engine Integration', () => {
  beforeEach(() => {
    publishedEvents = [];
    jest.clearAllMocks();
  });
  
  describe('End-to-End Reasoning Analysis', () => {
    test('should perform complete reasoning analysis on valid argument', () => {
      // Valid argument using modus ponens
      const premises = [
        "If it rains, the ground gets wet",
        "It is raining"
      ];
      const conclusion = "The ground is wet";
      
      // Step 1: Check consistency of premises
      const consistencyResult = validateConsistency(premises);
      expect(consistencyResult.isConsistent).toBe(true);
      
      // Step 2: Validate the inference
      const inferenceResult = validateInference(premises, conclusion);
      expect(inferenceResult.isValid).toBe(true);
      expect(inferenceResult.confidence).toBeGreaterThan(0.7);
      expect(inferenceResult.pattern).toBe('modus_ponens');
      
      // Step 3: Check for fallacies in the entire argument
      const fullArgument = [...premises, "Therefore, " + conclusion].join(". ");
      const fallacies = detectFallacies(fullArgument);
      expect(fallacies.length).toBe(0);
    });
    
    test('should detect issues in flawed reasoning', () => {
      // Flawed argument with ad hominem and hasty generalization
      const premises = [
        "Dr. Smith claims climate change is real",
        "Dr. Smith once made a mistake in a calculation",
        "I saw one cold day last winter"
      ];
      const conclusion = "Climate change is not real";
      
      // Step 1: Check consistency of premises
      const consistencyResult = validateConsistency(premises);
      // Premises themselves might be consistent even in flawed reasoning
      
      // Step 2: Validate the inference
      const inferenceResult = validateInference(premises, conclusion);
      expect(inferenceResult.isValid).toBe(false);
      
      // Step 3: Check for fallacies in the entire argument
      const fullArgument = [...premises, "Therefore, " + conclusion].join(". ");
      const fallacies = detectFallacies(fullArgument);
      expect(fallacies.length).toBeGreaterThan(0);
      
      // Step 4: Generate explanation of reasoning flaws
      const explanation = explainFallacies(fullArgument, fallacies, { 
        includeExamples: true,
        includeRemediation: true,
        educationalMode: true
      });
      
      expect(explanation).toContain('fallacies');
    });
  });
  
  describe('Consistency and Inference Integration', () => {
    test('should detect contradiction between inference conclusion and foundation facts', async () => {
      // Mock foundation facts check
      jest.spyOn(global, 'checkContradiction').mockImplementation((statement) => {
        if (statement.includes("sun revolves around the earth")) {
          return {
            isContradiction: true,
            contradictingFact: "The earth revolves around the sun",
            confidence: 0.99,
            category: "astronomy"
          };
        }
        return { isContradiction: false };
      });
      
      const premises = [
        "All celestial observations from earth show the sun moving across the sky",
        "What we observe must be what is happening"
      ];
      const conclusion = "The sun revolves around the earth";
      
      // First validate the inference (might be valid based on premises)
      const inferenceResult = validateInference(premises, conclusion);
      
      // Then check against foundation facts
      const contradictionResult = checkContradiction(conclusion);
      expect(contradictionResult.isContradiction).toBe(true);
      
      // This should trigger a conflict resolution
      const conflictResult = resolveConflicts([
        {
          statement: conclusion,
          source: "inference",
          confidence: inferenceResult.confidence
        },
        {
          statement: contradictionResult.contradictingFact,
          source: "foundation_fact",
          confidence: contradictionResult.confidence,
          category: contradictionResult.category
        }
      ]);
      
      // Foundation facts should win in conflict resolution
      expect(conflictResult.resolvedStatement).toBe(contradictionResult.contradictingFact);
    });
  });
  
  describe('Fallacy Detection and Explanation Integration', () => {
    test('should provide comprehensive analysis of complex reasoning with multiple fallacies', () => {
      const complexArgument = `
        Everyone knows that vaccines are dangerous. My cousin got a vaccine and then felt sick the next day.
        Therefore, vaccines cause autism. The scientists who disagree are all paid by pharmaceutical companies.
        Either we stop all vaccinations or millions of people will suffer terrible consequences.
        This is just common sense, and anyone who disagrees doesn't care about children.
      `;
      
      // Detect fallacies
      const fallacies = detectFallacies(complexArgument);
      
      // Should detect multiple fallacies
      expect(fallacies.length).toBeGreaterThan(2);
      
      // Check for specific fallacy types
      const fallacyIds = fallacies.map(f => f.id);
      expect(fallacyIds).toContain('post_hoc'); // Post hoc (vaccine then felt sick)
      expect(fallacyIds).toContain('ad_hominem'); // Ad hominem (scientists paid by pharma)
      expect(fallacyIds).toContain('false_dichotomy'); // False dichotomy (stop all or suffer)
      expect(fallacyIds).toContain('appeal_to_emotion'); // Appeal to emotion (care about children)
      
      // Generate explanation with all educational features
      const explanation = explainFallacies(complexArgument, fallacies, {
        includeExamples: true,
        includeRemediation: true,
        educationalMode: true
      });
      
      // Verify explanation contains educational content
      expect(explanation).toContain('Educational note');
      expect(explanation).toContain('Example');
      expect(explanation).toContain('Suggestion');
      
      // Verify explanation is organized by category
      expect(explanation).toMatch(/[A-Z]+ FALLACIES:/);
    });
  });
  
  describe('Event Publishing Integration', () => {
    test('should publish events from all reasoning components', () => {
      const premises = ["All humans are mortal", "Socrates is human"];
      const conclusion = "Socrates is mortal";
      
      // Run all reasoning components
      validateConsistency(premises);
      validateInference(premises, conclusion);
      detectFallacies([...premises, conclusion].join(". "));
      
      // Check that events were published from each component
      const eventTypes = publishedEvents.map(e => e.eventName);
      expect(eventTypes).toContain('reasoning:consistency-validated');
      expect(eventTypes).toContain('reasoning:inference-validated');
      expect(eventTypes).toContain('reasoning:fallacies-detected');
    });
  });
});
