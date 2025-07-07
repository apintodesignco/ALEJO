/**
 * ALEJO System Monitoring Dashboard
 * 
 * Provides a visual interface for monitoring system health, component status,
 * resource usage, and error logs. Designed with accessibility as a priority.
 */

import { getComponentStatus, getErrorLog } from './error-handler.js';
import { getInitializationStatus } from './initialization-manager.js';
import { getCurrentResourceMode } from '../../performance/resource-allocation-manager.js';

// Dashboard state
let dashboardElement = null;
let isVisible = false;
let updateInterval = null;

// Dashboard sections
const sections = {
  overview: true,
  components: true,
  resources: true,
  errors: true
};

/**
 * Initialize the monitoring dashboard
 * 
 * @param {Object} options - Dashboard options
 * @param {HTMLElement} options.container - Container element (creates one if not provided)
 * @param {boolean} options.autoShow - Whether to show dashboard immediately
 * @param {number} options.updateInterval - Update interval in ms (default: 2000)
 * @param {Object} options.sections - Which sections to show (default: all)
 * @returns {HTMLElement} - The dashboard element
 */
export function initDashboard(options = {}) {
  const {
    container = null,
    autoShow = false,
    updateInterval: interval = 2000,
    sections: sectionOptions = {}
  } = options;
  
  // Update section visibility
  Object.assign(sections, sectionOptions);
  
  // Create dashboard element if it doesn't exist
  if (!dashboardElement) {
    dashboardElement = document.createElement('div');
    dashboardElement.id = 'alejo-monitoring-dashboard';
    dashboardElement.setAttribute('role', 'region');
    dashboardElement.setAttribute('aria-label', 'ALEJO System Monitoring Dashboard');
    dashboardElement.className = 'alejo-dashboard';
    
    // Apply basic styles
    dashboardElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      max-height: 80vh;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      overflow: auto;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 10000;
      display: none;
      color: #333;
    `;
    
    // Add status indicator styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .status-normal { color: #28a745; }
      .status-warning { color: #ffc107; }
      .status-error { color: #dc3545; }
      .status-normal-bg { background-color: #28a745; }
      .status-warning-bg { background-color: #ffc107; }
      .status-error-bg { background-color: #dc3545; }
    `;
    document.head.appendChild(styleElement);
    
    // Create dashboard structure
    dashboardElement.innerHTML = `
      <div class="alejo-dashboard-header" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 600;">ALEJO System Monitor</h2>
        <div>
          <button id="alejo-dashboard-refresh" aria-label="Refresh dashboard" style="background: none; border: none; cursor: pointer; padding: 4px;">
            🔄
          </button>
          <button id="alejo-dashboard-close" aria-label="Close dashboard" style="background: none; border: none; cursor: pointer; padding: 4px;">
            ✕
          </button>
        </div>
      </div>
      <div class="alejo-dashboard-content" style="padding: 12px;">
        <div id="alejo-dashboard-overview" class="alejo-dashboard-section" style="margin-bottom: 16px;"></div>
        <div id="alejo-dashboard-components" class="alejo-dashboard-section" style="margin-bottom: 16px;"></div>
        <div id="alejo-dashboard-resources" class="alejo-dashboard-section" style="margin-bottom: 16px;"></div>
        <div id="alejo-dashboard-errors" class="alejo-dashboard-section"></div>
      </div>
    `;
    
    // Add event listeners
    dashboardElement.querySelector('#alejo-dashboard-refresh').addEventListener('click', () => {
      updateDashboard();
    });
    
    dashboardElement.querySelector('#alejo-dashboard-close').addEventListener('click', () => {
      hideDashboard();
    });
    
    // Add to container or body
    const targetContainer = container || document.body;
    targetContainer.appendChild(dashboardElement);
  }
  
  // Show dashboard if requested
  if (autoShow) {
    showDashboard();
  }
  
  // Set up update interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(() => {
    if (isVisible) {
      updateDashboard();
    }
  }, interval);
  
  return dashboardElement;
}

/**
 * Show the monitoring dashboard
 */
export function showDashboard() {
  if (!dashboardElement) {
    initDashboard();
  }
  
  dashboardElement.style.display = 'block';
  isVisible = true;
  updateDashboard();
  
  // Announce for screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.style.position = 'absolute';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = 'ALEJO System Monitoring Dashboard is now open';
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
}

/**
 * Hide the monitoring dashboard
 */
export function hideDashboard() {
  if (dashboardElement) {
    dashboardElement.style.display = 'none';
    isVisible = false;
  }
}

/**
 * Toggle dashboard visibility
 */
export function toggleDashboard() {
  if (isVisible) {
    hideDashboard();
  } else {
    showDashboard();
  }
}

/**
 * Update the dashboard with current system information
 */
export function updateDashboard() {
  if (!dashboardElement || !isVisible) return;
  
  // Update each section if visible
  if (sections.overview) {
    updateOverviewSection();
  }
  
  if (sections.components) {
    updateComponentsSection();
  }
  
  if (sections.resources) {
    updateResourcesSection();
  }
  
  if (sections.errors) {
    updateErrorsSection();
  }
}

/**
 * Update the overview section
 */
function updateOverviewSection() {
  const overviewSection = dashboardElement.querySelector('#alejo-dashboard-overview');
  if (!overviewSection) return;
  
  const initStatus = getInitializationStatus();
  const resourceMode = getCurrentResourceMode();
  
  let statusClass = 'status-normal';
  let statusText = 'Normal';
  
  if (initStatus.failedComponents.length > 0) {
    statusClass = 'status-error';
    statusText = 'Error';
  } else if (initStatus.isInitializing) {
    statusClass = 'status-warning';
    statusText = 'Initializing';
  }
  
  overviewSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">System Overview</h3>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Status:</div>
      <div class="${statusClass}" style="font-weight: 500;">${statusText}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Resource Mode:</div>
      <div>${resourceMode || 'Unknown'}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Components:</div>
      <div>${initStatus.completedComponents.length} active / ${initStatus.failedComponents.length} failed</div>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <div>Last Updated:</div>
      <div>${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  
  // Add status styles
  const style = document.createElement('style');
  style.textContent = `
    .status-normal { color: #2e7d32; }
    .status-warning { color: #f57c00; }
    .status-error { color: #d32f2f; }
  `;
  overviewSection.appendChild(style);
}

/**
 * Update the components section
 */
function updateComponentsSection() {
  const componentsSection = dashboardElement.querySelector('#alejo-dashboard-components');
  if (!componentsSection) return;
  
  const componentStatus = getComponentStatus();
  const statusEntries = Object.entries(componentStatus);
  
  componentsSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Component Status</h3>
    <div style="max-height: 200px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">Component</th>
            <th style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${statusEntries.length === 0 ? 
            '<tr><td colspan="2" style="text-align: center; padding: 8px;">No components registered</td></tr>' : 
            statusEntries.map(([id, status]) => `
              <tr>
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${id}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee;">
                  <span class="status-${getStatusClass(status.status)}">${status.status}</span>
                </td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
  
  // Add status styles
  const style = document.createElement('style');
  style.textContent = `
    .status-initialized { color: #2e7d32; }
    .status-fallback { color: #f57c00; }
    .status-failed { color: #d32f2f; }
    .status-initializing { color: #1976d2; }
  `;
  componentsSection.appendChild(style);
}

/**
 * Get CSS class for component status
 */
function getStatusClass(status) {
  switch (status) {
    case 'initialized': return 'initialized';
    case 'fallback': return 'fallback';
    case 'failed': return 'failed';
    case 'initializing': return 'initializing';
    default: return '';
  }
}

/**
 * Update the resources section
 */
function updateResourcesSection() {
  const resourcesSection = dashboardElement.querySelector('#alejo-dashboard-resources');
  if (!resourcesSection) return;
  
  // Get memory usage
  const memoryUsage = window.performance && window.performance.memory ? 
    window.performance.memory : null;
  
  let memoryInfo = 'Not available';
  if (memoryUsage) {
    const usedHeap = Math.round(memoryUsage.usedJSHeapSize / (1024 * 1024));
    const totalHeap = Math.round(memoryUsage.totalJSHeapSize / (1024 * 1024));
    const heapLimit = Math.round(memoryUsage.jsHeapSizeLimit / (1024 * 1024));
    memoryInfo = `${usedHeap}MB / ${totalHeap}MB (Limit: ${heapLimit}MB)`;
  }
  
  resourcesSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Resource Usage</h3>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Memory:</div>
      <div>${memoryInfo}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <div>Network:</div>
      <div>${navigator.onLine ? 'Online' : 'Offline'}</div>
    </div>
    <div>
      <button id="alejo-resource-settings" style="margin-top: 8px; padding: 4px 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Configure Resource Thresholds
      </button>
    </div>
  `;
  
  // Add event listener for resource settings button
  const settingsButton = resourcesSection.querySelector('#alejo-resource-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      showResourceSettingsModal();
    });
  }
}

/**
 * Show resource settings modal
 */
function showResourceSettingsModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('alejo-resource-settings-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alejo-resource-settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'resource-settings-title');
    modal.setAttribute('aria-modal', 'true');
    
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      width: 400px;
      max-width: 90%;
    `;
    
    modalContent.innerHTML = `
      <h2 id="resource-settings-title" style="margin-top: 0;">Resource Thresholds</h2>
      <p>Configure when ALEJO should adapt to different resource modes.</p>
      
      <div style="margin-bottom: 16px;">
        <label for="memory-threshold" style="display: block; margin-bottom: 4px;">Memory Usage Threshold (%)</label>
        <input type="range" id="memory-threshold" min="50" max="90" value="75" style="width: 100%;">
        <div style="display: flex; justify-content: space-between;">
          <span>50%</span>
          <span id="memory-threshold-value">75%</span>
          <span>90%</span>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label for="cpu-threshold" style="display: block; margin-bottom: 4px;">CPU Usage Threshold (%)</label>
        <input type="range" id="cpu-threshold" min="50" max="90" value="70" style="width: 100%;">
        <div style="display: flex; justify-content: space-between;">
          <span>50%</span>
          <span id="cpu-threshold-value">70%</span>
          <span>90%</span>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label for="battery-threshold" style="display: block; margin-bottom: 4px;">Battery Threshold (%)</label>
        <input type="range" id="battery-threshold" min="10" max="50" value="20" style="width: 100%;">
        <div style="display: flex; justify-content: space-between;">
          <span>10%</span>
          <span id="battery-threshold-value">20%</span>
          <span>50%</span>
        </div>
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
        <button id="resource-settings-cancel" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
        <button id="resource-settings-save" style="padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Save
        </button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add event listeners
    const memorySlider = modal.querySelector('#memory-threshold');
    const memoryValue = modal.querySelector('#memory-threshold-value');
    memorySlider.addEventListener('input', () => {
      memoryValue.textContent = `${memorySlider.value}%`;
    });
    
    const cpuSlider = modal.querySelector('#cpu-threshold');
    const cpuValue = modal.querySelector('#cpu-threshold-value');
    cpuSlider.addEventListener('input', () => {
      cpuValue.textContent = `${cpuSlider.value}%`;
    });
    
    const batterySlider = modal.querySelector('#battery-threshold');
    const batteryValue = modal.querySelector('#battery-threshold-value');
    batterySlider.addEventListener('input', () => {
      batteryValue.textContent = `${batterySlider.value}%`;
    });
    
    modal.querySelector('#resource-settings-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.querySelector('#resource-settings-save').addEventListener('click', () => {
      // Save settings
      const settings = {
        memoryThreshold: parseInt(memorySlider.value, 10),
        cpuThreshold: parseInt(cpuSlider.value, 10),
        batteryThreshold: parseInt(batterySlider.value, 10)
      };
      
      try {
        localStorage.setItem('alejo_resource_thresholds', JSON.stringify(settings));
        // Publish event for resource manager to pick up
        const event = new CustomEvent('alejo:resource:thresholds:updated', { detail: settings });
        window.dispatchEvent(event);
      } catch (e) {
        console.warn('Failed to save resource thresholds:', e);
      }
      
      document.body.removeChild(modal);
    });
  } else {
    // Show existing modal
    modal.style.display = 'flex';
  }
  
  // Load saved settings
  try {
    const savedSettings = JSON.parse(localStorage.getItem('alejo_resource_thresholds'));
    if (savedSettings) {
      const memorySlider = modal.querySelector('#memory-threshold');
      const memoryValue = modal.querySelector('#memory-threshold-value');
      memorySlider.value = savedSettings.memoryThreshold;
      memoryValue.textContent = `${savedSettings.memoryThreshold}%`;
      
      const cpuSlider = modal.querySelector('#cpu-threshold');
      const cpuValue = modal.querySelector('#cpu-threshold-value');
      cpuSlider.value = savedSettings.cpuThreshold;
      cpuValue.textContent = `${savedSettings.cpuThreshold}%`;
      
      const batterySlider = modal.querySelector('#battery-threshold');
      const batteryValue = modal.querySelector('#battery-threshold-value');
      batterySlider.value = savedSettings.batteryThreshold;
      batteryValue.textContent = `${savedSettings.batteryThreshold}%`;
    }
  } catch (e) {
    console.warn('Failed to load resource thresholds:', e);
  }
  
  // Focus first interactive element for accessibility
  setTimeout(() => {
    const firstInput = modal.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);
}

/**
 * Update the errors section
 */
function updateErrorsSection() {
  const errorsSection = dashboardElement.querySelector('#alejo-dashboard-errors');
  if (!errorsSection) return;
  
  const errorLog = getErrorLog(5); // Get the 5 most recent errors
  
  errorsSection.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Recent Errors</h3>
    <div style="max-height: 200px; overflow-y: auto;">
      ${errorLog.length === 0 ? 
        '<div style="text-align: center; padding: 8px; color: #2e7d32;">No errors reported</div>' : 
        errorLog.map(error => `
          <div style="margin-bottom: 8px; padding: 8px; border-left: 3px solid ${getSeverityColor(error.severity)}; background: #f5f5f5;">
            <div style="font-weight: 500; margin-bottom: 4px;">${error.source}</div>
            <div style="font-size: 12px;">${error.message}</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">${new Date(error.timestamp).toLocaleString()}</div>
          </div>
        `).join('')
      }
    </div>
    ${errorLog.length > 0 ? 
      `<div style="text-align: right; margin-top: 8px;">
        <button id="alejo-view-all-errors" style="padding: 4px 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
          View All Errors
        </button>
      </div>` : ''
    }
  `;
  
  // Add event listener for view all errors button
  const viewAllButton = errorsSection.querySelector('#alejo-view-all-errors');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      showErrorLogModal();
    });
  }
}

/**
 * Get color for error severity
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'critical': return '#d32f2f';
    case 'high': return '#f57c00';
    case 'medium': return '#fbc02d';
    case 'low': return '#7cb342';
    case 'info': return '#1976d2';
    default: return '#757575';
  }
}

/**
 * Show error log modal
 */
function showErrorLogModal() {
  const errorLog = getErrorLog(50); // Get up to 50 errors
  
  // Create modal
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'error-log-title');
  modal.setAttribute('aria-modal', 'true');
  
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    width: 600px;
    max-width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  modalContent.innerHTML = `
    <h2 id="error-log-title" style="margin-top: 0;">Error Log</h2>
    <div style="margin-bottom: 16px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Time</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Source</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Severity</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Message</th>
          </tr>
        </thead>
        <tbody>
          ${errorLog.length === 0 ? 
            '<tr><td colspan="4" style="text-align: center; padding: 16px;">No errors logged</td></tr>' : 
            errorLog.map(error => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(error.timestamp).toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${error.source}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                  <span style="color: ${getSeverityColor(error.severity)};">${error.severity}</span>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${error.message}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <button id="error-log-clear" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Clear Log
      </button>
      <button id="error-log-close" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
        Close
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('#error-log-close').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.querySelector('#error-log-clear').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the error log?')) {
      try {
        localStorage.removeItem('alejo_error_log');
        document.body.removeChild(modal);
        updateDashboard();
      } catch (e) {
        console.warn('Failed to clear error log:', e);
      }
    }
  });
}

/**
 * Create a floating button to toggle the dashboard
 * 
 * @returns {HTMLElement} - The toggle button element
 */
export function createDashboardToggle() {
  let toggleButton = document.getElementById('alejo-dashboard-toggle');
  
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'alejo-dashboard-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle system monitoring dashboard');
    toggleButton.setAttribute('title', 'System Monitor');
    
    toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1976d2;
      color: white;
      border: none;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    `;
    
    toggleButton.innerHTML = '📊';
    
    toggleButton.addEventListener('click', () => {
      toggleDashboard();
    });
    
    document.body.appendChild(toggleButton);
  }
  
  return toggleButton;
}

// Export dashboard API
export default {
  init: initDashboard,
  show: showDashboard,
  hide: hideDashboard,
  toggle: toggleDashboard,
  update: updateDashboard,
  createToggle: createDashboardToggle
};
