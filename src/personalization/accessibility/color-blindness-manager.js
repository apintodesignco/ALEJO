/**
 * ALEJO Color Blindness Accommodation Manager
 * 
 * This module provides support for users with various color vision deficiencies:
 * - Protanopia (red-blind)
 * - Deuteranopia (green-blind)
 * - Tritanopia (blue-blind)
 * - Achromatopsia (monochromacy)
 * 
 * Features:
 * - Automatic detection of color blindness accessibility preferences
 * - Multiple compensation modes with different levels of adaptation
 * - SVG filters for entire application or specific elements
 * - Enhanced pattern/texture usage in charts and data visualizations
 * - ARIA announcements for state changes
 * - Persistent user preferences
 */

import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';
import { ariaManager } from './aria-manager.js';
import { ConfigManager } from '../../core/config-manager.js';
import { Logger } from '../../core/logger.js';
import { ResourceAllocator, PRIORITY_LEVELS } from '../../core/resource-manager.js';

// Configuration constants
const CONFIG_KEY = 'accessibility.colorBlindnessMode';
const CONFIG_STRENGTH_KEY = 'accessibility.colorBlindnessStrength';
const COLOR_BLINDNESS_CLASS = 'alejo-color-blindness-adjusted';

// Color blindness types
const COLOR_BLINDNESS_MODES = {
  NONE: 'none',
  PROTANOPIA: 'protanopia', // Red-blind
  DEUTERANOPIA: 'deuteranopia', // Green-blind
  TRITANOPIA: 'tritanopia', // Blue-blind
  ACHROMATOPSIA: 'achromatopsia' // Complete color blindness (monochromacy)
};

// Enhancement strength levels
const STRENGTH_LEVELS = {
  SUBTLE: 0.3,
  MODERATE: 0.6,
  STRONG: 0.9,
  MAXIMUM: 1.0
};

// Component IDs for resource management
const COMPONENT_ID = 'accessibility-color-blindness-manager';

// State
let currentMode = COLOR_BLINDNESS_MODES.NONE;
let currentStrength = STRENGTH_LEVELS.MODERATE;
let hasInitialized = false;
let svgFilterElement = null;
let configManager = null;
let logger = null;
let isRegisteredWithResourceManager = false;

/**
 * Initialize color blindness accommodation
 * 
 * @param {Object} options Configuration options
 * @param {boolean} [options.detectSystemPreference=true] Whether to detect system preference
 * @param {boolean} [options.applyImmediately=true] Whether to apply settings immediately
 * @returns {Promise<boolean>} Success status
 */
async function initialize(options = {}) {
  try {
    if (hasInitialized) return true;
    
    const defaultOptions = {
      detectSystemPreference: true,
      applyImmediately: true
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Get config manager and logger instances
    configManager = await ConfigManager.getInstance();
    logger = new Logger('ColorBlindnessManager');
    
    // Create SVG filter container for applying color adjustments
    createSvgFilterContainer();
    
    // Load saved preferences
    const savedMode = await configManager.get(CONFIG_KEY);
    if (savedMode && Object.values(COLOR_BLINDNESS_MODES).includes(savedMode)) {
      currentMode = savedMode;
    }
    
    const savedStrength = await configManager.get(CONFIG_STRENGTH_KEY);
    if (savedStrength !== undefined && savedStrength >= 0 && savedStrength <= 1) {
      currentStrength = savedStrength;
    }
    
    // Detect system preference if enabled
    if (finalOptions.detectSystemPreference) {
      detectColorBlindnessPreference();
    }
    
    // Apply immediately if requested
    if (finalOptions.applyImmediately) {
      applyColorBlindnessMode(currentMode, currentStrength);
    }
    
    // Set up event listeners
    eventEmitter.on('accessibility:color-blindness:set-mode', setColorBlindnessMode);
    eventEmitter.on('accessibility:color-blindness:set-strength', setColorBlindnessStrength);
    eventEmitter.on('accessibility:color-blindness:toggle', toggleColorBlindnessMode);
    
    // Register keyboard shortcuts
    registerKeyboardShortcuts();
    
    // Register with resource manager
    registerWithResourceManager();
    
    // Log initialization
    auditTrail.log('accessibility', 'Color blindness manager initialized', {
      initialMode: currentMode,
      strength: currentStrength
    });
    
    hasInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize color blindness manager:', error);
    auditTrail.log('error', 'Failed to initialize color blindness manager', {
      error: error.message
    });
    return false;
  }
}

/**
 * Register with the resource manager
 */
function registerWithResourceManager() {
  if (isRegisteredWithResourceManager) return;
  
  try {
    if (!ResourceAllocator) {
      logger.warn('Resource Allocator not available, skipping registration');
      return;
    }
    
    ResourceAllocator.registerComponent({
      id: COMPONENT_ID,
      priority: PRIORITY_LEVELS.ACCESSIBILITY_ESSENTIAL,
      onResourceModeChanged: handleResourceModeChange
    });
    
    isRegisteredWithResourceManager = true;
    logger.debug('Registered with Resource Allocator');
  } catch (error) {
    logger.error('Failed to register with Resource Allocator', error);
  }
}

/**
 * Unregister from the resource manager
 */
function unregisterFromResourceManager() {
  if (!isRegisteredWithResourceManager) return;
  
  try {
    if (!ResourceAllocator) {
      logger.warn('Resource Allocator not available, skipping unregistration');
      return;
    }
    
    ResourceAllocator.unregisterComponent(COMPONENT_ID);
    isRegisteredWithResourceManager = false;
    logger.debug('Unregistered from Resource Allocator');
  } catch (error) {
    logger.error('Failed to unregister from Resource Allocator', error);
  }
}

/**
 * Handle resource mode changes
 * @param {string} mode The new resource mode
 */
function handleResourceModeChange(mode) {
  logger.debug(`Resource mode changed to: ${mode}`);
  
  // Adapt color compensation strength based on resource mode
  if (currentMode !== COLOR_BLINDNESS_MODES.NONE) {
    let adjustedStrength = currentStrength;
    
    switch (mode) {
      case 'LOW':
        // Maintain full strength since this is an accessibility feature
        adjustedStrength = currentStrength;
        break;
        
      case 'VERY_LOW':
        // Slightly reduce visual effects in extremely constrained environments
        adjustedStrength = Math.min(0.7, currentStrength);
        break;
        
      default:
        // Normal operation
        adjustedStrength = currentStrength;
    }
    
    // Only reapply if strength actually changed
    if (adjustedStrength !== currentStrength) {
      applyColorBlindnessMode(currentMode, adjustedStrength, false);
    }
  }
}

/**
 * Create the SVG filter container
 * @private
 */
function createSvgFilterContainer() {
  // Check if it already exists
  svgFilterElement = document.getElementById('alejo-color-blindness-filters');
  if (svgFilterElement) return;
  
  // Create SVG element with filter definitions
  svgFilterElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgFilterElement.id = 'alejo-color-blindness-filters';
  svgFilterElement.setAttribute('aria-hidden', 'true');
  svgFilterElement.style.width = '0';
  svgFilterElement.style.height = '0';
  svgFilterElement.style.position = 'absolute';
  svgFilterElement.style.pointerEvents = 'none';
  svgFilterElement.innerHTML = `
    <defs>
      <!-- Protanopia (red-blind) Filter -->
      <filter id="alejo-protanopia-filter">
        <feColorMatrix type="matrix" values="
          0.567, 0.433, 0,     0, 0
          0.558, 0.442, 0,     0, 0
          0,     0.242, 0.758, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
      
      <!-- Deuteranopia (green-blind) Filter -->
      <filter id="alejo-deuteranopia-filter">
        <feColorMatrix type="matrix" values="
          0.625, 0.375, 0,   0, 0
          0.7,   0.3,   0,   0, 0
          0,     0.3,   0.7, 0, 0
          0,     0,     0,   1, 0
        "/>
      </filter>
      
      <!-- Tritanopia (blue-blind) Filter -->
      <filter id="alejo-tritanopia-filter">
        <feColorMatrix type="matrix" values="
          0.95, 0.05,  0,     0, 0
          0,    0.433, 0.567, 0, 0
          0,    0.475, 0.525, 0, 0
          0,    0,     0,     1, 0
        "/>
      </filter>
      
      <!-- Achromatopsia (monochromacy) Filter -->
      <filter id="alejo-achromatopsia-filter">
        <feColorMatrix type="matrix" values="
          0.299, 0.587, 0.114, 0, 0
          0.299, 0.587, 0.114, 0, 0
          0.299, 0.587, 0.114, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
      
      <!-- Enhancement Filters -->
      <filter id="alejo-color-enhance-filter">
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude="1" exponent="0.9"/>
          <feFuncG type="gamma" amplitude="1.1" exponent="0.9"/>
          <feFuncB type="gamma" amplitude="1" exponent="0.9"/>
        </feComponentTransfer>
        <feColorMatrix type="matrix" values="
          1.1, -0.1, 0,    0, 0
          0,    1.1, -0.1, 0, 0
          0,    0,    1.1, 0, 0
          0,    0,    0,   1, 0
        "/>
      </filter>
    </defs>
  `;
  
  document.body.appendChild(svgFilterElement);
}

/**
 * Register keyboard shortcuts for color blindness mode
 * @private
 */
function registerKeyboardShortcuts() {
  // Prevent duplicate event listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts for color blindness mode
 * @private
 * @param {KeyboardEvent} event Keyboard event
 */
function handleKeyboardShortcuts(event) {
  // Only handle keyboard shortcuts with Alt+Shift+C
  if (!event.altKey || !event.shiftKey || event.key !== 'c') return;
  
  toggleColorBlindnessMode();
  event.preventDefault();
}

/**
 * Detect color blindness preferences from system settings
 * This is a best-effort attempt as not all browsers/OSes expose this
 * @private
 */
function detectColorBlindnessPreference() {
  try {
    // Check for prefers-contrast media query (not perfect but may indicate accessibility needs)
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      logger.debug('System prefers higher contrast, color blindness mode may be beneficial');
      // We don't automatically enable, but log this information
    }
    
    // In the future, browsers may add direct color blindness detection
    // This is a placeholder for when such APIs become available
    
    // For now, we mainly rely on user settings
    
  } catch (error) {
    logger.warn('Error detecting color blindness preference', error);
  }
}

/**
 * Apply color blindness mode to the UI
 * 
 * @private
 * @param {string} mode Color blindness mode to apply
 * @param {number} strength Strength of the filter (0-1)
 * @param {boolean} [updateUI=true] Whether to update UI components
 */
function applyColorBlindnessMode(mode, strength = currentStrength, updateUI = true) {
  // Clean up any existing class
  document.documentElement.classList.remove(COLOR_BLINDNESS_CLASS);
  
  // Reset inline style
  document.documentElement.style.removeProperty('filter');
  
  // If mode is NONE, we're done
  if (mode === COLOR_BLINDNESS_MODES.NONE) {
    if (updateUI) {
      // Remove focus outlines and other accessibility indicators
      document.documentElement.classList.remove('alejo-enhanced-focus');
      updateDataVisualizations(false);
    }
    return;
  }
  
  // Add class for CSS targeting
  document.documentElement.classList.add(COLOR_BLINDNESS_CLASS);
  
  // Add enhanced focus outlines to improve UI clarity
  document.documentElement.classList.add('alejo-enhanced-focus');
  
  // Apply SVG filter based on mode
  let filterValue = '';
  
  switch (mode) {
    case COLOR_BLINDNESS_MODES.PROTANOPIA:
      filterValue = 'url(#alejo-protanopia-filter)';
      break;
      
    case COLOR_BLINDNESS_MODES.DEUTERANOPIA:
      filterValue = 'url(#alejo-deuteranopia-filter)';
      break;
      
    case COLOR_BLINDNESS_MODES.TRITANOPIA:
      filterValue = 'url(#alejo-tritanopia-filter)';
      break;
      
    case COLOR_BLINDNESS_MODES.ACHROMATOPSIA:
      filterValue = 'url(#alejo-achromatopsia-filter)';
      break;
      
    default:
      // Do nothing for unknown modes
      return;
  }
  
  // Apply the filter at the requested strength
  if (strength < 1) {
    // For partial strength, we use a CSS blend
    // To do this, we create a custom inline style
    document.documentElement.style.filter = filterValue;
    document.documentElement.style.opacity = 1; // Reset opacity
    
    // Apply filter with strength (using CSS variables for better performance)
    document.documentElement.style.setProperty('--color-blindness-strength', strength);
    document.documentElement.style.setProperty('--color-blindness-filter', filterValue);
  } else {
    // Full strength is simpler
    document.documentElement.style.filter = filterValue;
  }
  
  // Update data visualizations if requested
  if (updateUI) {
    updateDataVisualizations(true, mode);
  }
}

/**
 * Update data visualizations across the application
 * 
 * @private
 * @param {boolean} enhanceVisualizations Whether to enhance visualizations
 * @param {string} [mode] Current color blindness mode
 */
function updateDataVisualizations(enhanceVisualizations, mode = currentMode) {
  if (enhanceVisualizations) {
    // Emit an event for visualizations to adapt
    eventEmitter.emit('visualizations:adapt-for-color-blindness', { 
      mode, 
      enhancePatterns: true,
      enhanceLabels: true
    });
  } else {
    // Reset visualizations
    eventEmitter.emit('visualizations:reset-color-adaptations');
  }
}

/**
 * Set color blindness mode
 * 
 * @param {string} mode Color blindness mode to set
 * @param {number} [strength] Optional strength value (0-1)
 * @returns {string} Applied mode
 */
function setColorBlindnessMode(mode, strength = undefined) {
  // Validate mode
  if (!Object.values(COLOR_BLINDNESS_MODES).includes(mode)) {
    mode = COLOR_BLINDNESS_MODES.NONE;
    logger.warn(`Invalid color blindness mode: ${mode}, using default`);
  }
  
  // Use provided strength or keep current
  const targetStrength = (strength !== undefined) ? 
    Math.max(0, Math.min(1, strength)) : currentStrength;
  
  // Skip if no change
  if (mode === currentMode && targetStrength === currentStrength) return currentMode;
  
  // Update state
  const previousMode = currentMode;
  currentMode = mode;
  currentStrength = targetStrength;
  
  // Apply changes
  applyColorBlindnessMode(mode, currentStrength);
  
  // Save preference
  configManager.set(CONFIG_KEY, mode);
  configManager.set(CONFIG_STRENGTH_KEY, currentStrength);
  
  // Emit event
  eventEmitter.emit('accessibility:color-blindness:changed', { 
    mode, 
    strength: currentStrength,
    previousMode
  });
  
  // Find display name for mode
  const modeName = getModeDisplayName(mode);
  
  // Announce to screen readers
  if (mode === COLOR_BLINDNESS_MODES.NONE) {
    ariaManager.announce(`Color blindness accommodations turned off`);
  } else {
    ariaManager.announce(`Color blindness mode set to ${modeName} at ${Math.round(currentStrength * 100)}% strength`);
  }
  
  // Log change
  auditTrail.log('accessibility', 'Color blindness mode changed', {
    mode,
    strength: currentStrength,
    previousMode,
    userInitiated: true
  });
  
  return mode;
}

/**
 * Set color blindness filter strength
 * 
 * @param {number} strength Strength value (0-1)
 * @returns {number} Applied strength
 */
function setColorBlindnessStrength(strength) {
  // Validate strength
  strength = Math.max(0, Math.min(1, strength));
  
  // Skip if no change or no active mode
  if (strength === currentStrength || currentMode === COLOR_BLINDNESS_MODES.NONE) return currentStrength;
  
  // Update state
  currentStrength = strength;
  
  // Apply changes
  applyColorBlindnessMode(currentMode, currentStrength);
  
  // Save preference
  configManager.set(CONFIG_STRENGTH_KEY, currentStrength);
  
  // Emit event
  eventEmitter.emit('accessibility:color-blindness:strength-changed', { 
    strength: currentStrength,
    mode: currentMode
  });
  
  // Announce to screen readers
  ariaManager.announce(`Color blindness filter strength set to ${Math.round(currentStrength * 100)}%`);
  
  // Log change
  auditTrail.log('accessibility', 'Color blindness strength changed', {
    strength: currentStrength,
    mode: currentMode,
    userInitiated: true
  });
  
  return currentStrength;
}

/**
 * Toggle through color blindness modes
 * 
 * @returns {string} New mode
 */
function toggleColorBlindnessMode() {
  const modes = Object.values(COLOR_BLINDNESS_MODES);
  const currentIndex = modes.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  return setColorBlindnessMode(modes[nextIndex]);
}

/**
 * Get the display name for a mode
 * 
 * @param {string} mode Mode to get display name for
 * @returns {string} Display name
 */
function getModeDisplayName(mode) {
  switch (mode) {
    case COLOR_BLINDNESS_MODES.PROTANOPIA:
      return 'Protanopia (Red-Blind)';
    case COLOR_BLINDNESS_MODES.DEUTERANOPIA:
      return 'Deuteranopia (Green-Blind)';
    case COLOR_BLINDNESS_MODES.TRITANOPIA:
      return 'Tritanopia (Blue-Blind)';
    case COLOR_BLINDNESS_MODES.ACHROMATOPSIA:
      return 'Achromatopsia (Monochromacy)';
    case COLOR_BLINDNESS_MODES.NONE:
      return 'None';
    default:
      return mode;
  }
}

/**
 * Shutdown and cleanup the color blindness manager
 */
async function shutdown() {
  try {
    // Remove event listeners
    eventEmitter.off('accessibility:color-blindness:set-mode', setColorBlindnessMode);
    eventEmitter.off('accessibility:color-blindness:set-strength', setColorBlindnessStrength);
    eventEmitter.off('accessibility:color-blindness:toggle', toggleColorBlindnessMode);
    
    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    
    // Unregister from resource manager
    unregisterFromResourceManager();
    
    // Reset UI
    if (currentMode !== COLOR_BLINDNESS_MODES.NONE) {
      currentMode = COLOR_BLINDNESS_MODES.NONE;
      applyColorBlindnessMode(currentMode);
    }
    
    // Remove SVG filter element
    if (svgFilterElement && svgFilterElement.parentNode) {
      svgFilterElement.parentNode.removeChild(svgFilterElement);
      svgFilterElement = null;
    }
    
    hasInitialized = false;
    logger.debug('Color blindness manager shutdown complete');
    
    return true;
  } catch (error) {
    logger.error('Error during color blindness manager shutdown', error);
    return false;
  }
}

/**
 * Get current color blindness mode
 * 
 * @returns {string} Current mode
 */
function getCurrentMode() {
  return currentMode;
}

/**
 * Get current strength level
 * 
 * @returns {number} Current strength (0-1)
 */
function getCurrentStrength() {
  return currentStrength;
}

/**
 * Check if color blindness mode is active
 * 
 * @returns {boolean} Whether a color blindness mode is active
 */
function isColorBlindnessModeActive() {
  return currentMode !== COLOR_BLINDNESS_MODES.NONE;
}

/**
 * Get all available color blindness modes
 * 
 * @returns {Object} Mapping of mode constants
 */
function getAvailableModes() {
  return { ...COLOR_BLINDNESS_MODES };
}

/**
 * Get preset strength levels
 * 
 * @returns {Object} Mapping of strength level constants
 */
function getStrengthPresets() {
  return { ...STRENGTH_LEVELS };
}

// Export public API
export const colorBlindnessManager = {
  initialize,
  shutdown,
  setColorBlindnessMode,
  setColorBlindnessStrength,
  toggleColorBlindnessMode,
  getCurrentMode,
  getCurrentStrength,
  isColorBlindnessModeActive,
  getAvailableModes,
  getStrengthPresets,
  COLOR_BLINDNESS_MODES,
  STRENGTH_LEVELS
};
