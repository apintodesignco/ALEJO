/**
 * @file voice-dashboard.js
 * @description Voice system monitoring dashboard component for the ALEJO monitoring dashboard
 * @module core/system/voice-dashboard
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

/**
 * Update the voice system section of the dashboard
 * @param {HTMLElement} dashboardElement - Main dashboard container element
 */
export function updateVoiceSection(dashboardElement) {
  const voiceSection = dashboardElement.querySelector('#alejo-dashboard-voice');
  if (!voiceSection) return;
  
  // Try to import the voice module dynamically to avoid circular dependencies
  import('../../personalization/voice/index.js').then(voiceModule => {
    try {
      const voiceStatus = voiceModule.getVoiceStatus();
      updateVoiceDisplay(voiceSection, voiceStatus);
    } catch (error) {
      console.error('Failed to get voice status:', error);
      updateVoiceDisplayFallback(voiceSection);
    }
  }).catch(error => {
    console.error('Failed to import voice module:', error);
    updateVoiceDisplayFallback(voiceSection);
  });
}

/**
 * Update the voice system display with status information
 * @param {HTMLElement} voiceSection - Voice section element
 * @param {Object} voiceStatus - Voice system status information
 */
function updateVoiceDisplay(voiceSection, voiceStatus) {
  if (!voiceStatus) {
    updateVoiceDisplayFallback(voiceSection);
    return;
  }
  
  const { componentStatus, statistics, resourceMode } = voiceStatus;
  
  // Determine overall voice system status
  const systemStatus = componentStatus.system.status;
  let overallStatusClass = getVoiceStatusClass(systemStatus);
  
  // Count components by status
  const statusCounts = {
    active: 0,
    inactive: 0,
    error: 0,
    initializing: 0,
    paused: 0
  };
  
  Object.keys(componentStatus).forEach(component => {
    const status = componentStatus[component].status;
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  });
  
  // Build statistics display
  const recognitionAccuracy = statistics.recognitionAttempts > 0 
    ? (statistics.recognitionSuccesses / statistics.recognitionAttempts * 100).toFixed(1)
    : 'N/A';
    
  const synthesisCompletion = statistics.synthesisRequests > 0
    ? (statistics.synthesisCompletions / statistics.synthesisRequests * 100).toFixed(1)
    : 'N/A';
  
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
          <div><strong>Resource Mode:</strong> ${resourceMode || 'Unknown'}</div>
        </div>
        
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Components</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr style="background-color: #f5f5f5;">
              <th style="text-align: left; padding: 4px;">Component</th>
              <th style="text-align: center; padding: 4px;">Status</th>
              <th style="text-align: right; padding: 4px;">Last Updated</th>
            </tr>
            ${Object.keys(componentStatus).map(component => {
              const status = componentStatus[component];
              const statusClass = getVoiceStatusClass(status.status);
              const lastUpdated = new Date(status.lastUpdated).toLocaleTimeString();
              return `
                <tr>
                  <td style="padding: 4px;">${component.charAt(0).toUpperCase() + component.slice(1)}</td>
                  <td style="text-align: center; padding: 4px;">
                    <span class="status-dot ${statusClass}" 
                          style="display: inline-block; width: 10px; height: 10px; border-radius: 50%;"></span>
                    ${status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                  </td>
                  <td style="text-align: right; padding: 4px;">${lastUpdated}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
        
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 13px; margin: 5px 0;">Performance Metrics</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            <div>
              <div><strong>Recognition Accuracy:</strong> ${recognitionAccuracy}%</div>
              <div><strong>Recognition Attempts:</strong> ${statistics.recognitionAttempts}</div>
              <div><strong>Recognition Errors:</strong> ${statistics.recognitionErrors}</div>
              <div><strong>Avg. Recognition Time:</strong> ${statistics.averageRecognitionTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div><strong>Synthesis Completion:</strong> ${synthesisCompletion}%</div>
              <div><strong>Synthesis Requests:</strong> ${statistics.synthesisRequests}</div>
              <div><strong>Training Sessions:</strong> ${statistics.trainingSessionsCompleted}/${statistics.trainingSessionsStarted}</div>
              <div><strong>Avg. Synthesis Time:</strong> ${statistics.averageSynthesisTime.toFixed(2)}ms</div>
            </div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <button id="reset-voice-stats" class="dashboard-button" 
                  style="padding: 4px 8px; font-size: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Reset Statistics
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
  const toggleBtn = voiceSection.querySelector('.section-toggle');
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
  
  const resetStatsBtn = voiceSection.querySelector('#reset-voice-stats');
  resetStatsBtn.addEventListener('click', () => {
    try {
      import('../../personalization/voice/index.js').then(voiceModule => {
        voiceModule.resetStatistics();
        // Update the display after a brief delay to allow statistics to reset
        setTimeout(() => updateVoiceSection(dashboardElement), 100);
      });
    } catch (error) {
      console.error('Failed to reset voice statistics:', error);
    }
  });
  
  const showDetailsBtn = voiceSection.querySelector('#show-voice-details');
  showDetailsBtn.addEventListener('click', () => {
    showVoiceDetailsModal(componentStatus);
  });
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
  
  const retryBtn = voiceSection.querySelector('#retry-voice-load');
  retryBtn.addEventListener('click', () => {
    updateVoiceSection(voiceSection.closest('.alejo-dashboard'));
  });
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
 * Show detailed voice system information in a modal
 * @param {Object} componentStatus - Component status information
 */
function showVoiceDetailsModal(componentStatus) {
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
  modalContent.style.borderRadius = '5px';
  modalContent.style.padding = '20px';
  modalContent.style.width = '80%';
  modalContent.style.maxWidth = '800px';
  modalContent.style.maxHeight = '80vh';
  modalContent.style.overflow = 'auto';
  modalContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  
  // Build detailed component information
  let componentsHtml = '';
  Object.keys(componentStatus).forEach(component => {
    const status = componentStatus[component];
    const statusClass = getVoiceStatusClass(status.status);
    const lastUpdated = new Date(status.lastUpdated).toLocaleTimeString();
    
    // Build metrics display
    let metricsHtml = '';
    if (status.metrics && Object.keys(status.metrics).length > 0) {
      metricsHtml += '<h4>Metrics</h4><table style="width: 100%; border-collapse: collapse;">';
      Object.entries(status.metrics).forEach(([key, value]) => {
        metricsHtml += `
          <tr>
            <td style="padding: 4px; border-bottom: 1px solid #eee;">${key}</td>
            <td style="padding: 4px; border-bottom: 1px solid #eee;">${value}</td>
          </tr>
        `;
      });
      metricsHtml += '</table>';
    }
    
    // Build errors display
    let errorsHtml = '';
    if (status.errors && status.errors.length > 0) {
      errorsHtml += '<h4>Errors</h4><table style="width: 100%; border-collapse: collapse;">';
      status.errors.slice(-5).forEach(err => {
        const timestamp = new Date(err.timestamp).toLocaleString();
        errorsHtml += `
          <tr>
            <td style="padding: 4px; border-bottom: 1px solid #eee;">${timestamp}</td>
            <td style="padding: 4px; border-bottom: 1px solid #eee;">${err.error.message || JSON.stringify(err.error)}</td>
          </tr>
        `;
      });
      errorsHtml += '</table>';
    }
    
    componentsHtml += `
      <div style="margin-bottom: 20px;">
        <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">
          ${component.charAt(0).toUpperCase() + component.slice(1)}
          <span class="status-dot ${statusClass}" 
                style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 5px;"></span>
          <span style="font-size: 12px; font-weight: normal; float: right;">${status.status} (${lastUpdated})</span>
        </h3>
        ${metricsHtml}
        ${errorsHtml}
      </div>
    `;
  });
  
  // Build modal content HTML
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h2 style="margin: 0;">Voice System Details</h2>
      <button id="close-voice-modal" style="background: none; border: none; font-size: 18px; cursor: pointer;">✖</button>
    </div>
    <div style="max-height: calc(80vh - 60px); overflow-y: auto; padding-right: 10px;">
      ${componentsHtml}
    </div>
  `;
  
  // Add modal to document
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add close event listener
  const closeBtn = document.getElementById('close-voice-modal');
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Close when clicking outside the modal
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
}
