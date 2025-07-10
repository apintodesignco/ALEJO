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

import { EventBus } from '../../core/events/event-bus.js';
import { Logger } from '../../core/logger/logger.js';

// Accessibility Core Components
import { AriaManager } from './aria-manager.js';
import { AriaEnhancer } from './aria-enhancer.js';
import { KeyboardNavigationManager } from './keyboard-navigation.js';
import { VisualAdaptationsManager } from './visual-adaptations.js';
import { AccessibilityPanel } from './accessibility-panel.js';

// Legacy Components (for backward compatibility)
import { adaptiveFeatureManager } from './adaptive-feature-manager.js';
import { accessibilitySettingsPanel } from './accessibility-settings-panel.js';
import { fontScalingManager } from './font-scaling-manager.js';
import { highContrastManager } from './high-contrast-manager.js';
import { colorBlindnessManager } from './color-blindness-manager.js';
import { screenReaderManager } from './screen-reader-manager.js';

/**
 * Initialize the adaptive accessibility system
 * 
 * @param {Object} options Configuration options
 * @param {boolean} [options.autoDetect=true] Whether to enable automatic detection
 * @param {boolean} [options.showWelcomeMessage=true] Whether to show an initial welcome message
 * @param {boolean} [options.enableKeyboardNavigation=true] Whether to enable enhanced keyboard navigation
 * @param {boolean} [options.enhanceAriaAttributes=true] Whether to auto-enhance ARIA attributes
 * @param {Object} [options.detectionThresholds] Custom thresholds for detection sensitivity
 * @returns {Promise<boolean>} Success status
 */
async function initializeAccessibilitySystem(options = {}) {
    try {
        // Set up logging
        const logger = new Logger('AccessibilitySystem');
        logger.info('Initializing accessibility system...');
        
        // Get event bus
        const eventBus = EventBus.getInstance();
        
        // Default options
        const defaultOptions = {
            autoDetect: true,
            showWelcomeMessage: true,
            enableKeyboardNavigation: true,
            enhanceAriaAttributes: true,
            detectionThresholds: {
                vision: 0.7,
                hearing: 0.7,
                motor: 0.7,
                cognitive: 0.7
            }
        };
        
        // Merge with provided options
        const finalOptions = { ...defaultOptions, ...options };
        
        // Initialize core accessibility components
        logger.info('Initializing ARIA Manager...');
        const ariaInitialized = await AriaManager.initialize({
            announceInitialization: false
        }).catch(error => {
            logger.error('ARIA Manager initialization failed', error);
            return false;
        });
        
        // Initialize ARIA Enhancer if enabled
        let ariaEnhancerInitialized = false;
        if (finalOptions.enhanceAriaAttributes && ariaInitialized) {
            logger.info('Initializing ARIA Enhancer...');
            ariaEnhancerInitialized = await AriaEnhancer.initialize({
                autoEnhance: true,
                watchDomChanges: true
            }).catch(error => {
                logger.error('ARIA Enhancer initialization failed', error);
                return false;
            });
        }
        
        // Initialize Keyboard Navigation if enabled
        let keyboardNavInitialized = false;
        if (finalOptions.enableKeyboardNavigation) {
            logger.info('Initializing Keyboard Navigation Manager...');
            keyboardNavInitialized = await KeyboardNavigationManager.initialize({
                createSkipLinks: true
            }).catch(error => {
                logger.error('Keyboard Navigation initialization failed', error);
                return false;
            });
        }
        
        // Initialize Visual Adaptations Manager
        logger.info('Initializing Visual Adaptations Manager...');
        const visualAdaptationsInitialized = await VisualAdaptationsManager.initialize({
            detectOsSettings: finalOptions.autoDetect,
            applyImmediately: false // Will apply after loading user preferences
        }).catch(error => {
            logger.error('Visual Adaptations initialization failed', error);
            return false;
        });
        
        // Initialize the Accessibility Settings Panel
        logger.info('Initializing Accessibility Panel...');
        const accessibilityPanelInitialized = await AccessibilityPanel.initialize({
            keyboardShortcut: true
        }).catch(error => {
            logger.error('Accessibility Panel initialization failed', error);
            return false;
        });
        
        // Legacy components initialization (for backward compatibility)
        // Initialize the feature manager
        const featureManagerInitialized = await adaptiveFeatureManager.initialize({
            autoDetection: finalOptions.autoDetect,
            thresholds: finalOptions.detectionThresholds
        }).catch(() => false);
        
        // Initialize the legacy settings panel (but don't show it)
        const legacyPanelInitialized = await accessibilitySettingsPanel.initialize()
            .catch(() => false);
        
        // Initialize font scaling manager
        const fontScalingInitialized = await fontScalingManager.initialize({
            applyImmediately: false // Visual adaptations will handle this
        }).catch(() => false);
        
        // Initialize high contrast manager if it exists
        const highContrastInitialized = await highContrastManager.initialize({
            applyImmediately: false // Visual adaptations will handle this
        }).catch(() => false);
        
        // Initialize color blindness manager
        const colorBlindnessInitialized = await colorBlindnessManager.initialize({
            detectSystemPreference: false, // Visual adaptations will handle this
            applyImmediately: false
        }).catch(() => false);
        
        // Initialize screen reader manager
        const screenReaderInitialized = await screenReaderManager.initialize({ 
            detectScreenReader: finalOptions.autoDetect,
            enableResourceManagement: true
        }).catch(() => false);
        
        // Apply visual adaptations after all components are initialized
        if (visualAdaptationsInitialized) {
            await VisualAdaptationsManager.applyAllAdaptations();
        }
        
        // Combine initialization status for core components
        const coreInitialized = ariaInitialized && 
                              visualAdaptationsInitialized && 
                              accessibilityPanelInitialized;
        
        // Combine initialization status for legacy components
        const legacyInitialized = fontScalingInitialized || 
                                 highContrastInitialized || 
                                 colorBlindnessInitialized || 
                                 screenReaderInitialized;
        
        // Combined overall status
        const combinedInitializationStatus = coreInitialized || legacyInitialized;
        
        // Show welcome message if enabled
        if (finalOptions.showWelcomeMessage && combinedInitializationStatus) {
            showAccessibilityWelcomeMessage();
        }
        
        // Emit initialization event
        eventEmitter.emit('accessibility:system:initialized', {
            success: combinedInitializationStatus && panelInitialized,
            components: {
                fontScaling: fontScalingInitialized,
                highContrast: highContrastInitialized,
                colorBlindness: colorBlindnessInitialized,
                screenReader: screenReaderInitialized
            }
        });
        
        // Log initialization
        auditTrail.log('accessibility', 'Accessibility system initialized', {
            autoDetection: finalOptions.autoDetect
        });
        
        return combinedInitializationStatus && panelInitialized;
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
 * @returns {boolean} Success status
 */
function showAccessibilitySettings() {
    try {
        // Try modern panel first
        if (AccessibilityPanel && AccessibilityPanel.initialized) {
            AccessibilityPanel.show();
            return true;
        }
        
        // Fall back to legacy panel
        accessibilitySettingsPanel.showPanel();
        return true;
    } catch (error) {
        console.error('Failed to show accessibility settings', error);
        return false;
    }
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
    
    // Export component instances for direct access
    AriaManager,
    AriaEnhancer,
    KeyboardNavigationManager,
    VisualAdaptationsManager,
    AccessibilityPanel,
    
    // Export individual feature managers for direct access
    fontScalingManager,
    highContrastManager,
    colorBlindnessManager,
    screenReaderManager
};
