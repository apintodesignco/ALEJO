/**
 * feedback-loop.js
 * 
 * Comprehensive feedback management system for ALEJO's reasoning engine.
 * Allows users to provide feedback on reasoning steps, stores and categorizes
 * feedback, and supports automatic application of high-confidence corrections.
 * 
 * Features:
 * - Integration with ALEJO's security components (RBAC, audit trail, privacy guard, consent manager)
 * - Feedback categorization and prioritization
 * - Automatic application of high-confidence corrections
 * - Correction impact tracking
 * - Configurable correction thresholds and behavior
 */
import { subscribe, publish } from '../../core/events.js';
import * as security from '../../security/index.js';
import { validateSource } from './source-validator.js';

// Feedback categories for classification
const FEEDBACK_CATEGORY = {
  FACTUAL_ERROR: 'factual_error',       // Incorrect facts or information
  LOGICAL_FALLACY: 'logical_fallacy',   // Errors in reasoning process
  MISSING_CONTEXT: 'missing_context',   // Important context was omitted
  OUTDATED_INFO: 'outdated_info',       // Information is no longer current
  BIAS_CONCERN: 'bias_concern',         // Potential bias in reasoning
  CLARIFICATION: 'clarification',       // Request for more explanation
  ALTERNATIVE_VIEW: 'alternative_view', // Suggestion of different perspective
  OTHER: 'other'                        // Miscellaneous feedback
};

// Feedback impact levels
const IMPACT_LEVEL = {
  CRITICAL: 'critical',   // Fundamentally changes conclusion
  HIGH: 'high',           // Significantly affects reasoning
  MEDIUM: 'medium',       // Moderately affects reasoning
  LOW: 'low',             // Minor effect on reasoning
  NONE: 'none'            // No effect on reasoning
};

// Default configuration
const DEFAULT_CONFIG = {
  autoApplyThreshold: 0.85,           // Confidence threshold for auto-applying corrections
  requireVerification: true,          // Whether corrections need verification before auto-applying
  maxStoredFeedback: 10000,           // Maximum number of feedback entries to store
  notifyOnHighImpact: true,           // Whether to notify when high-impact feedback is received
  feedbackRetentionDays: 365,         // How long to keep feedback entries
  enableAnonymousFeedback: false,     // Whether to allow feedback without user ID
  enabledCategories: Object.values(FEEDBACK_CATEGORY) // Enabled feedback categories
};

// State management
let initialized = false;
let config = { ...DEFAULT_CONFIG };
let feedbackStore = [];
let appliedCorrections = new Map(); // Maps stepId to applied corrections
let correctionImpacts = new Map();  // Tracks impact of applied corrections
let feedbackListeners = new Map();  // Event listeners for feedback events

/**
 * Initialize the feedback loop system.
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  if (initialized) {
    console.warn('Feedback loop already initialized');
    return true;
  }
  
  try {
    console.log('Initializing ALEJO Feedback Loop');
    
    // Apply configuration options
    config = { ...DEFAULT_CONFIG, ...options };
    
    // Load previously stored feedback if available
    await loadStoredFeedback();
    
    // Set up event subscriptions
    subscribe('reasoning:user-feedback', handleFeedback);
    subscribe('reasoning:step:completed', checkForApplicableCorrections);
    subscribe('user:preferences:updated', handlePreferencesUpdate);
    
    initialized = true;
    publish('reasoning:feedback-loop:initialized', { success: true });
    
    // Log initialization
    await security.auditTrail.logEvent('reasoning:feedback-loop:initialized', {
      configApplied: { ...config, enabledCategories: config.enabledCategories.length }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize feedback loop:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'initialization',
      error: error.message
    });
    return false;
  }
}

/**
 * Handle user feedback to a reasoning step.
 * @param {Object} data - Feedback data
 * @param {string} data.stepId - ID of the reasoning step
 * @param {string} data.correction - Correction text
 * @param {string} data.userId - User ID providing feedback
 * @param {string} [data.category] - Feedback category
 * @param {string} [data.source] - Source URL for correction
 * @param {string} [data.impactLevel] - Estimated impact level
 * @param {number} [data.confidence] - Confidence in correction (0-1)
 * @private
 */
async function handleFeedback(data) {
  try {
    // Validate required fields
    if (!data.stepId || !data.correction) {
      console.error('Invalid feedback data:', data);
      publish('reasoning:feedback-loop:error', { 
        phase: 'feedback-processing',
        error: 'Missing required fields'
      });
      return;
    }
    
    // Check if anonymous feedback is allowed
    if (!data.userId && !config.enableAnonymousFeedback) {
      console.warn('Anonymous feedback rejected');
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'anonymous_feedback_disabled'
      });
      return;
    }
    
    // Check RBAC permissions if user is identified
    if (data.userId) {
      const hasPermission = await security.hasPermission(
        data.userId, 
        'reasoning:provide-feedback'
      );
      
      if (!hasPermission) {
        console.warn(`User ${data.userId} lacks permission to provide feedback`);
        publish('reasoning:feedback-loop:rejected', { 
          reason: 'permission_denied',
          userId: data.userId
        });
        return;
      }
    }
    
    // Check if user consent is granted
    if (data.userId && !await checkUserConsent(data.userId)) {
      console.warn(`User ${data.userId} has not granted consent for feedback processing`);
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'consent_not_granted',
        userId: data.userId
      });
      return;
    }
    
    // Process and enrich feedback data
    const enrichedFeedback = await enrichFeedbackData(data);
    
    // Store the feedback
    const feedbackId = await storeFeedback(enrichedFeedback);
    
    // Publish event
    publish('reasoning:feedback-recorded', { 
      ...enrichedFeedback,
      feedbackId
    });
    
    // Check if this feedback should be automatically applied
    if (shouldAutoApplyFeedback(enrichedFeedback)) {
      await applyFeedback(feedbackId);
    }
    
    // Notify about high-impact feedback if configured
    if (config.notifyOnHighImpact && 
        (enrichedFeedback.impactLevel === IMPACT_LEVEL.CRITICAL || 
         enrichedFeedback.impactLevel === IMPACT_LEVEL.HIGH)) {
      publish('reasoning:high-impact-feedback', enrichedFeedback);
    }
    
    // Log the feedback event
    await security.auditTrail.logEvent('reasoning:feedback-received', {
      feedbackId,
      stepId: enrichedFeedback.stepId,
      category: enrichedFeedback.category,
      impactLevel: enrichedFeedback.impactLevel,
      userId: enrichedFeedback.userId || 'anonymous',
      autoApplied: enrichedFeedback.autoApplied || false
    });
    
  } catch (error) {
    console.error('Error handling feedback:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'feedback-processing',
      error: error.message
    });
  }
}

/**
 * Enrich feedback data with additional information.
 * @param {Object} data - Raw feedback data
 * @returns {Object} Enriched feedback data
 * @private
 */
async function enrichFeedbackData(data) {
  const enriched = { 
    ...data,
    timestamp: new Date().toISOString(),
    id: generateFeedbackId(),
    category: data.category || FEEDBACK_CATEGORY.OTHER,
    processed: false,
    verified: false
  };
  
  // Validate and set source reliability if a source is provided
  if (data.source) {
    try {
      const sourceValidation = await validateSource(data.source);
      enriched.sourceReliability = sourceValidation.overall;
      enriched.sourceCategory = sourceValidation.category;
    } catch (error) {
      console.warn('Could not validate source:', error);
      enriched.sourceReliability = 0.5; // Default to medium reliability
    }
  }
  
  // Calculate confidence if not provided
  if (typeof enriched.confidence !== 'number') {
    enriched.confidence = calculateFeedbackConfidence(enriched);
  }
  
  // Determine impact level if not provided
  if (!enriched.impactLevel) {
    enriched.impactLevel = estimateImpactLevel(enriched);
  }
  
  return enriched;
}

/**
 * Calculate confidence score for feedback.
 * @param {Object} feedback - Feedback data
 * @returns {number} Confidence score (0-1)
 * @private
 */
function calculateFeedbackConfidence(feedback) {
  let score = 0.5; // Start with neutral confidence
  
  // Adjust based on source reliability if available
  if (feedback.sourceReliability) {
    score = score * 0.6 + feedback.sourceReliability * 0.4;
  }
  
  // Adjust based on user reputation if available
  if (feedback.userId) {
    // TODO: Implement user reputation system
    // For now, assume slightly higher confidence for authenticated users
    score += 0.1;
  }
  
  // Cap between 0 and 1
  return Math.max(0, Math.min(1, score));
}

/**
 * Estimate the impact level of feedback.
 * @param {Object} feedback - Feedback data
 * @returns {string} Impact level
 * @private
 */
function estimateImpactLevel(feedback) {
  // Default to medium impact
  if (!feedback.category) {
    return IMPACT_LEVEL.MEDIUM;
  }
  
  // Assign impact levels based on category
  switch (feedback.category) {
    case FEEDBACK_CATEGORY.FACTUAL_ERROR:
      return IMPACT_LEVEL.HIGH;
    case FEEDBACK_CATEGORY.LOGICAL_FALLACY:
      return IMPACT_LEVEL.HIGH;
    case FEEDBACK_CATEGORY.MISSING_CONTEXT:
      return IMPACT_LEVEL.MEDIUM;
    case FEEDBACK_CATEGORY.OUTDATED_INFO:
      return IMPACT_LEVEL.MEDIUM;
    case FEEDBACK_CATEGORY.BIAS_CONCERN:
      return IMPACT_LEVEL.MEDIUM;
    case FEEDBACK_CATEGORY.CLARIFICATION:
      return IMPACT_LEVEL.LOW;
    case FEEDBACK_CATEGORY.ALTERNATIVE_VIEW:
      return IMPACT_LEVEL.LOW;
    case FEEDBACK_CATEGORY.OTHER:
    default:
      return IMPACT_LEVEL.MEDIUM;
  }
}

/**
 * Check if user has granted consent for feedback processing.
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether consent is granted
 * @private
 */
async function checkUserConsent(userId) {
  return security.consentManager.hasConsent('reasoning:feedback');
}

/**
 * Generate a unique ID for feedback.
 * @returns {string} Unique ID
 * @private
 */
function generateFeedbackId() {
  return `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Determine if feedback should be automatically applied.
 * @param {Object} feedback - Feedback data
 * @returns {boolean} Whether to auto-apply
 * @private
 */
function shouldAutoApplyFeedback(feedback) {
  // Don't auto-apply if feature is disabled
  if (!config.autoApplyThreshold || config.autoApplyThreshold >= 1) {
    return false;
  }
  
  // Check if confidence meets threshold
  if (feedback.confidence < config.autoApplyThreshold) {
    return false;
  }
  
  // If verification is required, check if verified
  if (config.requireVerification && !feedback.verified) {
    return false;
  }
  
  // Don't auto-apply for certain categories
  const nonAutoCategories = [
    FEEDBACK_CATEGORY.BIAS_CONCERN,
    FEEDBACK_CATEGORY.ALTERNATIVE_VIEW
  ];
  
  if (nonAutoCategories.includes(feedback.category)) {
    return false;
  }
  
  return true;
}

/**
 * Store feedback in the feedback store.
 * @param {Object} feedback - Feedback data
 * @returns {Promise<string>} Feedback ID
 * @private
 */
async function storeFeedback(feedback) {
  // Check if we need to trim the feedback store
  if (feedbackStore.length >= config.maxStoredFeedback) {
    // Sort by timestamp (oldest first) and remove oldest entries
    feedbackStore.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    feedbackStore = feedbackStore.slice(feedbackStore.length - config.maxStoredFeedback + 1);
  }
  
  // Add to in-memory store
  feedbackStore.push(feedback);
  
  // Encrypt sensitive feedback data if needed
  const encryptedFeedback = await security.privacyGuard.encryptSensitiveData(feedback);
  
  // Store in secure storage
  try {
    await security.secureStorage.store(
      `feedback:${feedback.id}`,
      JSON.stringify(encryptedFeedback)
    );
    
    // Log storage event
    await security.auditTrail.logEvent('reasoning:feedback-stored', {
      feedbackId: feedback.id,
      userId: feedback.userId || 'anonymous',
      timestamp: feedback.timestamp
    });
    
  } catch (error) {
    console.error('Failed to store feedback in secure storage:', error);
    // Still return the ID since we have it in memory
  }
  
  return feedback.id;
}

/**
 * Load previously stored feedback from secure storage.
 * @returns {Promise<void>}
 * @private
 */
async function loadStoredFeedback() {
  try {
    // Get list of feedback keys
    const keys = await security.secureStorage.listKeys('feedback:');
    
    // Load each feedback entry
    for (const key of keys) {
      try {
        const encryptedData = await security.secureStorage.retrieve(key);
        if (!encryptedData) continue;
        
        const data = await security.privacyGuard.decryptSensitiveData(
          JSON.parse(encryptedData)
        );
        
        feedbackStore.push(data);
      } catch (error) {
        console.warn(`Failed to load feedback ${key}:`, error);
      }
    }
    
    console.log(`Loaded ${feedbackStore.length} feedback entries from storage`);
  } catch (error) {
    console.error('Failed to load stored feedback:', error);
  }
}

/**
 * Apply feedback to correct a reasoning step.
 * @param {string} feedbackId - ID of the feedback to apply
 * @returns {Promise<boolean>} Success status
 */
export async function applyFeedback(feedbackId) {
  try {
    // Find the feedback
    const feedback = feedbackStore.find(f => f.id === feedbackId);
    if (!feedback) {
      console.error(`Feedback with ID ${feedbackId} not found`);
      return false;
    }
    
    // Check if already applied
    if (feedback.applied) {
      console.warn(`Feedback ${feedbackId} already applied`);
      return true;
    }
    
    // Mark as applied
    feedback.applied = true;
    feedback.appliedAt = new Date().toISOString();
    
    // Store in applied corrections map
    appliedCorrections.set(feedback.stepId, feedback);
    
    // Update the stored feedback
    await storeFeedback(feedback);
    
    // Publish correction event
    publish('reasoning:correction-applied', {
      stepId: feedback.stepId,
      correction: feedback.correction,
      feedbackId: feedback.id,
      confidence: feedback.confidence,
      source: feedback.source,
      category: feedback.category
    });
    
    // Log application event
    await security.auditTrail.logEvent('reasoning:correction-applied', {
      feedbackId: feedback.id,
      stepId: feedback.stepId,
      userId: feedback.userId || 'anonymous',
      confidence: feedback.confidence,
      category: feedback.category
    });
    
    return true;
  } catch (error) {
    console.error('Failed to apply feedback:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'feedback-application',
      error: error.message,
      feedbackId
    });
    return false;
  }
}

/**
 * Check for applicable corrections when a reasoning step is completed.
 * @param {Object} data - Step completion data
 * @private
 */
async function checkForApplicableCorrections(data) {
  if (!data || !data.stepId) return;
  
  // Check if we have any corrections for this step
  const correction = appliedCorrections.get(data.stepId);
  if (!correction) return;
  
  // Publish event with correction information
  publish('reasoning:step:correction-available', {
    stepId: data.stepId,
    correction: correction.correction,
    confidence: correction.confidence,
    source: correction.source,
    category: correction.category
  });
}

/**
 * Handle user preference updates.
 * @param {Object} data - Updated preferences
 * @private
 */
function handlePreferencesUpdate(data) {
  if (!data || !data.preferences) return;
  
  // Update feedback configuration based on user preferences
  if (data.preferences.feedbackSettings) {
    config = {
      ...config,
      ...data.preferences.feedbackSettings
    };
    
    console.log('Updated feedback configuration:', config);
  }
}

/**
 * Get all feedback entries with permission checking.
 * @param {Object} options - Options for retrieval
 * @param {string} options.userId - User ID requesting feedback
 * @param {string} [options.stepId] - Filter by step ID
 * @param {string} [options.category] - Filter by category
 * @param {boolean} [options.onlyVerified=false] - Only return verified feedback
 * @param {boolean} [options.includeApplied=true] - Include applied feedback
 * @returns {Promise<Array<Object>>} Filtered feedback entries
 */
export async function getFeedback(options = {}) {
  try {
    // Check permissions
    if (!options.userId) {
      throw new Error('User ID is required to retrieve feedback');
    }
    
    const hasPermission = await security.hasPermission(
      options.userId,
      'reasoning:view-feedback'
    );
    
    if (!hasPermission) {
      console.warn(`User ${options.userId} lacks permission to view feedback`);
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'permission_denied',
        userId: options.userId,
        action: 'view-feedback'
      });
      return [];
    }
    
    // Log access event
    await security.auditTrail.logEvent('reasoning:feedback-accessed', {
      userId: options.userId,
      filters: {
        stepId: options.stepId || 'all',
        category: options.category || 'all',
        onlyVerified: !!options.onlyVerified,
        includeApplied: options.includeApplied !== false
      }
    });
    
    // Filter feedback based on options
    return feedbackStore.filter(feedback => {
      // Filter by step ID if provided
      if (options.stepId && feedback.stepId !== options.stepId) {
        return false;
      }
      
      // Filter by category if provided
      if (options.category && feedback.category !== options.category) {
        return false;
      }
      
      // Filter by verification status if requested
      if (options.onlyVerified && !feedback.verified) {
        return false;
      }
      
      // Filter out applied feedback if requested
      if (options.includeApplied === false && feedback.applied) {
        return false;
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error retrieving feedback:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'feedback-retrieval',
      error: error.message
    });
    return [];
  }
}

/**
 * Verify a feedback entry.
 * @param {Object} options - Verification options
 * @param {string} options.feedbackId - ID of feedback to verify
 * @param {string} options.userId - User ID performing verification
 * @param {boolean} options.verified - Verification status
 * @param {string} [options.verificationNote] - Note about verification
 * @returns {Promise<boolean>} Success status
 */
export async function verifyFeedback(options) {
  try {
    // Check required parameters
    if (!options.feedbackId || !options.userId || options.verified === undefined) {
      throw new Error('Missing required parameters');
    }
    
    // Check permissions
    const hasPermission = await security.hasPermission(
      options.userId,
      'reasoning:verify-feedback'
    );
    
    if (!hasPermission) {
      console.warn(`User ${options.userId} lacks permission to verify feedback`);
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'permission_denied',
        userId: options.userId,
        action: 'verify-feedback'
      });
      return false;
    }
    
    // Find the feedback
    const feedback = feedbackStore.find(f => f.id === options.feedbackId);
    if (!feedback) {
      throw new Error(`Feedback with ID ${options.feedbackId} not found`);
    }
    
    // Update verification status
    feedback.verified = options.verified;
    feedback.verifiedBy = options.userId;
    feedback.verifiedAt = new Date().toISOString();
    feedback.verificationNote = options.verificationNote || '';
    
    // Store updated feedback
    await storeFeedback(feedback);
    
    // Log verification event
    await security.auditTrail.logEvent('reasoning:feedback-verified', {
      feedbackId: feedback.id,
      stepId: feedback.stepId,
      userId: options.userId,
      verified: options.verified,
      note: options.verificationNote || ''
    });
    
    // Publish event
    publish('reasoning:feedback-verified', {
      feedbackId: feedback.id,
      verified: options.verified,
      verifiedBy: options.userId
    });
    
    // If verified and meets auto-apply criteria, apply it
    if (options.verified && shouldAutoApplyFeedback(feedback)) {
      await applyFeedback(feedback.id);
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying feedback:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'feedback-verification',
      error: error.message
    });
    return false;
  }
}

/**
 * Get feedback statistics and metrics.
 * @param {Object} options - Options for statistics
 * @param {string} options.userId - User ID requesting statistics
 * @returns {Promise<Object>} Feedback statistics
 */
export async function getFeedbackStats(options = {}) {
  try {
    // Check permissions
    if (!options.userId) {
      throw new Error('User ID is required to retrieve feedback statistics');
    }
    
    const hasPermission = await security.hasPermission(
      options.userId,
      'reasoning:view-feedback-stats'
    );
    
    if (!hasPermission) {
      console.warn(`User ${options.userId} lacks permission to view feedback statistics`);
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'permission_denied',
        userId: options.userId,
        action: 'view-feedback-stats'
      });
      return {};
    }
    
    // Calculate statistics
    const stats = {
      total: feedbackStore.length,
      applied: feedbackStore.filter(f => f.applied).length,
      verified: feedbackStore.filter(f => f.verified).length,
      byCategory: {},
      byImpactLevel: {},
      averageConfidence: 0
    };
    
    // Calculate category and impact level stats
    Object.values(FEEDBACK_CATEGORY).forEach(category => {
      stats.byCategory[category] = feedbackStore.filter(f => f.category === category).length;
    });
    
    Object.values(IMPACT_LEVEL).forEach(level => {
      stats.byImpactLevel[level] = feedbackStore.filter(f => f.impactLevel === level).length;
    });
    
    // Calculate average confidence
    const confidenceSum = feedbackStore.reduce((sum, f) => sum + (f.confidence || 0), 0);
    stats.averageConfidence = feedbackStore.length > 0 ? confidenceSum / feedbackStore.length : 0;
    
    // Log access event
    await security.auditTrail.logEvent('reasoning:feedback-stats-accessed', {
      userId: options.userId
    });
    
    return stats;
  } catch (error) {
    console.error('Error retrieving feedback statistics:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'feedback-stats-retrieval',
      error: error.message
    });
    return {};
  }
}

/**
 * Update feedback loop configuration.
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID updating configuration
 * @param {Object} options.config - New configuration values
 * @returns {Promise<boolean>} Success status
 */
export async function updateConfig(options = {}) {
  try {
    // Check permissions
    if (!options.userId) {
      throw new Error('User ID is required to update configuration');
    }
    
    const hasPermission = await security.hasPermission(
      options.userId,
      'reasoning:configure-feedback'
    );
    
    if (!hasPermission) {
      console.warn(`User ${options.userId} lacks permission to configure feedback system`);
      publish('reasoning:feedback-loop:rejected', { 
        reason: 'permission_denied',
        userId: options.userId,
        action: 'configure-feedback'
      });
      return false;
    }
    
    // Update configuration
    const oldConfig = { ...config };
    config = {
      ...config,
      ...options.config
    };
    
    // Log configuration change
    await security.auditTrail.logEvent('reasoning:feedback-config-updated', {
      userId: options.userId,
      oldConfig,
      newConfig: config,
      changedFields: Object.keys(options.config)
    });
    
    // Publish event
    publish('reasoning:feedback-config-updated', {
      userId: options.userId,
      config
    });
    
    return true;
  } catch (error) {
    console.error('Error updating feedback configuration:', error);
    publish('reasoning:feedback-loop:error', { 
      phase: 'config-update',
      error: error.message
    });
    return false;
  }
}

/**
 * Register a listener for feedback events.
 * @param {string} eventType - Type of event to listen for
 * @param {Function} callback - Callback function
 * @returns {string} Listener ID
 */
export function registerFeedbackListener(eventType, callback) {
  const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  feedbackListeners.set(listenerId, { eventType, callback });
  return listenerId;
}

/**
 * Unregister a feedback event listener.
 * @param {string} listenerId - ID of listener to remove
 * @returns {boolean} Success status
 */
export function unregisterFeedbackListener(listenerId) {
  return feedbackListeners.delete(listenerId);
}

/**
 * Get the current feedback configuration.
 * @returns {Object} Current configuration
 */
export function getConfig() {
  return { ...config };
}

// Export constants for use in other modules
export { FEEDBACK_CATEGORY, IMPACT_LEVEL }
