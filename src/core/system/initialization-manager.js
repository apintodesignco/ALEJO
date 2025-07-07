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
import { logInitEvent } from './initialization-log-viewer.js';

// Track initialization state
const initState = {
  isInitializing: false,
  startTime: null,
  endTime: null,
  completedComponents: [],
  failedComponents: [],
  pendingComponents: [],
  accessibilityComponents: [],
  essentialComponents: []
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
    status: 'registered',
    registrationTime: Date.now()
  });
  
  // Track accessibility and essential components
  if (accessibility && !initState.accessibilityComponents.includes(id)) {
    initState.accessibilityComponents.push(id);
  }
  
  if (isEssential && !initState.essentialComponents.includes(id)) {
    initState.essentialComponents.push(id);
  }
  
  console.log(`Component registered: ${id}`);
  logInitEvent('register', id, { 
    dependencies, 
    isEssential, 
    accessibility, 
    priority: accessibility ? 1000 : priority 
  });
}

/**
 * Initialize the ALEJO system with progressive loading and fallback support
 * 
 * @param {Object} options - System initialization options
 * @param {boolean} options.prioritizeAccessibility - Whether to prioritize accessibility components
 * @param {boolean} options.deferNonEssential - Whether to defer non-essential components
 * @param {boolean} options.useFallbacks - Whether to use fallbacks for failed components
 * @param {Function} options.progressCallback - Callback for initialization progress
 * @param {string[]} options.allowedPhases - Progressive loading phases to initialize
 * @returns {Promise<Object>} - Initialization results
 */
export async function initializeSystem(options = {}) {
  const {
    prioritizeAccessibility = true,
    deferNonEssential = false,
    useFallbacks = true,
    progressCallback = null,
    allowedPhases = null
  } = options;
  
  console.log('Initializing ALEJO system');
  logInitEvent('system-init-start', 'system', { options });
  
  try {
    // Import progressive loading manager dynamically to avoid circular dependencies
    let progressiveLoadingManager = null;
    try {
      progressiveLoadingManager = await import('../loading/progressive-loading-manager.js');
      console.log('Progressive loading manager imported successfully');
    } catch (error) {
      console.warn('Failed to import progressive loading manager, proceeding without phase filtering', error);
    }
    
    // Get current loading sequence state if progressive loading manager is available
    let currentPhase = 'all';
    let phasesAllowed = allowedPhases;
    
    if (progressiveLoadingManager && progressiveLoadingManager.getLoadingSequenceState) {
      const loadingState = progressiveLoadingManager.getLoadingSequenceState();
      currentPhase = loadingState.currentPhase;
      
      // If no specific phases are provided, use the current phase from the loading manager
      if (!phasesAllowed) {
        phasesAllowed = loadingState.allowedPhases || ['critical', 'essential', currentPhase];
      }
      
      console.log(`Current loading phase: ${currentPhase}. Allowed phases: ${phasesAllowed.join(', ')}`);
    }
    
    // Determine which components to initialize based on phase and options
    const componentsToInitialize = [];
    const deferredComponents = [];
    
    // Group components by their initialization phase
    const componentsByPhase = new Map();
    Array.from(componentRegistry.keys()).forEach(id => {
      const component = componentRegistry.get(id);
      const phase = component.phase || 'default';
      
      if (!componentsByPhase.has(phase)) {
        componentsByPhase.set(phase, []);
      }
      componentsByPhase.get(phase).push(id);
    });
    
    // First, add all accessibility components if prioritizing accessibility
    if (prioritizeAccessibility) {
      initState.accessibilityComponents.forEach(id => {
        if (componentRegistry.has(id)) {
          componentsToInitialize.push(id);
        }
      });
    }
    
    // Then add components based on phases
    if (phasesAllowed) {
      phasesAllowed.forEach(phase => {
        if (componentsByPhase.has(phase)) {
          componentsByPhase.get(phase).forEach(id => {
            // Skip if already added (e.g., accessibility component)
            if (!componentsToInitialize.includes(id)) {
              const component = componentRegistry.get(id);
              
              // If deferring non-essential components, check if this one is essential
              if (deferNonEssential && !component.isEssential && phase !== 'critical') {
                deferredComponents.push(id);
              } else {
                componentsToInitialize.push(id);
              }
            }
          });
        }
      });
    } else {
      // If no phases specified, add all components except deferred ones
      Array.from(componentRegistry.keys()).forEach(id => {
        if (!componentsToInitialize.includes(id)) {
          const component = componentRegistry.get(id);
          
          if (deferNonEssential && !component.isEssential) {
            deferredComponents.push(id);
          } else {
            componentsToInitialize.push(id);
          }
        }
      });
    }
    
    console.log(`Initializing ${componentsToInitialize.length} components, deferring ${deferredComponents.length} non-essential components`);
    logInitEvent('system-components-selected', 'system', {
      initializing: componentsToInitialize.length,
      deferred: deferredComponents.length,
      accessibility: initState.accessibilityComponents.length,
      essential: initState.essentialComponents.length
    });
    
    // Initialize the selected components
    const initResults = await initializeAllComponents({
      componentIds: componentsToInitialize,
      useFallbacks,
      progressCallback: (progress, phase, detail) => {
        // Scale progress to 90% to leave room for deferred components
        const scaledProgress = deferredComponents.length > 0 ? progress * 0.9 : progress;
        
        if (progressCallback) {
          progressCallback(scaledProgress, phase, detail);
        }
      }
    });
    
    // Store deferred components for later initialization
    initState.deferredComponents = deferredComponents;
    
    // Return initialization results
    const results = {
      success: initResults.success,
      initialized: initResults.initialized,
      failed: initResults.failed,
      deferred: deferredComponents,
      duration: Date.now() - initState.startTime,
      usedFallbacks: initResults.usedFallbacks || []
    };
    
    console.log('ALEJO system initialization completed', results);
    logInitEvent('system-init-complete', 'system', results);
    publishEvent('system:initialized', results);
    
    return results;
  } catch (error) {
    console.error('ALEJO system initialization failed', error);
    logInitEvent('system-init-failed', 'system', { error: error.message, stack: error.stack });
    publishEvent('system:initialization:failed', { error: error.message });
    
    throw error;
  }
}

/**
 * Initialize deferred components that were skipped during initial system initialization
 * 
 * @param {Object} options - Deferred initialization options
 * @param {boolean} options.useFallbacks - Whether to use fallbacks for failed components
 * @param {Function} options.progressCallback - Callback for initialization progress
 * @returns {Promise<Object>} - Initialization results
 */
export async function initializeDeferredComponents(options = {}) {
  const {
    useFallbacks = true,
    progressCallback = null
  } = options;
  
  if (!initState.deferredComponents || initState.deferredComponents.length === 0) {
    console.log('No deferred components to initialize');
    return { success: true, initialized: [], failed: [], duration: 0 };
  }
  
  console.log(`Initializing ${initState.deferredComponents.length} deferred components`);
  logInitEvent('deferred-init-start', 'system', { count: initState.deferredComponents.length });
  
  try {
    // Track start time for this deferred initialization
    const startTime = Date.now();
    
    // Initialize the deferred components
    const initResults = await initializeAllComponents({
      componentIds: initState.deferredComponents,
      useFallbacks,
      progressCallback
    });
    
    // Clear the deferred components list
    const deferredComponents = [...initState.deferredComponents];
    initState.deferredComponents = [];
    
    // Return initialization results
    const results = {
      success: initResults.success,
      initialized: initResults.initialized,
      failed: initResults.failed,
      duration: Date.now() - startTime,
      usedFallbacks: initResults.usedFallbacks || []
    };
    
    console.log('Deferred components initialization completed', results);
    logInitEvent('deferred-init-complete', 'system', results);
    publishEvent('system:deferred:initialized', results);
    
    return results;
  } catch (error) {
    console.error('Deferred components initialization failed', error);
    logInitEvent('deferred-init-failed', 'system', { error: error.message, stack: error.stack });
    publishEvent('system:deferred:initialization:failed', { error: error.message });
    
    throw error;
  }
}

/**
 * Initialize all registered components in the correct order
 * 
 * @param {Object} options - Initialization options
 * @param {string[]} options.componentIds - Specific component IDs to initialize (all if not provided)
 * @param {boolean} options.useFallbacks - Whether to use fallbacks for failed components
 * @param {Function} options.progressCallback - Callback for initialization progress
 * @returns {Promise<Object>} - Initialization results
 */
export async function initializeAllComponents(options = {}) {
  const {
    componentIds = null,
    useFallbacks = true,
    progressCallback = null
  } = options;
  
  if (initState.isInitializing) {
    console.warn('Initialization already in progress');
    return;
  }
  
  // Reset initialization state
  initState.isInitializing = true;
  initState.startTime = Date.now();
  initState.completedComponents = [];
  initState.failedComponents = [];
  
  // Use provided component IDs or all registered components
  initState.pendingComponents = componentIds 
    ? componentIds.filter(id => componentRegistry.has(id))
    : Array.from(componentRegistry.keys());
  
  const totalComponents = initState.pendingComponents.length;
  console.log(`Starting initialization of ${totalComponents} components`);
  
  // Notify about initialization start
  publishEvent('system:initialization:start', { componentCount: totalComponents });
  logInitEvent('system-start', 'initialization-manager', { 
    componentCount: totalComponents,
    accessibilityCount: initState.accessibilityComponents.length,
    essentialCount: initState.essentialComponents.length,
    useFallbacks
  });
  
  // Report initial progress
  if (progressCallback) {
    progressCallback({
      phase: 'start',
      progress: 0,
      total: totalComponents,
      completed: 0,
      failed: 0
    });
  }
  
  try {
    // Sort components by priority and dependencies
    const initOrder = calculateInitializationOrder(initState.pendingComponents);
    
    // Group components that can be initialized in parallel
    const initGroups = createInitializationGroups(initOrder);
    
    // Initialize each group in sequence, with parallel initialization within groups
    const results = {};
    let completedCount = 0;
    
    for (let groupIndex = 0; groupIndex < initGroups.length; groupIndex++) {
      const group = initGroups[groupIndex];
      console.log(`Initializing group ${groupIndex + 1}/${initGroups.length} with ${group.length} components`);
      
      // Report group progress
      if (progressCallback) {
        progressCallback({
          phase: 'group',
          groupIndex,
          groupCount: initGroups.length,
          groupSize: group.length,
          progress: completedCount / totalComponents,
          total: totalComponents,
          completed: completedCount,
          failed: initState.failedComponents.length
        });
      }
      
      // Initialize all components in this group in parallel
      const groupPromises = group.map(componentId => {
        const component = componentRegistry.get(componentId);
        
        // Skip if component doesn't exist
        if (!component) {
          console.warn(`Component not found: ${componentId}`);
          return Promise.resolve({ componentId, success: false, error: new Error('Component not found') });
        }
        
        return initializeComponentWithFallback(component, { useFallbacks })
          .then(result => {
            completedCount++;
            results[componentId] = result;
            
            // Report component progress
            if (progressCallback) {
              progressCallback({
                phase: 'component',
                componentId,
                progress: completedCount / totalComponents,
                total: totalComponents,
                completed: completedCount,
                failed: initState.failedComponents.length
              });
            }
            
            return { componentId, success: true, result };
          })
          .catch(error => {
            results[componentId] = { error };
            initState.failedComponents.push(componentId);
            
            // Report component failure
            if (progressCallback) {
              progressCallback({
                phase: 'failure',
                componentId,
                error,
                progress: completedCount / totalComponents,
                total: totalComponents,
                completed: completedCount,
                failed: initState.failedComponents.length
              });
            }
            
            return { componentId, success: false, error };
          });
      });
      
      // Wait for all components in this group to complete
      const groupResults = await Promise.all(groupPromises);
      
      // Check if any essential components failed without fallbacks
      const essentialFailures = groupResults.filter(r => {
        if (!r.success) {
          const component = componentRegistry.get(r.componentId);
          // Only consider it a critical failure if it's essential and no fallback was used
          return component && component.isEssential && 
                 (!useFallbacks || !results[r.componentId]?.usedFallback);
        }
        return false;
      });
      
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
    
    // Final progress report
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        progress: 1,
        total: totalComponents,
        completed: initState.completedComponents.length,
        failed: initState.failedComponents.length,
        duration
      });
    }
    
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
    
    // Final error progress report
    if (progressCallback) {
      progressCallback({
        phase: 'error',
        error,
        progress: initState.completedComponents.length / totalComponents,
        total: totalComponents,
        completed: initState.completedComponents.length,
        failed: initState.failedComponents.length,
        duration
      });
    }
    
    publishEvent('system:initialization:failed', {
      duration,
      error,
      completedCount: initState.completedComponents.length,
      failedCount: initState.failedComponents.length
    });
    
    logInitEvent('system-failure', 'initialization-manager', { 
      duration,
      error: error.message,
      stack: error.stack
    });
    

/**
 * Initialize a single component
 * 
 * @param {Object} component - Component to initialize
 * @returns {Promise<Object>} - Initialization result
 */
async function initializeComponent(component) {
  const { id, initialize } = component;
  
  if (!initialize || typeof initialize !== 'function') {
    throw new Error(`Component ${id} does not have a valid initialize function`);
  }
  
  try {
    console.log(`Initializing component: ${id}`);
    logInitEvent('component-start', id);
    
    // Initialize the component
    const result = await initialize();
    
    // Mark as completed
    initState.completedComponents.push(id);
    initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
    
    logInitEvent('component-success', id, { result });
    console.log(`Component initialized successfully: ${id}`);
    
    return { success: true, result };
  } catch (error) {
    // Mark as failed
    initState.failedComponents.push(id);
    initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
    
    logInitEvent('component-error', id, { error: error.message, stack: error.stack });
    console.error(`Failed to initialize component: ${id}`, error);
    
    throw error;
  }
}

/**
 * Initialize a component with fallback support
 * 
 * @param {Object} component - Component to initialize
 * @param {Object} options - Options
 * @param {boolean} options.useFallbacks - Whether to use fallbacks
 * @returns {Promise<Object>} - Initialization result
 */
async function initializeComponentWithFallback(component, options = {}) {
  const { id } = component;
  const { useFallbacks = true } = options;
  
  // Track initialization start time
  componentRegistry.get(id).startTime = Date.now();
  componentRegistry.get(id).status = 'initializing';
  
  try {
    // Try to initialize the component normally first
    const result = await initializeComponent(component);
    
    // Update component registry with success status
    componentRegistry.get(id).status = 'initialized';
    componentRegistry.get(id).endTime = Date.now();
    componentRegistry.get(id).usingFallback = false;
    
    const duration = componentRegistry.get(id).endTime - componentRegistry.get(id).startTime;
    
    // Update initialization state
    initState.completedComponents.push(id);
    initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
    
    // Log success
    console.log(`Component initialized: ${id} in ${duration}ms`);
    publishEvent('system:component:initialized', { 
      componentId: id, 
      usingFallback: false,
      duration
    });
    
    logInitEvent('success', id, { 
      duration,
      result: result
    });
    
    return result;
  } catch (error) {
    // If fallbacks are disabled, mark as failed and re-throw the error
    if (!useFallbacks) {
      componentRegistry.get(id).status = 'failed';
      componentRegistry.get(id).endTime = Date.now();
      componentRegistry.get(id).error = error.message;
      
      const duration = componentRegistry.get(id).endTime - componentRegistry.get(id).startTime;
      
      logError({
        error,
        context: `initialization:${id}`,
        severity: component.isEssential ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR
      });
      
      initState.failedComponents.push(id);
      initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
      
      console.error(`Component initialization failed: ${id} after ${duration}ms`, error);
      publishEvent('system:component:failed', { 
        componentId: id, 
        error: error.message,
        duration
      });
      
      logInitEvent('failure', id, { 
        duration,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
    
    // Attempt fallback
    console.log(`Attempting fallback for component: ${id}`);
    logInitEvent('fallback-attempt', id, { error: error.message });
    
    try {
      // Import the fallback manager dynamically to avoid circular dependencies
      const fallbackManager = await import('./fallback-manager.js');
      const fallbackImpl = fallbackManager.getFallbackImplementation(id);
      
      // If no fallback is available, mark as failed and re-throw the original error
      if (!fallbackImpl) {
        console.log(`No fallback available for component: ${id}`);
        logInitEvent('fallback-missing', id);
        
        componentRegistry.get(id).status = 'failed';
        componentRegistry.get(id).endTime = Date.now();
        componentRegistry.get(id).error = error.message;
        
        const duration = componentRegistry.get(id).endTime - componentRegistry.get(id).startTime;
        
        logError({
          error,
          context: `initialization:${id}`,
          severity: component.isEssential ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR
        });
        
        initState.failedComponents.push(id);
        initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
        
        console.error(`Component initialization failed: ${id} after ${duration}ms`, error);
        publishEvent('system:component:failed', { 
          componentId: id, 
          error: error.message,
          duration
        });
        
        logInitEvent('failure', id, { 
          duration,
          error: error.message,
          stack: error.stack
        });
        
        throw error;
      }
      
      // Execute the fallback implementation
      console.log(`Executing fallback for component: ${id}`);
      logInitEvent('fallback-start', id, { 
        isStub: fallbackImpl.isStub,
        isAccessible: fallbackImpl.isAccessible,
        limitations: fallbackImpl.limitations
      });
      
      let fallbackResult;
      
      // Use the executeWithFallback function if available
      if (fallbackManager.executeWithFallback) {
        fallbackResult = await fallbackManager.executeWithFallback({
          primaryFunction: component.initialize,
          fallbackFunction: fallbackImpl.implementation,
          componentId: id,
          onProgress: (progress) => {
            logInitEvent('fallback-progress', id, { progress });
          }
        });
      } else {
        // Direct fallback execution if executeWithFallback is not available
        fallbackResult = await fallbackImpl.implementation();
      }
      
      // Mark as completed with fallback
      componentRegistry.get(id).status = 'fallback';
      componentRegistry.get(id).endTime = Date.now();
      componentRegistry.get(id).usingFallback = true;
      
      const duration = componentRegistry.get(id).endTime - componentRegistry.get(id).startTime;
      
      initState.completedComponents.push(id);
      initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
      
      logInitEvent('fallback-success', id, { result: fallbackResult });
      console.log(`Component initialized with fallback: ${id} in ${duration}ms`);
      
      // Publish fallback usage event
      publishEvent('system:fallback:used', {
        componentId: id,
        isStub: fallbackImpl.isStub,
        isAccessible: fallbackImpl.isAccessible,
        duration
      });
      
      return { 
        success: true, 
        usedFallback: true,
        fallbackType: fallbackImpl.isStub ? 'stub' : 'full',
        preservesAccessibility: fallbackImpl.isAccessible,
        result: fallbackResult
      };
    } catch (fallbackError) {
      // Both primary and fallback failed
      componentRegistry.get(id).status = 'failed';
      componentRegistry.get(id).endTime = Date.now();
      componentRegistry.get(id).error = `Primary: ${error.message}; Fallback: ${fallbackError.message}`;
      
      const duration = componentRegistry.get(id).endTime - componentRegistry.get(id).startTime;
      
      logInitEvent('fallback-error', id, { 
        primaryError: error.message, 
        fallbackError: fallbackError.message 
      });
      
      console.error(`Both primary and fallback initialization failed for component: ${id} after ${duration}ms`, {
        primaryError: error,
        fallbackError
      });
      
      initState.failedComponents.push(id);
      initState.pendingComponents = initState.pendingComponents.filter(c => c !== id);
      
      publishEvent('system:component:failed', { 
        componentId: id, 
        error: `Primary: ${error.message}; Fallback: ${fallbackError.message}`,
        duration,
        primaryError: error.message,
        fallbackError: fallbackError.message
      });
      
      // Throw a combined error
      const combinedError = new Error(
        `Component initialization failed with both primary and fallback methods: ${fallbackError.message}`
      );
      combinedError.primaryError = error;
      combinedError.fallbackError = fallbackError;
      throw combinedError;
    }
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
  // Create a detailed component status map
  const componentStatus = {};
  
  for (const [id, component] of componentRegistry.entries()) {
    componentStatus[id] = {
      id,
      status: component.status,
      progress: component.progress || 0,
      phase: component.phase || 'unknown',
      startTime: component.startTime || null,
      endTime: component.endTime || null,
      dependencies: component.dependencies || [],
      isEssential: component.isEssential || false,
      accessibility: component.accessibility || false,
      usingFallback: component.usingFallback || false,
      error: component.error || null
    };
  }
  
  return {
    ...initState,
    componentCount: componentRegistry.size,
    componentStatus,
    accessibilityComponents: initState.accessibilityComponents.map(id => componentStatus[id]),
    essentialComponents: initState.essentialComponents.map(id => componentStatus[id])
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
  // Reset the initialization state and component registry
  // Useful for testing or restarting the system
  initState.isInitializing = false;
  initState.startTime = null;
  initState.endTime = null;
  initState.completedComponents = [];
  initState.failedComponents = [];
  initState.pendingComponents = [];
  
  // Don't clear accessibility and essential components lists
  // as they're still useful for the next initialization
  
  // Clear component registry
  componentRegistry.clear();
  
  console.log('Initialization state reset');
}

/**
 * Initialize the system with progressive loading and fallback support
 * 
 * @param {Object} options - Initialization options
 * @param {boolean} options.deferNonEssential - Whether to defer non-essential components
 * @param {boolean} options.prioritizeAccessibility - Whether to prioritize accessibility components
 * @param {boolean} options.useFallbacks - Whether to use fallbacks for failed components
 * @param {Function} options.progressCallback - Callback for initialization progress
 * @returns {Promise<Object>} - Initialization results
 */
export async function initializeSystem(options = {}) {
  const {
    deferNonEssential = false,
    prioritizeAccessibility = true,
    useFallbacks = true,
    progressCallback = null
  } = options;
  
  // Log initialization start
  logInitEvent('system-init', 'initialization-manager', { 
    options,
    componentCount: componentRegistry.size
  });
  
  try {
    // Get the current loading sequence state
    const loadingState = await import('./progressive-loading-manager.js')
      .then(module => module.getLoadingSequenceState())
      .catch(error => {
        console.error('Failed to import progressive loading manager:', error);
        return null;
      });
    
    // If progressive loading is active, respect its component ordering
    if (loadingState && loadingState.currentPhase) {
      console.log(`Progressive loading active, current phase: ${loadingState.currentPhase}`);
      
      // Initialize only components that are part of completed phases or current phase
      const allowedPhases = [...loadingState.completedPhases, loadingState.currentPhase];
      
      // Filter components to initialize based on progressive loading state
      const componentsToInitialize = Array.from(componentRegistry.entries())
        .filter(([id, component]) => {
          // Always initialize accessibility components if prioritizeAccessibility is true
          if (prioritizeAccessibility && component.accessibility) {
            return true;
          }
          
          // Always initialize essential components
          if (component.isEssential) {
            return true;
          }
          
          // Check if component is in an allowed phase
          const componentPhase = loadingState.componentPhases?.[id];
          return componentPhase && allowedPhases.includes(componentPhase);
        })
        .map(([id]) => id);
      
      console.log(`Initializing ${componentsToInitialize.length} components based on progressive loading state`);
      
      // Initialize the filtered components
      return initializeAllComponents({
        componentIds: componentsToInitialize,
        useFallbacks,
        progressCallback
      });
    } else {
      // Progressive loading not active, initialize based on options
      let componentsToInitialize = Array.from(componentRegistry.keys());
      
      // Filter out non-essential components if deferring
      if (deferNonEssential) {
        componentsToInitialize = componentsToInitialize.filter(id => {
          const component = componentRegistry.get(id);
          return component.isEssential || 
                 (prioritizeAccessibility && component.accessibility);
        });
      }
      
      console.log(`Initializing ${componentsToInitialize.length} components`);
      
      // Initialize the filtered components
      return initializeAllComponents({
        componentIds: componentsToInitialize,
        useFallbacks,
        progressCallback
      });
    }
  } catch (error) {
    console.error('Initialization system error:', error);
    logInitEvent('system-error', 'initialization-manager', { 
      error: error.message,
      stack: error.stack
    });
    
    // Re-throw the error
    throw error;
  }
}

/**
 * Reset the initialization state
 * This is useful for testing, development, and recovery scenarios
 * 
 * @param {Object} options - Reset options
 * @param {boolean} options.clearRegistry - Whether to clear the component registry
 * @param {boolean} options.publishEvent - Whether to publish a reset event
 * @returns {Object} - Reset results
 */
export function resetInitialization(options = {}) {
  const {
    clearRegistry = false,
    publishEvent: shouldPublish = true
  } = options;
  
  console.log('Resetting initialization state');
  logInitEvent('reset', 'system', options);
  
  // Store current state for reporting
  const previousState = {
    isInitializing: initState.isInitializing,
    completedCount: initState.completedComponents.length,
    failedCount: initState.failedComponents.length,
    pendingCount: initState.pendingComponents.length,
    deferredCount: initState.deferredComponents ? initState.deferredComponents.length : 0
  };
  
  // Reset initialization state
  initState.isInitializing = false;
  initState.startTime = null;
  initState.completedComponents = [];
  initState.failedComponents = [];
  initState.pendingComponents = [];
  initState.deferredComponents = [];
  
  // Optionally clear component registry
  if (clearRegistry) {
    componentRegistry.clear();
    initState.accessibilityComponents = [];
    initState.essentialComponents = [];
  } else {
    // Just reset component status
    Array.from(componentRegistry.keys()).forEach(id => {
      const component = componentRegistry.get(id);
      component.status = 'registered';
      component.startTime = null;
      component.endTime = null;
      component.error = null;
      component.usingFallback = false;
    });
  }
  
  // Publish reset event
  if (shouldPublish) {
    publishEvent('system:initialization:reset', {
      previousState,
      clearedRegistry: clearRegistry
    });
  }
  
  console.log('Initialization state reset complete');
  return {
    success: true,
    previousState,
    clearedRegistry: clearRegistry
  };
}
