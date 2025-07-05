/**
 * learning-filter.js
 * 
 * This module provides filtering capabilities to prevent ALEJO from learning
 * harmful, incorrect, or misleading information. It acts as a gatekeeper
 * for new knowledge acquisition, ensuring that information added to ALEJO's
 * knowledge base meets quality and safety standards.
 * 
 * The learning filter uses multiple strategies:
 * 1. Foundation facts validation - checks against established truths
 * 2. Logical consistency checks - ensures new information doesn't contradict existing knowledge
 * 3. Source credibility assessment - evaluates reliability of information sources
 * 4. Safety boundaries - prevents harmful or dangerous information
 * 5. Confidence scoring - assigns confidence levels to new information
 * 
 * Security integration:
 * - Audit trail logging for all filtering decisions
 * - RBAC permissions for filter configuration
 * - Event emission for monitoring
 */

import { auditTrail } from '../../security/audit-trail.js';
import { eventBus } from '../../core/event-bus.js';
import { rbac } from '../../security/rbac.js';
import * as foundationFacts from './foundation-facts.js';
import * as validityChecker from './validity-checker.js';

// Configuration defaults
const DEFAULT_CONFIG = {
  // Minimum confidence threshold for accepting new information (0-1)
  minimumConfidenceThreshold: 0.7,
  
  // Whether to strictly enforce foundation facts (true) or allow overrides with high confidence (false)
  strictFoundationEnforcement: true,
  
  // Maximum allowed contradiction level with existing knowledge (0-1)
  maxContradictionLevel: 0.3,
  
  // Minimum required source credibility score (0-1)
  minimumSourceCredibility: 0.6,
  
  // Whether to apply safety filters
  applySafetyFilters: true,
  
  // Whether to log detailed filter decisions
  detailedLogging: true
};

// Current configuration (initialized with defaults)
let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize the learning filter with custom configuration
 * @param {Object} config - Custom configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(config = {}) {
  try {
    // Merge provided config with defaults
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...config
    };
    
    auditTrail.log('learning_filter:initialized', {
      timestamp: new Date().toISOString(),
      config: currentConfig
    });
    
    eventBus.emit('learning_filter:initialized', {
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    auditTrail.log('learning_filter:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Filter new information before it's learned
 * @param {Object} information - New information to be filtered
 * @param {Object} context - Additional context for filtering decisions
 * @returns {Promise<Object>} - Filtering result with decision and explanation
 */
export async function filterInformation(information, context = {}) {
  const userId = context.userId || 'system';
  const startTime = performance.now();
  
  try {
    // Create result object
    const result = {
      originalInformation: information,
      isAccepted: false,
      confidence: 0,
      filterResults: {},
      explanation: [],
      timestamp: new Date().toISOString()
    };
    
    // 1. Foundation facts validation
    const foundationResult = await checkAgainstFoundationFacts(information, context);
    result.filterResults.foundationCheck = foundationResult;
    result.explanation.push(foundationResult.explanation);
    
    // If foundation check fails and strict enforcement is enabled, reject immediately
    if (!foundationResult.passed && currentConfig.strictFoundationEnforcement) {
      result.isAccepted = false;
      result.explanation.push('Information contradicts foundation facts and strict enforcement is enabled.');
      return finalizeResult(result, startTime, userId);
    }
    
    // 2. Logical consistency check
    const consistencyResult = await checkLogicalConsistency(information, context);
    result.filterResults.consistencyCheck = consistencyResult;
    result.explanation.push(consistencyResult.explanation);
    
    // If contradiction level exceeds threshold, reject
    if (consistencyResult.contradictionLevel > currentConfig.maxContradictionLevel) {
      result.isAccepted = false;
      result.explanation.push(`Information contradicts existing knowledge (level: ${consistencyResult.contradictionLevel.toFixed(2)}).`);
      return finalizeResult(result, startTime, userId);
    }
    
    // 3. Source credibility assessment
    const credibilityResult = await assessSourceCredibility(information, context);
    result.filterResults.credibilityCheck = credibilityResult;
    result.explanation.push(credibilityResult.explanation);
    
    // If source credibility is below threshold, reject
    if (credibilityResult.credibilityScore < currentConfig.minimumSourceCredibility) {
      result.isAccepted = false;
      result.explanation.push(`Source credibility (${credibilityResult.credibilityScore.toFixed(2)}) is below threshold.`);
      return finalizeResult(result, startTime, userId);
    }
    
    // 4. Safety boundary check
    const safetyResult = await checkSafetyBoundaries(information, context);
    result.filterResults.safetyCheck = safetyResult;
    result.explanation.push(safetyResult.explanation);
    
    // If safety check fails and safety filters are enabled, reject
    if (!safetyResult.passed && currentConfig.applySafetyFilters) {
      result.isAccepted = false;
      result.explanation.push('Information violates safety boundaries.');
      return finalizeResult(result, startTime, userId);
    }
    
    // 5. Calculate overall confidence
    result.confidence = calculateOverallConfidence(
      foundationResult,
      consistencyResult,
      credibilityResult,
      safetyResult
    );
    
    // Accept if confidence meets threshold
    result.isAccepted = result.confidence >= currentConfig.minimumConfidenceThreshold;
    
    if (result.isAccepted) {
      result.explanation.push(`Information accepted with confidence ${result.confidence.toFixed(2)}.`);
    } else {
      result.explanation.push(`Information rejected due to insufficient confidence (${result.confidence.toFixed(2)}).`);
    }
    
    return finalizeResult(result, startTime, userId);
  } catch (error) {
    auditTrail.log('learning_filter:error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack,
      information
    });
    
    return {
      originalInformation: information,
      isAccepted: false,
      confidence: 0,
      filterResults: {},
      explanation: [`Error during filtering: ${error.message}`],
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Check information against foundation facts
 * @param {Object} information - Information to check
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Check result
 */
async function checkAgainstFoundationFacts(information, context) {
  try {
    const result = await foundationFacts.validateAgainstFoundations(information, context);
    
    return {
      passed: result.valid,
      confidence: result.confidence,
      contradictions: result.contradictions || [],
      explanation: result.explanation || 'Checked against foundation facts.'
    };
  } catch (error) {
    auditTrail.log('learning_filter:foundation_check_error', {
      error: error.message,
      stack: error.stack,
      information
    });
    
    return {
      passed: false,
      confidence: 0,
      contradictions: [],
      explanation: `Error checking against foundation facts: ${error.message}`
    };
  }
}

/**
 * Check logical consistency of information
 * @param {Object} information - Information to check
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Check result
 */
async function checkLogicalConsistency(information, context) {
  try {
    const result = await validityChecker.checkConsistency(information, context);
    
    return {
      passed: result.consistent,
      contradictionLevel: result.contradictionLevel || 0,
      affectedConcepts: result.affectedConcepts || [],
      explanation: result.explanation || 'Checked logical consistency.'
    };
  } catch (error) {
    auditTrail.log('learning_filter:consistency_check_error', {
      error: error.message,
      stack: error.stack,
      information
    });
    
    return {
      passed: false,
      contradictionLevel: 1,
      affectedConcepts: [],
      explanation: `Error checking logical consistency: ${error.message}`
    };
  }
}

/**
 * Assess credibility of information source
 * @param {Object} information - Information with source
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Assessment result
 */
async function assessSourceCredibility(information, context) {
  try {
    // Extract source information
    const source = information.source || context.source || { credibility: 0.5, type: 'unknown' };
    
    // Default credibility for unknown sources
    let credibilityScore = 0.5;
    let explanation = 'No source information provided.';
    
    if (source) {
      // If source has explicit credibility score, use it
      if (typeof source.credibility === 'number') {
        credibilityScore = source.credibility;
        explanation = `Source has explicit credibility score: ${credibilityScore.toFixed(2)}.`;
      } else {
        // Evaluate based on source type
        switch (source.type) {
          case 'peer_reviewed':
            credibilityScore = 0.9;
            explanation = 'Source is peer-reviewed academic content.';
            break;
          case 'educational':
            credibilityScore = 0.8;
            explanation = 'Source is from educational institution.';
            break;
          case 'news':
            credibilityScore = 0.6;
            explanation = 'Source is from news organization.';
            break;
          case 'social_media':
            credibilityScore = 0.3;
            explanation = 'Source is from social media.';
            break;
          case 'user_provided':
            credibilityScore = 0.4;
            explanation = 'Source is user-provided information.';
            break;
          default:
            credibilityScore = 0.5;
            explanation = 'Source type is unknown or unspecified.';
        }
      }
      
      // Adjust based on verification status
      if (source.verified === true) {
        credibilityScore = Math.min(credibilityScore + 0.2, 1.0);
        explanation += ' Source has been verified.';
      }
      
      // Adjust based on corroboration
      if (source.corroborated === true) {
        credibilityScore = Math.min(credibilityScore + 0.1, 1.0);
        explanation += ' Information is corroborated by multiple sources.';
      }
    }
    
    return {
      credibilityScore,
      sourceType: source.type || 'unknown',
      explanation
    };
  } catch (error) {
    auditTrail.log('learning_filter:credibility_assessment_error', {
      error: error.message,
      stack: error.stack,
      information
    });
    
    return {
      credibilityScore: 0.3,
      sourceType: 'error',
      explanation: `Error assessing source credibility: ${error.message}`
    };
  }
}

/**
 * Check information against safety boundaries
 * @param {Object} information - Information to check
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Check result
 */
async function checkSafetyBoundaries(information, context) {
  try {
    // Safety categories to check
    const safetyCategories = [
      'harmful_instructions',
      'illegal_content',
      'malware_generation',
      'privacy_violation',
      'discrimination',
      'misinformation',
      'manipulation'
    ];
    
    // Convert information to string for checking
    const infoString = typeof information === 'string' 
      ? information 
      : JSON.stringify(information);
    
    // Simple keyword-based checks (in production, this would use more sophisticated methods)
    const safetyIssues = [];
    
    // Check for harmful instructions
    const harmfulPatterns = [
      /how to (make|create|build) (bomb|explosive|weapon)/i,
      /instructions for (hacking|attacking|harming)/i
    ];
    
    if (harmfulPatterns.some(pattern => pattern.test(infoString))) {
      safetyIssues.push('harmful_instructions');
    }
    
    // Check for illegal content
    const illegalPatterns = [
      /(distribute|access|create) (illegal|illicit) content/i,
      /(evade|avoid) (taxes|law enforcement)/i
    ];
    
    if (illegalPatterns.some(pattern => pattern.test(infoString))) {
      safetyIssues.push('illegal_content');
    }
    
    // Check for privacy violations
    const privacyPatterns = [
      /(personal|private) (data|information) (of|about) (specific|named)/i,
      /(dox|doxx|expose) (person|individual|people)/i
    ];
    
    if (privacyPatterns.some(pattern => pattern.test(infoString))) {
      safetyIssues.push('privacy_violation');
    }
    
    // Check for discriminatory content
    const discriminationPatterns = [
      /(all|every) (people|person) (of|from) (race|religion|gender|nationality) are/i,
      /(inferior|superior) (race|gender|group)/i
    ];
    
    if (discriminationPatterns.some(pattern => pattern.test(infoString))) {
      safetyIssues.push('discrimination');
    }
    
    // Check for misinformation
    const misinformationPatterns = [
      /(conspiracy|hoax) about/i,
      /proven (false|fake)/i
    ];
    
    if (misinformationPatterns.some(pattern => pattern.test(infoString))) {
      safetyIssues.push('misinformation');
    }
    
    const passed = safetyIssues.length === 0;
    let explanation = passed 
      ? 'Information passed safety boundary checks.' 
      : `Information violates safety boundaries: ${safetyIssues.join(', ')}.`;
    
    return {
      passed,
      safetyIssues,
      explanation
    };
  } catch (error) {
    auditTrail.log('learning_filter:safety_check_error', {
      error: error.message,
      stack: error.stack,
      information
    });
    
    return {
      passed: false,
      safetyIssues: ['error_during_check'],
      explanation: `Error checking safety boundaries: ${error.message}`
    };
  }
}

/**
 * Calculate overall confidence based on all filter results
 * @param {Object} foundationResult - Foundation facts check result
 * @param {Object} consistencyResult - Logical consistency check result
 * @param {Object} credibilityResult - Source credibility assessment result
 * @param {Object} safetyResult - Safety boundary check result
 * @returns {number} - Overall confidence score (0-1)
 */
function calculateOverallConfidence(foundationResult, consistencyResult, credibilityResult, safetyResult) {
  // Weight factors for different checks
  const weights = {
    foundation: 0.3,
    consistency: 0.3,
    credibility: 0.25,
    safety: 0.15
  };
  
  // Calculate weighted scores
  let totalScore = 0;
  
  // Foundation score (based on passed status and confidence)
  const foundationScore = foundationResult.passed ? foundationResult.confidence : 0;
  totalScore += foundationScore * weights.foundation;
  
  // Consistency score (inverse of contradiction level)
  const consistencyScore = 1 - consistencyResult.contradictionLevel;
  totalScore += consistencyScore * weights.consistency;
  
  // Credibility score (direct from assessment)
  totalScore += credibilityResult.credibilityScore * weights.credibility;
  
  // Safety score (1 if passed, 0 if failed)
  const safetyScore = safetyResult.passed ? 1 : 0;
  totalScore += safetyScore * weights.safety;
  
  return Math.max(0, Math.min(1, totalScore));
}

/**
 * Finalize filtering result with logging and event emission
 * @param {Object} result - Filtering result
 * @param {number} startTime - Start time for performance measurement
 * @param {string} userId - User ID for logging
 * @returns {Object} - Finalized result
 */
function finalizeResult(result, startTime, userId) {
  const duration = performance.now() - startTime;
  
  // Add duration to result
  result.processingTime = duration;
  
  // Log detailed result if enabled
  if (currentConfig.detailedLogging) {
    auditTrail.log('learning_filter:decision', {
      timestamp: new Date().toISOString(),
      userId,
      isAccepted: result.isAccepted,
      confidence: result.confidence,
      duration,
      information: result.originalInformation
    });
  } else {
    // Log minimal result
    auditTrail.log('learning_filter:decision', {
      timestamp: new Date().toISOString(),
      userId,
      isAccepted: result.isAccepted,
      confidence: result.confidence,
      duration
    });
  }
  
  // Emit event with decision
  eventBus.emit('learning_filter:decision', {
    timestamp: new Date().toISOString(),
    userId,
    isAccepted: result.isAccepted,
    confidence: result.confidence
  });
  
  return result;
}

/**
 * Update learning filter configuration
 * @param {Object} newConfig - New configuration options
 * @param {string} userId - User ID making the change
 * @returns {Promise<boolean>} - Success status
 */
export async function updateConfiguration(newConfig, userId = 'system') {
  try {
    // Check permission
    if (!rbac.checkPermission(userId, 'reasoning:configure_filter')) {
      auditTrail.log('security:permission_denied', {
        userId,
        permission: 'reasoning:configure_filter',
        action: 'updateConfiguration'
      });
      
      return false;
    }
    
    // Store old config for logging
    const oldConfig = { ...currentConfig };
    
    // Update config
    currentConfig = {
      ...currentConfig,
      ...newConfig
    };
    
    // Log configuration change
    auditTrail.log('learning_filter:config_updated', {
      timestamp: new Date().toISOString(),
      userId,
      oldConfig,
      newConfig: currentConfig
    });
    
    // Emit configuration change event
    eventBus.emit('learning_filter:config_updated', {
      timestamp: new Date().toISOString(),
      userId,
      config: currentConfig
    });
    
    return true;
  } catch (error) {
    auditTrail.log('learning_filter:config_update_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Get current learning filter configuration
 * @param {string} userId - User ID requesting configuration
 * @returns {Promise<Object>} - Current configuration
 */
export async function getConfiguration(userId = 'system') {
  try {
    // Check permission
    if (!rbac.checkPermission(userId, 'reasoning:view_filter_config')) {
      auditTrail.log('security:permission_denied', {
        userId,
        permission: 'reasoning:view_filter_config',
        action: 'getConfiguration'
      });
      
      throw new Error('Permission denied');
    }
    
    return { ...currentConfig };
  } catch (error) {
    auditTrail.log('learning_filter:get_config_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * Reset learning filter configuration to defaults
 * @param {string} userId - User ID making the change
 * @returns {Promise<boolean>} - Success status
 */
export async function resetConfiguration(userId = 'system') {
  try {
    return await updateConfiguration(DEFAULT_CONFIG, userId);
  } catch (error) {
    auditTrail.log('learning_filter:reset_config_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}
