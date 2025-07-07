/**
 * ALEJO Accessibility Integration
 * 
 * This module integrates the adaptive accessibility system with ALEJO's core components,
 * including voice and gesture systems. It's designed to be robust with fallback mechanisms
 * and to work with the centralized error handling and initialization system.
 * 
 * It provides:
 * 1. Accessibility-specific voice commands
 * 2. Accessibility-specific gesture commands
 * 3. Integration with the notification system for accessibility alerts
 * 4. Accessibility hooks for the UI rendering system
 * 5. Integration with the Resource Allocation Manager for optimized performance
 * 6. Graceful degradation when components are unavailable
 * 7. High-priority initialization for accessibility features
 */

import { initializeAccessibilitySystem, adaptiveFeatureManager } from './index.js';
import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';
import { publish, subscribe } from '../../core/events.js';
import { showAccessibilityPanel } from './accessibility-settings-panel.js';
import { toggleFeature, getFeatureStatus } from './adaptive-feature-manager.js';
import { registerCommand as registerGestureCommand } from '../../gesture/commands.js';
import { registerWithResourceManager, unregisterFromResourceManager, getCurrentResourceMode } from './performance-integration.js';
import { RESOURCE_MODES } from '../../performance/index.js';

// Import error handling utilities if available
let logError, ErrorSeverity;
try {
  ({ logError, ErrorSeverity } = require('../../core/system/error-handler.js'));
} catch (error) {
  // Fallback error logging if the error handler isn't available
  logError = (source, error, severity) => {
    console.error(`[${severity}] ${source}:`, error);
    if (auditTrail && auditTrail.log) {
      auditTrail.log('error', `Accessibility error: ${error.message}`, { source, severity });
    }
  };
  ErrorSeverity = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO'
  };
}

// Import voice recognition if available
let voiceRecognition;
try {
  voiceRecognition = require('../../personalization/voice/recognition.js');
} catch (error) {
  logError('accessibility:voice', new Error('Voice recognition module not available, voice commands for accessibility will be limited'), ErrorSeverity.MEDIUM);
}

class AccessibilityIntegration {
    constructor() {
        this.initialized = false;
        this.voiceCommandsRegistered = false;
        this.gestureCommandsRegistered = false;
        this.resourceManagementRegistered = false;
        this.currentResourceMode = null;
        
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
     * @returns {Promise<Object>} The initialized accessibility integration instance or error
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return this;
        }
        
        try {
            // Initialize the core accessibility system with robust error handling
            const accessibilityInitialized = await this._initializeWithRetry({
                ...options,
                showWelcomeMessage: options.showWelcomeMessage !== false
            });
            
            if (!accessibilityInitialized) {
                throw new Error('Failed to initialize accessibility system after multiple attempts');
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Register accessibility voice commands if voice system is available
            await this._safeExecute(
                () => this.registerVoiceCommands(),
                'Failed to register voice commands',
                ErrorSeverity.MEDIUM,
                true // Continue even if this fails
            );
            
            // Register accessibility gesture commands if gesture system is available
            await this._safeExecute(
                () => this.registerGestureCommands(),
                'Failed to register gesture commands',
                ErrorSeverity.MEDIUM,
                true // Continue even if this fails
            );
            
            // Inject accessibility hooks into the UI
            await this._safeExecute(
                () => this.injectUIHooks(),
                'Failed to inject UI hooks',
                ErrorSeverity.HIGH,
                true // Continue even if this fails
            );
            
            // Register with Resource Allocation Manager with high priority
            await this._safeExecute(
                () => this.registerWithResourceManager(options),
                'Failed to register with Resource Allocation Manager',
                ErrorSeverity.MEDIUM,
                true // Continue even if this fails
            );
            
            this.initialized = true;
            
            // Publish initialization success event
            publish('accessibility:initialized', { success: true, timestamp: Date.now() });
            
            // Return the initialized instance for the initialization manager
            return this;
        } catch (error) {
            logError('accessibility:initialization', error, ErrorSeverity.CRITICAL);
            
            // Attempt to initialize minimal accessibility features
            await this._initializeMinimalFeatures();
            
            // Publish initialization failure event
            publish('accessibility:initialization:failed', { error: error.message, timestamp: Date.now() });
            
            // Re-throw the error for the initialization manager to handle
            throw error;
        }
    }
    
    /**
     * Clean up and release resources
     */
    cleanup() {
        if (!this.initialized) {
            return;
        }
        
        // Unregister event listeners
        eventEmitter.off('accessibility:feature:toggle', this.handleFeatureToggle);
        eventEmitter.off('accessibility:status:request', this.announceAccessibilityStatus);
        
        // Unregister voice commands if registered
        if (this.voiceCommandsRegistered && voiceRecognition) {
            Object.keys(this.voiceCommands).forEach(command => {
                voiceRecognition.unregisterCommand(command);
            });
            this.voiceCommandsRegistered = false;
        }
        
        // Unregister gesture commands if registered
        if (this.gestureCommandsRegistered) {
            Object.keys(this.gestureCommands).forEach(gesture => {
                // Assuming there's an unregister method for gestures
                try {
                    registerGestureCommand(gesture, null); // Pass null to unregister
                } catch (error) {
                    console.warn(`Failed to unregister gesture command: ${gesture}`, error);
                }
            });
            this.gestureCommandsRegistered = false;
        }
        
        // Unregister from Resource Allocation Manager
        this.unregisterFromResourceManager();
        
        this.initialized = false;
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
     * Inject accessibility hooks into the UI rendering system
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
            
            // Subscribe to resource mode changes to adapt accessibility features
            subscribe('resource:mode_changed', this.handleResourceModeChange.bind(this));
            
            // Example: Add ARIA attributes to dynamic elements
            document.addEventListener('DOMNodeInserted', (event) => {
                // Process newly inserted nodes for accessibility
                this.processNodeForAccessibility(event.target);
            });
            
            return true;
        } catch (error) {
            console.error('Failed to inject accessibility UI hooks:', error);
            return false;
        }
    }
    
    /**
     * Register accessibility components with the Resource Allocation Manager
     * @param {Object} options Configuration options
     * @private
     */
    registerWithResourceManager(options = {}) {
        if (this.resourceManagementRegistered) {
            return;
        }
        
        try {
            // Register with the resource manager
            registerWithResourceManager({
                options,
                onResourceModeChange: this.handleResourceModeChange.bind(this),
                onPause: this.handleResourcePause.bind(this),
                onResume: this.handleResourceResume.bind(this)
            });
            
            this.resourceManagementRegistered = true;
            
            // Log registration for audit trail
            auditTrail.log({
                action: 'accessibility:resource_management:register',
                category: 'performance',
                details: {
                    timestamp: new Date().toISOString(),
                    options,
                }
            });

            console.log('Accessibility features registered with Resource Allocation Manager');
        } catch (error) {
            console.error('Failed to register accessibility features with Resource Allocation Manager:', error);
        }
    }
    
    /**
     * Unregister accessibility components from the Resource Allocation Manager
     * @private
     */
    unregisterFromResourceManager() {
        if (!this.resourceManagementRegistered) {
            return;
        }
        
        try {
            unregisterFromResourceManager();
            this.resourceManagementRegistered = false;
            
            // Log unregistration for audit trail
            auditTrail.log({
                action: 'accessibility:resource_management:unregister',
                category: 'performance',
                details: {
                    timestamp: new Date().toISOString()
                }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to unregister accessibility from resource manager:', error);
            return false;
        }
    }
    
    /**
     * Handle resource mode changes from the Resource Allocation Manager
     * @param {Object} data Resource mode change data
     * @private
     */
    handleResourceModeChange(event) {
        const { mode, reason } = event;
        this.currentResourceMode = mode;
        
        console.log(`Accessibility adapting to resource mode: ${mode}`);

        // Update UI status bar
        this.updateStatusBar({
            mode,
            reason,
            timestamp: new Date().toISOString()
        });

        // The actual feature configuration is now handled in the performance-integration.js file
        // This method now just handles UI updates and any accessibility-specific adjustments
    }
    
    /**
     * Adapt features for normal resource mode - enable all features
     * @private
     */
    adaptFeaturesForNormalMode() {
        // Enable all accessibility features at full quality
        // No restrictions in normal mode
    }
    
    /**
     * Adapt features for reduced resource mode
     * @private
     */
    adaptFeaturesForReducedMode() {
        // Reduce quality of non-essential features
        // For example, reduce frequency of non-critical updates
        
        // Reduce animation complexity if enabled
        if (getFeatureStatus('reducedMotion')) {
            publish('accessibility:feature:update', {
                feature: 'reducedMotion',
                settings: { complexity: 'minimal' }
            });
        }
    }
    
    /**
     * Adapt features for minimal resource mode
     * @private
     */
    adaptFeaturesForMinimalMode() {
        // Disable non-essential features
        // Keep essential features for users with disabilities
        
        // For example, disable advanced visual effects but keep screen reader
        if (getFeatureStatus('highContrast')) {
            publish('accessibility:feature:update', {
                feature: 'highContrast',
                settings: { quality: 'basic' }
            });
        }
    }
    
    /**
     * Adapt features for critical resource mode
     * @private
     */
    adaptFeaturesForCriticalMode() {
        // Keep only critical accessibility features
        // Disable everything else
        
        // Example: Keep only screen reader and keyboard navigation
        // Disable all visual enhancements
        
        // Announce critical mode to user
        publish('accessibility:announcement', {
            message: 'System in critical resource mode. Some accessibility features may be limited.',
            priority: 'high',
            source: 'system'
        });
    }
            
    /**
     * Update status bar with accessibility status
     * @private
     */
    updateStatusBar() {
        if (window.alejoUI && window.alejoUI.setStatusItem) {
            window.alejoUI.setStatusItem({
                id: 'accessibility-status',
                icon: 'accessibility',
                tooltip: 'Accessibility features active',
                onClick: () => this.showAccessibilityPanel(),
                visible: this.hasEnabledFeatures()
            });
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
    _setBasicAriaAttributes() {
        // Add basic ARIA landmarks
        const main = document.querySelector('main');
        if (main) main.setAttribute('role', 'main');
        
        const header = document.querySelector('header');
        if (header) header.setAttribute('role', 'banner');
        
        const footer = document.querySelector('footer');
        if (footer) footer.setAttribute('role', 'contentinfo');
        
        const nav = document.querySelector('nav');
        if (nav) nav.setAttribute('role', 'navigation');
        
        // Add basic button accessibility
        const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
        buttons.forEach(button => {
            if (!button.textContent.trim()) {
                button.setAttribute('aria-label', 'Button');
            }
        });
    }
    
    /**
     * Handle keyboard navigation in fallback mode
     * @private
     * @param {KeyboardEvent} event Keyboard event
     */
    _handleKeyboardNavigation(event) {
        // Basic keyboard navigation for fallback mode
        if (event.key === 'Tab') {
            // Ensure focus is visible
            document.body.classList.add('keyboard-navigation');
        } else if (event.key === 'Escape') {
            // Close any open dialogs or panels
            const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
            dialogs.forEach(dialog => {
                if (dialog.getAttribute('aria-hidden') !== 'true') {
                    dialog.setAttribute('aria-hidden', 'true');
                    dialog.style.display = 'none';
                }
            });
        }
    }
}

// Create singleton instance
const accessibilityIntegration = new AccessibilityIntegration();

/**
 * Create a fallback implementation of the accessibility integration
 * Used when the main implementation fails to initialize
 * @returns {Object} A simplified accessibility integration with the same interface
 */
function createFallbackAccessibilityIntegration() {
    return {
        initialized: false,
        voiceCommandsRegistered: false,
        gestureCommandsRegistered: false,
        resourceManagementRegistered: false,
        
        // Core methods with minimal implementation
        initialize: async () => {
            console.log('Using fallback accessibility integration');
            
            // Set basic ARIA attributes
            const announcer = document.createElement('div');
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.classList.add('sr-only');
            announcer.id = 'accessibility-announcer';
            document.body.appendChild(announcer);
            
            // Add basic keyboard handler
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Tab') {
                    document.body.classList.add('keyboard-navigation');
                }
            });
            
            return Promise.resolve();
        },
        
        cleanup: () => {},
        
        // Feature management
        toggleFeature: (featureId, enable) => {
            console.log(`Fallback: Toggle feature ${featureId} to ${enable}`);
            return true;
        },
        
        getFeatureStatus: (featureId) => {
            return false; // Default to disabled in fallback mode
        },
        
        // UI methods
        showAccessibilityPanel: () => {
            console.log('Fallback: Accessibility panel not available in fallback mode');
            return false;
        },
        
        announce: (message, priority = 'polite') => {
            const announcer = document.getElementById('accessibility-announcer');
            if (announcer) {
                announcer.textContent = message;
            }
            console.log(`Accessibility announcement (${priority}): ${message}`);
        },
        
        // Status methods
        getAccessibilityStatus: () => ({
            features: {},
            active: false,
            fallbackMode: true
        })
    };
}

// Export instance and fallback
export { accessibilityIntegration as default, createFallbackAccessibilityIntegration };
