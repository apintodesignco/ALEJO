/**
 * @file font-scaling.js
 * @description Font scaling implementation for visual accessibility
 * @module accessibility/font-scaling
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';

// Initialize logger
const logger = new Logger('FontScaling');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;
let _currentLevel = 1;
let _styleElement = null;
let _originalFontSizes = new Map();

// Default configuration
const DEFAULT_CONFIG = {
  // Whether font scaling is enabled
  enabled: false,
  // Default scaling level (1 = normal size)
  defaultLevel: 1,
  // Scaling levels
  levels: {
    0.85: 'Smaller',
    1: 'Normal',
    1.15: 'Medium',
    1.3: 'Large',
    1.5: 'X-Large',
    1.75: 'XX-Large'
  },
  // Elements to exclude from scaling (selectors)
  excludeSelectors: [
    '.no-font-scaling',
    '.icon',
    'i.fa',
    'i.material-icons',
    'svg'
  ],
  // Whether to respect user's browser font size settings
  respectBrowserSettings: true,
  // Minimum font size in pixels
  minFontSize: 12,
  // Whether to adjust line height proportionally
  adjustLineHeight: true,
  // Whether to adjust spacing proportionally
  adjustSpacing: true
};

/**
 * Initialize font scaling
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Font scaling already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing font scaling');
    
    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility.fontScaling');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    
    // Create style element
    _styleElement = document.createElement('style');
    _styleElement.id = 'font-scaling-styles';
    document.head.appendChild(_styleElement);
    
    // Store original font sizes
    captureOriginalFontSizes();
    
    // Set initial state
    _enabled = _config.enabled;
    _currentLevel = _config.defaultLevel;
    
    // Apply font scaling if enabled
    if (_enabled) {
      applyFontScaling(_currentLevel);
    }
    
    // Add class to body for CSS targeting
    document.body.classList.add('font-scaling-initialized');
    
    // Set up event listeners
    setupEventListeners();
    
    _initialized = true;
    
    EventBus.publish('accessibility:fontScalingInitialized', { 
      enabled: _enabled,
      level: _currentLevel
    });
    
    logger.info('Font scaling initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize font scaling', error);
    return false;
  }
}

/**
 * Enable or disable font scaling
 * @param {boolean} enable - Whether to enable font scaling
 * @param {number} [level] - Scaling level to apply when enabling
 * @returns {boolean} - True if successful
 */
export function setEnabled(enable, level = null) {
  if (!_initialized) {
    return false;
  }
  
  try {
    if (enable) {
      _enabled = true;
      _config.enabled = true;
      
      // Apply font scaling at specified level or current level
      const scaleLevel = level !== null ? level : _currentLevel;
      return applyFontScaling(scaleLevel);
    } else {
      _enabled = false;
      _config.enabled = false;
      return removeFontScaling();
    }
  } catch (error) {
    logger.error(`Error ${enable ? 'enabling' : 'disabling'} font scaling`, error);
    return false;
  }
}

/**
 * Get available font scaling levels
 * @returns {Object} - Object with level values and names
 */
export function getAvailableLevels() {
  if (!_initialized) {
    return {};
  }
  
  return { ..._config.levels };
}

/**
 * Get current font scaling state
 * @returns {Object} - Current state with enabled flag and level
 */
export function getState() {
  return {
    initialized: _initialized,
    enabled: _enabled,
    currentLevel: _currentLevel,
    levelName: _config.levels[_currentLevel] || 'Custom'
  };
}

/**
 * Apply font scaling at a specific level
 * @param {number} level - Scaling level to apply
 * @returns {boolean} - True if successful
 */
export function applyFontScaling(level = 1) {
  if (!_initialized) {
    return false;
  }
  
  try {
    // Check if level is valid
    if (!Object.keys(_config.levels).includes(level.toString())) {
      level = findClosestLevel(level);
      logger.warn(`Invalid font scaling level, using closest match: ${level}`);
    }
    
    // Generate CSS
    const css = generateFontScalingCSS(level);
    
    // Apply CSS
    _styleElement.textContent = css;
    
    // Update body class
    document.body.classList.remove(
      'font-scale-smaller',
      'font-scale-normal',
      'font-scale-medium',
      'font-scale-large',
      'font-scale-xlarge',
      'font-scale-xxlarge'
    );
    
    let className = 'font-scale-normal';
    if (level <= 0.85) className = 'font-scale-smaller';
    else if (level <= 1) className = 'font-scale-normal';
    else if (level <= 1.15) className = 'font-scale-medium';
    else if (level <= 1.3) className = 'font-scale-large';
    else if (level <= 1.5) className = 'font-scale-xlarge';
    else className = 'font-scale-xxlarge';
    
    document.body.classList.add(className);
    document.body.setAttribute('data-font-scale', level);
    
    // Update state
    _enabled = true;
    _currentLevel = level;
    _config.enabled = true;
    _config.defaultLevel = level;
    
    // Save config
    ConfigManager.save('accessibility.fontScaling', _config);
    
    // Publish event
    EventBus.publish('accessibility:fontScalingChanged', { 
      level: level,
      levelName: _config.levels[level] || 'Custom'
    });
    
    logger.info(`Font scaling applied at level: ${level}`);
    
    return true;
  } catch (error) {
    logger.error(`Error applying font scaling at level: ${level}`, error);
    return false;
  }
}

/**
 * Remove font scaling and restore original sizes
 * @returns {boolean} - True if successful
 */
export function removeFontScaling() {
  if (!_initialized || !_enabled) {
    return false;
  }
  
  try {
    // Clear custom styles
    _styleElement.textContent = '';
    
    // Remove body classes
    document.body.classList.remove(
      'font-scale-smaller',
      'font-scale-normal',
      'font-scale-medium',
      'font-scale-large',
      'font-scale-xlarge',
      'font-scale-xxlarge'
    );
    document.body.removeAttribute('data-font-scale');
    
    // Update state
    _enabled = false;
    _config.enabled = false;
    
    // Save config
    ConfigManager.save('accessibility.fontScaling', _config);
    
    // Publish event
    EventBus.publish('accessibility:fontScalingDisabled');
    
    logger.info('Font scaling disabled');
    
    return true;
  } catch (error) {
    logger.error('Error removing font scaling', error);
    return false;
  }
}

/**
 * Increase font scaling by one level
 * @returns {boolean} - True if successful
 */
export function increaseScaling() {
  if (!_initialized) {
    return false;
  }
  
  try {
    const levels = Object.keys(_config.levels).map(parseFloat).sort((a, b) => a - b);
    const currentIndex = levels.indexOf(_currentLevel);
    
    if (currentIndex < levels.length - 1) {
      const newLevel = levels[currentIndex + 1];
      return applyFontScaling(newLevel);
    }
    
    return false;
  } catch (error) {
    logger.error('Error increasing font scaling', error);
    return false;
  }
}

/**
 * Decrease font scaling by one level
 * @returns {boolean} - True if successful
 */
export function decreaseScaling() {
  if (!_initialized) {
    return false;
  }
  
  try {
    const levels = Object.keys(_config.levels).map(parseFloat).sort((a, b) => a - b);
    const currentIndex = levels.indexOf(_currentLevel);
    
    if (currentIndex > 0) {
      const newLevel = levels[currentIndex - 1];
      return applyFontScaling(newLevel);
    }
    
    return false;
  } catch (error) {
    logger.error('Error decreasing font scaling', error);
    return false;
  }
}

/**
 * Reset font scaling to normal level
 * @returns {boolean} - True if successful
 */
export function resetScaling() {
  if (!_initialized) {
    return false;
  }
  
  return applyFontScaling(1);
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  logger.info('Cleaning up font scaling');
  
  try {
    // Remove font scaling if enabled
    if (_enabled) {
      removeFontScaling();
    }
    
    // Remove style element
    if (_styleElement && _styleElement.parentNode) {
      _styleElement.parentNode.removeChild(_styleElement);
    }
    
    // Remove body class
    document.body.classList.remove('font-scaling-initialized');
    
    // Remove event listeners
    removeEventListeners();
    
    _initialized = false;
    _enabled = false;
    
    EventBus.publish('accessibility:fontScalingCleanup');
    logger.info('Font scaling cleaned up');
  } catch (error) {
    logger.error('Error during font scaling cleanup', error);
  }
}

/* Private Functions */

/**
 * Generate CSS for font scaling
 * @private
 * @param {number} level - Scaling level
 * @returns {string} - Generated CSS
 */
function generateFontScalingCSS(level) {
  const minFontSize = _config.minFontSize;
  const adjustLineHeight = _config.adjustLineHeight;
  const adjustSpacing = _config.adjustSpacing;
  
  // Build the exclude selector string
  const excludeSelectors = _config.excludeSelectors.join(', ');
  
  return `
    /* Font Scaling Level: ${level} (${_config.levels[level] || 'Custom'}) */
    
    /* Global text scaling */
    html, body {
      font-size: ${Math.max(minFontSize, 16 * level)}px !important;
    }
    
    body *:not(${excludeSelectors}) {
      font-size: ${level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.5)} !important;` : ''}
    }
    
    /* Headings */
    h1:not(${excludeSelectors}) {
      font-size: ${2 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    h2:not(${excludeSelectors}) {
      font-size: ${1.75 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    h3:not(${excludeSelectors}) {
      font-size: ${1.5 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    h4:not(${excludeSelectors}) {
      font-size: ${1.25 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    h5:not(${excludeSelectors}) {
      font-size: ${1.1 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    h6:not(${excludeSelectors}) {
      font-size: ${1 * level}em !important;
      ${adjustLineHeight ? `line-height: ${Math.min(1.5, 1 + (level - 1) * 0.3)} !important;` : ''}
    }
    
    /* Form elements */
    input:not(${excludeSelectors}),
    select:not(${excludeSelectors}),
    textarea:not(${excludeSelectors}),
    button:not(${excludeSelectors}) {
      font-size: ${level}em !important;
    }
    
    /* Special cases */
    .small:not(${excludeSelectors}),
    small:not(${excludeSelectors}) {
      font-size: ${0.85 * level}em !important;
    }
    
    .large-text:not(${excludeSelectors}) {
      font-size: ${1.2 * level}em !important;
    }
    
    /* Spacing adjustments */
    ${adjustSpacing ? `
      body.font-scaling-initialized {
        --spacing-scalar: ${Math.max(1, level * 0.8)};
      }
      
      body.font-scaling-initialized .container,
      body.font-scaling-initialized .content-section {
        padding: calc(1rem * var(--spacing-scalar)) !important;
      }
      
      body.font-scaling-initialized .button,
      body.font-scaling-initialized button {
        padding: calc(0.5rem * var(--spacing-scalar)) calc(1rem * var(--spacing-scalar)) !important;
      }
      
      body.font-scaling-initialized input,
      body.font-scaling-initialized select,
      body.font-scaling-initialized textarea {
        padding: calc(0.5rem * var(--spacing-scalar)) !important;
      }
      
      body.font-scaling-initialized td,
      body.font-scaling-initialized th {
        padding: calc(0.5rem * var(--spacing-scalar)) !important;
      }
    ` : ''}
    
    /* ALEJO specific components */
    
    /* Health status indicators */
    body.font-scaling-initialized .health-status-indicator:not(${excludeSelectors}) {
      padding: ${adjustSpacing ? 'calc(0.25rem * var(--spacing-scalar))' : '0.25rem'} !important;
    }
    
    /* Resource dashboard */
    body.font-scaling-initialized .resource-dashboard label:not(${excludeSelectors}) {
      font-size: ${0.9 * level}em !important;
    }
    
    body.font-scaling-initialized .resource-value:not(${excludeSelectors}) {
      font-size: ${1.2 * level}em !important;
    }
  `;
}

/**
 * Capture original font sizes from the page
 * @private
 */
function captureOriginalFontSizes() {
  try {
    // Store computed font size for key elements
    const elements = [
      'body',
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'button',
      'input',
      'select',
      'textarea',
      'small',
      '.health-status-indicator',
      '.resource-dashboard label',
      '.resource-value'
    ];
    
    elements.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        _originalFontSizes.set(selector, {
          fontSize: style.fontSize,
          lineHeight: style.lineHeight
        });
      }
    });
    
    logger.debug(`Captured original font sizes for ${_originalFontSizes.size} elements`);
  } catch (error) {
    logger.error('Error capturing original font sizes', error);
  }
}

/**
 * Find the closest scaling level to a given value
 * @private
 * @param {number} value - Value to find closest level for
 * @returns {number} - Closest available level
 */
function findClosestLevel(value) {
  const levels = Object.keys(_config.levels).map(parseFloat).sort((a, b) => a - b);
  
  if (value <= levels[0]) return levels[0];
  if (value >= levels[levels.length - 1]) return levels[levels.length - 1];
  
  let closest = levels[0];
  let closestDiff = Math.abs(value - closest);
  
  for (let i = 1; i < levels.length; i++) {
    const diff = Math.abs(value - levels[i]);
    if (diff < closestDiff) {
      closest = levels[i];
      closestDiff = diff;
    }
  }
  
  return closest;
}

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Listen for page content loaded to ensure we scale dynamic content
  window.addEventListener('DOMContentLoaded', handleContentLoaded);
  
  // Listen for dynamic content changes
  if (window.MutationObserver) {
    const observer = new MutationObserver(handleDOMChanges);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
  
  // Subscribe to theme change events
  EventBus.subscribe('ui:themeChanged', handleThemeChanged);
}

/**
 * Remove event listeners
 * @private
 */
function removeEventListeners() {
  window.removeEventListener('DOMContentLoaded', handleContentLoaded);
  EventBus.unsubscribe('ui:themeChanged', handleThemeChanged);
}

/**
 * Handle content loaded event
 * @private
 */
function handleContentLoaded() {
  if (!_initialized || !_enabled) return;
  
  // Re-apply font scaling to ensure it affects all elements
  applyFontScaling(_currentLevel);
}

/**
 * Handle DOM changes
 * @private
 */
function handleDOMChanges() {
  if (!_initialized || !_enabled) return;
  
  // Don't reapply immediately for performance reasons
  // Use a debounce to prevent too frequent updates
  if (window._fontScalingDebounce) {
    clearTimeout(window._fontScalingDebounce);
  }
  
  window._fontScalingDebounce = setTimeout(() => {
    // Re-apply current level to ensure new content is scaled
    applyFontScaling(_currentLevel);
  }, 500);
}

/**
 * Handle theme changed event
 * @private
 */
function handleThemeChanged() {
  if (!_initialized || !_enabled) return;
  
  // Re-apply font scaling to ensure it works with new theme
  applyFontScaling(_currentLevel);
}
