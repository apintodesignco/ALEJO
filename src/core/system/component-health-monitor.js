/**
 * @file component-health-monitor.js
 * @description System-wide component health monitoring for ALEJO
 * @module core/system/component-health-monitor
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../event-bus.js';
import { Logger } from '../logger.js';
import { getAuditTrail } from '../../security/audit-trail.js';

// Initialize logger
const logger = new Logger('ComponentHealthMonitor');

// Health monitor state
const _healthStatus = {
  components: {},
  lastSystemCheck: null,
  overallStatus: 'unknown'
};

// Registered component checkers
const _componentCheckers = new Map();

// Configuration
const _config = {
  autoCheckInterval: 5 * 60 * 1000, // 5 minutes
  checkTimeout: 10000, // 10 seconds
  criticalComponents: []
};

// Internal state
let _initialized = false;
let _checkInProgress = false;
let _autoCheckTimer = null;
let _eventBus = null;
let _auditTrail = null;

/**
 * Initialize the component health monitor
 * @param {Object} options - Initialization options
 * @param {number} [options.autoCheckInterval] - Auto check interval in ms
 * @param {number} [options.checkTimeout] - Health check timeout in ms
 * @param {string[]} [options.criticalComponents] - List of component IDs considered critical
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize(options = {}) {
  if (_initialized) {
    logger.warn('Component health monitor already initialized');
    return true;
  }

  try {
    // Set up configuration
    if (options.autoCheckInterval) _config.autoCheckInterval = options.autoCheckInterval;
    if (options.checkTimeout) _config.checkTimeout = options.checkTimeout;
    if (options.criticalComponents) _config.criticalComponents = options.criticalComponents;

    // Get dependencies
    _eventBus = EventBus;
    _auditTrail = getAuditTrail();

    // Subscribe to health status events
    _eventBus.subscribe('monitoring:healthStatus', handleHealthStatusUpdate);
    
    // Register for system lifecycle events
    _eventBus.subscribe('system:beforeSleep', pauseAutoCheck);
    _eventBus.subscribe('system:afterWake', resumeAutoCheck);
    _eventBus.subscribe('system:shutdown', cleanup);
    _eventBus.subscribe('system:lowResources', handleLowResources);

    // Start automatic health checks
    startAutoCheck();
    
    _initialized = true;
    logger.info('Component health monitor initialized');
    
    // Perform initial health check
    setTimeout(() => performSystemHealthCheck(), 2000);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize component health monitor', error);
    return false;
  }
}

/**
 * Register a component health check function
 * @param {string} componentId - Unique component identifier
 * @param {Function} checkFunction - Async function that returns health status
 * @param {boolean} isCritical - Whether the component is critical for system operation
 */
function registerComponentChecker(componentId, checkFunction, isCritical = false) {
  if (typeof checkFunction !== 'function') {
    logger.error(`Invalid check function for component ${componentId}`);
    return;
  }
  
  _componentCheckers.set(componentId, checkFunction);
  
  if (isCritical && !_config.criticalComponents.includes(componentId)) {
    _config.criticalComponents.push(componentId);
  }
  
  logger.debug(`Registered health checker for component: ${componentId}`);
  
  // Initialize component status
  _healthStatus.components[componentId] = {
    status: 'unknown',
    lastCheck: null,
    details: {}
  };
}

/**
 * Unregister a component health checker
 * @param {string} componentId - Component ID to unregister
 */
function unregisterComponentChecker(componentId) {
  if (_componentCheckers.has(componentId)) {
    _componentCheckers.delete(componentId);
    logger.debug(`Unregistered health checker for component: ${componentId}`);
    
    // Remove from critical components if present
    const criticalIndex = _config.criticalComponents.indexOf(componentId);
    if (criticalIndex !== -1) {
      _config.criticalComponents.splice(criticalIndex, 1);
    }
  }
}

/**
 * Handle health status updates from components
 * @param {Object} data - Health status data
 */
function handleHealthStatusUpdate(data) {
  if (!data || !data.component) return;
  
  const { component, status, details, timestamp } = data;
  
  // Update component status
  _healthStatus.components[component] = {
    status: status || 'unknown',
    lastCheck: timestamp || Date.now(),
    details: details || {}
  };
  
  // Update overall status
  updateOverallHealthStatus();
  
  // Log important status changes
  if (status === 'error' || status === 'degraded') {
    logger.warn(`Component ${component} reported ${status} status`, details);
    
    // Log to audit trail for critical components
    if (_config.criticalComponents.includes(component)) {
      _auditTrail?.log({
        action: 'health_status_change',
        target: component,
        details: {
          status,
          timestamp: timestamp || Date.now(),
          ...(details || {})
        }
      });
    }
  }
  
  // Emit overall health status update event
  _eventBus.publish('monitoring:systemHealth', {
    overall: _healthStatus.overallStatus,
    components: _healthStatus.components,
    timestamp: Date.now()
  });
}

/**
 * Update the overall system health status based on component statuses
 */
function updateOverallHealthStatus() {
  const components = Object.keys(_healthStatus.components);
  
  // Default to online if no components
  if (components.length === 0) {
    _healthStatus.overallStatus = 'online';
    return;
  }
  
  let hasErrors = false;
  let hasWarnings = false;
  let hasUnknown = false;
  
  // Check critical components first
  for (const criticalComponent of _config.criticalComponents) {
    const status = _healthStatus.components[criticalComponent]?.status;
    if (status === 'error') {
      _healthStatus.overallStatus = 'error';
      return; // Critical error, immediately set overall status to error
    } else if (status === 'degraded') {
      hasWarnings = true;
    } else if (status === 'unknown') {
      hasUnknown = true;
    }
  }
  
  // Check all other components
  for (const component in _healthStatus.components) {
    if (_config.criticalComponents.includes(component)) continue; // Skip critical components already checked
    
    const status = _healthStatus.components[component]?.status;
    if (status === 'error') {
      hasErrors = true;
    } else if (status === 'degraded') {
      hasWarnings = true;
    } else if (status === 'unknown') {
      hasUnknown = true;
    }
  }
  
  // Determine overall status
  if (hasErrors) {
    _healthStatus.overallStatus = 'degraded';
  } else if (hasWarnings) {
    _healthStatus.overallStatus = 'degraded';
  } else if (hasUnknown) {
    _healthStatus.overallStatus = 'unknown';
  } else {
    _healthStatus.overallStatus = 'online';
  }
}

/**
 * Start automatic health check timer
 */
function startAutoCheck() {
  if (_autoCheckTimer) {
    clearInterval(_autoCheckTimer);
  }
  
  _autoCheckTimer = setInterval(() => {
    performSystemHealthCheck();
  }, _config.autoCheckInterval);
  
  logger.debug(`Automatic health checks scheduled every ${_config.autoCheckInterval / 1000} seconds`);
}

/**
 * Pause automatic health checks (e.g., when system is sleeping)
 */
function pauseAutoCheck() {
  if (_autoCheckTimer) {
    clearInterval(_autoCheckTimer);
    _autoCheckTimer = null;
    logger.debug('Automatic health checks paused');
  }
}

/**
 * Resume automatic health checks
 */
function resumeAutoCheck() {
  startAutoCheck();
  
  // Perform an immediate check when resuming
  setTimeout(() => performSystemHealthCheck(), 1000);
}

/**
 * Handle low resource situation
 */
function handleLowResources() {
  // Extend the auto-check interval to reduce resource usage
  if (_autoCheckTimer) {
    clearInterval(_autoCheckTimer);
    _autoCheckTimer = setInterval(() => {
      performSystemHealthCheck();
    }, _config.autoCheckInterval * 2); // Double the interval
    
    logger.debug('Health check interval extended due to low resources');
  }
}

/**
 * Perform a system-wide health check
 * @returns {Promise<Object>} Health status result
 */
async function performSystemHealthCheck() {
  if (_checkInProgress) {
    logger.debug('Health check already in progress, skipping');
    return null;
  }
  
  _checkInProgress = true;
  const now = Date.now();
  _healthStatus.lastSystemCheck = now;
  
  logger.debug('Starting system-wide health check');
  
  try {
    // Perform checks for all registered components
    const checkPromises = [];
    
    for (const [componentId, checkFunction] of _componentCheckers.entries()) {
      checkPromises.push(checkComponent(componentId, checkFunction));
    }
    
    // Wait for all checks to complete
    await Promise.all(checkPromises);
    
    // Update overall status
    updateOverallHealthStatus();
    
    // Publish system health status event
    _eventBus.publish('monitoring:systemHealth', {
      overall: _healthStatus.overallStatus,
      components: _healthStatus.components,
      timestamp: now
    });
    
    logger.debug(`System health check completed, overall status: ${_healthStatus.overallStatus}`);
    
    return {
      overall: _healthStatus.overallStatus,
      components: { ..._healthStatus.components },
      timestamp: now
    };
  } catch (error) {
    logger.error('Error during system health check', error);
    return null;
  } finally {
    _checkInProgress = false;
  }
}

/**
 * Check health of a single component
 * @param {string} componentId - Component ID to check
 * @param {Function} checkFunction - Health check function
 * @returns {Promise<void>}
 */
async function checkComponent(componentId, checkFunction) {
  try {
    // Run the check with a timeout
    const status = await Promise.race([
      checkFunction(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), _config.checkTimeout)
      )
    ]);
    
    _healthStatus.components[componentId] = {
      status: status ? (status.status || 'healthy') : 'degraded',
      lastCheck: Date.now(),
      ...(status?.details && { details: status.details })
    };
    
    logger.debug(`Health check for ${componentId}: ${_healthStatus.components[componentId].status}`);
  } catch (error) {
    logger.warn(`Health check failed for ${componentId}:`, error);
    
    _healthStatus.components[componentId] = {
      status: 'error',
      lastCheck: Date.now(),
      error: error.message || String(error)
    };
    
    // Log critical component errors to audit trail
    if (_config.criticalComponents.includes(componentId)) {
      _auditTrail?.log({
        action: 'health_check_failed',
        target: componentId,
        details: {
          error: error.message || String(error),
          timestamp: Date.now()
        }
      });
    }
  }
}

/**
 * Get the current health status
 * @returns {Object} Health status object
 */
function getHealthStatus() {
  return {
    overall: _healthStatus.overallStatus,
    components: { ..._healthStatus.components },
    lastSystemCheck: _healthStatus.lastSystemCheck,
    timestamp: Date.now()
  };
}

/**
 * Get health status for a specific component
 * @param {string} componentId - Component ID
 * @returns {Object|null} Component health status or null if not found
 */
function getComponentHealth(componentId) {
  return _healthStatus.components[componentId] || null;
}

/**
 * Trigger an immediate health check for a specific component
 * @param {string} componentId - Component ID to check
 * @returns {Promise<Object|null>} Component status or null if component not found
 */
async function checkComponentHealth(componentId) {
  const checkFunction = _componentCheckers.get(componentId);
  if (!checkFunction) {
    logger.warn(`No health checker registered for component: ${componentId}`);
    return null;
  }
  
  await checkComponent(componentId, checkFunction);
  return _healthStatus.components[componentId] || null;
}

/**
 * Clean up resources
 */
function cleanup() {
  if (_autoCheckTimer) {
    clearInterval(_autoCheckTimer);
    _autoCheckTimer = null;
  }
  
  // Unsubscribe from events
  _eventBus.unsubscribe('monitoring:healthStatus', handleHealthStatusUpdate);
  _eventBus.unsubscribe('system:beforeSleep', pauseAutoCheck);
  _eventBus.unsubscribe('system:afterWake', resumeAutoCheck);
  _eventBus.unsubscribe('system:shutdown', cleanup);
  _eventBus.unsubscribe('system:lowResources', handleLowResources);
  
  _initialized = false;
  logger.debug('Component health monitor cleaned up');
}

// Export the public API
export default {
  initialize,
  registerComponentChecker,
  unregisterComponentChecker,
  performSystemHealthCheck,
  getHealthStatus,
  getComponentHealth,
  checkComponentHealth,
  cleanup
};
