/**
 * ALEJO High Contrast Mode Manager
 * 
 * This module provides comprehensive high contrast mode support with:
 * - System preference detection (prefers-contrast media query)
 * - User override controls
 * - Dynamic CSS variable updates
 * - Persistent user preferences
 * - ARIA announcements for state changes
 * - Context-aware image handling for improved contrast
 * 
 * Resource-efficient implementation with minimal DOM manipulation.
 */

import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';
import { ariaManager } from './aria-manager.js';
import { ConfigManager } from '../../core/config-manager.js';

// Configuration constants
const CONFIG_KEY = 'accessibility.highContrast';
const HIGH_CONTRAST_CLASS = 'alejo-high-contrast';
const THEME_VARIABLES = {
  '--alejo-background': '#000000',
  '--alejo-foreground': '#ffffff',
  '--alejo-accent': '#ffff00',
  '--alejo-accent-secondary': '#00ffff',
  '--alejo-warning': '#ffff00',
  '--alejo-error': '#ff0000',
  '--alejo-success': '#00ff00',
  '--alejo-border': '#ffffff',
  '--alejo-focus-outline': '#ffff00',
  '--alejo-text': '#ffffff',
  '--alejo-text-secondary': '#eeeeee',
  '--alejo-link': '#00ffff',
  '--alejo-link-visited': '#ffbbff',
  '--alejo-button-background': '#000000',
  '--alejo-button-text': '#ffffff',
  '--alejo-button-border': '#ffffff'
};

// State
let isHighContrastEnabled = false;
let hasInitialized = false;
let styleElement = null;
let configManager = null;

/**
 * Initialize high contrast mode management
 * 
 * @param {Object} options Configuration options
 * @param {boolean} [options.detectSystemPreference=true] Whether to detect system high contrast preference
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
    
    // Get config manager instance
    configManager = await ConfigManager.getInstance();
    
    // Create style element for dynamic CSS
    createStyleElement();
    
    // Load saved preference
    const savedPreference = await configManager.get(CONFIG_KEY);
    if (savedPreference !== undefined) {
      isHighContrastEnabled = savedPreference;
    } else if (finalOptions.detectSystemPreference) {
      // Check system preference if no saved preference
      isHighContrastEnabled = detectSystemHighContrastPreference();
    }
    
    // Apply immediately if requested
    if (finalOptions.applyImmediately) {
      applyHighContrastSetting(isHighContrastEnabled);
    }
    
    // Set up system preference change listener
    if (finalOptions.detectSystemPreference) {
      setupSystemPreferenceListener();
    }
    
    // Set up event listeners
    eventEmitter.on('accessibility:high-contrast:toggle', toggleHighContrast);
    eventEmitter.on('accessibility:high-contrast:set', setHighContrast);
    eventEmitter.on('theme:changed', updateThemeVariables);
    
    // Log initialization
    auditTrail.log('accessibility', 'High contrast manager initialized', {
      initialState: isHighContrastEnabled
    });
    
    hasInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize high contrast manager:', error);
    auditTrail.log('error', 'Failed to initialize high contrast manager', {
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
  styleElement = document.getElementById('alejo-high-contrast-style');
  if (styleElement) return;
  
  // Create new style element
  styleElement = document.createElement('style');
  styleElement.id = 'alejo-high-contrast-style';
  styleElement.setAttribute('data-generated', 'alejo-accessibility');
  document.head.appendChild(styleElement);
}

/**
 * Detect system high contrast preference
 * @private
 * @returns {boolean} Whether system prefers high contrast
 */
function detectSystemHighContrastPreference() {
  // Check for the standard media query
  if (window.matchMedia('(prefers-contrast: more)').matches) {
    return true;
  }
  
  // Check for Windows High Contrast Mode (WHCM)
  // This is a heuristic - WHCM doesn't have a direct detection method
  try {
    // Create a test element with a background image
    const testElement = document.createElement('div');
    testElement.style.cssText = 'position:absolute;width:1px;height:1px;background-image:url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");';
    document.body.appendChild(testElement);
    
    // In WHCM, background images are forced to none
    const computedStyle = window.getComputedStyle(testElement);
    const result = !computedStyle.backgroundImage || computedStyle.backgroundImage === 'none';
    
    // Clean up
    document.body.removeChild(testElement);
    
    return result;
  } catch (error) {
    console.warn('Error detecting Windows High Contrast Mode:', error);
    return false;
  }
}

/**
 * Set up system preference change listener
 * @private
 */
function setupSystemPreferenceListener() {
  const mediaQuery = window.matchMedia('(prefers-contrast: more)');
  
  // Use the standard event listener approach
  const handleChange = (e) => {
    // Only apply if user hasn't explicitly set a preference
    const userHasExplicitPreference = configManager.has(CONFIG_KEY);
    if (!userHasExplicitPreference) {
      setHighContrast(e.matches);
    }
  };
  
  // Add the listener
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else if (mediaQuery.addListener) {
    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
  }
}

/**
 * Apply high contrast setting to the UI
 * 
 * @private
 * @param {boolean} enable Whether to enable high contrast mode
 */
function applyHighContrastSetting(enable) {
  if (enable) {
    // Add class to html element
    document.documentElement.classList.add(HIGH_CONTRAST_CLASS);
    
    // Apply CSS variables
    updateThemeVariables();
    
    // Update images with appropriate alt text and high contrast versions
    enhanceImagesForHighContrast(true);
  } else {
    // Remove class from html element
    document.documentElement.classList.remove(HIGH_CONTRAST_CLASS);
    
    // Reset CSS variables
    styleElement.textContent = '';
    
    // Reset images to normal
    enhanceImagesForHighContrast(false);
  }
  
  // Update ARIA properties
  ariaManager.updateProperty('highContrast', enable);
  
  // Announce to screen readers
  if (enable) {
    ariaManager.announce('High contrast mode enabled');
  } else {
    ariaManager.announce('High contrast mode disabled');
  }
}

/**
 * Update theme variables based on current settings
 * @private
 */
function updateThemeVariables() {
  if (!isHighContrastEnabled || !styleElement) return;
  
  // Generate CSS rules
  let cssRules = '';
  
  // Root variables
  cssRules += '.alejo-high-contrast {\n';
  Object.entries(THEME_VARIABLES).forEach(([key, value]) => {
    cssRules += `  ${key}: ${value};\n`;
  });
  cssRules += '}\n\n';
  
  // Button styles
  cssRules += '.alejo-high-contrast button, .alejo-high-contrast .button {\n';
  cssRules += '  background-color: var(--alejo-button-background);\n';
  cssRules += '  color: var(--alejo-button-text);\n';
  cssRules += '  border: 2px solid var(--alejo-button-border);\n';
  cssRules += '}\n\n';
  
  // Input styles
  cssRules += '.alejo-high-contrast input, .alejo-high-contrast select, .alejo-high-contrast textarea {\n';
  cssRules += '  background-color: #000000;\n';
  cssRules += '  color: #ffffff;\n';
  cssRules += '  border: 2px solid #ffffff;\n';
  cssRules += '}\n\n';
  
  // Focus styles
  cssRules += '.alejo-high-contrast :focus {\n';
  cssRules += '  outline: 3px solid var(--alejo-focus-outline);\n';
  cssRules += '  outline-offset: 2px;\n';
  cssRules += '}\n';
  
  // Update style element
  styleElement.textContent = cssRules;
}

/**
 * Enhance images for high contrast mode
 * 
 * @private
 * @param {boolean} enable Whether to enhance images
 */
function enhanceImagesForHighContrast(enable) {
  // Get all images that don't have specific high contrast versions
  const images = document.querySelectorAll('img:not([data-high-contrast-src])');
  
  // For images that don't have a high contrast version, increase border contrast
  if (enable) {
    images.forEach(img => {
      if (!img.hasAttribute('data-original-style')) {
        img.setAttribute('data-original-style', img.getAttribute('style') || '');
      }
      
      // Add high contrast border
      img.style.border = '2px solid white';
      img.style.padding = '2px';
      
      // If image doesn't have alt text, add a warning to the audit trail
      if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
        auditTrail.log('accessibility', 'Image missing alt text', {
          src: img.src,
          location: img.closest('[id]')?.id || 'unknown'
        });
      }
    });
  } else {
    // Reset to original style
    images.forEach(img => {
      if (img.hasAttribute('data-original-style')) {
        img.setAttribute('style', img.getAttribute('data-original-style'));
        img.removeAttribute('data-original-style');
      } else {
        img.style.border = '';
        img.style.padding = '';
      }
    });
  }
  
  // Handle images with specific high-contrast versions
  const highContrastImages = document.querySelectorAll('img[data-high-contrast-src]');
  highContrastImages.forEach(img => {
    if (!img.hasAttribute('data-original-src')) {
      img.setAttribute('data-original-src', img.src);
    }
    
    if (enable) {
      img.src = img.getAttribute('data-high-contrast-src');
    } else {
      img.src = img.getAttribute('data-original-src');
    }
  });
}

/**
 * Toggle high contrast mode
 * @returns {boolean} New high contrast state
 */
function toggleHighContrast() {
  return setHighContrast(!isHighContrastEnabled);
}

/**
 * Set high contrast mode to a specific state
 * 
 * @param {boolean} enable Whether to enable high contrast mode
 * @returns {boolean} New high contrast state
 */
function setHighContrast(enable) {
  if (enable === isHighContrastEnabled) return isHighContrastEnabled;
  
  isHighContrastEnabled = enable;
  
  // Apply setting
  applyHighContrastSetting(enable);
  
  // Save preference
  configManager.set(CONFIG_KEY, enable);
  
  // Emit event
  eventEmitter.emit('accessibility:high-contrast:changed', { enabled: enable });
  
  // Log change
  auditTrail.log('accessibility', 'High contrast mode changed', {
    enabled: enable,
    userInitiated: true
  });
  
  return enable;
}

/**
 * Get current high contrast mode status
 * @returns {boolean} Whether high contrast mode is enabled
 */
function isHighContrastMode() {
  return isHighContrastEnabled;
}

/**
 * Add high contrast version of an image
 * 
 * @param {HTMLImageElement} imageElement Image element to enhance
 * @param {string} highContrastSrc URL of high contrast version
 */
function addHighContrastImage(imageElement, highContrastSrc) {
  if (!imageElement || !highContrastSrc) return;
  
  imageElement.setAttribute('data-high-contrast-src', highContrastSrc);
  
  if (isHighContrastEnabled) {
    imageElement.setAttribute('data-original-src', imageElement.src);
    imageElement.src = highContrastSrc;
  }
}

export const highContrastManager = {
  initialize,
  toggleHighContrast,
  setHighContrast,
  isHighContrastMode,
  addHighContrastImage
};
