/**
 * ALEJO Accessibility Settings Panel
 * 
 * A user interface component for managing accessibility features and settings.
 * This panel is designed to be accessible itself, working with screen readers,
 * keyboard navigation, and various input methods.
 */

import { adaptiveFeatureManager } from './adaptive-feature-manager.js';
import { eventEmitter } from '../../core/event-emitter.js';
import { rbacMiddleware } from '../../security/rbac-middleware.js';
import { auditTrail } from '../../security/audit-trail.js';

class AccessibilitySettingsPanel {
    constructor() {
        this.panelElement = null;
        this.isVisible = false;
        this.tabSections = ['vision', 'hearing', 'motor', 'cognitive', 'detection'];
        this.activeTab = 'vision';
        this.initialized = false;
    }

    /**
     * Initialize the settings panel
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            // Create panel DOM element
            this.createPanelElement();
            
            // Add event listeners
            this.setupEventListeners();
            
            // Initial render
            this.renderPanelContent();
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize accessibility settings panel:', error);
            auditTrail.log('error', 'Failed to initialize accessibility settings panel', { error: error.message });
            return false;
        }
    }

    /**
     * Create the panel DOM element
     * @private
     */
    createPanelElement() {
        // Create main panel container
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'alejo-accessibility-panel';
        this.panelElement.className = 'alejo-panel alejo-accessibility-panel';
        this.panelElement.setAttribute('role', 'dialog');
        this.panelElement.setAttribute('aria-labelledby', 'alejo-accessibility-panel-title');
        this.panelElement.setAttribute('aria-hidden', 'true');
        
        // Add ARIA attributes for accessibility
        this.panelElement.setAttribute('aria-modal', 'true');
        
        // Set initial styles
        this.panelElement.style.display = 'none';
        this.panelElement.style.position = 'fixed';
        this.panelElement.style.top = '50%';
        this.panelElement.style.left = '50%';
        this.panelElement.style.transform = 'translate(-50%, -50%)';
        this.panelElement.style.zIndex = '10000';
        this.panelElement.style.backgroundColor = 'var(--alejo-bg-color, #ffffff)';
        this.panelElement.style.color = 'var(--alejo-text-color, #333333)';
        this.panelElement.style.borderRadius = '8px';
        this.panelElement.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.15)';
        this.panelElement.style.width = '90%';
        this.panelElement.style.maxWidth = '800px';
        this.panelElement.style.maxHeight = '80vh';
        this.panelElement.style.overflowY = 'auto';
        this.panelElement.style.padding = '0';
        
        // Create basic structure
        this.panelElement.innerHTML = `
            <div class="alejo-panel-header">
                <h2 id="alejo-accessibility-panel-title">Accessibility Settings</h2>
                <button id="alejo-accessibility-panel-close" aria-label="Close accessibility settings panel" class="alejo-panel-close-btn">
                    <span aria-hidden="true">×</span>
                </button>
            </div>
            <div class="alejo-panel-tabs" role="tablist">
                <button id="alejo-tab-vision" class="alejo-tab active" role="tab" aria-selected="true" aria-controls="alejo-tab-content-vision">Vision</button>
                <button id="alejo-tab-hearing" class="alejo-tab" role="tab" aria-selected="false" aria-controls="alejo-tab-content-hearing">Hearing</button>
                <button id="alejo-tab-motor" class="alejo-tab" role="tab" aria-selected="false" aria-controls="alejo-tab-content-motor">Motor</button>
                <button id="alejo-tab-cognitive" class="alejo-tab" role="tab" aria-selected="false" aria-controls="alejo-tab-content-cognitive">Cognitive</button>
                <button id="alejo-tab-detection" class="alejo-tab" role="tab" aria-selected="false" aria-controls="alejo-tab-content-detection">Detection</button>
            </div>
            <div class="alejo-panel-content">
                <div id="alejo-tab-content-vision" class="alejo-tab-content" role="tabpanel" aria-labelledby="alejo-tab-vision"></div>
                <div id="alejo-tab-content-hearing" class="alejo-tab-content" role="tabpanel" aria-labelledby="alejo-tab-hearing" hidden></div>
                <div id="alejo-tab-content-motor" class="alejo-tab-content" role="tabpanel" aria-labelledby="alejo-tab-motor" hidden></div>
                <div id="alejo-tab-content-cognitive" class="alejo-tab-content" role="tabpanel" aria-labelledby="alejo-tab-cognitive" hidden></div>
                <div id="alejo-tab-content-detection" class="alejo-tab-content" role="tabpanel" aria-labelledby="alejo-tab-detection" hidden></div>
            </div>
            <div class="alejo-panel-footer">
                <button id="alejo-accessibility-reset" class="alejo-btn alejo-btn-secondary">Reset to Defaults</button>
                <button id="alejo-accessibility-save" class="alejo-btn alejo-btn-primary">Save Changes</button>
            </div>
        `;
        
        // Append to document body
        document.body.appendChild(this.panelElement);
    }

    /**
     * Set up event listeners for the panel
     * @private
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('alejo-accessibility-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hidePanel());
        }
        
        // Tab buttons
        for (const tabName of this.tabSections) {
            const tabBtn = document.getElementById(`alejo-tab-${tabName}`);
            if (tabBtn) {
                tabBtn.addEventListener('click', () => this.switchTab(tabName));
            }
        }
        
        // Reset button
        const resetBtn = document.getElementById('alejo-accessibility-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
        
        // Save button
        const saveBtn = document.getElementById('alejo-accessibility-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // Listen for Escape key to close panel
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                this.hidePanel();
            }
        });
        
        // Listen for feature changes to update UI
        eventEmitter.on('accessibility:feature:changed', () => {
            if (this.isVisible) {
                this.renderPanelContent();
            }
        });
        
        // Listen for global command to open settings
        eventEmitter.on('command:openAccessibilitySettings', () => {
            this.showPanel();
        });
    }

    /**
     * Render panel content based on current feature states
     * @private
     */
    renderPanelContent() {
        // Get current feature status
        const status = adaptiveFeatureManager.getFeatureStatus();
        
        // For each tab section, render its content
        for (const category of this.tabSections) {
            const tabContent = document.getElementById(`alejo-tab-content-${category}`);
            
            if (!tabContent) continue;
            
            // Clear existing content
            tabContent.innerHTML = '';
            
            // Render different content based on tab
            if (category === 'detection') {
                this.renderDetectionTab(tabContent, status);
            } else {
                this.renderFeatureTab(tabContent, category, status);
            }
        }
    }

    /**
     * Render a category-specific feature tab
     * @param {HTMLElement} tabContent - Tab content element
     * @param {string} category - Feature category
     * @param {Object} status - Current feature status
     * @private
     */
    renderFeatureTab(tabContent, category, status) {
        // Create category description
        const descriptions = {
            vision: 'Settings for users with visual impairments, including blindness, low vision, and color blindness.',
            hearing: 'Settings for users with hearing impairments, including deafness and hard of hearing.',
            motor: 'Settings for users with motor impairments, including limited dexterity and mobility.',
            cognitive: 'Settings for users with cognitive impairments, including memory, focus, and reading difficulties.'
        };
        
        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'alejo-tab-description';
        descriptionElement.textContent = descriptions[category] || `${category.charAt(0).toUpperCase() + category.slice(1)} accessibility settings`;
        tabContent.appendChild(descriptionElement);
        
        // Create features list
        const featuresContainer = document.createElement('div');
        featuresContainer.className = 'alejo-features-list';
        
        // Get features for this category
        const features = status.features[category] || [];
        
        if (features.length === 0) {
            const noFeatures = document.createElement('p');
            noFeatures.textContent = 'No features available for this category.';
            featuresContainer.appendChild(noFeatures);
        } else {
            // Sort features by priority
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            features.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            
            // Create toggle for each feature
            for (const feature of features) {
                const featureRow = document.createElement('div');
                featureRow.className = 'alejo-feature-item';
                
                // Feature name with proper formatting
                const featureName = feature.id
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase());
                
                featureRow.innerHTML = `
                    <div class="alejo-feature-info">
                        <span class="alejo-feature-name">${featureName}</span>
                        ${feature.autoDetected ? '<span class="alejo-auto-detected-badge">Auto-detected</span>' : ''}
                        ${feature.userOverride ? '<span class="alejo-user-override-badge">User set</span>' : ''}
                    </div>
                    <label class="alejo-toggle-switch">
                        <input type="checkbox" class="alejo-feature-toggle" data-feature-id="${feature.id}" ${feature.enabled ? 'checked' : ''}>
                        <span class="alejo-toggle-slider"></span>
                        <span class="alejo-toggle-label sr-only">${feature.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                `;
                
                featuresContainer.appendChild(featureRow);
                
                // Add event listener to toggle
                const toggle = featureRow.querySelector('.alejo-feature-toggle');
                toggle.addEventListener('change', (event) => {
                    adaptiveFeatureManager.toggleFeature(feature.id, event.target.checked, true);
                });
            }
        }
        
        tabContent.appendChild(featuresContainer);
    }

    /**
     * Render the detection settings tab
     * @param {HTMLElement} tabContent - Tab content element
     * @param {Object} status - Current feature status
     * @private
     */
    renderDetectionTab(tabContent, status) {
        // Auto-detection toggle section
        const autoDetectionSection = document.createElement('div');
        autoDetectionSection.className = 'alejo-settings-section';
        
        const autoDetectionTitle = document.createElement('h3');
        autoDetectionTitle.textContent = 'Automatic Detection';
        autoDetectionSection.appendChild(autoDetectionTitle);
        
        const autoDetectionDesc = document.createElement('p');
        autoDetectionDesc.textContent = 'Allow ALEJO to automatically detect and adapt to your accessibility needs.';
        autoDetectionSection.appendChild(autoDetectionDesc);
        
        const autoDetectionToggle = document.createElement('div');
        autoDetectionToggle.className = 'alejo-feature-item';
        autoDetectionToggle.innerHTML = `
            <div class="alejo-feature-info">
                <span class="alejo-feature-name">Automatic Detection</span>
            </div>
            <label class="alejo-toggle-switch">
                <input type="checkbox" id="alejo-auto-detection-toggle" ${status.autoDetectionEnabled ? 'checked' : ''}>
                <span class="alejo-toggle-slider"></span>
                <span class="alejo-toggle-label sr-only">${status.autoDetectionEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        `;
        
        autoDetectionSection.appendChild(autoDetectionToggle);
        tabContent.appendChild(autoDetectionSection);
        
        // Event listener for auto-detection toggle
        const autoToggle = document.getElementById('alejo-auto-detection-toggle');
        if (autoToggle) {
            autoToggle.addEventListener('change', (event) => {
                adaptiveFeatureManager.toggleAutoDetection(event.target.checked);
            });
        }
        
        // Threshold settings section
        const thresholdSection = document.createElement('div');
        thresholdSection.className = 'alejo-settings-section';
        
        const thresholdTitle = document.createElement('h3');
        thresholdTitle.textContent = 'Detection Sensitivity';
        thresholdSection.appendChild(thresholdTitle);
        
        const thresholdDesc = document.createElement('p');
        thresholdDesc.textContent = 'Adjust how sensitive ALEJO should be when detecting accessibility needs.';
        thresholdSection.appendChild(thresholdDesc);
        
        // Create sliders for each detection category
        const categories = ['vision', 'hearing', 'motor', 'cognitive'];
        for (const category of categories) {
            const thresholdRow = document.createElement('div');
            thresholdRow.className = 'alejo-threshold-item';
            
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            
            thresholdRow.innerHTML = `
                <label for="alejo-threshold-${category}" class="alejo-threshold-label">${categoryName} Detection Sensitivity</label>
                <div class="alejo-threshold-control">
                    <span class="alejo-threshold-min">Lower</span>
                    <input type="range" id="alejo-threshold-${category}" class="alejo-threshold-slider" 
                           min="0" max="1" step="0.1" value="${adaptiveFeatureManager.detectionThresholds[category]}" 
                           aria-describedby="alejo-threshold-${category}-value">
                    <span class="alejo-threshold-max">Higher</span>
                </div>
                <div id="alejo-threshold-${category}-value" class="alejo-threshold-value">
                    ${Math.round(adaptiveFeatureManager.detectionThresholds[category] * 100)}%
                </div>
            `;
            
            thresholdSection.appendChild(thresholdRow);
            
            // Add event listener (will be attached after appending to DOM)
        }
        
        tabContent.appendChild(thresholdSection);
        
        // Now add event listeners for threshold sliders
        for (const category of categories) {
            const slider = document.getElementById(`alejo-threshold-${category}`);
            const valueDisplay = document.getElementById(`alejo-threshold-${category}-value`);
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (event) => {
                    const value = parseFloat(event.target.value);
                    valueDisplay.textContent = `${Math.round(value * 100)}%`;
                });
                
                slider.addEventListener('change', (event) => {
                    const value = parseFloat(event.target.value);
                    adaptiveFeatureManager.setDetectionThreshold(category, value);
                });
            }
        }
        
        // Privacy notice section
        const privacySection = document.createElement('div');
        privacySection.className = 'alejo-settings-section alejo-privacy-section';
        
        privacySection.innerHTML = `
            <h3>Privacy Information</h3>
            <p>All accessibility detection happens locally on your device. No personal data or detection results are sent to external servers.</p>
            <p>You can review and clear stored accessibility preferences at any time.</p>
            <button id="alejo-clear-preferences" class="alejo-btn alejo-btn-secondary">Clear Stored Preferences</button>
        `;
        
        tabContent.appendChild(privacySection);
        
        // Add event listener for clear preferences button
        const clearBtn = document.getElementById('alejo-clear-preferences');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearStoredPreferences());
        }
    }

    /**
     * Switch to a different tab
     * @param {string} tabName - Name of tab to switch to
     * @private
     */
    switchTab(tabName) {
        // Validate tab name
        if (!this.tabSections.includes(tabName)) {
            return;
        }
        
        // Update active state
        this.activeTab = tabName;
        
        // Update tab buttons
        for (const tab of this.tabSections) {
            const tabBtn = document.getElementById(`alejo-tab-${tab}`);
            const tabContent = document.getElementById(`alejo-tab-content-${tab}`);
            
            if (tabBtn && tabContent) {
                if (tab === tabName) {
                    tabBtn.classList.add('active');
                    tabBtn.setAttribute('aria-selected', 'true');
                    tabContent.hidden = false;
                } else {
                    tabBtn.classList.remove('active');
                    tabBtn.setAttribute('aria-selected', 'false');
                    tabContent.hidden = true;
                }
            }
        }
        
        // Announce tab switch for screen readers
        this.announceForScreenReader(`Switched to ${tabName} settings tab`);
    }

    /**
     * Show the settings panel
     */
    showPanel() {
        // Check if already initialized
        if (!this.initialized) {
            this.initialize().then(() => {
                this.displayPanel();
            });
        } else {
            this.displayPanel();
        }
    }
    
    /**
     * Actually display the panel
     * @private
     */
    displayPanel() {
        // Update content before showing
        this.renderPanelContent();
        
        // Show panel
        this.panelElement.style.display = 'block';
        this.panelElement.setAttribute('aria-hidden', 'false');
        
        // Set focus on first element for keyboard accessibility
        setTimeout(() => {
            const firstTab = document.getElementById(`alejo-tab-${this.activeTab}`);
            if (firstTab) {
                firstTab.focus();
            }
        }, 100);
        
        this.isVisible = true;
        
        // Add overlay
        this.addOverlay();
        
        // Announce for screen readers
        this.announceForScreenReader('Accessibility settings panel opened');
        
        // Log panel open
        auditTrail.log('accessibility', 'Opened accessibility settings panel');
    }

    /**
     * Hide the settings panel
     */
    hidePanel() {
        if (!this.isVisible) return;
        
        // Hide panel
        this.panelElement.style.display = 'none';
        this.panelElement.setAttribute('aria-hidden', 'true');
        
        this.isVisible = false;
        
        // Remove overlay
        this.removeOverlay();
        
        // Announce for screen readers
        this.announceForScreenReader('Accessibility settings panel closed');
        
        // Log panel close
        auditTrail.log('accessibility', 'Closed accessibility settings panel');
    }

    /**
     * Add overlay behind panel
     * @private
     */
    addOverlay() {
        // Create overlay if it doesn't exist
        let overlay = document.getElementById('alejo-accessibility-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'alejo-accessibility-overlay';
            overlay.className = 'alejo-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            overlay.style.zIndex = '9999';
            
            // Click on overlay closes panel
            overlay.addEventListener('click', () => this.hidePanel());
            
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'block';
        }
    }

    /**
     * Remove overlay
     * @private
     */
    removeOverlay() {
        const overlay = document.getElementById('alejo-accessibility-overlay');
        
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Announce message for screen readers
     * @param {string} message - Message to announce
     * @private
     */
    announceForScreenReader(message) {
        // Use ARIA live region for announcements
        let announcer = document.getElementById('alejo-screen-reader-announcer');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'alejo-screen-reader-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            document.body.appendChild(announcer);
        }
        
        announcer.textContent = message;
    }

    /**
     * Reset all settings to defaults
     * @private
     */
    resetSettings() {
        // Show confirmation dialog
        if (confirm('This will reset all accessibility settings to their default values. Continue?')) {
            adaptiveFeatureManager.resetToDefaults();
            
            // Announce for screen readers
            this.announceForScreenReader('Accessibility settings have been reset to defaults');
            
            // Re-render panel content
            this.renderPanelContent();
        }
    }

    /**
     * Save current settings
     * @private
     */
    saveSettings() {
        // This is automatically handled by the adaptiveFeatureManager on each change,
        // but we provide this button for user confidence
        
        // Show confirmation
        alert('Your accessibility preferences have been saved.');
        
        // Announce for screen readers
        this.announceForScreenReader('Accessibility settings have been saved');
        
        // Hide panel
        this.hidePanel();
    }

    /**
     * Clear stored preferences
     * @private
     */
    clearStoredPreferences() {
        // Show confirmation dialog
        if (confirm('This will clear all stored accessibility preferences. You will need to set them again or let ALEJO detect them automatically. Continue?')) {
            // Clear local storage
            localStorage.removeItem('accessibility_preferences');
            
            // Reset feature manager
            adaptiveFeatureManager.resetToDefaults();
            
            // Announce for screen readers
            this.announceForScreenReader('Stored accessibility preferences have been cleared');
            
            // Re-render panel content
            this.renderPanelContent();
        }
    }
}

// Create singleton instance
const accessibilitySettingsPanel = new AccessibilitySettingsPanel();

// Export module
export { accessibilitySettingsPanel };
