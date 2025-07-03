/**
 * ALEJO Foundation Facts Database
 * 
 * This module provides an unoverridable knowledge base of foundational facts
 * that serve as the basis for ALEJO's reasoning system. These facts are
 * organized by category and cannot be contradicted by learned information.
 * 
 * Based on MIT Media Lab research (2025) on establishing reliable knowledge
 * foundations for AI systems.
 */
import { publish } from '../../core/events.js';

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

// Export categories and confidence levels for use in other modules
export { CATEGORIES, CONFIDENCE };
