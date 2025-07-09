/**
 * @file index.js
 * @description Progressive enhancement system for ALEJO to ensure functionality across diverse environments
 * @module core/progressive-enhancement
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { publish, subscribe } from '../events.js';
import { ResourceAllocationManager, RESOURCE_MODES } from '../../performance/index.js';
import { BrowserCapabilities } from './browser-capabilities.js';
import { NetworkStatus } from './network-status.js';
import { StorageCapabilities } from './storage-capabilities.js';
import { FeatureDetection } from './feature-detection.js';

// Get singleton instance of resource manager
const resourceManager = ResourceAllocationManager.getInstance();

// Track current enhancement state
let currentState = {
  resourceMode: RESOURCE_MODES.BALANCED,
  networkStatus: 'online',
  storageAvailable: true,
  browserCapabilities: {},
  detectedFeatures: {},
  enhancementLevel: 'standard'
};

// Enhancement levels are defined as an exported constant at the bottom of the file

/**
 * Initialize the progressive enhancement system
 * 
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Progressive enhancement controller
 */
export async function initializeProgressiveEnhancement(options = {}) {
  console.log('[ProgressiveEnhancement] Initializing progressive enhancement system');
  
  try {
    // Detect browser capabilities
    const browserCapabilities = await BrowserCapabilities.detect();
    currentState.browserCapabilities = browserCapabilities;
    
    // Check network status
    const networkStatus = await NetworkStatus.check();
    currentState.networkStatus = networkStatus.status;
    
    // Check storage capabilities
    const storageCapabilities = await StorageCapabilities.check();
    currentState.storageAvailable = storageCapabilities.available;
    
    // Detect supported features
    const features = await FeatureDetection.detectAll();
    currentState.detectedFeatures = features;
    
    // Subscribe to resource manager mode changes
    subscribe('resource-manager:mode-changed', handleResourceModeChange);
    
    // Subscribe to network status changes
    subscribe('network:status-changed', handleNetworkStatusChange);
    
    // Subscribe to storage status changes
    subscribe('storage:status-changed', handleStorageStatusChange);
    
    // Determine initial enhancement level
    determineEnhancementLevel();
    
    // Publish initial state
    publishEnhancementState();
    
    console.log(`[ProgressiveEnhancement] System initialized with level: ${currentState.enhancementLevel}`);
    
    return {
      getCurrentState: () => ({ ...currentState }),
      forceEnhancementLevel: setEnhancementLevel,
      checkFeatureAvailability,
      getEnhancementConfigurations
    };
  } catch (error) {
    console.error('[ProgressiveEnhancement] Failed to initialize:', error);
    
    // Fall back to minimal mode on initialization error
    currentState.enhancementLevel = ENHANCEMENT_LEVELS.MINIMAL;
    publishEnhancementState();
    
    return {
      getCurrentState: () => ({ ...currentState }),
      forceEnhancementLevel: setEnhancementLevel,
      checkFeatureAvailability,
      getEnhancementConfigurations
    };
  }
}

/**
 * Handle resource mode changes from the Resource Manager
 * 
 * @param {Object} data - Event data
 */
function handleResourceModeChange(data) {
  currentState.resourceMode = data.mode;
  determineEnhancementLevel();
  publishEnhancementState();
}

/**
 * Handle network status changes
 * 
 * @param {Object} data - Event data
 */
function handleNetworkStatusChange(data) {
  currentState.networkStatus = data.status;
  determineEnhancementLevel();
  publishEnhancementState();
}

/**
 * Handle storage status changes
 * 
 * @param {Object} data - Event data
 */
function handleStorageStatusChange(data) {
  currentState.storageAvailable = data.available;
  determineEnhancementLevel();
  publishEnhancementState();
}

/**
 * Determine the appropriate enhancement level based on current conditions
 */
function determineEnhancementLevel() {
  // Start with resource mode as base
  let level;
  switch (currentState.resourceMode) {
    case RESOURCE_MODES.FULL:
      level = ENHANCEMENT_LEVELS.FULL;
      break;
    case RESOURCE_MODES.BALANCED:
      level = ENHANCEMENT_LEVELS.STANDARD;
      break;
    case RESOURCE_MODES.CONSERVATIVE:
      level = ENHANCEMENT_LEVELS.BASIC;
      break;
    case RESOURCE_MODES.MINIMAL:
      level = ENHANCEMENT_LEVELS.MINIMAL;
      break;
    default:
      level = ENHANCEMENT_LEVELS.STANDARD;
  }
  
  // Adjust based on network status
  if (currentState.networkStatus === 'offline') {
    // Downgrade by one level when offline
    switch (level) {
      case ENHANCEMENT_LEVELS.FULL:
        level = ENHANCEMENT_LEVELS.STANDARD;
        break;
      case ENHANCEMENT_LEVELS.STANDARD:
        level = ENHANCEMENT_LEVELS.BASIC;
        break;
      case ENHANCEMENT_LEVELS.BASIC:
      case ENHANCEMENT_LEVELS.MINIMAL:
        level = ENHANCEMENT_LEVELS.MINIMAL;
        break;
    }
  } else if (currentState.networkStatus === 'slow') {
    // Downgrade visually heavy features but keep core functionality
    if (level === ENHANCEMENT_LEVELS.FULL) {
      level = ENHANCEMENT_LEVELS.STANDARD;
    }
  }
  
  // Adjust based on storage availability
  if (!currentState.storageAvailable) {
    // Limited storage requires more conservative approach
    if (level === ENHANCEMENT_LEVELS.FULL) {
      level = ENHANCEMENT_LEVELS.STANDARD;
    }
  }
  
  // Check browser capabilities for specific feature requirements
  if (!currentState.browserCapabilities.webgl && level === ENHANCEMENT_LEVELS.FULL) {
    level = ENHANCEMENT_LEVELS.STANDARD;
  }
  
  // Update the current state
  currentState.enhancementLevel = level;
}

/**
 * Manually set the enhancement level (for testing or special cases)
 * 
 * @param {string} level - Enhancement level
 * @returns {boolean} - Success status
 */
function setEnhancementLevel(level) {
  if (!Object.values(ENHANCEMENT_LEVELS).includes(level)) {
    console.error(`[ProgressiveEnhancement] Invalid enhancement level: ${level}`);
    return false;
  }
  
  currentState.enhancementLevel = level;
  publishEnhancementState();
  return true;
}

/**
 * Check if a specific feature is available based on current enhancement level
 * 
 * @param {string} featureId - Feature identifier
 * @returns {boolean} - Whether the feature is available
 */
function checkFeatureAvailability(featureId) {
  // Get feature configurations for current enhancement level
  const configs = getEnhancementConfigurations();
  
  // Check if feature exists in current configuration
  if (configs.features && configs.features[featureId] !== undefined) {
    return configs.features[featureId].enabled;
  }
  
  // If not explicitly defined, check if it's an accessibility feature
  const accessibilityFeatures = [
    'screenReader', 'textToSpeech', 'speechToText', 
    'signLanguage', 'highContrast', 'keyboardNavigation'
  ];
  
  // Always enable accessibility features
  if (accessibilityFeatures.includes(featureId)) {
    return true;
  }
  
  // For unknown features, enable in full and standard modes only
  return currentState.enhancementLevel === ENHANCEMENT_LEVELS.FULL || 
         currentState.enhancementLevel === ENHANCEMENT_LEVELS.STANDARD;
}

/**
 * Get the configuration details for the current enhancement level
 * 
 * @returns {Object} - Enhancement configurations
 */
function getEnhancementConfigurations() {
  switch (currentState.enhancementLevel) {
    case ENHANCEMENT_LEVELS.FULL:
      return {
        quality: 'high',
        caching: { enabled: true, strategy: 'aggressive' },
        prefetching: { enabled: true },
        offlineMode: { enabled: true },
        animations: { enabled: true, quality: 'high' },
        media: { quality: 'high', autoLoad: true },
        features: {
          avatarGeneration: { enabled: true, quality: 'high' },
          visualEffects: { enabled: true },
          backgroundProcessing: { enabled: true },
          dataAnalytics: { enabled: true }
        }
      };
      
    case ENHANCEMENT_LEVELS.STANDARD:
      return {
        quality: 'medium',
        caching: { enabled: true, strategy: 'balanced' },
        prefetching: { enabled: true },
        offlineMode: { enabled: true },
        animations: { enabled: true, quality: 'medium' },
        media: { quality: 'medium', autoLoad: true },
        features: {
          avatarGeneration: { enabled: true, quality: 'medium' },
          visualEffects: { enabled: true },
          backgroundProcessing: { enabled: true },
          dataAnalytics: { enabled: false }
        }
      };
      
    case ENHANCEMENT_LEVELS.BASIC:
      return {
        quality: 'low',
        caching: { enabled: true, strategy: 'minimal' },
        prefetching: { enabled: false },
        offlineMode: { enabled: true },
        animations: { enabled: false },
        media: { quality: 'low', autoLoad: false },
        features: {
          avatarGeneration: { enabled: false },
          visualEffects: { enabled: false },
          backgroundProcessing: { enabled: false },
          dataAnalytics: { enabled: false }
        }
      };
      
    case ENHANCEMENT_LEVELS.MINIMAL:
      return {
        quality: 'minimal',
        caching: { enabled: true, strategy: 'essential-only' },
        prefetching: { enabled: false },
        offlineMode: { enabled: true },
        animations: { enabled: false },
        media: { quality: 'minimal', autoLoad: false },
        features: {
          avatarGeneration: { enabled: false },
          visualEffects: { enabled: false },
          backgroundProcessing: { enabled: false },
          dataAnalytics: { enabled: false }
        }
      };
      
    default:
      return getEnhancementConfigurations(ENHANCEMENT_LEVELS.STANDARD);
  }
}

/**
 * Publish the current enhancement state to other modules
 */
function publishEnhancementState() {
  const config = getEnhancementConfigurations();
  
  publish('progressive-enhancement:state-changed', {
    level: currentState.enhancementLevel,
    config,
    conditions: {
      resourceMode: currentState.resourceMode,
      networkStatus: currentState.networkStatus,
      storageAvailable: currentState.storageAvailable
    },
    timestamp: Date.now()
  });
  
  console.log(`[ProgressiveEnhancement] State updated to: ${currentState.enhancementLevel}`);
}

// Export constants and helper functions
export const ENHANCEMENT_LEVELS = Object.freeze({
  FULL: 'full',
  STANDARD: 'standard',
  BASIC: 'basic',
  MINIMAL: 'minimal'
});

export default {
  initialize: initializeProgressiveEnhancement,
  ENHANCEMENT_LEVELS
};
