/**
 * @file voice-dashboard-enhanced.js
 * @description Enhanced voice system monitoring dashboard with resource threshold integration
 * @module core/system/voice-dashboard-enhanced
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../../core/event-bus.js';
import { createThresholdConfigButton } from './resource-threshold-section.js';

// Initialize event bus
const eventBus = EventBus.getInstance();

/**
 * Update the voice system section of the dashboard with enhanced resource monitoring
 * @param {HTMLElement} dashboardElement - Main dashboard container element
 */
export function updateVoiceSectionEnhanced(dashboardElement) {
  const voiceSection = dashboardElement.querySelector('#alejo-dashboard-voice');
  if (!voiceSection) return;
  
  // Try to import the dashboard integration module to avoid circular dependencies
  import('../../personalization/voice/dashboard-integration.js').then(dashboardIntegration => {
    try {
      // Get voice dashboard data
      const voiceData = dashboardIntegration.getVoiceDashboardData();
      updateEnhancedVoiceDisplay(voiceSection, voiceData);
      
      // Set up event listener for dashboard updates if not already set
      if (!voiceSection.hasAttribute('data-event-listeners-attached')) {
        eventBus.on('dashboard:voice-update', (data) => {
          updateEnhancedVoiceDisplay(voiceSection, data);
        });
        
        eventBus.on('dashboard:voice-resource-threshold-exceeded', (data) => {
          showResourceAlert(voiceSection, data);
        });
        
        voiceSection.setAttribute('data-event-listeners-attached', 'true');
      }
    } catch (error) {
      console.error('Failed to get voice dashboard data:', error);
      updateVoiceDisplayFallback(voiceSection);
    }
  }).catch(error => {
    console.error('Failed to import voice dashboard integration:', error);
    updateVoiceDisplayFallback(voiceSection);
  });
}

/**
 * Update the enhanced voice display with resource monitoring
 * @param {HTMLElement} voiceSection - Voice section element
 * @param {Object} data - Voice dashboard data
 */
function updateEnhancedVoiceDisplay(voiceSection, data) {
  if (!data) {
    updateVoiceDisplayFallback(voiceSection);
    return;
  }
  
  const { status = {}, performance = {}, errors = [], resourceUsage = {}, thresholds = {} } = data;
  
  // Determine overall voice system status
  const systemStatus = status.system?.status || 'unknown';
  let overallStatusClass = getVoiceStatusClass(systemStatus);
  
  // Build statistics display
  const recognitionAccuracy = performance.recognitionAttempts > 0 
    ? (performance.recognitionSuccesses / performance.recognitionAttempts * 100).toFixed(1)
    : 'N/A';
    
  const synthesisCompletion = performance.synthesisRequests > 0
    ? (performance.synthesisCompletions / performance.synthesisRequests * 100).toFixed(1)
    : 'N/A';
  
  // Format resource usage values
  const cpuUsage = resourceUsage.cpu !== undefined ? resourceUsage.cpu.toFixed(1) : 'N/A';
  const memoryUsage = resourceUsage.memory !== undefined ? resourceUsage.memory.toFixed(1) : 'N/A';
  const temperatureStatus = resourceUsage.temperature !== undefined ? resourceUsage.temperature.toFixed(1) : 'N/A';
  
  // Get threshold status classes
  const cpuStatusClass = getResourceStatusClass('cpu', resourceUsage.cpu, thresholds.cpu);
  const memoryStatusClass = getResourceStatusClass('memory', resourceUsage.memory, thresholds.memory);
  const temperatureStatusClass = getResourceStatusClass('temperature', resourceUsage.temperature, thresholds.temperature);
  
  // Get resource mode class
  const resourceModeClass = getResourceModeClass(status.resourceMode);
  
  // Build HTML for voice section
  const html = `
    <div class="section-header" style="margin-bottom: 12px;">
      <h3 style="font-size: 14px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 8px;">
        <span style="cursor: pointer;" class="section-toggle" data-section="voice">
          <span class="toggle-icon">▼</span> Voice System
        </span>
      </h3>
      <div id="voice-content" style="display: block;">
        <div class="status-indicator ${overallStatusClass}" style="margin-bottom: 10px; padding: 8px; border-radius: 4px;">
          <div><strong>Status:</strong> ${systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}</div>
          <div><strong>Resource Mode:</strong> <span class="${resourceModeClass}">${status.resourceMode || 'Unknown'}</span></div>
        </div>
        
        <!-- Resource Usage Section -->
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Resource Usage</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            <div>
              <div style="display: flex; justify-content: space-between;">
                <strong>CPU:</strong> 
                <span class="${cpuStatusClass}">${cpuUsage}%</span>
              </div>
              ${createProgressBar(resourceUsage.cpu || 0, cpuStatusClass)}
              
              <div style="display: flex; justify-content: space-between; margin-top: 6px;">
                <strong>Memory:</strong> 
                <span class="${memoryStatusClass}">${memoryUsage}%</span>
              </div>
              ${createProgressBar(resourceUsage.memory || 0, memoryStatusClass)}
            </div>
            <div>
              <div style="display: flex; justify-content: space-between;">
                <strong>Temperature:</strong> 
                <span class="${temperatureStatusClass}">${temperatureStatus}°C</span>
              </div>
              ${createProgressBar(resourceUsage.temperature ? (resourceUsage.temperature / 100) * 100 : 0, temperatureStatusClass)}
              
              <div style="display: flex; justify-content: space-between; margin-top: 6px;">
                <strong>Thresholds:</strong>
                <a href="#" class="configure-thresholds" style="font-size: 11px; text-decoration: none;">Configure</a>
              </div>
              <div style="font-size: 10px; color: #666; margin-top: 2px;">
                CPU: W:${thresholds.cpu?.warning || 'N/A'} C:${thresholds.cpu?.critical || 'N/A'} | 
                Mem: W:${thresholds.memory?.warning || 'N/A'} C:${thresholds.memory?.critical || 'N/A'}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Components Section -->
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Components</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr style="background-color: #f5f5f5;">
              <th style="text-align: left; padding: 4px;">Component</th>
              <th style="text-align: center; padding: 4px;">Status</th>
              <th style="text-align: right; padding: 4px;">Last Updated</th>
            </tr>
            ${Object.keys(status).filter(key => key !== 'system' && key !== 'resourceMode').map(component => {
              const componentStatus = status[component] || {status: 'unknown'};
              const statusClass = getVoiceStatusClass(componentStatus.status);
              const lastUpdated = componentStatus.lastUpdated 
                ? new Date(componentStatus.lastUpdated).toLocaleTimeString() 
                : 'Unknown';
              return `
                <tr>
                  <td style="padding: 4px;">${component.charAt(0).toUpperCase() + component.slice(1)}</td>
                  <td style="text-align: center; padding: 4px;">
                    <span class="status-dot ${statusClass}" 
                          style="display: inline-block; width: 10px; height: 10px; border-radius: 50%;"></span>
                    ${componentStatus.status.charAt(0).toUpperCase() + componentStatus.status.slice(1)}
                  </td>
                  <td style="text-align: right; padding: 4px;">${lastUpdated}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
        
        <!-- Performance Section -->
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Performance Metrics</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            <div>
              <div><strong>Recognition Accuracy:</strong> ${recognitionAccuracy}%</div>
              <div><strong>Recognition Attempts:</strong> ${performance.recognitionAttempts || 0}</div>
              <div><strong>Recognition Errors:</strong> ${performance.recognitionErrors || 0}</div>
              <div><strong>Avg. Recognition Time:</strong> ${performance.averageRecognitionTime?.toFixed(2) || 0}ms</div>
            </div>
            <div>
              <div><strong>Synthesis Completion:</strong> ${synthesisCompletion}%</div>
              <div><strong>Synthesis Requests:</strong> ${performance.synthesisRequests || 0}</div>
              <div><strong>Training Sessions:</strong> ${performance.trainingSessionsCompleted || 0}/${performance.trainingSessionsStarted || 0}</div>
              <div><strong>Avg. Synthesis Time:</strong> ${performance.averageSynthesisTime?.toFixed(2) || 0}ms</div>
            </div>
          </div>
        </div>
        
        <!-- Recent Errors Section -->
        ${errors && errors.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Recent Errors</h4>
          <div style="max-height: 100px; overflow-y: auto; font-size: 11px; border: 1px solid #eee; padding: 4px;">
            ${errors.slice(0, 5).map(error => `
              <div style="margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #f5f5f5;">
                <div><strong>${new Date(error.timestamp).toLocaleTimeString()}</strong>: ${error.message}</div>
                <div style="color: #666;">${error.component || 'Unknown'} - ${error.code || 'No Code'}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Actions Section -->
        <div style="text-align: right;">
          <button id="reset-voice-stats" class="dashboard-button" 
                  style="padding: 4px 8px; font-size: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Reset Statistics
          </button>
          <button id="configure-voice-resources" class="dashboard-button" 
                  style="padding: 4px 8px; font-size: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Configure Resources
          </button>
          <button id="show-voice-details" class="dashboard-button" 
                  style="padding: 4px 8px; font-size: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Show Details
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Update section content
  voiceSection.innerHTML = html;
  
  // Add event listeners
  addVoiceEventListeners(voiceSection);
}

/**
 * Add event listeners to voice section elements
 * @param {HTMLElement} voiceSection - Voice section element
 */
function addVoiceEventListeners(voiceSection) {
  // Toggle section visibility
  const toggleBtn = voiceSection.querySelector('.section-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const content = document.getElementById('voice-content');
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    });
  }
  
  // Reset statistics button
  const resetStatsBtn = voiceSection.querySelector('#reset-voice-stats');
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      try {
        import('../../personalization/voice/index.js').then(voiceModule => {
          if (typeof voiceModule.resetStatistics === 'function') {
            voiceModule.resetStatistics();
            // Display feedback to user
            resetStatsBtn.textContent = 'Reset Complete';
            setTimeout(() => {
              resetStatsBtn.textContent = 'Reset Statistics';
            }, 1500);
          }
        });
      } catch (error) {
        console.error('Failed to reset voice statistics:', error);
      }
    });
  }
  
  // Configure resources button
  const configureResourcesBtn = voiceSection.querySelector('#configure-voice-resources');
  if (configureResourcesBtn) {
    configureResourcesBtn.addEventListener('click', () => {
      eventBus.emit('dashboard:open-resource-config');
    });
  }
  
  // Configure thresholds link
  const configureThresholdsLink = voiceSection.querySelector('.configure-thresholds');
  if (configureThresholdsLink) {
    configureThresholdsLink.addEventListener('click', (e) => {
      e.preventDefault();
      eventBus.emit('dashboard:open-resource-config');
    });
  }
  
  // Show details button
  const showDetailsBtn = voiceSection.querySelector('#show-voice-details');
  if (showDetailsBtn) {
    showDetailsBtn.addEventListener('click', () => {
      import('../../personalization/voice/dashboard-integration.js').then(dashboardIntegration => {
        const voiceData = dashboardIntegration.getVoiceDashboardData();
        showVoiceDetailsModal(voiceData.status);
      });
    });
  }
}

/**
 * Update voice display with fallback data when voice module is unavailable
 * @param {HTMLElement} voiceSection - Voice section element
 */
function updateVoiceDisplayFallback(voiceSection) {
  const html = `
    <div class="section-header" style="margin-bottom: 12px;">
      <h3 style="font-size: 14px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 8px;">
        <span style="cursor: pointer;" class="section-toggle" data-section="voice">
          <span class="toggle-icon">▼</span> Voice System
        </span>
      </h3>
      <div id="voice-content" style="display: block;">
        <div class="status-indicator status-inactive" style="margin-bottom: 10px; padding: 8px; border-radius: 4px;">
          <div><strong>Status:</strong> Unavailable</div>
          <div>Voice system module could not be loaded or is not initialized.</div>
        </div>
        
        <div style="margin-top: 10px; text-align: center;">
          <button id="retry-voice-load" class="dashboard-button" 
                  style="padding: 4px 8px; font-size: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Retry Loading
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Update section content
  voiceSection.innerHTML = html;
  
  // Add event listeners
  const toggleBtn = voiceSection.querySelector('.section-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const content = document.getElementById('voice-content');
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    });
  }
  
  const retryBtn = voiceSection.querySelector('#retry-voice-load');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      updateVoiceSectionEnhanced(voiceSection.closest('.alejo-dashboard'));
    });
  }
}

/**
 * Get CSS class for voice component status
 * @param {string} status - Component status
 * @returns {string} - CSS status class
 */
function getVoiceStatusClass(status) {
  switch (status) {
    case 'active':
      return 'status-normal';
    case 'initializing':
      return 'status-info';
    case 'paused':
      return 'status-warning';
    case 'error':
      return 'status-error';
    case 'inactive':
    default:
      return 'status-inactive';
  }
}

/**
 * Get CSS class for resource mode
 * @param {string} mode - Resource mode
 * @returns {string} - CSS class
 */
function getResourceModeClass(mode) {
  switch (mode) {
    case 'normal':
      return 'mode-normal';
    case 'conservative':
      return 'mode-warning';
    case 'critical':
      return 'mode-error';
    default:
      return 'mode-normal';
  }
}

/**
 * Get CSS class for resource status based on thresholds
 * @param {string} resource - Resource type
 * @param {number} value - Current value
 * @param {Object} thresholds - Thresholds for the resource
 * @returns {string} - CSS status class
 */
function getResourceStatusClass(resource, value, thresholds) {
  if (value === undefined || !thresholds) return 'status-inactive';
  
  const warning = thresholds.warning;
  const critical = thresholds.critical;
  
  if (critical !== undefined && value >= critical) {
    return 'status-error';
  } else if (warning !== undefined && value >= warning) {
    return 'status-warning';
  } else {
    return 'status-normal';
  }
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Percentage value (0-100)
 * @param {string} statusClass - CSS class for status color
 * @returns {string} - HTML for progress bar
 */
function createProgressBar(percentage, statusClass) {
  percentage = Math.min(100, Math.max(0, percentage)); // Clamp between 0-100
  
  return `
    <div style="width: 100%; height: 6px; background-color: #eee; border-radius: 3px; margin: 2px 0;">
      <div class="${statusClass}-bg" style="width: ${percentage}%; height: 100%; border-radius: 3px;"></div>
    </div>
  `;
}

/**
 * Show resource alert when threshold is exceeded
 * @param {HTMLElement} voiceSection - Voice section element
 * @param {Object} alertData - Alert data
 */
function showResourceAlert(voiceSection, alertData) {
  // Create alert element if it doesn't exist
  let alertContainer = voiceSection.querySelector('.resource-alerts');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.className = 'resource-alerts';
    alertContainer.style.marginBottom = '10px';
    alertContainer.style.padding = '8px';
    alertContainer.style.borderRadius = '4px';
    alertContainer.style.backgroundColor = '#fff3cd';
    alertContainer.style.border = '1px solid #ffeeba';
    alertContainer.style.color = '#856404';
    alertContainer.style.fontSize = '12px';
    
    // Insert after status indicator
    const statusIndicator = voiceSection.querySelector('.status-indicator');
    if (statusIndicator) {
      statusIndicator.parentNode.insertBefore(alertContainer, statusIndicator.nextSibling);
    } else {
      const content = voiceSection.querySelector('#voice-content');
      if (content) {
        content.prepend(alertContainer);
      }
    }
  }
  
  // Create alert message
  const alertMessage = document.createElement('div');
  alertMessage.style.display = 'flex';
  alertMessage.style.justifyContent = 'space-between';
  alertMessage.style.alignItems = 'center';
  alertMessage.style.marginBottom = '4px';
  alertMessage.style.paddingBottom = '4px';
  alertMessage.style.borderBottom = '1px solid #ffeeba';
  
  // Format timestamp
  const timestamp = new Date(alertData.timestamp).toLocaleTimeString();
  
  // Set alert content
  alertMessage.innerHTML = `
    <div>
      <strong>${alertData.level === 'critical' ? '⚠️ Critical' : '⚠️ Warning'}</strong>:
      ${alertData.resource.charAt(0).toUpperCase() + alertData.resource.slice(1)} usage at ${alertData.value}
      (threshold: ${alertData.threshold})
    </div>
    <div style="font-size: 10px; color: #6c757d;">${timestamp}</div>
  `;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.backgroundColor = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.marginLeft = '8px';
  closeBtn.setAttribute('aria-label', 'Close alert');
  
  closeBtn.addEventListener('click', () => {
    alertMessage.remove();
    
    // Remove container if empty
    if (alertContainer.children.length === 0) {
      alertContainer.remove();
    }
  });
  
  alertMessage.appendChild(closeBtn);
  
  // Add to container
  alertContainer.prepend(alertMessage);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (alertMessage && alertMessage.parentNode) {
      alertMessage.remove();
      
      // Remove container if empty
      if (alertContainer.children.length === 0 && alertContainer.parentNode) {
        alertContainer.remove();
      }
    }
  }, 10000);
}

/**
 * Show detailed voice system information in a modal
 * @param {Object} componentStatus - Component status information
 */
function showVoiceDetailsModal(componentStatus) {
  // Implementation similar to the existing showVoiceDetailsModal function
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'alejo-dashboard-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modal.style.zIndex = '10000';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'alejo-dashboard-modal-content';
  modalContent.style.backgroundColor = '#fff';
  modalContent.style.borderRadius = '8px';
  modalContent.style.padding = '20px';
  modalContent.style.width = '80%';
  modalContent.style.maxWidth = '800px';
  modalContent.style.maxHeight = '80%';
  modalContent.style.overflowY = 'auto';
  modalContent.style.position = 'relative';
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.backgroundColor = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';
  closeButton.setAttribute('aria-label', 'Close modal');
  
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modalContent.appendChild(closeButton);
  
  // Add modal title
  const modalTitle = document.createElement('h3');
  modalTitle.textContent = 'Voice System Details';
  modalTitle.style.marginTop = '0';
  modalTitle.style.borderBottom = '1px solid #eee';
  modalTitle.style.paddingBottom = '10px';
  
  modalContent.appendChild(modalTitle);
  
  // Add component status details
  const componentList = document.createElement('div');
  
  Object.keys(componentStatus || {}).forEach(component => {
    if (component === 'system' || component === 'resourceMode') return;
    
    const status = componentStatus[component] || {status: 'unknown'};
    const statusClass = getVoiceStatusClass(status.status);
    
    const componentItem = document.createElement('div');
    componentItem.style.marginBottom = '15px';
    componentItem.style.padding = '10px';
    componentItem.style.backgroundColor = '#f9f9f9';
    componentItem.style.borderRadius = '4px';
    
    let statusText = status.status.charAt(0).toUpperCase() + status.status.slice(1);
    const lastUpdated = status.lastUpdated 
      ? new Date(status.lastUpdated).toLocaleTimeString() 
      : 'Unknown';
    
    componentItem.innerHTML = `
      <h4 style="margin-top: 0; margin-bottom: 10px; display: flex; justify-content: space-between;">
        <span>${component.charAt(0).toUpperCase() + component.slice(1)}</span>
        <span class="${statusClass}" style="font-weight: normal; font-size: 14px;">${statusText}</span>
      </h4>
      <div style="font-size: 14px;">
        <div><strong>Last Updated:</strong> ${lastUpdated}</div>
        ${status.message ? `<div><strong>Message:</strong> ${status.message}</div>` : ''}
        ${status.details ? `<div><strong>Details:</strong> ${JSON.stringify(status.details)}</div>` : ''}
        ${status.version ? `<div><strong>Version:</strong> ${status.version}</div>` : ''}
      </div>
    `;
    
    componentList.appendChild(componentItem);
  });
  
  modalContent.appendChild(componentList);
  
  // Add to modal and display
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add keyboard event listener to close on Escape
  document.addEventListener('keydown', function escapeListener(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', escapeListener);
    }
  });
  
  // Add click event listener to close when clicking outside modal content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// Export the enhanced voice dashboard function to replace the original
export { updateVoiceSectionEnhanced as updateVoiceSection };
