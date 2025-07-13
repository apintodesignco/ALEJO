/**
 * @file color-blindness-mode.js
 * @description Color blindness accommodation implementation for visual accessibility
 * @module accessibility/color-blindness-mode
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';

// Initialize logger
const logger = new Logger('ColorBlindnessMode');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;
let _activeType = null;
let _styleElement = null;

// Color blindness types and their SVG filters
const COLOR_BLINDNESS_TYPES = {
  protanopia: {
    name: 'Protanopia (Red-Blind)',
    description: 'Red-green color blindness, with insensitivity to red light',
    filter: `
      <filter id="protanopia">
        <feColorMatrix type="matrix" values="
          0.567, 0.433, 0.000, 0, 0
          0.558, 0.442, 0.000, 0, 0
          0.000, 0.242, 0.758, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
    `
  },
  deuteranopia: {
    name: 'Deuteranopia (Green-Blind)',
    description: 'Red-green color blindness, with insensitivity to green light',
    filter: `
      <filter id="deuteranopia">
        <feColorMatrix type="matrix" values="
          0.625, 0.375, 0.000, 0, 0
          0.700, 0.300, 0.000, 0, 0
          0.000, 0.300, 0.700, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
    `
  },
  tritanopia: {
    name: 'Tritanopia (Blue-Blind)',
    description: 'Blue-yellow color blindness, with insensitivity to blue light',
    filter: `
      <filter id="tritanopia">
        <feColorMatrix type="matrix" values="
          0.950, 0.050, 0.000, 0, 0
          0.000, 0.433, 0.567, 0, 0
          0.000, 0.475, 0.525, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
    `
  },
  achromatopsia: {
    name: 'Achromatopsia (Monochromacy)',
    description: 'Complete color blindness, seeing only in shades of gray',
    filter: `
      <filter id="achromatopsia">
        <feColorMatrix type="matrix" values="
          0.299, 0.587, 0.114, 0, 0
          0.299, 0.587, 0.114, 0, 0
          0.299, 0.587, 0.114, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
    `
  },
  // Enhanced color perception for those with partial color blindness
  enhanced: {
    name: 'Enhanced Colors',
    description: 'Enhanced color contrast for partial color blindness',
    filter: `
      <filter id="enhanced">
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude="1.5" exponent="1.2" offset="0" />
          <feFuncG type="gamma" amplitude="1.2" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="1.5" exponent="1.2" offset="0" />
        </feComponentTransfer>
        <feColorMatrix type="matrix" values="
          1.3, -0.3, 0.0, 0, 0
          0.0,  1.3, -0.3, 0, 0
          -0.3, 0.0, 1.3, 0, 0
          0,    0,   0,   1, 0
        "/>
      </filter>
    `
  },
  // Additional color blindness compensation
  compensation: {
    name: 'Color Blind Compensation',
    description: 'Adjusts colors to be more distinguishable for color blind users',
    filter: `
      <filter id="compensation">
        <feColorMatrix type="matrix" values="
          1,   0,   0, 0, 0
          0.7, 0.3, 0, 0, 0
          0.7, 0,   0.3, 0, 0
          0,   0,   0, 1, 0
        "/>
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude="1.2" exponent="1" offset="0" />
          <feFuncG type="gamma" amplitude="1.2" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="1.2" exponent="1" offset="0" />
        </feComponentTransfer>
      </filter>
    `
  }
};

// Default configuration
const DEFAULT_CONFIG = {
  // Whether color blindness mode is enabled
  enabled: false,
  // Default color blindness type
  defaultType: 'enhanced',
  // Whether to add outlines to elements with similar colors
  enhanceElementOutlines: true,
  // Whether to enhance text contrast
  enhanceTextContrast: true,
  // Elements to exclude from color transformation (selectors)
  excludeSelectors: [
    '.no-color-transform',
    '.original-color',
    '.preserve-color',
    'img.preserve-original'
  ],
  // Auto-detect system preferences
  detectSystemPreferences: true
};

/**
 * Initialize color blindness mode
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Color blindness mode already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing color blindness mode');
    
    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility.colorBlindnessMode');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    
    // Create style element
    _styleElement = document.createElement('style');
    _styleElement.id = 'color-blindness-styles';
    document.head.appendChild(_styleElement);
    
    // Create SVG filters
    createSVGFilters();
    
    // Check system preferences
    if (_config.detectSystemPreferences) {
      detectSystemPreferences();
    }
    
    // Set initial state
    _enabled = _config.enabled;
    _activeType = _config.defaultType;
    
    // Apply color blindness mode if enabled
    if (_enabled) {
      applyColorBlindnessMode(_activeType);
    }
    
    // Add class to body for CSS targeting
    document.body.classList.add('color-blindness-initialized');
    
    // Set up event listeners
    setupEventListeners();
    
    _initialized = true;
    
    EventBus.publish('accessibility:colorBlindnessInitialized', { 
      enabled: _enabled,
      type: _activeType
    });
    
    logger.info('Color blindness mode initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize color blindness mode', error);
    return false;
  }
}

/**
 * Enable or disable color blindness mode
 * @param {boolean} enable - Whether to enable color blindness mode
 * @param {string} [type] - Color blindness type to apply when enabling
 * @returns {boolean} - True if successful
 */
export function setEnabled(enable, type = null) {
  if (!_initialized) {
    return false;
  }
  
  try {
    if (enable) {
      _enabled = true;
      _config.enabled = true;
      
      // Apply color blindness mode with specified type or current type
      const colorType = type !== null ? type : _activeType;
      return applyColorBlindnessMode(colorType);
    } else {
      _enabled = false;
      _config.enabled = false;
      return removeColorBlindnessMode();
    }
  } catch (error) {
    logger.error(`Error ${enable ? 'enabling' : 'disabling'} color blindness mode`, error);
    return false;
  }
}

/**
 * Toggle color blindness mode on/off
 * @returns {boolean} - True if now enabled, false if now disabled
 */
export function toggle() {
  if (!_initialized) {
    return false;
  }
  
  return setEnabled(!_enabled);
}

/**
 * Get available color blindness types
 * @returns {Object} - Object with type keys and name/description values
 */
export function getAvailableTypes() {
  const types = {};
  
  for (const [key, value] of Object.entries(COLOR_BLINDNESS_TYPES)) {
    types[key] = {
      name: value.name,
      description: value.description
    };
  }
  
  return types;
}

/**
 * Get current color blindness mode state
 * @returns {Object} - Current state with enabled flag and type
 */
export function getState() {
  return {
    initialized: _initialized,
    enabled: _enabled,
    type: _activeType,
    typeName: _activeType ? COLOR_BLINDNESS_TYPES[_activeType]?.name : null
  };
}

/**
 * Apply color blindness mode with a specific type
 * @param {string} type - Color blindness type to apply
 * @returns {boolean} - True if successful
 */
export function applyColorBlindnessMode(type = 'enhanced') {
  if (!_initialized) {
    return false;
  }
  
  try {
    // Check if type is valid
    if (!COLOR_BLINDNESS_TYPES[type]) {
      type = 'enhanced';
      logger.warn(`Invalid color blindness type, using default: ${type}`);
    }
    
    // Generate CSS
    const css = generateColorBlindnessCSS(type);
    
    // Apply CSS
    _styleElement.textContent = css;
    
    // Update body class
    document.body.classList.forEach(className => {
      if (className.startsWith('color-blind-')) {
        document.body.classList.remove(className);
      }
    });
    
    document.body.classList.add(`color-blind-${type}`);
    document.body.setAttribute('data-color-blind', type);
    
    // Update state
    _enabled = true;
    _activeType = type;
    _config.enabled = true;
    _config.defaultType = type;
    
    // Save config
    ConfigManager.save('accessibility.colorBlindnessMode', _config);
    
    // Publish event
    EventBus.publish('accessibility:colorBlindnessChanged', { 
      type: type,
      typeName: COLOR_BLINDNESS_TYPES[type]?.name
    });
    
    logger.info(`Color blindness mode applied with type: ${type}`);
    
    return true;
  } catch (error) {
    logger.error(`Error applying color blindness mode with type: ${type}`, error);
    return false;
  }
}

/**
 * Remove color blindness mode
 * @returns {boolean} - True if successful
 */
export function removeColorBlindnessMode() {
  if (!_initialized || !_enabled) {
    return false;
  }
  
  try {
    // Clear custom styles
    _styleElement.textContent = '';
    
    // Remove body classes
    document.body.classList.forEach(className => {
      if (className.startsWith('color-blind-')) {
        document.body.classList.remove(className);
      }
    });
    
    document.body.removeAttribute('data-color-blind');
    
    // Update state
    _enabled = false;
    _config.enabled = false;
    
    // Save config
    ConfigManager.save('accessibility.colorBlindnessMode', _config);
    
    // Publish event
    EventBus.publish('accessibility:colorBlindnessDisabled');
    
    logger.info('Color blindness mode disabled');
    
    return true;
  } catch (error) {
    logger.error('Error removing color blindness mode', error);
    return false;
  }
}

/**
 * Cycle through available color blindness types
 * @returns {string} - The newly applied color blindness type
 */
export function cycleType() {
  if (!_initialized) {
    return null;
  }
  
  try {
    const types = Object.keys(COLOR_BLINDNESS_TYPES);
    const currentIndex = types.indexOf(_activeType);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex];
    
    if (applyColorBlindnessMode(nextType)) {
      return nextType;
    }
    
    return null;
  } catch (error) {
    logger.error('Error cycling color blindness type', error);
    return null;
  }
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  logger.info('Cleaning up color blindness mode');
  
  try {
    // Remove color blindness mode if enabled
    if (_enabled) {
      removeColorBlindnessMode();
    }
    
    // Remove style element
    if (_styleElement && _styleElement.parentNode) {
      _styleElement.parentNode.removeChild(_styleElement);
    }
    
    // Remove SVG filters
    const filtersContainer = document.getElementById('color-blindness-filters');
    if (filtersContainer && filtersContainer.parentNode) {
      filtersContainer.parentNode.removeChild(filtersContainer);
    }
    
    // Remove body class
    document.body.classList.remove('color-blindness-initialized');
    
    // Remove event listeners
    removeEventListeners();
    
    _initialized = false;
    _enabled = false;
    
    EventBus.publish('accessibility:colorBlindnessCleanup');
    logger.info('Color blindness mode cleaned up');
  } catch (error) {
    logger.error('Error during color blindness mode cleanup', error);
  }
}

/* Private Functions */

/**
 * Create SVG filters for color blindness simulation
 * @private
 */
function createSVGFilters() {
  try {
    // Check if filters already exist
    let filtersContainer = document.getElementById('color-blindness-filters');
    
    if (!filtersContainer) {
      // Create SVG element to hold filters
      filtersContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      filtersContainer.id = 'color-blindness-filters';
      filtersContainer.style.position = 'absolute';
      filtersContainer.style.width = '0';
      filtersContainer.style.height = '0';
      filtersContainer.setAttribute('aria-hidden', 'true');
      
      // Add each filter
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      
      for (const [type, config] of Object.entries(COLOR_BLINDNESS_TYPES)) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = config.filter;
        const filterNode = tempDiv.firstChild;
        
        defs.appendChild(filterNode);
      }
      
      filtersContainer.appendChild(defs);
      document.body.appendChild(filtersContainer);
      
      logger.debug('Created SVG filters for color blindness simulation');
    }
  } catch (error) {
    logger.error('Error creating SVG filters', error);
  }
}

/**
 * Generate CSS for color blindness mode
 * @private
 * @param {string} type - Color blindness type
 * @returns {string} - Generated CSS
 */
function generateColorBlindnessCSS(type) {
  // Build the exclude selector string
  const excludeSelectors = _config.excludeSelectors.join(', ');
  
  // Get enhanced outlines setting
  const enhanceOutlines = _config.enhanceElementOutlines;
  const enhanceContrast = _config.enhanceTextContrast;
  
  return `
    /* Color Blindness Type: ${type} (${COLOR_BLINDNESS_TYPES[type]?.name}) */
    
    /* Apply filter to all content */
    html.color-blind-${type} body *:not(${excludeSelectors}) {
      filter: url(#${type});
    }
    
    body.color-blind-${type} img:not(${excludeSelectors}),
    body.color-blind-${type} video:not(${excludeSelectors}),
    body.color-blind-${type} canvas:not(${excludeSelectors}),
    body.color-blind-${type} svg:not(${excludeSelectors}) {
      filter: url(#${type});
    }
    
    /* Element outlines for better distinction */
    ${enhanceOutlines ? `
      body.color-blind-${type} button:not(${excludeSelectors}),
      body.color-blind-${type} .button:not(${excludeSelectors}),
      body.color-blind-${type} input:not(${excludeSelectors}),
      body.color-blind-${type} select:not(${excludeSelectors}),
      body.color-blind-${type} a:not(${excludeSelectors}) {
        outline: 2px solid rgba(0, 0, 0, 0.2) !important;
      }
      
      body.color-blind-${type} button:hover:not(${excludeSelectors}),
      body.color-blind-${type} .button:hover:not(${excludeSelectors}),
      body.color-blind-${type} input:focus:not(${excludeSelectors}),
      body.color-blind-${type} select:focus:not(${excludeSelectors}),
      body.color-blind-${type} a:hover:not(${excludeSelectors}) {
        outline: 2px solid rgba(0, 0, 0, 0.5) !important;
      }
      
      /* Status indicators with patterns */
      body.color-blind-${type} .status-success:not(${excludeSelectors}) {
        background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent) !important;
        background-size: 10px 10px !important;
      }
      
      body.color-blind-${type} .status-warning:not(${excludeSelectors}) {
        background-image: linear-gradient(-45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent) !important;
        background-size: 10px 10px !important;
      }
      
      body.color-blind-${type} .status-error:not(${excludeSelectors}) {
        background-image: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 2px, transparent 2px, transparent 4px) !important;
      }
      
      body.color-blind-${type} .status-neutral:not(${excludeSelectors}) {
        background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 2px, transparent 2px, transparent 4px) !important;
      }
    ` : ''}
    
    /* Text contrast enhancements */
    ${enhanceContrast ? `
      body.color-blind-${type} h1:not(${excludeSelectors}),
      body.color-blind-${type} h2:not(${excludeSelectors}),
      body.color-blind-${type} h3:not(${excludeSelectors}),
      body.color-blind-${type} h4:not(${excludeSelectors}),
      body.color-blind-${type} h5:not(${excludeSelectors}),
      body.color-blind-${type} h6:not(${excludeSelectors}) {
        text-shadow: 0 0 1px rgba(0, 0, 0, 0.3) !important;
        color: ${type === 'protanopia' || type === 'deuteranopia' ? '#000 !important' : ''};
      }
      
      body.color-blind-${type} p:not(${excludeSelectors}),
      body.color-blind-${type} li:not(${excludeSelectors}),
      body.color-blind-${type} span:not(${excludeSelectors}) {
        color: ${type === 'protanopia' || type === 'deuteranopia' ? '#000 !important' : ''};
      }
    ` : ''}
    
    /* Resource dashboard specific enhancements */
    body.color-blind-${type} .health-status-indicator:not(${excludeSelectors}) {
      border: 2px solid black !important;
    }
    
    body.color-blind-${type} .resource-value.critical:not(${excludeSelectors}),
    body.color-blind-${type} .resource-value.warning:not(${excludeSelectors}),
    body.color-blind-${type} .resource-value.normal:not(${excludeSelectors}) {
      font-weight: bold !important;
    }
    
    /* Add text labels for color-coded elements */
    body.color-blind-${type} .status-success:not(${excludeSelectors}):after {
      content: "(✓)" !important;
    }
    
    body.color-blind-${type} .status-warning:not(${excludeSelectors}):after {
      content: "(⚠)" !important;
    }
    
    body.color-blind-${type} .status-error:not(${excludeSelectors}):after {
      content: "(✗)" !important;
    }
    
    body.color-blind-${type} .health-status-indicator.online:not(${excludeSelectors}):after {
      content: "(Online)" !important;
      font-size: 0.8em !important;
    }
    
    body.color-blind-${type} .health-status-indicator.offline:not(${excludeSelectors}):after {
      content: "(Offline)" !important;
      font-size: 0.8em !important;
    }
    
    body.color-blind-${type} .health-status-indicator.degraded:not(${excludeSelectors}):after {
      content: "(Degraded)" !important;
      font-size: 0.8em !important;
    }
  `;
}

/**
 * Detect system color blindness settings
 * @private
 */
function detectSystemPreferences() {
  try {
    // Check for prefers-contrast media query
    const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
    
    // Check for forced colors mode (Windows high contrast)
    const forcedColors = window.matchMedia('(forced-colors: active)').matches;
    
    // Apply settings based on system preferences
    if (prefersContrast || forcedColors) {
      _config.enabled = true;
      _config.defaultType = 'enhanced';
      
      logger.info('Detected system preference for increased contrast or forced colors');
    }
    
    // Listen for changes in system preferences
    const contrastMediaQuery = window.matchMedia('(prefers-contrast: more)');
    contrastMediaQuery.addEventListener('change', handleSystemPreferenceChange);
    
    const forcedColorsMediaQuery = window.matchMedia('(forced-colors: active)');
    forcedColorsMediaQuery.addEventListener('change', handleSystemPreferenceChange);
  } catch (error) {
    logger.error('Error detecting system preferences', error);
  }
}

/**
 * Handle system preference changes
 * @private
 * @param {MediaQueryListEvent} event - Media query change event
 */
function handleSystemPreferenceChange(event) {
  if (!_initialized) return;
  
  const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
  const forcedColors = window.matchMedia('(forced-colors: active)').matches;
  
  if (prefersContrast || forcedColors) {
    logger.info('System preference changed to increased contrast or forced colors');
    
    // Only apply if we're respecting system preferences
    if (_config.detectSystemPreferences && !_enabled) {
      applyColorBlindnessMode('enhanced');
    }
  } else if (_config.detectSystemPreferences && _enabled) {
    // Only remove if it was enabled based on system preferences
    logger.info('System preference no longer requests increased contrast or forced colors');
    removeColorBlindnessMode();
  }
}

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Listen for page content loaded to ensure we apply to all content
  window.addEventListener('DOMContentLoaded', handleContentLoaded);
  
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
  
  // Remove system preference listeners
  const contrastMediaQuery = window.matchMedia('(prefers-contrast: more)');
  contrastMediaQuery.removeEventListener('change', handleSystemPreferenceChange);
  
  const forcedColorsMediaQuery = window.matchMedia('(forced-colors: active)');
  forcedColorsMediaQuery.removeEventListener('change', handleSystemPreferenceChange);
}

/**
 * Handle content loaded event
 * @private
 */
function handleContentLoaded() {
  if (!_initialized || !_enabled) return;
  
  // Re-apply color blindness mode to ensure it affects all elements
  applyColorBlindnessMode(_activeType);
}

/**
 * Handle theme changed event
 * @private
 */
function handleThemeChanged() {
  if (!_initialized || !_enabled) return;
  
  // Re-apply color blindness mode to ensure it works with new theme
  applyColorBlindnessMode(_activeType);
}
