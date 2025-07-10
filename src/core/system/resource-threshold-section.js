/**
 * @file resource-threshold-section.js
 * @description Resource threshold configuration section for the ALEJO monitoring dashboard
 * @module core/system/resource-threshold-section
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { createResourceThresholdUI } from './resource-threshold-ui.js';
import { DEFAULT_THRESHOLDS } from '../../performance/resource-threshold-config.js';
import { EventBus } from '../event-bus.js';
import { Logger } from '../logger.js';

// Initialize logger
const logger = new Logger('ResourceThresholdSection');

/**
 * State for threshold configuration UI
 * @type {Object}
 */
const state = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  preferences: {},
  isVisible: false,
  isConfigLoaded: false,
  pendingChanges: {},
  pendingPreferences: {},
  eventBus: EventBus.getInstance()
};

/**
 * Initialize the resource threshold section
 * @returns {Promise<boolean>} Whether initialization succeeded
 */
export async function initializeResourceThresholdSection() {
  try {
    // Set up event listeners
    state.eventBus.on('resource-thresholds:config', handleConfigData);
    state.eventBus.on('dashboard:open-resource-config', showThresholdConfig);
    state.eventBus.on('resource-thresholds:updated', handleThresholdUpdate);
    state.eventBus.on('resource-thresholds:bulk-update', handleBulkThresholdUpdate);
    state.eventBus.on('resource-thresholds:reset', handleThresholdReset);
    
    // Request initial configuration data
    requestConfigData();
    
    logger.info('Resource threshold section initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize resource threshold section', error);
    return false;
  }
}

/**
 * Request configuration data from resource threshold configuration
 */
function requestConfigData() {
  state.eventBus.emit('resource-thresholds:request-config');
}

/**
 * Handle configuration data from resource threshold configuration
 * @param {Object} data - Configuration data
 */
function handleConfigData(data) {
  state.thresholds = data.thresholds;
  state.preferences = data.preferences;
  state.isConfigLoaded = true;
  
  logger.debug('Received resource threshold configuration', data);
  
  // Update UI if visible
  if (state.isVisible && state.thresholdUI) {
    updateThresholdUI();
  }
}

/**
 * Handle threshold update event
 * @param {Object} data - Threshold update data
 */
function handleThresholdUpdate(data) {
  if (!state.thresholds[data.resource]) {
    state.thresholds[data.resource] = {};
  }
  
  state.thresholds[data.resource][data.level] = data.value;
  
  logger.debug(`Resource threshold updated: ${data.resource}.${data.level} = ${data.value}`);
}

/**
 * Handle bulk threshold update event
 * @param {Object} data - Bulk threshold update data
 */
function handleBulkThresholdUpdate(data) {
  state.thresholds = { ...data.thresholds };
  logger.debug('Resource thresholds bulk updated', state.thresholds);
}

/**
 * Handle threshold reset event
 * @param {Object} data - Reset data
 */
function handleThresholdReset(data) {
  state.thresholds = { ...data.thresholds };
  state.pendingChanges = {};
  logger.debug('Resource thresholds reset to defaults', state.thresholds);
}

/**
 * Show the threshold configuration UI
 * @param {Object} data - Configuration data
 */
function showThresholdConfig(data) {
  if (data) {
    // Update state with new data if provided
    state.thresholds = data.thresholds || state.thresholds;
    state.preferences = data.preferences || state.preferences;
    state.isConfigLoaded = true;
  }
  
  // Show configuration UI
  showThresholdUI();
}

/**
 * Create and show the threshold configuration UI
 */
function showThresholdUI() {
  // Don't create multiple instances
  if (state.thresholdUI && state.thresholdUI.isConnected) {
    return;
  }
  
  // Create UI
  state.thresholdUI = createResourceThresholdUI({
    thresholds: state.thresholds,
    preferences: state.preferences,
    onUpdateThreshold: updateThreshold,
    onUpdatePreference: updatePreference,
    onReset: resetThresholds
  });
  
  // Add close handler
  state.thresholdUI.addEventListener('close', hideThresholdUI);
  
  // Add to dashboard
  const dashboardContainer = document.querySelector('#monitoring-dashboard') || document.body;
  
  // Create a modal wrapper
  const modalWrapper = document.createElement('div');
  modalWrapper.className = 'resource-threshold-modal';
  modalWrapper.id = 'resource-threshold-modal';
  modalWrapper.setAttribute('role', 'dialog');
  modalWrapper.setAttribute('aria-modal', 'true');
  modalWrapper.setAttribute('aria-labelledby', 'threshold-config-title');
  
  // Add styles to modal wrapper
  modalWrapper.style.position = 'fixed';
  modalWrapper.style.top = '0';
  modalWrapper.style.left = '0';
  modalWrapper.style.right = '0';
  modalWrapper.style.bottom = '0';
  modalWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modalWrapper.style.display = 'flex';
  modalWrapper.style.justifyContent = 'center';
  modalWrapper.style.alignItems = 'center';
  modalWrapper.style.zIndex = '1000';
  
  // Add click handler to close when clicking outside
  modalWrapper.addEventListener('click', (event) => {
    if (event.target === modalWrapper) {
      hideThresholdUI();
    }
  });
  
  // Add UI to modal
  modalWrapper.appendChild(state.thresholdUI);
  
  // Add modal to dashboard
  dashboardContainer.appendChild(modalWrapper);
  
  // Set visible state
  state.isVisible = true;
  
  // Focus first tab for accessibility
  setTimeout(() => {
    const firstTab = state.thresholdUI.querySelector('.tab');
    if (firstTab) {
      firstTab.focus();
    }
  }, 100);
  
  logger.debug('Showing resource threshold configuration UI');
}

/**
 * Hide the threshold configuration UI
 */
function hideThresholdUI() {
  const modal = document.querySelector('#resource-threshold-modal');
  if (modal) {
    modal.remove();
  }
  
  state.isVisible = false;
  logger.debug('Hiding resource threshold configuration UI');
  
  // Apply any pending changes if needed
  applyPendingChanges();
}

/**
 * Apply any pending changes
 */
function applyPendingChanges() {
  // If there are pending changes, apply them
  if (Object.keys(state.pendingChanges).length > 0 || Object.keys(state.pendingPreferences).length > 0) {
    // Emit event to apply changes
    if (Object.keys(state.pendingChanges).length > 0) {
      state.eventBus.emit('resource-thresholds:apply', {
        thresholds: state.pendingChanges
      });
      
      state.pendingChanges = {};
    }
    
    // Emit event to apply preference changes
    if (Object.keys(state.pendingPreferences).length > 0) {
      state.eventBus.emit('resource-thresholds:apply-preferences', {
        preferences: state.pendingPreferences
      });
      
      state.pendingPreferences = {};
    }
    
    logger.debug('Applied pending resource threshold changes');
  }
}

/**
 * Update the threshold UI with current state
 */
function updateThresholdUI() {
  // To be implemented if needed
}

/**
 * Update a threshold value
 * @param {string} resource - Resource type (cpu, memory, etc.)
 * @param {string} level - Threshold level (warning, critical, etc.)
 * @param {number} value - New threshold value
 */
function updateThreshold(resource, level, value) {
  // Update local state
  if (!state.thresholds[resource]) {
    state.thresholds[resource] = {};
  }
  
  state.thresholds[resource][level] = value;
  
  // Track pending changes if not applying immediately
  if (!state.preferences.applyImmediately) {
    if (!state.pendingChanges[resource]) {
      state.pendingChanges[resource] = {};
    }
    
    state.pendingChanges[resource][level] = value;
  } else {
    // Apply immediately
    state.eventBus.emit('resource-thresholds:update', {
      resource,
      level,
      value
    });
  }
  
  logger.debug(`Resource threshold updated: ${resource}.${level} = ${value}`);
}

/**
 * Update a preference value
 * @param {string} preference - Preference name
 * @param {any} value - New preference value
 */
function updatePreference(preference, value) {
  // Update local state
  state.preferences[preference] = value;
  
  // Track pending changes if not applying immediately
  if (!state.preferences.applyImmediately && preference !== 'applyImmediately') {
    state.pendingPreferences[preference] = value;
  } else {
    // Apply immediately or if the preference is applyImmediately
    state.eventBus.emit('resource-thresholds:update-preference', {
      preference,
      value
    });
    
    // If turning on apply immediately, apply all pending changes
    if (preference === 'applyImmediately' && value === true) {
      applyPendingChanges();
    }
  }
  
  logger.debug(`Resource preference updated: ${preference} = ${value}`);
}

/**
 * Reset thresholds to default values
 */
function resetThresholds() {
  // Emit reset event
  state.eventBus.emit('resource-thresholds:reset-request');
  
  // Clear pending changes
  state.pendingChanges = {};
  state.pendingPreferences = {};
  
  logger.debug('Requested resource threshold reset to defaults');
}

/**
 * Add a button to open the resource threshold configuration
 * @param {HTMLElement} container - Container to add button to
 * @returns {HTMLElement} The created button
 */
export function createThresholdConfigButton(container) {
  const button = document.createElement('button');
  button.className = 'config-button resource-threshold-button';
  button.textContent = 'Configure Resource Thresholds';
  button.setAttribute('aria-label', 'Open resource threshold configuration');
  
  // Add icon (using Unicode for simplicity)
  const icon = document.createElement('span');
  icon.textContent = '⚙️';
  icon.style.marginRight = '5px';
  button.prepend(icon);
  
  button.addEventListener('click', () => {
    state.eventBus.emit('dashboard:open-resource-config');
  });
  
  if (container) {
    container.appendChild(button);
  }
  
  return button;
}

/**
 * Add a resource threshold UI section to a dashboard container
 * @param {HTMLElement} container - Dashboard container
 * @returns {HTMLElement} The created section element
 */
export function addResourceThresholdSection(container) {
  const section = document.createElement('section');
  section.className = 'dashboard-section resource-thresholds-section';
  section.innerHTML = `
    <h2 class="section-title">Resource Management</h2>
    <div class="section-content">
      <div class="resource-thresholds-summary">
        <p>Configure how ALEJO manages system resources and adapts to different resource availability scenarios.</p>
        <div class="thresholds-quick-view">
          <div class="quick-view-item">
            <span class="item-label">CPU Warning:</span>
            <span class="item-value cpu-warning">${state.thresholds.cpu?.warning || DEFAULT_THRESHOLDS.cpu.warning}%</span>
          </div>
          <div class="quick-view-item">
            <span class="item-label">Memory Warning:</span>
            <span class="item-value memory-warning">${state.thresholds.memory?.warning || DEFAULT_THRESHOLDS.memory.warning}%</span>
          </div>
          <div class="quick-view-item">
            <span class="item-label">Temperature Warning:</span>
            <span class="item-value temperature-warning">${state.thresholds.temperature?.warning || DEFAULT_THRESHOLDS.temperature.warning}°C</span>
          </div>
        </div>
      </div>
      <div class="section-actions">
        <button class="open-thresholds-config">Configure Resource Thresholds</button>
      </div>
    </div>
  `;
  
  // Add click handler for the configuration button
  const configButton = section.querySelector('.open-thresholds-config');
  configButton.addEventListener('click', () => {
    state.eventBus.emit('dashboard:open-resource-config');
  });
  
  // Add section to container
  if (container) {
    container.appendChild(section);
  }
  
  return section;
}

/**
 * Update the resource threshold summary display with current values
 */
export function updateResourceThresholdSummary() {
  const cpuWarningEl = document.querySelector('.thresholds-quick-view .cpu-warning');
  const memoryWarningEl = document.querySelector('.thresholds-quick-view .memory-warning');
  const temperatureWarningEl = document.querySelector('.thresholds-quick-view .temperature-warning');
  
  if (cpuWarningEl) {
    cpuWarningEl.textContent = `${state.thresholds.cpu?.warning || DEFAULT_THRESHOLDS.cpu.warning}%`;
  }
  
  if (memoryWarningEl) {
    memoryWarningEl.textContent = `${state.thresholds.memory?.warning || DEFAULT_THRESHOLDS.memory.warning}%`;
  }
  
  if (temperatureWarningEl) {
    temperatureWarningEl.textContent = `${state.thresholds.temperature?.warning || DEFAULT_THRESHOLDS.temperature.warning}°C`;
  }
}

/**
 * Create a threshold configuration button for use in dashboard sections
 * @param {string} [buttonText='Configure Thresholds'] - Text to display on the button
 * @param {string} [className='threshold-config-button'] - CSS class to apply to the button
 * @param {Function} [onClick=null] - Optional callback function to execute when button is clicked
 * @returns {HTMLButtonElement} - The created button element
 */
function createThresholdConfigButton(buttonText = 'Configure Thresholds', className = 'threshold-config-button', onClick = null) {
  const button = document.createElement('button');
  button.textContent = buttonText;
  button.className = className || 'threshold-config-button';
  button.setAttribute('aria-label', 'Configure resource thresholds');
  button.style.padding = '4px 8px';
  button.style.fontSize = '12px';
  button.style.backgroundColor = '#f5f5f5';
  button.style.border = '1px solid #ddd';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#e9e9e9';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#f5f5f5';
  });
  
  // Add keyboard focus styles
  button.addEventListener('focus', () => {
    button.style.outline = '2px solid #0078d7';
  });
  button.addEventListener('blur', () => {
    button.style.outline = 'none';
  });
  
  // Add click handler
  button.addEventListener('click', (event) => {
    if (typeof onClick === 'function') {
      onClick(event);
    } else {
      // Use the EventBus instance from state
      state.eventBus.emit('dashboard:open-resource-config');
    }
  });
  
  return button;
}

// Get the current thresholds
function getResourceThresholds() {
  return { ...state.thresholds };
}

// Save thresholds to persistent storage
function saveThresholds() {
  // Implementation details will depend on how ALEJO stores configurations
  return state.thresholds;
}

// Export the resource threshold section module functions
export {
  initializeResourceThresholdSection,
  updateThresholds,
  showThresholdUI,
  saveThresholds,
  getResourceThresholds,
  createThresholdConfigButton,
  updateResourceThresholdSummary
};
