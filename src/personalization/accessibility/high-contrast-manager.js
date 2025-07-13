/**
 * ALEJO High Contrast Mode Manager
 * 
 * This module provides comprehensive high contrast mode support with:
 * - System preference detection (prefers-contrast media query)
 * - Multiple contrast themes (black-on-white, white-on-black, yellow-on-black, etc.)
 * - Customizable contrast intensity levels
 * - Dynamic CSS variable updates with context awareness
 * - Persistent user preferences with encrypted storage
 * - ARIA announcements for state changes
 * - Context-aware image and media handling for improved contrast
 * - Keyboard shortcut integration for fast toggling
 * - Focus enhancement for improved visibility in high contrast mode
 * - Resource-mode awareness for performance optimization
 * 
 * Resource-efficient implementation with minimal DOM manipulation.
 */

import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';
import { ariaManager } from './aria-manager.js';
import { ConfigManager } from '../../core/config-manager.js';
import KeyboardNavigationManager from './keyboard-navigation-manager.js';
import { ResourceAllocationManager, RESOURCE_MODES } from '../../performance/resource-allocation-manager.js';
import { adaptiveFeatureManager } from './adaptive-feature-manager.js';
import { localStorageManager } from '../../utils/local-storage-manager.js';
import { ErrorHandler } from '../../core/error/error-handler.js';

// Configuration constants
const CONFIG_KEY = 'accessibility.highContrast';
const HIGH_CONTRAST_CLASS = 'alejo-high-contrast';
const RESOURCE_COMPONENT_ID = 'accessibility.highContrastManager';
const STORAGE_KEY = 'alejo.accessibility.highContrast';

// Keyboard shortcut for toggling high contrast mode
const KEYBOARD_SHORTCUTS = {
  TOGGLE_HIGH_CONTRAST: 'Alt+H',
  CYCLE_THEMES: 'Alt+Shift+H'
};

// High contrast themes
const CONTRAST_THEMES = {
  WHITE_ON_BLACK: 'white-on-black',
  BLACK_ON_WHITE: 'black-on-white',
  YELLOW_ON_BLACK: 'yellow-on-black',
  YELLOW_ON_BLUE: 'yellow-on-blue',
  CUSTOM: 'custom'
};

// Contrast intensity levels
const CONTRAST_LEVELS = {
  STANDARD: 'standard',
  ENHANCED: 'enhanced',
  MAXIMUM: 'maximum'
};

// Theme color variables by theme type
const THEME_VARIABLES = {
  [CONTRAST_THEMES.WHITE_ON_BLACK]: {
    '--alejo-background': '#000000',
    '--alejo-foreground': '#ffffff',
    '--alejo-accent': '#ffffff',
    '--alejo-accent-secondary': '#eeeeee',
    '--alejo-warning': '#ffff00',
    '--alejo-error': '#ff6666',
    '--alejo-success': '#66ff66',
    '--alejo-border': '#ffffff',
    '--alejo-focus-outline': '#ffffff',
    '--alejo-text': '#ffffff',
    '--alejo-text-secondary': '#eeeeee',
    '--alejo-link': '#00ffff',
    '--alejo-link-visited': '#ffbbff',
    '--alejo-button-background': '#000000',
    '--alejo-button-text': '#ffffff',
    '--alejo-button-border': '#ffffff',
    '--alejo-input-background': '#000000',
    '--alejo-input-text': '#ffffff',
    '--alejo-input-border': '#ffffff'
  },
  [CONTRAST_THEMES.BLACK_ON_WHITE]: {
    '--alejo-background': '#ffffff',
    '--alejo-foreground': '#000000',
    '--alejo-accent': '#000000',
    '--alejo-accent-secondary': '#333333',
    '--alejo-warning': '#aa0000',
    '--alejo-error': '#ff0000',
    '--alejo-success': '#006600',
    '--alejo-border': '#000000',
    '--alejo-focus-outline': '#000000',
    '--alejo-text': '#000000',
    '--alejo-text-secondary': '#333333',
    '--alejo-link': '#0000ff',
    '--alejo-link-visited': '#660066',
    '--alejo-button-background': '#ffffff',
    '--alejo-button-text': '#000000',
    '--alejo-button-border': '#000000',
    '--alejo-input-background': '#ffffff',
    '--alejo-input-text': '#000000',
    '--alejo-input-border': '#000000'
  },
  [CONTRAST_THEMES.YELLOW_ON_BLACK]: {
    '--alejo-background': '#000000',
    '--alejo-foreground': '#ffff00',
    '--alejo-accent': '#ffff00',
    '--alejo-accent-secondary': '#ffffaa',
    '--alejo-warning': '#ff6600',
    '--alejo-error': '#ff0000',
    '--alejo-success': '#00ff00',
    '--alejo-border': '#ffff00',
    '--alejo-focus-outline': '#ffff00',
    '--alejo-text': '#ffff00',
    '--alejo-text-secondary': '#ffffaa',
    '--alejo-link': '#00ffff',
    '--alejo-link-visited': '#ff00ff',
    '--alejo-button-background': '#000000',
    '--alejo-button-text': '#ffff00',
    '--alejo-button-border': '#ffff00',
    '--alejo-input-background': '#000000',
    '--alejo-input-text': '#ffff00',
    '--alejo-input-border': '#ffff00'
  },
  [CONTRAST_THEMES.YELLOW_ON_BLUE]: {
    '--alejo-background': '#000066',
    '--alejo-foreground': '#ffff00',
    '--alejo-accent': '#ffff00',
    '--alejo-accent-secondary': '#ffffaa',
    '--alejo-warning': '#ff6600',
    '--alejo-error': '#ff0000',
    '--alejo-success': '#00ff00',
    '--alejo-border': '#ffffff',
    '--alejo-focus-outline': '#ffffff',
    '--alejo-text': '#ffff00',
    '--alejo-text-secondary': '#ffffff',
    '--alejo-link': '#00ffff',
    '--alejo-link-visited': '#ff00ff',
    '--alejo-button-background': '#000088',
    '--alejo-button-text': '#ffff00',
    '--alejo-button-border': '#ffffff',
    '--alejo-input-background': '#000088',
    '--alejo-input-text': '#ffff00',
    '--alejo-input-border': '#ffffff'
  }
};

// State
let isHighContrastEnabled = false;
let hasInitialized = false;
let styleElement = null;
let configManager = null;
let currentTheme = CONTRAST_THEMES.WHITE_ON_BLACK;
let currentLevel = CONTRAST_LEVELS.STANDARD;
let currentResourceMode = RESOURCE_MODES.NORMAL;
let isResourceRegistered = false;

/**
 * Initialize high contrast mode management
 * 
 * @param {Object} options - Initialization options
 * @param {boolean} options.detectSystemPreference - Whether to detect system preference
 * @param {boolean} options.applyImmediately - Whether to apply high contrast mode immediately
 * @param {string} options.defaultTheme - Default high contrast theme (from CONTRAST_THEMES)
 * @param {string} options.defaultLevel - Default contrast level (from CONTRAST_LEVELS)
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
async function initialize(options = {}) {
  if (hasInitialized) {
    return true;
  }
  
  try {
    // Set up configuration manager
    configManager = await ConfigManager.getInstance();
    
    // Create style element for dynamic CSS
    createStyleElement();
    
    // Register with resource allocation manager
    registerWithResourceManager();
    
    // Get stored preferences from secure storage
    await loadUserPreferences();
    
    // Apply default theme and level if provided
    if (options.defaultTheme && Object.values(CONTRAST_THEMES).includes(options.defaultTheme)) {
      currentTheme = options.defaultTheme;
    }
    
    if (options.defaultLevel && Object.values(CONTRAST_LEVELS).includes(options.defaultLevel)) {
      currentLevel = options.defaultLevel;
    }
    
    // Detect system preference if enabled
    if (options.detectSystemPreference !== false) {
      const systemPreference = detectSystemHighContrastPreference();
      if (systemPreference !== null && !hasStoredPreference()) {
        isHighContrastEnabled = systemPreference;
        
        // If system prefers high contrast and no theme is set, default to white-on-black
        if (systemPreference && !hasStoredTheme()) {
          currentTheme = CONTRAST_THEMES.WHITE_ON_BLACK;
        }
      }
      
      // Set up listener for system preference changes
      setupSystemPreferenceListener();
    }
    
    // Register keyboard shortcuts for high contrast toggling
    registerKeyboardShortcuts();
    
    // Apply high contrast if enabled and applyImmediately is true
    if (options.applyImmediately !== false && isHighContrastEnabled) {
      applyHighContrastSetting(isHighContrastEnabled);
    }
    
    // Set up event listeners for accessibility integration
    setupEventListeners();
    
    // Log initialization for audit trail
    auditTrail.log('accessibility', 'High contrast manager initialized', {
      enabled: isHighContrastEnabled,
      theme: currentTheme,
      level: currentLevel
    });
    
    hasInitialized = true;
    return true;
  } catch (error) {
    ErrorHandler.report('Error initializing high contrast mode', error);
    return false;
  }
}

/**
 * Register with the Resource Allocation Manager
 * 
 * @private
 */
function registerWithResourceManager() {
  if (isResourceRegistered) return;
  
  try {
    // Register as an essential accessibility component (high priority)
    ResourceAllocationManager.register({
      componentId: RESOURCE_COMPONENT_ID,
      componentType: 'accessibility',
      priority: 'high', // High priority for accessibility features
      resourceClaim: {
        cpu: 'low',
        memory: 'low',
        network: 'none',
        graphics: 'low'
      },
      adaptiveStrategy: (newMode) => {
        currentResourceMode = newMode;
        adaptToResourceMode(newMode);
        return true;
      }
    });
    
    isResourceRegistered = true;
    currentResourceMode = ResourceAllocationManager.getCurrentMode();
    
    auditTrail.log('performance', 'High contrast manager registered with resource manager', {
      resourceMode: currentResourceMode
    });
  } catch (error) {
    ErrorHandler.report('Failed to register high contrast manager with resource allocation manager', error);
  }
}

/**
 * Unregister from Resource Allocation Manager
 * 
 * @private
 */
function unregisterFromResourceManager() {
  if (!isResourceRegistered) return;
  
  try {
    ResourceAllocationManager.unregister(RESOURCE_COMPONENT_ID);
    isResourceRegistered = false;
    
    auditTrail.log('performance', 'High contrast manager unregistered from resource manager');
  } catch (error) {
    ErrorHandler.report('Failed to unregister high contrast manager from resource allocation manager', error);
  }
}

/**
 * Adapt functionality based on current resource mode
 * 
 * @private
 * @param {string} mode - New resource mode
 */
function adaptToResourceMode(mode) {
  switch (mode) {
    case RESOURCE_MODES.MINIMAL:
      // In minimal mode, disable animations and use simpler rendering
      if (isHighContrastEnabled) {
        // Use simpler theme application with fewer CSS variables
        updateThemeVariables(true);
      }
      break;
      
    case RESOURCE_MODES.CONSERVATIVE:
      // In conservative mode, reduce some effects but keep core functionality
      if (isHighContrastEnabled) {
        updateThemeVariables(false);
      }
      break;
      
    case RESOURCE_MODES.NORMAL:
    case RESOURCE_MODES.PERFORMANCE:
      // Full functionality
      if (isHighContrastEnabled) {
        updateThemeVariables(false);
      }
      break;
  }
}

/**
 * Load user preferences from secure storage
 * 
 * @private
 * @returns {Promise<void>}
 */
async function loadUserPreferences() {
  try {
    // Try to load from secure config manager first
    const savedSettings = await configManager.get(CONFIG_KEY);
    
    if (savedSettings) {
      if (typeof savedSettings === 'object') {
        // New format with theme and level
        isHighContrastEnabled = savedSettings.enabled === true;
        
        if (savedSettings.theme && Object.values(CONTRAST_THEMES).includes(savedSettings.theme)) {
          currentTheme = savedSettings.theme;
        }
        
        if (savedSettings.level && Object.values(CONTRAST_LEVELS).includes(savedSettings.level)) {
          currentLevel = savedSettings.level;
        }
      } else {
        // Legacy format (just boolean)
        isHighContrastEnabled = savedSettings === true;
      }
      return;
    }
    
    // Fall back to local storage if config manager has no data
    const localData = await localStorageManager.getItem(STORAGE_KEY);
    if (localData) {
      try {
        const parsedData = JSON.parse(localData);
        isHighContrastEnabled = parsedData.enabled === true;
        
        if (parsedData.theme && Object.values(CONTRAST_THEMES).includes(parsedData.theme)) {
          currentTheme = parsedData.theme;
        }
        
        if (parsedData.level && Object.values(CONTRAST_LEVELS).includes(parsedData.level)) {
          currentLevel = parsedData.level;
        }
      } catch (e) {
        // Handle legacy storage format (just boolean)
        isHighContrastEnabled = localData === 'true';
      }
    }
  } catch (error) {
    ErrorHandler.report('Error loading high contrast preferences', error);
  }
}

/**
 * Save user preferences to secure storage
 * 
 * @private
 * @returns {Promise<void>}
 */
async function saveUserPreferences() {
  try {
    // Save to config manager
    await configManager.set(CONFIG_KEY, {
      enabled: isHighContrastEnabled,
      theme: currentTheme,
      level: currentLevel
    });
    
    // Also save to local storage as backup
    await localStorageManager.setItem(STORAGE_KEY, JSON.stringify({
      enabled: isHighContrastEnabled,
      theme: currentTheme,
      level: currentLevel
    }));
    
    auditTrail.log('accessibility', 'High contrast preferences saved', {
      enabled: isHighContrastEnabled,
      theme: currentTheme,
      level: currentLevel
    });
  } catch (error) {
    ErrorHandler.report('Error saving high contrast preferences', error);
  }
}

/**
 * Check if user has stored high contrast preference
 * 
 * @private
 * @returns {boolean} Whether user has stored preference
 */
function hasStoredPreference() {
  return configManager && configManager.has(CONFIG_KEY);
}

/**
 * Check if user has stored theme preference
 * 
 * @private
 * @returns {boolean} Whether user has stored theme
 */
function hasStoredTheme() {
  return currentTheme !== CONTRAST_THEMES.WHITE_ON_BLACK;
}

/**
 * Register keyboard shortcuts for high contrast features
 * 
 * @private
 */
function registerKeyboardShortcuts() {
  try {
    // Register shortcut to toggle high contrast mode
    KeyboardNavigationManager.registerShortcut({
      id: 'highContrast.toggle',
      keys: KEYBOARD_SHORTCUTS.TOGGLE_HIGH_CONTRAST,
      description: 'Toggle high contrast mode',
      category: 'accessibility',
      action: () => {
        toggleHighContrast();
        return true;
      }
    });
    
    // Register shortcut to cycle through contrast themes
    KeyboardNavigationManager.registerShortcut({
      id: 'highContrast.cycleThemes',
      keys: KEYBOARD_SHORTCUTS.CYCLE_THEMES,
      description: 'Cycle through high contrast themes',
      category: 'accessibility',
      action: () => {
        cycleContrastThemes();
        return true;
      }
    });
    
    auditTrail.log('accessibility', 'High contrast keyboard shortcuts registered');
  } catch (error) {
    ErrorHandler.report('Error registering high contrast keyboard shortcuts', error);
  }
}

/**
 * Set up event listeners for accessibility integration
 * 
 * @private
 */
function setupEventListeners() {
  // Listen for accessibility settings changes
  eventEmitter.on('accessibility:high-contrast:toggle', toggleHighContrast);
  eventEmitter.on('accessibility:high-contrast:set', setHighContrast);
  eventEmitter.on('accessibility:high-contrast:theme', setContrastTheme);
  eventEmitter.on('accessibility:high-contrast:level', setContrastLevel);
  eventEmitter.on('theme:changed', () => updateThemeVariables(false));
  
  // Listen for adaptive feature manager changes
  adaptiveFeatureManager.on('feature:changed', (feature, enabled) => {
    if (feature === 'highContrast' && enabled !== isHighContrastEnabled) {
      setHighContrast(enabled);
    }
  });
}

/**
 * Create style element for dynamic CSS
 * 
 * @private
 */
function createStyleElement() {
  if (styleElement) return;
  
  styleElement = document.createElement('style');
  styleElement.id = 'alejo-high-contrast-styles';
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
  // Check resource mode to determine rendering approach
  const currentResourceMode = ResourceAllocationManager.getCurrentMode();
  const simplifiedRendering = currentResourceMode === RESOURCE_MODES.MINIMAL || 
                             currentResourceMode === RESOURCE_MODES.CONSERVATIVE;
  
  if (enable) {
    // Add class to html element
    document.documentElement.classList.add(HIGH_CONTRAST_CLASS);
    
    // Apply CSS variables with resource-aware rendering
    updateThemeVariables(simplifiedRendering);
    
    // Update images with appropriate alt text and high contrast versions
    // Skip image processing in minimal resource mode
    if (currentResourceMode !== RESOURCE_MODES.MINIMAL) {
      enhanceImagesForHighContrast(true);
    }
  } else {
    // Remove class from html element
    document.documentElement.classList.remove(HIGH_CONTRAST_CLASS);
    
    // Reset CSS variables
    styleElement.textContent = '';
    
    // Reset images to normal
    if (currentResourceMode !== RESOURCE_MODES.MINIMAL) {
      enhanceImagesForHighContrast(false);
    }
  }
  
  // Update ARIA properties
  ariaManager.updateProperty('highContrast', enable);
  
  // Announce to screen readers - always do this regardless of resource mode
  if (enable) {
    const announcement = `High contrast mode enabled with ${currentTheme.replace('-', ' ')} theme`;
    ariaManager.announce(announcement, 'assertive');
  } else {
    ariaManager.announce('High contrast mode disabled', 'assertive');
  }
  
  // Log for audit trail
  auditTrail.log('accessibility', `High contrast mode ${enable ? 'enabled' : 'disabled'}`, {
    theme: currentTheme,
    level: currentLevel,
    resourceMode: currentResourceMode
  });
}

/**
 * Update theme variables based on current settings
 * @private
 * @param {boolean} simplifiedRendering - Whether to use simplified rendering for low resource mode
 */
function updateThemeVariables(simplifiedRendering = false) {
  if (!styleElement) return;
  
  let css = '';
  
  if (isHighContrastEnabled) {
    const themeVars = THEME_VARIABLES[currentTheme] || THEME_VARIABLES[CONTRAST_THEMES.WHITE_ON_BLACK];
    
    // Apply contrast intensity adjustments
    const adjustedThemeVars = applyContrastIntensity(themeVars, currentLevel);
    
    // Set CSS variables
    css = ':root {\n';
    for (const [name, value] of Object.entries(adjustedThemeVars)) {
      css += `  ${name}: ${value};\n`;
    }
    css += '}\n';
    
    // Apply common high contrast styles
    css += generateHighContrastStyles(simplifiedRendering);
    
    // Apply theme-specific styles
    css += generateThemeSpecificStyles(currentTheme, simplifiedRendering);
  } else {
    css = '/* High contrast mode disabled */';
  }
  
  styleElement.textContent = css;
}

/**
 * Generate common high contrast styles
 * 
 * @private
 * @param {boolean} simplified - Whether to use simplified styling
 * @returns {string} - CSS styles
 */
function generateHighContrastStyles(simplified = false) {
  let css = '';
  
  // Set focus styles with enhanced visibility
  css += `\n.${HIGH_CONTRAST_CLASS} *:focus {\n`;
  css += `  outline: 3px solid var(--alejo-focus-outline) !important;\n`;
  css += `  outline-offset: ${simplified ? '1px' : '2px'} !important;\n`;
  css += `  box-shadow: ${simplified ? 'none' : '0 0 0 2px var(--alejo-background), 0 0 0 4px var(--alejo-focus-outline)'} !important;\n`;
  css += `}\n`;
  
  // Set button styles
  css += `\n.${HIGH_CONTRAST_CLASS} button {\n`;
  css += `  background-color: var(--alejo-button-background) !important;\n`;
  css += `  color: var(--alejo-button-text) !important;\n`;
  css += `  border: ${simplified ? '1px' : '2px'} solid var(--alejo-button-border) !important;\n`;
  css += `}\n`;
  
  // Set input styles
  css += `\n.${HIGH_CONTRAST_CLASS} input, .${HIGH_CONTRAST_CLASS} textarea, .${HIGH_CONTRAST_CLASS} select {\n`;
  css += `  background-color: var(--alejo-input-background) !important;\n`;
  css += `  color: var(--alejo-input-text) !important;\n`;
  css += `  border: ${simplified ? '1px' : '2px'} solid var(--alejo-input-border) !important;\n`;
  css += `}\n`;
  
  // Remove background images in simplified mode
  if (simplified) {
    css += `\n.${HIGH_CONTRAST_CLASS} [style*="background-image"] {\n`;
    css += `  background-image: none !important;\n`;
    css += `}\n`;
  }
  
  // Enhanced link styles
  css += `\n.${HIGH_CONTRAST_CLASS} a {\n`;
  css += `  color: var(--alejo-link) !important;\n`;
  css += `  text-decoration: underline !important;\n`;
  css += `}\n`;
  
  css += `\n.${HIGH_CONTRAST_CLASS} a:visited {\n`;
  css += `  color: var(--alejo-link-visited) !important;\n`;
  css += `}\n`;
  
  return css;
}

/**
 * Generate theme-specific styles
 * 
 * @private
 * @param {string} theme - Theme name
 * @param {boolean} simplified - Whether to use simplified styling
 * @returns {string} - CSS styles
 */
function generateThemeSpecificStyles(theme, simplified = false) {
  let css = '';
  
  switch (theme) {
    case CONTRAST_THEMES.YELLOW_ON_BLACK:
      // Add specific styles for yellow-on-black theme
      css += `\n.${HIGH_CONTRAST_CLASS} .alejo-warning-icon {\n`;
      css += `  color: var(--alejo-warning) !important;\n`;
      css += `  background-color: transparent !important;\n`;
      css += `}\n`;
      break;
      
    case CONTRAST_THEMES.BLACK_ON_WHITE:
      // Add specific styles for black-on-white theme
      if (!simplified) {
        css += `\n.${HIGH_CONTRAST_CLASS} .alejo-icon {\n`;
        css += `  filter: grayscale(100%) contrast(150%) !important;\n`;
        css += `}\n`;
      }
      break;
      
    case CONTRAST_THEMES.YELLOW_ON_BLUE:
      // Add specific styles for yellow-on-blue theme
      css += `\n.${HIGH_CONTRAST_CLASS} .alejo-card {\n`;
      css += `  border: ${simplified ? '1px' : '2px'} solid var(--alejo-border) !important;\n`;
      css += `}\n`;
      break;
  }
  
  return css;
}

/**
 * Apply contrast intensity to theme variables
 * 
 * @private
 * @param {Object} themeVars - Theme variables
 * @param {string} level - Contrast intensity level
 * @returns {Object} - Adjusted theme variables
 */
function applyContrastIntensity(themeVars, level) {
  const result = { ...themeVars };
  
  // Standard level uses base theme
  if (level === CONTRAST_LEVELS.STANDARD) {
    return result;
  }
  
  // For enhanced and maximum levels, adjust contrast
  const isBrightBackground = isColorBright(themeVars['--alejo-background']);
  
  if (level === CONTRAST_LEVELS.ENHANCED) {
    // Enhance contrast by adjusting colors
    if (isBrightBackground) {
      // For bright backgrounds, darken text
      result['--alejo-text'] = '#000000';
      result['--alejo-text-secondary'] = '#222222';
      result['--alejo-border'] = '#000000';
    } else {
      // For dark backgrounds, brighten text
      result['--alejo-text'] = '#ffffff';
      result['--alejo-text-secondary'] = '#ffffff';
      result['--alejo-border'] = '#ffffff';
    }
  } else if (level === CONTRAST_LEVELS.MAXIMUM) {
    // Maximum contrast (usually black and white or yellow on black)
    if (currentTheme === CONTRAST_THEMES.YELLOW_ON_BLACK) {
      // Already high contrast, just ensure pure colors
      result['--alejo-background'] = '#000000';
      result['--alejo-text'] = '#ffff00';
      result['--alejo-border'] = '#ffff00';
    } else if (isBrightBackground) {
      // For bright backgrounds, use pure black text
      result['--alejo-background'] = '#ffffff';
      result['--alejo-text'] = '#000000';
      result['--alejo-text-secondary'] = '#000000';
      result['--alejo-border'] = '#000000';
      result['--alejo-focus-outline'] = '#000000';
    } else {
      // For dark backgrounds, use pure white text
      result['--alejo-background'] = '#000000';
      result['--alejo-text'] = '#ffffff';
      result['--alejo-text-secondary'] = '#ffffff';
      result['--alejo-border'] = '#ffffff';
      result['--alejo-focus-outline'] = '#ffffff';
    }
  }
  
  return result;
}

/**
 * Determine if a color is bright or dark
 * 
 * @private
 * @param {string} color - Hex color code
 * @returns {boolean} - True if color is bright, false if dark
 */
function isColorBright(color) {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) {
    return true; // Default to bright if invalid color
  }
  
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Convert hex to RGB
  let r, g, b;
  if (hex.length === 3) {
    // Short notation like #FFF
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    // Standard notation like #FFFFFF
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  // Calculate relative luminance using the formula
  // Luminance = 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if color is bright (luminance > 0.5)
  return luminance > 0.5;
}

/**
 * Lighten a hex color
 * 
 * @private
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} - Lightened color as hex
 */
function lightenColor(color, percent) {
  // Remove # if present
  let hex = color.replace('#', '');
  
  // Convert to RGB
  let r, g, b;
  if (hex.length === 3) {
    // Short notation
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    // Standard notation
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  // Calculate new values
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a hex color
 * 
 * @private
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} - Darkened color as hex
 */
function darkenColor(color, percent) {
  // Remove # if present
  let hex = color.replace('#', '');
  
  // Convert to RGB
  let r, g, b;
  if (hex.length === 3) {
    // Short notation
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    // Standard notation
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  // Calculate new values
  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Check if a color is bright
 * @private
 * @param {string} color - Color value (e.g. #ffffff)
 * @returns {boolean} Whether the color is bright
 */
function isColorBright(color) {
  const hex = color.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Simple brightness check: if any channel is above 128, consider it bright
  return r > 128 || g > 128 || b > 128;
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
 * Cycle through available contrast themes
 * @returns {string} New theme name
 */
function cycleContrastThemes() {
  if (!isHighContrastEnabled) {
    // Enable high contrast with first theme when cycling from off state
    setHighContrast(true);
    return currentTheme;
  }
  
  // Get all available themes
  const themes = Object.values(CONTRAST_THEMES);
  const currentIndex = themes.indexOf(currentTheme);
  
  // Get next theme (or wrap around to first theme)
  const nextIndex = (currentIndex + 1) % themes.length;
  const nextTheme = themes[nextIndex];
  
  // Set the new theme
  setContrastTheme(nextTheme);
  
  // Announce theme change to screen readers
  ariaManager.announce(`High contrast theme changed to ${nextTheme.replace('-', ' ')}`, 'polite');
  
  return nextTheme;
}

/**
 * Set the contrast theme
 * @param {string} theme - Theme name from CONTRAST_THEMES
 * @returns {boolean} Success status
 */
function setContrastTheme(theme) {
  if (!Object.values(CONTRAST_THEMES).includes(theme)) {
    return false;
  }
  
  currentTheme = theme;
  
  if (isHighContrastEnabled) {
    updateThemeVariables(false);
  }
  
  // Save user preference
  saveUserPreferences();
  
  // Emit event about theme change
  eventEmitter.emit('accessibility:high-contrast:theme-changed', theme);
  
  // Log for audit trail
  auditTrail.log('accessibility', 'High contrast theme changed', {
    theme: theme,
    level: currentLevel,
    enabled: isHighContrastEnabled
  });
  
  return true;
}

/**
 * Set the contrast intensity level
 * @param {string} level - Level name from CONTRAST_LEVELS
 * @returns {boolean} Success status
 */
function setContrastLevel(level) {
  if (!Object.values(CONTRAST_LEVELS).includes(level)) {
    return false;
  }
  
  currentLevel = level;
  
  if (isHighContrastEnabled) {
    updateThemeVariables(false);
  }
  
  // Save user preference
  saveUserPreferences();
  
  // Emit event about level change
  eventEmitter.emit('accessibility:high-contrast:level-changed', level);
  
  // Log for audit trail
  auditTrail.log('accessibility', 'High contrast level changed', {
    theme: currentTheme,
    level: level,
    enabled: isHighContrastEnabled
  });
  
  return true;
}

/**
 * Set high contrast mode to a specific state
 * 
 * @param {boolean} enable Whether to enable high contrast mode
 * @returns {boolean} New high contrast state
 */
function setHighContrast(enable) {
  if (typeof enable !== 'boolean') {
    return isHighContrastEnabled;
  }
  
  if (enable === isHighContrastEnabled) {
    return isHighContrastEnabled;
  }
  
  isHighContrastEnabled = enable;
  
  // Apply the high contrast settings
  applyHighContrastSetting(enable);
  
  // Store user preference
  saveUserPreferences();
  
  // Emit event
  eventEmitter.emit('accessibility:high-contrast:changed', {
    enabled: enable,
    theme: currentTheme,
    level: currentLevel
  });
  
  // Update adaptive feature manager
  adaptiveFeatureManager.setFeatureEnabled('highContrast', enable);
  
  // Make screen reader announcement
  const announcement = enable 
    ? `High contrast mode enabled with ${currentTheme.replace('-', ' ')} theme` 
    : 'High contrast mode disabled';
  ariaManager.announce(announcement, 'assertive');
  
  // Log for audit trail
  auditTrail.log('accessibility', `High contrast mode ${enable ? 'enabled' : 'disabled'}`, {
    theme: currentTheme,
    level: currentLevel
  });
  
  return isHighContrastEnabled;
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
  cycleContrastThemes,
  setContrastTheme,
  setContrastLevel,
  setHighContrast,
  isHighContrastMode,
  addHighContrastImage
};
