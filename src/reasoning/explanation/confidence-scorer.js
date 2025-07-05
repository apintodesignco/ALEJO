/**
 * confidence-scorer.js
 * 
 * This module provides uncertainty estimation and confidence scoring for ALEJO's
 * reasoning processes. It helps quantify the reliability of conclusions and
 * provides transparency about the system's confidence in its outputs.
 * 
 * The confidence scorer uses multiple methods:
 * 1. Evidence strength assessment
 * 2. Reasoning path analysis
 * 3. Source reliability weighting
 * 4. Uncertainty propagation
 * 5. Calibrated confidence estimation
 * 
 * Security integration:
 * - Audit trail logging for all confidence assessments
 * - RBAC permissions for confidence threshold configuration
 * - Event emission for monitoring
 */

import { auditTrail } from '../../security/audit-trail.js';
import { eventBus } from '../../core/event-bus.js';
import { rbac } from '../../security/rbac.js';
import * as reasoningTracer from './reasoning-tracer.js';
import * as fallacyDetector from './fallacy-detector.js';

// Configuration defaults
const DEFAULT_CONFIG = {
  // Minimum confidence threshold for presenting conclusions (0-1)
  minimumConfidenceThreshold: 0.6,
  
  // Whether to include uncertainty ranges in outputs
  includeUncertaintyRanges: true,
  
  // Whether to apply calibration to raw confidence scores
  applyCalibration: true,
  
  // Whether to propagate uncertainty through reasoning chains
  propagateUncertainty: true,
  
  // Whether to weight evidence by source reliability
  weightBySourceReliability: true,
  
  // Whether to penalize confidence for detected fallacies
  penalizeForFallacies: true,
  
  // Calibration parameters (based on historical performance)
  calibration: {
    // Coefficients for sigmoid calibration function
    alpha: 1.2,  // Steepness
    beta: 0.3,   // Shift
    
    // Domain-specific calibration adjustments
    domainAdjustments: {
      scientific: 0.0,    // Well-calibrated in scientific domains
      personal: -0.1,     // Slightly overconfident in personal domains
      speculative: -0.2,  // More overconfident in speculative domains
      ethical: -0.15      // Somewhat overconfident in ethical domains
    }
  }
};

// Current configuration (initialized with defaults)
let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize the confidence scorer with custom configuration
 * @param {Object} config - Custom configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(config = {}) {
  try {
    // Merge provided config with defaults
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      calibration: {
        ...DEFAULT_CONFIG.calibration,
        ...(config.calibration || {}),
        domainAdjustments: {
          ...DEFAULT_CONFIG.calibration.domainAdjustments,
          ...(config.calibration?.domainAdjustments || {})
        }
      }
    };
    
    auditTrail.log('confidence_scorer:initialized', {
      timestamp: new Date().toISOString(),
      config: currentConfig
    });
    
    eventBus.emit('confidence_scorer:initialized', {
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    auditTrail.log('confidence_scorer:initialization_error', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Score confidence for a conclusion based on its reasoning path
 * @param {Object} conclusion - The conclusion to score
 * @param {Object} reasoningPath - The reasoning path that led to the conclusion
 * @param {Object} context - Additional context for scoring
 * @returns {Promise<Object>} - Confidence assessment result
 */
export async function scoreConfidence(conclusion, reasoningPath, context = {}) {
  const userId = context.userId || 'system';
  const domain = context.domain || 'general';
  const startTime = performance.now();
  
  try {
    // Create result object
    const result = {
      conclusion,
      rawConfidence: 0,
      calibratedConfidence: 0,
      uncertaintyRange: [0, 0],
      factors: {},
      explanation: [],
      timestamp: new Date().toISOString()
    };
    
    // 1. Assess evidence strength
    const evidenceResult = await assessEvidenceStrength(conclusion, reasoningPath, context);
    result.factors.evidenceStrength = evidenceResult.score;
    result.explanation.push(evidenceResult.explanation);
    
    // 2. Analyze reasoning path quality
    const reasoningResult = await analyzeReasoningPath(reasoningPath, context);
    result.factors.reasoningQuality = reasoningResult.score;
    result.explanation.push(reasoningResult.explanation);
    
    // 3. Weight by source reliability if enabled
    if (currentConfig.weightBySourceReliability) {
      const sourceResult = await assessSourceReliability(conclusion, reasoningPath, context);
      result.factors.sourceReliability = sourceResult.score;
      result.explanation.push(sourceResult.explanation);
    } else {
      result.factors.sourceReliability = 0.5; // Neutral if not enabled
    }
    
    // 4. Check for fallacies if enabled
    if (currentConfig.penalizeForFallacies) {
      const fallacyResult = await checkForFallacies(reasoningPath, context);
      result.factors.fallacyPenalty = fallacyResult.penalty;
      result.explanation.push(fallacyResult.explanation);
    } else {
      result.factors.fallacyPenalty = 0; // No penalty if not enabled
    }
    
    // 5. Calculate raw confidence score
    result.rawConfidence = calculateRawConfidence(result.factors);
    
    // 6. Apply calibration if enabled
    if (currentConfig.applyCalibration) {
      result.calibratedConfidence = calibrateConfidence(result.rawConfidence, domain);
      result.explanation.push(`Raw confidence ${result.rawConfidence.toFixed(2)} calibrated to ${result.calibratedConfidence.toFixed(2)} for domain '${domain}'.`);
    } else {
      result.calibratedConfidence = result.rawConfidence;
    }
    
    // 7. Calculate uncertainty range if enabled
    if (currentConfig.includeUncertaintyRanges) {
      result.uncertaintyRange = calculateUncertaintyRange(result.calibratedConfidence, result.factors);
      result.explanation.push(`Uncertainty range: [${result.uncertaintyRange[0].toFixed(2)}, ${result.uncertaintyRange[1].toFixed(2)}].`);
    }
    
    // 8. Determine if conclusion meets confidence threshold
    result.meetsThreshold = result.calibratedConfidence >= currentConfig.minimumConfidenceThreshold;
    
    if (result.meetsThreshold) {
      result.explanation.push(`Conclusion meets confidence threshold (${currentConfig.minimumConfidenceThreshold}).`);
    } else {
      result.explanation.push(`Conclusion does not meet confidence threshold (${currentConfig.minimumConfidenceThreshold}).`);
    }
    
    return finalizeResult(result, startTime, userId);
  } catch (error) {
    auditTrail.log('confidence_scorer:error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack,
      conclusion
    });
    
    return {
      conclusion,
      rawConfidence: 0,
      calibratedConfidence: 0,
      uncertaintyRange: [0, 0],
      factors: {},
      explanation: [`Error during confidence scoring: ${error.message}`],
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Assess the strength of evidence supporting a conclusion
 * @param {Object} conclusion - The conclusion to assess
 * @param {Object} reasoningPath - The reasoning path
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Assessment result
 */
async function assessEvidenceStrength(conclusion, reasoningPath, context) {
  try {
    // Extract evidence from reasoning path
    const evidence = reasoningPath.evidence || [];
    
    if (evidence.length === 0) {
      return {
        score: 0.1,
        explanation: 'No explicit evidence provided to support conclusion.'
      };
    }
    
    // Factors affecting evidence strength
    let quantity = Math.min(evidence.length / 5, 1); // Normalize quantity, cap at 1
    let quality = 0;
    let relevance = 0;
    let consistency = 0;
    
    // Assess quality of each piece of evidence
    for (const item of evidence) {
      // Quality based on evidence type
      switch (item.type) {
        case 'empirical':
          quality += 0.9;
          break;
        case 'logical':
          quality += 0.8;
          break;
        case 'expert':
          quality += 0.7;
          break;
        case 'anecdotal':
          quality += 0.4;
          break;
        case 'opinion':
          quality += 0.3;
          break;
        default:
          quality += 0.5;
      }
      
      // Relevance to conclusion
      relevance += item.relevance || 0.5;
      
      // Consistency with other evidence
      consistency += item.consistency || 0.5;
    }
    
    // Average scores
    quality = quality / evidence.length;
    relevance = relevance / evidence.length;
    consistency = consistency / evidence.length;
    
    // Calculate overall evidence strength
    const evidenceStrength = (quantity * 0.2) + (quality * 0.4) + (relevance * 0.2) + (consistency * 0.2);
    
    return {
      score: evidenceStrength,
      explanation: `Evidence strength: ${evidenceStrength.toFixed(2)} (quantity: ${quantity.toFixed(2)}, quality: ${quality.toFixed(2)}, relevance: ${relevance.toFixed(2)}, consistency: ${consistency.toFixed(2)})`
    };
  } catch (error) {
    auditTrail.log('confidence_scorer:evidence_assessment_error', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      score: 0.3,
      explanation: `Error assessing evidence strength: ${error.message}`
    };
  }
}

/**
 * Analyze the quality of a reasoning path
 * @param {Object} reasoningPath - The reasoning path to analyze
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzeReasoningPath(reasoningPath, context) {
  try {
    // Get reasoning steps from path
    const steps = reasoningPath.steps || [];
    
    if (steps.length === 0) {
      return {
        score: 0.2,
        explanation: 'No explicit reasoning steps provided.'
      };
    }
    
    // Factors affecting reasoning quality
    let logicalValidity = 0;
    let completeness = 0;
    let clarity = 0;
    let complexity = 0;
    
    // Analyze each reasoning step
    for (const step of steps) {
      // Logical validity of step
      logicalValidity += step.validity || 0.5;
      
      // Completeness of step
      completeness += step.completeness || 0.5;
      
      // Clarity of step
      clarity += step.clarity || 0.5;
      
      // Complexity penalty (more complex = less confidence)
      complexity += step.complexity || 0.5;
    }
    
    // Average scores
    logicalValidity = logicalValidity / steps.length;
    completeness = completeness / steps.length;
    clarity = clarity / steps.length;
    
    // Normalize complexity (higher complexity = lower score)
    complexity = complexity / steps.length;
    const complexityScore = 1 - (complexity / 2); // Convert to 0.5-1 range
    
    // Calculate overall reasoning quality
    const reasoningQuality = (logicalValidity * 0.4) + (completeness * 0.2) + (clarity * 0.2) + (complexityScore * 0.2);
    
    return {
      score: reasoningQuality,
      explanation: `Reasoning quality: ${reasoningQuality.toFixed(2)} (validity: ${logicalValidity.toFixed(2)}, completeness: ${completeness.toFixed(2)}, clarity: ${clarity.toFixed(2)}, complexity adjustment: ${complexityScore.toFixed(2)})`
    };
  } catch (error) {
    auditTrail.log('confidence_scorer:reasoning_analysis_error', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      score: 0.3,
      explanation: `Error analyzing reasoning path: ${error.message}`
    };
  }
}

/**
 * Assess the reliability of information sources
 * @param {Object} conclusion - The conclusion
 * @param {Object} reasoningPath - The reasoning path
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Assessment result
 */
async function assessSourceReliability(conclusion, reasoningPath, context) {
  try {
    // Extract sources from reasoning path
    const sources = reasoningPath.sources || [];
    
    if (sources.length === 0) {
      return {
        score: 0.5,
        explanation: 'No explicit sources provided. Using neutral source reliability.'
      };
    }
    
    let totalReliability = 0;
    let explanations = [];
    
    // Assess each source
    for (const source of sources) {
      let sourceScore = 0.5; // Default neutral score
      
      // Score based on source type
      if (source.type) {
        switch (source.type.toLowerCase()) {
          case 'peer_reviewed':
            sourceScore = 0.9;
            explanations.push(`Peer-reviewed source: ${source.name || 'unnamed'} (0.9)`);
            break;
          case 'academic':
            sourceScore = 0.8;
            explanations.push(`Academic source: ${source.name || 'unnamed'} (0.8)`);
            break;
          case 'government':
            sourceScore = 0.75;
            explanations.push(`Government source: ${source.name || 'unnamed'} (0.75)`);
            break;
          case 'news':
            sourceScore = 0.6;
            explanations.push(`News source: ${source.name || 'unnamed'} (0.6)`);
            break;
          case 'expert':
            sourceScore = 0.7;
            explanations.push(`Expert source: ${source.name || 'unnamed'} (0.7)`);
            break;
          case 'industry':
            sourceScore = 0.65;
            explanations.push(`Industry source: ${source.name || 'unnamed'} (0.65)`);
            break;
          case 'social_media':
            sourceScore = 0.3;
            explanations.push(`Social media source: ${source.name || 'unnamed'} (0.3)`);
            break;
          case 'personal':
            sourceScore = 0.4;
            explanations.push(`Personal source: ${source.name || 'unnamed'} (0.4)`);
            break;
          case 'unknown':
            sourceScore = 0.2;
            explanations.push(`Unknown source: ${source.name || 'unnamed'} (0.2)`);
            break;
          default:
            sourceScore = 0.5;
            explanations.push(`Source of type ${source.type}: ${source.name || 'unnamed'} (0.5)`);
        }
      }
      
      // Override with explicit reliability if provided
      if (typeof source.reliability === 'number') {
        sourceScore = source.reliability;
        explanations.push(`Source ${source.name || 'unnamed'} has explicit reliability score: ${sourceScore.toFixed(2)}`);
      }
      
      totalReliability += sourceScore;
    }
    
    // Average source reliability
    const averageReliability = totalReliability / sources.length;
    
    return {
      score: averageReliability,
      explanation: `Source reliability: ${averageReliability.toFixed(2)} (${explanations.join(', ')})`
    };
  } catch (error) {
    auditTrail.log('confidence_scorer:source_assessment_error', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      score: 0.5,
      explanation: `Error assessing source reliability: ${error.message}. Using neutral reliability.`
    };
  }
}

/**
 * Check for fallacies in reasoning
 * @param {Object} reasoningPath - The reasoning path to check
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Check result
 */
async function checkForFallacies(reasoningPath, context) {
  try {
    // Use fallacy detector to find fallacies
    const fallacyResult = await fallacyDetector.detectFallacies(reasoningPath);
    const fallacies = fallacyResult.fallacies || [];
    
    if (fallacies.length === 0) {
      return {
        penalty: 0,
        explanation: 'No fallacies detected in reasoning.'
      };
    }
    
    // Calculate penalty based on fallacy severity and count
    let totalPenalty = 0;
    let explanations = [];
    
    for (const fallacy of fallacies) {
      const severityPenalty = fallacy.severity || 0.1;
      totalPenalty += severityPenalty;
      explanations.push(`${fallacy.type} (penalty: ${severityPenalty.toFixed(2)})`);
    }
    
    // Cap total penalty at 0.8 (allowing some confidence even with fallacies)
    const cappedPenalty = Math.min(totalPenalty, 0.8);
    
    return {
      penalty: cappedPenalty,
      explanation: `Fallacy penalty: ${cappedPenalty.toFixed(2)} for fallacies: ${explanations.join(', ')}`
    };
  } catch (error) {
    auditTrail.log('confidence_scorer:fallacy_check_error', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      penalty: 0,
      explanation: `Error checking for fallacies: ${error.message}. No penalty applied.`
    };
  }
}

/**
 * Calculate raw confidence score from factor scores
 * @param {Object} factors - Factor scores
 * @returns {number} - Raw confidence score (0-1)
 */
function calculateRawConfidence(factors) {
  // Weights for different factors
  const weights = {
    evidenceStrength: 0.35,
    reasoningQuality: 0.35,
    sourceReliability: 0.2
  };
  
  // Calculate weighted sum of positive factors
  let score = 0;
  score += (factors.evidenceStrength || 0) * weights.evidenceStrength;
  score += (factors.reasoningQuality || 0) * weights.reasoningQuality;
  score += (factors.sourceReliability || 0) * weights.sourceReliability;
  
  // Apply fallacy penalty if present
  if (factors.fallacyPenalty) {
    score *= (1 - factors.fallacyPenalty);
  }
  
  // Ensure score is in 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Calibrate raw confidence score based on historical performance
 * @param {number} rawConfidence - Raw confidence score
 * @param {string} domain - Knowledge domain
 * @returns {number} - Calibrated confidence score (0-1)
 */
function calibrateConfidence(rawConfidence, domain = 'general') {
  // Get calibration parameters
  const { alpha, beta, domainAdjustments } = currentConfig.calibration;
  
  // Get domain-specific adjustment
  const domainAdjustment = domainAdjustments[domain] || 0;
  
  // Apply sigmoid calibration function: 1 / (1 + e^(-alpha * (x - beta)))
  const calibrated = 1 / (1 + Math.exp(-alpha * (rawConfidence - beta)));
  
  // Apply domain adjustment
  const adjusted = calibrated + domainAdjustment;
  
  // Ensure result is in 0-1 range
  return Math.max(0, Math.min(1, adjusted));
}

/**
 * Calculate uncertainty range for a confidence score
 * @param {number} confidence - Confidence score
 * @param {Object} factors - Factor scores
 * @returns {Array<number>} - Uncertainty range [min, max]
 */
function calculateUncertaintyRange(confidence, factors) {
  // Base uncertainty is inversely proportional to confidence
  // Higher confidence = narrower range
  const baseUncertainty = 0.1 + (0.2 * (1 - confidence));
  
  // Adjust uncertainty based on evidence and reasoning
  let adjustedUncertainty = baseUncertainty;
  
  // More evidence = less uncertainty
  if (factors.evidenceStrength) {
    adjustedUncertainty *= (1.2 - factors.evidenceStrength * 0.4);
  }
  
  // Better reasoning = less uncertainty
  if (factors.reasoningQuality) {
    adjustedUncertainty *= (1.2 - factors.reasoningQuality * 0.4);
  }
  
  // Fallacies = more uncertainty
  if (factors.fallacyPenalty) {
    adjustedUncertainty *= (1 + factors.fallacyPenalty);
  }
  
  // Calculate range
  const min = Math.max(0, confidence - adjustedUncertainty);
  const max = Math.min(1, confidence + adjustedUncertainty);
  
  return [min, max];
}

/**
 * Finalize confidence scoring result with logging and event emission
 * @param {Object} result - Scoring result
 * @param {number} startTime - Start time for performance measurement
 * @param {string} userId - User ID for logging
 * @returns {Object} - Finalized result
 */
function finalizeResult(result, startTime, userId) {
  const duration = performance.now() - startTime;
  
  // Add duration to result
  result.processingTime = duration;
  
  // Log result
  auditTrail.log('confidence_scorer:assessment', {
    timestamp: new Date().toISOString(),
    userId,
    conclusion: result.conclusion,
    confidence: result.calibratedConfidence,
    meetsThreshold: result.meetsThreshold,
    duration
  });
  
  // Emit event with assessment
  eventBus.emit('confidence_scorer:assessment', {
    timestamp: new Date().toISOString(),
    userId,
    confidence: result.calibratedConfidence,
    meetsThreshold: result.meetsThreshold
  });
  
  return result;
}

/**
 * Update confidence scorer configuration
 * @param {Object} newConfig - New configuration options
 * @param {string} userId - User ID making the change
 * @returns {Promise<boolean>} - Success status
 */
export async function updateConfiguration(newConfig, userId = 'system') {
  try {
    // Check permission
    if (!rbac.checkPermission(userId, 'reasoning:configure_confidence')) {
      auditTrail.log('security:permission_denied', {
        userId,
        permission: 'reasoning:configure_confidence',
        action: 'updateConfiguration'
      });
      
      return false;
    }
    
    // Store old config for logging
    const oldConfig = { ...currentConfig };
    
    // Update config
    currentConfig = {
      ...currentConfig,
      ...newConfig,
      calibration: {
        ...currentConfig.calibration,
        ...(newConfig.calibration || {}),
        domainAdjustments: {
          ...currentConfig.calibration.domainAdjustments,
          ...(newConfig.calibration?.domainAdjustments || {})
        }
      }
    };
    
    // Log configuration change
    auditTrail.log('confidence_scorer:config_updated', {
      timestamp: new Date().toISOString(),
      userId,
      oldConfig,
      newConfig: currentConfig
    });
    
    // Emit configuration change event
    eventBus.emit('confidence_scorer:config_updated', {
      timestamp: new Date().toISOString(),
      userId,
      config: currentConfig
    });
    
    return true;
  } catch (error) {
    auditTrail.log('confidence_scorer:config_update_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Get current confidence scorer configuration
 * @param {string} userId - User ID requesting configuration
 * @returns {Promise<Object>} - Current configuration
 */
export async function getConfiguration(userId = 'system') {
  try {
    // Check permission
    if (!rbac.checkPermission(userId, 'reasoning:view_confidence_config')) {
      auditTrail.log('security:permission_denied', {
        userId,
        permission: 'reasoning:view_confidence_config',
        action: 'getConfiguration'
      });
      
      throw new Error('Permission denied');
    }
    
    return { ...currentConfig };
  } catch (error) {
    auditTrail.log('confidence_scorer:get_config_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * Reset confidence scorer configuration to defaults
 * @param {string} userId - User ID making the change
 * @returns {Promise<boolean>} - Success status
 */
export async function resetConfiguration(userId = 'system') {
  try {
    return await updateConfiguration(DEFAULT_CONFIG, userId);
  } catch (error) {
    auditTrail.log('confidence_scorer:reset_config_error', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}
