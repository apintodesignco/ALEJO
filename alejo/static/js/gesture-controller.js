/**
 * ALEJO Gesture Controller System
 *
 * Connects the frontend gesture system with the backend WebSocket handler,
 * integrating with accessibility modules for a complete production-ready system.
 * Supports 100% local inference with no external dependencies.
 *
 * @module gesture-controller
 * @requires gesture-accessibility-core.js
 * @requires gesture-accessibility-enhanced.js
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};

    /**
     * GestureController class
     * Manages gesture detection, WebSocket communication, and accessibility integration
     */
    class GestureController {
        /**
         * Creates a new instance of the gesture controller
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            this.config = {
                webSocketUrl: options.webSocketUrl || 'ws://localhost:8765',
                enableLogging: options.enableLogging !== undefined ? options.enableLogging : true,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 5,
                gestureThreshold: options.gestureThreshold || 0.75,
                accessibilityEnabled: options.accessibilityEnabled !== undefined ? options.accessibilityEnabled : true
            };

            // Initialize state
            this.socket = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pendingGestures = [];
            this.isProcessingGesture = false;
            this.gestureTypes = ['swipe', 'tap', 'hold', 'pinch', 'rotate', 'wave'];
            
            // Initialize accessibility
            if (this.config.accessibilityEnabled) {
                this.accessibility = new ALEJO.GestureAccessibilityEnhanced({
                    enabled: true
                });
            }

            // Bind methods
            this.connect = this.connect.bind(this);
            this.disconnect = this.disconnect.bind(this);
            this.sendGestureEvent = this.sendGestureEvent.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            this.handleGestureDetection = this.handleGestureDetection.bind(this);
            
            // Initialize WebSocket connection
            this.connect();
        }

        /**
         * Establishes WebSocket connection to the backend
         */
        connect() {
            try {
                this.socket = new WebSocket(this.config.webSocketUrl);
                
                this.socket.onopen = () => {
                    this.log('WebSocket connection established');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send any pending gestures
                    this.processPendingGestures();
                    
                    // Announce connection to screen readers if accessibility is enabled
                    if (this.accessibility) {
                        this.accessibility.announce('Gesture system connected');
                    }
                };
                
                this.socket.onmessage = this.handleMessage;
                
                this.socket.onclose = () => {
                    this.log('WebSocket connection closed');
                    this.connected = false;
                    
                    // Attempt to reconnect if we haven't exceeded max attempts
                    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        setTimeout(this.connect, this.config.reconnectInterval);
                        this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
                    } else {
                        this.log('Max reconnection attempts reached');
                        if (this.accessibility) {
                            this.accessibility.announce('Gesture system disconnected. Please refresh the page.');
                        }
                    }
                };
                
                this.socket.onerror = (error) => {
                    this.log('WebSocket error', error);
                };
            } catch (error) {
                this.log('Error connecting to WebSocket', error);
            }
        }
        
        /**
         * Disconnects from the WebSocket server
         */
        disconnect() {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            }
        }
        
        /**
         * Handles incoming messages from the WebSocket server
         * @param {MessageEvent} event - WebSocket message event
         */
        handleMessage(event) {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'ack':
                        this.log('Gesture acknowledged by server:', data.message);
                        break;
                    
                    case 'error':
                        this.log('Error from server:', data.message);
                        if (this.accessibility) {
                            this.accessibility.announce(`Gesture error: ${data.message}`);
                        }
                        break;
                        
                    case 'action':
                        this.log('Action received:', data.action);
                        this.processAction(data.action, data.payload);
                        break;
                        
                    default:
                        this.log('Unknown message type:', data.type);
                }
            } catch (error) {
                this.log('Error processing message', error);
            }
        }
        
        /**
         * Sends a gesture event to the server
         * @param {Object} gestureData - Gesture data to send
         */
        sendGestureEvent(gestureData) {
            // Validate gesture data
            if (!gestureData || !gestureData.type || !this.gestureTypes.includes(gestureData.type)) {
                this.log('Invalid gesture data');
                return false;
            }
            
            // Add timestamp if not present
            if (!gestureData.timestamp) {
                gestureData.timestamp = new Date().toISOString();
            }
            
            // Send if connected, otherwise queue it
            if (this.connected && this.socket.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'gesture',
                    data: gestureData
                };
                
                try {
                    this.socket.send(JSON.stringify(message));
                    this.log('Gesture sent:', gestureData.type);
                    return true;
                } catch (error) {
                    this.log('Error sending gesture', error);
                    return false;
                }
            } else {
                this.pendingGestures.push(gestureData);
                this.log('Gesture queued:', gestureData.type);
                return false;
            }
        }
        
        /**
         * Processes pending gestures when connection is established
         */
        processPendingGestures() {
            if (this.isProcessingGesture || this.pendingGestures.length === 0) return;
            
            this.isProcessingGesture = true;
            
            // Process one gesture at a time to prevent flooding
            const gesture = this.pendingGestures.shift();
            this.sendGestureEvent(gesture);
            
            // Allow time for server to process before sending the next one
            setTimeout(() => {
                this.isProcessingGesture = false;
                this.processPendingGestures();
            }, 100);
        }
        
        /**
         * Handles gesture detection from sensors or input devices
         * @param {string} gestureType - Type of gesture detected
         * @param {Object} gestureDetails - Additional gesture information
         * @param {Element} targetElement - DOM element that triggered the gesture
         */
        handleGestureDetection(gestureType, gestureDetails = {}, targetElement = null) {
            if (!gestureType || !this.gestureTypes.includes(gestureType)) {
                this.log('Invalid gesture type:', gestureType);
                return;
            }
            
            // Get target element information
            const targetInfo = targetElement ? {
                id: targetElement.id || null,
                tagName: targetElement.tagName || null,
                className: targetElement.className || null
            } : null;
            
            // Create gesture data object
            const gestureData = {
                type: gestureType,
                timestamp: new Date().toISOString(),
                target: targetInfo,
                details: gestureDetails,
                context: {
                    path: window.location.pathname,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight
                }
            };
            
            // Send the gesture event
            this.sendGestureEvent(gestureData);
            
            // Announce gesture to screen readers if accessibility is enabled
            if (this.accessibility) {
                this.accessibility.announce(`${gestureType} gesture detected`);
            }
        }
        
        /**
         * Processes an action received from the server
         * @param {string} actionType - Type of action to perform
         * @param {Object} payload - Action payload
         */
        processAction(actionType, payload = {}) {
            switch (actionType) {
                case 'navigation.previous':
                case 'navigation.next':
                    if (this.accessibility) {
                        this.accessibility.handleNavigation(actionType);
                    }
                    break;
                    
                case 'ui.focus':
                    if (this.accessibility && payload.elementId) {
                        this.accessibility.focusElement(payload.elementId);
                    }
                    break;
                    
                case 'ui.announce':
                    if (this.accessibility && payload.message) {
                        this.accessibility.announce(payload.message);
                    }
                    break;
                    
                default:
                    this.log('Unhandled action type:', actionType);
            }
        }
        
        /**
         * Logs messages to console if logging is enabled
         */
        log(...args) {
            if (this.config.enableLogging) {
                console.log('[GestureController]', ...args);
            }
        }
    }

    // Export the controller to ALEJO namespace
    ALEJO.GestureController = GestureController;
})();
