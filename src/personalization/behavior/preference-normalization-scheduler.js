/**
 * preference-normalization-scheduler.js
 * 
 * Schedules periodic normalization of user preferences to maintain
 * consistent distributions and prevent preference drift over time.
 */
import { auditTrail } from '../../utils/audit-trail.js';
import { normalizeAllPreferences } from './preference-normalization.js';
import { getPreferencesByCategory } from './preference-model.js';

// Default configuration
const DEFAULT_CONFIG = {
  // Run normalization every 24 hours by default
  intervalHours: 24,
  // Maximum number of users to process in one batch
  batchSize: 100,
  // Whether to run normalization on startup
  runOnStartup: false,
  // Categories to prioritize for normalization
  priorityCategories: ['CONTENT', 'UI', 'ACTIVITIES']
};

let normalizationTimer = null;
let isRunning = false;
let config = { ...DEFAULT_CONFIG };

/**
 * Start the preference normalization scheduler
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Success status
 */
export async function startScheduler(options = {}) {
  try {
    // Merge provided options with defaults
    config = { ...DEFAULT_CONFIG, ...options };
    
    // Clear any existing timer
    if (normalizationTimer) {
      clearInterval(normalizationTimer);
    }
    
    // Log scheduler start
    auditTrail.log('preference:normalization:scheduler:start', { 
      intervalHours: config.intervalHours,
      batchSize: config.batchSize
    });
    
    // Run immediately if configured
    if (config.runOnStartup) {
      runNormalization();
    }
    
    // Set up recurring schedule
    const intervalMs = config.intervalHours * 60 * 60 * 1000;
    normalizationTimer = setInterval(runNormalization, intervalMs);
    
    return true;
  } catch (error) {
    console.error('Failed to start preference normalization scheduler:', error);
    auditTrail.log('preference:normalization:scheduler:error', { 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Stop the preference normalization scheduler
 * @returns {boolean} Success status
 */
export function stopScheduler() {
  try {
    if (normalizationTimer) {
      clearInterval(normalizationTimer);
      normalizationTimer = null;
      
      auditTrail.log('preference:normalization:scheduler:stop', {});
    }
    return true;
  } catch (error) {
    console.error('Failed to stop preference normalization scheduler:', error);
    auditTrail.log('preference:normalization:scheduler:error', { 
      error: error.message,
      operation: 'stop'
    });
    return false;
  }
}

/**
 * Run the normalization process for all users
 * @returns {Promise<Object>} Results of the normalization run
 */
async function runNormalization() {
  // Prevent concurrent runs
  if (isRunning) {
    console.warn('Normalization already in progress, skipping this run');
    return { skipped: true };
  }
  
  isRunning = true;
  const startTime = performance.now();
  const results = {
    usersProcessed: 0,
    categoriesProcessed: 0,
    preferencesNormalized: 0,
    errors: 0,
    duration: 0
  };
  
  try {
    // Get active users (implementation depends on your user management system)
    const activeUsers = await getActiveUsers(config.batchSize);
    
    // Process each user
    for (const userId of activeUsers) {
      try {
        // Get preferences by category for this user
        const preferencesByCategory = await getPreferencesByCategory(userId);
        
        // Process each category, prioritizing important ones
        const categories = [
          ...config.priorityCategories,
          ...Object.keys(preferencesByCategory).filter(cat => !config.priorityCategories.includes(cat))
        ];
        
        for (const category of categories) {
          if (preferencesByCategory[category]) {
            const preferences = preferencesByCategory[category];
            
            // Skip categories with too few preferences to normalize
            if (Object.keys(preferences).length < 3) {
              continue;
            }
            
            // Normalize preferences in this category
            const normalizedCount = await normalizeAllPreferences(userId, category);
            
            results.preferencesNormalized += normalizedCount;
            results.categoriesProcessed++;
          }
        }
        
        results.usersProcessed++;
      } catch (error) {
        console.error(`Error normalizing preferences for user ${userId}:`, error);
        auditTrail.log('preference:normalization:user:error', {
          userId,
          error: error.message
        });
        results.errors++;
      }
    }
    
    // Calculate duration
    results.duration = performance.now() - startTime;
    
    // Log results
    auditTrail.log('preference:normalization:complete', {
      ...results,
      durationSeconds: results.duration / 1000
    });
    
    return results;
  } catch (error) {
    console.error('Error during preference normalization run:', error);
    auditTrail.log('preference:normalization:run:error', {
      error: error.message,
      stack: error.stack
    });
    
    results.errors++;
    results.duration = performance.now() - startTime;
    return results;
  } finally {
    isRunning = false;
  }
}

/**
 * Get a list of active users to process
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<string[]>} Array of user IDs
 */
async function getActiveUsers(limit) {
  try {
    // This implementation would connect to your user management system
    // For now, we'll use a placeholder that would be replaced with actual implementation
    
    // Example implementation using a database query
    // const db = await getDatabase();
    // return db.collection('users')
    //   .find({ lastActive: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    //   .sort({ lastActive: -1 })
    //   .limit(limit)
    //   .map(user => user.id)
    //   .toArray();
    
    // Placeholder implementation
    return ['user1', 'user2', 'user3'].slice(0, limit);
  } catch (error) {
    console.error('Error getting active users:', error);
    auditTrail.log('preference:normalization:users:error', {
      error: error.message
    });
    return [];
  }
}

/**
 * Get the current scheduler status
 * @returns {Object} Current status
 */
export function getSchedulerStatus() {
  return {
    isRunning,
    isScheduled: normalizationTimer !== null,
    config
  };
}
