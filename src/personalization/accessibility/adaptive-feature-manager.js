/**
 * ALEJO Adaptive Accessibility Feature Manager
 * 
 * This module provides intelligent adaptation of accessibility features based on:
 * 1. Automatic detection of user needs
 * 2. User preferences and explicit settings
 * 3. Environmental context
 * 
 * Features can be toggled via direct settings, voice commands, or gesture commands,
 * and ALEJO will learn from user interactions to optimize the experience.
 */

import { auditTrail } from '../../security/audit-trail.js';
import { consentManager } from '../../security/consent-manager.js';
import { rbacMiddleware } from '../../security/rbac-middleware.js';
import { hearingImpairmentDetection } from '../hearing/hearing-impairment-detection.js';
import { visualImpairmentDetection } from '../vision/visual-impairment-detection.js';
import { motorImpairmentDetection } from '../motor/motor-impairment-detection.js';
import { cognitiveImpairmentDetection } from '../cognitive/cognitive-impairment-detection.js';
import { localStorageManager } from '../../utils/local-storage-manager.js';
import { eventEmitter } from '../../core/event-emitter.js';

class AdaptiveFeatureManager {
    constructor() {
        this.initialized = false;
        this.featureModules = {
            // Vision modules
            screenReader: { enabled: false, autoDetected: false, category: 'vision', priority: 'high' },
            highContrast: { enabled: false, autoDetected: false, category: 'vision', priority: 'medium' },
            textZoom: { enabled: false, autoDetected: false, category: 'vision', priority: 'medium' },
            reduceMotion: { enabled: false, autoDetected: false, category: 'vision', priority: 'medium' },
            colorBlindMode: { enabled: false, autoDetected: false, category: 'vision', priority: 'medium' },
            cursorEnhancement: { enabled: false, autoDetected: false, category: 'vision', priority: 'low' },

            // Hearing modules
            visualAlerts: { enabled: false, autoDetected: false, category: 'hearing', priority: 'high' },
            captions: { enabled: false, autoDetected: false, category: 'hearing', priority: 'high' },
            visualMetronome: { enabled: false, autoDetected: false, category: 'hearing', priority: 'medium' },
            vibrationFeedback: { enabled: false, autoDetected: false, category: 'hearing', priority: 'medium' },
            audioVisualization: { enabled: false, autoDetected: false, category: 'hearing', priority: 'medium' },
            signLanguage: { enabled: false, autoDetected: false, category: 'hearing', priority: 'high' },

            // Motor modules
            voiceControl: { enabled: false, autoDetected: false, category: 'motor', priority: 'high' },
            dwellClicking: { enabled: false, autoDetected: false, category: 'motor', priority: 'medium' },
            gestureSimplification: { enabled: false, autoDetected: false, category: 'motor', priority: 'medium' },
            adaptiveInputTiming: { enabled: false, autoDetected: false, category: 'motor', priority: 'medium' },
            
            // Cognitive modules
            simplifiedInterface: { enabled: false, autoDetected: false, category: 'cognitive', priority: 'high' },
            readingAssistance: { enabled: false, autoDetected: false, category: 'cognitive', priority: 'medium' },
            focusMode: { enabled: false, autoDetected: false, category: 'cognitive', priority: 'medium' },
            reminderSystem: { enabled: false, autoDetected: false, category: 'cognitive', priority: 'medium' }
        };
        
        this.detectionModules = {
            vision: visualImpairmentDetection,
            hearing: hearingImpairmentDetection,
            motor: motorImpairmentDetection,
            cognitive: cognitiveImpairmentDetection
        };
        
        // Commands mapping for voice and gesture control
        this.commands = {
            'enable screen reader': () => this.toggleFeature('screenReader', true),
            'disable screen reader': () => this.toggleFeature('screenReader', false),
            'turn on captions': () => this.toggleFeature('captions', true),
            'turn off captions': () => this.toggleFeature('captions', false),
            'enable high contrast': () => this.toggleFeature('highContrast', true),
            'disable high contrast': () => this.toggleFeature('highContrast', false),
            'enable voice control': () => this.toggleFeature('voiceControl', true),
            'disable voice control': () => this.toggleFeature('voiceControl', false),
            'toggle sign language': () => this.toggleFeature('signLanguage'),
            'toggle vibration': () => this.toggleFeature('vibrationFeedback'),
            'reset accessibility': () => this.resetToDefaults(),
            'accessibility status': () => this.announceStatus()
        };

        // Gesture commands map (will be populated during initialization)
        this.gestureCommands = {};

        // Detection confidence thresholds
        this.detectionThresholds = {
            vision: 0.7,
            hearing: 0.7,
            motor: 0.7,
            cognitive: 0.7
        };

        // For tracking automatic feature changes
        this.recentChanges = [];
        
        // Feature relationships (enabling one might disable or enable others)
        this.featureRelationships = {
            screenReader: {
                enableWith: ['cursorEnhancement'],
                disableWith: ['highContrast']
            },
            signLanguage: {
                enableWith: ['captions'],
                disableWith: []
            }
            // Additional relationships to be defined
        };

        this.autoDetectionEnabled = true;
        this.userOverrides = {};
    }

    /**
     * Initialize the adaptive feature manager
     * @param {Object} options - Initialization options
     * @returns {Promise<boolean>} - Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }
        
        try {
            // Check for consent before initializing detection modules
            const hasConsent = await consentManager.checkConsent('accessibility_features');
            
            if (!hasConsent) {
                console.log('User consent for accessibility detection not granted. Using default settings only.');
                this.autoDetectionEnabled = false;
            }
            
            // Load saved preferences
            await this.loadSavedPreferences();

            // Initialize detection modules if consent granted
            if (hasConsent) {
                for (const [category, module] of Object.entries(this.detectionModules)) {
                    if (module && typeof module.initialize === 'function') {
                        await module.initialize();
                    }
                }
                
                // Run initial detection if auto-detection enabled
                if (this.autoDetectionEnabled) {
                    await this.runAccessibilityDetection();
                }
            }

            // Setup event listeners
            this.setupEventListeners();
            
            // Register voice and gesture commands
            this.registerCommands();
            
            this.initialized = true;
            auditTrail.log('accessibility', 'Adaptive feature manager initialized', { autoDetection: this.autoDetectionEnabled });
            eventEmitter.emit('accessibility:manager:initialized', { success: true });
            
            return true;
        } catch (error) {
            auditTrail.log('error', 'Failed to initialize adaptive feature manager', { error: error.message });
            eventEmitter.emit('accessibility:manager:error', { error: error.message });
            console.error('Failed to initialize adaptive feature manager:', error);
            return false;
        }
    }

    /**
     * Load user preferences from secure storage
     * @private
     */
    async loadSavedPreferences() {
        try {
            const savedPrefs = await localStorageManager.getItem('accessibility_preferences');
            
            if (savedPrefs) {
                const prefs = JSON.parse(savedPrefs);
                
                // Apply saved feature settings
                if (prefs.features) {
                    for (const [featureId, settings] of Object.entries(prefs.features)) {
                        if (this.featureModules[featureId]) {
                            this.featureModules[featureId].enabled = settings.enabled;
                            
                            // Track user overrides
                            if (settings.userOverride) {
                                this.userOverrides[featureId] = settings.userOverride;
                            }
                        }
                    }
                }
                
                // Apply detection settings
                if (prefs.autoDetection !== undefined) {
                    this.autoDetectionEnabled = prefs.autoDetection;
                }
                
                // Apply detection thresholds
                if (prefs.thresholds) {
                    this.detectionThresholds = {...this.detectionThresholds, ...prefs.thresholds};
                }
            }
        } catch (error) {
            console.error('Failed to load accessibility preferences:', error);
        }
    }

    /**
     * Save current preferences to secure storage
     * @private
     */
    async savePreferences() {
        try {
            const prefsToSave = {
                features: {},
                autoDetection: this.autoDetectionEnabled,
                thresholds: this.detectionThresholds,
                lastUpdated: new Date().toISOString()
            };
            
            // Collect current feature settings
            for (const [featureId, settings] of Object.entries(this.featureModules)) {
                prefsToSave.features[featureId] = {
                    enabled: settings.enabled,
                    autoDetected: settings.autoDetected
                };
                
                // Include user overrides if any
                if (this.userOverrides[featureId]) {
                    prefsToSave.features[featureId].userOverride = this.userOverrides[featureId];
                }
            }
            
            await localStorageManager.setItem('accessibility_preferences', JSON.stringify(prefsToSave));
        } catch (error) {
            console.error('Failed to save accessibility preferences:', error);
        }
    }

    /**
     * Setup event listeners for various components
     * @private
     */
    setupEventListeners() {
        // Listen for detection events
        eventEmitter.on('accessibility:detection:vision', this.handleVisionDetection.bind(this));
        eventEmitter.on('accessibility:detection:hearing', this.handleHearingDetection.bind(this));
        eventEmitter.on('accessibility:detection:motor', this.handleMotorDetection.bind(this));
        eventEmitter.on('accessibility:detection:cognitive', this.handleCognitiveDetection.bind(this));
        
        // Listen for manual feature toggles from other components
        eventEmitter.on('accessibility:feature:toggle', this.handleFeatureToggleEvent.bind(this));
        
        // Listen for environmental changes
        eventEmitter.on('system:environment:change', this.handleEnvironmentChange.bind(this));
    }

    /**
     * Register voice and gesture commands
     * @private
     */
    registerCommands() {
        // Register voice commands if voice recognition is available
        if (window.voiceRecognition) {
            for (const [phrase, handler] of Object.entries(this.commands)) {
                window.voiceRecognition.registerCommand(phrase, handler);
            }
        }
        
        // Define gesture commands
        this.gestureCommands = {
            'swipe_up_two_fingers': () => this.toggleFeature('screenReader'),
            'swipe_left_two_fingers': () => this.toggleFeature('highContrast'),
            'swipe_right_two_fingers': () => this.toggleFeature('captions'),
            'swipe_down_two_fingers': () => this.toggleFeature('signLanguage'),
            'pinch_in': () => this.toggleFeature('textZoom', true),
            'pinch_out': () => this.toggleFeature('textZoom', false),
            'double_tap_three_fingers': this.announceStatus.bind(this)
        };
        
        // Register gesture commands if gesture system is available
        if (window.gestureSystem) {
            for (const [gesture, handler] of Object.entries(this.gestureCommands)) {
                window.gestureSystem.registerGestureHandler(gesture, handler);
            }
        }
    }

    /**
     * Run accessibility detection across all categories
     * @returns {Promise<Object>} - Detection results
     */
    async runAccessibilityDetection() {
        if (!this.autoDetectionEnabled) {
            return { disabled: true };
        }
        
        const results = {};
        
        try {
            // Check consent before running detection
            const hasConsent = await consentManager.checkConsent('accessibility_features');
            
            if (!hasConsent) {
                console.log('User consent for accessibility detection not granted.');
                return { noConsent: true };
            }
            
            // Run each detection module
            for (const [category, module] of Object.entries(this.detectionModules)) {
                if (module && typeof module.detectUserNeeds === 'function') {
                    results[category] = await module.detectUserNeeds();
                    this.processDetectionResults(category, results[category]);
                }
            }
            
            auditTrail.log('accessibility', 'Ran accessibility detection', { results });
            return results;
        } catch (error) {
            auditTrail.log('error', 'Error running accessibility detection', { error: error.message });
            console.error('Error running accessibility detection:', error);
            return { error: error.message };
        }
    }

    /**
     * Process detection results and update features accordingly
     * @param {string} category - Detection category (vision, hearing, etc.)
     * @param {Object} results - Detection results
     * @private
     */
    processDetectionResults(category, results) {
        if (!results || !results.detectedNeeds) {
            return;
        }
        
        const threshold = this.detectionThresholds[category] || 0.7;
        const detectedNeeds = results.detectedNeeds;
        
        // Map detected needs to features
        const categoryFeatures = Object.entries(this.featureModules)
            .filter(([_, settings]) => settings.category === category)
            .map(([featureId, _]) => featureId);
            
        for (const feature of categoryFeatures) {
            // Skip features that have user overrides
            if (this.userOverrides[feature]) {
                continue;
            }
            
            let shouldEnable = false;
            
            // Vision-specific detection mapping
            if (category === 'vision') {
                if (detectedNeeds.blind && detectedNeeds.blind.confidence > threshold) {
                    shouldEnable = ['screenReader', 'textZoom', 'cursorEnhancement'].includes(feature);
                } else if (detectedNeeds.lowVision && detectedNeeds.lowVision.confidence > threshold) {
                    shouldEnable = ['highContrast', 'textZoom', 'cursorEnhancement'].includes(feature);
                } else if (detectedNeeds.colorBlind && detectedNeeds.colorBlind.confidence > threshold) {
                    shouldEnable = ['colorBlindMode'].includes(feature);
                }
            }
            
            // Hearing-specific detection mapping
            else if (category === 'hearing') {
                if (detectedNeeds.deaf && detectedNeeds.deaf.confidence > threshold) {
                    shouldEnable = ['visualAlerts', 'captions', 'vibrationFeedback'].includes(feature);
                } else if (detectedNeeds.hardOfHearing && detectedNeeds.hardOfHearing.confidence > threshold) {
                    shouldEnable = ['captions', 'audioVisualization'].includes(feature);
                } else if (detectedNeeds.signLanguageUser && detectedNeeds.signLanguageUser.confidence > threshold) {
                    shouldEnable = ['signLanguage'].includes(feature);
                }
            }
            
            // Motor-specific detection mapping
            else if (category === 'motor') {
                if (detectedNeeds.limitedDexterity && detectedNeeds.limitedDexterity.confidence > threshold) {
                    shouldEnable = ['voiceControl', 'dwellClicking'].includes(feature);
                } else if (detectedNeeds.tremor && detectedNeeds.tremor.confidence > threshold) {
                    shouldEnable = ['adaptiveInputTiming', 'gestureSimplification'].includes(feature);
                }
            }
            
            // Cognitive-specific detection mapping
            else if (category === 'cognitive') {
                if (detectedNeeds.readingDifficulties && detectedNeeds.readingDifficulties.confidence > threshold) {
                    shouldEnable = ['readingAssistance', 'simplifiedInterface'].includes(feature);
                } else if (detectedNeeds.focusDifficulties && detectedNeeds.focusDifficulties.confidence > threshold) {
                    shouldEnable = ['focusMode'].includes(feature);
                } else if (detectedNeeds.memoryDifficulties && detectedNeeds.memoryDifficulties.confidence > threshold) {
                    shouldEnable = ['reminderSystem'].includes(feature);
                }
            }
            
            // Update the feature state if needed
            if (shouldEnable !== this.featureModules[feature].enabled) {
                this.setFeatureState(feature, shouldEnable, true);
                
                // Track the automatic change
                this.trackAutomaticChange(feature, shouldEnable);
            }
        }
    }

    /**
     * Toggle a specific accessibility feature
     * @param {string} featureId - ID of the feature to toggle
     * @param {boolean} [state] - Optional explicit state, otherwise toggles current state
     * @param {boolean} [userInitiated=true] - Whether this toggle was initiated by the user
     * @returns {boolean} - New state of the feature
     */
    toggleFeature(featureId, state, userInitiated = true) {
        if (!this.featureModules[featureId]) {
            console.error(`Unknown accessibility feature: ${featureId}`);
            return false;
        }

        const currentState = this.featureModules[featureId].enabled;
        const newState = state !== undefined ? state : !currentState;
        
        return this.setFeatureState(featureId, newState, false, userInitiated);
    }

    /**
     * Set the state of an accessibility feature
     * @param {string} featureId - ID of the feature to set
     * @param {boolean} enabled - Whether the feature should be enabled
     * @param {boolean} [autoDetected=false] - Whether this change was automatically detected
     * @param {boolean} [userInitiated=false] - Whether this change was user initiated
     * @returns {boolean} - Success status
     * @private
     */
    setFeatureState(featureId, enabled, autoDetected = false, userInitiated = false) {
        if (!this.featureModules[featureId]) {
            console.error(`Unknown accessibility feature: ${featureId}`);
            return false;
        }
        
        // Update feature state
        this.featureModules[featureId].enabled = enabled;
        
        // Track detection status
        if (autoDetected) {
            this.featureModules[featureId].autoDetected = true;
        }
        
        // Track user override
        if (userInitiated) {
            this.userOverrides[featureId] = {
                enabled,
                timestamp: new Date().toISOString()
            };
        }
        
        // Apply feature relationships
        this.applyFeatureRelationships(featureId, enabled);
        
        // Emit event for other components to respond
        eventEmitter.emit('accessibility:feature:changed', {
            featureId,
            enabled,
            autoDetected,
            userInitiated
        });
        
        // Log the change
        auditTrail.log('accessibility', `${enabled ? 'Enabled' : 'Disabled'} accessibility feature: ${featureId}`, {
            autoDetected,
            userInitiated
        });
        
        // Save preferences
        this.savePreferences();
        
        return true;
    }

    /**
     * Apply relationship rules between features (enabling one may enable/disable others)
     * @param {string} featureId - Feature being changed
     * @param {boolean} enabled - Whether it's being enabled or disabled
     * @private
     */
    applyFeatureRelationships(featureId, enabled) {
        const relationships = this.featureRelationships[featureId];
        if (!relationships) return;
        
        if (enabled && relationships.enableWith) {
            for (const relatedFeature of relationships.enableWith) {
                // Don't override user-specified settings
                if (!this.userOverrides[relatedFeature]) {
                    this.setFeatureState(relatedFeature, true, true, false);
                }
            }
        }
        
        if (enabled && relationships.disableWith) {
            for (const relatedFeature of relationships.disableWith) {
                // Don't override user-specified settings
                if (!this.userOverrides[relatedFeature]) {
                    this.setFeatureState(relatedFeature, false, true, false);
                }
            }
        }
    }

    /**
     * Handle vision detection results
     * @param {Object} data - Detection results
     * @private
     */
    handleVisionDetection(data) {
        this.processDetectionResults('vision', data);
    }

    /**
     * Handle hearing detection results
     * @param {Object} data - Detection results
     * @private
     */
    handleHearingDetection(data) {
        this.processDetectionResults('hearing', data);
    }

    /**
     * Handle motor detection results
     * @param {Object} data - Detection results
     * @private
     */
    handleMotorDetection(data) {
        this.processDetectionResults('motor', data);
    }

    /**
     * Handle cognitive detection results
     * @param {Object} data - Detection results
     * @private
     */
    handleCognitiveDetection(data) {
        this.processDetectionResults('cognitive', data);
    }

    /**
     * Handle feature toggle events from other components
     * @param {Object} data - Event data
     * @private
     */
    handleFeatureToggleEvent(data) {
        if (data && data.featureId) {
            this.toggleFeature(data.featureId, data.enabled, data.userInitiated);
        }
    }

    /**
     * Handle environment changes that may affect accessibility needs
     * @param {Object} data - Environment data
     * @private
     */
    handleEnvironmentChange(data) {
        // Example: Automatically adjust features based on environmental factors
        if (data.lighting === 'dim' && !this.userOverrides.highContrast) {
            this.toggleFeature('highContrast', true, false);
        }
        
        if (data.noisy === true && !this.userOverrides.captions) {
            this.toggleFeature('captions', true, false);
        }
        
        // If in public place, prefer visual over audio
        if (data.location === 'public' && !this.userOverrides.visualAlerts) {
            this.toggleFeature('visualAlerts', true, false);
        }
    }

    /**
     * Track automatic changes for user notification
     * @param {string} featureId - Feature ID
     * @param {boolean} enabled - New state
     * @private
     */
    trackAutomaticChange(featureId, enabled) {
        this.recentChanges.push({
            featureId,
            enabled,
            timestamp: new Date().toISOString()
        });
        
        // Only keep last 5 changes
        if (this.recentChanges.length > 5) {
            this.recentChanges.shift();
        }
        
        // Notify user of automatic changes
        this.notifyAutomaticChange(featureId, enabled);
    }

    /**
     * Notify user of automatic feature changes
     * @param {string} featureId - Feature ID
     * @param {boolean} enabled - Whether it was enabled or disabled
     * @private
     */
    notifyAutomaticChange(featureId, enabled) {
        // Create a user-friendly feature name from the ID
        const featureName = featureId
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase());
            
        const message = `${enabled ? 'Enabled' : 'Disabled'} ${featureName} based on detected needs.`;
        
        // Send notification via appropriate channel based on user capabilities
        eventEmitter.emit('notification:send', {
            message,
            type: 'accessibility',
            priority: 'medium',
            actionable: true,
            actions: [
                {
                    label: 'Undo',
                    action: () => this.toggleFeature(featureId, !enabled, true)
                },
                {
                    label: 'Settings',
                    action: 'openAccessibilitySettings'
                }
            ]
        });
    }

    /**
     * Reset features to default states
     * @returns {boolean} - Success status
     */
    resetToDefaults() {
        try {
            // Reset all features to disabled state
            for (const featureId in this.featureModules) {
                this.featureModules[featureId].enabled = false;
                this.featureModules[featureId].autoDetected = false;
            }
            
            // Clear user overrides
            this.userOverrides = {};
            
            // Re-run detection if enabled
            if (this.autoDetectionEnabled) {
                this.runAccessibilityDetection();
            }
            
            // Save preferences
            this.savePreferences();
            
            auditTrail.log('accessibility', 'Reset accessibility features to defaults');
            eventEmitter.emit('accessibility:features:reset');
            
            return true;
        } catch (error) {
            console.error('Failed to reset accessibility features:', error);
            return false;
        }
    }

    /**
     * Get current status of all accessibility features
     * @returns {Object} - Feature status object
     */
    getFeatureStatus() {
        const status = {
            features: {},
            autoDetectionEnabled: this.autoDetectionEnabled,
            userOverrides: Object.keys(this.userOverrides).length
        };
        
        // Group features by category
        for (const [featureId, settings] of Object.entries(this.featureModules)) {
            if (!status.features[settings.category]) {
                status.features[settings.category] = [];
            }
            
            status.features[settings.category].push({
                id: featureId,
                enabled: settings.enabled,
                autoDetected: settings.autoDetected,
                priority: settings.priority,
                userOverride: this.userOverrides[featureId] ? true : false
            });
        }
        
        return status;
    }

    /**
     * Announce current accessibility status using the appropriate method
     */
    announceStatus() {
        const enabledFeatures = Object.entries(this.featureModules)
            .filter(([_, settings]) => settings.enabled)
            .map(([id, _]) => id);
            
        let message = '';
        
        if (enabledFeatures.length === 0) {
            message = 'No accessibility features are currently enabled.';
        } else {
            message = `Enabled accessibility features: ${enabledFeatures.join(', ')}`;
        }
        
        // Use appropriate announcement method based on user capabilities
        if (this.featureModules.screenReader.enabled) {
            // Use screen reader announcement
            eventEmitter.emit('screenReader:announce', message);
        } else if (this.featureModules.visualAlerts.enabled) {
            // Show visual alert
            eventEmitter.emit('visualAlert:show', {
                message,
                duration: 5000,
                type: 'info'
            });
        } else {
            // Use standard notification
            eventEmitter.emit('notification:show', {
                message,
                type: 'accessibility'
            });
        }
        
        return true;
    }

    /**
     * Toggle automatic detection of accessibility needs
     * @param {boolean} enabled - Whether to enable automatic detection
     * @returns {boolean} - New state
     */
    toggleAutoDetection(enabled) {
        this.autoDetectionEnabled = enabled !== undefined ? enabled : !this.autoDetectionEnabled;
        
        if (this.autoDetectionEnabled) {
            // Run detection immediately when enabled
            this.runAccessibilityDetection();
        }
        
        // Save preferences
        this.savePreferences();
        
        auditTrail.log('accessibility', `${this.autoDetectionEnabled ? 'Enabled' : 'Disabled'} automatic accessibility detection`);
        
        return this.autoDetectionEnabled;
    }
    
    /**
     * Set the detection confidence threshold for a category
     * @param {string} category - Detection category
     * @param {number} threshold - Confidence threshold (0-1)
     * @returns {boolean} - Success status
     */
    setDetectionThreshold(category, threshold) {
        if (!this.detectionThresholds.hasOwnProperty(category)) {
            return false;
        }
        
        if (threshold < 0 || threshold > 1) {
            return false;
        }
        
        this.detectionThresholds[category] = threshold;
        this.savePreferences();
        
        // Re-run detection with new threshold
        if (this.autoDetectionEnabled) {
            this.runAccessibilityDetection();
        }
        
        return true;
    }
}

// Create singleton instance
const adaptiveFeatureManager = new AdaptiveFeatureManager();

// Export module
export { adaptiveFeatureManager };
