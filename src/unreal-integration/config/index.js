/**
 * ALEJO Unreal Engine Configuration
 * 
 * This module manages configuration settings for the Unreal Engine integration,
 * including performance, accessibility, and user preferences. It provides
 * methods to load, save, and update configuration settings, as well as
 * default configurations for different device capabilities.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Configuration storage key
const CONFIG_STORAGE_KEY = 'alejo-unreal-config';

// Default configuration
const DEFAULT_CONFIG = {
  // Rendering settings
  rendering: {
    preferredMode: 'hybrid', // 'webgl', 'webgpu', 'pixel-streaming', 'hybrid', 'fallback'
    quality: 'auto', // 'low', 'medium', 'high', 'ultra', 'auto'
    targetFPS: 60,
    adaptiveQuality: true,
    antialiasing: true,
    shadows: true,
    reflections: true,
    postProcessing: true,
    textureQuality: 'high', // 'low', 'medium', 'high'
    viewDistance: 'medium', // 'low', 'medium', 'high'
    effectsQuality: 'medium' // 'low', 'medium', 'high'
  },
  
  // Avatar settings
  avatar: {
    preferredType: 'metahuman', // 'metahuman', 'stylized', 'custom', 'fallback'
    defaultAvatar: 'alejo',
    expressionIntensity: 1.0,
    lipSyncQuality: 'high', // 'low', 'medium', 'high'
    enableBlinking: true,
    enableBreathing: true,
    enableIdleAnimations: true,
    enableHandGestures: true
  },
  
  // UI settings
  ui: {
    theme: 'futuristic', // 'futuristic', 'minimal', 'classic', 'custom'
    colorScheme: 'dark', // 'light', 'dark', 'auto'
    primaryColor: '#4080ff',
    accentColor: '#40e0ff',
    animationSpeed: 1.0,
    enableParticleEffects: true,
    enableBlur: true,
    enableGlow: true,
    enableReflections: true,
    fontScale: 1.0
  },
  
  // Interaction settings
  interaction: {
    enableVoiceCommands: true,
    enableGestureControl: true,
    voiceCommandConfidenceThreshold: 0.7,
    gestureConfidenceThreshold: 0.6,
    multimodalFusionEnabled: true,
    commandDebounceMs: 300,
    hapticFeedback: true,
    audioFeedback: true,
    visualFeedback: true
  },
  
  // Performance settings
  performance: {
    prioritizeFramerate: true,
    dynamicResolution: true,
    targetResolutionScale: 1.0,
    minResolutionScale: 0.5,
    maxResolutionScale: 1.0,
    loadingPriority: 'speed', // 'speed', 'quality', 'balanced'
    backgroundProcessingEnabled: true,
    useHardwareAcceleration: true,
    useMultithreading: true,
    memoryManagementMode: 'balanced' // 'aggressive', 'balanced', 'quality'
  },
  
  // Accessibility settings
  accessibility: {
    highContrast: false,
    largeText: false,
    simplifiedUI: false,
    reducedMotion: false,
    descriptiveAudio: false,
    subtitles: false,
    colorBlindMode: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
    keyboardNavigationEnabled: true,
    screenReaderOptimized: false,
    alternativeInputMethods: false
  },
  
  // Advanced settings
  advanced: {
    developerMode: false,
    debugInfo: false,
    experimentalFeatures: false,
    logLevel: 'error', // 'debug', 'info', 'warn', 'error'
    pixelStreamingUrl: null,
    customShaders: false,
    customMaterials: false,
    unrealEngineVersion: '5.3',
    wasmOptimizationLevel: 2 // 0-3
  }
};

// Device-specific configurations
const DEVICE_CONFIGS = {
  // High-end device configuration
  highEnd: {
    rendering: {
      quality: 'high',
      targetFPS: 60,
      shadows: true,
      reflections: true,
      postProcessing: true,
      textureQuality: 'high',
      viewDistance: 'high',
      effectsQuality: 'high'
    },
    ui: {
      enableParticleEffects: true,
      enableBlur: true,
      enableGlow: true,
      enableReflections: true
    },
    performance: {
      targetResolutionScale: 1.0,
      minResolutionScale: 0.7
    }
  },
  
  // Mid-range device configuration
  midRange: {
    rendering: {
      quality: 'medium',
      targetFPS: 60,
      shadows: true,
      reflections: false,
      postProcessing: true,
      textureQuality: 'medium',
      viewDistance: 'medium',
      effectsQuality: 'medium'
    },
    ui: {
      enableParticleEffects: true,
      enableBlur: true,
      enableGlow: true,
      enableReflections: false
    },
    performance: {
      targetResolutionScale: 0.9,
      minResolutionScale: 0.6
    }
  },
  
  // Low-end device configuration
  lowEnd: {
    rendering: {
      quality: 'low',
      targetFPS: 30,
      shadows: false,
      reflections: false,
      postProcessing: false,
      textureQuality: 'low',
      viewDistance: 'low',
      effectsQuality: 'low'
    },
    ui: {
      enableParticleEffects: false,
      enableBlur: false,
      enableGlow: false,
      enableReflections: false
    },
    performance: {
      targetResolutionScale: 0.7,
      minResolutionScale: 0.5
    }
  },
  
  // Mobile device configuration
  mobile: {
    rendering: {
      quality: 'low',
      targetFPS: 30,
      shadows: false,
      reflections: false,
      postProcessing: false,
      textureQuality: 'low',
      viewDistance: 'low',
      effectsQuality: 'low'
    },
    ui: {
      enableParticleEffects: false,
      enableBlur: false,
      enableGlow: false,
      enableReflections: false
    },
    performance: {
      targetResolutionScale: 0.6,
      minResolutionScale: 0.4,
      prioritizeFramerate: true,
      dynamicResolution: true
    },
    interaction: {
      hapticFeedback: true
    }
  },
  
  // Accessibility-focused configuration
  accessibility: {
    ui: {
      animationSpeed: 0.7,
      enableParticleEffects: false,
      enableBlur: false,
      enableGlow: false,
      fontScale: 1.2
    },
    accessibility: {
      highContrast: true,
      largeText: true,
      simplifiedUI: true,
      reducedMotion: true,
      subtitles: true,
      keyboardNavigationEnabled: true,
      screenReaderOptimized: true
    },
    interaction: {
      voiceCommandConfidenceThreshold: 0.6,
      gestureConfidenceThreshold: 0.5,
      commandDebounceMs: 500,
      visualFeedback: true,
      audioFeedback: true
    }
  }
};

// Current configuration
let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Initializes the configuration system
 * @param {Object} initialConfig - Initial configuration (optional)
 * @returns {Promise<Object>} - The initialized configuration
 */
export async function initializeConfig(initialConfig = {}) {
  console.log('Initializing ALEJO Unreal Engine configuration');
  
  try {
    // Load saved configuration from storage
    const savedConfig = loadConfigFromStorage();
    
    // Detect device capabilities
    const deviceType = await detectDeviceType();
    console.log(`Detected device type: ${deviceType}`);
    
    // Get device-specific configuration
    const deviceConfig = DEVICE_CONFIGS[deviceType] || {};
    
    // Merge configurations in order of precedence:
    // 1. Initial config (highest priority)
    // 2. Saved config
    // 3. Device-specific config
    // 4. Default config (lowest priority)
    currentConfig = mergeConfigs(
      DEFAULT_CONFIG,
      deviceConfig,
      savedConfig,
      initialConfig
    );
    
    // Set up event listeners
    setupEventListeners();
    
    // Publish configuration initialized event
    publish('unreal:config:initialized', { config: currentConfig });
    
    return currentConfig;
  } catch (error) {
    console.error('Failed to initialize configuration:', error);
    publish('unreal:config:error', { error });
    
    // Fall back to default configuration
    currentConfig = { ...DEFAULT_CONFIG, ...initialConfig };
    return currentConfig;
  }
}

/**
 * Loads configuration from local storage
 * @returns {Object} - Saved configuration or empty object
 */
function loadConfigFromStorage() {
  try {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    return savedConfig ? JSON.parse(savedConfig) : {};
  } catch (error) {
    console.warn('Failed to load configuration from storage:', error);
    return {};
  }
}

/**
 * Saves configuration to local storage
 * @param {Object} config - Configuration to save
 */
function saveConfigToStorage(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Failed to save configuration to storage:', error);
  }
}

/**
 * Detects device type based on capabilities
 * @returns {Promise<string>} - Device type ('highEnd', 'midRange', 'lowEnd', 'mobile')
 */
async function detectDeviceType() {
  // Check if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    return 'mobile';
  }
  
  // Get hardware information
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = navigator.deviceMemory || 4;
  
  // Check for WebGPU support as an indicator of modern hardware
  const hasWebGPU = 'gpu' in navigator;
  
  // Check for WebGL2 support
  let hasWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    hasWebGL2 = !!canvas.getContext('webgl2');
  } catch (e) {
    // WebGL2 not supported
  }
  
  // Determine device type based on capabilities
  if (hasWebGPU && hardwareConcurrency >= 8 && deviceMemory >= 8) {
    return 'highEnd';
  } else if (hasWebGL2 && hardwareConcurrency >= 4 && deviceMemory >= 4) {
    return 'midRange';
  } else {
    return 'lowEnd';
  }
}

/**
 * Merges multiple configuration objects
 * @param {...Object} configs - Configuration objects to merge
 * @returns {Object} - Merged configuration
 */
function mergeConfigs(...configs) {
  return configs.reduce((merged, config) => {
    // Deep merge the configurations
    return deepMerge(merged, config);
  }, {});
}

/**
 * Deep merges two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

/**
 * Checks if a value is an object
 * @param {*} item - Value to check
 * @returns {boolean} - Whether the value is an object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Sets up event listeners for configuration changes
 */
function setupEventListeners() {
  // Listen for accessibility settings changes
  subscribe('accessibility:settings:update', handleAccessibilityUpdate);
  
  // Listen for performance settings changes
  subscribe('performance:settings:update', handlePerformanceUpdate);
  
  // Listen for user preference changes
  subscribe('user:preferences:update', handleUserPreferencesUpdate);
  
  // Listen for device orientation changes (for mobile)
  window.addEventListener('orientationchange', handleOrientationChange);
  
  // Listen for network status changes
  if (navigator.connection) {
    navigator.connection.addEventListener('change', handleNetworkChange);
  }
}

/**
 * Handles accessibility settings updates
 * @param {Object} event - Accessibility settings update event
 */
function handleAccessibilityUpdate(event) {
  if (!event.settings) return;
  
  // Update accessibility settings
  updateConfig({
    accessibility: event.settings
  });
  
  // If high contrast or reduced motion is enabled, also update UI settings
  if (event.settings.highContrast || event.settings.reducedMotion) {
    updateConfig({
      ui: {
        enableParticleEffects: !event.settings.reducedMotion,
        enableBlur: !event.settings.highContrast,
        enableGlow: !event.settings.highContrast,
        animationSpeed: event.settings.reducedMotion ? 0.5 : 1.0
      }
    });
  }
}

/**
 * Handles performance settings updates
 * @param {Object} event - Performance settings update event
 */
function handlePerformanceUpdate(event) {
  if (!event.settings) return;
  
  // Update performance settings
  updateConfig({
    performance: event.settings
  });
  
  // Adjust rendering quality based on performance settings
  if (event.settings.prioritizeFramerate) {
    updateConfig({
      rendering: {
        quality: 'low',
        shadows: false,
        reflections: false,
        postProcessing: false
      }
    });
  }
}

/**
 * Handles user preference updates
 * @param {Object} event - User preference update event
 */
function handleUserPreferencesUpdate(event) {
  if (!event.preferences) return;
  
  // Update relevant configuration sections based on user preferences
  if (event.preferences.theme) {
    updateConfig({
      ui: {
        theme: event.preferences.theme
      }
    });
  }
  
  if (event.preferences.avatar) {
    updateConfig({
      avatar: {
        preferredType: event.preferences.avatar.type || currentConfig.avatar.preferredType,
        defaultAvatar: event.preferences.avatar.name || currentConfig.avatar.defaultAvatar
      }
    });
  }
}

/**
 * Handles device orientation changes
 */
function handleOrientationChange() {
  // Adjust rendering settings based on orientation
  const isLandscape = window.orientation === 90 || window.orientation === -90;
  
  updateConfig({
    performance: {
      targetResolutionScale: isLandscape ? 0.8 : 0.6
    }
  });
}

/**
 * Handles network status changes
 */
function handleNetworkChange() {
  if (!navigator.connection) return;
  
  const connection = navigator.connection;
  const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
  const downlink = connection.downlink; // Mbps
  
  // Adjust pixel streaming settings based on network quality
  if (effectiveType === '4g' && downlink >= 5) {
    // Good connection, enable high-quality streaming
    updateConfig({
      rendering: {
        preferredMode: 'hybrid'
      }
    });
  } else if (effectiveType === '3g' || (effectiveType === '4g' && downlink < 5)) {
    // Medium connection, use local rendering if possible
    updateConfig({
      rendering: {
        preferredMode: 'webgl',
        quality: 'medium'
      }
    });
  } else {
    // Poor connection, use minimal quality
    updateConfig({
      rendering: {
        preferredMode: 'webgl',
        quality: 'low',
        shadows: false,
        reflections: false,
        postProcessing: false
      }
    });
  }
}

/**
 * Updates the current configuration
 * @param {Object} newConfig - New configuration options
 * @returns {Object} - Updated configuration
 */
export function updateConfig(newConfig) {
  // Deep merge the new configuration with the current one
  currentConfig = deepMerge(currentConfig, newConfig);
  
  // Save to storage
  saveConfigToStorage(currentConfig);
  
  // Publish configuration update event
  publish('unreal:config:updated', { config: currentConfig });
  
  return currentConfig;
}

/**
 * Gets the current configuration
 * @returns {Object} - Current configuration
 */
export function getConfig() {
  return { ...currentConfig };
}

/**
 * Gets a specific configuration section
 * @param {string} section - Configuration section name
 * @returns {Object} - Configuration section
 */
export function getConfigSection(section) {
  return currentConfig[section] ? { ...currentConfig[section] } : {};
}

/**
 * Resets configuration to defaults
 * @param {string} section - Optional section to reset (resets all if not specified)
 * @returns {Object} - Updated configuration
 */
export function resetConfig(section) {
  if (section && DEFAULT_CONFIG[section]) {
    // Reset only the specified section
    currentConfig[section] = { ...DEFAULT_CONFIG[section] };
  } else {
    // Reset entire configuration
    currentConfig = { ...DEFAULT_CONFIG };
  }
  
  // Save to storage
  saveConfigToStorage(currentConfig);
  
  // Publish configuration reset event
  publish('unreal:config:reset', { 
    config: currentConfig,
    section: section
  });
  
  return currentConfig;
}

/**
 * Applies a preset configuration
 * @param {string} preset - Preset name ('highEnd', 'midRange', 'lowEnd', 'mobile', 'accessibility')
 * @returns {Object} - Updated configuration
 */
export function applyPreset(preset) {
  if (!DEVICE_CONFIGS[preset]) {
    console.warn(`Unknown configuration preset: ${preset}`);
    return currentConfig;
  }
  
  // Apply the preset configuration
  updateConfig(DEVICE_CONFIGS[preset]);
  
  // Publish preset applied event
  publish('unreal:config:preset:applied', { 
    preset,
    config: currentConfig
  });
  
  return currentConfig;
}

export default {
  initializeConfig,
  updateConfig,
  getConfig,
  getConfigSection,
  resetConfig,
  applyPreset
};
