/**
 * ALEJO Value Alignment System
 * 
 * Ensures ALEJO's responses align with the user's personal value system:
 * - Learns and adapts to user's ethical boundaries
 * - Validates responses against personal value framework
 * - Provides transparent reasoning for value-based decisions
 * - Respects cultural and individual differences in values
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';

// Constants
const VALUE_STORAGE_KEY = 'alejo_value_framework';
const DEFAULT_THRESHOLD = 0.75; // Minimum alignment score to pass validation

// Core value domains that serve as the foundation
const CORE_VALUE_DOMAINS = {
  'autonomy': {
    name: 'Autonomy',
    description: 'Respecting user agency and control',
    immutable: true,
    weight: 1.0
  },
  'privacy': {
    name: 'Privacy',
    description: 'Protecting personal information and private spaces',
    immutable: true,
    weight: 1.0
  },
  'transparency': {
    name: 'Transparency',
    description: 'Being clear about system capabilities and limitations',
    immutable: true,
    weight: 1.0
  },
  'wellbeing': {
    name: 'Well-being',
    description: 'Promoting physical and mental health',
    immutable: false,
    weight: 0.9
  },
  'fairness': {
    name: 'Fairness',
    description: 'Treating all individuals equitably and without bias',
    immutable: false,
    weight: 0.9
  },
  'safety': {
    name: 'Safety',
    description: 'Preventing harm and ensuring security',
    immutable: true,
    weight: 1.0
  }
};

// State management
let initialized = false;
let userValueFramework = {};
let alignmentThreshold = DEFAULT_THRESHOLD;

/**
 * Initialize the value alignment system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Value Alignment System');
  
  if (initialized) {
    console.warn('Value Alignment System already initialized');
    return true;
  }
  
  try {
    // Configure threshold
    alignmentThreshold = options.threshold || DEFAULT_THRESHOLD;
    
    // Initialize security module if not already done
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    // Load or create user value framework
    await loadValueFramework(options.userId || 'anonymous');
    
    // Register for relevant events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    subscribe('response:pre_delivery', validateResponse);
    
    initialized = true;
    publish('ethics:value_alignment:initialized', { success: true });
    
    // Log initialization if consent is granted
    if (security.isFeatureAllowed('personalization:learning')) {
      security.logSecureEvent('ethics:value_alignment:initialized', {
        timestamp: Date.now(),
        domains: Object.keys(userValueFramework)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Value Alignment System:', error);
    publish('ethics:value_alignment:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Load or create the user's value framework
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Value framework
 */
async function loadValueFramework(userId) {
  try {
    // Try to load from secure storage
    if (security && typeof security.secureRetrieve === 'function') {
      const storedFramework = await security.secureRetrieve(
        `${VALUE_STORAGE_KEY}_${userId}`,
        { consentFeature: 'personalization:learning' }
      );
      
      if (storedFramework) {
        userValueFramework = validateFramework(storedFramework);
        return userValueFramework;
      }
    }
    
    // Create default framework if none found
    userValueFramework = createDefaultFramework();
    
    // Save the default framework
    await saveValueFramework(userId);
    
    return userValueFramework;
  } catch (error) {
    console.error('Error loading value framework:', error);
    userValueFramework = createDefaultFramework();
    return userValueFramework;
  }
}

/**
 * Create a default value framework
 * @returns {Object} Default framework
 */
function createDefaultFramework() {
  const framework = {};
  
  // Copy core value domains
  Object.entries(CORE_VALUE_DOMAINS).forEach(([id, domain]) => {
    framework[id] = {
      ...domain,
      userImportance: domain.weight, // Initialize with default weight
      examples: [],
      lastUpdated: new Date().toISOString()
    };
  });
  
  return framework;
}

/**
 * Validate a stored framework against the core domains
 * @param {Object} framework - Stored framework to validate
 * @returns {Object} Validated framework
 */
function validateFramework(framework) {
  const validated = createDefaultFramework();
  
  // Merge with stored values for existing domains
  Object.keys(validated).forEach(domainId => {
    if (framework[domainId]) {
      // Keep immutable properties from default
      const immutableProps = validated[domainId].immutable ? 
        { immutable: true, weight: validated[domainId].weight } : {};
      
      // Merge with stored values
      validated[domainId] = {
        ...validated[domainId],
        ...framework[domainId],
        ...immutableProps
      };
    }
  });
  
  // Add any custom domains from stored framework
  Object.keys(framework).forEach(domainId => {
    if (!validated[domainId] && !domainId.startsWith('_')) {
      validated[domainId] = {
        ...framework[domainId],
        immutable: false
      };
    }
  });
  
  return validated;
}

/**
 * Save the current value framework
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
async function saveValueFramework(userId) {
  if (!security || typeof security.secureStore !== 'function') {
    console.error('Security module not available, cannot save value framework');
    return false;
  }
  
  try {
    const result = await security.secureStore(
      `${VALUE_STORAGE_KEY}_${userId}`,
      userValueFramework,
      { 
        consentFeature: 'personalization:learning',
        category: 'ethics'
      }
    );
    
    return result;
  } catch (error) {
    console.error('Failed to save value framework:', error);
    return false;
  }
}

/**
 * Update importance of a value domain for the user
 * @param {string} domainId - Value domain ID
 * @param {number} importance - Importance score (0-1)
 * @returns {Promise<boolean>} Success status
 */
export async function updateValueImportance(domainId, importance) {
  if (!initialized) {
    await initialize();
  }
  
  // Validate inputs
  if (!userValueFramework[domainId]) {
    console.error(`Invalid value domain: ${domainId}`);
    return false;
  }
  
  const validImportance = Math.max(0, Math.min(1, importance));
  
  // Check if this is an immutable domain with fixed importance
  if (userValueFramework[domainId].immutable) {
    console.warn(`Cannot change importance for immutable domain: ${domainId}`);
    return false;
  }
  
  // Update the importance
  userValueFramework[domainId].userImportance = validImportance;
  userValueFramework[domainId].lastUpdated = new Date().toISOString();
  
  // Log the update
  if (security && security.isFeatureAllowed('personalization:learning')) {
    security.logSecureEvent('ethics:value:updated', {
      domain: domainId,
      importance: validImportance
    });
  }
  
  // Save the updated framework
  return saveValueFramework('anonymous'); // TODO: Use actual user ID
}

/**
 * Add a value example to help train the system
 * @param {string} domainId - Value domain ID
 * @param {string} example - Example text
 * @param {boolean} isPositive - Whether this is a positive or negative example
 * @returns {Promise<boolean>} Success status
 */
export async function addValueExample(domainId, example, isPositive) {
  if (!initialized) {
    await initialize();
  }
  
  // Validate inputs
  if (!userValueFramework[domainId]) {
    console.error(`Invalid value domain: ${domainId}`);
    return false;
  }
  
  if (!example || typeof example !== 'string') {
    console.error('Example must be a non-empty string');
    return false;
  }
  
  // Add the example
  userValueFramework[domainId].examples = userValueFramework[domainId].examples || [];
  userValueFramework[domainId].examples.push({
    text: example,
    isPositive,
    timestamp: new Date().toISOString()
  });
  
  // Limit the number of examples
  if (userValueFramework[domainId].examples.length > 50) {
    userValueFramework[domainId].examples.shift(); // Remove oldest
  }
  
  userValueFramework[domainId].lastUpdated = new Date().toISOString();
  
  // Log the update
  if (security && security.isFeatureAllowed('personalization:learning')) {
    security.logSecureEvent('ethics:value:example_added', {
      domain: domainId,
      isPositive
    });
  }
  
  // Save the updated framework
  return saveValueFramework('anonymous'); // TODO: Use actual user ID
}

/**
 * Create a new custom value domain
 * @param {Object} domainInfo - Domain information
 * @returns {Promise<boolean>} Success status
 */
export async function createValueDomain(domainInfo) {
  if (!initialized) {
    await initialize();
  }
  
  // Validate inputs
  if (!domainInfo.id || !domainInfo.name || !domainInfo.description) {
    console.error('Domain must have id, name, and description');
    return false;
  }
  
  // Check if domain already exists
  if (userValueFramework[domainInfo.id]) {
    console.error(`Domain already exists: ${domainInfo.id}`);
    return false;
  }
  
  // Create the new domain
  const newDomain = {
    name: domainInfo.name,
    description: domainInfo.description,
    immutable: false,
    weight: 0.5, // Default weight for custom domains
    userImportance: domainInfo.importance || 0.5,
    examples: [],
    lastUpdated: new Date().toISOString(),
    custom: true
  };
  
  userValueFramework[domainInfo.id] = newDomain;
  
  // Log the update
  if (security && security.isFeatureAllowed('personalization:learning')) {
    security.logSecureEvent('ethics:value:domain_created', {
      domain: domainInfo.id,
      importance: newDomain.userImportance
    });
  }
  
  // Save the updated framework
  return saveValueFramework('anonymous'); // TODO: Use actual user ID
}

/**
 * Validate a response against the user's value framework
 * @param {Object} data - Response data to validate
 */
async function validateResponse(data) {
  if (!initialized) {
    return;
  }
  
  // Skip validation for system messages
  if (data.systemMessage || !data.content) {
    return;
  }
  
  try {
    const alignmentResults = assessValueAlignment(data.content);
    const overallScore = calculateOverallAlignmentScore(alignmentResults);
    
    // Add alignment information to the response metadata
    data.valueAlignmentScore = overallScore;
    data.valueAssessment = alignmentResults;
    
    // Check if the response passes the threshold
    if (overallScore < alignmentThreshold) {
      // Log the issue
      if (security) {
        security.logSecureEvent('ethics:value:alignment_failed', {
          score: overallScore,
          threshold: alignmentThreshold,
          domains: Object.entries(alignmentResults)
            .filter(([_, result]) => result.score < 0.5)
            .map(([domain]) => domain)
        });
      }
      
      // Flag the response for review or revision
      data.requiresReview = true;
      data.reviewReason = 'value_alignment';
      
      publish('response:needs_revision', { 
        id: data.id,
        reason: 'value_alignment',
        alignmentScore: overallScore,
        problemDomains: Object.entries(alignmentResults)
          .filter(([_, result]) => result.score < 0.5)
          .map(([domain, result]) => ({
            domain,
            score: result.score,
            issue: result.issue
          }))
      });
    }
  } catch (error) {
    console.error('Error validating response against value framework:', error);
  }
}

/**
 * Assess how well content aligns with each value domain
 * @param {string} content - Content to assess
 * @returns {Object} Assessment results by domain
 */
function assessValueAlignment(content) {
  const results = {};
  
  // For each value domain, assess alignment
  Object.entries(userValueFramework).forEach(([domainId, domain]) => {
    // This is a simple implementation that could be enhanced with NLP/ML
    results[domainId] = simpleDomainAssessment(content, domain);
  });
  
  return results;
}

/**
 * Simple rule-based assessment of content for a value domain
 * @param {string} content - Content to assess
 * @param {Object} domain - Value domain
 * @returns {Object} Assessment result
 */
function simpleDomainAssessment(content, domain) {
  // This is a simplified implementation
  // A real implementation would use more sophisticated NLP
  
  // Define some basic keywords for each core domain
  const domainKeywords = {
    'autonomy': {
      positive: ['choice', 'control', 'decide', 'option', 'freedom', 'independence'],
      negative: ['force', 'must', 'required', 'no choice', 'mandatory', 'compulsory']
    },
    'privacy': {
      positive: ['private', 'confidential', 'secure', 'protected', 'encrypted'],
      negative: ['exposed', 'tracking', 'monitoring', 'surveillance', 'personal data']
    },
    'transparency': {
      positive: ['clear', 'explain', 'transparent', 'understand', 'disclosure'],
      negative: ['hidden', 'obscure', 'unclear', 'deceptive', 'misleading']
    },
    'wellbeing': {
      positive: ['health', 'wellbeing', 'wellness', 'balance', 'beneficial'],
      negative: ['harmful', 'unhealthy', 'dangerous', 'risky', 'detrimental']
    },
    'fairness': {
      positive: ['fair', 'equal', 'just', 'equitable', 'unbiased'],
      negative: ['unfair', 'biased', 'discriminatory', 'prejudiced', 'unequal']
    },
    'safety': {
      positive: ['safe', 'protect', 'secure', 'prevent harm', 'safeguard'],
      negative: ['unsafe', 'dangerous', 'harmful', 'risk', 'hazard']
    }
  };
  
  // Default for custom domains or domains without keywords
  let positiveKeywords = [];
  let negativeKeywords = [];
  
  // Get keywords for domain if available
  if (domainKeywords[domain.name.toLowerCase()]) {
    positiveKeywords = domainKeywords[domain.name.toLowerCase()].positive;
    negativeKeywords = domainKeywords[domain.name.toLowerCase()].negative;
  }
  
  // Add examples from user's framework as keywords
  if (domain.examples && domain.examples.length > 0) {
    domain.examples.forEach(example => {
      if (example.isPositive) {
        positiveKeywords.push(example.text);
      } else {
        negativeKeywords.push(example.text);
      }
    });
  }
  
  // Count occurrences of positive and negative keywords
  const lowerContent = content.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
    const matches = lowerContent.match(regex);
    if (matches) positiveCount += matches.length;
  });
  
  negativeKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
    const matches = lowerContent.match(regex);
    if (matches) negativeCount += matches.length;
  });
  
  // Calculate a basic alignment score
  let score = 0.5; // Neutral starting point
  
  if (positiveCount > 0 || negativeCount > 0) {
    score = positiveCount / (positiveCount + negativeCount);
  }
  
  // If we have no matches, leave it neutral
  
  // Provide an issue description for low scores
  let issue = null;
  if (score < 0.3) {
    issue = `Content may conflict with ${domain.name} values`;
  }
  
  return {
    score,
    positiveMatches: positiveCount,
    negativeMatches: negativeCount,
    issue
  };
}

/**
 * Calculate overall alignment score across domains
 * @param {Object} results - Assessment results by domain
 * @returns {number} Overall alignment score (0-1)
 */
function calculateOverallAlignmentScore(results) {
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Calculate weighted average based on domain importance
  Object.entries(results).forEach(([domainId, result]) => {
    const domain = userValueFramework[domainId];
    if (domain) {
      const weight = domain.userImportance || domain.weight || 0.5;
      weightedSum += result.score * weight;
      totalWeight += weight;
    }
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Get the user's current value framework
 * @returns {Object} Value framework
 */
export function getValueFramework() {
  if (!initialized) {
    console.warn('Value Alignment System not initialized');
    return {};
  }
  
  return JSON.parse(JSON.stringify(userValueFramework));
}

/**
 * Set the alignment threshold
 * @param {number} threshold - New threshold (0-1)
 */
export function setAlignmentThreshold(threshold) {
  if (!initialized) {
    console.warn('Value Alignment System not initialized');
    return;
  }
  
  alignmentThreshold = Math.max(0, Math.min(1, threshold));
  
  // Log the change
  if (security && security.isFeatureAllowed('personalization:learning')) {
    security.logSecureEvent('ethics:value:threshold_changed', {
      threshold: alignmentThreshold
    });
  }
}

/**
 * Perform a value alignment check on content without modifying it
 * @param {string} content - Content to check
 * @returns {Object} Alignment assessment
 */
export function checkAlignment(content) {
  if (!initialized) {
    console.warn('Value Alignment System not initialized');
    return { score: 0.5, passed: true, assessment: {} };
  }
  
  const assessment = assessValueAlignment(content);
  const score = calculateOverallAlignmentScore(assessment);
  
  return {
    score,
    passed: score >= alignmentThreshold,
    assessment,
    threshold: alignmentThreshold
  };
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
async function handleUserLogin(data) {
  if (data?.userId) {
    await loadValueFramework(data.userId);
  }
}

/**
 * Handle user logout event
 */
async function handleUserLogout() {
  await loadValueFramework('anonymous');
}
