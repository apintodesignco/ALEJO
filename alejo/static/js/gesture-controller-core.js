/**
 * ALEJO Gesture Controller Core Module
 * 
 * Core functionality for the ALEJO gesture control system.
 * This module serves as the main integration point for the gesture detection,
 * classification, and communication components.
 * 
 * @module gesture-controller-core
 * @requires gesture-detection
 * @requires gesture-classifier
 * @requires gesture-websocket
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureControllerCore class for coordinating gesture components
     */
    class GestureControllerCore {
        /**
         * Create a new GestureControllerCore
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                enabled: options.enabled !== undefined ? options.enabled : true,
                useWebSocket: options.useWebSocket !== undefined ? options.useWebSocket : true,
                webSocketUrl: options.webSocketUrl || null,
                confidenceThreshold: options.confidenceThreshold || 0.7,
                debug: options.debug || false,
                storageKey: options.storageKey || 'alejo_gesture_config'
            };
            
            // Load saved configuration
            this._loadConfig();
            
            // Component instances
            this.detector = null;
            this.classifier = null;
            this.websocket = null;
            
            // State tracking
            this.initialized = false;
            this.active = false;
            
            // Event callbacks
            this.callbacks = {
                onAction: options.onAction || null,
                onSequence: options.onSequence || null,
                onError: options.onError || null,
                onStateChange: options.onStateChange || null
            };
            
            // Initialize if enabled
            if (this.config.enabled) {
                this.init();
            }
        }
        
        /**
         * Initialize the controller and its components
         */
        init() {
            if (this.initialized) return;
            
            try {
                // Initialize detector
                this.detector = new ALEJO.GestureDetector({
                    debug: this.config.debug,
                    onSwipe: (event) => this._handleGesture(event),
                    onTap: (event) => this._handleGesture(event),
                    onDoubleTap: (event) => this._handleGesture(event),
                    onHold: (event) => this._handleGesture(event),
                    onPinch: (event) => this._handleGesture(event),
                    onRotate: (event) => this._handleGesture(event),
                    onGestureStart: (event) => this._handleGestureStart(event),
                    onGestureEnd: (event) => this._handleGestureEnd(event)
                });
                
                // Initialize classifier
                this.classifier = new ALEJO.GestureClassifier({
                    confidenceThreshold: this.config.confidenceThreshold,
                    debug: this.config.debug,
                    onAction: (action) => this._handleAction(action),
                    onSequence: (sequence) => this._handleSequence(sequence),
                    onUnrecognized: (data) => this._handleUnrecognized(data)
                });
                
                // Initialize WebSocket if enabled
                if (this.config.useWebSocket) {
                    this.websocket = new ALEJO.GestureWebSocket({
                        url: this.config.webSocketUrl,
                        debug: this.config.debug,
                        onOpen: () => this._handleWebSocketOpen(),
                        onClose: () => this._handleWebSocketClose(),
                        onError: (error) => this._handleWebSocketError(error),
                        onConfig: (config) => this._handleConfigUpdate(config),
                        onFeedback: (feedback) => this._handleGestureFeedback(feedback),
                        onUIUpdate: (update) => this._handleUIUpdate(update)
                    });
                }
                
                this.initialized = true;
                this.active = true;
                
                // Notify state change
                this._notifyStateChange({
                    type: 'initialized',
                    active: this.active,
                    enabled: this.config.enabled
                });
                
                if (this.config.debug) {
                    console.log('ALEJO GestureControllerCore initialized');
                }
            } catch (error) {
                this._handleError('initialization', error);
            }
        }
        
        /**
         * Enable the gesture controller
         */
        enable() {
            if (!this.initialized) {
                this.init();
                return;
            }
            
            if (this.active) return;
            
            this.active = true;
            this.config.enabled = true;
            this._saveConfig();
            
            // Notify state change
            this._notifyStateChange({
                type: 'enabled',
                active: this.active,
                enabled: this.config.enabled
            });
            
            if (this.config.debug) {
                console.log('ALEJO GestureControllerCore enabled');
            }
        }
        
        /**
         * Disable the gesture controller
         */
        disable() {
            if (!this.initialized || !this.active) return;
            
            this.active = false;
            this.config.enabled = false;
            this._saveConfig();
            
            // Notify state change
            this._notifyStateChange({
                type: 'disabled',
                active: this.active,
                enabled: this.config.enabled
            });
            
            if (this.config.debug) {
                console.log('ALEJO GestureControllerCore disabled');
            }
        }
        
        /**
         * Update configuration
         * @param {Object} config - New configuration
         */
        updateConfig(config) {
            const oldConfig = { ...this.config };
            
            // Update config
            this.config = {
                ...this.config,
                ...config
            };
            
            // Apply changes
            if (this.classifier && this.config.confidenceThreshold !== oldConfig.confidenceThreshold) {
                this.classifier.config.confidenceThreshold = this.config.confidenceThreshold;
            }
            
            // Handle enabled/disabled state
            if (this.config.enabled !== oldConfig.enabled) {
                if (this.config.enabled) {
                    this.enable();
                } else {
                    this.disable();
                }
            }
            
            // Save config
            this._saveConfig();
            
            // Notify state change
            this._notifyStateChange({
                type: 'config_updated',
                active: this.active,
                enabled: this.config.enabled,
                config: this.config
            });
            
            if (this.config.debug) {
                console.log('Configuration updated', this.config);
            }
        }
        
        /**
         * Set the UI context for gesture classification
         * @param {string} context - Context name
         */
        setContext(context) {
            if (!this.initialized || !this.active) return;
            
            if (this.classifier) {
                this.classifier.setContext(context);
                
                if (this.config.debug) {
                    console.log(`Context set to: ${context}`);
                }
            }
        }
        
        /**
         * Handle raw gesture events from detector
         * @param {Object} event - Gesture event
         * @private
         */
        _handleGesture(event) {
            if (!this.initialized || !this.active) return;
            
            try {
                // Classify the gesture
                if (this.classifier) {
                    this.classifier.classifyGesture(event);
                }
                
                // Send to WebSocket if connected
                if (this.websocket && this.websocket.connected) {
                    this.websocket.sendGestureEvent(event);
                }
            } catch (error) {
                this._handleError('gesture_processing', error);
            }
        }
        
        /**
         * Handle gesture start events
         * @param {Object} event - Gesture start event
         * @private
         */
        _handleGestureStart(event) {
            // Could be used for visual feedback or other processing
            if (this.config.debug) {
                console.log('Gesture started', event);
            }
        }
        
        /**
         * Handle gesture end events
         * @param {Object} event - Gesture end event
         * @private
         */
        _handleGestureEnd(event) {
            // Could be used for visual feedback or other processing
            if (this.config.debug) {
                console.log('Gesture ended', event);
            }
        }
        
        /**
         * Handle classified actions from classifier
         * @param {Object} action - Classified action
         * @private
         */
        _handleAction(action) {
            if (!this.initialized || !this.active) return;
            
            if (this.callbacks.onAction) {
                this.callbacks.onAction(action);
            }
            
            if (this.config.debug) {
                console.log('Action received', action);
            }
        }
        
        /**
         * Handle gesture sequences from classifier
         * @param {Object} sequence - Gesture sequence
         * @private
         */
        _handleSequence(sequence) {
            if (!this.initialized || !this.active) return;
            
            if (this.callbacks.onSequence) {
                this.callbacks.onSequence(sequence);
            }
            
            // Send to WebSocket if connected
            if (this.websocket && this.websocket.connected) {
                this.websocket.sendGestureSequence(sequence.sequence);
            }
            
            if (this.config.debug) {
                console.log('Sequence received', sequence);
            }
        }
        
        /**
         * Handle unrecognized gestures
         * @param {Object} data - Unrecognized gesture data
         * @private
         */
        _handleUnrecognized(data) {
            if (this.config.debug) {
                console.log('Unrecognized gesture', data);
            }
        }
        
        /**
         * Handle WebSocket open events
         * @private
         */
        _handleWebSocketOpen() {
            if (this.config.debug) {
                console.log('WebSocket connected');
            }
        }
        
        /**
         * Handle WebSocket close events
         * @private
         */
        _handleWebSocketClose() {
            if (this.config.debug) {
                console.log('WebSocket disconnected');
            }
        }
        
        /**
         * Handle WebSocket error events
         * @param {Object} error - Error data
         * @private
         */
        _handleWebSocketError(error) {
            this._handleError('websocket', error);
        }
        
        /**
         * Handle configuration updates from server
         * @param {Object} config - New configuration
         * @private
         */
        _handleConfigUpdate(config) {
            this.updateConfig(config);
        }
        
        /**
         * Handle gesture feedback from server
         * @param {Object} feedback - Feedback data
         * @private
         */
        _handleGestureFeedback(feedback) {
            // Could be used for visual or audio feedback
            if (this.config.debug) {
                console.log('Gesture feedback received', feedback);
            }
        }
        
        /**
         * Handle UI updates from server
         * @param {Object} update - UI update data
         * @private
         */
        _handleUIUpdate(update) {
            // Apply UI updates
            if (this.config.debug) {
                console.log('UI update received', update);
            }
        }
        
        /**
         * Handle errors
         * @param {string} source - Error source
         * @param {Error|Object} error - Error object
         * @private
         */
        _handleError(source, error) {
            const errorData = {
                source: source,
                message: error.message || 'Unknown error',
                timestamp: Date.now()
            };
            
            if (this.callbacks.onError) {
                this.callbacks.onError(errorData);
            }
            
            if (this.config.debug) {
                console.error(`Gesture controller error (${source}):`, error);
            }
        }
        
        /**
         * Notify state change
         * @param {Object} state - State data
         * @private
         */
        _notifyStateChange(state) {
            if (this.callbacks.onStateChange) {
                this.callbacks.onStateChange(state);
            }
        }
        
        /**
         * Load configuration from storage
         * @private
         */
        _loadConfig() {
            try {
                const savedConfig = localStorage.getItem(this.config.storageKey);
                if (savedConfig) {
                    const parsedConfig = JSON.parse(savedConfig);
                    this.config = {
                        ...this.config,
                        ...parsedConfig
                    };
                    
                    if (this.config.debug) {
                        console.log('Loaded configuration from storage', this.config);
                    }
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error loading configuration:', error);
                }
            }
        }
        
        /**
         * Save configuration to storage
         * @private
         */
        _saveConfig() {
            try {
                localStorage.setItem(this.config.storageKey, JSON.stringify(this.config));
                
                if (this.config.debug) {
                    console.log('Saved configuration to storage');
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error saving configuration:', error);
                }
            }
        }
        
        /**
         * Reset the controller to default state
         */
        reset() {
            if (this.classifier) {
                this.classifier.reset();
            }
            
            if (this.websocket) {
                this.websocket.reset();
            }
            
            if (this.config.debug) {
                console.log('GestureControllerCore reset');
            }
        }
        
        /**
         * Destroy the controller and clean up resources
         */
        destroy() {
            if (this.detector) {
                this.detector.destroy();
                this.detector = null;
            }
            
            if (this.classifier) {
                this.classifier.destroy();
                this.classifier = null;
            }
            
            if (this.websocket) {
                this.websocket.destroy();
                this.websocket = null;
            }
            
            this.initialized = false;
            this.active = false;
            
            if (this.config.debug) {
                console.log('ALEJO GestureControllerCore destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureControllerCore = GestureControllerCore;
})();
