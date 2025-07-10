/**
 * @file resource-dashboard-performance-integration.js
 * @description Performance integration for the resource dashboard with the Resource Allocation Manager
 * @module core/system/resource-dashboard-performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  registerComponent, 
  unregisterComponent,
  RESOURCE_MODE,
  COMPONENT_PRIORITY,
  subscribeToResourceModeChanges,
  unsubscribeFromResourceModeChanges
} from '../../performance/resource-allocation-manager.js';

import { Logger } from '../logger.js';

// Initialize logger
const logger = new Logger('ResourceDashboardPerformance');

// Component IDs for the resource dashboard
export const COMPONENT = {
  RESOURCE_DASHBOARD: 'system.resourceDashboard',
  RESOURCE_MONITOR: 'system.resourceMonitor',
  THRESHOLD_CONFIG: 'system.thresholdConfig'
};

// Registration status
let isRegistered = false;
let registrations = new Map();

// Current resource mode
let currentResourceMode = RESOURCE_MODE.NORMAL;

// Update interval times (in ms) for different resource modes
const UPDATE_INTERVALS = {
  [RESOURCE_MODE.NORMAL]: 2000,     // Update every 2 seconds in normal mode
  [RESOURCE_MODE.HIGH]: 5000,       // Update every 5 seconds in high usage mode
  [RESOURCE_MODE.SAVING]: 10000,    // Update every 10 seconds in resource saving mode
  [RESOURCE_MODE.MINIMAL]: 30000    // Update every 30 seconds in minimal mode
};

/**
 * Register the resource dashboard components with the resource allocation manager
 * @returns {Promise<boolean>} Whether registration was successful
 */
export async function registerWithResourceManager() {
  try {
    if (isRegistered) {
      logger.warn('Resource dashboard already registered with resource manager');
      return true;
    }

    logger.info('Registering resource dashboard with resource manager');

    // Register the main dashboard (medium priority)
    const dashboardReg = await registerComponent(COMPONENT.RESOURCE_DASHBOARD, {
      name: 'Resource Dashboard',
      description: 'System-wide resource monitoring dashboard',
      priority: COMPONENT_PRIORITY.MEDIUM,
      category: 'system',
      requiredResources: {
        cpu: { min: 0.5, target: 1 }, // Percentage points (relatively low CPU needs)
        memory: { min: 5, target: 10 } // MB (modest memory requirements)
      }
    });
    
    registrations.set(COMPONENT.RESOURCE_DASHBOARD, dashboardReg);

    // Register the resource monitor (medium-high priority as it provides critical system info)
    const monitorReg = await registerComponent(COMPONENT.RESOURCE_MONITOR, {
      name: 'Resource Monitor',
      description: 'Core resource monitoring functionality',
      priority: COMPONENT_PRIORITY.MEDIUM_HIGH, // Higher priority as it's important for system stability
      category: 'system',
      requiredResources: {
        cpu: { min: 0.2, target: 0.5 },
        memory: { min: 2, target: 5 }
      }
    });
    
    registrations.set(COMPONENT.RESOURCE_MONITOR, monitorReg);

    // Register threshold configuration (lower priority as it's a configuration UI)
    const thresholdReg = await registerComponent(COMPONENT.THRESHOLD_CONFIG, {
      name: 'Resource Threshold Configuration',
      description: 'UI for configuring resource usage thresholds',
      priority: COMPONENT_PRIORITY.MEDIUM_LOW,
      category: 'system',
      requiredResources: {
        cpu: { min: 0.1, target: 0.3 },
        memory: { min: 1, target: 3 }
      }
    });
    
    registrations.set(COMPONENT.THRESHOLD_CONFIG, thresholdReg);

    // Subscribe to resource mode changes
    subscribeToResourceModeChanges(handleResourceModeChange);

    isRegistered = true;
    logger.info('Resource dashboard registered successfully with resource manager');
    
    return true;
  } catch (error) {
    logger.error('Failed to register resource dashboard with resource manager', error);
    return false;
  }
}

/**
 * Unregister the resource dashboard from the resource allocation manager
 * @returns {Promise<boolean>} Whether unregistration was successful
 */
export async function unregisterFromResourceManager() {
  try {
    if (!isRegistered) {
      return true;
    }

    logger.info('Unregistering resource dashboard from resource manager');

    // Unsubscribe from resource mode changes
    unsubscribeFromResourceModeChanges(handleResourceModeChange);

    // Unregister all components
    for (const [componentId, registration] of registrations.entries()) {
      await unregisterComponent(componentId, registration);
      logger.debug(`Unregistered component: ${componentId}`);
    }

    registrations.clear();
    isRegistered = false;
    
    logger.info('Resource dashboard unregistered from resource manager');
    return true;
  } catch (error) {
    logger.error('Failed to unregister resource dashboard from resource manager', error);
    return false;
  }
}

/**
 * Handle resource mode changes by adapting dashboard behavior
 * @param {RESOURCE_MODE} newMode - The new resource mode
 */
export function handleResourceModeChange(newMode) {
  try {
    logger.info(`Resource mode changed to: ${newMode}`);
    currentResourceMode = newMode;

    // Get the appropriate update interval for this mode
    const updateInterval = UPDATE_INTERVALS[newMode] || UPDATE_INTERVALS[RESOURCE_MODE.NORMAL];
    
    // Update the dashboard's update frequency
    updateDashboardFrequency(updateInterval);
    
    // Adapt UI based on resource mode
    adaptDashboardUI(newMode);
  } catch (error) {
    logger.error('Error handling resource mode change', error);
  }
}

/**
 * Update the dashboard's update frequency
 * @param {number} interval - The new update interval in milliseconds
 */
export function updateDashboardFrequency(interval) {
  // This function will be implemented by the resource dashboard
  if (typeof window !== 'undefined' && window.ALEJO && window.ALEJO.resourceDashboard) {
    if (typeof window.ALEJO.resourceDashboard.setUpdateInterval === 'function') {
      window.ALEJO.resourceDashboard.setUpdateInterval(interval);
      logger.debug(`Set resource dashboard update interval to ${interval}ms`);
    }
  }
}

/**
 * Adapt the dashboard UI based on the current resource mode
 * @param {RESOURCE_MODE} mode - The current resource mode
 */
export function adaptDashboardUI(mode) {
  // This function will be implemented by the resource dashboard
  if (typeof window !== 'undefined' && window.ALEJO && window.ALEJO.resourceDashboard) {
    if (typeof window.ALEJO.resourceDashboard.adaptToResourceMode === 'function') {
      window.ALEJO.resourceDashboard.adaptToResourceMode(mode);
      logger.debug(`Adapted resource dashboard UI to resource mode: ${mode}`);
    }
  }
}

/**
 * Get the current resource mode
 * @returns {RESOURCE_MODE} The current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}

/**
 * Get the update interval for the current resource mode
 * @returns {number} The update interval in milliseconds
 */
export function getCurrentUpdateInterval() {
  return UPDATE_INTERVALS[currentResourceMode] || UPDATE_INTERVALS[RESOURCE_MODE.NORMAL];
}

// Export public API
export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  getCurrentUpdateInterval,
  COMPONENT
};
