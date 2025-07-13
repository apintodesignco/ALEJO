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

import { publishEvent, subscribeToEvent } from '../neural-architecture/neural-event-bus.js';
import '../../../styles/recovery-status-ui.css';
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
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  isAutoRecoveryEnabled,
  getPriorityThreshold,
  getMaxParallelRecoveries,
  getRecoveryInterval,
  RECOVERY_UI_ID,
  getCurrentConfig
} from './recovery-performance-integration.js';
import { ResourceConsumptionMode } from '../performance/resource-manager.js';

// UI state
let isVisible = false;
let isInitialized = false;
let containerElement = null;
let failedComponentsList = [];
let autoUpdateInterval = null;
let updateInterval = 5000; // Default update interval (5 seconds)
let lastResourceMode = ResourceConsumptionMode.NORMAL;
let resourceModeEventSubscription = null;
let registeredWithResourceManager = false;

/**
 * Initialize the recovery status UI
 *
 * @param {Object} options - Initialization options
 * @param {HTMLElement} options.parentElement - Parent element to attach the UI to
 * @param {boolean} options.autoUpdate - Whether to automatically update the UI
 * @param {number} options.updateInterval - Interval in ms to update the UI
 * @param {boolean} options.registerWithResources - Whether to register with the resource manager
 * @returns {Object} - UI control functions
 */
function initializeRecoveryStatusUI(options = {}) {
  const { 
    parentElement = document.body, 
    autoUpdate = true, 
    updateInterval = 5000,
    registerWithResources = true
  } = options;
  
  if (isInitialized) {
    return getPublicAPI();
  }
  
  // Initialize the recovery manager
  initializeRecoveryManager({
    includeUI: true
  });
  
  // Get current resource mode configuration
  lastResourceMode = getCurrentResourceMode();
  
  // Register with resource allocation manager if requested
  if (registerWithResources && !registeredWithResourceManager) {
    registerWithResourceManager({ includeUI: true });
    registeredWithResourceManager = true;
  }
  
  // Create container element
  containerElement = document.createElement('div');
  containerElement.classList.add('alejo-recovery-status');
  containerElement.setAttribute('role', 'region');
  containerElement.setAttribute('aria-label', 'System Component Recovery');
  containerElement.style.display = 'none';
  
  // Add resource mode class
  containerElement.classList.add(`resource-mode-${lastResourceMode.toLowerCase()}`);
  
  // Add to DOM
  parentElement.appendChild(containerElement);
  
  // Subscribe to resource mode changes
  resourceModeEventSubscription = subscribeToEvent('resourceModeChanged', handleResourceModeChange);
  
  /**
   * Handle resource mode changes
   * @param {Object} event - Event data
   */
  function handleResourceModeChange(event) {
    const newMode = event.detail.mode;
    if (newMode === lastResourceMode) return;
    
    // Update resource mode
    lastResourceMode = newMode;
    
    // Apply resource mode-specific adaptations
    updateResourceModeClass();
    setupUpdateInterval();
    
    // Re-render the UI with new resource constraints
    if (isVisible) {
      render();
    }
    
    // Announce mode change to screen reader if visible
    if (isVisible) {
      announceToScreenReader(`Recovery UI adapting to ${newMode} resource mode`);
    }
  }
  
  // Define event handlers
  const handleComponentFailure = (event) => {
    updateFailedComponentsList();
    // Auto-show UI for essential or accessibility components
    if (event.detail?.component?.isEssential || event.detail?.component?.accessibility) {
      show();
      
      // Announce to screen readers
      if (event.detail?.component?.accessibility) {
        announceToScreenReader(`Accessibility component ${event.detail.componentId} has failed. Recovery options available.`);
      } else if (event.detail?.component?.isEssential) {
        announceToScreenReader(`Essential component ${event.detail.componentId} has failed. Recovery options available.`);
      }
    }
    render();
  };
  
  const handleComponentRecovered = (event) => {
    updateFailedComponentsList();
    render();
    
    // Announce recovery to screen readers
    const { componentId, isEssential, accessibility } = event.detail || {};
    if (componentId) {
      if (accessibility) {
        announceToScreenReader(`Accessibility component ${componentId} has been successfully recovered.`);
      } else if (isEssential) {
        announceToScreenReader(`Essential component ${componentId} has been successfully recovered.`);
      } else {
        announceToScreenReader(`Component ${componentId} has been successfully recovered.`);
      }
    }
  };
  
  const handleRecoveryStateChange = (event) => {
    const { componentId, state: recoveryState, result } = event.detail || {};
    updateFailedComponentsList();
    
    // Store recovery results for display
    if (componentId && recoveryState) {
      state.recoveryResults[componentId] = { state: recoveryState, result };
    }
    
    // Announce important state changes
    if (componentId) {
      if (recoveryState === RecoveryState.SUCCESS) {
        announceToScreenReader(`Component ${componentId} recovered successfully.`);
      } else if (recoveryState === RecoveryState.TERMINAL_FAILURE) {
        announceToScreenReader(`Component ${componentId} could not be recovered after multiple attempts.`);
      }
    }
    
    render();
  };
  
  /**
   * Handle resource mode changes
   * @param {Object} event - The resource mode change event
   */
  const handleResourceModeChange = (event) => {
    if (!event || !event.mode) return;
    
    const previousMode = state.currentResourceMode;
    state.currentResourceMode = event.mode;
    state.resourceConfig = event.config || state.resourceConfig;
    
    console.log(`Recovery UI: Resource mode changed from ${previousMode} to ${state.currentResourceMode}`);
    
    // Update UI elements for new resource mode
    updateResourceModeClass();
    
    // Adjust refresh interval based on new resource mode
    setupUpdateInterval();
    
    // Re-filter components based on new priority thresholds
    updateFailedComponentsList();
    
    // Re-render UI to reflect new resource mode
    render();
    
    // Announce resource mode change to screen readers with specific messaging
    let announcement = `Resource mode changed to ${state.currentResourceMode}. `;
    
    if (state.currentResourceMode === ResourceConsumptionMode.MINIMAL) {
      announcement += 'Only accessibility components are shown and recovery options are limited.';
    } else if (state.currentResourceMode === ResourceConsumptionMode.CONSERVATIVE) {
      announcement += 'Only essential and accessibility components are shown.';
    } else if (state.currentResourceMode === ResourceConsumptionMode.PERFORMANCE) {
      announcement += 'All components are shown with detailed information.';
    }
    
    // Announce the change to screen reader if UI is visible
    if (state.visible) {
      announceToScreenReader(announcement);
    }
  };
  
  // Listen for component failure and recovery events
  state.eventListeners.push(
    { event: 'system:component:failure', handler: handleComponentFailure },
    { event: 'system:recovery:success', handler: handleComponentRecoverySuccess },
    { event: 'system:recovery:state-change', handler: handleRecoveryStateChange },
    { event: 'recovery:resource-mode-changed', handler: handleResourceModeChange },
    { event: 'recovery:config-updated', handler: handleResourceModeChange }
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
    initialize,
    show,
    hide,
    updateFailedComponentsList,
    attemptRecoveryAll,
    attemptRecovery,
    shutdown,
    // Resource manager integration
    registerWithResourceManager,
    unregisterFromResourceManager,
    handleResourceModeChange,
    getCurrentResourceMode: () => state.currentResourceMode,
    getPriorityThreshold
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
 * Attempt recovery for all failed components with resource-aware constraints
 * 
 * @returns {Promise<Object>} - Recovery results
 */
async function attemptRecoveryAll() {
  // Check if recovery is allowed in current resource mode
  if (state.recoveryInProgress || !isAutoRecoveryEnabled()) {
    if (!isAutoRecoveryEnabled()) {
      announceToScreenReader('Recovery operations are limited in the current resource mode');
      console.warn('Recovery operations limited due to resource constraints');
    }
    return;
  }
  
  try {
    state.recoveryInProgress = true;
    announceToScreenReader('Attempting recovery for all failed components');
    render();
    
    // Filter components by resource mode priority threshold
    const priorityThreshold = getPriorityThreshold();
    const registeredComponents = getRegisteredComponents();
    const failedComponents = state.failedComponents.filter(component => {
      const registeredComponent = registeredComponents.find(c => c.id === component.componentId);
      if (!registeredComponent) return false;
      
      const priority = getPriorityFromComponent(registeredComponent);
      return priority >= priorityThreshold;
    });
    
    // Log resource-aware recovery attempt
    console.log(`Attempting resource-aware recovery in ${state.currentResourceMode} mode for ${failedComponents.length} components`);
    
    // Extract component IDs for recovery
    const componentIds = failedComponents.map(c => c.componentId);
    
    // Attempt recovery with current resource mode
    const results = await recoverAllFailedComponents(componentIds, { resourceMode: state.currentResourceMode });
    state.recoveryResults = { ...state.recoveryResults, ...results };
    
    const successCount = Object.values(results).filter(r => r.state === RecoveryState.SUCCESS).length;
    const failureCount = Object.values(results).filter(r => r.state === RecoveryState.FAILURE || r.state === RecoveryState.TERMINAL_FAILURE).length;
    const skippedCount = state.failedComponents.length - (successCount + failureCount);
    
    // Include resource mode and skipped count in announcement
    const announcement = `Recovery complete in ${state.currentResourceMode} mode. `;
    if (successCount > 0) {
      announceToScreenReader(announcement + `${successCount} components recovered, ${failureCount} components failed${skippedCount > 0 ? `, ${skippedCount} components skipped due to resource constraints` : ''}.`);
    } else if (skippedCount > 0) {
      announceToScreenReader(`No components recovered. ${skippedCount} components skipped due to resource constraints.`);
    } else {
      announceToScreenReader(`Recovery complete. No components were recovered.`);
    }
    
    return results;
  } catch (error) {
    console.error('Error during resource-aware bulk recovery attempt', error);
    announceToScreenReader('Error during recovery attempt');
  } finally {
    state.recoveryInProgress = false;
    updateFailedComponentsList();
    render();
  }
}

/**
 * Attempt recovery for a single component with resource-awareness
 * 
 * @param {string} componentId - Component ID to recover
 * @returns {Promise<Object>} - Recovery result
 */
async function attemptRecovery(componentId) {
  // Check if recovery is allowed in current resource mode
  if (!isAutoRecoveryEnabled()) {
    announceToScreenReader('Component recovery is limited in the current resource mode');
    console.warn(`Recovery attempt for ${componentId} blocked due to resource constraints`);
    return { success: false, state: 'BLOCKED', result: 'Operation blocked due to resource constraints' };
  }
  
  // Get component priority and check against threshold
  const registeredComponents = getRegisteredComponents();
  const registeredComponent = registeredComponents.find(c => c.id === componentId);
  if (registeredComponent) {
    const priority = getPriorityFromComponent(registeredComponent);
    const priorityThreshold = getPriorityThreshold();
    
    if (priority < priorityThreshold) {
      const priorityName = priority === 1 ? 'low' : priority === 2 ? 'medium' : 'high';
      announceToScreenReader(`Cannot recover ${priorityName} priority component in current resource mode`);
      console.warn(`Recovery attempt for ${componentId} (priority ${priorityName}) blocked due to resource mode ${state.currentResourceMode}`);
      return { success: false, state: 'BLOCKED', result: 'Component priority too low for current resource mode' };
    }
  }
  
  try {
    announceToScreenReader(`Attempting recovery for component ${componentId}`);
    console.log(`Attempting recovery for component ${componentId} in ${state.currentResourceMode} mode`);
    
    // Pass resource mode to recovery function
    const result = await attemptComponentRecovery(componentId, { resourceMode: state.currentResourceMode });
    
    // Save result in recovery results
    state.recoveryResults[componentId] = result;
    
    return result;
  } catch (error) {
    console.error(`Error during recovery attempt for ${componentId}`, error);
    announceToScreenReader(`Error during recovery attempt for ${componentId}`);
    return { success: false, state: RecoveryState.FAILURE, error };
  } finally {
    updateFailedComponentsList();
  }
}

/**
 * Render the recovery UI with resource-aware adaptations
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
      priority: getPriorityFromComponent(registeredComponent),
      recoveryResult: state.recoveryResults[failedComponent.componentId]
    };
  });
  
  // Sort components by priority (highest first)
  componentDetails.sort((a, b) => b.priority - a.priority);
  
  // Filter components based on resource mode
  const filteredComponents = filterComponentsByResourceMode(componentDetails);
  
  // Build UI header with resource mode indicator
  const html = `
    <div class="alejo-recovery-status-header">
      <div class="alejo-recovery-status-title">
        <h2>Component Recovery</h2>
        <span class="alejo-resource-mode-indicator ${state.currentResourceMode.toLowerCase()}">
          ${state.currentResourceMode} Mode
        </span>
      </div>
      <div class="alejo-recovery-status-actions">
        ${isRecoverAllButtonVisible() ? `
          <button class="alejo-btn alejo-btn-recover-all" ${state.recoveryInProgress || !isAutoRecoveryEnabled() ? 'disabled' : ''}>
            ${state.recoveryInProgress ? 'Recovery in progress...' : 'Recover All'}
          </button>
        ` : ''}
        <button class="alejo-btn alejo-btn-close">Close</button>
      </div>
    </div>
    
    <div class="alejo-recovery-status-content">
      ${filteredComponents.length === 0 ? 
        getEmptyStateMessage() :
        `<div class="alejo-recovery-status-list">
          ${filteredComponents.map(component => `
            <div class="alejo-recovery-status-item ${getComponentClassByPriority(component)}" data-component-id="${component.componentId}">
              <div class="alejo-recovery-status-item-header">
                <h3>${component.name}</h3>
                ${renderComponentBadges(component)}
              </div>
              
              ${shouldRenderDetails(component) ? `
                <div class="alejo-recovery-status-item-details">
                  <div class="alejo-recovery-status-item-error">
                    <strong>Error:</strong> ${formatErrorMessage(component.error?.message || 'Unknown error')}
                  </div>
                  
                  ${shouldRenderTimestamp() ? `
                    <div class="alejo-recovery-status-item-timestamp">
                      <strong>Failed at:</strong> ${new Date(component.timestamp).toLocaleTimeString()}
                    </div>
                  ` : ''}
                  
                  ${component.recoveryResult ? `
                    <div class="alejo-recovery-status-item-recovery-result">
                      <strong>Last recovery:</strong> 
                      <span class="alejo-recovery-status-${component.recoveryResult.state.toLowerCase()}">
                        ${component.recoveryResult.state}
                      </span>
                      ${shouldRenderDetailedResult(component) && component.recoveryResult.result ? 
                        `<div class="alejo-recovery-result-detail">${component.recoveryResult.result}</div>` : 
                        ''}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
              
              <div class="alejo-recovery-status-item-actions">
                ${shouldRenderRecoverButton(component) ? `
                  <button class="alejo-btn alejo-btn-recover" 
                    data-component-id="${component.componentId}"
                    ${isAutoRecoveryEnabled() ? '' : 'disabled'}
                    title="${isAutoRecoveryEnabled() ? 'Attempt recovery' : 'Recovery disabled in current resource mode'}">
                    Attempt Recovery
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>`
      }
      ${renderResourceModeMessage()}
    </div>
  `;
  
  state.container.innerHTML = html;
  
  // Add event listeners if not in minimal mode
  if (state.currentResourceMode !== ResourceConsumptionMode.MINIMAL) {
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
  } else {
    // In minimal mode, only add close button listener
    const closeButton = state.container.querySelector('.alejo-btn-close');
    if (closeButton) {
      closeButton.addEventListener('click', hide);
    }
  }
}

/**
 * Get priority from component metadata
 * 
 * @param {Object} component - Component data
 * @returns {number} - Priority level (3=high, 2=medium, 1=low)
 */
function getPriorityFromComponent(component) {
  if (component.accessibility) return 3; // Highest priority for accessibility components
  if (component.isEssential) return 2; // Medium priority for essential components
  return 1; // Default low priority
}

/**
 * Get minimum priority threshold based on current resource mode
 * 
 * @returns {number} - Minimum priority level required
 */
function getPriorityThreshold() {
  switch (state.currentResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      return 3; // Only high priority (accessibility) in minimal mode
    case ResourceConsumptionMode.CONSERVATIVE:
      return 2; // Medium+ priority in conservative mode
    default:
      return 1; // All priorities in normal/performance mode
  }
}

/**
 * Check if automatic recovery operations are enabled in current resource mode
 * 
 * @returns {boolean} - True if auto recovery is enabled
 */
function isAutoRecoveryEnabled() {
  return state.currentResourceMode !== ResourceConsumptionMode.MINIMAL;
}

/**
 * Get registered components from recovery manager
 * 
 * @returns {Array} - Array of registered components
 */
function getRegisteredComponents() {
  try {
    return getRegisteredRecoveryComponents() || [];
  } catch (error) {
    console.error('Failed to get registered components', error);
    return [];
  }
}

/**
 * Register recovery status UI with resource allocation manager
 */
function registerWithResourceManager() {
  if (state.registeredWithResourceManager) return;
  
  try {
    // Register with resource manager as a non-essential UI component
    window.alejoResourceManager.registerComponent({
      id: 'recovery-status-ui',
      name: 'Recovery Status UI',
      category: 'system-ui',
      isEssential: false,
      accessibility: true, // Mark as accessibility-related
      resourceHandlers: {
        onResourceModeChanged: handleResourceModeChange
      }
    });
    
    state.registeredWithResourceManager = true;
    console.log('Recovery Status UI registered with Resource Allocation Manager');
    
    // Get initial resource mode
    const currentMode = window.alejoResourceManager.getCurrentMode();
    handleResourceModeChange({ mode: currentMode });
  } catch (error) {
    console.error('Failed to register with resource manager', error);
  }
}

/**
 * Unregister recovery status UI from resource allocation manager
 */
function unregisterFromResourceManager() {
  if (!state.registeredWithResourceManager) return;
  
  try {
    window.alejoResourceManager.unregisterComponent('recovery-status-ui');
    state.registeredWithResourceManager = false;
    console.log('Recovery Status UI unregistered from Resource Allocation Manager');
  } catch (error) {
    console.error('Failed to unregister from resource manager', error);
  }
}

/**
 * Setup update interval based on current resource mode
 */
function setupUpdateInterval() {
  // Clear any existing interval
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
  
  // Set different update intervals based on resource mode
  let intervalTime;
  switch (lastResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      intervalTime = 60000; // 1 minute in minimal mode
      break;
    case ResourceConsumptionMode.CONSERVATIVE:
      intervalTime = 30000; // 30 seconds in conservative mode
      break;
    case ResourceConsumptionMode.NORMAL:
      intervalTime = 30000; // 30 seconds in normal mode
      break;
    case ResourceConsumptionMode.PERFORMANCE:
      intervalTime = 15000; // 15 seconds in performance mode
      break;
    default:
      intervalTime = 30000; // Default fallback
  }
  
  // Create new interval with appropriate timing
  autoUpdateInterval = setInterval(() => {
    updateFailedComponentsList();
    if (isVisible) {
      render();
    }
  }, intervalTime);
  
  console.log(`Recovery UI update interval set to ${intervalTime}ms based on ${lastResourceMode} mode`);
}

/**
 * Update container CSS classes based on current resource mode
 */
function updateResourceModeClass() {
  if (!containerElement) return;
  
  // Remove all resource mode classes first
  containerElement.classList.remove(
    'resource-mode-minimal',
    'resource-mode-conservative', 
    'resource-mode-normal',
    'resource-mode-performance'
  );
  
  // Add appropriate class for current mode
  containerElement.classList.add(`resource-mode-${lastResourceMode.toLowerCase()}`);
  
  // Apply accessibility enhancements for minimal resource mode
  if (lastResourceMode === ResourceConsumptionMode.MINIMAL) {
    containerElement.classList.add('simplified-ui');
    containerElement.setAttribute('aria-live', 'polite');
  } else {
    containerElement.classList.remove('simplified-ui');
    containerElement.setAttribute('aria-live', 'off');
  }
}

/**
 * Attach event listeners based on current resource mode
 * @param {Array} eventListeners - Array of event listener configs to attach
 */
function attachEventListeners(eventListeners = []) {
  if (!eventListeners || !eventListeners.length) return;
  
  // Limit number of event listeners in minimal resource mode
  const listeners = lastResourceMode === ResourceConsumptionMode.MINIMAL
    ? eventListeners.filter(el => el.essential)
    : eventListeners;
    
  // Register listeners
  listeners.forEach(({ event, handler }) => {
    document.addEventListener(event, handler);
  });
  
  console.log(`Recovery UI: ${listeners.length} event listeners registered in ${lastResourceMode} mode`);
}

/**
 * Filter components based on current resource mode
 * 
 * @param {Array} components - Component list
 * @returns {Array} - Filtered component list
 */
function filterComponentsByResourceMode(components) {
  const threshold = getPriorityThreshold();
  
  switch (lastResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      // In minimal mode, only show accessibility and essential components
      // Always prioritize accessibility components regardless of resource mode
      return components.filter(c => 
        c.accessibility || 
        (c.isEssential && getPriorityFromComponent(c) >= threshold)
      );
      
    case ResourceConsumptionMode.CONSERVATIVE:
      // In conservative mode, show accessibility, essential, and higher priority components
      return components.filter(c => 
        c.accessibility || 
        c.isEssential || 
        getPriorityFromComponent(c) >= threshold
      );
      
    default:
      // In normal/performance mode, filter only by priority threshold
      return components.filter(c => 
        c.accessibility || 
        getPriorityFromComponent(c) >= threshold
      );
  }
}

/**
 * Get CSS class for component based on priority
 * 
 * @param {Object} component - Component data
 * @returns {string} - CSS class
 */
function getComponentClassByPriority(component) {
  if (component.accessibility) return 'priority-high accessibility';
  if (component.isEssential) return 'priority-medium essential';
  return 'priority-low';
}

/**
 * Determine if recover all button should be visible based on resource mode
 * 
 * @returns {boolean} - True if button should be visible
 */
function isRecoverAllButtonVisible() {
  // Hide recover all button in minimal mode to reduce complexity
  // and prevent excessive resource usage during recovery operations
  return lastResourceMode !== ResourceConsumptionMode.MINIMAL;
}

/**
 * Get empty state message based on resource mode
 * 
 * @returns {string} - HTML for empty state message
 */
function getEmptyStateMessage() {
  switch (state.currentResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      return '<div class="alejo-recovery-status-empty">No failed accessibility components</div>';
    case ResourceConsumptionMode.CONSERVATIVE:
      return '<div class="alejo-recovery-status-empty">No failed essential components</div>';
    default:
      return '<div class="alejo-recovery-status-empty">No failed components</div>';
  }
}

/**
 * Format error message based on resource mode
 * 
 * @param {string} errorMessage - Original error message
 * @returns {string} - Formatted error message
 */
function formatErrorMessage(errorMessage) {
  // In minimal mode, truncate error messages to save resources
  if (state.currentResourceMode === ResourceConsumptionMode.MINIMAL && errorMessage.length > 50) {
    return errorMessage.substring(0, 50) + '...';
  }
  return errorMessage;
}

/**
 * Determine if detailed component information should be rendered
 * 
 * @param {Object} component - Component data
 * @returns {boolean} - True if details should be rendered
 */
function shouldRenderDetails(component) {
  // Always show details for accessibility components regardless of resource mode
  if (component.accessibility) {
    return true;
  }
  
  switch (lastResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      // In minimal mode, only render details for essential components
      return component.isEssential;
      
    case ResourceConsumptionMode.CONSERVATIVE:
      // In conservative mode, show details for essential and high priority components
      return component.isEssential || getPriorityFromComponent(component) >= 3;
      
    default:
      // In normal/performance mode, show details for all components
      return true;
  }
}

/**
 * Determine if timestamps should be rendered based on resource mode
 * 
 * @returns {boolean} - True if timestamps should be rendered
 */
function shouldRenderTimestamp() {
  // Hide timestamps in minimal and conservative modes to simplify UI
  // and reduce rendering complexity/overhead
  return lastResourceMode !== ResourceConsumptionMode.MINIMAL && 
         lastResourceMode !== ResourceConsumptionMode.CONSERVATIVE;
}

/**
 * Determine if detailed recovery results should be shown
 * 
 * @param {Object} component - Component data
 * @returns {boolean} - True if detailed results should be shown
 */
function shouldRenderDetailedResult(component) {
  // Only show detailed results in NORMAL or PERFORMANCE mode
  return [
    ResourceConsumptionMode.NORMAL,
    ResourceConsumptionMode.PERFORMANCE
  ].includes(state.currentResourceMode);
}

/**
 * Determine if recovery button should be rendered
 * 
 * @param {Object} component - Component data
 * @returns {boolean} - True if recovery button should be rendered
 */
function shouldRenderRecoverButton(component) {
  // In minimal mode, only show buttons for accessibility components
  if (state.currentResourceMode === ResourceConsumptionMode.MINIMAL) {
    return component.accessibility;
  }
  
  // In conservative mode, show buttons for essential and accessibility components
  if (state.currentResourceMode === ResourceConsumptionMode.CONSERVATIVE) {
    return component.accessibility || component.isEssential;
  }
  
  // In normal/performance mode, show all buttons
  return true;
}

/**
 * Render appropriate badges for a component
 * 
 * @param {Object} component - Component data
 * @returns {string} - HTML for component badges
 */
function renderComponentBadges(component) {
  const badges = [];
  
  if (component.accessibility) {
    badges.push('<span class="alejo-badge alejo-badge-accessibility">Accessibility</span>');
  }
  
  if (component.isEssential) {
    badges.push('<span class="alejo-badge alejo-badge-essential">Essential</span>');
  }
  
  // Only show resource priority badge in NORMAL or PERFORMANCE mode
  if ([
    ResourceConsumptionMode.NORMAL,
    ResourceConsumptionMode.PERFORMANCE
  ].includes(state.currentResourceMode)) {
    const priorityLabel = component.accessibility ? 'High Priority' : 
                         component.isEssential ? 'Medium Priority' : 'Low Priority';
    badges.push(`<span class="alejo-badge alejo-badge-priority">${priorityLabel}</span>`);
  }
  
  return badges.join('');
}

/**
 * Render resource mode explanation message
 * 
 * @returns {string} - HTML for resource mode message
 */
function renderResourceModeMessage() {
  let message = '';
  
  switch (lastResourceMode) {
    case ResourceConsumptionMode.MINIMAL:
      message = 'System is in minimal resource mode. Only essential and accessibility-related recovery operations are enabled. The interface has been simplified to conserve resources.';
      break;
    case ResourceConsumptionMode.CONSERVATIVE:
      message = 'System is conserving resources. Recovery operations are limited to higher priority components, and some UI features are simplified.';
      break;
    case ResourceConsumptionMode.NORMAL:
      message = 'System is in normal resource mode with standard recovery capabilities.';
      break;
    case ResourceConsumptionMode.PERFORMANCE:
      message = 'System is in performance mode with enhanced recovery capabilities and detailed component information.';
      break;
  }
  
  if (!message) return '';
  
  return `<div class="resource-mode-message" role="status" aria-live="polite">${message}</div>`;
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
 * @returns {Promise<void>}
 */
async function shutdown() {
  // Clear any active update intervals
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
  
  // Unsubscribe from resource mode change events
  if (resourceModeEventSubscription) {
    resourceModeEventSubscription.unsubscribe();
    resourceModeEventSubscription = null;
  }
  
  // Unregister from resource manager if registered
  if (registeredWithResourceManager) {
    try {
      await unregisterFromResourceManager();
      registeredWithResourceManager = false;
    } catch (error) {
      console.error('Failed to unregister recovery UI during shutdown:', error);
    }
  }
  
  // Clean up container
  if (containerElement && containerElement.parentNode) {
    containerElement.parentNode.removeChild(containerElement);
    containerElement = null;
  }
  
  // Reset state
  isVisible = false;
  isInitialized = false;
  failedComponentsList = [];
  
  // Shutdown recovery manager
  try {
    await shutdownRecoveryManager();
  } catch (error) {
    console.error('Failed to shutdown recovery manager:', error);
  }
}

/**
 * Get the public API for the Recovery Status UI
 * @returns {Object} Public API
 */
function getPublicAPI() {
  return {
    show,
    hide,
    toggle,
    render,
    updateFailedComponentsList,
    attemptRecovery,
    attemptRecoveryAll,
    shutdown
  };
}

// Export the recovery status UI module
export { initializeRecoveryStatusUI };
