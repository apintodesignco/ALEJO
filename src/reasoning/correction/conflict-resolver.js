/**
 * ALEJO Conflict Resolver
 * 
 * This module handles contradictions in knowledge by systematically analyzing
 * conflicting information and selecting the most reliable resolution based on
 * multiple factors including source reliability, recency, consistency with
 * foundation facts, and user feedback.
 * 
 * Based on MIT Media Lab research (2025) on knowledge conflict resolution in AI systems.
 */
import { publish, subscribe } from '../../core/events.js';
import { getFact, checkContradiction } from '../truth-core/foundation-facts.js';
import * as security from '../../security/index.js';

// Resolution strategies for handling conflicts
const RESOLUTION_STRATEGY = {
  FOUNDATION_FACTS: 'foundation_facts',   // Use foundation facts as the source of truth
  SOURCE_RELIABILITY: 'source_reliability', // Use source reliability to determine truth
  RECENCY: 'recency',                     // Prefer more recent information
  USER_FEEDBACK: 'user_feedback',         // Use explicit user feedback/correction
  CONSISTENCY: 'consistency',             // Choose option most consistent with other knowledge
  UNCERTAINTY: 'uncertainty'              // Express uncertainty when resolution is unclear
};

// Types of conflicts that can occur
const CONFLICT_TYPE = {
  FACTUAL: 'factual',           // Direct contradiction of facts (e.g., "A is B" vs "A is C")
  TEMPORAL: 'temporal',         // Time-based conflicts (e.g., outdated information)
  CONTEXTUAL: 'contextual',     // Context-dependent contradictions 
  DEFINITIONAL: 'definitional', // Different definitions of the same term
  INFERENTIAL: 'inferential'    // Conflicts in inferred information
};

// Confidence thresholds for different resolution strategies
const CONFIDENCE_THRESHOLD = {
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.4
};

// Store user feedback for conflict resolution
const userFeedbackStore = new Map();

// Initialize by subscribing to user feedback events
subscribe('reasoning:user-feedback', handleUserFeedback);

/**
 * Handle user feedback for conflict resolution.
 * @param {Object} data - Feedback data
 * @private
 */
function handleUserFeedback(data) {
  if (data && data.conflictId && data.resolution) {
    userFeedbackStore.set(data.conflictId, {
      resolution: data.resolution,
      timestamp: new Date().toISOString(),
      confidence: data.confidence || 1.0
    });
  }
}

/**
 * Resolve a conflict between existing and proposed facts.
 * @param {Object} conflict - Conflict information
 * @param {string} conflict.id - Unique identifier for the conflict
 * @param {string} conflict.key - The knowledge key in conflict
 * @param {any} conflict.existing - Existing value
 * @param {any} conflict.proposed - Proposed new value
 * @param {Object} [conflict.metadata] - Additional metadata about the conflict
 * @param {string} [conflict.metadata.existingSource] - Source of existing information
 * @param {string} [conflict.metadata.proposedSource] - Source of proposed information
 * @param {number} [conflict.metadata.existingConfidence] - Confidence in existing value (0-1)
 * @param {number} [conflict.metadata.proposedConfidence] - Confidence in proposed value (0-1)
 * @param {Date} [conflict.metadata.existingTimestamp] - When existing value was added
 * @param {Date} [conflict.metadata.proposedTimestamp] - When proposed value was created
 * @param {string} [conflict.metadata.conflictType] - Type of conflict from CONFLICT_TYPE
 * @param {string[]} [options.strategies] - Prioritized list of resolution strategies to try
 * @returns {Object} Resolution with value and explanation
 */
export function resolveConflict(conflict, options = {}) {
  // Generate a conflict ID if not provided
  const conflictId = conflict.id || `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Default metadata if not provided
  const metadata = conflict.metadata || {};
  const conflictType = metadata.conflictType || detectConflictType(conflict);
  
  // Default confidence values if not provided
  const existingConfidence = metadata.existingConfidence || 0.5;
  const proposedConfidence = metadata.proposedConfidence || 0.5;
  
  // Determine which resolution strategies to try, in order
  const strategies = options.strategies || [
    RESOLUTION_STRATEGY.FOUNDATION_FACTS,
    RESOLUTION_STRATEGY.USER_FEEDBACK,
    RESOLUTION_STRATEGY.SOURCE_RELIABILITY,
    RESOLUTION_STRATEGY.CONSISTENCY,
    RESOLUTION_STRATEGY.RECENCY,
    RESOLUTION_STRATEGY.UNCERTAINTY
  ];
  
  // Try each strategy in order until one produces a resolution
  let resolution = null;
  let strategyUsed = null;
  let confidence = 0;
  let explanation = '';
  
  for (const strategy of strategies) {
    const result = applyResolutionStrategy(strategy, conflict, conflictType);
    
    if (result && result.confidence > confidence) {
      resolution = result.value;
      strategyUsed = strategy;
      confidence = result.confidence;
      explanation = result.explanation;
      
      // If we have high confidence, stop trying other strategies
      if (confidence >= CONFIDENCE_THRESHOLD.HIGH) {
        break;
      }
    }
  }
  
  // If no strategy worked well, express uncertainty
  if (!resolution || confidence < CONFIDENCE_THRESHOLD.LOW) {
    resolution = {
      value: null,
      isUncertain: true,
      alternatives: [conflict.existing, conflict.proposed]
    };
    strategyUsed = RESOLUTION_STRATEGY.UNCERTAINTY;
    explanation = 'Unable to determine which value is correct with sufficient confidence.';
    confidence = 0.3;
  }
  
  // Prepare the full resolution result
  const resolutionResult = {
    conflictId,
    key: conflict.key,
    resolution,
    strategy: strategyUsed,
    confidence,
    explanation,
    conflictType,
    timestamp: new Date().toISOString()
  };
  
  // Publish the resolution event
  publish('reasoning:conflict-resolved', resolutionResult);
  
  return resolutionResult;
}

/**
 * Apply a specific resolution strategy to resolve a conflict.
 * @param {string} strategy - Strategy from RESOLUTION_STRATEGY
 * @param {Object} conflict - Conflict information
 * @param {string} conflictType - Type of conflict from CONFLICT_TYPE
 * @returns {Object|null} Resolution result with value, confidence, and explanation
 * @private
 */
function applyResolutionStrategy(strategy, conflict, conflictType) {
  const metadata = conflict.metadata || {};
  
  switch (strategy) {
    case RESOLUTION_STRATEGY.FOUNDATION_FACTS:
      return resolveUsingFoundationFacts(conflict);
      
    case RESOLUTION_STRATEGY.USER_FEEDBACK:
      return resolveUsingUserFeedback(conflict);
      
    case RESOLUTION_STRATEGY.SOURCE_RELIABILITY:
      return resolveUsingSourceReliability(conflict);
      
    case RESOLUTION_STRATEGY.CONSISTENCY:
      return resolveUsingConsistency(conflict);
      
    case RESOLUTION_STRATEGY.RECENCY:
      return resolveUsingRecency(conflict);
      
    case RESOLUTION_STRATEGY.UNCERTAINTY:
      return {
        value: null,
        isUncertain: true,
        alternatives: [conflict.existing, conflict.proposed],
        confidence: 0.3,
        explanation: 'Multiple conflicting values exist with similar reliability.'
      };
      
    default:
      return null;
  }
}

/**
 * Resolve conflict using foundation facts.
 * @param {Object} conflict - Conflict information
 * @returns {Object|null} Resolution result
 * @private
 */
function resolveUsingFoundationFacts(conflict) {
  // Check if either value contradicts foundation facts
  const existingContradiction = checkContradiction(conflict.key, conflict.existing);
  const proposedContradiction = checkContradiction(conflict.key, conflict.proposed);
  
  // If existing contradicts foundation facts but proposed doesn't
  if (existingContradiction && !proposedContradiction) {
    return {
      value: conflict.proposed,
      confidence: 0.95,
      explanation: `Existing value contradicts foundation fact: ${existingContradiction.factId}`
    };
  }
  
  // If proposed contradicts foundation facts but existing doesn't
  if (proposedContradiction && !existingContradiction) {
    return {
      value: conflict.existing,
      confidence: 0.95,
      explanation: `Proposed value contradicts foundation fact: ${proposedContradiction.factId}`
    };
  }
  
  // If both contradict or neither contradicts, this strategy can't help
  return null;
}

/**
 * Resolve conflict using explicit user feedback.
 * @param {Object} conflict - Conflict information
 * @returns {Object|null} Resolution result
 * @private
 */
function resolveUsingUserFeedback(conflict) {
  // Check if we have user feedback for this conflict
  const feedback = userFeedbackStore.get(conflict.id);
  
  if (feedback) {
    return {
      value: feedback.resolution,
      confidence: 0.9,
      explanation: 'Resolution based on explicit user feedback'
    };
  }
  
  return null;
}

/**
 * Resolve conflict based on source reliability.
 * @param {Object} conflict - Conflict information
 * @returns {Object|null} Resolution result
 * @private
 */
function resolveUsingSourceReliability(conflict) {
  const metadata = conflict.metadata || {};
  
  // If we don't have source reliability information, we can't use this strategy
  if (!metadata.existingSourceReliability && !metadata.proposedSourceReliability) {
    return null;
  }
  
  const existingReliability = metadata.existingSourceReliability || 0.5;
  const proposedReliability = metadata.proposedSourceReliability || 0.5;
  
  // If there's a significant difference in reliability
  const reliabilityDifference = Math.abs(existingReliability - proposedReliability);
  
  if (reliabilityDifference >= 0.2) {
    if (existingReliability > proposedReliability) {
      return {
        value: conflict.existing,
        confidence: Math.min(0.9, existingReliability),
        explanation: 'Existing source has higher reliability'
      };
    } else {
      return {
        value: conflict.proposed,
        confidence: Math.min(0.9, proposedReliability),
        explanation: 'Proposed source has higher reliability'
      };
    }
  }
  
  return null;
}

/**
 * Resolve conflict based on consistency with other knowledge.
 * @param {Object} conflict - Conflict information
 * @returns {Object|null} Resolution result
 * @private
 */
function resolveUsingConsistency(conflict) {
  const metadata = conflict.metadata || {};
  
  // If we don't have consistency scores, we can't use this strategy
  if (!metadata.existingConsistencyScore && !metadata.proposedConsistencyScore) {
    return null;
  }
  
  const existingConsistency = metadata.existingConsistencyScore || 0.5;
  const proposedConsistency = metadata.proposedConsistencyScore || 0.5;
  
  // If there's a significant difference in consistency
  const consistencyDifference = Math.abs(existingConsistency - proposedConsistency);
  
  if (consistencyDifference >= 0.2) {
    if (existingConsistency > proposedConsistency) {
      return {
        value: conflict.existing,
        confidence: Math.min(0.85, existingConsistency),
        explanation: 'Existing value is more consistent with other knowledge'
      };
    } else {
      return {
        value: conflict.proposed,
        confidence: Math.min(0.85, proposedConsistency),
        explanation: 'Proposed value is more consistent with other knowledge'
      };
    }
  }
  
  return null;
}

/**
 * Resolve conflict based on recency of information.
 * @param {Object} conflict - Conflict information
 * @returns {Object|null} Resolution result
 * @private
 */
function resolveUsingRecency(conflict) {
  const metadata = conflict.metadata || {};
  
  // If we don't have timestamp information, we can't use this strategy
  if (!metadata.existingTimestamp && !metadata.proposedTimestamp) {
    return null;
  }
  
  const existingDate = metadata.existingTimestamp ? new Date(metadata.existingTimestamp) : null;
  const proposedDate = metadata.proposedTimestamp ? new Date(metadata.proposedTimestamp) : new Date();
  
  // If existing date is missing, assume proposed is more recent
  if (!existingDate) {
    return {
      value: conflict.proposed,
      confidence: 0.7,
      explanation: 'Proposed value is more recent (existing timestamp unknown)'
    };
  }
  
  // Compare dates - for temporal facts, newer is generally better
  // But the confidence depends on how much newer it is
  const timeDifference = proposedDate - existingDate;
  const daysDifference = timeDifference / (1000 * 60 * 60 * 24);
  
  // For temporal conflicts, recency matters more
  const isTemporal = metadata.conflictType === CONFLICT_TYPE.TEMPORAL;
  
  if (daysDifference > 0) {
    // Proposed is newer
    const recencyConfidence = isTemporal ? 
      Math.min(0.9, 0.6 + Math.min(daysDifference / 30, 0.3)) : // Higher confidence for temporal facts
      Math.min(0.75, 0.5 + Math.min(daysDifference / 90, 0.25)); // Lower for other facts
      
    return {
      value: conflict.proposed,
      confidence: recencyConfidence,
      explanation: `Proposed value is more recent (${Math.round(daysDifference)} days newer)`
    };
  } else if (daysDifference < 0) {
    // Existing is newer (unusual case)
    const recencyConfidence = isTemporal ?
      Math.min(0.9, 0.6 + Math.min(Math.abs(daysDifference) / 30, 0.3)) :
      Math.min(0.75, 0.5 + Math.min(Math.abs(daysDifference) / 90, 0.25));
      
    return {
      value: conflict.existing,
      confidence: recencyConfidence,
      explanation: `Existing value is more recent (${Math.round(Math.abs(daysDifference))} days newer)`
    };
  }
  
  // Same timestamp, can't use recency
  return null;
}

/**
 * Detect the type of conflict based on the conflicting values.
 * @param {Object} conflict - Conflict information
 * @returns {string} Conflict type from CONFLICT_TYPE
 * @private
 */
function detectConflictType(conflict) {
  const metadata = conflict.metadata || {};
  
  // If explicitly specified, use that
  if (metadata.conflictType && CONFLICT_TYPE[metadata.conflictType.toUpperCase()]) {
    return metadata.conflictType;
  }
  
  // Check if it's a temporal conflict (involving dates)
  if (
    (conflict.existing instanceof Date || typeof conflict.existing === 'string' && !isNaN(Date.parse(conflict.existing))) &&
    (conflict.proposed instanceof Date || typeof conflict.proposed === 'string' && !isNaN(Date.parse(conflict.proposed)))
  ) {
    return CONFLICT_TYPE.TEMPORAL;
  }
  
  // Default to factual conflict
  return CONFLICT_TYPE.FACTUAL;
}

/**
 * Get a list of all unresolved conflicts.
 * @returns {Array<Object>} List of unresolved conflicts
 */
export function getUnresolvedConflicts() {
  // This would typically query from a conflict store
  // For now, return an empty array as a placeholder
  return [];
}

/**
 * Generate a human-readable explanation of a conflict resolution.
 * @param {Object} resolutionResult - Result from resolveConflict()
 * @returns {string} Human-readable explanation
 */
export function explainConflictResolution(resolutionResult) {
  const { key, resolution, strategy, confidence, explanation, conflictType } = resolutionResult;
  
  const confidencePercent = Math.round(confidence * 100);
  let strategyName = '';
  
  switch (strategy) {
    case RESOLUTION_STRATEGY.FOUNDATION_FACTS:
      strategyName = 'foundation facts';
      break;
    case RESOLUTION_STRATEGY.USER_FEEDBACK:
      strategyName = 'your feedback';
      break;
    case RESOLUTION_STRATEGY.SOURCE_RELIABILITY:
      strategyName = 'source reliability';
      break;
    case RESOLUTION_STRATEGY.CONSISTENCY:
      strategyName = 'consistency with other knowledge';
      break;
    case RESOLUTION_STRATEGY.RECENCY:
      strategyName = 'information recency';
      break;
    case RESOLUTION_STRATEGY.UNCERTAINTY:
      strategyName = 'uncertainty handling';
      break;
    default:
      strategyName = 'multiple factors';
  }
  
  if (resolution && resolution.isUncertain) {
    return `I found conflicting information about "${key}". ` +
           `I'm not confident enough to determine which is correct. ` +
           `The conflicting values are: ${JSON.stringify(resolution.alternatives)}. ` +
           `You can help by providing more information.`;
  }
  
  return `For "${key}", I resolved a ${conflictType} conflict based on ${strategyName} ` +
         `with ${confidencePercent}% confidence. ${explanation}`;
}

/**
 * Resolve multiple conflicts at once.
 * This is a convenience function for handling an array of conflicting statements.
 * 
 * @param {Array<Object>} conflicts - Array of conflicting statements
 * @param {Object} [options] - Resolution options
 * @returns {Object} Resolution result with resolved statements
 */
export function resolveConflicts(conflicts, options = {}) {
  // Validate input
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return { resolvedStatement: null, confidence: 0, explanation: "No conflicts to resolve" };
  }
  
  // For a simple conflict between two items, map to the single resolver
  if (conflicts.length === 2) {
    const conflict = {
      existing: conflicts[0].statement,
      proposed: conflicts[1].statement,
      metadata: {
        existingSource: conflicts[0].source,
        proposedSource: conflicts[1].source,
        existingConfidence: conflicts[0].confidence || 0.5,
        proposedConfidence: conflicts[1].confidence || 0.5,
        existingCategory: conflicts[0].category,
        proposedCategory: conflicts[1].category
      }
    };
    
    const resolution = resolveConflict(conflict, options);
    
    // Publish event about resolution
    publish('reasoning:conflicts-resolved', {
      conflicts,
      resolution,
      timestamp: new Date().toISOString()
    });
    
    return {
      resolvedStatement: resolution.value,
      confidence: resolution.confidence,
      explanation: resolution.explanation
    };
  }
  
  // For more complex multi-statement conflicts, we need more sophisticated resolution
  // For now, prioritize foundation facts, then by confidence
  let highestConfidence = -1;
  let bestStatement = null;
  
  for (const item of conflicts) {
    // Foundation facts always win
    if (item.source === 'foundation_fact' && item.confidence > 0.9) {
      return {
        resolvedStatement: item.statement,
        confidence: item.confidence,
        explanation: `Prioritized foundation fact: ${item.statement}`
      };
    }
    
    // Otherwise pick highest confidence
    if (item.confidence > highestConfidence) {
      highestConfidence = item.confidence;
      bestStatement = item.statement;
    }
  }
  
  // Publish event about resolution
  publish('reasoning:conflicts-resolved', {
    conflicts,
    resolution: {
      value: bestStatement,
      confidence: highestConfidence,
      strategy: 'confidence_based'
    },
    timestamp: new Date().toISOString()
  });
  
  return {
    resolvedStatement: bestStatement,
    confidence: highestConfidence,
    explanation: `Selected statement with highest confidence (${Math.round(highestConfidence * 100)}%)`
  };
}

// Export constants and functions for use in other modules
/**
 * Handle updates to foundation facts and check for any conflicts with existing knowledge.
 * @param {string} factId - ID of the foundation fact that was updated
 * @param {Object} updatedFact - The updated fact data
 */
export function handleFoundationFactUpdate(factId, updatedFact) {
  // Log the foundation fact update in the audit trail
  security.auditLog({
    action: 'conflict-resolver:foundation-fact-update',
    details: { factId, updatedFact },
    outcome: 'processing'
  });
  
  // Get potentially affected knowledge items that might conflict with this foundation fact
  const potentialConflicts = findPotentialConflicts(factId, updatedFact);
  
  if (potentialConflicts.length > 0) {
    // Process each potential conflict
    const conflicts = potentialConflicts.map(item => ({
      id: `foundation_update_${factId}_${Date.now()}`,
      key: item.key,
      existing: item.value,
      proposed: updatedFact.value,
      metadata: {
        existingSource: item.source || 'unknown',
        proposedSource: updatedFact.source || 'foundation-facts',
        existingConfidence: item.confidence || 0.5,
        proposedConfidence: updatedFact.confidence || 0.95,
        conflictType: CONFLICT_TYPE.FACTUAL,
        foundationFactId: factId
      }
    }));
    
    // Resolve the conflicts with foundation facts as highest priority
    const resolutions = resolveConflicts(conflicts, {
      strategies: [
        RESOLUTION_STRATEGY.FOUNDATION_FACTS,
        RESOLUTION_STRATEGY.SOURCE_RELIABILITY,
        RESOLUTION_STRATEGY.USER_FEEDBACK,
        RESOLUTION_STRATEGY.CONSISTENCY,
        RESOLUTION_STRATEGY.RECENCY
      ]
    });
    
    // Log the resolutions
    security.auditLog({
      action: 'conflict-resolver:foundation-conflicts-resolved',
      details: { factId, conflicts: conflicts.length, resolutions },
      outcome: 'processed'
    });
    
    // Publish an event with the resolutions
    publish('conflict:resolution-applied', {
      conflictSource: 'foundation-fact-update',
      factId,
      resolutions,
      involvedFacts: [factId]
    });
  } else {
    // No conflicts found
    security.auditLog({
      action: 'conflict-resolver:foundation-fact-update',
      details: { factId },
      outcome: 'no-conflicts-found'
    });
  }
}

/**
 * Handle removal of foundation facts and check for any dependent knowledge.
 * @param {string} factId - ID of the foundation fact that was removed
 */
export function handleFoundationFactRemoval(factId) {
  // Log the foundation fact removal in the audit trail
  security.auditLog({
    action: 'conflict-resolver:foundation-fact-removal',
    details: { factId },
    outcome: 'processing'
  });
  
  // Find knowledge that depends on this foundation fact
  const dependentKnowledge = findDependentKnowledge(factId);
  
  if (dependentKnowledge.length > 0) {
    // Mark dependent knowledge as potentially unreliable
    dependentKnowledge.forEach(item => {
      // Reduce confidence in this knowledge since its foundation is gone
      updateKnowledgeConfidence(item.id, Math.max(0.3, item.confidence * 0.6));
      
      // Add a note that this knowledge may need verification
      flagKnowledgeForVerification(item.id, {
        reason: `Foundation fact ${factId} was removed`,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    });
    
    // Log the dependent knowledge processing
    security.auditLog({
      action: 'conflict-resolver:dependent-knowledge-flagged',
      details: { factId, dependentItems: dependentKnowledge.length },
      outcome: 'processed'
    });
    
    // Publish an event about the dependent knowledge
    publish('conflict:dependent-knowledge-flagged', {
      factId,
      dependentItems: dependentKnowledge.length,
      verificationNeeded: true
    });
  } else {
    // No dependent knowledge found
    security.auditLog({
      action: 'conflict-resolver:foundation-fact-removal',
      details: { factId },
      outcome: 'no-dependencies-found'
    });
  }
}

/**
 * Find knowledge items that might conflict with an updated foundation fact.
 * @param {string} factId - Foundation fact ID
 * @param {Object} fact - Foundation fact data
 * @returns {Array<Object>} Potentially conflicting knowledge items
 * @private
 */
function findPotentialConflicts(factId, fact) {
  // This would normally query the knowledge store for potentially conflicting items
  // For now, we'll return an empty array as a placeholder
  // In a real implementation, we would search for knowledge related to this fact
  return [];
}

/**
 * Find knowledge items that depend on a particular foundation fact.
 * @param {string} factId - Foundation fact ID
 * @returns {Array<Object>} Dependent knowledge items
 * @private
 */
function findDependentKnowledge(factId) {
  // This would normally query the knowledge store for items that depend on this fact
  // For now, we'll return an empty array as a placeholder
  return [];
}

/**
 * Update the confidence score for a knowledge item.
 * @param {string} itemId - Knowledge item ID
 * @param {number} newConfidence - New confidence value (0-1)
 * @returns {boolean} Success of the operation
 * @private
 */
function updateKnowledgeConfidence(itemId, newConfidence) {
  // This would normally update the knowledge store
  // For now, we'll just return true as a placeholder
  return true;
}

/**
 * Flag a knowledge item as needing verification.
 * @param {string} itemId - Knowledge item ID
 * @param {Object} flagData - Flag information
 * @returns {boolean} Success of the operation
 * @private
 */
function flagKnowledgeForVerification(itemId, flagData) {
  // This would normally update the knowledge store
  // For now, we'll just return true as a placeholder
  return true;
}

export { RESOLUTION_STRATEGY, CONFLICT_TYPE, CONFIDENCE_THRESHOLD };
