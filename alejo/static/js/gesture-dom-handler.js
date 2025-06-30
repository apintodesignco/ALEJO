/**
 * ALEJO Gesture DOM Handler Module
 * 
 * Handles DOM interactions, UI feedback, and accessibility features for the gesture system.
 * This module provides visual and audio feedback for gesture recognition, manages ARIA
 * live regions for accessibility, and handles DOM manipulation for gesture-enabled elements.
 * 
 * @module gesture-dom-handler
 * @requires gesture-controller-core
 * @requires gesture-element-registry
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureDomHandler class for managing DOM interactions and feedback
     */
    class GestureDomHandler {
        /**
         * Create a new GestureDomHandler
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                feedbackEnabled: options.feedbackEnabled !== undefined ? options.feedbackEnabled : true,
                visualFeedback: options.visualFeedback !== undefined ? options.visualFeedback : true,
                audioFeedback: options.audioFeedback !== undefined ? options.audioFeedback : true,
                accessibilityEnabled: options.accessibilityEnabled !== undefined ? options.accessibilityEnabled : true,
                feedbackDuration: options.feedbackDuration || 500,
                feedbackClass: options.feedbackClass || 'gesture-feedback',
                ariaLiveRegion: options.ariaLiveRegion || 'gesture-announcer',
                debug: options.debug || false
            };
            
            // State tracking
            this.activeGestures = new Map();
            this.feedbackElements = new Map();
            this.ariaLiveRegion = null;
            this.audioContext = null;
            
            // Event callbacks
            this.callbacks = {
                onFeedbackShown: options.onFeedbackShown || null,
                onFeedbackHidden: options.onFeedbackHidden || null,
                onAccessibilityAnnouncement: options.onAccessibilityAnnouncement || null
            };
            
            // Initialize
            this.init();
        }
        
        /**
         * Initialize the DOM handler
         */
        init() {
            // Set up ARIA live region if accessibility is enabled
            if (this.config.accessibilityEnabled) {
                this._setupAriaLiveRegion();
            }
            
            // Initialize audio context if audio feedback is enabled
            if (this.config.audioFeedback) {
                this._initAudioContext();
            }
            
            if (this.config.debug) {
                console.log('ALEJO GestureDomHandler initialized');
            }
        }
        
        /**
         * Set up ARIA live region for accessibility announcements
         * @private
         */
        _setupAriaLiveRegion() {
            // Check if live region already exists
            let region = document.getElementById(this.config.ariaLiveRegion);
            
            // Create if it doesn't exist
            if (!region) {
                region = document.createElement('div');
                region.id = this.config.ariaLiveRegion;
                region.className = 'sr-only';
                region.setAttribute('aria-live', 'polite');
                region.setAttribute('aria-atomic', 'true');
                document.body.appendChild(region);
            }
            
            this.ariaLiveRegion = region;
            
            if (this.config.debug) {
                console.log('ARIA live region set up');
            }
        }
        
        /**
         * Initialize audio context for audio feedback
         * @private
         */
        _initAudioContext() {
            try {
                // Use AudioContext or webkitAudioContext
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.audioContext = new AudioContextClass();
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error initializing AudioContext:', error);
                }
            }
        }
        
        /**
         * Show visual feedback for a gesture
         * @param {string} gestureType - Type of gesture
         * @param {Element|string} [element=null] - Element or element ID to show feedback on
         * @param {Object} [options={}] - Additional options
         */
        showVisualFeedback(gestureType, element = null, options = {}) {
            if (!this.config.visualFeedback) return;
            
            // Get target element
            let targetElement = null;
            
            if (element) {
                if (typeof element === 'string') {
                    targetElement = document.getElementById(element);
                } else if (element instanceof Element) {
                    targetElement = element;
                }
            }
            
            // If no target element, use body for global feedback
            if (!targetElement) {
                targetElement = document.body;
            }
            
            // Create feedback element if it doesn't exist for this target
            let feedbackElement = this.feedbackElements.get(targetElement);
            
            if (!feedbackElement) {
                feedbackElement = document.createElement('div');
                feedbackElement.className = `${this.config.feedbackClass} ${this.config.feedbackClass}-${gestureType}`;
                
                // Position the feedback element
                if (targetElement !== document.body) {
                    const rect = targetElement.getBoundingClientRect();
                    feedbackElement.style.position = 'absolute';
                    feedbackElement.style.left = `${rect.left}px`;
                    feedbackElement.style.top = `${rect.top}px`;
                    feedbackElement.style.width = `${rect.width}px`;
                    feedbackElement.style.height = `${rect.height}px`;
                    document.body.appendChild(feedbackElement);
                } else {
                    // Global feedback
                    feedbackElement.style.position = 'fixed';
                    feedbackElement.style.left = '50%';
                    feedbackElement.style.top = '50%';
                    feedbackElement.style.transform = 'translate(-50%, -50%)';
                    document.body.appendChild(feedbackElement);
                }
                
                this.feedbackElements.set(targetElement, feedbackElement);
            }
            
            // Add active class
            feedbackElement.classList.add(`${this.config.feedbackClass}-active`);
            
            // Add custom classes if provided
            if (options.customClass) {
                feedbackElement.classList.add(options.customClass);
            }
            
            // Store timeout ID to clear later
            const timeoutId = setTimeout(() => {
                this.hideVisualFeedback(gestureType, targetElement);
            }, options.duration || this.config.feedbackDuration);
            
            // Store active gesture info
            this.activeGestures.set(feedbackElement, {
                gestureType,
                element: targetElement,
                timeoutId
            });
            
            // Notify feedback shown
            if (this.callbacks.onFeedbackShown) {
                this.callbacks.onFeedbackShown({
                    gestureType,
                    element: targetElement,
                    feedbackElement
                });
            }
            
            if (this.config.debug) {
                console.log(`Visual feedback shown for ${gestureType}`);
            }
        }
        
        /**
         * Hide visual feedback for a gesture
         * @param {string} gestureType - Type of gesture
         * @param {Element|string} [element=null] - Element or element ID to hide feedback on
         */
        hideVisualFeedback(gestureType, element = null) {
            // Get target element
            let targetElement = null;
            
            if (element) {
                if (typeof element === 'string') {
                    targetElement = document.getElementById(element);
                } else if (element instanceof Element) {
                    targetElement = element;
                }
            }
            
            // If no target element, use body for global feedback
            if (!targetElement) {
                targetElement = document.body;
            }
            
            // Get feedback element
            const feedbackElement = this.feedbackElements.get(targetElement);
            
            if (!feedbackElement) return;
            
            // Get active gesture info
            const gestureInfo = this.activeGestures.get(feedbackElement);
            
            if (!gestureInfo || gestureInfo.gestureType !== gestureType) return;
            
            // Clear timeout
            clearTimeout(gestureInfo.timeoutId);
            
            // Remove active class
            feedbackElement.classList.remove(`${this.config.feedbackClass}-active`);
            
            // Remove custom classes
            feedbackElement.className = `${this.config.feedbackClass} ${this.config.feedbackClass}-${gestureType}`;
            
            // Remove from active gestures
            this.activeGestures.delete(feedbackElement);
            
            // Notify feedback hidden
            if (this.callbacks.onFeedbackHidden) {
                this.callbacks.onFeedbackHidden({
                    gestureType,
                    element: targetElement,
                    feedbackElement
                });
            }
            
            if (this.config.debug) {
                console.log(`Visual feedback hidden for ${gestureType}`);
            }
        }
        
        /**
         * Play audio feedback for a gesture
         * @param {string} gestureType - Type of gesture
         * @param {Object} [options={}] - Additional options
         */
        playAudioFeedback(gestureType, options = {}) {
            if (!this.config.audioFeedback || !this.audioContext) return;
            
            try {
                // Create oscillator
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                // Configure oscillator based on gesture type
                switch (gestureType) {
                    case 'tap':
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 800;
                        gainNode.gain.value = 0.1;
                        break;
                    case 'doubletap':
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 1000;
                        gainNode.gain.value = 0.1;
                        break;
                    case 'hold':
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 400;
                        gainNode.gain.value = 0.1;
                        break;
                    case 'swipe':
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 600;
                        oscillator.frequency.linearRampToValueAtTime(
                            300, 
                            this.audioContext.currentTime + 0.2
                        );
                        gainNode.gain.value = 0.1;
                        break;
                    default:
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 600;
                        gainNode.gain.value = 0.1;
                }
                
                // Apply custom options if provided
                if (options.frequency) {
                    oscillator.frequency.value = options.frequency;
                }
                
                if (options.type) {
                    oscillator.type = options.type;
                }
                
                if (options.gain) {
                    gainNode.gain.value = options.gain;
                }
                
                // Connect nodes
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Start and stop
                oscillator.start();
                
                // Set duration
                const duration = options.duration || 150;
                
                // Fade out
                gainNode.gain.exponentialRampToValueAtTime(
                    0.001, 
                    this.audioContext.currentTime + duration / 1000
                );
                
                // Stop after duration
                setTimeout(() => {
                    oscillator.stop();
                }, duration);
                
                if (this.config.debug) {
                    console.log(`Audio feedback played for ${gestureType}`);
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error playing audio feedback:', error);
                }
            }
        }
        
        /**
         * Make accessibility announcement
         * @param {string} message - Message to announce
         * @param {Object} [options={}] - Additional options
         */
        makeAccessibilityAnnouncement(message, options = {}) {
            if (!this.config.accessibilityEnabled || !this.ariaLiveRegion) return;
            
            // Set politeness level
            const politeness = options.politeness || 'polite';
            this.ariaLiveRegion.setAttribute('aria-live', politeness);
            
            // Clear previous announcement
            this.ariaLiveRegion.textContent = '';
            
            // Small delay to ensure screen readers register the change
            setTimeout(() => {
                this.ariaLiveRegion.textContent = message;
                
                // Notify announcement made
                if (this.callbacks.onAccessibilityAnnouncement) {
                    this.callbacks.onAccessibilityAnnouncement({
                        message,
                        options
                    });
                }
                
                if (this.config.debug) {
                    console.log(`Accessibility announcement: ${message}`);
                }
            }, 50);
        }
        
        /**
         * Handle gesture event with appropriate feedback
         * @param {Object} gestureEvent - Gesture event data
         */
        handleGestureEvent(gestureEvent) {
            if (!this.config.feedbackEnabled) return;
            
            const { type, target, confidence } = gestureEvent;
            
            // Skip low confidence gestures
            if (confidence < 0.7) return;
            
            // Show visual feedback if enabled
            if (this.config.visualFeedback) {
                this.showVisualFeedback(type, target);
            }
            
            // Play audio feedback if enabled
            if (this.config.audioFeedback) {
                this.playAudioFeedback(type);
            }
            
            // Make accessibility announcement if enabled
            if (this.config.accessibilityEnabled) {
                let announcement = `Gesture detected: ${type}`;
                
                if (target && typeof target === 'string') {
                    const targetElement = document.getElementById(target);
                    if (targetElement && targetElement.getAttribute('aria-label')) {
                        announcement += ` on ${targetElement.getAttribute('aria-label')}`;
                    }
                }
                
                this.makeAccessibilityAnnouncement(announcement);
            }
        }
        
        /**
         * Update element state based on gesture action
         * @param {string} elementId - Element ID
         * @param {string} action - Action to perform
         * @param {Object} [params={}] - Additional parameters
         */
        updateElementState(elementId, action, params = {}) {
            const element = document.getElementById(elementId);
            if (!element) return false;
            
            switch (action) {
                case 'activate':
                    // Simulate click
                    element.click();
                    break;
                    
                case 'toggle':
                    // Toggle attribute or class
                    if (params.attribute) {
                        if (element.hasAttribute(params.attribute)) {
                            element.removeAttribute(params.attribute);
                        } else {
                            element.setAttribute(params.attribute, params.value || '');
                        }
                    } else if (params.class) {
                        element.classList.toggle(params.class);
                    }
                    break;
                    
                case 'scroll':
                    // Scroll element
                    if (params.direction === 'up') {
                        element.scrollTop -= params.amount || 100;
                    } else if (params.direction === 'down') {
                        element.scrollTop += params.amount || 100;
                    } else if (params.direction === 'left') {
                        element.scrollLeft -= params.amount || 100;
                    } else if (params.direction === 'right') {
                        element.scrollLeft += params.amount || 100;
                    }
                    break;
                    
                default:
                    // Custom action
                    if (element.dataset.gestureAction === action) {
                        // Trigger custom event
                        const event = new CustomEvent('gesture-action', {
                            detail: {
                                action,
                                params
                            },
                            bubbles: true
                        });
                        element.dispatchEvent(event);
                    }
            }
            
            return true;
        }
        
        /**
         * Reset the DOM handler
         */
        reset() {
            // Clear all feedback elements
            this.feedbackElements.forEach((feedbackElement) => {
                if (feedbackElement.parentNode) {
                    feedbackElement.parentNode.removeChild(feedbackElement);
                }
            });
            
            // Clear maps
            this.feedbackElements.clear();
            this.activeGestures.clear();
            
            if (this.config.debug) {
                console.log('GestureDomHandler reset');
            }
        }
        
        /**
         * Destroy the DOM handler and clean up resources
         */
        destroy() {
            // Reset first
            this.reset();
            
            // Close audio context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            // Remove ARIA live region
            if (this.ariaLiveRegion && this.ariaLiveRegion.parentNode) {
                this.ariaLiveRegion.parentNode.removeChild(this.ariaLiveRegion);
                this.ariaLiveRegion = null;
            }
            
            if (this.config.debug) {
                console.log('ALEJO GestureDomHandler destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureDomHandler = GestureDomHandler;
})();
