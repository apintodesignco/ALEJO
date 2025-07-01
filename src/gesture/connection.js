/**
 * ALEJO Gesture WebSocket Connection Module
 * 
 * Handles communication with the ALEJO gesture backend service.
 * Implements connection pooling, auto-reconnect, and message batching
 * for improved performance and reliability.
 */

import { publish, subscribe } from '../core/events.js';

// Connection state
let socket = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // ms

// Message batching for performance optimization
let messageQueue = [];
let batchSendInterval = null;
const BATCH_INTERVAL = 100; // ms

/**
 * Connect to the gesture recognition backend
 */
export async function connectToGestureBackend() {
  console.log('Connecting to gesture backend service');
  
  if (socket && isConnected) {
    console.log('Already connected to gesture backend');
    return true;
  }
  
  try {
    // Determine backend URL (use secure WebSocket in production)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    const wsUrl = `${protocol}//${host}:${port}/ws/gesture`;
    
    // Create WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Set up event handlers
    socket.addEventListener('open', handleSocketOpen);
    socket.addEventListener('message', handleSocketMessage);
    socket.addEventListener('close', handleSocketClose);
    socket.addEventListener('error', handleSocketError);
    
    // Wait for connection to establish
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener('open', onOpen);
        resolve();
      };
      
      const onError = (error) => {
        socket.removeEventListener('error', onError);
        reject(error);
      };
      
      socket.addEventListener('open', onOpen);
      socket.addEventListener('error', onError);
      
      // Set connection timeout
      const timeout = setTimeout(() => {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onError);
        reject(new Error('Connection timeout'));
      }, 5000);
    });
    
    // Subscribe to gesture events to forward to backend
    subscribe('gesture:detected', sendGestureData);
    
    console.log('Connected to gesture backend service');
    return true;
  } catch (error) {
    console.error('Failed to connect to gesture backend:', error);
    
    // Attempt to reconnect
    scheduleReconnect();
    
    return false;
  }
}

/**
 * Handle WebSocket open event
 */
function handleSocketOpen() {
  isConnected = true;
  reconnectAttempts = 0;
  
  // Publish connection status
  publish('gesture:connection', {
    status: 'connected',
    timestamp: Date.now()
  });
  
  console.log('Gesture backend connection established');
  
  // Start batched message sending
  startMessageBatching();
  
  // Send initial connection info
  const info = {
    type: 'connect',
    client: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    },
    timestamp: Date.now()
  };
  
  sendToSocket(info);
}

/**
 * Handle WebSocket message event
 */
function handleSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    // Process different message types
    switch (data.type) {
      case 'gesture_feedback':
        // Gesture processing feedback from backend
        publish('gesture:feedback', data);
        break;
        
      case 'config_update':
        // Configuration updates from backend
        publish('gesture:config', data.config);
        break;
        
      case 'command':
        // Command from backend
        publish('gesture:command', data.command);
        break;
        
      case 'ping':
        // Ping-pong to keep connection alive
        sendToSocket({ type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        // Forward other messages to general event
        publish('gesture:message', data);
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
  }
}

/**
 * Handle WebSocket close event
 */
function handleSocketClose(event) {
  isConnected = false;
  
  // Stop batched sending
  stopMessageBatching();
  
  // Publish disconnection status
  publish('gesture:connection', {
    status: 'disconnected',
    code: event.code,
    reason: event.reason,
    timestamp: Date.now()
  });
  
  console.log(`Gesture backend connection closed: ${event.code} ${event.reason}`);
  
  // Attempt to reconnect if not a deliberate closure
  if (event.code !== 1000) {
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket error event
 */
function handleSocketError(error) {
  console.error('Gesture backend connection error:', error);
  
  // Publish error status
  publish('gesture:connection', {
    status: 'error',
    error: error.message || 'Connection error',
    timestamp: Date.now()
  });
}

/**
 * Schedule WebSocket reconnection attempt
 */
function scheduleReconnect() {
  // Clear any existing reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // Increment reconnect attempts
  reconnectAttempts++;
  
  // Check if max attempts reached
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.log('Maximum reconnection attempts reached');
    
    // Publish final disconnection status
    publish('gesture:connection', {
      status: 'disconnected_final',
      attempts: reconnectAttempts,
      timestamp: Date.now()
    });
    
    return;
  }
  
  // Calculate exponential backoff delay
  const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1);
  
  console.log(`Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);
  
  // Publish reconnecting status
  publish('gesture:connection', {
    status: 'reconnecting',
    attempt: reconnectAttempts,
    delay: delay,
    timestamp: Date.now()
  });
  
  // Schedule reconnect
  reconnectTimeout = setTimeout(() => {
    connectToGestureBackend();
  }, delay);
}

/**
 * Send gesture data to backend
 */
function sendGestureData(gestureData) {
  if (!isConnected) return;
  
  const message = {
    type: 'gesture',
    data: gestureData,
    timestamp: Date.now()
  };
  
  // Add to batch queue instead of sending immediately
  messageQueue.push(message);
}

/**
 * Start batched message sending
 */
function startMessageBatching() {
  // Clear any existing interval
  stopMessageBatching();
  
  // Start new batch send interval
  batchSendInterval = setInterval(sendBatchedMessages, BATCH_INTERVAL);
}

/**
 * Stop batched message sending
 */
function stopMessageBatching() {
  if (batchSendInterval) {
    clearInterval(batchSendInterval);
    batchSendInterval = null;
  }
}

/**
 * Send batched messages
 */
function sendBatchedMessages() {
  if (!isConnected || messageQueue.length === 0) return;
  
  // If only one message, send directly
  if (messageQueue.length === 1) {
    sendToSocket(messageQueue[0]);
  } else {
    // Send as a batch
    sendToSocket({
      type: 'batch',
      messages: messageQueue,
      count: messageQueue.length,
      timestamp: Date.now()
    });
  }
  
  // Clear the queue
  messageQueue = [];
}

/**
 * Send data to WebSocket
 */
function sendToSocket(data) {
  if (!socket || !isConnected) return false;
  
  try {
    socket.send(JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error sending data to gesture backend:', error);
    return false;
  }
}

/**
 * Disconnect from gesture backend
 */
export function disconnectFromGestureBackend() {
  // Clear reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Stop batched sending
  stopMessageBatching();
  
  // Close socket if open
  if (socket) {
    if (isConnected) {
      // Send disconnect message before closing
      try {
        socket.send(JSON.stringify({
          type: 'disconnect',
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Error sending disconnect message:', error);
      }
    }
    
    try {
      socket.close(1000, 'User disconnected');
    } catch (error) {
      console.warn('Error closing socket:', error);
    }
    
    socket = null;
  }
  
  isConnected = false;
  
  console.log('Disconnected from gesture backend');
  
  return true;
}

/**
 * Get current connection status
 */
export function getConnectionStatus() {
  return {
    connected: isConnected,
    reconnectAttempts: reconnectAttempts
  };
}
