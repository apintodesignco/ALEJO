/**
 * ALEJO Reasoning Engine
 * 
 * This module serves as the main entry point for ALEJO's reasoning system,
 * providing a unified interface to the truth core, explanation, and correction components.
 * 
 * Integrated with the Resource Allocation Manager for optimized performance and
 * prevention of system overheating.
 */

// Import truth core components
import * as foundationFacts from './truth-core/foundation-facts.js';
import * as learningFilter from './truth-core/learning-filter.js';
import * as validityChecker from './truth-core/validity-checker.js';

// Import explanation components
import * as reasoningTracer from './explanation/reasoning-tracer.js';
import * as fallacyDetector from './explanation/fallacy-detector.js';
import * as confidenceScorer from './explanation/confidence-scorer.js';

// Import correction components
import * as feedbackLoop from './correction/feedback-loop.js';
import * as sourceValidator from './correction/source-validator.js';
import * as conflictResolver from './correction/conflict-resolver.js';

// Import performance integration
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';

/**
 * Initialize the ALEJO Reasoning Engine
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.enableResourceManagement=true] - Whether to register with Resource Allocation Manager
 * @returns {Promise<Object>} - Initialization results
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Reasoning Engine');
  
  const results = {
    // Truth core components
    foundationFacts: false,
    learningFilter: false,
    validityChecker: false,
    
    // Explanation components
    reasoningTracer: false,
    fallacyDetector: false,
    confidenceScorer: false,
    
    // Correction components
    feedbackLoop: false,
    sourceValidator: false,
    conflictResolver: false,
    
    // Resource management
    resourceManagement: false
  };
  
  // Initialize truth core components
  try {
    results.foundationFacts = await foundationFacts.initialize(options);
    results.learningFilter = await learningFilter.initialize(options);
    results.validityChecker = await validityChecker.initialize(options);
  } catch (error) {
    console.error('Failed to initialize truth core components:', error);
  }
  
  // Initialize explanation components
  try {
    results.reasoningTracer = await reasoningTracer.initialize(options);
    results.fallacyDetector = await fallacyDetector.initialize(options);
    results.confidenceScorer = await confidenceScorer.initialize(options);
  } catch (error) {
    console.error('Failed to initialize explanation components:', error);
  }
  
  // Initialize correction components
  try {
    results.feedbackLoop = await feedbackLoop.initialize(options);
    results.sourceValidator = await sourceValidator.initialize(options);
    results.conflictResolver = await conflictResolver.initialize(options);
  } catch (error) {
    console.error('Failed to initialize correction components:', error);
  }
  
  // Register with Resource Allocation Manager if enabled
  if (options.enableResourceManagement !== false) {
    try {
      results.resourceManagement = registerWithResourceManager(options);
    } catch (error) {
      console.error('Failed to register reasoning engine with Resource Allocation Manager:', error);
    }
  }
  
  return {
    success: Object.values(results).some(result => result === true),
    results
  };
}

/**
 * Shutdown the reasoning engine and release resources
 */
export async function shutdown() {
  console.log('Shutting down ALEJO Reasoning Engine');
  
  // Unregister from Resource Allocation Manager
  unregisterFromResourceManager();
  
  // Shutdown all components
  try {
    // Truth core components
    if (typeof foundationFacts.shutdown === 'function') await foundationFacts.shutdown();
    if (typeof learningFilter.shutdown === 'function') await learningFilter.shutdown();
    if (typeof validityChecker.shutdown === 'function') await validityChecker.shutdown();
    
    // Explanation components
    if (typeof reasoningTracer.shutdown === 'function') await reasoningTracer.shutdown();
    if (typeof fallacyDetector.shutdown === 'function') await fallacyDetector.shutdown();
    if (typeof confidenceScorer.shutdown === 'function') await confidenceScorer.shutdown();
    
    // Correction components
    if (typeof feedbackLoop.shutdown === 'function') await feedbackLoop.shutdown();
    if (typeof sourceValidator.shutdown === 'function') await sourceValidator.shutdown();
    if (typeof conflictResolver.shutdown === 'function') await conflictResolver.shutdown();
  } catch (error) {
    console.error('Error during reasoning engine shutdown:', error);
  }
}

// Export truth core components
export const truthCore = {
  foundationFacts,
  learningFilter,
  validityChecker
};

// Export explanation components
export const explanation = {
  reasoningTracer,
  fallacyDetector,
  confidenceScorer
};

// Export correction components
export const correction = {
  feedbackLoop,
  sourceValidator,
  conflictResolver
};

// Default export for the entire reasoning system
export default {
  initialize,
  shutdown,
  truthCore,
  explanation,
  correction
};
