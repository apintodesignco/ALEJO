/**
 * ALEJO Improvement Configuration
 * 
 * Defines how ALEJO balances local user customizations with global improvements.
 * This configuration enables both individual instances to improve based on user
 * preferences while also allowing opt-in contributions to the global codebase.
 */

export const ImprovementConfig = {
  // Local improvement settings
  local: {
    // Whether local improvements are enabled
    enabled: true,
    
    // Maximum storage allocated for local model customizations (in MB)
    maxStorageSize: 500,
    
    // Types of local improvements to track
    trackTypes: [
      'userPreferences',     // UI, accessibility, interaction preferences
      'performanceProfiles', // System optimization settings
      'modelCustomization',  // LLM fine-tuning parameters
      'codeCustomization',   // User-specific code modifications
      'usagePatterns'        // How the user interacts with ALEJO
    ],
    
    // How often to apply local improvements (in hours)
    applyFrequency: 24
  },
  
  // Global improvement settings
  global: {
    // Whether global improvement contributions are enabled
    enabled: true,
    
    // Whether user must explicitly opt-in to global contributions
    requireExplicitConsent: true,
    
    // Types of data that can be shared globally (if user consents)
    sharingOptions: {
      anonymizedUsageStats: {
        default: true,
        description: 'Anonymous usage statistics to improve ALEJO'
      },
      systemOptimizations: {
        default: true,
        description: 'System optimization profiles (no personal data)'
      },
      errorReports: {
        default: true,
        description: 'Error reports to fix bugs (no personal content)'
      },
      codeImprovements: {
        default: false,
        description: 'Code improvements you create (reviewed before sharing)'
      },
      modelFeedback: {
        default: false,
        description: 'AI model feedback (helps improve responses)'
      }
    },
    
    // How contributions are processed
    contributionProcess: {
      // Whether contributions are reviewed before integration
      reviewRequired: true,
      
      // Whether to credit users for their contributions
      attributeContributions: true,
      
      // Minimum quality score required for contributions (0-1)
      qualityThreshold: 0.7
    }
  },
  
  // Conflict resolution between local and global improvements
  conflictResolution: {
    // Default strategy for resolving conflicts
    defaultStrategy: 'userPreference', // 'userPreference', 'global', 'merge'
    
    // Whether to notify users about available global updates
    notifyOnGlobalUpdates: true,
    
    // Whether to preserve local customizations during global updates
    preserveLocalCustomizations: true
  },
  
  // Privacy and security settings
  privacy: {
    // Data anonymization level
    anonymizationLevel: 'high', // 'low', 'medium', 'high'
    
    // Whether to encrypt local improvement data
    encryptLocalData: true,
    
    // Whether to allow cloud backup of local improvements
    allowCloudBackup: false
  }
};

/**
 * Get the current improvement configuration
 * @returns {Object} Current configuration
 */
export function getImprovementConfig() {
  // In the future, this could load from user preferences
  return ImprovementConfig;
}

/**
 * Update the improvement configuration
 * @param {Object} updates - Configuration updates
 * @returns {Object} Updated configuration
 */
export function updateImprovementConfig(updates) {
  // Deep merge updates into the configuration
  mergeConfig(ImprovementConfig, updates);
  
  // Save the updated configuration (future implementation)
  // saveConfigToStorage(ImprovementConfig);
  
  return ImprovementConfig;
}

/**
 * Helper function to deep merge configuration objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @private
 */
function mergeConfig(target, source) {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      mergeConfig(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
