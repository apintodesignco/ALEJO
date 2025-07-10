/**
 * ALEJO Component Recovery Manager
 * 
 * This module provides a robust recovery system for failed components
 * with support for multiple recovery strategies, persistent tracking,
 * and automatic recovery attempts.
 * 
 * Features:
 * - Registration of failed components with metadata
 * - Persistent storage of failures across sessions
 * - Multiple recovery strategies per component with priority ordering
 * - Automated recovery attempts with delay and retry limits
 * - Recovery result handling and event publication
 * - Resource-aware recovery operations
 * 
 * This module provides recovery mechanisms for failed components,
 * including persistent recovery attempts, alternative implementations,
 * graceful degradation, and user notifications.
 */

import { logError, ErrorSeverity, getComponentStatus } from './error-handler.js';
import { logInitEvent } from './initialization-log-viewer.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';
import {
  registerWithResourceManager,
  unregisterFromResourceManager,
  isAutoRecoveryEnabled,
  getMaxParallelRecoveries,
  getPriorityThreshold,
  getRetryDelay,
  getRecoveryInterval
} from './recovery-performance-integration.js';
import { ResourcePriority } from '../performance/resource-manager.js';

// Store failed components and their recovery attempts
const failedComponentRegistry = new Map();
const recoveryStrategies = new Map();
const persistentFailureStorage = 'alejo_failed_components';

// Recovery states
export const RecoveryState = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  TERMINAL_FAILURE: 'TERMINAL_FAILURE'
};

// System state tracking
let isInitialized = false;
let recoveryTimer = null;
let recoveryInProgress = false;

/**
 * Initialize the recovery manager
 * 
 * @param {Object} options - Initialization options
 * @returns {Object} - Recovery manager controls
 */
export function initializeRecoveryManager(options = {}) {
  if (isInitialized) return;
  
  // Register with resource manager
  registerWithResourceManager({ includeUI: options.includeUI });
  
  // Check for persistent failures from previous sessions
  checkForPersistentFailures();
  
  // Start automatic recovery if enabled
  if (isAutoRecoveryEnabled()) {
    startRecoveryTimer();
  }
  
  isInitialized = true;
  
  return {
    getFailedComponents,
    attemptComponentRecovery,
    recoverAllFailedComponents,
    clearPersistentFailures
  };
}

/**
 * Shutdown the recovery manager
 */
export function shutdownRecoveryManager() {
  if (!isInitialized) return;
  
  // Stop automatic recovery timer
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
  
  // Unregister from resource manager
  unregisterFromResourceManager();
  
  isInitialized = false;
}

/**
 * Register a component failure for recovery
 * 
 * @param {string} componentId - Component identifier
 * @param {Error} error - Initialization error
 * @param {Object} options - Recovery options
 */
export function registerFailedComponent(componentId, error, options = {}) {
  const {
    isEssential = false,
    accessibility = false,
    maxRecoveryAttempts = 3,
    recoveryDelay = 3000,
    persistAcrossSessions = isEssential || accessibility,
    resourcePriority = getComponentResourcePriority(isEssential, accessibility)
  } = options;
  
  const now = Date.now();
  
  // Store failed component info
  failedComponentRegistry.set(componentId, {
    componentId,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    isEssential,
    accessibility,
    failureTime: now,
    recoveryAttempts: 0,
    maxRecoveryAttempts,
    lastRecoveryAttempt: null,
    recoveryDelay: getRetryDelay() || recoveryDelay, // Use resource-based delay if available
    recoveryState: RecoveryState.PENDING,
    persistAcrossSessions,
    resourcePriority
  });
  
  logInitEvent('component-failure-registered', componentId, {
    error: error.message,
    isEssential,
    accessibility,
    maxRecoveryAttempts
  });
  
  // If component should persist failure info across sessions, save to localStorage
  if (persistAcrossSessions) {
    savePersistentFailures();
  }
  
  // Publish failure event
  publishEvent('system:component:failure', {
    componentId,
    error: error.message,
    isEssential,
    accessibility,
    recoverable: maxRecoveryAttempts > 0,
    component: {
      id: componentId,
      isEssential,
      accessibility,
      resourcePriority
    }
  });
  
  // Start recovery timer if not already running
  if (isAutoRecoveryEnabled() && !recoveryTimer) {
    startRecoveryTimer();
  }
}

/**
 * Register a recovery strategy for a component
 * 
 * @param {string} componentId - Component identifier
 * @param {Function} recoveryFn - Recovery function that returns a Promise
 * @param {Object} options - Strategy options
 */
export function registerRecoveryStrategy(componentId, recoveryFn, options = {}) {
  const {
    priority = 0,
    description = 'Default recovery strategy',
    requiresUserApproval = false
  } = options;
  
  if (!recoveryStrategies.has(componentId)) {
    recoveryStrategies.set(componentId, []);
  }
  
  recoveryStrategies.get(componentId).push({
    recoveryFn,
    priority,
    description,
    requiresUserApproval,
    registrationTime: Date.now()
  });
  
  // Sort strategies by priority (higher first)
  recoveryStrategies.get(componentId).sort((a, b) => b.priority - a.priority);
  
  logInitEvent('recovery-strategy-registered', componentId, {
    description,
    priority,
    requiresUserApproval,
    strategyCount: recoveryStrategies.get(componentId).length
  });
}

/**
 * Get all failed components
 * 
 * @param {Object} options - Filter options
 * @param {boolean} options.essentialOnly - Only return essential components
 * @param {boolean} options.accessibilityOnly - Only return accessibility components
 * @returns {Array} - Array of failed component objects
 */
export function getFailedComponents(options = {}) {
  const { essentialOnly = false, accessibilityOnly = false } = options;
  
  return Array.from(failedComponentRegistry.values()).filter(component => {
    if (essentialOnly && !component.isEssential) return false;
    if (accessibilityOnly && !component.accessibility) return false;
    return true;
  });
}

/**
 * Attempt recovery for a specific component
 * 
 * @param {string} componentId - Component identifier
 * @param {Object} options - Recovery options
 * @returns {Promise<Object>} - Recovery result
 */
export async function attemptComponentRecovery(componentId, options = {}) {
  const {
    force = false,
    userApproved = false,
    notifyUser = true
  } = options;
  
  // Check if component is registered as failed
  if (!failedComponentRegistry.has(componentId)) {
    console.warn(`Cannot recover component ${componentId}: Not registered as failed`);
    return { success: false, reason: 'not-failed' };
  }
  
  const componentInfo = failedComponentRegistry.get(componentId);
  
  // Check if max recovery attempts exceeded
  if (!force && componentInfo.recoveryAttempts >= componentInfo.maxRecoveryAttempts) {
    console.warn(`Max recovery attempts reached for component ${componentId}`);
    return { success: false, reason: 'max-attempts' };
  }
  
  // Check if we need to wait for recovery delay
  const now = Date.now();
  if (!force && 
      componentInfo.lastRecoveryAttempt && 
      now - componentInfo.lastRecoveryAttempt < componentInfo.recoveryDelay) {
    console.warn(`Recovery delay not elapsed for ${componentId}`);
    return { success: false, reason: 'delay-not-elapsed' };
  }
  
  // Update component recovery state
  componentInfo.recoveryState = RecoveryState.IN_PROGRESS;
  componentInfo.lastRecoveryAttempt = now;
  componentInfo.recoveryAttempts++;
  
  // Notify about recovery attempt
  if (notifyUser) {
    publishEvent('system:component:recovery:attempt', {
      componentId,
      attemptNumber: componentInfo.recoveryAttempts,
      maxAttempts: componentInfo.maxRecoveryAttempts,
      isEssential: componentInfo.isEssential,
      accessibility: componentInfo.accessibility
    });
  }
  
  logInitEvent('recovery-attempt', componentId, {
    attemptNumber: componentInfo.recoveryAttempts,
    maxAttempts: componentInfo.maxRecoveryAttempts,
    timeSinceFailure: now - componentInfo.failureTime
  });
  
  // Get recovery strategies
  const strategies = recoveryStrategies.get(componentId) || [];
  
  if (strategies.length === 0) {
    // Try default recovery if no strategies registered
    try {
      const result = await defaultRecoveryAttempt(componentId);
      handleRecoveryResult(componentId, result);
      return result;
    } catch (error) {
      logError('component-recovery', error, ErrorSeverity.MEDIUM, { 
        componentId, 
        recovery: 'default' 
      });
      
      handleRecoveryResult(componentId, { success: false, error });
      return { success: false, error };
    }
  }
  
  // Try each strategy in order (highest priority first)
  for (const strategy of strategies) {
    // Skip strategies requiring user approval if not provided
    if (strategy.requiresUserApproval && !userApproved) {
      continue;
    }
    
    try {
      console.log(`Attempting recovery strategy for ${componentId}: ${strategy.description}`);
      const result = await strategy.recoveryFn(componentId, componentInfo);
      
      if (result.success) {
        // Recovery succeeded
        handleRecoveryResult(componentId, result, true);
        return { ...result, strategy: strategy.description };
      }
    } catch (error) {
      logError('component-recovery', error, ErrorSeverity.MEDIUM, { 
        componentId, 
        strategy: strategy.description 
      });
    }
  }
  
  // All strategies failed
  handleRecoveryResult(componentId, { success: false, reason: 'all-strategies-failed' });
  return { success: false, reason: 'all-strategies-failed' };
}

/**
 * Handle the result of a recovery attempt
 * 
 * @param {string} componentId - Component identifier
 * @param {Object} result - Recovery result
 * @param {boolean} succeeded - Whether recovery succeeded
 */
function handleRecoveryResult(componentId, result, succeeded = false) {
  if (!failedComponentRegistry.has(componentId)) return;
  
  const componentInfo = failedComponentRegistry.get(componentId);
  
  if (succeeded) {
    // Recovery succeeded
    updateComponentRecoveryState(componentId, RecoveryState.SUCCESS, result);
    
    // If component had persistent storage, update it
    if (componentInfo.persistAcrossSessions) {
      savePersistentFailures();
    }
    
    logInitEvent('recovery-succeeded', componentId, {
      attemptNumber: componentInfo.recoveryAttempts,
      timeSinceFailure: Date.now() - componentInfo.failureTime
    });
    
    // Publish recovery success event
    publishEvent('system:component:recovery:success', {
      componentId,
      attemptNumber: componentInfo.recoveryAttempts,
      timeSinceFailure: Date.now() - componentInfo.failureTime
    });
    
    // Remove from failed components if successful
    failedComponentRegistry.delete(componentId);
  } else {
    // Recovery failed
    updateComponentRecoveryState(componentId, RecoveryState.FAILURE, result);
    
    // If max attempts reached, mark as permanently failed
    const isTerminalFailure = componentInfo.recoveryAttempts >= componentInfo.maxRecoveryAttempts;
    
    if (isTerminalFailure) {
      logInitEvent('recovery-terminal-failure', componentId, {
        attemptsExhausted: true,
        timeSinceFailure: Date.now() - componentInfo.failureTime
      });
      
      // Publish terminal failure event
      publishEvent('system:component:recovery:terminal', {
        componentId,
        isEssential: componentInfo.isEssential,
        accessibility: componentInfo.accessibility
      });
    } else {
      logInitEvent('recovery-attempt-failed', componentId, {
        attemptNumber: componentInfo.recoveryAttempts,
        maxAttempts: componentInfo.maxRecoveryAttempts,
        nextAttemptDelay: componentInfo.recoveryDelay
      });
    }
  }
}

/**
 * Default recovery attempt for a component
 * 
 * @param {string} componentId - Component identifier
 * @returns {Promise<Object>} - Recovery result
 */
async function defaultRecoveryAttempt(componentId) {
  try {
    // Get component registration from initialization manager
    const initManager = await import('./initialization-manager.js');
    const componentRegistry = initManager.getComponentRegistry();
    const component = componentRegistry.get(componentId);
    
    if (!component) {
      return { success: false, reason: 'component-not-found' };
    }
    
    // Attempt to initialize the component again
    console.log(`Attempting default recovery for component ${componentId}`);
    const result = await initManager.initializeComponent(componentId, { force: true });
    
    return { 
      success: !!result && !result.error,
      result
    };
  } catch (error) {
    return { 
      success: false, 
      error,
      reason: 'initialization-error' 
    };
  }
}

/**
 * Check for persistent component failures on startup
 * 
 * @returns {Array} - Array of recovered persistent failures
 */
export function checkForPersistentFailures() {
  try {
    const failuresJson = localStorage.getItem(persistentFailureStorage);
    if (!failuresJson) return [];
    
    const persistentFailures = JSON.parse(failuresJson);
    const recovered = [];
    
    // Register each persistent failure
    persistentFailures.forEach(failure => {
      // Skip if already registered
      if (failedComponentRegistry.has(failure.componentId)) return;
      
      // Reconstruct error
      const error = new Error(failure.error.message);
      error.stack = failure.error.stack;
      error.code = failure.error.code;
      
      // Register the failure
      registerFailedComponent(failure.componentId, error, {
        isEssential: failure.isEssential,
        accessibility: failure.accessibility,
        maxRecoveryAttempts: failure.maxRecoveryAttempts,
        recoveryDelay: failure.recoveryDelay,
        persistAcrossSessions: true
      });
      
      recovered.push(failure.componentId);
    });
    
    if (recovered.length > 0) {
      logInitEvent('persistent-failures-recovered', 'system', { 
        count: recovered.length,
        components: recovered
      });
      
      // Publish event about recovered persistent failures
      publishEvent('system:persistent-failures:recovered', {
        count: recovered.length,
        components: recovered
      });
    }
    
    return recovered;
  } catch (error) {
    console.error('Error checking for persistent failures:', error);
    return [];
  }
}

/**
 * Save persistent failures to localStorage
 */
function savePersistentFailures() {
  try {
    // Filter only persistent failures
    const persistentFailures = Array.from(failedComponentRegistry.values())
      .filter(failure => failure.persistAcrossSessions);
    
    // Save to localStorage
    localStorage.setItem(persistentFailureStorage, JSON.stringify(persistentFailures));
  } catch (error) {
    console.error('Error saving persistent failures:', error);
  }
}

/**
 * Clear all persistent failures
 */
export function clearPersistentFailures() {
  try {
    localStorage.removeItem(persistentFailureStorage);
    
    // Filter out persistent failures from registry
    const persistentIds = [];
    failedComponentRegistry.forEach((value, key) => {
      if (value.persistAcrossSessions) {
        persistentIds.push(key);
      }
    });
    
    // Remove from registry
    persistentIds.forEach(id => {
      failedComponentRegistry.delete(id);
    });
    
    logInitEvent('persistent-failures-cleared', 'system', { count: persistentIds.length });
    
    return persistentIds.length;
  } catch (error) {
    console.error('Error clearing persistent failures:', error);
    return 0;
  }
}

/**
 * Attempt recovery for all failed components
 * 
 * @param {Object} options - Recovery options
 * @returns {Promise<Object>} - Recovery results
 */
export async function recoverAllFailedComponents(options = {}) {
  const {
    essentialOnly = false,
    accessibilityOnly = false,
    force = false,
    userApproved = false,
    notifyUser = true
  } = options;
  
  // Get failed components that match criteria
  const failedComponents = getFailedComponents({
    essentialOnly,
    accessibilityOnly
  });
  
  if (failedComponents.length === 0) {
    return { 
      success: true, 
      recovered: 0,
      failed: 0,
      components: [] 
    };
  }
  
  console.log(`Attempting recovery for ${failedComponents.length} components`);
  
  // Attempt recovery for each component
  const results = {
    success: false,
    recovered: 0,
    failed: 0,
    components: []
  };
  
  for (const component of failedComponents) {
    const result = await attemptComponentRecovery(component.componentId, {
      force,
      userApproved,
      notifyUser: notifyUser && results.components.length === 0 // Only notify for first component
    });
    
    results.components.push({
      componentId: component.componentId,
      success: result.success,
      reason: result.reason
    });
    
    if (result.success) {
      results.recovered++;
    } else {
      results.failed++;
    }
  }
  
  results.success = results.recovered > 0 && results.failed === 0;
  
  logInitEvent('mass-recovery-complete', 'system', {
    recovered: results.recovered,
    failed: results.failed,
    total: failedComponents.length
  });
  
  // Publish event about mass recovery attempt
  publishEvent('system:recovery:mass-attempt', {
    recovered: results.recovered,
    failed: results.failed,
    total: failedComponents.length
  });
  
  return results;
}

/**
 * Get resource priority for a component based on its properties
 *
 * @param {boolean} isEssential - Whether the component is essential
 * @param {boolean} accessibility - Whether the component is accessibility-related
 * @returns {number} - Resource priority value
 */
function getComponentResourcePriority(isEssential, accessibility) {
  if (accessibility) {
    return ResourcePriority.CRITICAL; // Highest priority for accessibility components
  } else if (isEssential) {
    return ResourcePriority.HIGH; // High priority for essential components
  } else {
    return ResourcePriority.MEDIUM; // Medium priority for standard components
  }
}

/**
 * Start the automatic recovery timer
 */
function startRecoveryTimer() {
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
  }
  
  // Only schedule timer if auto-recovery is enabled in current resource mode
  if (!isAutoRecoveryEnabled()) {
    return;
  }
  
  const interval = getRecoveryInterval();
  
  recoveryTimer = setTimeout(async () => {
    try {
      // Don't start new recovery if one is already in progress
      if (recoveryInProgress) {
        startRecoveryTimer(); // Reschedule for later
        return;
      }
      
      recoveryInProgress = true;
      
      // Get failed components that meet the resource priority threshold
      const components = getRecoverableComponentsByPriority();
      
      if (components.length === 0) {
        recoveryInProgress = false;
        startRecoveryTimer(); // Reschedule for next interval
        return;
      }
      
      // Limit parallel recovery attempts based on resource mode
      const maxParallel = getMaxParallelRecoveries();
      const componentsToRecover = components.slice(0, maxParallel);
      
      // Attempt recovery
      await Promise.allSettled(componentsToRecover.map(componentId => {
        return attemptComponentRecovery(componentId);
      }));
      
    } catch (error) {
      console.error('Error during automatic recovery:', error);
    } finally {
      recoveryInProgress = false;
      startRecoveryTimer(); // Schedule next recovery attempt
    }
  }, interval);
  
  console.log(`Scheduled automatic recovery in ${interval}ms`);
}

/**
 * Get failed components that meet the current resource priority threshold
 * 
 * @returns {Array<string>} - Array of component IDs that can be recovered
 */
function getRecoverableComponentsByPriority() {
  const priorityThreshold = getPriorityThreshold();
  const result = [];
  
  for (const [componentId, component] of failedComponentRegistry.entries()) {
    // Skip components that are already at max attempts
    if (component.recoveryAttempts >= component.maxRecoveryAttempts) {
      continue;
    }
    
    // Skip components that are in recovery
    if (component.recoveryState === RecoveryState.IN_PROGRESS) {
      continue;
    }
    
    // Skip components that don't meet priority threshold
    if (component.resourcePriority < priorityThreshold) {
      continue;
    }
    
    result.push(componentId);
  }
  
  // Sort by priority (highest first)
  return result.sort((a, b) => {
    const componentA = failedComponentRegistry.get(a);
    const componentB = failedComponentRegistry.get(b);
    
    // Prioritize accessibility components
    if (componentA.accessibility && !componentB.accessibility) return -1;
    if (!componentA.accessibility && componentB.accessibility) return 1;
    
    // Then essential components
    if (componentA.isEssential && !componentB.isEssential) return -1;
    if (!componentA.isEssential && componentB.isEssential) return 1;
    
    // Then by explicit resource priority
    return componentB.resourcePriority - componentA.resourcePriority;
  });
}

/**
 * Update a component's recovery state and publish state change event
 * 
 * @param {string} componentId - Component ID
 * @param {string} state - New recovery state
 * @param {Object} result - Recovery result (optional)
 */
function updateComponentRecoveryState(componentId, state, result = null) {
  const component = failedComponentRegistry.get(componentId);
  if (!component) return;
  
  // Update component state
  component.recoveryState = state;
  
  // Publish state change event
  publishEvent('system:recovery:state-change', {
    componentId,
    state,
    result,
    attempts: component.recoveryAttempts,
    maxAttempts: component.maxRecoveryAttempts,
    isEssential: component.isEssential,
    accessibility: component.accessibility
  });
  
  // Log event
  logInitEvent(`recovery-state-${state.toLowerCase()}`, componentId, {
    state,
    attempts: component.recoveryAttempts,
    result: result ? JSON.stringify(result) : null
  });
}
