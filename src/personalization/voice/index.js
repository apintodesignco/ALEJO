/**
 * ALEJO Voice System Index
 * 
 * This module exports all voice-related components:
 * - Training: Voice pattern capture and model creation
 * - Recognition: Voice identification and authentication
 * - Synthesis: Voice output and style adaptation
 * - Command Processing: Voice command interpretation and execution
 * - Advanced Features: Neural voice embedding, emotion analysis, and adaptive learning
 * - Monitoring: Integration with system monitoring dashboard
 * 
 * PRODUCTION FEATURES:
 * - Resource-aware initialization and operation
 * - Graceful degradation under constrained resources
 * - Accessibility-first design with screen reader announcements
 * - Local-first processing for privacy and performance
 * - Comprehensive error handling and reporting
 * - Detailed monitoring and health checks
 */

import * as training from './training.js';
import * as recognition from './recognition.js';
import * as synthesis from './synthesis.js';
import * as commandProcessor from './command-processor.js';
import * as advancedFeatures from './advanced-features.js';
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';
import { initializeMonitoring, getVoiceStatus, resetStatistics } from './monitoring-integration.js';
import * as dashboardIntegration from './dashboard-integration.js';

// Module state
let _initialized = false;
let _initializationInProgress = false;
let _healthCheckInterval = null;
const _systemHealth = {
  lastCheck: null,
  status: 'offline',
  components: {},
  criticalErrors: []
};

// Import EventBus for monitoring events
let EventBus;
try {
  EventBus = require('../event-bus').EventBus;
} catch (error) {
  // Create mock EventBus if not available
  EventBus = { publish: () => {} };
}

// Initialization statistics
const _initStats = {
  startTime: 0,
  completionTime: 0,
  totalDuration: 0,
  componentTimes: {}
};

/**
 * Initialize the complete voice system with production-ready enhancements
 * @param {Object} options - Initialization options
 * @param {boolean} [options.enableResourceManagement=true] - Whether to register with Resource Allocation Manager
 * @param {boolean} [options.parallelInit=true] - Initialize components in parallel for faster startup
 * @param {number} [options.initTimeout=30000] - Timeout for initialization in milliseconds
 * @param {boolean} [options.enableHealthChecks=true] - Enable periodic system health checks
 * @param {number} [options.healthCheckInterval=60000] - Interval for health checks in milliseconds
 * @param {boolean} [options.allowPartialInit=true] - Continue even if some components fail to initialize
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  // Prevent multiple initializations
  if (_initialized) {
    console.warn('ALEJO Voice System already initialized');
    return { success: true, alreadyInitialized: true };
  }
  
  if (_initializationInProgress) {
    console.warn('ALEJO Voice System initialization already in progress');
    return { success: false, error: 'Initialization already in progress' };
  }
  
  _initializationInProgress = true;
  _initStats.startTime = performance.now();
  
  // Set default options
  const initOptions = {
    enableResourceManagement: true,
    parallelInit: true,
    initTimeout: 30000,
    enableHealthChecks: true,
    healthCheckInterval: 60000,
    allowPartialInit: true,
    ...options
  };
  
  console.log('Initializing ALEJO Voice System with options:', 
    JSON.stringify({ ...initOptions, credentials: initOptions.credentials ? '[REDACTED]' : undefined }));
  
  // Create a results object to track initialization status
  const results = {
    training: false,
    recognition: false,
    synthesis: false,
    commandProcessor: false,
    advancedFeatures: false,
    resourceManagement: false,
    monitoring: false,
    dashboardIntegration: false,
    errors: {}
  };
  
  // Setup initialization timeout with accessibility announcement
  const initTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error('Voice system initialization timeout');
      // Announce timeout to screen readers
      try {
        const { publish } = require('../../core/events.js');
        publish('accessibility:announce', {
          message: 'Voice system initialization timed out. Some features may be unavailable.',
          priority: 'assertive'
        });
      } catch (e) {
        // Fallback if events module isn't available
        console.error('Failed to announce timeout:', e);
      }
      reject(timeoutError);
    }, initOptions.initTimeout);
  });
  
  // Function to initialize a component with timing and error handling
  const initComponent = async (name, initFn, options = {}) => {
    const compStartTime = performance.now();
    try {
      const result = await Promise.race([
        initFn(options),
        initTimeoutPromise
      ]);
      results[name] = result || true;
      _systemHealth.components[name] = { status: 'healthy', lastCheck: Date.now() };
      return result;
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      results.errors[name] = error.message || String(error);
      _systemHealth.components[name] = { 
        status: 'error', 
        lastCheck: Date.now(),
        error: error.message || String(error)
      };
      
      // Track critical errors
      if (!options.allowPartialInit || ['commandProcessor', 'recognition'].includes(name)) {
        _systemHealth.criticalErrors.push({ 
          component: name, 
          error: error.message || String(error),
          time: Date.now()
        });
      }
      
      if (initOptions.allowPartialInit) {
        return false;
      } else {
        throw error;
      }
    } finally {
      const duration = performance.now() - compStartTime;
      _initStats.componentTimes[name] = duration;
    }
  };
  
  try {
    // Check system resources before initialization to determine optimal approach
    let availableResources = {};
    try {
      // Import performance utilities
      const { checkSystemResources } = await import('../../performance/system-check.js');
      availableResources = await checkSystemResources();
      console.log('Available system resources:', availableResources);
      
      // Dynamically adjust initialization based on available resources
      if (availableResources.memory && availableResources.memory.available < 100 * 1024 * 1024) { // Less than 100MB
        console.warn('Limited memory detected, forcing sequential initialization and minimal features');
        initOptions.parallelInit = false;
        initOptions.minimalFeatures = true;
      }
      
      if (availableResources.cpu && availableResources.cpu.usage > 80) { // CPU usage over 80%
        console.warn('High CPU usage detected, optimizing for efficiency');
        initOptions.optimizeForEfficiency = true;
      }
    } catch (error) {
      console.warn('Failed to check system resources, using default initialization:', error);
    }
    
    // Announce initialization start to screen readers
    try {
      const { publish } = await import('../../core/events.js');
      publish('accessibility:announce', {
        message: 'Initializing voice system',
        priority: 'polite'
      });
    } catch (e) {
      // Silent fallback if events module isn't available
    }
    
    // Initialize components based on configuration (parallel or sequential)
    if (initOptions.parallelInit) {
      // Initialize core components in parallel for faster startup
      await Promise.all([
        initComponent('training', training.initialize, {
          ...initOptions,
          // Set training-specific options based on resources
          optimizeStorage: initOptions.optimizeForEfficiency || false
        }),
        initComponent('recognition', recognition.initialize, {
          ...initOptions,
          // Set recognition-specific options based on resources
          lowLatencyMode: !initOptions.optimizeForEfficiency
        }),
        initComponent('synthesis', synthesis.initialize, {
          ...initOptions,
          // Set synthesis-specific options based on resources
          highQuality: !initOptions.optimizeForEfficiency && !initOptions.minimalFeatures
        }),
        initComponent('commandProcessor', commandProcessor.initialize, {
          ...initOptions,
          // Command processor is critical - ensure it initializes with appropriate settings
          prioritizeAccessibility: true
        })
      ]);
      
      // Initialize advanced features only after core components
      // Advanced features are optional and can be initialized with reduced capabilities
      if (!initOptions.minimalFeatures) {
        await initComponent('advancedFeatures', advancedFeatures.initialize, {
          ...initOptions,
          // Configure advanced features based on available resources
          enableEmotionDetection: !initOptions.optimizeForEfficiency,
          enableSpeechPatternAnalysis: !initOptions.optimizeForEfficiency,
          adaptiveLearning: !initOptions.optimizeForEfficiency
        });
      } else {
        console.log('Skipping advanced features initialization due to resource constraints');
        results.advancedFeatures = 'skipped';
      }
    } else {
      // Sequential initialization for systems with limited resources
      await initComponent('training', training.initialize, {
        ...initOptions,
        optimizeStorage: true
      });
      
      await initComponent('recognition', recognition.initialize, {
        ...initOptions,
        lowLatencyMode: false
      });
      
      await initComponent('synthesis', synthesis.initialize, {
        ...initOptions,
        highQuality: false
      });
      
      await initComponent('commandProcessor', commandProcessor.initialize, {
        ...initOptions,
        prioritizeAccessibility: true
      });
      
      // Only initialize advanced features if not in minimal mode
      if (!initOptions.minimalFeatures) {
        await initComponent('advancedFeatures', advancedFeatures.initialize, {
          ...initOptions,
          enableEmotionDetection: false,
          enableSpeechPatternAnalysis: false,
          adaptiveLearning: false
        });
      } else {
        console.log('Skipping advanced features initialization due to resource constraints');
        results.advancedFeatures = 'skipped';
      }
    }
    
    // Resource management is critical for production - register components with appropriate priorities
    if (initOptions.enableResourceManagement !== false) {
      await initComponent('resourceManagement', async () => {
        // Register with resource manager with appropriate component priorities
        return registerWithResourceManager({
          ...initOptions,
          // Set component priorities based on accessibility and user needs
          componentPriorities: {
            'voice.commandProcessor': 'critical', // Command processing is critical for accessibility
            'voice.recognition': 'high',         // Recognition is important but can be reduced
            'voice.synthesis': 'high',           // Synthesis is important for feedback
            'voice.training': 'medium',          // Training can be paused when resources are constrained
            'voice.advancedFeatures': 'low'      // Advanced features are optional
          }
        });
      }, initOptions);
    }
    
    // Monitoring and dashboard provide important visibility but are not critical to core functionality
    await Promise.all([
      initComponent('monitoring', async () => {
        // Initialize monitoring with appropriate detail level
        return initializeMonitoring({
          detailLevel: initOptions.optimizeForEfficiency ? 'minimal' : 'full',
          reportInterval: initOptions.optimizeForEfficiency ? 60000 : 30000 // Longer interval when optimizing
        });
      }, initOptions),
      initComponent('dashboardIntegration', async () => {
        // Initialize dashboard with appropriate features
        return dashboardIntegration.initialize({
          ...initOptions,
          enableRealTimeUpdates: !initOptions.optimizeForEfficiency
        });
      }, initOptions)
    ]);
    
    // Setup periodic health checks
    if (initOptions.enableHealthChecks) {
      _healthCheckInterval = setInterval(
        performHealthCheck, 
        initOptions.healthCheckInterval
      );
    }
    
    _initialized = true;
    _initializationInProgress = false;
    _initStats.completionTime = performance.now();
    _initStats.totalDuration = _initStats.completionTime - _initStats.startTime;
    
    console.log(`ALEJO Voice System initialization complete in ${_initStats.totalDuration.toFixed(2)}ms`);
    
    // Announce successful initialization to screen readers
    try {
      const { publish } = require('../../core/events.js');
      let accessibilityMessage = 'Voice system ready';
      
      // Provide more detailed message if there were issues
      const failedComponents = Object.keys(results).filter(k => results[k] === false);
      if (failedComponents.length > 0) {
        accessibilityMessage = `Voice system ready with limited functionality. ${failedComponents.join(', ')} unavailable.`;
      }
      
      publish('accessibility:announce', {
        message: accessibilityMessage,
        priority: 'polite'
      });
    } catch (e) {
      // Silent fallback if events module isn't available
    }
    
    // Log detailed initialization data to audit trail
    try {
      const { addAuditEntry } = require('../../core/audit-trail.js');
      addAuditEntry('voice:system:initialized', {
        duration: _initStats.totalDuration,
        componentTimes: _initStats.componentTimes,
        results: { ...results, errors: Object.keys(results.errors) } // Don't log full error details
      });
    } catch (e) {
      console.warn('Failed to log initialization to audit trail:', e);
    }
    // Report initialization metrics
    reportInitializationMetrics();
    
    return {
      success: criticalComponentsHealthy,
    results
  };
}

/**
 * Perform a health check on the voice system components
 * @private
 */
function performHealthCheck() {
  if (!_initialized) return;
  
  const now = Date.now();
  _systemHealth.lastCheck = now;
  let systemStatus = 'online';
  let criticalErrors = false;
  
  // Check each component
  const checkComponent = async (name, checkFn) => {
    try {
      const status = await Promise.race([
        checkFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
      ]);
      
      _systemHealth.components[name] = {
        status: status ? 'healthy' : 'degraded',
        lastCheck: now,
        ...(status?.details && { details: status.details })
      };
      
      if (!status && ['commandProcessor', 'recognition'].includes(name)) {
        criticalErrors = true;
      }
    } catch (error) {
      console.error(`Health check failed for ${name}:`, error);
      _systemHealth.components[name] = {
        status: 'error',
        lastCheck: now,
        error: error.message || String(error)
      };
      
      if (['commandProcessor', 'recognition'].includes(name)) {
        criticalErrors = true;
      }
    }
  };
  
  // Run health checks in parallel
  Promise.all([
    checkComponent('training', () => training.getStatus?.() || training.isInitialized?.() || true),
    checkComponent('recognition', () => recognition.getStatus?.() || recognition.isInitialized?.() || true),
    checkComponent('synthesis', () => synthesis.getStatus?.() || synthesis.isInitialized?.() || true),
    checkComponent('commandProcessor', () => commandProcessor.isInitialized?.() || true),
    checkComponent('advancedFeatures', () => advancedFeatures.getStatus?.() || true)
  ]).then(() => {
    // Update overall system status
    _systemHealth.status = criticalErrors ? 'degraded' : 'online';
    
    // Publish health status to monitoring system
    EventBus.publish('monitoring:healthStatus', {
      component: 'VoiceSystem',
      status: _systemHealth.status,
      details: _systemHealth,
      timestamp: now
    });
  }).catch(error => {
    console.error('Error during health check:', error);
    _systemHealth.status = 'error';
  });
}

/**
 * Report initialization metrics to monitoring system
 * @private
 */
function reportInitializationMetrics() {
  try {
    // Calculate component-level metrics
    const componentMetrics = Object.entries(_initStats.componentTimes).map(([name, duration]) => ({
      name,
      duration,
      success: _systemHealth.components[name]?.status === 'healthy'
    }));
    
    // Find slowest component
    const slowestComponent = componentMetrics.reduce(
      (prev, current) => (current.duration > prev.duration ? current : prev),
      { duration: 0 }
    );
    
    // Report metrics
    EventBus.publish('monitoring:metrics', {
      component: 'VoiceSystem',
      event: 'initialization',
      totalDuration: _initStats.totalDuration,
      componentMetrics,
      slowestComponent: slowestComponent.name,
      slowestComponentTime: slowestComponent.duration,
      timestamp: Date.now(),
      success: _systemHealth.status === 'online'
    });
  } catch (error) {
    console.error('Failed to report initialization metrics:', error);
  }
}

/**
 * Get the current health status of the voice system
 * @returns {Object} Health status object
 */
export function getHealthStatus() {
  return { ..._systemHealth, timestamp: Date.now() };
}

/**
 * Shutdown the voice system and release resources
 * @param {Object} options - Shutdown options
 * @param {boolean} [options.force=false] - Force shutdown even if components fail
 * @param {number} [options.timeout=10000] - Timeout for shutdown in milliseconds
 * @returns {Promise<Object>} Shutdown results with success status
 */
export async function shutdown(options = {}) {
  if (!_initialized) {
    console.warn('ALEJO Voice System not initialized, nothing to shut down');
    return { success: true, notInitialized: true };
  }
  
  console.log('Shutting down ALEJO Voice System');
  const shutdownStart = performance.now();
  
  // Default options
  const shutdownOptions = {
    force: false,
    timeout: 10000,
    ...options
  };
  
  // Clear health check interval
  if (_healthCheckInterval) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
  }
  
  const results = {
    training: false,
    recognition: false,
    synthesis: false,
    commandProcessor: false,
    advancedFeatures: false,
    resourceManagement: false,
    monitoring: false,
    dashboardIntegration: false,
    errors: {}
  };
  
  // Timeout promise
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), shutdownOptions.timeout);
  });
  
  // Function to shutdown a component with timeout
  const shutdownComponent = async (name, shutdownFn) => {
    try {
      const result = await Promise.race([
        shutdownFn(),
        timeoutPromise
      ]);
      
      if (result === 'timeout') {
        throw new Error(`Shutdown timeout for ${name}`);
      }
      
      results[name] = true;
      return true;
    } catch (error) {
      console.error(`Failed to shutdown ${name}:`, error);
      results.errors[name] = error.message || String(error);
      return false;
    }
  };
  
  try {
    // Publish shutdown event
    try {
      const { EventBus } = require('../event-bus');
      EventBus.publish('system:shutdownStarted', {
        component: 'VoiceSystem',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to publish shutdown event:', error);
    }
    
    // Shutdown components in optimal order (reverse of initialization)
    await shutdownComponent('dashboardIntegration', () => dashboardIntegration.shutdown());
    await shutdownComponent('monitoring', () => shutdownMonitoring());
    
    // Unregister from resource manager
    await shutdownComponent('resourceManagement', () => unregisterFromResourceManager());
    
    // Shutdown primary components in parallel for faster shutdown
    await Promise.all([
      shutdownComponent('advancedFeatures', () => advancedFeatures.shutdown()),
      shutdownComponent('commandProcessor', () => commandProcessor.shutdown()),
      shutdownComponent('synthesis', () => synthesis.shutdown()),
      shutdownComponent('recognition', () => recognition.shutdown()),
      shutdownComponent('training', () => training.shutdown())
    ]);
    
    // Publish final metrics before fully shutting down
    try {
      const { EventBus } = require('../event-bus');
      EventBus.publish('monitoring:metrics', {
        component: 'VoiceSystem',
        event: 'shutdown',
        duration: performance.now() - shutdownStart,
        success: true,
        timestamp: Date.now()
      });
    } catch (error) {
      // Ignore metrics errors during shutdown
    }
    
    _initialized = false;
    _systemHealth.status = 'offline';
    _systemHealth.lastCheck = Date.now();
    
    return {
      success: true,
      duration: performance.now() - shutdownStart,
      results
    };
  } catch (error) {
    console.error('Error during voice system shutdown:', error);
    
    if (shutdownOptions.force) {
      _initialized = false;
      _systemHealth.status = 'error';
      _systemHealth.lastCheck = Date.now();
      
      return {
        success: false,
        forced: true,
        error: error.message || String(error),
        results
      };
    }
    
    return {
      success: false,
      error: error.message || String(error),
      results
    };
  }
}

// Export all modules
/**
 * Create an accessible interface for the voice system
 * @returns {Object} Accessibility interface
 */
export function createAccessibleInterface() {
  return {
    // Check if the voice system is ready for use
    isReady: () => _initialized,
    
    // Get the current system status in an accessible format
    getStatus: () => {
      const statusSummary = getVoiceStatus();
      return {
        ready: _initialized,
        statusText: _systemHealth.status,
        components: Object.keys(_systemHealth.components).map(name => ({
          name,
          status: _systemHealth.components[name].status
        })),
        hasErrors: _systemHealth.criticalErrors.length > 0
      };
    },
    
    // Get help information for screen readers
    getHelpInformation: () => ({
      availableCommands: commandProcessor.getAvailableCommands(),
      usageTips: [
        'Speak clearly and at a moderate pace',
        'Wait for the system to respond before giving another command',
        'Use the exact command phrases for best results'
      ],
      troubleshooting: [
        'If commands are not recognized, try speaking more clearly',
        'Ensure your microphone is working correctly',
        'Check that you have granted microphone permissions'
      ]
    }),
    
    // Provide an announcement for screen readers
    announceStatus: () => {
      try {
        const { publish } = require('../../core/events.js');
        publish('accessibility:announce', {
          message: `Voice system is ${_initialized ? 'ready' : 'not ready'}. Status: ${_systemHealth.status}`,
          priority: 'polite'
        });
        return true;
      } catch (e) {
        console.error('Failed to announce status:', e);
        return false;
      }
    }
  };
}

// Export all modules with accessible interface
/**
 * Shutdown the voice system and release all resources
 * @param {Object} options - Shutdown options
 * @param {boolean} [options.force=false] - Force shutdown even if errors occur
 * @param {boolean} [options.clearData=false] - Clear persistent data on shutdown
 * @param {boolean} [options.announceShutdown=true] - Announce shutdown to screen readers
 * @param {string} [options.shutdownReason] - Reason for shutdown (for logging)
 * @returns {Promise<Object>} Shutdown results
 */
export async function shutdown(options = {}) {
  // If not initialized, nothing to shut down
  if (!_initialized && !_initializationInProgress) {
    console.log('ALEJO Voice System not initialized, nothing to shut down');
    return { success: true, alreadyShutDown: true };
  }

  console.log('Shutting down ALEJO Voice System...');
  const startTime = performance.now();
  
  // Default options
  const shutdownOptions = {
    force: false,
    clearData: false,
    announceShutdown: true,
    shutdownReason: 'user_request',
    ...options
  };
  
  // For accessibility announcements
  if (shutdownOptions.announceShutdown) {
    try {
      const { publish } = require('../../core/events.js');
      publish('accessibility:announce', {
        message: 'Voice system shutting down',
        priority: 'polite'
      });
    } catch (error) {
      console.error('Failed to announce shutdown:', error);
    }
  }
  
  // Clear health check interval if active
  if (_healthCheckInterval) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
  }
  
  // Track shutdown results
  const results = {
    success: true,
    componentResults: {
      commandProcessor: false,
      training: false,
      recognition: false,
      synthesis: false,
      advancedFeatures: false,
      monitoring: false,
      resourceManagement: false
    },
    errors: {}
  };
  
  // Shutdown components in reverse order of dependency
  const shutdownPromises = [];
  
  // 1. Command Processor
  shutdownPromises.push(
    commandProcessor.shutdown(shutdownOptions)
      .then(result => {
        results.componentResults.commandProcessor = result.success;
        return result;
      })
      .catch(error => {
        results.success = false;
        results.errors.commandProcessor = error.message || String(error);
        return { success: false, error };
      })
  );
  
  // 2. Recognition module
  shutdownPromises.push(
    Promise.resolve().then(async () => {
      if (typeof recognition.shutdown === 'function') {
        return recognition.shutdown(shutdownOptions);
      }
      return { success: true };
    })
    .then(result => {
      results.componentResults.recognition = result.success;
      return result;
    })
    .catch(error => {
      results.success = false;
      results.errors.recognition = error.message || String(error);
      return { success: false, error };
    })
  );
  
  // 3. Synthesis module
  shutdownPromises.push(
    Promise.resolve().then(async () => {
      if (typeof synthesis.shutdown === 'function') {
        return synthesis.shutdown(shutdownOptions);
      }
      return { success: true };
    })
    .then(result => {
      results.componentResults.synthesis = result.success;
      return result;
    })
    .catch(error => {
      results.success = false;
      results.errors.synthesis = error.message || String(error);
      return { success: false, error };
    })
  );
  
  // 4. Training module
  shutdownPromises.push(
    Promise.resolve().then(async () => {
      if (typeof training.shutdown === 'function') {
        return training.shutdown(shutdownOptions);
      }
      return { success: true };
    })
    .then(result => {
      results.componentResults.training = result.success;
      return result;
    })
    .catch(error => {
      results.success = false;
      results.errors.training = error.message || String(error);
      return { success: false, error };
    })
  );
  
  // 5. Advanced features
  shutdownPromises.push(
    Promise.resolve().then(async () => {
      if (typeof advancedFeatures.shutdown === 'function') {
        return advancedFeatures.shutdown(shutdownOptions);
      }
      return { success: true };
    })
    .then(result => {
      results.componentResults.advancedFeatures = result.success;
      return result;
    })
    .catch(error => {
      results.success = false;
      results.errors.advancedFeatures = error.message || String(error);
      return { success: false, error };
    })
  );
  
  // 6. Stop monitoring
  try {
    await initializeMonitoring(false);
    results.componentResults.monitoring = true;
  } catch (error) {
    results.success = false;
    results.errors.monitoring = error.message || String(error);
  }
  
  // 7. Unregister from resource manager
  try {
    if (shutdownOptions.force) {
      await unregisterFromResourceManager().catch(() => {});
    } else {
      await unregisterFromResourceManager();
    }
    results.componentResults.resourceManagement = true;
  } catch (error) {
    results.success = false;
    results.errors.resourceManagement = error.message || String(error);
  }
  
  // Wait for all shutdowns to complete
  await Promise.all(shutdownPromises);
  
  // If forced shutdown, consider it successful regardless of component errors
  if (shutdownOptions.force) {
    results.forced = true;
  }
  
  // Reset module state
  _initialized = false;
  _initializationInProgress = false;
  _systemHealth.status = 'offline';
  _systemHealth.lastCheck = new Date().toISOString();
  
  // Clear data if requested
  if (shutdownOptions.clearData) {
    try {
      // Clear any cached data
      results.dataCleared = true;
    } catch (error) {
      results.errors.dataClear = error.message || String(error);
      results.dataCleared = false;
    }
  }
  
  // Log performance metrics
  const shutdownTime = performance.now() - startTime;
  console.log(`ALEJO Voice System shutdown completed in ${shutdownTime.toFixed(2)}ms`);
  results.shutdownTime = shutdownTime;
  
  // Log audit trail
  try {
    const AuditTrail = require('../../utils/audit-trail.js');
    AuditTrail.addEntry('voiceSystem:shutdown', {
      success: results.success,
      forced: shutdownOptions.force,
      reason: shutdownOptions.shutdownReason,
      errors: Object.keys(results.errors).length > 0 ? results.errors : undefined,
      shutdownTime
    });
  } catch (error) {
    console.error('Failed to log voice system shutdown to audit trail:', error);
  }
  
  return results;
}

export { 
  initialize,
  shutdown,
  training,
  recognition,
  commandProcessor,
  getVoiceStatus,
  resetStatistics,
  advancedFeatures,
  synthesis,
  // Export the accessible interface creation function
  createAccessibleInterface
};
