/**
 * ALEJO Accessibility Settings Panel
 * 
 * This module provides a user interface for configuring accessibility options:
 * - Font size and text preferences
 * - High contrast mode and themes
 * - Color blindness accommodations
 * - Keyboard navigation options
 * - Motion reduction settings
 * 
 * @module personalization/accessibility/accessibility-panel
 */

import { EventBus } from '../../core/events/event-bus.js';
import { Logger } from '../../core/logger/logger.js';
import { ResourceManager } from '../../core/resources/resource-manager.js';
import { KeyboardNavigationManager } from './keyboard-navigation.js';
import { VisualAdaptationsManager } from './visual-adaptations.js';
import { AriaManager } from './aria-manager.js';

/**
 * Accessibility Settings Panel Class
 */
class AccessibilityPanel {
  /**
   * Create a new AccessibilityPanel instance
   */
  constructor() {
    this.initialized = false;
    this.eventBus = null;
    this.logger = null;
    this.resources = null;
    this.panel = null;
    this.isVisible = false;
    this.keyboardNavManager = null;
    this.visualAdaptations = null;
    this.ariaManager = null;
    this.settingsForm = null;
    this.localization = {
      title: 'Accessibility Settings',
      closeButton: 'Close',
      saveButton: 'Save Settings',
      resetButton: 'Reset to Defaults',
      visualSection: 'Visual Settings',
      keyboardSection: 'Keyboard & Navigation',
      screenReaderSection: 'Screen Reader',
      fontSizeLabel: 'Font Size',
      highContrastLabel: 'High Contrast Mode',
      contrastThemeLabel: 'Contrast Theme',
      colorBlindnessLabel: 'Color Blindness Mode',
      reduceMotionLabel: 'Reduce Motion',
      keyboardShortcutsLabel: 'Enable Keyboard Shortcuts',
      focusHighlightLabel: 'Highlight Focused Elements',
      screenReaderSupportLabel: 'Optimize for Screen Readers'
    };
  }

  /**
   * Get singleton instance
   * @returns {AccessibilityPanel} Singleton instance
   */
  static getInstance() {
    if (!AccessibilityPanel.instance) {
      AccessibilityPanel.instance = new AccessibilityPanel();
    }
    return AccessibilityPanel.instance;
  }

  /**
   * Initialize the Accessibility Panel
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        return true;
      }

      const defaultOptions = {
        keyboardShortcut: true,
        appendTo: document.body,
        localization: {}
      };

      const finalOptions = { ...defaultOptions, ...options };

      this.eventBus = EventBus.getInstance();
      this.logger = new Logger('AccessibilityPanel');
      this.resources = ResourceManager.getInstance();
      
      // Get references to required managers
      this.keyboardNavManager = KeyboardNavigationManager;
      this.visualAdaptations = VisualAdaptationsManager;
      this.ariaManager = AriaManager;

      // Extend localization with provided options
      if (finalOptions.localization) {
        this.localization = { ...this.localization, ...finalOptions.localization };
      }
      
      // Create panel element
      this._createPanel(finalOptions.appendTo);
      
      // Register event handlers
      this._registerEventHandlers();
      
      // Set up keyboard shortcut if enabled
      if (finalOptions.keyboardShortcut) {
        this.keyboardNavManager.registerShortcut('accessibilityPanel', {
          keys: { key: 'a', modifiers: { altKey: true } },
          action: 'toggleAccessibilityPanel',
          callback: () => this.toggle()
        });
      }

      this.initialized = true;
      this.eventBus.publish('accessibility:panel:initialized', { success: true });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Accessibility Panel', error);
      this.eventBus.publish('accessibility:panel:initialized', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Create the panel element
   * @param {HTMLElement} appendTo - Element to append panel to
   * @private
   */
  _createPanel(appendTo) {
    // Create main container
    this.panel = document.createElement('div');
    this.panel.id = 'alejo-accessibility-panel';
    this.panel.className = 'alejo-accessibility-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'alejo-accessibility-panel-title');
    this.panel.setAttribute('aria-hidden', 'true');
    this.panel.style.display = 'none';
    
    // Create panel header
    const header = document.createElement('header');
    header.className = 'alejo-accessibility-panel-header';
    
    const title = document.createElement('h2');
    title.id = 'alejo-accessibility-panel-title';
    title.textContent = this.localization.title;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'alejo-accessibility-panel-close';
    closeButton.setAttribute('aria-label', this.localization.closeButton);
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', () => this.hide());
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create settings form
    this.settingsForm = document.createElement('form');
    this.settingsForm.className = 'alejo-accessibility-settings-form';
    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._saveSettings();
    });
    
    // Create form sections
    const visualSection = this._createVisualSettingsSection();
    const keyboardSection = this._createKeyboardSettingsSection();
    const screenReaderSection = this._createScreenReaderSection();
    
    // Create form buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'alejo-accessibility-panel-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'alejo-accessibility-save-button';
    saveButton.textContent = this.localization.saveButton;
    
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'alejo-accessibility-reset-button';
    resetButton.textContent = this.localization.resetButton;
    resetButton.addEventListener('click', () => this._resetSettings());
    
    buttonsContainer.appendChild(saveButton);
    buttonsContainer.appendChild(resetButton);
    
    // Assemble the form
    this.settingsForm.appendChild(visualSection);
    this.settingsForm.appendChild(keyboardSection);
    this.settingsForm.appendChild(screenReaderSection);
    this.settingsForm.appendChild(buttonsContainer);
    
    // Assemble the panel
    this.panel.appendChild(header);
    this.panel.appendChild(this.settingsForm);
    
    // Add styles
    this._addStyles();
    
    // Append to target element
    appendTo.appendChild(this.panel);
  }
  
  /**
   * Create visual settings section
   * @returns {HTMLElement} Section element
   * @private
   */
  _createVisualSettingsSection() {
    const section = document.createElement('section');
    section.className = 'alejo-accessibility-section';
    
    const heading = document.createElement('h3');
    heading.textContent = this.localization.visualSection;
    section.appendChild(heading);
    
    // Font size control
    const fontSizeGroup = document.createElement('div');
    fontSizeGroup.className = 'alejo-accessibility-setting-group';
    
    const fontSizeLabel = document.createElement('label');
    fontSizeLabel.htmlFor = 'alejo-font-size';
    fontSizeLabel.textContent = this.localization.fontSizeLabel;
    
    const fontSizeValue = document.createElement('span');
    fontSizeValue.className = 'alejo-setting-value';
    fontSizeValue.id = 'alejo-font-size-value';
    fontSizeValue.textContent = '100%';
    
    const fontSizeSlider = document.createElement('input');
    fontSizeSlider.type = 'range';
    fontSizeSlider.id = 'alejo-font-size';
    fontSizeSlider.name = 'fontSize';
    fontSizeSlider.min = '75';
    fontSizeSlider.max = '200';
    fontSizeSlider.step = '5';
    fontSizeSlider.value = '100';
    fontSizeSlider.addEventListener('input', () => {
      fontSizeValue.textContent = `${fontSizeSlider.value}%`;
    });
    
    fontSizeGroup.appendChild(fontSizeLabel);
    fontSizeGroup.appendChild(fontSizeSlider);
    fontSizeGroup.appendChild(fontSizeValue);
    section.appendChild(fontSizeGroup);
    
    // High contrast mode
    const highContrastGroup = document.createElement('div');
    highContrastGroup.className = 'alejo-accessibility-setting-group';
    
    const highContrastLabel = document.createElement('label');
    highContrastLabel.htmlFor = 'alejo-high-contrast';
    highContrastLabel.textContent = this.localization.highContrastLabel;
    
    const highContrastToggle = document.createElement('input');
    highContrastToggle.type = 'checkbox';
    highContrastToggle.id = 'alejo-high-contrast';
    highContrastToggle.name = 'highContrast';
    highContrastToggle.addEventListener('change', () => this._onHighContrastToggle());
    
    const themeLabel = document.createElement('label');
    themeLabel.htmlFor = 'alejo-contrast-theme';
    themeLabel.textContent = this.localization.contrastThemeLabel;
    
    const themeSelect = document.createElement('select');
    themeSelect.id = 'alejo-contrast-theme';
    themeSelect.name = 'contrastTheme';
    themeSelect.addEventListener('change', () => this._onContrastThemeChange());
    
    const themes = [
      { value: 'light', text: 'Light' },
      { value: 'dark', text: 'Dark' },
      { value: 'black-on-white', text: 'Black on White' },
      { value: 'yellow-on-black', text: 'Yellow on Black' }
    ];
    
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.value;
      option.textContent = theme.text;
      themeSelect.appendChild(option);
    });
    
    highContrastToggle.addEventListener('change', () => {
      themeSelect.disabled = !highContrastToggle.checked;
    });
    
    themeSelect.disabled = !highContrastToggle.checked;
    
    highContrastGroup.appendChild(highContrastLabel);
    highContrastGroup.appendChild(highContrastToggle);
    highContrastGroup.appendChild(document.createElement('br'));
    highContrastGroup.appendChild(themeLabel);
    highContrastGroup.appendChild(themeSelect);
    section.appendChild(highContrastGroup);
    
    // Color blindness mode
    const colorBlindnessGroup = document.createElement('div');
    colorBlindnessGroup.className = 'alejo-accessibility-setting-group';
    
    const colorBlindnessLabel = document.createElement('label');
    colorBlindnessLabel.htmlFor = 'alejo-color-blindness';
    colorBlindnessLabel.textContent = this.localization.colorBlindnessLabel;
    
    const colorBlindnessSelect = document.createElement('select');
    colorBlindnessSelect.id = 'alejo-color-blindness';
    colorBlindnessSelect.name = 'colorBlindnessMode';
    
    const modes = [
      { value: 'none', text: 'None' },
      { value: 'protanopia', text: 'Protanopia (Red-Blind)' },
      { value: 'deuteranopia', text: 'Deuteranopia (Green-Blind)' },
      { value: 'tritanopia', text: 'Tritanopia (Blue-Blind)' }
    ];
    
    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.text;
      colorBlindnessSelect.appendChild(option);
    });
    
    const intensityLabel = document.createElement('label');
    intensityLabel.htmlFor = 'alejo-color-blindness-intensity';
    intensityLabel.textContent = 'Intensity';
    
    const intensitySlider = document.createElement('input');
    intensitySlider.type = 'range';
    intensitySlider.id = 'alejo-color-blindness-intensity';
    intensitySlider.name = 'colorBlindnessIntensity';
    intensitySlider.min = '0';
    intensitySlider.max = '100';
    intensitySlider.value = '100';
    
    const intensityValue = document.createElement('span');
    intensityValue.className = 'alejo-setting-value';
    intensityValue.textContent = '100%';
    
    intensitySlider.addEventListener('input', () => {
      intensityValue.textContent = `${intensitySlider.value}%`;
    });
    
    colorBlindnessSelect.addEventListener('change', () => {
      const isNone = colorBlindnessSelect.value === 'none';
      intensityLabel.style.opacity = isNone ? '0.5' : '1';
      intensitySlider.disabled = isNone;
      intensityValue.style.opacity = isNone ? '0.5' : '1';
    });
    
    colorBlindnessGroup.appendChild(colorBlindnessLabel);
    colorBlindnessGroup.appendChild(colorBlindnessSelect);
    colorBlindnessGroup.appendChild(document.createElement('br'));
    colorBlindnessGroup.appendChild(intensityLabel);
    colorBlindnessGroup.appendChild(intensitySlider);
    colorBlindnessGroup.appendChild(intensityValue);
    section.appendChild(colorBlindnessGroup);
    
    // Reduce motion
    const reduceMotionGroup = document.createElement('div');
    reduceMotionGroup.className = 'alejo-accessibility-setting-group';
    
    const reduceMotionLabel = document.createElement('label');
    reduceMotionLabel.htmlFor = 'alejo-reduce-motion';
    reduceMotionLabel.textContent = this.localization.reduceMotionLabel;
    
    const reduceMotionToggle = document.createElement('input');
    reduceMotionToggle.type = 'checkbox';
    reduceMotionToggle.id = 'alejo-reduce-motion';
    reduceMotionToggle.name = 'reduceMotion';
    
    reduceMotionGroup.appendChild(reduceMotionLabel);
    reduceMotionGroup.appendChild(reduceMotionToggle);
    section.appendChild(reduceMotionGroup);
    
    return section;
  }
  
  /**
   * Create keyboard settings section
   * @returns {HTMLElement} Section element
   * @private
   */
  _createKeyboardSettingsSection() {
    const section = document.createElement('section');
    section.className = 'alejo-accessibility-section';
    
    const heading = document.createElement('h3');
    heading.textContent = this.localization.keyboardSection;
    section.appendChild(heading);
    
    // Keyboard shortcuts
    const keyboardGroup = document.createElement('div');
    keyboardGroup.className = 'alejo-accessibility-setting-group';
    
    const keyboardLabel = document.createElement('label');
    keyboardLabel.htmlFor = 'alejo-keyboard-shortcuts';
    keyboardLabel.textContent = this.localization.keyboardShortcutsLabel;
    
    const keyboardToggle = document.createElement('input');
    keyboardToggle.type = 'checkbox';
    keyboardToggle.id = 'alejo-keyboard-shortcuts';
    keyboardToggle.name = 'keyboardShortcuts';
    keyboardToggle.checked = true;
    
    keyboardGroup.appendChild(keyboardLabel);
    keyboardGroup.appendChild(keyboardToggle);
    section.appendChild(keyboardGroup);
    
    // Focus highlighting
    const focusGroup = document.createElement('div');
    focusGroup.className = 'alejo-accessibility-setting-group';
    
    const focusLabel = document.createElement('label');
    focusLabel.htmlFor = 'alejo-focus-highlight';
    focusLabel.textContent = this.localization.focusHighlightLabel;
    
    const focusToggle = document.createElement('input');
    focusToggle.type = 'checkbox';
    focusToggle.id = 'alejo-focus-highlight';
    focusToggle.name = 'highlightFocus';
    focusToggle.checked = true;
    
    focusGroup.appendChild(focusLabel);
    focusGroup.appendChild(focusToggle);
    section.appendChild(focusGroup);
    
    return section;
  }
  
  /**
   * Create screen reader settings section
   * @returns {HTMLElement} Section element
   * @private
   */
  _createScreenReaderSection() {
    const section = document.createElement('section');
    section.className = 'alejo-accessibility-section';
    
    const heading = document.createElement('h3');
    heading.textContent = this.localization.screenReaderSection;
    section.appendChild(heading);
    
    // Screen reader optimization
    const srGroup = document.createElement('div');
    srGroup.className = 'alejo-accessibility-setting-group';
    
    const srLabel = document.createElement('label');
    srLabel.htmlFor = 'alejo-screen-reader-support';
    srLabel.textContent = this.localization.screenReaderSupportLabel;
    
    const srToggle = document.createElement('input');
    srToggle.type = 'checkbox';
    srToggle.id = 'alejo-screen-reader-support';
    srToggle.name = 'screenReaderOptimization';
    srToggle.checked = false;
    
    srGroup.appendChild(srLabel);
    srGroup.appendChild(srToggle);
    section.appendChild(srGroup);
    
    return section;
  }
  
  /**
   * Add panel styles
   * @private
   */
  _addStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .alejo-accessibility-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-width: 90%;
        max-height: 90vh;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        overflow-y: auto;
        display: none;
      }
      
      .alejo-accessibility-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #eaeaea;
      }
      
      .alejo-accessibility-panel-header h2 {
        margin: 0;
        font-size: 18px;
      }
      
      .alejo-accessibility-panel-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
      }
      
      .alejo-accessibility-panel-close:hover {
        background: #f0f0f0;
      }
      
      .alejo-accessibility-settings-form {
        padding: 16px;
      }
      
      .alejo-accessibility-section {
        margin-bottom: 24px;
      }
      
      .alejo-accessibility-section h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        border-bottom: 1px solid #eaeaea;
        padding-bottom: 8px;
      }
      
      .alejo-accessibility-setting-group {
        margin-bottom: 16px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .alejo-accessibility-setting-group label {
        flex: 1 1 200px;
        margin-right: 12px;
      }
      
      .alejo-accessibility-setting-group input[type="range"] {
        flex: 2 1 100px;
        margin-right: 12px;
      }
      
      .alejo-accessibility-setting-group select {
        flex: 2 1 100px;
      }
      
      .alejo-setting-value {
        flex: 0 0 50px;
        text-align: right;
      }
      
      .alejo-accessibility-panel-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 24px;
      }
      
      .alejo-accessibility-panel-buttons button {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .alejo-accessibility-save-button {
        background: #4299e1;
        color: white;
        border: none;
      }
      
      .alejo-accessibility-reset-button {
        background: none;
        border: 1px solid #ccc;
      }
      
      .alejo-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        display: none;
      }
      
      /* High contrast compatibility */
      @media (forced-colors: active) {
        .alejo-accessibility-panel {
          border: 2px solid CanvasText;
        }
        
        .alejo-accessibility-save-button,
        .alejo-accessibility-reset-button {
          border: 1px solid CanvasText;
          background: Canvas;
          color: CanvasText;
        }
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  /**
   * Register event handlers
   * @private
   */
  _registerEventHandlers() {
    // Listen for keyboard shortcuts
    this.eventBus.subscribe('accessibility:shortcut:toggleAccessibilityPanel', () => {
      this.toggle();
    });
    
    // Handle ESC key to close panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }
  
  /**
   * Save settings from form
   * @private
   */
  _saveSettings() {
    // Get form values
    const formData = new FormData(this.settingsForm);
    
    // Visual settings
    this.visualAdaptations.updateSetting('fontSize', parseInt(formData.get('fontSize') || 100));
    this.visualAdaptations.updateSetting('highContrast', formData.has('highContrast'));
    this.visualAdaptations.updateSetting('contrastTheme', formData.get('contrastTheme') || 'light');
    this.visualAdaptations.updateSetting('colorBlindnessMode', formData.get('colorBlindnessMode') || 'none');
    this.visualAdaptations.updateSetting('colorBlindnessIntensity', parseInt(formData.get('colorBlindnessIntensity') || 100));
    this.visualAdaptations.updateSetting('reduceMotion', formData.has('reduceMotion'));
    this.visualAdaptations.updateSetting('highlightFocus', formData.has('highlightFocus'));
    
    // Screen reader optimization
    const screenReaderOptimized = formData.has('screenReaderOptimization');
    
    // If screen reader optimization is enabled/disabled
    if (screenReaderOptimized) {
      this.ariaManager.enableScreenReaderOptimization();
    } else {
      this.ariaManager.disableScreenReaderOptimization();
    }
    
    // Publish event
    this.eventBus.publish('accessibility:settings:saved', {
      settings: this.visualAdaptations.getSettings()
    });
    
    // Hide panel
    this.hide();
    
    // Announce settings saved
    this.ariaManager.announceMessage('Accessibility settings saved and applied');
  }
  
  /**
   * Reset settings to defaults
   * @private
   */
  _resetSettings() {
    // Reset visual adaptations
    this.visualAdaptations.resetToDefaults();
    
    // Reset form values
    this._updateFormFromSettings();
    
    // Announce reset
    this.ariaManager.announceMessage('Accessibility settings reset to defaults');
  }
  
  /**
   * Update form controls from current settings
   * @private
   */
  _updateFormFromSettings() {
    const settings = this.visualAdaptations.getSettings();
    
    // Font size
    const fontSizeInput = document.getElementById('alejo-font-size');
    const fontSizeValue = document.getElementById('alejo-font-size-value');
    fontSizeInput.value = settings.fontSize;
    fontSizeValue.textContent = `${settings.fontSize}%`;
    
    // High contrast
    const highContrastToggle = document.getElementById('alejo-high-contrast');
    const themeSelect = document.getElementById('alejo-contrast-theme');
    highContrastToggle.checked = settings.highContrast;
    themeSelect.value = settings.contrastTheme;
    themeSelect.disabled = !settings.highContrast;
    
    // Color blindness
    const colorBlindnessSelect = document.getElementById('alejo-color-blindness');
    const intensitySlider = document.getElementById('alejo-color-blindness-intensity');
    const intensityLabel = document.querySelector('label[for="alejo-color-blindness-intensity"]');
    const intensityValue = intensitySlider.nextElementSibling;
    
    colorBlindnessSelect.value = settings.colorBlindnessMode;
    intensitySlider.value = settings.colorBlindnessIntensity;
    intensityValue.textContent = `${settings.colorBlindnessIntensity}%`;
    
    const isNone = settings.colorBlindnessMode === 'none';
    intensityLabel.style.opacity = isNone ? '0.5' : '1';
    intensitySlider.disabled = isNone;
    intensityValue.style.opacity = isNone ? '0.5' : '1';
    
    // Reduce motion
    const reduceMotionToggle = document.getElementById('alejo-reduce-motion');
    reduceMotionToggle.checked = settings.reduceMotion;
    
    // Focus highlight
    const focusToggle = document.getElementById('alejo-focus-highlight');
    focusToggle.checked = settings.highlightFocus;
  }
  
  _onHighContrastToggle() {
    const isChecked = document.getElementById('alejo-high-contrast').checked;
    this.visualAdaptations.updateSetting('highContrast', isChecked);
    this._saveSetting('highContrast', isChecked);
  }

  _onContrastThemeChange() {
    const theme = document.getElementById('alejo-contrast-theme').value;
    this.visualAdaptations.updateSetting('contrastTheme', theme);
    this._saveSetting('contrastTheme', theme);
  }
  
  /**
   * Show the accessibility panel
   */
  show() {
    if (!this.initialized || this.isVisible) {
      return;
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'alejo-overlay';
    overlay.addEventListener('click', () => this.hide());
    document.body.appendChild(overlay);
    
    // Show overlay with fade in
    overlay.style.display = 'block';
    
    // Show panel
    this.panel.style.display = 'block';
    this.panel.setAttribute('aria-hidden', 'false');
    
    // Update form values
    this._updateFormFromSettings();
    
    // Create focus trap
    this.focusTrapId = this.keyboardNavManager.createFocusTrap(this.panel, {
      initialFocus: '#alejo-font-size'
    });
    
    this.isVisible = true;
    
    // Publish event
    this.eventBus.publish('accessibility:panel:shown');
  }
  
  /**
   * Hide the accessibility panel
   */
  hide() {
    if (!this.initialized || !this.isVisible) {
      return;
    }
    
    // Remove overlay
    const overlay = document.querySelector('.alejo-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
    
    // Hide panel
    this.panel.style.display = 'none';
    this.panel.setAttribute('aria-hidden', 'true');
    
    // Remove focus trap
    if (this.focusTrapId) {
      this.keyboardNavManager.removeFocusTrap(this.focusTrapId);
      this.focusTrapId = null;
    }
    
    this.isVisible = false;
    
    // Publish event
    this.eventBus.publish('accessibility:panel:hidden');
  }
  
  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}

// Add ARIA attributes for screen reader support
const screenReaderSupport = {
  init: function() {
    this.addAriaAttributes();
    this.setupLiveRegion();
    this.enableKeyboardNavigation();
  },
  
  addAriaAttributes: function() {
    const panel = document.getElementById('alejo-accessibility-panel');
    if (panel) {
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', 'alejo-accessibility-panel-title');
    }
  },
  
  setupLiveRegion: function() {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(1px, 1px, 1px, 1px)';
    document.body.appendChild(liveRegion);
    this.liveRegion = liveRegion;
  },
  
  announce: function(message) {
    if (this.liveRegion) {
      this.liveRegion.textContent = message;
    }
  },
  
  enableKeyboardNavigation: function() {
    const panel = document.getElementById('alejo-accessibility-panel');
    if (panel) {
      panel.addEventListener('keydown', (e) => {
        // Handle tab and arrow keys for navigation
        if (e.key === 'Tab') {
          // Ensure focus stays within the panel
          const focusableElements = panel.querySelectorAll('button, input, select');
          if (focusableElements.length === 0) return;
          
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      });
    }
  }
};

// Initialize screen reader support when the panel is loaded
document.addEventListener('DOMContentLoaded', () => {
  screenReaderSupport.init();
});

// Create singleton instance
const instance = AccessibilityPanel.getInstance();

export { instance as AccessibilityPanel };
export default instance;

class AccessibilityPanel {
  constructor() {
    this.panelElement = document.getElementById('alejo-accessibility-panel');
    this.initComplete = false;
    this.currentSettings = {
      screenReader: true,
      highContrast: false,
      fontSize: 'medium',
      keyboardNavigation: true
    };
  }

  init() {
    if (this.initComplete) return;
    
    // Create panel UI
    this.createPanelStructure();
    
    // Load saved settings
    this.loadSettings();
    
    // Apply initial settings
    this.applySettings();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.initComplete = true;
    console.log('Accessibility panel initialized');
  }

  createPanelStructure() {
    this.panelElement.innerHTML = `
      <div class="panel-header">
        <h2 id="alejo-accessibility-panel-title">Accessibility Settings</h2>
      </div>
      <div class="panel-content">
        <div class="setting">
          <label>
            <input type="checkbox" id="screen-reader-toggle">
            Screen Reader Support
          </label>
        </div>
        <div class="setting">
          <label>
            <input type="checkbox" id="high-contrast-toggle">
            High Contrast Mode
          </label>
        </div>
        <div class="setting">
          <label>Font Size:</label>
          <select id="font-size-select">
            <option value="small">Small</option>
            <option value="medium" selected>Medium</option>
            <option value="large">Large</option>
            <option value="x-large">Extra Large</option>
          </select>
        </div>
        <div class="setting">
          <label>
            <input type="checkbox" id="keyboard-nav-toggle">
            Enhanced Keyboard Navigation
          </label>
        </div>
      </div>
    `;
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('alejoAccessibilitySettings');
    if (savedSettings) {
      this.currentSettings = JSON.parse(savedSettings);
    }
  }

  saveSettings() {
    localStorage.setItem(
      'alejoAccessibilitySettings', 
      JSON.stringify(this.currentSettings)
    );
  }

  applySettings() {
    // Apply screen reader settings
    document.getElementById('screen-reader-toggle').checked = 
      this.currentSettings.screenReader;
      
    // Apply high contrast mode
    document.getElementById('high-contrast-toggle').checked = 
      this.currentSettings.highContrast;
    if (this.currentSettings.highContrast) {
      enableHighContrastMode();
    }
    
    // Apply font size
    document.getElementById('font-size-select').value = 
      this.currentSettings.fontSize;
    applyFontSize(this.currentSettings.fontSize);
    
    // Apply keyboard navigation
    document.getElementById('keyboard-nav-toggle').checked = 
      this.currentSettings.keyboardNavigation;
    if (this.currentSettings.keyboardNavigation) {
      enableKeyboardNavigation();
    }
  }

  setupEventListeners() {
    document.getElementById('screen-reader-toggle')
      .addEventListener('change', (e) => {
        this.currentSettings.screenReader = e.target.checked;
        this.saveSettings();
        if (e.target.checked) {
          initScreenReaderSupport();
        }
      });

    document.getElementById('high-contrast-toggle')
      .addEventListener('change', (e) => {
        this.currentSettings.highContrast = e.target.checked;
        this.saveSettings();
        if (e.target.checked) {
          enableHighContrastMode();
        } else {
          disableHighContrastMode();
        }
      });

    document.getElementById('font-size-select')
      .addEventListener('change', (e) => {
        this.currentSettings.fontSize = e.target.value;
        this.saveSettings();
        applyFontSize(e.target.value);
      });

    document.getElementById('keyboard-nav-toggle')
      .addEventListener('change', (e) => {
        this.currentSettings.keyboardNavigation = e.target.checked;
        this.saveSettings();
        if (e.target.checked) {
          enableKeyboardNavigation();
        }
      });
  }

  show() {
    this.panelElement.style.display = 'block';
    this.init();
  }

  hide() {
    this.panelElement.style.display = 'none';
  }

  toggle() {
    if (this.panelElement.style.display === 'block') {
      this.hide();
    } else {
      this.show();
    }
  }
}
