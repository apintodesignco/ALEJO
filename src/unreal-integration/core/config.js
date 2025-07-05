/**
 * ALEJO Unreal Engine Integration Configuration
 * 
 * This module provides configuration settings for the Unreal Engine integration
 * with ALEJO, including rendering modes, performance settings, and feature flags.
 */

export const UE_CONFIG = {
  // Core settings
  version: '5.3', // Target Unreal Engine version
  integrationMode: 'hybrid', // 'webgl', 'wasm', 'pixel-streaming', or 'hybrid'
  
  // Performance settings
  performanceTiers: {
    low: {
      resolution: 0.5, // 50% of native resolution
      maxFPS: 30,
      textureQuality: 'low',
      effectsQuality: 'low',
      useSimplifiedAvatars: true,
      usePixelStreaming: true
    },
    medium: {
      resolution: 0.75,
      maxFPS: 45,
      textureQuality: 'medium',
      effectsQuality: 'medium',
      useSimplifiedAvatars: false,
      usePixelStreaming: false
    },
    high: {
      resolution: 1.0,
      maxFPS: 60,
      textureQuality: 'high',
      effectsQuality: 'high',
      useSimplifiedAvatars: false,
      usePixelStreaming: false
    }
  },
  
  // Feature flags
  features: {
    metaHumanAvatars: true,
    neuralNetworkTraining: true,
    adaptiveUI: true,
    gestureVisualization: true,
    environmentalEffects: true,
    accessibilityFeatures: true
  },
  
  // Asset configuration
  assets: {
    baseUrl: '/assets/unreal/',
    preloadAssets: [
      'core-ui.pak',
      'base-avatar.pak',
      'environment-minimal.pak'
    ],
    dynamicLoadingEnabled: true,
    compressionLevel: 'high'
  },
  
  // Pixel streaming configuration (for remote rendering)
  pixelStreaming: {
    serverUrl: process.env.UE_PIXEL_STREAMING_SERVER || 'https://pixel-streaming.alejo.ai',
    fallbackEnabled: true,
    signallingServerUrl: process.env.UE_SIGNALLING_SERVER || 'wss://signalling.alejo.ai',
    connectionTimeoutMs: 10000,
    reconnectAttempts: 3
  },
  
  // WebGL/WebGPU configuration (for local rendering)
  webRendering: {
    preferWebGPU: true,
    webGLFallback: true,
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'highp'
  },
  
  // Accessibility settings for UE integration
  accessibility: {
    reduceMotion: false,
    highContrastMode: false,
    alternativeRendering: false,
    descriptiveAudioEnabled: false,
    keyboardNavigationForUE: true
  },
  
  // Debug settings
  debug: {
    logLevel: process.env.NODE_ENV === 'development' ? 'verbose' : 'error',
    showFPS: process.env.NODE_ENV === 'development',
    showMemoryUsage: process.env.NODE_ENV === 'development',
    wireframeMode: false,
    profileGPU: false
  }
};

/**
 * Detects the optimal performance tier based on device capabilities
 * @returns {string} The performance tier ('low', 'medium', or 'high')
 */
export function detectPerformanceTier() {
  // This is a simplified version - in production we would do more thorough detection
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) return 'low';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    
    // Check for mobile GPUs
    if (/Mali|Adreno|Apple GPU|PowerVR/i.test(renderer)) {
      return 'low';
    }
    
    // Check for integrated GPUs
    if (/Intel|AMD.*Radeon.*Graphics|NVIDIA.*GeForce.*M/i.test(renderer)) {
      return 'medium';
    }
    
    // Check CPU cores and memory
    const cpuCores = navigator.hardwareConcurrency || 2;
    
    if (cpuCores <= 4) return 'low';
    if (cpuCores <= 8) return 'medium';
    
    return 'high';
  } catch (e) {
    console.error('Error detecting performance tier:', e);
    return 'medium'; // Safe default
  }
}

/**
 * Gets the configuration for the current device
 * @returns {Object} Configuration object tailored to current device
 */
export function getDeviceOptimizedConfig() {
  const tier = detectPerformanceTier();
  
  return {
    ...UE_CONFIG,
    currentPerformanceTier: tier,
    currentPerformanceSettings: UE_CONFIG.performanceTiers[tier]
  };
}

/**
 * Checks if the current browser supports the required features for UE integration
 * @returns {Object} Support status for various features
 */
export function checkBrowserSupport() {
  return {
    webgl2: !!window.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'),
    webgpu: 'gpu' in navigator,
    webAssembly: typeof WebAssembly === 'object',
    webRTC: 'RTCPeerConnection' in window,
    webWorkers: 'Worker' in window,
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    webXR: 'xr' in navigator,
    webAudio: 'AudioContext' in window || 'webkitAudioContext' in window
  };
}

/**
 * Determines if Unreal Engine integration is supported on this device
 * @returns {boolean} Whether UE integration is supported
 */
export function isUnrealEngineSupported() {
  const support = checkBrowserSupport();
  
  // Minimum requirements
  const hasMinimumSupport = support.webgl2 && support.webAssembly && support.webWorkers;
  
  // For pixel streaming, we need WebRTC
  const hasPixelStreamingSupport = support.webRTC;
  
  return hasMinimumSupport || hasPixelStreamingSupport;
}

export default {
  UE_CONFIG,
  detectPerformanceTier,
  getDeviceOptimizedConfig,
  checkBrowserSupport,
  isUnrealEngineSupported
};
