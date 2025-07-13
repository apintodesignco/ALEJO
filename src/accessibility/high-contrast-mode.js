/**
 * @file high-contrast-mode.js
 * @description High contrast mode implementation for visual accessibility
 * @module accessibility/high-contrast-mode
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';

// Initialize logger
const logger = new Logger('HighContrastMode');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;
let _activeTheme = null;
let _originalTheme = null;
let _styleElement = null;
let _mediaQueryList = null;

// Default configuration
const DEFAULT_CONFIG = {
  // Whether high contrast mode is enabled
  enabled: false,
  // Whether to respond to system high contrast setting
  respectSystemSetting: true,
  // Default theme to use
  defaultTheme: 'dark',
  // Available themes
  themes: {
    dark: {
      name: 'High Contrast Dark',
      background: '#000000',
      foreground: '#ffffff',
      links: '#ffff00',
      buttonBg: '#0000aa',
      buttonFg: '#ffffff',
      focusOutline: '#ff0000',
      borderColor: '#ffffff',
      headingColor: '#ffffff',
      successColor: '#00ff00',
      errorColor: '#ff0000',
      warningColor: '#ffff00',
      infoColor: '#00ffff'
    },
    light: {
      name: 'High Contrast Light',
      background: '#ffffff',
      foreground: '#000000',
      links: '#0000ff',
      buttonBg: '#000000',
      buttonFg: '#ffffff',
      focusOutline: '#ff0000',
      borderColor: '#000000',
      headingColor: '#000000',
      successColor: '#008000',
      errorColor: '#ff0000',
      warningColor: '#b30000',
      infoColor: '#0000ff'
    },
    yellow: {
      name: 'Yellow on Black',
      background: '#000000',
      foreground: '#ffff00',
      links: '#00ffff',
      buttonBg: '#ffff00',
      buttonFg: '#000000',
      focusOutline: '#ff0000',
      borderColor: '#ffff00',
      headingColor: '#ffff00',
      successColor: '#00ff00',
      errorColor: '#ff6666',
      warningColor: '#ffff66',
      infoColor: '#66ffff'
    }
  }
};

/**
 * Initialize high contrast mode
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('High contrast mode already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing high contrast mode');
    
    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility.highContrast');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    
    // Create style element
    _styleElement = document.createElement('style');
    _styleElement.id = 'high-contrast-styles';
    document.head.appendChild(_styleElement);
    
    // Check for system high contrast setting
    if (_config.respectSystemSetting && window.matchMedia) {
      _mediaQueryList = window.matchMedia('(forced-colors: active)');
      
      if (_mediaQueryList.matches) {
        // System is using high contrast mode
        logger.info('System high contrast mode detected');
        _config.enabled = true;
      }
      
      // Listen for changes
      if (_mediaQueryList.addEventListener) {
        _mediaQueryList.addEventListener('change', handleSystemHighContrastChange);
      }
    }
    
    // Store original theme for restoration
    _originalTheme = getCurrentTheme();
    
    // Set enabled state
    _enabled = _config.enabled;
    
    // Apply high contrast if enabled
    if (_enabled) {
      applyHighContrast(_config.defaultTheme);
    }
    
    _initialized = true;
    
    EventBus.publish('accessibility:highContrastInitialized', { 
      enabled: _enabled,
      theme: _activeTheme
    });
    
    logger.info('High contrast mode initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize high contrast mode', error);
    return false;
  }
}

/**
 * Enable or disable high contrast mode
 * @param {boolean} enable - Whether to enable high contrast mode
 * @param {string} [theme] - Theme to use when enabling
 * @returns {boolean} - True if successful
 */
export function setEnabled(enable, theme = null) {
  if (!_initialized) {
    return false;
  }
  
  try {
    if (enable) {
      return applyHighContrast(theme || _config.defaultTheme);
    } else {
      return removeHighContrast();
    }
  } catch (error) {
    logger.error(`Error ${enable ? 'enabling' : 'disabling'} high contrast mode`, error);
    return false;
  }
}

/**
 * Get available high contrast themes
 * @returns {Object} - Object with theme keys and names
 */
export function getAvailableThemes() {
  if (!_initialized) {
    return {};
  }
  
  const themes = {};
  
  for (const [key, theme] of Object.entries(_config.themes)) {
    themes[key] = theme.name;
  }
  
  return themes;
}

/**
 * Get current high contrast state
 * @returns {Object} - Current state with enabled flag and active theme
 */
export function getState() {
  return {
    initialized: _initialized,
    enabled: _enabled,
    activeTheme: _activeTheme,
    systemHighContrast: _mediaQueryList ? _mediaQueryList.matches : false
  };
}

/**
 * Apply a high contrast theme
 * @param {string} themeName - Name of the theme to apply
 * @returns {boolean} - True if successful
 */
export function applyHighContrast(themeName = 'dark') {
  if (!_initialized) {
    return false;
  }
  
  try {
    // Store original theme if not already done
    if (!_originalTheme) {
      _originalTheme = getCurrentTheme();
    }
    
    // Get theme configuration
    const theme = _config.themes[themeName] || _config.themes.dark;
    
    // Generate CSS
    const css = generateHighContrastCSS(theme);
    
    // Apply CSS
    _styleElement.textContent = css;
    
    // Add class to body
    document.body.classList.add('high-contrast-mode');
    document.body.setAttribute('data-high-contrast-theme', themeName);
    
    // Update state
    _enabled = true;
    _activeTheme = themeName;
    _config.enabled = true;
    _config.defaultTheme = themeName;
    
    // Save config
    ConfigManager.save('accessibility.highContrast', _config);
    
    // Publish event
    EventBus.publish('accessibility:highContrastEnabled', { 
      theme: themeName,
      themeConfig: theme
    });
    
    logger.info(`High contrast mode enabled with theme: ${themeName}`);
    
    return true;
  } catch (error) {
    logger.error(`Error applying high contrast theme: ${themeName}`, error);
    return false;
  }
}

/**
 * Remove high contrast mode and restore original theme
 * @returns {boolean} - True if successful
 */
export function removeHighContrast() {
  if (!_initialized || !_enabled) {
    return false;
  }
  
  try {
    // Clear custom styles
    _styleElement.textContent = '';
    
    // Remove body class
    document.body.classList.remove('high-contrast-mode');
    document.body.removeAttribute('data-high-contrast-theme');
    
    // Restore original theme if available
    if (_originalTheme) {
      // Implement theme restoration logic here
      // This will depend on your theming system
    }
    
    // Update state
    _enabled = false;
    _activeTheme = null;
    _config.enabled = false;
    
    // Save config
    ConfigManager.save('accessibility.highContrast', _config);
    
    // Publish event
    EventBus.publish('accessibility:highContrastDisabled');
    
    logger.info('High contrast mode disabled');
    
    return true;
  } catch (error) {
    logger.error('Error removing high contrast mode', error);
    return false;
  }
}

/**
 * Toggle high contrast mode
 * @param {string} [theme] - Theme to use when enabling
 * @returns {boolean} - New enabled state
 */
export function toggle(theme = null) {
  return _enabled ? removeHighContrast() : applyHighContrast(theme || _config.defaultTheme);
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  logger.info('Cleaning up high contrast mode');
  
  try {
    // Remove high contrast if enabled
    if (_enabled) {
      removeHighContrast();
    }
    
    // Remove style element
    if (_styleElement && _styleElement.parentNode) {
      _styleElement.parentNode.removeChild(_styleElement);
    }
    
    // Remove media query listener
    if (_mediaQueryList && _mediaQueryList.removeEventListener) {
      _mediaQueryList.removeEventListener('change', handleSystemHighContrastChange);
    }
    
    _initialized = false;
    _enabled = false;
    
    EventBus.publish('accessibility:highContrastCleanup');
    logger.info('High contrast mode cleaned up');
  } catch (error) {
    logger.error('Error during high contrast mode cleanup', error);
  }
}

/* Private Functions */

/**
 * Generate CSS for high contrast theme
 * @private
 * @param {Object} theme - Theme configuration
 * @returns {string} - Generated CSS
 */
function generateHighContrastCSS(theme) {
  return `
    /* High Contrast Mode: ${theme.name} */
    
    /* Base styles */
    body.high-contrast-mode {
      background-color: ${theme.background} !important;
      color: ${theme.foreground} !important;
    }
    
    body.high-contrast-mode * {
      background-image: none !important;
      text-shadow: none !important;
      box-shadow: none !important;
    }
    
    /* Text and links */
    body.high-contrast-mode h1,
    body.high-contrast-mode h2,
    body.high-contrast-mode h3,
    body.high-contrast-mode h4,
    body.high-contrast-mode h5,
    body.high-contrast-mode h6 {
      color: ${theme.headingColor} !important;
    }
    
    body.high-contrast-mode a,
    body.high-contrast-mode a:visited {
      color: ${theme.links} !important;
      text-decoration: underline !important;
    }
    
    body.high-contrast-mode a:hover,
    body.high-contrast-mode a:active {
      color: ${theme.links} !important;
      text-decoration: underline double !important;
    }
    
    /* Form elements */
    body.high-contrast-mode input,
    body.high-contrast-mode textarea,
    body.high-contrast-mode select {
      background-color: ${theme.background} !important;
      color: ${theme.foreground} !important;
      border: 1px solid ${theme.borderColor} !important;
    }
    
    body.high-contrast-mode input:focus,
    body.high-contrast-mode textarea:focus,
    body.high-contrast-mode select:focus {
      outline: 2px solid ${theme.focusOutline} !important;
    }
    
    /* Buttons */
    body.high-contrast-mode button,
    body.high-contrast-mode .button,
    body.high-contrast-mode input[type="button"],
    body.high-contrast-mode input[type="submit"] {
      background-color: ${theme.buttonBg} !important;
      color: ${theme.buttonFg} !important;
      border: 1px solid ${theme.borderColor} !important;
      text-decoration: none !important;
    }
    
    body.high-contrast-mode button:hover,
    body.high-contrast-mode .button:hover,
    body.high-contrast-mode input[type="button"]:hover,
    body.high-contrast-mode input[type="submit"]:hover {
      outline: 2px solid ${theme.focusOutline} !important;
    }
    
    /* Focus indicator */
    body.high-contrast-mode *:focus {
      outline: 2px solid ${theme.focusOutline} !important;
      outline-offset: 2px !important;
    }
    
    /* Status colors */
    body.high-contrast-mode .status-success,
    body.high-contrast-mode .text-success {
      color: ${theme.successColor} !important;
    }
    
    body.high-contrast-mode .status-error,
    body.high-contrast-mode .text-error {
      color: ${theme.errorColor} !important;
    }
    
    body.high-contrast-mode .status-warning,
    body.high-contrast-mode .text-warning {
      color: ${theme.warningColor} !important;
    }
    
    body.high-contrast-mode .status-info,
    body.high-contrast-mode .text-info {
      color: ${theme.infoColor} !important;
    }
    
    /* Borders and dividers */
    body.high-contrast-mode hr,
    body.high-contrast-mode .divider,
    body.high-contrast-mode .separator {
      border-color: ${theme.borderColor} !important;
      height: 1px !important;
      background-color: ${theme.borderColor} !important;
    }
    
    /* Tables */
    body.high-contrast-mode table,
    body.high-contrast-mode th,
    body.high-contrast-mode td {
      border: 1px solid ${theme.borderColor} !important;
    }
    
    body.high-contrast-mode th {
      background-color: ${theme.buttonBg} !important;
      color: ${theme.buttonFg} !important;
    }
    
    /* Icons and SVGs */
    body.high-contrast-mode svg,
    body.high-contrast-mode img[src*=".svg"] {
      filter: ${theme.background === '#000000' 
        ? 'invert(1) !important' 
        : 'none !important'};
    }
    
    /* ALEJO specific components */
    
    /* Health status indicators */
    body.high-contrast-mode .health-status-indicator {
      border: 1px solid ${theme.borderColor} !important;
    }
    
    body.high-contrast-mode .health-status-online {
      background-color: ${theme.successColor} !important;
      color: ${theme.background} !important;
    }
    
    body.high-contrast-mode .health-status-degraded {
      background-color: ${theme.warningColor} !important;
      color: ${theme.background} !important;
    }
    
    body.high-contrast-mode .health-status-error {
      background-color: ${theme.errorColor} !important;
      color: ${theme.background} !important;
    }
    
    body.high-contrast-mode .health-status-offline {
      background-color: ${theme.foreground} !important;
      color: ${theme.background} !important;
    }
    
    /* Resource dashboard */
    body.high-contrast-mode .resource-usage-bar {
      border: 1px solid ${theme.borderColor} !important;
    }
    
    body.high-contrast-mode .resource-usage-fill {
      background-color: ${theme.buttonBg} !important;
    }
    
    body.high-contrast-mode .resource-usage-critical {
      background-color: ${theme.errorColor} !important;
    }
    
    body.high-contrast-mode .resource-usage-warning {
      background-color: ${theme.warningColor} !important;
    }
    
    body.high-contrast-mode .resource-usage-normal {
      background-color: ${theme.successColor} !important;
    }
  `;
}

/**
 * Get current theme settings
 * @private
 * @returns {Object|null} - Current theme or null if not available
 */
function getCurrentTheme() {
  // This function would extract current theme settings from your theming system
  // The implementation will depend on how your theming is structured
  
  // Simplified example:
  const styles = window.getComputedStyle(document.body);
  
  return {
    background: styles.backgroundColor,
    foreground: styles.color,
    links: styles.getPropertyValue('--link-color') || '#0078d4',
    buttonBg: styles.getPropertyValue('--button-bg') || '#0078d4',
    buttonFg: styles.getPropertyValue('--button-fg') || '#ffffff'
  };
}

/**
 * Handle system high contrast mode change
 * @private
 * @param {MediaQueryListEvent} event - Media query change event
 */
function handleSystemHighContrastChange(event) {
  if (!_initialized || !_config.respectSystemSetting) {
    return;
  }
  
  if (event.matches) {
    // System enabled high contrast
    logger.info('System high contrast mode enabled');
    if (!_enabled) {
      applyHighContrast(_config.defaultTheme);
    }
  } else {
    // System disabled high contrast
    logger.info('System high contrast mode disabled');
    if (_enabled) {
      removeHighContrast();
    }
  }
}
