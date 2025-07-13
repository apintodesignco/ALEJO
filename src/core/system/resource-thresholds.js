/**
 * @file resource-thresholds.js
 * @description User-configurable resource thresholds for system monitoring
 * @module core/system/resource-thresholds
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../events/event-bus.js';
import { ConfigManager } from '../config/config-manager.js';
import { Logger } from '../utils/logger.js';
import { AuditTrail } from '../utils/audit-trail.js';
import { LocalStorage } from '../storage/local-storage.js';

// Initialize logger
const logger = new Logger('ResourceThresholds');
const auditTrail = new AuditTrail('system');

// Constants for default thresholds
export const DEFAULT_THRESHOLDS = {
  cpu: {
    warning: 70,    // Percentage CPU usage to trigger warning
    critical: 90,   // Percentage CPU usage to trigger critical alert
    sustainedDuration: 30000, // Time in ms that high usage must be sustained to trigger alert
  },
  memory: {
    warning: 75,    // Percentage memory usage to trigger warning
    critical: 90,   // Percentage memory usage to trigger critical alert
    swapWarning: 50 // Percentage swap usage to trigger warning
  },
  storage: {
    warning: 85,    // Percentage storage usage to trigger warning
    critical: 95    // Percentage storage usage to trigger critical alert
  },
  battery: {
    warning: 25,    // Percentage battery remaining to trigger warning
    critical: 10    // Percentage battery remaining to trigger critical alert
  },
  network: {
    latencyWarning: 500,  // Network latency in ms to trigger warning
    timeoutThreshold: 5000 // Timeout threshold for network operations
  },
  temperature: {
    warning: 75,    // Temperature percentage to trigger warning
    critical: 90    // Temperature percentage to trigger critical alert
  },
  resourceModes: {
    minimal: {
      // CPU percentage to trigger automatic switch to minimal mode
      cpuThreshold: 85,
      // Memory percentage to trigger automatic switch to minimal mode
      memoryThreshold: 80,
      // Duration in ms that thresholds must be exceeded
      sustainedDuration: 60000 // 1 minute
    },
    conservative: {
      // CPU percentage to trigger automatic switch to conservative mode
      cpuThreshold: 70,
      // Memory percentage to trigger automatic switch to conservative mode
      memoryThreshold: 65,
      // Duration in ms that thresholds must be exceeded
      sustainedDuration: 45000 // 45 seconds
    }
  },
  healthMonitor: {
    autoCheckInterval: 300000,     // 5 minutes in milliseconds
    checkTimeout: 10000,           // 10 seconds in milliseconds
    persistentWarningThreshold: 30 // Minutes before persistent warning
  }
};

// Storage key for user thresholds
const STORAGE_KEY = 'alejo-resource-thresholds';

// Current thresholds
let currentThresholds = {};

// Module state
let _initialized = false;

/**
 * Initialize the resource thresholds module
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(options = {}) {
  if (_initialized) {
    return true;
  }
  
  try {
    logger.info('Initializing resource thresholds module');
    
    // Load configuration from config manager if available
    let configThresholds = {};
    try {
      configThresholds = await ConfigManager.get('system.resourceThresholds') || {};
      logger.debug('Loaded thresholds from config', configThresholds);
    } catch (error) {
      logger.warn('Could not load thresholds from config, using defaults', error);
    }
    
    // Load user customized thresholds from local storage
    let userThresholds = {};
    try {
      const savedThresholds = await LocalStorage.getItem(STORAGE_KEY);
      if (savedThresholds) {
        userThresholds = JSON.parse(savedThresholds);
        logger.debug('Loaded user thresholds from storage', userThresholds);
        auditTrail.log('info', 'Loaded user-configured resource thresholds');
      }
    } catch (error) {
      logger.warn('Could not load user thresholds from storage, using defaults', error);
    }
    
    // Merge thresholds with defaults taking precedence
    // DEFAULT_THRESHOLDS < configThresholds < userThresholds
    currentThresholds = mergeDeep({}, DEFAULT_THRESHOLDS, configThresholds, userThresholds);
    
    // If there are passed options, apply them as well
    if (options.thresholds) {
      currentThresholds = mergeDeep(currentThresholds, options.thresholds);
    }
    
    // Validate thresholds
    validateThresholds(currentThresholds);
    
    // Set up event listeners
    EventBus.subscribe('system:configChanged', handleConfigChanged);
    
    _initialized = true;
    logger.info('Resource thresholds module initialized successfully');
    
    // Publish initial thresholds
    EventBus.publish('resources:thresholdsUpdated', { thresholds: currentThresholds });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize resource thresholds module', error);
    return false;
  }
}

/**
 * Get current resource thresholds
 * @param {string} [category] - Optional specific category to retrieve
 * @returns {Object} - Current threshold values
 */
export function getThresholds(category = null) {
  if (!_initialized) {
    logger.warn('Attempting to get thresholds before initialization');
    return category ? { ...DEFAULT_THRESHOLDS[category] } : { ...DEFAULT_THRESHOLDS };
  }
  
  if (category) {
    return { ...(currentThresholds[category] || DEFAULT_THRESHOLDS[category] || {}) };
  }
  
  return { ...currentThresholds };
}

/**
 * Update resource thresholds with user preferences
 * @param {Object} newThresholds - New threshold values to apply
 * @returns {Promise<boolean>} - True if update successful
 */
export async function updateThresholds(newThresholds) {
  if (!_initialized) {
    logger.error('Cannot update thresholds before initialization');
    return false;
  }
  
  try {
    // Validate new thresholds before applying
    const validatedThresholds = validateThresholds(newThresholds);
    
    // Merge with current thresholds
    currentThresholds = mergeDeep({}, currentThresholds, validatedThresholds);
    
    // Save to local storage
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(currentThresholds));
    
    // Log the update
    logger.info('Resource thresholds updated successfully');
    auditTrail.log('info', 'Resource thresholds updated by user', { 
      thresholdsUpdated: Object.keys(newThresholds)
    });
    
    // Publish event
    EventBus.publish('resources:thresholdsUpdated', { thresholds: currentThresholds });
    
    return true;
  } catch (error) {
    logger.error('Failed to update resource thresholds', error);
    return false;
  }
}

/**
 * Reset thresholds to default values
 * @param {string} [category] - Optional specific category to reset
 * @returns {Promise<boolean>} - True if reset successful
 */
export async function resetToDefaults(category = null) {
  if (!_initialized) {
    logger.error('Cannot reset thresholds before initialization');
    return false;
  }
  
  try {
    if (category && DEFAULT_THRESHOLDS[category]) {
      // Reset specific category
      currentThresholds[category] = { ...DEFAULT_THRESHOLDS[category] };
      logger.info(`Reset ${category} thresholds to defaults`);
    } else if (!category) {
      // Reset all thresholds
      currentThresholds = { ...DEFAULT_THRESHOLDS };
      logger.info('Reset all resource thresholds to defaults');
    } else {
      logger.warn(`Invalid category ${category}, no thresholds reset`);
      return false;
    }
    
    // Save to local storage
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(currentThresholds));
    
    // Log the reset
    auditTrail.log('info', 'Resource thresholds reset to defaults', { 
      category: category || 'all'
    });
    
    // Publish event
    EventBus.publish('resources:thresholdsUpdated', { thresholds: currentThresholds });
    
    return true;
  } catch (error) {
    logger.error('Failed to reset resource thresholds', error);
    return false;
  }
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  try {
    // Remove event listeners
    EventBus.unsubscribe('system:configChanged', handleConfigChanged);
    
    _initialized = false;
    logger.info('Resource thresholds module cleaned up');
  } catch (error) {
    logger.error('Error during resource thresholds module cleanup', error);
  }
}

/**
 * Handle changes to system configuration
 * @private
 * @param {Object} data - Config change data
 */
function handleConfigChanged(data) {
  if (data?.path?.startsWith('system.resourceThresholds')) {
    logger.debug('Resource thresholds config changed, updating');
    
    try {
      const configThresholds = ConfigManager.get('system.resourceThresholds') || {};
      
      // Only update from config if there are no user customizations
      // for the specific categories that were updated
      const updatedCategories = Object.keys(configThresholds);
      const userCustomizedCategories = [];
      
      try {
        const savedThresholds = LocalStorage.getItem(STORAGE_KEY);
        if (savedThresholds) {
          const parsedThresholds = JSON.parse(savedThresholds);
          userCustomizedCategories.push(...Object.keys(parsedThresholds));
        }
      } catch (error) {
        // Ignore errors here
      }
      
      // Only apply config changes for categories not customized by the user
      const categoriesToUpdate = updatedCategories.filter(
        cat => !userCustomizedCategories.includes(cat)
      );
      
      if (categoriesToUpdate.length > 0) {
        const updateData = {};
        categoriesToUpdate.forEach(cat => {
          updateData[cat] = configThresholds[cat];
        });
        
        updateThresholds(updateData);
      }
    } catch (error) {
      logger.error('Error processing config changes', error);
    }
  }
}

/**
 * Validate threshold values to ensure they are within acceptable ranges
 * @private
 * @param {Object} thresholds - Thresholds to validate
 * @returns {Object} - Validated thresholds
 * @throws {Error} - If thresholds are invalid
 */
function validateThresholds(thresholds) {
  const validated = {};
  
  // For each category in the provided thresholds
  Object.entries(thresholds).forEach(([category, values]) => {
    if (!DEFAULT_THRESHOLDS[category]) {
      logger.warn(`Unknown threshold category: ${category}, ignoring`);
      return;
    }
    
    validated[category] = {};
    
    // For each value in this category
    Object.entries(values).forEach(([key, value]) => {
      // Check if this is a valid property for this category
      if (DEFAULT_THRESHOLDS[category][key] === undefined) {
        logger.warn(`Unknown threshold property ${key} in category ${category}, ignoring`);
        return;
      }
      
      // Validate based on property type
      const defaultValue = DEFAULT_THRESHOLDS[category][key];
      
      if (typeof defaultValue === 'number') {
        // For numeric values, ensure they are valid numbers and within reasonable ranges
        if (typeof value !== 'number' || isNaN(value)) {
          logger.warn(`Invalid value for ${category}.${key}, must be a number. Using default.`);
          validated[category][key] = defaultValue;
          return;
        }
        
        // Apply min/max constraints based on property name
        if (key.includes('Percentage') || key.includes('Threshold') || key.includes('warning') || key.includes('critical')) {
          // Percentage values should be 0-100
          if (value < 0 || value > 100) {
            logger.warn(`Value for ${category}.${key} out of range, must be 0-100. Using default.`);
            validated[category][key] = defaultValue;
            return;
          }
        }
        
        // Ensure warning is less than critical for paired thresholds
        if (key === 'warning' && values.critical !== undefined && value >= values.critical) {
          logger.warn(`Warning threshold must be less than critical threshold for ${category}. Using default.`);
          validated[category][key] = Math.min(defaultValue, values.critical - 1);
          return;
        }
        
        if (key === 'critical' && values.warning !== undefined && value <= values.warning) {
          logger.warn(`Critical threshold must be greater than warning threshold for ${category}. Using default.`);
          validated[category][key] = Math.max(defaultValue, values.warning + 1);
          return;
        }
        
        // Time durations should be reasonable
        if (key.includes('Duration') || key.includes('Timeout') || key.includes('Interval')) {
          // Durations between 1 second and 1 hour
          if (value < 1000 || value > 3600000) {
            logger.warn(`Duration ${category}.${key} out of reasonable range. Using default.`);
            validated[category][key] = defaultValue;
            return;
          }
        }
        
        // Value passed all checks
        validated[category][key] = value;
      } else if (typeof defaultValue === 'boolean') {
        // Boolean values
        if (typeof value !== 'boolean') {
          logger.warn(`Invalid value for ${category}.${key}, must be boolean. Using default.`);
          validated[category][key] = defaultValue;
        } else {
          validated[category][key] = value;
        }
      } else if (typeof defaultValue === 'string') {
        // String values
        if (typeof value !== 'string') {
          logger.warn(`Invalid value for ${category}.${key}, must be string. Using default.`);
          validated[category][key] = defaultValue;
        } else {
          validated[category][key] = value;
        }
      } else if (typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
        // Object values (nested thresholds)
        validated[category][key] = validateThresholds({ [key]: value })[key] || defaultValue;
      } else {
        // Any other type, just use as is
        validated[category][key] = value;
      }
    });
    
    // If no valid properties were found, don't include the empty category
    if (Object.keys(validated[category]).length === 0) {
      delete validated[category];
    }
  });
  
  return validated;
}

/**
 * Helper function to deep merge objects
 * @private
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects to merge
 * @returns {Object} - Merged object
 */
function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();
  
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return mergeDeep(target, ...sources);
}
