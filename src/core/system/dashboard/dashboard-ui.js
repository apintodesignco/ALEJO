/**
 * @file dashboard-ui.js
 * @description UI component for the ALEJO system monitoring dashboard
 * @module core/system/dashboard/dashboard-ui
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../../event-bus.js';
import { Logger } from '../../logger.js';

// Logger instance
const logger = new Logger('DashboardUI');

// Default dashboard styles
const DEFAULT_STYLES = `
  .alejo-dashboard {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #333;
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 900px;
    margin: 0 auto;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .alejo-dashboard.high-contrast {
    color: #fff;
    background-color: #111;
    border: 1px solid #444;
  }
  
  .alejo-dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: linear-gradient(to right, #2c3e50, #4a5568);
    color: white;
  }
  
  .high-contrast .alejo-dashboard-header {
    background: #000;
    border-bottom: 2px solid #fff;
  }
  
  .alejo-dashboard-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
  
  .alejo-dashboard-controls {
    display: flex;
    gap: 12px;
  }
  
  .alejo-dashboard-button {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  
  .alejo-dashboard-button:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .high-contrast .alejo-dashboard-button {
    background: #333;
    border: 1px solid #fff;
  }
  
  .alejo-dashboard-content {
    padding: 20px;
  }
  
  .alejo-dashboard-section {
    margin-bottom: 20px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  
  .high-contrast .alejo-dashboard-section {
    border-color: #555;
  }
  
  .alejo-dashboard-section-header {
    background-color: #e2e8f0;
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .high-contrast .alejo-dashboard-section-header {
    background-color: #333;
    color: #fff;
  }
  
  .alejo-dashboard-section-title {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }
  
  .alejo-dashboard-section-body {
    padding: 15px;
    background-color: #fff;
  }
  
  .high-contrast .alejo-dashboard-section-body {
    background-color: #222;
    color: #fff;
  }
  
  .alejo-dashboard-metric {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .alejo-dashboard-metric-label {
    flex: 1;
    font-size: 14px;
  }
  
  .alejo-dashboard-metric-value {
    font-weight: 500;
    margin-left: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 14px;
    background-color: #edf2f7;
  }
  
  .high-contrast .alejo-dashboard-metric-value {
    background-color: #444;
  }
  
  .alejo-dashboard-progress {
    height: 8px;
    background-color: #edf2f7;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 5px;
    flex: 2;
  }
  
  .high-contrast .alejo-dashboard-progress {
    background-color: #444;
    border: 1px solid #666;
  }
  
  .alejo-dashboard-progress-bar {
    height: 100%;
    background-color: #4299e1;
    transition: width 0.3s ease;
  }
  
  .alejo-dashboard-progress-bar.warning {
    background-color: #f6ad55;
  }
  
  .alejo-dashboard-progress-bar.critical {
    background-color: #f56565;
  }
  
  .high-contrast .alejo-dashboard-progress-bar {
    background-color: #fff;
  }
  
  .high-contrast .alejo-dashboard-progress-bar.warning {
    background-color: #ffcc00;
  }
  
  .high-contrast .alejo-dashboard-progress-bar.critical {
    background-color: #ff6666;
  }
  
  .alejo-dashboard-status {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .alejo-dashboard-status.success {
    background-color: #c6f6d5;
    color: #22543d;
  }
  
  .alejo-dashboard-status.warning {
    background-color: #feebc8;
    color: #744210;
  }
  
  .alejo-dashboard-status.error {
    background-color: #fed7d7;
    color: #822727;
  }
  
  .high-contrast .alejo-dashboard-status.success {
    background-color: #0f0;
    color: #000;
  }
  
  .high-contrast .alejo-dashboard-status.warning {
    background-color: #ff0;
    color: #000;
  }
  
  .high-contrast .alejo-dashboard-status.error {
    background-color: #f00;
    color: #000;
  }
  
  .alejo-dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
  }
  
  .alejo-dashboard-card {
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 15px;
    background-color: #fff;
  }
  
  .high-contrast .alejo-dashboard-card {
    border-color: #555;
    background-color: #222;
  }
  
  .alejo-dashboard-error-log {
    max-height: 150px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 12px;
    background-color: #2d3748;
    color: #e2e8f0;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  
  .high-contrast .alejo-dashboard-error-log {
    background-color: #000;
    color: #fff;
    border: 1px solid #555;
  }
`;

/**
 * Creates the dashboard UI container
 * @param {Object} options - Dashboard creation options
 * @param {string} [options.containerId] - Optional ID for the dashboard container
 * @param {boolean} [options.highContrast=false] - Whether to enable high contrast mode
 * @returns {HTMLElement} The dashboard container element
 */
export function createDashboard(options = {}) {
  const {
    containerId = `alejo-dashboard-${Date.now()}`,
    highContrast = false
  } = options;
  
  logger.debug('Creating dashboard UI');
  
  // Create the main container
  const container = document.createElement('div');
  container.id = containerId;
  container.className = `alejo-dashboard ${highContrast ? 'high-contrast' : ''}`;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'ALEJO System Monitoring Dashboard');
  
  // Create the style element
  const styleElement = document.createElement('style');
  styleElement.textContent = DEFAULT_STYLES;
  
  // Create the dashboard structure
  container.innerHTML = `
    <div class="alejo-dashboard-header">
      <h2 class="alejo-dashboard-title">ALEJO System Monitor</h2>
      <div class="alejo-dashboard-controls">
        <button class="alejo-dashboard-button refresh-button" aria-label="Refresh Dashboard">
          Refresh
        </button>
        <button class="alejo-dashboard-button contrast-button" aria-label="Toggle High Contrast">
          ${highContrast ? 'Standard Contrast' : 'High Contrast'}
        </button>
        <button class="alejo-dashboard-button close-button" aria-label="Close Dashboard">
          Close
        </button>
      </div>
    </div>
    <div class="alejo-dashboard-content">
      <!-- Dashboard sections will be inserted here -->
    </div>
  `;
  
  // Add the style element to the container
  container.prepend(styleElement);
  
  // Return the created dashboard
  return container;
}

/**
 * Creates a dashboard section
 * @param {Object} options - Section creation options
 * @param {string} options.id - Section ID
 * @param {string} options.title - Section title
 * @param {boolean} [options.collapsible=true] - Whether section is collapsible
 * @param {boolean} [options.collapsed=false] - Whether section starts collapsed
 * @returns {HTMLElement} The created section element
 */
export function createDashboardSection(options) {
  const {
    id,
    title,
    collapsible = true,
    collapsed = false
  } = options;
  
  // Create section container
  const section = document.createElement('div');
  section.id = id;
  section.className = 'alejo-dashboard-section';
  section.setAttribute('aria-labelledby', `${id}-title`);
  
  // Create section header
  const header = document.createElement('div');
  header.className = 'alejo-dashboard-section-header';
  
  // Create section title
  const titleElement = document.createElement('h3');
  titleElement.id = `${id}-title`;
  titleElement.className = 'alejo-dashboard-section-title';
  titleElement.textContent = title;
  
  header.appendChild(titleElement);
  
  // Add collapse button if section is collapsible
  if (collapsible) {
    const collapseButton = document.createElement('button');
    collapseButton.className = 'alejo-dashboard-button collapse-button';
    collapseButton.textContent = collapsed ? 'Expand' : 'Collapse';
    collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    collapseButton.setAttribute('aria-controls', `${id}-body`);
    header.appendChild(collapseButton);
    
    // Add click event handler
    collapseButton.addEventListener('click', () => {
      const body = section.querySelector('.alejo-dashboard-section-body');
      const isCollapsed = body.style.display === 'none';
      body.style.display = isCollapsed ? 'block' : 'none';
      collapseButton.textContent = isCollapsed ? 'Collapse' : 'Expand';
      collapseButton.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    });
  }
  
  // Create section body
  const body = document.createElement('div');
  body.id = `${id}-body`;
  body.className = 'alejo-dashboard-section-body';
  
  if (collapsed && collapsible) {
    body.style.display = 'none';
  }
  
  // Assemble the section
  section.appendChild(header);
  section.appendChild(body);
  
  return section;
}

/**
 * Creates a metric row with progress bar
 * @param {Object} options - Metric options
 * @param {string} options.id - Metric ID
 * @param {string} options.label - Metric label
 * @param {number} options.value - Current value
 * @param {number} [options.max=100] - Maximum value
 * @param {number} [options.warningThreshold] - Warning threshold
 * @param {number} [options.criticalThreshold] - Critical threshold
 * @returns {HTMLElement} The created metric element
 */
export function createMetric(options) {
  const {
    id,
    label,
    value,
    max = 100,
    warningThreshold,
    criticalThreshold
  } = options;
  
  // Create metric container
  const metric = document.createElement('div');
  metric.id = id;
  metric.className = 'alejo-dashboard-metric';
  
  // Create metric label
  const labelElement = document.createElement('div');
  labelElement.className = 'alejo-dashboard-metric-label';
  labelElement.textContent = label;
  
  // Create progress container
  const progress = document.createElement('div');
  progress.className = 'alejo-dashboard-progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuenow', value);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', max);
  progress.setAttribute('aria-label', `${label}: ${value} out of ${max}`);
  
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  // Determine status
  let status = 'normal';
  if (criticalThreshold !== undefined && value >= criticalThreshold) {
    status = 'critical';
  } else if (warningThreshold !== undefined && value >= warningThreshold) {
    status = 'warning';
  }
  
  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.className = `alejo-dashboard-progress-bar ${status}`;
  progressBar.style.width = `${percentage}%`;
  
  // Create value display
  const valueElement = document.createElement('div');
  valueElement.className = 'alejo-dashboard-metric-value';
  valueElement.textContent = value;
  
  // Assemble the metric
  progress.appendChild(progressBar);
  metric.appendChild(labelElement);
  metric.appendChild(progress);
  metric.appendChild(valueElement);
  
  return metric;
}

/**
 * Creates a status indicator
 * @param {Object} options - Status options
 * @param {string} options.id - Status ID
 * @param {string} options.label - Status label
 * @param {string} options.status - Status value (success, warning, error)
 * @param {string} [options.message] - Optional status message
 * @returns {HTMLElement} The created status element
 */
export function createStatus(options) {
  const {
    id,
    label,
    status,
    message
  } = options;
  
  // Create status container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'alejo-dashboard-metric';
  
  // Create status label
  const labelElement = document.createElement('div');
  labelElement.className = 'alejo-dashboard-metric-label';
  labelElement.textContent = label;
  
  // Create status indicator
  const statusElement = document.createElement('div');
  statusElement.className = `alejo-dashboard-status ${status}`;
  statusElement.textContent = status.toUpperCase();
  
  // Assemble the status
  container.appendChild(labelElement);
  container.appendChild(statusElement);
  
  // Add message if provided
  if (message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'alejo-dashboard-metric-message';
    messageElement.textContent = message;
    container.appendChild(messageElement);
  }
  
  return container;
}

/**
 * Creates an error log section
 * @param {Object} options - Error log options
 * @param {string} options.id - Error log ID
 * @param {Array<Object>} options.errors - List of error objects
 * @returns {HTMLElement} The created error log element
 */
export function createErrorLog(options) {
  const {
    id,
    errors
  } = options;
  
  // Create error log container
  const container = document.createElement('div');
  container.id = id;
  container.className = 'alejo-dashboard-error-log';
  container.setAttribute('role', 'log');
  container.setAttribute('aria-label', 'System error log');
  
  // Add each error to the log
  if (Array.isArray(errors) && errors.length > 0) {
    const errorMessages = errors.map(err => {
      const timestamp = err.timestamp ? new Date(err.timestamp).toISOString() : new Date().toISOString();
      const component = err.component || 'unknown';
      const message = err.message || 'Unknown error';
      
      return `[${timestamp}] ${component}: ${message}`;
    });
    
    container.textContent = errorMessages.join('\n');
  } else {
    container.textContent = 'No errors reported.';
  }
  
  return container;
}

export default {
  createDashboard,
  createDashboardSection,
  createMetric,
  createStatus,
  createErrorLog
};
