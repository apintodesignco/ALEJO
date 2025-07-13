/**
 * @file screen-reader-integration.js
 * @description Core module for screen reader integration and accessibility features
 * @module accessibility/screen-reader-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { AuditTrail } from '../core/utils/audit-trail.js';
import { ConfigManager } from '../core/config/config-manager.js';

// Import submodules (will be created separately)
import * as AriaManager from './aria-manager.js';
import * as KeyboardNavigation from './keyboard-navigation.js';
import * as AnnouncementService from './announcement-service.js';

// Initialize logger
const logger = new Logger('ScreenReaderIntegration');
const auditTrail = new AuditTrail('accessibility');

// Module state
let _initialized = false;
let _enabled = false;
let _detectedScreenReader = null;
let _config = null;

// Default configuration
const DEFAULT_CONFIG = {
  // Whether to enable screen reader integration by default
  enabled: true,
  
  // Automatic detection settings
  detection: {
    // Whether to detect screen readers automatically
    enabled: true,
    // Interval (ms) between detection attempts
    interval: 2000,
    // Maximum attempts (0 for unlimited)
    maxAttempts: 3
  },
  
  // Announcement settings
  announcements: {
    // Types of announcements to make
    types: {
      navigation: true,    // Page navigation and focus changes
      updates: true,       // Content updates
      errors: true,        // Errors and warnings
      actions: true,       // User actions and results
      system: true         // System status and events
    },
    // Politeness levels
    politeness: 'polite',  // 'polite', 'assertive', or 'off'
    // Delay (ms) between announcements
    delay: 250,
    // Whether to deduplicate identical consecutive announcements
    deduplicate: true
  },
  
  // Keyboard navigation settings
  keyboard: {
    // Whether to enable enhanced keyboard navigation
    enabled: true,
    // Tab navigation sequence
    tabSequence: 'auto',   // 'auto', 'standard', or 'custom'
    // Whether to use arrow keys for navigation within components
    arrowNavigation: true,
    // Whether to show keyboard shortcuts in tooltips
    showShortcutsInTooltips: true
  },
  
  // ARIA settings
  aria: {
    // Whether to enhance elements with additional ARIA attributes
    enhanceElements: true,
    // Whether to announce dynamic content changes
    announceLiveChanges: true,
    // Politeness level for live regions
    liveRegionPoliteness: 'polite',
    // Whether to apply ARIA labels to icons
    labelIcons: true
  }
};

/**
 * Initialize the screen reader integration
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(options = {}) {
  if (_initialized) {
    logger.warn('Screen reader integration already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing screen reader integration');
    
    // Load configuration
    _config = await loadConfiguration(options);
    
    // Check if screen reader integration is enabled
    _enabled = _config.enabled;
    
    if (!_enabled) {
      logger.info('Screen reader integration disabled by configuration');
      _initialized = true;
      return true;
    }
    
    // Initialize submodules
    await Promise.all([
      AriaManager.initialize(_config.aria),
      KeyboardNavigation.initialize(_config.keyboard),
      AnnouncementService.initialize(_config.announcements)
    ]);
    
    // Set up event listeners
    EventBus.subscribe('system:configChanged', handleConfigChanged);
    EventBus.subscribe('ui:elementFocused', handleElementFocused);
    EventBus.subscribe('ui:contentUpdated', handleContentUpdated);
    EventBus.subscribe('system:error', handleSystemError);
    
    // Start screen reader detection if enabled
    if (_config.detection.enabled) {
      detectScreenReader();
    }
    
    _initialized = true;
    logger.info('Screen reader integration initialized successfully');
    
    // Announce initialization to screen readers
    announceInitialization();
    
    // Log initialization
    auditTrail.log('info', 'Screen reader integration initialized', {
      enabled: _enabled,
      detectedScreenReader: _detectedScreenReader
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize screen reader integration', error);
    auditTrail.log('error', 'Screen reader integration initialization failed', {
      error: error.message
    });
    return false;
  }
}

/**
 * Enable or disable screen reader integration
 * @param {boolean} enable - Whether to enable screen reader integration
 * @returns {boolean} - True if successful
 */
export function setEnabled(enable) {
  if (!_initialized) {
    logger.error('Cannot change enabled state before initialization');
    return false;
  }
  
  if (_enabled === enable) {
    return true;
  }
  
  _enabled = enable;
  
  // Enable or disable submodules
  AriaManager.setEnabled(enable);
  KeyboardNavigation.setEnabled(enable);
  AnnouncementService.setEnabled(enable);
  
  // Announce state change
  if (enable) {
    announce('Screen reader integration enabled', 'system', 'assertive');
    logger.info('Screen reader integration enabled');
  } else {
    announce('Screen reader integration disabled', 'system', 'assertive');
    logger.info('Screen reader integration disabled');
  }
  
  // Update configuration
  _config.enabled = enable;
  saveConfiguration();
  
  // Publish event
  EventBus.publish('accessibility:screenReaderToggled', {
    enabled: enable
  });
  
  // Log state change
  auditTrail.log('info', `Screen reader integration ${enable ? 'enabled' : 'disabled'}`);
  
  return true;
}

/**
 * Get the current enabled state
 * @returns {boolean} - Whether screen reader integration is enabled
 */
export function isEnabled() {
  return _enabled;
}

/**
 * Get detected screen reader information
 * @returns {Object|null} - Screen reader information or null if none detected
 */
export function getDetectedScreenReader() {
  return _detectedScreenReader;
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 * @param {string} [type='updates'] - Announcement type
 * @param {string} [politeness='polite'] - Politeness level
 * @returns {boolean} - True if announcement was made
 */
export function announce(message, type = 'updates', politeness = null) {
  if (!_initialized || !_enabled) {
    return false;
  }
  
  if (!_config.announcements.types[type]) {
    return false;
  }
  
  return AnnouncementService.announce(message, type, politeness);
}

/**
 * Make an element accessible to screen readers
 * @param {HTMLElement} element - Element to make accessible
 * @param {Object} options - Accessibility options
 * @returns {boolean} - True if successful
 */
export function makeElementAccessible(element, options = {}) {
  if (!_initialized || !_enabled) {
    return false;
  }
  
  // Apply ARIA attributes
  AriaManager.enhanceElement(element, options);
  
  // Add keyboard navigation
  KeyboardNavigation.registerElement(element, options);
  
  return true;
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  try {
    logger.info('Cleaning up screen reader integration');
    
    // Remove event listeners
    EventBus.unsubscribe('system:configChanged', handleConfigChanged);
    EventBus.unsubscribe('ui:elementFocused', handleElementFocused);
    EventBus.unsubscribe('ui:contentUpdated', handleContentUpdated);
    EventBus.unsubscribe('system:error', handleSystemError);
    
    // Clean up submodules
    AriaManager.cleanup();
    KeyboardNavigation.cleanup();
    AnnouncementService.cleanup();
    
    _initialized = false;
    _enabled = false;
    _detectedScreenReader = null;
    
    logger.info('Screen reader integration cleaned up');
  } catch (error) {
    logger.error('Error during screen reader integration cleanup', error);
  }
}

/**
 * Load configuration
 * @private
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Loaded configuration
 */
async function loadConfiguration(options) {
  // Start with default configuration
  const config = { ...DEFAULT_CONFIG };
  
  // Try to load from config manager
  try {
    const configManagerConfig = await ConfigManager.get('accessibility.screenReader');
    if (configManagerConfig) {
      Object.assign(config, configManagerConfig);
    }
  } catch (error) {
    logger.warn('Could not load screen reader config from config manager', error);
  }
  
  // Apply passed options
  if (options) {
    Object.assign(config, options);
  }
  
  return config;
}

/**
 * Save current configuration
 * @private
 */
async function saveConfiguration() {
  try {
    await ConfigManager.set('accessibility.screenReader', _config);
  } catch (error) {
    logger.warn('Could not save screen reader configuration', error);
  }
}

/**
 * Detect screen reader software
 * @private
 */
async function detectScreenReader() {
  if (!_initialized || !_config.detection.enabled) {
    return;
  }
  
  try {
    // Various detection methods
    
    // 1. Check for common screen reader objects in window
    if (window.NVDA || 
        window.JAWS || 
        window.FocusManagement || // VoiceOver on macOS
        window.accessibilityDisplayWebPageReader) { // Chrome Vox
          
      let name = 'Unknown Screen Reader';
      if (window.NVDA) name = 'NVDA';
      else if (window.JAWS) name = 'JAWS';
      else if (window.FocusManagement) name = 'VoiceOver';
      else if (window.accessibilityDisplayWebPageReader) name = 'ChromeVox';
      
      _detectedScreenReader = { name, detected: true };
      
      logger.info(`Detected screen reader: ${name}`);
      EventBus.publish('accessibility:screenReaderDetected', { name });
      
      return;
    }
    
    // 2. Use browser specific features
    if (navigator.userAgent.includes('Win')) {
      // Windows: UIA (UI Automation) API check
      // This is a simplified check; in a real implementation we would 
      // use more sophisticated detection
      if (document.documentElement.getAttribute('role') === 'application') {
        _detectedScreenReader = { name: 'Windows Screen Reader', detected: true };
        logger.info('Detected Windows screen reader');
        EventBus.publish('accessibility:screenReaderDetected', { name: 'Windows Screen Reader' });
        return;
      }
    } else if (navigator.userAgent.includes('Mac')) {
      // macOS: Check for VoiceOver
      if (document.documentElement.hasAttribute('data-voiceoveruserinject')) {
        _detectedScreenReader = { name: 'VoiceOver', detected: true };
        logger.info('Detected VoiceOver');
        EventBus.publish('accessibility:screenReaderDetected', { name: 'VoiceOver' });
        return;
      }
    } else if (navigator.userAgent.includes('Android')) {
      // Android: Check for TalkBack
      if (window.accessibility && window.accessibility.getVersionName) {
        _detectedScreenReader = { name: 'TalkBack', detected: true };
        logger.info('Detected TalkBack');
        EventBus.publish('accessibility:screenReaderDetected', { name: 'TalkBack' });
        return;
      }
    } else if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      // iOS: VoiceOver detection
      // Limited detection capabilities in iOS web
      const touchStartHandler = function(e) {
        if (e.touches.length === 3) {
          _detectedScreenReader = { name: 'VoiceOver iOS', detected: true };
          logger.info('Detected VoiceOver iOS');
          EventBus.publish('accessibility:screenReaderDetected', { name: 'VoiceOver iOS' });
          document.removeEventListener('touchstart', touchStartHandler);
        }
      };
      
      document.addEventListener('touchstart', touchStartHandler);
      
      // Remove event listener after a short time if no detection
      setTimeout(() => {
        document.removeEventListener('touchstart', touchStartHandler);
      }, 5000);
    }
    
    // 3. Create a temporary hidden live region and monitor focus
    const testRegion = document.createElement('div');
    testRegion.setAttribute('aria-live', 'assertive');
    testRegion.style.position = 'absolute';
    testRegion.style.left = '-9999px';
    testRegion.style.height = '1px';
    testRegion.style.width = '1px';
    testRegion.style.overflow = 'hidden';
    testRegion.textContent = 'Screen reader detection';
    
    document.body.appendChild(testRegion);
    
    // Remove after a short time
    setTimeout(() => {
      document.body.removeChild(testRegion);
    }, 1000);
    
    // If no screen reader detected after multiple attempts, assume none is present
    if (_config.detection.maxAttempts > 0) {
      let attempts = 1;
      
      const detectionInterval = setInterval(() => {
        if (_detectedScreenReader || attempts >= _config.detection.maxAttempts) {
          clearInterval(detectionInterval);
          
          if (!_detectedScreenReader) {
            logger.info('No screen reader detected after multiple attempts');
            _detectedScreenReader = { detected: false };
          }
        } else {
          attempts++;
          detectScreenReader();
        }
      }, _config.detection.interval);
    }
  } catch (error) {
    logger.error('Error detecting screen reader', error);
    _detectedScreenReader = { detected: false, error: error.message };
  }
}

/**
 * Announce initialization to screen readers
 * @private
 */
function announceInitialization() {
  // Only announce if screen reader integration is enabled
  if (!_enabled) {
    return;
  }
  
  // Delayed announcement to ensure screen readers are ready
  setTimeout(() => {
    announce('ALEJO accessibility features initialized', 'system', 'polite');
    
    // If keyboard navigation is enabled, announce keyboard shortcuts
    if (_config.keyboard.enabled) {
      announce('Press question mark for keyboard shortcuts', 'system', 'polite');
    }
  }, 1000);
}

/**
 * Handle config changes
 * @private
 * @param {Object} data - Config change data
 */
function handleConfigChanged(data) {
  if (!data || !data.path) {
    return;
  }
  
  // Check if screen reader config changed
  if (data.path.startsWith('accessibility.screenReader')) {
    logger.debug('Screen reader configuration changed, reloading');
    
    // Reload configuration
    ConfigManager.get('accessibility.screenReader')
      .then(newConfig => {
        if (newConfig) {
          const wasEnabled = _enabled;
          
          // Update configuration
          _config = { ...DEFAULT_CONFIG, ...newConfig };
          _enabled = _config.enabled;
          
          // Update submodules
          AriaManager.updateConfig(_config.aria);
          KeyboardNavigation.updateConfig(_config.keyboard);
          AnnouncementService.updateConfig(_config.announcements);
          
          // Announce change if enabled state changed
          if (wasEnabled !== _enabled) {
            if (_enabled) {
              announce('Screen reader integration enabled', 'system', 'assertive');
            } else {
              announce('Screen reader integration disabled', 'system', 'assertive');
            }
          }
          
          logger.info('Screen reader configuration updated');
        }
      })
      .catch(error => {
        logger.error('Error updating screen reader configuration', error);
      });
  }
}

/**
 * Handle element focused events
 * @private
 * @param {Object} data - Event data
 */
function handleElementFocused(data) {
  if (!_initialized || !_enabled) {
    return;
  }
  
  // Check if we should announce this focus change
  if (_config.announcements.types.navigation) {
    const element = data.element;
    
    if (!element) {
      return;
    }
    
    // Get accessible name for the element
    let accessibleName = AriaManager.getAccessibleName(element);
    
    // Get element role
    let role = element.getAttribute('role') || getImplicitRole(element);
    
    // Construct announcement
    let announcement = '';
    
    if (accessibleName) {
      announcement += accessibleName;
      
      if (role) {
        announcement += `, ${role}`;
      }
    } else if (role) {
      announcement += `${role}`;
    } else {
      // Don't announce if we can't determine anything useful
      return;
    }
    
    // Check if element has a value
    if (element.value !== undefined && element.value !== '') {
      // For inputs, announce current value
      if (element.type === 'password') {
        // Don't announce actual password
        announcement += ', password field';
      } else {
        announcement += `, ${element.value}`;
      }
    }
    
    // Check if element has any special states
    if (element.disabled) {
      announcement += ', disabled';
    }
    if (element.readOnly) {
      announcement += ', read only';
    }
    if (element.required) {
      announcement += ', required';
    }
    if (element.checked) {
      announcement += ', checked';
    }
    if (element.getAttribute('aria-expanded') === 'true') {
      announcement += ', expanded';
    }
    if (element.getAttribute('aria-pressed') === 'true') {
      announcement += ', pressed';
    }
    
    // Announce element focus
    announce(announcement, 'navigation');
  }
}

/**
 * Handle content updated events
 * @private
 * @param {Object} data - Event data
 */
function handleContentUpdated(data) {
  if (!_initialized || !_enabled) {
    return;
  }
  
  // Check if we should announce this update
  if (_config.announcements.types.updates && data.message) {
    announce(data.message, 'updates', data.politeness || 'polite');
  }
}

/**
 * Handle system error events
 * @private
 * @param {Object} data - Event data
 */
function handleSystemError(data) {
  if (!_initialized || !_enabled) {
    return;
  }
  
  // Check if we should announce this error
  if (_config.announcements.types.errors && data.message) {
    announce(data.message, 'errors', 'assertive');
  }
}

/**
 * Get implicit ARIA role for an element
 * @private
 * @param {HTMLElement} element - Element to get role for
 * @returns {string|null} - Implicit role or null
 */
function getImplicitRole(element) {
  // Common elements and their implicit roles
  const tagRoles = {
    'a': element.hasAttribute('href') ? 'link' : null,
    'article': 'article',
    'aside': 'complementary',
    'button': 'button',
    'form': 'form',
    'h1': 'heading',
    'h2': 'heading',
    'h3': 'heading',
    'h4': 'heading',
    'h5': 'heading',
    'h6': 'heading',
    'header': 'banner',
    'footer': 'contentinfo',
    'img': element.hasAttribute('alt') ? 'img' : 'presentation',
    'input': getInputRole(element),
    'li': 'listitem',
    'main': 'main',
    'nav': 'navigation',
    'ol': 'list',
    'section': 'region',
    'select': 'combobox',
    'table': 'table',
    'textarea': 'textbox',
    'ul': 'list'
  };
  
  return tagRoles[element.tagName.toLowerCase()] || null;
}

/**
 * Get role for input element based on its type
 * @private
 * @param {HTMLInputElement} input - Input element
 * @returns {string|null} - Input role or null
 */
function getInputRole(input) {
  if (!input || input.tagName.toLowerCase() !== 'input') {
    return null;
  }
  
  const inputTypeRoles = {
    'button': 'button',
    'checkbox': 'checkbox',
    'color': 'color',
    'date': 'date',
    'datetime': 'datetime',
    'datetime-local': 'datetime',
    'email': 'textbox',
    'file': 'button',
    'hidden': null,
    'image': 'button',
    'month': 'spinbutton',
    'number': 'spinbutton',
    'password': 'textbox',
    'radio': 'radio',
    'range': 'slider',
    'reset': 'button',
    'search': 'searchbox',
    'submit': 'button',
    'tel': 'textbox',
    'text': 'textbox',
    'time': 'spinbutton',
    'url': 'textbox',
    'week': 'spinbutton'
  };
  
  return inputTypeRoles[input.type] || 'textbox';
}
