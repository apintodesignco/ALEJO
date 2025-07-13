/**
 * @file progressive-loader.js
 * @description Progressive loading system for ALEJO components with fallback mechanisms
 * @module core/system/progressive-loader
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../events/event-bus.js';
import { Logger } from '../utils/logger.js';
import { AuditTrail } from '../utils/audit-trail.js';
import { ResourceMonitor } from './resource-monitor.js';
import { getThresholds } from './resource-thresholds.js';

// Initialize logger
const logger = new Logger('ProgressiveLoader');
const auditTrail = new AuditTrail('system');

// Module state
const _components = new Map();
const _loadedComponents = new Set();
const _failedComponents = new Set();
const _pendingComponents = new Set();
const _dependencyGraph = new Map();
let _loadingActive = false;
let _initialized = false;
let _aborted = false;

// Constants
const LOAD_PHASES = {
  CRITICAL: 0,    // Essential system components (event bus, error handlers, etc)
  CORE: 1,        // Core functionality (main services and APIs)
  FUNCTIONAL: 2,  // Functional components (specific features)
  ENHANCEMENT: 3, // Enhancement components (non-essential features)
  EXTENSION: 4    // Extensions and plugins
};

const LOAD_PRIORITIES = {
  HIGHEST: 0,     // Load first within phase
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  LOWEST: 4      // Load last within phase
};

// Configuration
const DEFAULT_CONFIG = {
  concurrentLoads: 3,           // Number of components to load concurrently
  retryAttempts: 2,             // Number of retry attempts for failed components
  retryDelay: 1000,             // Delay between retries in ms
  resourceCheckInterval: 500,   // Interval for resource availability checks in ms
  phaseTransitionDelay: 100,    // Delay between loading phases in ms
  loadTimeout: 30000,           // Timeout for component loading in ms
  abortOnCriticalFailure: true, // Whether to abort loading if a critical component fails
  enableFallbacks: true         // Whether to enable fallback mechanisms
};

let config = { ...DEFAULT_CONFIG };

/**
 * Initialize the progressive loader
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(options = {}) {
  if (_initialized) {
    logger.warn('Progressive loader already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing progressive loader');
    
    // Apply configuration
    config = { ...DEFAULT_CONFIG, ...options };
    
    // Reset state
    _components.clear();
    _loadedComponents.clear();
    _failedComponents.clear();
    _pendingComponents.clear();
    _dependencyGraph.clear();
    _loadingActive = false;
    _aborted = false;
    
    // Set up event listeners
    EventBus.subscribe('system:resourceStatusChanged', handleResourceStatusChanged);
    
    _initialized = true;
    logger.info('Progressive loader initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize progressive loader', error);
    return false;
  }
}

/**
 * Register a component for loading
 * @param {string} id - Unique component identifier
 * @param {Function} loadFn - Async function to load the component
 * @param {Object} options - Component options
 * @param {number} [options.phase=LOAD_PHASES.FUNCTIONAL] - Loading phase
 * @param {number} [options.priority=LOAD_PRIORITIES.NORMAL] - Loading priority within phase
 * @param {string[]} [options.dependencies=[]] - Component dependencies
 * @param {boolean} [options.critical=false] - Whether component is critical
 * @param {Function} [options.fallbackFn=null] - Fallback function if loading fails
 * @param {Object} [options.metadata={}] - Additional component metadata
 * @returns {boolean} - True if registration successful
 */
export function registerComponent(id, loadFn, options = {}) {
  if (!_initialized) {
    logger.error('Cannot register component before initialization');
    return false;
  }
  
  if (!id || typeof id !== 'string') {
    logger.error('Invalid component ID');
    return false;
  }
  
  if (!loadFn || typeof loadFn !== 'function') {
    logger.error(`Invalid load function for component ${id}`);
    return false;
  }
  
  if (_components.has(id)) {
    logger.warn(`Component ${id} already registered, updating registration`);
  }
  
  // Default options
  const componentOptions = {
    phase: LOAD_PHASES.FUNCTIONAL,
    priority: LOAD_PRIORITIES.NORMAL,
    dependencies: [],
    critical: false,
    fallbackFn: null,
    metadata: {},
    ...options
  };
  
  // Validate phase and priority
  if (!Object.values(LOAD_PHASES).includes(componentOptions.phase)) {
    logger.warn(`Invalid phase for component ${id}, using default`);
    componentOptions.phase = LOAD_PHASES.FUNCTIONAL;
  }
  
  if (!Object.values(LOAD_PRIORITIES).includes(componentOptions.priority)) {
    logger.warn(`Invalid priority for component ${id}, using default`);
    componentOptions.priority = LOAD_PRIORITIES.NORMAL;
  }
  
  // Register component
  _components.set(id, {
    id,
    loadFn,
    ...componentOptions,
    status: 'registered',
    retryCount: 0,
    error: null
  });
  
  // Update dependency graph
  if (!_dependencyGraph.has(id)) {
    _dependencyGraph.set(id, new Set());
  }
  
  componentOptions.dependencies.forEach(depId => {
    if (!_dependencyGraph.has(depId)) {
      _dependencyGraph.set(depId, new Set());
    }
    _dependencyGraph.get(depId).add(id);
  });
  
  logger.debug(`Registered component ${id} in phase ${componentOptions.phase} with priority ${componentOptions.priority}`);
  
  return true;
}

/**
 * Unregister a component
 * @param {string} id - Component identifier
 * @returns {boolean} - True if unregistration successful
 */
export function unregisterComponent(id) {
  if (!_initialized) {
    logger.error('Cannot unregister component before initialization');
    return false;
  }
  
  if (!_components.has(id)) {
    logger.warn(`Component ${id} not registered`);
    return false;
  }
  
  // Check if component is loaded or in progress
  if (_loadedComponents.has(id)) {
    logger.warn(`Component ${id} already loaded, cannot unregister`);
    return false;
  }
  
  if (_pendingComponents.has(id)) {
    logger.warn(`Component ${id} currently loading, cannot unregister`);
    return false;
  }
  
  // Remove component
  _components.delete(id);
  _failedComponents.delete(id);
  
  // Update dependency graph
  if (_dependencyGraph.has(id)) {
    _dependencyGraph.delete(id);
    
    // Remove references to this component as a dependency
    _dependencyGraph.forEach((dependents, depId) => {
      dependents.delete(id);
    });
  }
  
  logger.debug(`Unregistered component ${id}`);
  
  return true;
}

/**
 * Start loading all registered components
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} - Loading results
 */
export async function startLoading(options = {}) {
  if (!_initialized) {
    logger.error('Cannot start loading before initialization');
    return { success: false, error: 'Not initialized' };
  }
  
  if (_loadingActive) {
    logger.warn('Loading already in progress');
    return { success: false, error: 'Loading in progress' };
  }
  
  try {
    logger.info('Starting progressive loading of components');
    auditTrail.log('info', 'Starting system initialization');
    
    const startTime = performance.now();
    _loadingActive = true;
    _aborted = false;
    
    // Apply options
    const loadOptions = { ...config, ...options };
    
    // Publish loading start event
    EventBus.publish('system:loadingStarted', {
      componentCount: _components.size,
      phases: Object.keys(LOAD_PHASES).length
    });
    
    // Sort components by phase and priority
    const sortedComponents = Array.from(_components.entries())
      .map(([id, component]) => component)
      .sort((a, b) => {
        if (a.phase !== b.phase) {
          return a.phase - b.phase;
        }
        return a.priority - b.priority;
      });
    
    // Group components by phase
    const phases = [];
    let currentPhase = -1;
    let phaseComponents = [];
    
    sortedComponents.forEach(component => {
      if (component.phase !== currentPhase) {
        if (phaseComponents.length > 0) {
          phases.push(phaseComponents);
        }
        currentPhase = component.phase;
        phaseComponents = [component];
      } else {
        phaseComponents.push(component);
      }
    });
    
    if (phaseComponents.length > 0) {
      phases.push(phaseComponents);
    }
    
    // Load components by phase
    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
      if (_aborted) {
        logger.warn('Loading aborted');
        break;
      }
      
      const phaseStart = performance.now();
      const phaseComponents = phases[phaseIndex];
      const phaseName = Object.keys(LOAD_PHASES)[phaseIndex];
      
      logger.info(`Loading phase ${phaseName} with ${phaseComponents.length} components`);
      
      EventBus.publish('system:phaseStarted', {
        phase: phaseIndex,
        phaseName,
        componentCount: phaseComponents.length
      });
      
      // Load components in this phase
      await loadComponentsInPhase(phaseComponents, loadOptions);
      
      if (_aborted) {
        break;
      }
      
      const phaseDuration = performance.now() - phaseStart;
      
      logger.info(`Completed phase ${phaseName} in ${phaseDuration.toFixed(2)}ms`);
      
      EventBus.publish('system:phaseCompleted', {
        phase: phaseIndex,
        phaseName,
        duration: phaseDuration,
        successful: phaseComponents.filter(c => _loadedComponents.has(c.id)).length,
        failed: phaseComponents.filter(c => _failedComponents.has(c.id)).length
      });
      
      // Add a small delay between phases to allow UI updates
      if (phaseIndex < phases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, loadOptions.phaseTransitionDelay));
      }
    }
    
    const totalDuration = performance.now() - startTime;
    _loadingActive = false;
    
    const results = {
      success: !_aborted,
      aborted: _aborted,
      duration: totalDuration,
      loadedCount: _loadedComponents.size,
      failedCount: _failedComponents.size,
      totalCount: _components.size,
      loaded: Array.from(_loadedComponents),
      failed: Array.from(_failedComponents).map(id => ({
        id,
        error: _components.get(id)?.error?.message || 'Unknown error'
      }))
    };
    
    logger.info(`Progressive loading completed in ${totalDuration.toFixed(2)}ms`, 
      `Loaded: ${results.loadedCount}, Failed: ${results.failedCount}`);
    
    auditTrail.log('info', 'System initialization completed', {
      duration: Math.round(totalDuration),
      loadedCount: results.loadedCount,
      failedCount: results.failedCount,
      success: results.success
    });
    
    EventBus.publish('system:loadingCompleted', results);
    
    return results;
  } catch (error) {
    _loadingActive = false;
    
    logger.error('Error during progressive loading', error);
    auditTrail.log('error', 'System initialization failed', {
      error: error.message
    });
    
    EventBus.publish('system:loadingError', {
      error: error.message
    });
    
    return {
      success: false,
      aborted: _aborted,
      error: error.message,
      loadedCount: _loadedComponents.size,
      failedCount: _failedComponents.size,
      totalCount: _components.size,
      loaded: Array.from(_loadedComponents),
      failed: Array.from(_failedComponents).map(id => ({
        id,
        error: _components.get(id)?.error?.message || 'Unknown error'
      }))
    };
  }
}

/**
 * Abort the loading process
 * @returns {boolean} - True if abort successful
 */
export function abortLoading() {
  if (!_loadingActive) {
    return false;
  }
  
  logger.warn('Aborting component loading');
  _aborted = true;
  
  EventBus.publish('system:loadingAborted', {
    loadedCount: _loadedComponents.size,
    failedCount: _failedComponents.size,
    pendingCount: _pendingComponents.size
  });
  
  auditTrail.log('warning', 'System initialization aborted', {
    loadedCount: _loadedComponents.size,
    failedCount: _failedComponents.size
  });
  
  return true;
}

/**
 * Get component loading status
 * @param {string} id - Component identifier
 * @returns {Object} - Component status
 */
export function getComponentStatus(id) {
  if (!_components.has(id)) {
    return { id, status: 'not_registered' };
  }
  
  const component = _components.get(id);
  
  if (_loadedComponents.has(id)) {
    return { id, status: 'loaded' };
  }
  
  if (_failedComponents.has(id)) {
    return {
      id,
      status: 'failed',
      error: component.error?.message || 'Unknown error',
      retryCount: component.retryCount
    };
  }
  
  if (_pendingComponents.has(id)) {
    return { id, status: 'loading' };
  }
  
  return {
    id,
    status: 'registered',
    phase: component.phase,
    priority: component.priority
  };
}

/**
 * Get loading progress
 * @returns {Object} - Loading progress information
 */
export function getLoadingProgress() {
  const total = _components.size;
  const loaded = _loadedComponents.size;
  const failed = _failedComponents.size;
  const pending = _pendingComponents.size;
  const waiting = total - loaded - failed - pending;
  
  return {
    total,
    loaded,
    failed,
    pending,
    waiting,
    progress: total > 0 ? Math.floor((loaded / total) * 100) : 0,
    active: _loadingActive,
    aborted: _aborted
  };
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  try {
    // Abort loading if active
    if (_loadingActive) {
      abortLoading();
    }
    
    // Remove event listeners
    EventBus.unsubscribe('system:resourceStatusChanged', handleResourceStatusChanged);
    
    _components.clear();
    _loadedComponents.clear();
    _failedComponents.clear();
    _pendingComponents.clear();
    _dependencyGraph.clear();
    
    _initialized = false;
    _loadingActive = false;
    _aborted = false;
    
    logger.info('Progressive loader cleaned up');
  } catch (error) {
    logger.error('Error during progressive loader cleanup', error);
  }
}

/**
 * Load components in a phase with concurrency control
 * @private
 * @param {Array} components - Components to load
 * @param {Object} options - Loading options
 * @returns {Promise<void>}
 */
async function loadComponentsInPhase(components, options) {
  // Filter out already loaded or failed components
  const toLoad = components.filter(c => 
    !_loadedComponents.has(c.id) && 
    !_failedComponents.has(c.id)
  );
  
  if (toLoad.length === 0) {
    return;
  }
  
  // Create a queue of components
  const queue = [...toLoad];
  const inProgress = new Map();
  
  while (queue.length > 0 || inProgress.size > 0) {
    if (_aborted) {
      break;
    }
    
    // Check if we can start more component loads
    while (inProgress.size < options.concurrentLoads && queue.length > 0) {
      const component = queue.shift();
      
      // Check if dependencies are satisfied
      const unsatisfiedDeps = component.dependencies.filter(
        depId => !_loadedComponents.has(depId)
      );
      
      if (unsatisfiedDeps.length > 0) {
        // Cannot load yet, put back in queue
        queue.push(component);
        continue;
      }
      
      // Start loading component
      _pendingComponents.add(component.id);
      
      const loadPromise = loadComponent(component, options)
        .finally(() => {
          _pendingComponents.delete(component.id);
          inProgress.delete(component.id);
        });
      
      inProgress.set(component.id, loadPromise);
    }
    
    if (inProgress.size === 0 && queue.length > 0) {
      // We have a dependency cycle or all remaining components have unsatisfied dependencies
      logger.error('Dependency cycle detected or unsatisfied dependencies', 
        queue.map(c => ({ 
          id: c.id, 
          dependencies: c.dependencies.filter(d => !_loadedComponents.has(d))
        }))
      );
      
      // Try to continue with the first component in queue
      const component = queue.shift();
      _pendingComponents.add(component.id);
      
      const loadPromise = loadComponent(component, options, true)
        .finally(() => {
          _pendingComponents.delete(component.id);
          inProgress.delete(component.id);
        });
      
      inProgress.set(component.id, loadPromise);
    }
    
    // Wait for at least one component to finish
    if (inProgress.size > 0) {
      await Promise.race(Array.from(inProgress.values()));
    }
  }
}

/**
 * Load a single component
 * @private
 * @param {Object} component - Component to load
 * @param {Object} options - Loading options
 * @param {boolean} [forceDespiteDeps=false] - Whether to force load despite unsatisfied dependencies
 * @returns {Promise<boolean>} - True if loading successful
 */
async function loadComponent(component, options, forceDespiteDeps = false) {
  const { id, loadFn, fallbackFn, critical } = component;
  
  logger.debug(`Loading component ${id}`);
  
  // Publish component loading event
  EventBus.publish('system:componentLoading', {
    id,
    critical,
    metadata: component.metadata
  });
  
  try {
    // Check if dependencies are satisfied
    if (!forceDespiteDeps) {
      const unsatisfiedDeps = component.dependencies.filter(
        depId => !_loadedComponents.has(depId)
      );
      
      if (unsatisfiedDeps.length > 0) {
        throw new Error(`Unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}`);
      }
    }
    
    // Set a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Loading timeout after ${options.loadTimeout}ms`)), 
        options.loadTimeout);
    });
    
    // Load the component
    const result = await Promise.race([
      loadFn(),
      timeoutPromise
    ]);
    
    // Mark as loaded
    _loadedComponents.add(id);
    component.status = 'loaded';
    
    logger.debug(`Successfully loaded component ${id}`);
    
    // Publish component loaded event
    EventBus.publish('system:componentLoaded', {
      id,
      critical,
      metadata: component.metadata
    });
    
    // Check if this enables any dependent components
    if (_dependencyGraph.has(id)) {
      const dependents = Array.from(_dependencyGraph.get(id));
      if (dependents.length > 0) {
        logger.debug(`Component ${id} enables dependents: ${dependents.join(', ')}`);
      }
    }
    
    return true;
  } catch (error) {
    component.error = error;
    component.status = 'failed';
    component.retryCount += 1;
    
    logger.error(`Failed to load component ${id}`, error);
    
    // Publish component failed event
    EventBus.publish('system:componentFailed', {
      id,
      critical,
      error: error.message,
      retryCount: component.retryCount,
      metadata: component.metadata
    });
    
    // Check if we should retry
    if (component.retryCount <= options.retryAttempts) {
      logger.debug(`Will retry loading component ${id} (attempt ${component.retryCount} of ${options.retryAttempts})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, options.retryDelay));
      
      // Retry loading
      return loadComponent(component, options);
    }
    
    // Check if there's a fallback available
    if (options.enableFallbacks && fallbackFn) {
      try {
        logger.debug(`Attempting fallback for component ${id}`);
        
        // Publish fallback attempt event
        EventBus.publish('system:componentFallbackAttempt', {
          id,
          critical,
          metadata: component.metadata
        });
        
        // Execute fallback
        const fallbackResult = await Promise.race([
          fallbackFn(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Fallback timeout after ${options.loadTimeout}ms`)), 
              options.loadTimeout);
          })
        ]);
        
        // Mark as loaded via fallback
        _loadedComponents.add(id);
        component.status = 'loaded_fallback';
        
        logger.info(`Successfully loaded component ${id} using fallback`);
        
        // Publish fallback success event
        EventBus.publish('system:componentFallbackSuccess', {
          id,
          critical,
          metadata: component.metadata
        });
        
        return true;
      } catch (fallbackError) {
        logger.error(`Fallback failed for component ${id}`, fallbackError);
        
        // Publish fallback failure event
        EventBus.publish('system:componentFallbackFailed', {
          id,
          critical,
          error: fallbackError.message,
          metadata: component.metadata
        });
      }
    }
    
    // Mark as failed
    _failedComponents.add(id);
    
    // Check if this is a critical component
    if (critical && options.abortOnCriticalFailure) {
      logger.error(`Critical component ${id} failed, aborting loading`);
      _aborted = true;
      
      // Publish critical failure event
      EventBus.publish('system:criticalFailure', {
        id,
        error: error.message,
        metadata: component.metadata
      });
      
      auditTrail.log('error', 'Critical component failed during initialization', {
        component: id,
        error: error.message
      });
    }
    
    return false;
  }
}

/**
 * Handle resource status changes
 * @private
 * @param {Object} data - Resource status data
 */
function handleResourceStatusChanged(data) {
  // If resources are critically low, slow down loading
  if (data?.critical && _loadingActive && !_aborted) {
    logger.warn('Resources critically low, slowing down loading');
    
    // Get current thresholds
    const thresholds = getThresholds();
    
    // Check if we should abort loading based on resource constraints
    if (data.cpu > thresholds?.resourceModes?.minimal?.cpuThreshold || 
        data.memory > thresholds?.resourceModes?.minimal?.memoryThreshold) {
      
      logger.error('Resource thresholds exceeded, pausing loading');
      
      // Publish resource constraint event
      EventBus.publish('system:resourceConstraint', {
        cpu: data.cpu,
        memory: data.memory,
        thresholds: {
          cpu: thresholds?.resourceModes?.minimal?.cpuThreshold,
          memory: thresholds?.resourceModes?.minimal?.memoryThreshold
        }
      });
      
      // We don't abort, but we'll wait for resources to free up
      // This will be handled automatically by the concurrency control
    }
  }
}

// Export constants for external use
export const LoadPhases = LOAD_PHASES;
export const LoadPriorities = LOAD_PRIORITIES;
