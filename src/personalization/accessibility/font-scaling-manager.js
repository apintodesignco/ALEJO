/**
 * ALEJO Font Scaling Manager
 * 
 * This module provides comprehensive font scaling support with:
 * - Multiple preset font size levels
 * - Custom user-defined font sizes
 * - Per-element customization
 * - Responsive layout adjustments
 * - Preservation of hierarchical relationships
 * - Persistent user preferences
 * - ARIA announcements for state changes
 * 
 * Resource-efficient implementation with CSS variable-based scaling.
 */

import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';
import { ariaManager } from './aria-manager.js';
import { ConfigManager } from '../../core/config-manager.js';
import { Logger } from '../../core/logger.js';
import { ResourceAllocationManager } from '../../core/system/resource-allocation-manager.js';
import { adaptiveFeatureManager } from '../../core/adaptivity/adaptive-feature-manager.js';
import { localStorageManager } from '../../core/storage/local-storage-manager.js';
import { ErrorHandler } from '../../core/error-handler.js';

// Configuration constants
const CONFIG_KEY = 'accessibility.fontScaling';
const FONT_SCALING_CLASS = 'alejo-font-scaled';
const BASE_FONT_SIZE = 16; // Browser default in pixels
const DEFAULT_SCALING_LEVEL = 1; // 1 = 100% (normal)
const STORAGE_KEY = 'alejo_font_scaling_preferences';
const LOW_RESOURCE_OPTIMIZATIONS = 'lowResourceFontOptimizations';

// Font scaling presets (multipliers of base font size)
const SCALING_PRESETS = {
  0.85: 'Small',
  1: 'Normal',
  1.15: 'Medium',
  1.3: 'Large',
  1.5: 'X-Large',
  1.7: 'XX-Large'
};

// Performance optimization presets for different resource levels
const RESOURCE_OPTIMIZATION_LEVELS = {
  high: {
    animationsEnabled: true,
    transitionsEnabled: true,
    complexSelectorsEnabled: true,
    dynamicStyleUpdatesEnabled: true
  },
  medium: {
    animationsEnabled: true,
    transitionsEnabled: true,
    complexSelectorsEnabled: false,
    dynamicStyleUpdatesEnabled: true
  },
  low: {
    animationsEnabled: false,
    transitionsEnabled: false,
    complexSelectorsEnabled: false,
    dynamicStyleUpdatesEnabled: false
  }
};

// CSS selectors for elements to exclude from scaling
const EXCLUDED_ELEMENTS = [
  '.no-font-scaling',
  '[data-no-font-scaling]',
  '.preserve-font-size'
].join(',');

// State
let currentScalingLevel = DEFAULT_SCALING_LEVEL;
let currentResourceLevel = 'high';
let hasInitialized = false;
let styleElement = null;
let configManager = null;
let logger = null;
let resourceManager = null;
let errorHandler = null;

/**
 * Initialize font scaling management
 * 
 * @param {Object} options Configuration options
 * @param {number} [options.initialLevel] Initial scaling level (1 = 100%)
 * @param {boolean} [options.applyImmediately=true] Whether to apply settings immediately
 * @param {boolean} [options.resourceAware=true] Whether to adjust behavior based on system resources
 * @returns {Promise<boolean>} Success status
 */
async function initialize(options = {}) {
  try {
    if (hasInitialized) return true;
    
    const defaultOptions = {
      initialLevel: DEFAULT_SCALING_LEVEL,
      applyImmediately: true,
      resourceAware: true
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    errorHandler = new ErrorHandler('FontScalingManager');
    
    // Get required service instances
    configManager = await ConfigManager.getInstance();
    logger = new Logger('FontScalingManager');
    
    if (finalOptions.resourceAware) {
      try {
        resourceManager = await ResourceAllocationManager.getInstance();
        // Listen for resource level changes
        eventEmitter.on('system:resources:level-changed', handleResourceLevelChange);
        
        // Get current resource level
        const resourceStatus = await resourceManager.getSystemResourceStatus();
        currentResourceLevel = determineResourceLevel(resourceStatus);
        
        logger.debug(`Font scaling initialized with resource level: ${currentResourceLevel}`);
      } catch (resourceError) {
        errorHandler.warn(
          'Failed to initialize resource-aware features for font scaling', 
          resourceError
        );
        // Default to medium resource level if resource manager fails
        currentResourceLevel = 'medium';
      }
    }
    
    // Create style element for dynamic CSS
    createStyleElement();
    
    // Load user preferences (includes both scaling level and optimization preferences)
    await loadUserPreferences(finalOptions);
    
    // Apply immediately if requested
    if (finalOptions.applyImmediately) {
      applyFontScaling(currentScalingLevel);
    }
    
    // Set up event listeners
    eventEmitter.on('accessibility:font-scaling:set', setFontScaling);
    eventEmitter.on('accessibility:font-scaling:increase', increaseFontScaling);
    eventEmitter.on('accessibility:font-scaling:decrease', decreaseFontScaling);
    eventEmitter.on('accessibility:font-scaling:reset', resetFontScaling);
    eventEmitter.on('accessibility:font-scaling:apply-to-element', applyFontScalingToElement);
    
    // Register keyboard shortcuts
    registerKeyboardShortcuts();
    
    // Register with adaptive feature manager
    adaptiveFeatureManager.registerFeature('fontScaling', {
      enabled: currentScalingLevel !== DEFAULT_SCALING_LEVEL,
      resourceImpact: calculateResourceImpact(currentScalingLevel),
      priority: 'medium',
      toggleFunction: setHighResourceModeEnabled
    });
    
    // Log initialization
    auditTrail.log('accessibility', 'Font scaling manager initialized', {
      initialLevel: currentScalingLevel,
      resourceLevel: currentResourceLevel
    });
    
    hasInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize font scaling manager:', error);
    auditTrail.log('error', 'Failed to initialize font scaling manager', {
      error: error.message
    });
    return false;
  }
}

/**
 * Load user preferences for font scaling
 * 
 * @private
 * @param {Object} options Configuration options
 * @returns {Promise<void>}
 */
async function loadUserPreferences(options) {
  try {
    // Try loading from ConfigManager first (managed settings)
    const savedScaling = await configManager.get(CONFIG_KEY);
    if (savedScaling !== undefined && isValidScalingLevel(savedScaling)) {
      currentScalingLevel = savedScaling;
    } else {
      // Fall back to local storage (user preferences)
      try {
        const storedPreferences = await localStorageManager.getEncrypted(STORAGE_KEY);
        if (storedPreferences && storedPreferences.scalingLevel && 
            isValidScalingLevel(storedPreferences.scalingLevel)) {
          currentScalingLevel = storedPreferences.scalingLevel;
        } else {
          currentScalingLevel = options.initialLevel;
        }
      } catch (storageError) {
        errorHandler.warn('Failed to load font scaling preferences from storage', storageError);
        currentScalingLevel = options.initialLevel;
      }
    }
    
    logger.debug(`Loaded font scaling preferences: level=${currentScalingLevel}`);
  } catch (error) {
    errorHandler.warn('Failed to load font scaling preferences', error);
    currentScalingLevel = options.initialLevel;
  }
}

/**
 * Save user preferences for font scaling
 * 
 * @private
 * @returns {Promise<boolean>} Success status
 */
async function saveUserPreferences() {
  try {
    // Save to ConfigManager (managed settings)
    await configManager.set(CONFIG_KEY, currentScalingLevel);
    
    // Save to encrypted local storage (user preferences)
    await localStorageManager.setEncrypted(STORAGE_KEY, {
      scalingLevel: currentScalingLevel,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    errorHandler.warn('Failed to save font scaling preferences', error);
    return false;
  }
}

/**
 * Determine resource level based on system resource status
 * 
 * @private
 * @param {Object} resourceStatus System resource status
 * @returns {string} Resource level (high|medium|low)
 */
function determineResourceLevel(resourceStatus) {
  // Default to medium if status is not available
  if (!resourceStatus) return 'medium';
  
  const { cpuUsage, memoryUsage, batteryStatus } = resourceStatus;
  
  // Low resource mode conditions
  const isLowCpu = cpuUsage && cpuUsage > 80; // CPU usage over 80%
  const isLowMemory = memoryUsage && memoryUsage > 85; // Memory usage over 85%
  const isLowBattery = batteryStatus && 
                     batteryStatus.level < 0.2 && 
                     !batteryStatus.charging; // Battery below 20% and not charging
  
  if (isLowCpu || isLowMemory || isLowBattery) {
    return 'low';
  }
  
  // Medium resource mode conditions
  const isMediumCpu = cpuUsage && cpuUsage > 60; // CPU usage over 60%
  const isMediumMemory = memoryUsage && memoryUsage > 70; // Memory usage over 70%
  const isMediumBattery = batteryStatus && 
                        batteryStatus.level < 0.3 && 
                        !batteryStatus.charging; // Battery below 30% and not charging
  
  if (isMediumCpu || isMediumMemory || isMediumBattery) {
    return 'medium';
  }
  
  // Default to high resources
  return 'high';
}

/**
 * Calculate resource impact of font scaling
 * 
 * @private
 * @param {number} level Current scaling level
 * @returns {string} Resource impact (low|medium|high)
 */
function calculateResourceImpact(level) {
  if (level <= 1) return 'low';
  if (level <= 1.3) return 'medium';
  return 'high';
}

/**
 * Handle resource level changes
 * 
 * @private
 * @param {Object} data Resource level change data
 */
function handleResourceLevelChange(data) {
  const newResourceLevel = determineResourceLevel(data.resourceStatus);
  
  // Only update if the level has changed
  if (newResourceLevel === currentResourceLevel) return;
  
  logger.debug(`Resource level changed from ${currentResourceLevel} to ${newResourceLevel}`);
  currentResourceLevel = newResourceLevel;
  
  // Re-apply font scaling with new resource constraints
  if (currentScalingLevel !== DEFAULT_SCALING_LEVEL) {
    applyFontScaling(currentScalingLevel);
  }
}

/**
 * Enable or disable high resource mode for font scaling
 * 
 * @private
 * @param {boolean} enable Whether to enable high resource mode
 */
function setHighResourceModeEnabled(enable) {
  const newResourceLevel = enable ? 'high' : 'medium';
  
  // Only update if the level has changed
  if (newResourceLevel === currentResourceLevel) return;
  
  logger.debug(`Resource mode manually set to ${newResourceLevel}`);
  currentResourceLevel = newResourceLevel;
  
  // Re-apply font scaling with new resource constraints
  if (currentScalingLevel !== DEFAULT_SCALING_LEVEL) {
    applyFontScaling(currentScalingLevel);
  }
}

/**
 * Create style element for dynamic CSS
 * @private
 */
function createStyleElement() {
  // Check if it already exists
  styleElement = document.getElementById('alejo-font-scaling-style');
  if (styleElement) return;
  
  // Create new style element
  styleElement = document.createElement('style');
  styleElement.id = 'alejo-font-scaling-style';
  styleElement.setAttribute('data-generated', 'alejo-accessibility');
  document.head.appendChild(styleElement);
}

/**
 * Register keyboard shortcuts for font scaling
 * @private
 */
function registerKeyboardShortcuts() {
  // Prevent duplicate event listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts for font scaling
 * @private
 * @param {KeyboardEvent} event Keyboard event
 */
function handleKeyboardShortcuts(event) {
  // Handle Alt+Shift shortcuts for font scaling
  if (event.altKey && event.shiftKey) {
    switch (event.key) {
      case '+': // Increase font size
      case '=': // Alternative key for increase (without shift)
        increaseFontScaling();
        event.preventDefault();
        break;
        
      case '-': // Decrease font size
      case '_': // Alternative key for decrease (with shift)
        decreaseFontScaling();
        event.preventDefault();
        break;
        
      case '0': // Reset to default
        resetFontScaling();
        event.preventDefault();
        break;
        
      case 'F': // Toggle font scaling
      case 'f': 
        toggleFontScaling();
        event.preventDefault();
        break;
    }
  }
  
  // Handle Alt shortcuts (without Shift) for quick font size changes
  if (event.altKey && !event.shiftKey && !event.ctrlKey) {
    // Number keys 1-6 for direct preset selection
    const presetKeys = ['1', '2', '3', '4', '5', '6'];
    const presetLevels = Object.keys(SCALING_PRESETS).map(Number).sort((a, b) => a - b);
    
    const keyIndex = presetKeys.indexOf(event.key);
    if (keyIndex !== -1 && keyIndex < presetLevels.length) {
      setFontScaling(presetLevels[keyIndex]);
      event.preventDefault();
    }
  }
}

/**
 * Apply font scaling to the UI
 * 
 * @private
 * @param {number} level Scaling level (1 = 100%)
 * @param {Object} [options={}] Additional options
 * @param {boolean} [options.announceChanges=true] Whether to announce changes to screen readers
 */
function applyFontScaling(level, options = {}) {
  try {
    const { announceChanges = true } = options;
    
    // Skip if the level is invalid
    if (!isValidScalingLevel(level)) {
      errorHandler.warn(`Attempted to apply invalid font scaling level: ${level}`);
      return;
    }
    
    // Update the HTML class
    if (level !== 1) {
      document.documentElement.classList.add(FONT_SCALING_CLASS);
    } else {
      document.documentElement.classList.remove(FONT_SCALING_CLASS);
    }
    
    // Calculate pixel size
    const pixelSize = Math.round(BASE_FONT_SIZE * level);
    
    // Get optimization settings based on resource level
    const optimizations = RESOURCE_OPTIMIZATION_LEVELS[currentResourceLevel];
    
    // Build CSS content with resource-aware optimizations
    let cssContent = `
      /* Base font size - applied to html element */
      html.${FONT_SCALING_CLASS} {
        font-size: ${pixelSize}px;
      }
      
      /* Ensure rem-based elements scale properly */
      html.${FONT_SCALING_CLASS} body {
        /* Maintain body font size relationship with html */
        font-size: 1rem;
      }
      
      /* Preserve size for excluded elements */
      html.${FONT_SCALING_CLASS} ${EXCLUDED_ELEMENTS} {
        font-size: calc(${1/level}rem);
      }
    `;
    
    // Only include complex selectors if enabled (based on resource level)
    if (optimizations.complexSelectorsEnabled) {
      cssContent += `
        /* Fix potential layout issues with scaled fonts */
        html.${FONT_SCALING_CLASS} .alejo-layout-fix {
          /* Add appropriate fixes based on scaling level */
          ${level > 1.3 ? 'max-width: 100%; overflow-wrap: break-word;' : ''}
        }
        
        /* Adjust button padding for better proportions */
        html.${FONT_SCALING_CLASS} button, 
        html.${FONT_SCALING_CLASS} .button {
          padding: calc(0.375em * ${Math.min(level, 1.3)}) calc(0.75em * ${Math.min(level, 1.2)});
        }
        
        /* Adjust form controls */
        html.${FONT_SCALING_CLASS} input,
        html.${FONT_SCALING_CLASS} select,
        html.${FONT_SCALING_CLASS} textarea {
          padding: calc(0.375em * ${Math.min(level, 1.2)});
        }
      `;
    }
    
    // Only include enhanced layout adjustments if in high resource mode
    if (optimizations.complexSelectorsEnabled && level > 1.3) {
      cssContent += `
        /* Adjust spacing for better readability with larger fonts */
        html.${FONT_SCALING_CLASS} p,
        html.${FONT_SCALING_CLASS} li,
        html.${FONT_SCALING_CLASS} .text-content {
          line-height: 1.6;
          margin-bottom: 1.2em;
        }
        
        html.${FONT_SCALING_CLASS} h1, 
        html.${FONT_SCALING_CLASS} h2, 
        html.${FONT_SCALING_CLASS} h3, 
        html.${FONT_SCALING_CLASS} h4, 
        html.${FONT_SCALING_CLASS} h5, 
        html.${FONT_SCALING_CLASS} h6 {
          margin-top: 1.5em;
          margin-bottom: 0.8em;
        }
      `;
    }
    
    // Only include transitions if enabled (based on resource level)
    if (optimizations.transitionsEnabled) {
      cssContent += `
        /* Smooth transitions for font size changes */
        html.${FONT_SCALING_CLASS} {
          transition: font-size 0.2s ease-out;
        }
        
        html.${FONT_SCALING_CLASS} * {
          transition: font-size 0.2s ease-out;
        }
      `;
    }
    
    // Update style element
    styleElement.textContent = cssContent;
    
    // Update ARIA properties
    ariaManager.updateProperty('fontScale', level);
    
    // Find preset name for current level or show percentage
    let levelName = SCALING_PRESETS[level] || `${Math.round(level * 100)}%`;
    
    // Announce to screen readers if enabled
    if (announceChanges) {
      const resourceMode = currentResourceLevel !== 'high' ? 
        ` (${currentResourceLevel} resource mode)` : '';
      
      ariaManager.announce(
        `Font size set to ${levelName}${resourceMode}`,
        level > 1 ? 'assertive' : 'polite'
      );
    }
    
    // Emit event for any component that needs to adjust layout
    eventEmitter.emit('layout:adjust-for-font-scaling', { 
      level,
      resourceLevel: currentResourceLevel 
    });
    
    // Log for debugging
    logger.debug(`Applied font scaling: ${level} (${levelName}) with resource level: ${currentResourceLevel}`);
  } catch (error) {
    errorHandler.warn('Error applying font scaling', error);
  }
}

/**
 * Check if a scaling level is valid
 * 
 * @private
 * @param {number} level Scaling level to check
 * @returns {boolean} Whether the level is valid
 */
function isValidScalingLevel(level) {
  return !isNaN(level) && level >= 0.75 && level <= 2;
}

/**
 * Get the next scaling level up or down
 * 
 * @private
 * @param {number} current Current scaling level
 * @param {boolean} increase Whether to increase or decrease
 * @returns {number} Next scaling level
 */
function getNextScalingLevel(current, increase) {
  // Get sorted scaling levels from presets
  const levels = Object.keys(SCALING_PRESETS)
    .map(Number)
    .sort((a, b) => a - b);
  
  if (increase) {
    // Find next level up
    for (const level of levels) {
      if (level > current + 0.001) { // Adding a small epsilon for floating-point comparison
        return level;
      }
    }
    // If current is already at or beyond the highest preset, increase by 10%
    return Math.min(2, current + 0.1);
  } else {
    // Find next level down
    for (const level of [...levels].reverse()) {
      if (level < current - 0.001) { // Subtracting a small epsilon for floating-point comparison
        return level;
      }
    }
    // If current is already at or below the lowest preset, decrease by 10%
    return Math.max(0.75, current - 0.1);
  }
}

/**
 * Set font scaling to a specific level
 * 
 * @param {number} level Scaling level (1 = 100%)
 * @param {Object} [options={}] Additional options
 * @param {boolean} [options.announceChanges=true] Whether to announce changes to screen readers
 * @param {boolean} [options.userInitiated=true] Whether the change was initiated by the user
 * @returns {number} Applied scaling level
 */
function setFontScaling(level, options = {}) {
  try {
    const { announceChanges = true, userInitiated = true } = options;
    
    // Validate level
    if (!isValidScalingLevel(level)) {
      level = DEFAULT_SCALING_LEVEL;
      logger.warn(`Invalid font scaling level: ${level}, using default`);
    }
    
    // Skip if no change
    if (level === currentScalingLevel) return currentScalingLevel;
    
    // Update state
    currentScalingLevel = level;
    
    // Apply changes
    applyFontScaling(level, { announceChanges });
    
    // Save preferences
    saveUserPreferences().catch(error => {
      errorHandler.warn('Failed to save font scaling preferences', error);
    });
    
    // Update adaptive feature manager status
    adaptiveFeatureManager.updateFeatureStatus('fontScaling', {
      enabled: level !== DEFAULT_SCALING_LEVEL,
      resourceImpact: calculateResourceImpact(level)
    });
    
    // Emit event
    eventEmitter.emit('accessibility:font-scaling:changed', { 
      level,
      resourceLevel: currentResourceLevel,
      userInitiated
    });
    
    // Log change
    auditTrail.log('accessibility', 'Font scaling changed', {
      level,
      resourceLevel: currentResourceLevel,
      userInitiated
    });
    
    return level;
  } catch (error) {
    errorHandler.error('Error setting font scaling level', error);
    return currentScalingLevel;
  }
}

/**
 * Apply font scaling to a specific element
 * 
 * @param {HTMLElement|string} element Element or selector to apply font scaling to
 * @param {number} [level] Scaling level (defaults to current global level)
 * @param {Object} [options={}] Additional options
 * @param {boolean} [options.persistent=false] Whether to persist the scaling across page reloads
 * @param {boolean} [options.applyToChildren=true] Whether to apply scaling to child elements
 * @returns {boolean} Success status
 */
function applyFontScalingToElement(element, level, options = {}) {
  try {
    // Process arguments
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    
    if (!element || !(element instanceof HTMLElement)) {
      errorHandler.warn('Invalid element for font scaling');
      return false;
    }
    
    if (level === undefined) {
      level = currentScalingLevel;
    } else if (!isValidScalingLevel(level)) {
      errorHandler.warn(`Invalid font scaling level: ${level} for element`);
      return false;
    }
    
    const { persistent = false, applyToChildren = true } = options;
    
    // Calculate font size
    const pixelSize = Math.round(BASE_FONT_SIZE * level);
    const remSize = level.toFixed(2) + 'rem';
    
    // Apply styling
    element.style.fontSize = remSize;
    
    // Add a data attribute for tracking
    element.setAttribute('data-alejo-font-scaled', level.toString());
    
    // If not applying to children, prevent inheritance
    if (!applyToChildren) {
      // Add a class to all direct children to reset their font size
      Array.from(element.children).forEach(child => {
        child.classList.add('preserve-font-size');
      });
    }
    
    // Store the setting if persistent
    if (persistent) {
      // Get existing persistent elements
      configManager.get('accessibility.fontScaling.elements')
        .then(elements => {
          const persistentElements = elements || {};
          const elementId = element.id || generateElementId(element);
          
          // If no ID, generate one and set it
          if (!element.id) {
            element.id = elementId;
          }
          
          // Store the settings
          persistentElements[elementId] = {
            level,
            applyToChildren,
            selector: getElementSelector(element)
          };
          
          return configManager.set('accessibility.fontScaling.elements', persistentElements);
        })
        .catch(error => {
          errorHandler.warn('Failed to save persistent element font scaling', error);
        });
    }
    
    logger.debug(
      `Applied font scaling of ${level} to element ${element.tagName}${element.id ? '#' + element.id : ''}`
    );
    
    return true;
  } catch (error) {
    errorHandler.warn('Error applying font scaling to element', error);
    return false;
  }
}

/**
 * Generate a unique ID for an element
 * 
 * @private
 * @param {HTMLElement} element Element to generate ID for
 * @returns {string} Generated ID
 */
function generateElementId(element) {
  const prefix = 'alejo-font-scaled-';
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return prefix + timestamp + '-' + random;
}

/**
 * Get a CSS selector for an element
 * 
 * @private
 * @param {HTMLElement} element Element to get selector for
 * @returns {string} CSS selector
 */
function getElementSelector(element) {
  if (element.id) {
    return '#' + element.id;
  }
  
  // Simple path for common cases
  const tagName = element.tagName.toLowerCase();
  if (element.className) {
    const className = element.className.split(' ')[0];
    return tagName + '.' + className;
  }
  
  // Fallback to a basic tag selector with nth-child
  if (element.parentElement) {
    const index = Array.from(element.parentElement.children)
      .filter(child => child.tagName === element.tagName)
      .indexOf(element) + 1;
    
    return tagName + `:nth-of-type(${index})`;
  }
  
  return tagName;
}

/**
 * Increase font scaling to the next preset level
 * 
 * @returns {number} New scaling level
 */
function increaseFontScaling() {
  const nextLevel = getNextScalingLevel(currentScalingLevel, true);
  return setFontScaling(nextLevel);
}

/**
 * Decrease font scaling to the previous preset level
 * 
 * @returns {number} New scaling level
 */
function decreaseFontScaling() {
  const nextLevel = getNextScalingLevel(currentScalingLevel, false);
  return setFontScaling(nextLevel);
}

/**
 * Reset font scaling to the default level
 * 
 * @returns {number} Applied scaling level
 */
function resetFontScaling() {
  return setFontScaling(DEFAULT_SCALING_LEVEL, { userInitiated: true });
}

/**
 * Toggle font scaling on/off
 * 
 * @returns {boolean} New state (true if enabled, false if disabled)
 */
function toggleFontScaling() {
  try {
    const isEnabled = currentScalingLevel !== DEFAULT_SCALING_LEVEL;
    const newLevel = isEnabled ? DEFAULT_SCALING_LEVEL : lastNonDefaultScalingLevel || SCALING_PRESETS.large;
    
    setFontScaling(newLevel, { userInitiated: true });
    
    // Update last non-default level for future toggling
    if (newLevel !== DEFAULT_SCALING_LEVEL) {
      lastNonDefaultScalingLevel = newLevel;
    }
    
    const newState = newLevel !== DEFAULT_SCALING_LEVEL;
    eventEmitter.emit('accessibility:font-scaling:toggled', { enabled: newState });
    
    return newState;
  } catch (error) {
    errorHandler.error('Error toggling font scaling', error);
    return currentScalingLevel !== DEFAULT_SCALING_LEVEL;
  }
}

/**
 * Calculate the resource impact of a given scaling level
 * 
 * @private
 * @param {number} level Scaling level
 * @returns {string} Resource impact level ('low', 'medium', or 'high')
 */
function calculateResourceImpact(level) {
  if (level === DEFAULT_SCALING_LEVEL) {
    return 'none';
  } else if (level < 1.5) {
    return 'low';
  } else if (level < 2) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Get current font scaling level
 * 
 * @returns {number} Current scaling level
 */
function getCurrentScalingLevel() {
  return currentScalingLevel;
}

/**
 * Get all available font scaling presets
 * 
 * @returns {Object} Mapping of scaling levels to display names
 */
function getScalingPresets() {
  return { ...SCALING_PRESETS };
}

/**
 * Restore persistent element-specific font scaling settings
 * 
 * @returns {Promise<boolean>} Success status
 */
async function restorePersistentElementScaling() {
  try {
    // Get stored element settings
    const persistentElements = await configManager.get('accessibility.fontScaling.elements') || {};
    if (!Object.keys(persistentElements).length) {
      logger.debug('No persistent element font scaling settings found');
      return true;
    }
    
    logger.info(`Restoring font scaling for ${Object.keys(persistentElements).length} elements`);
    
    // Process each stored element
    let restoreCount = 0;
    for (const [elementId, settings] of Object.entries(persistentElements)) {
      try {
        // Try to find the element by ID first, then by selector
        let element = document.getElementById(elementId);
        if (!element && settings.selector) {
          element = document.querySelector(settings.selector);
        }
        
        if (!element) {
          logger.debug(`Element ${elementId} not found for font scaling restoration`);
          continue;
        }
        
        // Apply the stored font scaling
        const success = applyFontScalingToElement(element, settings.level, {
          applyToChildren: settings.applyToChildren || true,
          persistent: true // Keep it persistent
        });
        
        if (success) {
          restoreCount++;
        }
      } catch (elementError) {
        errorHandler.warn(`Error restoring font scaling for element ${elementId}`, elementError);
      }
    }
    
    logger.info(`Successfully restored font scaling for ${restoreCount} elements`);
    return true;
  } catch (error) {
    errorHandler.error('Failed to restore persistent element font scaling', error);
    return false;
  }
}

/**
 * Clear all element-specific font scaling settings
 * 
 * @returns {Promise<boolean>} Success status
 */
async function clearElementScaling() {
  try {
    // Clear stored settings
    await configManager.set('accessibility.fontScaling.elements', {});
    
    // Remove inline font scaling from elements with data-alejo-font-scaled attribute
    const scaledElements = document.querySelectorAll('[data-alejo-font-scaled]');
    scaledElements.forEach(element => {
      element.style.fontSize = '';
      element.removeAttribute('data-alejo-font-scaled');
      
      // Remove the class from children if it was added
      Array.from(element.querySelectorAll('.preserve-font-size')).forEach(child => {
        child.classList.remove('preserve-font-size');
      });
    });
    
    logger.info(`Cleared font scaling for ${scaledElements.length} elements`);
    return true;
  } catch (error) {
    errorHandler.error('Error clearing element font scaling', error);
    return false;
  }
}

// Export public API
export const fontScalingManager = {
  // Core functionality
  initialize,
  setFontScaling,
  getCurrentScalingLevel,
  getScalingPresets,
  
  // Scaling control
  increaseFontScaling,
  decreaseFontScaling,
  resetFontScaling,
  toggleFontScaling,
  
  // Element-specific scaling
  applyFontScalingToElement,
  restorePersistentElementScaling,
  clearElementScaling
};
