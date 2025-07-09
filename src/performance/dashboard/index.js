/**
 * @file index.js
 * @description Entry point for the ALEJO performance dashboard module
 * @module performance/dashboard
 */

import { PerformanceDashboard } from './performance-dashboard.js';
import ResourceThresholds from './resource-thresholds.js';
import { 
  registerWithResourceManager, 
  unregisterFromResourceManager,
  createResourceThresholds
} from './performance-integration.js';

/**
 * Create a performance dashboard
 * @param {Object} options - Dashboard configuration options
 * @returns {PerformanceDashboard} - Dashboard instance
 */
export async function createDashboard(options = {}) {
  // Register with resource manager
  await registerWithResourceManager();
  
  // Create dashboard instance
  return new PerformanceDashboard(options);
}

/**
 * Destroy a performance dashboard
 * @param {PerformanceDashboard} dashboard - Dashboard instance to destroy
 * @returns {Promise<void>}
 */
export async function destroyDashboard(dashboard) {
  if (!dashboard) {
    return;
  }
  
  // Destroy dashboard instance
  dashboard.destroy();
  
  // Unregister from resource manager
  await unregisterFromResourceManager();
}

/**
 * Create a resource thresholds configuration component
 * @param {Object} options - Configuration options
 * @returns {ResourceThresholds} - Resource thresholds component
 */
export function createThresholds(options = {}) {
  return createResourceThresholds(options);
}

/**
 * Initialize the performance dashboard module
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} - Initialization result
 */
export async function initialize(options = {}) {
  // Register with resource manager
  const registrations = await registerWithResourceManager(options);
  
  return {
    success: true,
    registrations,
    message: 'Performance dashboard module initialized successfully'
  };
}

/**
 * Shutdown the performance dashboard module
 * @returns {Promise<Object>} - Shutdown result
 */
export async function shutdown() {
  // Unregister from resource manager
  await unregisterFromResourceManager();
  
  return {
    success: true,
    message: 'Performance dashboard module shut down successfully'
  };
}

// Export the component classes
export { PerformanceDashboard, ResourceThresholds };
export default {
  createDashboard,
  destroyDashboard,
  createThresholds,
  initialize,
  shutdown,
  PerformanceDashboard,
  ResourceThresholds
};
