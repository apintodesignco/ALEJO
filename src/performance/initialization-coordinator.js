/**
 * @fileoverview Initialization Coordinator for ALEJO's component loading sequence
 * 
 * This module provides a robust initialization system that:
 * 1. Manages dependencies between components
 * 2. Implements progressive loading with stages
 * 3. Provides fallback mechanisms for failed components
 * 4. Logs detailed initialization information
 * 5. Handles timeout and retry logic
 */

import { EventBus } from '../core/event-bus.js';
import { Logger } from '../core/logger.js';
import { ConfigManager } from '../core/config-manager.js';

// Default configuration
const DEFAULT_CONFIG = {
  // Maximum time to wait for a component to initialize (ms)
  componentTimeout: 5000,
  // Maximum retries for failed components
  maxRetries: 2,
  // Delay between retries (ms)
  retryDelay: 1000,
  // Whether to continue if non-essential components fail
  continueOnNonEssentialFailure: true,
  // Whether to use fallbacks for failed essential components
  useFallbacksForEssentialComponents: true,
  // Whether to log detailed initialization information
  detailedLogging: true
};

/**
 * Component initialization states
 * @enum {string}
 */
const INIT_STATE = {
  PENDING: 'pending',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  FAILED: 'failed',
  FALLBACK: 'fallback'
};

/**
 * Manages the initialization sequence of components with dependencies
 */
class InitializationCoordinator {
  /**
   * Create a new initialization coordinator
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.logger = new Logger('InitializationCoordinator');
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    
    // Load configuration
    this.config = {
      ...DEFAULT_CONFIG,
      ...options
    };
    
    // Component registry
    this.components = new Map();
    
    // Initialization statistics
    this.stats = {
      startTime: null,
      endTime: null,
      totalComponents: 0,
      initializedComponents: 0,
      failedComponents: 0,
      fallbackComponents: 0,
      retries: 0
    };
    
    // Bind methods
    this._handleComponentInitialized = this._handleComponentInitialized.bind(this);
    this._handleComponentFailed = this._handleComponentFailed.bind(this);
    
    // Register event listeners
    this.eventBus.on('component:initialized', this._handleComponentInitialized);
    this.eventBus.on('component:failed', this._handleComponentFailed);
  }
  
  /**
   * Register a component for initialization
   * @param {string} id - Unique component identifier
   * @param {Function} initFunction - Async function that initializes the component
   * @param {Object} options - Component options
   * @param {string[]} options.dependencies - IDs of components this depends on
   * @param {boolean} options.isEssential - Whether this component is essential
   * @param {Function} options.fallbackFunction - Function to create fallback if init fails
   * @returns {boolean} - Whether registration was successful
   */
  registerComponent(id, initFunction, options = {}) {
    if (!id || typeof id !== 'string') {
      this.logger.error('Invalid component ID');
      return false;
    }
    
    if (typeof initFunction !== 'function') {
      this.logger.error(`Invalid initialization function for component ${id}`);
      return false;
    }
    
    if (this.components.has(id)) {
      this.logger.warn(`Component ${id} is already registered`);
      return false;
    }
    
    const componentInfo = {
      id,
      initFunction,
      dependencies: options.dependencies || [],
      isEssential: options.isEssential || false,
      fallbackFunction: options.fallbackFunction || null,
      state: INIT_STATE.PENDING,
      instance: null,
      retries: 0,
      error: null,
      startTime: null,
      endTime: null,
      timeoutId: null
    };
    
    this.components.set(id, componentInfo);
    this.stats.totalComponents++;
    
    this.logger.debug(`Registered component: ${id} (dependencies: ${componentInfo.dependencies.join(', ') || 'none'})`);
    
    return true;
  }
  
  /**
   * Start the initialization sequence
   * @returns {Promise<Map>} - Map of initialized components
   */
  async initialize() {
    this.stats.startTime = Date.now();
    this.logger.info('Starting progressive initialization sequence');
    
    // Emit initialization start event
    this.eventBus.emit('initialization:start', {
      timestamp: new Date().toISOString(),
      totalComponents: this.stats.totalComponents
    });
    
    try {
      // Validate the dependency graph
      this._validateDependencies();
      
      // Get components with no dependencies to start with
      const rootComponents = this._getRootComponents();
      
      if (rootComponents.length === 0) {
        throw new Error('No root components found. Circular dependency or no components registered.');
      }
      
      // Start initializing root components
      this.logger.debug(`Starting with ${rootComponents.length} root components: ${rootComponents.join(', ')}`);
      await Promise.all(rootComponents.map(id => this._initializeComponent(id)));
      
      // Wait for all components to initialize
      await this._waitForCompletion();
      
      // Check if all essential components are initialized
      const failedEssentials = this._getFailedEssentialComponents();
      if (failedEssentials.length > 0) {
        throw new Error(`Failed to initialize essential components: ${failedEssentials.join(', ')}`);
      }
      
      // Finalize initialization
      this.stats.endTime = Date.now();
      const duration = this.stats.endTime - this.stats.startTime;
      
      this.logger.info(`Initialization complete in ${duration}ms. ` +
        `Initialized: ${this.stats.initializedComponents}, ` +
        `Fallbacks: ${this.stats.fallbackComponents}, ` +
        `Failed: ${this.stats.failedComponents}`);
      
      // Emit initialization complete event
      this.eventBus.emit('initialization:complete', {
        timestamp: new Date().toISOString(),
        duration,
        stats: { ...this.stats },
        components: this._getComponentSummary()
      });
      
      // Return map of initialized components
      return this._getInitializedComponents();
    } catch (error) {
      this.stats.endTime = Date.now();
      const duration = this.stats.endTime - this.stats.startTime;
      
      this.logger.error(`Initialization failed after ${duration}ms: ${error.message}`, error);
      
      // Emit initialization failed event
      this.eventBus.emit('initialization:failed', {
        timestamp: new Date().toISOString(),
        duration,
        error: error.message,
        stats: { ...this.stats },
        components: this._getComponentSummary()
      });
      
      throw error;
    }
  }
  
  /**
   * Shutdown all initialized components
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.logger.info('Shutting down components');
    
    const shutdownPromises = [];
    
    // Shutdown in reverse dependency order
    const sortedComponents = this._getComponentsInDependencyOrder().reverse();
    
    for (const id of sortedComponents) {
      const component = this.components.get(id);
      
      if (component && component.instance && 
          component.state === INIT_STATE.INITIALIZED &&
          typeof component.instance.shutdown === 'function') {
        
        this.logger.debug(`Shutting down component: ${id}`);
        
        try {
          shutdownPromises.push(
            Promise.resolve(component.instance.shutdown())
              .catch(error => {
                this.logger.warn(`Error shutting down component ${id}:`, error);
              })
          );
        } catch (error) {
          this.logger.warn(`Error initiating shutdown for component ${id}:`, error);
        }
      }
    }
    
    await Promise.all(shutdownPromises);
    
    // Clear event listeners
    this.eventBus.off('component:initialized', this._handleComponentInitialized);
    this.eventBus.off('component:failed', this._handleComponentFailed);
    
    this.logger.info('All components shut down');
    
    // Emit shutdown complete event
    this.eventBus.emit('initialization:shutdown', {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get a component instance by ID
   * @param {string} id - Component ID
   * @returns {Object|null} - Component instance or null if not found/initialized
   */
  getComponent(id) {
    const component = this.components.get(id);
    if (!component || component.state !== INIT_STATE.INITIALIZED) {
      return null;
    }
    return component.instance;
  }
  
  /**
   * Get initialization status for all components
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      stats: { ...this.stats },
      components: this._getComponentSummary()
    };
  }
  
  /**
   * Initialize a specific component
   * @private
   * @param {string} id - Component ID
   * @returns {Promise<Object>} - Initialized component instance
   */
  async _initializeComponent(id) {
    const component = this.components.get(id);
    
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    
    if (component.state === INIT_STATE.INITIALIZED) {
      return component.instance;
    }
    
    if (component.state === INIT_STATE.INITIALIZING) {
      // Wait for the component to finish initializing
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const updatedComponent = this.components.get(id);
          if (updatedComponent.state === INIT_STATE.INITIALIZED) {
            clearInterval(checkInterval);
            resolve(updatedComponent.instance);
          } else if (updatedComponent.state === INIT_STATE.FAILED) {
            clearInterval(checkInterval);
            reject(new Error(`Component ${id} failed to initialize: ${updatedComponent.error}`));
          }
        }, 100);
      });
    }
    
    // Check if all dependencies are initialized
    for (const depId of component.dependencies) {
      const dependency = this.components.get(depId);
      
      if (!dependency) {
        throw new Error(`Dependency ${depId} for component ${id} not found`);
      }
      
      if (dependency.state !== INIT_STATE.INITIALIZED) {
        // Initialize the dependency first
        try {
          await this._initializeComponent(depId);
        } catch (error) {
          // If a dependency fails, this component can't initialize
          this._markComponentFailed(id, `Dependency ${depId} failed: ${error.message}`);
          throw new Error(`Cannot initialize ${id}: Dependency ${depId} failed`);
        }
      }
    }
    
    // Start initializing this component
    component.state = INIT_STATE.INITIALIZING;
    component.startTime = Date.now();
    
    this.logger.debug(`Initializing component: ${id}`);
    
    // Set timeout for initialization
    component.timeoutId = setTimeout(() => {
      if (component.state === INIT_STATE.INITIALIZING) {
        this._handleTimeout(id);
      }
    }, this.config.componentTimeout);
    
    try {
      // Get dependency instances
      const dependencies = {};
      for (const depId of component.dependencies) {
        dependencies[depId] = this.components.get(depId).instance;
      }
      
      // Initialize the component
      component.instance = await component.initFunction(dependencies);
      
      // Clear timeout
      clearTimeout(component.timeoutId);
      component.timeoutId = null;
      
      // Mark as initialized
      component.state = INIT_STATE.INITIALIZED;
      component.endTime = Date.now();
      this.stats.initializedComponents++;
      
      const duration = component.endTime - component.startTime;
      this.logger.debug(`Component ${id} initialized in ${duration}ms`);
      
      // Emit event
      this.eventBus.emit('component:initialized', {
        id,
        duration,
        timestamp: new Date().toISOString()
      });
      
      // Check if any components are waiting on this one
      this._initializeDependentComponents(id);
      
      return component.instance;
    } catch (error) {
      // Clear timeout
      clearTimeout(component.timeoutId);
      component.timeoutId = null;
      
      // Handle initialization failure
      return this._handleInitFailure(id, error);
    }
  }
  
  /**
   * Handle component initialization timeout
   * @private
   * @param {string} id - Component ID
   */
  _handleTimeout(id) {
    const component = this.components.get(id);
    
    if (!component || component.state !== INIT_STATE.INITIALIZING) {
      return;
    }
    
    this.logger.warn(`Component ${id} initialization timed out after ${this.config.componentTimeout}ms`);
    
    // Handle as a failure
    this._handleInitFailure(id, new Error(`Initialization timed out after ${this.config.componentTimeout}ms`));
  }
  
  /**
   * Handle component initialization failure
   * @private
   * @param {string} id - Component ID
   * @param {Error} error - Error that occurred
   * @returns {Promise<Object|null>} - Fallback instance or null
   */
  async _handleInitFailure(id, error) {
    const component = this.components.get(id);
    
    if (!component) {
      return null;
    }
    
    // Check if we should retry
    if (component.retries < this.config.maxRetries) {
      component.retries++;
      this.stats.retries++;
      
      this.logger.warn(`Retrying component ${id} initialization (attempt ${component.retries}/${this.config.maxRetries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      
      // Reset state to pending
      component.state = INIT_STATE.PENDING;
      
      // Try again
      return this._initializeComponent(id);
    }
    
    // Mark as failed
    this._markComponentFailed(id, error.message);
    
    // Check if we should use a fallback
    if (component.fallbackFunction && 
        (component.isEssential && this.config.useFallbacksForEssentialComponents)) {
      
      this.logger.warn(`Using fallback for component ${id}`);
      
      try {
        // Create fallback instance
        component.instance = await component.fallbackFunction();
        component.state = INIT_STATE.FALLBACK;
        component.endTime = Date.now();
        this.stats.fallbackComponents++;
        
        // Emit fallback event
        this.eventBus.emit('component:fallback', {
          id,
          timestamp: new Date().toISOString()
        });
        
        // Check if any components are waiting on this one
        this._initializeDependentComponents(id);
        
        return component.instance;
      } catch (fallbackError) {
        this.logger.error(`Fallback for component ${id} also failed:`, fallbackError);
        // Keep component in failed state
      }
    }
    
    // If this is an essential component and we don't have a fallback,
    // we can't continue the initialization process
    if (component.isEssential && !this.config.continueOnNonEssentialFailure) {
      throw new Error(`Essential component ${id} failed to initialize: ${error.message}`);
    }
    
    return null;
  }
  
  /**
   * Mark a component as failed
   * @private
   * @param {string} id - Component ID
   * @param {string} errorMessage - Error message
   */
  _markComponentFailed(id, errorMessage) {
    const component = this.components.get(id);
    
    if (!component) {
      return;
    }
    
    component.state = INIT_STATE.FAILED;
    component.error = errorMessage;
    component.endTime = Date.now();
    this.stats.failedComponents++;
    
    const duration = component.endTime - component.startTime;
    this.logger.error(`Component ${id} failed after ${duration}ms: ${errorMessage}`);
    
    // Emit event
    this.eventBus.emit('component:failed', {
      id,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Initialize components that depend on a specific component
   * @private
   * @param {string} id - Component ID that was just initialized
   */
  _initializeDependentComponents(id) {
    // Find components that depend on this one
    for (const [componentId, component] of this.components.entries()) {
      if (component.state === INIT_STATE.PENDING && 
          component.dependencies.includes(id)) {
        
        // Check if all dependencies are now initialized
        const allDepsInitialized = component.dependencies.every(depId => {
          const dep = this.components.get(depId);
          return dep && (dep.state === INIT_STATE.INITIALIZED || dep.state === INIT_STATE.FALLBACK);
        });
        
        if (allDepsInitialized) {
          // Start initializing this component
          this._initializeComponent(componentId).catch(error => {
            this.logger.error(`Failed to initialize dependent component ${componentId}:`, error);
          });
        }
      }
    }
  }
  
  /**
   * Wait for all components to finish initializing
   * @private
   * @returns {Promise<void>}
   */
  async _waitForCompletion() {
    // Check if all components are already in a final state
    if (this._allComponentsFinalized()) {
      return;
    }
    
    // Wait for all components to finish
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this._allComponentsFinalized()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
  
  /**
   * Check if all components are in a final state
   * @private
   * @returns {boolean}
   */
  _allComponentsFinalized() {
    for (const component of this.components.values()) {
      if (component.state === INIT_STATE.PENDING || 
          component.state === INIT_STATE.INITIALIZING) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get components with no dependencies
   * @private
   * @returns {string[]} - Array of component IDs
   */
  _getRootComponents() {
    const roots = [];
    
    for (const [id, component] of this.components.entries()) {
      if (component.dependencies.length === 0) {
        roots.push(id);
      }
    }
    
    return roots;
  }
  
  /**
   * Get components that failed and are marked as essential
   * @private
   * @returns {string[]} - Array of component IDs
   */
  _getFailedEssentialComponents() {
    const failed = [];
    
    for (const [id, component] of this.components.entries()) {
      if (component.isEssential && component.state === INIT_STATE.FAILED) {
        failed.push(id);
      }
    }
    
    return failed;
  }
  
  /**
   * Get all initialized components
   * @private
   * @returns {Map<string, Object>} - Map of component ID to instance
   */
  _getInitializedComponents() {
    const initialized = new Map();
    
    for (const [id, component] of this.components.entries()) {
      if (component.state === INIT_STATE.INITIALIZED || 
          component.state === INIT_STATE.FALLBACK) {
        initialized.set(id, component.instance);
      }
    }
    
    return initialized;
  }
  
  /**
   * Get component summary for reporting
   * @private
   * @returns {Object} - Component summary
   */
  _getComponentSummary() {
    const summary = {};
    
    for (const [id, component] of this.components.entries()) {
      summary[id] = {
        state: component.state,
        isEssential: component.isEssential,
        dependencies: component.dependencies,
        retries: component.retries,
        error: component.error,
        startTime: component.startTime,
        endTime: component.endTime,
        duration: component.endTime ? component.endTime - component.startTime : null
      };
    }
    
    return summary;
  }
  
  /**
   * Validate the dependency graph for cycles
   * @private
   * @throws {Error} If a cycle is detected
   */
  _validateDependencies() {
    // Check for unknown dependencies
    for (const [id, component] of this.components.entries()) {
      for (const depId of component.dependencies) {
        if (!this.components.has(depId)) {
          throw new Error(`Component ${id} depends on unknown component ${depId}`);
        }
      }
    }
    
    // Check for cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    
    const detectCycle = (id) => {
      visited.add(id);
      recursionStack.add(id);
      
      const component = this.components.get(id);
      for (const depId of component.dependencies) {
        if (!visited.has(depId)) {
          if (detectCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          throw new Error(`Circular dependency detected: ${id} -> ${depId}`);
        }
      }
      
      recursionStack.delete(id);
      return false;
    };
    
    // Start DFS from each unvisited node
    for (const id of this.components.keys()) {
      if (!visited.has(id)) {
        detectCycle(id);
      }
    }
  }
  
  /**
   * Get components in dependency order (topological sort)
   * @private
   * @returns {string[]} - Array of component IDs in dependency order
   */
  _getComponentsInDependencyOrder() {
    const visited = new Set();
    const result = [];
    
    const visit = (id) => {
      if (visited.has(id)) {
        return;
      }
      
      visited.add(id);
      
      const component = this.components.get(id);
      for (const depId of component.dependencies) {
        visit(depId);
      }
      
      result.push(id);
    };
    
    // Visit all components
    for (const id of this.components.keys()) {
      visit(id);
    }
    
    return result;
  }
  
  /**
   * Event handler for component:initialized event
   * @private
   * @param {Object} data - Event data
   */
  _handleComponentInitialized(data) {
    if (this.config.detailedLogging) {
      this.logger.info(`Component ${data.id} initialized`);
    }
  }
  
  /**
   * Event handler for component:failed event
   * @private
   * @param {Object} data - Event data
   */
  _handleComponentFailed(data) {
    if (this.config.detailedLogging) {
      this.logger.warn(`Component ${data.id} failed: ${data.error}`);
    }
  }
}

export { InitializationCoordinator, INIT_STATE };
