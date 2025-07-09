/**
 * ALEJO Resource Monitoring Dashboard
 * 
 * This module provides a UI dashboard for monitoring system resource usage
 * and allows users to configure resource allocation preferences.
 * 
 * Features:
 * - Real-time CPU and memory usage visualization
 * - Component-level resource consumption breakdown
 * - User-configurable resource thresholds
 * - Resource mode controls (performance, balanced, efficiency)
 * - Accessibility-first design with keyboard navigation
 */

import { ResourceAllocationManager } from './resource-allocation-manager.js';
import { publishEvent, subscribeToEvent } from '../core/neural-architecture/neural-event-bus.js';
import { logPerformanceEvent } from './performance-logger.js';

// Dashboard state
const dashboardState = {
  isVisible: false,
  selectedTab: 'overview',
  updateInterval: 1000, // ms
  updateTimer: null,
  resourceData: {
    cpu: {
      current: 0,
      history: [],
      threshold: 80, // percent
    },
    memory: {
      current: 0,
      history: [],
      threshold: 70, // percent
    },
    components: new Map()
  }
};

// DOM element references
let dashboardElement = null;
let cpuGaugeElement = null;
let memoryGaugeElement = null;
let componentListElement = null;
let thresholdControlsElement = null;

/**
 * Initialize the resource monitoring dashboard
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializeResourceDashboard() {
  try {
    console.log('Initializing Resource Monitoring Dashboard');
    
    // Create dashboard DOM elements
    await createDashboardElements();
    
    // Subscribe to resource events
    subscribeToResourceEvents();
    
    // Start data collection
    startDataCollection();
    
    // Log initialization
    logPerformanceEvent('resource-dashboard-initialized', {
      updateInterval: dashboardState.updateInterval
    });
    
    return {
      success: true,
      dashboardElement
    };
  } catch (error) {
    console.error('Failed to initialize resource dashboard', error);
    logPerformanceEvent('resource-dashboard-init-failed', {
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Create the dashboard DOM elements
 * @returns {Promise<void>}
 */
async function createDashboardElements() {
  // Create main dashboard container
  dashboardElement = document.createElement('div');
  dashboardElement.id = 'alejo-resource-dashboard';
  dashboardElement.className = 'resource-dashboard';
  dashboardElement.setAttribute('aria-label', 'Resource Monitoring Dashboard');
  dashboardElement.setAttribute('role', 'region');
  
  // Create dashboard header
  const header = document.createElement('div');
  header.className = 'dashboard-header';
  header.innerHTML = `
    <h2>System Resources</h2>
    <div class="dashboard-controls">
      <button id="dashboard-close" aria-label="Close dashboard">×</button>
    </div>
  `;
  
  // Create tabs
  const tabs = document.createElement('div');
  tabs.className = 'dashboard-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `
    <button id="tab-overview" class="tab active" role="tab" aria-selected="true">Overview</button>
    <button id="tab-components" class="tab" role="tab" aria-selected="false">Components</button>
    <button id="tab-settings" class="tab" role="tab" aria-selected="false">Settings</button>
  `;
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'dashboard-content';
  
  // Create overview panel
  const overviewPanel = document.createElement('div');
  overviewPanel.id = 'panel-overview';
  overviewPanel.className = 'dashboard-panel active';
  overviewPanel.setAttribute('role', 'tabpanel');
  overviewPanel.setAttribute('aria-labelledby', 'tab-overview');
  
  // Create CPU and memory gauges
  cpuGaugeElement = createGauge('cpu-gauge', 'CPU Usage', '0%');
  memoryGaugeElement = createGauge('memory-gauge', 'Memory Usage', '0%');
  
  // Create resource mode selector
  const modeSelector = document.createElement('div');
  modeSelector.className = 'resource-mode-selector';
  modeSelector.innerHTML = `
    <h3>Resource Mode</h3>
    <div class="mode-buttons" role="radiogroup" aria-label="Resource mode">
      <button id="mode-performance" class="mode-button" role="radio" aria-checked="false">Performance</button>
      <button id="mode-balanced" class="mode-button active" role="radio" aria-checked="true">Balanced</button>
      <button id="mode-efficiency" class="mode-button" role="radio" aria-checked="false">Efficiency</button>
    </div>
  `;
  
  // Assemble overview panel
  overviewPanel.appendChild(cpuGaugeElement);
  overviewPanel.appendChild(memoryGaugeElement);
  overviewPanel.appendChild(modeSelector);
  
  // Create components panel
  const componentsPanel = document.createElement('div');
  componentsPanel.id = 'panel-components';
  componentsPanel.className = 'dashboard-panel';
  componentsPanel.setAttribute('role', 'tabpanel');
  componentsPanel.setAttribute('aria-labelledby', 'tab-components');
  
  // Create component list
  componentListElement = document.createElement('div');
  componentListElement.className = 'component-list';
  componentListElement.innerHTML = '<h3>Component Resource Usage</h3>';
  componentsPanel.appendChild(componentListElement);
  
  // Create settings panel
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'panel-settings';
  settingsPanel.className = 'dashboard-panel';
  settingsPanel.setAttribute('role', 'tabpanel');
  settingsPanel.setAttribute('aria-labelledby', 'tab-settings');
  
  // Create threshold controls
  thresholdControlsElement = document.createElement('div');
  thresholdControlsElement.className = 'threshold-controls';
  thresholdControlsElement.innerHTML = `
    <h3>Resource Thresholds</h3>
    <div class="threshold-control">
      <label for="cpu-threshold">CPU Threshold (%)</label>
      <input type="range" id="cpu-threshold" min="10" max="95" value="${dashboardState.resourceData.cpu.threshold}" />
      <span class="threshold-value">${dashboardState.resourceData.cpu.threshold}%</span>
    </div>
    <div class="threshold-control">
      <label for="memory-threshold">Memory Threshold (%)</label>
      <input type="range" id="memory-threshold" min="10" max="95" value="${dashboardState.resourceData.memory.threshold}" />
      <span class="threshold-value">${dashboardState.resourceData.memory.threshold}%</span>
    </div>
    <div class="update-interval-control">
      <label for="update-interval">Update Interval (ms)</label>
      <input type="number" id="update-interval" min="500" max="5000" step="100" value="${dashboardState.updateInterval}" />
    </div>
    <button id="save-settings" class="primary-button">Save Settings</button>
  `;
  settingsPanel.appendChild(thresholdControlsElement);
  
  // Assemble content area
  content.appendChild(overviewPanel);
  content.appendChild(componentsPanel);
  content.appendChild(settingsPanel);
  
  // Assemble dashboard
  dashboardElement.appendChild(header);
  dashboardElement.appendChild(tabs);
  dashboardElement.appendChild(content);
  
  // Add event listeners
  addEventListeners();
  
  // Initially hide the dashboard
  dashboardElement.style.display = 'none';
  
  // Append to body when DOM is ready
  if (document.body) {
    document.body.appendChild(dashboardElement);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(dashboardElement);
    });
  }
  
  // Add dashboard styles
  addDashboardStyles();
}

/**
 * Create a gauge element for resource visualization
 * @param {string} id - Element ID
 * @param {string} label - Gauge label
 * @param {string} value - Initial value
 * @returns {HTMLElement} - Gauge element
 */
function createGauge(id, label, value) {
  const gauge = document.createElement('div');
  gauge.className = 'resource-gauge';
  gauge.innerHTML = `
    <h3>${label}</h3>
    <div class="gauge-container">
      <div id="${id}" class="gauge">
        <div class="gauge-fill" style="width: 0%"></div>
      </div>
      <div class="gauge-value">${value}</div>
    </div>
  `;
  return gauge;
}

/**
 * Add event listeners to dashboard elements
 */
function addEventListeners() {
  // Close button
  const closeButton = dashboardElement.querySelector('#dashboard-close');
  closeButton.addEventListener('click', hideDashboard);
  
  // Tab switching
  const tabs = dashboardElement.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.id.replace('tab-', '');
      switchTab(tabId);
    });
  });
  
  // Resource mode selection
  const modeButtons = dashboardElement.querySelectorAll('.mode-button');
  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.id.replace('mode-', '');
      setResourceMode(mode);
    });
  });
  
  // Threshold controls
  const cpuThreshold = dashboardElement.querySelector('#cpu-threshold');
  cpuThreshold.addEventListener('input', e => {
    const value = e.target.value;
    dashboardElement.querySelector('#cpu-threshold + .threshold-value').textContent = `${value}%`;
  });
  
  const memoryThreshold = dashboardElement.querySelector('#memory-threshold');
  memoryThreshold.addEventListener('input', e => {
    const value = e.target.value;
    dashboardElement.querySelector('#memory-threshold + .threshold-value').textContent = `${value}%`;
  });
  
  // Save settings
  const saveButton = dashboardElement.querySelector('#save-settings');
  saveButton.addEventListener('click', saveSettings);
  
  // Keyboard navigation
  dashboardElement.addEventListener('keydown', handleKeyboardNavigation);
}

/**
 * Add dashboard styles to the document
 */
function addDashboardStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .resource-dashboard {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 1000;
      overflow: hidden;
      color: #333;
    }
    
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .dashboard-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    .dashboard-controls button {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
    }
    
    .dashboard-tabs {
      display: flex;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .dashboard-tabs .tab {
      flex: 1;
      padding: 8px 0;
      text-align: center;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 14px;
      color: #666;
    }
    
    .dashboard-tabs .tab.active {
      border-bottom-color: #0078d7;
      color: #0078d7;
      font-weight: 500;
    }
    
    .dashboard-content {
      padding: 16px;
    }
    
    .dashboard-panel {
      display: none;
    }
    
    .dashboard-panel.active {
      display: block;
    }
    
    .resource-gauge {
      margin-bottom: 16px;
    }
    
    .resource-gauge h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .gauge-container {
      display: flex;
      align-items: center;
    }
    
    .gauge {
      flex: 1;
      height: 16px;
      background: #f0f0f0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .gauge-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #FFC107, #F44336);
      transition: width 0.3s ease;
    }
    
    .gauge-value {
      margin-left: 8px;
      font-size: 14px;
      font-weight: 500;
      min-width: 40px;
      text-align: right;
    }
    
    .resource-mode-selector {
      margin-top: 24px;
    }
    
    .mode-buttons {
      display: flex;
      gap: 8px;
    }
    
    .mode-button {
      flex: 1;
      padding: 8px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #f5f5f5;
      cursor: pointer;
      font-size: 13px;
    }
    
    .mode-button.active {
      background: #0078d7;
      color: white;
      border-color: #0078d7;
    }
    
    .component-list {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .component-item {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .component-item:last-child {
      border-bottom: none;
    }
    
    .component-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    
    .component-name {
      font-weight: 500;
      font-size: 14px;
    }
    
    .component-status {
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .status-paused {
      background: #fff8e1;
      color: #f57f17;
    }
    
    .component-resources {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #666;
    }
    
    .threshold-controls {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .threshold-control {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .threshold-control label {
      font-size: 14px;
    }
    
    .update-interval-control {
      margin-top: 8px;
    }
    
    .primary-button {
      margin-top: 16px;
      padding: 8px 16px;
      background: #0078d7;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .primary-button:hover {
      background: #006cc1;
    }
    
    /* Accessibility focus styles */
    .resource-dashboard button:focus,
    .resource-dashboard input:focus {
      outline: 2px solid #0078d7;
      outline-offset: 2px;
    }
    
    /* High contrast mode */
    @media (forced-colors: active) {
      .resource-dashboard {
        border: 2px solid CanvasText;
      }
      
      .gauge-fill {
        background: Highlight;
      }
      
      .mode-button.active {
        background: Highlight;
        color: Canvas;
      }
    }
  `;
  
  document.head.appendChild(styleElement);
}

/**
 * Subscribe to resource-related events
 */
function subscribeToResourceEvents() {
  // Resource updates
  subscribeToEvent('resource-manager:update', handleResourceUpdate);
  
  // Component registration/unregistration
  subscribeToEvent('resource-manager:component-registered', handleComponentRegistered);
  subscribeToEvent('resource-manager:component-unregistered', handleComponentUnregistered);
  
  // Resource mode changes
  subscribeToEvent('resource-manager:mode-changed', handleResourceModeChanged);
  
  // Dashboard visibility toggle events
  subscribeToEvent('ui:toggle-resource-dashboard', toggleDashboard);
}

/**
 * Start collecting resource data
 */
function startDataCollection() {
  // Clear any existing timer
  if (dashboardState.updateTimer) {
    clearInterval(dashboardState.updateTimer);
  }
  
  // Set up regular updates
  dashboardState.updateTimer = setInterval(updateResourceData, dashboardState.updateInterval);
  
  // Initial update
  updateResourceData();
}

/**
 * Update resource data
 */
async function updateResourceData() {
  try {
    // Get current resource manager instance
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Get current resource usage
    const resourceUsage = await resourceManager.getCurrentResourceUsage();
    
    // Update dashboard state
    dashboardState.resourceData.cpu.current = resourceUsage.cpu;
    dashboardState.resourceData.memory.current = resourceUsage.memory;
    
    // Keep history (limited to 60 data points)
    dashboardState.resourceData.cpu.history.push(resourceUsage.cpu);
    if (dashboardState.resourceData.cpu.history.length > 60) {
      dashboardState.resourceData.cpu.history.shift();
    }
    
    dashboardState.resourceData.memory.history.push(resourceUsage.memory);
    if (dashboardState.resourceData.memory.history.length > 60) {
      dashboardState.resourceData.memory.history.shift();
    }
    
    // Update component data
    resourceUsage.components.forEach((usage, componentId) => {
      dashboardState.resourceData.components.set(componentId, usage);
    });
    
    // Update UI if dashboard is visible
    if (dashboardState.isVisible) {
      updateDashboardUI();
    }
  } catch (error) {
    console.error('Failed to update resource data', error);
  }
}

/**
 * Update the dashboard UI with current resource data
 */
function updateDashboardUI() {
  // Update CPU gauge
  const cpuValue = dashboardState.resourceData.cpu.current;
  const cpuGaugeFill = cpuGaugeElement.querySelector('.gauge-fill');
  const cpuGaugeValue = cpuGaugeElement.querySelector('.gauge-value');
  
  cpuGaugeFill.style.width = `${cpuValue}%`;
  cpuGaugeValue.textContent = `${cpuValue.toFixed(1)}%`;
  
  // Update memory gauge
  const memoryValue = dashboardState.resourceData.memory.current;
  const memoryGaugeFill = memoryGaugeElement.querySelector('.gauge-fill');
  const memoryGaugeValue = memoryGaugeElement.querySelector('.gauge-value');
  
  memoryGaugeFill.style.width = `${memoryValue}%`;
  memoryGaugeValue.textContent = `${memoryValue.toFixed(1)}%`;
  
  // Update component list if on components tab
  if (dashboardState.selectedTab === 'components') {
    updateComponentList();
  }
}

/**
 * Update the component list with current resource usage
 */
function updateComponentList() {
  // Clear existing list
  componentListElement.innerHTML = '<h3>Component Resource Usage</h3>';
  
  // Sort components by CPU usage (highest first)
  const sortedComponents = Array.from(dashboardState.resourceData.components.entries())
    .sort((a, b) => b[1].cpu - a[1].cpu);
  
  // Create component items
  sortedComponents.forEach(([componentId, usage]) => {
    const componentItem = document.createElement('div');
    componentItem.className = 'component-item';
    
    const statusClass = usage.isActive ? 'status-active' : 'status-paused';
    const statusText = usage.isActive ? 'Active' : 'Paused';
    
    componentItem.innerHTML = `
      <div class="component-header">
        <span class="component-name">${componentId}</span>
        <span class="component-status ${statusClass}">${statusText}</span>
      </div>
      <div class="component-resources">
        <span>CPU: ${usage.cpu.toFixed(1)}%</span>
        <span>Memory: ${usage.memory.toFixed(1)} MB</span>
        <span>Priority: ${usage.priority}</span>
      </div>
    `;
    
    componentListElement.appendChild(componentItem);
  });
  
  // Show message if no components
  if (sortedComponents.length === 0) {
    const noComponents = document.createElement('p');
    noComponents.textContent = 'No active components';
    componentListElement.appendChild(noComponents);
  }
}

/**
 * Switch between dashboard tabs
 * @param {string} tabId - Tab ID to switch to
 */
function switchTab(tabId) {
  // Update selected tab
  dashboardState.selectedTab = tabId;
  
  // Update tab buttons
  const tabs = dashboardElement.querySelectorAll('.tab');
  tabs.forEach(tab => {
    const isActive = tab.id === `tab-${tabId}`;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
  
  // Update panels
  const panels = dashboardElement.querySelectorAll('.dashboard-panel');
  panels.forEach(panel => {
    const isActive = panel.id === `panel-${tabId}`;
    panel.classList.toggle('active', isActive);
  });
  
  // Update component list if switching to components tab
  if (tabId === 'components') {
    updateComponentList();
  }
}

/**
 * Set the resource mode
 * @param {string} mode - Resource mode (performance, balanced, efficiency)
 */
async function setResourceMode(mode) {
  try {
    // Get resource manager instance
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Set the mode
    await resourceManager.setResourceMode(mode);
    
    // Update UI
    const modeButtons = dashboardElement.querySelectorAll('.mode-button');
    modeButtons.forEach(button => {
      const isActive = button.id === `mode-${mode}`;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-checked', isActive);
    });
    
    // Log event
    logPerformanceEvent('resource-mode-changed', { mode });
    
  } catch (error) {
    console.error('Failed to set resource mode', error);
  }
}

/**
 * Save dashboard settings
 */
async function saveSettings() {
  try {
    // Get values from inputs
    const cpuThreshold = parseInt(dashboardElement.querySelector('#cpu-threshold').value);
    const memoryThreshold = parseInt(dashboardElement.querySelector('#memory-threshold').value);
    const updateInterval = parseInt(dashboardElement.querySelector('#update-interval').value);
    
    // Update dashboard state
    dashboardState.resourceData.cpu.threshold = cpuThreshold;
    dashboardState.resourceData.memory.threshold = memoryThreshold;
    dashboardState.updateInterval = updateInterval;
    
    // Update data collection interval
    if (dashboardState.updateTimer) {
      clearInterval(dashboardState.updateTimer);
      dashboardState.updateTimer = setInterval(updateResourceData, updateInterval);
    }
    
    // Get resource manager instance
    const resourceManager = await ResourceAllocationManager.getInstance();
    
    // Update resource manager thresholds
    await resourceManager.setResourceThresholds({
      cpu: cpuThreshold,
      memory: memoryThreshold
    });
    
    // Log event
    logPerformanceEvent('resource-thresholds-updated', {
      cpu: cpuThreshold,
      memory: memoryThreshold,
      updateInterval
    });
    
    // Show confirmation
    const saveButton = dashboardElement.querySelector('#save-settings');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saved!';
    setTimeout(() => {
      saveButton.textContent = originalText;
    }, 2000);
    
  } catch (error) {
    console.error('Failed to save settings', error);
  }
}

/**
 * Handle resource update events
 * @param {Object} data - Event data
 */
function handleResourceUpdate(data) {
  // Update dashboard state with new data
  if (data.cpu !== undefined) {
    dashboardState.resourceData.cpu.current = data.cpu;
  }
  
  if (data.memory !== undefined) {
    dashboardState.resourceData.memory.current = data.memory;
  }
  
  // Update UI if dashboard is visible
  if (dashboardState.isVisible) {
    updateDashboardUI();
  }
}

/**
 * Handle component registration events
 * @param {Object} data - Event data
 */
function handleComponentRegistered(data) {
  // Add component to dashboard state
  dashboardState.resourceData.components.set(data.componentId, {
    cpu: 0,
    memory: data.memoryFootprint || 0,
    priority: data.cpuPriority || 5,
    isActive: true,
    isEssential: data.isEssential || false
  });
  
  // Update UI if dashboard is visible and on components tab
  if (dashboardState.isVisible && dashboardState.selectedTab === 'components') {
    updateComponentList();
  }
}

/**
 * Handle component unregistration events
 * @param {Object} data - Event data
 */
function handleComponentUnregistered(data) {
  // Remove component from dashboard state
  dashboardState.resourceData.components.delete(data.componentId);
  
  // Update UI if dashboard is visible and on components tab
  if (dashboardState.isVisible && dashboardState.selectedTab === 'components') {
    updateComponentList();
  }
}

/**
 * Handle resource mode change events
 * @param {Object} data - Event data
 */
function handleResourceModeChanged(data) {
  // Update mode buttons
  const modeButtons = dashboardElement.querySelectorAll('.mode-button');
  modeButtons.forEach(button => {
    const isActive = button.id === `mode-${data.mode}`;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-checked', isActive);
  });
}

/**
 * Handle keyboard navigation
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyboardNavigation(event) {
  // Escape key closes dashboard
  if (event.key === 'Escape') {
    hideDashboard();
    event.preventDefault();
  }
  
  // Tab key navigation
  if (event.key === 'Tab') {
    // Keep focus within dashboard
    const focusableElements = dashboardElement.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey && document.activeElement === firstElement) {
      lastElement.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      firstElement.focus();
      event.preventDefault();
    }
  }
}

/**
 * Show the dashboard
 */
export function showDashboard() {
  if (!dashboardElement) return;
  
  dashboardElement.style.display = 'block';
  dashboardState.isVisible = true;
  
  // Update UI with current data
  updateDashboardUI();
  
  // Focus first interactive element
  setTimeout(() => {
    const firstButton = dashboardElement.querySelector('button');
    if (firstButton) firstButton.focus();
  }, 100);
  
  // Publish event
  publishEvent('ui:resource-dashboard:shown', {});
}

/**
 * Hide the dashboard
 */
export function hideDashboard() {
  if (!dashboardElement) return;
  
  dashboardElement.style.display = 'none';
  dashboardState.isVisible = false;
  
  // Publish event
  publishEvent('ui:resource-dashboard:hidden', {});
}

/**
 * Toggle dashboard visibility
 */
export function toggleDashboard() {
  if (dashboardState.isVisible) {
    hideDashboard();
  } else {
    showDashboard();
  }
}

/**
 * Get current dashboard state
 * @returns {Object} - Current dashboard state
 */
export function getDashboardState() {
  return {
    isVisible: dashboardState.isVisible,
    selectedTab: dashboardState.selectedTab,
    updateInterval: dashboardState.updateInterval,
    cpuThreshold: dashboardState.resourceData.cpu.threshold,
    memoryThreshold: dashboardState.resourceData.memory.threshold
  };
}
