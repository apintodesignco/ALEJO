/**
 * ALEJO Unreal Engine Avatar System Integration
 * 
 * This module serves as the main entry point for the Unreal Engine avatar system,
 * coordinating between different avatar types (MetaHuman, custom, etc.) and
 * handling integration with the rest of ALEJO.
 */

import { publish, subscribe } from '../../core/event-bus.js';
import { initializeMetaHumanSystem } from './metahuman.js';

// Avatar types
export const AVATAR_TYPES = {
  METAHUMAN: 'metahuman',
  CUSTOM: 'custom',
  STYLIZED: 'stylized',
  FALLBACK: 'fallback'
};

// Default configuration
const DEFAULT_CONFIG = {
  preferredType: AVATAR_TYPES.METAHUMAN,
  defaultAvatar: 'alejo',
  preloadAvatars: ['alejo'],
  expressionDetection: true,
  voiceIntegration: true,
  accessibilityFeatures: {
    highContrast: false,
    simplifiedAnimations: false,
    reducedMotion: false,
    descriptiveAudio: false
  }
};

/**
 * Initializes the Unreal Engine avatar system
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @returns {Promise<Object>} - Initialized avatar system
 */
export async function initializeAvatarSystem(renderingSystem, config = {}) {
  console.log('Initializing ALEJO Unreal Engine avatar system');
  
  // Merge with default configuration
  const avatarConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Determine the best avatar type based on preferences and capabilities
    const avatarType = determineAvatarType(renderingSystem, avatarConfig);
    console.log(`Selected avatar type: ${avatarType}`);
    
    // Initialize the selected avatar system
    const avatarManager = await initializeAvatarManager(avatarType, renderingSystem, avatarConfig);
    
    // Set up event listeners
    setupEventListeners(avatarManager, avatarConfig);
    
    // Publish initialization success event
    publish('unreal:avatars:initialized', { 
      type: avatarType
    });
    
    return {
      ...avatarManager,
      type: avatarType,
      
      /**
       * Updates the avatar system configuration
       * @param {Object} newConfig - New configuration options
       * @returns {Promise<void>}
       */
      async updateConfig(newConfig) {
        // Update accessibility settings if provided
        if (newConfig.accessibilityFeatures) {
          await avatarManager.updateAccessibilitySettings(newConfig.accessibilityFeatures);
        }
        
        // Update other configuration options
        Object.assign(avatarConfig, newConfig);
      }
    };
  } catch (error) {
    console.error('Failed to initialize Unreal Engine avatar system:', error);
    publish('unreal:avatars:error', { error });
    
    // Try to initialize fallback avatar system
    if (config.preferredType !== AVATAR_TYPES.FALLBACK) {
      console.log('Attempting to initialize fallback avatar system');
      return initializeAvatarSystem(renderingSystem, {
        ...config,
        preferredType: AVATAR_TYPES.FALLBACK
      });
    }
    
    throw error;
  }
}

/**
 * Determines the best avatar type based on rendering system and preferences
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @returns {string} - Selected avatar type
 */
function determineAvatarType(renderingSystem, config) {
  const preferredType = config.preferredType;
  
  // Check if the preferred type is compatible with the rendering system
  switch (preferredType) {
    case AVATAR_TYPES.METAHUMAN:
      // MetaHuman requires advanced rendering capabilities
      if (renderingSystem.type === 'webgpu' || 
          renderingSystem.type === 'pixel-streaming' || 
          (renderingSystem.type === 'webgl' && renderingSystem.version === 2)) {
        return AVATAR_TYPES.METAHUMAN;
      }
      break;
      
    case AVATAR_TYPES.CUSTOM:
    case AVATAR_TYPES.STYLIZED:
      // Custom and stylized avatars can work with most rendering systems
      if (renderingSystem.type !== 'fallback') {
        return preferredType;
      }
      break;
      
    case AVATAR_TYPES.FALLBACK:
      return AVATAR_TYPES.FALLBACK;
  }
  
  // If preferred type is not compatible, choose the best available option
  if (renderingSystem.type === 'webgpu' || 
      renderingSystem.type === 'pixel-streaming' || 
      (renderingSystem.type === 'webgl' && renderingSystem.version === 2)) {
    return AVATAR_TYPES.METAHUMAN;
  } else if (renderingSystem.type === 'webgl') {
    return AVATAR_TYPES.STYLIZED;
  } else {
    return AVATAR_TYPES.FALLBACK;
  }
}

/**
 * Initializes the selected avatar manager
 * @param {string} type - Avatar type
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @returns {Promise<Object>} - Initialized avatar manager
 */
async function initializeAvatarManager(type, renderingSystem, config) {
  switch (type) {
    case AVATAR_TYPES.METAHUMAN:
      return initializeMetaHumanSystem(renderingSystem, {
        defaultAvatar: config.defaultAvatar,
        preloadAvatars: config.preloadAvatars,
        lipSyncEnabled: config.voiceIntegration,
        emotionDetectionEnabled: config.expressionDetection,
        accessibilityFeatures: config.accessibilityFeatures
      });
      
    case AVATAR_TYPES.CUSTOM:
      // Custom avatar system not yet implemented
      console.warn('Custom avatar system not yet implemented, falling back to stylized');
      return initializeStylizedAvatarSystem(renderingSystem, config);
      
    case AVATAR_TYPES.STYLIZED:
      return initializeStylizedAvatarSystem(renderingSystem, config);
      
    case AVATAR_TYPES.FALLBACK:
      return initializeFallbackAvatarSystem(renderingSystem, config);
      
    default:
      throw new Error(`Unsupported avatar type: ${type}`);
  }
}

/**
 * Initializes the stylized avatar system
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @returns {Promise<Object>} - Initialized avatar system
 */
async function initializeStylizedAvatarSystem(renderingSystem, config) {
  console.log('Initializing stylized avatar system (placeholder)');
  
  // This is a placeholder for the actual stylized avatar system
  // In a real implementation, this would initialize a stylized avatar system
  
  // Create a basic avatar manager
  return createBasicAvatarManager(renderingSystem, config, 'stylized');
}

/**
 * Initializes the fallback avatar system
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @returns {Promise<Object>} - Initialized avatar system
 */
async function initializeFallbackAvatarSystem(renderingSystem, config) {
  console.log('Initializing fallback avatar system');
  
  // Create a basic avatar manager with limited functionality
  return createBasicAvatarManager(renderingSystem, config, 'fallback');
}

/**
 * Creates a basic avatar manager for stylized and fallback avatar types
 * @param {Object} renderingSystem - The initialized Unreal Engine rendering system
 * @param {Object} config - Avatar system configuration
 * @param {string} type - Avatar type ('stylized' or 'fallback')
 * @returns {Object} - Basic avatar manager
 */
function createBasicAvatarManager(renderingSystem, config, type) {
  // State management
  const state = {
    initialized: false,
    activeAvatarId: null,
    loadedAvatars: new Map(),
    currentExpression: null,
    lipSyncActive: false
  };
  
  // Create avatar manager
  const avatarManager = {
    /**
     * Initializes the avatar manager
     * @returns {Promise<void>}
     */
    async initialize() {
      console.log(`Initializing ${type} avatar manager`);
      
      // Simulate initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      state.initialized = true;
    },
    
    /**
     * Loads an avatar by ID
     * @param {string} avatarId - Avatar identifier
     * @returns {Promise<Object>} - Loaded avatar
     */
    async loadAvatar(avatarId) {
      console.log(`Loading ${type} avatar: ${avatarId}`);
      
      // Check if avatar is already loaded
      if (state.loadedAvatars.has(avatarId)) {
        return state.loadedAvatars.get(avatarId);
      }
      
      // Create avatar object
      const avatar = {
        id: avatarId,
        name: avatarId,
        isLoaded: true,
        type
      };
      
      // Store in loaded avatars map
      state.loadedAvatars.set(avatarId, avatar);
      
      // Publish avatar loaded event
      publish('unreal:avatar:loaded', { avatarId });
      
      return avatar;
    },
    
    /**
     * Sets the active avatar
     * @param {string} avatarId - Avatar identifier
     * @returns {Promise<Object>} - Active avatar
     */
    async setActiveAvatar(avatarId) {
      console.log(`Setting active ${type} avatar: ${avatarId}`);
      
      // Load avatar if not already loaded
      if (!state.loadedAvatars.has(avatarId)) {
        await this.loadAvatar(avatarId);
      }
      
      // Get avatar object
      const avatar = state.loadedAvatars.get(avatarId);
      
      // Update state
      state.activeAvatarId = avatarId;
      
      // Publish avatar activated event
      publish('unreal:avatar:activated', { avatarId });
      
      return avatar;
    },
    
    /**
     * Gets the currently active avatar
     * @returns {Object|null} - Active avatar or null if none
     */
    getActiveAvatar() {
      if (!state.activeAvatarId) {
        return null;
      }
      
      return state.loadedAvatars.get(state.activeAvatarId) || null;
    },
    
    /**
     * Gets a list of all loaded avatars
     * @returns {Array<Object>} - List of loaded avatars
     */
    getLoadedAvatars() {
      return Array.from(state.loadedAvatars.values());
    },
    
    /**
     * Sets an expression on the active avatar
     * @param {string} expression - Expression name
     * @param {number} intensity - Expression intensity (0.0 to 1.0)
     * @param {number} duration - Duration in seconds (0 for indefinite)
     * @returns {Promise<void>}
     */
    async setExpression(expression, intensity = 1.0, duration = 0) {
      if (!state.activeAvatarId) {
        throw new Error('No active avatar');
      }
      
      console.log(`Setting expression on ${type} avatar ${state.activeAvatarId}: ${expression}`);
      
      // Update current expression
      state.currentExpression = {
        type: expression,
        intensity,
        timestamp: Date.now()
      };
      
      // Publish expression changed event
      publish('unreal:avatar:expression:changed', {
        avatarId: state.activeAvatarId,
        expression,
        intensity
      });
      
      // If duration is specified, schedule expression end
      if (duration > 0) {
        setTimeout(() => {
          // Reset expression if it's still the current one
          if (state.currentExpression && 
              state.currentExpression.type === expression && 
              state.currentExpression.timestamp === state.currentExpression.timestamp) {
            this.resetExpression();
          }
        }, duration * 1000);
      }
    },
    
    /**
     * Resets the avatar expression to neutral
     * @returns {Promise<void>}
     */
    async resetExpression() {
      if (!state.activeAvatarId) {
        return;
      }
      
      console.log(`Resetting expression on ${type} avatar ${state.activeAvatarId}`);
      
      // Clear current expression
      state.currentExpression = null;
      
      // Publish expression reset event
      publish('unreal:avatar:expression:reset', {
        avatarId: state.activeAvatarId
      });
    },
    
    /**
     * Starts lip sync for speech
     * @param {string} text - Text to speak
     * @param {Object} options - Lip sync options
     * @returns {Promise<void>}
     */
    async startLipSync(text, options = {}) {
      if (!state.activeAvatarId || !config.voiceIntegration) {
        return;
      }
      
      console.log(`Starting lip sync for ${type} avatar ${state.activeAvatarId}`);
      
      // Set lip sync active
      state.lipSyncActive = true;
      
      // Publish lip sync started event
      publish('unreal:avatar:lipsync:started', { 
        avatarId: state.activeAvatarId,
        text
      });
    },
    
    /**
     * Stops active lip sync
     * @returns {Promise<void>}
     */
    async stopLipSync() {
      if (!state.activeAvatarId || !state.lipSyncActive) {
        return;
      }
      
      console.log(`Stopping lip sync for ${type} avatar ${state.activeAvatarId}`);
      
      // Set lip sync inactive
      state.lipSyncActive = false;
      
      // Publish lip sync stopped event
      publish('unreal:avatar:lipsync:stopped', { 
        avatarId: state.activeAvatarId
      });
    },
    
    /**
     * Updates avatar animation state
     * @param {string} animation - Animation name or ID
     * @param {Object} options - Animation options
     * @returns {Promise<void>}
     */
    async playAnimation(animation, options = {}) {
      if (!state.activeAvatarId) {
        return;
      }
      
      console.log(`Playing animation on ${type} avatar ${state.activeAvatarId}: ${animation}`);
      
      // Publish animation started event
      publish('unreal:avatar:animation:started', { 
        avatarId: state.activeAvatarId,
        animation
      });
    },
    
    /**
     * Stops current animation
     * @returns {Promise<void>}
     */
    async stopAnimation() {
      if (!state.activeAvatarId) {
        return;
      }
      
      console.log(`Stopping animation on ${type} avatar ${state.activeAvatarId}`);
      
      // Publish animation stopped event
      publish('unreal:avatar:animation:stopped', { 
        avatarId: state.activeAvatarId
      });
    },
    
    /**
     * Updates accessibility settings for avatars
     * @param {Object} settings - Accessibility settings
     * @returns {Promise<void>}
     */
    async updateAccessibilitySettings(settings) {
      console.log(`Updating ${type} avatar accessibility settings`);
      
      // Update config
      config.accessibilityFeatures = {
        ...config.accessibilityFeatures,
        ...settings
      };
      
      // Publish settings updated event
      publish('unreal:avatar:accessibility:updated', { 
        settings: config.accessibilityFeatures
      });
    },
    
    /**
     * Shuts down the avatar system
     * @returns {Promise<void>}
     */
    async shutdown() {
      console.log(`Shutting down ${type} avatar system`);
      
      // Stop active processes
      if (state.lipSyncActive) {
        await this.stopLipSync();
      }
      
      // Reset expression
      await this.resetExpression();
      
      // Clear state
      state.initialized = false;
      state.activeAvatarId = null;
      state.loadedAvatars.clear();
      state.currentExpression = null;
    }
  };
  
  return avatarManager;
}

/**
 * Sets up event listeners for the avatar system
 * @param {Object} avatarManager - Initialized avatar manager
 * @param {Object} config - Avatar system configuration
 */
function setupEventListeners(avatarManager, config) {
  // Handle speech events for lip sync
  if (config.voiceIntegration) {
    subscribe('speech:start', async (event) => {
      if (event.text) {
        await avatarManager.startLipSync(event.text, event.options);
      }
    });
    
    subscribe('speech:end', async () => {
      await avatarManager.stopLipSync();
    });
  }
  
  // Handle emotion events for expressions
  if (config.expressionDetection) {
    subscribe('emotion:detected', async (event) => {
      if (event.emotion) {
        // Map detected emotions to avatar expressions
        const expressionMap = {
          happy: 'happy',
          sad: 'sad',
          angry: 'angry',
          surprised: 'surprised',
          confused: 'confused',
          neutral: 'neutral'
        };
        
        const expression = expressionMap[event.emotion] || 'neutral';
        const intensity = event.intensity || 1.0;
        
        await avatarManager.setExpression(expression, intensity);
      }
    });
  }
  
  // Handle accessibility setting changes
  subscribe('accessibility:settings:update', async (event) => {
    if (event.settings) {
      const relevantSettings = {
        highContrast: event.settings.highContrast,
        simplifiedAnimations: event.settings.simplifiedAnimations,
        reducedMotion: event.settings.reducedMotion,
        descriptiveAudio: event.settings.descriptiveAudio
      };
      
      await avatarManager.updateAccessibilitySettings(relevantSettings);
    }
  });
}

export default {
  initializeAvatarSystem,
  AVATAR_TYPES
};
