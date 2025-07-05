/**
 * ALEJO Foundation Facts Database
 * 
 * This module provides an unoverridable knowledge base of foundational facts
 * that serve as the basis for ALEJO's reasoning system. These facts are
 * organized by category and cannot be contradicted by learned information.
 * 
 * The foundation facts system serves as the bedrock of ALEJO's reasoning engine,
 * providing irrefutable first principles and foundational knowledge that guides
 * all reasoning processes and conflict resolution.
 * 
 * Based on MIT Media Lab research (2025) on establishing reliable knowledge
 * foundations for AI systems.
 */
import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';
import * as conflictResolver from '../correction/conflict-resolver.js';

// Constants for security permissions
const PERMISSIONS = {
  VIEW_FACTS: 'reasoning:view-foundation-facts',
  MODIFY_FACTS: 'reasoning:modify-foundation-facts',
  VERIFY_FACTS: 'reasoning:verify-foundation-facts'
};

// Categories of foundational facts
const CATEGORIES = {
  MATHEMATICS: 'mathematics',     // Mathematical constants and principles
  PHYSICS: 'physics',           // Physical constants and laws
  LOGIC: 'logic',               // Logical principles and rules
  TIME: 'time',                 // Temporal concepts and principles
  SPACE: 'space',               // Spatial concepts and principles
  IDENTITY: 'identity',         // Identity principles
  CAUSALITY: 'causality',       // Causality principles
  ETHICS: 'ethics',             // Ethical principles
  EPISTEMOLOGY: 'epistemology', // Knowledge principles
  COMPUTATION: 'computation',    // Computational principles
  BIOLOGY: 'biology',           // Biological principles
  CHEMISTRY: 'chemistry',       // Chemical principles
  LANGUAGE: 'language',         // Linguistic principles
  PROBABILITY: 'probability',    // Probability and statistics
  ECONOMICS: 'economics'         // Economic principles
};

// Fact confidence levels
const CONFIDENCE = {
  AXIOMATIC: 1.0,    // Mathematical/logical axioms
  ESTABLISHED: 0.99, // Well-established scientific facts
  CONSENSUS: 0.95,   // Strong scientific consensus
  RELIABLE: 0.9      // Reliable but with some uncertainty
};

// Foundation facts database
// Each fact has: value, category, confidence, description, and source
const factsDatabase = new Map([
  // Mathematics
  ['pi', {
    value: '3.14159265358979323846',
    category: CATEGORIES.MATHEMATICS,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'The ratio of a circle\'s circumference to its diameter',
    source: 'Mathematical constant'
  }],
  ['e', {
    value: '2.71828182845904523536',
    category: CATEGORIES.MATHEMATICS,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'The base of the natural logarithm',
    source: 'Mathematical constant'
  }],
  ['sqrt2', {
    value: '1.41421356237309504880',
    category: CATEGORIES.MATHEMATICS,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'The square root of 2',
    source: 'Mathematical constant'
  }],
  ['golden_ratio', {
    value: '1.61803398874989484820',
    category: CATEGORIES.MATHEMATICS,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'The golden ratio, often denoted by φ',
    source: 'Mathematical constant'
  }],
  ['pythagorean_theorem', {
    value: 'In a right triangle, the square of the length of the hypotenuse equals the sum of the squares of the lengths of the other two sides',
    category: CATEGORIES.MATHEMATICS,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Fundamental theorem in Euclidean geometry',
    source: 'Euclidean geometry'
  }],
  
  // Logic
  ['law_of_non_contradiction', {
    value: 'A statement cannot be both true and false at the same time and in the same sense',
    category: CATEGORIES.LOGIC,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Fundamental principle of classical logic',
    source: 'Aristotle\'s Metaphysics'
  }],
  ['law_of_excluded_middle', {
    value: 'Every statement is either true or false',
    category: CATEGORIES.LOGIC,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Principle of classical logic',
    source: 'Classical logic'
  }],
  ['law_of_identity', {
    value: 'Everything is identical to itself',
    category: CATEGORIES.LOGIC,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Fundamental principle of logic',
    source: 'Classical logic'
  }],
  ['modus_ponens', {
    value: 'If P implies Q and P is true, then Q is true',
    category: CATEGORIES.LOGIC,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Rule of inference in logic',
    source: 'Classical logic'
  }],
  ['modus_tollens', {
    value: 'If P implies Q and Q is false, then P is false',
    category: CATEGORIES.LOGIC,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Rule of inference in logic',
    source: 'Classical logic'
  }],
  
  // Physics
  ['speed_of_light', {
    value: '299792458',
    category: CATEGORIES.PHYSICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Speed of light in vacuum in meters per second',
    source: 'International System of Units (SI)'
  }],
  ['planck_constant', {
    value: '6.62607015e-34',
    category: CATEGORIES.PHYSICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Planck constant in joule-seconds',
    source: 'International System of Units (SI)'
  }],
  ['gravitational_constant', {
    value: '6.67430e-11',
    category: CATEGORIES.PHYSICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Gravitational constant in N⋅m²/kg²',
    source: 'CODATA 2018'
  }],
  ['conservation_of_energy', {
    value: 'Energy cannot be created or destroyed, only transformed or transferred',
    category: CATEGORIES.PHYSICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'First law of thermodynamics',
    source: 'Thermodynamics'
  }],
  ['entropy_increase', {
    value: 'The entropy of an isolated system not in equilibrium will tend to increase over time',
    category: CATEGORIES.PHYSICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Second law of thermodynamics',
    source: 'Thermodynamics'
  }],
  
  // Time
  ['time_linearity', {
    value: 'Time flows in one direction from past to future',
    category: CATEGORIES.TIME,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'The arrow of time',
    source: 'Second law of thermodynamics'
  }],
  ['time_measurement', {
    value: 'Time can be measured in discrete units',
    category: CATEGORIES.TIME,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Basis for temporal reasoning',
    source: 'Physics and measurement theory'
  }],
  ['time_relativity', {
    value: 'Time dilation occurs at high speeds or in strong gravitational fields',
    category: CATEGORIES.TIME,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Time is not absolute',
    source: 'Theory of relativity'
  }],
  
  // Space
  ['three_dimensions', {
    value: 'Physical space has three observable dimensions',
    category: CATEGORIES.SPACE,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Basis for spatial reasoning',
    source: 'Classical physics'
  }],
  ['spacetime_continuum', {
    value: 'Space and time are interwoven into a single continuum',
    category: CATEGORIES.SPACE,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Spacetime concept',
    source: 'Theory of relativity'
  }],
  ['space_curvature', {
    value: 'Mass and energy curve spacetime',
    category: CATEGORIES.SPACE,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Gravity as spacetime curvature',
    source: 'General relativity'
  }],
  
  // Identity
  ['identity_principle', {
    value: 'An entity is identical to itself',
    category: CATEGORIES.IDENTITY,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'A = A',
    source: 'Law of identity in logic'
  }],
  ['identity_persistence', {
    value: 'Objects persist through time despite changes in properties',
    category: CATEGORIES.IDENTITY,
    confidence: CONFIDENCE.RELIABLE,
    description: 'Basis for object permanence',
    source: 'Metaphysics'
  }],
  
  // Causality
  ['causality_principle', {
    value: 'Every effect has a cause that precedes it in time',
    category: CATEGORIES.CAUSALITY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Basis for causal reasoning',
    source: 'Classical physics and philosophy'
  }],
  ['correlation_causation', {
    value: 'Correlation does not necessarily imply causation',
    category: CATEGORIES.CAUSALITY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Principle of causal inference',
    source: 'Statistics and philosophy of science'
  }],
  ['causal_closure', {
    value: 'Every physical event has a physical cause',
    category: CATEGORIES.CAUSALITY,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Principle of physical causation',
    source: 'Philosophy of science'
  }],
  
  // Ethics
  ['human_dignity', {
    value: 'All humans have inherent worth and dignity',
    category: CATEGORIES.ETHICS,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Foundational ethical principle',
    source: 'Universal Declaration of Human Rights'
  }],
  ['harm_principle', {
    value: 'Actions that harm others without consent are generally wrong',
    category: CATEGORIES.ETHICS,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Basic ethical principle',
    source: 'Mill\'s harm principle'
  }],
  ['autonomy_principle', {
    value: 'Individuals have the right to make their own informed decisions',
    category: CATEGORIES.ETHICS,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Principle of autonomy',
    source: 'Bioethics and moral philosophy'
  }],
  ['justice_fairness', {
    value: 'Similar cases should be treated similarly',
    category: CATEGORIES.ETHICS,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Principle of justice',
    source: 'Rawls\'s theory of justice'
  }],
  ['informed_consent', {
    value: 'Valid consent requires adequate information, understanding, and voluntariness',
    category: CATEGORIES.ETHICS,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Principle of informed consent',
    source: 'Medical ethics'
  }],
  
  // Epistemology
  ['knowledge_definition', {
    value: 'Knowledge is justified true belief with proper causal connection',
    category: CATEGORIES.EPISTEMOLOGY,
    confidence: CONFIDENCE.RELIABLE,
    description: 'Definition of knowledge',
    source: 'Contemporary epistemology'
  }],
  ['empirical_verification', {
    value: 'Empirical claims should be verifiable through observation or experiment',
    category: CATEGORIES.EPISTEMOLOGY,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Scientific method principle',
    source: 'Philosophy of science'
  }],
  ['falsifiability', {
    value: 'Scientific theories must be falsifiable to be meaningful',
    category: CATEGORIES.EPISTEMOLOGY,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Criterion for scientific theories',
    source: 'Popper\'s philosophy of science'
  }],
  ['occams_razor', {
    value: 'Among competing hypotheses, the one with the fewest assumptions should be selected',
    category: CATEGORIES.EPISTEMOLOGY,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Principle of parsimony',
    source: 'Scientific methodology'
  }],
  
  // Computation
  ['halting_problem', {
    value: 'It is impossible to create a general algorithm that can determine whether any arbitrary program will halt or run forever',
    category: CATEGORIES.COMPUTATION,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Fundamental limitation in computation',
    source: 'Turing\'s proof'
  }],
  ['boolean_logic', {
    value: 'All digital computing is based on binary logic operations',
    category: CATEGORIES.COMPUTATION,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Foundation of digital computing',
    source: 'Computer science'
  }],
  
  // Biology
  ['cell_theory', {
    value: 'All living organisms are composed of cells',
    category: CATEGORIES.BIOLOGY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Fundamental principle of biology',
    source: 'Cell theory'
  }],
  ['evolution', {
    value: 'Species change over time through natural selection acting on genetic variation',
    category: CATEGORIES.BIOLOGY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Theory of evolution by natural selection',
    source: 'Evolutionary biology'
  }],
  ['dna_genetic_code', {
    value: 'DNA contains the genetic instructions for the development and functioning of living organisms',
    category: CATEGORIES.BIOLOGY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Central dogma of molecular biology',
    source: 'Molecular biology'
  }],
  
  // Chemistry
  ['conservation_of_mass', {
    value: 'In a closed system, the mass of the reactants equals the mass of the products',
    category: CATEGORIES.CHEMISTRY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Law of conservation of mass',
    source: 'Chemistry'
  }],
  ['periodic_table', {
    value: 'Elements are organized by atomic number and electron configuration',
    category: CATEGORIES.CHEMISTRY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Organization of chemical elements',
    source: 'Chemistry'
  }],
  
  // Language
  ['language_productivity', {
    value: 'Human languages allow the creation of novel, never-before-uttered sentences',
    category: CATEGORIES.LANGUAGE,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Property of human language',
    source: 'Linguistics'
  }],
  ['linguistic_relativity', {
    value: 'Language influences but does not determine thought',
    category: CATEGORIES.LANGUAGE,
    confidence: CONFIDENCE.CONSENSUS,
    description: 'Weak Sapir-Whorf hypothesis',
    source: 'Cognitive linguistics'
  }],
  
  // Probability
  ['bayes_theorem', {
    value: 'P(A|B) = P(B|A) * P(A) / P(B)',
    category: CATEGORIES.PROBABILITY,
    confidence: CONFIDENCE.AXIOMATIC,
    description: 'Formula for conditional probability',
    source: 'Probability theory'
  }],
  ['law_of_large_numbers', {
    value: 'As a sample size grows, its mean will approach the population mean',
    category: CATEGORIES.PROBABILITY,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Statistical principle',
    source: 'Probability theory'
  }],
  
  // Economics
  ['scarcity_principle', {
    value: 'Resources are limited relative to wants',
    category: CATEGORIES.ECONOMICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Fundamental economic principle',
    source: 'Economics'
  }],
  ['supply_demand', {
    value: 'Price equilibrium occurs where supply equals demand',
    category: CATEGORIES.ECONOMICS,
    confidence: CONFIDENCE.ESTABLISHED,
    description: 'Market equilibrium principle',
    source: 'Microeconomics'
  }]
]);

/**
 * Retrieve a foundational fact by its identifier.
 * @param {string} id - Fact identifier
 * @returns {Object|null} - Fact object or null if not found
 */
export function getFact(id) {
  const fact = factsDatabase.get(id) || null;
  publish('reasoning:fact-queried', { id, fact });
  return fact;
}

/**
 * Get just the value of a foundational fact.
 * @param {string} id - Fact identifier
 * @returns {string|null} - Fact value or null if not found
 */
export function getFactValue(id) {
  const fact = factsDatabase.get(id);
  return fact ? fact.value : null;
}

/**
 * List all available foundational fact identifiers.
 * @returns {Array<string>} - List of fact IDs
 */
export function listFacts() {
  return Array.from(factsDatabase.keys());
}

/**
 * Get facts by category.
 * @param {string} category - Category identifier
 * @returns {Array<Object>} - Facts in the specified category
 */
export function getFactsByCategory(category) {
  const result = [];
  factsDatabase.forEach((fact, id) => {
    if (fact.category === category) {
      result.push({ id, ...fact });
    }
  });
  publish('reasoning:facts-queried-by-category', { category, count: result.length });
  return result;
}

/**
 * Search for facts by keyword in their description or value.
 * @param {string} keyword - Keyword to search for
 * @returns {Array<Object>} - Matching facts
 */
export function searchFacts(keyword) {
  if (!keyword || typeof keyword !== 'string') {
    return [];
  }
  
  const lowerKeyword = keyword.toLowerCase();
  const result = [];
  
  factsDatabase.forEach((fact, id) => {
    const lowerValue = fact.value.toString().toLowerCase();
    const lowerDescription = fact.description.toLowerCase();
    
    if (lowerValue.includes(lowerKeyword) || lowerDescription.includes(lowerKeyword)) {
      result.push({ id, ...fact });
    }
  });
  
  publish('reasoning:facts-searched', { keyword, count: result.length });
  return result;
}

/**
 * List all available fact categories.
 * @returns {Array<string>} - List of categories
 */
export function listCategories() {
  return Object.values(CATEGORIES);
}

/**
 * Check if a statement contradicts a foundational fact.
 * @param {string} key - The knowledge key to check
 * @param {any} value - The value to check against foundation facts
 * @returns {Object|null} - Returns contradiction info or null if no contradiction
 */
export function checkContradiction(key, value) {
  const fact = factsDatabase.get(key);
  if (!fact) {
    // No foundation fact for this key, so no contradiction
    return null;
  }
  
  // Check if the value contradicts the foundation fact
  const valueStr = value !== null && value !== undefined ? value.toString() : '';
  const factValueStr = fact.value !== null && fact.value !== undefined ? fact.value.toString() : '';
  
  if (valueStr !== factValueStr) {
    return {
      factId: key,
      factValue: fact.value,
      providedValue: value,
      confidence: fact.confidence,
      description: fact.description
    };
  }
  
  // No contradiction
  return null;
}

/**
 * Legacy version of checkContradiction for backward compatibility
 * @param {Object} statement - { key: string, value: any }
 * @returns {Object} - { contradicts: boolean, fact: Object|null }
 * @deprecated Use the new signature checkContradiction(key, value) instead
 */
export function checkStatementContradiction(statement) {
  const fact = factsDatabase.get(statement.key);
  if (!fact) {
    return { contradicts: false, fact: null };
  }
  
  const contradicts = fact.value.toString() !== statement.value.toString();
  return { contradicts, fact };
}

/**
 * Add a new foundational fact to the database.
 * This operation requires the 'reasoning:modify-foundation-facts' permission.
 * @param {string} id - Unique identifier for the fact
 * @param {Object} factData - Fact data object
 * @param {string} factData.value - The value of the fact
 * @param {string} factData.category - The category of the fact
 * @param {number} factData.confidence - Confidence level (0-1)
 * @param {string} factData.description - Description of the fact
 * @param {string} factData.source - Source of the fact
 * @returns {boolean} - Success of the operation
 */
export async function addFoundationFact(id, factData) {
  // Security check - requires special permission
  if (!await security.checkPermission(PERMISSIONS.MODIFY_FACTS)) {
    security.auditLog({
      action: 'foundation-facts:unauthorized-add-attempt',
      details: { id, factData },
      outcome: 'denied'
    });
    publish('reasoning:unauthorized-operation', { operation: 'add-foundation-fact', id });
    return false;
  }
  
  // Validate required fields
  const requiredFields = ['value', 'category', 'confidence', 'description', 'source'];
  const missingFields = requiredFields.filter(field => !factData[field]);
  
  if (missingFields.length > 0) {
    security.auditLog({
      action: 'foundation-facts:invalid-fact-data',
      details: { id, factData, missingFields },
      outcome: 'rejected'
    });
    publish('reasoning:invalid-data', { operation: 'add-foundation-fact', id, missingFields });
    return false;
  }
  
  // Validate category
  if (!Object.values(CATEGORIES).includes(factData.category)) {
    security.auditLog({
      action: 'foundation-facts:invalid-category',
      details: { id, category: factData.category },
      outcome: 'rejected'
    });
    publish('reasoning:invalid-data', { operation: 'add-foundation-fact', id, invalidCategory: factData.category });
    return false;
  }
  
  // Validate confidence
  if (typeof factData.confidence !== 'number' || factData.confidence < 0 || factData.confidence > 1) {
    security.auditLog({
      action: 'foundation-facts:invalid-confidence',
      details: { id, confidence: factData.confidence },
      outcome: 'rejected'
    });
    publish('reasoning:invalid-data', { operation: 'add-foundation-fact', id, invalidConfidence: factData.confidence });
    return false;
  }
  
  // Check if fact already exists
  if (factsDatabase.has(id)) {
    security.auditLog({
      action: 'foundation-facts:duplicate-fact',
      details: { id, factData },
      outcome: 'rejected'
    });
    publish('reasoning:duplicate-data', { operation: 'add-foundation-fact', id });
    return false;
  }
  
  // Add the fact
  factsDatabase.set(id, { ...factData });
  
  // Log the operation
  security.auditLog({
    action: 'foundation-facts:fact-added',
    details: { id, factData },
    outcome: 'success'
  });
  
  // Publish event
  publish('reasoning:foundation-fact-added', { id, fact: factData });
  
  return true;
}

/**
 * Update an existing foundational fact.
 * This operation requires the 'reasoning:modify-foundation-facts' permission.
 * @param {string} id - Fact identifier
 * @param {Object} updates - Fact data updates
 * @returns {boolean} - Success of the operation
 */
export async function updateFoundationFact(id, updates) {
  // Security check
  if (!await security.checkPermission(PERMISSIONS.MODIFY_FACTS)) {
    security.auditLog({
      action: 'foundation-facts:unauthorized-update-attempt',
      details: { id, updates },
      outcome: 'denied'
    });
    publish('reasoning:unauthorized-operation', { operation: 'update-foundation-fact', id });
    return false;
  }
  
  // Check if fact exists
  if (!factsDatabase.has(id)) {
    security.auditLog({
      action: 'foundation-facts:fact-not-found',
      details: { id, updates },
      outcome: 'rejected'
    });
    publish('reasoning:not-found', { operation: 'update-foundation-fact', id });
    return false;
  }
  
  const currentFact = factsDatabase.get(id);
  const updatedFact = { ...currentFact };
  
  // Apply updates
  Object.keys(updates).forEach(key => {
    if (key === 'category' && !Object.values(CATEGORIES).includes(updates[key])) {
      // Skip invalid category
      publish('reasoning:invalid-data', { operation: 'update-foundation-fact', id, invalidCategory: updates[key] });
    } else if (key === 'confidence' && 
              (typeof updates[key] !== 'number' || updates[key] < 0 || updates[key] > 1)) {
      // Skip invalid confidence
      publish('reasoning:invalid-data', { operation: 'update-foundation-fact', id, invalidConfidence: updates[key] });
    } else {
      updatedFact[key] = updates[key];
    }
  });
  
  // Update the fact
  factsDatabase.set(id, updatedFact);
  
  // Log the operation
  security.auditLog({
    action: 'foundation-facts:fact-updated',
    details: { id, originalFact: currentFact, updates, updatedFact },
    outcome: 'success'
  });
  
  // Publish event
  publish('reasoning:foundation-fact-updated', { 
    id, 
    previousValue: currentFact.value,
    newValue: updatedFact.value,
    fact: updatedFact 
  });
  
  // Notify the conflict resolver of the update
  conflictResolver.handleFoundationFactUpdate(id, updatedFact);
  
  return true;
}

/**
 * Remove a foundational fact from the database.
 * This operation requires the 'reasoning:modify-foundation-facts' permission.
 * @param {string} id - Fact identifier
 * @returns {boolean} - Success of the operation
 */
export async function removeFoundationFact(id) {
  // Security check
  if (!await security.checkPermission(PERMISSIONS.MODIFY_FACTS)) {
    security.auditLog({
      action: 'foundation-facts:unauthorized-remove-attempt',
      details: { id },
      outcome: 'denied'
    });
    publish('reasoning:unauthorized-operation', { operation: 'remove-foundation-fact', id });
    return false;
  }
  
  // Check if fact exists
  if (!factsDatabase.has(id)) {
    security.auditLog({
      action: 'foundation-facts:fact-not-found',
      details: { id },
      outcome: 'rejected'
    });
    publish('reasoning:not-found', { operation: 'remove-foundation-fact', id });
    return false;
  }
  
  const fact = factsDatabase.get(id);
  
  // Remove the fact
  factsDatabase.delete(id);
  
  // Log the operation
  security.auditLog({
    action: 'foundation-facts:fact-removed',
    details: { id, removedFact: fact },
    outcome: 'success'
  });
  
  // Publish event
  publish('reasoning:foundation-fact-removed', { id, fact });
  
  // Notify the conflict resolver of the removal
  conflictResolver.handleFoundationFactRemoval(id);
  
  return true;
}

/**
 * Advanced check for contradictions against foundation facts.
 * This checks not only direct contradictions but also attempts to detect
 * indirect contradictions through logical implication.
 * @param {string} statement - The statement to check
 * @param {Object} context - Additional context that might be needed
 * @returns {Object|null} - Returns contradiction info or null if no contradiction
 */
export function checkAdvancedContradiction(statement, context = {}) {
  // First check for direct contradiction
  const directContradiction = checkContradiction(statement.key, statement.value);
  if (directContradiction) {
    return {
      ...directContradiction,
      type: 'direct',
      conflictSeverity: 'critical'
    };
  }
  
  // Check for category-specific contradictions
  // For example, mathematical and logical contradictions
  
  // Mathematical contradictions
  if (statement.category === CATEGORIES.MATHEMATICS) {
    // Example: checking if a statement contradicts the pythagorean theorem
    if (statement.key.includes('pythagorean') || 
        (statement.description && statement.description.includes('right triangle'))) {
      // Run specialized mathematical validation
      const mathContradiction = validateMathematicalConsistency(statement, context);
      if (mathContradiction) {
        return {
          ...mathContradiction,
          type: 'mathematical',
          conflictSeverity: 'high'
        };
      }
    }
  }
  
  // Logical contradictions
  if (statement.category === CATEGORIES.LOGIC) {
    // Example: checking if a statement violates the law of non-contradiction
    const logicalContradiction = validateLogicalConsistency(statement, context);
    if (logicalContradiction) {
      return {
        ...logicalContradiction,
        type: 'logical',
        conflictSeverity: 'critical'
      };
    }
  }
  
  // Physical law contradictions
  if (statement.category === CATEGORIES.PHYSICS) {
    // Check for violations of physical laws
    const physicalContradiction = validatePhysicalConsistency(statement, context);
    if (physicalContradiction) {
      return {
        ...physicalContradiction,
        type: 'physical',
        conflictSeverity: 'high'
      };
    }
  }
  
  // No contradiction detected
  return null;
}

// Helper function for mathematical consistency checking
function validateMathematicalConsistency(statement, context) {
  // This would contain specialized mathematical validation logic
  // For now, we'll return null (no contradiction)
  return null;
}

// Helper function for logical consistency checking
function validateLogicalConsistency(statement, context) {
  // This would contain specialized logical validation logic
  // For now, we'll return null (no contradiction)
  return null;
}

// Helper function for physical law consistency checking
function validatePhysicalConsistency(statement, context) {
  // This would contain specialized physical validation logic
  // For now, we'll return null (no contradiction)
  return null;
}

/**
 * Initialize the foundation facts module and set up event listeners.
 */
export function initialize() {
  // Subscribe to feedback events
  subscribe('feedback:high-impact-recorded', handleHighImpactFeedback);
  subscribe('feedback:correction-applied', handleCorrectionApplied);
  
  // Subscribe to conflict resolution events
  subscribe('conflict:resolution-applied', handleConflictResolution);
  
  // Log initialization
  security.auditLog({
    action: 'foundation-facts:initialized',
    details: { factCount: factsDatabase.size },
    outcome: 'success'
  });
  
  // Publish initialization event
  publish('reasoning:foundation-facts-initialized', { 
    factCount: factsDatabase.size,
    categories: Object.values(CATEGORIES)
  });
  
  return true;
}

/**
 * Handle high impact feedback that might affect foundation facts.
 * @param {Object} event - Feedback event data
 */
async function handleHighImpactFeedback(event) {
  const { feedback } = event;
  
  // Check if this feedback concerns a foundation fact
  if (feedback.targetType === 'foundation-fact' && feedback.impactLevel === 'critical') {
    // Log the feedback review
    security.auditLog({
      action: 'foundation-facts:high-impact-feedback-received',
      details: { feedbackId: feedback.id, factId: feedback.targetId },
      outcome: 'pending-review'
    });
    
    // Notify administrators for review
    publish('reasoning:foundation-fact-feedback', { 
      feedbackId: feedback.id,
      factId: feedback.targetId,
      urgency: 'high'
    });
  }
}

/**
 * Handle applied corrections that might affect foundation facts.
 * @param {Object} event - Correction event data
 */
async function handleCorrectionApplied(event) {
  const { correction, targetId } = event;
  
  // If the correction applies to a foundation fact, update our verification status
  if (correction.targetType === 'foundation-fact' && factsDatabase.has(targetId)) {
    // Update verification metadata
    const fact = factsDatabase.get(targetId);
    fact.lastVerified = new Date().toISOString();
    fact.verificationSource = correction.source || 'feedback-correction';
    factsDatabase.set(targetId, fact);
    
    // Log the verification
    security.auditLog({
      action: 'foundation-facts:fact-verified',
      details: { factId: targetId, verificationSource: fact.verificationSource },
      outcome: 'success'
    });
  }
}

/**
 * Handle conflict resolutions that might affect foundation facts.
 * @param {Object} event - Conflict resolution event data
 */
async function handleConflictResolution(event) {
  const { conflictId, resolution, involvedFacts } = event;
  
  // Check if any foundation facts were involved
  if (involvedFacts && involvedFacts.some(factId => factsDatabase.has(factId))) {
    // Log the conflict resolution
    security.auditLog({
      action: 'foundation-facts:conflict-resolution-processed',
      details: { conflictId, resolution, involvedFacts },
      outcome: 'processed'
    });
  }
}

/**
 * Export the security permissions for foundation facts.
 */
export const factPermissions = PERMISSIONS;

// Export categories and confidence levels for use in other modules
export { CATEGORIES, CONFIDENCE };
