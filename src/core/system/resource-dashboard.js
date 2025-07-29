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
import { getRecoveryStatusSummary } from '../component-recovery-manager.js';
import { initializeRecoveryStatusUI } from './recovery-status-ui.js';
import componentHealthMonitor from './component-health-monitor.js';
import { createHealthStatusSection, updateHealthStatusFromMonitor, cleanupHealthStatusUI } from './health-status-ui.js';
import GPUInterface from './gpu-interface'; // Import GPUInterface

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
let gpuInterface = null; // Initialize gpuInterface variable

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
    battery: { current: 0, history: [], trend: 'stable', charging: false },
    gpu: { current: 0, history: [], trend: 'stable' } // Add GPU resource
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
  alerts: [],
  recommendations: [],          // System recommendations based on resource usage
  currentResourceMode: 'normal',
  userThresholdChanges: false,  // Flag to track if user has customized thresholds
  lastTrendUpdate: 0,           // Timestamp of last trend analysis
  trendUpdateInterval: 10000    // Only update trends every 10 seconds
};

const DEFAULT_THRESHOLDS = {
  CPU: 80, // %
  Memory: 75, // %
  Temperature: 70 // °C
};

export function setResourceThresholds(thresholds) {
  // Merge user thresholds with defaults
  dashboardState.thresholds = {...DEFAULT_THRESHOLDS, ...thresholds};
  
  // Add safety caps
  if (dashboardState.thresholds.Temperature > 85) {
    console.warn('Temperature threshold set too high! Capped at 85°C for safety');
    dashboardState.thresholds.Temperature = 85;
  }
}

export function getCurrentThresholds() {
  return dashboardState.thresholds;
}

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
  
    // Initialize GPU interface
    gpuInterface = new GPUInterface();
    gpuInterface.setMemoryThreshold(0.85); // 85% threshold
  
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

// ... rest of the code remains the same ...

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
  
  // Create GPU section
  const gpuSection = createResourceSection('gpu', 'GPU Usage');
  dashboard.appendChild(gpuSection);
  
  // Add threshold configuration section
  addResourceThresholdSection(dashboard);
  
  // Add health status section if health monitor is initialized
  if (healthMonitorInitialized) {
    createHealthStatusSection(dashboard);
  }
}

// ... rest of the code remains the same ...

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
  
  // Check GPU memory threshold
  if (gpuInterface.checkMemoryThreshold()) {
    dashboardState.recommendations.push({
      priority: 'high',
      resource: 'gpu',
      message: 'GPU memory threshold exceeded',
      action: 'Reduce GPU-intensive tasks or adjust threshold.',
      actionable: true
    });
  }
  
  // ... rest of the function remains the same ...
}

// ... rest of the code remains the same ...

function checkTemperatureSafety() {
  if (dashboardState.resources.temperature.current > dashboardState.thresholds.Temperature) {
    triggerCoolDownProtocol();
    notifyUser('System overheating! Entering safety mode');
  }
}

// ... rest of the code remains the same ...
