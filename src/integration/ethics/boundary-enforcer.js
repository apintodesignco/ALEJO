/**
 * boundary-enforcer.js
 * Prevents harmful or disallowed behavior by monitoring responses and actions.
 * 
 * Enhanced with:
 * - More sophisticated content filtering categories
 * - User-configurable boundaries with multiple enforcement levels
 * - Better integration with security and consent systems
 * - Detailed violation logging with remediation suggestions
 * - Support for different response formats (text, voice, multimodal)
 */
import { subscribe, publish } from '../../core/events.js';
import * as security from '../../security/index.js';

// Default boundary configuration with categories and patterns
const DEFAULT_BOUNDARIES = {
  // Safety boundaries
  safety: {
    selfHarm: {
      active: true,
      level: 'block', // block, warn, or monitor
      patterns: [
        /\b(kill|harm|hurt)\s+(myself|yourself|himself|herself|themself)\b/i,
        /\b(suicid\w+|self-harm\w*|cut\s+\w+self)\b/i,
        /\b(ways|methods|how)\s+to\s+(die|commit suicide|harm\s+\w+self)\b/i
      ],
      description: 'Content that promotes, encourages, or provides instruction for self-harm',
      userConfigurable: false // Critical safety boundaries cannot be disabled by users
    },
    violence: {
      active: true,
      level: 'block',
      patterns: [
        /\b(kill|murder|assault|attack)\s+(people|person|him|her|them)\b/i,
        /\b(bomb|shooting|terror\w+)\s+(instructions|plans|manifesto)\b/i,
        /\b(how\s+to|instructions\s+for)\s+(build|create|make)\s+(weapons|bombs|poisons)\b/i
      ],
      description: 'Content that promotes or provides instruction for violence against others',
      userConfigurable: false
    },
    harassment: {
      active: true,
      level: 'block',
      patterns: [
        /\b(hate\s+speech|slurs?|racial\s+epithets)\b/i,
        /\b(target|harass|stalk|dox)\s+(people|person|individuals)\b/i
      ],
      description: 'Content that encourages harassment, intimidation, or invasion of privacy',
      userConfigurable: false
    }
  },
  
  // Legal boundaries
  legal: {
    illegalActivity: {
      active: true,
      level: 'block',
      patterns: [
        /\b(hack|steal|pirate|defraud)\s+(accounts|data|credentials|money)\b/i,
        /\b(evade|avoid)\s+(taxes|prosecution|authorities)\b/i
      ],
      description: 'Content that provides instruction for illegal activities',
      userConfigurable: false
    },
    copyright: {
      active: true,
      level: 'warn',
      patterns: [
        /\b(download|copy|distribute)\s+(movies|songs|books|content)\s+(illegally|without\s+permission)\b/i,
        /\b(bypass|circumvent)\s+(copyright|DRM|protection)\b/i
      ],
      description: 'Content that may infringe on copyright or intellectual property',
      userConfigurable: true
    }
  },
  
  // Privacy boundaries
  privacy: {
    personalData: {
      active: true,
      level: 'block',
      patterns: [
        /\b(collect|gather|store)\s+(personal|private|sensitive)\s+(data|information)\s+(without consent)\b/i,
        /\b(email|password|credit card|social security|bank)\s+(number|details)\b/i
      ],
      description: 'Content that encourages collection or sharing of personal data without consent',
      userConfigurable: true
    },
    surveillance: {
      active: true,
      level: 'warn',
      patterns: [
        /\b(spy|monitor|track|surveill\w+)\s+(people|users|employees|family)\b/i,
        /\b(hidden|covert)\s+(camera|microphone|tracker|surveillance)\b/i
      ],
      description: 'Content related to unauthorized surveillance',
      userConfigurable: true
    }
  },
  
  // User-defined custom boundaries
  custom: {}
};

// Current active boundary configuration (initialized with defaults and updated with user preferences)
let activeBoundaries = JSON.parse(JSON.stringify(DEFAULT_BOUNDARIES));

// Tracks initialization status
let initialized = false;

// Stores the user's boundary preference settings
let userBoundarySettings = {};

/**
 * Initialize the boundary enforcer with optional user settings
 * @param {Object} options - Configuration options
 * @param {Object} options.userSettings - User's boundary preferences
 * @param {Boolean} options.strictMode - If true, applies stricter boundary enforcement
 * @returns {Promise<boolean>} success
 */
export async function initialize(options = {}) {
  if (initialized) return true;
  
  // Initialize security module if available
  if (security && typeof security.initialize === 'function') {
    await security.initialize();
  }
  
  // Register event listeners
  subscribe('response:pre_delivery', handlePreDelivery);
  subscribe('user:input_submitted', checkUserInput);
  subscribe('ethics:boundary_settings_updated', updateBoundarySettings);
  subscribe('security:user_login_complete', loadUserBoundarySettings);
  subscribe('multimodal:fusion_complete', checkFusedCommand);
  
  // If user settings provided, apply them
  if (options.userSettings) {
    await updateBoundarySettings({ settings: options.userSettings });
  } else {
    // Try to load saved user settings if available
    await loadUserBoundarySettings();
  }
  
  initialized = true;
  publish('ethics:boundary-enforcer:initialized', { 
    timestamp: Date.now(),
    boundaryCategories: Object.keys(activeBoundaries)
  });
  
  return true;
}

/**
 * Update boundary settings based on user preferences
 * @param {Object} data - Event data containing settings
 * @returns {Promise<boolean>} success
 */
async function updateBoundarySettings(data = {}) {
  const { settings, userId } = data;
  
  if (!settings) return false;
  
  // Store the user's preference settings
  userBoundarySettings = settings;
  
  // Apply user settings to active boundaries
  try {
    // Deep clone the default boundaries as a starting point
    activeBoundaries = JSON.parse(JSON.stringify(DEFAULT_BOUNDARIES));
    
    // Apply user's custom boundaries
    if (settings.custom && Array.isArray(settings.custom)) {
      activeBoundaries.custom = {};
      
      settings.custom.forEach(custom => {
        if (custom.name && custom.patterns && custom.level) {
          // Convert string patterns to RegExp objects
          const regexPatterns = custom.patterns.map(pattern => {
            try {
              return new RegExp(pattern, 'i');
            } catch (e) {
              console.error(`Invalid regex pattern: ${pattern}`, e);
              return null;
            }
          }).filter(Boolean);
          
          if (regexPatterns.length > 0) {
            activeBoundaries.custom[custom.name] = {
              active: custom.active !== false,
              level: ['block', 'warn', 'monitor'].includes(custom.level) ? custom.level : 'warn',
              patterns: regexPatterns,
              description: custom.description || `Custom boundary: ${custom.name}`,
              userConfigurable: true
            };
          }
        }
      });
    }
    
    // Apply modifications to built-in boundaries
    if (settings.modifications) {
      for (const [category, boundaries] of Object.entries(settings.modifications)) {
        if (activeBoundaries[category]) {
          for (const [boundaryName, config] of Object.entries(boundaries)) {
            if (activeBoundaries[category][boundaryName] && 
                activeBoundaries[category][boundaryName].userConfigurable) {
              // Only update active status and level for user-configurable boundaries
              if (typeof config.active === 'boolean') {
                activeBoundaries[category][boundaryName].active = config.active;
              }
              
              if (['block', 'warn', 'monitor'].includes(config.level)) {
                activeBoundaries[category][boundaryName].level = config.level;
              }
            }
          }
        }
      }
    }
    
    // Save the user's boundary settings if security module is available
    if (userId && security && typeof security.storeUserPreference === 'function') {
      await security.storeUserPreference(userId, 'boundary_settings', settings, {
        encrypted: true
      });
    }
    
    publish('ethics:boundaries_updated', {
      timestamp: Date.now(),
      categories: Object.keys(activeBoundaries)
    });
    
    return true;
  } catch (error) {
    console.error('Failed to update boundary settings:', error);
    
    // Log error event if security module is available
    if (security && typeof security.logSecureEvent === 'function') {
      security.logSecureEvent('ethics:boundary_settings_error', {
        error: error.message,
        stack: error.stack,
        settings
      });
    }
    
    return false;
  }
}

/**
 * Load a user's boundary settings after login
 * @param {Object} data - Event data containing userId
 * @returns {Promise<boolean>} success
 */
async function loadUserBoundarySettings(data = {}) {
  const { userId } = data;
  
  if (!userId) return false;
  
  try {
    // Load user preferences if security module is available
    if (security && typeof security.getUserPreference === 'function') {
      const settings = await security.getUserPreference(userId, 'boundary_settings');
      
      if (settings) {
        return updateBoundarySettings({ settings, userId });
      }
    }
    
    return false;
  } catch (error) {
    console.error('Failed to load user boundary settings:', error);
    return false;
  }
}

/**
 * Check if content violates any active boundaries
 * @param {string} content - Content to check
 * @param {Object} metadata - Additional context about the content
 * @returns {Object|null} - Violation details if found, null otherwise
 */
function checkBoundaries(content, metadata = {}) {
  if (!content || typeof content !== 'string') return null;
  
  // Check each category of boundaries
  for (const [categoryName, category] of Object.entries(activeBoundaries)) {
    // Check each boundary within the category
    for (const [boundaryName, boundary] of Object.entries(category)) {
      if (!boundary.active) continue;
      
      // Check each pattern in the boundary
      for (const pattern of boundary.patterns) {
        if (pattern.test(content)) {
          return {
            category: categoryName,
            boundary: boundaryName,
            pattern: pattern.toString(),
            level: boundary.level,
            description: boundary.description,
            violationContext: extractViolationContext(content, pattern),
            metadata
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract the context around the violation for better reporting
 * @param {string} content - Full content
 * @param {RegExp} pattern - Pattern that matched
 * @returns {string} - Context snippet
 */
function extractViolationContext(content, pattern) {
  try {
    const match = content.match(pattern);
    if (!match || match.index === undefined) return '';
    
    const start = Math.max(0, match.index - 30);
    const end = Math.min(content.length, match.index + match[0].length + 30);
    
    let context = content.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < content.length) context += '...';
    
    return context;
  } catch (error) {
    return '';
  }
}

/**
 * Handle a response before it's delivered
 * @param {Object} data - { response, metadata }
 */
function handlePreDelivery(data) {
  const { response, metadata } = data;
  
  if (!response || !response.content) return;
  
  const violation = checkBoundaries(response.content, metadata);
  
  if (violation) {
    // Handle the violation based on its level
    switch (violation.level) {
      case 'block':
        handleBlockViolation(response, violation);
        break;
      case 'warn':
        handleWarnViolation(response, violation);
        break;
      case 'monitor':
        handleMonitorViolation(response, violation);
        break;
    }
  }
}

/**
 * Handle blocking-level violations
 * @param {Object} response - Response object with content
 * @param {Object} violation - Violation details
 */
function handleBlockViolation(response, violation) {
  // Log violation
  logBoundaryViolation(violation, 'blocked');
  
  // Replace the violating content
  const safeContent = createSafeReplacement(response.content, violation);
  response.content = safeContent;
  
  // Add explanation of why content was blocked
  response.metadata = response.metadata || {};
  response.metadata.boundaryViolation = {
    explanation: `Some content was removed because it violated our ${violation.category} guidelines: ${violation.description}.`,
    category: violation.category,
    boundary: violation.boundary,
    action: 'blocked'
  };
  
  // Notify system that response was modified
  publish('ethics:boundary-violated', { 
    response, 
    violation,
    action: 'blocked'
  });
  
  publish('response:modified', { response });
}

/**
 * Handle warning-level violations
 * @param {Object} response - Response object with content
 * @param {Object} violation - Violation details
 */
function handleWarnViolation(response, violation) {
  // Log violation
  logBoundaryViolation(violation, 'warned');
  
  // Add warning to the response but don't modify content
  response.metadata = response.metadata || {};
  response.metadata.boundaryViolation = {
    explanation: `This response contains content that may be concerning related to ${violation.description}. Please use this information responsibly.`,
    category: violation.category,
    boundary: violation.boundary,
    action: 'warned'
  };
  
  // Notify system
  publish('ethics:boundary-warned', { 
    response, 
    violation,
    action: 'warned'
  });
}

/**
 * Handle monitor-level violations
 * @param {Object} response - Response object with content
 * @param {Object} violation - Violation details
 */
function handleMonitorViolation(response, violation) {
  // Just log the violation without modifying content
  logBoundaryViolation(violation, 'monitored');
  
  // Notify system for monitoring purposes
  publish('ethics:boundary-monitored', { 
    response, 
    violation,
    action: 'monitored'
  });
}

/**
 * Create a safe replacement for violating content
 * @param {string} originalContent - Original content
 * @param {Object} violation - Violation details
 * @returns {string} - Safe content with violations removed
 */
function createSafeReplacement(originalContent, violation) {
  try {
    // Create a pattern from the violation pattern
    const pattern = new RegExp(violation.pattern.slice(1, -2), 'i');
    
    // Replace the violating content with a placeholder
    return originalContent.replace(pattern, '[content removed due to safety guidelines]');
  } catch (error) {
    // If regex fails, replace entire content as a fallback
    return 'I apologize, but I cannot provide that information as it may violate safety guidelines.';
  }
}

/**
 * Log boundary violation securely
 * @param {Object} violation - Violation details
 * @param {string} action - Action taken (blocked, warned, monitored)
 */
function logBoundaryViolation(violation, action) {
  if (security && typeof security.logSecureEvent === 'function') {
    security.logSecureEvent('ethics:boundary-violation', {
      category: violation.category,
      boundary: violation.boundary,
      pattern: violation.pattern,
      context: violation.violationContext,
      action,
      timestamp: Date.now(),
      metadata: violation.metadata
    });
  }
}

/**
 * Check user input for potential boundary violations
 * @param {Object} data - Event data with user input
 */
function checkUserInput(data = {}) {
  const { input, userId, context } = data;
  
  if (!input || typeof input !== 'string') return;
  
  // Check input against boundaries
  const violation = checkBoundaries(input, { userId, context });
  
  if (violation && violation.level === 'block') {
    // Log attempted violation from user
    logBoundaryViolation(violation, 'user_input_flagged');
    
    // Notify system
    publish('ethics:user-input-violation', {
      violation,
      userId,
      timestamp: Date.now()
    });
  }
}

/**
 * Check multimodal commands after fusion for violations
 * @param {Object} data - Fused command data
 */
function checkFusedCommand(data = {}) {
  const { command, confidence, sources } = data;
  
  if (!command || typeof command !== 'string') return;
  
  // Check command against boundaries
  const violation = checkBoundaries(command, { confidence, sources });
  
  if (violation && violation.level === 'block') {
    // Log violation
    logBoundaryViolation(violation, 'command_blocked');
    
    // Publish command blocked event
    publish('ethics:command-blocked', {
      violation,
      command,
      timestamp: Date.now()
    });
    
    // Replace the command with an error
    data.command = null;
    data.error = `Command blocked due to ${violation.category} safety concerns`;
    
    // Notify user that command was blocked
    publish('user:notification', {
      type: 'warning',
      message: `Your request could not be processed as it may violate our ${violation.category} guidelines.`,
      details: violation.description
    });
  }
}

/**
 * Get the current boundary settings (for UI display)
 * @returns {Object} - Current boundary settings
 */
export function getBoundarySettings() {
  return {
    categories: Object.keys(activeBoundaries),
    userConfigurable: Object.entries(activeBoundaries).reduce((result, [category, boundaries]) => {
      result[category] = Object.entries(boundaries)
        .filter(([_, boundary]) => boundary.userConfigurable)
        .map(([name, boundary]) => ({
          name,
          description: boundary.description,
          active: boundary.active,
          level: boundary.level
        }));
      return result;
    }, {}),
    userSettings: userBoundarySettings
  };
}

/**
 * Add a custom boundary rule
 * @param {Object} boundary - Custom boundary configuration
 * @returns {boolean} - Success
 */
export function addCustomBoundary(boundary) {
  if (!boundary || !boundary.name || !boundary.patterns || !boundary.level) {
    return false;
  }
  
  try {
    // Add to user settings
    userBoundarySettings.custom = userBoundarySettings.custom || [];
    userBoundarySettings.custom.push(boundary);
    
    // Update boundaries with the new settings
    updateBoundarySettings({ settings: userBoundarySettings });
    return true;
  } catch (error) {
    console.error('Failed to add custom boundary:', error);
    return false;
  }
}
