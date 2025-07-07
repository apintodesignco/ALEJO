/**
 * ALEJO Python Bridge
 * 
 * Utility for communicating between JavaScript and Python code,
 * particularly for ML model interaction.
 * 
 * This bridge uses a WebSocket connection to communicate with a Python backend
 * that can load and run TensorFlow models.
 */

import { publish } from '../core/events.js';

// Default configuration
const DEFAULT_CONFIG = {
  wsUrl: 'ws://localhost:8765',
  timeout: 5000,
  reconnectInterval: 2000,
  maxReconnectAttempts: 5
};

/**
 * Python Bridge for ML model communication
 */
export class PythonBridge {
  /**
   * Create a new Python Bridge
   * @param {Object} options - Configuration options
   * @param {String} options.module - Python module name
   * @param {String} options.className - Python class name
   * @param {String} options.wsUrl - WebSocket URL
   * @param {Number} options.timeout - Request timeout in ms
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.ws = null;
    this.isConnected = false;
    this.isInitialized = false;
    this.reconnectAttempts = 0;
    this.pendingRequests = new Map();
    this.requestId = 1;
    this.module = options.module;
    this.className = options.className;
    this.instanceId = null;
  }

  /**
   * Initialize the bridge and connect to the Python backend
   * @returns {Promise} - Resolves when connected and initialized
   */
  async initialize() {
    try {
      // Connect to WebSocket
      await this.connect();
      
      // Create an instance of the Python class
      const result = await this.sendRequest('create_instance', {
        module: this.module,
        class_name: this.className
      });
      
      if (result.success) {
        this.instanceId = result.instance_id;
        this.isInitialized = true;
        console.log(`Python bridge initialized with instance ID: ${this.instanceId}`);
        return true;
      } else {
        throw new Error(`Failed to create Python instance: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to initialize Python bridge:', error);
      throw error;
    }
  }

  /**
   * Connect to the Python WebSocket server
   * @returns {Promise} - Resolves when connected
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);
        
        // Set up event handlers
        this.ws.onopen = () => {
          console.log('Connected to Python WebSocket server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve(true);
        };
        
        this.ws.onclose = () => {
          console.log('Disconnected from Python WebSocket server');
          this.isConnected = false;
          this._handleDisconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!this.isConnected) {
            reject(error);
          }
        };
        
        this.ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };
        
        // Set timeout for connection
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, this.config.timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket disconnection
   * @private
   */
  _handleDisconnect() {
    // Clear pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();
    
    // Attempt to reconnect
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect()
          .then(() => {
            console.log('Reconnected to Python WebSocket server');
            publish('python:reconnected', { attempts: this.reconnectAttempts });
          })
          .catch(error => {
            console.error('Failed to reconnect:', error);
          });
      }, this.config.reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached');
      publish('python:connection_failed', { attempts: this.reconnectAttempts });
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {String} data - Message data
   * @private
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Check if this is a response to a request
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      } else {
        // Handle other message types
        if (message.type === 'event') {
          // Publish event to ALEJO event system
          publish(`python:${message.event}`, message.data);
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Send a request to the Python backend
   * @param {String} method - Method name
   * @param {Object} params - Method parameters
   * @returns {Promise} - Resolves with the response
   */
  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to Python WebSocket server'));
        return;
      }
      
      // Create request ID
      const id = this.requestId++;
      
      // Store promise callbacks
      this.pendingRequests.set(id, { resolve, reject });
      
      // Create request message
      const request = {
        id,
        method,
        params
      };
      
      // Send request
      this.ws.send(JSON.stringify(request));
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, this.config.timeout);
    });
  }

  /**
   * Call a method on the Python instance
   * @param {String} method - Method name
   * @param {...any} args - Method arguments
   * @returns {Promise} - Resolves with the result
   */
  async call(method, ...args) {
    if (!this.isInitialized) {
      throw new Error('Python bridge not initialized');
    }
    
    try {
      const result = await this.sendRequest('call_method', {
        instance_id: this.instanceId,
        method,
        args
      });
      
      return result;
    } catch (error) {
      console.error(`Error calling Python method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Close the WebSocket connection
   */
  async close() {
    if (this.isInitialized && this.instanceId) {
      try {
        // Clean up Python instance
        await this.sendRequest('destroy_instance', {
          instance_id: this.instanceId
        });
      } catch (error) {
        console.error('Error destroying Python instance:', error);
      }
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
    this.isInitialized = false;
  }
}
