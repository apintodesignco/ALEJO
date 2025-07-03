/**
 * ALEJO Validity Checker
 * 
 * This module validates new statements against the foundation facts database
 * and detects logical inconsistencies. It ensures that ALEJO's reasoning
 * remains consistent with established foundational knowledge.
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
  CONFIDENCE, 
  CATEGORIES 
} from './foundation-facts.js';
import { resolveConflict } from '../correction/conflict-resolver.js';

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
 * @returns {Object} - { validity: string, confidence: number, details: Object }
 */
export function validateStatement(statement, options = {}) {
  const { useCache = true, resolveConflicts = true } = options;
  
  // Check cache first if enabled
  if (useCache) {
    const cacheKey = getCacheKey(statement);
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }
  
  // Check direct contradiction with foundation facts
  const contradictionResult = checkContradiction(statement.key, statement.value);
  
  if (contradictionResult) {
    // If conflict resolution is enabled, try to resolve the conflict
    if (resolveConflicts) {
      const resolution = resolveConflict({
        key: statement.key,
        value: statement.value,
        conflictType: 'factual',
        conflictingFact: contradictionResult.fact
      });
      
      // If resolution was successful and favors the new statement
      if (resolution && resolution.resolution === 'accept_new') {
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
  
  publish('reasoning:validation-result', result);
  return result;
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
 * @returns {Object} - { validity: string, confidence: number, details: Object }
 */
export function validateConsistency(statements, options = {}) {
  // If no statements or only one statement, delegate to validateStatement
  if (!statements || statements.length === 0) {
    return {
      validity: VALIDITY.VALID,
      confidence: 1.0,
      details: {
        statements: [],
        reason: 'No statements to validate'
      }
    };
  }
  
  if (statements.length === 1) {
    return validateStatement(statements[0], options);
  }
  
  // Check each statement against foundation facts
  const individualResults = statements.map(stmt => validateStatement(stmt, options));
  
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
    
    publish('reasoning:consistency-result', result);
    return result;
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
  
  publish('reasoning:consistency-result', result);
  return result;
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
 * @returns {Object} - { valid: boolean, confidence: number, details: Object }
 */
export function validateInference(premises, conclusion, options = {}) {
  // First check if all premises and the conclusion are individually valid
  const premiseResults = premises.map(p => validateStatement(p, options));
  const conclusionResult = validateStatement(conclusion, options);
  
  // If any premise or the conclusion contradicts foundation facts, the inference is invalid
  if (premiseResults.some(r => r.validity !== VALIDITY.VALID) || 
      conclusionResult.validity !== VALIDITY.VALID) {
    const invalidPremises = premiseResults
      .map((r, i) => ({ index: i, result: r }))
      .filter(item => item.result.validity !== VALIDITY.VALID);
    
    const result = {
      valid: false,
      confidence: 1.0,
      details: {
        premises,
        conclusion,
        invalidPremises: invalidPremises.map(item => ({
          premise: premises[item.index],
          reason: item.result.details.reason
        })),
        invalidConclusion: conclusionResult.validity !== VALIDITY.VALID ? {
          reason: conclusionResult.details.reason
        } : null,
        reason: 'One or more statements contradict foundation facts or are logically inconsistent'
      }
    };
    
    publish('reasoning:inference-result', result);
    return result;
  }
  
  // Check if the premises are consistent with each other
  const consistencyResult = validateConsistency(premises, options);
  if (consistencyResult.validity !== VALIDITY.VALID) {
    const result = {
      valid: false,
      confidence: consistencyResult.confidence,
      details: {
        premises,
        conclusion,
        consistencyIssue: consistencyResult.details,
        reason: 'Premises are inconsistent with each other'
      }
    };
    
    publish('reasoning:inference-result', result);
    return result;
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
    
    publish('reasoning:inference-result', result);
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

// Export validity constants
export { VALIDITY };
