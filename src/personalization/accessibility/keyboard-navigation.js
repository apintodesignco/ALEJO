/**
 * ALEJO Keyboard Navigation System
 * 
 * This module provides enhanced keyboard navigation features for ALEJO:
 * - Keyboard shortcuts for common actions
 * - Focus management for modal dialogs and other interactive components
 * - Focus traps for modals and dropdown menus
 * - Logical tab order enforcement
 * - Skip links for keyboard navigation
 * 
 * @module personalization/accessibility/keyboard-navigation
 */

import { EventBus } from '../../core/events/event-bus.js';
import { Logger } from '../../core/logger/logger.js';
import AriaManager from './aria-manager.js';

// Default keyboard shortcuts configuration
const DEFAULT_SHORTCUTS = {
  dashboard: { key: 'd', modifiers: { altKey: true } },
  accessibility: { key: 'a', modifiers: { altKey: true } },
  menu: { key: 'm', modifiers: { altKey: true } },
  help: { key: 'h', modifiers: { altKey: true } },
  search: { key: 'f', modifiers: { ctrlKey: true } },
  skipToContent: { key: 'Tab', modifiers: { shiftKey: false } },
  skipToNavigation: { key: 'n', modifiers: { altKey: true, shiftKey: true } },
  escape: { key: 'Escape', modifiers: {} }
};

/**
 * Keyboard Navigation Manager Class
 */
class KeyboardNavigationManager {
  /**
   * Create a new KeyboardNavigationManager instance
   */
  constructor() {
    this.initialized = false;
    this.eventBus = null;
    this.logger = null;
    this.ariaManager = null;
    this.shortcuts = { ...DEFAULT_SHORTCUTS };
    this.customShortcuts = new Map();
    this.focusTraps = new Map();
    this.activeTraps = [];
    this.focusableSelector = 'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
    this.skipLinksCreated = false;
    this.initialFocusElements = new Set();
  }

  /**
   * Get singleton instance
   * @returns {KeyboardNavigationManager} Singleton instance
   */
  static getInstance() {
    if (!KeyboardNavigationManager.instance) {
      KeyboardNavigationManager.instance = new KeyboardNavigationManager();
    }
    return KeyboardNavigationManager.instance;
  }

  /**
   * Initialize the Keyboard Navigation Manager
   * @param {Object} options - Initialization options
   * @param {boolean} options.createSkipLinks - Whether to create skip navigation links
   * @param {Object} options.customShortcuts - Custom keyboard shortcuts
   * @param {Array} options.initialFocusElements - Elements that should receive focus on page load
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }

      const defaultOptions = {
        createSkipLinks: true,
        customShortcuts: {},
        initialFocusElements: ['#main-content', 'main', '[role="main"]']
      };

      const finalOptions = { ...defaultOptions, ...options };

      this.eventBus = EventBus.getInstance();
      this.logger = new Logger('KeyboardNavigationManager');
      this.ariaManager = AriaManager;

      // Set custom shortcuts
      if (finalOptions.customShortcuts) {
        this.shortcuts = { ...this.shortcuts, ...finalOptions.customShortcuts };
      }

      // Set initial focus elements
      if (finalOptions.initialFocusElements) {
        this.initialFocusElements = new Set(finalOptions.initialFocusElements);
      }

      // Create skip links if enabled
      if (finalOptions.createSkipLinks) {
        this._createSkipLinks();
      }

      // Set up global keyboard event listener
      this._setupGlobalKeyboardHandler();

      // Set initial focus
      this._setInitialFocus();

      // Register DOM mutation observer to handle new content
      this._setupMutationObserver();

      this.initialized = true;
      this.eventBus.publish('accessibility:keyboard-navigation:initialized', { success: true });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Keyboard Navigation Manager', error);
      this.eventBus.publish('accessibility:keyboard-navigation:initialized', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up global keyboard event handler
   * @private
   */
  _setupGlobalKeyboardHandler() {
    document.addEventListener('keydown', this._handleKeyDown.bind(this));
    document.addEventListener('keyup', this._handleKeyUp.bind(this));
    document.addEventListener('focusin', this._handleFocusIn.bind(this));
  }

  /**
   * Handle key down events
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleKeyDown(event) {
    // Handle focus trap if active
    if (this.activeTraps.length > 0 && event.key === 'Tab') {
      const activeTrap = this.activeTraps[this.activeTraps.length - 1];
      const trapInfo = this.focusTraps.get(activeTrap);
      
      if (trapInfo) {
        this._manageFocusTrap(event, trapInfo);
      }
    }

    // Handle arrow keys for complex widgets
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      this._handleArrowKeys(event);
    }

    // Handle global shortcuts
    this._handleShortcut(event);

    // Handle ESC key for closing modals and dropdowns
    if (event.key === 'Escape') {
      this._handleEscapeKey();
    }
  }

  /**
   * Handle key up events
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleKeyUp(event) {
    // Additional key up handling if needed
  }

  /**
   * Handle focus in events
   * @param {FocusEvent} event - Focus event
   * @private
   */
  _handleFocusIn(event) {
    const target = event.target;
    
    // Handle focus events for active focus traps
    if (this.activeTraps.length > 0) {
      const activeTrap = this.activeTraps[this.activeTraps.length - 1];
      const trapInfo = this.focusTraps.get(activeTrap);
      
      if (trapInfo && !this._isElementInTrap(target, trapInfo)) {
        // Focus moved outside of trap, move it back to first focusable element
        event.stopPropagation();
        const firstFocusable = trapInfo.focusableElements[0];
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    }
  }

  /**
   * Check if element is within a focus trap
   * @param {HTMLElement} element - Element to check
   * @param {Object} trapInfo - Focus trap information
   * @returns {boolean} Whether element is in trap
   * @private
   */
  _isElementInTrap(element, trapInfo) {
    if (!element || !trapInfo) {
      return false;
    }
    
    return trapInfo.container.contains(element) || 
           trapInfo.focusableElements.includes(element);
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleShortcut(event) {
    // Check built-in shortcuts
    for (const [action, shortcut] of Object.entries(this.shortcuts)) {
      if (this._isShortcutMatch(event, shortcut)) {
        event.preventDefault();
        this.eventBus.publish(`accessibility:shortcut:${action}`, { 
          action,
          event
        });
        return;
      }
    }

    // Check custom shortcuts
    for (const [id, shortcut] of this.customShortcuts.entries()) {
      if (this._isShortcutMatch(event, shortcut.keys)) {
        event.preventDefault();
        this.eventBus.publish('accessibility:shortcut:custom', {
          id,
          action: shortcut.action,
          data: shortcut.data,
          event
        });
        
        if (typeof shortcut.callback === 'function') {
          shortcut.callback(event);
        }
        
        return;
      }
    }
  }

  /**
   * Check if keyboard event matches shortcut definition
   * @param {KeyboardEvent} event - Keyboard event
   * @param {Object} shortcut - Shortcut definition
   * @returns {boolean} Whether event matches shortcut
   * @private
   */
  _isShortcutMatch(event, shortcut) {
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
      return false;
    }
    
    const modifiers = shortcut.modifiers || {};
    
    // Check modifiers
    if ((!!modifiers.altKey !== !!event.altKey) ||
        (!!modifiers.ctrlKey !== !!event.ctrlKey) ||
        (!!modifiers.shiftKey !== !!event.shiftKey) ||
        (!!modifiers.metaKey !== !!event.metaKey)) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle escape key for closing modals and dropdowns
   * @private
   */
  _handleEscapeKey() {
    // Get the top-most focus trap if available
    if (this.activeTraps.length > 0) {
      const topTrapId = this.activeTraps[this.activeTraps.length - 1];
      this.deactivateFocusTrap(topTrapId);
      
      this.eventBus.publish('accessibility:modal:escape', {
        trapId: topTrapId
      });
    }
  }

  /**
   * Manage focus within a focus trap
   * @param {KeyboardEvent} event - Keyboard event
   * @param {Object} trapInfo - Focus trap information
   * @private
   */
  _manageFocusTrap(event, trapInfo) {
    const focusableElements = trapInfo.focusableElements;
    
    if (!focusableElements || focusableElements.length === 0) {
      return;
    }
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    
    // Handling Tab and Shift+Tab navigation
    if (event.shiftKey && activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  /**
   * Handle arrow key navigation for complex widgets
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleArrowKeys(event) {
    const activeElement = document.activeElement;
    if (!activeElement) return;

    // Handle dropdown navigation
    if (activeElement.getAttribute('role') === 'option') {
      event.preventDefault();
      const options = Array.from(activeElement.parentNode.children);
      const currentIndex = options.indexOf(activeElement);
      
      if (event.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % options.length;
        options[nextIndex].focus();
      } else if (event.key === 'ArrowUp') {
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        options[prevIndex].focus();
      }
    }
    
    // Handle slider navigation
    if (activeElement.getAttribute('role') === 'slider') {
      event.preventDefault();
      const step = parseFloat(activeElement.getAttribute('aria-valuestep') || 1);
      const min = parseFloat(activeElement.getAttribute('aria-valuemin') || 0);
      const max = parseFloat(activeElement.getAttribute('aria-valuemax') || 100);
      let value = parseFloat(activeElement.getAttribute('aria-valuenow') || min);
      
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        value = Math.min(value + step, max);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        value = Math.max(value - step, min);
      }
      
      activeElement.setAttribute('aria-valuenow', value);
      activeElement.value = value;
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Create skip navigation links
   * @private
   */
  _createSkipLinks() {
    if (this.skipLinksCreated || !document.body) {
      return;
    }

    // Create skip to content link
    const skipToContent = document.createElement('a');
    skipToContent.href = '#main-content';
    skipToContent.id = 'alejo-skip-to-content';
    skipToContent.className = 'alejo-skip-link';
    skipToContent.textContent = 'Skip to main content';
    skipToContent.setAttribute('aria-label', 'Skip to main content');
    
    // Create skip to navigation link
    const skipToNav = document.createElement('a');
    skipToNav.href = '#main-navigation';
    skipToNav.id = 'alejo-skip-to-navigation';
    skipToNav.className = 'alejo-skip-link';
    skipToNav.textContent = 'Skip to navigation';
    skipToNav.setAttribute('aria-label', 'Skip to main navigation');
    
    // Apply styles
    const skipLinkStyle = `
      .alejo-skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: #000;
        color: #fff;
        padding: 8px;
        z-index: 100;
        transition: top 0.3s ease;
        text-decoration: none;
      }
      
      .alejo-skip-link:focus {
        top: 0;
        outline: 2px solid #4299e1;
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = skipLinkStyle;
    document.head.appendChild(styleElement);
    
    // Add skip links to DOM
    const container = document.createElement('div');
    container.className = 'alejo-skip-links';
    container.appendChild(skipToContent);
    container.appendChild(skipToNav);
    
    document.body.insertBefore(container, document.body.firstChild);
    
    // Make sure target elements have appropriate IDs
    this._ensureTargetElementIds();
    
    this.skipLinksCreated = true;
  }

  /**
   * Ensure target elements for skip links have appropriate IDs
   * @private
   */
  _ensureTargetElementIds() {
    // Find main content area
    const mainContent = document.querySelector('main') || 
                       document.querySelector('[role="main"]') || 
                       document.querySelector('#content') ||
                       document.querySelector('.content');
    
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
    }
    
    // Find main navigation
    const mainNav = document.querySelector('nav') || 
                   document.querySelector('[role="navigation"]') || 
                   document.querySelector('#navigation') ||
                   document.querySelector('.navigation');
    
    if (mainNav && !mainNav.id) {
      mainNav.id = 'main-navigation';
    }
  }

  /**
   * Set initial focus when page loads
   * @private
   */
  _setInitialFocus() {
    if (!document.body) {
      return;
    }

    // Wait for DOM to be fully loaded
    window.addEventListener('DOMContentLoaded', () => {
      // Find first focusable element matching our initial focus selectors
      for (const selector of this.initialFocusElements) {
        const element = document.querySelector(selector);
        
        if (element) {
          // Only set focus if element is focusable or can be made focusable
          if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '-1');
          }
          
          setTimeout(() => {
            try {
              element.focus();
              // Announce to screen readers that focus has been set
              this.ariaManager.announceMessage(`Focus set to ${element.tagName.toLowerCase()}`);
            } catch (error) {
              this.logger.warn('Failed to set initial focus', error);
            }
          }, 100);
          
          break;
        }
      }
    });
  }

  /**
   * Set up mutation observer to handle dynamically added content
   * @private
   */
  _setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check for modals or dialogs that might need focus traps
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this._checkForModalOrDialog(node);
            }
          });
        }
      });
    });
    
    // Start observing document body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if element is a modal or dialog that needs a focus trap
   * @param {HTMLElement} element - Element to check
   * @private
   */
  _checkForModalOrDialog(element) {
    // If element itself is a modal or dialog
    if (element.matches('[role="dialog"], dialog, .modal, [aria-modal="true"]')) {
      this.createFocusTrap(element);
      return;
    }
    
    // Check child elements
    const modals = element.querySelectorAll('[role="dialog"], dialog, .modal, [aria-modal="true"]');
    modals.forEach(modal => {
      this.createFocusTrap(modal);
    });
  }

  /**
   * Register a custom keyboard shortcut
   * @param {string} id - Unique identifier for the shortcut
   * @param {Object} shortcutData - Shortcut configuration
   * @param {Object} shortcutData.keys - Key and modifier combination
   * @param {string} shortcutData.keys.key - Key name
   * @param {Object} shortcutData.keys.modifiers - Modifier keys required
   * @param {string} shortcutData.action - Action name
   * @param {Object} shortcutData.data - Additional data for event
   * @param {Function} shortcutData.callback - Callback function
   * @returns {boolean} Success status
   */
  registerShortcut(id, shortcutData) {
    if (!id || this.customShortcuts.has(id)) {
      return false;
    }
    
    this.customShortcuts.set(id, shortcutData);
    this.eventBus.publish('accessibility:shortcut:registered', { id, shortcutData });
    
    return true;
  }

  /**
   * Unregister a custom keyboard shortcut
   * @param {string} id - Shortcut identifier
   * @returns {boolean} Success status
   */
  unregisterShortcut(id) {
    if (!id || !this.customShortcuts.has(id)) {
      return false;
    }
    
    this.customShortcuts.delete(id);
    this.eventBus.publish('accessibility:shortcut:unregistered', { id });
    
    return true;
  }

  /**
   * Create a focus trap for modal dialogs
   * @param {HTMLElement|string} element - Element or selector for the trap container
   * @param {Object} options - Focus trap options
   * @param {boolean} options.autoActivate - Whether to activate the trap immediately
   * @param {string} options.initialFocus - Selector for the element to receive initial focus
   * @param {Function} options.onActivate - Callback when trap is activated
   * @param {Function} options.onDeactivate - Callback when trap is deactivated
   * @returns {string|null} Focus trap ID or null if failed
   */
  createFocusTrap(element, options = {}) {
    try {
      if (!element) {
        return null;
      }

      // Get the actual element if a selector string was provided
      const container = typeof element === 'string' 
        ? document.querySelector(element)
        : element;
        
      if (!container) {
        return null;
      }
      
      // Generate a unique trap ID
      const trapId = `trap-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Find all focusable elements inside the container
      const focusableElements = Array.from(
        container.querySelectorAll(this.focusableSelector)
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      
      // Store information about this focus trap
      this.focusTraps.set(trapId, {
        container,
        focusableElements,
        previouslyFocused: document.activeElement,
        initialFocus: options.initialFocus,
        onActivate: options.onActivate,
        onDeactivate: options.onDeactivate
      });
      
      // Activate trap immediately if requested
      if (options.autoActivate !== false) {
        this.activateFocusTrap(trapId);
      }
      
      return trapId;
    } catch (error) {
      this.logger.error('Error creating focus trap', error);
      return null;
    }
  }

  /**
   * Activate a focus trap
   * @param {string} trapId - Focus trap ID
   * @returns {boolean} Success status
   */
  activateFocusTrap(trapId) {
    if (!trapId || !this.focusTraps.has(trapId)) {
      return false;
    }
    
    const trapInfo = this.focusTraps.get(trapId);
    
    // Store currently focused element
    trapInfo.previouslyFocused = document.activeElement;
    
    // Add to active traps stack
    if (!this.activeTraps.includes(trapId)) {
      this.activeTraps.push(trapId);
    }
    
    // Find the element to focus initially
    let initialFocusElement = null;
    
    if (trapInfo.initialFocus) {
      // Try to find the specified initial focus element
      initialFocusElement = typeof trapInfo.initialFocus === 'string'
        ? trapInfo.container.querySelector(trapInfo.initialFocus)
        : trapInfo.initialFocus;
    }
    
    // If not specified or not found, use the first focusable element
    if (!initialFocusElement && trapInfo.focusableElements.length > 0) {
      initialFocusElement = trapInfo.focusableElements[0];
    }
    
    // Set focus after a short delay to allow for any animations
    setTimeout(() => {
      if (initialFocusElement) {
        initialFocusElement.focus();
      } else {
        trapInfo.container.setAttribute('tabindex', '-1');
        trapInfo.container.focus();
      }
      
      // Call the onActivate callback if provided
      if (typeof trapInfo.onActivate === 'function') {
        trapInfo.onActivate(trapId, trapInfo);
      }
      
      this.eventBus.publish('accessibility:focustrap:activated', { 
        trapId, 
        container: trapInfo.container 
      });
    }, 50);
    
    return true;
  }

  /**
   * Deactivate a focus trap
   * @param {string} trapId - Focus trap ID
   * @returns {boolean} Success status
   */
  deactivateFocusTrap(trapId) {
    if (!trapId || !this.focusTraps.has(trapId)) {
      return false;
    }
    
    const trapInfo = this.focusTraps.get(trapId);
    
    // Remove from active traps stack
    const index = this.activeTraps.indexOf(trapId);
    if (index !== -1) {
      this.activeTraps.splice(index, 1);
    }
    
    // Restore focus to the previously focused element
    if (trapInfo.previouslyFocused && trapInfo.previouslyFocused.focus) {
      setTimeout(() => {
        trapInfo.previouslyFocused.focus();
        
        // Call the onDeactivate callback if provided
        if (typeof trapInfo.onDeactivate === 'function') {
          trapInfo.onDeactivate(trapId, trapInfo);
        }
        
        this.eventBus.publish('accessibility:focustrap:deactivated', { 
          trapId, 
          container: trapInfo.container 
        });
      }, 50);
    }
    
    return true;
  }

  /**
   * Remove a focus trap permanently
   * @param {string} trapId - Focus trap ID
   * @returns {boolean} Success status
   */
  removeFocusTrap(trapId) {
    if (!trapId || !this.focusTraps.has(trapId)) {
      return false;
    }
    
    // Deactivate if active
    if (this.activeTraps.includes(trapId)) {
      this.deactivateFocusTrap(trapId);
    }
    
    // Remove from traps map
    this.focusTraps.delete(trapId);
    
    return true;
  }

  /**
   * Update focusable elements in a trap
   * @param {string} trapId - Focus trap ID
   * @returns {boolean} Success status
   */
  updateFocusTrap(trapId) {
    if (!trapId || !this.focusTraps.has(trapId)) {
      return false;
    }
    
    const trapInfo = this.focusTraps.get(trapId);
    
    // Update list of focusable elements
    trapInfo.focusableElements = Array.from(
      trapInfo.container.querySelectorAll(this.focusableSelector)
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    
    return true;
  }

  /**
   * Get all registered shortcuts
   * @returns {Object} All shortcuts
   */
  getAllShortcuts() {
    const result = {
      builtIn: { ...this.shortcuts },
      custom: {}
    };
    
    // Convert custom shortcuts Map to object
    for (const [id, data] of this.customShortcuts.entries()) {
      result.custom[id] = { ...data };
    }
    
    return result;
  }

  /**
   * Destroy keyboard navigation manager
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    document.removeEventListener('keyup', this._handleKeyUp);
    document.removeEventListener('focusin', this._handleFocusIn);
    
    // Clear active traps
    this.activeTraps = [];
    this.focusTraps.clear();
    this.customShortcuts.clear();
    
    this.initialized = false;
  }
}

// Create singleton instance
const instance = KeyboardNavigationManager.getInstance();

export { instance as KeyboardNavigationManager };
export default instance;
