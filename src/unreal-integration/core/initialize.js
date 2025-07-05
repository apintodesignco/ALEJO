/**
 * ALEJO Unreal Engine Integration Initialization
 * 
 * This module handles the initialization of the Unreal Engine integration,
 * including loading the appropriate rendering mode, setting up communication
 * channels, and preparing the environment for UE content.
 */

import { getDeviceOptimizedConfig, isUnrealEngineSupported } from './config.js';
import { setupWebGLRendering, setupWebGPURendering } from '../rendering/web-rendering.js';
import { setupPixelStreaming } from '../rendering/pixel-streaming.js';
import { initializeAvatarSystem } from '../avatars/avatar-system.js';
import { setupUIIntegration } from '../ui/ui-bridge.js';
import { initializeNeuralTraining } from '../neural-training/training-environment.js';
import { publish, subscribe } from '../../core/event-bus.js';

// Initialization states
const INIT_STATES = {
  NOT_STARTED: 'not_started',
  CHECKING_SUPPORT: 'checking_support',
  LOADING_CORE: 'loading_core',
  INITIALIZING_RENDERER: 'initializing_renderer',
  LOADING_ASSETS: 'loading_assets',
  SETTING_UP_SYSTEMS: 'setting_up_systems',
  READY: 'ready',
  FAILED: 'failed'
};

let initState = INIT_STATES.NOT_STARTED;
let initError = null;
let config = null;
let renderingSystem = null;

/**
 * Initializes the Unreal Engine integration
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} - Initialization result
 */
export async function initialize(options = {}) {
  try {
    initState = INIT_STATES.CHECKING_SUPPORT;
    publish('unreal:initialization:progress', { state: initState, progress: 0.1 });
    
    // Check if UE is supported on this device
    if (!isUnrealEngineSupported()) {
      throw new Error('Unreal Engine integration is not supported on this device');
    }
    
    // Get optimized configuration for this device
    initState = INIT_STATES.LOADING_CORE;
    publish('unreal:initialization:progress', { state: initState, progress: 0.2 });
    
    config = getDeviceOptimizedConfig();
    
    // Apply any user options
    config = {
      ...config,
      ...options
    };
    
    // Initialize the appropriate rendering system
    initState = INIT_STATES.INITIALIZING_RENDERER;
    publish('unreal:initialization:progress', { state: initState, progress: 0.4 });
    
    renderingSystem = await initializeRenderingSystem(config);
    
    // Load initial assets
    initState = INIT_STATES.LOADING_ASSETS;
    publish('unreal:initialization:progress', { state: initState, progress: 0.6 });
    
    await loadInitialAssets(config);
    
    // Set up subsystems
    initState = INIT_STATES.SETTING_UP_SYSTEMS;
    publish('unreal:initialization:progress', { state: initState, progress: 0.8 });
    
    await Promise.all([
      initializeAvatarSystem(config),
      setupUIIntegration(config, renderingSystem),
      config.features.neuralNetworkTraining ? initializeNeuralTraining(config) : Promise.resolve()
    ]);
    
    // Register event handlers
    setupEventHandlers();
    
    // Initialization complete
    initState = INIT_STATES.READY;
    publish('unreal:initialization:complete', { config, renderingSystem });
    publish('unreal:initialization:progress', { state: initState, progress: 1.0 });
    
    return {
      success: true,
      config,
      renderingSystem
    };
  } catch (error) {
    console.error('Failed to initialize Unreal Engine integration:', error);
    initState = INIT_STATES.FAILED;
    initError = error;
    
    publish('unreal:initialization:error', { error });
    publish('unreal:initialization:progress', { state: initState, progress: 0, error });
    
    return {
      success: false,
      error
    };
  }
}

/**
 * Initializes the appropriate rendering system based on configuration
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} - Initialized rendering system
 */
async function initializeRenderingSystem(config) {
  const { integrationMode, webRendering, pixelStreaming } = config;
  
  switch (integrationMode) {
    case 'webgl':
      return setupWebGLRendering(webRendering);
    
    case 'wasm':
      return setupWebGLRendering({ ...webRendering, useWasm: true });
    
    case 'pixel-streaming':
      return setupPixelStreaming(pixelStreaming);
    
    case 'hybrid':
    default:
      // Try WebGPU first if preferred and available
      if (webRendering.preferWebGPU && 'gpu' in navigator) {
        try {
          return await setupWebGPURendering(webRendering);
        } catch (error) {
          console.warn('WebGPU initialization failed, falling back to WebGL:', error);
        }
      }
      
      // Try WebGL next
      try {
        return await setupWebGLRendering(webRendering);
      } catch (error) {
        console.warn('WebGL initialization failed, falling back to pixel streaming:', error);
        
        // Fall back to pixel streaming as last resort
        if (pixelStreaming.fallbackEnabled) {
          return setupPixelStreaming(pixelStreaming);
        }
        
        throw error;
      }
  }
}

/**
 * Loads initial assets required for the UE integration
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
async function loadInitialAssets(config) {
  const { assets } = config;
  
  if (!assets.preloadAssets || assets.preloadAssets.length === 0) {
    return;
  }
  
  const assetPromises = assets.preloadAssets.map(async (assetName) => {
    const assetUrl = `${assets.baseUrl}${assetName}`;
    
    // This is a simplified version - in a real implementation we would have
    // proper asset loading and management
    try {
      const response = await fetch(assetUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Failed to load asset ${assetName}: ${response.status}`);
      }
      
      publish('unreal:asset:ready', { assetName, assetUrl });
      return { assetName, assetUrl, status: 'loaded' };
    } catch (error) {
      console.error(`Failed to load asset ${assetName}:`, error);
      publish('unreal:asset:error', { assetName, assetUrl, error });
      return { assetName, assetUrl, status: 'failed', error };
    }
  });
  
  await Promise.all(assetPromises);
}

/**
 * Sets up event handlers for the UE integration
 */
function setupEventHandlers() {
  // Handle application state changes
  subscribe('app:state:changed', (event) => {
    if (renderingSystem) {
      renderingSystem.handleAppStateChange(event);
    }
  });
  
  // Handle window resize events
  window.addEventListener('resize', () => {
    if (renderingSystem) {
      renderingSystem.handleResize();
    }
  });
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (renderingSystem) {
      renderingSystem.handleVisibilityChange(document.visibilityState);
    }
  });
  
  // Handle performance mode changes
  subscribe('settings:performance:changed', (event) => {
    if (renderingSystem) {
      renderingSystem.updatePerformanceSettings(event.performanceSettings);
    }
  });
  
  // Handle accessibility changes
  subscribe('accessibility:settings:changed', (event) => {
    if (renderingSystem && config) {
      config.accessibility = {
        ...config.accessibility,
        ...event.accessibilitySettings
      };
      
      renderingSystem.updateAccessibilitySettings(config.accessibility);
    }
  });
}

/**
 * Gets the current initialization state
 * @returns {Object} Current initialization state
 */
export function getInitializationState() {
  return {
    state: initState,
    error: initError,
    config
  };
}

/**
 * Shuts down the Unreal Engine integration
 * @returns {Promise<void>}
 */
export async function shutdown() {
  if (renderingSystem) {
    await renderingSystem.shutdown();
    renderingSystem = null;
  }
  
  initState = INIT_STATES.NOT_STARTED;
  initError = null;
  
  publish('unreal:shutdown:complete');
}

export default {
  initialize,
  getInitializationState,
  shutdown,
  INIT_STATES
};
