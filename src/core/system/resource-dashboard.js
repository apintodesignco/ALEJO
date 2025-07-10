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

// Import styles
import '../../styles/resource-dashboard.css';
import '../../styles/resource-alerts.css';
import '../../styles/resource-dashboard-thresholds.css';

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

// Dashboard DOM IDs
const DASHBOARD_ID = 'alejo-resource-dashboard';
const CONTAINER_ID = 'alejo-resource-dashboard-container';

const dashboardState = {
  isVisible: false,
  resources: {
    cpu: { current: 0, history: [] },
    memory: { current: 0, history: [] },
    temperature: { current: 0, history: [] },
    disk: { current: 0, history: [] },
    battery: { current: 0, history: [], charging: false }
  },
  thresholds: { ...DEFAULT_THRESHOLDS },
  updateInterval: 2000,
  historyLimit: 60,
  eventBus: EventBus.getInstance(),
  logger: new Logger('ResourceDashboard'),
  auditTrail: new AuditTrail('resource-dashboard'),
  accessibilitySettings: {
    highContrast: false,
    largeText: false,
    reducedMotion: false
  },
  alerts: [],
  currentResourceMode: 'normal',
  userThresholdChanges: false  // Flag to track if user has customized thresholds
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

    // Get required services
    resourceManager = getResourceAllocationManager();
    thresholdConfig = getResourceThresholdConfig();
    eventBus = EventBus.getInstance();
    configManager = ConfigManager.getInstance();
    auditTrail = getAuditTrail();

    // Set up event listeners
    setupEventListeners();

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
  eventBus.on('resource:threshold-crossed', handleThresholdCrossed);
  eventBus.on('resource:mode-changed', handleResourceModeChanged);
  eventBus.on('resource:thresholds-updated', updateDashboard);
  eventBus.on('system:accessibility-changed', applyAccessibilitySettings);
  eventBus.on('dashboard:toggle-resource', toggleResourceDashboard);

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
 * Handle threshold crossing events
 * @param {Object} data - Event data
 */
function handleThresholdCrossed(data) {
  const { resource, value, threshold, level } = data;
  
  // Update dashboard with alert
  updateResourceAlert(resource, value, threshold, level);
  
  // Log to audit trail
  auditTrail.log('system:resource', `Resource threshold crossed: ${resource} at ${value}`, {
    resource, value, threshold, level
  });
  
  // Announce to screen reader if enabled
  if (configManager.get('accessibility.announceResourceAlerts', true)) {
    announce(`Resource alert: ${resource} usage at ${value} percent, exceeding ${threshold} percent ${level} threshold`);
  }
}

/**
 * Handle resource mode changes
 * @param {Object} data - Event data 
 */
function handleResourceModeChanged(data) {
  const { newMode, previousMode, reason } = data;
  
  // Update dashboard mode indicator
  updateResourceModeIndicator(newMode, reason);
  
  // Log to audit trail
  auditTrail.log('system:resource', `Resource mode changed: ${previousMode} → ${newMode}`, {
    newMode, previousMode, reason
  });
  
  // Announce to screen reader if enabled
  if (configManager.get('accessibility.announceResourceModeChanges', true)) {
    announce(`Resource mode changed to ${newMode} due to ${reason}`);
  }
}

/**
 * Handle threshold configuration data
 * @param {Object} data - Threshold configuration data
 */
function handleThresholdConfig(data) {
  dashboardState.thresholds = data.thresholds;
  dashboardState.logger.debug('Received updated threshold configuration', data.thresholds);
  
  // Update dashboard visuals to reflect new thresholds
  updateAllResourceGauges();
}

/**
 * Handle single threshold update
 * @param {Object} data - Threshold update data
 */
function handleThresholdUpdate(data) {
  const { resource, level, value } = data;
  
  // Update the specific threshold
  if (!dashboardState.thresholds[resource]) {
    dashboardState.thresholds[resource] = {};
  }
  
  dashboardState.thresholds[resource][level] = value;
  dashboardState.userThresholdChanges = true;
  
  dashboardState.logger.debug(`Threshold updated: ${resource}.${level} = ${value}`);
  
  // Update the relevant resource gauge
  updateResourceGauge(resource, dashboardState.resources[resource].current);
}

/**
 * Handle bulk threshold update
 * @param {Object} data - Bulk threshold update data
 */
function handleBulkThresholdUpdate(data) {
  dashboardState.thresholds = { ...data.thresholds };
  dashboardState.userThresholdChanges = true;
  
  dashboardState.logger.debug('Thresholds bulk updated', dashboardState.thresholds);
  
  // Update all resource gauges
  updateAllResourceGauges();
}

/**
 * Handle threshold reset
 * @param {Object} data - Reset data
 */
function handleThresholdReset(data) {
  dashboardState.thresholds = { ...data.thresholds };
  dashboardState.userThresholdChanges = false;
  
  dashboardState.logger.debug('Thresholds reset to defaults', dashboardState.thresholds);
  
  // Update all resource gauges
  updateAllResourceGauges();
  
  // Announce to screen readers
  announceToScreenReader('Resource thresholds have been reset to default values');
}

/**
 * Handle threshold apply event
 * @param {Object} data - Apply data
 */
function handleThresholdApply(data) {
  // Update thresholds with the applied changes
  Object.keys(data.thresholds).forEach(resource => {
    if (!dashboardState.thresholds[resource]) {
      dashboardState.thresholds[resource] = {};
    }
    
    Object.keys(data.thresholds[resource]).forEach(level => {
      dashboardState.thresholds[resource][level] = data.thresholds[resource][level];
    });
  });
  
  dashboardState.userThresholdChanges = true;
  
  dashboardState.logger.debug('Applied threshold changes', data.thresholds);
  
  // Update all resource gauges
  updateAllResourceGauges();
  
  // Announce to screen readers
  announceToScreenReader('Resource threshold changes have been applied');
}

/**
 * Open the threshold configuration UI
 */
function openThresholdConfig() {
  // Request the latest threshold configuration
  dashboardState.eventBus.emit('resource-thresholds:request-config');
  
  dashboardState.logger.debug('Opening threshold configuration UI');
}

/**
 * Update all resource gauges based on current values and thresholds
 */
function updateAllResourceGauges() {
  // Update each resource gauge
  Object.keys(dashboardState.resources).forEach(resource => {
    const currentValue = dashboardState.resources[resource].current;
    updateResourceGauge(resource, currentValue);
  });
}

/**
 * Create the dashboard element
 * @returns {HTMLElement} The dashboard element
 */
function createDashboardElement() {
  const dashboard = document.createElement('div');
  dashboard.id = DASHBOARD_ID;
  dashboard.className = 'alejo-dashboard resource-dashboard';
  dashboard.setAttribute('role', 'region');
  dashboard.setAttribute('aria-label', 'ALEJO Resource Monitoring Dashboard');
  dashboard.setAttribute('aria-hidden', 'true');
  
  // Add dashboard header
  const header = createDashboardHeader();
  dashboard.appendChild(header);
  
  // Add resource sections
  addResourceSections(dashboard);
  
  // Add controls
  addDashboardControls(dashboard);

  return dashboard;
}

/**
 * Create dashboard header
 * @returns {HTMLElement} Header element
 */
function createDashboardHeader() {
  const header = document.createElement('div');
  header.className = 'dashboard-header';
  
  const title = document.createElement('h2');
  title.textContent = 'System Resource Monitor';
  title.className = 'dashboard-title';
  
  const subtitle = document.createElement('div');
  subtitle.className = 'dashboard-subtitle';
  subtitle.textContent = 'Real-time resource monitoring and configuration';
  
  const modeIndicator = document.createElement('div');
  modeIndicator.className = 'resource-mode-indicator';
  modeIndicator.id = 'resource-mode-indicator';
  modeIndicator.setAttribute('aria-live', 'polite');
  
  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(modeIndicator);
  
  return header;
}

/**
 * Add resource monitoring sections to the dashboard
 * @param {HTMLElement} dashboard - Dashboard element
 */
function addResourceSections(dashboard) {
  // Main resource summary
  const summary = document.createElement('div');
  summary.className = 'resource-summary';
  summary.id = 'resource-summary';
  
  // CPU section
  const cpuSection = createResourceSection('cpu', 'CPU Usage');
  dashboard.appendChild(cpuSection);
  
  // Memory section
  const memorySection = createResourceSection('memory', 'Memory Usage');
  dashboard.appendChild(memorySection);
  
  // Temperature section (if available)
  const tempSection = createResourceSection('temperature', 'System Temperature');
  dashboard.appendChild(tempSection);
  
  // Disk section
  const diskSection = createResourceSection('disk', 'Disk Usage');
  dashboard.appendChild(diskSection);
  
  // Battery section (if available)
  const batterySection = createResourceSection('battery', 'Battery Status');
  dashboard.appendChild(batterySection);
  
  // Add resource threshold configuration section
  addResourceThresholdSection(dashboard);
}

/**
 * Create a resource section element
 * @param {string} resource - Resource type (cpu, memory, etc.)
 * @param {string} title - Section title
 * @returns {HTMLElement} Section element
 */
function createResourceSection(resource, title) {
  const section = document.createElement('div');
  section.className = `resource-section ${resource}-section`;
  section.id = `${resource}-section`;
  
  const sectionHeader = document.createElement('h3');
  sectionHeader.textContent = title;
  section.appendChild(sectionHeader);
  
  const gauge = document.createElement('div');
  gauge.className = 'resource-gauge';
  gauge.id = `${resource}-gauge`;
  section.appendChild(gauge);
  
  const details = document.createElement('div');
  details.className = 'resource-details';
  details.id = `${resource}-details`;
  section.appendChild(details);
  
  const alert = document.createElement('div');
  alert.className = 'resource-alert hidden';
  alert.id = `${resource}-alert`;
  alert.setAttribute('role', 'alert');
  alert.setAttribute('aria-hidden', 'true');
  section.appendChild(alert);
  
  return section;
}

/**
 * Add dashboard control buttons
 * @param {HTMLElement} dashboard - Dashboard element
 */
function addDashboardControls(dashboard) {
  const controls = document.createElement('div');
  controls.className = 'dashboard-controls';
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'dashboard-button close-button';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close resource dashboard');
  closeButton.addEventListener('click', hideResourceDashboard);
  
  // Configure thresholds button
  const configButton = createThresholdConfigButton();
  
  // Help button
  const helpButton = document.createElement('button');
  helpButton.className = 'dashboard-button help-button';
  helpButton.textContent = 'Help';
  helpButton.setAttribute('aria-label', 'Resource dashboard help');
  helpButton.addEventListener('click', showDashboardHelp);
  
  controls.appendChild(configButton);
  controls.appendChild(helpButton);
  controls.appendChild(closeButton);
  
  dashboard.appendChild(controls);
}

/**
 * Update the dashboard with current resource information
 */
function updateDashboard() {
  if (!isVisible || !dashboardElement || !resourceManager) {
    return;
  }
  
  try {
    // Get current resource usage
    const resourceUsage = resourceManager.getResourceUsage();
    const currentMode = resourceManager.getCurrentMode();
    
    // Update mode indicator
    updateResourceModeIndicator(currentMode);
    
    // Update each resource section
    updateResourceSection('cpu', resourceUsage.cpu);
    updateResourceSection('memory', resourceUsage.memory);
    updateResourceSection('temperature', resourceUsage.temperature);
    updateResourceSection('disk', resourceUsage.disk);
    updateResourceSection('battery', resourceUsage.battery);
    
    // Update threshold indicators
    updateThresholdIndicators(resourceUsage);
  } catch (error) {
    logger.error('Failed to update resource dashboard', error);
  }
}

/**
 * Update a specific resource section with usage information
 * @param {string} resource - Resource type (cpu, memory, etc.)
 * @param {Object} usage - Resource usage information
 */
function updateResourceSection(resource, usage) {
  if (!usage) {
    return;
  }
  
  const gauge = document.getElementById(`${resource}-gauge`);
  const details = document.getElementById(`${resource}-details`);
  
  if (!gauge || !details) {
    return;
  }
  
  // Update gauge display
  updateResourceGauge(gauge, resource, usage);
  
  // Update details text
  details.innerHTML = generateResourceDetails(resource, usage);
}

/**
 * Update a resource gauge with current usage
 * @param {HTMLElement} gauge - Gauge element
 * @param {string} resource - Resource type
 * @param {Object} usage - Resource usage information
 */
function updateResourceGauge(gauge, resource, usage) {
  let percentage = 0;
  let statusClass = 'status-normal';
  
  // Get appropriate percentage and status based on resource type
  switch (resource) {
    case 'cpu':
      percentage = usage.percentage || 0;
      statusClass = getCpuStatusClass(percentage);
      break;
    case 'memory':
      percentage = usage.percentage || 0;
      statusClass = getMemoryStatusClass(percentage);
      break;
    case 'temperature':
      // Convert temperature to percentage for gauge (0-100°C)
      percentage = Math.min(100, Math.max(0, usage.celsius || 0));
      statusClass = getTemperatureStatusClass(usage.celsius || 0);
      break;
    case 'disk':
      percentage = usage.percentage || 0;
      statusClass = getDiskStatusClass(percentage);
      break;
    case 'battery':
      percentage = usage.percentage || 0;
      statusClass = getBatteryStatusClass(percentage);
      break;
    default:
      percentage = 0;
  }
  
  // Create gauge display HTML with resource type for threshold indicators
  gauge.innerHTML = createGaugeHTML(percentage, statusClass, resource);
  
  // Set gauge ARIA attributes
  gauge.setAttribute('aria-valuenow', Math.round(percentage));
  gauge.setAttribute('aria-valuemin', '0');
  gauge.setAttribute('aria-valuemax', '100');
  
  // Add data attribute for current status for easier styling and state management
  gauge.setAttribute('data-status', statusClass.replace('status-', ''));
  
  // If user has custom thresholds, add indicator class
  if (dashboardState.userThresholdChanges) {
    gauge.classList.add('custom-thresholds');
  } else {
    gauge.classList.remove('custom-thresholds');
  }
}

/**
 * Create HTML for a resource gauge
 * @param {number} percentage - Usage percentage
 * @param {string} statusClass - Status class (normal, warning, critical)
 * @param {string} resource - Resource type
 * @returns {string} HTML for gauge
 */
function createGaugeHTML(percentage, statusClass, resource) {
  // Get the thresholds for this resource
  const thresholds = dashboardState.thresholds[resource] || DEFAULT_THRESHOLDS[resource];
  const warningThreshold = resource === 'battery' ? 100 - thresholds.warning : thresholds.warning;
  const criticalThreshold = resource === 'battery' ? 100 - thresholds.critical : thresholds.critical;
  
  // Create threshold indicators with ARIA labels
  const thresholdIndicators = `
    <div class="gauge-threshold warning" style="left: ${warningThreshold}%" 
         aria-label="Warning threshold at ${warningThreshold}%" role="presentation"></div>
    <div class="gauge-threshold critical" style="left: ${criticalThreshold}%" 
         aria-label="Critical threshold at ${criticalThreshold}%" role="presentation"></div>
  `;
  
  return `
    <div class="gauge-container" data-resource="${resource}">
      <div class="gauge">
        <div class="gauge-fill ${statusClass}" style="width: ${percentage}%"></div>
        ${thresholdIndicators}
      </div>
      <div class="gauge-label">${Math.round(percentage)}%</div>
      <div class="gauge-thresholds-summary" aria-hidden="true">
        <span class="warning-threshold">Warning: ${warningThreshold}%</span>
        <span class="critical-threshold">Critical: ${criticalThreshold}%</span>
      </div>
    </div>
  `;
}

/**
 * Generate detailed resource information HTML
 * @param {string} resource - Resource type
 * @param {Object} usage - Resource usage information
 * @returns {string} HTML with details
 */
function generateResourceDetails(resource, usage) {
  switch (resource) {
    case 'cpu':
      return `
        <div>Current: ${usage.percentage.toFixed(1)}%</div>
        <div>Cores: ${usage.cores || 'Unknown'}</div>
        <div>Average Load: ${usage.loadAverage ? usage.loadAverage.toFixed(2) : 'N/A'}</div>
      `;
    case 'memory':
      return `
        <div>Used: ${formatBytes(usage.used)}</div>
        <div>Total: ${formatBytes(usage.total)}</div>
        <div>${usage.percentage.toFixed(1)}% in use</div>
      `;
    case 'temperature':
      return `
        <div>${usage.celsius ? `${usage.celsius.toFixed(1)}°C` : 'N/A'}</div>
        <div>${usage.fahrenheit ? `${usage.fahrenheit.toFixed(1)}°F` : 'N/A'}</div>
      `;
    case 'disk':
      return `
        <div>Used: ${formatBytes(usage.used)}</div>
        <div>Total: ${formatBytes(usage.total)}</div>
        <div>${usage.percentage.toFixed(1)}% in use</div>
      `;
    case 'battery':
      return `
        <div>Charge: ${usage.percentage ? `${usage.percentage.toFixed(1)}%` : 'N/A'}</div>
        <div>Status: ${usage.charging ? 'Charging' : 'Discharging'}</div>
        <div>${usage.timeRemaining ? `${usage.timeRemaining} remaining` : ''}</div>
      `;
    default:
      return '<div>No data available</div>';
  }
}

/**
 * Format bytes into human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g. "4.2 GB")
 */
function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) {
    return 'Unknown';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Update resource mode indicator
 * @param {string} mode - Current resource mode
 * @param {string} [reason] - Reason for mode change
 */
function updateResourceModeIndicator(mode, reason) {
  const indicator = document.getElementById('resource-mode-indicator');
  if (!indicator) {
    return;
  }
  
  let modeText = 'Normal';
  let modeClass = 'mode-normal';
  
  switch (mode) {
    case RESOURCE_MODES.HIGH_PERFORMANCE:
      modeText = 'High Performance';
      modeClass = 'mode-high';
      break;
    case RESOURCE_MODES.NORMAL:
      modeText = 'Normal';
      modeClass = 'mode-normal';
      break;
    case RESOURCE_MODES.POWER_SAVING:
      modeText = 'Power Saving';
      modeClass = 'mode-saving';
      break;
    case RESOURCE_MODES.MINIMAL:
      modeText = 'Minimal';
      modeClass = 'mode-minimal';
      break;
    default:
      modeText = 'Unknown';
  }
  
  // Add reason if provided
  const reasonText = reason ? ` (${reason})` : '';
  
  // Update indicator
  indicator.textContent = `Resource Mode: ${modeText}${reasonText}`;
  indicator.className = `resource-mode-indicator ${modeClass}`;
}

/**
 * Update threshold indicators based on current resource usage
 * @param {Object} resourceUsage - Current resource usage
 */
function updateThresholdIndicators(resourceUsage) {
  if (!thresholdConfig) {
    return;
  }
  
  const thresholds = thresholdConfig.getThresholds();
  
  // Check each resource against its thresholds
  Object.entries(resourceUsage).forEach(([resource, usage]) => {
    if (!usage || !thresholds[resource]) {
      return;
    }
    
    const resourceThresholds = thresholds[resource];
    let percentage = 0;
    
    // Get percentage based on resource type
    switch (resource) {
      case 'cpu':
      case 'memory':
      case 'disk':
        percentage = usage.percentage || 0;
        break;
      case 'temperature':
        percentage = usage.celsius || 0;
        break;
      case 'battery':
        percentage = usage.percentage || 0;
        break;
      default:
        return;
    }
    
    // Check critical threshold
    if (resourceThresholds.critical && percentage >= resourceThresholds.critical) {
      updateResourceAlert(resource, percentage, resourceThresholds.critical, 'critical');
    }
    // Check warning threshold
    else if (resourceThresholds.warning && percentage >= resourceThresholds.warning) {
      updateResourceAlert(resource, percentage, resourceThresholds.warning, 'warning');
    }
    // Clear alert if below thresholds
    else {
      clearResourceAlert(resource);
    }
  });
}

/**
 * Update resource alert display
 * @param {string} resource - Resource type
 * @param {number} value - Current value
 * @param {number} threshold - Threshold value
 * @param {string} level - Alert level (warning, critical)
 */
function updateResourceAlert(resource, value, threshold, level) {
  const alert = document.getElementById(`${resource}-alert`);
  if (!alert) {
    return;
  }
  
  // Format value based on resource type
  let valueText = '';
  switch (resource) {
    case 'temperature':
      valueText = `${value.toFixed(1)}°C`;
      break;
    default:
      valueText = `${value.toFixed(1)}%`;
  }
  
  // Update alert content
  alert.innerHTML = `
    <div class="alert-icon ${level}"></div>
    <div class="alert-message">
      <strong>${level === 'critical' ? 'Critical' : 'Warning'}</strong>: 
      ${valueText} exceeds ${threshold}${resource === 'temperature' ? '°C' : '%'} ${level} threshold
    </div>
  `;
  
  // Show alert
  alert.className = `resource-alert ${level}`;
  alert.setAttribute('aria-hidden', 'false');
}

/**
 * Clear resource alert
 * @param {string} resource - Resource type
 */
function clearResourceAlert(resource) {
  const alert = document.getElementById(`${resource}-alert`);
  if (!alert) {
    return;
  }
  
  // Hide alert
  alert.className = 'resource-alert hidden';
  alert.setAttribute('aria-hidden', 'true');
}

/**
 * Apply accessibility settings to the dashboard
 */
function applyAccessibilitySettings() {
  try {
    const accessibilityStatus = getAccessibilityStatus();
    const dashboard = document.getElementById(DASHBOARD_ID);
    
    if (!dashboard) {
      return;
    }
    
    // Apply high contrast if enabled
    if (isHighContrastMode()) {
      dashboard.classList.add('high-contrast');
    } else {
      dashboard.classList.remove('high-contrast');
    }
    
    // Apply large text if enabled
    if (accessibilityStatus.largeText) {
      dashboard.classList.add('large-text');
    } else {
      dashboard.classList.remove('large-text');
    }
    
    // Apply reduced motion if enabled
    if (accessibilityStatus.reducedMotion) {
      dashboard.classList.add('reduced-motion');
    } else {
      dashboard.classList.remove('reduced-motion');
    }
  } catch (error) {
    logger.error('Failed to apply accessibility settings', error);
  }
}

/**
 * Show resource dashboard help
 */
function showDashboardHelp() {
  // Create help modal
  const modal = document.createElement('div');
  modal.className = 'alejo-modal help-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'help-title');
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3 id="help-title">Resource Dashboard Help</h3>
      <div class="help-content">
        <h4>Overview</h4>
        <p>The Resource Dashboard provides real-time monitoring of system resources used by ALEJO.</p>
        
        <h4>Resource Sections</h4>
        <p>Each resource section shows:</p>
        <ul>
          <li>Visual gauge of current usage</li>
          <li>Detailed metrics</li>
          <li>Warning/critical alerts when thresholds are exceeded</li>
        </ul>
        
        <h4>Resource Mode</h4>
        <p>The current resource mode determines how ALEJO balances performance and efficiency:</p>
        <ul>
          <li><strong>High Performance:</strong> Maximum capabilities, higher resource usage</li>
          <li><strong>Normal:</strong> Balanced performance and efficiency</li>
          <li><strong>Power Saving:</strong> Reduced capabilities to save resources</li>
          <li><strong>Minimal:</strong> Essential functions only</li>
        </ul>
        
        <h4>Threshold Configuration</h4>
        <p>Click "Configure Thresholds" to set custom warning and critical thresholds for each resource type.</p>
      </div>
      <button class="close-button" aria-label="Close help">Close</button>
    </div>
  `;
  
  // Add close button event
  const closeButton = modal.querySelector('.close-button');
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.body.appendChild(modal);
}

/**
 * Get CSS class for CPU usage status
 * @param {number} cpuUsage - CPU usage percentage
 * @returns {string} CSS status class
 */
function getCpuStatusClass(cpuUsage) {
  const thresholds = dashboardState.thresholds.cpu || DEFAULT_THRESHOLDS.cpu;
  
  if (cpuUsage >= thresholds.critical) {
    return 'status-critical';
  } else if (cpuUsage >= thresholds.warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Get CSS class for memory usage status
 * @param {number} memoryUsage - Memory usage percentage
 * @returns {string} CSS status class
 */
function getMemoryStatusClass(memoryUsage) {
  const thresholds = dashboardState.thresholds.memory || DEFAULT_THRESHOLDS.memory;
  
  if (memoryUsage >= thresholds.critical) {
    return 'status-critical';
  } else if (memoryUsage >= thresholds.warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Get CSS class for temperature status
 * @param {number} temperature - Temperature in Celsius
 * @returns {string} CSS status class
 */
function getTemperatureStatusClass(temperature) {
  const thresholds = dashboardState.thresholds.temperature || DEFAULT_THRESHOLDS.temperature;
  
  if (temperature >= thresholds.critical) {
    return 'status-critical';
  } else if (temperature >= thresholds.warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Get CSS class for disk usage status
 * @param {number} diskUsage - Disk usage percentage
 * @returns {string} CSS status class
 */
function getDiskStatusClass(diskUsage) {
  const thresholds = dashboardState.thresholds.disk || DEFAULT_THRESHOLDS.disk;
  
  if (diskUsage >= thresholds.critical) {
    return 'status-critical';
  } else if (diskUsage >= thresholds.warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Get CSS class for battery status
 * @param {number} batteryLevel - Battery level percentage
 * @returns {string} CSS status class
 */
function getBatteryStatusClass(batteryLevel) {
  const thresholds = dashboardState.thresholds.battery || DEFAULT_THRESHOLDS.battery;
  
  if (batteryLevel <= thresholds.critical) {
    return 'status-critical';
  } else if (batteryLevel <= thresholds.warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Show the resource dashboard
 */
export function showResourceDashboard() {
  if (!dashboardElement || !initialized) {
    logger.warn('Cannot show resource dashboard - not initialized');
    return;
  }
  
  // Make dashboard visible
  dashboardElement.style.display = 'block';
  dashboardElement.setAttribute('aria-hidden', 'false');
  isVisible = true;
  
  // Update dashboard
  updateDashboard();
  
  // Announce to screen reader
  announce('Resource monitoring dashboard opened');
  
  // Log to audit trail
  auditTrail.log('system:dashboard', 'Resource dashboard opened');
  
  // Publish event
  eventBus.publish('dashboard:resource-shown');
}

/**
 * Hide the resource dashboard
 */
export function hideResourceDashboard() {
  if (!dashboardElement) {
    return;
  }
  
  // Hide dashboard
  dashboardElement.style.display = 'none';
  dashboardElement.setAttribute('aria-hidden', 'true');
  isVisible = false;
  
  // Announce to screen reader
  announce('Resource monitoring dashboard closed');
  
  // Log to audit trail
  auditTrail.log('system:dashboard', 'Resource dashboard closed');
  
  // Publish event
  eventBus.publish('dashboard:resource-hidden');
}

/**
 * Toggle resource dashboard visibility
 */
export function toggleResourceDashboard() {
  if (isVisible) {
    hideResourceDashboard();
  } else {
    showResourceDashboard();
  }
}

/**
 * Check if dashboard is visible
 * @returns {boolean} Whether dashboard is visible
 */
export function isResourceDashboardVisible() {
  return isVisible;
}

/**
 * Clean up resource dashboard
 */
export function cleanupResourceDashboard() {
  // Clear update interval
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  // Remove event listeners
  if (eventBus) {
    eventBus.off('resource:threshold-crossed', handleThresholdCrossed);
    eventBus.off('resource:mode-changed', handleResourceModeChanged);
    eventBus.off('resource:thresholds-updated', updateDashboard);
    eventBus.off('system:accessibility-changed', applyAccessibilitySettings);
    eventBus.off('dashboard:toggle-resource', toggleResourceDashboard);
  }
  
  // Remove dashboard element
  if (dashboardElement && dashboardElement.parentNode) {
    dashboardElement.parentNode.removeChild(dashboardElement);
  }
  
  // Reset state
  dashboardElement = null;
  isVisible = false;
  initialized = false;
  
  // Log cleanup
  logger.info('Resource dashboard cleaned up');
}

// Export the public API
export default {
  initialize: initializeResourceDashboard,
  show: showResourceDashboard,
  hide: hideResourceDashboard,
  toggle: toggleResourceDashboard,
  isVisible: isResourceDashboardVisible,
  cleanup: cleanupResourceDashboard
};
