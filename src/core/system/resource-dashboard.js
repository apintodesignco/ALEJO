/**
 * @file resource-dashboard.js
 * @description System-wide resource monitoring dashboard for ALEJO
 * @module core/system/resource-dashboard
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../event-bus.js';
import { ConfigManager } from '../config-manager.js';
import { Logger } from '../logger.js';
import { getResourceAllocationManager, RESOURCE_MODES } from '../../performance/resource-allocation-manager.js';
import { getResourceThresholdConfig, DEFAULT_THRESHOLDS, THRESHOLD_STEPS } from '../../performance/resource-threshold-config.js';
import { createResourceThresholdUI } from './resource-threshold-ui.js';
import { addResourceThresholdSection, createThresholdConfigButton } from './resource-threshold-section.js';
import { getAuditTrail } from '../../security/audit-trail.js';
import { getAccessibilityStatus } from '../../personalization/accessibility/accessibility-status.js';
import { announce } from '../../personalization/accessibility/screen-reader-announcements.js';
import { isHighContrastMode } from '../../personalization/accessibility/high-contrast-mode.js';
import { getRecoveryStatusSummary } from '../component-recovery-manager.js';
import { initializeRecoveryStatusUI } from './recovery-status-ui.js';
import componentHealthMonitor from './component-health-monitor.js';
import { createHealthStatusSection, updateHealthStatusFromMonitor, cleanupHealthStatusUI } from './health-status-ui.js';

// Import styles
import '../../styles/resource-dashboard.css';
import '../../styles/resource-alerts.css';
import '../../styles/resource-dashboard-thresholds.css';
import '../../styles/health-status-ui.css';

// Initialize logger
const logger = new Logger('ResourceDashboard');

// Dashboard state
let dashboardElement = null;
let isVisible = false;
let updateInterval = null;
let resourceManager = null;
let thresholdConfig = null;
let eventBus = null;
let configManager = null;
let auditTrail = null;
let initialized = false;
let healthMonitorInitialized = false;

// Dashboard DOM IDs
const DASHBOARD_ID = 'alejo-resource-dashboard';
const CONTAINER_ID = 'alejo-resource-dashboard-container';
const TRENDS_CONTAINER_ID = 'alejo-resource-trends-container';
const RECOMMENDATIONS_ID = 'alejo-resource-recommendations';

const dashboardState = {
  isVisible: false,
  minimizeDuringRecovery: true, // Whether to minimize dashboard when recovery UI opens
  resources: {
    cpu: { current: 0, history: [], trend: 'stable' },
    memory: { current: 0, history: [], trend: 'stable' },
    temperature: { current: 0, history: [], trend: 'stable' },
    disk: { current: 0, history: [], trend: 'stable' },
    battery: { current: 0, history: [], trend: 'stable', charging: false }
  },
  thresholds: { ...DEFAULT_THRESHOLDS },
  updateInterval: 2000,
  historyLimit: 60,
  showTrends: true,              // Whether to show trend visualizations
  showRecommendations: true,     // Whether to show resource recommendations
  compactMode: false,           // Whether dashboard is in compact mode
  eventBus: EventBus.getInstance(),
  logger: new Logger('ResourceDashboard'),
  auditTrail: new AuditTrail('resource-dashboard'),
  accessibilitySettings: {
    highContrast: false,
    largeText: false,
    reducedMotion: false
  },
  alerts: [],
  recommendations: [],          // System recommendations based on resource usage
  currentResourceMode: 'normal',
  userThresholdChanges: false,  // Flag to track if user has customized thresholds
  lastTrendUpdate: 0,           // Timestamp of last trend analysis
  trendUpdateInterval: 10000    // Only update trends every 10 seconds
};

/**
 * Initialize the resource dashboard
 * @param {Object} options - Dashboard initialization options
 * @param {boolean} [options.autoShow=false] - Whether to show dashboard after initialization
 * @param {number} [options.updateInterval=2000] - Update interval in ms
 * @param {HTMLElement} [options.container] - Optional container to append dashboard to
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export async function initializeResourceDashboard(options = {}) {
  try {
    if (initialized) {
      logger.warn('Resource dashboard already initialized');
      return true;
    }

    const { autoShow = false, updateInterval: interval = 2000, container } = options;

    // Get dependencies
    resourceManager = getResourceAllocationManager();
    thresholdConfig = getResourceThresholdConfig();
    eventBus = EventBus;
    configManager = ConfigManager;
    auditTrail = getAuditTrail();
  
    // Initialize component health monitor
    try {
      await componentHealthMonitor.initialize({
        autoCheckInterval: 5 * 60 * 1000, // 5 minutes
        checkTimeout: 10000, // 10 seconds
        criticalComponents: [
          'voiceSystem',
          'gestureSystem',
          'faceRecognition',
          'memorySystem',
          'reasoningEngine'
        ]
      });
      healthMonitorInitialized = true;
      logger.info('Component health monitor initialized');
    } catch (error) {
      logger.error('Failed to initialize component health monitor', error);
    }

    // Set up event listeners
    setupEventListeners();
  
    // Register health check listeners if health monitor was initialized
    if (healthMonitorInitialized) {
      registerComponentHealthCheckers();
    }

    // Create dashboard element
    dashboardElement = createDashboardElement();
    
    // Append to container if provided, otherwise to body
    if (container && container instanceof HTMLElement) {
      container.appendChild(dashboardElement);
    } else {
      const dashboardContainer = document.createElement('div');
      dashboardContainer.id = CONTAINER_ID;
      dashboardContainer.appendChild(dashboardElement);
      document.body.appendChild(dashboardContainer);
    }

    // Setup update interval
    updateInterval = setInterval(updateDashboard, interval);

    // Apply accessibility settings
    applyAccessibilitySettings();
    
    // Show dashboard if requested
    if (autoShow) {
      showResourceDashboard();
    }

    // Mark as initialized
    initialized = true;

    // Log initialization
    logger.info('Resource dashboard initialized');
    auditTrail.log('system:dashboard', 'Resource dashboard initialized', { autoShow });
    
    // Initial update
    updateDashboard();

    return true;
  } catch (error) {
    logger.error('Failed to initialize resource dashboard', error);
    return false;
  }
}

/**
 * Set up event listeners for dashboard
 */
function setupEventListeners() {
  eventBus.subscribe('resource:thresholdCrossed', handleThresholdCrossed);
  eventBus.subscribe('resource:modeChanged', handleResourceModeChanged);
  eventBus.subscribe('threshold:configUpdated', handleThresholdConfig);
  eventBus.subscribe('threshold:updated', handleThresholdUpdate);
  eventBus.subscribe('threshold:bulkUpdate', handleBulkThresholdUpdate);
  eventBus.subscribe('threshold:reset', handleThresholdReset);
  eventBus.subscribe('threshold:apply', handleThresholdApply);
  eventBus.subscribe('monitoring:systemHealth', handleSystemHealthUpdate);
  eventBus.subscribe('monitoring:componentStatus', handleComponentStatusUpdate);

  // Listen for dashboard toggle events
  dashboardState.eventBus.on('dashboard:toggle', toggleDashboard);
  dashboardState.eventBus.on('dashboard:show', showDashboard);
  dashboardState.eventBus.on('dashboard:hide', hideDashboard);
  
  // Listen for resource update events
  dashboardState.eventBus.on('resources:update', handleResourceUpdate);
  
  // Listen for accessibility setting changes
  dashboardState.eventBus.on('accessibility:preference-change', handleAccessibilityChange);
  
  // Listen for resource mode changes
  dashboardState.eventBus.on('resource-allocation:mode-change', handleResourceModeChange);
  
  // Listen for threshold configuration events
  dashboardState.eventBus.on('resource-thresholds:config', handleThresholdConfig);
  dashboardState.eventBus.on('resource-thresholds:updated', handleThresholdUpdate);
  dashboardState.eventBus.on('resource-thresholds:bulk-update', handleBulkThresholdUpdate);
  dashboardState.eventBus.on('resource-thresholds:reset', handleThresholdReset);
  dashboardState.eventBus.on('resource-thresholds:apply', handleThresholdApply);
  dashboardState.eventBus.on('dashboard:open-resource-config', openThresholdConfig);
}

/**
 * Register health check functions for various system components
 */
function registerComponentHealthCheckers() {
  // Import component modules dynamically to avoid circular dependencies
  import('../../personalization/voice/index.js')
    .then(voiceModule => {
      // Register health check functions for voice system (dynamic import to avoid circular dependencies)
      import('../voice/voice-system-health.js')
        .then(voiceSystemHealth => {
          if (typeof voiceSystemHealth.checkVoiceSystemHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('voiceSystem', voiceSystemHealth.checkVoiceSystemHealth, true);
            logger.info('Registered voice system health check function');
          } else {
            logger.warn('Voice system health check function not available');
          }
        })
        .catch(error => {
          logger.error('Failed to import voice system health module', error);
        });

      // Register health check functions for face recognition system
      import('../vision/vision-system-health.js')
        .then(visionSystemHealth => {
          if (typeof visionSystemHealth.checkFaceRecognitionHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('faceRecognition', visionSystemHealth.checkFaceRecognitionHealth, true);
            logger.info('Registered face recognition health check function');
          } else {
            logger.warn('Face recognition health check function not available');
          }
          
          // Register gesture system health check
          if (typeof visionSystemHealth.checkGestureSystemHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('gestureSystem', visionSystemHealth.checkGestureSystemHealth, true);
            logger.info('Registered gesture system health check function');
          } else {
            logger.warn('Gesture system health check function not available');
          }
        })
        .catch(error => {
          logger.error('Failed to import vision system health module', error);
        });
        
      // Register health check functions for memory system
      import('../memory/memory-system-health.js')
        .then(memorySystemHealth => {
          if (typeof memorySystemHealth.checkMemoryStorageHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('memoryStorage', memorySystemHealth.checkMemoryStorageHealth, true);
            logger.info('Registered memory storage health check function');
          } else {
            logger.warn('Memory storage health check function not available');
          }
          
          if (typeof memorySystemHealth.checkMemoryIndexHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('memoryIndex', memorySystemHealth.checkMemoryIndexHealth, true);
            logger.info('Registered memory index health check function');
          } else {
            logger.warn('Memory index health check function not available');
          }
        })
        .catch(error => {
          logger.error('Failed to import memory system health module', error);
        });
        
      // Register health check functions for reasoning engine
      import('../reasoning/reasoning-engine-health.js')
        .then(reasoningEngineHealth => {
          if (typeof reasoningEngineHealth.checkLogicalReasoningHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('logicalReasoning', reasoningEngineHealth.checkLogicalReasoningHealth, true);
            logger.info('Registered logical reasoning health check function');
          } else {
            logger.warn('Logical reasoning health check function not available');
          }
          
          if (typeof reasoningEngineHealth.checkFactsDatabaseHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('factsDatabase', reasoningEngineHealth.checkFactsDatabaseHealth, true);
            logger.info('Registered facts database health check function');
          } else {
            logger.warn('Facts database health check function not available');
          }
          
          if (typeof reasoningEngineHealth.checkFallacyDetectionHealth === 'function') {
            componentHealthMonitor.registerComponentChecker('fallacyDetection', reasoningEngineHealth.checkFallacyDetectionHealth, true);
            logger.info('Registered fallacy detection health check function');
          } else {
            logger.warn('Fallacy detection health check function not available');
          }
        })
        .catch(error => {
          logger.error('Failed to import reasoning engine health module', error);
        });
        
      // Register other component health checkers here as they become available
      // Example: Vision system, Gesture system, Memory system, etc.
      
      // Register the dashboard's own health check
      componentHealthMonitor.registerComponentChecker(
        'resourceDashboard',
        async () => {
          return {
            status: 'healthy',
            details: {
              refreshRate: updateInterval,
              isVisible: isVisible
            }
          };
        },
        false // Not a critical component
      );
    })
    .catch(error => {
      logger.warn('Could not register voice system health checker', error);
    });
    
  // Register other component health checkers here as they become available
  // Example: Vision system, Gesture system, Memory system, etc.
  
  // Register the dashboard's own health check
  componentHealthMonitor.registerComponentChecker(
    'resourceDashboard',
    async () => {
      return {
        status: 'healthy',
        details: {
          refreshRate: updateInterval,
          isVisible: isVisible
        }
      };
    },
    false // Not a critical component
  );
}

/**
 * Handle system health status updates
 * @param {Object} data - System health data
 */
function handleSystemHealthUpdate(data) {
  // Update recommendations based on system health
  if (dashboardState.recommendations) {
    generateHealthRecommendations(data);
  }
  
  // Update dashboard UI if visible
  if (isVisible && dashboardElement) {
    updateHealthStatusFromMonitor();
  }
}

/**
 * Handle component status update
 * @param {Object} data - Component status data
 */
function handleComponentStatusUpdate(data) {
  if (!data || !data.component) return;
  
  // Add component-specific UI updates here if needed
  logger.debug(`Received status update for component: ${data.component}`);
  
  // Refresh health status section if visible
  if (isVisible && healthMonitorInitialized) {
    updateHealthStatusFromMonitor();
  }
}

/**
 * Generate health recommendations based on component health status
 * @param {Object} healthStatus - Health status data from component health monitor
 */
function generateHealthRecommendations(healthStatus) {
  if (!healthStatus || !healthStatus.components || Object.keys(healthStatus.components).length === 0) {
    return;
  }
  
  // Check overall system health status
  const overallStatus = healthStatus.status;
  
  // Add recommendation based on overall status
  if (overallStatus === 'error') {
    dashboardState.recommendations.push({
      priority: 'high',
      resource: 'health',
      message: 'System health is critical',
      action: 'Critical components require attention. Check component health details.',
      actionable: true
    });
  } else if (overallStatus === 'degraded') {
    dashboardState.recommendations.push({
      priority: 'medium',
      resource: 'health',
      message: 'System health is degraded',
      action: 'Some components require attention to restore optimal performance.',
      actionable: true
    });
  }
  
  // Count issues by severity
  let errorCount = 0;
  let degradedCount = 0;
  let criticalComponentsAffected = false;
  
  // Check individual component statuses
  Object.entries(healthStatus.components).forEach(([componentName, status]) => {
    const isCritical = healthStatus.criticalComponents?.includes(componentName);
    
    if (status.status === 'error') {
      errorCount++;
      if (isCritical) criticalComponentsAffected = true;
    } else if (status.status === 'degraded') {
      degradedCount++;
      if (isCritical) criticalComponentsAffected = true;
    }
  });
  
  // Add specific recommendations based on component counts
  if (criticalComponentsAffected) {
    dashboardState.recommendations.push({
      priority: 'high',
      resource: 'health',
      message: 'Critical components affected',
      action: `${errorCount > 0 ? `${errorCount} component${errorCount > 1 ? 's' : ''} in error state.` : ''} ${degradedCount > 0 ? `${degradedCount} component${degradedCount > 1 ? 's' : ''} degraded.` : ''} Run diagnostics to resolve issues.`,
      actionable: true
    });
  } else if (errorCount > 0) {
    dashboardState.recommendations.push({
      priority: 'medium',
      resource: 'health',
      message: `${errorCount} component${errorCount > 1 ? 's' : ''} in error state`,
      action: 'Non-critical components need attention. Check health status for details.',
      actionable: true
    });
  } else if (degradedCount > 0) {
    dashboardState.recommendations.push({
      priority: 'low',
      resource: 'health',
      message: `${degradedCount} component${degradedCount > 1 ? 's' : ''} showing degraded performance`,
      action: 'Monitor affected components for further degradation.',
      actionable: false
    });
  }
  
  // Add recovery recommendation if system has been in a problematic state for a while
  if ((overallStatus === 'error' || overallStatus === 'degraded') && 
      healthStatus.lastHealthyTime && 
      (Date.now() - healthStatus.lastHealthyTime > 1000 * 60 * 30)) { // 30 minutes
    
    // If system has been unhealthy for a long time, suggest deeper diagnostics
    const unhealthyMinutes = Math.floor((Date.now() - healthStatus.lastHealthyTime) / (1000 * 60));
    
    dashboardState.recommendations.push({
      priority: 'high',
      resource: 'health',
      message: `System unhealthy for ${unhealthyMinutes} minutes`,
      action: 'Consider restarting affected components or running deep system diagnostics.',
      actionable: true
    });
  }
}

/**
 * Generate resource-specific recommendations based on resource usage and mode
 * @param {Object} resourceUsage - Current resource usage data
 * @param {string} currentMode - Current resource mode
 */
function generateResourceSpecificRecommendations(resourceUsage, currentMode) {
  // Add resource mode specific recommendations
  if (currentMode === RESOURCE_MODES.MINIMAL) {
    dashboardState.recommendations.push({
      priority: 'high',
      resource: 'system',
      message: 'System is in minimal resource mode. Only essential functions are enabled.',
      action: 'Wait until system resources improve or close unnecessary applications.'
    });
  } else if (currentMode === RESOURCE_MODES.CONSERVATIVE) {
    dashboardState.recommendations.push({
      priority: 'medium',
      resource: 'system',
      message: 'System is in conservative resource mode to prevent overheating.',
      action: 'Reduce system load or improve cooling to return to normal operation.'
    });
  }
}

/**
 * Add resource monitoring sections to the dashboard
 * @param {HTMLElement} dashboard - Dashboard element
 */
function addResourceSections(dashboard) {
  const resourcesContainer = document.createElement('div');
  resourcesContainer.className = 'resources-container';
  resourcesContainer.setAttribute('role', 'group');
  resourcesContainer.setAttribute('aria-label', 'Resource usage indicators');
  
  // Create CPU section
  const cpuSection = createResourceSection('cpu', 'CPU Usage');
  dashboard.appendChild(cpuSection);
  
  // Create Memory section
  const memorySection = createResourceSection('memory', 'Memory Usage');
  dashboard.appendChild(memorySection);
  
  // Create Temperature section (if available)
  if (resourceManager.hasTemperatureSensor()) {
    const temperatureSection = createResourceSection('temperature', 'Temperature');
    dashboard.appendChild(temperatureSection);
  }
  
  // Create Storage section
  const diskSection = createResourceSection('disk', 'Storage Usage');
  dashboard.appendChild(diskSection);
  
  // Create Battery section (if available on mobile/laptop)
  if (resourceManager.hasBatteryInfo()) {
    const batterySection = createResourceSection('battery', 'Battery');
    dashboard.appendChild(batterySection);
  }
  
  // Add threshold configuration section
  addResourceThresholdSection(dashboard);
  
  // Add health status section if health monitor is initialized
  if (healthMonitorInitialized) {
    createHealthStatusSection(dashboard);
  }
}

/**
 * Update resource optimization recommendations
 * @param {Object} resourceUsage - Current resource usage
 * @param {string} currentMode - Current resource mode
 */
function updateResourceRecommendations(resourceUsage, currentMode) {
  // Reset recommendations
  dashboardState.recommendations = [];
  
  // Add health-related recommendations if health monitor is initialized
  if (healthMonitorInitialized) {
    const healthStatus = componentHealthMonitor.getHealthStatus();
    if (healthStatus) {
      generateHealthRecommendations(healthStatus);
    }
  }
  
  // Generate resource-specific recommendations
  if (resourceUsage && currentMode) {
    generateResourceSpecificRecommendations(resourceUsage, currentMode);
  }
  
  // ... rest of the function remains the same ...
}

/**
 * Clean up resource dashboard
 */
function cleanupResourceDashboard() {
  if (!initialized) return;
  
  // Clear update interval
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  // Unsubscribe from events
  eventBus.unsubscribe('resource:thresholdCrossed', handleThresholdCrossed);
  eventBus.unsubscribe('resource:modeChanged', handleResourceModeChanged);
  eventBus.unsubscribe('threshold:configUpdated', handleThresholdConfig);
  eventBus.unsubscribe('threshold:updated', handleThresholdUpdate);
  eventBus.unsubscribe('threshold:bulkUpdate', handleBulkThresholdUpdate);
  eventBus.unsubscribe('threshold:reset', handleThresholdReset);
  eventBus.unsubscribe('threshold:apply', handleThresholdApply);
  eventBus.unsubscribe('monitoring:systemHealth', handleSystemHealthUpdate);
  eventBus.unsubscribe('monitoring:componentStatus', handleComponentStatusUpdate);
  
  // Clean up health status UI if initialized
  if (healthMonitorInitialized) {
    cleanupHealthStatusUI();
    componentHealthMonitor.cleanup();
    healthMonitorInitialized = false;
  }
  
  // Remove dashboard from DOM if it exists
  if (dashboardElement && dashboardElement.parentNode) {
    dashboardElement.parentNode.removeChild(dashboardElement);
  }
  
  // Reset state
  dashboardElement = null;
  isVisible = false;
  initialized = false;
  
  logger.info('Resource dashboard cleaned up');
}

// Export the public API
export default {
  initialize: initializeResourceDashboard,
  show: showResourceDashboard,
  hide: hideResourceDashboard,
  toggle: toggleResourceDashboard,
  isVisible: isResourceDashboardVisible,
  cleanup: cleanupResourceDashboard,
  openRecoveryUI,
  minimizeResourceDashboard,
  restoreResourceDashboard
};
