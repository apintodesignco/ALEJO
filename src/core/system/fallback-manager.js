/**
 * ALEJO Fallback Manager
 * 
 * This module provides advanced fallback mechanisms for component initialization,
 * ensuring that the system can continue to function even when components fail to initialize.
 * It prioritizes accessibility components and provides alternative implementations
 * for critical functionality.
 */

import { logError, ErrorSeverity } from './error-handler.js';
import { logInitEvent } from './initialization-log-viewer.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Registry of fallback implementations
const fallbackRegistry = new Map();

// Fallback configuration
const config = {
  maxRetryAttempts: 3,
  defaultRetryDelay: 1000, // ms
  progressiveRetryDelay: true, // Increase delay with each retry
  fallbackTimeout: 5000, // ms
  prioritizeAccessibility: true,
  logFallbackUsage: true,
  notifyUserOnFallback: true
};

/**
 * Register a fallback implementation for a component
 * 
 * @param {string} componentId - Component ID
 * @param {Function} fallbackImpl - Fallback implementation function
 * @param {Object} options - Fallback options
 * @param {boolean} options.isStub - Whether this is a stub implementation (minimal functionality)
 * @param {boolean} options.isAccessible - Whether this fallback maintains accessibility
 * @param {string[]} options.limitations - List of limitations compared to the primary implementation
 * @param {string[]} options.capabilities - List of capabilities maintained by this fallback
 */
export function registerFallbackImplementation(componentId, fallbackImpl, options = {}) {
  const {
    isStub = false,
    isAccessible = false,
    limitations = [],
    capabilities = []
  } = options;
  
  fallbackRegistry.set(componentId, {
    implementation: fallbackImpl,
    isStub,
    isAccessible,
    limitations,
    capabilities,
    usageCount: 0,
    lastUsed: null
  });
  
  logInitEvent('fallback-register', componentId, { isStub, isAccessible, limitations, capabilities });
  console.log(`Fallback registered for component: ${componentId}`);
}

/**
 * Get a fallback implementation for a component
 * 
 * @param {string} componentId - Component ID
 * @returns {Object|null} - Fallback implementation or null if not found
 */
export function getFallbackImplementation(componentId) {
  return fallbackRegistry.get(componentId) || null;
}

/**
 * Execute a function with fallback
 * 
 * @param {Object} options - Options
 * @param {Function} options.primaryFunction - Primary implementation function
 * @param {Function} options.fallbackFunction - Fallback implementation function
 * @param {string} options.componentId - Component ID
 * @param {number} options.retryAttempts - Number of retry attempts
 * @param {number} options.retryDelay - Delay between retries in ms
 * @param {Function} options.onProgress - Progress callback function
 * @returns {Promise<Object>} - Result with data and fallback status
 */
export async function executeWithFallback(options) {
  const {
    primaryFunction,
    fallbackFunction,
    componentId,
    retryAttempts = config.maxRetryAttempts,
    retryDelay = config.defaultRetryDelay,
    onProgress
  } = options;
  
  // Try primary implementation with retries
  let primaryError = null;
  let attemptCount = 0;
  
  // Report progress
  if (onProgress) {
    onProgress({ progress: 0, phase: 'primary-attempt' });
  }
  
  while (attemptCount <= retryAttempts) {
    try {
      // Report retry attempt
      if (attemptCount > 0) {
        logInitEvent('retry', componentId, { attempt: attemptCount, maxAttempts: retryAttempts });
        
        if (onProgress) {
          onProgress({ 
            progress: (attemptCount / (retryAttempts + 1)) * 50, 
            phase: `retry-${attemptCount}` 
          });
        }
      }
      
      // Execute primary function
      const result = await primaryFunction();
      
      // Report success
      if (attemptCount > 0) {
        logInitEvent('retry-success', componentId, { attempts: attemptCount });
      }
      
      return { data: result, usingFallback: false };
    } catch (error) {
      primaryError = error;
      attemptCount++;
      
      // Log retry failure
      if (attemptCount <= retryAttempts) {
        console.warn(`Retry ${attemptCount}/${retryAttempts} failed for ${componentId}:`, error.message);
        logInitEvent('retry-failure', componentId, { 
          attempt: attemptCount, 
          maxAttempts: retryAttempts,
          error: error.message
        });
        
        // Wait before retrying
        const currentRetryDelay = config.progressiveRetryDelay 
          ? retryDelay * attemptCount 
          : retryDelay;
          
        await new Promise(resolve => setTimeout(resolve, currentRetryDelay));
      }
    }
  }
  
  // Primary implementation failed, try fallback
  if (fallbackFunction) {
    try {
      // Report fallback attempt
      logInitEvent('fallback-attempt', componentId, { 
        primaryError: primaryError.message,
        fallbackInfo: fallbackRegistry.get(componentId)
      });
      
      if (onProgress) {
        onProgress({ progress: 60, phase: 'fallback-attempt' });
      }
      
      // Execute fallback with timeout
      const fallbackResult = await Promise.race([
        fallbackFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fallback timeout')), config.fallbackTimeout)
        )
      ]);
      
      // Update fallback usage statistics
      if (fallbackRegistry.has(componentId)) {
        const fallbackInfo = fallbackRegistry.get(componentId);
        fallbackInfo.usageCount++;
        fallbackInfo.lastUsed = Date.now();
        
        // Log fallback usage
        if (config.logFallbackUsage) {
          logInitEvent('fallback-success', componentId, { 
            usageCount: fallbackInfo.usageCount,
            isStub: fallbackInfo.isStub,
            isAccessible: fallbackInfo.isAccessible
          });
        }
      }
      
      // Notify about fallback usage
      if (config.notifyUserOnFallback) {
        publishEvent('system:fallback:used', { 
          componentId, 
          reason: primaryError.message,
          isStub: fallbackRegistry.get(componentId)?.isStub || false
        });
      }
      
      if (onProgress) {
        onProgress({ progress: 90, phase: 'fallback-success' });
      }
      
      return { data: fallbackResult, usingFallback: true };
    } catch (fallbackError) {
      // Both primary and fallback failed
      logError({
        error: fallbackError,
        context: `fallback:${componentId}`,
        severity: ErrorSeverity.HIGH,
        metadata: { primaryError: primaryError.message }
      });
      
      logInitEvent('fallback-failure', componentId, { 
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      
      throw new Error(`Component ${componentId} failed to initialize: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`);
    }
  } else {
    // No fallback available
    throw primaryError;
  }
}

/**
 * Get fallback statistics
 * 
 * @returns {Object} - Fallback statistics
 */
export function getFallbackStatistics() {
  const stats = {
    totalFallbacks: fallbackRegistry.size,
    activeFallbacks: 0,
    accessibleFallbacks: 0,
    stubImplementations: 0,
    totalUsageCount: 0,
    componentStats: {}
  };
  
  for (const [componentId, fallbackInfo] of fallbackRegistry.entries()) {
    if (fallbackInfo.usageCount > 0) {
      stats.activeFallbacks++;
    }
    
    if (fallbackInfo.isAccessible) {
      stats.accessibleFallbacks++;
    }
    
    if (fallbackInfo.isStub) {
      stats.stubImplementations++;
    }
    
    stats.totalUsageCount += fallbackInfo.usageCount;
    
    stats.componentStats[componentId] = {
      usageCount: fallbackInfo.usageCount,
      lastUsed: fallbackInfo.lastUsed,
      isStub: fallbackInfo.isStub,
      isAccessible: fallbackInfo.isAccessible,
      limitations: fallbackInfo.limitations,
      capabilities: fallbackInfo.capabilities
    };
  }
  
  return stats;
}

/**
 * Configure fallback behavior
 * 
 * @param {Object} options - Configuration options
 */
export function configureFallbackBehavior(options = {}) {
  Object.assign(config, options);
}

/**
 * Generate a default stub implementation for a component
 * 
 * @param {string} componentId - Component ID
 * @param {Object} options - Stub options
 * @returns {Function} - Stub implementation function
 */
export function generateStubImplementation(componentId, options = {}) {
  const {
    returnValue = null,
    methods = [],
    properties = [],
    events = []
  } = options;
  
  // Create stub object with specified methods
  const stubObject = {};
  
  // Add stub methods
  methods.forEach(methodName => {
    stubObject[methodName] = (...args) => {
      console.warn(`Stub method called: ${componentId}.${methodName}`, args);
      return returnValue;
    };
  });
  
  // Add stub properties
  properties.forEach(propName => {
    stubObject[propName] = returnValue;
  });
  
  // Add stub event emitter if events are specified
  if (events.length > 0) {
    stubObject.addEventListener = (event, handler) => {
      console.warn(`Stub event listener added: ${componentId}.${event}`);
    };
    
    stubObject.removeEventListener = (event, handler) => {
      console.warn(`Stub event listener removed: ${componentId}.${event}`);
    };
    
    stubObject.dispatchEvent = (event) => {
      console.warn(`Stub event dispatch: ${componentId}.${event.type}`);
    };
  }
  
  // Return a function that returns the stub object
  return () => {
    console.warn(`Using stub implementation for component: ${componentId}`);
    return Promise.resolve(stubObject);
  };
}

/**
 * Create an accessibility-preserving fallback
 * 
 * @param {string} componentId - Component ID
 * @param {Function} coreFunction - Core functionality implementation
 * @param {Object} a11yOptions - Accessibility options
 * @returns {Function} - Accessibility-preserving fallback function
 */
export function createAccessibilityFallback(componentId, coreFunction, a11yOptions = {}) {
  const {
    announcements = true,
    keyboardSupport = true,
    highContrast = true,
    screenReaderHints = true
  } = a11yOptions;
  
  return async () => {
    try {
      // Get core functionality
      const core = await coreFunction();
      
      // Enhance with accessibility features
      const enhanced = { ...core };
      
      // Add screen reader announcements
      if (announcements) {
        enhanced.announce = (message, priority = 'polite') => {
          const element = document.createElement('div');
          element.setAttribute('aria-live', priority);
          element.setAttribute('aria-atomic', 'true');
          element.classList.add('sr-only');
          document.body.appendChild(element);
          
          // Set the text content after a brief delay to ensure it's announced
          setTimeout(() => {
            element.textContent = message;
            
            // Remove after announcement
            setTimeout(() => {
              document.body.removeChild(element);
            }, 3000);
          }, 100);
        };
      }
      
      // Add keyboard support
      if (keyboardSupport) {
        enhanced.setupKeyboardSupport = (element) => {
          if (!element) return;
          
          // Make focusable
          if (!element.getAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
          }
          
          // Add keyboard event listeners
          element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              element.click();
            }
          });
        };
      }
      
      // Add high contrast support
      if (highContrast) {
        enhanced.enableHighContrast = (element) => {
          if (!element) return;
          
          element.classList.add('high-contrast-compatible');
          
          // Add high contrast media query listener
          const mediaQuery = window.matchMedia('(forced-colors: active)');
          const handleMediaChange = (e) => {
            if (e.matches) {
              element.setAttribute('data-high-contrast', 'true');
            } else {
              element.removeAttribute('data-high-contrast');
            }
          };
          
          mediaQuery.addEventListener('change', handleMediaChange);
          handleMediaChange(mediaQuery);
        };
      }
      
      // Add screen reader hints
      if (screenReaderHints) {
        enhanced.addScreenReaderHint = (element, hint) => {
          if (!element) return;
          
          const srHint = document.createElement('span');
          srHint.classList.add('sr-only');
          srHint.textContent = hint;
          element.appendChild(srHint);
        };
      }
      
      return enhanced;
    } catch (error) {
      console.error(`Accessibility fallback failed for ${componentId}:`, error);
      throw error;
    }
  };
}

// Export a unified function for initialization with fallback
export { executeWithFallback as initializeWithFallback };
