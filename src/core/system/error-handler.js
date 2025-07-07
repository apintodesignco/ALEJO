/**
 * ALEJO Error Handler and Fallback System
 * 
 * This module provides centralized error handling and fallback mechanisms
 * for component initialization and runtime errors.
 * 
 * Features:
 * - Centralized error logging and reporting
 * - Component initialization with fallback options
 * - Graceful degradation for failed components
 * - Error recovery strategies
 * - Detailed error tracking for debugging
 */

import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Error severity levels
export const ErrorSeverity = {
  CRITICAL: 'critical',   // System cannot function, requires immediate attention
  HIGH: 'high',           // Major feature unavailable, significant impact
  MEDIUM: 'medium',       // Feature degraded but functional
  LOW: 'low',             // Minor issue, minimal impact
  INFO: 'info'            // Informational only
};

// Component status tracking
const componentStatus = new Map();

/**
 * Initialize a component with fallback options
 * 
 * @param {string} componentId - Unique identifier for the component
 * @param {Function} initFunction - Primary initialization function
 * @param {Function} fallbackFunction - Fallback initialization function (optional)
 * @param {Object} options - Additional options
 * @param {boolean} options.isEssential - Whether this component is essential for system operation
 * @param {boolean} options.accessibility - Whether this component is related to accessibility
 * @param {number} options.retryAttempts - Number of retry attempts (default: 1)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 500)
 * @returns {Promise<Object>} - Result of initialization or fallback
 */
export async function initializeWithFallback(componentId, initFunction, fallbackFunction = null, options = {}) {
  const {
    isEssential = false,
    accessibility = false,
    retryAttempts = 1,
    retryDelay = 500
  } = options;

  // Track component initialization start
  setComponentStatus(componentId, {
    status: 'initializing',
    isEssential,
    accessibility,
    startTime: Date.now()
  });

  // Log initialization attempt
  console.log(`Initializing component: ${componentId}`);
  
  try {
    // Attempt primary initialization with retries
    let lastError = null;
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${retryAttempts} for ${componentId}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        const result = await initFunction();
        
        // Track successful initialization
        setComponentStatus(componentId, {
          status: 'initialized',
          endTime: Date.now(),
          result: 'success'
        });
        
        // Publish success event
        publishEvent('system:component:initialized', {
          componentId,
          success: true
        });
        
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Initialization attempt ${attempt + 1} failed for ${componentId}:`, error);
      }
    }
    
    // All attempts failed, try fallback if available
    if (fallbackFunction) {
      console.log(`Using fallback for ${componentId}`);
      try {
        const fallbackResult = await fallbackFunction(lastError);
        
        // Track fallback success
        setComponentStatus(componentId, {
          status: 'fallback',
          endTime: Date.now(),
          result: 'fallback-success',
          error: lastError
        });
        
        // Publish fallback event
        publishEvent('system:component:fallback', {
          componentId,
          success: true,
          error: lastError
        });
        
        return fallbackResult;
      } catch (fallbackError) {
        // Both primary and fallback failed
        handleComponentFailure(componentId, lastError, fallbackError, isEssential, accessibility);
        throw new Error(`Both primary and fallback initialization failed for ${componentId}`);
      }
    } else {
      // No fallback available
      handleComponentFailure(componentId, lastError, null, isEssential, accessibility);
      throw lastError;
    }
  } catch (error) {
    // Unexpected error during initialization process
    handleComponentFailure(componentId, error, null, isEssential, accessibility);
    throw error;
  }
}

/**
 * Handle component failure
 * 
 * @param {string} componentId - Component identifier
 * @param {Error} primaryError - Primary initialization error
 * @param {Error} fallbackError - Fallback initialization error (if applicable)
 * @param {boolean} isEssential - Whether component is essential
 * @param {boolean} accessibility - Whether component is accessibility-related
 */
function handleComponentFailure(componentId, primaryError, fallbackError, isEssential, accessibility) {
  // Update component status
  setComponentStatus(componentId, {
    status: 'failed',
    endTime: Date.now(),
    result: fallbackError ? 'complete-failure' : 'primary-failure',
    error: primaryError,
    fallbackError
  });
  
  // Determine severity based on component importance
  let severity = ErrorSeverity.MEDIUM;
  
  if (accessibility) {
    severity = ErrorSeverity.HIGH; // Accessibility issues are always high priority
  }
  
  if (isEssential) {
    severity = ErrorSeverity.CRITICAL; // Essential components are critical
  }
  
  // Log the error with appropriate severity
  logError(componentId, primaryError, severity, {
    fallbackError,
    isEssential,
    accessibility
  });
  
  // Publish failure event
  publishEvent('system:component:failed', {
    componentId,
    error: primaryError,
    fallbackError,
    severity,
    isEssential,
    accessibility
  });
}

/**
 * Log an error with the centralized error handler
 * 
 * @param {string} source - Error source (component, module, etc.)
 * @param {Error} error - The error object
 * @param {string} severity - Error severity from ErrorSeverity enum
 * @param {Object} metadata - Additional error metadata
 */
export function logError(source, error, severity = ErrorSeverity.MEDIUM, metadata = {}) {
  const timestamp = new Date().toISOString();
  const errorId = generateErrorId();
  
  // Construct error report
  const errorReport = {
    id: errorId,
    timestamp,
    source,
    message: error.message,
    stack: error.stack,
    severity,
    metadata
  };
  
  // Log to console with appropriate level
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      console.error(`CRITICAL ERROR [${errorId}] in ${source}:`, error, metadata);
      break;
    case ErrorSeverity.HIGH:
      console.error(`HIGH SEVERITY ERROR [${errorId}] in ${source}:`, error, metadata);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn(`ERROR [${errorId}] in ${source}:`, error, metadata);
      break;
    case ErrorSeverity.LOW:
      console.warn(`Minor error [${errorId}] in ${source}:`, error, metadata);
      break;
    case ErrorSeverity.INFO:
      console.info(`Info [${errorId}] in ${source}:`, error, metadata);
      break;
    default:
      console.log(`Error [${errorId}] in ${source}:`, error, metadata);
  }
  
  // Publish error event for other systems to react
  publishEvent('system:error', errorReport);
  
  // Store error in error log for later analysis
  storeErrorReport(errorReport);
  
  return errorId;
}

/**
 * Generate a unique error ID
 * 
 * @returns {string} - Unique error identifier
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store error report for later analysis
 * 
 * @param {Object} errorReport - The error report to store
 */
function storeErrorReport(errorReport) {
  try {
    // Get existing error log from storage
    const errorLog = JSON.parse(localStorage.getItem('alejo_error_log') || '[]');
    
    // Add new error and limit size to prevent storage issues
    errorLog.unshift(errorReport);
    if (errorLog.length > 100) {
      errorLog.length = 100; // Keep only the 100 most recent errors
    }
    
    // Save back to storage
    localStorage.setItem('alejo_error_log', JSON.stringify(errorLog));
  } catch (e) {
    console.warn('Failed to store error report:', e);
  }
}

/**
 * Update component status
 * 
 * @param {string} componentId - Component identifier
 * @param {Object} statusUpdate - Status update to apply
 */
function setComponentStatus(componentId, statusUpdate) {
  // Get existing status or create new one
  const currentStatus = componentStatus.get(componentId) || {};
  
  // Update with new information
  componentStatus.set(componentId, {
    ...currentStatus,
    ...statusUpdate,
    lastUpdated: Date.now()
  });
}

/**
 * Get the current status of all components
 * 
 * @returns {Object} - Map of component statuses
 */
export function getComponentStatus() {
  return Object.fromEntries(componentStatus);
}

/**
 * Get the status of a specific component
 * 
 * @param {string} componentId - Component identifier
 * @returns {Object|null} - Component status or null if not found
 */
export function getComponentStatusById(componentId) {
  return componentStatus.get(componentId) || null;
}

/**
 * Check if a component has been successfully initialized
 * 
 * @param {string} componentId - Component identifier
 * @returns {boolean} - True if component is initialized (primary or fallback)
 */
export function isComponentInitialized(componentId) {
  const status = componentStatus.get(componentId);
  return status && (status.status === 'initialized' || status.status === 'fallback');
}

/**
 * Get a list of all failed components
 * 
 * @param {boolean} essentialOnly - Only return essential components
 * @returns {Array} - Array of failed component IDs
 */
export function getFailedComponents(essentialOnly = false) {
  const failed = [];
  
  for (const [id, status] of componentStatus.entries()) {
    if (status.status === 'failed') {
      if (!essentialOnly || status.isEssential) {
        failed.push(id);
      }
    }
  }
  
  return failed;
}

/**
 * Check if any essential components have failed
 * 
 * @returns {boolean} - True if any essential components have failed
 */
export function hasEssentialFailures() {
  return getFailedComponents(true).length > 0;
}

/**
 * Get the error log
 * 
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} - Array of error reports
 */
export function getErrorLog(limit = 50) {
  try {
    const errorLog = JSON.parse(localStorage.getItem('alejo_error_log') || '[]');
    return errorLog.slice(0, limit);
  } catch (e) {
    console.warn('Failed to retrieve error log:', e);
    return [];
  }
}

/**
 * Clear the error log
 */
export function clearErrorLog() {
  try {
    localStorage.removeItem('alejo_error_log');
  } catch (e) {
    console.warn('Failed to clear error log:', e);
  }
}
