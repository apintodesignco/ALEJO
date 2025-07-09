/**
 * ALEJO Performance Integration Module
 * 
 * This module integrates all performance-related components:
 * - Resource Allocation Manager
 * - Performance Logger
 * - Resource Monitoring Dashboard
 * 
 * It provides a unified interface for performance monitoring and management
 * while ensuring all components work together seamlessly.
 */

import { ResourceAllocationManager } from './resource-allocation-manager.js';
import { 
  initializePerformanceLogger, 
  logResourceUsage, 
  logPerformanceEvent,
  generatePerformanceReport 
} from './performance-logger.js';
import { 
  initializeResourceDashboard, 
  showDashboard, 
  hideDashboard, 
  toggleDashboard 
} from './resource-monitoring-dashboard.js';
import { publishEvent, subscribeToEvent } from '../core/neural-architecture/neural-event-bus.js';

// Integration state
const integrationState = {
  isInitialized: false,
  resourceMonitoringInterval: 5000, // ms
  monitoringTimer: null,
  autoReportInterval: 3600000, // 1 hour in ms
  autoReportTimer: null
};

/**
 * Initialize the performance management system
 * @param {Object} options - Initialization options
 * @param {boolean} options.enableDashboard - Whether to enable the resource dashboard
 * @param {boolean} options.enableAutoReporting - Whether to enable automatic performance reporting
 * @param {number} options.resourceMonitoringInterval - Interval for resource monitoring in ms
 * @param {number} options.autoReportInterval - Interval for automatic reporting in ms
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializePerformanceManagement(options = {}) {
  try {
    console.log('Initializing Performance Management System');
    
    const {
      enableDashboard = true,
      enableAutoReporting = true,
      resourceMonitoringInterval = 5000,
      autoReportInterval = 3600000 // 1 hour
    } = options;
    
    // Update state
    integrationState.resourceMonitoringInterval = resourceMonitoringInterval;
    integrationState.autoReportInterval = autoReportInterval;
    
    // Initialize components
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Initialize performance logger
    const loggerResult = await initializePerformanceLogger();
    
    // Log initialization event
    logPerformanceEvent('performance-management-initializing', options);
    
    // Initialize dashboard if enabled
    let dashboardResult = null;
    if (enableDashboard) {
      dashboardResult = await initializeResourceDashboard();
    }
    
    // Set up event subscriptions
    setupEventSubscriptions();
    
    // Start resource monitoring
    startResourceMonitoring();
    
    // Start auto-reporting if enabled
    if (enableAutoReporting) {
      startAutoReporting();
    }
    
    // Mark as initialized
    integrationState.isInitialized = true;
    
    // Log completion
    logPerformanceEvent('performance-management-initialized', {
      enableDashboard,
      enableAutoReporting,
      resourceMonitoringInterval,
      autoReportInterval
    });
    
    // Publish initialization event
    publishEvent('performance:system-initialized', {
      enableDashboard,
      enableAutoReporting
    });
    
    return {
      success: true,
      resourceManager,
      loggerInitialized: loggerResult.success,
      dashboardInitialized: dashboardResult?.success || false
    };
  } catch (error) {
    console.error('Failed to initialize performance management system', error);
    logPerformanceEvent('performance-management-init-failed', {
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Start resource monitoring
 * @returns {boolean} - Whether monitoring was started
 */
function startResourceMonitoring() {
  // Clear any existing timer
  if (integrationState.monitoringTimer) {
    clearInterval(integrationState.monitoringTimer);
  }
  
  // Set up resource monitoring
  integrationState.monitoringTimer = setInterval(async () => {
    try {
      const resourceManager = await ResourceAllocationManager.getInstance();
      const resourceUsage = await resourceManager.getCurrentResourceUsage();
      
      // Log resource usage
      logResourceUsage(resourceUsage);
      
      // Publish resource update event
      publishEvent('performance:resource-update', resourceUsage);
      
    } catch (error) {
      console.error('Error monitoring resources', error);
    }
  }, integrationState.resourceMonitoringInterval);
  
  return true;
}

/**
 * Start automatic performance reporting
 * @returns {boolean} - Whether auto-reporting was started
 */
function startAutoReporting() {
  // Clear any existing timer
  if (integrationState.autoReportTimer) {
    clearInterval(integrationState.autoReportTimer);
  }
  
  // Set up auto-reporting
  integrationState.autoReportTimer = setInterval(() => {
    try {
      // Generate report
      const report = generatePerformanceReport({
        timeRange: integrationState.autoReportInterval
      });
      
      // Publish report event
      publishEvent('performance:auto-report-generated', {
        reportId: `auto_${Date.now()}`,
        reportSummary: {
          timeRangeMs: report.timeRange.durationMs,
          eventCount: report.summary.eventCount,
          metricCount: report.summary.metricCount
        }
      });
      
    } catch (error) {
      console.error('Error generating automatic performance report', error);
    }
  }, integrationState.autoReportInterval);
  
  return true;
}

/**
 * Set up event subscriptions
 */
function setupEventSubscriptions() {
  // Resource mode changes
  subscribeToEvent('resource-manager:mode-changed', handleResourceModeChanged);
  
  // Component registration/unregistration
  subscribeToEvent('resource-manager:component-registered', handleComponentRegistered);
  subscribeToEvent('resource-manager:component-unregistered', handleComponentUnregistered);
  
  // Critical resource events
  subscribeToEvent('resource-manager:critical-cpu', handleCriticalResourceEvent);
  subscribeToEvent('resource-manager:critical-memory', handleCriticalResourceEvent);
  
  // Dashboard toggle events
  subscribeToEvent('ui:toggle-performance-dashboard', handleDashboardToggle);
  
  // System initialization events
  subscribeToEvent('system:initialization:complete', handleSystemInitialized);
  subscribeToEvent('system:initialization:failed', handleSystemInitializationFailed);
}

/**
 * Handle resource mode changes
 * @param {Object} data - Event data
 */
function handleResourceModeChanged(data) {
  logPerformanceEvent('resource-mode-changed', {
    mode: data.mode,
    previousMode: data.previousMode,
    reason: data.reason
  });
}

/**
 * Handle component registration
 * @param {Object} data - Event data
 */
function handleComponentRegistered(data) {
  logPerformanceEvent('component-registered', {
    componentId: data.componentId,
    cpuPriority: data.cpuPriority,
    memoryFootprint: data.memoryFootprint,
    isEssential: data.isEssential
  });
}

/**
 * Handle component unregistration
 * @param {Object} data - Event data
 */
function handleComponentUnregistered(data) {
  logPerformanceEvent('component-unregistered', {
    componentId: data.componentId
  });
}

/**
 * Handle critical resource events
 * @param {Object} data - Event data
 */
function handleCriticalResourceEvent(data) {
  const eventType = data.type || 'unknown';
  
  logPerformanceEvent(`critical-resource-${eventType}`, {
    value: data.value,
    threshold: data.threshold,
    components: data.affectedComponents
  });
  
  // Show dashboard on critical events if not already visible
  showDashboard();
}

/**
 * Handle dashboard toggle request
 */
function handleDashboardToggle() {
  toggleDashboard();
}

/**
 * Handle system initialization complete
 * @param {Object} data - Event data
 */
function handleSystemInitialized(data) {
  logPerformanceEvent('system-initialized', {
    duration: data.duration,
    componentCount: data.initialized.length,
    failedCount: data.failed.length
  });
}

/**
 * Handle system initialization failure
 * @param {Object} data - Event data
 */
function handleSystemInitializationFailed(data) {
  logPerformanceEvent('system-initialization-failed', {
    error: data.error
  });
}

/**
 * Update resource monitoring interval
 * @param {number} interval - New interval in ms
 * @returns {boolean} - Whether update was successful
 */
export function updateResourceMonitoringInterval(interval) {
  if (typeof interval !== 'number' || interval < 1000) {
    console.error('Invalid monitoring interval. Must be at least 1000ms.');
    return false;
  }
  
  integrationState.resourceMonitoringInterval = interval;
  
  // Restart monitoring with new interval
  startResourceMonitoring();
  
  logPerformanceEvent('monitoring-interval-updated', {
    interval
  });
  
  return true;
}

/**
 * Update auto-reporting interval
 * @param {number} interval - New interval in ms
 * @returns {boolean} - Whether update was successful
 */
export function updateAutoReportingInterval(interval) {
  if (typeof interval !== 'number' || interval < 60000) {
    console.error('Invalid auto-reporting interval. Must be at least 60000ms (1 minute).');
    return false;
  }
  
  integrationState.autoReportInterval = interval;
  
  // Restart auto-reporting with new interval
  if (integrationState.autoReportTimer) {
    startAutoReporting();
  }
  
  logPerformanceEvent('auto-reporting-interval-updated', {
    interval
  });
  
  return true;
}

/**
 * Generate an on-demand performance report
 * @param {Object} options - Report options
 * @param {number} options.timeRange - Time range in milliseconds
 * @param {boolean} options.includeResourceUsage - Whether to include resource usage
 * @returns {Promise<Object>} - Performance report
 */
export async function generateOnDemandReport(options = {}) {
  try {
    const report = generatePerformanceReport(options);
    
    logPerformanceEvent('on-demand-report-generated', {
      timeRangeMs: report.timeRange.durationMs,
      eventCount: report.summary.eventCount
    });
    
    return report;
  } catch (error) {
    console.error('Failed to generate on-demand report', error);
    throw error;
  }
}

/**
 * Get the current resource usage
 * @returns {Promise<Object>} - Current resource usage
 */
export async function getCurrentResourceUsage() {
  try {
    const resourceManager = await ResourceAllocationManager.getInstance();
    return resourceManager.getCurrentResourceUsage();
  } catch (error) {
    console.error('Failed to get current resource usage', error);
    throw error;
  }
}

/**
 * Set the resource mode
 * @param {string} mode - Resource mode (performance, balanced, efficiency)
 * @returns {Promise<boolean>} - Whether mode was set
 */
export async function setResourceMode(mode) {
  try {
    const resourceManager = await ResourceAllocationManager.getInstance();
    await resourceManager.setResourceMode(mode);
    
    logPerformanceEvent('resource-mode-set', {
      mode
    });
    
    return true;
  } catch (error) {
    console.error('Failed to set resource mode', error);
    return false;
  }
}

/**
 * Pause a component to reduce resource usage
 * @param {string} componentId - Component ID
 * @returns {Promise<boolean>} - Whether component was paused
 */
export async function pauseComponent(componentId) {
  try {
    const resourceManager = await ResourceAllocationManager.getInstance();
    const result = await resourceManager.pauseComponent(componentId);
    
    if (result) {
      logPerformanceEvent('component-paused', {
        componentId
      });
    }
    
    return result;
  } catch (error) {
    console.error(`Failed to pause component ${componentId}`, error);
    return false;
  }
}

/**
 * Resume a paused component
 * @param {string} componentId - Component ID
 * @returns {Promise<boolean>} - Whether component was resumed
 */
export async function resumeComponent(componentId) {
  try {
    const resourceManager = await ResourceAllocationManager.getInstance();
    const result = await resourceManager.resumeComponent(componentId);
    
    if (result) {
      logPerformanceEvent('component-resumed', {
        componentId
      });
    }
    
    return result;
  } catch (error) {
    console.error(`Failed to resume component ${componentId}`, error);
    return false;
  }
}

/**
 * Get the performance management system status
 * @returns {Object} - System status
 */
export function getPerformanceManagementStatus() {
  return {
    isInitialized: integrationState.isInitialized,
    resourceMonitoringInterval: integrationState.resourceMonitoringInterval,
    autoReportInterval: integrationState.autoReportInterval,
    isMonitoringActive: !!integrationState.monitoringTimer,
    isAutoReportingActive: !!integrationState.autoReportTimer
  };
}

/**
 * Clean up resources when shutting down
 * @returns {Promise<boolean>} - Whether cleanup was successful
 */
export async function cleanupPerformanceManagement() {
  try {
    // Clear timers
    if (integrationState.monitoringTimer) {
      clearInterval(integrationState.monitoringTimer);
      integrationState.monitoringTimer = null;
    }
    
    if (integrationState.autoReportTimer) {
      clearInterval(integrationState.autoReportTimer);
      integrationState.autoReportTimer = null;
    }
    
    // Log cleanup event
    logPerformanceEvent('performance-management-cleanup');
    
    // Reset state
    integrationState.isInitialized = false;
    
    return true;
  } catch (error) {
    console.error('Error during performance management cleanup', error);
    return false;
  }
}
