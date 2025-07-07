/**
 * @file module-integration-helper.js
 * @description Helper utilities to standardize module integration with the Resource Allocation Manager
 * @module performance/module-integration-helper
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  getResourceAllocationManager, 
  RESOURCE_MODES, 
  RESOURCE_EVENTS 
} from './resource-allocation-manager.js';
import { 
  registerComponent, 
  registerModule, 
  COMPONENT_TYPES 
} from './component-registration.js';
import { publish, subscribe } from '../core/events.js';
import { auditTrail } from '../security/audit-trail.js';

/**
 * Create a standardized module integration with the Resource Allocation Manager
 * 
 * @param {string} moduleName - Name of the module (e.g., 'voice', 'vision')
 * @param {Object} componentConfigs - Configuration for each component to register
 * @param {Object} options - Additional options
 * @returns {Object} - Module integration API
 */
export function createModuleIntegration(moduleName, componentConfigs, options = {}) {
  // Track registration state
  let isRegistered = false;
  let registrations = {};
  let currentMode = null;
  
  // Create component IDs with proper namespacing
  const componentIds = {};
  Object.keys(componentConfigs).forEach(key => {
    componentIds[key] = `${moduleName}.${key}`;
  });
  
  /**
   * Register the module with the Resource Allocation Manager
   * 
   * @param {Object} registrationOptions - Options to pass during registration
   * @returns {boolean} - Success status
   */
  function registerWithResourceManager(registrationOptions = {}) {
    if (isRegistered) {
      console.log(`[${moduleName}] Already registered with Resource Allocation Manager`);
      return true;
    }
    
    try {
      const resourceManager = getResourceAllocationManager();
      const mergedOptions = { ...options, ...registrationOptions };
      
      // Register each component
      Object.keys(componentConfigs).forEach(key => {
        const config = componentConfigs[key];
        const componentId = componentIds[key];
        
        registrations[key] = registerComponent(componentId, {
          type: config.type || COMPONENT_TYPES.GENERAL,
          pauseHandler: () => {
            if (config.pauseEvent) {
              publish(config.pauseEvent, { reason: 'resource_manager' });
            }
            if (typeof config.pauseHandler === 'function') {
              config.pauseHandler();
            }
          },
          resumeHandler: () => {
            if (config.resumeEvent) {
              publish(config.resumeEvent, { reason: 'resource_manager' });
            }
            if (typeof config.resumeHandler === 'function') {
              config.resumeHandler();
            }
          },
          reduceResourcesHandler: (mode) => {
            if (config.reduceEvent) {
              publish(config.reduceEvent, { mode, reason: 'resource_manager' });
            }
            if (typeof config.reduceResourcesHandler === 'function') {
              config.reduceResourcesHandler(mode);
            }
          },
          customRequirements: config.customRequirements || {
            cpuPriority: config.cpuPriority || 5,
            memoryFootprint: config.memoryFootprint || 10,
            isEssential: config.isEssential || false
          }
        });
      });
      
      // Subscribe to resource mode changes
      currentMode = resourceManager.getCurrentMode();
      subscribe('resource:mode_changed', (event) => {
        currentMode = event.mode;
        handleResourceModeChange(event);
      });
      
      isRegistered = true;
      
      // Log registration for audit trail
      auditTrail.log({
        action: `${moduleName}:resource_management:register`,
        category: 'performance',
        details: {
          timestamp: new Date().toISOString(),
          options: mergedOptions
        }
      });
      
      console.log(`[${moduleName}] Registered with Resource Allocation Manager`);
      return true;
    } catch (error) {
      console.error(`[${moduleName}] Failed to register with Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  /**
   * Unregister the module from the Resource Allocation Manager
   * 
   * @returns {boolean} - Success status
   */
  function unregisterFromResourceManager() {
    if (!isRegistered) return true;
    
    try {
      // Unregister all components
      Object.values(registrations).forEach(registration => {
        if (registration && registration.unregister) {
          registration.unregister();
        }
      });
      
      registrations = {};
      isRegistered = false;
      
      // Log unregistration for audit trail
      auditTrail.log({
        action: `${moduleName}:resource_management:unregister`,
        category: 'performance',
        details: {
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`[${moduleName}] Unregistered from Resource Allocation Manager`);
      return true;
    } catch (error) {
      console.error(`[${moduleName}] Failed to unregister from Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  /**
   * Handle resource mode changes
   * 
   * @param {Object} event - Resource mode change event
   */
  function handleResourceModeChange(event) {
    const { mode, reason } = event;
    
    // Log mode change for audit trail
    auditTrail.log({
      action: `${moduleName}:resource_mode:change`,
      category: 'performance',
      details: {
        timestamp: new Date().toISOString(),
        mode,
        reason
      }
    });
    
    // Call the mode change handler if provided
    if (options.onModeChange && typeof options.onModeChange === 'function') {
      options.onModeChange(mode, reason);
    }
    
    // Publish a module-specific event
    publish(`${moduleName}:resource_mode_changed`, { mode, reason });
  }
  
  /**
   * Get the current resource mode
   * 
   * @returns {string} - Current resource mode
   */
  function getCurrentResourceMode() {
    return currentMode;
  }
  
  /**
   * Check if the module is registered with the Resource Allocation Manager
   * 
   * @returns {boolean} - Registration status
   */
  function isRegisteredWithManager() {
    return isRegistered;
  }
  
  // Return the public API
  return {
    registerWithResourceManager,
    unregisterFromResourceManager,
    getCurrentResourceMode,
    isRegisteredWithManager,
    componentIds
  };
}

export default {
  createModuleIntegration
};
