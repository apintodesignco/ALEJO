/**
 * ALEJO ARIA Enhancer
 * 
 * This module extends the core ARIA Manager by automatically enhancing DOM elements
 * with proper ARIA attributes based on context and element types. It uses intelligent
 * detection to identify UI patterns and apply appropriate ARIA roles and attributes.
 * 
 * @module personalization/accessibility/aria-enhancer
 */

import AriaManager from './aria-manager.js';
import { EventBus } from '../../core/events/event-bus.js';
import { Logger } from '../../core/logger/logger.js';

/**
 * Component patterns that can be automatically detected and enhanced with ARIA attributes
 */
const COMPONENT_PATTERNS = {
  accordion: {
    container: '.accordion, [data-component="accordion"]',
    header: '.accordion-header, [data-role="accordion-header"]',
    panel: '.accordion-panel, [data-role="accordion-panel"]',
    attributes: {
      container: { role: 'presentation' },
      header: { 
        role: 'button',
        'aria-expanded': 'false',
        'aria-controls': '%panelId%'
      },
      panel: {
        role: 'region',
        'aria-labelledby': '%headerId%',
        hidden: true
      }
    }
  },
  tabs: {
    container: '.tabs, [data-component="tabs"]',
    tablist: '.tabs-list, [data-role="tablist"]',
    tab: '.tab, [data-role="tab"]',
    tabpanel: '.tab-panel, [data-role="tabpanel"]',
    attributes: {
      tablist: { role: 'tablist' },
      tab: { 
        role: 'tab',
        'aria-selected': 'false',
        'aria-controls': '%panelId%'
      },
      tabpanel: {
        role: 'tabpanel',
        'aria-labelledby': '%tabId%',
        hidden: true
      }
    }
  },
  modal: {
    container: '.modal, [data-component="modal"]',
    dialog: '.modal-dialog, [data-role="modal-dialog"]',
    title: '.modal-title, [data-role="modal-title"]',
    close: '.modal-close, [data-role="modal-close"]',
    attributes: {
      dialog: { 
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': '%titleId%'
      },
      close: {
        'aria-label': 'Close modal'
      }
    }
  },
  dropdown: {
    button: '.dropdown-toggle, [data-role="dropdown-toggle"]',
    menu: '.dropdown-menu, [data-role="dropdown-menu"]',
    attributes: {
      button: { 
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        'aria-controls': '%menuId%'
      },
      menu: {
        role: 'menu',
        hidden: true
      }
    }
  },
  slider: {
    container: '.slider, [data-component="slider"]',
    thumb: '.slider-thumb, [data-role="slider-thumb"]',
    attributes: {
      container: {
        role: 'none'
      },
      thumb: {
        role: 'slider',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '50',
        'aria-orientation': 'horizontal'
      }
    }
  }
};

/**
 * ARIA Enhancer class for automatic ARIA attribute management
 */
class AriaEnhancer {
  /**
   * Creates a new AriaEnhancer instance
   */
  constructor() {
    this.initialized = false;
    this.ariaManager = AriaManager;
    this.eventBus = null;
    this.logger = null;
    this.mutationObserver = null;
    this.enhancedElements = new WeakMap();
    this.pendingEnhancements = [];
    this.enhancementInterval = null;
    this.processingEnhancements = false;
  }

  /**
   * Get singleton instance
   * @returns {AriaEnhancer} Singleton instance
   */
  static getInstance() {
    if (!AriaEnhancer.instance) {
      AriaEnhancer.instance = new AriaEnhancer();
    }
    return AriaEnhancer.instance;
  }

  /**
   * Initialize the ARIA Enhancer
   * @param {Object} options - Initialization options
   * @param {boolean} options.observeDomChanges - Whether to observe DOM changes for automatic enhancement
   * @param {boolean} options.enhanceExistingElements - Whether to enhance existing elements on initialization
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }

      const defaultOptions = {
        observeDomChanges: true,
        enhanceExistingElements: true
      };

      const finalOptions = { ...defaultOptions, ...options };

      this.eventBus = EventBus.getInstance();
      this.logger = new Logger('AriaEnhancer');

      // Wait for ARIA Manager initialization if not already initialized
      if (!this.ariaManager.initialized) {
        await this.ariaManager.initialize();
      }

      // Set up DOM mutation observer if enabled
      if (finalOptions.observeDomChanges) {
        this._setupMutationObserver();
      }

      // Enhance existing elements if enabled
      if (finalOptions.enhanceExistingElements) {
        this.enhanceExistingElements();
      }

      // Set up processing interval for batched enhancements
      this.enhancementInterval = setInterval(() => this._processEnhancementQueue(), 100);

      this.eventBus.publish('accessibility:aria-enhancer:initialized', { success: true });
      this.initialized = true;
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize ARIA Enhancer', error);
      this.eventBus.publish('accessibility:aria-enhancer:initialized', { 
        success: false,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Set up mutation observer to watch for DOM changes
   * @private
   */
  _setupMutationObserver() {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this._queueElementForEnhancement(node);
              // Also queue any matching descendants
              node.querySelectorAll('*').forEach(element => {
                this._queueElementForEnhancement(element);
              });
            }
          });
        }
      }
    });

    // Start observing the document
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Queue an element for ARIA enhancement
   * @param {HTMLElement} element - Element to enhance
   * @private
   */
  _queueElementForEnhancement(element) {
    if (this.enhancedElements.has(element)) {
      return;
    }
    this.pendingEnhancements.push(element);
  }

  /**
   * Process the queue of elements waiting for enhancement
   * @private
   */
  _processEnhancementQueue() {
    if (this.processingEnhancements || this.pendingEnhancements.length === 0) {
      return;
    }

    this.processingEnhancements = true;
    
    try {
      // Take up to 50 elements from the queue
      const elementsToProcess = this.pendingEnhancements.splice(0, 50);
      
      elementsToProcess.forEach(element => {
        try {
          this._enhanceElementWithAria(element);
          this.enhancedElements.set(element, true);
        } catch (error) {
          this.logger.error('Error enhancing element with ARIA', error, element);
        }
      });
    } finally {
      this.processingEnhancements = false;
    }
  }

  /**
   * Enhance an element with appropriate ARIA attributes based on patterns
   * @param {HTMLElement} element - Element to enhance
   * @private
   */
  _enhanceElementWithAria(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    // Skip elements that are already enhanced or have aria-enhanced attribute
    if (element.hasAttribute('data-aria-enhanced')) {
      return;
    }

    // Check each component pattern
    Object.entries(COMPONENT_PATTERNS).forEach(([componentName, pattern]) => {
      // Check if element matches any role in the pattern
      Object.entries(pattern).forEach(([role, selector]) => {
        if (role === 'attributes') {
          return; // Skip the attributes object
        }

        if (element.matches(selector)) {
          // Apply attributes for this role
          const attributes = pattern.attributes?.[role];
          if (attributes) {
            this._applyAriaAttributes(element, attributes, componentName);
          }

          // Mark as enhanced
          element.setAttribute('data-aria-enhanced', componentName);
        }
      });
    });

    // Special case for images without alt text
    if (element.tagName === 'IMG' && !element.hasAttribute('alt')) {
      element.setAttribute('alt', '');
      element.setAttribute('data-aria-enhanced', 'image');
    }

    // Add role="presentation" to purely decorative elements
    if (element.classList.contains('decorative') || element.hasAttribute('data-decorative')) {
      element.setAttribute('role', 'presentation');
      element.setAttribute('data-aria-enhanced', 'decorative');
    }
  }

  /**
   * Apply ARIA attributes to an element
   * @param {HTMLElement} element - Target element
   * @param {Object} attributes - Attributes to apply
   * @param {string} componentType - Component type for ID generation
   * @private
   */
  _applyAriaAttributes(element, attributes, componentType) {
    if (!element || !attributes) return;

    // Generate IDs for related elements if needed
    const parentComponent = element.closest(`[data-component="${componentType}"]`) || 
                           element.closest(`.${componentType}`);

    Object.entries(attributes).forEach(([attr, value]) => {
      if (typeof value === 'string' && value.includes('%')) {
        // This is a template that needs to be filled
        if (value.includes('%panelId%')) {
          // Find related panel and ensure it has an ID
          const panel = parentComponent?.querySelector('[data-role="tabpanel"], .tab-panel, [data-role="accordion-panel"], .accordion-panel');
          if (panel) {
            if (!panel.id) {
              panel.id = `${componentType}-panel-${this._generateUniqueId()}`;
            }
            value = value.replace('%panelId%', panel.id);
          }
        }
        
        if (value.includes('%tabId%')) {
          // Find related tab and ensure it has an ID
          const tab = parentComponent?.querySelector('[data-role="tab"], .tab');
          if (tab) {
            if (!tab.id) {
              tab.id = `${componentType}-tab-${this._generateUniqueId()}`;
            }
            value = value.replace('%tabId%', tab.id);
          }
        }
        
        if (value.includes('%headerId%')) {
          // Find related header and ensure it has an ID
          const header = parentComponent?.querySelector('[data-role="accordion-header"], .accordion-header');
          if (header) {
            if (!header.id) {
              header.id = `${componentType}-header-${this._generateUniqueId()}`;
            }
            value = value.replace('%headerId%', header.id);
          }
        }
        
        if (value.includes('%titleId%')) {
          // Find related title and ensure it has an ID
          const title = parentComponent?.querySelector('[data-role="modal-title"], .modal-title');
          if (title) {
            if (!title.id) {
              title.id = `${componentType}-title-${this._generateUniqueId()}`;
            }
            value = value.replace('%titleId%', title.id);
          }
        }
        
        if (value.includes('%menuId%')) {
          // Find related menu and ensure it has an ID
          const menu = element.nextElementSibling?.matches('[data-role="dropdown-menu"], .dropdown-menu') 
            ? element.nextElementSibling 
            : parentComponent?.querySelector('[data-role="dropdown-menu"], .dropdown-menu');
            
          if (menu) {
            if (!menu.id) {
              menu.id = `${componentType}-menu-${this._generateUniqueId()}`;
            }
            value = value.replace('%menuId%', menu.id);
          }
        }
      }

      // Apply the attribute
      element.setAttribute(attr, value);
    });
  }

  /**
   * Generate a unique ID for ARIA relationships
   * @returns {string} Unique ID
   * @private
   */
  _generateUniqueId() {
    return `aria-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * Enhance all existing elements in the document
   * @returns {number} Number of elements enhanced
   */
  enhanceExistingElements() {
    let count = 0;

    // Enhance by component pattern selectors
    Object.values(COMPONENT_PATTERNS).forEach(pattern => {
      Object.entries(pattern).forEach(([role, selector]) => {
        if (role === 'attributes') return;
        
        document.querySelectorAll(selector).forEach(element => {
          this._queueElementForEnhancement(element);
          count++;
        });
      });
    });

    // Enhance images without alt attributes
    document.querySelectorAll('img:not([alt])').forEach(element => {
      this._queueElementForEnhancement(element);
      count++;
    });

    // Enhance decorative elements
    document.querySelectorAll('.decorative, [data-decorative]').forEach(element => {
      this._queueElementForEnhancement(element);
      count++;
    });

    return count;
  }

  /**
   * Enhance a specific element tree with ARIA attributes
   * @param {HTMLElement} rootElement - Root element of the tree to enhance
   * @returns {number} Number of elements enhanced
   */
  enhanceElementTree(rootElement) {
    let count = 0;

    if (!rootElement) {
      return count;
    }

    // Enhance the root element
    this._enhanceElementWithAria(rootElement);
    count++;

    // Enhance all child elements
    rootElement.querySelectorAll('*').forEach(element => {
      this._enhanceElementWithAria(element);
      count++;
    });

    return count;
  }

  /**
   * Update ARIA attributes for a dynamic element (like a slider)
   * @param {HTMLElement} element - Element to update
   * @param {Object} attributes - New attribute values
   */
  updateAriaAttributes(element, attributes) {
    if (!element || !attributes) {
      return false;
    }

    Object.entries(attributes).forEach(([attr, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(attr);
      } else {
        element.setAttribute(attr, value);
      }
    });

    return true;
  }

  /**
   * Destroy the ARIA Enhancer and clean up resources
   */
  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.enhancementInterval) {
      clearInterval(this.enhancementInterval);
      this.enhancementInterval = null;
    }

    this.pendingEnhancements = [];
    this.enhancedElements = new WeakMap();
    this.initialized = false;
  }
}

// Create singleton instance
const instance = AriaEnhancer.getInstance();

export { instance as AriaEnhancer };
export default instance;
