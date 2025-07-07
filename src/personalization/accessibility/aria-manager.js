/**
 * ALEJO ARIA Manager
 * 
 * Provides centralized management of ARIA attributes and keyboard navigation
 * for all ALEJO components. This module ensures consistent accessibility
 * implementation across the application.
 * 
 * @module personalization/accessibility/aria-manager
 */

import { EventBus } from '../../core/events/event-bus.js';
import { ErrorHandler } from '../../core/error/error-handler.js';
import { ResourceAllocationManager } from '../../performance/resource-allocation-manager.js';

export class AriaManager {
  /**
   * Creates a new ARIA Manager instance
   */
  constructor() {
    this.initialized = false;
    this.elements = new Map();
    this.liveRegions = new Map();
    this.keyboardTraps = [];
    this.focusableSelector = 'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
    this.eventHandlers = new Map();
    this.resourceManager = null;
    this.errorHandler = null;
    this.eventBus = null;
  }

  /**
   * Initializes the ARIA Manager
   * @param {Object} options - Initialization options
   * @param {ResourceAllocationManager} options.resourceManager - Resource allocation manager instance
   * @param {ErrorHandler} options.errorHandler - Error handler instance
   * @param {EventBus} options.eventBus - Event bus instance
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }

      this.resourceManager = options.resourceManager || ResourceAllocationManager.getInstance();
      this.errorHandler = options.errorHandler || ErrorHandler.getInstance();
      this.eventBus = options.eventBus || EventBus.getInstance();

      // Register with resource manager
      await this.resourceManager.registerComponent('AriaManager', {
        priority: 'high',
        category: 'accessibility',
        resourceUsage: {
          memory: 'low',
          cpu: 'low',
          network: 'none'
        }
      });

      // Set up global keyboard event listeners
      this._setupGlobalKeyboardHandlers();
      
      // Create default live regions
      this._createDefaultLiveRegions();
      
      // Subscribe to relevant events
      this._subscribeToEvents();
      
      this.initialized = true;
      this.eventBus.publish('accessibility:aria:initialized', { success: true });
      
      return true;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        source: 'AriaManager.initialize',
        severity: 'high',
        message: 'Failed to initialize ARIA Manager'
      });
      
      this.eventBus.publish('accessibility:aria:initialized', { 
        success: false,
        error: error.message
      });
      
      // Implement minimal fallback
      this._setupMinimalFallback();
      
      return false;
    }
  }

  /**
   * Sets up minimal fallback functionality when full initialization fails
   * @private
   */
  _setupMinimalFallback() {
    try {
      // Set up basic keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          // Ensure at least basic tab navigation works
          const focusableElements = document.querySelectorAll(this.focusableSelector);
          if (focusableElements.length === 0) return;
          
          // If we detect we're about to exit the ALEJO interface, wrap focus
          if (!e.shiftKey && document.activeElement === focusableElements[focusableElements.length - 1]) {
            e.preventDefault();
            focusableElements[0].focus();
          } else if (e.shiftKey && document.activeElement === focusableElements[0]) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
          }
        }
      });
      
      // Create a basic announcement region
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.classList.add('sr-only');
      document.body.appendChild(liveRegion);
      
      this.liveRegions.set('fallback', liveRegion);
      
      console.warn('ARIA Manager running in fallback mode with limited functionality');
    } catch (error) {
      console.error('Failed to set up ARIA Manager fallback:', error);
    }
  }

  /**
   * Sets up global keyboard event handlers
   * @private
   */
  _setupGlobalKeyboardHandlers() {
    // Handle ESC key for closing modals and dialogs
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (activeModal) {
          const closeButton = activeModal.querySelector('[data-close-modal]');
          if (closeButton) {
            closeButton.click();
          }
          this.eventBus.publish('accessibility:dialog:escape', { dialogId: activeModal.id });
        }
      }
    };
    
    // Handle tab key for focus management
    const tabHandler = (e) => {
      if (e.key === 'Tab') {
        // Check if we're in a modal or other focus trap
        const activeTrap = this.keyboardTraps[this.keyboardTraps.length - 1];
        if (activeTrap) {
          const focusableElements = activeTrap.querySelectorAll(this.focusableSelector);
          if (focusableElements.length === 0) return;
          
          // If we're about to exit the trap, wrap focus
          if (!e.shiftKey && document.activeElement === focusableElements[focusableElements.length - 1]) {
            e.preventDefault();
            focusableElements[0].focus();
          } else if (e.shiftKey && document.activeElement === focusableElements[0]) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
          }
        }
      }
    };
    
    // Skip to content handler
    const skipToContentHandler = (e) => {
      if (e.key === '/' && e.ctrlKey) {
        e.preventDefault();
        const mainContent = document.querySelector('main, [role="main"]');
        if (mainContent) {
          mainContent.setAttribute('tabindex', '-1');
          mainContent.focus();
          // Remove tabindex after focus to avoid leaving tabindex on the element
          setTimeout(() => {
            mainContent.removeAttribute('tabindex');
          }, 100);
        }
      }
    };
    
    document.addEventListener('keydown', escHandler);
    document.addEventListener('keydown', tabHandler);
    document.addEventListener('keydown', skipToContentHandler);
    
    this.eventHandlers.set('escHandler', escHandler);
    this.eventHandlers.set('tabHandler', tabHandler);
    this.eventHandlers.set('skipToContentHandler', skipToContentHandler);
  }

  /**
   * Creates default live regions for screen reader announcements
   * @private
   */
  _createDefaultLiveRegions() {
    // Create polite announcement region
    const politeRegion = document.createElement('div');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.classList.add('sr-only');
    document.body.appendChild(politeRegion);
    
    // Create assertive announcement region
    const assertiveRegion = document.createElement('div');
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.classList.add('sr-only');
    document.body.appendChild(assertiveRegion);
    
    // Create status region
    const statusRegion = document.createElement('div');
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-atomic', 'true');
    statusRegion.classList.add('sr-only');
    document.body.appendChild(statusRegion);
    
    // Create alert region
    const alertRegion = document.createElement('div');
    alertRegion.setAttribute('role', 'alert');
    alertRegion.setAttribute('aria-atomic', 'true');
    alertRegion.classList.add('sr-only');
    document.body.appendChild(alertRegion);
    
    this.liveRegions.set('polite', politeRegion);
    this.liveRegions.set('assertive', assertiveRegion);
    this.liveRegions.set('status', statusRegion);
    this.liveRegions.set('alert', alertRegion);
  }

  /**
   * Subscribes to relevant events
   * @private
   */
  _subscribeToEvents() {
    // Listen for dynamic content changes
    this.eventBus.subscribe('ui:content:updated', (data) => {
      if (data.elementId) {
        this.updateAriaAttributes(data.elementId, data.attributes);
      }
      
      if (data.announcement) {
        this.announce(data.announcement, data.priority || 'polite');
      }
    });
    
    // Listen for dialog open/close events
    this.eventBus.subscribe('ui:dialog:opened', (data) => {
      if (data.dialogId) {
        const dialog = document.getElementById(data.dialogId);
        if (dialog) {
          this.trapFocus(dialog);
        }
      }
    });
    
    this.eventBus.subscribe('ui:dialog:closed', (data) => {
      if (data.dialogId) {
        const dialog = document.getElementById(data.dialogId);
        if (dialog) {
          this.releaseFocus(dialog);
        }
      }
    });
  }

  /**
   * Makes an announcement for screen readers
   * @param {string} message - The message to announce
   * @param {string} priority - Priority of the announcement (polite, assertive, status, alert)
   */
  announce(message, priority = 'polite') {
    if (!this.initialized && !this.liveRegions.has('fallback')) {
      console.warn('ARIA Manager not initialized, announcement not made');
      return;
    }
    
    const region = this.liveRegions.get(priority) || this.liveRegions.get('fallback') || this.liveRegions.get('polite');
    
    if (!region) {
      console.error(`No live region found for priority: ${priority}`);
      return;
    }
    
    // Clear previous content and add new announcement
    region.textContent = '';
    
    // Use setTimeout to ensure the DOM update is recognized by screen readers
    setTimeout(() => {
      region.textContent = message;
    }, 50);
    
    // Log the announcement for debugging
    this.eventBus.publish('accessibility:announcement', {
      message,
      priority
    });
  }

  /**
   * Updates ARIA attributes for an element
   * @param {string} elementId - ID of the element to update
   * @param {Object} attributes - ARIA attributes to set
   */
  updateAriaAttributes(elementId, attributes = {}) {
    const element = document.getElementById(elementId);
    
    if (!element) {
      this.errorHandler.handleError({
        source: 'AriaManager.updateAriaAttributes',
        severity: 'medium',
        message: `Element with ID ${elementId} not found`
      });
      return;
    }
    
    // Update all provided attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key.startsWith('aria-') || key === 'role') {
        if (value === null) {
          element.removeAttribute(key);
        } else {
          element.setAttribute(key, value);
        }
      }
    });
    
    // Track this element
    this.elements.set(elementId, {
      element,
      attributes
    });
  }

  /**
   * Traps keyboard focus within an element (for modals, dialogs)
   * @param {HTMLElement} element - Element to trap focus within
   */
  trapFocus(element) {
    if (!element) return;
    
    // Add to the trap stack
    this.keyboardTraps.push(element);
    
    // Find all focusable elements
    const focusableElements = element.querySelectorAll(this.focusableSelector);
    
    if (focusableElements.length > 0) {
      // Focus the first element after a short delay
      setTimeout(() => {
        focusableElements[0].focus();
      }, 50);
    }
    
    // Set appropriate ARIA attributes
    element.setAttribute('aria-modal', 'true');
    
    // Store previous focus to restore later
    element._previousFocus = document.activeElement;
  }

  /**
   * Releases keyboard focus trap
   * @param {HTMLElement} element - Element to release focus from
   */
  releaseFocus(element) {
    if (!element) return;
    
    // Remove from trap stack
    const index = this.keyboardTraps.indexOf(element);
    if (index !== -1) {
      this.keyboardTraps.splice(index, 1);
    }
    
    // Restore previous focus
    if (element._previousFocus && typeof element._previousFocus.focus === 'function') {
      element._previousFocus.focus();
    }
    
    // Update ARIA attributes
    element.setAttribute('aria-modal', 'false');
  }

  /**
   * Registers a component with the ARIA Manager
   * @param {string} componentId - Unique ID for the component
   * @param {Object} options - Component options
   * @param {HTMLElement} options.element - The component's root element
   * @param {Object} options.ariaAttributes - Initial ARIA attributes
   * @param {boolean} options.announceable - Whether changes to this component should be announced
   */
  registerComponent(componentId, options = {}) {
    if (!componentId) {
      this.errorHandler.handleError({
        source: 'AriaManager.registerComponent',
        severity: 'medium',
        message: 'Component ID is required'
      });
      return;
    }
    
    const { element, ariaAttributes, announceable = false } = options;
    
    if (!element) {
      this.errorHandler.handleError({
        source: 'AriaManager.registerComponent',
        severity: 'medium',
        message: `Element is required for component ${componentId}`
      });
      return;
    }
    
    // Store component information
    this.elements.set(componentId, {
      element,
      attributes: ariaAttributes || {},
      announceable
    });
    
    // Apply initial ARIA attributes
    if (ariaAttributes) {
      this.updateAriaAttributes(element.id, ariaAttributes);
    }
    
    // Set up mutation observer for dynamic content
    if (announceable) {
      const observer = new MutationObserver((mutations) => {
        const textChanges = mutations.some(mutation => 
          mutation.type === 'characterData' || 
          mutation.type === 'childList'
        );
        
        if (textChanges) {
          this.announce(`${componentId} content updated: ${element.textContent.trim().substring(0, 100)}`, 'polite');
        }
      });
      
      observer.observe(element, {
        childList: true,
        characterData: true,
        subtree: true
      });
      
      // Store observer reference
      this.elements.get(componentId).observer = observer;
    }
    
    return true;
  }

  /**
   * Unregisters a component
   * @param {string} componentId - ID of the component to unregister
   */
  unregisterComponent(componentId) {
    const component = this.elements.get(componentId);
    
    if (!component) {
      return false;
    }
    
    // Disconnect any observers
    if (component.observer) {
      component.observer.disconnect();
    }
    
    // Remove from tracked elements
    this.elements.delete(componentId);
    
    return true;
  }

  /**
   * Checks if an element is keyboard navigable
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} - True if the element is keyboard navigable
   */
  isKeyboardNavigable(element) {
    if (!element) return false;
    
    // Check if element matches our focusable selector
    const isFocusable = element.matches(this.focusableSelector);
    
    // Check if element is visible and not disabled
    const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;
    const isEnabled = !element.hasAttribute('disabled');
    
    return isFocusable && isVisible && isEnabled;
  }

  /**
   * Makes an element keyboard navigable
   * @param {HTMLElement} element - Element to make navigable
   * @param {Object} options - Options for keyboard navigation
   * @param {number} options.tabIndex - Tab index to set
   * @param {string} options.role - ARIA role to set
   * @param {Function} options.keyHandler - Custom key handler function
   */
  makeKeyboardNavigable(element, options = {}) {
    if (!element) return;
    
    const { tabIndex = 0, role, keyHandler } = options;
    
    // Set tabindex
    element.setAttribute('tabindex', tabIndex.toString());
    
    // Set role if provided
    if (role) {
      element.setAttribute('role', role);
    }
    
    // Add keyboard handler
    if (keyHandler && typeof keyHandler === 'function') {
      const handler = (e) => {
        keyHandler(e, element);
      };
      
      element.addEventListener('keydown', handler);
      
      // Store handler reference for potential cleanup
      if (!element._keyHandlers) {
        element._keyHandlers = [];
      }
      
      element._keyHandlers.push(handler);
    } else {
      // Add default keyboard handler for common interactions
      const defaultHandler = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          element.click();
        }
      };
      
      element.addEventListener('keydown', defaultHandler);
      
      if (!element._keyHandlers) {
        element._keyHandlers = [];
      }
      
      element._keyHandlers.push(defaultHandler);
    }
  }

  /**
   * Removes keyboard navigability from an element
   * @param {HTMLElement} element - Element to modify
   */
  removeKeyboardNavigability(element) {
    if (!element) return;
    
    // Remove tabindex
    element.removeAttribute('tabindex');
    
    // Remove event listeners
    if (element._keyHandlers) {
      element._keyHandlers.forEach(handler => {
        element.removeEventListener('keydown', handler);
      });
      
      element._keyHandlers = [];
    }
  }

  /**
   * Cleans up resources used by the ARIA Manager
   */
  cleanup() {
    // Remove global event listeners
    this.eventHandlers.forEach((handler, key) => {
      document.removeEventListener('keydown', handler);
    });
    
    // Clear keyboard traps
    this.keyboardTraps = [];
    
    // Disconnect all observers
    this.elements.forEach((component) => {
      if (component.observer) {
        component.observer.disconnect();
      }
    });
    
    // Remove live regions
    this.liveRegions.forEach((region) => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    
    // Clear collections
    this.elements.clear();
    this.liveRegions.clear();
    this.eventHandlers.clear();
    
    this.initialized = false;
  }

  /**
   * Gets the singleton instance of AriaManager
   * @returns {AriaManager} - The singleton instance
   */
  static getInstance() {
    if (!AriaManager.instance) {
      AriaManager.instance = new AriaManager();
    }
    
    return AriaManager.instance;
  }
}

// Export singleton instance
export default AriaManager.getInstance();
