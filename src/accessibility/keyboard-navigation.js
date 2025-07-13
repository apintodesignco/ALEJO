/**
 * @file keyboard-navigation.js
 * @description Keyboard navigation handler for accessibility
 * @module accessibility/keyboard-navigation
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';

// Initialize logger
const logger = new Logger('KeyboardNavigation');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;
let _activeElementId = null;
let _focusTrapActive = false;
let _focusTrapElements = [];
let _eventHandlers = new Map();

// Default configuration
const DEFAULT_CONFIG = {
  // Whether keyboard navigation is enabled
  enabled: true,
  // Whether to enable focus trap for modals
  enableFocusTraps: true,
  // Whether to use enhanced focus indicators
  enhancedFocusIndicators: true,
  // Skip links navigation
  skipLinksEnabled: true,
  // Tab index override for custom focus order
  customFocusOrder: false,
  // Keyboard shortcuts
  shortcuts: {
    toggleSkipLinks: 'Alt+S',
    toggleNavigation: 'Alt+N',
    toggleMenu: 'Alt+M',
    focusMainContent: 'Alt+1',
    toggleHelp: 'Alt+H'
  }
};

/**
 * Initialize the keyboard navigation handler
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Keyboard navigation handler already initialized');
    return true;
  }

  try {
    logger.info('Initializing keyboard navigation handler');

    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility.keyboardNav');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    _enabled = _config.enabled;

    // Set up event listeners
    setupEventListeners();

    // Create skip links if enabled
    if (_config.skipLinksEnabled) {
      createSkipLinks();
    }

    // Set up enhanced focus indicators
    if (_config.enhancedFocusIndicators) {
      setupEnhancedFocusIndicators();
    }

    _initialized = true;
    
    EventBus.publish('accessibility:keyboardNavInitialized', { enabled: _enabled });
    logger.info('Keyboard navigation handler initialized successfully');

    return true;
  } catch (error) {
    logger.error('Failed to initialize keyboard navigation handler', error);
    return false;
  }
}

/**
 * Enable or disable keyboard navigation
 * @param {boolean} enable - Whether to enable keyboard navigation
 */
export function setEnabled(enable) {
  if (!_initialized) {
    return;
  }

  _enabled = enable;
  _config.enabled = enable;
  
  // Save the updated config
  ConfigManager.save('accessibility.keyboardNav', _config);
  
  EventBus.publish('accessibility:keyboardNavToggled', { enabled: _enabled });
  logger.info(`Keyboard navigation ${enable ? 'enabled' : 'disabled'}`);
}

/**
 * Update configuration
 * @param {Object} config - New configuration
 */
export function updateConfig(config) {
  if (!_initialized) {
    return;
  }

  const oldConfig = { ..._config };
  _config = { ...DEFAULT_CONFIG, ..._config, ...config };
  _enabled = _config.enabled;

  // Save the updated config
  ConfigManager.save('accessibility.keyboardNav', _config);

  // Update skip links if the setting changed
  if (oldConfig.skipLinksEnabled !== _config.skipLinksEnabled) {
    if (_config.skipLinksEnabled) {
      createSkipLinks();
    } else {
      removeSkipLinks();
    }
  }

  // Update focus indicators if the setting changed
  if (oldConfig.enhancedFocusIndicators !== _config.enhancedFocusIndicators) {
    if (_config.enhancedFocusIndicators) {
      setupEnhancedFocusIndicators();
    } else {
      removeEnhancedFocusIndicators();
    }
  }
  
  EventBus.publish('accessibility:keyboardNavConfigUpdated', { config: _config });
}

/**
 * Focus an element by ID or selector
 * @param {string} idOrSelector - Element ID or CSS selector
 * @returns {boolean} - True if focus successful
 */
export function focusElement(idOrSelector) {
  if (!_initialized || !_enabled) {
    return false;
  }

  try {
    const element = typeof idOrSelector === 'string' && idOrSelector.includes(' ') 
      ? document.querySelector(idOrSelector) 
      : document.getElementById(idOrSelector);

    if (!element) {
      logger.warn(`Element not found: ${idOrSelector}`);
      return false;
    }

    // Make the element focusable if it's not
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
      
      // Remember to restore this attribute later
      if (!_eventHandlers.has('focusableElements')) {
        _eventHandlers.set('focusableElements', []);
      }
      _eventHandlers.get('focusableElements').push(element);
    }

    // Focus the element
    element.focus();
    
    _activeElementId = element.id || null;
    EventBus.publish('accessibility:elementFocused', { 
      element: element, 
      id: _activeElementId 
    });
    
    return true;
  } catch (error) {
    logger.error(`Error focusing element: ${idOrSelector}`, error);
    return false;
  }
}

/**
 * Set a focus trap for a container, ensuring focus stays within it
 * @param {HTMLElement|string} container - Container element or its ID
 * @param {HTMLElement|string} [initialFocus] - Element to focus initially
 * @returns {boolean} - True if trap set successfully
 */
export function setFocusTrap(container, initialFocus = null) {
  if (!_initialized || !_enabled || !_config.enableFocusTraps) {
    return false;
  }

  try {
    // Get container element
    const containerElement = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;

    if (!containerElement) {
      logger.warn(`Container element not found: ${container}`);
      return false;
    }

    // Find all focusable elements
    const focusableElements = containerElement.querySelectorAll(
      'button, [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      logger.warn('No focusable elements found in container');
      return false;
    }

    // Store for later
    _focusTrapElements = Array.from(focusableElements);
    _focusTrapActive = true;

    // Set up focus trap handler if not already
    if (!_eventHandlers.has('focusTrap')) {
      const handler = (e) => {
        if (!_focusTrapActive) return;
        
        // Only handle tab key
        if (e.key !== 'Tab') return;

        const firstElement = _focusTrapElements[0];
        const lastElement = _focusTrapElements[_focusTrapElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          // Shift+Tab on first element - move to last
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          // Tab on last element - move to first
          e.preventDefault();
          firstElement.focus();
        }
      };

      document.addEventListener('keydown', handler);
      _eventHandlers.set('focusTrap', handler);
    }

    // Focus the initial element
    if (initialFocus) {
      const initialElement = typeof initialFocus === 'string' 
        ? document.getElementById(initialFocus) 
        : initialFocus;

      if (initialElement && _focusTrapElements.includes(initialElement)) {
        initialElement.focus();
      } else {
        // Focus first element by default
        _focusTrapElements[0].focus();
      }
    } else {
      // Focus first element by default
      _focusTrapElements[0].focus();
    }
    
    EventBus.publish('accessibility:focusTrapSet', { 
      container: containerElement,
      elementCount: _focusTrapElements.length
    });
    
    return true;
  } catch (error) {
    logger.error('Error setting focus trap', error);
    return false;
  }
}

/**
 * Remove an active focus trap
 * @returns {boolean} - True if trap removed successfully
 */
export function removeFocusTrap() {
  if (!_focusTrapActive) {
    return false;
  }

  _focusTrapActive = false;
  _focusTrapElements = [];
  
  EventBus.publish('accessibility:focusTrapRemoved');
  return true;
}

/**
 * Create a custom keyboard shortcut
 * @param {string} key - Key combination (e.g., 'Alt+S')
 * @param {Function} callback - Callback function to execute
 * @param {string} [description] - Description of the shortcut
 * @returns {boolean} - True if shortcut created successfully
 */
export function createShortcut(key, callback, description = '') {
  if (!_initialized || !_enabled) {
    return false;
  }

  try {
    // Parse the key combination
    const parts = key.split('+');
    const keyCode = parts[parts.length - 1].toLowerCase();
    const hasAlt = parts.includes('Alt');
    const hasCtrl = parts.includes('Ctrl');
    const hasShift = parts.includes('Shift');

    // Create handler function
    const handler = (e) => {
      if (e.key.toLowerCase() === keyCode &&
          e.altKey === hasAlt &&
          e.ctrlKey === hasCtrl &&
          e.shiftKey === hasShift) {
        e.preventDefault();
        callback();
      }
    };

    // Register the handler
    document.addEventListener('keydown', handler);
    
    // Store the handler for later cleanup
    if (!_eventHandlers.has('shortcuts')) {
      _eventHandlers.set('shortcuts', []);
    }
    _eventHandlers.get('shortcuts').push({
      key,
      description,
      handler
    });
    
    EventBus.publish('accessibility:shortcutCreated', { key, description });
    logger.debug(`Created keyboard shortcut: ${key} - ${description}`);
    
    return true;
  } catch (error) {
    logger.error(`Error creating keyboard shortcut: ${key}`, error);
    return false;
  }
}

/**
 * Get all registered keyboard shortcuts
 * @returns {Array} - List of registered shortcuts
 */
export function getShortcuts() {
  if (!_initialized) {
    return [];
  }

  // Built-in shortcuts from config
  const builtInShortcuts = Object.entries(_config.shortcuts).map(([action, key]) => {
    return {
      key,
      description: action.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      builtin: true
    };
  });

  // Custom shortcuts
  const customShortcuts = _eventHandlers.get('shortcuts') || [];

  return [
    ...builtInShortcuts,
    ...customShortcuts.map(s => ({
      key: s.key,
      description: s.description,
      builtin: false
    }))
  ];
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }

  logger.info('Cleaning up keyboard navigation handler');

  try {
    // Remove event listeners
    removeEventListeners();
    
    // Remove skip links
    removeSkipLinks();
    
    // Remove enhanced focus indicators
    removeEnhancedFocusIndicators();
    
    // Remove focus trap
    removeFocusTrap();
    
    _initialized = false;
    _enabled = false;
    
    EventBus.publish('accessibility:keyboardNavCleanup');
    logger.info('Keyboard navigation handler cleaned up');
  } catch (error) {
    logger.error('Error during keyboard navigation cleanup', error);
  }
}

/* Private Functions */

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Focus change handler
  const focusHandler = (e) => {
    if (!_enabled) return;

    const target = e.target;
    if (!target) return;

    _activeElementId = target.id || null;

    // Announce focus change
    const label = getLabelForElement(target);
    if (label) {
      EventBus.publish('accessibility:focusChanged', {
        element: target,
        label
      });
    }
  };

  document.addEventListener('focusin', focusHandler);
  _eventHandlers.set('focus', focusHandler);

  // Set up built-in keyboard shortcuts
  setupBuiltInShortcuts();

  // Dialog opened handler
  EventBus.subscribe('ui:dialogOpened', handleDialogOpened);
  
  // Dialog closed handler
  EventBus.subscribe('ui:dialogClosed', handleDialogClosed);
}

/**
 * Remove event listeners
 * @private
 */
function removeEventListeners() {
  // Remove focus handler
  if (_eventHandlers.has('focus')) {
    document.removeEventListener('focusin', _eventHandlers.get('focus'));
    _eventHandlers.delete('focus');
  }

  // Remove focus trap handler
  if (_eventHandlers.has('focusTrap')) {
    document.removeEventListener('keydown', _eventHandlers.get('focusTrap'));
    _eventHandlers.delete('focusTrap');
  }

  // Remove shortcut handlers
  if (_eventHandlers.has('shortcuts')) {
    const shortcuts = _eventHandlers.get('shortcuts');
    shortcuts.forEach(shortcut => {
      document.removeEventListener('keydown', shortcut.handler);
    });
    _eventHandlers.delete('shortcuts');
  }

  // Remove any other event handlers
  _eventHandlers.forEach((handler, key) => {
    if (Array.isArray(handler) && key === 'focusableElements') {
      // Restore tabindex attributes
      handler.forEach(element => {
        if (element && element.hasAttribute && element.hasAttribute('tabindex') && 
            element.getAttribute('tabindex') === '-1') {
          element.removeAttribute('tabindex');
        }
      });
    }
  });

  // Clear event handler map
  _eventHandlers.clear();

  // Unsubscribe from EventBus events
  EventBus.unsubscribe('ui:dialogOpened', handleDialogOpened);
  EventBus.unsubscribe('ui:dialogClosed', handleDialogClosed);
}

/**
 * Set up built-in keyboard shortcuts
 * @private
 */
function setupBuiltInShortcuts() {
  if (!_config.shortcuts) return;

  // Toggle skip links
  if (_config.shortcuts.toggleSkipLinks) {
    createShortcut(_config.shortcuts.toggleSkipLinks, () => {
      toggleSkipLinks();
    }, 'Toggle skip links visibility');
  }

  // Toggle navigation
  if (_config.shortcuts.toggleNavigation) {
    createShortcut(_config.shortcuts.toggleNavigation, () => {
      const navigation = document.querySelector('nav');
      if (navigation) {
        focusElement(navigation);
      }
    }, 'Focus main navigation');
  }

  // Toggle menu
  if (_config.shortcuts.toggleMenu) {
    createShortcut(_config.shortcuts.toggleMenu, () => {
      const menu = document.querySelector('[role="menu"]');
      if (menu) {
        focusElement(menu);
      }
    }, 'Focus main menu');
  }

  // Focus main content
  if (_config.shortcuts.focusMainContent) {
    createShortcut(_config.shortcuts.focusMainContent, () => {
      const main = document.querySelector('main') || document.getElementById('main');
      if (main) {
        focusElement(main);
      }
    }, 'Focus main content');
  }

  // Toggle help
  if (_config.shortcuts.toggleHelp) {
    createShortcut(_config.shortcuts.toggleHelp, () => {
      EventBus.publish('accessibility:showHelp', { shortcuts: getShortcuts() });
    }, 'Show keyboard shortcuts help');
  }
}

/**
 * Create skip links for navigation
 * @private
 */
function createSkipLinks() {
  // Check if skip links already exist
  if (document.getElementById('skip-links')) {
    return;
  }

  // Create skip links container
  const skipLinks = document.createElement('div');
  skipLinks.id = 'skip-links';
  skipLinks.className = 'skip-links';
  skipLinks.setAttribute('aria-label', 'Skip links navigation');

  // Define common targets
  const targets = [
    { id: 'main', label: 'Skip to main content' },
    { id: 'navigation', label: 'Skip to navigation' },
    { id: 'search', label: 'Skip to search' }
  ];

  // Create links for existing targets
  targets.forEach(target => {
    const element = document.getElementById(target.id) || document.querySelector(target.id);
    if (element) {
      const link = document.createElement('a');
      link.href = `#${target.id}`;
      link.textContent = target.label;
      link.className = 'skip-link';
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        focusElement(target.id);
      });
      
      skipLinks.appendChild(link);
    }
  });

  // Only add if we have links
  if (skipLinks.children.length > 0) {
    document.body.insertBefore(skipLinks, document.body.firstChild);
    
    // Style skip links for accessibility
    const style = document.createElement('style');
    style.id = 'skip-links-style';
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -1000px;
        left: -1000px;
        height: 1px;
        width: 1px;
        overflow: hidden;
        z-index: 9999;
      }
      .skip-links:focus-within {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: auto;
        padding: 10px;
        background: #ffffff;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      .skip-link {
        display: inline-block;
        padding: 8px 16px;
        margin: 0 5px;
        background: #0078d4;
        color: white;
        text-decoration: none;
        border-radius: 3px;
      }
      .skip-link:focus {
        outline: 2px solid #000;
      }
    `;
    document.head.appendChild(style);
    
    logger.debug('Skip links created');
  }
}

/**
 * Remove skip links
 * @private
 */
function removeSkipLinks() {
  const skipLinks = document.getElementById('skip-links');
  if (skipLinks) {
    skipLinks.parentNode.removeChild(skipLinks);
  }

  const skipLinksStyle = document.getElementById('skip-links-style');
  if (skipLinksStyle) {
    skipLinksStyle.parentNode.removeChild(skipLinksStyle);
  }
  
  logger.debug('Skip links removed');
}

/**
 * Toggle skip links visibility
 * @private
 */
function toggleSkipLinks() {
  const skipLinks = document.getElementById('skip-links');
  if (!skipLinks) {
    createSkipLinks();
    return;
  }

  if (skipLinks.style.position === 'fixed') {
    skipLinks.style.position = '';
    skipLinks.style.top = '';
    skipLinks.style.left = '';
  } else {
    skipLinks.style.position = 'fixed';
    skipLinks.style.top = '0';
    skipLinks.style.left = '0';
    
    // Focus the first link
    const firstLink = skipLinks.querySelector('.skip-link');
    if (firstLink) {
      firstLink.focus();
    }
  }
}

/**
 * Set up enhanced focus indicators
 * @private
 */
function setupEnhancedFocusIndicators() {
  // Check if style already exists
  if (document.getElementById('enhanced-focus-style')) {
    return;
  }

  // Create and append style
  const style = document.createElement('style');
  style.id = 'enhanced-focus-style';
  style.textContent = `
    :focus {
      outline: 2px solid #0078d4 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.5) !important;
    }
    
    /* High contrast mode */
    @media (forced-colors: active) {
      :focus {
        outline: 2px solid SelectedItem !important;
        outline-offset: 2px !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  logger.debug('Enhanced focus indicators set up');
}

/**
 * Remove enhanced focus indicators
 * @private
 */
function removeEnhancedFocusIndicators() {
  const style = document.getElementById('enhanced-focus-style');
  if (style) {
    style.parentNode.removeChild(style);
  }
  
  logger.debug('Enhanced focus indicators removed');
}

/**
 * Get an accessible label for an element
 * @private
 * @param {HTMLElement} element - Element to get label for
 * @returns {string|null} - Label or null if not found
 */
function getLabelForElement(element) {
  if (!element) return null;

  // Check for aria-label
  if (element.hasAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }

  // Check for aria-labelledby
  if (element.hasAttribute('aria-labelledby')) {
    const labelId = element.getAttribute('aria-labelledby');
    const labelElement = document.getElementById(labelId);
    if (labelElement) {
      return labelElement.textContent;
    }
  }

  // Check for label element (for form elements)
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent;
    }
  }

  // Check for title attribute
  if (element.hasAttribute('title')) {
    return element.getAttribute('title');
  }

  // Check for text content
  if (element.textContent && element.textContent.trim() !== '') {
    // Get only direct text nodes, not child element content
    let text = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      if (element.childNodes[i].nodeType === Node.TEXT_NODE) {
        text += element.childNodes[i].textContent;
      }
    }
    
    text = text.trim();
    if (text) {
      return text;
    }
  }

  // Check for placeholder (for input elements)
  if (element.hasAttribute('placeholder')) {
    return `${element.getAttribute('placeholder')} field`;
  }

  // Check for value (for buttons)
  if (element.hasAttribute('value') && 
      (element.tagName === 'BUTTON' || 
       (element.tagName === 'INPUT' && 
        (element.type === 'button' || element.type === 'submit')))) {
    return element.getAttribute('value');
  }

  // Check for name
  if (element.hasAttribute('name')) {
    return element.getAttribute('name');
  }

  // Check for role
  if (element.hasAttribute('role')) {
    const role = element.getAttribute('role');
    return `${role} control`;
  }

  // Return element tag as a last resort
  return element.tagName.toLowerCase();
}

/**
 * Handle dialog opened event
 * @private
 * @param {Object} data - Dialog data
 */
function handleDialogOpened(data) {
  if (!_initialized || !_enabled || !_config.enableFocusTraps) {
    return;
  }

  const { dialog } = data;
  if (!dialog) {
    return;
  }

  // Set focus trap on the dialog
  setFocusTrap(dialog);
}

/**
 * Handle dialog closed event
 * @private
 */
function handleDialogClosed() {
  if (!_initialized || !_enabled) {
    return;
  }

  // Remove focus trap
  removeFocusTrap();
}
