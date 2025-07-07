/**
 * @file component-registration.js
 * @description Utility functions for registering components with the Resource Allocation Manager
 * @module performance/component-registration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { getResourceAllocationManager } from './resource-allocation-manager.js';

/**
 * Component types with default resource requirements
 */
export const COMPONENT_TYPES = {
  GESTURE_RECOGNITION: {
    cpuPriority: 8,
    memoryFootprint: 50,
    isEssential: false
  },
  VOICE_RECOGNITION: {
    cpuPriority: 8,
    memoryFootprint: 40,
    isEssential: false
  },
  FACE_RECOGNITION: {
    cpuPriority: 7,
    memoryFootprint: 60,
    isEssential: false
  },
  REASONING_ENGINE: {
    cpuPriority: 6,
    memoryFootprint: 30,
    isEssential: true
  },
  UI_COMPONENT: {
    cpuPriority: 5,
    memoryFootprint: 15,
    isEssential: true
  },
  BACKGROUND_TASK: {
    cpuPriority: 3,
    memoryFootprint: 10,
    isEssential: false
  },
  DATA_PROCESSING: {
    cpuPriority: 4,
    memoryFootprint: 20,
    isEssential: false
  },
  ACCESSIBILITY_FEATURE: {
    cpuPriority: 7,
    memoryFootprint: 15,
    isEssential: true
  }
};

/**
 * Register a component with the Resource Allocation Manager
 * 
 * @param {string} componentId - Unique identifier for the component
 * @param {Object} options - Registration options
 * @param {string} options.type - Component type from COMPONENT_TYPES
 * @param {Function} options.pauseHandler - Function to call when component should pause
 * @param {Function} options.resumeHandler - Function to call when component can resume
 * @param {Function} options.reduceResourcesHandler - Function to call when component should reduce resource usage
 * @param {Object} options.customRequirements - Custom resource requirements to override defaults
 * @returns {Object} - Registration result with unregister function
 */
export function registerComponent(componentId, options) {
  const resourceManager = getResourceAllocationManager();
  
  if (!componentId) {
    console.error('Component ID is required for registration');
    return { success: false };
  }
  
  // Get default requirements based on component type
  const defaultRequirements = options.type && COMPONENT_TYPES[options.type] 
    ? COMPONENT_TYPES[options.type] 
    : COMPONENT_TYPES.BACKGROUND_TASK;
  
  // Merge default requirements with custom requirements
  const requirements = {
    ...defaultRequirements,
    ...(options.customRequirements || {}),
    pauseCallback: options.pauseHandler || (() => {}),
    resumeCallback: options.resumeHandler || (() => {}),
    reduceResourcesCallback: options.reduceResourcesHandler || (() => {})
  };
  
  // Register with resource manager
  const success = resourceManager.registerComponent(componentId, requirements);
  
  return {
    success,
    unregister: () => resourceManager.unregisterComponent(componentId)
  };
}

/**
 * Create a higher-order component that automatically registers with the Resource Allocation Manager
 * 
 * @param {Function} ComponentClass - Component class to wrap
 * @param {Object} options - Registration options
 * @returns {Function} - Wrapped component class
 */
export function withResourceManagement(ComponentClass, options = {}) {
  return class ResourceManagedComponent extends ComponentClass {
    constructor(...args) {
      super(...args);
      
      // Generate component ID if not provided
      this.componentId = options.componentId || `${ComponentClass.name}_${Date.now()}`;
      
      // Default handlers that call methods on the component if they exist
      const defaultHandlers = {
        pauseHandler: () => {
          if (typeof this.pause === 'function') {
            this.pause();
          }
        },
        resumeHandler: () => {
          if (typeof this.resume === 'function') {
            this.resume();
          }
        },
        reduceResourcesHandler: (mode) => {
          if (typeof this.reduceResources === 'function') {
            this.reduceResources(mode);
          }
        }
      };
      
      // Register with resource manager
      this.registration = registerComponent(this.componentId, {
        ...options,
        ...defaultHandlers
      });
    }
    
    // Override dispose method to unregister
    dispose() {
      if (this.registration && this.registration.unregister) {
        this.registration.unregister();
      }
      
      // Call original dispose method if it exists
      if (super.dispose) {
        super.dispose();
      }
    }
  };
}

/**
 * Register a module with multiple components
 * 
 * @param {string} moduleId - Unique identifier for the module
 * @param {Object} components - Map of component IDs to options
 * @returns {Object} - Registration result with unregister function
 */
export function registerModule(moduleId, components) {
  const registrations = {};
  let success = true;
  
  // Register each component
  Object.entries(components).forEach(([componentId, options]) => {
    const fullComponentId = `${moduleId}.${componentId}`;
    const registration = registerComponent(fullComponentId, options);
    
    registrations[componentId] = registration;
    success = success && registration.success;
  });
  
  // Return unregister function for all components
  return {
    success,
    unregister: () => {
      Object.values(registrations).forEach(registration => {
        if (registration.unregister) {
          registration.unregister();
        }
      });
    }
  };
}

export default {
  registerComponent,
  registerModule,
  withResourceManagement,
  COMPONENT_TYPES
};
