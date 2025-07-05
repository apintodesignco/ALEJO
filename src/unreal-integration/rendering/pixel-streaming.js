/**
 * ALEJO Unreal Engine Pixel Streaming Integration
 * 
 * This module handles the Pixel Streaming functionality for the Unreal Engine integration,
 * allowing high-quality rendering on a remote server with the output streamed to the client.
 * This enables complex UE content to run on lower-powered devices.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Connection states
const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed'
};

// Default configuration
const DEFAULT_CONFIG = {
  serverUrl: 'https://pixel-streaming.alejo.ai',
  signallingServerUrl: 'wss://signalling.alejo.ai',
  connectionTimeoutMs: 10000,
  reconnectAttempts: 3,
  fallbackEnabled: true
};

/**
 * Sets up Pixel Streaming for Unreal Engine content
 * @param {Object} config - Pixel Streaming configuration
 * @returns {Promise<Object>} - Initialized Pixel Streaming system
 */
export async function setupPixelStreaming(config = {}) {
  console.log('Setting up Unreal Engine Pixel Streaming');
  
  // Merge with default configuration
  const pixelStreamingConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Create video element for streaming
    const videoElement = document.createElement('video');
    videoElement.id = 'alejo-unreal-stream';
    videoElement.className = 'alejo-unreal-renderer';
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    
    // Apply initial styles
    Object.assign(videoElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'auto',
      display: 'block',
      backgroundColor: '#000'
    });
    
    // Create canvas for input overlay
    const inputCanvas = document.createElement('canvas');
    inputCanvas.id = 'alejo-unreal-input';
    inputCanvas.className = 'alejo-unreal-input-overlay';
    
    // Apply initial styles to input canvas
    Object.assign(inputCanvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '1',
      pointerEvents: 'none',
      display: 'block'
    });
    
    // Create container for video and input overlay
    const container = document.createElement('div');
    container.id = 'alejo-unreal-container';
    container.className = 'alejo-unreal-streaming-container';
    
    // Apply styles to container
    Object.assign(container.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    });
    
    // Add elements to container
    container.appendChild(videoElement);
    container.appendChild(inputCanvas);
    
    // Create WebRTC connection manager
    const connectionManager = createConnectionManager(videoElement, inputCanvas, pixelStreamingConfig);
    
    // Initialize connection
    await connectionManager.initialize();
    
    // Create and return the rendering system
    const renderingSystem = {
      type: 'pixel-streaming',
      container,
      videoElement,
      inputCanvas,
      connectionManager,
      config: pixelStreamingConfig,
      connectionState: CONNECTION_STATES.DISCONNECTED,
      
      /**
       * Attaches the streaming container to a parent element
       * @param {HTMLElement} parentElement - Parent element
       */
      attachToContainer(parentElement) {
        if (container.parentElement) {
          container.parentElement.removeChild(container);
        }
        
        parentElement.appendChild(container);
        this.handleResize();
      },
      
      /**
       * Handles window resize events
       */
      handleResize() {
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Update input canvas dimensions
        inputCanvas.width = width;
        inputCanvas.height = height;
        
        // Notify connection manager of resize
        connectionManager.handleResize(width, height);
      },
      
      /**
       * Handles application state changes
       * @param {Object} event - State change event
       */
      handleAppStateChange(event) {
        connectionManager.sendCommand('appState', event.state);
      },
      
      /**
       * Handles visibility changes
       * @param {string} visibilityState - Document visibility state
       */
      handleVisibilityChange(visibilityState) {
        const isVisible = visibilityState === 'visible';
        
        connectionManager.sendCommand('visibility', isVisible);
        
        // Pause streaming when not visible to save bandwidth
        if (!isVisible) {
          this.pauseRendering();
        } else {
          this.resumeRendering();
        }
      },
      
      /**
       * Updates performance settings
       * @param {Object} performanceSettings - New performance settings
       */
      updatePerformanceSettings(performanceSettings) {
        connectionManager.sendCommand('performanceSettings', performanceSettings);
      },
      
      /**
       * Updates accessibility settings
       * @param {Object} accessibilitySettings - New accessibility settings
       */
      updateAccessibilitySettings(accessibilitySettings) {
        connectionManager.sendCommand('accessibilitySettings', accessibilitySettings);
      },
      
      /**
       * Pauses rendering
       */
      pauseRendering() {
        videoElement.pause();
        connectionManager.sendCommand('pause');
      },
      
      /**
       * Resumes rendering
       */
      resumeRendering() {
        videoElement.play();
        connectionManager.sendCommand('resume');
      },
      
      /**
       * Connects to the Pixel Streaming server
       * @returns {Promise<void>}
       */
      async connect() {
        this.connectionState = CONNECTION_STATES.CONNECTING;
        publish('unreal:pixelstreaming:connecting');
        
        try {
          await connectionManager.connect();
          this.connectionState = CONNECTION_STATES.CONNECTED;
          publish('unreal:pixelstreaming:connected');
        } catch (error) {
          this.connectionState = CONNECTION_STATES.FAILED;
          publish('unreal:pixelstreaming:error', { error });
          throw error;
        }
      },
      
      /**
       * Disconnects from the Pixel Streaming server
       * @returns {Promise<void>}
       */
      async disconnect() {
        await connectionManager.disconnect();
        this.connectionState = CONNECTION_STATES.DISCONNECTED;
        publish('unreal:pixelstreaming:disconnected');
      },
      
      /**
       * Shuts down the rendering system
       * @returns {Promise<void>}
       */
      async shutdown() {
        await this.disconnect();
        
        if (container && container.parentElement) {
          container.parentElement.removeChild(container);
        }
      }
    };
    
    // Connect to the Pixel Streaming server
    await renderingSystem.connect();
    
    publish('unreal:rendering:initialized', { 
      type: renderingSystem.type
    });
    
    return renderingSystem;
  } catch (error) {
    console.error('Failed to set up Pixel Streaming:', error);
    publish('unreal:rendering:error', { error });
    throw error;
  }
}

/**
 * Creates a WebRTC connection manager for Pixel Streaming
 * @param {HTMLVideoElement} videoElement - Video element for streaming
 * @param {HTMLCanvasElement} inputCanvas - Canvas for input overlay
 * @param {Object} config - Pixel Streaming configuration
 * @returns {Object} - Connection manager
 */
function createConnectionManager(videoElement, inputCanvas, config) {
  let peerConnection = null;
  let signallingConnection = null;
  let dataChannel = null;
  let reconnectCount = 0;
  let reconnectTimeout = null;
  
  // Input handling state
  const inputState = {
    mouseDown: false,
    touchActive: false,
    lastPosition: { x: 0, y: 0 }
  };
  
  return {
    /**
     * Initializes the connection manager
     * @returns {Promise<void>}
     */
    async initialize() {
      // Set up input event listeners
      this.setupInputHandlers(inputCanvas);
    },
    
    /**
     * Connects to the Pixel Streaming server
     * @returns {Promise<void>}
     */
    async connect() {
      try {
        // Connect to signalling server
        await this.connectToSignallingServer();
        
        // Create and set up WebRTC peer connection
        await this.createPeerConnection();
        
        // Reset reconnect count on successful connection
        reconnectCount = 0;
      } catch (error) {
        console.error('Failed to connect to Pixel Streaming server:', error);
        
        // Attempt to reconnect if enabled
        if (reconnectCount < config.reconnectAttempts) {
          reconnectCount++;
          
          console.log(`Reconnecting to Pixel Streaming server (attempt ${reconnectCount}/${config.reconnectAttempts})...`);
          
          // Clear any existing timeout
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          // Reconnect after exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, reconnectCount - 1), 10000);
          
          return new Promise((resolve, reject) => {
            reconnectTimeout = setTimeout(async () => {
              try {
                await this.connect();
                resolve();
              } catch (reconnectError) {
                reject(reconnectError);
              }
            }, backoffMs);
          });
        }
        
        throw error;
      }
    },
    
    /**
     * Connects to the signalling server
     * @returns {Promise<void>}
     */
    async connectToSignallingServer() {
      return new Promise((resolve, reject) => {
        // Create WebSocket connection to signalling server
        signallingConnection = new WebSocket(config.signallingServerUrl);
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          if (signallingConnection && signallingConnection.readyState !== WebSocket.OPEN) {
            signallingConnection.close();
            reject(new Error('Connection to signalling server timed out'));
          }
        }, config.connectionTimeoutMs);
        
        // Handle WebSocket events
        signallingConnection.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('Connected to signalling server');
          resolve();
        };
        
        signallingConnection.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('Signalling server connection error:', error);
          reject(error);
        };
        
        signallingConnection.onclose = (event) => {
          console.log(`Signalling server connection closed: ${event.code} ${event.reason}`);
          this.handleSignallingDisconnect();
        };
        
        signallingConnection.onmessage = (event) => {
          this.handleSignallingMessage(event);
        };
      });
    },
    
    /**
     * Creates and sets up the WebRTC peer connection
     * @returns {Promise<void>}
     */
    async createPeerConnection() {
      // Create new RTCPeerConnection
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      // Set up data channel for commands
      dataChannel = peerConnection.createDataChannel('commands', {
        ordered: true
      });
      
      dataChannel.onopen = () => {
        console.log('Data channel opened');
      };
      
      dataChannel.onclose = () => {
        console.log('Data channel closed');
      };
      
      dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
      };
      
      // Handle ICE candidate events
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignallingMessage({
            type: 'ice_candidate',
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`WebRTC connection state: ${peerConnection.connectionState}`);
        
        if (peerConnection.connectionState === 'failed') {
          this.handleConnectionFailure();
        }
      };
      
      // Handle track events (video stream)
      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
        }
      };
      
      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);
      
      this.sendSignallingMessage({
        type: 'offer',
        sdp: offer.sdp
      });
      
      // Wait for connection to establish
      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('WebRTC connection timed out'));
        }, config.connectionTimeoutMs);
        
        const checkConnectionState = () => {
          if (peerConnection.connectionState === 'connected') {
            clearTimeout(connectionTimeout);
            resolve();
          } else if (peerConnection.connectionState === 'failed' || 
                     peerConnection.connectionState === 'closed') {
            clearTimeout(connectionTimeout);
            reject(new Error(`WebRTC connection failed: ${peerConnection.connectionState}`));
          } else {
            setTimeout(checkConnectionState, 100);
          }
        };
        
        checkConnectionState();
      });
    },
    
    /**
     * Handles messages from the signalling server
     * @param {MessageEvent} event - WebSocket message event
     */
    async handleSignallingMessage(event) {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'answer':
            if (peerConnection && peerConnection.signalingState !== 'closed') {
              await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: message.sdp
              }));
            }
            break;
            
          case 'ice_candidate':
            if (peerConnection && peerConnection.signalingState !== 'closed') {
              await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            }
            break;
            
          case 'config':
            // Handle server configuration
            console.log('Received server configuration:', message.config);
            break;
            
          case 'error':
            console.error('Received error from server:', message.error);
            publish('unreal:pixelstreaming:servererror', { error: message.error });
            break;
            
          default:
            console.warn('Unknown signalling message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling signalling message:', error);
      }
    },
    
    /**
     * Sends a message to the signalling server
     * @param {Object} message - Message to send
     */
    sendSignallingMessage(message) {
      if (signallingConnection && signallingConnection.readyState === WebSocket.OPEN) {
        signallingConnection.send(JSON.stringify(message));
      }
    },
    
    /**
     * Handles signalling server disconnection
     */
    handleSignallingDisconnect() {
      // Clean up WebRTC connection
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      // Attempt to reconnect if needed
      if (reconnectCount < config.reconnectAttempts) {
        reconnectCount++;
        
        console.log(`Reconnecting to signalling server (attempt ${reconnectCount}/${config.reconnectAttempts})...`);
        
        // Clear any existing timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Reconnect after exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectCount - 1), 10000);
        reconnectTimeout = setTimeout(() => this.connect(), backoffMs);
      } else {
        publish('unreal:pixelstreaming:disconnected');
      }
    },
    
    /**
     * Handles WebRTC connection failure
     */
    handleConnectionFailure() {
      console.error('WebRTC connection failed');
      
      // Clean up connection
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      publish('unreal:pixelstreaming:connectionfailed');
    },
    
    /**
     * Sets up input event handlers for the input canvas
     * @param {HTMLCanvasElement} canvas - Input canvas element
     */
    setupInputHandlers(canvas) {
      // Mouse events
      canvas.addEventListener('mousedown', (event) => {
        inputState.mouseDown = true;
        inputState.lastPosition = this.getCanvasCoordinates(canvas, event);
        
        this.sendInputCommand('mouseDown', {
          button: event.button,
          position: inputState.lastPosition
        });
      });
      
      canvas.addEventListener('mouseup', (event) => {
        inputState.mouseDown = false;
        const position = this.getCanvasCoordinates(canvas, event);
        
        this.sendInputCommand('mouseUp', {
          button: event.button,
          position
        });
      });
      
      canvas.addEventListener('mousemove', (event) => {
        const position = this.getCanvasCoordinates(canvas, event);
        
        this.sendInputCommand('mouseMove', {
          position,
          isDragging: inputState.mouseDown
        });
        
        inputState.lastPosition = position;
      });
      
      canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        
        this.sendInputCommand('mouseWheel', {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          position: inputState.lastPosition
        });
      });
      
      // Touch events
      canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        inputState.touchActive = true;
        
        const touches = Array.from(event.touches).map(touch => ({
          identifier: touch.identifier,
          position: this.getCanvasCoordinates(canvas, touch)
        }));
        
        if (touches.length > 0) {
          inputState.lastPosition = touches[0].position;
        }
        
        this.sendInputCommand('touchStart', { touches });
      });
      
      canvas.addEventListener('touchend', (event) => {
        event.preventDefault();
        
        const touches = Array.from(event.changedTouches).map(touch => ({
          identifier: touch.identifier,
          position: this.getCanvasCoordinates(canvas, touch)
        }));
        
        this.sendInputCommand('touchEnd', { touches });
        
        if (event.touches.length === 0) {
          inputState.touchActive = false;
        }
      });
      
      canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        
        const touches = Array.from(event.touches).map(touch => ({
          identifier: touch.identifier,
          position: this.getCanvasCoordinates(canvas, touch)
        }));
        
        if (touches.length > 0) {
          inputState.lastPosition = touches[0].position;
        }
        
        this.sendInputCommand('touchMove', { touches });
      });
      
      // Keyboard events
      document.addEventListener('keydown', (event) => {
        // Only send keyboard events when the canvas has focus
        if (document.activeElement === canvas) {
          this.sendInputCommand('keyDown', {
            key: event.key,
            keyCode: event.keyCode,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey
          });
          
          // Prevent default for certain keys to avoid browser actions
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
          }
        }
      });
      
      document.addEventListener('keyup', (event) => {
        // Only send keyboard events when the canvas has focus
        if (document.activeElement === canvas) {
          this.sendInputCommand('keyUp', {
            key: event.key,
            keyCode: event.keyCode,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey
          });
        }
      });
      
      // Make canvas focusable
      canvas.tabIndex = 0;
      
      // Make canvas receive pointer events
      canvas.style.pointerEvents = 'auto';
    },
    
    /**
     * Gets normalized coordinates within the canvas
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {MouseEvent|Touch} event - Mouse or touch event
     * @returns {Object} - Normalized coordinates
     */
    getCanvasCoordinates(canvas, event) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      
      return { x, y };
    },
    
    /**
     * Sends an input command to the Unreal Engine instance
     * @param {string} type - Command type
     * @param {Object} data - Command data
     */
    sendInputCommand(type, data) {
      this.sendCommand('input', { type, ...data });
    },
    
    /**
     * Sends a command to the Unreal Engine instance
     * @param {string} type - Command type
     * @param {*} data - Command data
     */
    sendCommand(type, data = null) {
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type,
          data
        }));
      }
    },
    
    /**
     * Handles resize events
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
      this.sendCommand('resize', { width, height });
    },
    
    /**
     * Disconnects from the Pixel Streaming server
     * @returns {Promise<void>}
     */
    async disconnect() {
      // Clear reconnect timeout if it exists
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Close data channel
      if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
      }
      
      // Close peer connection
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      // Close signalling connection
      if (signallingConnection) {
        signallingConnection.close();
        signallingConnection = null;
      }
    }
  };
}

export default {
  setupPixelStreaming,
  CONNECTION_STATES
};
