/**
 * ALEJO Preference Normalization Module
 * 
 * This module provides utilities to normalize preference strengths over time
 * to prevent preference drift and maintain consistent personalization.
 * 
 * @module preference-normalization
 */

import { auditTrail } from '../../utils/audit-trail.js';
import { getPreferenceModel, savePreferenceModel } from './preference-model.js';
import { preferenceCache } from '../../utils/cache-manager.js';

/**
 * Default normalization configuration
 */
const DEFAULT_CONFIG = {
  // Maximum number of preferences to consider in a category
  maxPreferencesPerCategory: 100,
  
  // Minimum strength value (floor)
  minStrength: 0.1,
  
  // Maximum strength value (ceiling)
  maxStrength: 1.0,
  
  // Target mean strength value
  targetMean: 0.5,
  
  // Target standard deviation
  targetStd: 0.2,
  
  // Decay factor for old preferences (per day)
  dailyDecayFactor: 0.995,
  
  // Maximum age in days before aggressive normalization
  maxAgeInDays: 90
};

/**
 * Normalize a collection of preferences to prevent drift and maintain consistency
 * @param {Array<Object>} preferences - Array of preference objects
 * @param {string} category - Preference category
 * @param {Object} config - Normalization configuration
 * @returns {Array<Object>} Normalized preferences
 */
export function normalizePreferences(preferences, category, config = {}) {
  const startTime = performance.now();
  const normalizeConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return preferences;
    }
    
    // Apply time-based decay
    const decayedPreferences = applyTimeDecay(preferences, normalizeConfig);
    
    // Apply statistical normalization
    const normalizedPreferences = applyStatisticalNormalization(
      decayedPreferences, 
      normalizeConfig
    );
    
    // Log performance metrics
    const duration = performance.now() - startTime;
    if (duration > 50) { // Only log slow operations
      auditTrail.log('preference:normalization:performance', {
        category,
        count: preferences.length,
        duration,
        config: normalizeConfig
      });
    }
    
    return normalizedPreferences;
  } catch (error) {
    console.error('Error normalizing preferences:', error);
    auditTrail.log('preference:normalization:error', {
      category,
      error: error.message,
      stack: error.stack
    });
    
    // Return original preferences on error
    return preferences;
  }
}

/**
 * Apply time-based decay to preference strengths
 * @param {Array<Object>} preferences - Array of preference objects
 * @param {Object} config - Normalization configuration
 * @returns {Array<Object>} Preferences with decay applied
 */
function applyTimeDecay(preferences, config) {
  const now = new Date();
  
  return preferences.map(pref => {
    const lastUpdated = pref.lastUpdated ? new Date(pref.lastUpdated) : now;
    const ageInDays = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    
    // Skip recent preferences
    if (ageInDays < 1) {
      return pref;
    }
    
    // Apply exponential decay based on age
    const decayFactor = Math.pow(config.dailyDecayFactor, ageInDays);
    let newStrength = pref.strength * decayFactor;
    
    // Apply more aggressive decay for very old preferences
    if (ageInDays > config.maxAgeInDays) {
      const extraDecay = (ageInDays - config.maxAgeInDays) / 100;
      newStrength = Math.max(newStrength - extraDecay, config.minStrength);
    }
    
    // Ensure we stay within bounds
    newStrength = Math.max(config.minStrength, Math.min(config.maxStrength, newStrength));
    
    return {
      ...pref,
      strength: newStrength,
      originalStrength: pref.strength, // Keep original for reference
      decayApplied: true
    };
  });
}

/**
 * Apply statistical normalization to preference strengths
 * @param {Array<Object>} preferences - Array of preference objects
 * @param {Object} config - Normalization configuration
 * @returns {Array<Object>} Statistically normalized preferences
 */
function applyStatisticalNormalization(preferences, config) {
  // Skip normalization if too few preferences
  if (preferences.length < 3) {
    return preferences;
  }
  
  // Calculate current statistics
  const strengths = preferences.map(p => p.strength);
  const currentMean = strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
  
  const squaredDiffs = strengths.map(s => Math.pow(s - currentMean, 2));
  const currentVariance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / strengths.length;
  const currentStd = Math.sqrt(currentVariance);
  
  // Skip if already close to target
  const meanDiff = Math.abs(currentMean - config.targetMean);
  const stdDiff = Math.abs(currentStd - config.targetStd);
  
  if (meanDiff < 0.05 && stdDiff < 0.05) {
    return preferences;
  }
  
  // Apply z-score normalization
  return preferences.map(pref => {
    // Skip if marked as important
    if (pref.preserveStrength) {
      return pref;
    }
    
    // Calculate z-score
    const zScore = currentStd > 0 ? (pref.strength - currentMean) / currentStd : 0;
    
    // Apply normalization
    let normalizedStrength = config.targetMean + (zScore * config.targetStd);
    
    // Ensure we stay within bounds
    normalizedStrength = Math.max(
      config.minStrength, 
      Math.min(config.maxStrength, normalizedStrength)
    );
    
    return {
      ...pref,
      strength: normalizedStrength,
      originalStrength: pref.originalStrength || pref.strength,
      normalized: true
    };
  });
}

/**
 * Normalize a single preference value within the context of a category
 * @param {number} strength - Preference strength to normalize
 * @param {string} category - Preference category
 * @param {Array<Object>} existingPreferences - Existing preferences in the category
 * @param {Object} config - Normalization configuration
 * @returns {number} Normalized strength value
 */
export function normalizePreferenceStrength(strength, category, existingPreferences = [], config = {}) {
  try {
    const normalizeConfig = { ...DEFAULT_CONFIG, ...config };
    
    // If no existing preferences or very few, just apply bounds
    if (!existingPreferences || existingPreferences.length < 3) {
      return Math.max(
        normalizeConfig.minStrength, 
        Math.min(normalizeConfig.maxStrength, strength)
      );
    }
    
    // Calculate current statistics
    const strengths = existingPreferences.map(p => p.strength);
    const currentMean = strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
    
    const squaredDiffs = strengths.map(s => Math.pow(s - currentMean, 2));
    const currentVariance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / strengths.length;
    const currentStd = Math.sqrt(currentVariance);
    
    // If the new strength is an outlier (> 2 std devs from mean), pull it closer
    const zScore = currentStd > 0 ? (strength - currentMean) / currentStd : 0;
    
    if (Math.abs(zScore) > 2) {
      // Pull extreme values toward the mean, but preserve direction
      const direction = Math.sign(zScore);
      const adjustedZScore = direction * Math.min(Math.abs(zScore), 2);
      strength = currentMean + (adjustedZScore * currentStd);
    }
    
    // Ensure we stay within bounds
    return Math.max(
      normalizeConfig.minStrength, 
      Math.min(normalizeConfig.maxStrength, strength)
    );
  } catch (error) {
    console.error('Error normalizing preference strength:', error);
    // Return original strength on error, but ensure it's within bounds
    return Math.max(DEFAULT_CONFIG.minStrength, Math.min(DEFAULT_CONFIG.maxStrength, strength));
  }
}

/**
 * Schedule periodic normalization of all preferences
 * @param {Function} getAllPreferences - Function to retrieve all preferences
 * @param {Function} updatePreferences - Function to update preferences
 * @param {Object} config - Normalization configuration
 * @returns {Object} Scheduler control object
 */
/**
 * Normalize all preferences for a specific user in a category
 * @param {string} userId - User identifier
 * @param {string} category - Preference category to normalize
 * @param {Object} config - Normalization configuration
 * @returns {Promise<number>} Number of preferences normalized
 */
export async function normalizeAllPreferences(userId, category, config = {}) {
  const startTime = performance.now();
  let normalizedCount = 0;
  
  try {
    // Get the user's preference model
    const model = await getPreferenceModel(userId, { bypassCache: true });
    
    // Skip if category doesn't exist or has no preferences
    if (!model.preferences[category] || Object.keys(model.preferences[category]).length === 0) {
      return 0;
    }
    
    // Convert preferences object to array for normalization
    const preferencesArray = Object.entries(model.preferences[category]).map(([key, pref]) => ({
      key,
      ...pref
    }));
    
    // Apply normalization
    const normalizedPreferences = normalizePreferences(preferencesArray, category, config);
    
    // Update the model with normalized preferences
    normalizedCount = normalizedPreferences.length;
    
    // Convert back to object format
    const updatedPreferences = {};
    normalizedPreferences.forEach(pref => {
      const { key, ...prefData } = pref;
      updatedPreferences[key] = prefData;
    });
    
    // Update the model
    model.preferences[category] = updatedPreferences;
    model.lastUpdated = Date.now();
    model.version = (model.version || 0) + 1;
    
    // Save the updated model
    await savePreferenceModel(userId, model);
    
    // Update cache
    const cacheKey = `preference_model:${userId}`;
    preferenceCache.set(cacheKey, model);
    
    // Clear individual preference caches in this category
    Object.keys(updatedPreferences).forEach(key => {
      preferenceCache.delete(`preference:${userId}:${key}`);
    });
    
    // Log success
    const duration = performance.now() - startTime;
    auditTrail.log('preference:normalization:category:success', {
      userId,
      category,
      count: normalizedCount,
      duration
    });
    
    return normalizedCount;
  } catch (error) {
    console.error(`Error normalizing preferences for user ${userId} in category ${category}:`, error);
    auditTrail.log('preference:normalization:category:error', {
      userId,
      category,
      error: error.message,
      stack: error.stack
    });
    return 0;
  }
}

export function scheduleNormalization(getAllPreferences, updatePreferences, config = {}) {
  const normalizeConfig = { ...DEFAULT_CONFIG, ...config };
  let intervalId = null;
  
  // Default to running once per day
  const intervalMs = config.intervalMs || 24 * 60 * 60 * 1000;
  
  const runNormalization = async () => {
    try {
      console.info('Running scheduled preference normalization');
      const startTime = performance.now();
      
      // Get all preferences by category
      const allPreferences = await getAllPreferences();
      let totalNormalized = 0;
      
      // Process each category
      for (const [category, preferences] of Object.entries(allPreferences)) {
        if (Array.isArray(preferences) && preferences.length > 0) {
          const normalized = normalizePreferences(preferences, category, normalizeConfig);
          await updatePreferences(category, normalized);
          totalNormalized += normalized.length;
        }
      }
      
      const duration = performance.now() - startTime;
      console.info(`Normalized ${totalNormalized} preferences in ${duration.toFixed(2)}ms`);
      
      auditTrail.log('preference:normalization:scheduled', {
        totalNormalized,
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in scheduled preference normalization:', error);
      auditTrail.log('preference:normalization:scheduled:error', {
        error: error.message,
        stack: error.stack
      });
    }
  };
  
  // Start the scheduler
  const start = () => {
    if (intervalId) {
      return false; // Already running
    }
    
    // Run immediately once
    runNormalization();
    
    // Then schedule regular runs
    intervalId = setInterval(runNormalization, intervalMs);
    return true;
  };
  
  // Stop the scheduler
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      return true;
    }
    return false;
  };
  
  // Run normalization once without scheduling
  const runOnce = () => {
    return runNormalization();
  };
  
  return {
    start,
    stop,
    runOnce,
    isRunning: () => intervalId !== null
  };
}
