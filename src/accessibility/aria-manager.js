/**
 * @file aria-manager.js
 * @description ARIA attributes management for screen reader accessibility
 * @module accessibility/aria-manager
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';

// Initialize logger
const logger = new Logger('AriaManager');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;

// Element registry for enhanced elements
const _enhancedElements = new WeakMap();

// Default configuration
const DEFAULT_CONFIG = {
  // Whether to enhance elements with additional ARIA attributes
  enhanceElements: true,
  // Whether to announce dynamic content changes
  announceLiveChanges: true,
  // Politeness level for live regions
  liveRegionPoliteness: 'polite',
  // Whether to apply ARIA labels to icons
  labelIcons: true
};

/**
 * Initialize the ARIA manager
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('ARIA manager already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing ARIA manager');
    
    // Apply configuration
    _config = { ...DEFAULT_CONFIG, ...config };
    _enabled = _config.enhanceElements;
    
    // Set up mutation observers for dynamic content
    if (_config.announceLiveChanges) {
      setupMutationObservers();
    }
    
    // Set up event listeners
    EventBus.subscribe('ui:componentMounted', handleComponentMounted);
    EventBus.subscribe('ui:dialogOpened', handleDialogOpened);
    
    _initialized = true;
    logger.info('ARIA manager initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize ARIA manager', error);
    return false;
  }
}

/**
 * Enable or disable ARIA enhancements
 * @param {boolean} enable - Whether to enable ARIA enhancements
 */
export function setEnabled(enable) {
  _enabled = enable;
  logger.info(`ARIA enhancements ${enable ? 'enabled' : 'disabled'}`);
}

/**
 * Update configuration
 * @param {Object} config - New configuration
 */
export function updateConfig(config) {
  if (!_initialized) {
    return;
  }
  
  _config = { ...DEFAULT_CONFIG, ...config };
  _enabled = _config.enhanceElements;
}

/**
 * Enhance an element with ARIA attributes
 * @param {HTMLElement} element - Element to enhance
 * @param {Object} options - Enhancement options
 * @returns {boolean} - True if enhancement successful
 */
export function enhanceElement(element, options = {}) {
  if (!_initialized || !_enabled || !element) {
    return false;
  }
  
  try {
    const opts = {
      role: options.role || null,
      label: options.label || null,
      description: options.description || null,
      liveRegion: options.liveRegion || false,
      polite: options.polite !== undefined ? options.polite : (_config.liveRegionPoliteness === 'polite'),
      hidden: options.hidden !== undefined ? options.hidden : false,
      expanded: options.expanded !== undefined ? options.expanded : null,
      controls: options.controls || null,
      owns: options.owns || null,
      hasPopup: options.hasPopup || null,
      required: options.required !== undefined ? options.required : null,
      invalid: options.invalid !== undefined ? options.invalid : null,
      checked: options.checked !== undefined ? options.checked : null,
      selected: options.selected !== undefined ? options.selected : null
    };
    
    // Store original values
    const originalAttributes = {};
    ['role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-live',
     'aria-hidden', 'aria-expanded', 'aria-controls', 'aria-owns', 'aria-haspopup',
     'aria-required', 'aria-invalid', 'aria-checked', 'aria-selected'].forEach(attr => {
      if (element.hasAttribute(attr)) {
        originalAttributes[attr] = element.getAttribute(attr);
      }
    });
    
    _enhancedElements.set(element, {
      original: originalAttributes,
      enhanced: true,
      options: { ...opts }
    });
    
    // Apply ARIA attributes
    if (opts.role) {
      element.setAttribute('role', opts.role);
    }
    
    if (opts.label) {
      element.setAttribute('aria-label', opts.label);
    }
    
    if (opts.description) {
      // If description refers to an element ID
      if (opts.description.startsWith('#') && document.getElementById(opts.description.substring(1))) {
        element.setAttribute('aria-describedby', opts.description.substring(1));
      } else {
        // Create a hidden element for the description
        const descId = `desc-${Math.random().toString(36).substring(2, 10)}`;
        const descElement = document.createElement('div');
        descElement.id = descId;
        descElement.className = 'sr-only';
        descElement.textContent = opts.description;
        
        // Add to document
        element.parentNode.insertBefore(descElement, element.nextSibling);
        element.setAttribute('aria-describedby', descId);
      }
    }
    
    if (opts.liveRegion) {
      element.setAttribute('aria-live', opts.polite ? 'polite' : 'assertive');
      element.setAttribute('aria-atomic', 'true');
    }
    
    if (opts.hidden !== null) {
      element.setAttribute('aria-hidden', opts.hidden.toString());
    }
    
    if (opts.expanded !== null) {
      element.setAttribute('aria-expanded', opts.expanded.toString());
    }
    
    if (opts.controls) {
      element.setAttribute('aria-controls', opts.controls);
    }
    
    if (opts.owns) {
      element.setAttribute('aria-owns', opts.owns);
    }
    
    if (opts.hasPopup) {
      element.setAttribute('aria-haspopup', 
        typeof opts.hasPopup === 'boolean' ? 'true' : opts.hasPopup);
    }
    
    if (opts.required !== null) {
      element.setAttribute('aria-required', opts.required.toString());
    }
    
    if (opts.invalid !== null) {
      element.setAttribute('aria-invalid', opts.invalid.toString());
    }
    
    if (opts.checked !== null) {
      element.setAttribute('aria-checked', opts.checked.toString());
    }
    
    if (opts.selected !== null) {
      element.setAttribute('aria-selected', opts.selected.toString());
    }
    
    // Special handling for specific elements
    enhanceSpecialElements(element, opts);
    
    return true;
  } catch (error) {
    logger.error('Error enhancing element with ARIA attributes', error);
    return false;
  }
}

/**
 * Reset an element to its original ARIA attributes
 * @param {HTMLElement} element - Element to reset
 * @returns {boolean} - True if reset successful
 */
export function resetElement(element) {
  if (!_initialized || !element) {
    return false;
  }
  
  try {
    // Check if element was enhanced
    const enhancedData = _enhancedElements.get(element);
    
    if (!enhancedData) {
      return false;
    }
    
    // Remove all ARIA attributes
    ['role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-live',
     'aria-atomic', 'aria-hidden', 'aria-expanded', 'aria-controls', 'aria-owns',
     'aria-haspopup', 'aria-required', 'aria-invalid', 'aria-checked', 'aria-selected'].forEach(attr => {
      element.removeAttribute(attr);
    });
    
    // Restore original attributes
    Object.entries(enhancedData.original).forEach(([attr, value]) => {
      element.setAttribute(attr, value);
    });
    
    // Remove any description elements that were added
    if (element.getAttribute('aria-describedby')) {
      const descId = element.getAttribute('aria-describedby');
      const descElement = document.getElementById(descId);
      if (descElement && descElement.classList.contains('sr-only')) {
        descElement.parentNode.removeChild(descElement);
      }
    }
    
    // Remove from registry
    _enhancedElements.delete(element);
    
    return true;
  } catch (error) {
    logger.error('Error resetting element ARIA attributes', error);
    return false;
  }
}

/**
 * Create a live region for announcing content to screen readers
 * @param {string} id - ID for the live region
 * @param {boolean} [assertive=false] - Whether the region should be assertive
 * @returns {HTMLElement} - The created live region element
 */
export function createLiveRegion(id, assertive = false) {
  if (!_initialized) {
    logger.warn('Creating live region before initialization');
  }
  
  // Check if the region already exists
  let region = document.getElementById(id);
  
  if (region) {
    return region;
  }
  
  // Create the live region
  region = document.createElement('div');
  region.id = id;
  region.className = 'sr-only';
  region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('aria-relevant', 'additions text');
  
  // Add to document
  document.body.appendChild(region);
  
  logger.debug(`Created live region ${id} with politeness ${assertive ? 'assertive' : 'polite'}`);
  
  return region;
}

/**
 * Update content in a live region
 * @param {string} id - ID of the live region
 * @param {string} content - Content to announce
 * @param {boolean} [clear=true] - Whether to clear the region after announcement
 * @returns {boolean} - True if update successful
 */
export function updateLiveRegion(id, content, clear = true) {
  if (!_initialized || !_config.announceLiveChanges) {
    return false;
  }
  
  try {
    // Get the live region
    let region = document.getElementById(id);
    
    if (!region) {
      // Create the region if it doesn't exist
      region = createLiveRegion(id);
    }
    
    // Update content
    region.textContent = content;
    
    // Clear after a delay if requested
    if (clear) {
      setTimeout(() => {
        region.textContent = '';
      }, 5000);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error updating live region ${id}`, error);
    return false;
  }
}

/**
 * Get the accessible name for an element
 * @param {HTMLElement} element - Element to get name for
 * @returns {string} - Accessible name
 */
export function getAccessibleName(element) {
  if (!element) {
    return '';
  }
  
  try {
    // Check for aria-label
    if (element.hasAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }
    
    // Check for aria-labelledby
    if (element.hasAttribute('aria-labelledby')) {
      const labelIds = element.getAttribute('aria-labelledby').split(' ');
      return labelIds
        .map(id => document.getElementById(id)?.textContent || '')
        .filter(text => text.trim() !== '')
        .join(' ');
    }
    
    // Check for label element (for form elements)
    if (element.id && element.tagName.match(/^(INPUT|SELECT|TEXTAREA|BUTTON|METER|OUTPUT|PROGRESS)$/i)) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent;
      }
    }
    
    // Check for button or link text
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent || '';
    }
    
    // Check for alt text on images
    if (element.tagName === 'IMG' && element.hasAttribute('alt')) {
      return element.getAttribute('alt');
    }
    
    // Check for title attribute
    if (element.hasAttribute('title')) {
      return element.getAttribute('title');
    }
    
    // Check for name attribute
    if (element.hasAttribute('name')) {
      return element.getAttribute('name');
    }
    
    // Check for text content
    if (element.textContent && element.textContent.trim() !== '') {
      return element.textContent.trim();
    }
    
    // No accessible name found
    return '';
  } catch (error) {
    logger.error('Error getting accessible name', error);
    return '';
  }
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  try {
    logger.info('Cleaning up ARIA manager');
    
    // Remove event listeners
    EventBus.unsubscribe('ui:componentMounted', handleComponentMounted);
    EventBus.unsubscribe('ui:dialogOpened', handleDialogOpened);
    
    // Remove mutation observers
    if (_mutationObserver) {
      _mutationObserver.disconnect();
      _mutationObserver = null;
    }
    
    _initialized = false;
    _enabled = false;
    
    logger.info('ARIA manager cleaned up');
  } catch (error) {
    logger.error('Error during ARIA manager cleanup', error);
  }
}

/* Private Functions */

// Mutation observer for tracking content changes
let _mutationObserver = null;

/**
 * Set up mutation observers for dynamic content
 * @private
 */
function setupMutationObservers() {
  if (!window.MutationObserver) {
    logger.warn('MutationObserver not supported, live region updates disabled');
    return;
  }
  
  // Create observer for tracking changes to live regions
  _mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      const target = mutation.target;
      
      // Skip non-element nodes and hidden elements
      if (target.nodeType !== Node.ELEMENT_NODE || 
          target.getAttribute('aria-hidden') === 'true' ||
          target.classList.contains('sr-only')) {
        return;
      }
      
      // Check if this is a live region
      if (target.getAttribute('aria-live')) {
        // Live region was updated, no need to do anything else
        return;
      }
      
      // Check if this is a significant content update
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check for important content changes
        let importantChange = false;
        let newContent = '';
        
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if added element has important role
            const role = node.getAttribute('role');
            if (role && ['alert', 'status', 'log', 'marquee', 'timer'].includes(role)) {
              importantChange = true;
              newContent = node.textContent;
            }
          } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
            newContent += node.textContent + ' ';
          }
        });
        
        if (importantChange || newContent.trim() !== '') {
          // Find nearest element with ID for reference
          let referenceElement = target;
          let referenceId = null;
          
          while (referenceElement && !referenceId) {
            if (referenceElement.id) {
              referenceId = referenceElement.id;
            } else {
              referenceElement = referenceElement.parentElement;
            }
          }
          
          // Generate ID if none found
          if (!referenceId) {
            referenceId = `content-update-${Math.random().toString(36).substring(2, 10)}`;
            target.id = referenceId;
          }
          
          // Create a reference to the updated element
          const updateEvent = {
            source: referenceId,
            content: newContent.trim(),
            role: role || null
          };
          
          // Publish content update event
          EventBus.publish('accessibility:contentUpdated', updateEvent);
        }
      }
    });
  });
  
  // Start observing
  _mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  logger.debug('Mutation observer set up for live region tracking');
}

/**
 * Enhance special elements with specific ARIA improvements
 * @private
 * @param {HTMLElement} element - Element to enhance
 * @param {Object} options - Enhancement options
 */
function enhanceSpecialElements(element, options) {
  if (!element) {
    return;
  }
  
  // Handle icons and SVGs
  if (element.tagName === 'SVG' || 
      element.tagName === 'I' || 
      element.classList.contains('icon') ||
      element.querySelector('svg')) {
    
    // If icon doesn't have an accessible name, try to infer one
    if (!getAccessibleName(element) && _config.labelIcons) {
      // Check for common icon classes
      const classes = Array.from(element.classList);
      
      // Check for FontAwesome icons
      const faMatch = classes.find(c => c.startsWith('fa-') && c !== 'fa-fw' && c !== 'fa-lg');
      if (faMatch) {
        const iconName = faMatch.replace('fa-', '').replace(/-/g, ' ');
        element.setAttribute('aria-label', iconName);
        
        // If it's just a decorative icon, hide it from screen readers
        if (element.parentElement && 
            (element.parentElement.tagName === 'BUTTON' || element.parentElement.tagName === 'A')) {
          element.setAttribute('aria-hidden', 'true');
        }
      }
      
      // Check for Material icons
      if (element.classList.contains('material-icons')) {
        element.setAttribute('aria-label', element.textContent.trim());
      }
    }
  }
  
  // Handle form elements
  if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
    // Ensure inputs have accessible names
    if (!getAccessibleName(element) && element.name) {
      // Use capitalized name as label
      const nameLabel = element.name.charAt(0).toUpperCase() + 
                       element.name.slice(1).replace(/([A-Z])/g, ' $1');
      element.setAttribute('aria-label', nameLabel);
    }
    
    // Add appropriate roles if missing
    if (!element.getAttribute('role')) {
      if (element.type === 'checkbox') {
        element.setAttribute('role', 'checkbox');
      } else if (element.type === 'radio') {
        element.setAttribute('role', 'radio');
      } else if (element.type === 'range') {
        element.setAttribute('role', 'slider');
      } else if (element.tagName === 'SELECT') {
        element.setAttribute('role', 'combobox');
      }
    }
  }
  
  // Handle buttons without types
  if (element.tagName === 'BUTTON' && !element.getAttribute('type')) {
    element.setAttribute('type', 'button'); // Prevent accidental form submissions
  }
  
  // Handle tables
  if (element.tagName === 'TABLE') {
    // Add role=presentation for layout tables
    if (!element.querySelector('th') && !element.querySelector('thead')) {
      element.setAttribute('role', 'presentation');
    }
  }
}

/**
 * Handle component mounted events
 * @private
 * @param {Object} data - Event data
 */
function handleComponentMounted(data) {
  if (!_initialized || !_enabled) {
    return;
  }
  
  try {
    const { component, root } = data;
    
    if (!component || !root) {
      return;
    }
    
    // Check if component has accessibility options
    if (component.ariaOptions) {
      enhanceElement(root, component.ariaOptions);
    }
    
    // Check for common component types and enhance automatically
    if (component.type) {
      switch (component.type) {
        case 'dialog':
          enhanceElement(root, {
            role: 'dialog',
            modal: true,
            liveRegion: true
          });
          break;
        case 'alert':
          enhanceElement(root, {
            role: 'alert',
            liveRegion: true,
            polite: false
          });
          break;
        case 'tab-panel':
          enhanceElement(root, {
            role: 'tabpanel'
          });
          break;
        case 'menu':
          enhanceElement(root, {
            role: 'menu'
          });
          break;
      }
    }
  } catch (error) {
    logger.error('Error handling component mounted event', error);
  }
}

/**
 * Handle dialog opened events
 * @private
 * @param {Object} data - Event data
 */
function handleDialogOpened(data) {
  if (!_initialized || !_enabled) {
    return;
  }
  
  try {
    const { dialog, title } = data;
    
    if (!dialog) {
      return;
    }
    
    // Enhance dialog with ARIA attributes
    enhanceElement(dialog, {
      role: 'dialog',
      modal: true,
      label: title || 'Dialog',
      liveRegion: true
    });
    
    // Set focus trap
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      // Focus first element
      focusableElements[0].focus();
      
      // Trap focus within dialog
      dialog._lastFocusableElement = focusableElements[focusableElements.length - 1];
      dialog._firstFocusableElement = focusableElements[0];
      
      // Add event listener for tab key
      dialog._handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === dialog._firstFocusableElement) {
              e.preventDefault();
              dialog._lastFocusableElement.focus();
            }
          } else {
            if (document.activeElement === dialog._lastFocusableElement) {
              e.preventDefault();
              dialog._firstFocusableElement.focus();
            }
          }
        }
      };
      
      dialog.addEventListener('keydown', dialog._handleKeyDown);
    }
  } catch (error) {
    logger.error('Error handling dialog opened event', error);
  }
}
