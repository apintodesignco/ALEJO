/**
 * ALEJO Initialization Manager
 * 
 * This module provides a robust system for initializing ALEJO components
 * with proper error handling, fallbacks, and dependency management.
 * 
 * Features:
 * - Dependency-aware initialization order
 * - Parallel initialization where possible
 * - Fallback mechanisms for failed components
 * - Detailed initialization logging
 * - Accessibility-first prioritization
 */

import { 
  initializeWithFallback, 
  logError, 
  ErrorSeverity,
  getComponentStatus,
  hasEssentialFailures
} from './error-handler.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Track initialization state
const initState = {
  isInitializing: false,
  startTime: null,
  endTime: null,
  completedComponents: [],
  failedComponents: [],
  pendingComponents: []
};

// Component registry for initialization
const componentRegistry = new Map();

/**
 * Register a component for initialization
 * 
 * @param {Object} componentConfig - Component configuration
 * @param {string} componentConfig.id - Unique component identifier
 * @param {Function} componentConfig.initFunction - Primary initialization function
 * @param {Function} componentConfig.fallbackFunction - Fallback initialization function (optional)
 * @param {string[]} componentConfig.dependencies - Array of component IDs this component depends on
 * @param {boolean} componentConfig.isEssential - Whether this component is essential
 * @param {boolean} componentConfig.accessibility - Whether this component is accessibility-related
 * @param {number} componentConfig.priority - Initialization priority (higher = earlier)
 * @param {number} componentConfig.retryAttempts - Number of retry attempts
 * @param {number} componentConfig.retryDelay - Delay between retries in ms
 */
export function registerComponent(componentConfig) {
  const {
    id,
    initFunction,
    fallbackFunction = null,
    dependencies = [],
    isEssential = false,
    accessibility = false,
    priority = 0,
    retryAttempts = 1,
    retryDelay = 500
  } = componentConfig;
  
  if (!id || typeof id !== 'string') {
    throw new Error('Component ID is required and must be a string');
  }
  
  if (!initFunction || typeof initFunction !== 'function') {
    throw new Error('Component initialization function is required');
  }
  
  // Register the component
  componentRegistry.set(id, {
    id,
    initFunction,
    fallbackFunction,
    dependencies,
    isEssential,
    accessibility,
    priority: accessibility ? 1000 : priority, // Accessibility components get highest priority
    retryAttempts,
    retryDelay,
    status: 'registered'
  });
  
  console.log(`Component registered: ${id}`);
}

/**
 * Initialize all registered components in the correct order
 * 
 * @returns {Promise<Object>} - Initialization results
 */
export async function initializeAllComponents() {
  if (initState.isInitializing) {
    console.warn('Initialization already in progress');
    return;
  }
  
  // Reset initialization state
  initState.isInitializing = true;
  initState.startTime = Date.now();
  initState.completedComponents = [];
  initState.failedComponents = [];
  initState.pendingComponents = Array.from(componentRegistry.keys());
  
  console.log(`Starting initialization of ${initState.pendingComponents.length} components`);
  publishEvent('system:initialization:start', { componentCount: initState.pendingComponents.length });
  
  try {
    // Sort components by priority and dependencies
    const initOrder = calculateInitializationOrder();
    
    // Group components that can be initialized in parallel
    const initGroups = createInitializationGroups(initOrder);
    
    // Initialize each group in sequence, with parallel initialization within groups
    const results = {};
    
    for (let groupIndex = 0; groupIndex < initGroups.length; groupIndex++) {
      const group = initGroups[groupIndex];
      console.log(`Initializing group ${groupIndex + 1}/${initGroups.length} with ${group.length} components`);
      
      // Initialize all components in this group in parallel
      const groupPromises = group.map(componentId => {
        const component = componentRegistry.get(componentId);
        return initializeComponent(component).then(result => {
          results[componentId] = result;
          return { componentId, success: true, result };
        }).catch(error => {
          results[componentId] = { error };
          return { componentId, success: false, error };
        });
      });
      
      // Wait for all components in this group to complete
      const groupResults = await Promise.all(groupPromises);
      
      // Check if any essential components failed
      const essentialFailures = groupResults.filter(r => 
        !r.success && componentRegistry.get(r.componentId).isEssential
      );
      
      if (essentialFailures.length > 0) {
        const failedIds = essentialFailures.map(f => f.componentId).join(', ');
        throw new Error(`Essential components failed to initialize: ${failedIds}`);
      }
    }
    
    // Finalize initialization
    initState.isInitializing = false;
    initState.endTime = Date.now();
    const duration = initState.endTime - initState.startTime;
    
    console.log(`Initialization completed in ${duration}ms`);
    console.log(`- Completed: ${initState.completedComponents.length} components`);
    console.log(`- Failed: ${initState.failedComponents.length} components`);
    
    publishEvent('system:initialization:complete', {
      duration,
      completedCount: initState.completedComponents.length,
      failedCount: initState.failedComponents.length,
      results
    });
    
    return {
      success: initState.failedComponents.length === 0,
      completedComponents: initState.completedComponents,
      failedComponents: initState.failedComponents,
      duration,
      results
    };
  } catch (error) {
    initState.isInitializing = false;
    initState.endTime = Date.now();
    const duration = initState.endTime - initState.startTime;
    
    console.error(`Initialization failed after ${duration}ms:`, error);
    
    publishEvent('system:initialization:failed', {
      duration,
      error,
      completedCount: initState.completedComponents.length,
      failedCount: initState.failedComponents.length
    });
    
    throw error;
  }
}

/**
 * Initialize a single component with proper error handling
 * 
 * @param {Object} component - Component configuration
 * @returns {Promise<any>} - Initialization result
 */
async function initializeComponent(component) {
  const { id, initFunction, fallbackFunction, isEssential, accessibility, retryAttempts, retryDelay } = component;
  
  try {
    // Check if all dependencies are satisfied
    const unsatisfiedDependencies = component.dependencies.filter(depId => 
      !initState.completedComponents.includes(depId)
    );
    
    if (unsatisfiedDependencies.length > 0) {
      throw new Error(`Cannot initialize ${id}: Unsatisfied dependencies: ${unsatisfiedDependencies.join(', ')}`);
    }
    
    // Initialize the component with fallback
    const result = await initializeWithFallback(
      id,
      initFunction,
      fallbackFunction,
      {
        isEssential,
        accessibility,
        retryAttempts,
        retryDelay
      }
    );
    
    // Mark as completed
    initState.completedComponents.push(id);
    initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
    
    return result;
  } catch (error) {
    // Mark as failed
    initState.failedComponents.push(id);
    initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
    
    // Log the error
    logError(
      `component:${id}`,
      error,
      isEssential ? ErrorSeverity.CRITICAL : (accessibility ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM),
      { component: id, isEssential, accessibility }
    );
    
    throw error;
  }
}

/**
 * Calculate the order in which components should be initialized
 * based on dependencies and priority
 * 
 * @returns {Array<string>} - Ordered array of component IDs
 */
function calculateInitializationOrder() {
  const componentIds = Array.from(componentRegistry.keys());
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  
  // Topological sort with priority
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected involving component: ${id}`);
    }
    
    visiting.add(id);
    
    const component = componentRegistry.get(id);
    if (component && component.dependencies) {
      // Sort dependencies by priority (highest first)
      const sortedDeps = [...component.dependencies].sort((a, b) => {
        const compA = componentRegistry.get(a);
        const compB = componentRegistry.get(b);
        return (compB?.priority || 0) - (compA?.priority || 0);
      });
      
      for (const depId of sortedDeps) {
        if (!componentRegistry.has(depId)) {
          console.warn(`Component ${id} depends on unknown component ${depId}`);
          continue;
        }
        visit(depId);
      }
    }
    
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  }
  
  // Sort components by priority (highest first) before topological sort
  const prioritySorted = [...componentIds].sort((a, b) => {
    const compA = componentRegistry.get(a);
    const compB = componentRegistry.get(b);
    return (compB?.priority || 0) - (compA?.priority || 0);
  });
  
  // Visit each component in priority order
  for (const id of prioritySorted) {
    if (!visited.has(id)) {
      visit(id);
    }
  }
  
  return ordered;
}

/**
 * Group components that can be initialized in parallel
 * 
 * @param {Array<string>} orderedIds - Component IDs in dependency order
 * @returns {Array<Array<string>>} - Groups of component IDs that can be initialized in parallel
 */
function createInitializationGroups(orderedIds) {
  const groups = [];
  const remainingIds = new Set(orderedIds);
  
  while (remainingIds.size > 0) {
    const currentGroup = [];
    
    // Find all components that have all dependencies satisfied
    for (const id of remainingIds) {
      const component = componentRegistry.get(id);
      const unsatisfiedDeps = component.dependencies.filter(depId => remainingIds.has(depId));
      
      if (unsatisfiedDeps.length === 0) {
        currentGroup.push(id);
      }
    }
    
    if (currentGroup.length === 0) {
      throw new Error('Unable to resolve component dependencies. Possible circular dependency.');
    }
    
    // Remove the current group from remaining IDs
    for (const id of currentGroup) {
      remainingIds.delete(id);
    }
    
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Get initialization status
 * 
 * @returns {Object} - Current initialization status
 */
export function getInitializationStatus() {
  return {
    ...initState,
    componentCount: componentRegistry.size,
    componentStatus: getComponentStatus()
  };
}

/**
 * Check if initialization has completed successfully
 * 
 * @returns {boolean} - True if initialization completed without essential failures
 */
export function isInitializationSuccessful() {
  return !initState.isInitializing && 
         initState.endTime !== null && 
         !hasEssentialFailures();
}

/**
 * Reset the initialization state and component registry
 * Useful for testing or restarting the system
 */
export function resetInitialization() {
  componentRegistry.clear();
  
  initState.isInitializing = false;
  initState.startTime = null;
  initState.endTime = null;
  initState.completedComponents = [];
  initState.failedComponents = [];
  initState.pendingComponents = [];
  
  console.log('Initialization state and component registry reset');
}
