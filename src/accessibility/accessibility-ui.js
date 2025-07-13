/**
 * @file accessibility-ui.js
 * @description UI components for accessibility controls
 * @module accessibility/accessibility-ui
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import * as AccessibilityManager from './accessibility-manager.js';
import * as HighContrastMode from './high-contrast-mode.js';
import * as FontScaling from './font-scaling.js';
import * as ColorBlindnessMode from './color-blindness-mode.js';

// Initialize logger
const logger = new Logger('AccessibilityUI');

// Module state
let _initialized = false;
let _panelVisible = false;
let _panelElement = null;
let _toggleButton = null;
let _config = null;

// Default configuration
const DEFAULT_CONFIG = {
  // Whether to show the accessibility panel toggle button
  showToggleButton: true,
  // Position of the toggle button ('top-right', 'top-left', 'bottom-right', 'bottom-left')
  toggleButtonPosition: 'bottom-right',
  // Icon to use for the toggle button ('wheelchair', 'eye', 'ear', 'universal')
  toggleButtonIcon: 'universal',
  // Whether to automatically show the panel on first visit
  showPanelOnFirstVisit: false,
  // Whether to highlight accessible elements
  highlightAccessibleElements: false,
  // Animation settings
  animations: {
    enabled: true,
    duration: 300
  }
};

/**
 * Initialize the accessibility UI
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Accessibility UI already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing Accessibility UI');
    
    // Combine default config with provided config
    _config = { ...DEFAULT_CONFIG, ...config };
    
    // Create accessibility button if configured
    if (_config.showToggleButton) {
      createAccessibilityToggleButton();
    }
    
    // Create accessibility panel (hidden by default)
    createAccessibilityPanel();
    
    // Set up event listeners
    setupEventListeners();
    
    _initialized = true;
    
    EventBus.publish('accessibility:uiInitialized');
    
    logger.info('Accessibility UI initialized successfully');
    
    // Show panel on first visit if configured
    const isFirstVisit = !localStorage.getItem('alejo_a11y_visited');
    if (_config.showPanelOnFirstVisit && isFirstVisit) {
      showAccessibilityPanel();
      localStorage.setItem('alejo_a11y_visited', 'true');
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Accessibility UI', error);
    return false;
  }
}

/**
 * Create accessibility toggle button
 * @private
 */
function createAccessibilityToggleButton() {
  if (_toggleButton) return;
  
  // Create button element
  _toggleButton = document.createElement('button');
  _toggleButton.id = 'accessibility-toggle-button';
  _toggleButton.className = 'accessibility-toggle-button';
  _toggleButton.setAttribute('aria-label', 'Toggle accessibility panel');
  _toggleButton.setAttribute('title', 'Accessibility Options');
  
  // Set button position
  _toggleButton.classList.add(`position-${_config.toggleButtonPosition}`);
  
  // Add icon based on configuration
  const iconMap = {
    wheelchair: '♿',
    eye: '👁',
    ear: '👂',
    universal: 'A11y'
  };
  
  const icon = iconMap[_config.toggleButtonIcon] || iconMap.universal;
  _toggleButton.innerHTML = icon;
  
  // Add click event
  _toggleButton.addEventListener('click', toggleAccessibilityPanel);
  
  // Add to DOM
  document.body.appendChild(_toggleButton);
  
  // Add styles for the button
  const style = document.createElement('style');
  style.textContent = `
    .accessibility-toggle-button {
      position: fixed;
      z-index: 9999;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background-color: #2962ff;
      color: white;
      font-size: 18px;
      font-weight: bold;
      border: 2px solid white;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .accessibility-toggle-button:hover,
    .accessibility-toggle-button:focus {
      background-color: #0039cb;
      transform: scale(1.05);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
      outline: none;
    }
    
    .accessibility-toggle-button:active {
      transform: scale(0.95);
    }
    
    .accessibility-toggle-button.position-top-right {
      top: 20px;
      right: 20px;
    }
    
    .accessibility-toggle-button.position-top-left {
      top: 20px;
      left: 20px;
    }
    
    .accessibility-toggle-button.position-bottom-right {
      bottom: 20px;
      right: 20px;
    }
    
    .accessibility-toggle-button.position-bottom-left {
      bottom: 20px;
      left: 20px;
    }
  `;
  
  document.head.appendChild(style);
  
  logger.debug('Created accessibility toggle button');
}

/**
 * Create accessibility panel
 * @private
 */
function createAccessibilityPanel() {
  if (_panelElement) return;
  
  // Create panel container
  _panelElement = document.createElement('div');
  _panelElement.id = 'accessibility-panel';
  _panelElement.className = 'accessibility-panel';
  _panelElement.setAttribute('role', 'dialog');
  _panelElement.setAttribute('aria-labelledby', 'accessibility-panel-title');
  _panelElement.setAttribute('aria-hidden', 'true');
  
  // Create panel header
  const header = document.createElement('div');
  header.className = 'accessibility-panel-header';
  
  const title = document.createElement('h2');
  title.id = 'accessibility-panel-title';
  title.textContent = 'Accessibility Options';
  header.appendChild(title);
  
  const closeButton = document.createElement('button');
  closeButton.className = 'accessibility-panel-close';
  closeButton.setAttribute('aria-label', 'Close accessibility panel');
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', hideAccessibilityPanel);
  header.appendChild(closeButton);
  
  _panelElement.appendChild(header);
  
  // Create panel content
  const content = document.createElement('div');
  content.className = 'accessibility-panel-content';
  
  // Add each feature section
  content.appendChild(createHighContrastSection());
  content.appendChild(createFontScalingSection());
  content.appendChild(createColorBlindnessSection());
  
  _panelElement.appendChild(content);
  
  // Create panel footer
  const footer = document.createElement('div');
  footer.className = 'accessibility-panel-footer';
  
  const resetButton = document.createElement('button');
  resetButton.className = 'accessibility-button secondary';
  resetButton.textContent = 'Reset All';
  resetButton.addEventListener('click', resetAllAccessibilitySettings);
  footer.appendChild(resetButton);
  
  const closeButtonFooter = document.createElement('button');
  closeButtonFooter.className = 'accessibility-button primary';
  closeButtonFooter.textContent = 'Close';
  closeButtonFooter.addEventListener('click', hideAccessibilityPanel);
  footer.appendChild(closeButtonFooter);
  
  _panelElement.appendChild(footer);
  
  // Add to DOM
  document.body.appendChild(_panelElement);
  
  // Add styles for the panel
  addPanelStyles();
  
  logger.debug('Created accessibility panel');
}

/**
 * Add CSS styles for accessibility panel
 * @private
 */
function addPanelStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .accessibility-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      z-index: 10000;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      overflow: hidden;
    }
    
    .accessibility-panel.visible {
      opacity: 1;
      visibility: visible;
      transform: translate(-50%, -50%) scale(1);
    }
    
    .accessibility-panel-header {
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .accessibility-panel-header h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #333;
    }
    
    .accessibility-panel-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #777;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .accessibility-panel-close:hover {
      color: #333;
    }
    
    .accessibility-panel-content {
      padding: 20px;
      overflow-y: auto;
      flex-grow: 1;
    }
    
    .accessibility-panel-footer {
      padding: 15px 20px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .accessibility-feature-section {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .accessibility-feature-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .accessibility-feature-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .accessibility-feature-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
      color: #333;
    }
    
    .accessibility-toggle {
      position: relative;
      display: inline-block;
      width: 52px;
      height: 26px;
    }
    
    .accessibility-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .accessibility-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 34px;
    }
    
    .accessibility-toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    
    input:checked + .accessibility-toggle-slider {
      background-color: #2962ff;
    }
    
    input:checked + .accessibility-toggle-slider:before {
      transform: translateX(26px);
    }
    
    .accessibility-description {
      margin-top: 8px;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
    }
    
    .accessibility-options {
      margin-top: 15px;
      display: none;
    }
    
    .accessibility-options.visible {
      display: block;
    }
    
    .accessibility-option-group {
      margin-bottom: 15px;
    }
    
    .accessibility-option-label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .accessibility-button {
      padding: 8px 15px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    
    .accessibility-button.primary {
      background-color: #2962ff;
      color: white;
    }
    
    .accessibility-button.primary:hover {
      background-color: #0039cb;
    }
    
    .accessibility-button.secondary {
      background-color: #f5f5f5;
      color: #333;
    }
    
    .accessibility-button.secondary:hover {
      background-color: #e0e0e0;
    }
    
    .accessibility-button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    
    .accessibility-button-group button {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    
    .accessibility-button-group button:hover {
      background: #e0e0e0;
    }
    
    .accessibility-button-group button.selected {
      background: #2962ff;
      color: white;
      border-color: #2962ff;
    }
    
    .accessibility-slider {
      width: 100%;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Create high contrast mode section
 * @private
 * @returns {HTMLElement} The created section
 */
function createHighContrastSection() {
  const section = document.createElement('div');
  section.className = 'accessibility-feature-section';
  
  // Create header with toggle
  const header = document.createElement('div');
  header.className = 'accessibility-feature-header';
  
  const title = document.createElement('h3');
  title.className = 'accessibility-feature-title';
  title.textContent = 'High Contrast Mode';
  header.appendChild(title);
  
  const toggle = createToggleSwitch('high-contrast-toggle', handleHighContrastToggle);
  header.appendChild(toggle);
  
  section.appendChild(header);
  
  // Create description
  const description = document.createElement('p');
  description.className = 'accessibility-description';
  description.textContent = 'Increases contrast between text and background for better readability.';
  section.appendChild(description);
  
  // Create options (initially hidden)
  const options = document.createElement('div');
  options.className = 'accessibility-options';
  options.id = 'high-contrast-options';
  
  // Create theme selector
  const themeGroup = document.createElement('div');
  themeGroup.className = 'accessibility-option-group';
  
  const themeLabel = document.createElement('label');
  themeLabel.className = 'accessibility-option-label';
  themeLabel.textContent = 'Select theme:';
  themeGroup.appendChild(themeLabel);
  
  const themeButtons = document.createElement('div');
  themeButtons.className = 'accessibility-button-group';
  
  const themes = [
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
    { id: 'yellow-on-black', name: 'Yellow on Black' }
  ];
  
  themes.forEach(theme => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.theme = theme.id;
    button.textContent = theme.name;
    button.addEventListener('click', (e) => handleHighContrastThemeChange(theme.id));
    themeButtons.appendChild(button);
  });
  
  themeGroup.appendChild(themeButtons);
  options.appendChild(themeGroup);
  
  section.appendChild(options);
  
  return section;
}

/**
 * Create font scaling section
 * @private
 * @returns {HTMLElement} The created section
 */
function createFontScalingSection() {
  const section = document.createElement('div');
  section.className = 'accessibility-feature-section';
  
  // Create header with toggle
  const header = document.createElement('div');
  header.className = 'accessibility-feature-header';
  
  const title = document.createElement('h3');
  title.className = 'accessibility-feature-title';
  title.textContent = 'Font Scaling';
  header.appendChild(title);
  
  const toggle = createToggleSwitch('font-scaling-toggle', handleFontScalingToggle);
  header.appendChild(toggle);
  
  section.appendChild(header);
  
  // Create description
  const description = document.createElement('p');
  description.className = 'accessibility-description';
  description.textContent = 'Adjust text size for better readability.';
  section.appendChild(description);
  
  // Create options (initially hidden)
  const options = document.createElement('div');
  options.className = 'accessibility-options';
  options.id = 'font-scaling-options';
  
  // Create size buttons
  const sizeGroup = document.createElement('div');
  sizeGroup.className = 'accessibility-option-group';
  
  const sizeLabel = document.createElement('label');
  sizeLabel.className = 'accessibility-option-label';
  sizeLabel.textContent = 'Select text size:';
  sizeGroup.appendChild(sizeLabel);
  
  const sizeButtons = document.createElement('div');
  sizeButtons.className = 'accessibility-button-group';
  
  const sizes = [
    { level: 0.85, name: 'Smaller' },
    { level: 1, name: 'Normal' },
    { level: 1.15, name: 'Medium' },
    { level: 1.3, name: 'Large' },
    { level: 1.5, name: 'X-Large' }
  ];
  
  sizes.forEach(size => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.size = size.level;
    button.textContent = size.name;
    button.addEventListener('click', (e) => handleFontSizeChange(size.level));
    sizeButtons.appendChild(button);
  });
  
  sizeGroup.appendChild(sizeButtons);
  options.appendChild(sizeGroup);
  
  section.appendChild(options);
  
  return section;
}

/**
 * Create color blindness mode section
 * @private
 * @returns {HTMLElement} The created section
 */
function createColorBlindnessSection() {
  const section = document.createElement('div');
  section.className = 'accessibility-feature-section';
  
  // Create header with toggle
  const header = document.createElement('div');
  header.className = 'accessibility-feature-header';
  
  const title = document.createElement('h3');
  title.className = 'accessibility-feature-title';
  title.textContent = 'Color Blindness Support';
  header.appendChild(title);
  
  const toggle = createToggleSwitch('color-blindness-toggle', handleColorBlindnessToggle);
  header.appendChild(toggle);
  
  section.appendChild(header);
  
  // Create description
  const description = document.createElement('p');
  description.className = 'accessibility-description';
  description.textContent = 'Adjusts colors for different types of color vision deficiencies.';
  section.appendChild(description);
  
  // Create options (initially hidden)
  const options = document.createElement('div');
  options.className = 'accessibility-options';
  options.id = 'color-blindness-options';
  
  // Create type selector
  const typeGroup = document.createElement('div');
  typeGroup.className = 'accessibility-option-group';
  
  const typeLabel = document.createElement('label');
  typeLabel.className = 'accessibility-option-label';
  typeLabel.textContent = 'Select type:';
  typeGroup.appendChild(typeLabel);
  
  const typeButtons = document.createElement('div');
  typeButtons.className = 'accessibility-button-group';
  
  const types = [
    { id: 'protanopia', name: 'Red-Blind' },
    { id: 'deuteranopia', name: 'Green-Blind' },
    { id: 'tritanopia', name: 'Blue-Blind' },
    { id: 'enhanced', name: 'Enhanced Colors' }
  ];
  
  types.forEach(type => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.type = type.id;
    button.textContent = type.name;
    button.addEventListener('click', (e) => handleColorBlindnessTypeChange(type.id));
    typeButtons.appendChild(button);
  });
  
  typeGroup.appendChild(typeButtons);
  options.appendChild(typeGroup);
  
  section.appendChild(options);
  
  return section;
}

/**
 * Create a toggle switch
 * @private
 * @param {string} id - ID for the toggle
 * @param {Function} onChange - Change event handler
 * @returns {HTMLElement} The created toggle
 */
function createToggleSwitch(id, onChange) {
  const label = document.createElement('label');
  label.className = 'accessibility-toggle';
  
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.addEventListener('change', onChange);
  
  const slider = document.createElement('span');
  slider.className = 'accessibility-toggle-slider';
  
  label.appendChild(input);
  label.appendChild(slider);
  
  return label;
}

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Listen for keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Listen for accessibility feature changes
  EventBus.subscribe('accessibility:featureToggled', handleFeatureToggled);
  
  // Listen for panel close events
  document.addEventListener('click', (e) => {
    if (_panelVisible && _panelElement && 
        !_panelElement.contains(e.target) && 
        e.target !== _toggleButton) {
      hideAccessibilityPanel();
    }
  });
  
  // Listen for escape key to close panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _panelVisible) {
      hideAccessibilityPanel();
    }
  });
  
  // Update UI when features change programmatically
  EventBus.subscribe('accessibility:highContrastChanged', updateHighContrastUI);
  EventBus.subscribe('accessibility:fontScalingChanged', updateFontScalingUI);
  EventBus.subscribe('accessibility:colorBlindnessChanged', updateColorBlindnessUI);
}

/**
 * Show the accessibility panel
 */
export function showAccessibilityPanel() {
  if (!_initialized || _panelVisible) return;
  
  _panelElement.classList.add('visible');
  _panelElement.setAttribute('aria-hidden', 'false');
  _panelVisible = true;
  
  // Set focus to the panel for keyboard navigation
  _panelElement.focus();
  
  // Update toggles to match current state
  updateAllToggles();
  
  // Announce panel open
  EventBus.publish('accessibility:panelOpened');
  
  // If the announcement service is available, announce the panel is open
  if (typeof AccessibilityManager.announce === 'function') {
    AccessibilityManager.announce('Accessibility options panel opened', 'info');
  }
  
  logger.debug('Accessibility panel shown');
}

/**
 * Hide the accessibility panel
 */
export function hideAccessibilityPanel() {
  if (!_initialized || !_panelVisible) return;
  
  _panelElement.classList.remove('visible');
  _panelElement.setAttribute('aria-hidden', 'true');
  _panelVisible = false;
  
  // Return focus to the toggle button
  if (_toggleButton) {
    _toggleButton.focus();
  }
  
  // Announce panel close
  EventBus.publish('accessibility:panelClosed');
  
  logger.debug('Accessibility panel hidden');
}

/**
 * Toggle the accessibility panel visibility
 */
export function toggleAccessibilityPanel() {
  if (_panelVisible) {
    hideAccessibilityPanel();
  } else {
    showAccessibilityPanel();
  }
}

/**
 * Handle high contrast toggle change
 * @param {Event} e - Change event
 */
function handleHighContrastToggle(e) {
  const enabled = e.target.checked;
  
  // Toggle high contrast mode
  AccessibilityManager.toggleFeature('highContrast', enabled);
  
  // Toggle options visibility
  const options = document.getElementById('high-contrast-options');
  if (options) {
    options.classList.toggle('visible', enabled);
  }
}

/**
 * Handle font scaling toggle change
 * @param {Event} e - Change event
 */
function handleFontScalingToggle(e) {
  const enabled = e.target.checked;
  
  // Toggle font scaling
  AccessibilityManager.toggleFeature('fontScaling', enabled);
  
  // Toggle options visibility
  const options = document.getElementById('font-scaling-options');
  if (options) {
    options.classList.toggle('visible', enabled);
  }
}

/**
 * Handle color blindness toggle change
 * @param {Event} e - Change event
 */
function handleColorBlindnessToggle(e) {
  const enabled = e.target.checked;
  
  // Toggle color blindness mode
  AccessibilityManager.toggleFeature('colorBlindness', enabled);
  
  // Toggle options visibility
  const options = document.getElementById('color-blindness-options');
  if (options) {
    options.classList.toggle('visible', enabled);
  }
}

/**
 * Handle high contrast theme change
 * @param {string} theme - Selected theme
 */
function handleHighContrastThemeChange(theme) {
  // Apply the selected theme
  HighContrastMode.applyTheme(theme);
  
  // Update UI
  updateHighContrastUI({ theme });
}

/**
 * Handle font size change
 * @param {number} level - Font size scaling level
 */
function handleFontSizeChange(level) {
  // Apply the selected font size
  FontScaling.applyFontScaling(parseFloat(level));
  
  // Update UI
  updateFontScalingUI({ level: parseFloat(level) });
}

/**
 * Handle color blindness type change
 * @param {string} type - Selected color blindness type
 */
function handleColorBlindnessTypeChange(type) {
  // Apply the selected color blindness type
  ColorBlindnessMode.applyColorBlindnessMode(type);
  
  // Update UI
  updateColorBlindnessUI({ type });
}

/**
 * Reset all accessibility settings
 */
function resetAllAccessibilitySettings() {
  // Confirm reset
  if (!confirm('Reset all accessibility settings to default?')) {
    return;
  }
  
  // Reset high contrast
  if (HighContrastMode.getState().enabled) {
    AccessibilityManager.toggleFeature('highContrast', false);
  }
  
  // Reset font scaling
  if (FontScaling.getState().enabled) {
    FontScaling.resetScaling();
  }
  
  // Reset color blindness
  if (ColorBlindnessMode.getState().enabled) {
    AccessibilityManager.toggleFeature('colorBlindness', false);
  }
  
  // Update UI
  updateAllToggles();
  
  // Announce reset
  if (typeof AccessibilityManager.announce === 'function') {
    AccessibilityManager.announce('All accessibility settings have been reset', 'info');
  }
  
  logger.info('All accessibility settings reset to defaults');
}

/**
 * Update high contrast UI to match current state
 * @param {Object} [data] - Optional data with theme
 */
function updateHighContrastUI(data = {}) {
  // Get current state
  const state = HighContrastMode.getState();
  
  // Update toggle
  const toggle = document.getElementById('high-contrast-toggle');
  if (toggle) {
    toggle.checked = state.enabled;
  }
  
  // Update options visibility
  const options = document.getElementById('high-contrast-options');
  if (options) {
    options.classList.toggle('visible', state.enabled);
  }
  
  // Update theme buttons
  if (state.enabled) {
    const currentTheme = data.theme || state.theme;
    const themeButtons = document.querySelectorAll('#high-contrast-options [data-theme]');
    
    themeButtons.forEach(button => {
      button.classList.toggle('selected', button.dataset.theme === currentTheme);
    });
  }
}

/**
 * Update font scaling UI to match current state
 * @param {Object} [data] - Optional data with level
 */
function updateFontScalingUI(data = {}) {
  // Get current state
  const state = FontScaling.getState();
  
  // Update toggle
  const toggle = document.getElementById('font-scaling-toggle');
  if (toggle) {
    toggle.checked = state.enabled;
  }
  
  // Update options visibility
  const options = document.getElementById('font-scaling-options');
  if (options) {
    options.classList.toggle('visible', state.enabled);
  }
  
  // Update size buttons
  if (state.enabled) {
    const currentLevel = data.level || state.currentLevel;
    const sizeButtons = document.querySelectorAll('#font-scaling-options [data-size]');
    
    sizeButtons.forEach(button => {
      // Check if approximately equal (floating point comparison)
      const buttonSize = parseFloat(button.dataset.size);
      const isSelected = Math.abs(buttonSize - currentLevel) < 0.01;
      button.classList.toggle('selected', isSelected);
    });
  }
}

/**
 * Update color blindness UI to match current state
 * @param {Object} [data] - Optional data with type
 */
function updateColorBlindnessUI(data = {}) {
  // Get current state
  const state = ColorBlindnessMode.getState();
  
  // Update toggle
  const toggle = document.getElementById('color-blindness-toggle');
  if (toggle) {
    toggle.checked = state.enabled;
  }
  
  // Update options visibility
  const options = document.getElementById('color-blindness-options');
  if (options) {
    options.classList.toggle('visible', state.enabled);
  }
  
  // Update type buttons
  if (state.enabled) {
    const currentType = data.type || state.type;
    const typeButtons = document.querySelectorAll('#color-blindness-options [data-type]');
    
    typeButtons.forEach(button => {
      button.classList.toggle('selected', button.dataset.type === currentType);
    });
  }
}

/**
 * Update all UI toggles to match current state
 */
function updateAllToggles() {
  updateHighContrastUI();
  updateFontScalingUI();
  updateColorBlindnessUI();
}

/**
 * Handle keyboard shortcuts for accessibility features
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardShortcuts(e) {
  // Only handle if initialized
  if (!_initialized) return;
  
  // Get configured shortcuts
  const shortcuts = AccessibilityManager._config?.keyboardShortcuts || {};
  
  // Check for alt+a (default toggle accessibility panel)
  if (e.altKey && e.key === 'a' && !e.shiftKey && shortcuts['alt+a'] === 'toggleAccessibilityPanel') {
    e.preventDefault();
    toggleAccessibilityPanel();
  }
  
  // Check for alt+c (default toggle high contrast)
  if (e.altKey && e.key === 'c' && shortcuts['alt+c'] === 'toggleHighContrast') {
    e.preventDefault();
    const currentState = HighContrastMode.getState();
    AccessibilityManager.toggleFeature('highContrast', !currentState.enabled);
  }
  
  // Check for alt+f (default toggle font scaling)
  if (e.altKey && e.key === 'f' && shortcuts['alt+f'] === 'toggleFontScaling') {
    e.preventDefault();
    const currentState = FontScaling.getState();
    AccessibilityManager.toggleFeature('fontScaling', !currentState.enabled);
  }
  
  // Check for alt+b (default toggle color blindness)
  if (e.altKey && e.key === 'b' && shortcuts['alt+b'] === 'toggleColorBlindness') {
    e.preventDefault();
    const currentState = ColorBlindnessMode.getState();
    AccessibilityManager.toggleFeature('colorBlindness', !currentState.enabled);
  }
  
  // Check for alt+shift+a (default toggle all features)
  if (e.altKey && e.shiftKey && e.key === 'A' && shortcuts['alt+shift+a'] === 'toggleAllFeatures') {
    e.preventDefault();
    
    // Check if any features are enabled
    const state = AccessibilityManager.getFullState();
    const anyEnabled = state.enabledModules.length > 0;
    
    // Toggle all features
    AccessibilityManager.toggleAllFeatures(!anyEnabled);
  }
}

/**
 * Handle feature toggle events
 * @param {Object} data - Event data
 */
function handleFeatureToggled(data) {
  // Update UI based on the toggled feature
  switch (data.feature) {
    case 'highContrast':
      updateHighContrastUI();
      break;
    case 'fontScaling':
      updateFontScalingUI();
      break;
    case 'colorBlindness':
      updateColorBlindnessUI();
      break;
  }
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) return;
  
  logger.info('Cleaning up Accessibility UI');
  
  try {
    // Hide panel if visible
    if (_panelVisible) {
      hideAccessibilityPanel();
    }
    
    // Remove toggle button
    if (_toggleButton && _toggleButton.parentNode) {
      _toggleButton.parentNode.removeChild(_toggleButton);
    }
    
    // Remove panel
    if (_panelElement && _panelElement.parentNode) {
      _panelElement.parentNode.removeChild(_panelElement);
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    
    // Unsubscribe from events
    EventBus.unsubscribe('accessibility:featureToggled', handleFeatureToggled);
    EventBus.unsubscribe('accessibility:highContrastChanged', updateHighContrastUI);
    EventBus.unsubscribe('accessibility:fontScalingChanged', updateFontScalingUI);
    EventBus.unsubscribe('accessibility:colorBlindnessChanged', updateColorBlindnessUI);
    
    _initialized = false;
    _panelVisible = false;
    
    EventBus.publish('accessibility:uiCleanup');
    logger.info('Accessibility UI cleaned up');
  } catch (error) {
    logger.error('Error during Accessibility UI cleanup', error);
  }
}
