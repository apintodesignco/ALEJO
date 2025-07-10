/**
 * @file dashboard-integration.js
 * @description Integrates voice system monitoring with the ALEJO monitoring dashboard
 * @module personalization/voice/dashboard-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import * as MonitoringIntegration from './monitoring-integration.js';
import * as ResourceThresholdConfig from '../../performance/resource-threshold-config.js';

// Initialize logger
const logger = new Logger('VoiceDashboardIntegration');

// State management
const state = {
  isInitialized: false,
  eventBus: EventBus.getInstance(),
  updateInterval: null,
  lastUpdate: null,
  metrics: {
    status: {},
    performance: {},
    errors: [],
    resourceUsage: {}
  },
  thresholds: {},
  preferences: {}
};

/**
 * Initialize the voice dashboard integration
 * @returns {Promise<boolean>} Whether initialization succeeded
 */
export async function initialize() {
  if (state.isInitialized) {
    logger.warn('Voice dashboard integration already initialized');
    return true;
  }

  try {
    // Subscribe to voice monitoring events
    state.eventBus.on('voice:status', handleVoiceStatus);
    state.eventBus.on('voice:performance', handleVoicePerformance);
    state.eventBus.on('voice:error', handleVoiceError);
    state.eventBus.on('voice:resource-usage', handleVoiceResourceUsage);
    
    // Subscribe to resource threshold events
    state.eventBus.on('resource-thresholds:config', handleResourceThresholds);
    state.eventBus.on('resource-thresholds:updated', handleThresholdUpdate);
    
    // Request current voice status
    requestCurrentStatus();
    
    // Request resource thresholds
    requestResourceThresholds();
    
    // Set up regular updates for the dashboard
    setupRegularUpdates();
    
    state.isInitialized = true;
    logger.info('Voice dashboard integration initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize voice dashboard integration', error);
    return false;
  }
}

/**
 * Shutdown the voice dashboard integration
 */
export function shutdown() {
  if (!state.isInitialized) {
    return;
  }
  
  // Clear update interval
  if (state.updateInterval) {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  }
  
  // Unsubscribe from events
  state.eventBus.off('voice:status', handleVoiceStatus);
  state.eventBus.off('voice:performance', handleVoicePerformance);
  state.eventBus.off('voice:error', handleVoiceError);
  state.eventBus.off('voice:resource-usage', handleVoiceResourceUsage);
  state.eventBus.off('resource-thresholds:config', handleResourceThresholds);
  state.eventBus.off('resource-thresholds:updated', handleThresholdUpdate);
  
  state.isInitialized = false;
  logger.info('Voice dashboard integration shut down');
}

/**
 * Setup regular updates for the dashboard
 */
function setupRegularUpdates() {
  state.updateInterval = setInterval(() => {
    publishDashboardUpdate();
  }, 5000); // Update every 5 seconds
}

/**
 * Request current voice system status
 */
function requestCurrentStatus() {
  state.metrics.status = MonitoringIntegration.getVoiceStatus() || {};
  state.metrics.performance = MonitoringIntegration.getVoicePerformanceMetrics() || {};
  state.metrics.errors = MonitoringIntegration.getVoiceErrors() || [];
  state.metrics.resourceUsage = MonitoringIntegration.getVoiceResourceUsage() || {};
}

/**
 * Request current resource thresholds
 */
function requestResourceThresholds() {
  state.eventBus.emit('resource-thresholds:request-config');
}

/**
 * Publish an update to the monitoring dashboard
 */
function publishDashboardUpdate() {
  if (!state.isInitialized) return;
  
  // Get latest metrics
  requestCurrentStatus();
  
  // Publish update to dashboard
  state.eventBus.emit('dashboard:voice-update', {
    timestamp: new Date(),
    status: state.metrics.status,
    performance: state.metrics.performance,
    errors: state.metrics.errors,
    resourceUsage: state.metrics.resourceUsage,
    thresholds: state.thresholds
  });
  
  state.lastUpdate = new Date();
  logger.debug('Published voice dashboard update');
}

/**
 * Handle voice status update
 * @param {Object} data - Voice status data
 */
function handleVoiceStatus(data) {
  state.metrics.status = { ...data };
  
  // Check if any components are in a critical state
  const criticalComponents = Object.entries(data)
    .filter(([_, status]) => status === 'critical' || status === 'error')
    .map(([component]) => component);
    
  if (criticalComponents.length > 0) {
    // Emit critical status event
    state.eventBus.emit('dashboard:voice-critical', {
      components: criticalComponents,
      timestamp: new Date()
    });
  }
}

/**
 * Handle voice performance metrics update
 * @param {Object} data - Voice performance data
 */
function handleVoicePerformance(data) {
  state.metrics.performance = { ...data };
  
  // Check if any metrics exceed thresholds
  checkPerformanceThresholds(data);
}

/**
 * Handle voice error update
 * @param {Object} data - Voice error data
 */
function handleVoiceError(data) {
  // Add error to beginning of array
  state.metrics.errors.unshift({
    ...data,
    timestamp: data.timestamp || new Date()
  });
  
  // Keep only the last 100 errors
  if (state.metrics.errors.length > 100) {
    state.metrics.errors = state.metrics.errors.slice(0, 100);
  }
  
  // Emit error event to dashboard
  state.eventBus.emit('dashboard:voice-error', {
    error: data,
    timestamp: new Date()
  });
}

/**
 * Handle voice resource usage update
 * @param {Object} data - Voice resource usage data
 */
function handleVoiceResourceUsage(data) {
  state.metrics.resourceUsage = { ...data };
  
  // Check if resource usage exceeds thresholds
  checkResourceThresholds(data);
}

/**
 * Handle resource thresholds update
 * @param {Object} data - Resource thresholds configuration
 */
function handleResourceThresholds(data) {
  state.thresholds = data.thresholds || state.thresholds;
  state.preferences = data.preferences || state.preferences;
  
  // Re-check current resource usage against new thresholds
  if (state.metrics.resourceUsage) {
    checkResourceThresholds(state.metrics.resourceUsage);
  }
}

/**
 * Handle threshold update
 * @param {Object} data - Threshold update data
 */
function handleThresholdUpdate(data) {
  if (!state.thresholds[data.resource]) {
    state.thresholds[data.resource] = {};
  }
  
  state.thresholds[data.resource][data.level] = data.value;
  
  // Re-check current resource usage against updated threshold
  if (state.metrics.resourceUsage && 
      state.metrics.resourceUsage[data.resource] !== undefined) {
    
    const usage = state.metrics.resourceUsage;
    checkSpecificThreshold(data.resource, usage[data.resource]);
  }
}

/**
 * Check performance metrics against thresholds
 * @param {Object} metrics - Performance metrics
 */
function checkPerformanceThresholds(metrics) {
  // Implementation depends on specific metrics collected
  // Example: check latency against threshold
  if (metrics.latency !== undefined && 
      state.thresholds.voice && 
      state.thresholds.voice.latency) {
    
    const latency = metrics.latency;
    const warning = state.thresholds.voice.latency.warning;
    const critical = state.thresholds.voice.latency.critical;
    
    if (critical !== undefined && latency >= critical) {
      state.eventBus.emit('dashboard:voice-threshold-exceeded', {
        metric: 'latency',
        value: latency,
        threshold: critical,
        level: 'critical',
        timestamp: new Date()
      });
    } else if (warning !== undefined && latency >= warning) {
      state.eventBus.emit('dashboard:voice-threshold-exceeded', {
        metric: 'latency',
        value: latency,
        threshold: warning,
        level: 'warning',
        timestamp: new Date()
      });
    }
  }
}

/**
 * Check resource usage against thresholds
 * @param {Object} usage - Resource usage data
 */
function checkResourceThresholds(usage) {
  // Check CPU usage
  if (usage.cpu !== undefined) {
    checkSpecificThreshold('cpu', usage.cpu);
  }
  
  // Check memory usage
  if (usage.memory !== undefined) {
    checkSpecificThreshold('memory', usage.memory);
  }
}

/**
 * Check a specific resource against its threshold
 * @param {string} resource - Resource name
 * @param {number} value - Current value
 */
function checkSpecificThreshold(resource, value) {
  if (!state.thresholds[resource]) return;
  
  const warning = state.thresholds[resource].warning;
  const critical = state.thresholds[resource].critical;
  
  if (critical !== undefined && value >= critical) {
    state.eventBus.emit('dashboard:voice-resource-threshold-exceeded', {
      resource,
      value,
      threshold: critical,
      level: 'critical',
      timestamp: new Date(),
      component: 'voice'
    });
  } else if (warning !== undefined && value >= warning) {
    state.eventBus.emit('dashboard:voice-resource-threshold-exceeded', {
      resource,
      value,
      threshold: warning,
      level: 'warning',
      timestamp: new Date(),
      component: 'voice'
    });
  }
}

/**
 * Get the latest voice dashboard data
 * @returns {Object} Latest voice dashboard data
 */
export function getVoiceDashboardData() {
  return {
    timestamp: state.lastUpdate || new Date(),
    status: state.metrics.status,
    performance: state.metrics.performance,
    errors: state.metrics.errors,
    resourceUsage: state.metrics.resourceUsage,
    thresholds: state.thresholds
  };
}
