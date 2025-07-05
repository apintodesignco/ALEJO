/**
 * ALEJO Unreal Engine Integration
 * 
 * This is the main entry point for the Unreal Engine integration in ALEJO.
 * It coordinates the initialization and communication between all Unreal Engine
 * components, including rendering, avatars, UI, and interaction systems.
 */

import { publish, subscribe } from '../core/event-bus.js';
import { initializeRenderingSystem } from './rendering/index.js';
import { initializeAvatarSystem } from './avatars/index.js';
import { initializeUIBridge } from './ui-bridge/index.js';
import { initializeUnrealUIRenderer } from './ui/unreal-ui-renderer.js';
import { initializeInteractionController } from './ui/interaction-controller.js';

// Default configuration
const DEFAULT_CONFIG = {
  // Container selectors
  renderingContainerSelector: '#alejo-unreal-container',
  uiContainerSelector: '#alejo-ui-container',
  
  // Feature flags
  enableWebGPU: true,
  enablePixelStreaming: true,
  enableVoiceCommands: true,
  enableGestureControl: true,
  
  // Avatar settings
  preferredAvatarType: 'metahuman',
  defaultAvatar: 'alejo',
  
  // UI settings
  uiTheme: 'futuristic',
  showDebugInfo: false,
  
  // Performance settings
  targetFPS: 60,
  adaptiveQuality: true,
  
  // Accessibility settings
  accessibilityFeatures: {
    highContrast: false,
    largeText: false,
    simplifiedAnimations: false,
    reducedMotion: false,
    descriptiveAudio: false
  }
};

// Integration state
let integrationState = {
  initialized: false,
  renderingSystem: null,
  avatarSystem: null,
  uiBridge: null,
  uiRenderer: null,
  interactionController: null,
  config: null
};

/**
 * Initializes the Unreal Engine integration
 * @param {Object} config - Integration configuration
 * @returns {Promise<Object>} - Initialized Unreal Engine integration
 */
export async function initializeUnrealEngine(config = {}) {
  console.log('Initializing ALEJO Unreal Engine integration');
  
  // Merge with default configuration
  const unrealConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Store configuration
    integrationState.config = unrealConfig;
    
    // Initialize rendering system
    console.log('Initializing Unreal Engine rendering system...');
    const renderingSystem = await initializeRenderingSystem({
      containerSelector: unrealConfig.renderingContainerSelector,
      enableWebGPU: unrealConfig.enableWebGPU,
      enablePixelStreaming: unrealConfig.enablePixelStreaming,
      targetFPS: unrealConfig.targetFPS,
      adaptiveQuality: unrealConfig.adaptiveQuality,
      accessibilityFeatures: unrealConfig.accessibilityFeatures
    });
    integrationState.renderingSystem = renderingSystem;
    
    // Initialize avatar system
    console.log('Initializing Unreal Engine avatar system...');
    const avatarSystem = await initializeAvatarSystem(renderingSystem, {
      preferredType: unrealConfig.preferredAvatarType,
      defaultAvatar: unrealConfig.defaultAvatar,
      accessibilityFeatures: unrealConfig.accessibilityFeatures
    });
    integrationState.avatarSystem = avatarSystem;
    
    // Initialize UI bridge
    console.log('Initializing Unreal Engine UI bridge...');
    const uiBridge = await initializeUIBridge(renderingSystem, avatarSystem, {
      containerSelector: unrealConfig.renderingContainerSelector,
      showDebugInfo: unrealConfig.showDebugInfo,
      accessibilityFeatures: unrealConfig.accessibilityFeatures
    });
    integrationState.uiBridge = uiBridge;
    
    // Initialize UI renderer
    console.log('Initializing Unreal Engine UI renderer...');
    const uiRenderer = await initializeUnrealUIRenderer({
      renderingSystem,
      avatarSystem,
      theme: unrealConfig.uiTheme,
      accessibilityFeatures: unrealConfig.accessibilityFeatures
    });
    integrationState.uiRenderer = uiRenderer;
    
    // Initialize interaction controller
    console.log('Initializing Unreal Engine interaction controller...');
    const interactionController = await initializeInteractionController(uiRenderer, {
      enableVoiceCommands: unrealConfig.enableVoiceCommands,
      enableGestureControl: unrealConfig.enableGestureControl,
      accessibilityMode: unrealConfig.accessibilityFeatures.reducedMotion || 
                         unrealConfig.accessibilityFeatures.highContrast
    });
    integrationState.interactionController = interactionController;
    
    // Set up event listeners
    setupEventListeners();
    
    // Create integration API
    const unrealEngine = createUnrealEngineAPI();
    
    // Mark as initialized
    integrationState.initialized = true;
    
    // Publish initialization success event
    publish('unreal:initialized', { unrealEngine });
    
    // Create initial UI components
    await createInitialUI(uiRenderer);
    
    return unrealEngine;
  } catch (error) {
    console.error('Failed to initialize Unreal Engine integration:', error);
    publish('unreal:error', { error });
    
    // Attempt cleanup
    await shutdownUnrealEngine();
    
    throw error;
  }
}

/**
 * Creates the Unreal Engine API
 * @returns {Object} - Unreal Engine API
 */
function createUnrealEngineAPI() {
  return {
    // Systems
    renderingSystem: integrationState.renderingSystem,
    avatarSystem: integrationState.avatarSystem,
    uiBridge: integrationState.uiBridge,
    uiRenderer: integrationState.uiRenderer,
    interactionController: integrationState.interactionController,
    
    // Configuration
    config: integrationState.config,
    
    /**
     * Updates the Unreal Engine configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
      // Update main configuration
      Object.assign(integrationState.config, newConfig);
      
      // Update subsystem configurations
      if (integrationState.renderingSystem) {
        integrationState.renderingSystem.updateConfig(newConfig);
      }
      
      if (integrationState.avatarSystem) {
        integrationState.avatarSystem.updateConfig(newConfig);
      }
      
      if (integrationState.uiBridge) {
        integrationState.uiBridge.updateConfig(newConfig);
      }
      
      if (integrationState.uiRenderer) {
        integrationState.uiRenderer.updateConfig(newConfig);
      }
      
      if (integrationState.interactionController) {
        integrationState.interactionController.updateConfig(newConfig);
      }
    },
    
    /**
     * Sends a command to the Unreal Engine
     * @param {string} command - Command name
     * @param {Object} params - Command parameters
     * @returns {Promise<Object>} - Command result
     */
    async sendCommand(command, params = {}) {
      if (!integrationState.initialized) {
        throw new Error('Unreal Engine integration not initialized');
      }
      
      console.log(`Sending Unreal Engine command: ${command}`, params);
      
      // Route command to appropriate subsystem
      if (command.startsWith('rendering.')) {
        return integrationState.renderingSystem.sendCommand(
          command.substring('rendering.'.length),
          params
        );
      } else if (command.startsWith('avatar.')) {
        return integrationState.avatarSystem.sendCommand(
          command.substring('avatar.'.length),
          params
        );
      } else if (command.startsWith('ui.')) {
        return integrationState.uiRenderer.sendCommand(
          command.substring('ui.'.length),
          params
        );
      } else {
        // Default to rendering system for generic commands
        return integrationState.renderingSystem.sendCommand(command, params);
      }
    },
    
    /**
     * Shows a notification in the UI
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('info', 'warning', 'error', 'success')
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    showNotification(message, type = 'info', duration = 3000) {
      if (integrationState.uiBridge) {
        return integrationState.uiBridge.showNotification(message, type, duration);
      }
    },
    
    /**
     * Shows a loading indicator
     * @param {string} message - Loading message
     * @returns {Object} - Loading indicator control
     */
    showLoading(message = 'Loading...') {
      if (integrationState.uiBridge) {
        return integrationState.uiBridge.showLoading(message);
      }
      
      // Return dummy control if UI bridge not available
      return {
        updateMessage: () => {},
        complete: () => {}
      };
    },
    
    /**
     * Creates a UI component
     * @param {string} id - Component identifier
     * @param {string} type - Component type
     * @param {Object} options - Component options
     * @returns {Promise<Object>} - Created component
     */
    async createUIComponent(id, type, options = {}) {
      if (!integrationState.uiRenderer) {
        throw new Error('Unreal Engine UI renderer not initialized');
      }
      
      return integrationState.uiRenderer.createComponent(id, type, options);
    },
    
    /**
     * Creates a UI layout from a template
     * @param {string} templateId - Template identifier
     * @param {Object} data - Template data
     * @returns {Promise<Array<Object>>} - Created components
     */
    async createUILayout(templateId, data = {}) {
      if (!integrationState.uiRenderer) {
        throw new Error('Unreal Engine UI renderer not initialized');
      }
      
      return integrationState.uiRenderer.createLayout(templateId, data);
    },
    
    /**
     * Handles a voice command
     * @param {string} command - Voice command
     * @param {Object} params - Command parameters
     * @returns {Promise<boolean>} - Whether command was handled
     */
    async handleVoiceCommand(command, params = {}) {
      if (!integrationState.interactionController) {
        return false;
      }
      
      return integrationState.interactionController.processVoiceCommand(command, params);
    },
    
    /**
     * Handles a gesture
     * @param {string} gesture - Gesture type
     * @param {Object} params - Gesture parameters
     * @returns {Promise<boolean>} - Whether gesture was handled
     */
    async handleGesture(gesture, params = {}) {
      if (!integrationState.interactionController) {
        return false;
      }
      
      return integrationState.interactionController.processGesture(gesture, params);
    },
    
    /**
     * Shuts down the Unreal Engine integration
     * @returns {Promise<void>}
     */
    async shutdown() {
      return shutdownUnrealEngine();
    }
  };
}

/**
 * Sets up event listeners for the Unreal Engine integration
 */
function setupEventListeners() {
  // Listen for window resize events
  window.addEventListener('resize', handleWindowResize);
  
  // Listen for visibility change events
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Listen for accessibility settings changes
  subscribe('accessibility:settings:update', handleAccessibilityUpdate);
  
  // Listen for voice commands
  subscribe('voice:command:detected', handleVoiceCommand);
  
  // Listen for gestures
  subscribe('gesture:detected', handleGesture);
}

/**
 * Handles window resize events
 */
function handleWindowResize() {
  if (integrationState.renderingSystem) {
    integrationState.renderingSystem.resize();
  }
}

/**
 * Handles visibility change events
 */
function handleVisibilityChange() {
  if (!integrationState.initialized) {
    return;
  }
  
  if (document.hidden) {
    // Pause rendering and other systems when page is not visible
    if (integrationState.renderingSystem) {
      integrationState.renderingSystem.pause();
    }
  } else {
    // Resume when page becomes visible again
    if (integrationState.renderingSystem) {
      integrationState.renderingSystem.resume();
    }
  }
}

/**
 * Handles accessibility settings updates
 * @param {Object} event - Accessibility settings update event
 */
function handleAccessibilityUpdate(event) {
  if (!integrationState.initialized || !event.settings) {
    return;
  }
  
  // Update configuration
  integrationState.config.accessibilityFeatures = {
    ...integrationState.config.accessibilityFeatures,
    ...event.settings
  };
  
  // Update subsystems
  if (integrationState.renderingSystem) {
    integrationState.renderingSystem.updateAccessibilitySettings(event.settings);
  }
  
  if (integrationState.avatarSystem) {
    integrationState.avatarSystem.updateAccessibilitySettings(event.settings);
  }
  
  if (integrationState.uiRenderer) {
    integrationState.uiRenderer.updateConfig({
      accessibilityFeatures: integrationState.config.accessibilityFeatures
    });
  }
  
  if (integrationState.interactionController) {
    integrationState.interactionController.updateConfig({
      accessibilityMode: event.settings.reducedMotion || event.settings.highContrast
    });
  }
}

/**
 * Handles voice commands
 * @param {Object} event - Voice command event
 */
function handleVoiceCommand(event) {
  if (!integrationState.initialized || 
      !integrationState.config.enableVoiceCommands ||
      !integrationState.interactionController) {
    return;
  }
  
  integrationState.interactionController.processVoiceCommand(
    event.command,
    event.params || {}
  );
}

/**
 * Handles gestures
 * @param {Object} event - Gesture event
 */
function handleGesture(event) {
  if (!integrationState.initialized || 
      !integrationState.config.enableGestureControl ||
      !integrationState.interactionController) {
    return;
  }
  
  integrationState.interactionController.processGesture(
    event.gesture,
    event.params || {}
  );
}

/**
 * Creates initial UI components
 * @param {Object} uiRenderer - UI renderer
 * @returns {Promise<void>}
 */
async function createInitialUI(uiRenderer) {
  if (!uiRenderer) {
    return;
  }
  
  try {
    // Create welcome notification
    await uiRenderer.createComponent('welcome-notification', 'notification', {
      title: 'ALEJO Unreal Engine',
      message: 'Welcome to the next-generation ALEJO experience powered by Unreal Engine',
      type: 'info',
      duration: 5000,
      style: {
        backgroundColor: 'rgba(10, 20, 40, 0.9)',
        textColor: '#ffffff',
        borderRadius: 10,
        glow: true,
        glowColor: '#4080ff'
      },
      animation: 'slide-in'
    });
  } catch (error) {
    console.error('Failed to create initial UI components:', error);
  }
}

/**
 * Shuts down the Unreal Engine integration
 * @returns {Promise<void>}
 */
export async function shutdownUnrealEngine() {
  console.log('Shutting down ALEJO Unreal Engine integration');
  
  try {
    // Shut down subsystems in reverse order
    if (integrationState.interactionController) {
      await integrationState.interactionController.shutdown();
      integrationState.interactionController = null;
    }
    
    if (integrationState.uiRenderer) {
      await integrationState.uiRenderer.shutdown();
      integrationState.uiRenderer = null;
    }
    
    if (integrationState.uiBridge) {
      await integrationState.uiBridge.shutdown();
      integrationState.uiBridge = null;
    }
    
    if (integrationState.avatarSystem) {
      await integrationState.avatarSystem.shutdown();
      integrationState.avatarSystem = null;
    }
    
    if (integrationState.renderingSystem) {
      await integrationState.renderingSystem.shutdown();
      integrationState.renderingSystem = null;
    }
    
    // Remove event listeners
    window.removeEventListener('resize', handleWindowResize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    // Reset state
    integrationState.initialized = false;
    integrationState.config = null;
    
    // Publish shutdown event
    publish('unreal:shutdown', {});
  } catch (error) {
    console.error('Error during Unreal Engine shutdown:', error);
    throw error;
  }
}

/**
 * Checks if the browser supports Unreal Engine features
 * @returns {Promise<Object>} - Support information
 */
export async function checkUnrealEngineSupport() {
  console.log('Checking browser support for Unreal Engine features');
  
  const support = {
    webGL: false,
    webGL2: false,
    webGPU: false,
    webRTC: false,
    webAssembly: false,
    sharedArrayBuffer: false,
    overall: false
  };
  
  // Check WebGL support
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    support.webGL = !!gl;
    
    const gl2 = canvas.getContext('webgl2');
    support.webGL2 = !!gl2;
  } catch (e) {
    console.warn('Error checking WebGL support:', e);
  }
  
  // Check WebGPU support
  support.webGPU = 'gpu' in navigator;
  
  // Check WebRTC support
  support.webRTC = 'RTCPeerConnection' in window;
  
  // Check WebAssembly support
  support.webAssembly = typeof WebAssembly === 'object' && 
                        typeof WebAssembly.compile === 'function';
  
  // Check SharedArrayBuffer support (needed for multithreaded WebAssembly)
  try {
    support.sharedArrayBuffer = typeof SharedArrayBuffer === 'function';
  } catch (e) {
    support.sharedArrayBuffer = false;
  }
  
  // Determine overall support
  support.overall = support.webGL && support.webRTC && support.webAssembly;
  
  // Publish support information
  publish('unreal:support:checked', { support });
  
  return support;
}

export default {
  initializeUnrealEngine,
  shutdownUnrealEngine,
  checkUnrealEngineSupport
};
