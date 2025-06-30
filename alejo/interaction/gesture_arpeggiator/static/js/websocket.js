/**
 * ALEJO Gesture Arpeggiator - WebSocket Manager
 * 
 * Handles WebSocket communication between the client and server,
 * with automatic reconnection and message handling.
 */

class WebSocketManager {
    /**
     * Initialize the WebSocket manager
     * @param {string} url - WebSocket URL to connect to
     */
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second delay
        
        // Event handlers (to be set by the application)
        this.onOpen = () => {};
        this.onClose = () => {};
        this.onMessage = () => {};
        this.onError = () => {};
        
        // Message queue for messages sent before connection is established
        this.messageQueue = [];
    }
    
    /**
     * Connect to the WebSocket server
     * @returns {Promise} Resolves when connected, rejects on failure
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
                resolve();
                return;
            }
            
            if (this.isConnecting) {
                reject(new Error('Connection already in progress'));
                return;
            }
            
            this.isConnecting = true;
            
            try {
                console.log(`Connecting to WebSocket at ${this.url}`);
                this.socket = new WebSocket(this.url);
                
                this.socket.onopen = (event) => {
                    console.log('WebSocket connection established');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = 1000;
                    
                    // Send any queued messages
                    while (this.messageQueue.length > 0) {
                        const message = this.messageQueue.shift();
                        this.send(message);
                    }
                    
                    this.onOpen(event);
                    resolve();
                };
                
                this.socket.onclose = (event) => {
                    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
                    this.isConnecting = false;
                    this.socket = null;
                    
                    // Attempt to reconnect if not closed cleanly
                    if (event.code !== 1000 && event.code !== 1001) {
                        this.scheduleReconnect();
                    }
                    
                    this.onClose(event);
                };
                
                this.socket.onmessage = (event) => {
                    this.onMessage(event.data);
                };
                
                this.socket.onerror = (event) => {
                    console.error('WebSocket error:', event);
                    this.isConnecting = false;
                    this.onError(event);
                    reject(new Error('WebSocket connection error'));
                };
            } catch (error) {
                console.error('Error creating WebSocket:', error);
                this.isConnecting = false;
                reject(error);
            }
        });
    }
    
    /**
     * Schedule a reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Maximum reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect().catch((error) => {
                console.error('Reconnection failed:', error);
            });
        }, delay);
    }
    
    /**
     * Send a message to the server
     * @param {object|string} message - Message to send
     * @returns {boolean} True if sent or queued, false if failed
     */
    send(message) {
        // Convert object to JSON string if necessary
        const data = typeof message === 'object' ? JSON.stringify(message) : message;
        
        // If socket is open, send immediately
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(data);
                return true;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                return false;
            }
        } 
        // Otherwise queue the message for later
        else {
            console.log('Socket not ready, queueing message');
            this.messageQueue.push(data);
            
            // Try to connect if not already connecting
            if (!this.isConnecting && (!this.socket || this.socket.readyState === WebSocket.CLOSED)) {
                this.connect().catch((error) => {
                    console.error('Connection attempt failed:', error);
                });
            }
            
            return true;
        }
    }
    
    /**
     * Close the WebSocket connection
     * @param {number} code - Close code
     * @param {string} reason - Close reason
     */
    close(code = 1000, reason = 'Normal closure') {
        if (this.socket) {
            this.socket.close(code, reason);
        }
    }
    
    /**
     * Check if the WebSocket is connected
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
    
    /**
     * Get the current connection state
     * @returns {string} Connection state
     */
    getState() {
        if (!this.socket) {
            return 'CLOSED';
        }
        
        switch (this.socket.readyState) {
            case WebSocket.CONNECTING:
                return 'CONNECTING';
            case WebSocket.OPEN:
                return 'OPEN';
            case WebSocket.CLOSING:
                return 'CLOSING';
            case WebSocket.CLOSED:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }
}
