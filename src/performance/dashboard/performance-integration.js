/**
 * @file performance-integration.js
 * @description Integration module for the performance dashboard with the ResourceAllocationManager
 * @module performance/dashboard/performance-integration
 */

import { getResourceAllocationManager } from '../resource-allocation-manager.js';
import { subscribe, publish } from '../../core/neural-architecture/neural-event-bus.js';
import { PerformanceDashboard } from './performance-dashboard.js';
import ResourceThresholds from './resource-thresholds.js';

// Component IDs for registration with the resource manager
const COMPONENT_IDS = {
  DASHBOARD: 'performance-dashboard',
  THRESHOLDS: 'resource-thresholds'
};

// Track registration status
let isRegistered = false;
let registrations = {};
let currentResourceMode = 'full';
let subscriptions = [];

/**
 * Register the performance dashboard with the resource manager
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Registration result
 */
export async function registerWithResourceManager(options = {}) {
  if (isRegistered) {
    console.warn('Performance dashboard already registered with resource manager');
    return registrations;
  }

  try {
    const resourceManager = getResourceAllocationManager();
    
    // Register the dashboard component
    registrations[COMPONENT_IDS.DASHBOARD] = await resourceManager.registerComponent({
      componentId: COMPONENT_IDS.DASHBOARD,
      name: 'Performance Dashboard',
      description: 'Real-time visualization of system performance metrics',
      resourceRequirements: {
        cpu: 5, // Percentage of CPU usage
        memory: 10, // MB of memory
        priority: 3, // Medium priority (1-5 scale, 5 being highest)
        essential: false // Not essential for system operation
      },
      tags: ['visualization', 'monitoring', 'performance']
    });
    
    // Register the thresholds configuration component
    registrations[COMPONENT_IDS.THRESHOLDS] = await resourceManager.registerComponent({
      componentId: COMPONENT_IDS.THRESHOLDS,
      name: 'Resource Thresholds Configuration',
      description: 'User-configurable resource thresholds for system optimization',
      resourceRequirements: {
        cpu: 2, // Percentage of CPU usage
        memory: 5, // MB of memory
        priority: 4, // Higher priority (1-5 scale, 5 being highest)
        essential: true // Essential for system operation
      },
      tags: ['configuration', 'thresholds', 'performance']
    });

    // Subscribe to resource mode changes
    subscriptions.push(
      subscribe('resource:mode-change', handleResourceModeChange)
    );

    // Subscribe to resource updates
    subscriptions.push(
      subscribe('resource:update', handleResourceUpdate)
    );

    // Subscribe to component updates
    subscriptions.push(
      subscribe('component:update', handleComponentUpdate)
    );
    
    // Subscribe to threshold updates
    subscriptions.push(
      subscribe('resource-thresholds:updated', handleThresholdsUpdate)
    );

    // Get current resource mode
    currentResourceMode = resourceManager.getCurrentResourceMode();

    isRegistered = true;
    console.log('Performance dashboard registered with resource manager');

    return registrations;
  } catch (error) {
    console.error('Failed to register performance dashboard with resource manager:', error);
    throw error;
  }
}

/**
 * Unregister the performance dashboard from the resource manager
 * @returns {Promise<void>}
 */
export async function unregisterFromResourceManager() {
  if (!isRegistered) {
    console.warn('Performance dashboard not registered with resource manager');
    return;
  }

  try {
    const resourceManager = getResourceAllocationManager();
    
    // Unregister components
    for (const [componentId, registration] of Object.entries(registrations)) {
      await resourceManager.unregisterComponent(componentId);
    }

    // Unsubscribe from events
    subscriptions.forEach(subscription => subscription.unsubscribe());
    subscriptions = [];

    isRegistered = false;
    registrations = {};
    console.log('Performance dashboard unregistered from resource manager');
  } catch (error) {
    console.error('Failed to unregister performance dashboard from resource manager:', error);
    throw error;
  }
}

/**
 * Handle resource mode changes
 * @param {Object} data - Event data
 * @param {string} data.oldMode - Previous resource mode
 * @param {string} data.newMode - New resource mode
 */
function handleResourceModeChange({ oldMode, newMode }) {
  console.log(`Resource mode changed from ${oldMode} to ${newMode}`);
  currentResourceMode = newMode;

  // Publish dashboard-specific event for mode change
  publish('dashboard:mode-change', { oldMode, newMode });

  // Adjust dashboard behavior based on resource mode
  switch (newMode) {
    case 'minimal':
      // Reduce update frequency and disable animations
      publish('dashboard:update-config', {
        updateInterval: 5000, // 5 seconds
        enableAnimations: false,
        showDetailedCharts: false
      });
      break;
    case 'conservative':
      // Moderate update frequency and minimal animations
      publish('dashboard:update-config', {
        updateInterval: 3000, // 3 seconds
        enableAnimations: false,
        showDetailedCharts: true
      });
      break;
    case 'balanced':
      // Regular update frequency with animations
      publish('dashboard:update-config', {
        updateInterval: 2000, // 2 seconds
        enableAnimations: true,
        showDetailedCharts: true
      });
      break;
    case 'full':
    default:
      // Frequent updates with full animations
      publish('dashboard:update-config', {
        updateInterval: 1000, // 1 second
        enableAnimations: true,
        showDetailedCharts: true
      });
      break;
  }
}

/**
 * Handle resource updates
 * @param {Object} data - Event data
 * @param {Object} data.resources - Updated resource usage
 */
function handleResourceUpdate({ resources }) {
  // Publish dashboard-specific event for resource update
  publish('dashboard:resource-update', { resources });
}

/**
 * Handle component updates
 * @param {Object} data - Event data
 * @param {string} data.componentId - Component ID
 * @param {Object} data.usage - Component resource usage
 */
function handleComponentUpdate({ componentId, usage }) {
  // Publish dashboard-specific event for component update
  publish('dashboard:component-update', { componentId, usage });
}

/**
 * Handle threshold updates
 * @param {Object} data - Event data
 * @param {Object} data.thresholds - Updated thresholds
 */
function handleThresholdsUpdate({ thresholds }) {
  // Publish dashboard-specific event for threshold update
  publish('dashboard:thresholds-update', { thresholds });
  
  // Recalculate resource mode based on new thresholds
  const resourceManager = getResourceAllocationManager();
  const currentUsage = resourceManager.getCurrentResourceUsage();
  
  // Trigger a resource update to re-evaluate mode with new thresholds
  publish('resource:update', { resources: currentUsage });
}

/**
 * Get the current resource mode
 * @returns {string} - Current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}

/**
 * Get the current resource usage
 * @returns {Object} - Current resource usage
 */
export function getCurrentResourceUsage() {
  if (!isRegistered) {
    console.warn('Performance dashboard not registered with resource manager');
    return null;
  }

  try {
    const resourceManager = getResourceAllocationManager();
    return resourceManager.getCurrentResourceUsage();
  } catch (error) {
    console.error('Failed to get current resource usage:', error);
    return null;
  }
}

/**
 * Get the component registry data formatted for visualization
 * @returns {Array} - Component registry data
 */
export function getComponentRegistryData() {
  if (!isRegistered) {
    console.warn('Performance dashboard not registered with resource manager');
    return [];
  }

  try {
    const resourceManager = getResourceAllocationManager();
    const registry = resourceManager.getComponentRegistry();
    
    // Format registry data for visualization
    return Object.entries(registry).map(([componentId, component]) => ({
      id: componentId,
      name: component.name || componentId,
      cpuUsage: component.usage?.cpu || 0,
      memoryUsage: component.usage?.memory || 0,
      priority: component.resourceRequirements?.priority || 1,
      essential: component.resourceRequirements?.essential || false
    }));
  } catch (error) {
    console.error('Failed to get component registry data:', error);
    return [];
  }
}

/**
 * Create a resource thresholds configuration component
 * @param {Object} options - Configuration options
 * @returns {ResourceThresholds} - Resource thresholds component
 */
export function createResourceThresholds(options = {}) {
  if (!isRegistered) {
    console.warn('Performance dashboard not registered with resource manager');
    return null;
  }
  
  return new ResourceThresholds(options);
}

/**
 * Get adaptations for the current resource mode
 * @private
 * @param {string} mode - Resource mode
 * @returns {Object} - Adaptations for the mode
 */
function getAdaptationsForMode(mode) {
  switch (mode) {
    case 'full':
      return {
        updateInterval: 1000,
        animations: true,
        showAllCharts: true
      };
    case 'balanced':
      return {
        updateInterval: 2000,
        animations: true,
        showAllCharts: true
      };
    case 'conservative':
      return {
        updateInterval: 5000,
        animations: false,
        showAllCharts: false
      };
    case 'minimal':
      return {
        updateInterval: 10000,
        animations: false,
        showAllCharts: false
      };
    default:
      return {
        updateInterval: 2000,
        animations: true,
        showAllCharts: true
      };
  }
}

/**
 * Get the current resource mode
 * @returns {string} - Current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}

/**
 * Check if the performance dashboard is registered with the resource manager
 * @returns {boolean} - Whether the dashboard is registered
 */
export function isRegisteredWithResourceManager() {
  return isRegistered;
}

/**
 * Get resource usage data from the resource manager
 * @returns {Object} - Current resource usage data
 */
export function getResourceUsageData() {
  try {
    const resourceManager = getResourceAllocationManager();
    return resourceManager.getResourceUsage();
  } catch (error) {
    console.error('Failed to get resource usage data:', error);
    return {
      cpu: 0,
      memory: 0,
      temperature: 0,
      batteryLevel: 100,
      isCharging: true
    };
  }
}

/**
 * Get component registry data from the resource manager
 * @returns {Array} - Component registry data formatted for visualization
 */
export function getComponentRegistryData() {
  try {
    const resourceManager = getResourceAllocationManager();
    const registry = resourceManager.componentRegistry;
    
    if (!registry || typeof registry.entries !== 'function') {
      return [];
    }
    
    // Format component data for visualization
    return Array.from(registry.entries()).map(([id, component]) => ({
      label: id,
      value: component.cpuPriority * 10, // Scale priority to percentage
      isEssential: component.isEssential,
      isActive: component.isActive
    }));
  } catch (error) {
    console.error('Failed to get component registry data:', error);
    return [];
  }
}

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  isRegisteredWithResourceManager,
  getResourceUsageData,
  getComponentRegistryData
};
