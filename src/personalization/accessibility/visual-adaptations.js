/**
 * ALEJO Visual Adaptations
 * 
 * This module provides comprehensive visual accessibility adaptations:
 * - Font scaling and size adjustment
 * - High contrast mode with customizable themes
 * - Color blindness accommodations (protanopia, deuteranopia, tritanopia)
 * - Motion reduction for animations and transitions
 * - Spacing adjustments for improved readability
 * 
 * Designed to work with the existing font-scaling-manager, high-contrast-manager,
 * and color-blindness-manager components, this module provides a unified API for
 * managing all visual adaptations in ALEJO.
 * 
 * @module personalization/accessibility/visual-adaptations
 */

import { EventBus } from '../../core/events/event-bus.js';
import { Logger } from '../../core/logger/logger.js';
import { fontScalingManager } from './font-scaling-manager.js';
import { highContrastManager } from './high-contrast-manager.js';
import { colorBlindnessManager } from './color-blindness-manager.js';

// Default visual adaptation settings
const DEFAULT_SETTINGS = {
  // Font settings
  fontSize: 100, // Percentage of base font size (100 = normal)
  lineSpacing: 1.5, // Line height multiplier
  letterSpacing: 0, // Letter spacing in pixels
  fontFamily: null, // Custom font family or null for default
  
  // Contrast settings
  highContrast: false, // Enable high contrast mode
  contrastTheme: 'light', // light, dark, black-on-white, yellow-on-black
  contrastLevel: 'standard', // standard, enhanced, maximum
  
  // Color adaptation settings
  colorBlindnessMode: 'none', // none, protanopia, deuteranopia, tritanopia
  colorBlindnessIntensity: 100, // Percentage of adaptation (0-100)
  
  // Motion and animation settings
  reduceMotion: false, // Reduce or eliminate animations
  reduceTransparency: false, // Reduce or eliminate transparency effects
  
  // Additional adaptations
  increaseCursorSize: false, // Use larger cursor
  boldText: false, // Make all text bold
  highlightFocus: true, // Highlight focused elements
  increaseSpacing: false, // Increase spacing between elements
};

/**
 * Visual Adaptations Manager Class
 */
class VisualAdaptationsManager {
  /**
   * Create a new VisualAdaptationsManager instance
   */
  constructor() {
    this.initialized = false;
    this.eventBus = null;
    this.logger = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.styleElement = null;
    this.observedElements = new WeakMap();
    this.styleObserver = null;
    this.userOverrides = {};
    this.osSettings = {};
  }

  /**
   * Get singleton instance
   * @returns {VisualAdaptationsManager} Singleton instance
   */
  static getInstance() {
    if (!VisualAdaptationsManager.instance) {
      VisualAdaptationsManager.instance = new VisualAdaptationsManager();
    }
    return VisualAdaptationsManager.instance;
  }

  /**
   * Initialize the Visual Adaptations Manager
   * @param {Object} options - Initialization options
   * @param {boolean} options.detectOsSettings - Whether to detect OS accessibility settings
   * @param {boolean} options.applyImmediately - Apply adaptations immediately after initialization
   * @param {Object} options.initialSettings - Initial adaptation settings
   * @param {Array<string>} options.enabledFeatures - List of features to enable
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }

      const defaultOptions = {
        detectOsSettings: true,
        applyImmediately: true,
        initialSettings: {},
        enabledFeatures: [
          'fontSize', 
          'highContrast', 
          'colorBlindness',
          'reduceMotion',
          'highlightFocus'
        ]
      };

      const finalOptions = { ...defaultOptions, ...options };

      this.eventBus = EventBus.getInstance();
      this.logger = new Logger('VisualAdaptationsManager');

      // Create style element for custom styles
      this._createStyleElement();

      // Detect OS settings if enabled
      if (finalOptions.detectOsSettings) {
        await this._detectOsAccessibilitySettings();
      }

      // Initialize sub-managers
      await this._initializeSubManagers();

      // Set initial settings
      if (Object.keys(finalOptions.initialSettings).length > 0) {
        this.settings = { ...this.settings, ...finalOptions.initialSettings };
      }

      // Set up media query listeners
      this._setupMediaQueryListeners();

      // Set up DOM mutation observer
      this._setupMutationObserver();

      // Apply adaptations immediately if enabled
      if (finalOptions.applyImmediately) {
        await this.applyAllAdaptations();
      }

      this.initialized = true;
      this.eventBus.publish('accessibility:visual-adaptations:initialized', { 
        success: true,
        settings: this.settings
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Visual Adaptations Manager', error);
      this.eventBus.publish('accessibility:visual-adaptations:initialized', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Create style element for custom styles
   * @private
   */
  _createStyleElement() {
    // Remove existing style element if it exists
    if (this.styleElement && document.head.contains(this.styleElement)) {
      document.head.removeChild(this.styleElement);
    }

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'alejo-visual-adaptations';
    this.styleElement.setAttribute('data-alejo-component', 'visual-adaptations');
    document.head.appendChild(this.styleElement);
  }

  /**
   * Detect OS/browser accessibility settings
   * @private
   */
  async _detectOsAccessibilitySettings() {
    try {
      // Detect prefers-reduced-motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.osSettings.reduceMotion = prefersReducedMotion.matches;

      // Detect prefers-contrast
      const prefersHighContrast = window.matchMedia('(prefers-contrast: more)');
      this.osSettings.highContrast = prefersHighContrast.matches;

      // Detect prefers-color-scheme
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
      this.osSettings.darkMode = prefersDarkMode.matches;

      // Detect forced-colors mode (high contrast in Windows)
      const forcedColors = window.matchMedia('(forced-colors: active)');
      this.osSettings.forcedColors = forcedColors.matches;

      this.logger.info('Detected OS accessibility settings:', this.osSettings);

      // Apply OS settings if no user overrides exist
      if (!this.userOverrides.reduceMotion) {
        this.settings.reduceMotion = this.osSettings.reduceMotion;
      }

      if (!this.userOverrides.highContrast) {
        this.settings.highContrast = this.osSettings.highContrast || this.osSettings.forcedColors;
        if (this.settings.highContrast && this.osSettings.darkMode) {
          this.settings.contrastTheme = 'dark';
        }
      }
    } catch (error) {
      this.logger.warn('Failed to detect OS accessibility settings', error);
    }
  }

  /**
   * Initialize font-scaling, high-contrast, and color-blindness managers
   * @private
   */
  async _initializeSubManagers() {
    try {
      // Initialize font scaling manager
      await fontScalingManager.initialize({
        applyImmediately: false,
        initialScale: this.settings.fontSize / 100
      }).catch(error => {
        this.logger.warn('Failed to initialize font scaling manager', error);
        return null;
      });

      // Initialize high contrast manager
      await highContrastManager.initialize({
        applyImmediately: false,
        initialMode: this.settings.highContrast ? this.settings.contrastTheme : 'none'
      }).catch(error => {
        this.logger.warn('Failed to initialize high contrast manager', error);
        return null;
      });

      // Initialize color blindness manager
      await colorBlindnessManager.initialize({
        applyImmediately: false,
        initialMode: this.settings.colorBlindnessMode,
        intensity: this.settings.colorBlindnessIntensity
      }).catch(error => {
        this.logger.warn('Failed to initialize color blindness manager', error);
        return null;
      });

      // Subscribe to events from sub-managers
      this.eventBus.subscribe('accessibility:font-scaling:changed', this._onFontScalingChanged.bind(this));
      this.eventBus.subscribe('accessibility:high-contrast:changed', this._onHighContrastChanged.bind(this));
      this.eventBus.subscribe('accessibility:color-blindness:changed', this._onColorBlindnessChanged.bind(this));
    } catch (error) {
      this.logger.error('Failed to initialize sub-managers', error);
      throw error;
    }
  }

  /**
   * Set up media query listeners for system preference changes
   * @private
   */
  _setupMediaQueryListeners() {
    try {
      // Listen for reduced motion preference changes
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionQuery.addEventListener('change', (event) => {
        this.osSettings.reduceMotion = event.matches;
        
        if (!this.userOverrides.reduceMotion) {
          this.settings.reduceMotion = event.matches;
          this._applyReducedMotion();
          this.eventBus.publish('accessibility:reduce-motion:changed', { 
            enabled: event.matches, 
            source: 'os-preference'
          });
        }
      });

      // Listen for high contrast preference changes
      const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
      highContrastQuery.addEventListener('change', (event) => {
        this.osSettings.highContrast = event.matches;
        
        if (!this.userOverrides.highContrast) {
          this.settings.highContrast = event.matches;
          this._applyHighContrast();
          this.eventBus.publish('accessibility:high-contrast:changed', { 
            enabled: event.matches, 
            source: 'os-preference'
          });
        }
      });

      // Listen for dark mode preference changes
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkModeQuery.addEventListener('change', (event) => {
        this.osSettings.darkMode = event.matches;
        
        if (this.settings.highContrast && !this.userOverrides.contrastTheme) {
          this.settings.contrastTheme = event.matches ? 'dark' : 'light';
          this._applyHighContrast();
        }
      });

      // Listen for forced colors mode changes
      const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
      forcedColorsQuery.addEventListener('change', (event) => {
        this.osSettings.forcedColors = event.matches;
        
        if (!this.userOverrides.highContrast) {
          this.settings.highContrast = this.settings.highContrast || event.matches;
          this._applyHighContrast();
        }
      });
    } catch (error) {
      this.logger.warn('Failed to set up media query listeners', error);
    }
  }

  /**
   * Set up DOM mutation observer to handle dynamically added content
   * @private
   */
  _setupMutationObserver() {
    try {
      this.styleObserver = new MutationObserver((mutations) => {
        let needsUpdate = false;
        
        for (const mutation of mutations) {
          // Look for added nodes that might contain styles
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.tagName === 'STYLE' || node.tagName === 'LINK') {
                needsUpdate = true;
                break;
              }
            }
          }
        }
        
        if (needsUpdate) {
          // Reapply adaptations to handle new styles
          this.applyAllAdaptations();
        }
      });
      
      // Start observing document head for style changes
      if (document.head) {
        this.styleObserver.observe(document.head, {
          childList: true,
          subtree: true
        });
      }
    } catch (error) {
      this.logger.warn('Failed to set up mutation observer', error);
    }
  }

  /**
   * Handle font scaling changes from font scaling manager
   * @param {Object} data - Event data
   * @private
   */
  _onFontScalingChanged(data) {
    if (data && typeof data.scale === 'number') {
      this.settings.fontSize = data.scale * 100;
      this.userOverrides.fontSize = true;
      
      // Update UI if needed
      this.eventBus.publish('accessibility:visual-adaptations:updated', {
        type: 'fontSize',
        value: this.settings.fontSize
      });
    }
  }

  /**
   * Handle high contrast changes from high contrast manager
   * @param {Object} data - Event data
   * @private
   */
  _onHighContrastChanged(data) {
    if (data) {
      this.settings.highContrast = data.enabled;
      
      if (data.theme) {
        this.settings.contrastTheme = data.theme;
      }
      
      this.userOverrides.highContrast = true;
      this.userOverrides.contrastTheme = true;
      
      // Update UI if needed
      this.eventBus.publish('accessibility:visual-adaptations:updated', {
        type: 'highContrast',
        enabled: this.settings.highContrast,
        theme: this.settings.contrastTheme
      });
    }
  }

  /**
   * Handle color blindness changes from color blindness manager
   * @param {Object} data - Event data
   * @private
   */
  _onColorBlindnessChanged(data) {
    if (data) {
      this.settings.colorBlindnessMode = data.mode || 'none';
      
      if (data.intensity !== undefined) {
        this.settings.colorBlindnessIntensity = data.intensity;
      }
      
      this.userOverrides.colorBlindnessMode = true;
      this.userOverrides.colorBlindnessIntensity = true;
      
      // Update UI if needed
      this.eventBus.publish('accessibility:visual-adaptations:updated', {
        type: 'colorBlindness',
        mode: this.settings.colorBlindnessMode,
        intensity: this.settings.colorBlindnessIntensity
      });
    }
  }

  /**
   * Apply all visual adaptations
   * @returns {Promise<boolean>} Success status
   */
  async applyAllAdaptations() {
    try {
      // Apply each adaptation
      await this._applyFontScaling();
      await this._applyHighContrast();
      await this._applyColorBlindnessMode();
      this._applyReducedMotion();
      this._applyAdditionalAdaptations();
      
      this.eventBus.publish('accessibility:visual-adaptations:applied', {
        settings: { ...this.settings }
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply all adaptations', error);
      return false;
    }
  }

  /**
   * Apply font scaling
   * @private
   */
  async _applyFontScaling() {
    try {
      // Use font scaling manager to apply font size
      await fontScalingManager.setScale(this.settings.fontSize / 100);
      
      // Apply additional font settings
      let css = '';
      
      if (this.settings.lineSpacing !== 1.5) {
        css += `
          body {
            line-height: ${this.settings.lineSpacing};
          }
        `;
      }
      
      if (this.settings.letterSpacing !== 0) {
        css += `
          body {
            letter-spacing: ${this.settings.letterSpacing}px;
          }
        `;
      }
      
      if (this.settings.fontFamily) {
        css += `
          body {
            font-family: ${this.settings.fontFamily}, system-ui, sans-serif;
          }
        `;
      }
      
      if (this.settings.boldText) {
        css += `
          p, li, a, span, div, button, input, select, textarea {
            font-weight: bold !important;
          }
        `;
      }
      
      this._updateCustomStyles('font-settings', css);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply font scaling', error);
      return false;
    }
  }

  /**
   * Apply high contrast mode
   * @private
   */
  async _applyHighContrast() {
    try {
      // Use high contrast manager to apply high contrast mode
      const enabled = this.settings.highContrast;
      const theme = this.settings.contrastTheme;
      
      await highContrastManager.setHighContrast(enabled, theme);
      
      // Apply additional contrast settings
      if (enabled && this.settings.contrastLevel !== 'standard') {
        let css = '';
        
        if (this.settings.contrastLevel === 'enhanced') {
          css = `
            :root {
              --contrast-ratio: 10 !important;
            }
          `;
        } else if (this.settings.contrastLevel === 'maximum') {
          css = `
            :root {
              --contrast-ratio: 21 !important;
            }
          `;
        }
        
        this._updateCustomStyles('high-contrast-level', css);
      }
      
      this._applyHighContrastStyles();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply high contrast mode', error);
      return false;
    }
  }

  /**
   * Apply high contrast styles based on current theme
   * @private
   */
  _applyHighContrastStyles() {
    let css = '';
    
    switch (this.settings.contrastTheme) {
      case 'light':
        css = `
          :root {
            --alejo-bg: #ffffff;
            --alejo-text: #000000;
            --alejo-primary: #0066cc;
            --alejo-border: #000000;
          }
        `;
        break;
      case 'dark':
        css = `
          :root {
            --alejo-bg: #000000;
            --alejo-text: #ffffff;
            --alejo-primary: #4da6ff;
            --alejo-border: #ffffff;
          }
        `;
        break;
      case 'black-on-white':
        css = `
          :root {
            --alejo-bg: #ffffff;
            --alejo-text: #000000;
            --alejo-primary: #000000;
            --alejo-border: #000000;
          }
        `;
        break;
      case 'yellow-on-black':
        css = `
          :root {
            --alejo-bg: #000000;
            --alejo-text: #ffff00;
            --alejo-primary: #ffff00;
            --alejo-border: #ffff00;
          }
        `;
        break;
      default:
        css = '';
    }
    
    // Add or update the high contrast style element
    let styleElement = document.getElementById('alejo-high-contrast-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'alejo-high-contrast-styles';
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;
    
    if (this.settings.highContrast) {
      document.documentElement.setAttribute('data-alejo-high-contrast', this.settings.contrastTheme);
    } else {
      document.documentElement.removeAttribute('data-alejo-high-contrast');
    }
  }

  /**
   * Apply color blindness adaptations
   * @private
   */
  async _applyColorBlindnessMode() {
    try {
      // Use color blindness manager to apply color blindness mode
      const mode = this.settings.colorBlindnessMode;
      const intensity = this.settings.colorBlindnessIntensity;
      
      await colorBlindnessManager.setColorBlindnessMode(mode, intensity);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply color blindness mode', error);
      return false;
    }
  }

  /**
   * Apply reduced motion
   * @private
   */
  _applyReducedMotion() {
    try {
      if (this.settings.reduceMotion) {
        const css = `
          *, ::before, ::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        `;
        
        this._updateCustomStyles('reduced-motion', css);
      } else {
        this._updateCustomStyles('reduced-motion', '');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply reduced motion', error);
      return false;
    }
  }

  /**
   * Apply additional adaptations (cursor size, focus highlighting, spacing)
   * @private
   */
  _applyAdditionalAdaptations() {
    try {
      let css = '';
      
      // Larger cursor
      if (this.settings.increaseCursorSize) {
        css += `
          * {
            cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><path fill="black" stroke="white" stroke-width="1" d="M1 1 L14 8 L9 9 L7 14 Z"/></svg>') 8 8, auto;
          }
          a, button, input[type="button"], input[type="submit"], [role="button"], [tabindex]:not([tabindex="-1"]) {
            cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><path fill="black" stroke="white" stroke-width="1" d="M1 1 L1 15 L5 11 L9 15 L15 1 Z"/></svg>') 8 8, pointer;
          }
        `;
      }
      
      // Focus highlighting
      if (this.settings.highlightFocus) {
        css += `
          :focus {
            outline: 3px solid #4299e1 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5) !important;
          }
          
          :focus:not(:focus-visible) {
            outline: none !important;
            box-shadow: none !important;
          }
          
          :focus-visible {
            outline: 3px solid #4299e1 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5) !important;
          }
        `;
      }
      
      // Increased spacing
      if (this.settings.increaseSpacing) {
        css += `
          p, li, div, h1, h2, h3, h4, h5, h6, button, input, select, textarea {
            margin-bottom: 1.5em !important;
          }
          
          a, button, input, select, label {
            padding: 0.5em !important;
            margin: 0.25em !important;
          }
          
          form > * {
            margin-bottom: 1.5em !important;
          }
        `;
      }
      
      this._updateCustomStyles('additional-adaptations', css);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to apply additional adaptations', error);
      return false;
    }
  }

  /**
   * Update custom styles in the style element
   * @param {string} key - Section identifier
   * @param {string} css - CSS styles
   * @private
   */
  _updateCustomStyles(key, css) {
    if (!this.styleElement) {
      this._createStyleElement();
    }
    
    // Find or create the section
    const sectionStart = `/* BEGIN ${key} */`;
    const sectionEnd = `/* END ${key} */`;
    
    const styleContent = this.styleElement.textContent;
    const startIndex = styleContent.indexOf(sectionStart);
    const endIndex = styleContent.indexOf(sectionEnd);
    
    let newContent = '';
    
    if (startIndex >= 0 && endIndex >= 0) {
      // Replace existing section
      newContent = styleContent.substring(0, startIndex) +
                  sectionStart + '\n' +
                  css + '\n' +
                  sectionEnd +
                  styleContent.substring(endIndex + sectionEnd.length);
    } else {
      // Add new section
      newContent = styleContent + '\n' +
                  sectionStart + '\n' +
                  css + '\n' +
                  sectionEnd + '\n';
    }
    
    this.styleElement.textContent = newContent;
  }

  /**
   * Update a setting and apply the changes
   * @param {string} key - The setting key
   * @param {*} value - The new value
   */
  updateSetting(key, value) {
    if (this.settings[key] === value) return;
    
    this.settings[key] = value;
    
    switch (key) {
      case 'highContrast':
        this._applyHighContrast();
        break;
      case 'contrastTheme':
        if (this.settings.highContrast) {
          this._applyHighContrast();
        }
        break;
      // Add other settings as needed
    }
    
    this._saveSettings();
  }

  /**
   * Save current settings to storage
   * @private
   */
  _saveSettings() {
    // Save to localStorage for now
    localStorage.setItem('alejo-visual-adaptations', JSON.stringify(this.settings));
  }

  /**
   * Get current adaptation settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get detected OS accessibility settings
   * @returns {Object} OS settings
   */
  getOsSettings() {
    return { ...this.osSettings };
  }

  /**
   * Check if a specific feature is supported
   * @param {string} feature - Feature name
   * @returns {boolean} Whether feature is supported
   */
  isFeatureSupported(feature) {
    switch (feature) {
      case 'fontSize':
        return !!fontScalingManager;
        
      case 'highContrast':
        return !!highContrastManager;
        
      case 'colorBlindness':
        return !!colorBlindnessManager;
        
      case 'reduceMotion':
        return typeof window !== 'undefined' && 
               window.matchMedia && 
               window.matchMedia('(prefers-reduced-motion)').media !== 'not all';
        
      default:
        return true;
    }
  }

  /**
   * Destroy the visual adaptations manager
   */
  destroy() {
    // Stop observers
    if (this.styleObserver) {
      this.styleObserver.disconnect();
      this.styleObserver = null;
    }
    
    // Remove style element
    if (this.styleElement && document.head.contains(this.styleElement)) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    }
    
    this.initialized = false;
  }
}

// High contrast mode implementation
export function enableHighContrastMode() {
  document.documentElement.style.setProperty('--text-color', '#FFFFFF');
  document.documentElement.style.setProperty('--background-color', '#000000');
  document.documentElement.style.setProperty('--primary-color', '#FFFF00');
  document.documentElement.style.setProperty('--secondary-color', '#FFA500');
  document.documentElement.style.setProperty('--border-color', '#FFFFFF');
  
  // Add high-contrast class to body
  document.body.classList.add('high-contrast');
  
  // Announce the change
  if (window.accessibilityAnnouncements) {
    window.accessibilityAnnouncements.announce('High contrast mode enabled');
  }
}

export function disableHighContrastMode() {
  document.documentElement.style.removeProperty('--text-color');
  document.documentElement.style.removeProperty('--background-color');
  document.documentElement.style.removeProperty('--primary-color');
  document.documentElement.style.removeProperty('--secondary-color');
  document.documentElement.style.removeProperty('--border-color');
  
  // Remove high-contrast class
  document.body.classList.remove('high-contrast');
  
  // Announce the change
  if (window.accessibilityAnnouncements) {
    window.accessibilityAnnouncements.announce('High contrast mode disabled');
  }
}

export function toggleHighContrastMode() {
  if (document.body.classList.contains('high-contrast')) {
    disableHighContrastMode();
  } else {
    enableHighContrastMode();
  }
}

// Create singleton instance
const instance = VisualAdaptationsManager.getInstance();

export { instance as VisualAdaptationsManager };
export default instance;
