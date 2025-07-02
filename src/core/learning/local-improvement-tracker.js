/**
 * ALEJO Local Improvement Tracker
 * 
 * Tracks, stores, and applies user-specific improvements and customizations.
 * This module ensures that each user's instance of ALEJO can adapt to their
 * specific needs and preferences without affecting the global codebase.
 */

import { getImprovementConfig } from './improvement-config.js';

// In-memory cache of local improvements
const improvementCache = {
  userPreferences: new Map(),
  performanceProfiles: new Map(),
  modelCustomization: new Map(),
  codeCustomization: new Map(),
  usagePatterns: new Map()
};

// Storage keys
const STORAGE_KEYS = {
  USER_PREFERENCES: 'alejo_user_preferences',
  PERFORMANCE_PROFILES: 'alejo_performance_profiles',
  MODEL_CUSTOMIZATION: 'alejo_model_customization',
  CODE_CUSTOMIZATION: 'alejo_code_customization',
  USAGE_PATTERNS: 'alejo_usage_patterns',
  METADATA: 'alejo_improvement_metadata'
};

/**
 * Initialize the local improvement tracker
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    console.log('Initializing ALEJO Local Improvement Tracker');
    
    // Load existing improvements from storage
    await loadFromStorage();
    
    // Set up event listeners for tracking improvements
    setupEventListeners();
    
    // Schedule periodic processing
    scheduleProcessing();
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Local Improvement Tracker:', error);
    return false;
  }
}

/**
 * Load existing improvements from storage
 * @private
 */
async function loadFromStorage() {
  try {
    // Check if local storage is available
    if (!window.localStorage) {
      console.warn('LocalStorage not available for improvement tracking');
      return;
    }
    
    // Load each improvement type
    for (const [type, map] of Object.entries(improvementCache)) {
      const storageKey = STORAGE_KEYS[type.toUpperCase()];
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        // Populate the cache
        Object.entries(parsedData).forEach(([key, value]) => {
          map.set(key, value);
        });
        
        console.log(`Loaded ${map.size} ${type} improvements from storage`);
      }
    }
    
    // Load metadata
    const metadata = localStorage.getItem(STORAGE_KEYS.METADATA);
    if (metadata) {
      // Process metadata (e.g., last sync time, version info)
      console.log('Loaded improvement metadata:', JSON.parse(metadata));
    }
  } catch (error) {
    console.error('Error loading improvements from storage:', error);
  }
}

/**
 * Set up event listeners to track improvements
 * @private
 */
function setupEventListeners() {
  // Listen for user preference changes
  window.addEventListener('alejo:preference:changed', (event) => {
    trackImprovement('userPreferences', event.detail.key, event.detail.value);
  });
  
  // Listen for performance profile updates
  window.addEventListener('alejo:performance:profile', (event) => {
    trackImprovement('performanceProfiles', event.detail.context, event.detail.profile);
  });
  
  // Listen for model customization events
  window.addEventListener('alejo:model:customized', (event) => {
    trackImprovement('modelCustomization', event.detail.modelId, event.detail.parameters);
  });
  
  // Listen for code customization events
  window.addEventListener('alejo:code:customized', (event) => {
    trackImprovement('codeCustomization', event.detail.path, {
      original: event.detail.original,
      modified: event.detail.modified,
      reason: event.detail.reason,
      timestamp: Date.now()
    });
  });
  
  // Listen for usage pattern events
  window.addEventListener('alejo:usage:pattern', (event) => {
    trackImprovement('usagePatterns', event.detail.patternType, {
      data: event.detail.data,
      frequency: (improvementCache.usagePatterns.get(event.detail.patternType)?.frequency || 0) + 1,
      lastSeen: Date.now()
    });
  });
}

/**
 * Schedule periodic processing of improvements
 * @private
 */
function scheduleProcessing() {
  const config = getImprovementConfig();
  const processingInterval = config.local.applyFrequency * 60 * 60 * 1000; // Convert hours to ms
  
  // Schedule periodic processing
  setInterval(() => {
    processImprovements();
  }, processingInterval);
  
  // Also process improvements on page unload to avoid losing data
  window.addEventListener('beforeunload', () => {
    saveToStorage();
  });
}

/**
 * Track a new improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @param {any} value - Improvement data
 * @returns {boolean} Success status
 */
export function trackImprovement(type, key, value) {
  try {
    // Check if this improvement type is enabled
    const config = getImprovementConfig();
    if (!config.local.enabled || !config.local.trackTypes.includes(type)) {
      return false;
    }
    
    // Get the appropriate cache map
    const cacheMap = improvementCache[type];
    if (!cacheMap) {
      console.error(`Unknown improvement type: ${type}`);
      return false;
    }
    
    // Add metadata
    const improvementData = {
      value,
      metadata: {
        timestamp: Date.now(),
        version: '1.0'
      }
    };
    
    // Store in cache
    cacheMap.set(key, improvementData);
    
    // Periodically save to storage
    if (cacheMap.size % 10 === 0) { // Save every 10 improvements
      saveToStorage(type);
    }
    
    return true;
  } catch (error) {
    console.error(`Error tracking improvement (${type}/${key}):`, error);
    return false;
  }
}

/**
 * Get a specific improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @returns {any} Improvement value or null if not found
 */
export function getImprovement(type, key) {
  try {
    const cacheMap = improvementCache[type];
    if (!cacheMap) return null;
    
    const improvement = cacheMap.get(key);
    return improvement ? improvement.value : null;
  } catch (error) {
    console.error(`Error getting improvement (${type}/${key}):`, error);
    return null;
  }
}

/**
 * Get all improvements of a specific type
 * @param {string} type - Improvement type
 * @returns {Map} Map of improvements
 */
export function getAllImprovements(type) {
  try {
    const cacheMap = improvementCache[type];
    if (!cacheMap) return new Map();
    
    // Convert to a map of just the values (not the metadata wrapper)
    const resultMap = new Map();
    for (const [key, improvement] of cacheMap.entries()) {
      resultMap.set(key, improvement.value);
    }
    
    return resultMap;
  } catch (error) {
    console.error(`Error getting all improvements for type ${type}:`, error);
    return new Map();
  }
}

/**
 * Save improvements to storage
 * @param {string} [specificType] - Optional specific type to save
 * @private
 */
function saveToStorage(specificType = null) {
  try {
    // Check if local storage is available
    if (!window.localStorage) {
      console.warn('LocalStorage not available for saving improvements');
      return;
    }
    
    // Determine which types to save
    const typesToSave = specificType ? 
      [specificType] : 
      Object.keys(improvementCache);
    
    // Save each type
    for (const type of typesToSave) {
      const cacheMap = improvementCache[type];
      if (!cacheMap) continue;
      
      // Convert Map to object for storage
      const storageObject = {};
      for (const [key, value] of cacheMap.entries()) {
        storageObject[key] = value;
      }
      
      // Save to localStorage
      const storageKey = STORAGE_KEYS[type.toUpperCase()];
      localStorage.setItem(storageKey, JSON.stringify(storageObject));
    }
    
    // Save metadata
    const metadata = {
      lastSaved: Date.now(),
      version: '1.0',
      counts: {}
    };
    
    // Add counts for each type
    for (const [type, map] of Object.entries(improvementCache)) {
      metadata.counts[type] = map.size;
    }
    
    localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error saving improvements to storage:', error);
  }
}

/**
 * Process and apply local improvements
 * @returns {Promise<Object>} Processing results
 */
export async function processImprovements() {
  try {
    console.log('Processing local improvements...');
    
    const results = {
      processed: 0,
      applied: 0,
      skipped: 0,
      errors: 0
    };
    
    // Process each improvement type
    for (const [type, cacheMap] of Object.entries(improvementCache)) {
      for (const [key, improvement] of cacheMap.entries()) {
        results.processed++;
        
        try {
          // Apply the improvement based on its type
          const applied = await applyImprovement(type, key, improvement.value);
          
          if (applied) {
            results.applied++;
            
            // Mark as applied in metadata
            improvement.metadata.lastApplied = Date.now();
            improvement.metadata.timesApplied = (improvement.metadata.timesApplied || 0) + 1;
          } else {
            results.skipped++;
          }
        } catch (error) {
          console.error(`Error applying improvement (${type}/${key}):`, error);
          results.errors++;
        }
      }
    }
    
    // Save updated metadata
    saveToStorage();
    
    console.log('Improvement processing complete:', results);
    return results;
  } catch (error) {
    console.error('Error processing improvements:', error);
    return {
      processed: 0,
      applied: 0,
      skipped: 0,
      errors: 1
    };
  }
}

/**
 * Apply a specific improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @param {any} value - Improvement value
 * @returns {Promise<boolean>} Whether the improvement was applied
 * @private
 */
async function applyImprovement(type, key, value) {
  // This function would contain the logic to actually apply different types
  // of improvements to the system. For now, we'll just log what would happen.
  
  switch (type) {
    case 'userPreferences':
      console.log(`Would apply user preference: ${key} = ${JSON.stringify(value)}`);
      // In a real implementation:
      // await applyUserPreference(key, value);
      return true;
      
    case 'performanceProfiles':
      console.log(`Would apply performance profile for ${key}`);
      // In a real implementation:
      // await applyPerformanceProfile(key, value);
      return true;
      
    case 'modelCustomization':
      console.log(`Would apply model customization for ${key}`);
      // In a real implementation:
      // await customizeModel(key, value);
      return true;
      
    case 'codeCustomization':
      console.log(`Would apply code customization for ${key}`);
      // In a real implementation:
      // await applyCodeCustomization(key, value);
      return true;
      
    case 'usagePatterns':
      console.log(`Would adapt to usage pattern: ${key}`);
      // In a real implementation:
      // await adaptToUsagePattern(key, value);
      return true;
      
    default:
      console.warn(`Unknown improvement type: ${type}`);
      return false;
  }
}

/**
 * Clear all tracked improvements
 * @param {string} [specificType] - Optional specific type to clear
 * @returns {Promise<boolean>} Success status
 */
export async function clearImprovements(specificType = null) {
  try {
    // Determine which types to clear
    const typesToClear = specificType ? 
      [specificType] : 
      Object.keys(improvementCache);
    
    // Clear each type
    for (const type of typesToClear) {
      const cacheMap = improvementCache[type];
      if (cacheMap) {
        cacheMap.clear();
      }
      
      // Also clear from storage
      if (window.localStorage) {
        const storageKey = STORAGE_KEYS[type.toUpperCase()];
        localStorage.removeItem(storageKey);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing improvements:', error);
    return false;
  }
}
