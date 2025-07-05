/**
 * ALEJO Accessibility Integration
 * 
 * This module demonstrates how to integrate the adaptive accessibility system
 * with ALEJO's core components, including voice and gesture systems.
 * 
 * It provides examples of:
 * 1. Registering accessibility-specific voice commands
 * 2. Registering accessibility-specific gesture commands
 * 3. Integrating with the notification system for accessibility alerts
 * 4. Adding accessibility hooks to the UI rendering system
 */

import { initializeAccessibilitySystem, adaptiveFeatureManager } from './index.js';
import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';

class AccessibilityIntegration {
    constructor() {
        this.initialized = false;
        this.voiceCommandsRegistered = false;
        this.gestureCommandsRegistered = false;
        
        // Accessibility-specific voice commands
        this.voiceCommands = {
            'enable accessibility': () => this.showAccessibilityPanel(),
            'open accessibility settings': () => this.showAccessibilityPanel(),
            'accessibility help': () => this.showAccessibilityHelp(),
            'enable screen reader': () => this.toggleFeature('screenReader', true),
            'disable screen reader': () => this.toggleFeature('screenReader', false),
            'enable high contrast': () => this.toggleFeature('highContrast', true),
            'disable high contrast': () => this.toggleFeature('highContrast', false),
            'enable captions': () => this.toggleFeature('captions', true),
            'disable captions': () => this.toggleFeature('captions', false),
            'reset accessibility settings': () => this.confirmResetSettings()
        };
        
        // Accessibility-specific gesture commands
        this.gestureCommands = {
            'triple_tap': () => this.showAccessibilityPanel(),
            'swipe_up_three_fingers': () => this.toggleFeature('screenReader'),
            'swipe_down_three_fingers': () => this.toggleFeature('highContrast'),
            'swipe_left_three_fingers': () => this.toggleFeature('captions'),
            'swipe_right_three_fingers': () => this.toggleFeature('vibrationFeedback'),
            'pinch_in_hold': () => this.toggleFeature('textZoom', true),
            'pinch_out_hold': () => this.toggleFeature('textZoom', false),
            'four_finger_tap': () => this.announceAccessibilityStatus()
        };
    }
    
    /**
     * Initialize the accessibility integration
     * @param {Object} options Configuration options
     * @returns {Promise<boolean>} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }
        
        try {
            // Initialize the core accessibility system
            const accessibilityInitialized = await initializeAccessibilitySystem({
                ...options,
                showWelcomeMessage: options.showWelcomeMessage !== false
            });
            
            if (!accessibilityInitialized) {
                console.error('Failed to initialize accessibility system');
                return false;
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Register accessibility voice commands if voice system is available
            this.registerVoiceCommands();
            
            // Register accessibility gesture commands if gesture system is available
            this.registerGestureCommands();
            
            // Inject accessibility hooks into the UI
            this.injectUIHooks();
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize accessibility integration:', error);
            auditTrail.log('error', 'Failed to initialize accessibility integration', {
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Set up event listeners for accessibility integration
     * @private
     */
    setupEventListeners() {
        // Listen for accessibility status changes
        eventEmitter.on('accessibility:feature:changed', this.handleFeatureChange.bind(this));
        
        // Listen for environment changes that might affect accessibility needs
        eventEmitter.on('system:environment:change', this.handleEnvironmentChange.bind(this));
        
        // Listen for voice system initialization to register commands
        eventEmitter.on('voice:system:initialized', () => {
            if (!this.voiceCommandsRegistered) {
                this.registerVoiceCommands();
            }
        });
        
        // Listen for gesture system initialization to register commands
        eventEmitter.on('gesture:system:initialized', () => {
            if (!this.gestureCommandsRegistered) {
                this.registerGestureCommands();
            }
        });
        
        // Listen for UI initialization to inject accessibility hooks
        eventEmitter.on('ui:system:initialized', () => {
            this.injectUIHooks();
        });
    }
    
    /**
     * Register accessibility-specific voice commands
     * @returns {boolean} Success status
     */
    registerVoiceCommands() {
        // Check if voice system is available
        if (!window.voiceRecognition || typeof window.voiceRecognition.registerCommand !== 'function') {
            console.log('Voice system not available for accessibility commands');
            return false;
        }
        
        try {
            // Register each voice command
            for (const [phrase, handler] of Object.entries(this.voiceCommands)) {
                window.voiceRecognition.registerCommand(phrase, handler);
            }
            
            this.voiceCommandsRegistered = true;
            auditTrail.log('accessibility', 'Registered accessibility voice commands');
            return true;
        } catch (error) {
            console.error('Failed to register accessibility voice commands:', error);
            return false;
        }
    }
    
    /**
     * Register accessibility-specific gesture commands
     * @returns {boolean} Success status
     */
    registerGestureCommands() {
        // Check if gesture system is available
        if (!window.gestureSystem || typeof window.gestureSystem.registerGestureHandler !== 'function') {
            console.log('Gesture system not available for accessibility commands');
            return false;
        }
        
        try {
            // Register each gesture command
            for (const [gesture, handler] of Object.entries(this.gestureCommands)) {
                window.gestureSystem.registerGestureHandler(gesture, handler);
            }
            
            this.gestureCommandsRegistered = true;
            auditTrail.log('accessibility', 'Registered accessibility gesture commands');
            return true;
        } catch (error) {
            console.error('Failed to register accessibility gesture commands:', error);
            return false;
        }
    }
    
    /**
     * Inject accessibility hooks into the UI system
     * @private
     */
    injectUIHooks() {
        // Only proceed if UI system is available
        if (!window.alejoUI) {
            console.log('UI system not available for accessibility hooks');
            return false;
        }
        
        try {
            // Add accessibility button to main menu
            if (window.alejoUI.addMenuItem) {
                window.alejoUI.addMenuItem({
                    id: 'accessibility-settings',
                    label: 'Accessibility Settings',
                    icon: 'accessibility',
                    shortcut: 'Alt+A',
                    onClick: () => this.showAccessibilityPanel(),
                    position: 'tools',
                    priority: 'high'
                });
            }
            
            // Add accessibility status to status bar if available
            if (window.alejoUI.setStatusItem) {
                window.alejoUI.setStatusItem({
                    id: 'accessibility-status',
                    icon: 'accessibility',
                    tooltip: 'Accessibility features active',
                    onClick: () => this.showAccessibilityPanel(),
                    visible: this.hasEnabledFeatures()
                });
            }
            
            return true;
        } catch (error) {
            console.error('Failed to inject accessibility UI hooks:', error);
            return false;
        }
    }
    
    /**
     * Handle accessibility feature changes
     * @param {Object} data Change event data
     * @private
     */
    handleFeatureChange(data) {
        // Update UI status indicator if available
        if (window.alejoUI && window.alejoUI.setStatusItem) {
            window.alejoUI.setStatusItem({
                id: 'accessibility-status',
                visible: this.hasEnabledFeatures()
            });
        }
        
        // Update any UI elements that need to reflect the new state
        this.updateUIForFeature(data.featureId, data.enabled);
        
        // Emit integration-specific event for other components
        eventEmitter.emit('accessibility:integration:feature:changed', data);
    }
    
    /**
     * Handle environment changes
     * @param {Object} data Environment change data
     * @private
     */
    handleEnvironmentChange(data) {
        // Already handled by adaptive-feature-manager.js
        // This method could add additional integration-specific handling
    }
    
    /**
     * Check if any accessibility features are enabled
     * @returns {boolean} True if at least one feature is enabled
     * @private
     */
    hasEnabledFeatures() {
        const status = adaptiveFeatureManager.getFeatureStatus();
        
        for (const category in status.features) {
            const categoryFeatures = status.features[category] || [];
            for (const feature of categoryFeatures) {
                if (feature.enabled) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Update UI elements based on feature changes
     * @param {string} featureId - Feature ID that changed
     * @param {boolean} enabled - Whether the feature is now enabled
     * @private
     */
    updateUIForFeature(featureId, enabled) {
        // Apply high contrast if that feature was toggled
        if (featureId === 'highContrast') {
            this.applyHighContrast(enabled);
        }
        
        // Apply text zoom if that feature was toggled
        if (featureId === 'textZoom') {
            this.applyTextZoom(enabled);
        }
        
        // Add more feature-specific UI updates as needed
    }
    
    /**
     * Apply high contrast mode to the UI
     * @param {boolean} enabled Whether to enable high contrast
     * @private
     */
    applyHighContrast(enabled) {
        if (enabled) {
            document.documentElement.classList.add('alejo-high-contrast');
        } else {
            document.documentElement.classList.remove('alejo-high-contrast');
        }
    }
    
    /**
     * Apply text zoom to the UI
     * @param {boolean} enabled Whether to enable text zoom
     * @private
     */
    applyTextZoom(enabled) {
        if (enabled) {
            document.documentElement.classList.add('alejo-text-zoom');
        } else {
            document.documentElement.classList.remove('alejo-text-zoom');
        }
    }
    
    /**
     * Show the accessibility settings panel
     * Public method that can be called from anywhere
     */
    showAccessibilityPanel() {
        eventEmitter.emit('command:openAccessibilitySettings');
    }
    
    /**
     * Show accessibility help information
     * Public method that can be called from anywhere
     */
    showAccessibilityHelp() {
        // Show help dialog or navigate to help page
        if (window.alejoUI && window.alejoUI.showDialog) {
            window.alejoUI.showDialog({
                title: 'Accessibility Help',
                content: `
                    <h3>Accessibility Features</h3>
                    <p>ALEJO includes various accessibility features to help users with different needs:</p>
                    
                    <h4>Voice Commands</h4>
                    <ul>
                        <li>"enable accessibility" - Open the accessibility panel</li>
                        <li>"enable screen reader" - Turn on screen reader support</li>
                        <li>"enable high contrast" - Turn on high contrast mode</li>
                        <li>"enable captions" - Turn on captions for audio content</li>
                    </ul>
                    
                    <h4>Gesture Commands</h4>
                    <ul>
                        <li>Triple tap - Open accessibility panel</li>
                        <li>Swipe up with three fingers - Toggle screen reader</li>
                        <li>Swipe down with three fingers - Toggle high contrast</li>
                        <li>Four finger tap - Announce accessibility status</li>
                    </ul>
                    
                    <h4>Keyboard Shortcuts</h4>
                    <ul>
                        <li>Alt+A - Open accessibility settings</li>
                    </ul>
                `,
                buttons: [
                    {
                        label: 'Open Settings',
                        action: () => this.showAccessibilityPanel()
                    },
                    {
                        label: 'Close',
                        action: 'close'
                    }
                ]
            });
        } else {
            // Fallback to alert if UI system isn't available
            alert('Accessibility features help: Press Alt+A to open accessibility settings.');
        }
    }
    
    /**
     * Toggle an accessibility feature
     * @param {string} featureId Feature ID to toggle
     * @param {boolean} [state] Optional explicit state
     * @returns {boolean} New state
     */
    toggleFeature(featureId, state) {
        return adaptiveFeatureManager.toggleFeature(featureId, state, true);
    }
    
    /**
     * Confirm resetting accessibility settings
     * @private
     */
    confirmResetSettings() {
        if (window.alejoUI && window.alejoUI.showConfirm) {
            window.alejoUI.showConfirm({
                title: 'Reset Accessibility Settings',
                message: 'This will reset all accessibility settings to their default values. Continue?',
                confirmLabel: 'Reset',
                cancelLabel: 'Cancel',
                onConfirm: () => adaptiveFeatureManager.resetToDefaults()
            });
        } else {
            // Fallback to confirm if UI system isn't available
            if (confirm('Reset all accessibility settings to default?')) {
                adaptiveFeatureManager.resetToDefaults();
            }
        }
    }
    
    /**
     * Announce current accessibility status
     * Public method that can be called from anywhere
     */
    announceAccessibilityStatus() {
        adaptiveFeatureManager.announceStatus();
    }
    
    /**
     * Manually run accessibility detection
     * Public method that can be called from anywhere
     * @returns {Promise<Object>} Detection results
     */
    async runAccessibilityDetection() {
        return adaptiveFeatureManager.runAccessibilityDetection();
    }
}

// Create singleton instance
const accessibilityIntegration = new AccessibilityIntegration();

// Export instance
export { accessibilityIntegration };
