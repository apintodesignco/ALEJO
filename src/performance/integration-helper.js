/**
 * @file integration-helper.js
 * @description Provides helper functions to make integration with the Resource Allocation Manager easier
 * @module performance/integration-helper
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { ResourceAllocationManager } from './resource-allocation-manager.js';
import { publish, subscribe } from '../core/events.js';
import { RESOURCE_MODES } from './resource-modes.js';

// Get the singleton instance of the Resource Allocation Manager
const resourceManager = ResourceAllocationManager.getInstance();

/**
 * Creates a standardized integration module for components to register with the Resource Allocation Manager
 * 
 * @param {string} moduleName - The name of the module (e.g., 'voice', 'vision', 'reasoning')
 * @param {Object} componentConfigs - Configuration for each component to register
 * @param {Object} options - Additional options
 * @returns {Object} - The integration module with standardized functions
 */
export function createAdaptiveIntegration(moduleName, componentConfigs, options = {}) {
  // Track registered components and current resource mode
  const registeredComponents = {};
  let currentMode = options.initialMode || RESOURCE_MODES.BALANCED;
  let isRegistered = false;
  
  // Function to register all components with Resource Allocation Manager
  function registerWithResourceManager(opts = {}) {
    if (isRegistered) {
      console.log(`[${moduleName}] Already registered with Resource Allocation Manager`);
      return true;
    }
    
    try {
      // Register each component with enhanced options
      Object.entries(componentConfigs).forEach(([componentId, config]) => {
        const fullComponentId = `${moduleName}.${componentId}`;
        
        // Register component with Resource Allocation Manager
        resourceManager.registerComponent(fullComponentId, {
          cpuPriority: config.cpuPriority,
          memoryFootprint: config.memoryFootprint,
          isEssential: config.isEssential,
          category: config.category,
          adaptiveOptions: config.adaptiveOptions,
          pauseCallback: () => {
            console.log(`[${moduleName}] Pausing component: ${componentId}`);
            publish(config.pauseEvent, { reason: 'resource_management' });
          },
          resumeCallback: () => {
            console.log(`[${moduleName}] Resuming component: ${componentId}`);
            publish(config.resumeEvent, { reason: 'resource_management' });
          },
          reduceResourcesCallback: (mode) => {
            console.log(`[${moduleName}] Reducing resources for component: ${componentId}, mode: ${mode}`);
            publish(config.reduceEvent, { mode, reason: 'resource_management' });
            applyResourceRecommendations(fullComponentId, mode);
          }
        });
        
        // Track registered component
        registeredComponents[componentId] = fullComponentId;
      });
      
      // Set up event subscription for resource mode changes
      subscribe('resource-manager:mode-changed', handleResourceModeChange);
      
      // Request initial recommendations for all components
      Object.values(registeredComponents).forEach(componentId => {
        requestResourceRecommendations(componentId);
      });
      
      isRegistered = true;
      console.log(`[${moduleName}] Successfully registered with Resource Allocation Manager`);
      
      // Call onRegistration callback if provided
      if (typeof options.onRegistration === 'function') {
        options.onRegistration();
      }
      
      return true;
    } catch (error) {
      console.error(`[${moduleName}] Failed to register with Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  // Function to unregister all components
  function unregisterFromResourceManager() {
    if (!isRegistered) return false;
    
    try {
      // Unregister each component
      Object.values(registeredComponents).forEach(componentId => {
        resourceManager.unregisterComponent(componentId);
      });
      
      // Clear tracking
      Object.keys(registeredComponents).forEach(key => delete registeredComponents[key]);
      isRegistered = false;
      
      console.log(`[${moduleName}] Successfully unregistered from Resource Allocation Manager`);
      
      // Call onUnregistration callback if provided
      if (typeof options.onUnregistration === 'function') {
        options.onUnregistration();
      }
      
      return true;
    } catch (error) {
      console.error(`[${moduleName}] Failed to unregister from Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  // Function to handle resource mode changes
  function handleResourceModeChange(data) {
    const { mode, reason } = data;
    currentMode = mode;
    
    console.log(`[${moduleName}] Adapting to resource mode: ${mode}, reason: ${reason}`);
    
    // Call custom mode change handler if provided
    if (typeof options.onModeChange === 'function') {
      options.onModeChange(mode, reason);
    }
    
    // Request updated recommendations for all components
    Object.values(registeredComponents).forEach(componentId => {
      requestResourceRecommendations(componentId);
    });
  }
  
  // Function to request resource recommendations from Resource Allocation Manager
  function requestResourceRecommendations(componentId) {
    if (!componentId || !isRegistered) return;
    
    publish('resource-manager:request-recommendations', {
      componentId,
      resourceType: 'all'
    });
    
    // Set up one-time listener for recommendations
    const responseEvent = `resource-manager:recommendations-${componentId}`;
    const listener = (recommendations) => {
      applyResourceRecommendations(componentId, currentMode, recommendations);
      // Remove the one-time listener
      subscribe(responseEvent, listener, { once: true });
    };
    
    // Subscribe to response
    subscribe(responseEvent, listener, { once: true });
  }
  
  // Apply resource recommendations to component
  function applyResourceRecommendations(componentId, mode, recommendations) {
    if (!componentId) return;
    
    // Extract short componentId for event publishing
    const shortId = componentId.split('.')[1];
    if (!shortId || !componentConfigs[shortId]) return;
    
    // If we have specific recommendations from the resource manager
    if (recommendations) {
      console.log(`[${moduleName}] Applying specific recommendations for ${shortId}:`, recommendations.recommendations);
      
      // Call custom recommendation handler if provided
      if (typeof options.onRecommendations === 'function') {
        options.onRecommendations(shortId, recommendations);
      } else {
        // Default handler for common resource types
        defaultApplyRecommendations(shortId, componentConfigs[shortId], recommendations);
      }
    } 
    // Otherwise apply mode-based adjustments
    else if (typeof options.onModeChange === 'function') {
      options.onModeChange(mode, `Default adjustment for ${shortId}`);
    }
  }
  
  // Default handler for applying recommendations
  function defaultApplyRecommendations(componentId, componentConfig, recommendations) {
    // Apply CPU recommendations
    if (recommendations.recommendations.cpu) {
      const cpuRec = recommendations.recommendations.cpu;
      publish(`${moduleName}:${componentId}:adjust`, {
        throttleLevel: cpuRec.throttleLevel,
        updateInterval: cpuRec.updateInterval,
        batchSize: cpuRec.batchSize,
        source: 'resource_manager'
      });
    }
    
    // Apply memory recommendations
    if (recommendations.recommendations.memory) {
      const memRec = recommendations.recommendations.memory;
      publish(`${moduleName}:${componentId}:memory`, {
        cacheSize: memRec.cacheSize,
        preloadStrategy: memRec.preloadStrategy,
        releaseUnused: memRec.releaseUnused,
        source: 'resource_manager'
      });
    }
  }
  
  // Function to get current resource mode
  function getCurrentResourceMode() {
    return currentMode;
  }
  
  // Function to check if the module is registered
  function isRegisteredWithResourceManager() {
    return isRegistered;
  }
  
  // Return the public API
  return {
    registerWithResourceManager,
    unregisterFromResourceManager,
    getCurrentResourceMode,
    isRegisteredWithResourceManager,
    requestResourceRecommendations
  };
}

/**
 * Generate default adaptive options for a component
 * 
 * @param {boolean} isAccessibility - Whether this is an accessibility component
 * @param {boolean} isEssential - Whether this is an essential component
 * @param {number} scalingFactor - How much the component can scale down (0.0-1.0)
 * @returns {Object} - Adaptive options object
 */
export function createAdaptiveOptions(isAccessibility, isEssential, scalingFactor = 0.5) {
  return {
    minimalModeOperation: isAccessibility || isEssential,
    degradedOperation: true,
    resourceScalingFactor: isAccessibility ? Math.max(0.6, scalingFactor) : 
                           isEssential ? Math.max(0.4, scalingFactor) : 
                           scalingFactor
  };
}

/**
 * Generate quality configuration based on resource mode
 * 
 * @param {string} mode - Resource mode (from RESOURCE_MODES)
 * @param {boolean} isAccessibility - Whether this is for an accessibility component
 * @returns {Object} - Quality configuration object
 */
export function getQualityConfigForMode(mode, isAccessibility = false) {
  // Default configs for different modes
  const configs = {
    [RESOURCE_MODES.FULL]: {
      quality: 'high',
      updateFrequency: 'high',
      features: 'all',
      optimizations: 'none'
    },
    [RESOURCE_MODES.BALANCED]: {
      quality: 'medium',
      updateFrequency: 'medium',
      features: 'standard',
      optimizations: 'light'
    },
    [RESOURCE_MODES.CONSERVATIVE]: {
      quality: 'low',
      updateFrequency: 'low',
      features: 'essential',
      optimizations: 'aggressive'
    },
    [RESOURCE_MODES.MINIMAL]: {
      quality: 'minimal',
      updateFrequency: 'minimal',
      features: 'critical',
      optimizations: 'maximum'
    }
  };
  
  // Get the base config for the mode
  const baseConfig = configs[mode] || configs[RESOURCE_MODES.BALANCED];
  
  // For accessibility components, ensure minimum viable quality
  if (isAccessibility) {
    return {
      ...baseConfig,
      quality: mode === RESOURCE_MODES.MINIMAL ? 'low' : baseConfig.quality, // Never go below 'low' for accessibility
      updateFrequency: mode === RESOURCE_MODES.MINIMAL ? 'low' : baseConfig.updateFrequency, // Ensure reasonable update frequency
      features: mode === RESOURCE_MODES.MINIMAL ? 'essential' : baseConfig.features // Always keep essential features
    };
  }
  
  return baseConfig;
}
