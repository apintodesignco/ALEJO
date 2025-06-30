/**
 * ALEJO Gesture Classifier Module
 * 
 * Classifies detected gestures into semantic actions that can be used by the ALEJO system.
 * This module processes raw gesture data and determines the appropriate UI or system action
 * based on the context, gesture type, and target element.
 * 
 * @module gesture-classifier
 * @requires gesture-detection
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureClassifier class for interpreting gestures into actions
     */
    class GestureClassifier {
        /**
         * Create a new GestureClassifier
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                confidenceThreshold: options.confidenceThreshold || 0.7,
                sequenceTimeout: options.sequenceTimeout || 800,
                contextAware: options.contextAware !== undefined ? options.contextAware : true,
                debug: options.debug || false
            };
            
            // State tracking
            this.gestureSequence = [];
            this.sequenceTimer = null;
            this.currentContext = options.initialContext || 'default';
            this.lastAction = null;
            
            // Action mappings - default mappings for common gestures
            this.actionMappings = options.actionMappings || {
                default: {
                    swipe_left: 'navigation.next',
                    swipe_right: 'navigation.previous',
                    swipe_up: 'navigation.menu',
                    swipe_down: 'navigation.close',
                    pinch_in: 'view.zoom_out',
                    pinch_out: 'view.zoom_in',
                    rotate: 'view.rotate',
                    tap: 'interaction.select',
                    double_tap: 'interaction.activate',
                    hold: 'interaction.context_menu'
                }
            };
            
            // Custom element mappings - override default mappings for specific elements
            this.elementMappings = options.elementMappings || {};
            
            // Gesture sequences - define complex gesture sequences
            this.gestureSequences = options.gestureSequences || {
                'swipe_left,swipe_right': 'edit.undo',
                'swipe_right,swipe_left': 'edit.redo',
                'tap,tap,hold': 'system.reset',
                'swipe_up,swipe_down': 'system.home'
            };
            
            // Event callbacks
            this.callbacks = {
                onAction: options.onAction || null,
                onSequence: options.onSequence || null,
                onUnrecognized: options.onUnrecognized || null
            };
            
            // Initialize
            this.init();
        }
        
        /**
         * Initialize the classifier
         */
        init() {
            if (this.config.debug) {
                console.log('ALEJO GestureClassifier initialized');
            }
        }
        
        /**
         * Set the current UI context
         * @param {string} context - The UI context
         */
        setContext(context) {
            this.currentContext = context || 'default';
            
            if (this.config.debug) {
                console.log(`Context set to: ${this.currentContext}`);
            }
        }
        
        /**
         * Update action mappings
         * @param {Object} mappings - New action mappings
         * @param {string} context - Context to update, or null for all contexts
         */
        updateActionMappings(mappings, context = null) {
            if (context) {
                this.actionMappings[context] = {
                    ...(this.actionMappings[context] || {}),
                    ...mappings
                };
            } else {
                // Update all contexts
                Object.keys(mappings).forEach(ctx => {
                    this.actionMappings[ctx] = {
                        ...(this.actionMappings[ctx] || {}),
                        ...mappings[ctx]
                    };
                });
            }
            
            if (this.config.debug) {
                console.log('Action mappings updated');
            }
        }
        
        /**
         * Update element mappings
         * @param {Object} mappings - New element mappings
         */
        updateElementMappings(mappings) {
            this.elementMappings = {
                ...this.elementMappings,
                ...mappings
            };
            
            if (this.config.debug) {
                console.log('Element mappings updated');
            }
        }
        
        /**
         * Update gesture sequences
         * @param {Object} sequences - New gesture sequences
         */
        updateGestureSequences(sequences) {
            this.gestureSequences = {
                ...this.gestureSequences,
                ...sequences
            };
            
            if (this.config.debug) {
                console.log('Gesture sequences updated');
            }
        }
        
        /**
         * Process a gesture event and classify it
         * @param {Object} gestureEvent - The gesture event to classify
         * @returns {Object|null} The classified action or null if not recognized
         */
        classifyGesture(gestureEvent) {
            if (!gestureEvent || !gestureEvent.type) {
                return null;
            }
            
            // Format the gesture type
            let gestureType = gestureEvent.type.toLowerCase();
            
            // Add direction for directional gestures
            if (gestureEvent.direction) {
                gestureType += '_' + gestureEvent.direction.toLowerCase();
            }
            
            // Add to sequence
            this.addToSequence(gestureType, gestureEvent);
            
            // Get target element ID or data attribute
            const targetElement = gestureEvent.target;
            const elementId = targetElement ? (targetElement.id || null) : null;
            const gestureAction = targetElement ? (targetElement.dataset.gestureAction || null) : null;
            
            // Calculate confidence based on gesture properties
            const confidence = this.calculateConfidence(gestureEvent);
            
            // Skip if confidence is below threshold
            if (confidence < this.config.confidenceThreshold) {
                if (this.config.debug) {
                    console.log(`Gesture confidence too low: ${confidence.toFixed(2)}`);
                }
                return null;
            }
            
            // Try to get action from element-specific mapping
            let action = null;
            
            // First check if the element has a specific gesture action attribute
            if (gestureAction) {
                action = gestureAction;
            }
            // Then check element mappings by ID
            else if (elementId && this.elementMappings[elementId] && 
                     this.elementMappings[elementId][gestureType]) {
                action = this.elementMappings[elementId][gestureType];
            }
            // Then check context-specific mappings
            else if (this.actionMappings[this.currentContext] && 
                     this.actionMappings[this.currentContext][gestureType]) {
                action = this.actionMappings[this.currentContext][gestureType];
            }
            // Finally fall back to default mappings
            else if (this.actionMappings.default && 
                     this.actionMappings.default[gestureType]) {
                action = this.actionMappings.default[gestureType];
            }
            
            if (!action) {
                if (this.callbacks.onUnrecognized) {
                    this.callbacks.onUnrecognized({
                        gesture: gestureType,
                        context: this.currentContext,
                        target: elementId
                    });
                }
                return null;
            }
            
            // Create action object
            const actionObject = {
                action: action,
                source: 'gesture',
                gesture: gestureType,
                confidence: confidence,
                context: this.currentContext,
                target: elementId,
                timestamp: Date.now()
            };
            
            // Add additional properties from the gesture event
            if (gestureEvent.scale) actionObject.scale = gestureEvent.scale;
            if (gestureEvent.rotation) actionObject.rotation = gestureEvent.rotation;
            if (gestureEvent.duration) actionObject.duration = gestureEvent.duration;
            
            // Store as last action
            this.lastAction = actionObject;
            
            // Notify callback
            if (this.callbacks.onAction) {
                this.callbacks.onAction(actionObject);
            }
            
            if (this.config.debug) {
                console.log(`Classified gesture: ${gestureType} -> ${action}`);
            }
            
            return actionObject;
        }
        
        /**
         * Add a gesture to the current sequence
         * @param {string} gestureType - Type of gesture
         * @param {Object} gestureEvent - Original gesture event
         */
        addToSequence(gestureType, gestureEvent) {
            // Clear timeout if exists
            if (this.sequenceTimer) {
                clearTimeout(this.sequenceTimer);
            }
            
            // Add to sequence
            this.gestureSequence.push(gestureType);
            
            // Limit sequence length
            if (this.gestureSequence.length > 5) {
                this.gestureSequence.shift();
            }
            
            // Check for recognized sequences
            this.checkSequence();
            
            // Set timeout to clear sequence
            this.sequenceTimer = setTimeout(() => {
                this.gestureSequence = [];
            }, this.config.sequenceTimeout);
        }
        
        /**
         * Check if the current gesture sequence matches any defined sequences
         */
        checkSequence() {
            if (this.gestureSequence.length < 2) return;
            
            const sequenceString = this.gestureSequence.join(',');
            
            // Check for exact matches
            if (this.gestureSequences[sequenceString]) {
                const action = this.gestureSequences[sequenceString];
                
                const sequenceAction = {
                    action: action,
                    source: 'gesture_sequence',
                    sequence: this.gestureSequence.slice(),
                    confidence: 1.0,
                    context: this.currentContext,
                    timestamp: Date.now()
                };
                
                // Notify callback
                if (this.callbacks.onSequence) {
                    this.callbacks.onSequence(sequenceAction);
                }
                
                // Clear sequence
                this.gestureSequence = [];
                
                if (this.config.debug) {
                    console.log(`Recognized sequence: ${sequenceString} -> ${action}`);
                }
                
                return sequenceAction;
            }
            
            // Check for partial matches (for longer sequences)
            for (const [seq, action] of Object.entries(this.gestureSequences)) {
                const seqArray = seq.split(',');
                
                // Check if our current sequence is the start of a longer sequence
                if (seqArray.length > this.gestureSequence.length) {
                    const isPartialMatch = this.gestureSequence.every((g, i) => g === seqArray[i]);
                    
                    if (isPartialMatch && this.config.debug) {
                        console.log(`Partial sequence match: ${sequenceString} (waiting for more)`);
                    }
                }
            }
            
            return null;
        }
        
        /**
         * Calculate confidence score for a gesture
         * @param {Object} gestureEvent - The gesture event
         * @returns {number} Confidence score between 0 and 1
         */
        calculateConfidence(gestureEvent) {
            // Default high confidence
            let confidence = 0.9;
            
            // Adjust based on gesture type and properties
            switch (gestureEvent.type) {
                case 'swipe':
                    // Higher confidence for longer, faster swipes
                    const distance = gestureEvent.distance || 0;
                    const duration = gestureEvent.duration || 1;
                    const velocity = distance / duration;
                    
                    // Normalize: 0.3 - 2.0 pixels/ms range to 0.7 - 1.0 confidence
                    confidence = Math.min(1.0, 0.7 + (velocity - 0.3) / 1.7 * 0.3);
                    break;
                    
                case 'pinch_in':
                case 'pinch_out':
                    // Higher confidence for larger scale changes
                    const scaleDiff = Math.abs(1 - (gestureEvent.scale || 1));
                    
                    // Normalize: 0.1 - 0.5 scale difference to 0.7 - 1.0 confidence
                    confidence = Math.min(1.0, 0.7 + (scaleDiff - 0.1) / 0.4 * 0.3);
                    break;
                    
                case 'rotate':
                    // Higher confidence for larger rotations
                    const rotationAbs = Math.abs(gestureEvent.rotation || 0);
                    
                    // Normalize: 15 - 90 degrees to 0.7 - 1.0 confidence
                    confidence = Math.min(1.0, 0.7 + (rotationAbs - 15) / 75 * 0.3);
                    break;
                    
                case 'tap':
                    // High confidence for taps
                    confidence = 0.95;
                    break;
                    
                case 'double_tap':
                    // Slightly lower confidence for double taps (more complex)
                    confidence = 0.9;
                    break;
                    
                case 'hold':
                    // High confidence for holds
                    confidence = 0.95;
                    break;
                    
                default:
                    // Default confidence
                    confidence = 0.8;
            }
            
            return confidence;
        }
        
        /**
         * Reset the classifier state
         */
        reset() {
            this.gestureSequence = [];
            this.lastAction = null;
            
            if (this.sequenceTimer) {
                clearTimeout(this.sequenceTimer);
                this.sequenceTimer = null;
            }
            
            if (this.config.debug) {
                console.log('GestureClassifier reset');
            }
        }
        
        /**
         * Destroy the classifier and clean up resources
         */
        destroy() {
            this.reset();
            
            if (this.config.debug) {
                console.log('ALEJO GestureClassifier destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureClassifier = GestureClassifier;
})();
