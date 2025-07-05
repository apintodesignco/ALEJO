/**
 * preference-model.js
 * 
 * Discovers and models user preferences without requiring explicit input.
 * This module analyzes user interactions, choices, and feedback to build
 * a comprehensive preference model that other ALEJO components can use
 * for personalization.
 * 
 * Features:
 * - Implicit preference detection from conversation analysis
 * - Preference strength and confidence scoring
 * - Temporal preference evolution tracking
 * - Contextual preference application
 * - Integration with memory system for long-term preference storage
 */
import { PREFERENCE_CATEGORIES, CONFIDENCE_LEVELS, DECAY_RATES, CONTEXT_FACTORS } from '../constants/preference-constants.js';
import { publish } from '../../core/event-bus.js';
import { auditTrail } from '../../utils/audit-trail.js';
import { preferenceCache } from '../../utils/cache-manager.js';
import { normalizePreferenceStrength } from './preference-normalization.js';
import * as memoryCurator from '../memory/memory-curator.js';
import * as personalGraph from '../memory/personal-graph.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'preferences:';
const PREFERENCES_KEY = 'model';
const PREFERENCE_HISTORY_KEY = 'history';

// Preference categories
const PREFERENCE_CATEGORIES = {
  CONTENT: 'content',           // Content topics and formats
  INTERACTION: 'interaction',   // How the user likes to interact
  INTERFACE: 'interface',       // UI/UX preferences
  NOTIFICATION: 'notification', // Notification preferences
  PRIVACY: 'privacy',           // Privacy settings
  SCHEDULING: 'scheduling',     // Time and scheduling preferences
  LANGUAGE: 'language',         // Language and communication preferences
  ACCESSIBILITY: 'accessibility', // Accessibility needs
  COGNITIVE: 'cognitive',       // Cognitive processing preferences
  EMOTIONAL: 'emotional',       // Emotional tone preferences
  SOCIAL: 'social',             // Social interaction preferences
  LEARNING: 'learning'          // Learning style preferences
};

// Preference confidence levels
const CONFIDENCE_LEVELS = {
  INFERRED: 0.3,    // Inferred from limited data
  OBSERVED: 0.6,    // Observed multiple times
  CONFIRMED: 0.9,   // Explicitly confirmed by user
  EXPLICIT: 1.0     // Explicitly set by user
};

// Preference decay rates - how quickly preferences become less relevant over time
const DECAY_RATES = {
  FAST: 0.05,       // Decays quickly (e.g., temporary preferences)
  STANDARD: 0.02,   // Normal decay rate
  SLOW: 0.01,       // Decays slowly (e.g., fundamental preferences)
  PERSISTENT: 0.005 // Very slow decay (e.g., core values)
};

// Context factors for preference strength adjustment
const CONTEXT_FACTORS = {
  TIME_OF_DAY: 1.2,    // Time-relevant preferences get boosted
  EMOTIONAL: 0.9,      // Emotional state can affect preference strength
  LOCATION: 1.1,       // Location context can boost relevant preferences
  SOCIAL: 1.15,        // Social context can affect preferences
  ACTIVITY: 1.2        // Activity context can boost relevant preferences
};

// In-memory cache of user preferences
const userPreferences = new Map(); // userId -> preference model
const preferenceHistory = new Map(); // userId -> preference history

/**
 * Initialize or retrieve preference model for a user.
 * @param {string} userId - User identifier
 * @param {Object} options - Additional options
 * @param {boolean} options.bypassCache - Whether to bypass the cache
 * @returns {Promise<Object>} User's preference model
 */
async function getPreferenceModel(userId, options = { bypassCache: false }) {
  try {
    const startTime = performance.now();
    const cacheKey = `preference_model:${userId}`;
    
    // Check cache first if not bypassing
    if (!options.bypassCache) {
      const cachedModel = preferenceCache.get(cacheKey);
      if (cachedModel) {
        const duration = performance.now() - startTime;
        auditTrail.log('preferences:cache:hit', { userId, duration });
        return { ...cachedModel }; // Return a copy to prevent unintended mutations
      }
    }
    
    // Not in cache or bypassing cache, check in-memory map
    if (!userPreferences.has(userId)) {
      // Load from secure storage or initialize
      const storedModel = await loadPreferenceModel(userId);
      
      if (storedModel) {
        userPreferences.set(userId, storedModel);
        // Also update cache
        preferenceCache.set(cacheKey, storedModel);
      } else {
        // Initialize new preference model
        const initialModel = {
          preferences: {},
          lastUpdated: Date.now(),
          version: 1
        };
        
        userPreferences.set(userId, initialModel);
        preferenceCache.set(cacheKey, initialModel);
        await savePreferenceModel(userId, initialModel);
      }
      
      // Load preference history
      preferenceHistory.set(userId, await loadPreferenceHistory(userId) || []);
    }
    
    const model = { ...userPreferences.get(userId) };
    
    // Log cache miss metrics
    const duration = performance.now() - startTime;
    auditTrail.log('preferences:cache:miss', { 
      userId, 
      duration,
      cacheStats: preferenceCache.getStats()
    });
    
    return model;
  } catch (error) {
    console.error('Error getting preference model:', error);
    auditTrail.log('preferences:model:error', { userId, error: error.message });
    
    // Return default model if error
    return {
      preferences: {},
      lastUpdated: Date.now(),
      version: 1
    };
  }
}

/**
 * Get a specific user preference.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} defaultValue - Default value if preference not found
 * @param {Object} options - Additional options
 * @param {boolean} options.bypassCache - Whether to bypass the cache
 * @returns {Promise<*>} Preference value
 */
export async function getPreference(userId, key, defaultValue = null, options = { bypassCache: false }) {
  try {
    const startTime = performance.now();
    const cacheKey = `preference:${userId}:${key}`;
    
    // Check specific preference cache first if not bypassing
    if (!options.bypassCache) {
      const cachedPreference = preferenceCache.get(cacheKey);
      if (cachedPreference !== undefined) {
        const duration = performance.now() - startTime;
        auditTrail.log('preferences:item:cache:hit', { userId, key, duration });
        return cachedPreference;
      }
    }
    
    // Get the full model (which may come from cache)
    const model = await getPreferenceModel(userId, options);
    let result = defaultValue;
    let found = false;
    
    // Return preference if it exists and has sufficient confidence
    if (model.preferences[key] && model.preferences[key].confidence > 0.3) {
      result = model.preferences[key].value;
      found = true;
    } else {
      // Check if preference exists in any category
      for (const category in model.preferences) {
        if (model.preferences[category][key] && model.preferences[category][key].confidence > 0.3) {
          result = model.preferences[category][key].value;
          found = true;
          break;
        }
      }
    }
    
    // Cache the result for future lookups
    preferenceCache.set(cacheKey, result);
    
    // Log metrics
    const duration = performance.now() - startTime;
    auditTrail.log(found ? 'preferences:item:found' : 'preferences:item:default', { 
      userId, 
      key, 
      duration,
      fromCache: options.bypassCache ? false : !!preferenceCache.get(`preference_model:${userId}`)
    });
    
    return result;
  } catch (error) {
    console.error(`Error getting preference ${key}:`, error);
    auditTrail.log('preferences:get:error', { userId, key, error: error.message });
    return defaultValue;
  }
}

/**
 * Set a user preference explicitly.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {string} category - Preference category
 * @returns {Promise<boolean>} Success status
 */
export async function setPreference(userId, key, value, category = PREFERENCE_CATEGORIES.CONTENT) {
  try {
    const model = await getPreferenceModel(userId);
    const timestamp = Date.now();
    
    // Create or update preference
    model.preferences[key] = {
      value,
      confidence: CONFIDENCE_LEVELS.EXPLICIT,
      category,
      firstObserved: model.preferences[key]?.firstObserved || timestamp,
      lastUpdated: timestamp,
      source: 'explicit',
      occurrences: (model.preferences[key]?.occurrences || 0) + 1
    };
    
    model.lastUpdated = timestamp;
    model.version += 1;
    
    // Save updated model
    userPreferences.set(userId, model);
    await savePreferenceModel(userId, model);
    
    // Record in history
    await recordPreferenceChange(userId, key, value, 'explicit', category);
    
    // Create memory for explicit preferences
    await memoryCurator.createMemory({
      userId,
      type: 'preference',
      content: `Set preference for ${key} to ${JSON.stringify(value)}`,
      importance: 0.7,
      context: {
        timestamp,
        category,
        preferenceKey: key,
        preferenceValue: value
      }
    });
    
    // Publish preference updated event
    publish('user:preference:updated', {
      userId,
      key,
      value,
      category,
      source: 'explicit'
    });
    
    // Log the preference update
    auditTrail.log('preferences:set', {
      userId,
      key,
      category,
      source: 'explicit'
    });
    
    return true;
  } catch (error) {
    console.error(`Error setting preference ${key}:`, error);
    auditTrail.log('preferences:set:error', { userId, key, error: error.message });
    return false;
  }
}

/**
 * Observe a user preference and update the model.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {string} category - Preference category
 * @param {string} source - Source of the preference observation
 * @param {number} strength - Strength of the preference (0.0 to 1.0)
 * @param {number} decayRate - Rate at which this preference decays over time
 * @param {Object} context - Additional context for the preference observation
 * @returns {Promise<boolean>} Success status
 */
export async function observePreference(userId, key, value, category = PREFERENCE_CATEGORIES.CONTENT, source = 'interaction', strength = 0.5, decayRate = DECAY_RATES.STANDARD, context = {}) {
  try {
    // Start performance measurement
    const startTime = performance.now();
    let performanceMetrics = {
      totalTime: 0,
      relationshipLookupTime: 0,
      decayCalculationTime: 0,
      normalizationTime: 0,
      dbOperationsTime: 0,
      cacheOperations: 0
    };
    
    // Generate cache key for this user's preference model
    const cacheKey = `preference_model:${userId}`;
    
    // Try to get model from cache first
    let model = preferenceCache.get(cacheKey);
    let cacheHit = !!model;
    
    // If not in cache, load from storage
    if (!model) {
      model = await getPreferenceModel(userId);
      // Store in cache for future use
      if (model) {
        preferenceCache.set(cacheKey, model);
        performanceMetrics.cacheOperations++;
      }
    } else {
      performanceMetrics.cacheOperations++;
    }
    
    // Initialize category if needed
    if (!model.preferences[category]) {
      model.preferences[category] = {};
    }
    
    const now = Date.now();
    const preference = model.preferences[category][key] || {
      value: null,
      confidence: CONFIDENCE_LEVELS.LOW,
      observations: 0,
      firstObserved: now,
      lastObserved: now,
      lastUpdated: now,
      strength: 0,
      decayRate: DECAY_RATES.STANDARD
    };
    
    // Apply temporal decay to existing preference strength if it exists
    if (preference.value !== null) {
      const decayStartTime = performance.now();
      
      const timeSinceLastUpdate = now - preference.lastUpdated;
      const decayFactor = Math.exp(-preference.decayRate * (timeSinceLastUpdate / (1000 * 60 * 60 * 24))); // Convert to days
      preference.strength *= decayFactor;
      
      performanceMetrics.decayCalculationTime = performance.now() - decayStartTime;
    }
    
    // If we have relationship context, adjust preference strength
    if (context.entityId) {
      try {
        const relationshipStartTime = performance.now();
        
        // Import the relationship integration module
        const { adjustPreferenceByRelationship, updateRelationshipFromPreference } = await import('./preference-relationship-integration.js');
        
        // Adjust strength based on relationship context
        const relationshipAdjustedStrength = await adjustPreferenceByRelationship(userId, context.entityId, strength);
        strength = relationshipAdjustedStrength;
        
        // Update relationship memory with this preference
        await updateRelationshipFromPreference(userId, context.entityId, key, value, strength);
        
        performanceMetrics.relationshipLookupTime = performance.now() - relationshipStartTime;
      } catch (err) {
        console.warn('Failed to integrate with relationship memory:', err);
        // Continue with original strength if relationship integration fails
      }
    }
    
    // Update preference with new observation
    preference.observations += 1;
    preference.lastObserved = now;
    preference.lastUpdated = now;
    
    // Store context snapshot with this preference if provided
    if (Object.keys(context).length > 0) {
      preference.contextSnapshot = { ...context, timestamp: now };
    }
    
    // Get existing preferences in this category for normalization context
    const existingPreferences = Object.entries(model.preferences[category] || {})
      .filter(([existingKey]) => existingKey !== key)
      .map(([, pref]) => pref);
    
    // Apply normalization to prevent preference drift
    const normalizationStartTime = performance.now();
    const normalizedStrength = normalizePreferenceStrength(
      strength, 
      category, 
      existingPreferences
    );
    
    // Update value and strength conservatively based on confidence and new strength
    if (preference.value === null || normalizedStrength > preference.strength) {
      preference.value = value;
      preference.strength = Math.min(1.0, preference.strength + (normalizedStrength * 0.5)); // Conservative update
    }
    
    performanceMetrics.normalizationTime = performance.now() - normalizationStartTime;
    
    // Update confidence based on observations and strength
    if (preference.observations >= 3 && preference.strength >= 0.6) {
      preference.confidence = CONFIDENCE_LEVELS.OBSERVED;
    } else if (preference.observations >= 1) {
      preference.confidence = CONFIDENCE_LEVELS.INFERRED;
    }
    
    // Save the updated preference
    model.preferences[category][key] = preference;
    
    // Update model metadata
    model.lastUpdated = now;
    model.version = (model.version || 0) + 1;
    
    // Update cache with the modified model
    preferenceCache.set(cacheKey, model);
    performanceMetrics.cacheOperations++;
    
    // Save updated model
    const dbStartTime = performance.now();
    await savePreferenceModel(userId, model);
    
    // Record preference change in history
    await recordPreferenceChange(userId, key, value, source, category, normalizedStrength);
    performanceMetrics.dbOperationsTime = performance.now() - dbStartTime;
    
    // Publish event if confidence is sufficient
    if (preference.confidence >= CONFIDENCE_LEVELS.OBSERVED) {
      publish('user:preference:observed', {
        userId,
        key,
        value,
        category,
        confidence: preference.confidence,
        strength: preference.strength,
        source
      });
    }
    
    // Calculate and log total performance metrics
    performanceMetrics.totalTime = performance.now() - startTime;
    
    // Log performance metrics for monitoring
    if (performanceMetrics.totalTime > 100) { // Only log slow operations
      console.debug('Preference observation performance metrics:', {
        userId,
        key,
        hasRelationshipContext: !!context.entityId,
        metrics: performanceMetrics
      });
    }
    
    // Add telemetry for performance monitoring
    auditTrail.log('preferences:performance', {
      userId,
      key,
      category,
      totalTime: performanceMetrics.totalTime,
      relationshipLookupTime: performanceMetrics.relationshipLookupTime,
      decayCalculationTime: performanceMetrics.decayCalculationTime,
      dbOperationsTime: performanceMetrics.dbOperationsTime
    });
    
    return true;
  } catch (error) {
    console.error(`Error observing preference ${key}:`, error);
    auditTrail.log('preferences:observe:error', { userId, key, error: error.message });
    return false;
  }
}

/**
 * Confirm a previously observed preference.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @returns {Promise<boolean>} Success status
 */
export async function confirmPreference(userId, key) {
  try {
    const model = await getPreferenceModel(userId);
    
    if (!model.preferences[key]) {
      return false;
    }
    
    // Update confidence to confirmed
    model.preferences[key].confidence = CONFIDENCE_LEVELS.CONFIRMED;
    model.preferences[key].lastUpdated = Date.now();
    model.lastUpdated = Date.now();
    model.version += 1;
    
    // Save updated model
    userPreferences.set(userId, model);
    await savePreferenceModel(userId, model);
    
    // Record in history
    await recordPreferenceChange(
      userId, 
      key, 
      model.preferences[key].value, 
      'confirmation', 
      model.preferences[key].category
    );
    
    // Publish preference confirmed event
    publish('user:preference:confirmed', {
      userId,
      key,
      value: model.preferences[key].value,
      category: model.preferences[key].category
    });
    
    return true;
  } catch (error) {
    console.error(`Error confirming preference ${key}:`, error);
    auditTrail.log('preferences:confirm:error', { userId, key, error: error.message });
    return false;
  }
}

/**
 * Record a preference change in history.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {string} source - Source of change
 * @param {string} category - Preference category
 * @returns {Promise<boolean>} Success status
 */
async function recordPreferenceChange(userId, key, value, source, category) {
  try {
    if (!preferenceHistory.has(userId)) {
      preferenceHistory.set(userId, await loadPreferenceHistory(userId) || []);
    }
    
    const history = preferenceHistory.get(userId);
    
    // Add change to history
    history.push({
      timestamp: Date.now(),
      key,
      value,
      source,
      category
    });
    
    // Keep history to a reasonable size (last 100 changes)
    if (history.length > 100) {
      history.shift();
    }
    
    // Save updated history
    preferenceHistory.set(userId, history);
    await savePreferenceHistory(userId, history);
    
    return true;
  } catch (error) {
    console.error('Error recording preference change:', error);
    return false;
  }
}

/**
 * Get all preferences for a user by category.
 * @param {string} userId - User identifier
 * @param {string} category - Preference category (optional)
 * @param {number} minConfidence - Minimum confidence level (0-1)
 * @returns {Promise<Object>} User preferences by category
 */
export async function getPreferencesByCategory(userId, category = null, minConfidence = 0.3) {
  try {
    const model = await getPreferenceModel(userId);
    const result = {};
    
    // Filter preferences by category and confidence
    Object.entries(model.preferences).forEach(([key, pref]) => {
      if ((category === null || pref.category === category) && 
          pref.confidence >= minConfidence) {
        
        if (!result[pref.category]) {
          result[pref.category] = {};
        }
        
        result[pref.category][key] = pref.value;
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error getting preferences by category:', error);
    auditTrail.log('preferences:category:error', { userId, category, error: error.message });
    return {};
  }
}

/**
 * Get preference history for a user.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of history entries
 * @returns {Promise<Array>} Preference history
 */
export async function getPreferenceHistory(userId, limit = 20) {
  try {
    if (!preferenceHistory.has(userId)) {
      preferenceHistory.set(userId, await loadPreferenceHistory(userId) || []);
    }
    
    const history = preferenceHistory.get(userId);
    
    // Return most recent entries up to the limit
    return history.slice(-limit).reverse();
  } catch (error) {
    console.error('Error getting preference history:', error);
    auditTrail.log('preferences:history:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Load preference model from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's preference model
 */
async function loadPreferenceModel(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${PREFERENCES_KEY}`
    );
  } catch (error) {
    console.error('Error loading preference model:', error);
    return null;
  }
}

/**
 * Save preference model to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} model - Preference model to save
 * @returns {Promise<boolean>} Success status
 */
async function savePreferenceModel(userId, model) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${PREFERENCES_KEY}`,
      model
    );
  } catch (error) {
    console.error('Error saving preference model:', error);
    return false;
  }
}

/**
 * Load preference history from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User's preference history
 */
async function loadPreferenceHistory(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${PREFERENCE_HISTORY_KEY}`
    ) || [];
  } catch (error) {
    console.error('Error loading preference history:', error);
    return [];
  }
}

/**
 * Save preference history to secure storage.
 * @param {string} userId - User identifier
 * @param {Array} history - Preference history to save
 * @returns {Promise<boolean>} Success status
 */
async function savePreferenceHistory(userId, history) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${PREFERENCE_HISTORY_KEY}`,
      history
    );
  } catch (error) {
    console.error('Error saving preference history:', error);
    return false;
  }
}

/**
 * Initialize the preference model by subscribing to events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    console.log('Initializing preference model...');
    
    // Subscribe to conversation message events to detect preferences
    subscribe('conversation:message', async ({ userId, message, context }) => {
      await detectPreferencesFromMessage(userId, message, context);
    });
    
    // Subscribe to user action events
    subscribe('user:action', async ({ userId, action, context }) => {
      await detectPreferencesFromAction(userId, action, context);
    });
    
    // Subscribe to user feedback events
    subscribe('user:feedback', async ({ userId, feedback, context }) => {
      await processUserFeedback(userId, feedback, context);
    });
    
    // Subscribe to entity tracking events
    subscribe('entity:tracked', async ({ userId, entity, context }) => {
      if (entity.type === 'preference') {
        await observePreference(
          userId,
          `${entity.category}:${entity.name}`,
          entity.value,
          entity.category,
          'entity_tracking'
        );
      }
    });
    
    // Run periodic preference consolidation
    setInterval(async () => {
      for (const userId of userPreferences.keys()) {
        await consolidatePreferences(userId);
      }
    }, 24 * 60 * 60 * 1000); // Once per day
    
    publish('preferences:model:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing preference model:', error);
    return false;
  }
}

/**
 * Detect preferences from user message content using advanced NLP patterns and contextual analysis.
 * @param {string} userId - User identifier
 * @param {string} message - User message
 * @param {Object} context - Message context including time, emotional state, etc.
 * @returns {Promise<boolean>} Success status
 */
async function detectPreferencesFromMessage(userId, message, context = {}) {
  try {
    // Enhanced preference detection patterns with more nuanced understanding
    const patterns = [
      // Content preferences - explicit statements with sentiment analysis
      {
        regex: /I (like|love|enjoy|prefer|am interested in|am fond of) ([\w\s\-,']+)/i,
        handler: (match) => {
          const sentiment = getPreferenceSentiment(match[1]);
          const topic = match[2].trim().toLowerCase();
          return {
            key: `content:liked:${topic}`,
            value: true,
            strength: sentiment,
            category: PREFERENCE_CATEGORIES.CONTENT,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      {
        regex: /I (dislike|hate|don't like|do not like|can't stand|cannot stand|am not interested in) ([\w\s\-,']+)/i,
        handler: (match) => {
          const sentiment = getPreferenceSentiment(match[1], true);
          const topic = match[2].trim().toLowerCase();
          return {
            key: `content:disliked:${topic}`,
            value: true,
            strength: sentiment,
            category: PREFERENCE_CATEGORIES.CONTENT,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      
      // Content preferences - comparative statements
      {
        regex: /I (prefer|would rather|like more) ([\w\s\-,']+) (than|over|instead of) ([\w\s\-,']+)/i,
        handler: (match) => {
          const preferredTopic = match[2].trim().toLowerCase();
          const lesserTopic = match[4].trim().toLowerCase();
          return [
            {
              key: `content:liked:${preferredTopic}`,
              value: true,
              strength: 0.8,
              category: PREFERENCE_CATEGORIES.CONTENT,
              decayRate: DECAY_RATES.STANDARD
            },
            {
              key: `content:comparative:${preferredTopic}:${lesserTopic}`,
              value: true,
              strength: 0.7,
              category: PREFERENCE_CATEGORIES.CONTENT,
              decayRate: DECAY_RATES.STANDARD
            }
          ];
        }
      },
      
      // Interface preferences with more detail
      {
        regex: /I (like|prefer|want) (dark|light|high contrast|minimalist|colorful|simple) (mode|theme|interface|design|layout)/i,
        handler: (match) => {
          const preference = match[2].toLowerCase();
          return {
            key: 'interface:theme',
            value: preference,
            strength: 0.9,
            category: PREFERENCE_CATEGORIES.INTERFACE,
            decayRate: DECAY_RATES.SLOW
          };
        }
      },
      
      // Font and text preferences
      {
        regex: /I (prefer|like|need) (larger|smaller|bigger|readable|legible|accessible) (text|font|fonts)/i,
        handler: (match) => {
          const size = match[2].toLowerCase();
          let value = 'medium';
          
          if (['larger', 'bigger'].includes(size)) value = 'large';
          else if (['smaller'].includes(size)) value = 'small';
          else if (['readable', 'legible', 'accessible'].includes(size)) value = 'accessible';
          
          return {
            key: 'interface:font_size',
            value: value,
            strength: 0.85,
            category: PREFERENCE_CATEGORIES.ACCESSIBILITY,
            decayRate: DECAY_RATES.SLOW
          };
        }
      },
      
      // Notification preferences with more detail
      {
        regex: /(don't|do not|please don't|never) (notify|alert|send|bother) me (?:about|with) ([\w\s\-,']+)/i,
        handler: (match) => {
          const topic = match[3].trim().toLowerCase();
          return {
            key: `notification:disabled:${topic}`,
            value: true,
            strength: 0.9,
            category: PREFERENCE_CATEGORIES.NOTIFICATION,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      {
        regex: /(always|please) (notify|alert|inform|tell) me (?:about|of|when) ([\w\s\-,']+)/i,
        handler: (match) => {
          const topic = match[3].trim().toLowerCase();
          return {
            key: `notification:enabled:${topic}`,
            value: true,
            strength: 0.9,
            category: PREFERENCE_CATEGORIES.NOTIFICATION,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      
      // Language preferences with more detail
      {
        regex: /I (prefer|like|want) to (speak|talk|communicate|use|read|write) in ([\w\s\-,']+)/i,
        handler: (match) => {
          const language = match[3].trim().toLowerCase();
          return {
            key: 'language:preferred',
            value: language,
            strength: 0.95,
            category: PREFERENCE_CATEGORIES.LANGUAGE,
            decayRate: DECAY_RATES.SLOW
          };
        }
      },
      
      // Cognitive style preferences
      {
        regex: /I (prefer|like|want) (detailed|brief|concise|thorough|comprehensive|simple|complex) (explanations|information|answers|responses)/i,
        handler: (match) => {
          const style = match[2].toLowerCase();
          let value = 'balanced';
          
          if (['detailed', 'thorough', 'comprehensive'].includes(style)) value = 'detailed';
          else if (['brief', 'concise', 'simple'].includes(style)) value = 'concise';
          else if (['complex'].includes(style)) value = 'complex';
          
          return {
            key: 'cognitive:detail_level',
            value: value,
            strength: 0.85,
            category: PREFERENCE_CATEGORIES.COGNITIVE,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      
      // Learning style preferences
      {
        regex: /I (learn|understand) better (with|through|by|using) (visual|audio|text|reading|listening|watching|examples|practice|doing)/i,
        handler: (match) => {
          const style = match[3].toLowerCase();
          let value = style;
          
          // Normalize learning styles
          if (['reading', 'text'].includes(style)) value = 'textual';
          else if (['listening', 'audio'].includes(style)) value = 'auditory';
          else if (['watching', 'visual'].includes(style)) value = 'visual';
          else if (['doing', 'practice', 'examples'].includes(style)) value = 'kinesthetic';
          
          return {
            key: 'learning:style',
            value: value,
            strength: 0.8,
            category: PREFERENCE_CATEGORIES.LEARNING,
            decayRate: DECAY_RATES.SLOW
          };
        }
      },
      
      // Emotional tone preferences
      {
        regex: /I (prefer|like|want) (formal|informal|serious|casual|professional|friendly|humorous|technical) (tone|communication|conversation|interaction)/i,
        handler: (match) => {
          const tone = match[2].toLowerCase();
          return {
            key: 'emotional:tone',
            value: tone,
            strength: 0.75,
            category: PREFERENCE_CATEGORIES.EMOTIONAL,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      
      // Social interaction preferences
      {
        regex: /I (prefer|like|enjoy) (direct|indirect|collaborative|independent|guided|autonomous) (communication|work|interaction|approach)/i,
        handler: (match) => {
          const style = match[2].toLowerCase();
          return {
            key: 'social:interaction_style',
            value: style,
            strength: 0.8,
            category: PREFERENCE_CATEGORIES.SOCIAL,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      },
      
      // Time of day preferences
      {
        regex: /I (prefer|like|am more productive|work better) (in the|during the|at) (morning|afternoon|evening|night)/i,
        handler: (match) => {
          const timeOfDay = match[3].toLowerCase();
          return {
            key: 'scheduling:preferred_time',
            value: timeOfDay,
            strength: 0.7,
            category: PREFERENCE_CATEGORIES.SCHEDULING,
            decayRate: DECAY_RATES.STANDARD
          };
        }
      }
    ];
    
    // Extract contextual factors that might affect preference strength
    const contextFactors = extractContextFactors(context);
    
    // Check message against patterns
    const detectedPreferences = [];
    
    for (const pattern of patterns) {
      const match = message.match(pattern.regex);
      
      if (match) {
        const preferences = pattern.handler(match);
        
        // Handle both single preference and arrays of preferences
        const prefsArray = Array.isArray(preferences) ? preferences : [preferences];
        
        for (const pref of prefsArray) {
          if (pref) {
            // Apply contextual weighting to preference strength
            const adjustedStrength = adjustPreferenceStrength(pref.strength, contextFactors);
            
            // Add to detected preferences
            detectedPreferences.push({
              ...pref,
              strength: adjustedStrength
            });
          }
        }
      }
    }
    
    // Process all detected preferences
    for (const pref of detectedPreferences) {
      await observePreference(
        userId,
        pref.key,
        pref.value,
        pref.category,
        'message_analysis',
        pref.strength,
        pref.decayRate || DECAY_RATES.STANDARD
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error detecting preferences from message:', error);
    return false;
  }
}

/**
 * Get sentiment strength based on preference verb used
 * @param {string} verb - The preference verb used
 * @param {boolean} negative - Whether this is a negative preference
 * @returns {number} Sentiment strength from 0.0 to 1.0
 */
function getPreferenceSentiment(verb, negative = false) {
  const verbLower = verb.toLowerCase();
  
  // Positive sentiment mappings
  const positiveSentiments = {
    'love': 1.0,
    'adore': 0.95,
    'enjoy': 0.8,
    'like': 0.7,
    'prefer': 0.6,
    'am interested in': 0.5,
    'am fond of': 0.65
  };
  
  // Negative sentiment mappings
  const negativeSentiments = {
    'hate': 1.0,
    'can\'t stand': 0.9,
    'cannot stand': 0.9,
    'dislike': 0.7,
    'don\'t like': 0.6,
    'do not like': 0.6,
    'am not interested in': 0.5
  };
  
  const sentiments = negative ? negativeSentiments : positiveSentiments;
  
  // Find the closest matching verb
  for (const [key, value] of Object.entries(sentiments)) {
    if (verbLower.includes(key)) {
      return value;
    }
  }
  
  // Default sentiment if no match
  return negative ? 0.6 : 0.6;
}

/**
 * Extract contextual factors from the provided context
 * @param {Object} context - The context object
 * @returns {Object} Extracted context factors
 */
function extractContextFactors(context) {
  const factors = {};
  
  if (context.time) {
    const hour = new Date(context.time).getHours();
    factors.timeOfDay = hour < 6 ? 'night' : 
                       (hour < 12 ? 'morning' : 
                       (hour < 18 ? 'afternoon' : 'evening'));
  }
  
  if (context.location) {
    factors.location = context.location;
  }
  
  if (context.activity) {
    factors.activity = context.activity;
  }
  
  if (context.emotional_state) {
    factors.emotionalState = context.emotional_state;
  }
  
  if (context.device) {
    factors.device = context.device;
  }
  
  if (context.social_context) {
    factors.socialContext = context.social_context;
  }
  
  return factors;
}

/**
 * Adjust preference strength based on contextual factors
 * @param {number} baseStrength - Base preference strength
 * @param {Object} contextFactors - Contextual factors
 * @returns {number} Adjusted preference strength
 */
function adjustPreferenceStrength(baseStrength, contextFactors) {
  let adjustedStrength = baseStrength;
  
  // Apply time of day context
  if (contextFactors.timeOfDay) {
    // Time-sensitive preferences are stronger when expressed during relevant time
    adjustedStrength *= CONTEXT_FACTORS.TIME_OF_DAY;
  }
  
  // Apply emotional state context
  if (contextFactors.emotionalState) {
    // Preferences expressed during strong emotional states may be temporary
    const emotionIntensity = typeof contextFactors.emotionalState === 'object' ? 
                            contextFactors.emotionalState.intensity || 0.5 : 0.5;
    
    if (emotionIntensity > 0.7) {
      // High emotional states might lead to temporary preferences
      adjustedStrength *= (1 - (emotionIntensity - 0.7));
    } else {
      // Normal emotional states don't affect preferences much
      adjustedStrength *= CONTEXT_FACTORS.EMOTIONAL;
    }
  }
  
  // Ensure strength stays within valid range
  return Math.max(0.1, Math.min(1.0, adjustedStrength));
}

/**
 * Detect preferences from user actions with advanced context analysis.
 * @param {string} userId - User identifier
 * @param {Object} action - User action
 * @param {Object} context - Action context
 * @returns {Promise<boolean>} Success status
 */
async function detectPreferencesFromAction(userId, action, context = {}) {
  try {
    // Extract contextual factors that might affect preference strength
    const contextFactors = extractContextFactors(context);
    
    // Handle different action types with appropriate strength and decay rates
    switch (action.type) {
      case 'select':
        // Track selection preferences - explicit selections are strong signals
        await observePreference(
          userId,
          `interaction:selected:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.INTERACTION,
          'user_action',
          0.85, // High strength for explicit selections
          DECAY_RATES.STANDARD
        );
        
        // Also infer content preference from selection
        await observePreference(
          userId,
          `content:liked:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action_inference',
          0.7, // Slightly lower strength for inferred preference
          DECAY_RATES.STANDARD
        );
        break;
        
      case 'skip':
        // Track skipped content - skipping is a moderate negative signal
        await observePreference(
          userId,
          `content:skipped:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action',
          0.6, // Moderate strength for skips
          DECAY_RATES.STANDARD
        );
        
        // Also infer potential dislike from skipping
        if (action.immediate === true) { // If skipped immediately, stronger signal
          await observePreference(
            userId,
            `content:disliked:${action.category}:${action.item}`,
            true,
            PREFERENCE_CATEGORIES.CONTENT,
            'user_action_inference',
            0.5, // Lower strength for inferred dislike
            DECAY_RATES.STANDARD
          );
        }
        break;
        
      case 'view':
        // Track viewed content duration - longer views indicate stronger preference
        if (action.duration) {
          // Calculate strength based on view duration
          let viewStrength = 0.3; // Base strength
          
          if (action.duration > 120000) { // > 2 minutes
            viewStrength = 0.8;
          } else if (action.duration > 60000) { // > 1 minute
            viewStrength = 0.7;
          } else if (action.duration > 30000) { // > 30 seconds
            viewStrength = 0.6;
          } else if (action.duration > 10000) { // > 10 seconds
            viewStrength = 0.4;
          }
          
          // Apply contextual adjustments
          viewStrength = adjustPreferenceStrength(viewStrength, contextFactors);
          
          await observePreference(
            userId,
            `content:viewed:${action.category}:${action.item}`,
            true,
            PREFERENCE_CATEGORIES.CONTENT,
            'user_action',
            viewStrength,
            DECAY_RATES.STANDARD
          );
          
          // For very long views, infer a stronger content preference
          if (action.duration > 60000) { // > 1 minute
            await observePreference(
              userId,
              `content:liked:${action.category}:${action.item}`,
              true,
              PREFERENCE_CATEGORIES.CONTENT,
              'user_action_inference',
              viewStrength * 0.8, // Slightly lower than view strength
              DECAY_RATES.STANDARD
            );
          }
        }
        break;
        
      case 'schedule':
        // Track scheduling preferences with time context
        if (action.time) {
          const hour = new Date(action.time).getHours();
          const timeOfDay = hour < 6 ? 'night' : 
                           (hour < 12 ? 'morning' : 
                           (hour < 17 ? 'afternoon' : 'evening'));
          
          await observePreference(
            userId,
            `scheduling:preferred_time`,
            timeOfDay,
            PREFERENCE_CATEGORIES.SCHEDULING,
            'user_action',
            0.75, // Strong signal for explicit scheduling
            DECAY_RATES.SLOW // Time preferences change slowly
          );
        }
        break;
        
      case 'search':
        // Track search queries as potential interests
        if (action.query) {
          const query = action.query.toLowerCase().trim();
          
          await observePreference(
            userId,
            `content:searched:${query}`,
            true,
            PREFERENCE_CATEGORIES.CONTENT,
            'user_action',
            0.6, // Moderate strength for searches
            DECAY_RATES.FAST // Search interests can change quickly
          );
        }
        break;
        
      case 'share':
        // Track shared content as strong preference
        await observePreference(
          userId,
          `content:shared:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action',
          0.9, // Very high strength for sharing
          DECAY_RATES.STANDARD
        );
        
        // Also infer strong content preference from sharing
        await observePreference(
          userId,
          `content:liked:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action_inference',
          0.85, // High strength for shared content
          DECAY_RATES.STANDARD
        );
        break;
        
      case 'save':
        // Track saved content as strong preference
        await observePreference(
          userId,
          `content:saved:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action',
          0.8, // High strength for saving
          DECAY_RATES.SLOW // Saved preferences decay slowly
        );
        break;
        
      case 'rate':
        // Track explicit ratings
        if (typeof action.rating === 'number') {
          // Normalize rating to 0-1 scale if needed
          let normalizedRating = action.rating;
          if (action.ratingScale) {
            normalizedRating = action.rating / action.ratingScale;
          }
          
          // Determine preference strength from rating
          const ratingStrength = Math.min(1.0, Math.max(0.3, normalizedRating));
          
          await observePreference(
            userId,
            `content:rating:${action.category}:${action.item}`,
            normalizedRating,
            PREFERENCE_CATEGORIES.CONTENT,
            'user_action',
            ratingStrength,
            DECAY_RATES.STANDARD
          );
          
          // For high ratings, also record as liked content
          if (normalizedRating > 0.7) {
            await observePreference(
              userId,
              `content:liked:${action.category}:${action.item}`,
              true,
              PREFERENCE_CATEGORIES.CONTENT,
              'user_action_inference',
              ratingStrength * 0.9,
              DECAY_RATES.STANDARD
            );
          }
          // For low ratings, also record as disliked content
          else if (normalizedRating < 0.3) {
            await observePreference(
              userId,
              `content:disliked:${action.category}:${action.item}`,
              true,
              PREFERENCE_CATEGORIES.CONTENT,
              'user_action_inference',
              (1 - ratingStrength) * 0.9,
              DECAY_RATES.STANDARD
            );
          }
        }
        break;
    }
    
    return true;
  } catch (error) {
    console.error('Error detecting preferences from action:', error);
    return false;
  }
}

/**
 * Process user feedback for preference detection.
 * @param {string} userId - User identifier
 * @param {Object} feedback - User feedback
 * @param {Object} context - Feedback context
 * @returns {Promise<boolean>} Success status
 */
async function processUserFeedback(userId, feedback, context) {
  try {
    // Handle explicit preference feedback
    if (feedback.preferences) {
      for (const [key, value] of Object.entries(feedback.preferences)) {
        await setPreference(
          userId,
          key,
          value,
          key.split(':')[0] || PREFERENCE_CATEGORIES.CONTENT
        );
      }
    }
    
    // Handle content feedback
    if (feedback.content && feedback.contentId) {
      const sentiment = feedback.sentiment || 0;
      
      if (sentiment > 0.5) {
        // User liked the content
        await observePreference(
          userId,
          `content:liked:${feedback.contentType}:${feedback.contentId}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'feedback'
        );
      } else if (sentiment < -0.5) {
        // User disliked the content
        await observePreference(
          userId,
          `content:disliked:${feedback.contentType}:${feedback.contentId}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'feedback'
        );
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing user feedback for preferences:', error);
    return false;
  }
}

/**
 * Consolidate preferences by analyzing patterns and removing conflicts.
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
async function consolidatePreferences(userId) {
  try {
    const model = await getPreferenceModel(userId);
    let updated = false;
    
    // Group preferences by category
    const preferencesByCategory = {};
    Object.entries(model.preferences).forEach(([key, pref]) => {
      if (!preferencesByCategory[pref.category]) {
        preferencesByCategory[pref.category] = [];
      }
      
      preferencesByCategory[pref.category].push({ key, ...pref });
    });
    
    // Process each category
    for (const [category, prefs] of Object.entries(preferencesByCategory)) {
      // Find conflicting preferences
      const contentPrefs = prefs.filter(p => p.key.startsWith('content:'));
      
      // Find liked and disliked items
      const liked = contentPrefs.filter(p => p.key.includes(':liked:') && p.value === true);
      const disliked = contentPrefs.filter(p => p.key.includes(':disliked:') && p.value === true);
      
      // Check for direct conflicts (same item both liked and disliked)
      for (const likedItem of liked) {
        const topic = likedItem.key.split(':liked:')[1];
        const conflictKey = `content:disliked:${topic}`;
        
        if (model.preferences[conflictKey] && model.preferences[conflictKey].value === true) {
          // Resolve conflict based on recency and confidence
          if (likedItem.lastUpdated > model.preferences[conflictKey].lastUpdated &&
              likedItem.confidence >= model.preferences[conflictKey].confidence) {
            // Remove the disliked preference
            delete model.preferences[conflictKey];
            updated = true;
          } else if (model.preferences[conflictKey].lastUpdated > likedItem.lastUpdated &&
                    model.preferences[conflictKey].confidence >= likedItem.confidence) {
            // Remove the liked preference
            delete model.preferences[likedItem.key];
            updated = true;
          }
        }
      }
    }
    
    // Save if updated
    if (updated) {
      model.lastUpdated = Date.now();
      model.version += 1;
      
      userPreferences.set(userId, model);
      await savePreferenceModel(userId, model);
      
      auditTrail.log('preferences:consolidated', { userId });
    }
    
    return true;
  } catch (error) {
    console.error('Error consolidating preferences:', error);
    auditTrail.log('preferences:consolidate:error', { userId, error: error.message });
    return false;
  }
}
