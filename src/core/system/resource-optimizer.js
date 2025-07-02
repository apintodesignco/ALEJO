/**
 * ALEJO Resource Optimizer
 * 
 * Analyzes system capabilities and optimizes resource usage accordingly.
 * This module makes intelligent decisions about:
 * - LLM model selection based on available resources
 * - Storage allocation and quota management
 * - Processing strategies (client-side vs hybrid)
 * - UI complexity and feature availability
 */

import { getSystemProfile } from './system-profiler.js';
import { trackImprovement } from '../learning/dual-improvement-manager.js';

// Default resource configurations by capability level
const DEFAULT_CONFIGS = {
  // High-end system configuration
  high: {
    llm: {
      modelSize: 'large',     // 7B+ parameter models
      contextLength: 16384,   // Extended context window
      localProcessing: true,  // Process everything locally
      features: ['reasoning', 'coding', 'multimodal']
    },
    storage: {
      quotaMB: 1000,          // 1GB storage quota
      cacheStrategy: 'aggressive',
      persistenceDefault: true
    },
    ui: {
      complexity: 'full',     // All UI features enabled
      animations: true,
      parallelization: true
    }
  },
  
  // Medium capability system configuration
  medium: {
    llm: {
      modelSize: 'medium',    // 3-7B parameter models
      contextLength: 8192,    // Standard context window
      localProcessing: true,  // Process locally with fallbacks
      features: ['reasoning', 'coding']
    },
    storage: {
      quotaMB: 500,           // 500MB storage quota
      cacheStrategy: 'balanced',
      persistenceDefault: true
    },
    ui: {
      complexity: 'standard', // Standard UI features
      animations: true,
      parallelization: true
    }
  },
  
  // Low-end system configuration
  low: {
    llm: {
      modelSize: 'small',     // 1-3B parameter models
      contextLength: 4096,    // Reduced context window
      localProcessing: false, // Use hybrid processing
      features: ['basic']
    },
    storage: {
      quotaMB: 100,           // 100MB storage quota
      cacheStrategy: 'minimal',
      persistenceDefault: false
    },
    ui: {
      complexity: 'minimal',  // Minimal UI features
      animations: false,
      parallelization: false
    }
  },
  
  // Fallback configuration for very limited systems
  minimal: {
    llm: {
      modelSize: 'tiny',      // <1B parameter models
      contextLength: 2048,    // Minimal context window
      localProcessing: false, // Remote processing required
      features: ['basic']
    },
    storage: {
      quotaMB: 50,            // 50MB storage quota
      cacheStrategy: 'essential',
      persistenceDefault: false
    },
    ui: {
      complexity: 'minimal',  // Bare minimum UI
      animations: false,
      parallelization: false
    }
  }
};

// Cache for optimization results
let cachedOptimization = null;
let optimizationPromise = null;

/**
 * Get optimized resource configuration based on system capabilities
 * @param {Object} options - Optimization options
 * @param {boolean} options.forceRefresh - Force a refresh of cached optimization
 * @param {Object} options.userPreferences - User preferences to consider
 * @returns {Promise<Object>} - Optimized resource configuration
 */
export async function getOptimizedResources(options = {}) {
  // Return cached optimization if available and refresh not forced
  if (cachedOptimization && !options.forceRefresh) {
    return cachedOptimization;
  }
  
  // If optimization is already in progress, return that promise
  if (optimizationPromise && !options.forceRefresh) {
    return optimizationPromise;
  }
  
  // Start optimization
  optimizationPromise = optimizeResources(options.userPreferences);
  
  try {
    cachedOptimization = await optimizationPromise;
    return cachedOptimization;
  } catch (error) {
    console.error('Error optimizing resources:', error);
    // Return a fallback configuration
    return DEFAULT_CONFIGS.minimal;
  } finally {
    optimizationPromise = null;
  }
}

/**
 * Optimize resource allocation based on system capabilities
 * @param {Object} userPreferences - User preferences to consider
 * @returns {Promise<Object>} - Optimized resource configuration
 * @private
 */
async function optimizeResources(userPreferences = {}) {
  console.log('Optimizing resources based on system capabilities...');
  
  try {
    // Get system profile
    const systemProfile = await getSystemProfile();
    
    // Determine capability level based on system profile
    const capabilityLevel = determineCapabilityLevel(systemProfile);
    
    // Get base configuration for this capability level
    const baseConfig = DEFAULT_CONFIGS[capabilityLevel];
    
    // Apply learned optimizations from previous runs
    const learnedOptimizations = await getLearnedOptimizations(capabilityLevel);
    
    // Apply user preferences
    const userAdjustedConfig = applyUserPreferences(
      baseConfig, 
      userPreferences
    );
    
    // Combine configurations with priority: user > learned > base
    const optimizedConfig = {
      ...baseConfig,
      ...learnedOptimizations,
      ...userAdjustedConfig,
      
      // Add metadata
      _metadata: {
        timestamp: Date.now(),
        systemProfile: {
          capabilities: systemProfile.capabilities,
          hardware: {
            cores: systemProfile.hardware.cpu.cores,
            memory: systemProfile.hardware.memory.deviceMemory,
            deviceType: systemProfile.hardware.deviceType
          }
        },
        capabilityLevel,
        optimizationVersion: '1.0'
      }
    };
    
    console.log('Resource optimization complete:', optimizedConfig);
    
    // Track this optimization for learning
    trackOptimization(optimizedConfig);
    
    return optimizedConfig;
  } catch (error) {
    console.error('Error during resource optimization:', error);
    throw error;
  }
}

/**
 * Determine the overall capability level of the system
 * @param {Object} systemProfile - System profile data
 * @returns {string} - Capability level ('high', 'medium', 'low', or 'minimal')
 * @private
 */
function determineCapabilityLevel(systemProfile) {
  // Extract capability scores
  const { 
    computeScore, 
    storageScore, 
    browserScore, 
    gpuScore 
  } = systemProfile.capabilities;
  
  // Calculate weighted average score
  // Compute is most important, followed by storage
  const weightedScore = 
    (computeScore * 0.4) + 
    (storageScore * 0.3) + 
    (browserScore * 0.2) + 
    (gpuScore * 0.1);
  
  // Determine capability level based on score
  if (weightedScore >= 0.75) {
    return 'high';
  } else if (weightedScore >= 0.5) {
    return 'medium';
  } else if (weightedScore >= 0.25) {
    return 'low';
  } else {
    return 'minimal';
  }
}

/**
 * Get learned optimizations from previous runs
 * @param {string} capabilityLevel - Current capability level
 * @returns {Promise<Object>} - Learned optimizations
 * @private
 */
async function getLearnedOptimizations(capabilityLevel) {
  try {
    // In a real implementation, this would load from the improvement system
    // For now, we'll just return an empty object
    return {};
  } catch (error) {
    console.warn('Error getting learned optimizations:', error);
    return {};
  }
}

/**
 * Apply user preferences to the configuration
 * @param {Object} baseConfig - Base configuration
 * @param {Object} userPreferences - User preferences
 * @returns {Object} - User-adjusted configuration
 * @private
 */
function applyUserPreferences(baseConfig, userPreferences) {
  // Start with an empty object
  const adjustedConfig = {};
  
  // Apply LLM preferences if provided
  if (userPreferences.llm) {
    adjustedConfig.llm = {
      ...baseConfig.llm,
      ...userPreferences.llm
    };
  }
  
  // Apply storage preferences if provided
  if (userPreferences.storage) {
    adjustedConfig.storage = {
      ...baseConfig.storage,
      ...userPreferences.storage
    };
  }
  
  // Apply UI preferences if provided
  if (userPreferences.ui) {
    adjustedConfig.ui = {
      ...baseConfig.ui,
      ...userPreferences.ui
    };
  }
  
  return adjustedConfig;
}

/**
 * Track optimization for learning
 * @param {Object} optimization - Optimization configuration
 * @private
 */
function trackOptimization(optimization) {
  try {
    // Track this optimization for future learning
    trackImprovement(
      'performanceProfiles',
      `system-optimization-${optimization._metadata.capabilityLevel}`,
      optimization,
      { significant: true }
    ).catch(error => {
      console.warn('Error tracking optimization:', error);
    });
  } catch (error) {
    console.warn('Error tracking optimization:', error);
  }
}

/**
 * Get recommended LLM configuration based on system capabilities
 * @param {Object} options - Options for LLM recommendation
 * @returns {Promise<Object>} - Recommended LLM configuration
 */
export async function getRecommendedLLM(options = {}) {
  const resources = await getOptimizedResources(options);
  return resources.llm;
}

/**
 * Get recommended storage configuration based on system capabilities
 * @param {Object} options - Options for storage recommendation
 * @returns {Promise<Object>} - Recommended storage configuration
 */
export async function getRecommendedStorage(options = {}) {
  const resources = await getOptimizedResources(options);
  return resources.storage;
}

/**
 * Get recommended UI configuration based on system capabilities
 * @param {Object} options - Options for UI recommendation
 * @returns {Promise<Object>} - Recommended UI configuration
 */
export async function getRecommendedUI(options = {}) {
  const resources = await getOptimizedResources(options);
  return resources.ui;
}

/**
 * Apply a user override to the optimization
 * @param {Object} overrides - User-specified overrides
 * @returns {Promise<Object>} - Updated optimization
 */
export async function applyUserOverrides(overrides) {
  try {
    // Get current optimization
    const currentOptimization = await getOptimizedResources();
    
    // Apply overrides
    const updatedOptimization = {
      ...currentOptimization,
      ...overrides,
      _metadata: {
        ...currentOptimization._metadata,
        userOverridden: true,
        overrideTimestamp: Date.now()
      }
    };
    
    // Update cache
    cachedOptimization = updatedOptimization;
    
    // Track this override for learning
    trackImprovement(
      'userPreferences',
      'resource-optimization-override',
      overrides,
      { significant: true }
    ).catch(error => {
      console.warn('Error tracking optimization override:', error);
    });
    
    return updatedOptimization;
  } catch (error) {
    console.error('Error applying user overrides:', error);
    throw error;
  }
}
