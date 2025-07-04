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
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';
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
  ACCESSIBILITY: 'accessibility' // Accessibility needs
};

// Preference confidence levels
const CONFIDENCE_LEVELS = {
  INFERRED: 0.3,    // Inferred from limited data
  OBSERVED: 0.6,    // Observed multiple times
  CONFIRMED: 0.9,   // Explicitly confirmed by user
  EXPLICIT: 1.0     // Explicitly set by user
};

// In-memory cache of user preferences
const userPreferences = new Map(); // userId -> preference model
const preferenceHistory = new Map(); // userId -> preference history

/**
 * Initialize or retrieve preference model for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's preference model
 */
async function getPreferenceModel(userId) {
  try {
    if (!userPreferences.has(userId)) {
      // Load from secure storage or initialize
      const storedModel = await loadPreferenceModel(userId);
      
      if (storedModel) {
        userPreferences.set(userId, storedModel);
      } else {
        // Initialize new preference model
        const initialModel = {
          preferences: {},
          lastUpdated: Date.now(),
          version: 1
        };
        
        userPreferences.set(userId, initialModel);
        await savePreferenceModel(userId, initialModel);
      }
      
      // Load preference history
      preferenceHistory.set(userId, await loadPreferenceHistory(userId) || []);
    }
    
    return { ...userPreferences.get(userId) };
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
 * @returns {Promise<*>} Preference value
 */
export async function getPreference(userId, key, defaultValue = null) {
  try {
    const model = await getPreferenceModel(userId);
    
    // Return preference if it exists and has sufficient confidence
    if (model.preferences[key] && model.preferences[key].confidence > 0.3) {
      return model.preferences[key].value;
    }
    
    return defaultValue;
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
 * Observe a potential user preference from interaction.
 * @param {string} userId - User identifier
 * @param {string} key - Preference key
 * @param {*} value - Observed preference value
 * @param {string} category - Preference category
 * @param {string} source - Source of observation
 * @returns {Promise<boolean>} Success status
 */
export async function observePreference(userId, key, value, category = PREFERENCE_CATEGORIES.CONTENT, source = 'interaction') {
  try {
    const model = await getPreferenceModel(userId);
    const timestamp = Date.now();
    const existingPref = model.preferences[key];
    
    // If preference doesn't exist, create it
    if (!existingPref) {
      model.preferences[key] = {
        value,
        confidence: CONFIDENCE_LEVELS.INFERRED,
        category,
        firstObserved: timestamp,
        lastUpdated: timestamp,
        source,
        occurrences: 1
      };
    } 
    // If preference exists but value is different, update based on confidence
    else if (JSON.stringify(existingPref.value) !== JSON.stringify(value)) {
      // Only update if existing preference isn't explicit or confirmed
      if (existingPref.confidence < CONFIDENCE_LEVELS.CONFIRMED) {
        // If observed multiple times, increase confidence
        const newConfidence = existingPref.occurrences >= 3 ? 
                             CONFIDENCE_LEVELS.OBSERVED : 
                             CONFIDENCE_LEVELS.INFERRED;
        
        model.preferences[key] = {
          value,
          confidence: newConfidence,
          category: existingPref.category,
          firstObserved: existingPref.firstObserved,
          lastUpdated: timestamp,
          source,
          occurrences: existingPref.occurrences + 1
        };
      }
    } 
    // If preference exists with same value, increase confidence
    else {
      const occurrences = existingPref.occurrences + 1;
      let newConfidence = existingPref.confidence;
      
      // Increase confidence with more observations
      if (occurrences >= 5 && newConfidence < CONFIDENCE_LEVELS.OBSERVED) {
        newConfidence = CONFIDENCE_LEVELS.OBSERVED;
      }
      
      model.preferences[key] = {
        ...existingPref,
        lastUpdated: timestamp,
        occurrences,
        confidence: newConfidence
      };
    }
    
    model.lastUpdated = timestamp;
    model.version += 1;
    
    // Save updated model
    userPreferences.set(userId, model);
    await savePreferenceModel(userId, model);
    
    // Record in history if confidence changed
    if (!existingPref || existingPref.confidence !== model.preferences[key].confidence) {
      await recordPreferenceChange(userId, key, value, source, category);
    }
    
    // Only publish event if confidence is sufficient
    if (model.preferences[key].confidence >= CONFIDENCE_LEVELS.OBSERVED) {
      publish('user:preference:observed', {
        userId,
        key,
        value,
        category,
        confidence: model.preferences[key].confidence,
        source
      });
    }
    
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
 * Detect preferences from user message content.
 * @param {string} userId - User identifier
 * @param {string} message - User message
 * @param {Object} context - Message context
 * @returns {Promise<boolean>} Success status
 */
async function detectPreferencesFromMessage(userId, message, context) {
  try {
    // Simple preference detection patterns
    const patterns = [
      // Content preferences
      {
        regex: /I (like|love|enjoy|prefer) ([\w\s]+)/i,
        handler: (match) => {
          const topic = match[2].trim().toLowerCase();
          return {
            key: `content:liked:${topic}`,
            value: true,
            category: PREFERENCE_CATEGORIES.CONTENT
          };
        }
      },
      {
        regex: /I (dislike|hate|don't like|do not like) ([\w\s]+)/i,
        handler: (match) => {
          const topic = match[2].trim().toLowerCase();
          return {
            key: `content:disliked:${topic}`,
            value: true,
            category: PREFERENCE_CATEGORIES.CONTENT
          };
        }
      },
      
      // Interface preferences
      {
        regex: /I (like|prefer) (dark|light) mode/i,
        handler: (match) => {
          const mode = match[2].toLowerCase();
          return {
            key: 'interface:theme',
            value: mode,
            category: PREFERENCE_CATEGORIES.INTERFACE
          };
        }
      },
      
      // Notification preferences
      {
        regex: /(don't|do not) (notify|alert|send) me/i,
        handler: () => {
          return {
            key: 'notification:enabled',
            value: false,
            category: PREFERENCE_CATEGORIES.NOTIFICATION
          };
        }
      },
      
      // Language preferences
      {
        regex: /I (prefer|like) to (speak|talk|communicate) in (\w+)/i,
        handler: (match) => {
          const language = match[3].toLowerCase();
          return {
            key: 'language:preferred',
            value: language,
            category: PREFERENCE_CATEGORIES.LANGUAGE
          };
        }
      }
    ];
    
    // Check message against patterns
    for (const pattern of patterns) {
      const match = message.match(pattern.regex);
      
      if (match) {
        const preference = pattern.handler(match);
        
        if (preference) {
          await observePreference(
            userId,
            preference.key,
            preference.value,
            preference.category,
            'message_analysis'
          );
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error detecting preferences from message:', error);
    return false;
  }
}

/**
 * Detect preferences from user actions.
 * @param {string} userId - User identifier
 * @param {Object} action - User action
 * @param {Object} context - Action context
 * @returns {Promise<boolean>} Success status
 */
async function detectPreferencesFromAction(userId, action, context) {
  try {
    // Handle different action types
    switch (action.type) {
      case 'select':
        // Track selection preferences
        await observePreference(
          userId,
          `interaction:selected:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.INTERACTION,
          'user_action'
        );
        break;
        
      case 'skip':
        // Track skipped content
        await observePreference(
          userId,
          `content:skipped:${action.category}:${action.item}`,
          true,
          PREFERENCE_CATEGORIES.CONTENT,
          'user_action'
        );
        break;
        
      case 'view':
        // Track viewed content duration
        if (action.duration > 30000) { // Only if viewed for more than 30 seconds
          await observePreference(
            userId,
            `content:viewed:${action.category}:${action.item}`,
            true,
            PREFERENCE_CATEGORIES.CONTENT,
            'user_action'
          );
        }
        break;
        
      case 'schedule':
        // Track scheduling preferences
        if (action.time) {
          const hour = new Date(action.time).getHours();
          const timeOfDay = hour < 12 ? 'morning' : 
                           (hour < 17 ? 'afternoon' : 'evening');
          
          await observePreference(
            userId,
            `scheduling:preferred_time`,
            timeOfDay,
            PREFERENCE_CATEGORIES.SCHEDULING,
            'user_action'
          );
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
