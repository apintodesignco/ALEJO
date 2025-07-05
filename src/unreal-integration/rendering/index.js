/**
 * ALEJO Unreal Engine Rendering Integration
 * 
 * This module serves as the main entry point for the Unreal Engine rendering system,
 * coordinating between different rendering methods (WebGL, WebGPU, and Pixel Streaming)
 * based on device capabilities, performance settings, and user preferences.
 */

import { publish, subscribe } from '../../core/event-bus.js';
import { setupWebGLRendering, setupWebGPURendering } from './web-rendering.js';
import { setupPixelStreaming, CONNECTION_STATES } from './pixel-streaming.js';

// Rendering modes
export const RENDERING_MODES = {
  WEBGL: 'webgl',
  WEBGPU: 'webgpu',
  PIXEL_STREAMING: 'pixel-streaming',
  HYBRID: 'hybrid',
  FALLBACK: 'fallback'
};

// Default configuration
const DEFAULT_CONFIG = {
  preferredMode: RENDERING_MODES.HYBRID,
  container: null,
  webgl: {
    antialias: true,
    powerPreference: 'high-performance',
    useWasm: true
  },
  webgpu: {
    powerPreference: 'high-performance'
  },
  pixelStreaming: {
    fallbackEnabled: true,
    reconnectAttempts: 3
  },
  fallback: {
    useSimplifiedRendering: true,
    useStaticImages: false
  }
};

/**
 * Initializes the Unreal Engine rendering system
 * @param {Object} config - Rendering configuration
 * @returns {Promise<Object>} - Initialized rendering system
 */
export async function initializeRendering(config = {}) {
  console.log('Initializing ALEJO Unreal Engine rendering system');
  
  // Merge with default configuration
  const renderingConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Detect device capabilities
    const capabilities = await detectCapabilities();
    console.log('Device rendering capabilities:', capabilities);
    
    // Determine the best rendering mode based on capabilities and preferences
    const renderingMode = determineRenderingMode(capabilities, renderingConfig);
    console.log(`Selected rendering mode: ${renderingMode}`);
    
    // Initialize the selected rendering system
    const renderingSystem = await initializeRenderingSystem(renderingMode, capabilities, renderingConfig);
    
    // Set up event listeners
    setupEventListeners(renderingSystem);
    
    // Attach to container if provided
    if (renderingConfig.container) {
      renderingSystem.attachToContainer(renderingConfig.container);
    }
    
    // Publish initialization success event
    publish('unreal:rendering:ready', { 
      mode: renderingMode,
      capabilities
    });
    
    return {
      ...renderingSystem,
      mode: renderingMode,
      capabilities,
      
      /**
       * Updates the rendering configuration
       * @param {Object} newConfig - New configuration options
       * @returns {Promise<void>}
       */
      async updateConfig(newConfig) {
        // Update performance settings if provided
        if (newConfig.performance) {
          renderingSystem.updatePerformanceSettings(newConfig.performance);
        }
        
        // Update accessibility settings if provided
        if (newConfig.accessibility) {
          renderingSystem.updateAccessibilitySettings(newConfig.accessibility);
        }
      }
    };
  } catch (error) {
    console.error('Failed to initialize Unreal Engine rendering:', error);
    publish('unreal:rendering:error', { error });
    
    // Try to initialize fallback rendering
    if (config.preferredMode !== RENDERING_MODES.FALLBACK) {
      console.log('Attempting to initialize fallback rendering');
      return initializeRendering({
        ...config,
        preferredMode: RENDERING_MODES.FALLBACK
      });
    }
    
    throw error;
  }
}

/**
 * Detects device rendering capabilities
 * @returns {Promise<Object>} - Device capabilities
 */
async function detectCapabilities() {
  const capabilities = {
    webgl: false,
    webgl2: false,
    webgpu: false,
    pixelStreaming: {
      supported: false,
      rtcSupported: false,
      h264Supported: false,
      vp9Supported: false,
      av1Supported: false
    },
    hardware: {
      gpu: null,
      memory: null,
      cores: null
    },
    network: {
      type: null,
      downlinkMbps: null,
      rtt: null
    }
  };
  
  // Check WebGL support
  try {
    const canvas = document.createElement('canvas');
    const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    capabilities.webgl = !!gl1;
    
    if (gl1) {
      const debugInfo = gl1.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        capabilities.hardware.gpu = gl1.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
    
    const gl2 = canvas.getContext('webgl2');
    capabilities.webgl2 = !!gl2;
  } catch (error) {
    console.warn('Error detecting WebGL capabilities:', error);
  }
  
  // Check WebGPU support
  try {
    capabilities.webgpu = !!navigator.gpu;
    
    if (capabilities.webgpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          const adapterInfo = await adapter.requestAdapterInfo();
          capabilities.hardware.gpu = adapterInfo.description || adapterInfo.vendor;
        }
      } catch (error) {
        console.warn('Error getting WebGPU adapter info:', error);
      }
    }
  } catch (error) {
    console.warn('Error detecting WebGPU capabilities:', error);
  }
  
  // Check WebRTC and codec support for Pixel Streaming
  try {
    capabilities.pixelStreaming.rtcSupported = !!window.RTCPeerConnection;
    
    if (capabilities.pixelStreaming.rtcSupported) {
      // Check for video codec support
      if (window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
        const capabilities = RTCRtpReceiver.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          capabilities.pixelStreaming.h264Supported = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/h264');
          capabilities.pixelStreaming.vp9Supported = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/vp9');
          capabilities.pixelStreaming.av1Supported = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/av1');
        }
      } else {
        // Assume H.264 support as fallback for browsers that don't support getCapabilities
        capabilities.pixelStreaming.h264Supported = true;
      }
      
      capabilities.pixelStreaming.supported = capabilities.pixelStreaming.h264Supported;
    }
  } catch (error) {
    console.warn('Error detecting WebRTC capabilities:', error);
  }
  
  // Get hardware information
  try {
    if (navigator.deviceMemory) {
      capabilities.hardware.memory = navigator.deviceMemory;
    }
    
    if (navigator.hardwareConcurrency) {
      capabilities.hardware.cores = navigator.hardwareConcurrency;
    }
  } catch (error) {
    console.warn('Error detecting hardware capabilities:', error);
  }
  
  // Get network information
  try {
    if (navigator.connection) {
      capabilities.network.type = navigator.connection.effectiveType;
      capabilities.network.downlinkMbps = navigator.connection.downlink;
      capabilities.network.rtt = navigator.connection.rtt;
    }
  } catch (error) {
    console.warn('Error detecting network capabilities:', error);
  }
  
  return capabilities;
}

/**
 * Determines the best rendering mode based on capabilities and preferences
 * @param {Object} capabilities - Device capabilities
 * @param {Object} config - Rendering configuration
 * @returns {string} - Selected rendering mode
 */
function determineRenderingMode(capabilities, config) {
  const preferredMode = config.preferredMode;
  
  // If preferred mode is explicitly set and supported, use it
  if (preferredMode === RENDERING_MODES.WEBGPU && capabilities.webgpu) {
    return RENDERING_MODES.WEBGPU;
  }
  
  if (preferredMode === RENDERING_MODES.WEBGL && (capabilities.webgl2 || capabilities.webgl)) {
    return RENDERING_MODES.WEBGL;
  }
  
  if (preferredMode === RENDERING_MODES.PIXEL_STREAMING && capabilities.pixelStreaming.supported) {
    return RENDERING_MODES.PIXEL_STREAMING;
  }
  
  // For hybrid mode, make a smart decision based on capabilities
  if (preferredMode === RENDERING_MODES.HYBRID) {
    // Check if we have a good network connection for pixel streaming
    const hasGoodNetwork = capabilities.network.type === '4g' && 
                          capabilities.network.downlinkMbps >= 10 && 
                          capabilities.network.rtt < 100;
    
    // Check if we have good local rendering capabilities
    const hasGoodLocalRendering = capabilities.webgpu || 
                                 (capabilities.webgl2 && capabilities.hardware.cores >= 4);
    
    if (capabilities.pixelStreaming.supported && hasGoodNetwork && !hasGoodLocalRendering) {
      return RENDERING_MODES.PIXEL_STREAMING;
    }
    
    if (capabilities.webgpu) {
      return RENDERING_MODES.WEBGPU;
    }
    
    if (capabilities.webgl2 || capabilities.webgl) {
      return RENDERING_MODES.WEBGL;
    }
    
    if (capabilities.pixelStreaming.supported) {
      return RENDERING_MODES.PIXEL_STREAMING;
    }
  }
  
  // Fallback mode if nothing else is supported
  return RENDERING_MODES.FALLBACK;
}

/**
 * Initializes the selected rendering system
 * @param {string} mode - Rendering mode
 * @param {Object} capabilities - Device capabilities
 * @param {Object} config - Rendering configuration
 * @returns {Promise<Object>} - Initialized rendering system
 */
async function initializeRenderingSystem(mode, capabilities, config) {
  switch (mode) {
    case RENDERING_MODES.WEBGPU:
      return setupWebGPURendering(config.webgpu);
      
    case RENDERING_MODES.WEBGL:
      return setupWebGLRendering({
        ...config.webgl,
        // Use WebGL2 if available, otherwise WebGL1
        useWebGL2: capabilities.webgl2
      });
      
    case RENDERING_MODES.PIXEL_STREAMING:
      return setupPixelStreaming(config.pixelStreaming);
      
    case RENDERING_MODES.FALLBACK:
      return initializeFallbackRendering(config.fallback);
      
    default:
      throw new Error(`Unsupported rendering mode: ${mode}`);
  }
}

/**
 * Initializes fallback rendering for devices with limited capabilities
 * @param {Object} config - Fallback rendering configuration
 * @returns {Promise<Object>} - Initialized fallback rendering system
 */
async function initializeFallbackRendering(config) {
  console.log('Initializing fallback rendering');
  
  // Create a container for fallback content
  const container = document.createElement('div');
  container.id = 'alejo-unreal-fallback';
  container.className = 'alejo-unreal-fallback-container';
  
  // Apply styles to container
  Object.assign(container.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column'
  });
  
  // Create fallback content based on configuration
  if (config.useStaticImages) {
    // Use static images as fallback
    const img = document.createElement('img');
    img.src = '/assets/unreal/fallback-image.jpg';
    img.alt = 'ALEJO Fallback Interface';
    img.className = 'alejo-unreal-fallback-image';
    
    Object.assign(img.style, {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain'
    });
    
    container.appendChild(img);
  } else {
    // Use simplified HTML/CSS rendering
    const fallbackContent = document.createElement('div');
    fallbackContent.className = 'alejo-unreal-fallback-content';
    
    Object.assign(fallbackContent.style, {
      textAlign: 'center',
      color: '#fff',
      padding: '20px'
    });
    
    // Add logo or icon
    const logo = document.createElement('div');
    logo.className = 'alejo-unreal-fallback-logo';
    logo.innerHTML = `
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#3498db" stroke-width="5" />
        <path d="M30,50 L45,65 L70,35" stroke="#3498db" stroke-width="5" fill="none" />
      </svg>
    `;
    
    // Add message
    const message = document.createElement('h2');
    message.textContent = 'ALEJO Simplified Interface';
    message.style.marginTop = '20px';
    message.style.fontFamily = 'Arial, sans-serif';
    
    // Add description
    const description = document.createElement('p');
    description.textContent = 'Your device is running ALEJO in compatibility mode. ' +
                             'For the best experience, please use a device with better graphics capabilities.';
    description.style.marginTop = '10px';
    description.style.fontFamily = 'Arial, sans-serif';
    
    fallbackContent.appendChild(logo);
    fallbackContent.appendChild(message);
    fallbackContent.appendChild(description);
    container.appendChild(fallbackContent);
  }
  
  // Create and return the fallback rendering system
  return {
    type: 'fallback',
    container,
    
    /**
     * Attaches the fallback container to a parent element
     * @param {HTMLElement} parentElement - Parent element
     */
    attachToContainer(parentElement) {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
      
      parentElement.appendChild(container);
    },
    
    /**
     * Handles window resize events
     */
    handleResize() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Handles application state changes
     */
    handleAppStateChange() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Handles visibility changes
     */
    handleVisibilityChange() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Updates performance settings
     */
    updatePerformanceSettings() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Updates accessibility settings
     */
    updateAccessibilitySettings() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Pauses rendering
     */
    pauseRendering() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Resumes rendering
     */
    resumeRendering() {
      // Nothing to do for fallback rendering
    },
    
    /**
     * Shuts down the rendering system
     * @returns {Promise<void>}
     */
    async shutdown() {
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    }
  };
}

/**
 * Sets up event listeners for the rendering system
 * @param {Object} renderingSystem - Initialized rendering system
 */
function setupEventListeners(renderingSystem) {
  // Handle window resize events
  window.addEventListener('resize', () => {
    renderingSystem.handleResize();
  });
  
  // Handle visibility change events
  document.addEventListener('visibilitychange', () => {
    renderingSystem.handleVisibilityChange(document.visibilityState);
  });
  
  // Handle app state change events
  subscribe('app:state:change', (event) => {
    renderingSystem.handleAppStateChange(event);
  });
  
  // Handle performance setting changes
  subscribe('unreal:performance:update', (event) => {
    renderingSystem.updatePerformanceSettings(event.settings);
  });
  
  // Handle accessibility setting changes
  subscribe('accessibility:settings:update', (event) => {
    renderingSystem.updateAccessibilitySettings(event.settings);
  });
}

export default {
  initializeRendering,
  RENDERING_MODES
};
