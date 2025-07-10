/**
 * @file resource-dashboard-integration.js
 * @description Integration module for the ALEJO system-wide resource monitoring dashboard
 * @module core/system/resource-dashboard-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../event-bus.js';
import { Logger } from '../logger.js';
import { getResourceAllocationManager } from '../../performance/resource-allocation-manager.js';
import { getResourceThresholdConfig } from '../../performance/resource-threshold-config.js';
import { initializeResourceDashboard, showResourceDashboard, hideResourceDashboard, toggleResourceDashboard } from './resource-dashboard.js';

// Initialize logger
const logger = new Logger('ResourceDashboardIntegration');

// Integration state
let isInitialized = false;
let dashboardButton = null;
let eventBus = null;

/**
 * Initialize the resource dashboard integration
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export async function initializeResourceDashboardIntegration() {
  try {
    if (isInitialized) {
      logger.warn('Resource dashboard integration already initialized');
      return true;
    }

    logger.info('Initializing resource dashboard integration');

    // Get event bus instance
    eventBus = EventBus.getInstance();

    // Set up event listeners for dashboard toggle commands
    setupEventListeners();

    // Create dashboard toggle button in the UI
    createDashboardToggleButton();

    // Initialize the dashboard itself (hidden by default)
    await initializeResourceDashboard({ autoShow: false });

    // Add keyboard shortcut for dashboard (Alt+R)
    addKeyboardShortcut();

    isInitialized = true;
    logger.info('Resource dashboard integration initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize resource dashboard integration', error);
    return false;
  }
}

/**
 * Set up event listeners for dashboard commands
 */
function setupEventListeners() {
  eventBus.on('command:show-resource-dashboard', () => showResourceDashboard());
  eventBus.on('command:hide-resource-dashboard', () => hideResourceDashboard());
  eventBus.on('command:toggle-resource-dashboard', () => toggleResourceDashboard());
  eventBus.on('voice:command:show-resources', () => showResourceDashboard());
  eventBus.on('voice:command:hide-resources', () => hideResourceDashboard());
  eventBus.on('gesture:command:toggleResourceDashboard', () => toggleResourceDashboard());
}

/**
 * Create a button to toggle the resource dashboard
 * @returns {HTMLElement} The created button
 */
function createDashboardToggleButton() {
  // Check if button already exists
  if (dashboardButton) {
    return dashboardButton;
  }

  // Find the ALEJO main menu or toolbar
  const toolbar = document.getElementById('alejo-toolbar') || 
                 document.getElementById('app-toolbar') ||
                 document.querySelector('.toolbar') ||
                 document.querySelector('header');
  
  if (!toolbar) {
    logger.warn('Could not find toolbar to add dashboard toggle button');
    return null;
  }

  // Create the button
  dashboardButton = document.createElement('button');
  dashboardButton.className = 'toolbar-button resource-dashboard-toggle';
  dashboardButton.setAttribute('aria-label', 'Toggle Resource Dashboard');
  dashboardButton.setAttribute('title', 'System Resources');
  dashboardButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
    </svg>
    <span class="button-label">Resources</span>
  `;

  // Add click event
  dashboardButton.addEventListener('click', () => {
    toggleResourceDashboard();
  });

  // Add to toolbar
  toolbar.appendChild(dashboardButton);

  return dashboardButton;
}

/**
 * Add keyboard shortcut for toggling the dashboard (Alt+R)
 */
function addKeyboardShortcut() {
  document.addEventListener('keydown', (event) => {
    // Alt+R to toggle resource dashboard
    if (event.altKey && event.key === 'r') {
      event.preventDefault();
      toggleResourceDashboard();
    }
  });
}

/**
 * Update the dashboard toggle button state
 * @param {boolean} isOpen - Whether the dashboard is currently open
 */
export function updateDashboardButtonState(isOpen) {
  if (!dashboardButton) {
    return;
  }

  if (isOpen) {
    dashboardButton.classList.add('active');
    dashboardButton.setAttribute('aria-expanded', 'true');
  } else {
    dashboardButton.classList.remove('active');
    dashboardButton.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Create a floating button that can be added anywhere in the UI
 * @param {HTMLElement} container - The container to add the button to
 * @returns {HTMLElement} The created button
 */
export function createResourceMonitorButton(container) {
  if (!container) {
    logger.warn('No container provided for resource monitor button');
    return null;
  }

  const button = document.createElement('button');
  button.className = 'resource-monitor-button';
  button.setAttribute('aria-label', 'Open Resource Monitor');
  button.setAttribute('title', 'Open Resource Monitor');
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
    </svg>
    <span class="resource-utilization-indicator"></span>
  `;
  
  // Add click event
  button.addEventListener('click', () => {
    showResourceDashboard();
  });
  
  // Add to container
  container.appendChild(button);
  
  // Set up periodic updates of the utilization indicator
  setupUtilizationIndicator(button.querySelector('.resource-utilization-indicator'));
  
  return button;
}

/**
 * Setup periodic updates for the resource utilization indicator
 * @param {HTMLElement} indicator - The indicator element to update
 */
function setupUtilizationIndicator(indicator) {
  if (!indicator) return;
  
  const resourceManager = getResourceAllocationManager();
  const updateInterval = 5000; // Update every 5 seconds
  
  // Initial update
  updateUtilizationIndicator(indicator, resourceManager);
  
  // Set interval for updates
  setInterval(() => {
    updateUtilizationIndicator(indicator, resourceManager);
  }, updateInterval);
}

/**
 * Update the utilization indicator with current resource usage
 * @param {HTMLElement} indicator - The indicator element to update
 * @param {Object} resourceManager - Resource manager instance
 */
function updateUtilizationIndicator(indicator, resourceManager) {
  try {
    if (!indicator || !resourceManager) return;
    
    const usage = resourceManager.getResourceUsage();
    const cpuPercentage = usage?.cpu?.percentage || 0;
    const memoryPercentage = usage?.memory?.percentage || 0;
    
    // Get average utilization
    const avgUtilization = (cpuPercentage + memoryPercentage) / 2;
    
    // Determine status class
    let statusClass = 'normal';
    if (avgUtilization >= 90) {
      statusClass = 'critical';
    } else if (avgUtilization >= 70) {
      statusClass = 'warning';
    }
    
    // Update indicator
    indicator.className = `resource-utilization-indicator ${statusClass}`;
    indicator.setAttribute('data-percentage', Math.round(avgUtilization));
  } catch (error) {
    logger.error('Error updating utilization indicator', error);
  }
}

/**
 * Clean up the resource dashboard integration
 */
export function cleanupResourceDashboardIntegration() {
  if (!isInitialized) {
    return;
  }

  // Remove event listeners
  if (eventBus) {
    eventBus.off('command:show-resource-dashboard');
    eventBus.off('command:hide-resource-dashboard');
    eventBus.off('command:toggle-resource-dashboard');
    eventBus.off('voice:command:show-resources');
    eventBus.off('voice:command:hide-resources');
    eventBus.off('gesture:command:toggleResourceDashboard');
  }

  // Remove dashboard toggle button
  if (dashboardButton && dashboardButton.parentNode) {
    dashboardButton.parentNode.removeChild(dashboardButton);
    dashboardButton = null;
  }

  isInitialized = false;
  logger.info('Resource dashboard integration cleaned up');
}

// Export public API
export default {
  initialize: initializeResourceDashboardIntegration,
  createResourceMonitorButton,
  updateDashboardButtonState,
  cleanup: cleanupResourceDashboardIntegration
};
