/**
 * @fileoverview Example integration of the Resource Allocation Manager with the Initialization Coordinator
 * 
 * This module demonstrates how to:
 * 1. Register components with dependencies
 * 2. Set up progressive loading sequences
 * 3. Handle fallbacks for component initialization failures
 * 4. Monitor the initialization process
 */

import { ResourceAllocationManager } from './resource-allocation-manager.js';
import { InitializationCoordinator, INIT_STATE } from './initialization-coordinator.js';
import { Logger } from '../core/logger.js';
import { EventBus } from '../core/event-bus.js';

// Create a logger for this module
const logger = new Logger('ResourceInitialization');
const eventBus = EventBus.getInstance();

/**
 * Initialize the resource management system with progressive loading
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} - Initialized components
 */
export async function initializeResourceSystem(options = {}) {
  logger.info('Starting resource system initialization');
  
  // Create the initialization coordinator
  const coordinator = new InitializationCoordinator({
    componentTimeout: options.componentTimeout || 10000,
    maxRetries: options.maxRetries || 2,
    detailedLogging: options.detailedLogging !== false
  });
  
  // Register the resource allocation manager as a core component
  coordinator.registerComponent('resourceManager', async () => {
    logger.debug('Initializing resource allocation manager');
    const manager = new ResourceAllocationManager();
    return manager.initialize();
  }, {
    dependencies: [], // No dependencies for the resource manager
    isEssential: true, // This is an essential component
    fallbackFunction: async () => {
      logger.warn('Using fallback resource manager');
      // The resource manager's initialize method already returns a fallback if it fails
      const manager = new ResourceAllocationManager();
      try {
        return await manager.initialize();
      } catch (error) {
        // This should not happen as the manager should return a fallback,
        // but we handle it just in case
        logger.error('Both main and internal fallback resource managers failed', error);
        throw error;
      }
    }
  });
  
  // Register the performance dashboard component
  coordinator.registerComponent('performanceDashboard', async (dependencies) => {
    logger.debug('Initializing performance dashboard');
    
    // Import the dashboard dynamically to avoid loading it if not needed
    const { PerformanceDashboard } = await import('./dashboard/index.js');
    
    // Create and initialize the dashboard with the resource manager
    const dashboard = new PerformanceDashboard({
      resourceManager: dependencies.resourceManager
    });
    
    return dashboard.initialize();
  }, {
    dependencies: ['resourceManager'], // Depends on the resource manager
    isEssential: false // Dashboard is not essential for system operation
  });
  
  // Register the resource thresholds UI component
  coordinator.registerComponent('resourceThresholds', async (dependencies) => {
    logger.debug('Initializing resource thresholds UI');
    
    // Import the thresholds component dynamically
    const { ResourceThresholds } = await import('./dashboard/index.js');
    
    // Create and initialize the thresholds UI with the resource manager
    const thresholds = ResourceThresholds.createThresholds({
      resourceManager: dependencies.resourceManager,
      container: options.thresholdsContainer || document.getElementById('resource-thresholds')
    });
    
    return thresholds.initialize();
  }, {
    dependencies: ['resourceManager'], // Depends on the resource manager
    isEssential: false // Thresholds UI is not essential
  });
  
  // Register any additional components here...
  
  // Set up event listeners for initialization events
  if (options.detailedLogging !== false) {
    _setupInitializationEventListeners();
  }
  
  try {
    // Start the initialization process
    const initializedComponents = await coordinator.initialize();
    
    logger.info('Resource system initialization complete');
    
    // Return the coordinator and initialized components
    return {
      coordinator,
      components: initializedComponents
    };
  } catch (error) {
    logger.error('Resource system initialization failed', error);
    
    // Check if we have at least the resource manager (even as a fallback)
    const resourceManager = coordinator.getComponent('resourceManager');
    if (resourceManager) {
      logger.info('Resource manager available despite initialization failure');
      
      // Return partial initialization
      return {
        coordinator,
        components: new Map([['resourceManager', resourceManager]]),
        partial: true,
        error
      };
    }
    
    throw error;
  }
}

/**
 * Set up event listeners for initialization events
 * @private
 */
function _setupInitializationEventListeners() {
  // Listen for initialization start
  eventBus.on('initialization:start', (data) => {
    logger.info(`Initialization started with ${data.totalComponents} components`);
  });
  
  // Listen for component initialization
  eventBus.on('component:initialized', (data) => {
    logger.info(`Component ${data.id} initialized in ${data.duration}ms`);
  });
  
  // Listen for component fallback
  eventBus.on('component:fallback', (data) => {
    logger.warn(`Component ${data.id} using fallback implementation`);
  });
  
  // Listen for component failure
  eventBus.on('component:failed', (data) => {
    logger.error(`Component ${data.id} failed: ${data.error}`);
  });
  
  // Listen for initialization completion
  eventBus.on('initialization:complete', (data) => {
    const { stats } = data;
    logger.info(`Initialization complete in ${data.duration}ms. ` +
      `Success: ${stats.initializedComponents}, ` +
      `Fallbacks: ${stats.fallbackComponents}, ` +
      `Failed: ${stats.failedComponents}`);
  });
  
  // Listen for initialization failure
  eventBus.on('initialization:failed', (data) => {
    logger.error(`Initialization failed after ${data.duration}ms: ${data.error}`);
  });
}

/**
 * Shutdown the resource system and all components
 * @param {InitializationCoordinator} coordinator - The initialization coordinator
 * @returns {Promise<void>}
 */
export async function shutdownResourceSystem(coordinator) {
  if (!coordinator) {
    logger.warn('No coordinator provided for shutdown');
    return;
  }
  
  logger.info('Shutting down resource system');
  
  try {
    await coordinator.shutdown();
    logger.info('Resource system shutdown complete');
  } catch (error) {
    logger.error('Error during resource system shutdown', error);
    throw error;
  }
}

/**
 * Get a component status report
 * @param {InitializationCoordinator} coordinator - The initialization coordinator
 * @returns {Object} - Status report
 */
export function getResourceSystemStatus(coordinator) {
  if (!coordinator) {
    return { error: 'No coordinator available' };
  }
  
  const status = coordinator.getStatus();
  const resourceManager = coordinator.getComponent('resourceManager');
  
  // Add resource manager specific information if available
  if (resourceManager) {
    status.resources = resourceManager.getResourceUsage();
    status.currentMode = resourceManager.getCurrentMode();
  }
  
  return status;
}

/**
 * Create a demo page for testing the progressive loading sequence
 * @param {HTMLElement} container - Container element for the demo
 * @returns {Promise<Object>} - Initialized components
 */
export async function createProgressiveLoadingDemo(container) {
  if (!container) {
    throw new Error('Container element is required');
  }
  
  // Create UI elements
  const statusElement = document.createElement('div');
  statusElement.className = 'initialization-status';
  container.appendChild(statusElement);
  
  const componentsElement = document.createElement('div');
  componentsElement.className = 'component-status';
  container.appendChild(componentsElement);
  
  const thresholdsContainer = document.createElement('div');
  thresholdsContainer.id = 'resource-thresholds';
  thresholdsContainer.className = 'thresholds-container';
  container.appendChild(thresholdsContainer);
  
  // Update status display
  const updateStatus = (message, isError = false) => {
    const statusItem = document.createElement('div');
    statusItem.className = isError ? 'status-item error' : 'status-item';
    statusItem.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    statusElement.appendChild(statusItem);
    statusElement.scrollTop = statusElement.scrollHeight;
  };
  
  // Update component status display
  const updateComponentStatus = (components) => {
    componentsElement.innerHTML = '';
    
    for (const [id, status] of Object.entries(components)) {
      const componentItem = document.createElement('div');
      componentItem.className = `component-item ${status.state}`;
      
      const header = document.createElement('h3');
      header.textContent = id;
      componentItem.appendChild(header);
      
      const stateElement = document.createElement('div');
      stateElement.className = 'component-state';
      stateElement.textContent = `State: ${status.state}`;
      componentItem.appendChild(stateElement);
      
      if (status.duration) {
        const durationElement = document.createElement('div');
        durationElement.textContent = `Duration: ${status.duration}ms`;
        componentItem.appendChild(durationElement);
      }
      
      if (status.error) {
        const errorElement = document.createElement('div');
        errorElement.className = 'component-error';
        errorElement.textContent = `Error: ${status.error}`;
        componentItem.appendChild(errorElement);
      }
      
      componentsElement.appendChild(componentItem);
    }
  };
  
  // Listen for initialization events
  const eventHandlers = {
    'initialization:start': (data) => {
      updateStatus(`Initialization started with ${data.totalComponents} components`);
    },
    'component:initialized': (data) => {
      updateStatus(`Component ${data.id} initialized in ${data.duration}ms`);
    },
    'component:fallback': (data) => {
      updateStatus(`Component ${data.id} using fallback implementation`, true);
    },
    'component:failed': (data) => {
      updateStatus(`Component ${data.id} failed: ${data.error}`, true);
    },
    'initialization:complete': (data) => {
      updateStatus(`Initialization complete in ${data.duration}ms`);
      updateComponentStatus(data.components);
    },
    'initialization:failed': (data) => {
      updateStatus(`Initialization failed: ${data.error}`, true);
      updateComponentStatus(data.components);
    }
  };
  
  // Register event handlers
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    eventBus.on(event, handler);
  });
  
  // Initialize the resource system
  updateStatus('Starting resource system initialization...');
  
  try {
    const result = await initializeResourceSystem({
      thresholdsContainer,
      detailedLogging: true
    });
    
    updateStatus('Resource system initialization complete');
    
    // Clean up event handlers when the container is removed
    const cleanup = () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });
      
      // Shutdown the system
      shutdownResourceSystem(result.coordinator).catch(error => {
        console.error('Error during shutdown:', error);
      });
    };
    
    // Return the result and cleanup function
    return {
      ...result,
      cleanup
    };
  } catch (error) {
    updateStatus(`Initialization failed: ${error.message}`, true);
    throw error;
  }
}
