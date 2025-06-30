/**
 * ALEJO Gesture Handler
 * 
 * Client-side JavaScript for handling gesture recognition and integration
 * with ALEJO's UI system. This module detects gestures using the browser's
 * touch and pointer events and communicates with the backend via WebSockets.
 */

(function() {
    'use strict';

    // Main namespace
    window.ALEJO = window.ALEJO || {};
    
    /**
     * Gesture Handler class
     */
    class GestureHandler {
        constructor() {
            // Configuration
            this.config = {
                enabled: true,
                debugMode: false,
                confidenceThreshold: 0.7,
                gestureTimeout: 500, // ms
                minSwipeDistance: 50, // px
                minPinchDistance: 20, // px
                doubleTapTimeout: 300, // ms
                holdTimeout: 500 // ms
            };
            
            // State tracking
            this.activeGestures = new Map();
            this.gestureSequence = [];
            this.sequenceTimeout = null;
            this.touchPoints = [];
            this.lastTap = null;
            this.websocket = null;
            this.gestureElements = [];
            
            // Bind methods to preserve 'this' context
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);
            this.handlePointerCancel = this.handlePointerCancel.bind(this);
            this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
            this.registerGestureElements = this.registerGestureElements.bind(this);
            
            // Expose public methods
            ALEJO.registerGestureElements = this.registerGestureElements;
        }
        
        /**
         * Initialize the gesture handler
         */
        init() {
            this.loadConfig();
            this.setupEventListeners();
            this.connectWebSocket();
            this.log('Gesture Handler initialized');
        }
        
        /**
         * Load configuration from localStorage or defaults
         */
        loadConfig() {
            try {
                const savedConfig = localStorage.getItem('alejo_gesture_config');
                if (savedConfig) {
                    const parsedConfig = JSON.parse(savedConfig);
                    this.config = { ...this.config, ...parsedConfig };
                }
            } catch (error) {
                this.log('Error loading gesture config:', error);
            }
        }
        
        /**
         * Save configuration to localStorage
         */
        saveConfig() {
            try {
                localStorage.setItem('alejo_gesture_config', JSON.stringify(this.config));
            } catch (error) {
                this.log('Error saving gesture config:', error);
            }
        }
        
        /**
         * Set up event listeners for gesture detection
         */
        setupEventListeners() {
            if (!this.config.enabled) return;
            
            // Use pointer events for better cross-browser support
            document.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
            document.addEventListener('pointermove', this.handlePointerMove, { passive: false });
            document.addEventListener('pointerup', this.handlePointerUp, { passive: false });
            document.addEventListener('pointercancel', this.handlePointerCancel, { passive: false });
            
            // Listen for configuration changes
            window.addEventListener('storage', (event) => {
                if (event.key === 'alejo_gesture_config') {
                    this.loadConfig();
                }
            });
        }
        
        /**
         * Connect to WebSocket for real-time communication with backend
         */
        connectWebSocket() {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/gestures`;
                
                this.websocket = new WebSocket(wsUrl);
                
                this.websocket.onopen = () => {
                    this.log('WebSocket connection established');
                    this.sendMessage({
                        type: 'client_ready',
                        clientInfo: {
                            userAgent: navigator.userAgent,
                            screenWidth: window.innerWidth,
                            screenHeight: window.innerHeight
                        }
                    });
                };
                
                this.websocket.onmessage = this.handleWebSocketMessage;
                
                this.websocket.onclose = () => {
                    this.log('WebSocket connection closed');
                    // Try to reconnect after a delay
                    setTimeout(() => this.connectWebSocket(), 3000);
                };
                
                this.websocket.onerror = (error) => {
                    this.log('WebSocket error:', error);
                };
            } catch (error) {
                this.log('Error connecting to WebSocket:', error);
            }
        }
        
        /**
         * Handle incoming WebSocket messages
         * @param {MessageEvent} event - WebSocket message event
         */
        handleWebSocketMessage(event) {
            try {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'config_update':
                        this.updateConfig(message.config);
                        break;
                        
                    case 'gesture_feedback':
                        this.provideFeedback(message.feedback);
                        break;
                        
                    case 'ui_update':
                        this.handleUIUpdate(message.update);
                        break;
                }
            } catch (error) {
                this.log('Error handling WebSocket message:', error);
            }
        }
        
        /**
         * Handle pointer down events
         * @param {PointerEvent} event - Pointer down event
         */
        handlePointerDown(event) {
            if (!this.config.enabled) return;
            
            // Store touch point
            this.touchPoints.push({
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                target: event.target,
                timestamp: Date.now()
            });
            
            // Check for double tap
            if (this.touchPoints.length === 1) {
                const now = Date.now();
                if (this.lastTap && (now - this.lastTap) < this.config.doubleTapTimeout) {
                    this.recognizeGesture('double_tap', event.target);
                    this.lastTap = null;
                } else {
                    this.lastTap = now;
                    
                    // Start hold timer
                    this.holdTimer = setTimeout(() => {
                        this.recognizeGesture('hold', event.target);
                    }, this.config.holdTimeout);
                }
            }
            
            // Prevent default behavior for gesture-enabled elements
            if (this.isGestureEnabledElement(event.target)) {
                event.preventDefault();
            }
        }
        
        /**
         * Handle pointer move events
         * @param {PointerEvent} event - Pointer move event
         */
        handlePointerMove(event) {
            if (!this.config.enabled || this.touchPoints.length === 0) return;
            
            // Update touch point
            const index = this.touchPoints.findIndex(tp => tp.id === event.pointerId);
            if (index >= 0) {
                const prevX = this.touchPoints[index].x;
                const prevY = this.touchPoints[index].y;
                
                this.touchPoints[index].x = event.clientX;
                this.touchPoints[index].y = event.clientY;
                
                // Clear hold timer if moved too much
                if (this.holdTimer && 
                    Math.abs(event.clientX - prevX) > 10 || 
                    Math.abs(event.clientY - prevY) > 10) {
                    clearTimeout(this.holdTimer);
                    this.holdTimer = null;
                }
                
                // Detect gestures based on movement
                if (this.touchPoints.length === 1) {
                    // Possible swipe
                    const dx = event.clientX - prevX;
                    const dy = event.clientY - prevY;
                    
                    if (Math.abs(dx) > this.config.minSwipeDistance || 
                        Math.abs(dy) > this.config.minSwipeDistance) {
                        
                        let direction;
                        if (Math.abs(dx) > Math.abs(dy)) {
                            direction = dx > 0 ? 'right' : 'left';
                        } else {
                            direction = dy > 0 ? 'down' : 'up';
                        }
                        
                        this.recognizeGesture('swipe', event.target, { direction });
                    }
                } else if (this.touchPoints.length === 2) {
                    // Possible pinch/spread
                    const otherIndex = index === 0 ? 1 : 0;
                    const otherPoint = this.touchPoints[otherIndex];
                    
                    const prevDist = Math.hypot(
                        prevX - otherPoint.x,
                        prevY - otherPoint.y
                    );
                    
                    const currentDist = Math.hypot(
                        event.clientX - otherPoint.x,
                        event.clientY - otherPoint.y
                    );
                    
                    if (Math.abs(currentDist - prevDist) > this.config.minPinchDistance) {
                        const gestureType = currentDist < prevDist ? 'pinch' : 'spread';
                        this.recognizeGesture(gestureType, event.target, { 
                            magnitude: Math.abs(currentDist - prevDist) / 100
                        });
                    }
                }
            }
            
            // Prevent default behavior for gesture-enabled elements
            if (this.isGestureEnabledElement(event.target)) {
                event.preventDefault();
            }
        }
        
        /**
         * Handle pointer up events
         * @param {PointerEvent} event - Pointer up event
         */
        handlePointerUp(event) {
            if (!this.config.enabled) return;
            
            // Clear hold timer
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            // Remove touch point
            const index = this.touchPoints.findIndex(tp => tp.id === event.pointerId);
            if (index >= 0) {
                // Check for tap (if no other gestures were recognized)
                const touchPoint = this.touchPoints[index];
                const now = Date.now();
                const duration = now - touchPoint.timestamp;
                
                if (duration < this.config.holdTimeout && 
                    Math.abs(event.clientX - touchPoint.x) < 10 && 
                    Math.abs(event.clientY - touchPoint.y) < 10) {
                    this.recognizeGesture('tap', event.target);
                }
                
                this.touchPoints.splice(index, 1);
            }
        }
        
        /**
         * Handle pointer cancel events
         * @param {PointerEvent} event - Pointer cancel event
         */
        handlePointerCancel(event) {
            if (!this.config.enabled) return;
            
            // Clear hold timer
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            // Remove touch point
            const index = this.touchPoints.findIndex(tp => tp.id === event.pointerId);
            if (index >= 0) {
                this.touchPoints.splice(index, 1);
            }
        }
        
        /**
         * Recognize a gesture and process it
         * @param {string} type - Type of gesture
         * @param {Element} target - Target element
         * @param {Object} details - Additional gesture details
         */
        recognizeGesture(type, target, details = {}) {
            // Find the closest gesture-enabled element
            const element = this.findClosestGestureElement(target);
            if (!element) return;
            
            // Get gesture action from element
            const action = element.dataset.gestureAction || 'default';
            
            // Create gesture event
            const gestureEvent = {
                type,
                action,
                elementId: element.id || null,
                timestamp: Date.now(),
                confidence: 0.9, // Could be calculated based on gesture clarity
                ...details
            };
            
            // Add to sequence
            this.addToGestureSequence(gestureEvent);
            
            // Send to server
            this.sendGestureEvent(gestureEvent);
            
            // Provide visual feedback
            this.provideFeedback({
                type: 'gesture_recognized',
                gesture: type,
                element: element.id || null
            });
            
            // Announce for accessibility
            this.announceGesture(type, action);
        }
        
        /**
         * Add a gesture to the current sequence
         * @param {Object} gesture - Gesture event
         */
        addToGestureSequence(gesture) {
            // Clear timeout if exists
            if (this.sequenceTimeout) {
                clearTimeout(this.sequenceTimeout);
            }
            
            // Add to sequence
            this.gestureSequence.push(gesture);
            
            // Set timeout to clear sequence
            this.sequenceTimeout = setTimeout(() => {
                if (this.gestureSequence.length > 1) {
                    this.sendGestureSequence(this.gestureSequence);
                }
                this.gestureSequence = [];
            }, this.config.gestureTimeout);
        }
        
        /**
         * Send a gesture event to the server
         * @param {Object} gesture - Gesture event
         */
        sendGestureEvent(gesture) {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
            
            this.sendMessage({
                type: 'gesture_event',
                gesture
            });
        }
        
        /**
         * Send a gesture sequence to the server
         * @param {Array} sequence - Sequence of gestures
         */
        sendGestureSequence(sequence) {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
            
            this.sendMessage({
                type: 'gesture_sequence',
                sequence
            });
        }
        
        /**
         * Send a message through the WebSocket
         * @param {Object} message - Message to send
         */
        sendMessage(message) {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
            
            try {
                this.websocket.send(JSON.stringify(message));
            } catch (error) {
                this.log('Error sending message:', error);
            }
        }
        
        /**
         * Update configuration
         * @param {Object} config - New configuration
         */
        updateConfig(config) {
            this.config = { ...this.config, ...config };
            this.saveConfig();
            this.log('Configuration updated:', this.config);
        }
        
        /**
         * Provide visual feedback for gestures
         * @param {Object} feedback - Feedback details
         */
        provideFeedback(feedback) {
            // Skip if debug mode is off
            if (!this.config.debugMode) return;
            
            // Create feedback element if it doesn't exist
            let feedbackEl = document.getElementById('gesture-feedback');
            if (!feedbackEl) {
                feedbackEl = document.createElement('div');
                feedbackEl.id = 'gesture-feedback';
                feedbackEl.style.position = 'fixed';
                feedbackEl.style.bottom = '20px';
                feedbackEl.style.right = '20px';
                feedbackEl.style.padding = '10px';
                feedbackEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                feedbackEl.style.color = 'white';
                feedbackEl.style.borderRadius = '5px';
                feedbackEl.style.zIndex = '9999';
                feedbackEl.style.transition = 'opacity 0.3s';
                document.body.appendChild(feedbackEl);
            }
            
            // Update feedback content
            feedbackEl.textContent = `${feedback.type}: ${feedback.gesture || ''}`;
            feedbackEl.style.opacity = '1';
            
            // Hide after a delay
            setTimeout(() => {
                feedbackEl.style.opacity = '0';
            }, 2000);
        }
        
        /**
         * Announce a gesture for accessibility
         * @param {string} type - Type of gesture
         * @param {string} action - Action associated with gesture
         */
        announceGesture(type, action) {
            const announcer = document.getElementById('gesture-announcer');
            if (!announcer) return;
            
            announcer.textContent = `${type} gesture recognized for ${action} action`;
        }
        
        /**
         * Register elements that support gesture interaction
         * @param {NodeList|Array} elements - Elements to register
         */
        registerGestureElements(elements) {
            this.gestureElements = Array.from(elements);
            
            // Send to server
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                const elementData = this.gestureElements.map(el => ({
                    id: el.id || null,
                    action: el.dataset.gestureAction || 'default'
                }));
                
                this.sendMessage({
                    type: 'register_elements',
                    elements: elementData
                });
            }
            
            this.log(`Registered ${this.gestureElements.length} gesture elements`);
        }
        
        /**
         * Find the closest gesture-enabled element
         * @param {Element} target - Target element
         * @returns {Element|null} - Closest gesture-enabled element
         */
        findClosestGestureElement(target) {
            let element = target;
            
            while (element && element !== document.body) {
                if (element.classList.contains('gesture-enabled')) {
                    return element;
                }
                element = element.parentElement;
            }
            
            return null;
        }
        
        /**
         * Check if an element is gesture-enabled
         * @param {Element} target - Target element
         * @returns {boolean} - Whether the element is gesture-enabled
         */
        isGestureEnabledElement(target) {
            return this.findClosestGestureElement(target) !== null;
        }
        
        /**
         * Log a message to the console if debug mode is enabled
         * @param {...any} args - Arguments to log
         */
        log(...args) {
            if (this.config.debugMode) {
                console.log('[ALEJO Gesture]', ...args);
            }
        }
    }
    
    // Initialize the gesture handler when the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        const gestureHandler = new GestureHandler();
        ALEJO.gestureHandler = gestureHandler;
        gestureHandler.init();
    });
})();
