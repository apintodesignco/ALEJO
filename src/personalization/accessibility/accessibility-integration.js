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
import { publish, subscribe } from '../../core/events.js';
import { showAccessibilityPanel } from './accessibility-settings-panel.js';
import { toggleFeature, getFeatureStatus } from './adaptive-feature-manager.js';
import { registerCommand as registerGestureCommand } from '../../gesture/commands.js';

// Import voice recognition if available
let voiceRecognition;
try {
  voiceRecognition = require('../../personalization/voice/recognition.js');
} catch (error) {
  console.warn('Voice recognition module not available, voice commands for accessibility will be limited');
}

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
     * Register accessibility-related voice commands
     */
    registerVoiceCommands() {
        console.log('Registering accessibility voice commands');
        
        if (!voiceRecognition) {
            console.warn('Voice recognition not available, skipping voice command registration');
            return false;
        }
        
        // Register voice commands for accessibility features
        subscribe('voice:command:detected', (event) => {
            const command = event.command.toLowerCase();
            
            // Screen reader commands
            if (command === 'enable screen reader' || command === 'turn on screen reader') {
                toggleFeature('screenReader', true);
                publish('accessibility:announcement', { message: 'Screen reader enabled' });
            } else if (command === 'disable screen reader' || command === 'turn off screen reader') {
                toggleFeature('screenReader', false);
                publish('accessibility:announcement', { message: 'Screen reader disabled' });
            }
            
            // High contrast commands
            else if (command === 'enable high contrast' || command === 'turn on high contrast') {
                toggleFeature('highContrast', true);
                publish('accessibility:announcement', { message: 'High contrast mode enabled' });
            } else if (command === 'disable high contrast' || command === 'turn off high contrast') {
                toggleFeature('highContrast', false);
                publish('accessibility:announcement', { message: 'High contrast mode disabled' });
            }
            
            // Text zoom commands
            else if (command === 'increase text size' || command === 'larger text') {
                toggleFeature('textZoom', true);
                publish('accessibility:announcement', { message: 'Text size increased' });
            } else if (command === 'decrease text size' || command === 'smaller text') {
                toggleFeature('textZoom', false);
                publish('accessibility:announcement', { message: 'Text size decreased' });
            }
            
            // Settings panel commands
            else if (command === 'open accessibility settings' || command === 'show accessibility options') {
                showAccessibilityPanel();
                publish('accessibility:announcement', { message: 'Accessibility settings panel opened' });
            }
        });
        
        return true;
    }
    
    /**
     * Register accessibility-related gesture commands
     */
    registerGestureCommands() {
        console.log('Registering accessibility gesture commands');
        
        // Define gesture constants if not already defined
        const GESTURES = {
            OPEN_HAND: 'open_hand',
            CLOSED_FIST: 'closed_fist',
            POINTING: 'pointing',
            VICTORY: 'victory',
            THUMBS_UP: 'thumbs_up',
            WAVE: 'wave',
            TRIPLE_TAP: 'triple_tap'
        };
        
        // Register accessibility-specific gesture commands
        
        // Triple tap to open accessibility panel (works in any context)
        registerGestureCommand('default', GESTURES.TRIPLE_TAP, () => {
            showAccessibilityPanel();
            publish('accessibility:announcement', { 
                message: 'Accessibility settings panel opened via gesture',
                source: 'gesture'
            });
        });
        
        // In accessibility context, use thumbs up to toggle screen reader
        registerGestureCommand('accessibility', GESTURES.THUMBS_UP, () => {
            const currentStatus = getFeatureStatus('screenReader');
            toggleFeature('screenReader', !currentStatus);
            publish('accessibility:announcement', { 
                message: currentStatus ? 'Screen reader disabled' : 'Screen reader enabled',
                source: 'gesture'
            });
        });
        
        // In accessibility context, use victory gesture to toggle high contrast
        registerGestureCommand('accessibility', GESTURES.VICTORY, () => {
            const currentStatus = getFeatureStatus('highContrast');
            toggleFeature('highContrast', !currentStatus);
            publish('accessibility:announcement', { 
                message: currentStatus ? 'High contrast mode disabled' : 'High contrast mode enabled',
                source: 'gesture'
            });
        });
        
        // In accessibility context, use pointing to toggle text zoom
        registerGestureCommand('accessibility', GESTURES.POINTING, () => {
            const currentStatus = getFeatureStatus('textZoom');
            toggleFeature('textZoom', !currentStatus);
            publish('accessibility:announcement', { 
                message: currentStatus ? 'Text zoom disabled' : 'Text zoom enabled',
                source: 'gesture'
            });
        });
        
        // Listen for gesture detection events
        subscribe('gesture:detected', (event) => {
            // Handle special gesture sequences for accessibility
            if (event.sequence && event.sequence === 'triple_tap') {
                showAccessibilityPanel();
                publish('accessibility:announcement', { 
                    message: 'Accessibility settings panel opened via gesture sequence',
                    source: 'gesture'
                });
            }
        });
        
        try {
            // Register each gesture command from the class if available
            for (const [gesture, handler] of Object.entries(this.gestureCommands || {})) {
                if (window.gestureSystem && typeof window.gestureSystem.registerGestureHandler === 'function') {
                    window.gestureSystem.registerGestureHandler(gesture, handler);
                }
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
