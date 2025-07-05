/**
 * ALEJO Adaptive Accessibility System
 * 
 * This module provides a comprehensive, intelligent accessibility system that:
 * 1. Automatically detects user accessibility needs
 * 2. Adapts the interface based on detected needs
 * 3. Respects user preferences and explicit settings
 * 4. Provides voice and gesture commands for accessibility control
 * 5. Maintains a user-friendly settings interface
 * 
 * The system follows these key principles:
 * - Privacy-first: All detection happens locally on the device
 * - User agency: Users have final control over all adaptations
 * - Progressive enhancement: Features are enabled only as needed
 * - Graceful degradation: Core functionality works even without advanced features
 */

import { adaptiveFeatureManager } from './adaptive-feature-manager.js';
import { accessibilitySettingsPanel } from './accessibility-settings-panel.js';
import { eventEmitter } from '../../core/event-emitter.js';
import { auditTrail } from '../../security/audit-trail.js';

/**
 * Initialize the adaptive accessibility system
 * 
 * @param {Object} options Configuration options
 * @param {boolean} [options.autoDetect=true] Whether to enable automatic detection
 * @param {boolean} [options.showWelcomeMessage=true] Whether to show an initial welcome message
 * @param {Object} [options.detectionThresholds] Custom thresholds for detection sensitivity
 * @returns {Promise<boolean>} Success status
 */
async function initializeAccessibilitySystem(options = {}) {
    try {
        // Default options
        const defaultOptions = {
            autoDetect: true,
            showWelcomeMessage: true,
            detectionThresholds: {
                vision: 0.7,
                hearing: 0.7,
                motor: 0.7,
                cognitive: 0.7
            }
        };
        
        // Merge with provided options
        const finalOptions = { ...defaultOptions, ...options };
        
        // Initialize the feature manager
        const featureManagerInitialized = await adaptiveFeatureManager.initialize({
            autoDetection: finalOptions.autoDetect,
            thresholds: finalOptions.detectionThresholds
        });
        
        // Initialize the settings panel (but don't show it yet)
        const panelInitialized = await accessibilitySettingsPanel.initialize();
        
        // Register keyboard shortcut to open settings panel
        document.addEventListener('keydown', (event) => {
            // Alt + A to open accessibility settings
            if (event.altKey && event.key === 'a') {
                accessibilitySettingsPanel.showPanel();
                event.preventDefault();
            }
        });
        
        // Show welcome message if enabled
        if (finalOptions.showWelcomeMessage && featureManagerInitialized) {
            showAccessibilityWelcomeMessage();
        }
        
        // Emit initialization event
        eventEmitter.emit('accessibility:system:initialized', {
            success: featureManagerInitialized && panelInitialized
        });
        
        // Log initialization
        auditTrail.log('accessibility', 'Accessibility system initialized', {
            autoDetection: finalOptions.autoDetect
        });
        
        return featureManagerInitialized && panelInitialized;
    } catch (error) {
        console.error('Failed to initialize accessibility system:', error);
        auditTrail.log('error', 'Failed to initialize accessibility system', {
            error: error.message
        });
        return false;
    }
}

/**
 * Display a welcome message with accessibility information
 * @private
 */
function showAccessibilityWelcomeMessage() {
    // Create notification content
    const message = 'ALEJO can adapt to your accessibility needs. Use Alt+A to open accessibility settings.';
    
    // Emit notification event
    eventEmitter.emit('notification:show', {
        message,
        title: 'Accessibility Features Available',
        duration: 10000,
        type: 'accessibility',
        actions: [
            {
                label: 'Open Settings',
                action: () => accessibilitySettingsPanel.showPanel()
            },
            {
                label: 'Learn More',
                action: 'openAccessibilityHelp'
            }
        ]
    });
    
    // Also announce for screen readers
    const announcer = document.getElementById('alejo-screen-reader-announcer') || 
        document.createElement('div');
    
    if (!announcer.id) {
        announcer.id = 'alejo-screen-reader-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.position = 'absolute';
        announcer.style.width = '1px';
        announcer.style.height = '1px';
        announcer.style.margin = '-1px';
        announcer.style.padding = '0';
        announcer.style.overflow = 'hidden';
        announcer.style.clip = 'rect(0, 0, 0, 0)';
        announcer.style.whiteSpace = 'nowrap';
        announcer.style.border = '0';
        document.body.appendChild(announcer);
    }
    
    // Announce after a short delay to ensure screen readers catch it
    setTimeout(() => {
        announcer.textContent = 'ALEJO has accessibility features. Press Alt plus A to open settings.';
    }, 1000);
}

/**
 * Show the accessibility settings panel
 */
function showAccessibilitySettings() {
    accessibilitySettingsPanel.showPanel();
}

/**
 * Get the current status of all accessibility features
 * @returns {Object} Feature status object
 */
function getAccessibilityStatus() {
    return adaptiveFeatureManager.getFeatureStatus();
}

/**
 * Toggle a specific accessibility feature
 * @param {string} featureId - ID of the feature to toggle
 * @param {boolean} [state] - Optional explicit state, otherwise toggles current state
 * @returns {boolean} - New state of the feature
 */
function toggleAccessibilityFeature(featureId, state) {
    return adaptiveFeatureManager.toggleFeature(featureId, state, true);
}

/**
 * Reset all accessibility features to default settings
 * @returns {boolean} - Success status
 */
function resetAccessibilityFeatures() {
    return adaptiveFeatureManager.resetToDefaults();
}

// Export public API
export {
    initializeAccessibilitySystem,
    showAccessibilitySettings,
    getAccessibilityStatus,
    toggleAccessibilityFeature,
    resetAccessibilityFeatures,
    adaptiveFeatureManager,
    accessibilitySettingsPanel
};
