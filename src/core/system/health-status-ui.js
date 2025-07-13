/**
 * @file health-status-ui.js
 * @description UI components for displaying component health status in the resource dashboard
 * @module core/system/health-status-ui
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { Logger } from '../logger.js';
import componentHealthMonitor from './component-health-monitor.js';
import { announce } from '../../personalization/accessibility/screen-reader-announcements.js';
import { EventBus } from '../event-bus.js';

// Initialize logger
const logger = new Logger('HealthStatusUI');

// DOM element references
let healthSection = null;
let componentList = null;
let statusIndicator = null;
let lastCheckTime = null;
let checkButton = null;

// Status colors and icons
const STATUS_CLASSES = {
  online: 'status-healthy',
  healthy: 'status-healthy',
  degraded: 'status-warning',
  error: 'status-critical',
  unknown: 'status-unknown'
};

const STATUS_ICONS = {
  online: '<span class="icon">✓</span>',
  healthy: '<span class="icon">✓</span>',
  degraded: '<span class="icon">⚠</span>',
  error: '<span class="icon">✕</span>',
  unknown: '<span class="icon">?</span>'
};

const STATUS_LABELS = {
  online: 'Healthy',
  healthy: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
  unknown: 'Unknown'
};

/**
 * Create and initialize the health status UI section
 * @param {HTMLElement} dashboard - Dashboard container element
 */
function createHealthStatusSection(dashboard) {
  if (!dashboard || healthSection) return;
  
  try {
    // Create health status section
    healthSection = document.createElement('section');
    healthSection.id = 'alejo-health-status-section';
    healthSection.className = 'dashboard-section';
    healthSection.setAttribute('aria-label', 'System Health Status');
    
    // Create health status header
    const header = document.createElement('header');
    header.className = 'section-header';
    header.innerHTML = '<h3>Component Health</h3>';
    
    // Create status indicator
    statusIndicator = document.createElement('div');
    statusIndicator.className = 'overall-status-indicator status-unknown';
    statusIndicator.innerHTML = `
      ${STATUS_ICONS.unknown}
      <span class="status-label">System Health: Unknown</span>
    `;
    
    // Create last check time element
    lastCheckTime = document.createElement('div');
    lastCheckTime.className = 'last-check-time';
    lastCheckTime.textContent = 'Last checked: Never';
    
    // Create check button
    checkButton = document.createElement('button');
    checkButton.className = 'check-health-button';
    checkButton.innerHTML = '<span class="icon">↻</span> Check Now';
    checkButton.setAttribute('aria-label', 'Run system health check now');
    checkButton.addEventListener('click', handleCheckButtonClick);
    
    // Create component list container
    componentList = document.createElement('div');
    componentList.className = 'component-list';
    componentList.setAttribute('aria-label', 'Component health status list');
    
    // Assemble health section
    header.appendChild(statusIndicator);
    header.appendChild(checkButton);
    healthSection.appendChild(header);
    healthSection.appendChild(lastCheckTime);
    healthSection.appendChild(componentList);
    
    // Add to dashboard
    dashboard.appendChild(healthSection);
    
    // Subscribe to health status events
    EventBus.subscribe('monitoring:systemHealth', updateHealthStatus);
    
    logger.debug('Health status UI section created');
    
    // Initial update
    updateHealthStatusFromMonitor();
  } catch (error) {
    logger.error('Failed to create health status section', error);
  }
}

/**
 * Handle check button click
 * @param {Event} event - Click event
 */
async function handleCheckButtonClick(event) {
  event.preventDefault();
  
  // Disable button while checking
  checkButton.disabled = true;
  checkButton.innerHTML = '<span class="icon spin">↻</span> Checking...';
  
  announce('Running system health check...');
  
  try {
    await componentHealthMonitor.performSystemHealthCheck();
    
    // Button will be re-enabled when the monitoring:systemHealth event is received
    // and updateHealthStatus is called
  } catch (error) {
    logger.error('Health check failed', error);
    checkButton.disabled = false;
    checkButton.innerHTML = '<span class="icon">↻</span> Check Now';
    announce('Health check failed. Please try again.');
  }
}

/**
 * Update health status from the component health monitor
 */
function updateHealthStatusFromMonitor() {
  const healthStatus = componentHealthMonitor.getHealthStatus();
  updateHealthStatus(healthStatus);
}

/**
 * Update the health status UI with new data
 * @param {Object} data - Health status data
 */
function updateHealthStatus(data) {
  if (!healthSection || !componentList) return;
  
  const { overall, components, timestamp } = data;
  
  // Update overall status indicator
  if (statusIndicator && overall) {
    const statusClass = STATUS_CLASSES[overall] || STATUS_CLASSES.unknown;
    const statusIcon = STATUS_ICONS[overall] || STATUS_ICONS.unknown;
    const statusLabel = STATUS_LABELS[overall] || STATUS_LABELS.unknown;
    
    statusIndicator.className = `overall-status-indicator ${statusClass}`;
    statusIndicator.innerHTML = `
      ${statusIcon}
      <span class="status-label">System Health: ${statusLabel}</span>
    `;
  }
  
  // Update last check time
  if (lastCheckTime && timestamp) {
    const checkTime = new Date(timestamp).toLocaleTimeString();
    lastCheckTime.textContent = `Last checked: ${checkTime}`;
  }
  
  // Re-enable check button
  if (checkButton) {
    checkButton.disabled = false;
    checkButton.innerHTML = '<span class="icon">↻</span> Check Now';
  }
  
  // Update component list
  if (componentList && components) {
    // Clear existing items
    componentList.innerHTML = '';
    
    // Sort components by status severity (error > degraded > unknown > healthy)
    const sortedComponents = Object.entries(components).sort((a, b) => {
      const statusOrder = {
        'error': 0,
        'degraded': 1,
        'unknown': 2,
        'healthy': 3,
        'online': 3
      };
      
      const aStatus = statusOrder[a[1].status] ?? 2;
      const bStatus = statusOrder[b[1].status] ?? 2;
      
      return aStatus - bStatus;
    });
    
    // Create list items for each component
    for (const [componentId, componentData] of sortedComponents) {
      const status = componentData.status || 'unknown';
      const statusClass = STATUS_CLASSES[status] || STATUS_CLASSES.unknown;
      const statusIcon = STATUS_ICONS[status] || STATUS_ICONS.unknown;
      
      // Create component item
      const componentItem = document.createElement('div');
      componentItem.className = `component-item ${statusClass}`;
      componentItem.setAttribute('data-component-id', componentId);
      
      // Format component ID for display (camelCase to Title Case)
      const displayName = componentId
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      
      // Create item content
      componentItem.innerHTML = `
        <div class="component-status">
          ${statusIcon}
          <span class="component-name">${displayName}</span>
        </div>
        <div class="component-details">
          <span class="status-label">${STATUS_LABELS[status] || 'Unknown'}</span>
        </div>
      `;
      
      // Add details if available
      if (componentData.details && Object.keys(componentData.details).length > 0) {
        const detailsElement = document.createElement('div');
        detailsElement.className = 'detailed-status';
        
        for (const [key, value] of Object.entries(componentData.details)) {
          if (key === 'message' && value) {
            detailsElement.innerHTML += `<div class="status-message">${value}</div>`;
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            detailsElement.innerHTML += `<div class="status-detail"><span>${key}:</span> ${value}</div>`;
          }
        }
        
        componentItem.appendChild(detailsElement);
      }
      
      // Add error message if present
      if (componentData.error) {
        const errorElement = document.createElement('div');
        errorElement.className = 'component-error';
        errorElement.textContent = componentData.error;
        componentItem.appendChild(errorElement);
      }
      
      // Add click handler to show/hide details
      componentItem.addEventListener('click', () => {
        componentItem.classList.toggle('expanded');
      });
      
      // Add to list
      componentList.appendChild(componentItem);
    }
    
    // If no components, show message
    if (sortedComponents.length === 0) {
      componentList.innerHTML = '<div class="no-components-message">No component health data available</div>';
    }
    
    // Announce critical issues to screen readers
    const errorCount = sortedComponents.filter(([, data]) => data.status === 'error').length;
    const degradedCount = sortedComponents.filter(([, data]) => data.status === 'degraded').length;
    
    if (errorCount > 0 || degradedCount > 0) {
      const message = `Alert: ${errorCount} components with errors, ${degradedCount} degraded components.`;
      announce(message, 'alert');
    }
  }
}

/**
 * Clean up health status UI resources
 */
function cleanupHealthStatusUI() {
  // Unsubscribe from events
  EventBus.unsubscribe('monitoring:systemHealth', updateHealthStatus);
  
  // Remove event listeners
  if (checkButton) {
    checkButton.removeEventListener('click', handleCheckButtonClick);
  }
  
  // Clear references
  healthSection = null;
  componentList = null;
  statusIndicator = null;
  lastCheckTime = null;
  checkButton = null;
  
  logger.debug('Health status UI cleaned up');
}

// Export public API
export {
  createHealthStatusSection,
  updateHealthStatus,
  updateHealthStatusFromMonitor,
  cleanupHealthStatusUI
};
