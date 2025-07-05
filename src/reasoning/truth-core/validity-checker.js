/**
 * ALEJO Validity Checker
 * 
 * This module validates new statements against the foundation facts database
 * and detects logical inconsistencies. It ensures that ALEJO's reasoning
 * remains consistent with established foundational knowledge.
 * 
 * The validity checker serves as a cornerstone of ALEJO's reasoning engine,
 * preventing logical inconsistencies and ensuring all reasoning follows sound
 * principles backed by foundation facts.
 * 
 * Based on MIT Media Lab research (2025) on logical consistency validation
 * for AI reasoning systems.
 */
import { publish, subscribe } from '../../core/events.js';
import { 
  getFact, 
  getFactValue, 
  checkContradiction, 
  getFactsByCategory,
  searchFacts,
  checkAdvancedContradiction,
  CONFIDENCE, 
  CATEGORIES 
} from './foundation-facts.js';
import { resolveConflict } from '../correction/conflict-resolver.js';
import * as security from '../../security/index.js';
import * as feedback from '../correction/feedback-loop.js';

// Constants for security permissions
const PERMISSIONS = {
  USE_VALIDATOR: 'reasoning:use-validator',
  VIEW_VALIDATION_LOGS: 'reasoning:view-validation-logs',
  OVERRIDE_VALIDATION: 'reasoning:override-validation'
};

/**
 * Validation result levels
 */
const VALIDITY = {
  VALID: 'valid',                     // Statement is consistent with foundation facts
  CONTRADICTS_FOUNDATION: 'contradicts_foundation', // Statement contradicts foundation facts
  LOGICALLY_INCONSISTENT: 'logically_inconsistent', // Statement is internally inconsistent
  UNCERTAIN: 'uncertain',             // Cannot determine validity
  POTENTIALLY_MISLEADING: 'potentially_misleading', // Statement may be misleading
  FALLACIOUS: 'fallacious'           // Statement contains logical fallacies
};

/**
 * Logical relation types between statements
 */
const LOGICAL_RELATIONS = {
  EQUIVALENT: 'equivalent',           // Statements are logically equivalent
  CONTRADICTORY: 'contradictory',     // Statements contradict each other
  INDEPENDENT: 'independent',         // Statements are logically independent
  IMPLICATION: 'implication',         // One statement implies the other
  PROBABILISTIC: 'probabilistic'      // Statements have probabilistic relationship
};

/**
 * Common logical fallacies that can be detected
 */
const FALLACIES = {
  AD_HOMINEM: 'ad_hominem',          // Attacking the person instead of the argument
  APPEAL_TO_AUTHORITY: 'appeal_to_authority', // Using authority as the primary evidence
  APPEAL_TO_EMOTION: 'appeal_to_emotion',  // Using emotions as the primary argument
  APPEAL_TO_NATURE: 'appeal_to_nature',  // Assuming natural is automatically good
  BANDWAGON: 'bandwagon',           // Arguing something is right because it's popular
  BEGGING_QUESTION: 'begging_question', // Circular reasoning
  FALSE_DICHOTOMY: 'false_dichotomy', // Presenting only two options when more exist
  HASTY_GENERALIZATION: 'hasty_generalization', // Drawing conclusions from insufficient data
  POST_HOC: 'post_hoc',             // Assuming correlation implies causation
  SLIPPERY_SLOPE: 'slippery_slope',  // Arguing that one small step leads to extreme consequences
  STRAW_MAN: 'straw_man',           // Misrepresenting an argument to make it easier to attack
  NO_TRUE_SCOTSMAN: 'no_true_scotsman', // Modifying a generalization to avoid counterexamples
  RED_HERRING: 'red_herring',       // Introducing irrelevant topics to distract
  MIDDLE_GROUND: 'middle_ground'    // Assuming the middle position is always correct
};

// Initialize validation cache to improve performance
const validationCache = new Map();
const cacheMaxSize = 1000;

// Subscribe to events that might invalidate the cache
subscribe('reasoning:foundation-facts-updated', () => validationCache.clear());
subscribe('reasoning:conflict-resolved', () => validationCache.clear());

/**
 * Generate a cache key for a statement
 * @private
 * @param {Object} statement - { key: string, value: any }
 * @returns {string} - Cache key
 */
function getCacheKey(statement) {
  return `${statement.key}:${JSON.stringify(statement.value)}`;
}

/**
 * Add an entry to the validation cache with LRU eviction
 * @private
 * @param {string} key - Cache key
 * @param {Object} value - Value to cache
 */
function addToCache(key, value) {
  // If cache is full, remove oldest entry
  if (validationCache.size >= cacheMaxSize) {
    const oldestKey = validationCache.keys().next().value;
    validationCache.delete(oldestKey);
  }
  validationCache.set(key, value);
}

/**
 * Check if a statement conflicts with foundation facts.
 * @param {Object} statement - { key: string, value: any }
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.useCache=true] - Whether to use cache
 * @param {boolean} [options.resolveConflicts=true] - Whether to attempt conflict resolution
 * @param {boolean} [options.checkFallacies=true] - Whether to check for logical fallacies
 * @param {boolean} [options.useAdvancedCheck=true] - Whether to use advanced contradiction detection
 * @param {string} [options.requestedBy] - User ID or system component requesting validation
 * @param {Object} [options.context] - Additional context for advanced validation
 * @returns {Object} - { validity: string, confidence: number, details: Object }
 */
export async function validateStatement(statement, options = {}) {
  const { 
    useCache = true, 
    resolveConflicts = true, 
    checkFallacies = true,
    useAdvancedCheck = true,
    requestedBy = 'system',
    context = {}
  } = options;
  
  // Security check - requires permission to use validator
  if (!await security.checkPermission(PERMISSIONS.USE_VALIDATOR)) {
    security.auditLog({
      action: 'validity-checker:unauthorized-validation-attempt',
      details: { statement, requestedBy },
      outcome: 'denied'
    });
    
    publish('reasoning:unauthorized-operation', { 
      operation: 'validate-statement', 
      statement: statement.key 
    });
    
    throw new Error('Permission denied: reasoning:use-validator required');
  }
  
  // Check cache first if enabled
  if (useCache) {
    const cacheKey = getCacheKey(statement);
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult) {
      // Log cache hit
      security.auditLog({
        action: 'validity-checker:cache-hit',
        details: { statement: statement.key, requestedBy },
        outcome: 'success'
      });
      return cachedResult;
    }
  }
  
  // Log the validation attempt
  security.auditLog({
    action: 'validity-checker:validation-request',
    details: { statement, requestedBy },
    outcome: 'processing'
  });
  
  // Check for potential fallacies first if enabled
  if (checkFallacies) {
    const fallacyResult = checkForFallacies(statement);
    if (fallacyResult.hasFallacy) {
      const result = {
        validity: VALIDITY.FALLACIOUS,
        confidence: fallacyResult.confidence,
        details: {
          statement,
          fallacyType: fallacyResult.fallacyType,
          reason: fallacyResult.reason,
          explanation: fallacyResult.explanation
        }
      };
      
      if (useCache) {
        addToCache(getCacheKey(statement), result);
      }
      
      // Log the fallacy detection
      security.auditLog({
        action: 'validity-checker:fallacy-detected',
        details: { statement: statement.key, fallacy: fallacyResult.fallacyType, requestedBy },
        outcome: 'rejected'
      });
      
      publish('reasoning:validation-result', result);
      
      // Record feedback for fallacy detection
      feedback.recordFeedback({
        category: 'logical_fallacy',
        targetId: statement.key,
        targetType: 'statement',
        description: `Detected ${fallacyResult.fallacyType} fallacy: ${fallacyResult.explanation}`,
        impactLevel: 'medium',
        confidence: fallacyResult.confidence,
        source: 'validity_checker',
        metadata: {
          statement: statement,
          fallacyDetails: fallacyResult
        }
      });
      
      return result;
    }
  }
  
  // Use advanced contradiction check if enabled
  let contradictionResult;
  if (useAdvancedCheck && context) {
    contradictionResult = checkAdvancedContradiction({
      key: statement.key,
      value: statement.value,
      category: statement.category,
      description: statement.description
    }, context);
  } else {
    // Use standard contradiction check
    contradictionResult = checkContradiction(statement.key, statement.value);
  }
  
  if (contradictionResult) {
    // If conflict resolution is enabled, try to resolve the conflict
    if (resolveConflicts) {
      const resolution = resolveConflict({
        id: `validation_${statement.key}_${Date.now()}`,
        key: statement.key,
        existing: contradictionResult.fact.value,
        proposed: statement.value,
        metadata: {
          conflictType: 'factual',
          existingSource: 'foundation-facts',
          proposedSource: statement.source || 'unknown',
          existingConfidence: contradictionResult.fact.confidence,
          proposedConfidence: statement.confidence || 0.5
        }
      });
      
      // If resolution was successful and favors the new statement
      if (resolution && resolution.resolution && 
          JSON.stringify(resolution.resolution) === JSON.stringify(statement.value)) {
        const result = {
          validity: VALIDITY.VALID,
          confidence: resolution.confidence,
          details: {
            statement,
            resolution,
            reason: `Statement accepted after conflict resolution: ${resolution.explanation}`
          }
        };
        
        if (useCache) {
          addToCache(getCacheKey(statement), result);
        }
        
        // Log the conflict resolution
        security.auditLog({
          action: 'validity-checker:conflict-resolved',
          details: { 
            statement: statement.key, 
            conflictedFact: contradictionResult.factId,
            resolution: 'accepted_new',
            requestedBy 
          },
          outcome: 'accepted'
        });
        
        publish('reasoning:validation-result', result);
        return result;
      }
    }
    
    // If no resolution or resolution favors foundation fact
    const result = {
      validity: VALIDITY.CONTRADICTS_FOUNDATION,
      confidence: contradictionResult.fact.confidence,
      details: {
        statement,
        contradictedFact: contradictionResult.fact,
        reason: `Statement contradicts foundation fact: ${contradictionResult.fact.description}`,
        explanation: contradictionResult.explanation
      }
    };
    
    if (useCache) {
      addToCache(getCacheKey(statement), result);
    }
    
    // Log the contradiction
    security.auditLog({
      action: 'validity-checker:contradiction-detected',
      details: { 
        statement: statement.key, 
        contradictedFact: contradictionResult.factId,
        requestedBy 
      },
      outcome: 'rejected'
    });
    
    // Record feedback for contradiction
    feedback.recordFeedback({
      category: 'factual_error',
      targetId: statement.key,
      targetType: 'statement',
      description: `Statement contradicts foundation fact: ${contradictionResult.fact.description}`,
      impactLevel: 'high',
      confidence: contradictionResult.fact.confidence,
      source: 'validity_checker',
      metadata: {
        statement: statement,
        contradictedFact: contradictionResult.fact
      }
    });
    
    publish('reasoning:validation-result', result);
    return result;
  }
  
  // Check for logical consistency within the statement itself
  const internalConsistencyResult = checkInternalConsistency(statement);
  if (!internalConsistencyResult.consistent) {
    const result = {
      validity: VALIDITY.LOGICALLY_INCONSISTENT,
      confidence: internalConsistencyResult.confidence,
      details: {
        statement,
        reason: internalConsistencyResult.reason
      }
    };
    
    if (useCache) {
      addToCache(getCacheKey(statement), result);
    }
    
    // Log the inconsistency
    security.auditLog({
      action: 'validity-checker:internal-inconsistency',
      details: { 
        statement: statement.key, 
        reason: internalConsistencyResult.reason,
        requestedBy 
      },
      outcome: 'rejected'
    });
    
    // Record feedback for logical inconsistency
    feedback.recordFeedback({
      category: 'logical_inconsistency',
      targetId: statement.key,
      targetType: 'statement',
      description: internalConsistencyResult.reason,
      impactLevel: 'medium',
      confidence: internalConsistencyResult.confidence,
      source: 'validity_checker',
      metadata: {
        statement: statement,
        inconsistencyDetails: internalConsistencyResult
      }
    });
    
    publish('reasoning:validation-result', result);
    return result;
  }
  
  // If no direct contradiction, the statement is considered valid
  const result = {
    validity: VALIDITY.VALID,
    confidence: 1.0,
    details: {
      statement,
      reason: 'Statement does not contradict any foundation facts and is internally consistent'
    }
  };
  
  if (useCache) {
    addToCache(getCacheKey(statement), result);
  }
  
  // Log the successful validation
  security.auditLog({
    action: 'validity-checker:validation-success',
    details: { statement: statement.key, requestedBy },
    outcome: 'success'
  });
  
  publish('reasoning:validation-result', result);
  return result;
}

/**
 * Check for logical fallacies in a statement
 * @private
 * @param {Object} statement - { key: string, value: any }
 * @returns {Object} - { hasFallacy: boolean, fallacyType: string, confidence: number, reason: string, explanation: string }
 */
function checkForFallacies(statement) {
  // Default response for no fallacy detected
  const defaultResponse = {
    hasFallacy: false,
    fallacyType: null,
    confidence: 0,
    reason: '',
    explanation: ''
  };
  
  // Only check string values for fallacies
  if (typeof statement.value !== 'string') {
    return defaultResponse;
  }
  
  const value = statement.value.toLowerCase();
  
  // Array of fallacy pattern checks - each returns null or a fallacy detection result
  const fallacyChecks = [
    // Ad Hominem detection
    () => {
      const patterns = [
        /\b(?:because|since)\s+(?:(?:he|she|they)\s+(?:is|are)|someone\s+is)\s+(?:a|an)\s+[\w\s]*(?:idiot|stupid|dumb|fool|ignorant|corrupt|biased|evil)/i,
        /\b(?:don't|do not)\s+(?:listen to|believe|trust)\s+[\w\s]+\s+(?:because|as)\s+(?:(?:he|she|they)\s+(?:is|are)|someone\s+is)/i,
        /\b(?:argument|statement|claim|opinion)\s+is\s+(?:invalid|wrong|false|incorrect)\s+because\s+(?:(?:he|she|they)\s+(?:is|are)|someone\s+is)/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          return {
            hasFallacy: true,
            fallacyType: FALLACIES.AD_HOMINEM,
            confidence: 0.85,
            reason: 'Statement attacks the person rather than addressing their argument',
            explanation: 'The statement dismisses an argument based on a characteristic or perceived flaw of the person making it, rather than addressing the argument itself.'
          };
        }
      }
      return null;
    },
    
    // Appeal to Authority detection
    () => {
      const patterns = [
        /\b(?:because|since)\s+(?:Dr|Professor|Prof|expert|scientist|researcher|authority|specialist)\s+[\w\s]+\s+(?:says|said|believes|claims|states)/i,
        /\b(?:according to|as per)\s+(?:famous|respected|renowned|leading|top)\s+[\w\s]+,/i,
        /\b(?:must|should)\s+be\s+(?:true|right|correct|valid)\s+(?:because|since)\s+[\w\s]+\s+(?:says|said|believes|claims)/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          // Check if there's actual evidence or reasoning provided
          if (!/(evidence|data|experiment|study|research|because|since)\s+(shows|indicates|demonstrates|proves|supports)/i.test(value)) {
            return {
              hasFallacy: true,
              fallacyType: FALLACIES.APPEAL_TO_AUTHORITY,
              confidence: 0.75, // Lower confidence as some appeals to experts are valid
              reason: 'Statement relies primarily on authority rather than evidence',
              explanation: 'The statement uses authority as the primary basis for an argument without providing supporting evidence or reasoning.'
            };
          }
        }
      }
      return null;
    },
    
    // False Dichotomy detection
    () => {
      const patterns = [
        /\b(?:either|it's either|it is either)\s+[\w\s,]+\s+or\s+[\w\s,]+$/i,
        /\bthere\s+(?:are|is)\s+only\s+(?:two|2)\s+(?:options|choices|possibilities|alternatives)/i,
        /\b(?:if not|if it's not|if it is not)\s+[\w\s,]+,\s+(?:then|it must be|it has to be)\s+[\w\s,]+$/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          // Check if the statement is about a genuinely binary situation
          const genuinelyBinary = [
            /\b(?:true|false)\s+in\s+formal\s+logic\b/i,
            /\b(?:alive|dead)\s+in\s+biological\s+terms\b/i,
            /\b(?:even|odd)\s+(?:number|integer)\b/i
          ];
          
          if (!genuinelyBinary.some(pattern => pattern.test(value))) {
            return {
              hasFallacy: true,
              fallacyType: FALLACIES.FALSE_DICHOTOMY,
              confidence: 0.8,
              reason: 'Statement presents a false choice between only two alternatives',
              explanation: 'The statement artificially restricts possibilities to only two options when other alternatives may exist.'
            };
          }
        }
      }
      return null;
    },
    
    // Slippery Slope detection
    () => {
      const patterns = [
        /\bif\s+(?:we|you|they)\s+(?:allow|permit|accept|do)\s+[\w\s,]+,\s+(?:next|then|eventually)\s+[\w\s,]+\s+(?:will|would|could)\s+(?:happen|occur|follow|result)/i,
        /\b(?:leads|lead|leading)\s+to\s+a\s+slippery\s+slope\b/i,
        /\b(?:first step|gateway|opens the door)\s+to\s+[\w\s,]+$/i,
        /\b(?:today|now)\s+[\w\s,]+,\s+(?:tomorrow|next)\s+[\w\s,]+$/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          // Check if there's evidence for the causal chain
          if (!/(evidence|data|history|research|studies)\s+(shows|indicates|demonstrates|proves|supports)\s+this\s+(progression|sequence|chain\s+of\s+events)/i.test(value)) {
            return {
              hasFallacy: true,
              fallacyType: FALLACIES.SLIPPERY_SLOPE,
              confidence: 0.8,
              reason: 'Statement claims one event will inevitably lead to extreme consequences',
              explanation: 'The statement argues that a relatively small first step inevitably leads to significant negative consequences without adequate justification for this chain of causation.'
            };
          }
        }
      }
      return null;
    },
    
    // Post Hoc Fallacy detection
    () => {
      const patterns = [
        /\b(?:because|since)\s+[\w\s,]+\s+(?:happened|occurred)\s+(?:before|prior to)\s+[\w\s,]+,\s+(?:it|the former)\s+(?:caused|created|led to|resulted in)\s+(?:it|the latter)/i,
        /\b(?:after|following)\s+[\w\s,]+,\s+[\w\s,]+\s+(?:happened|occurred|began|started|appeared|emerged)/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          // Check if there's evidence for causation beyond timing
          if (!/(controlled|experimental|statistical|analysis|mechanism|pathway)\s+(shows|indicates|demonstrates|proves|supports|explains)\s+causation/i.test(value)) {
            return {
              hasFallacy: true,
              fallacyType: FALLACIES.POST_HOC,
              confidence: 0.8,
              reason: 'Statement assumes causation from mere temporal sequence',
              explanation: 'The statement assumes that because one event followed another, the first event caused the second, without sufficient evidence of a causal relationship.'
            };
          }
        }
      }
      return null;
    }
  ];
  
  // Run through all fallacy checks
  for (const check of fallacyChecks) {
    const result = check();
    if (result) {
      return result;
    }
  }
  
  return defaultResponse;
}

/**
 * Check internal logical consistency of a statement
 * @private
 * @param {Object} statement - { key: string, value: any }
 * @returns {Object} - { consistent: boolean, confidence: number, reason: string }
 */
function checkInternalConsistency(statement) {
  // This is a simplified implementation that could be expanded with more sophisticated logic
  
  // Check for self-contradictory statements
  if (typeof statement.value === 'string') {
    // Check for obvious contradictions like "X and not X"
    const value = statement.value.toLowerCase();
    
    // Simple pattern matching for contradictions
    if (
      (value.includes(' and not ') || value.includes(' but not ')) &&
      value.split(' and not ').some(part => 
        value.includes(part.trim()) && value.includes(`not ${part.trim()}`)
      )
    ) {
      return {
        consistent: false,
        confidence: 0.9,
        reason: 'Statement contains internal contradiction (X and not X pattern)'
      };
    }
    
    // Check for statements that violate basic logical principles
    const logicalFacts = getFactsByCategory(CATEGORIES.LOGIC);
    for (const fact of logicalFacts) {
      // This is a simplified check that could be expanded
      if (fact.id === 'law_of_non_contradiction' && 
          value.includes('both true and false')) {
        return {
          consistent: false,
          confidence: 1.0,
          reason: `Statement violates ${fact.description}`
        };
      }
    }
  }
  
  // For now, assume other statements are internally consistent
  return { consistent: true, confidence: 1.0, reason: 'No internal inconsistency detected' };
}

/**
 * Determine the logical relation between two statements
 * @private
 * @param {Object} statement1 - First statement { key: string, value: any }
 * @param {Object} statement2 - Second statement { key: string, value: any }
 * @returns {Object} - { relation: string, confidence: number, explanation: string }
 */
function determineLogicalRelation(statement1, statement2) {
  // If statements have the same key, check their values
  if (statement1.key === statement2.key) {
    // If values are identical, statements are equivalent
    if (JSON.stringify(statement1.value) === JSON.stringify(statement2.value)) {
      return {
        relation: LOGICAL_RELATIONS.EQUIVALENT,
        confidence: 1.0,
        explanation: 'Statements have identical keys and values'
      };
    }
    
    // If values are different, they might be contradictory
    // This is a simplified check that could be expanded with more sophisticated logic
    if (typeof statement1.value === 'boolean' && typeof statement2.value === 'boolean' &&
        statement1.value !== statement2.value) {
      return {
        relation: LOGICAL_RELATIONS.CONTRADICTORY,
        confidence: 1.0,
        explanation: 'Statements have the same key but opposite boolean values'
      };
    }
    
    // For string values, check for direct negation patterns
    if (typeof statement1.value === 'string' && typeof statement2.value === 'string') {
      const val1 = statement1.value.toLowerCase();
      const val2 = statement2.value.toLowerCase();
      
      // Check for simple negation patterns
      if ((val1.startsWith('not ') && val1.substring(4) === val2) ||
          (val2.startsWith('not ') && val2.substring(4) === val1)) {
        return {
          relation: LOGICAL_RELATIONS.CONTRADICTORY,
          confidence: 0.9,
          explanation: 'One statement directly negates the other'
        };
      }
    }
  }
  
  // Check for implication relationships based on foundation facts
  // This is a simplified implementation that could be expanded
  const logicalFacts = getFactsByCategory(CATEGORIES.LOGIC);
  for (const fact of logicalFacts) {
    if (fact.id === 'modus_ponens' && 
        statement1.key === 'implication' && 
        statement1.value.antecedent === statement2.key && 
        statement2.value === true) {
      return {
        relation: LOGICAL_RELATIONS.IMPLICATION,
        confidence: 0.9,
        explanation: 'First statement implies the second via modus ponens'
      };
    }
  }
  
  // Default to independent if no relation is detected
  return {
    relation: LOGICAL_RELATIONS.INDEPENDENT,
    confidence: 0.7,
    explanation: 'No logical relation detected between statements'
  };
}

/**
 * Validate logical consistency between multiple statements.
 * @param {Array<Object>} statements - Array of { key: string, value: any } objects
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.useCache=true] - Whether to use cache
 * @param {boolean} [options.resolveConflicts=true] - Whether to attempt conflict resolution
 * @param {boolean} [options.checkFallacies=true] - Whether to check for logical fallacies
 * @param {boolean} [options.useAdvancedCheck=true] - Whether to use advanced contradiction detection
 * @param {string} [options.requestedBy] - User ID or system component requesting validation
 * @param {Object} [options.context] - Additional context for advanced validation
 * @returns {Object} - { validity: string, confidence: number, details: Object }
 */
export async function validateConsistency(statements, options = {}) {
  const { 
    useCache = true, 
    resolveConflicts = true,
    checkFallacies = true,
    useAdvancedCheck = true,
    requestedBy = 'system',
    context = {}
  } = options;
  
  // Security check - requires permission to use validator
  if (!await security.checkPermission(PERMISSIONS.USE_VALIDATOR)) {
    security.auditLog({
      action: 'validity-checker:unauthorized-consistency-check-attempt',
      details: { statementCount: statements?.length || 0, requestedBy },
      outcome: 'denied'
    });
    
    publish('reasoning:unauthorized-operation', { 
      operation: 'validate-consistency', 
      statementCount: statements?.length || 0
    });
    
    throw new Error('Permission denied: reasoning:use-validator required');
  }
  
  // Log the validation attempt
  security.auditLog({
    action: 'validity-checker:consistency-check-request',
    details: { statementCount: statements?.length || 0, requestedBy },
    outcome: 'processing'
  });
  
  // If no statements or only one statement, delegate to validateStatement
  if (!statements || statements.length === 0) {
    const result = {
      validity: VALIDITY.VALID,
      confidence: 1.0,
      details: {
        statements: [],
        reason: 'No statements to validate'
      }
    };
    
    publish('reasoning:consistency-result', result);
    return result;
  }
  
  if (statements.length === 1) {
    return validateStatement(statements[0], options);
  }
  
  try {
    // Check each statement against foundation facts
    const individualResults = await Promise.all(
      statements.map(stmt => validateStatement(stmt, options))
    );
    
    // If any statement contradicts foundation facts, the set is inconsistent
    const contradictions = individualResults.filter(r => r.validity === VALIDITY.CONTRADICTS_FOUNDATION);
    if (contradictions.length > 0) {
      const result = {
        validity: VALIDITY.CONTRADICTS_FOUNDATION,
        confidence: Math.max(...contradictions.map(r => r.confidence)),
        details: {
          statements,
          contradictions: contradictions.map(r => r.details),
          reason: 'One or more statements contradict foundation facts'
        }
      };
      
      security.auditLog({
        action: 'validity-checker:consistency-check-result',
        details: { 
          statementCount: statements.length, 
          result: 'contradicts_foundation',
          contradictionCount: contradictions.length,
          requestedBy 
        },
        outcome: 'completed'
      });
      
      // Record feedback for contradictions
      feedback.recordFeedback({
        category: 'factual_error',
        targetId: `consistency_check_${Date.now()}`,
        targetType: 'statement_set',
        description: `${contradictions.length} statements contradict foundation facts`,
        impactLevel: 'high',
        confidence: result.confidence,
        source: 'validity_checker',
        metadata: {
          statements: statements.map(s => s.key),
          contradictionDetails: contradictions.map(c => c.details)
        }
      });
      
      publish('reasoning:consistency-result', result);
      return result;
    }
    
    // Check for fallacies in each statement if enabled
    if (checkFallacies) {
      const fallacies = [];
      
      for (const statement of statements) {
        const fallacyResult = checkForFallacies(statement);
        if (fallacyResult.hasFallacy) {
          fallacies.push({
            statement,
            fallacyResult
          });
        }
      }
      
      if (fallacies.length > 0) {
        const result = {
          validity: VALIDITY.FALLACIOUS,
          confidence: Math.max(...fallacies.map(f => f.fallacyResult.confidence)),
          details: {
            statements,
            fallacies,
            reason: `Found ${fallacies.length} logical fallacies in statements`
          }
        };
        
        security.auditLog({
          action: 'validity-checker:fallacies-in-statement-set',
          details: { 
            statementCount: statements.length,
            fallacyCount: fallacies.length,
            fallacyTypes: fallacies.map(f => f.fallacyResult.fallacyType),
            requestedBy 
          },
          outcome: 'rejected'
        });
        
        publish('reasoning:consistency-result', result);
        return result;
      }
    }
    
    // Check for logical inconsistencies between statements
    const inconsistencies = [];
    
    // Compare each pair of statements
    for (let i = 0; i < statements.length; i++) {
      for (let j = i + 1; j < statements.length; j++) {
        const relation = determineLogicalRelation(statements[i], statements[j]);
        
        // If statements are contradictory, the set is inconsistent
        if (relation.relation === LOGICAL_RELATIONS.CONTRADICTORY) {
          inconsistencies.push({
            statement1: statements[i],
            statement2: statements[j],
            relation
          });
        }
      }
    }
    
    // If inconsistencies were found, return them
    if (inconsistencies.length > 0) {
      const result = {
        validity: VALIDITY.LOGICALLY_INCONSISTENT,
        confidence: Math.max(...inconsistencies.map(i => i.relation.confidence)),
        details: {
          statements,
          inconsistencies,
          reason: `Found ${inconsistencies.length} logical inconsistencies between statements`
        }
      };
      
      security.auditLog({
        action: 'validity-checker:logical-inconsistencies',
        details: { 
          statementCount: statements.length,
          inconsistencyCount: inconsistencies.length,
          requestedBy 
        },
        outcome: 'rejected'
      });
      
      // Record feedback for inconsistencies
      feedback.recordFeedback({
        category: 'logical_inconsistency',
        targetId: `consistency_check_${Date.now()}`,
        targetType: 'statement_set',
        description: `Found ${inconsistencies.length} logical inconsistencies between statements`,
        impactLevel: 'medium',
        confidence: result.confidence,
        source: 'validity_checker',
        metadata: {
          statements: statements.map(s => s.key),
          inconsistencyDetails: inconsistencies
        }
      });
      
      publish('reasoning:consistency-result', result);
      return result;
    }
    
    // If no inconsistencies were found, the set is valid
    const result = {
      validity: VALIDITY.VALID,
      confidence: 1.0,
      details: {
        statements,
        reason: 'No inconsistencies detected between statements'
      }
    };
    
    security.auditLog({
      action: 'validity-checker:consistency-check-result',
      details: { 
        statementCount: statements.length, 
        result: 'valid',
        requestedBy 
      },
      outcome: 'success'
    });
    
    publish('reasoning:consistency-result', result);
    return result;
  } catch (error) {
    // Handle errors during validation
    const result = {
      validity: VALIDITY.UNCERTAIN,
      confidence: 0.5,
      details: {
        statements,
        error: error.message,
        reason: 'Error occurred during consistency validation'
      }
    };
    
    security.auditLog({
      action: 'validity-checker:consistency-check-error',
      details: { 
        statementCount: statements?.length || 0, 
        error: error.message,
        requestedBy 
      },
      outcome: 'error'
    });
    
    publish('reasoning:validation-error', {
      operation: 'validateConsistency',
      error: error.message,
      statementCount: statements?.length || 0
    });
    
    return result;
  }
}

/**
 * Check if a conclusion can be derived from premises using modus ponens
 * @private
 * @param {Array<Object>} premises - Array of premises
 * @param {Object} conclusion - The conclusion to check
 * @returns {Object} - { valid: boolean, confidence: number, explanation: string }
 */
function checkModusPonens(premises, conclusion) {
  // Look for implication statements in premises
  for (const premise of premises) {
    if (premise.key === 'implication' && typeof premise.value === 'object') {
      const { antecedent, consequent } = premise.value;
      
      // Check if the antecedent is among the premises
      const antecedentPremise = premises.find(p => p.key === antecedent && p.value === true);
      
      // If antecedent is present and conclusion matches consequent, modus ponens applies
      if (antecedentPremise && conclusion.key === consequent && conclusion.value === true) {
        return {
          valid: true,
          confidence: 1.0,
          explanation: `Valid modus ponens: If ${antecedent} then ${consequent}, and ${antecedent} is true, therefore ${consequent} is true`
        };
      }
    }
  }
  
  return { valid: false, confidence: 0, explanation: 'No modus ponens pattern found' };
}

/**
 * Check if a conclusion can be derived from premises using modus tollens
 * @private
 * @param {Array<Object>} premises - Array of premises
 * @param {Object} conclusion - The conclusion to check
 * @returns {Object} - { valid: boolean, confidence: number, explanation: string }
 */
function checkModusTollens(premises, conclusion) {
  // Look for implication statements in premises
  for (const premise of premises) {
    if (premise.key === 'implication' && typeof premise.value === 'object') {
      const { antecedent, consequent } = premise.value;
      
      // Check if the negation of consequent is among the premises
      const notConsequentPremise = premises.find(p => 
        p.key === consequent && p.value === false);
      
      // If not-consequent is present and conclusion is not-antecedent, modus tollens applies
      if (notConsequentPremise && conclusion.key === antecedent && conclusion.value === false) {
        return {
          valid: true,
          confidence: 1.0,
          explanation: `Valid modus tollens: If ${antecedent} then ${consequent}, and ${consequent} is false, therefore ${antecedent} is false`
        };
      }
    }
  }
  
  return { valid: false, confidence: 0, explanation: 'No modus tollens pattern found' };
}

/**
 * Check if a conclusion can be derived from premises using hypothetical syllogism
 * @private
 * @param {Array<Object>} premises - Array of premises
 * @param {Object} conclusion - The conclusion to check
 * @returns {Object} - { valid: boolean, confidence: number, explanation: string }
 */
function checkHypotheticalSyllogism(premises, conclusion) {
  // Look for two implication statements that can be chained
  const implications = premises.filter(p => p.key === 'implication' && typeof p.value === 'object');
  
  for (let i = 0; i < implications.length; i++) {
    for (let j = 0; j < implications.length; j++) {
      if (i !== j) {
        const first = implications[i].value;
        const second = implications[j].value;
        
        // If first consequent matches second antecedent
        if (first.consequent === second.antecedent) {
          // Check if conclusion is an implication from first antecedent to second consequent
          if (conclusion.key === 'implication' && 
              typeof conclusion.value === 'object' &&
              conclusion.value.antecedent === first.antecedent &&
              conclusion.value.consequent === second.consequent) {
            return {
              valid: true,
              confidence: 1.0,
              explanation: `Valid hypothetical syllogism: If ${first.antecedent} then ${first.consequent}, and if ${second.antecedent} then ${second.consequent}, therefore if ${first.antecedent} then ${second.consequent}`
            };
          }
        }
      }
    }
  }
  
  return { valid: false, confidence: 0, explanation: 'No hypothetical syllogism pattern found' };
}

/**
 * Check if a conclusion can be derived from premises using disjunctive syllogism
 * @private
 * @param {Array<Object>} premises - Array of premises
 * @param {Object} conclusion - The conclusion to check
 * @returns {Object} - { valid: boolean, confidence: number, explanation: string }
 */
function checkDisjunctiveSyllogism(premises, conclusion) {
  // Look for disjunction statements (OR)
  for (const premise of premises) {
    if (premise.key === 'disjunction' && Array.isArray(premise.value)) {
      const options = premise.value;
      
      // Check if all but one option are negated in the premises
      const negatedOptions = options.filter(option => {
        return premises.some(p => p.key === option && p.value === false);
      });
      
      // If all but one option are negated, the remaining one must be true
      if (negatedOptions.length === options.length - 1) {
        const remainingOption = options.find(opt => !negatedOptions.includes(opt));
        
        if (conclusion.key === remainingOption && conclusion.value === true) {
          return {
            valid: true,
            confidence: 1.0,
            explanation: `Valid disjunctive syllogism: Either ${options.join(' or ')}, and not ${negatedOptions.join(' and not ')}, therefore ${remainingOption}`
          };
        }
      }
    }
  }
  
  return { valid: false, confidence: 0, explanation: 'No disjunctive syllogism pattern found' };
}

/**
 * Check if a conclusion logically follows from premises.
 * @param {Array<Object>} premises - Array of { key: string, value: any } objects
 * @param {Object} conclusion - { key: string, value: any }
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.useCache=true] - Whether to use cache
 * @param {boolean} [options.resolveConflicts=true] - Whether to attempt conflict resolution
 * @param {boolean} [options.checkFallacies=true] - Whether to check for logical fallacies
 * @param {string} [options.requestedBy] - User ID or system component requesting validation
 * @param {Object} [options.context] - Additional context for advanced validation
 * @returns {Object} - { valid: boolean, confidence: number, details: Object }
 */
export async function validateInference(premises, conclusion, options = {}) {
  const { 
    useCache = true, 
    resolveConflicts = true,
    checkFallacies = true,
    requestedBy = 'system',
    context = {}
  } = options;
  
  // Security check - requires permission to use validator
  if (!await security.checkPermission(PERMISSIONS.USE_VALIDATOR)) {
    security.auditLog({
      action: 'validity-checker:unauthorized-inference-validation-attempt',
      details: { 
        premiseCount: premises?.length || 0,
        conclusion: conclusion?.key,
        requestedBy 
      },
      outcome: 'denied'
    });
    
    publish('reasoning:unauthorized-operation', { 
      operation: 'validate-inference', 
      requestedBy
    });
    
    throw new Error('Permission denied: reasoning:use-validator required');
  }
  
  // Log the inference validation attempt
  security.auditLog({
    action: 'validity-checker:inference-validation-request',
    details: { 
      premiseCount: premises?.length || 0,
      conclusion: conclusion?.key,
      requestedBy 
    },
    outcome: 'processing'
  });
  
  try {
    // Validate each premise first
    const premiseValidations = await Promise.all(
      premises.map(premise => validateStatement(premise, options))
    );
    
    // If any premise is invalid, the inference is invalid
    const invalidPremises = premiseValidations.filter(p => p.validity !== VALIDITY.VALID);
    if (invalidPremises.length > 0) {
      const result = {
        valid: false,
        confidence: Math.max(...invalidPremises.map(p => p.confidence)),
        details: {
          premises,
          conclusion,
          invalidPremises,
          reason: 'One or more premises are invalid'
        }
      };
      
      security.auditLog({
        action: 'validity-checker:inference-validation-result',
        details: { 
          premiseCount: premises.length,
          conclusion: conclusion.key,
          result: 'invalid_premises',
          invalidCount: invalidPremises.length,
          requestedBy 
        },
        outcome: 'rejected'
      });
      
      // Record feedback for invalid premises
      feedback.recordFeedback({
        category: 'reasoning_error',
        targetId: `inference_${conclusion.key}_${Date.now()}`,
        targetType: 'inference',
        description: `Invalid premises used in reasoning attempt: ${invalidPremises.map(p => p.details?.statement?.key || 'unknown').join(', ')}`,
        impactLevel: 'medium',
        confidence: result.confidence,
        source: 'validity_checker',
        metadata: {
          premises: premises.map(p => p.key),
          conclusion: conclusion.key,
          invalidPremises: invalidPremises.map(p => p.details)
        }
      });
      
      publish('reasoning:inference-result', result);
      return result;
    }
    
    // Check if conclusion has fallacies (if enabled)
    if (checkFallacies) {
      const fallacyResult = checkForFallacies(conclusion);
      if (fallacyResult.hasFallacy) {
        const result = {
          valid: false,
          confidence: fallacyResult.confidence,
          details: {
            premises,
            conclusion,
            fallacyType: fallacyResult.fallacyType,
            reason: `Conclusion contains logical fallacy: ${fallacyResult.reason}`,
            explanation: fallacyResult.explanation
          }
        };
        
        security.auditLog({
          action: 'validity-checker:fallacy-in-conclusion',
          details: { 
            premiseCount: premises.length,
            conclusion: conclusion.key,
            fallacyType: fallacyResult.fallacyType,
            requestedBy 
          },
          outcome: 'rejected'
        });
        
        // Record feedback for fallacious conclusion
        feedback.recordFeedback({
          category: 'logical_fallacy',
          targetId: `inference_${conclusion.key}_${Date.now()}`,
          targetType: 'inference',
          description: `Conclusion contains ${fallacyResult.fallacyType} fallacy: ${fallacyResult.explanation}`,
          impactLevel: 'high',
          confidence: fallacyResult.confidence,
          source: 'validity_checker',
          metadata: {
            premises: premises.map(p => p.key),
            conclusion: conclusion,
            fallacyDetails: fallacyResult
          }
        });
        
        publish('reasoning:inference-result', result);
        return result;
      }
    }
    
    // Check various inference patterns
    const inferenceChecks = [
      checkModusPonens(premises, conclusion),
      checkModusTollens(premises, conclusion),
      checkHypotheticalSyllogism(premises, conclusion),
      checkDisjunctiveSyllogism(premises, conclusion)
    ];
    
    // Find the first valid inference pattern
    const validInference = inferenceChecks.find(check => check.valid);
    
    if (validInference) {
      const result = {
        valid: true,
        confidence: validInference.confidence,
        details: {
          premises,
          conclusion,
          inferencePattern: validInference.explanation,
          reason: `Valid inference: ${validInference.explanation}`
        }
      };
      
      security.auditLog({
        action: 'validity-checker:valid-inference',
        details: { 
          premiseCount: premises.length,
          conclusion: conclusion.key,
          inferenceRule: validInference.explanation,
          requestedBy 
        },
        outcome: 'success'
      });
      
      publish('reasoning:inference-result', result);
      return result;
    }
    
    // If no formal inference pattern was found, check if the conclusion is one of the premises
    const isPremise = premises.some(p => 
      p.key === conclusion.key && JSON.stringify(p.value) === JSON.stringify(conclusion.value));
    
    if (isPremise) {
      const result = {
        valid: true,
        confidence: 1.0,
        details: {
          premises,
          conclusion,
          reason: 'Conclusion is directly stated in the premises'
        }
      };
      
      security.auditLog({
        action: 'validity-checker:direct-premise',
        details: { 
          premiseCount: premises.length,
          conclusion: conclusion.key,
          requestedBy 
        },
        outcome: 'success'
      });
      
      publish('reasoning:inference-result', result);
      return result;
    }
    
    // If we reach here, the inference is invalid
    const result = {
      valid: false,
      confidence: 0.8,
      details: {
        premises,
        conclusion,
        reason: 'No valid inference pattern found to derive conclusion from premises',
        fallacy: 'non_sequitur'
      }
    };
    
    security.auditLog({
      action: 'validity-checker:invalid-inference',
      details: { 
        premiseCount: premises.length,
        conclusion: conclusion.key,
        requestedBy 
      },
      outcome: 'rejected'
    });
    
    // Record feedback for invalid inference
    feedback.recordFeedback({
      category: 'logical_error',
      targetId: `inference_${conclusion.key}_${Date.now()}`,
      targetType: 'inference',
      description: 'No valid logical path from premises to conclusion',
      impactLevel: 'medium',
      confidence: result.confidence,
      source: 'validity_checker',
      metadata: {
        premises: premises.map(p => p.key),
        conclusion: conclusion.key
      }
    });
    
    publish('reasoning:inference-result', result);
    return result;
  } catch (error) {
    // Handle any errors during inference validation
    const result = {
      valid: false,
      confidence: 0.5,
      details: {
        premises,
        conclusion,
        error: error.message,
        reason: 'Error occurred during inference validation'
      }
    };
    
    security.auditLog({
      action: 'validity-checker:inference-validation-error',
      details: { 
        premiseCount: premises?.length || 0,
        conclusion: conclusion?.key,
        error: error.message,
        requestedBy 
      },
      outcome: 'error'
    });
    
    publish('reasoning:validation-error', {
      operation: 'validateInference',
      error: error.message
    });
    
    return result;
  }
  
  // If no valid inference pattern was found, the inference is considered invalid
  const result = {
    valid: false,
    confidence: 0.9,
    details: {
      premises,
      conclusion,
      reason: 'No valid inference pattern found to derive the conclusion from the premises',
      possiblePatterns: inferenceChecks.map(check => check.explanation)
    }
  };
  
  publish('reasoning:inference-result', result);
  return result;
}

/**
 * Initialize the validity checker module.
 * Sets up event subscriptions and prepares the module for use.
 */
export function initialize() {
  // Subscribe to foundation fact changes to clear cache
  subscribe('reasoning:foundation-facts-updated', () => {
    validationCache.clear();
    security.auditLog({
      action: 'validity-checker:cache-cleared',
      details: { reason: 'foundation facts updated' },
      outcome: 'success'
    });
  });
  
  // Subscribe to conflict resolution events
  subscribe('reasoning:conflict-resolved', (data) => {
    validationCache.clear();
    security.auditLog({
      action: 'validity-checker:cache-cleared',
      details: { reason: 'conflict resolved', conflictId: data.id },
      outcome: 'success'
    });
  });
  
  // Subscribe to feedback events that might affect validation
  subscribe('feedback:correction-submitted', (data) => {
    if (data.category === 'factual_error' || data.category === 'logical_inconsistency') {
      validationCache.clear();
      security.auditLog({
        action: 'validity-checker:cache-cleared',
        details: { reason: 'correction received', feedbackId: data.id },
        outcome: 'success'
      });
    }
  });
  
  // Log initialization
  security.auditLog({
    action: 'validity-checker:initialized',
    details: {},
    outcome: 'success'
  });
  
  publish('reasoning:validity-checker-initialized', { timestamp: Date.now() });
}

// Export constants and functions
export { 
  VALIDITY,
  LOGICAL_RELATIONS,
  FALLACIES,
  PERMISSIONS 
};
