/**
 * ALEJO Recovery Status UI
 * 
 * This module provides a UI component to display failed components
 * and allow users to trigger recovery attempts.
 * 
 * Features:
 * - Lists all failed components with details
 * - Provides recovery attempt buttons for each component
 * - Shows recovery status and results
 * - Includes accessibility announcements for recovery states
 * - Adapts UI complexity based on system resource mode
 * - Resource-aware recovery operations and rendering
 */

import { publishEvent } from '../neural-architecture/neural-event-bus.js';
import { 
  recoverAllFailedComponents,
  attemptComponentRecovery,
  RecoveryState,
  getFailedComponents,
  clearPersistentFailures,
  initializeRecoveryManager,
  shutdownRecoveryManager
} from './component-recovery-manager.js';
import { getRegisteredComponents } from './initialization-manager.js';
import {
  getCurrentResourceMode,
  isAutoRecoveryEnabled,
  getPriorityThreshold,
  getCurrentConfig
} from './recovery-performance-integration.js';
import { ResourceConsumptionMode } from '../performance/resource-manager.js';

// State
const state = {
  visible: false,
  failedComponents: [],
  recoveryInProgress: false,
  recoveryResults: {},
  container: null,
  eventListeners: [],
  currentResourceMode: ResourceConsumptionMode.NORMAL,
  resourceConfig: null,
  updateInterval: null
};

/**
 * Initialize the recovery status UI
 * 
 * @param {Object} options - Initialization options
 * @param {HTMLElement} options.parentElement - Parent element to attach the UI to
 * @param {boolean} options.autoUpdate - Whether to automatically update the UI
 * @param {number} options.updateInterval - Interval in ms to update the UI
 * @returns {Object} - UI control functions
 */
export function initializeRecoveryStatusUI(options = {}) {
  const { 
    parentElement = document.body, 
    autoUpdate = true, 
    updateInterval = 5000 
  } = options;
  
  // Initialize the recovery manager
  initializeRecoveryManager({
    includeUI: true
  });
  
  // Get current resource mode configuration
  state.currentResourceMode = getCurrentResourceMode();
  state.resourceConfig = getCurrentConfig();
  
  // Create container element
  state.container = document.createElement('div');
  state.container.classList.add('alejo-recovery-status');
  state.container.setAttribute('role', 'region');
  state.container.setAttribute('aria-label', 'System Component Recovery');
  state.container.style.display = 'none';
  
  // Add resource mode class
  state.container.classList.add(`resource-mode-${state.currentResourceMode.toLowerCase()}`);
  
  // Add to DOM
  parentElement.appendChild(state.container);
  
  // Add event listeners
  const onComponentFailure = (event) => {
    updateFailedComponentsList();
    if (event.detail?.component?.isEssential || event.detail?.component?.accessibility) {
      show();
    }
  };
  
  const onRecoveryStateChange = (event) => {
    const { componentId, state: recoveryState, result } = event.detail;
    updateFailedComponentsList();
    render();
  };
  
  const handleRecoveryStateChange = (event) => {
    updateFailedComponentsList();
    render();
  };
  
  const handleResourceModeChanged = (event) => {
    if (event?.detail?.mode) {
      state.currentResourceMode = event.detail.mode;
      state.resourceConfig = event.detail.config || getCurrentConfig();
      
      // Update UI to reflect new resource mode
      state.container.className = 'alejo-recovery-status';
      state.container.classList.add(`resource-mode-${state.currentResourceMode.toLowerCase()}`);
      
      updateFailedComponentsList();
      render();
    }
  };
  
  // Listen for component failure and recovery events
  state.eventListeners.push(
    { event: 'system:component:failure', handler: handleComponentFailure },
    { event: 'system:component:recovered', handler: handleComponentRecovered },
    { event: 'system:recovery:state-change', handler: handleRecoveryStateChange },
    { event: 'recovery:resource-mode-changed', handler: handleResourceModeChanged },
    { event: 'recovery:config-updated', handler: handleResourceModeChanged }
  );
  
  // Register event listeners
  state.eventListeners.forEach(({ event, handler }) => {
    document.addEventListener(event, handler);
  });
  
  // Set up automatic update if enabled
  if (autoUpdate) {
    const interval = state.resourceConfig?.recoveryInterval || updateInterval;
    state.updateInterval = setInterval(() => {
      if (state.visible && !state.recoveryInProgress) {
        updateFailedComponentsList();
        render();
      }
    }, interval);
  }
  
  // Initial render
  render();
  
  return {
    show,
    hide,
    toggle,
    updateFailedComponentsList,
    attemptRecoveryAll,
    shutdown
  };
}

/**
 * Show the recovery UI
 */
function show() {
  if (!state.visible) {
    state.visible = true;
    state.container.style.display = 'block';
    updateFailedComponentsList();
    announceToScreenReader('Component recovery panel opened');
  }
}

/**
 * Hide the recovery UI
 */
function hide() {
  if (state.visible) {
    state.visible = false;
    state.container.style.display = 'none';
    announceToScreenReader('Component recovery panel closed');
  }
}

/**
 * Toggle the visibility of the recovery UI
 */
function toggle() {
  if (state.visible) {
    hide();
  } else {
    show();
  }
}

/**
 * Update the list of failed components
 */
function updateFailedComponentsList() {
  state.failedComponents = getFailedComponents();
  render();
}

/**
 * Attempt recovery for all failed components
 * 
 * @returns {Promise<Object>} - Recovery results
 */
async function attemptRecoveryAll() {
  if (state.recoveryInProgress) return;
  
  try {
    state.recoveryInProgress = true;
    announceToScreenReader('Attempting recovery for all failed components');
    render();
    
    const results = await recoverAllFailedComponents();
    state.recoveryResults = results;
    
    const successCount = Object.values(results).filter(r => r.state === RecoveryState.SUCCESS).length;
    const failureCount = Object.values(results).filter(r => r.state === RecoveryState.FAILURE || r.state === RecoveryState.TERMINAL_FAILURE).length;
    
    announceToScreenReader(`Recovery complete. ${successCount} components recovered, ${failureCount} components failed.`);
    
    return results;
  } catch (error) {
    console.error('Error during bulk recovery attempt', error);
    announceToScreenReader('Error during recovery attempt');
  } finally {
    state.recoveryInProgress = false;
    updateFailedComponentsList();
    render();
  }
}

/**
 * Attempt recovery for a single component
 * 
 * @param {string} componentId - Component ID to recover
 * @returns {Promise<Object>} - Recovery result
 */
async function attemptRecovery(componentId) {
  try {
    announceToScreenReader(`Attempting recovery for component ${componentId}`);
    const result = await attemptComponentRecovery(componentId);
    return result;
  } catch (error) {
    console.error(`Error during recovery attempt for ${componentId}`, error);
    announceToScreenReader(`Error during recovery attempt for ${componentId}`);
    return { success: false, error };
  } finally {
    updateFailedComponentsList();
  }
}

/**
 * Render the recovery UI
 */
function render() {
  if (!state.container) return;
  
  const registeredComponents = getRegisteredComponents();
  const componentDetails = state.failedComponents.map(failedComponent => {
    const registeredComponent = registeredComponents.find(c => c.id === failedComponent.componentId) || {};
    return {
      ...failedComponent,
      isEssential: registeredComponent.isEssential,
      accessibility: registeredComponent.accessibility,
      name: registeredComponent.name || failedComponent.componentId,
      recoveryResult: state.recoveryResults[failedComponent.componentId]
    };
  });
  
  const html = `
    <div class="alejo-recovery-status-header">
      <h2>Component Recovery</h2>
      <div class="alejo-recovery-status-actions">
        <button class="alejo-btn alejo-btn-recover-all" ${state.recoveryInProgress ? 'disabled' : ''}>
          ${state.recoveryInProgress ? 'Recovery in progress...' : 'Recover All'}
        </button>
        <button class="alejo-btn alejo-btn-close">Close</button>
      </div>
    </div>
    
    <div class="alejo-recovery-status-content">
      ${state.failedComponents.length === 0 ? 
        '<div class="alejo-recovery-status-empty">No failed components</div>' :
        `<div class="alejo-recovery-status-list">
          ${componentDetails.map(component => `
            <div class="alejo-recovery-status-item" data-component-id="${component.componentId}">
              <div class="alejo-recovery-status-item-header">
                <h3>${component.name}</h3>
                ${component.isEssential ? '<span class="alejo-badge alejo-badge-essential">Essential</span>' : ''}
                ${component.accessibility ? '<span class="alejo-badge alejo-badge-accessibility">Accessibility</span>' : ''}
              </div>
              
              <div class="alejo-recovery-status-item-details">
                <div class="alejo-recovery-status-item-error">
                  <strong>Error:</strong> ${component.error?.message || 'Unknown error'}
                </div>
                
                <div class="alejo-recovery-status-item-timestamp">
                  <strong>Failed at:</strong> ${new Date(component.timestamp).toLocaleTimeString()}
                </div>
                
                ${component.recoveryResult ? `
                  <div class="alejo-recovery-status-item-recovery-result">
                    <strong>Last recovery attempt:</strong> 
                    <span class="alejo-recovery-status-${component.recoveryResult.state.toLowerCase()}">
                      ${component.recoveryResult.state}
                    </span>
                  </div>
                ` : ''}
              </div>
              
              <div class="alejo-recovery-status-item-actions">
                <button class="alejo-btn alejo-btn-recover" data-component-id="${component.componentId}">
                  Attempt Recovery
                </button>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
  
  state.container.innerHTML = html;
  
  // Add event listeners
  const recoverAllButton = state.container.querySelector('.alejo-btn-recover-all');
  if (recoverAllButton) {
    recoverAllButton.addEventListener('click', attemptRecoveryAll);
  }
  
  const closeButton = state.container.querySelector('.alejo-btn-close');
  if (closeButton) {
    closeButton.addEventListener('click', hide);
  }
  
  const recoverButtons = state.container.querySelectorAll('.alejo-btn-recover');
  recoverButtons.forEach(button => {
    const componentId = button.getAttribute('data-component-id');
    button.addEventListener('click', () => attemptRecovery(componentId));
  });
}

/**
 * Announce a message to screen readers
 * 
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
  publishEvent('accessibility:announce', { message });
}

/**
 * Shutdown and cleanup
 */
function shutdown() {
  if (state.container && state.container.parentNode) {
    state.container.parentNode.removeChild(state.container);
  }
  
  state.eventListeners.forEach(({ event, handler }) => {
    document.removeEventListener(event, handler);
  });
  
  state.eventListeners = [];
}
