/**
 * ALEJO Keyboard Navigation Manager
 * 
 * Provides comprehensive keyboard navigation capabilities across all ALEJO components.
 * This module works with the ARIA Manager to ensure consistent and accessible
 * keyboard navigation throughout the application.
 * 
 * Features:
 * - Focus trapping for modals and dialogs
 * - Focus management for components
 * - Keyboard shortcuts and navigation patterns
 * - Adaptive keyboard navigation based on user patterns
 * - Resource-aware implementation to prevent performance impact
 * 
 * @module personalization/accessibility/keyboard-navigation-manager
 */

import { EventBus } from '../../core/events/event-bus.js';
import { ErrorHandler } from '../../core/error/error-handler.js';
import { ResourceAllocationManager, RESOURCE_MODES } from '../../performance/resource-allocation-manager.js';
import AriaManager from './aria-manager.js';
import { adaptiveFeatureManager } from './adaptive-feature-manager.js';
import { auditTrail } from '../../security/audit-trail.js';
import { localStorageManager } from '../../utils/local-storage-manager.js';

/**
 * Class for managing keyboard navigation throughout ALEJO
 */
export class KeyboardNavigationManager {
  /**
   * Private instance for singleton pattern
   * @private
   */
  static #instance = null;
  
  /**
   * Gets the singleton instance
   * @returns {KeyboardNavigationManager}
   */
  static getInstance() {
    if (!KeyboardNavigationManager.#instance) {
      KeyboardNavigationManager.#instance = new KeyboardNavigationManager();
    }
    return KeyboardNavigationManager.#instance;
  }
  
  /**
   * Creates a new KeyboardNavigationManager instance
   * @private
   */
  constructor() {
    this.initialized = false;
    this.focusTraps = new Map();
    this.keyboardShortcuts = new Map();
    this.navigationGroups = new Map();
    this.focusHistory = [];
    this.maxHistorySize = 10;
    this.resourceMode = RESOURCE_MODES.NORMAL;
    this.isReducedMotionEnabled = false;
    this.eventBus = null;
    this.resourceManager = null;
    this.errorHandler = null;
    this.ariaManager = null;
    this.registeredWithResourceManager = false;
  }
  
  /**
   * Initializes the KeyboardNavigationManager
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }
      
      this.eventBus = options.eventBus || EventBus.getInstance();
      this.resourceManager = options.resourceManager || ResourceAllocationManager.getInstance();
      this.errorHandler = options.errorHandler || ErrorHandler.getInstance();
      this.ariaManager = options.ariaManager || AriaManager;
      
      // Register with resource manager
      await this.registerWithResourceManager();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load user preferences
      await this.loadPreferences();
      
      // Initialize default keyboard shortcuts
      this.initializeDefaultShortcuts();
      
      this.initialized = true;
      
      auditTrail.log('info', 'Keyboard Navigation Manager initialized', {
        component: 'KeyboardNavigationManager'
      });
      
      return true;
    } catch (error) {
      this.errorHandler.logError('KeyboardNavigationManager.initialize', error);
      auditTrail.log('error', 'Failed to initialize Keyboard Navigation Manager', {
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Registers with the Resource Allocation Manager
   * @private
   * @returns {Promise<void>}
   */
  async registerWithResourceManager() {
    if (this.registeredWithResourceManager) return;
    
    try {
      await this.resourceManager.registerComponent('KeyboardNavigationManager', {
        priority: 'HIGH',
        category: 'ACCESSIBILITY',
        resourceUsage: {
          cpu: { min: 0.1, target: 0.2, max: 0.5 },
          memory: { min: 2, target: 5, max: 10 }
        },
        adaptationCallbacks: {
          onModeChange: this.handleResourceModeChange.bind(this)
        }
      });
      
      this.registeredWithResourceManager = true;
      
      // Get initial resource mode
      this.resourceMode = this.resourceManager.getCurrentMode();
    } catch (error) {
      this.errorHandler.logError('KeyboardNavigationManager.registerWithResourceManager', error);
    }
  }
  
  /**
   * Unregisters from the Resource Allocation Manager
   * @private
   * @returns {Promise<void>}
   */
  async unregisterFromResourceManager() {
    if (!this.registeredWithResourceManager) return;
    
    try {
      await this.resourceManager.unregisterComponent('KeyboardNavigationManager');
      this.registeredWithResourceManager = false;
    } catch (error) {
      this.errorHandler.logError('KeyboardNavigationManager.unregisterFromResourceManager', error);
    }
  }
  
  /**
   * Sets up event listeners
   * @private
   */
  setupEventListeners() {
    // Listen for global keydown events
    document.addEventListener('keydown', this.handleKeyDown.bind(this), { passive: false });
    
    // Listen for modal open/close events
    this.eventBus.subscribe('ui:modal-opened', this.handleModalOpened.bind(this));
    this.eventBus.subscribe('ui:modal-closed', this.handleModalClosed.bind(this));
    
    // Listen for feature changes
    this.eventBus.subscribe('accessibility:feature-changed', this.handleFeatureChange.bind(this));
    
    // Listen for page navigation
    this.eventBus.subscribe('router:navigation-complete', this.handleNavigation.bind(this));
  }
  
  /**
   * Loads user preferences from storage
   * @private
   * @returns {Promise<void>}
   */
  async loadPreferences() {
    try {
      const preferences = await localStorageManager.getItem('keyboardNavigationPreferences');
      if (preferences) {
        // Apply any custom shortcuts
        if (preferences.customShortcuts) {
          for (const [action, shortcut] of Object.entries(preferences.customShortcuts)) {
            this.keyboardShortcuts.set(action, shortcut);
          }
        }
        
        // Apply history size
        if (preferences.maxHistorySize) {
          this.maxHistorySize = preferences.maxHistorySize;
        }
      }
      
      // Get reduced motion preference
      this.isReducedMotionEnabled = adaptiveFeatureManager.isFeatureEnabled('reduceMotion');
    } catch (error) {
      this.errorHandler.logError('KeyboardNavigationManager.loadPreferences', error);
    }
  }
  
  /**
   * Initializes default keyboard shortcuts
   * @private
   */
  initializeDefaultShortcuts() {
    // Navigation shortcuts
    this.registerShortcut('openAccessibilityPanel', { key: 'a', altKey: true, ctrlKey: true });
    this.registerShortcut('toggleHighContrast', { key: 'h', altKey: true, ctrlKey: true });
    this.registerShortcut('toggleScreenReader', { key: 's', altKey: true, ctrlKey: true });
    this.registerShortcut('increaseFontSize', { key: '+', ctrlKey: true });
    this.registerShortcut('decreaseFontSize', { key: '-', ctrlKey: true });
    this.registerShortcut('skipToMain', { key: 'Tab', shiftKey: true, initialOnly: true });
    
    // Common UI shortcuts
    this.registerShortcut('escape', { key: 'Escape' });
    this.registerShortcut('confirm', { key: 'Enter' });
    this.registerShortcut('delete', { key: 'Delete' });
  }
  
  /**
   * Handles resource mode changes from Resource Allocation Manager
   * @param {Object} data - Resource mode change data
   * @private
   */
  handleResourceModeChange(data) {
    const { newMode } = data;
    this.resourceMode = newMode;
    
    // Adapt keyboard navigation features based on resource mode
    switch (newMode) {
      case RESOURCE_MODES.MINIMAL:
        this.adaptForMinimalMode();
        break;
      case RESOURCE_MODES.CONSERVATIVE:
        this.adaptForConservativeMode();
        break;
      case RESOURCE_MODES.NORMAL:
        this.adaptForNormalMode();
        break;
      case RESOURCE_MODES.PERFORMANCE:
        this.adaptForPerformanceMode();
        break;
    }
  }
  
  /**
   * Adapts keyboard navigation for minimal resource mode
   * @private
   */
  adaptForMinimalMode() {
    // Disable advanced features, keep only essential navigation
    this.maxHistorySize = 3;
  }
  
  /**
   * Adapts keyboard navigation for conservative resource mode
   * @private
   */
  adaptForConservativeMode() {
    // Reduce features but keep core functionality
    this.maxHistorySize = 5;
  }
  
  /**
   * Adapts keyboard navigation for normal resource mode
   * @private
   */
  adaptForNormalMode() {
    // Enable standard features
    this.maxHistorySize = 10;
  }
  
  /**
   * Adapts keyboard navigation for performance resource mode
   * @private
   */
  adaptForPerformanceMode() {
    // Enable all features including animations and extended history
    this.maxHistorySize = 20;
  }
  
  /**
   * Handles global keydown events
   * @param {KeyboardEvent} event - The keydown event
   * @private
   */
  handleKeyDown(event) {
    // Skip if inside input or contenteditable
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    ) {
      // Still check for specific shortcuts that should work everywhere
      if (this.isGlobalShortcut(event)) {
        this.executeShortcut(event);
        return;
      }
      return;
    }
    
    // Check for active focus trap
    const activeTrap = this.getActiveFocusTrap();
    if (activeTrap && this.handleFocusTrapNavigation(event, activeTrap)) {
      return;
    }
    
    // Check for registered shortcuts
    if (this.matchShortcut(event)) {
      event.preventDefault();
      return;
    }
    
    // Handle standard tab navigation
    this.handleTabNavigation(event);
  }
  
  /**
   * Checks if a key event matches a global shortcut that should work everywhere
   * @param {KeyboardEvent} event - The keydown event
   * @returns {boolean} True if this is a global shortcut
   * @private
   */
  isGlobalShortcut(event) {
    // These shortcuts should work even in input fields
    const globalShortcutActions = [
      'openAccessibilityPanel',
      'toggleHighContrast',
      'toggleScreenReader'
    ];
    
    for (const action of globalShortcutActions) {
      const shortcut = this.keyboardShortcuts.get(action);
      if (shortcut && this.matchesShortcut(event, shortcut)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if a key event matches any registered shortcut
   * @param {KeyboardEvent} event - The keydown event
   * @returns {boolean} True if a shortcut was matched and executed
   * @private
   */
  matchShortcut(event) {
    for (const [action, shortcut] of this.keyboardShortcuts.entries()) {
      if (this.matchesShortcut(event, shortcut)) {
        this.executeAction(action, event);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Checks if a key event matches a specific shortcut
   * @param {KeyboardEvent} event - The keydown event
   * @param {Object} shortcut - The shortcut to match
   * @returns {boolean} True if the event matches the shortcut
   * @private
   */
  matchesShortcut(event, shortcut) {
    return (
      event.key === shortcut.key &&
      !!event.altKey === !!shortcut.altKey &&
      !!event.ctrlKey === !!shortcut.ctrlKey &&
      !!event.shiftKey === !!shortcut.shiftKey &&
      !!event.metaKey === !!shortcut.metaKey
    );
  }
  
  /**
   * Executes the action associated with a shortcut
   * @param {string} action - The action to execute
   * @param {KeyboardEvent} event - The triggering event
   * @private
   */
  executeAction(action, event) {
    event.preventDefault();
    
    // Log the action for auditing
    auditTrail.log('info', `Keyboard shortcut executed: ${action}`, {
      component: 'KeyboardNavigationManager'
    });
    
    // Execute based on action type
    switch (action) {
      case 'openAccessibilityPanel':
        this.eventBus.publish('accessibility:open-panel');
        break;
      case 'toggleHighContrast':
        adaptiveFeatureManager.toggleFeature('highContrast');
        break;
      case 'toggleScreenReader':
        adaptiveFeatureManager.toggleFeature('screenReader');
        break;
      case 'increaseFontSize':
        this.eventBus.publish('accessibility:increase-font-size');
        break;
      case 'decreaseFontSize':
        this.eventBus.publish('accessibility:decrease-font-size');
        break;
      case 'skipToMain':
        this.skipToMainContent();
        break;
      case 'escape':
        this.handleEscapeKey();
        break;
      default:
        // Dispatch custom event for other components to handle
        this.eventBus.publish('keyboard:shortcut', { action, event });
    }
  }
  
  /**
   * Handles standard Tab key navigation
   * @param {KeyboardEvent} event - The keydown event
   * @private
   */
  handleTabNavigation(event) {
    if (event.key !== 'Tab') return;
    
    // Track focus for history
    setTimeout(() => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body) {
        this.recordFocusedElement(activeElement);
      }
    }, 0);
  }
  
  /**
   * Records a focused element in history
   * @param {HTMLElement} element - The element that received focus
   * @private
   */
  recordFocusedElement(element) {
    // Don't record if element is already the most recent in history
    if (
      this.focusHistory.length > 0 &&
      this.focusHistory[this.focusHistory.length - 1] === element
    ) {
      return;
    }
    
    // Add to history
    this.focusHistory.push(element);
    
    // Trim history if needed
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory.shift();
    }
  }
  
  /**
   * Handles Escape key press
   * @private
   */
  handleEscapeKey() {
    // Check for open modals first
    const activeTrap = this.getActiveFocusTrap();
    if (activeTrap) {
      this.eventBus.publish('ui:close-modal', { id: activeTrap.id });
      return;
    }
    
    // If no modal, go back to previous focus if possible
    this.restorePreviousFocus();
  }
  
  /**
   * Restores focus to previous element in history
   * @returns {boolean} True if focus was restored
   * @public
   */
  restorePreviousFocus() {
    if (this.focusHistory.length < 2) return false;
    
    // Remove current focus from history
    this.focusHistory.pop();
    
    // Get previous element
    const previousElement = this.focusHistory.pop();
    if (previousElement && document.contains(previousElement)) {
      previousElement.focus();
      return true;
    }
    
    return false;
  }
  
  /**
   * Creates a focus trap for modals, dialogs, etc.
   * @param {string} id - Unique ID for the trap
   * @param {HTMLElement} container - The container to trap focus within
   * @param {Object} options - Additional options
   * @param {boolean} options.autoFocus - Whether to automatically focus first element
   * @param {HTMLElement} options.initialFocus - Element to receive initial focus
   * @param {Function} options.onEscape - Callback when Escape is pressed
   * @param {boolean} options.preventScroll - Whether to prevent scrolling on focus
   * @returns {Object} The focus trap object
   * @public
   */
  createFocusTrap(id, container, options = {}) {
    if (!container || !id) {
      this.errorHandler.logError('KeyboardNavigationManager.createFocusTrap', new Error('Container and ID required'));
      return null;
    }
    
    // Get all focusable elements in container
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) {
      this.errorHandler.logError('KeyboardNavigationManager.createFocusTrap', new Error('No focusable elements found in container'));
      return null;
    }
    
    const trap = {
      id,
      container,
      focusableElements,
      active: true,
      previousFocus: document.activeElement,
      options
    };
    
    // Store the trap
    this.focusTraps.set(id, trap);
    
    // Set initial focus
    if (options.autoFocus !== false) {
      const initialFocus = options.initialFocus || focusableElements[0];
      setTimeout(() => {
        initialFocus.focus({ preventScroll: !!options.preventScroll });
      }, 0);
    }
    
    return trap;
  }
  
  /**
   * Removes a focus trap
   * @param {string} id - ID of the trap to remove
   * @returns {boolean} True if trap was removed
   * @public
   */
  removeFocusTrap(id) {
    if (!this.focusTraps.has(id)) return false;
    
    const trap = this.focusTraps.get(id);
    
    // Restore previous focus
    if (trap.previousFocus && document.contains(trap.previousFocus)) {
      trap.previousFocus.focus();
    }
    
    // Remove trap
    this.focusTraps.delete(id);
    return true;
  }
  
  /**
   * Gets the active focus trap if one exists
   * @returns {Object|null} The active focus trap or null
   * @private
   */
  getActiveFocusTrap() {
    for (const trap of this.focusTraps.values()) {
      if (trap.active) return trap;
    }
    return null;
  }
  
  /**
   * Handles keyboard navigation within a focus trap
   * @param {KeyboardEvent} event - The keydown event
   * @param {Object} trap - The active focus trap
   * @returns {boolean} True if event was handled
   * @private
   */
  handleFocusTrapNavigation(event, trap) {
    if (event.key !== 'Tab') {
      // Handle Escape key
      if (event.key === 'Escape' && trap.options.onEscape) {
        event.preventDefault();
        trap.options.onEscape();
        return true;
      }
      return false;
    }
    
    const { focusableElements } = trap;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Handle Tab and Shift+Tab to keep focus within container
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return true;
    }
    
    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
      return true;
    }
    
    return false;
  }
  
  /**
   * Gets all focusable elements within a container
   * @param {HTMLElement} container - The container element
   * @returns {Array<HTMLElement>} Array of focusable elements
   * @public
   */
  getFocusableElements(container) {
    return Array.from(container.querySelectorAll(this.focusableSelector))
      .filter(el => !el.disabled && !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
  }
  
  /**
   * Registers a keyboard shortcut
   * @param {string} action - Action identifier
   * @param {Object} keys - Key combination
   * @param {string} keys.key - Main key
   * @param {boolean} [keys.ctrlKey] - Whether Ctrl is required
   * @param {boolean} [keys.altKey] - Whether Alt is required
   * @param {boolean} [keys.shiftKey] - Whether Shift is required
   * @param {boolean} [keys.metaKey] - Whether Meta is required
   * @returns {boolean} True if registered successfully
   * @public
   */
  registerShortcut(action, keys) {
    try {
      this.keyboardShortcuts.set(action, keys);
      
      // Save custom shortcuts to preferences
      this.saveShortcutPreferences();
      
      return true;
    } catch (error) {
      this.errorHandler.logError('KeyboardNavigationManager.registerShortcut', error);
      return false;
    }
  }
  
  /**
   * Removes a registered shortcut
   * @param {string} action - Action to remove shortcut for
   * @returns {boolean} True if removed
   * @public
   */
  removeShortcut(action) {
    const result = this.keyboardShortcuts.delete(action);
    if (result) {
      this.saveShortcutPreferences();
    }
    return result;
  }
  
  /**
   * Saves shortcut preferences to storage
   * @private
   */
  saveShortcutPreferences() {
    const customShortcuts = {};
    this.keyboardShortcuts.forEach((shortcut, action) => {
      customShortcuts[action] = shortcut;
    });
    
    localStorageManager.setItem('keyboardNavigationPreferences', {
      customShortcuts,
      maxHistorySize: this.maxHistorySize
    });
  }
  
  /**
   * Handles modal opened event
   * @param {Object} data - Modal data
   * @private
   */
  handleModalOpened(data) {
    const { id, element } = data;
    
    // Create focus trap for modal
    this.createFocusTrap(id, element, {
      autoFocus: true,
      onEscape: () => {
        this.eventBus.publish('ui:close-modal', { id });
      }
    });
  }
  
  /**
   * Handles modal closed event
   * @param {Object} data - Modal data
   * @private
   */
  handleModalClosed(data) {
    const { id } = data;
    this.removeFocusTrap(id);
  }
  
  /**
   * Handles accessibility feature changes
   * @param {Object} data - Change data
   * @private
   */
  handleFeatureChange(data) {
    const { feature, enabled } = data;
    
    // Update navigation based on feature changes
    switch (feature) {
      case 'reduceMotion':
        this.isReducedMotionEnabled = enabled;
        break;
    }
  }
  
  /**
   * Handles page navigation events
   * @private
   */
  handleNavigation() {
    // Reset focus history on page change
    this.focusHistory = [];
    
    // Focus skip link or main content after navigation completes
    setTimeout(() => {
      this.skipToMainContent();
    }, 100);
  }
  
  /**
   * Focuses on main content area
   * @public
   */
  skipToMainContent() {
    // Try to find main landmark
    const main = document.querySelector('main, [role="main"]');
    if (main) {
      // Set tabindex temporarily if needed
      const originalTabIndex = main.getAttribute('tabindex');
      if (!originalTabIndex || originalTabIndex === '-1') {
        main.setAttribute('tabindex', '-1');
      }
      
      // Focus the element
      main.focus();
      
      // Reset tabindex if we set it temporarily
      if (!originalTabIndex) {
        setTimeout(() => {
          main.removeAttribute('tabindex');
        }, 100);
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Cleans up resources used by the keyboard navigation manager
   * @returns {Promise<void>}
   * @public
   */
  async cleanup() {
    // Remove global event listener
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Unregister from resource manager
    await this.unregisterFromResourceManager();
    
    // Clear all traps
    this.focusTraps.clear();
    
    // Reset state
    this.focusHistory = [];
    this.initialized = false;
    
    auditTrail.log('info', 'Keyboard Navigation Manager cleaned up', {
      component: 'KeyboardNavigationManager'
    });
  }
}

// Export singleton instance
export default KeyboardNavigationManager.getInstance();
