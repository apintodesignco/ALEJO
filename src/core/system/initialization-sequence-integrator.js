/**
 * ALEJO Initialization Sequence Integrator
 * 
 * This module integrates the initialization manager with the progressive loading system,
 * providing a cohesive, fault-tolerant startup sequence for ALEJO in production environments.
 * 
 * Features:
 * - Unified initialization with progressive loading prioritization
 * - Comprehensive error handling and graceful degradation
 * - Detailed startup diagnostics and health reporting
 * - User-friendly startup progress indicators
 * - Accessibility-first loading approach
 */

import { 
  initializeSystem, 
  initializeDeferredComponents,
  getInitializationStatus
} from './initialization-manager.js';

import {
  initializeProgressiveLoading,
  getLoadingSequenceState,
  updateUserPreferences,
  loadDeferredComponents
} from './progressive-loading-manager.js';

import { logInitEvent, getInitializationLog } from './initialization-log-viewer.js';
import { getResourceStatus } from '../../performance/resource-allocation-manager.js';
import { publishEvent, subscribeToEvent } from '../neural-architecture/neural-event-bus.js';
import { addAuditEntry } from '../../core/audit-trail.js';
import { getFallbackStatus, setFallbackMode } from './fallback-manager.js';

// Initialization sequence state
const initSequenceState = {
  status: 'idle', // idle, starting, loading, complete, failed
  startTime: null,
  endTime: null,
  elapsedTime: null,
  progress: 0,
  currentPhase: null,
  initAttempts: 0,
  maxAttempts: 3,
  diagnostics: {},
  healthReport: {},
  errors: []
};

// Event subscriptions
let eventSubscriptions = [];

/**
 * Start the ALEJO initialization sequence
 * 
 * @param {Object} options - Initialization options
 * @param {boolean} options.prioritizeAccessibility - Whether to prioritize accessibility components
 * @param {boolean} options.resourceConservationMode - Whether to conserve resources during startup
 * @param {Function} options.progressCallback - Callback for initialization progress updates
 * @param {boolean} options.detailedDiagnostics - Whether to collect detailed diagnostics
 * @param {string} options.startupMode - Startup mode (normal, safe, minimal)
 * @returns {Promise<Object>} - Initialization results
 */
export async function startInitializationSequence(options = {}) {
  // Prevent multiple initialization attempts
  if (initSequenceState.status === 'starting' || initSequenceState.status === 'loading') {
    console.warn('Initialization sequence already in progress');
    return { success: false, error: 'ALREADY_INITIALIZING' };
  }

  try {
    // Update initialization state
    initSequenceState.status = 'starting';
    initSequenceState.startTime = Date.now();
    initSequenceState.progress = 0;
    initSequenceState.initAttempts += 1;
    
    // Reset errors for this attempt
    initSequenceState.errors = [];
    
    // Log and publish initialization start
    logInitEvent('sequence-start', 'initialization-sequence', {
      attempt: initSequenceState.initAttempts,
      options,
      startTime: new Date(initSequenceState.startTime).toISOString()
    });
    
    publishEvent('system:initialization:starting', {
      attempt: initSequenceState.initAttempts,
      timestamp: Date.now()
    });
    
    // Create an audit trail entry
    addAuditEntry({
      type: 'system',
      action: 'initialization-start',
      details: {
        attempt: initSequenceState.initAttempts,
        startupMode: options.startupMode || 'normal',
        timestamp: new Date().toISOString()
      }
    });
    
    // Setup diagnostic collection
    if (options.detailedDiagnostics) {
      collectSystemDiagnostics();
    }
    
    // Configure startup mode
    const startupMode = options.startupMode || 'normal';
    const startupConfig = configureStartupMode(startupMode);
    
    // Setup event subscriptions
    setupEventSubscriptions();
    
    // Update initialization state
    initSequenceState.status = 'loading';
    updateProgress(5, 'Preparing initialization sequence');
    
    // Initialize progressive loading first
    const progressiveLoadingResult = await initializeProgressiveLoading({
      userPreferences: {
        prioritizeAccessibility: options.prioritizeAccessibility !== false, // true by default
        resourceConservationMode: options.resourceConservationMode || false,
        loadOptionalComponents: startupConfig.loadOptionalComponents
      }
    });
    
    updateProgress(15, 'Progressive loading configured');
    
    // Get loading sequence state
    const loadingState = getLoadingSequenceState();
    
    // Initialize the system using the progressive loading configuration
    const initResult = await initializeSystem({
      prioritizeAccessibility: options.prioritizeAccessibility !== false,
      deferNonEssential: startupConfig.deferNonEssential,
      useFallbacks: startupConfig.useFallbacks,
      progressCallback: (progress, phase) => {
        // Map init progress (0-100) to overall progress (15-85)
        const mappedProgress = 15 + (progress * 0.7);
        updateProgress(mappedProgress, phase);
      },
      allowedPhases: startupConfig.allowedPhases
    });
    
    // Process initialization result
    if (!initResult.success) {
      handleInitializationError(initResult.error, startupConfig);
      
      // Check if we should retry
      if (initSequenceState.initAttempts < initSequenceState.maxAttempts) {
        console.warn(`Initialization attempt ${initSequenceState.initAttempts} failed, retrying...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try again in safe mode if this wasn't already safe mode
        const nextOptions = {
          ...options,
          startupMode: startupMode === 'normal' ? 'safe' : 'minimal'
        };
        
        return startInitializationSequence(nextOptions);
      }
      
      // All attempts failed
      finalizeInitialization(false, 'Max initialization attempts reached');
      return {
        success: false,
        error: 'MAX_ATTEMPTS_REACHED',
        status: initSequenceState.status,
        diagnostics: initSequenceState.diagnostics
      };
    }
    
    updateProgress(85, 'Core initialization complete');
    
    // Process any deferred components if appropriate
    if (startupConfig.loadDeferredAfterStartup && loadingState.deferredComponents.length > 0) {
      initSequenceState.currentPhase = 'Loading deferred components';
      
      // Load deferred components
      const deferredResult = await loadDeferredComponents();
      
      // Initialize the deferred components
      await initializeDeferredComponents({
        useFallbacks: true,
        progressCallback: (progress) => {
          // Map deferred progress (0-100) to overall progress (85-95)
          const mappedProgress = 85 + (progress * 0.1);
          updateProgress(mappedProgress, 'Loading deferred components');
        }
      });
    }
    
    // Complete the initialization
    finalizeInitialization(true);
    
    // Return success
    return {
      success: true,
      status: initSequenceState.status,
      elapsedTime: initSequenceState.elapsedTime,
      healthReport: initSequenceState.healthReport
    };
    
  } catch (error) {
    // Handle unexpected errors
    console.error('Unhandled error during initialization sequence:', error);
    
    initSequenceState.errors.push({
      phase: initSequenceState.currentPhase || 'unknown',
      error: error.message || 'Unknown error',
      stack: error.stack,
      timestamp: Date.now()
    });
    
    // Log the error
    logInitEvent('sequence-error', 'initialization-sequence', {
      error: error.message,
      phase: initSequenceState.currentPhase
    });
    
    // Finalize with failure
    finalizeInitialization(false, error.message);
    
    return {
      success: false,
      error: 'UNHANDLED_ERROR',
      message: error.message,
      status: initSequenceState.status,
      diagnostics: initSequenceState.diagnostics
    };
  }
}

/**
 * Configure startup based on mode
 * 
 * @param {string} mode - Startup mode (normal, safe, minimal)
 * @returns {Object} - Startup configuration
 */
function configureStartupMode(mode) {
  switch (mode) {
    case 'safe':
      return {
        deferNonEssential: true,
        useFallbacks: true,
        loadOptionalComponents: false,
        loadDeferredAfterStartup: true,
        allowedPhases: ['CRITICAL', 'CORE', 'STANDARD']
      };
    case 'minimal':
      return {
        deferNonEssential: true,
        useFallbacks: true,
        loadOptionalComponents: false,
        loadDeferredAfterStartup: false,
        allowedPhases: ['CRITICAL', 'CORE']
      };
    case 'normal':
    default:
      return {
        deferNonEssential: false,
        useFallbacks: true,
        loadOptionalComponents: true,
        loadDeferredAfterStartup: true,
        allowedPhases: ['CRITICAL', 'CORE', 'STANDARD', 'ENHANCED', 'OPTIONAL']
      };
  }
}

/**
 * Handle initialization error
 * 
 * @param {string|Object} error - Error information
 * @param {Object} startupConfig - Startup configuration
 */
function handleInitializationError(error, startupConfig) {
  // Record the error
  const errorDetails = typeof error === 'string' ? { message: error } : error;
  
  initSequenceState.errors.push({
    phase: initSequenceState.currentPhase || 'unknown',
    ...errorDetails,
    timestamp: Date.now()
  });
  
  // Log the error
  logInitEvent('sequence-error', 'initialization-sequence', {
    error: errorDetails,
    phase: initSequenceState.currentPhase
  });
  
  // Enable fallback mode if appropriate
  if (startupConfig.useFallbacks) {
    setFallbackMode(true, {
      reason: 'initialization-failure',
      details: errorDetails
    });
  }
  
  // Publish error event
  publishEvent('system:initialization:error', {
    phase: initSequenceState.currentPhase,
    error: errorDetails,
    attempt: initSequenceState.initAttempts,
    willRetry: initSequenceState.initAttempts < initSequenceState.maxAttempts
  });
}

/**
 * Update the initialization progress
 * 
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} phase - Current initialization phase
 */
function updateProgress(progress, phase) {
  initSequenceState.progress = Math.min(Math.max(progress, 0), 100);
  initSequenceState.currentPhase = phase;
  
  // Publish progress event
  publishEvent('system:initialization:progress', {
    progress: initSequenceState.progress,
    phase: initSequenceState.currentPhase,
    timestamp: Date.now()
  });
}

/**
 * Finalize the initialization sequence
 * 
 * @param {boolean} success - Whether initialization was successful
 * @param {string} errorMessage - Error message if not successful
 */
function finalizeInitialization(success, errorMessage = null) {
  // Update state
  initSequenceState.status = success ? 'complete' : 'failed';
  initSequenceState.endTime = Date.now();
  initSequenceState.elapsedTime = initSequenceState.endTime - initSequenceState.startTime;
  initSequenceState.progress = success ? 100 : initSequenceState.progress;
  
  // Generate health report
  generateHealthReport();
  
  // Log completion
  logInitEvent('sequence-complete', 'initialization-sequence', {
    success,
    elapsedTime: initSequenceState.elapsedTime,
    errors: initSequenceState.errors,
    errorCount: initSequenceState.errors.length,
    errorMessage,
    healthReport: initSequenceState.healthReport
  });
  
  // Create audit trail entry
  addAuditEntry({
    type: 'system',
    action: 'initialization-complete',
    details: {
      success,
      elapsedTime: initSequenceState.elapsedTime,
      timestamp: new Date().toISOString(),
      errorCount: initSequenceState.errors.length,
      healthStatus: initSequenceState.healthReport.status
    }
  });
  
  // Publish completion event
  publishEvent('system:initialization:complete', {
    success,
    elapsedTime: initSequenceState.elapsedTime,
    errors: initSequenceState.errors.length > 0,
    healthStatus: initSequenceState.healthReport.status,
    timestamp: Date.now()
  });
  
  // Clean up event subscriptions
  cleanupEventSubscriptions();
}

/**
 * Setup event subscriptions for monitoring the initialization process
 */
function setupEventSubscriptions() {
  // Clear any existing subscriptions
  cleanupEventSubscriptions();
  
  // Subscribe to component initialization events
  eventSubscriptions.push(
    subscribeToEvent('component:initialized', handleComponentEvent)
  );
  
  // Subscribe to component failure events
  eventSubscriptions.push(
    subscribeToEvent('component:initialization:failed', handleComponentFailure)
  );
  
  // Subscribe to resource status changes
  eventSubscriptions.push(
    subscribeToEvent('system:resources:critical', handleResourceCritical)
  );
}

/**
 * Clean up event subscriptions
 */
function cleanupEventSubscriptions() {
  // Unsubscribe from all events
  eventSubscriptions.forEach(subscription => {
    if (typeof subscription === 'function') {
      subscription();
    }
  });
  
  // Reset subscriptions array
  eventSubscriptions = [];
}

/**
 * Handle component initialization event
 * 
 * @param {Object} eventData - Component event data
 */
function handleComponentEvent(eventData) {
  // Log component initialization
  logInitEvent('component-initialized', eventData.componentId, eventData);
}

/**
 * Handle component initialization failure
 * 
 * @param {Object} eventData - Failure event data
 */
function handleComponentFailure(eventData) {
  // Log component failure
  logInitEvent('component-failed', eventData.componentId, eventData);
  
  // Add to errors list
  initSequenceState.errors.push({
    componentId: eventData.componentId,
    phase: initSequenceState.currentPhase,
    error: eventData.error,
    timestamp: Date.now()
  });
}

/**
 * Handle critical resource status during initialization
 * 
 * @param {Object} eventData - Resource event data
 */
function handleResourceCritical(eventData) {
  // Log resource critical event
  logInitEvent('resources-critical', 'resource-manager', eventData);
  
  // Add to diagnostics
  initSequenceState.diagnostics.resourceWarnings = initSequenceState.diagnostics.resourceWarnings || [];
  initSequenceState.diagnostics.resourceWarnings.push({
    ...eventData,
    timestamp: Date.now()
  });
}

/**
 * Collect system diagnostics
 */
function collectSystemDiagnostics() {
  try {
    // Get resource status
    const resourceStatus = getResourceStatus();
    
    // Get initialization status
    const initStatus = getInitializationStatus();
    
    // Get fallback status
    const fallbackStatus = getFallbackStatus();
    
    // Get initialization log
    const initLog = getInitializationLog();
    
    // Store diagnostics
    initSequenceState.diagnostics = {
      timestamp: new Date().toISOString(),
      resourceStatus,
      initStatus,
      fallbackStatus,
      initLog: initLog.slice(-20), // Last 20 log entries
      browserInfo: getBrowserInfo(),
      systemInfo: getSystemInfo()
    };
    
  } catch (error) {
    console.error('Error collecting diagnostics:', error);
  }
}

/**
 * Generate system health report
 */
function generateHealthReport() {
  const initStatus = getInitializationStatus();
  const resourceStatus = getResourceStatus();
  const fallbackStatus = getFallbackStatus();
  
  // Calculate component health
  const components = initStatus.componentStatus || {};
  const componentCount = Object.keys(components).length;
  const initializedCount = Object.values(components).filter(c => c.status === 'initialized').length;
  const fallbackCount = Object.values(components).filter(c => c.status === 'fallback').length;
  const failedCount = Object.values(components).filter(c => c.status === 'failed').length;
  
  // Calculate overall health
  let status = 'healthy';
  if (failedCount > 0) {
    status = fallbackStatus.active ? 'degraded' : 'critical';
  } else if (fallbackCount > 0) {
    status = 'degraded';
  }
  
  // Generate report
  initSequenceState.healthReport = {
    status,
    timestamp: new Date().toISOString(),
    components: {
      total: componentCount,
      initialized: initializedCount,
      fallback: fallbackCount,
      failed: failedCount
    },
    resources: {
      cpu: resourceStatus.cpu,
      memory: resourceStatus.memory
    },
    initTime: initSequenceState.elapsedTime,
    errors: initSequenceState.errors.length,
    fallbackActive: fallbackStatus.active
  };
}

/**
 * Get browser information for diagnostics
 * 
 * @returns {Object} - Browser information
 */
function getBrowserInfo() {
  // Basic browser info - this will be expanded in the browser environment
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
    platform: typeof navigator !== 'undefined' ? navigator.platform : process.platform,
    language: typeof navigator !== 'undefined' ? navigator.language : process.env.LANG
  };
}

/**
 * Get system information for diagnostics
 * 
 * @returns {Object} - System information
 */
function getSystemInfo() {
  return {
    timestamp: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    type: typeof window !== 'undefined' ? 'browser' : 'node'
  };
}

/**
 * Get current initialization sequence state
 * 
 * @returns {Object} - Current initialization state
 */
export function getInitializationSequenceState() {
  return {
    ...initSequenceState,
    currentTime: Date.now()
  };
}

/**
 * Reset the initialization sequence state
 * 
 * @returns {void}
 */
export function resetInitializationSequence() {
  // Clean up subscriptions
  cleanupEventSubscriptions();
  
  // Reset state
  Object.assign(initSequenceState, {
    status: 'idle',
    startTime: null,
    endTime: null,
    elapsedTime: null,
    progress: 0,
    currentPhase: null,
    initAttempts: 0,
    diagnostics: {},
    healthReport: {},
    errors: []
  });
  
  // Log reset
  logInitEvent('sequence-reset', 'initialization-sequence', {
    timestamp: Date.now()
  });
}

/**
 * Export default
 */
export default {
  startInitializationSequence,
  getInitializationSequenceState,
  resetInitializationSequence
};
