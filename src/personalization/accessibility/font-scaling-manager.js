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

// Configuration constants
const CONFIG_KEY = 'accessibility.fontScaling';
const FONT_SCALING_CLASS = 'alejo-font-scaled';
const BASE_FONT_SIZE = 16; // Browser default in pixels
const DEFAULT_SCALING_LEVEL = 1; // 1 = 100% (normal)

// Font scaling presets (multipliers of base font size)
const SCALING_PRESETS = {
  0.85: 'Small',
  1: 'Normal',
  1.15: 'Medium',
  1.3: 'Large',
  1.5: 'X-Large',
  1.7: 'XX-Large'
};

// CSS selectors for elements to exclude from scaling
const EXCLUDED_ELEMENTS = [
  '.no-font-scaling',
  '[data-no-font-scaling]',
  '.preserve-font-size'
].join(',');

// State
let currentScalingLevel = DEFAULT_SCALING_LEVEL;
let hasInitialized = false;
let styleElement = null;
let configManager = null;
let logger = null;

/**
 * Initialize font scaling management
 * 
 * @param {Object} options Configuration options
 * @param {number} [options.initialLevel] Initial scaling level (1 = 100%)
 * @param {boolean} [options.applyImmediately=true] Whether to apply settings immediately
 * @returns {Promise<boolean>} Success status
 */
async function initialize(options = {}) {
  try {
    if (hasInitialized) return true;
    
    const defaultOptions = {
      initialLevel: DEFAULT_SCALING_LEVEL,
      applyImmediately: true
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Get config manager and logger instances
    configManager = await ConfigManager.getInstance();
    logger = new Logger('FontScalingManager');
    
    // Create style element for dynamic CSS
    createStyleElement();
    
    // Load saved preference
    const savedScaling = await configManager.get(CONFIG_KEY);
    if (savedScaling !== undefined && isValidScalingLevel(savedScaling)) {
      currentScalingLevel = savedScaling;
    } else {
      currentScalingLevel = finalOptions.initialLevel;
    }
    
    // Apply immediately if requested
    if (finalOptions.applyImmediately) {
      applyFontScaling(currentScalingLevel);
    }
    
    // Set up event listeners
    eventEmitter.on('accessibility:font-scaling:set', setFontScaling);
    eventEmitter.on('accessibility:font-scaling:increase', increaseFontScaling);
    eventEmitter.on('accessibility:font-scaling:decrease', decreaseFontScaling);
    eventEmitter.on('accessibility:font-scaling:reset', resetFontScaling);
    
    // Register keyboard shortcuts
    registerKeyboardShortcuts();
    
    // Log initialization
    auditTrail.log('accessibility', 'Font scaling manager initialized', {
      initialLevel: currentScalingLevel
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
  // Only handle keyboard shortcuts with Alt+Shift
  if (!event.altKey || !event.shiftKey) return;
  
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
  }
}

/**
 * Apply font scaling to the UI
 * 
 * @private
 * @param {number} level Scaling level (1 = 100%)
 */
function applyFontScaling(level) {
  // Update the HTML class
  if (level !== 1) {
    document.documentElement.classList.add(FONT_SCALING_CLASS);
  } else {
    document.documentElement.classList.remove(FONT_SCALING_CLASS);
  }
  
  // Calculate pixel size
  const pixelSize = Math.round(BASE_FONT_SIZE * level);
  
  // Build CSS content
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
    
    /* Adjust spacing for better readability with larger fonts */
    ${level > 1.3 ? `
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
    ` : ''}
  `;
  
  // Update style element
  styleElement.textContent = cssContent;
  
  // Update ARIA properties
  ariaManager.updateProperty('fontScale', level);
  
  // Find preset name for current level or show percentage
  let levelName = SCALING_PRESETS[level] || `${Math.round(level * 100)}%`;
  
  // Announce to screen readers
  ariaManager.announce(`Font size set to ${levelName}`);
  
  // Emit event for any component that needs to adjust layout
  eventEmitter.emit('layout:adjust-for-font-scaling', { level });
  
  // Log for debugging
  logger.debug(`Applied font scaling: ${level} (${levelName})`);
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
 * @returns {number} Applied scaling level
 */
function setFontScaling(level) {
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
  applyFontScaling(level);
  
  // Save preference
  configManager.set(CONFIG_KEY, level);
  
  // Emit event
  eventEmitter.emit('accessibility:font-scaling:changed', { level });
  
  // Log change
  auditTrail.log('accessibility', 'Font scaling changed', {
    level,
    userInitiated: true
  });
  
  return level;
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
 * Reset font scaling to default
 * 
 * @returns {number} Default scaling level
 */
function resetFontScaling() {
  return setFontScaling(DEFAULT_SCALING_LEVEL);
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

// Export public API
export const fontScalingManager = {
  initialize,
  setFontScaling,
  increaseFontScaling,
  decreaseFontScaling,
  resetFontScaling,
  getCurrentScalingLevel,
  getScalingPresets
};
