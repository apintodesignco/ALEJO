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
import { RESOURCE_MODES, getCurrentResourceMode } from '../../performance/resource-allocation-manager.js';
import { EventBus } from '../event-bus.js';
import { Logger } from '../logger.js';
import { AuditTrail } from '../../security/audit-trail.js';

// Initialize logger and audit trail
const logger = new Logger('ResourceThresholdSection');
const auditTrail = new AuditTrail('resource-management');

/**
 * State for threshold configuration UI
 * @type {Object}
 */
const state = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  preferences: {
    applyImmediately: true,
    notifyOnThresholdCrossing: true,
    adaptResourceMode: true,
    userNotifications: true,
    showDashboardIndicator: true
  },
  isVisible: false,
  isConfigLoaded: false,
  pendingChanges: {},
  pendingPreferences: {},
  eventBus: EventBus.getInstance(),
  currentResourceMode: 'normal',
  initialized: false
};

/**
 * Initialize the threshold section
 */
function initialize() {
  if (!state.initialized) {
    setupEventListeners();
    initializeThresholdUI();
    checkForFailedConfigurations();
    state.initialized = true;
  }
}

/**
 * Check for any failed threshold configurations from previous sessions
 */
function checkForFailedConfigurations() {
  try {
    // Check if there's a failure flag from a previous session
    const failedConfigFlag = localStorage.getItem('alejo_threshold_config_failed');
    if (failedConfigFlag) {
      // Clear the flag first to prevent loops
      localStorage.removeItem('alejo_threshold_config_failed');
      
      // Check for available backup
      const backupStr = localStorage.getItem('alejo_threshold_config_backup');
      if (backupStr) {
        try {
          const backup = JSON.parse(backupStr);
          const timestamp = new Date(backup.timestamp);
          const now = new Date();
          const hoursSinceBackup = (now - timestamp) / (1000 * 60 * 60);
          
          // Only attempt recovery if the backup is less than 24 hours old
          if (hoursSinceBackup < 24) {
            // Log the recovery attempt
            logger.info('Detected failed configuration from previous session', { 
              backupTime: backup.timestamp 
            });
            
            // Show recovery notification to user
            showRecoveryNotification(backup.timestamp);
          } else {
            // Backup is too old, don't try to recover automatically
            logger.info('Found old backup configuration but not attempting recovery', { 
              backupTime: backup.timestamp,
              hoursSinceBackup
            });
          }
        } catch (e) {
          logger.error('Error parsing backup configuration', e);
        }
      }
    }
  } catch (error) {
    // Non-critical function, just log and continue
    logger.warn('Error checking for failed configurations', error);
  }
}

/**
 * Show a notification that recovery is available
 * @param {string} timestamp - ISO timestamp of the backup
 */
function showRecoveryNotification(timestamp) {
  // Create notification element
  const notifDiv = document.createElement('div');
  notifDiv.className = 'threshold-recovery-notification';
  notifDiv.setAttribute('role', 'status');
  notifDiv.setAttribute('aria-live', 'polite');
  
  // Format timestamp for display
  const backupDate = new Date(timestamp);
  const timeStr = backupDate.toLocaleTimeString();
  const dateStr = backupDate.toLocaleDateString();
  
  // Create notification content
  notifDiv.innerHTML = `
    <div class="recovery-header">
      <span class="recovery-icon">🔄</span>
      <span class="recovery-title">Unsaved threshold changes detected</span>
      <button class="recovery-close" aria-label="Dismiss recovery notification">×</button>
    </div>
    <div class="recovery-message">We found unsaved resource threshold changes from ${timeStr} on ${dateStr}.</div>
    <div class="recovery-actions">
      <button class="recovery-restore">Restore Changes</button>
      <button class="recovery-dismiss">Ignore</button>
    </div>
  `;
  
  // Add to UI - try to find the threshold modal content or dashboard container
  const container = document.querySelector('.threshold-modal-content') || 
                   document.querySelector('.resource-dashboard') || 
                   document.body;
  container.appendChild(notifDiv);
  
  // Add event listeners
  notifDiv.querySelector('.recovery-close').addEventListener('click', () => notifDiv.remove());
  notifDiv.querySelector('.recovery-dismiss').addEventListener('click', () => notifDiv.remove());
  notifDiv.querySelector('.recovery-restore').addEventListener('click', () => {
    notifDiv.remove();
    recoverFromBackup();
  });
  
  // Announce to screen reader after a short delay
  setTimeout(() => {
    announceToScreenReader('Previous unsaved threshold changes were detected. You can restore them from the notification.');
  }, 1000);
  
  // Auto-remove after 2 minutes if not addressed
  setTimeout(() => {
    if (document.body.contains(notifDiv)) {
      notifDiv.remove();
    }
  }, 120000);
}

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
    state.eventBus.on('resource-allocation:mode-change', handleResourceModeChange);
    state.eventBus.on('accessibility:preference-change', handleAccessibilityPreferenceChange);
    
    // Get current resource mode
    state.currentResourceMode = getCurrentResourceMode();
    
    // Request initial configuration data
    requestConfigData();
    
    // Log initialization
    logger.info('Resource threshold section initialized');
    auditTrail.log('resource_thresholds_initialized', {
      initialMode: state.currentResourceMode
    });
    
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
  modalWrapper.setAttribute('aria-describedby', 'threshold-config-description');
  
  // Add hidden description for screen readers
  const srDescription = document.createElement('div');
  srDescription.id = 'threshold-config-description';
  srDescription.className = 'sr-only';
  srDescription.textContent = 'Configure resource thresholds for CPU, memory, temperature, disk, and battery. Use tab to navigate between controls.';
  modalWrapper.appendChild(srDescription);
  
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
  
  // Register listener for apply event
  state.thresholdUI.addEventListener('apply', applyPendingChanges);
  
  // Log the opening of the configuration UI
  auditTrail.log('resource_threshold_ui_opened', {
    currentMode: state.currentResourceMode,
    source: 'user_action'
  });
  
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
  
  // Log the closing of the configuration UI
  auditTrail.log('resource_threshold_ui_closed', {
    pendingChangesCount: Object.keys(state.pendingChanges).length + Object.keys(state.pendingPreferences).length
  });
  
  // Apply any pending changes if needed
  applyPendingChanges();
}

/**
 * Apply any pending changes
 */
function applyPendingChanges() {
  // If there are pending changes, apply them
  if (Object.keys(state.pendingChanges).length > 0 || Object.keys(state.pendingPreferences).length > 0) {
    try {
      // Store backup before applying changes
      storeThresholdBackup();

      // Apply threshold changes
      if (Object.keys(state.pendingChanges).length > 0) {
        try {
          // Emit event to apply changes
          state.eventBus.emit('resource-thresholds:apply', {
            thresholds: state.pendingChanges
          });
          
          // Log threshold changes to audit trail
          auditTrail.log('resource_thresholds_updated', {
            changes: JSON.stringify(state.pendingChanges),
            currentMode: state.currentResourceMode,
            source: 'user_config'
          });
          
          state.pendingChanges = {};
        } catch (thresholdError) {
          handleThresholdApplyError(thresholdError, 'thresholds');
          return; // Exit function on error
        }
      }
      
      // Apply preference changes
      if (Object.keys(state.pendingPreferences).length > 0) {
        try {
          // Emit event to apply preference changes
          state.eventBus.emit('resource-thresholds:apply-preferences', {
            preferences: state.pendingPreferences
          });
          
          // Log preference changes to audit trail
          auditTrail.log('resource_preferences_updated', {
            changes: JSON.stringify(state.pendingPreferences),
            source: 'user_config'
          });
          
          state.pendingPreferences = {};
        } catch (preferenceError) {
          handleThresholdApplyError(preferenceError, 'preferences');
          return; // Exit function on error
        }
      }
      
      // Announce the changes to screen readers
      announceToScreenReader('Resource threshold changes applied successfully');
      
      logger.debug('Applied pending resource threshold changes');
      
      // Update the dashboard to reflect changes
      updateThresholdUI();
    } catch (error) {
      // Handle any unexpected errors
      handleThresholdApplyError(error, 'general');
    }
  }
}

/**
 * Store a backup of current threshold settings in localStorage
 */
function storeThresholdBackup() {
  try {
    // Create backup object
    const backup = {
      thresholds: { ...state.thresholds },
      preferences: { ...state.preferences },
      pendingChanges: { ...state.pendingChanges },
      pendingPreferences: { ...state.pendingPreferences },
      timestamp: new Date().toISOString(),
      currentResourceMode: state.currentResourceMode
    };
    
    // Store in localStorage
    localStorage.setItem('alejo_threshold_config_backup', JSON.stringify(backup));
    logger.debug('Stored threshold configuration backup');
  } catch (error) {
    // Log error but don't interrupt flow - this is just a backup
    logger.warn('Failed to create threshold backup', error);
  }
}

/**
 * Handle errors when applying threshold changes
 * @param {Error} error - The error object
 * @param {string} type - The type of error ('thresholds', 'preferences', or 'general')
 */
function handleThresholdApplyError(error, type) {
  // Log the error
  logger.error(`Error applying ${type} changes:`, error);
  
  // Log to audit trail
  auditTrail.log('resource_thresholds_apply_error', {
    error: error.message,
    type: type,
    timestamp: new Date().toISOString()
  });
  
  // Set failure flag in localStorage for future session recovery
  try {
    localStorage.setItem('alejo_threshold_config_failed', 'true');
  } catch (storageError) {
    logger.warn('Could not set threshold config failure flag', storageError);
  }
  
  // Show error to user
  showThresholdApplyError(error, type);
  
  // Announce to screen reader
  announceToScreenReader(`Error applying resource ${type} changes. Please try again or contact support.`);
}

/**
 * Display error message when threshold apply fails
 * @param {Error} error - The error object
 * @param {string} type - The type of error
 */
function showThresholdApplyError(error, type) {
  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'threshold-apply-error';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.setAttribute('aria-live', 'assertive');
  
  // Set error message
  let message = '';
  switch (type) {
    case 'thresholds':
      message = 'Failed to apply threshold changes';
      break;
    case 'preferences':
      message = 'Failed to apply preference changes';
      break;
    default:
      message = 'An error occurred while saving your settings';
  }
  
  // Create error content
  errorDiv.innerHTML = `
    <div class="error-header">
      <span class="error-icon">⚠️</span>
      <span class="error-title">${message}</span>
      <button class="error-close" aria-label="Close error message">×</button>
    </div>
    <div class="error-message">${error.message}</div>
    <div class="error-actions">
      <button class="error-retry">Try Again</button>
      <button class="error-recover">Recover Last Working Settings</button>
    </div>
  `;
  
  // Add to UI
  const container = state.thresholdUI.querySelector('.threshold-modal-content') || state.thresholdUI;
  container.appendChild(errorDiv);
  
  // Add event listeners
  errorDiv.querySelector('.error-close').addEventListener('click', () => errorDiv.remove());
  errorDiv.querySelector('.error-retry').addEventListener('click', () => {
    errorDiv.remove();
    applyPendingChanges();
  });
  errorDiv.querySelector('.error-recover').addEventListener('click', () => {
    errorDiv.remove();
    recoverFromBackup();
  });
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (document.body.contains(errorDiv)) {
      errorDiv.remove();
    }
  }, 30000);
}

/**
 * Recover thresholds from backup
 */
function recoverFromBackup() {
  try {
    // Get backup from localStorage
    const backupStr = localStorage.getItem('alejo_threshold_config_backup');
    if (!backupStr) {
      logger.warn('No threshold backup found for recovery');
      announceToScreenReader('No backup settings were found. Using default values.');
      return;
    }
    
    // Parse backup
    const backup = JSON.parse(backupStr);
    
    // Validate backup data
    if (!backup.thresholds || !backup.timestamp) {
      logger.warn('Invalid threshold backup format');
      announceToScreenReader('Backup settings were invalid. Using default values.');
      return;
    }
    
    // Apply recovered thresholds
    state.thresholds = { ...backup.thresholds };
    state.preferences = { ...backup.preferences };
    
    // Log recovery to audit trail
    auditTrail.log('resource_thresholds_recovery', {
      timestamp: new Date().toISOString(),
      backupTimestamp: backup.timestamp
    });
    
    // Emit event for recovered thresholds
    state.eventBus.emit('resource-thresholds:bulk-update', {
      thresholds: state.thresholds,
      recovered: true
    });
    
    // Update UI
    updateThresholdUI();
    
    // Announce recovery
    announceToScreenReader('Successfully recovered previous threshold settings');
    
    logger.info('Recovered threshold settings from backup', { backupTime: backup.timestamp });
  } catch (error) {
    logger.error('Failed to recover from threshold backup', error);
    announceToScreenReader('Error recovering previous settings. Using current values.');
  }
}

/**
 * Update the threshold UI with current state
 */
function updateThresholdUI() {
  // Update quick view elements if they exist
  const quickViewSection = document.querySelector('.thresholds-quick-view');
  if (quickViewSection) {
    const cpuWarning = quickViewSection.querySelector('.cpu-warning');
    const memoryWarning = quickViewSection.querySelector('.memory-warning');
    const temperatureWarning = quickViewSection.querySelector('.temperature-warning');
    
    if (cpuWarning) {
      cpuWarning.textContent = `${state.thresholds.cpu?.warning || DEFAULT_THRESHOLDS.cpu.warning}%`;
    }
    
    if (memoryWarning) {
      memoryWarning.textContent = `${state.thresholds.memory?.warning || DEFAULT_THRESHOLDS.memory.warning}%`;
    }
    
    if (temperatureWarning) {
      temperatureWarning.textContent = `${state.thresholds.temperature?.warning || DEFAULT_THRESHOLDS.temperature.warning}°C`;
    }
  }
  
  // Update the current resource mode indicator if it exists
  const modeIndicator = document.querySelector('.resource-mode-indicator');
  if (modeIndicator) {
    modeIndicator.textContent = state.currentResourceMode.toUpperCase();
    modeIndicator.className = `resource-mode-indicator mode-${state.currentResourceMode}`;
  }
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
/**
 * Handle resource mode change events
 * @param {Object} data - Resource mode change data
 */
function handleResourceModeChange(data) {
  state.currentResourceMode = data.newMode;
  
  logger.debug(`Resource mode changed to: ${data.newMode}`);
  
  // Update the UI to reflect the new mode
  updateThresholdUI();
  
  // If user notifications are enabled, announce the mode change
  if (state.preferences.userNotifications) {
    announceToScreenReader(`Resource mode changed to ${data.newMode}`);
  }
}

/**
 * Handle accessibility preference changes
 * @param {Object} data - Preference change data
 */
function handleAccessibilityPreferenceChange(data) {
  // Update UI if high contrast or large text preferences change
  if (data.preference === 'highContrast' || data.preference === 'largeText') {
    if (state.isVisible && state.thresholdUI) {
      // Apply appropriate class to the threshold UI
      if (data.preference === 'highContrast') {
        state.thresholdUI.classList.toggle('high-contrast', data.value);
      } else if (data.preference === 'largeText') {
        state.thresholdUI.classList.toggle('large-text', data.value);
      }
    }
  }
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
  const announcer = document.getElementById('resource-dashboard-announcer');
  
  if (announcer) {
    announcer.textContent = message;
  } else {
    // Create an announcer if one doesn't exist
    const newAnnouncer = document.createElement('div');
    newAnnouncer.id = 'resource-dashboard-announcer';
    newAnnouncer.setAttribute('aria-live', 'polite');
    newAnnouncer.className = 'sr-only';
    newAnnouncer.style.position = 'absolute';
    newAnnouncer.style.height = '1px';
    newAnnouncer.style.width = '1px';
    newAnnouncer.style.overflow = 'hidden';
    newAnnouncer.style.clip = 'rect(1px, 1px, 1px, 1px)';
    document.body.appendChild(newAnnouncer);
    
    // Slight delay to ensure screen readers pick it up
    setTimeout(() => {
      newAnnouncer.textContent = message;
    }, 100);
  }
}

export function addResourceThresholdSection(container) {
  const section = document.createElement('section');
  section.className = 'dashboard-section resource-thresholds-section';
  section.innerHTML = `
    <h2 class="section-title">Resource Management</h2>
    <div class="section-content">
      <div class="resource-thresholds-summary">
        <p>Configure how ALEJO manages system resources and adapts to different resource availability scenarios.</p>
        <div class="resource-mode-display">
          <span class="mode-label">Current Mode:</span>
          <span class="resource-mode-indicator mode-${state.currentResourceMode}">${state.currentResourceMode.toUpperCase()}</span>
        </div>
        <div class="thresholds-quick-view" tabindex="0" aria-label="Current resource thresholds">
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
          <div class="quick-view-item">
            <span class="item-label">Current Resource Mode:</span>
            <span class="item-value">${state.currentResourceMode}</span>
          </div>
        </div>
      </div>
      <div class="section-actions">
        <button class="open-thresholds-config" aria-label="Configure resource thresholds">Configure Resource Thresholds</button>
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
