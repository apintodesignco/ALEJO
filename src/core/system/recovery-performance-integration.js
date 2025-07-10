/**
 * ALEJO Recovery System - Resource Manager Integration
 * 
 * This module integrates the component recovery system with the 
 * resource allocation manager to ensure recovery operations respect
 * system resource constraints.
 * 
 * Features:
 * - Registers the recovery system with resource manager
 * - Adapts recovery behavior based on resource mode
 * - Prioritizes essential and accessibility components for recovery
 * - Controls recovery frequency and parallelism based on available resources
 */

import { 
  registerComponent, 
  unregisterComponent,
  ResourceConsumptionMode,
  ResourcePriority
} from '../performance/resource-manager.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Component IDs
export const RECOVERY_SYSTEM_ID = 'alejo:core:recovery-system';
export const RECOVERY_UI_ID = 'alejo:core:recovery-ui';

// Registration status
let isRegistered = false;
const registrations = new Map();

// Current resource mode
let currentResourceMode = ResourceConsumptionMode.NORMAL;

// Recovery configuration by resource mode
const recoveryConfig = {
  [ResourceConsumptionMode.MINIMAL]: {
    autoRecoveryEnabled: false,
    recoveryInterval: 30000, // 30 seconds
    maxParallelRecoveries: 1,
    retryDelay: 5000,       // 5 seconds
    priorityThreshold: ResourcePriority.HIGH // Only recover high priority and above
  },
  [ResourceConsumptionMode.CONSERVATIVE]: {
    autoRecoveryEnabled: true,
    recoveryInterval: 15000, // 15 seconds
    maxParallelRecoveries: 1,
    retryDelay: 3000,       // 3 seconds
    priorityThreshold: ResourcePriority.MEDIUM // Only recover medium priority and above
  },
  [ResourceConsumptionMode.NORMAL]: {
    autoRecoveryEnabled: true,
    recoveryInterval: 5000, // 5 seconds
    maxParallelRecoveries: 2,
    retryDelay: 2000,      // 2 seconds
    priorityThreshold: ResourcePriority.LOW // Recover all priorities
  },
  [ResourceConsumptionMode.PERFORMANCE]: {
    autoRecoveryEnabled: true,
    recoveryInterval: 3000, // 3 seconds
    maxParallelRecoveries: 4,
    retryDelay: 1000,      // 1 second
    priorityThreshold: ResourcePriority.LOW // Recover all priorities
  }
};

/**
 * Register the recovery system with the resource manager
 * 
 * @param {Object} options - Registration options
 */
export function registerWithResourceManager(options = {}) {
  if (isRegistered) return;
  
  // Register main recovery system
  const recoverySystemId = registrations.get(RECOVERY_SYSTEM_ID) || 
    registerComponent({
      id: RECOVERY_SYSTEM_ID,
      name: 'Component Recovery System',
      description: 'Manages recovery for failed system components',
      onModeChanged: (newMode) => handleResourceModeChanged(RECOVERY_SYSTEM_ID, newMode),
      priority: ResourcePriority.HIGH,
      category: 'system',
      tags: ['core', 'recovery', 'reliability']
    });
  
  registrations.set(RECOVERY_SYSTEM_ID, recoverySystemId);
  
  // Register recovery UI if needed
  if (options.includeUI) {
    const recoveryUiId = registrations.get(RECOVERY_UI_ID) ||
      registerComponent({
        id: RECOVERY_UI_ID,
        name: 'Recovery Status UI',
        description: 'User interface for component recovery status and controls',
        onModeChanged: (newMode) => handleResourceModeChanged(RECOVERY_UI_ID, newMode),
        priority: ResourcePriority.MEDIUM,
        category: 'ui',
        tags: ['recovery', 'ui', 'status']
      });
    
    registrations.set(RECOVERY_UI_ID, recoveryUiId);
  }
  
  isRegistered = true;
  
  // Apply current configuration based on initial resource mode
  applyResourceModeConfiguration(currentResourceMode);
  
  return {
    recoverySystemId: registrations.get(RECOVERY_SYSTEM_ID),
    recoveryUiId: registrations.get(RECOVERY_UI_ID)
  };
}

/**
 * Unregister the recovery system from the resource manager
 */
export function unregisterFromResourceManager() {
  if (!isRegistered) return;
  
  // Unregister all components
  for (const [id, registrationId] of registrations.entries()) {
    unregisterComponent(registrationId);
  }
  
  registrations.clear();
  isRegistered = false;
}

/**
 * Handle resource mode changes for recovery components
 * 
 * @param {string} componentId - Component ID that changed mode
 * @param {string} newMode - New resource mode
 */
function handleResourceModeChanged(componentId, newMode) {
  currentResourceMode = newMode;
  
  // Apply configuration based on the new resource mode
  applyResourceModeConfiguration(newMode);
  
  // Log the mode change
  console.log(`Recovery system adapting to resource mode: ${newMode}`);
  
  // Publish event for the mode change
  publishEvent('recovery:resource-mode-changed', {
    componentId,
    mode: newMode,
    config: getCurrentConfig()
  });
}

/**
 * Apply resource mode-specific configuration
 * 
 * @param {string} mode - Resource consumption mode
 */
function applyResourceModeConfiguration(mode) {
  const config = recoveryConfig[mode] || recoveryConfig[ResourceConsumptionMode.NORMAL];
  
  // Publish configuration update event
  publishEvent('recovery:config-updated', {
    mode,
    config
  });
}

/**
 * Get the current recovery configuration based on resource mode
 * 
 * @returns {Object} Current configuration
 */
export function getCurrentConfig() {
  return recoveryConfig[currentResourceMode] || recoveryConfig[ResourceConsumptionMode.NORMAL];
}

/**
 * Get the current resource mode
 * 
 * @returns {string} Current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}

/**
 * Check if automatic recovery is enabled in the current resource mode
 * 
 * @returns {boolean} True if auto recovery is enabled
 */
export function isAutoRecoveryEnabled() {
  return getCurrentConfig().autoRecoveryEnabled;
}

/**
 * Get the maximum number of parallel recovery attempts allowed
 * 
 * @returns {number} Maximum parallel recovery attempts
 */
export function getMaxParallelRecoveries() {
  return getCurrentConfig().maxParallelRecoveries;
}

/**
 * Get the minimum priority threshold for recovery in the current mode
 * 
 * @returns {number} Priority threshold
 */
export function getPriorityThreshold() {
  return getCurrentConfig().priorityThreshold;
}

/**
 * Get the retry delay for the current resource mode
 * 
 * @returns {number} Retry delay in milliseconds
 */
export function getRetryDelay() {
  return getCurrentConfig().retryDelay;
}

/**
 * Get the recovery interval for the current resource mode
 * 
 * @returns {number} Recovery interval in milliseconds
 */
export function getRecoveryInterval() {
  return getCurrentConfig().recoveryInterval;
}
