/**
 * ALEJO Transparency Module
 * 
 * Provides clear explanations of ALEJO's decisions and data usage:
 * - Explains AI decisions in understandable terms
 * - Clarifies what data is collected and how it's used
 * - Provides insight into personalization factors
 * - Offers different levels of explanation depth
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';

// Constants
const TRANSPARENCY_STORAGE_KEY = 'alejo_transparency_settings';
const DEFAULT_EXPLANATION_LEVEL = 'standard'; // minimal, standard, detailed
const FEATURE_ID = 'personalization:transparency';

// State management
let initialized = false;
let transparencySettings = {
  explanationLevel: DEFAULT_EXPLANATION_LEVEL,
  showDataUsage: true,
  showConfidenceScores: true,
  showReasoningSteps: true,
  verbosityLevel: 2, // 1-5, with 5 being most verbose
  userPreferredFormat: 'conversational' // conversational, technical, visual
};
let explanationContext = {};

/**
 * Initialize the transparency module
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Transparency Module');
  
  if (initialized) {
    console.warn('Transparency Module already initialized');
    return true;
  }
  
  try {
    // Initialize security module if not already done
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    // Load user settings
    await loadTransparencySettings(options.userId || 'anonymous');
    
    // Override with provided options
    if (options.explanationLevel) {
      transparencySettings.explanationLevel = options.explanationLevel;
    }
    
    // Register for relevant events
    subscribe('response:pre_delivery', addTransparencyData);
    subscribe('personalization:applied', recordPersonalizationFactor);
    subscribe('user:privacy:update', updateDataTransparency);
    
    initialized = true;
    publish('ethics:transparency:initialized', { success: true });
    
    // Log initialization if consent is granted
    if (security.isFeatureAllowed('personalization:learning')) {
      security.logSecureEvent('ethics:transparency:initialized', {
        timestamp: Date.now(),
        settings: transparencySettings
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Transparency Module:', error);
    publish('ethics:transparency:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Load user transparency settings
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User settings
 */
async function loadTransparencySettings(userId) {
  try {
    // Try to load from secure storage
    if (security && typeof security.secureRetrieve === 'function') {
      const storedSettings = await security.secureRetrieve(
        `${TRANSPARENCY_STORAGE_KEY}_${userId}`,
        { consentFeature: FEATURE_ID }
      );
      
      if (storedSettings) {
        transparencySettings = {
          ...transparencySettings,
          ...storedSettings
        };
        return transparencySettings;
      }
    }
    
    // Default settings are already set
    return transparencySettings;
  } catch (error) {
    console.error('Error loading transparency settings:', error);
    return transparencySettings;
  }
}

/**
 * Save current transparency settings
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
async function saveTransparencySettings(userId) {
  if (!security || typeof security.secureStore !== 'function') {
    console.error('Security module not available, cannot save transparency settings');
    return false;
  }
  
  try {
    const result = await security.secureStore(
      `${TRANSPARENCY_STORAGE_KEY}_${userId}`,
      transparencySettings,
      { 
        consentFeature: FEATURE_ID,
        category: 'ethics'
      }
    );
    
    return result;
  } catch (error) {
    console.error('Failed to save transparency settings:', error);
    return false;
  }
}

/**
 * Add transparency explanations to a response
 * @param {Object} data - Response data
 */
function addTransparencyData(data) {
  if (!initialized) {
    return;
  }
  
  // Skip for system messages
  if (data.systemMessage || !data.content) {
    return;
  }
  
  try {
    // Check if transparency features are enabled via consent
    const transparencyEnabled = security.isFeatureAllowed(FEATURE_ID);
    if (!transparencyEnabled) {
      // If not enabled, don't add any transparency data
      return;
    }
    
    // Create transparency metadata
    const transparencyInfo = generateTransparencyInfo(data);
    
    // Add to response metadata
    data.transparencyInfo = transparencyInfo;
    
    // For detailed explanations, augment the response content
    if (transparencySettings.explanationLevel === 'detailed' && 
        transparencySettings.verbosityLevel > 3) {
      data.content = appendExplanation(data.content, transparencyInfo);
    }
  } catch (error) {
    console.error('Error adding transparency data:', error);
  }
}

/**
 * Generate transparency information for a response
 * @param {Object} data - Response data
 * @returns {Object} Transparency information
 */
function generateTransparencyInfo(data) {
  const info = {
    timestamp: Date.now(),
    explanationLevel: transparencySettings.explanationLevel,
    factors: {}
  };
  
  // Include confidence scores if enabled
  if (transparencySettings.showConfidenceScores && data.confidence) {
    info.confidence = data.confidence;
  }
  
  // Include data usage explanation if enabled
  if (transparencySettings.showDataUsage) {
    info.dataUsage = explainDataUsage(data);
  }
  
  // Include personalization factors
  if (explanationContext.personalizationFactors) {
    info.factors.personalization = explanationContext.personalizationFactors;
  }
  
  // Include reasoning steps if enabled and available
  if (transparencySettings.showReasoningSteps && data.reasoningSteps) {
    info.reasoningSteps = data.reasoningSteps;
  }
  
  // Include any value alignment info
  if (data.valueAlignmentScore !== undefined) {
    info.valueAlignment = {
      score: data.valueAlignmentScore,
      assessment: data.valueAssessment
    };
  }
  
  return info;
}

/**
 * Explain how user data was used in generating a response
 * @param {Object} data - Response data
 * @returns {Object} Data usage explanation
 */
function explainDataUsage(data) {
  const dataUsage = {
    personalDataAccessed: false,
    dataCategories: [],
    purpose: 'To provide a relevant response'
  };
  
  // Check what data was accessed from various parts of the system
  if (data.usedPreferences) {
    dataUsage.personalDataAccessed = true;
    dataUsage.dataCategories.push('user preferences');
  }
  
  if (data.usedHistory) {
    dataUsage.personalDataAccessed = true;
    dataUsage.dataCategories.push('conversation history');
  }
  
  if (data.usedVoiceProfile) {
    dataUsage.personalDataAccessed = true;
    dataUsage.dataCategories.push('voice recognition data');
  }
  
  if (data.usedFaceProfile) {
    dataUsage.personalDataAccessed = true;
    dataUsage.dataCategories.push('facial recognition data');
  }
  
  if (data.usedPersonalMemory) {
    dataUsage.personalDataAccessed = true;
    dataUsage.dataCategories.push('personal memory graph');
  }
  
  return dataUsage;
}

/**
 * Record a personalization factor that influenced processing
 * @param {Object} data - Personalization factor data
 */
function recordPersonalizationFactor(data) {
  if (!initialized) {
    return;
  }
  
  // Initialize if needed
  if (!explanationContext.personalizationFactors) {
    explanationContext.personalizationFactors = [];
  }
  
  // Add to factors
  explanationContext.personalizationFactors.push({
    type: data.type,
    influence: data.influence,
    timestamp: Date.now()
  });
  
  // Limit the number of stored factors
  if (explanationContext.personalizationFactors.length > 10) {
    explanationContext.personalizationFactors.shift();
  }
}

/**
 * Update data transparency settings based on privacy preferences
 * @param {Object} data - Privacy update data
 */
function updateDataTransparency(data) {
  if (!initialized) {
    return;
  }
  
  // Update transparency settings based on privacy level
  if (data.privacyLevel === 'high') {
    transparencySettings.showDataUsage = true;
    transparencySettings.verbosityLevel = Math.max(3, transparencySettings.verbosityLevel);
  } else if (data.privacyLevel === 'low') {
    transparencySettings.verbosityLevel = Math.min(2, transparencySettings.verbosityLevel);
  }
  
  // Save the updated settings
  saveTransparencySettings('anonymous'); // TODO: Use actual user ID
}

/**
 * Append explanation to response content
 * @param {string} content - Original content
 * @param {Object} transparencyInfo - Transparency information
 * @returns {string} Augmented content
 */
function appendExplanation(content, transparencyInfo) {
  // Only append if we have something to explain
  if (!transparencyInfo || 
      (!transparencyInfo.dataUsage && 
       !transparencyInfo.factors.personalization)) {
    return content;
  }
  
  let explanation = '\n\n';
  
  if (transparencySettings.userPreferredFormat === 'conversational') {
    explanation += '— — —\n';
    explanation += 'Additional information about this response:\n';
    
    if (transparencyInfo.dataUsage && transparencyInfo.dataUsage.personalDataAccessed) {
      explanation += `• This response was personalized using your ${transparencyInfo.dataUsage.dataCategories.join(', ')}.\n`;
    }
    
    if (transparencyInfo.factors.personalization?.length > 0) {
      explanation += '• Personalization factors applied:\n';
      transparencyInfo.factors.personalization.forEach(factor => {
        explanation += `  - ${formatPersonalizationFactor(factor)}\n`;
      });
    }
    
    if (transparencyInfo.confidence !== undefined) {
      explanation += `• Confidence level: ${Math.round(transparencyInfo.confidence * 100)}%\n`;
    }
  } else if (transparencySettings.userPreferredFormat === 'technical') {
    explanation += '```\n';
    explanation += 'TRANSPARENCY DATA:\n';
    explanation += JSON.stringify(transparencyInfo, null, 2);
    explanation += '\n```\n';
  }
  
  return content + explanation;
}

/**
 * Format a personalization factor for display
 * @param {Object} factor - Personalization factor
 * @returns {string} Formatted description
 */
function formatPersonalizationFactor(factor) {
  switch (factor.type) {
    case 'preference':
      return `Your ${factor.preference} preference was applied`;
    case 'history':
      return 'Based on your previous conversations';
    case 'voice':
      return 'Voice tone matching your communication style';
    case 'pace':
      return 'Response pace adjusted to your reading speed';
    default:
      return `${factor.type} personalization applied`;
  }
}

/**
 * Generate an explanation for a specific decision
 * @param {Object} decision - Decision to explain
 * @param {Object} options - Explanation options
 * @returns {string} Human-readable explanation
 */
export function explainDecision(decision, options = {}) {
  if (!initialized) {
    console.warn('Transparency Module not initialized');
    return 'No explanation available.';
  }
  
  const level = options.level || transparencySettings.explanationLevel;
  const format = options.format || transparencySettings.userPreferredFormat;
  
  // Build explanation based on format and level
  let explanation = '';
  
  if (format === 'conversational') {
    switch (level) {
      case 'minimal':
        explanation = decision.shortExplanation || 'This decision was made based on your preferences.';
        break;
      case 'standard':
        explanation = decision.explanation || `This decision was made based on ${decision.factors?.join(', ') || 'various factors'}.`;
        break;
      case 'detailed':
        explanation = decision.detailedExplanation || `This decision was made considering:\n`;
        if (decision.factors) {
          decision.factors.forEach(factor => {
            explanation += `- ${factor}\n`;
          });
        }
        if (decision.reasoningSteps) {
          explanation += '\nReasoning process:\n';
          decision.reasoningSteps.forEach((step, index) => {
            explanation += `${index + 1}. ${step}\n`;
          });
        }
        break;
      default:
        explanation = decision.explanation || 'No detailed explanation available.';
    }
  } else if (format === 'technical') {
    explanation = '```json\n';
    explanation += JSON.stringify({
      decision: decision.name,
      factors: decision.factors,
      confidence: decision.confidence,
      reasoningSteps: decision.reasoningSteps,
      dataUsed: decision.dataUsed,
      timestamp: decision.timestamp || Date.now()
    }, null, 2);
    explanation += '\n```';
  }
  
  return explanation;
}

/**
 * Get transparency settings
 * @returns {Object} Current transparency settings
 */
export function getTransparencySettings() {
  return { ...transparencySettings };
}

/**
 * Update transparency settings
 * @param {Object} settings - New settings
 * @returns {Promise<boolean>} Success status
 */
export async function updateSettings(settings) {
  if (!initialized) {
    await initialize();
  }
  
  // Update settings
  transparencySettings = {
    ...transparencySettings,
    ...settings
  };
  
  // Log the update
  if (security && security.isFeatureAllowed(FEATURE_ID)) {
    security.logSecureEvent('ethics:transparency:settings_updated', {
      settings: transparencySettings
    });
  }
  
  // Save the updated settings
  return saveTransparencySettings('anonymous'); // TODO: Use actual user ID
}

/**
 * Clear the explanation context
 */
export function clearExplanationContext() {
  explanationContext = {};
}

/**
 * Set the explanation level
 * @param {string} level - Explanation level (minimal, standard, detailed)
 * @returns {Promise<boolean>} Success status
 */
export async function setExplanationLevel(level) {
  const validLevels = ['minimal', 'standard', 'detailed'];
  if (!validLevels.includes(level)) {
    console.error(`Invalid explanation level: ${level}`);
    return false;
  }
  
  transparencySettings.explanationLevel = level;
  
  // Log the update
  if (security && security.isFeatureAllowed(FEATURE_ID)) {
    security.logSecureEvent('ethics:transparency:level_updated', {
      level
    });
  }
  
  // Save the updated settings
  return saveTransparencySettings('anonymous'); // TODO: Use actual user ID
}

/**
 * Generate a data usage report
 * @param {Object} options - Report options
 * @returns {Object} Data usage report
 */
export function generateDataReport(options = {}) {
  if (!initialized) {
    console.warn('Transparency Module not initialized');
    return { generated: false, error: 'Module not initialized' };
  }
  
  // Check if transparency features are enabled via consent
  const transparencyEnabled = security.isFeatureAllowed(FEATURE_ID);
  if (!transparencyEnabled) {
    return { 
      generated: false, 
      error: 'Transparency features not enabled via consent'
    };
  }
  
  // Collect data categories used by the system
  const dataCategories = [
    {
      name: 'User Preferences',
      description: 'Your preferred settings for ALEJO behavior and UI',
      used: true,
      purpose: 'To customize ALEJO to your preferences',
      retention: 'Until explicitly deleted',
      location: 'Stored locally on your device (encrypted)'
    },
    {
      name: 'Conversation History',
      description: 'Records of your interactions with ALEJO',
      used: true,
      purpose: 'To provide context for conversations',
      retention: options.historyRetention || '90 days',
      location: 'Stored locally on your device (encrypted)'
    }
  ];
  
  // Add voice data if used
  if (security.isFeatureAllowed('personalization:voice')) {
    dataCategories.push({
      name: 'Voice Recognition Data',
      description: 'Voice patterns for recognition and personalization',
      used: true,
      purpose: 'To recognize your voice and personalize responses',
      retention: 'Until explicitly deleted',
      location: 'Stored locally on your device (encrypted)'
    });
  }
  
  // Add face data if used
  if (security.isFeatureAllowed('personalization:face')) {
    dataCategories.push({
      name: 'Facial Recognition Data',
      description: 'Facial features for recognition and emotional understanding',
      used: true,
      purpose: 'To recognize you and understand emotional context',
      retention: 'Until explicitly deleted',
      location: 'Stored locally on your device (encrypted)'
    });
  }
  
  // Generate the report
  const report = {
    generated: true,
    timestamp: Date.now(),
    dataCategories,
    privacyControls: [
      {
        name: 'Consent Manager',
        description: 'Control what data ALEJO collects and how it\'s used',
        link: '#/settings/privacy/consent'
      },
      {
        name: 'Data Export',
        description: 'Export all your personal data',
        link: '#/settings/privacy/export'
      },
      {
        name: 'Data Deletion',
        description: 'Delete specific categories of your data',
        link: '#/settings/privacy/delete'
      }
    ]
  };
  
  // Log report generation
  if (security) {
    security.logSecureEvent('ethics:transparency:report_generated', {
      categories: dataCategories.length
    });
  }
  
  return report;
}
