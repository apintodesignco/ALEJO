/**
 * ALEJO Core Module
 * 
 * This module contains core functionality that is needed right away.
 * It's separated from other modules for better code organization and performance.
 * 
 * Features:
 * - Robust initialization with fallback mechanisms
 * - Centralized error handling
 * - System monitoring dashboard
 * - Component dependency management
 * - Accessibility-first prioritization
 */

import { setupEventListeners } from './events.js';
import { initializeConfig } from './config.js';
import { 
  initializeWithFallback, 
  logError, 
  ErrorSeverity,
  getComponentStatus,
  hasEssentialFailures
} from './system/error-handler.js';
import {
  registerComponent,
  getInitializationStatus,
  isInitializationSuccessful
} from './system/initialization-manager.js';
import {
  startInitializationSequence,
  getInitializationSequenceState,
  resetInitializationSequence
} from './system/initialization-sequence-integrator.js';
import monitoringDashboard from './system/monitoring-dashboard.js';
import { publishEvent } from './neural-architecture/neural-event-bus.js';

// Import core components for registration
import { getResourceAllocationManager, createFallbackResourceManager, RESOURCE_MODES } from '../performance/resource-allocation-manager.js';
import accessibilityIntegration, { createFallbackAccessibilityIntegration } from '../personalization/accessibility/accessibility-integration.js';

// Track initialization state
let isInitialized = false;
let initializationError = null;

/**
 * Initialize the core functionality of ALEJO with robust error handling
 * 
 * @param {Object} options - Initialization options
 * @param {boolean} options.showDashboard - Whether to show the monitoring dashboard
 * @param {boolean} options.enableFallbacks - Whether to enable fallback mechanisms
 * @param {string} options.startupMode - Startup mode: 'normal', 'safe', or 'minimal'
 * @param {boolean} options.prioritizeAccessibility - Whether to prioritize accessibility components
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializeCore(options = {}) {
  const {
    showDashboard = false,
    enableFallbacks = true,
    startupMode = 'normal',
    prioritizeAccessibility = true
  } = options;
  
  console.log(`Initializing ALEJO Core in ${startupMode} mode...`);
  
  try {
    // Register core components first
    await registerCoreComponents();
    
    // Use the new Initialization Sequence Integrator for production-ready startup
    const initResult = await startInitializationSequence({
      startupMode,
      prioritizeAccessibility,
      resourceConservationMode: startupMode !== 'normal',
      detailedDiagnostics: true,
      progressCallback: (progress, phase) => {
        // Report progress to monitoring dashboard
        if (monitoringDashboard) {
          monitoringDashboard.updateInitProgress(progress, phase);
        }
      }
    });
    
    // Check initialization result
    if (!initResult.success) {
      throw new Error(initResult.error || 'Initialization sequence failed');
    }
    
    // Initialize neural event bus with fallback
    await initializeWithFallback(
      'core:neural-event-bus',
      async () => {
        const { initializeNeuralEventBus } = await import('./neural-architecture/neural-event-bus.js');
        return initializeNeuralEventBus();
      },
      async () => {
        console.log('Using simplified event system as fallback');
        // Simple event system as fallback
        window.alejoEvents = window.alejoEvents || {
          publish: (event, data) => {
            const customEvent = new CustomEvent(`alejo:${event}`, { detail: data });
            window.dispatchEvent(customEvent);
          },
          subscribe: (event, callback) => {
            const handler = (e) => callback(e.detail);
            window.addEventListener(`alejo:${event}`, handler);
            return () => window.removeEventListener(`alejo:${event}`, handler);
          }
        };
      },
      { isEssential: true }
    );
    
    // Register core components
    registerCoreComponents();
    
    // Initialize all registered components
    await initializeAllComponents();
    
    // Initialize monitoring dashboard if requested
    if (showDashboard) {
      monitoringDashboard.init({ autoShow: true });
    } else {
      // Load core resources in parallel
      loadCoreResources().catch(err => {
        logError('core:resources', err, ErrorSeverity.MEDIUM);
      });
      
      // Show dashboard if requested
      if (showDashboard) {
        monitoringDashboard.show();
      }
      
      // Set initialization status
      isInitialized = true;
      
      return {
        success: true,
        healthReport: initResult.healthReport,
        elapsedTime: initResult.elapsedTime
      };
    }
  } catch (error) {
    console.error('Core initialization failed:', error);
    
    // Log the error
    logError('core:initialization', error, ErrorSeverity.CRITICAL);
    
    // Store initialization error
    initializationError = error;
    
    // Show dashboard on error if enabled
    if (enableFallbacks) {
      monitoringDashboard.show();
    }
    
    return {
      success: false,
      error
    };
  }
}

/**
 * Register core components for initialization
 */
function registerCoreComponents() {
  // Register memory system
  registerComponent({
    id: 'core:memory',
    initFunction: async () => {
      const { initializeMemorySystem } = await import('./memory/memory-system.js');
      return initializeMemorySystem();
    },
    fallbackFunction: async () => {
      // Use localStorage as fallback
      console.log('Using localStorage as memory system fallback');
      return {
        set: (key, value) => localStorage.setItem(`alejo_${key}`, JSON.stringify(value)),
        get: (key) => {
          try {
            return JSON.parse(localStorage.getItem(`alejo_${key}`));
          } catch (e) {
            return null;
          }
        },
        remove: (key) => localStorage.removeItem(`alejo_${key}`),
        clear: () => {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('alejo_')) {
              localStorage.removeItem(key);
            }
          });
        }
      };
    },
    isEssential: true,
    priority: 90
  });
  
  // Register cognitive synchronizer
  registerComponent({
    id: 'core:cognitive-synchronizer',
    initFunction: async () => {
      const { initializeCognitiveSynchronizer } = await import('./neural-architecture/cognitive-synchronizer.js');
      return initializeCognitiveSynchronizer();
    },
    dependencies: ['core:neural-event-bus'],
    isEssential: false,
    priority: 70
  });
  
  // Register neural bridge
  registerComponent({
    id: 'core:neural-bridge',
    initFunction: async () => {
      const { initializeNeuralBridge } = await import('./neural-architecture/neural-bridge.js');
      return initializeNeuralBridge();
    },
    dependencies: ['core:neural-event-bus'],
    isEssential: false,
    priority: 60
  });
  
  // Register system profiler
  registerComponent({
    id: 'core:system-profiler',
    initFunction: async () => {
      const { initializeSystemProfiler } = await import('./system/system-profiler.js');
      return initializeSystemProfiler();
    },
    isEssential: false,
    priority: 50
  });
  
  // Register resource optimizer
  registerComponent({
    id: 'core:resource-optimizer',
    initFunction: async () => {
      const { initializeResourceOptimizer } = await import('./system/resource-optimizer.js');
      return initializeResourceOptimizer();
    },
    dependencies: ['core:system-profiler'],
    isEssential: true,
    priority: 80
  });
}

/**
 * Load resources needed by the core system
 * This is an async operation that can happen in parallel with other initialization
 * 
 * @returns {Promise<boolean>} - Whether resources were loaded successfully
 */
export async function loadCoreResources() {
  return initializeWithFallback(
    'core:resources',
    async () => {
      console.log('Loading core resources...');
      
      // Load actual resources here
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Core resources loaded');
      return true;
    },
    async () => {
      console.log('Using minimal resources as fallback');
      return true;
    },
    { isEssential: false }
  );
}

/**
 * Check if the core system is initialized
 * 
 * @returns {boolean} - Whether the core is initialized
 */
export function isCoreInitialized() {
  return isInitialized;
}

/**
 * Get the initialization error if any
 * 
 * @returns {Error|null} - Initialization error or null
 */
export function getInitializationError() {
  return initializationError;
}

/**
 * Get the system monitoring dashboard
 * 
 * @returns {Object} - Dashboard API
 */
export function getMonitoringDashboard() {
  return monitoringDashboard;
}

/**
 * Get the current status of all components
 * 
 * @returns {Object} - Component status
 */
export function getSystemStatus() {
  return {
    isInitialized,
    initializationError: initializationError ? initializationError.message : null,
    components: getComponentStatus(),
    initialization: getInitializationStatus()
  };
}

// Export other modules for convenience
export { 
  logError, 
  ErrorSeverity,
  getComponentStatus,
  getMonitoringDashboard,
  getSystemStatus,
  hasEssentialFailures,
  publishEvent,
  getInitializationSequenceState,
  resetInitializationSequence
};
