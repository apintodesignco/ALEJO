/**
 * ALEJO Gesture WebSocket Module
 * 
 * Handles real-time communication between the client-side gesture system and the ALEJO backend.
 * This module establishes and maintains a WebSocket connection, handles message serialization,
 * reconnection logic, and provides a robust communication channel for gesture events.
 * 
 * @module gesture-websocket
 * @requires gesture-detection
 * @requires gesture-classifier
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureWebSocket class for communication with the backend
     */
    class GestureWebSocket {
        /**
         * Create a new GestureWebSocket
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                url: options.url || this._getDefaultWebSocketUrl(),
                reconnectInterval: options.reconnectInterval || 2000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                heartbeatInterval: options.heartbeatInterval || 30000,
                debug: options.debug || false
            };
            
            // State tracking
            this.socket = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.reconnectTimer = null;
            this.heartbeatTimer = null;
            this.pendingMessages = [];
            this.messageQueue = [];
            this.messageIdCounter = 1;
            
            // Event callbacks
            this.callbacks = {
                onOpen: options.onOpen || null,
                onMessage: options.onMessage || null,
                onClose: options.onClose || null,
                onError: options.onError || null,
                onReconnect: options.onReconnect || null,
                onConfig: options.onConfig || null,
                onFeedback: options.onFeedback || null,
                onUIUpdate: options.onUIUpdate || null
            };
            
            // Client info
            this.clientInfo = {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                timestamp: Date.now()
            };
            
            // Initialize
            this.init();
        }
        
        /**
         * Initialize the WebSocket connection
         */
        init() {
            this.connect();
            
            // Set up unload handler to close connection gracefully
            window.addEventListener('beforeunload', () => {
                this.disconnect(1000, 'Page unloaded');
            });
            
            if (this.config.debug) {
                console.log('ALEJO GestureWebSocket initialized');
            }
        }
        
        /**
         * Get the default WebSocket URL based on current page
         * @returns {string} WebSocket URL
         * @private
         */
        _getDefaultWebSocketUrl() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            return `${protocol}//${host}/ws/gestures`;
        }
        
        /**
         * Connect to the WebSocket server
         */
        connect() {
            if (this.socket) {
                this.disconnect(1000, 'Reconnecting');
            }
            
            try {
                this.socket = new WebSocket(this.config.url);
                
                this.socket.onopen = (event) => this._handleOpen(event);
                this.socket.onmessage = (event) => this._handleMessage(event);
                this.socket.onclose = (event) => this._handleClose(event);
                this.socket.onerror = (event) => this._handleError(event);
                
                if (this.config.debug) {
                    console.log(`Connecting to WebSocket: ${this.config.url}`);
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('WebSocket connection error:', error);
                }
                this._scheduleReconnect();
            }
        }
        
        /**
         * Disconnect from the WebSocket server
         * @param {number} code - Close code
         * @param {string} reason - Close reason
         */
        disconnect(code = 1000, reason = 'Normal closure') {
            if (this.socket) {
                try {
                    this.socket.close(code, reason);
                } catch (error) {
                    if (this.config.debug) {
                        console.error('Error closing WebSocket:', error);
                    }
                }
                this.socket = null;
            }
            
            this.connected = false;
            
            // Clear timers
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
            
            if (this.config.debug) {
                console.log(`WebSocket disconnected: ${code} - ${reason}`);
            }
        }
        
        /**
         * Handle WebSocket open event
         * @param {Event} event - Open event
         * @private
         */
        _handleOpen(event) {
            this.connected = true;
            this.reconnectAttempts = 0;
            
            // Start heartbeat
            this._startHeartbeat();
            
            // Send client ready message
            this.sendClientReady();
            
            // Process any pending messages
            this._processPendingMessages();
            
            if (this.callbacks.onOpen) {
                this.callbacks.onOpen(event);
            }
            
            if (this.config.debug) {
                console.log('WebSocket connection established');
            }
        }
        
        /**
         * Handle WebSocket message event
         * @param {MessageEvent} event - Message event
         * @private
         */
        _handleMessage(event) {
            try {
                const message = JSON.parse(event.data);
                
                // Process different message types
                switch (message.type) {
                    case 'config_update':
                        this._handleConfigUpdate(message);
                        break;
                        
                    case 'gesture_ack':
                        this._handleAcknowledgment(message);
                        break;
                        
                    case 'sequence_ack':
                        this._handleAcknowledgment(message);
                        break;
                        
                    case 'elements_registered':
                        this._handleAcknowledgment(message);
                        break;
                        
                    case 'gesture_feedback':
                        this._handleGestureFeedback(message);
                        break;
                        
                    case 'ui_update':
                        this._handleUIUpdate(message);
                        break;
                        
                    case 'heartbeat':
                        // Heartbeat response, no action needed
                        break;
                        
                    default:
                        if (this.callbacks.onMessage) {
                            this.callbacks.onMessage(message);
                        }
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error parsing WebSocket message:', error);
                }
            }
        }
        
        /**
         * Handle WebSocket close event
         * @param {CloseEvent} event - Close event
         * @private
         */
        _handleClose(event) {
            this.connected = false;
            
            // Clear heartbeat timer
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
            
            if (this.callbacks.onClose) {
                this.callbacks.onClose(event);
            }
            
            // Attempt to reconnect if not a normal closure
            if (event.code !== 1000) {
                this._scheduleReconnect();
            }
            
            if (this.config.debug) {
                console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
            }
        }
        
        /**
         * Handle WebSocket error event
         * @param {Event} event - Error event
         * @private
         */
        _handleError(event) {
            if (this.callbacks.onError) {
                this.callbacks.onError(event);
            }
            
            if (this.config.debug) {
                console.error('WebSocket error:', event);
            }
        }
        
        /**
         * Schedule a reconnection attempt
         * @private
         */
        _scheduleReconnect() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
                const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts);
                
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectAttempts++;
                    
                    if (this.callbacks.onReconnect) {
                        this.callbacks.onReconnect({
                            attempt: this.reconnectAttempts,
                            max: this.config.maxReconnectAttempts
                        });
                    }
                    
                    if (this.config.debug) {
                        console.log(`Reconnecting... Attempt ${this.reconnectAttempts} of ${this.config.maxReconnectAttempts}`);
                    }
                    
                    this.connect();
                }, delay);
            } else {
                if (this.config.debug) {
                    console.error(`Maximum reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
                }
            }
        }
        
        /**
         * Start the heartbeat interval
         * @private
         */
        _startHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
            }
            
            this.heartbeatTimer = setInterval(() => {
                this.sendHeartbeat();
            }, this.config.heartbeatInterval);
        }
        
        /**
         * Process any pending messages in the queue
         * @private
         */
        _processPendingMessages() {
            if (!this.connected || this.pendingMessages.length === 0) {
                return;
            }
            
            // Clone and clear pending messages
            const messages = [...this.pendingMessages];
            this.pendingMessages = [];
            
            // Send each message
            messages.forEach(message => {
                this.send(message.type, message.data, message.id);
            });
        }
        
        /**
         * Handle config update message
         * @param {Object} message - Config message
         * @private
         */
        _handleConfigUpdate(message) {
            if (this.callbacks.onConfig) {
                this.callbacks.onConfig(message.config);
            }
            
            if (this.config.debug) {
                console.log('Received config update:', message.config);
            }
        }
        
        /**
         * Handle acknowledgment message
         * @param {Object} message - Acknowledgment message
         * @private
         */
        _handleAcknowledgment(message) {
            // Find and remove from message queue
            const messageId = message.message_id || message.gesture_id;
            if (messageId) {
                const index = this.messageQueue.findIndex(m => m.id === messageId);
                if (index !== -1) {
                    this.messageQueue.splice(index, 1);
                }
            }
            
            if (this.config.debug) {
                console.log(`Received acknowledgment: ${message.type}`, message);
            }
        }
        
        /**
         * Handle gesture feedback message
         * @param {Object} message - Feedback message
         * @private
         */
        _handleGestureFeedback(message) {
            if (this.callbacks.onFeedback) {
                this.callbacks.onFeedback(message.feedback);
            }
            
            if (this.config.debug) {
                console.log('Received gesture feedback:', message.feedback);
            }
        }
        
        /**
         * Handle UI update message
         * @param {Object} message - UI update message
         * @private
         */
        _handleUIUpdate(message) {
            if (this.callbacks.onUIUpdate) {
                this.callbacks.onUIUpdate(message.update);
            }
            
            if (this.config.debug) {
                console.log('Received UI update:', message.update);
            }
        }
        
        /**
         * Send a message to the server
         * @param {string} type - Message type
         * @param {Object} data - Message data
         * @param {number|string} id - Message ID (optional)
         * @returns {number|string} Message ID
         */
        send(type, data = {}, id = null) {
            // Generate message ID if not provided
            const messageId = id || this.messageIdCounter++;
            
            // Create message
            const message = {
                type: type,
                ...data,
                message_id: messageId,
                timestamp: Date.now()
            };
            
            // Add to message queue for tracking
            this.messageQueue.push({
                id: messageId,
                type: type,
                timestamp: Date.now()
            });
            
            // Limit queue size
            if (this.messageQueue.length > 100) {
                this.messageQueue.shift();
            }
            
            // Send if connected, otherwise queue
            if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                    this.socket.send(JSON.stringify(message));
                    
                    if (this.config.debug) {
                        console.log(`Sent message: ${type}`, message);
                    }
                } catch (error) {
                    if (this.config.debug) {
                        console.error('Error sending WebSocket message:', error);
                    }
                    
                    // Queue for retry
                    this.pendingMessages.push({
                        type: type,
                        data: data,
                        id: messageId
                    });
                }
            } else {
                // Queue for later
                this.pendingMessages.push({
                    type: type,
                    data: data,
                    id: messageId
                });
                
                if (this.config.debug) {
                    console.log(`Queued message: ${type} (WebSocket not connected)`);
                }
            }
            
            return messageId;
        }
        
        /**
         * Send client ready message
         * @returns {number|string} Message ID
         */
        sendClientReady() {
            return this.send('client_ready', {
                clientInfo: this.clientInfo
            });
        }
        
        /**
         * Send heartbeat message
         * @returns {number|string} Message ID
         */
        sendHeartbeat() {
            return this.send('heartbeat', {
                timestamp: Date.now()
            });
        }
        
        /**
         * Send gesture event
         * @param {Object} gesture - Gesture event data
         * @returns {number|string} Message ID
         */
        sendGestureEvent(gesture) {
            return this.send('gesture_event', {
                gesture: gesture
            });
        }
        
        /**
         * Send gesture sequence
         * @param {Array} sequence - Sequence of gestures
         * @returns {number|string} Message ID
         */
        sendGestureSequence(sequence) {
            return this.send('gesture_sequence', {
                sequence: sequence
            });
        }
        
        /**
         * Register gesture-enabled elements
         * @param {Array} elements - Array of element data
         * @returns {number|string} Message ID
         */
        registerElements(elements) {
            return this.send('register_elements', {
                elements: elements
            });
        }
        
        /**
         * Reset the connection
         */
        reset() {
            this.disconnect(1000, 'Reset requested');
            this.pendingMessages = [];
            this.messageQueue = [];
            this.messageIdCounter = 1;
            this.reconnectAttempts = 0;
            
            setTimeout(() => {
                this.connect();
            }, 500);
        }
        
        /**
         * Destroy the WebSocket connection and clean up resources
         */
        destroy() {
            this.disconnect(1000, 'Connection destroyed');
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            window.removeEventListener('beforeunload', this._handleUnload);
            
            if (this.config.debug) {
                console.log('ALEJO GestureWebSocket destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureWebSocket = GestureWebSocket;
})();
