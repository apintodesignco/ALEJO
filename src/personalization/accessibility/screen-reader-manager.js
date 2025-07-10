/**
 * ALEJO Screen Reader Manager
 * 
 * This module provides comprehensive screen reader support and ARIA integration
 * for the ALEJO system. It manages dynamic announcements, focus management,
 * keyboard navigation, and screen reader compatibility features.
 * 
 * Key features:
 * - Open source NVDA screen reader integration
 * - Live region management for announcements
 * - Focus trap and management for modal dialogs
 * - Keyboard navigation helper functions
 * - ARIA attribute management
 * - Integration with voice synthesis
 */

import { eventEmitter } from '../../core/event-emitter.js';
import { ConfigManager } from '../../core/config-manager.js';
import { auditTrail } from '../../core/audit-trail.js';
import { synthesis } from '../voice/synthesis.js';
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';
import { screenReaderFactory } from './screen-readers/index.js';

// Constants for configuration
const CONFIG_KEY_PREFIX = 'accessibility.screenReader';
const COMPONENTS = {
  LIVE_REGION: 'liveRegion',
  FOCUS_MANAGEMENT: 'focusManagement',
  KEYBOARD_NAVIGATION: 'keyboardNavigation',
  ARIA_ENHANCEMENT: 'ariaEnhancement',
  VOICE_INTEGRATION: 'voiceIntegration',
  NVDA_INTEGRATION: 'nvdaIntegration'
};

// Default settings
const DEFAULT_SETTINGS = {
  enabled: false,
  announcementPriority: 'polite',  // 'polite' or 'assertive'
  useBrowserApi: true,             // Use browser's built-in Speech API if available
  useVoiceSynthesis: true,         // Use ALEJO's voice synthesis if available
  useNVDA: true,                  // Use NVDA screen reader if available
  preferredReader: null,          // User's preferred screen reader (auto-detect if null)
  focusOutline: true,              // Enhanced focus outlines
  autoAnnounceChanges: true,       // Auto announce significant content changes
  keyboardShortcuts: true,         // Enable enhanced keyboard shortcuts
  autoFocusOnLoad: true,           // Auto focus on main content when page loads
  verbosityLevel: 'standard'       // 'minimal', 'standard', or 'verbose'
};

// State management
let isInitialized = false;
let isEnabled = false;
let liveRegionElement = null;
let currentFocusElement = null;
let keyboardListeners = [];
let configInstance = null;
let lastAnnouncementTime = 0;
let activeScreenReader = null;
const announcementQueue = [];
const ANNOUNCEMENT_COOLDOWN_MS = 300; // Prevent announcement spam

/**
 * Initialize the screen reader manager
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether initialization succeeded
 */
async function initialize(options = {}) {
  if (isInitialized) return true;

  try {
    // Get configuration instance
    configInstance = await ConfigManager.getInstance();
    
    // Load user preferences or use defaults
    const userSettings = await configInstance.get(`${CONFIG_KEY_PREFIX}.settings`) || {};
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };
    
    // Check for system screen reader detection
    if (options.detectScreenReader !== false) {
      const availableReaders = await screenReaderFactory.detectAvailableReaders();
      const hasScreenReader = Object.values(availableReaders).some(Boolean);
      
      if (hasScreenReader && !settings.enabled) {
        settings.enabled = true;
        await configInstance.set(`${CONFIG_KEY_PREFIX}.settings`, settings);
        auditTrail.log('accessibility', 'Screen reader detected and enabled automatically');
      }
    }
    
    // Initialize screen reader if enabled
    if (settings.enabled) {
      activeScreenReader = await screenReaderFactory.initialize({
        preferredReader: settings.preferredReader
      });
      
      if (activeScreenReader) {
        const readerInfo = screenReaderFactory.getActiveReader();
        auditTrail.log('accessibility', `Activated screen reader: ${readerInfo.name}`);
      }
    }
    
    // Initialize components
    await initializeLiveRegion();
    initializeKeyboardHandlers();
    await enhancePageAccessibility();
    
    // Register with resource manager
    if (options.enableResourceManagement !== false) {
      registerWithResourceManager();
    }
    
    // Apply settings
    await applySettings(settings);
    
    // Set up event listeners
    setupEventListeners();
    
    isInitialized = true;
    isEnabled = settings.enabled;
    
    auditTrail.log('accessibility', 'Screen reader manager initialized successfully');
    
    const readerInfo = activeScreenReader ? screenReaderFactory.getActiveReader() : { name: 'none', isActive: false };
    
    eventEmitter.emit('accessibility:screen-reader:initialized', {
      success: true,
      components: {
        liveRegion: !!liveRegionElement,
        focusManagement: true,
        keyboardNavigation: true,
        ariaEnhancement: true,
        nvdaIntegration: readerInfo.name === 'nvda'
      },
      activeReader: readerInfo.name
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing screen reader manager:', error);
    auditTrail.log('accessibility', 'Screen reader manager initialization failed', { error: error.message });
    eventEmitter.emit('accessibility:screen-reader:initialized', {
      success: false,
      error: error.message
    });
    return false;
  }
}

/**
 * Shut down the screen reader manager
 * @returns {Promise<boolean>} - Whether shutdown succeeded
 */
async function shutdown() {
  if (!isInitialized) return true;
  
  try {
    // Clean up keyboard event listeners
    keyboardListeners.forEach(listener => {
      document.removeEventListener('keydown', listener);
    });
    keyboardListeners = [];
    
    // Shut down active screen reader
    if (activeScreenReader) {
      await screenReaderFactory.shutdown();
      activeScreenReader = null;
    }
    
    // Unregister from resource manager
    unregisterFromResourceManager();
    
    // Clean up live region if it exists
    if (liveRegionElement && liveRegionElement.parentNode) {
      liveRegionElement.parentNode.removeChild(liveRegionElement);
      liveRegionElement = null;
    }
    
    isInitialized = false;
    isEnabled = false;
    
    auditTrail.log('accessibility', 'Screen reader manager shut down successfully');
    eventEmitter.emit('accessibility:screen-reader:shutdown', { success: true });
    
    return true;
  } catch (error) {
    console.error('Error shutting down screen reader manager:', error);
    auditTrail.log('accessibility', 'Screen reader manager shutdown failed', { error: error.message });
    eventEmitter.emit('accessibility:screen-reader:shutdown', {
      success: false,
      error: error.message
    });
    return false;
  }
}

/**
 * Attempt to detect if a screen reader is active
 * @returns {Promise<boolean>} Whether a screen reader is detected
 */
async function detectScreenReader() {
  // Detection methods are not perfect due to browser security and privacy measures
  // This uses a best-effort approach with multiple detection signals
  
  // Method 1: Check for high-contrast mode (often used with screen readers)
  const highContrast = window.matchMedia('(forced-colors: active)').matches;
  
  // Method 2: Check for keyboard focus styles (may indicate keyboard navigation usage)
  const keyboardFocus = window.matchMedia('(forced-colors: active), (-ms-high-contrast: active)').matches;
  
  // Method 3: Check for reduced motion preference (often set by screen reader users)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Method 4: Check for specific query parameters that might be set by assistive tech
  const urlParams = new URLSearchParams(window.location.search);
  const hasAccessibilityParams = urlParams.has('screenReader') || 
                                 urlParams.has('accessibility') || 
                                 urlParams.has('a11y');
  
  // Method 5: Check if any element has focus on page load (might indicate screen reader)
  const hasFocusOnLoad = document.activeElement !== document.body;
  
  // Combined probability calculation (basic heuristic)
  // Not perfect, but provides a reasonable guess
  const signals = [highContrast, keyboardFocus, reducedMotion, hasAccessibilityParams, hasFocusOnLoad];
  const signalCount = signals.filter(Boolean).length;
  
  return signalCount >= 2; // Require at least 2 signals to reduce false positives
}

/**
 * Initialize the live region element for screen reader announcements
 * @returns {Promise<boolean>} Whether initialization succeeded
 */
async function initializeLiveRegion() {
  try {
    // Check if live region already exists
    liveRegionElement = document.getElementById('alejo-live-region');
    
    if (!liveRegionElement) {
      // Create the live region if it doesn't exist
      liveRegionElement = document.createElement('div');
      liveRegionElement.id = 'alejo-live-region';
      liveRegionElement.className = 'sr-only alejo-live-region';
      liveRegionElement.setAttribute('aria-live', 'polite');
      liveRegionElement.setAttribute('aria-relevant', 'additions text');
      liveRegionElement.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegionElement);
    }
    
    // Add style to hide visually but keep available to screen readers
    const style = document.createElement('style');
    style.textContent = `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;
    document.head.appendChild(style);
    
    return true;
  } catch (error) {
    console.error('Error initializing live region:', error);
    return false;
  }
}

/**
 * Set up keyboard event listeners for accessibility shortcuts
 */
function initializeKeyboardHandlers() {
  // Skip to main content
  const skipToMainHandler = (event) => {
    if (event.key === '/' && (event.altKey || event.metaKey)) {
      event.preventDefault();
      const mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.getElementById('main');
      
      if (mainContent) {
        mainContent.setAttribute('tabindex', '-1');
        mainContent.focus();
        announce('Skipped to main content', 'polite');
      }
    }
  };
  
  // Toggle screen reader announcements
  const toggleAnnouncementsHandler = (event) => {
    if (event.key === 'a' && event.altKey && event.shiftKey) {
      event.preventDefault();
      toggleEnabled();
    }
  };
  
  // Show keyboard shortcuts help
  const showKeyboardShortcutsHandler = (event) => {
    if (event.key === '?' && event.altKey) {
      event.preventDefault();
      showKeyboardShortcutsHelp();
    }
  };
  
  // Register event listeners
  document.addEventListener('keydown', skipToMainHandler);
  document.addEventListener('keydown', toggleAnnouncementsHandler);
  document.addEventListener('keydown', showKeyboardShortcutsHandler);
  
  // Keep track of listeners for cleanup
  keyboardListeners = [
    skipToMainHandler,
    toggleAnnouncementsHandler,
    showKeyboardShortcutsHandler
  ];
}

/**
 * Apply accessibility enhancements to the page
 */
async function enhancePageAccessibility() {
  try {
    // Add role="main" to main content if not present
    const mainContent = document.querySelector('main');
    if (mainContent && !mainContent.getAttribute('role')) {
      mainContent.setAttribute('role', 'main');
    }
    
    // Ensure all interactive elements are keyboard accessible
    document.querySelectorAll('div[onclick], span[onclick]').forEach(element => {
      if (!element.getAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
      }
      if (!element.getAttribute('role')) {
        element.setAttribute('role', 'button');
      }
    });
    
    // Fix missing form labels
    document.querySelectorAll('input, select, textarea').forEach(formElement => {
      const id = formElement.id;
      if (!id) return;
      
      // Check if label exists
      const hasLabel = !!document.querySelector(`label[for="${id}"]`);
      
      if (!hasLabel) {
        // Try to find a parent label
        const parentLabel = formElement.closest('label');
        if (!parentLabel) {
          // Create a label based on placeholder or nearby text
          const labelText = formElement.getAttribute('placeholder') || 
                           formElement.getAttribute('name') || 
                           'Unlabeled field';
          
          const label = document.createElement('label');
          label.setAttribute('for', id);
          label.textContent = labelText;
          
          // Insert label before the form element
          formElement.parentNode.insertBefore(label, formElement);
        }
      }
    });
    
    // Add proper button types
    document.querySelectorAll('button').forEach(button => {
      if (!button.getAttribute('type')) {
        button.setAttribute('type', 'button');
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error enhancing page accessibility:', error);
    return false;
  }
}

/**
 * Set up event listeners for accessibility events
 */
function setupEventListeners() {
  // Listen for navigation events to announce page changes
  eventEmitter.on('navigation:changed', (data) => {
    if (isEnabled && data.title) {
      announce(`Navigated to ${data.title}`, 'polite');
    }
  });
  
  // Listen for modal dialog events
  eventEmitter.on('ui:modal:opened', (data) => {
    if (isEnabled) {
      trapFocus(data.element);
      announce(`Dialog opened: ${data.title || 'Untitled dialog'}`, 'assertive');
    }
  });
  
  eventEmitter.on('ui:modal:closed', () => {
    if (isEnabled) {
      releaseFocusTrap();
      announce('Dialog closed', 'polite');
    }
  });
  
  // Listen for loading state changes
  eventEmitter.on('ui:loading:started', (data) => {
    if (isEnabled) {
      announce(`Loading ${data.context || 'content'}`, 'polite');
    }
  });
  
  eventEmitter.on('ui:loading:completed', (data) => {
    if (isEnabled) {
      announce(`${data.context || 'Content'} loaded`, 'polite');
    }
  });
  
  // Listen for error messages
  eventEmitter.on('ui:error', (data) => {
    if (isEnabled) {
      announce(`Error: ${data.message || 'An error occurred'}`, 'assertive');
    }
  });
}

/**
 * Make an announcement to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 * @returns {Promise<boolean>} Whether announcement succeeded
 */
async function announce(message, priority = 'polite') {
  if (!isInitialized || !isEnabled || !message) return false;
  
  // Check for announcement cooldown to prevent spam
  const now = Date.now();
  if (now - lastAnnouncementTime < ANNOUNCEMENT_COOLDOWN_MS) {
    // Queue the announcement for later
    announcementQueue.push({ message, priority });
    setTimeout(processAnnouncementQueue, ANNOUNCEMENT_COOLDOWN_MS);
    return true;
  }
  
  try {
    lastAnnouncementTime = now;
    
    // Update the live region for screen reader announcement
    if (liveRegionElement) {
      liveRegionElement.setAttribute('aria-live', priority);
      
      // Clear and update with new content
      liveRegionElement.textContent = '';
      
      // Use setTimeout to ensure screen readers register the change
      setTimeout(() => {
        liveRegionElement.textContent = message;
      }, 50);
    }
    
    // Use ALEJO voice synthesis if enabled
    const settings = await getSettings();
    if (settings.useVoiceSynthesis && typeof synthesis?.speak === 'function') {
      synthesis.speak({
        text: message,
        priority: priority === 'assertive' ? 'high' : 'normal',
        category: 'accessibility'
      });
    }
    
    // Log the announcement
    auditTrail.log('accessibility', 'Screen reader announcement', { 
      message, 
      priority 
    });
    
    return true;
  } catch (error) {
    console.error('Error making screen reader announcement:', error);
    return false;
  }
}

/**
 * Process any queued announcements
 */
function processAnnouncementQueue() {
  if (announcementQueue.length > 0) {
    const { message, priority } = announcementQueue.shift();
    announce(message, priority);
  }
}

/**
 * Trap focus within a specific element (for modals, etc.)
 * @param {HTMLElement} element - Element to trap focus within
 */
function trapFocus(element) {
  if (!element) return;
  
  currentFocusElement = element;
  
  // Store the element that had focus before trapping
  const previousFocus = document.activeElement;
  
  // Find all focusable elements
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Auto-focus first element
  setTimeout(() => {
    firstElement.focus();
  }, 50);
  
  // Handle tab key to keep focus trapped within the element
  const trapHandler = (event) => {
    if (event.key === 'Tab') {
      // If shift+tab on first element, move to last element
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // If tab on last element, move to first element
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    
    // Allow escape key to close modal
    if (event.key === 'Escape') {
      releaseFocusTrap(previousFocus);
      eventEmitter.emit('ui:modal:escape');
    }
  };
  
  document.addEventListener('keydown', trapHandler);
  element._focusTrapHandler = trapHandler;
}

/**
 * Release focus trap
 * @param {HTMLElement} [restoreFocus] - Element to restore focus to
 */
function releaseFocusTrap(restoreFocus) {
  if (currentFocusElement && currentFocusElement._focusTrapHandler) {
    document.removeEventListener('keydown', currentFocusElement._focusTrapHandler);
    currentFocusElement._focusTrapHandler = null;
    
    // Restore focus if specified
    if (restoreFocus && typeof restoreFocus.focus === 'function') {
      setTimeout(() => {
        restoreFocus.focus();
      }, 50);
    }
    
    currentFocusElement = null;
  }
}

/**
 * Apply screen reader settings
 * @param {Object} settings - Settings to apply
 */
async function applySettings(settings) {
  isEnabled = settings.enabled;
  
  // Update live region priority
  if (liveRegionElement) {
    liveRegionElement.setAttribute('aria-live', settings.announcementPriority);
  }
  
  // Apply focus outline enhancement
  if (settings.focusOutline) {
    const style = document.createElement('style');
    style.textContent = `
      :focus {
        outline: 3px solid #4d90fe !important;
        outline-offset: 2px !important;
      }
      
      .no-focus-outline:focus {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add keyboard focus indicator
  document.body.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  });
  
  document.body.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation');
  });
  
  // Save the settings
  await configInstance.set(`${CONFIG_KEY_PREFIX}.settings`, settings);
  
  // Announce settings change if already enabled
  if (isEnabled) {
    announce('Screen reader settings updated', 'polite');
  }
  
  // Emit settings changed event
  eventEmitter.emit('accessibility:screen-reader:settings-changed', settings);
  
  return true;
}

/**
 * Show keyboard shortcuts help dialog
 */
function showKeyboardShortcutsHelp() {
  const shortcuts = [
    { keys: 'Alt + /', description: 'Skip to main content' },
    { keys: 'Alt + Shift + A', description: 'Toggle screen reader announcements' },
    { keys: 'Alt + ?', description: 'Show keyboard shortcuts help' },
    { keys: 'Tab', description: 'Navigate between interactive elements' },
    { keys: 'Shift + Tab', description: 'Navigate backwards' },
    { keys: 'Enter / Space', description: 'Activate buttons and links' },
    { keys: 'Esc', description: 'Close dialogs and menus' },
    { keys: 'Alt + Shift + +', description: 'Increase font size' },
    { keys: 'Alt + Shift + -', description: 'Decrease font size' },
    { keys: 'Alt + Shift + 0', description: 'Reset font size' },
    { keys: 'Alt + Shift + H', description: 'Toggle high contrast' },
    { keys: 'Alt + Shift + C', description: 'Cycle color blindness modes' },
    { keys: 'Alt + A', description: 'Open accessibility settings panel' }
  ];
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'shortcuts-title');
  dialog.className = 'accessibility-dialog keyboard-shortcuts-dialog';
  
  // Create dialog content
  dialog.innerHTML = `
    <div class="dialog-content">
      <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
      <table class="shortcuts-table">
        <thead>
          <tr>
            <th>Keys</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${shortcuts.map(shortcut => `
            <tr>
              <td class="shortcut-keys">${shortcut.keys}</td>
              <td>${shortcut.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="dialog-actions">
        <button type="button" class="btn btn-primary close-dialog">Close</button>
      </div>
    </div>
  `;
  
  // Style for the dialog
  const style = document.createElement('style');
  style.textContent = `
    .accessibility-dialog {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    
    .dialog-content {
      background-color: #fff;
      padding: 2rem;
      border-radius: 0.5rem;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .shortcuts-table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
    }
    
    .shortcuts-table th,
    .shortcuts-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    .shortcut-keys {
      font-family: monospace;
      white-space: nowrap;
      font-weight: 600;
    }
    
    .dialog-actions {
      margin-top: 1.5rem;
      text-align: right;
    }
    
    .high-contrast .dialog-content {
      background-color: #000;
      color: #fff;
      border: 2px solid #fff;
    }
    
    .high-contrast .shortcuts-table th,
    .high-contrast .shortcuts-table td {
      border-color: #fff;
    }
  `;
  
  // Add to document
  document.head.appendChild(style);
  document.body.appendChild(dialog);
  
  // Trap focus in dialog
  trapFocus(dialog);
  
  // Handle close button
  const closeButton = dialog.querySelector('.close-dialog');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      releaseFocusTrap();
      document.body.removeChild(dialog);
    });
  }
  
  // Handle escape key and click outside
  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      releaseFocusTrap();
      document.body.removeChild(dialog);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  
  // Announce dialog opened
  announce('Keyboard shortcuts dialog opened', 'polite');
}

/**
 * Toggle screen reader mode on/off
 */
async function toggleEnabled() {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  
  await applySettings(settings);
  
  if (settings.enabled) {
    announce('Screen reader support enabled', 'assertive');
  } else {
    // Final announcement before disabling
    announce('Screen reader support disabled', 'assertive');
  }
  
  return settings.enabled;
}

/**
 * Get current settings
 * @returns {Promise<Object>} Current settings
 */
async function getSettings() {
  if (!configInstance) {
    configInstance = await ConfigManager.getInstance();
  }
  
  const settings = await configInstance.get(`${CONFIG_KEY_PREFIX}.settings`) || {};
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Check if screen reader support is enabled
 * @returns {boolean} Whether screen reader support is enabled
 */
function isScreenReaderEnabled() {
  return isEnabled;
}

/**
 * Export functions and objects
 */
export const screenReaderManager = {
  initialize,
  shutdown,
  announce,
  trapFocus,
  releaseFocusTrap,
  toggleEnabled,
  isScreenReaderEnabled,
  getSettings
};

export default screenReaderManager;
