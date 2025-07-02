/**
 * ALEJO Dual Improvement Manager
 * 
 * Coordinates between local and global improvements, ensuring that ALEJO can
 * both adapt to individual user needs and contribute to collective learning.
 * This module serves as the main entry point for the improvement system.
 */

import { getImprovementConfig, updateImprovementConfig } from './improvement-config.js';
import * as LocalTracker from './local-improvement-tracker.js';
import * as GlobalSystem from './global-improvement-system.js';

// Initialization status
let isInitialized = false;

/**
 * Initialize the dual improvement system
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    console.log('Initializing ALEJO Dual Improvement Manager');
    
    // Initialize local tracker
    const localInitialized = await LocalTracker.initialize();
    
    // Initialize global system
    const globalInitialized = await GlobalSystem.initialize();
    
    // Set up coordination between systems
    if (localInitialized && globalInitialized) {
      setupCoordination();
    }
    
    isInitialized = localInitialized && globalInitialized;
    return isInitialized;
  } catch (error) {
    console.error('Failed to initialize Dual Improvement Manager:', error);
    return false;
  }
}

/**
 * Set up coordination between local and global improvement systems
 * @private
 */
function setupCoordination() {
  // Set up periodic sync
  const config = getImprovementConfig();
  const syncInterval = config.global.syncFrequency * 60 * 60 * 1000; // Convert hours to ms
  
  // Schedule periodic sync if enabled
  if (config.global.enabled && syncInterval > 0) {
    setInterval(() => {
      synchronizeImprovements();
    }, syncInterval);
  }
  
  // Listen for local improvements that might be worth sharing
  window.addEventListener('alejo:improvement:significant', (event) => {
    considerSharingImprovement(event.detail.type, event.detail.key, event.detail.value);
  });
}

/**
 * Track a new improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @param {any} value - Improvement data
 * @param {Object} options - Tracking options
 * @returns {Promise<boolean>} Success status
 */
export async function trackImprovement(type, key, value, options = {}) {
  if (!isInitialized) {
    console.warn('Dual Improvement Manager not initialized');
    return false;
  }
  
  // Track locally
  const tracked = LocalTracker.trackImprovement(type, key, value);
  
  // Consider for global sharing if significant
  if (tracked && options.significant) {
    await considerSharingImprovement(type, key, value);
  }
  
  return tracked;
}

/**
 * Consider sharing a significant improvement with the global system
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @param {any} value - Improvement data
 * @returns {Promise<Object>} Sharing result
 * @private
 */
async function considerSharingImprovement(type, key, value) {
  const config = getImprovementConfig();
  
  // Check if global sharing is enabled
  if (!config.global.enabled) {
    return { shared: false, reason: 'Global improvements disabled' };
  }
  
  // Check if this type of improvement can be shared
  if (!canShareImprovementType(type)) {
    return { shared: false, reason: 'Improvement type not sharable' };
  }
  
  // Evaluate significance
  const significance = evaluateSignificance(type, key, value);
  
  // Only share if significant enough
  if (significance >= config.global.significanceThreshold) {
    // Add metadata about significance
    const metadata = {
      significance,
      evaluationCriteria: ['impact', 'uniqueness', 'quality']
    };
    
    // Submit to global system
    const result = await GlobalSystem.submitContribution(type, key, value, metadata);
    
    return {
      shared: result.success,
      contributionId: result.contributionId,
      significance
    };
  }
  
  return {
    shared: false,
    reason: 'Not significant enough',
    significance
  };
}

/**
 * Check if an improvement type can be shared globally
 * @param {string} type - Improvement type
 * @returns {boolean} Whether the type can be shared
 * @private
 */
function canShareImprovementType(type) {
  const config = getImprovementConfig();
  
  // Map improvement types to sharing options
  const typeToSharingOption = {
    userPreferences: 'anonymizedUsageStats',
    performanceProfiles: 'systemOptimizations',
    modelCustomization: 'modelFeedback',
    codeCustomization: 'codeImprovements',
    usagePatterns: 'anonymizedUsageStats'
  };
  
  const sharingOption = typeToSharingOption[type];
  if (!sharingOption) return false;
  
  // Check if this sharing option is enabled
  return config.global.sharingOptions[sharingOption]?.default === true;
}

/**
 * Evaluate the significance of an improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @param {any} value - Improvement data
 * @returns {number} Significance score (0-1)
 * @private
 */
function evaluateSignificance(type, key, value) {
  // This is a simplified implementation
  // A real implementation would have more sophisticated significance evaluation
  
  // For now, we'll just return a random score between 0.3 and 0.9
  return 0.3 + Math.random() * 0.6;
}

/**
 * Synchronize between local and global improvements
 * @returns {Promise<Object>} Synchronization results
 */
export async function synchronizeImprovements() {
  try {
    console.log('Synchronizing improvements...');
    
    const results = {
      localProcessed: 0,
      globalChecked: 0,
      globalApplied: 0,
      contributions: 0
    };
    
    // Process local improvements
    const localResults = await LocalTracker.processImprovements();
    results.localProcessed = localResults.processed;
    
    // Check for global updates
    const updateCheck = await GlobalSystem.checkForGlobalUpdates();
    results.globalChecked = updateCheck.success ? 1 : 0;
    
    if (updateCheck.success && updateCheck.hasUpdates) {
      // Apply global updates
      const updateResults = await GlobalSystem.applyGlobalUpdates(updateCheck.updates);
      if (updateResults.success) {
        results.globalApplied = updateResults.results.applied;
      }
    }
    
    // Submit pending contributions
    const pendingContributions = GlobalSystem.getPendingContributions();
    for (const contribution of pendingContributions) {
      if (contribution.status === 'pending') {
        const submitResult = await GlobalSystem.submitPendingContribution(contribution.id);
        if (submitResult.success) {
          results.contributions++;
        }
      }
    }
    
    console.log('Synchronization complete:', results);
    return results;
  } catch (error) {
    console.error('Error synchronizing improvements:', error);
    return {
      error: true,
      message: error.message
    };
  }
}

/**
 * Get user consent settings for global contributions
 * @returns {Object} Current consent settings
 */
export function getConsentSettings() {
  const config = getImprovementConfig();
  
  // Extract just the consent status for each sharing option
  const consentSettings = {};
  for (const [option, settings] of Object.entries(config.global.sharingOptions)) {
    consentSettings[option] = {
      description: settings.description,
      consented: settings.consented ?? settings.default
    };
  }
  
  return consentSettings;
}

/**
 * Update user consent settings for global contributions
 * @param {Object} settings - New consent settings
 * @returns {Promise<boolean>} Success status
 */
export async function updateConsentSettings(settings) {
  try {
    // Update the global system
    const success = await GlobalSystem.setUserConsent(settings);
    
    // Also update the configuration
    if (success) {
      const config = getImprovementConfig();
      
      for (const [option, value] of Object.entries(settings)) {
        if (config.global.sharingOptions[option]) {
          config.global.sharingOptions[option].consented = !!value;
        }
      }
      
      updateImprovementConfig({ global: { sharingOptions: config.global.sharingOptions } });
    }
    
    return success;
  } catch (error) {
    console.error('Error updating consent settings:', error);
    return false;
  }
}

/**
 * Get a specific local improvement
 * @param {string} type - Improvement type
 * @param {string} key - Improvement identifier
 * @returns {any} Improvement value or null if not found
 */
export function getLocalImprovement(type, key) {
  return LocalTracker.getImprovement(type, key);
}

/**
 * Get all local improvements of a specific type
 * @param {string} type - Improvement type
 * @returns {Map} Map of improvements
 */
export function getAllLocalImprovements(type) {
  return LocalTracker.getAllImprovements(type);
}

/**
 * Clear all tracked local improvements
 * @param {string} [specificType] - Optional specific type to clear
 * @returns {Promise<boolean>} Success status
 */
export async function clearLocalImprovements(specificType = null) {
  return await LocalTracker.clearImprovements(specificType);
}

/**
 * Get pending global contributions
 * @returns {Array} Array of pending contributions
 */
export function getPendingContributions() {
  return GlobalSystem.getPendingContributions();
}

/**
 * Submit a pending contribution to the global system
 * @param {string} contributionId - ID of the contribution to submit
 * @returns {Promise<Object>} Submission result
 */
export async function submitPendingContribution(contributionId) {
  return await GlobalSystem.submitPendingContribution(contributionId);
}
