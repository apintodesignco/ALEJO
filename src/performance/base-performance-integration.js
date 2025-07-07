/**
 * @file base-performance-integration.js
 * @description Base class for integrating ALEJO modules with the Resource Allocation Manager
 * @module performance/base-performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  getResourceAllocationManager, 
  registerComponent,
  COMPONENT_TYPES,
  RESOURCE_MODES
} from './index.js';
import { publish, subscribe } from '../core/events.js';
import { auditTrail } from '../security/audit-trail.js';

/**
 * Base Performance Integration class that can be extended by specific module integrations
 */
export class BasePerformanceIntegration {
  /**
   * Create a new performance integration instance
   * @param {string} moduleName - Name of the module (e.g., 'voice', 'vision')
   * @param {Object} componentIds - Map of component IDs for this module
   * @param {Object} options - Additional options
   */
  constructor(moduleName, componentIds, options = {}) {
    this.moduleName = moduleName;
    this.componentIds = componentIds;
    this.options = options;
    this.isRegistered = false;
    this.registrations = {};
    this.currentMode = null;
    
    // Bind methods to ensure proper 'this' context
    this.registerWithResourceManager = this.registerWithResourceManager.bind(this);
    this.unregisterFromResourceManager = this.unregisterFromResourceManager.bind(this);
    this.handleResourceModeChange = this.handleResourceModeChange.bind(this);
  }
  
  /**
   * Register module components with the Resource Allocation Manager
   * @param {Object} registrationOptions - Options to pass during registration
   * @returns {boolean} - Success status
   */
  registerWithResourceManager(registrationOptions = {}) {
    if (this.isRegistered) {
      console.log(`[${this.moduleName}] Already registered with Resource Allocation Manager`);
      return true;
    }
    
    try {
      const resourceManager = getResourceAllocationManager();
      const mergedOptions = { ...this.options, ...registrationOptions };
      
      // Register components using the registerComponentsWithManager method
      // that must be implemented by subclasses
      this.registerComponentsWithManager(resourceManager, mergedOptions);
      
      // Subscribe to resource mode changes
      this.currentMode = resourceManager.getCurrentMode();
      subscribe('resource:mode_changed', (event) => {
        this.currentMode = event.mode;
        this.handleResourceModeChange(event);
      });
      
      this.isRegistered = true;
      
      // Log registration for audit trail
      auditTrail.log({
        action: `${this.moduleName}:resource_management:register`,
        category: 'performance',
        details: {
          timestamp: new Date().toISOString(),
          options: mergedOptions
        }
      });
      
      console.log(`[${this.moduleName}] Registered with Resource Allocation Manager`);
      return true;
    } catch (error) {
      console.error(`[${this.moduleName}] Failed to register with Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  /**
   * Unregister module components from the Resource Allocation Manager
   * @returns {boolean} - Success status
   */
  unregisterFromResourceManager() {
    if (!this.isRegistered) return true;
    
    try {
      // Unregister all components
      Object.values(this.registrations).forEach(registration => {
        if (registration && registration.unregister) {
          registration.unregister();
        }
      });
      
      this.registrations = {};
      this.isRegistered = false;
      
      // Log unregistration for audit trail
      auditTrail.log({
        action: `${this.moduleName}:resource_management:unregister`,
        category: 'performance',
        details: {
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`[${this.moduleName}] Unregistered from Resource Allocation Manager`);
      return true;
    } catch (error) {
      console.error(`[${this.moduleName}] Failed to unregister from Resource Allocation Manager:`, error);
      return false;
    }
  }
  
  /**
   * Handle resource mode changes - to be implemented by subclasses
   * @param {Object} event - Resource mode change event
   */
  handleResourceModeChange(event) {
    const { mode, reason } = event;
    
    // Log mode change for audit trail
    auditTrail.log({
      action: `${this.moduleName}:resource_mode:change`,
      category: 'performance',
      details: {
        timestamp: new Date().toISOString(),
        mode,
        reason
      }
    });
    
    // Subclasses should override this method to implement specific behavior
    console.log(`[${this.moduleName}] Resource mode changed to ${mode}`);
  }
  
  /**
   * Register components with the Resource Allocation Manager
   * This method must be implemented by subclasses
   * @param {Object} resourceManager - Resource Allocation Manager instance
   * @param {Object} options - Registration options
   */
  registerComponentsWithManager(resourceManager, options) {
    throw new Error('registerComponentsWithManager must be implemented by subclass');
  }
  
  /**
   * Helper method to register a component with standard structure
   * @param {string} componentId - Component ID
   * @param {Object} config - Component configuration
   * @returns {Object} - Registration result
   */
  registerStandardComponent(componentId, config) {
    return registerComponent(componentId, {
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
  }
  
  /**
   * Get the current resource mode
   * @returns {string} - Current resource mode
   */
  getCurrentResourceMode() {
    return this.currentMode;
  }
  
  /**
   * Check if the module is registered with the Resource Allocation Manager
   * @returns {boolean} - Registration status
   */
  isRegisteredWithManager() {
    return this.isRegistered;
  }
}

/**
 * Create a factory function for a specific module integration
 * @param {string} moduleName - Name of the module
 * @param {Object} componentIds - Component IDs for the module
 * @param {Function} registerComponentsImplementation - Implementation of registerComponentsWithManager
 * @param {Function} handleModeChangeImplementation - Implementation of handleResourceModeChange
 * @returns {Object} - Module-specific integration object with register/unregister functions
 */
export function createModuleIntegration(
  moduleName, 
  componentIds, 
  registerComponentsImplementation,
  handleModeChangeImplementation
) {
  // Create a singleton instance
  const integration = new class extends BasePerformanceIntegration {
    constructor() {
      super(moduleName, componentIds);
    }
    
    registerComponentsWithManager(resourceManager, options) {
      return registerComponentsImplementation.call(this, resourceManager, options);
    }
    
    handleResourceModeChange(event) {
      // Call base implementation for logging
      super.handleResourceModeChange(event);
      // Call specific implementation
      return handleModeChangeImplementation.call(this, event);
    }
  }();
  
  // Return the public API
  return {
    registerWithResourceManager: integration.registerWithResourceManager,
    unregisterFromResourceManager: integration.unregisterFromResourceManager,
    getCurrentResourceMode: integration.getCurrentResourceMode,
    isRegisteredWithManager: integration.isRegisteredWithManager
  };
}

export default {
  BasePerformanceIntegration,
  createModuleIntegration
};
