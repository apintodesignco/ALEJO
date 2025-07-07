/**
 * @file index.js
 * @description Entry point for the performance module
 * @module performance
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  initializeResourceAllocationManager,
  getResourceAllocationManager,
  RESOURCE_MODES,
  RESOURCE_EVENTS
} from './resource-allocation-manager.js';

import {
  registerComponent,
  registerModule,
  withResourceManagement,
  COMPONENT_TYPES
} from './component-registration.js';

import {
  createModuleIntegration
} from './module-integration-helper.js';

/**
 * Initialize the performance module
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {string} [options.initialMode='BALANCED'] - Initial resource mode
 * @param {Object} [options.thresholds] - Custom thresholds for resource monitoring
 * @returns {Object} - Initialized performance module
 */
export async function initializePerformanceModule(options = {}) {
  const debug = options.debug || false;
  
  // Initialize the resource allocation manager
  const resourceManager = await initializeResourceAllocationManager({
    debug,
    initialMode: options.initialMode || RESOURCE_MODES.BALANCED,
    thresholds: options.thresholds || {},
    ...options
  });
  
  if (debug) {
    console.log('[Performance] Resource Allocation Manager initialized');
    console.log(`[Performance] Initial mode: ${resourceManager.getCurrentMode()}`);
  }
  
  // Return the public API
  return {
    getResourceAllocationManager,
    registerComponent,
    registerModule,
    withResourceManagement,
    createModuleIntegration,
    COMPONENT_TYPES,
    RESOURCE_MODES,
    RESOURCE_EVENTS
  };
}

export {
  getResourceAllocationManager,
  registerComponent,
  registerModule,
  withResourceManagement,
  COMPONENT_TYPES,
  RESOURCE_MODES,
  RESOURCE_EVENTS
};

export default {
  initialize: initializePerformanceModule,
  getResourceAllocationManager,
  registerComponent,
  registerModule,
  withResourceManagement,
  COMPONENT_TYPES,
  RESOURCE_MODES,
  RESOURCE_EVENTS
};
