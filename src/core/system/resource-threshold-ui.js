/**
 * @file resource-threshold-ui.js
 * @description UI component for configuring resource thresholds in the ALEJO monitoring dashboard
 * @module core/system/resource-threshold-ui
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { DEFAULT_THRESHOLDS, THRESHOLD_STEPS } from '../../performance/resource-threshold-config.js';
import { RESOURCE_MODES } from '../../performance/resource-allocation-manager.js';

/**
 * Create the resource threshold configuration UI
 * @param {Object} options - Configuration options
 * @param {Object} options.thresholds - Current threshold values
 * @param {Object} options.preferences - User preferences
 * @param {Function} options.onUpdateThreshold - Callback when threshold is updated
 * @param {Function} options.onUpdatePreference - Callback when preference is updated
 * @param {Function} options.onReset - Callback when reset is requested
 * @returns {HTMLElement} The threshold configuration UI element
 */
/**
 * Helper function to announce changes to screen readers
 * @param {string} message - Message to announce
 * @private
 */
function _announceToScreenReader(message) {
  const announcer = document.getElementById('threshold-ui-announcer');
  
  if (!announcer) {
    const newAnnouncer = document.createElement('div');
    newAnnouncer.id = 'threshold-ui-announcer';
    newAnnouncer.setAttribute('aria-live', 'polite');
    newAnnouncer.className = 'sr-only';
    newAnnouncer.style.position = 'absolute';
    newAnnouncer.style.height = '1px';
    newAnnouncer.style.width = '1px';
    newAnnouncer.style.overflow = 'hidden';
    newAnnouncer.style.clip = 'rect(1px, 1px, 1px, 1px)';
    document.body.appendChild(newAnnouncer);
    setTimeout(() => { newAnnouncer.textContent = message; }, 100);
  } else {
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = message; }, 100);
  }
}

export function createResourceThresholdUI(options) {
  const {
    thresholds = DEFAULT_THRESHOLDS,
    preferences = {},
    onUpdateThreshold,
    onUpdatePreference,
    onReset
  } = options || {};
  
  // Create container
  const container = document.createElement('div');
  container.className = 'resource-threshold-config';
  container.setAttribute('aria-label', 'Resource Threshold Configuration');
  container.setAttribute('role', 'region');
  
  // Add styles
  container.innerHTML = `
    <style>
      .resource-threshold-config {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #333;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }
      
      .resource-threshold-config h2 {
        margin-top: 0;
        font-size: 18px;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .resource-threshold-config .tabs {
        display: flex;
        border-bottom: 1px solid #eee;
        margin-bottom: 20px;
      }
      
      .resource-threshold-config .tab {
        padding: 8px 16px;
        cursor: pointer;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
        margin-right: 2px;
        font-size: 14px;
      }
      
      .resource-threshold-config .tab.active {
        background-color: #f5f5f5;
        border-color: #ddd;
        border-bottom-color: #f5f5f5;
        margin-bottom: -1px;
      }
      
      .resource-threshold-config .tab-content {
        display: none;
        padding: 15px 0;
      }
      
      .resource-threshold-config .tab-content.active {
        display: block;
      }
      
      .resource-threshold-config .slider-container {
        margin-bottom: 20px;
      }
      
      .resource-threshold-config .slider-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 14px;
      }
      
      .resource-threshold-config .slider-value {
        font-weight: bold;
        min-width: 45px;
        text-align: right;
      }
      
      .resource-threshold-config .slider {
        width: 100%;
        margin: 10px 0;
      }
      
      .resource-threshold-config .slider-container input[type="range"] {
        width: 100%;
      }
      
      .resource-threshold-config .preference-item {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .resource-threshold-config .preference-label {
        flex: 1;
        font-size: 14px;
      }
      
      .resource-threshold-config .button-row {
        margin-top: 20px;
        display: flex;
        justify-content: space-between;
      }
      
      .resource-threshold-config button {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f5f5f5;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .resource-threshold-config button:hover {
        background-color: #e5e5e5;
      }
      
      .resource-threshold-config button.primary {
        background-color: #4a90e2;
        color: white;
        border-color: #3a80d2;
      }
      
      .resource-threshold-config button.primary:hover {
        background-color: #3a80d2;
      }
      
      .resource-threshold-config button.warning {
        background-color: #e74c3c;
        color: white;
        border-color: #d73c2c;
      }
      
      .resource-threshold-config button.warning:hover {
        background-color: #d73c2c;
      }
      
      .resource-threshold-config .info-text {
        font-size: 12px;
        color: #666;
        margin: 5px 0 15px;
      }
      
      .resource-threshold-config .toggle-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
      }
      
      .resource-threshold-config .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .resource-threshold-config .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 24px;
      }
      
      .resource-threshold-config .toggle-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      
      .resource-threshold-config input:checked + .toggle-slider {
        background-color: #4a90e2;
      }
      
      .resource-threshold-config input:focus + .toggle-slider {
        box-shadow: 0 0 1px #4a90e2;
      }
      
      .resource-threshold-config input:checked + .toggle-slider:before {
        transform: translateX(26px);
      }
    </style>
    
    <div class="resource-threshold-config-inner">
      <h2>
        Resource Threshold Configuration
        <button id="threshold-close" aria-label="Close configuration">✖</button>
      </h2>
      
      <div class="tabs" role="tablist" aria-orientation="horizontal">
        <div class="tab active" role="tab" aria-selected="true" tabindex="0" data-tab="cpu" aria-controls="cpu-tab" id="cpu-tab-button">CPU</div>
        <div class="tab" role="tab" aria-selected="false" tabindex="-1" data-tab="memory" aria-controls="memory-tab" id="memory-tab-button">Memory</div>
        <div class="tab" role="tab" aria-selected="false" tabindex="-1" data-tab="temperature" aria-controls="temperature-tab" id="temperature-tab-button">Temperature</div>
        <div class="tab" role="tab" aria-selected="false" tabindex="-1" data-tab="disk" aria-controls="disk-tab" id="disk-tab-button">Disk</div>
        <div class="tab" role="tab" aria-selected="false" tabindex="-1" data-tab="battery" aria-controls="battery-tab" id="battery-tab-button">Battery</div>
        <div class="tab" role="tab" aria-selected="false" tabindex="-1" data-tab="preferences" aria-controls="preferences-tab" id="preferences-tab-button">Preferences</div>
      </div>
      
      <div id="cpu-tab" class="tab-content active" role="tabpanel">
        <!-- CPU configuration will be inserted here -->
      </div>
      
      <div id="memory-tab" class="tab-content" role="tabpanel">
        <!-- Memory configuration will be inserted here -->
      </div>
      
      <div id="temperature-tab" class="tab-content" role="tabpanel">
        <!-- Temperature configuration will be inserted here -->
      </div>
      
      <div id="disk-tab" class="tab-content" role="tabpanel">
        <!-- Disk configuration will be inserted here -->
      </div>
      
      <div id="battery-tab" class="tab-content" role="tabpanel">
        <!-- Battery configuration will be inserted here -->
      </div>
      
      <div id="preferences-tab" class="tab-content" role="tabpanel">
        <!-- Preferences configuration will be inserted here -->
      </div>
      
      <div class="button-row">
        <button id="threshold-reset" class="warning">Reset to Defaults</button>
        <button id="threshold-apply" class="primary">Apply Changes</button>
      </div>
    </div>
  `;
  
  // Populate tabs with content
  _populateCpuTab(container, thresholds, onUpdateThreshold);
  _populateMemoryTab(container, thresholds, onUpdateThreshold);
  _populateTemperatureTab(container, thresholds, onUpdateThreshold);
  _populateDiskTab(container, thresholds, onUpdateThreshold);
  _populateBatteryTab(container, thresholds, onUpdateThreshold);
  _populatePreferencesTab(container, preferences, onUpdatePreference);
  
  // Set up tab switching
  const tabs = container.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      
      // Activate clicked tab
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      
      // Hide all tab content
      const tabContents = container.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      // Show selected tab content
      const tabId = tab.getAttribute('data-tab');
      const tabContent = container.querySelector(`#${tabId}-tab`);
      tabContent.classList.add('active');
    });
    
    // Enhanced keyboard navigation for tabs
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextTab = tab.nextElementSibling;
        if (nextTab && nextTab.classList.contains('tab')) {
          nextTab.click();
          nextTab.focus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevTab = tab.previousElementSibling;
        if (prevTab && prevTab.classList.contains('tab')) {
          prevTab.click();
          prevTab.focus();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        const firstTab = container.querySelector('.tab');
        firstTab.click();
        firstTab.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const tabs = container.querySelectorAll('.tab');
        const lastTab = tabs[tabs.length - 1];
        lastTab.click();
        lastTab.focus();
      }
    });
  });
  
  // Set up reset button
  const resetButton = container.querySelector('#threshold-reset');
  resetButton.addEventListener('click', () => {
    if (onReset) {
      onReset();
    }
    // Add screen reader announcement
    _announceToScreenReader('Thresholds reset to default values');
  });
  
  // Add apply button functionality
  const applyButton = container.querySelector('#threshold-apply');
  applyButton.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('apply'));
    // Add screen reader announcement
    _announceToScreenReader('Threshold changes applied');
  });
  
  // Set up close button
  const closeButton = container.querySelector('#threshold-close');
  closeButton.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('close'));
  });
  
  return container;
}

/**
 * Populate the CPU tab with threshold controls
 * @param {HTMLElement} container - The container element
 * @param {Object} thresholds - Current threshold values
 * @param {Function} onUpdateThreshold - Callback when threshold is updated
 * @private
 */
function _populateCpuTab(container, thresholds, onUpdateThreshold) {
  const cpuTab = container.querySelector('#cpu-tab');
  
  cpuTab.innerHTML = `
    <p class="info-text">Configure CPU usage thresholds to control when ALEJO reduces functionality to prevent overheating and system slowdowns.</p>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Warning Threshold</span>
        <span class="slider-value">${thresholds.cpu?.warning || DEFAULT_THRESHOLDS.cpu.warning}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="cpu-warning" 
        min="40" 
        max="95" 
        step="${THRESHOLD_STEPS.cpu}" 
        value="${thresholds.cpu?.warning || DEFAULT_THRESHOLDS.cpu.warning}" 
        aria-label="CPU warning threshold"
      >
      <p class="info-text">At this threshold, non-essential features will gradually reduce quality to preserve performance.</p>
    </div>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Critical Threshold</span>
        <span class="slider-value">${thresholds.cpu?.critical || DEFAULT_THRESHOLDS.cpu.critical}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="cpu-critical" 
        min="50" 
        max="100" 
        step="${THRESHOLD_STEPS.cpu}" 
        value="${thresholds.cpu?.critical || DEFAULT_THRESHOLDS.cpu.critical}" 
        aria-label="CPU critical threshold"
      >
      <p class="info-text">At this threshold, ALEJO will switch to minimal mode, disabling all non-essential features.</p>
    </div>
  `;
  
  // Set up event listeners for sliders
  const warningSlider = cpuTab.querySelector('#cpu-warning');
  const criticalSlider = cpuTab.querySelector('#cpu-critical');
  const warningValue = cpuTab.querySelector('.slider-container:first-child .slider-value');
  const criticalValue = cpuTab.querySelector('.slider-container:last-child .slider-value');
  
  warningSlider.addEventListener('input', () => {
    const warning = parseInt(warningSlider.value);
    warningValue.textContent = `${warning}%`;
    
    // Ensure critical is always higher than warning
    if (parseInt(criticalSlider.value) < warning + 5) {
      criticalSlider.value = warning + 5;
      criticalValue.textContent = `${warning + 5}%`;
      
      // Announce change for accessibility
      _announceToScreenReader(`Critical threshold automatically adjusted to ${warning + 5}%`);
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('cpu', 'warning', warning);
    }
  });
  
  criticalSlider.addEventListener('input', () => {
    const critical = parseInt(criticalSlider.value);
    criticalValue.textContent = `${critical}%`;
    
    // Ensure warning is always lower than critical
    if (parseInt(warningSlider.value) > critical - 5) {
      warningSlider.value = critical - 5;
      warningValue.textContent = `${critical - 5}%`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('cpu', 'critical', critical);
    }
  });
}

/**
 * Populate the Memory tab with threshold controls
 * @param {HTMLElement} container - The container element
 * @param {Object} thresholds - Current threshold values
 * @param {Function} onUpdateThreshold - Callback when threshold is updated
 * @private
 */
function _populateMemoryTab(container, thresholds, onUpdateThreshold) {
  const memoryTab = container.querySelector('#memory-tab');
  
  memoryTab.innerHTML = `
    <p class="info-text">Configure memory usage thresholds to control when ALEJO reduces functionality to prevent excessive memory consumption.</p>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Warning Threshold</span>
        <span class="slider-value">${thresholds.memory?.warning || DEFAULT_THRESHOLDS.memory.warning}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="memory-warning" 
        min="40" 
        max="95" 
        step="${THRESHOLD_STEPS.memory}" 
        value="${thresholds.memory?.warning || DEFAULT_THRESHOLDS.memory.warning}" 
        aria-label="Memory warning threshold"
      >
      <p class="info-text">At this threshold, ALEJO will attempt to free unused memory and reduce memory footprint.</p>
    </div>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Critical Threshold</span>
        <span class="slider-value">${thresholds.memory?.critical || DEFAULT_THRESHOLDS.memory.critical}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="memory-critical" 
        min="50" 
        max="100" 
        step="${THRESHOLD_STEPS.memory}" 
        value="${thresholds.memory?.critical || DEFAULT_THRESHOLDS.memory.critical}" 
        aria-label="Memory critical threshold"
      >
      <p class="info-text">At this threshold, ALEJO will disable memory-intensive features and unload non-essential modules.</p>
    </div>
  `;
  
  // Set up event listeners for sliders
  const warningSlider = memoryTab.querySelector('#memory-warning');
  const criticalSlider = memoryTab.querySelector('#memory-critical');
  const warningValue = memoryTab.querySelector('.slider-container:first-child .slider-value');
  const criticalValue = memoryTab.querySelector('.slider-container:last-child .slider-value');
  
  warningSlider.addEventListener('input', () => {
    const warning = parseInt(warningSlider.value);
    warningValue.textContent = `${warning}%`;
    
    // Ensure critical is always higher than warning
    if (parseInt(criticalSlider.value) < warning + 5) {
      criticalSlider.value = warning + 5;
      criticalValue.textContent = `${warning + 5}%`;
      
      // Announce change for accessibility
      _announceToScreenReader(`Critical threshold automatically adjusted to ${warning + 5}%`);
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('memory', 'warning', warning);
    }
  });
  
  criticalSlider.addEventListener('input', () => {
    const critical = parseInt(criticalSlider.value);
    criticalValue.textContent = `${critical}%`;
    
    // Ensure warning is always lower than critical
    if (parseInt(warningSlider.value) > critical - 5) {
      warningSlider.value = critical - 5;
      warningValue.textContent = `${critical - 5}%`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('memory', 'critical', critical);
    }
  });
}

/**
 * Populate the Temperature tab with threshold controls
 * @param {HTMLElement} container - The container element
 * @param {Object} thresholds - Current threshold values
 * @param {Function} onUpdateThreshold - Callback when threshold is updated
 * @private
 */
function _populateTemperatureTab(container, thresholds, onUpdateThreshold) {
  const temperatureTab = container.querySelector('#temperature-tab');
  
  temperatureTab.innerHTML = `
    <p class="info-text">Configure temperature thresholds to protect your device from overheating during intensive operations.</p>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Warning Threshold</span>
        <span class="slider-value">${thresholds.temperature?.warning || DEFAULT_THRESHOLDS.temperature.warning}°C</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="temperature-warning" 
        min="40" 
        max="85" 
        step="${THRESHOLD_STEPS.temperature}" 
        value="${thresholds.temperature?.warning || DEFAULT_THRESHOLDS.temperature.warning}" 
        aria-label="Temperature warning threshold"
      >
      <p class="info-text">At this temperature, ALEJO will throttle intensive operations to reduce heat generation.</p>
    </div>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Critical Threshold</span>
        <span class="slider-value">${thresholds.temperature?.critical || DEFAULT_THRESHOLDS.temperature.critical}°C</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="temperature-critical" 
        min="45" 
        max="95" 
        step="${THRESHOLD_STEPS.temperature}" 
        value="${thresholds.temperature?.critical || DEFAULT_THRESHOLDS.temperature.critical}" 
        aria-label="Temperature critical threshold"
      >
      <p class="info-text">At this temperature, ALEJO will switch to emergency cooling mode, disabling all non-essential features.</p>
    </div>
  `;
  
  // Set up event listeners for sliders
  const warningSlider = temperatureTab.querySelector('#temperature-warning');
  const criticalSlider = temperatureTab.querySelector('#temperature-critical');
  const warningValue = temperatureTab.querySelector('.slider-container:first-child .slider-value');
  const criticalValue = temperatureTab.querySelector('.slider-container:last-child .slider-value');
  
  warningSlider.addEventListener('input', () => {
    const warning = parseInt(warningSlider.value);
    warningValue.textContent = `${warning}°C`;
    
    // Ensure critical is always higher than warning
    if (parseInt(criticalSlider.value) < warning + 5) {
      criticalSlider.value = warning + 5;
      criticalValue.textContent = `${warning + 5}°C`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('temperature', 'warning', warning);
    }
  });
  
  criticalSlider.addEventListener('input', () => {
    const critical = parseInt(criticalSlider.value);
    criticalValue.textContent = `${critical}°C`;
    
    // Ensure warning is always lower than critical
    if (parseInt(warningSlider.value) > critical - 5) {
      warningSlider.value = critical - 5;
      warningValue.textContent = `${critical - 5}°C`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('temperature', 'critical', critical);
    }
  });
}

/**
 * Populate the Disk tab with threshold controls
 * @param {HTMLElement} container - The container element
 * @param {Object} thresholds - Current threshold values
 * @param {Function} onUpdateThreshold - Callback when threshold is updated
 * @private
 */
function _populateDiskTab(container, thresholds, onUpdateThreshold) {
  const diskTab = container.querySelector('#disk-tab');
  
  diskTab.innerHTML = `
    <p class="info-text">Configure disk usage thresholds to manage storage space for ALEJO's caches and data.</p>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Warning Threshold</span>
        <span class="slider-value">${thresholds.disk?.warning || DEFAULT_THRESHOLDS.disk.warning}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="disk-warning" 
        min="50" 
        max="95" 
        step="${THRESHOLD_STEPS.disk}" 
        value="${thresholds.disk?.warning || DEFAULT_THRESHOLDS.disk.warning}" 
        aria-label="Disk warning threshold"
      >
      <p class="info-text">At this threshold, ALEJO will clear temporary caches and suggest data cleanup.</p>
    </div>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Critical Threshold</span>
        <span class="slider-value">${thresholds.disk?.critical || DEFAULT_THRESHOLDS.disk.critical}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="disk-critical" 
        min="60" 
        max="100" 
        step="${THRESHOLD_STEPS.disk}" 
        value="${thresholds.disk?.critical || DEFAULT_THRESHOLDS.disk.critical}" 
        aria-label="Disk critical threshold"
      >
      <p class="info-text">At this threshold, ALEJO will remove all non-essential data and disable storage-heavy features.</p>
    </div>
  `;
  
  // Set up event listeners for sliders
  const warningSlider = diskTab.querySelector('#disk-warning');
  const criticalSlider = diskTab.querySelector('#disk-critical');
  const warningValue = diskTab.querySelector('.slider-container:first-child .slider-value');
  const criticalValue = diskTab.querySelector('.slider-container:last-child .slider-value');
  
  warningSlider.addEventListener('input', () => {
    const warning = parseInt(warningSlider.value);
    warningValue.textContent = `${warning}%`;
    
    // Ensure critical is always higher than warning
    if (parseInt(criticalSlider.value) < warning + 5) {
      criticalSlider.value = warning + 5;
      criticalValue.textContent = `${warning + 5}%`;
      
      // Announce change for accessibility
      _announceToScreenReader(`Critical threshold automatically adjusted to ${warning + 5}%`);
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('disk', 'warning', warning);
    }
  });
  
  criticalSlider.addEventListener('input', () => {
    const critical = parseInt(criticalSlider.value);
    criticalValue.textContent = `${critical}%`;
    
    // Ensure warning is always lower than critical
    if (parseInt(warningSlider.value) > critical - 5) {
      warningSlider.value = critical - 5;
      warningValue.textContent = `${critical - 5}%`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('disk', 'critical', critical);
    }
  });
}

/**
 * Populate the Battery tab with threshold controls
 * @param {HTMLElement} container - The container element
 * @param {Object} thresholds - Current threshold values
 * @param {Function} onUpdateThreshold - Callback when threshold is updated
 * @private
 */
function _populateBatteryTab(container, thresholds, onUpdateThreshold) {
  const batteryTab = container.querySelector('#battery-tab');
  
  batteryTab.innerHTML = `
    <p class="info-text">Configure battery thresholds to manage power consumption on portable devices.</p>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Low Battery Threshold</span>
        <span class="slider-value">${thresholds.battery?.low || DEFAULT_THRESHOLDS.battery.low}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="battery-low" 
        min="10" 
        max="30" 
        step="${THRESHOLD_STEPS.battery}" 
        value="${thresholds.battery?.low || DEFAULT_THRESHOLDS.battery.low}" 
        aria-label="Battery low threshold"
      >
      <p class="info-text">At this threshold, ALEJO will enter battery saving mode, reducing feature quality to extend battery life.</p>
    </div>
    
    <div class="slider-container">
      <div class="slider-label">
        <span>Critical Battery Threshold</span>
        <span class="slider-value">${thresholds.battery?.critical || DEFAULT_THRESHOLDS.battery.critical}%</span>
      </div>
      <input 
        type="range" 
        class="slider" 
        id="battery-critical" 
        min="5" 
        max="25" 
        step="${THRESHOLD_STEPS.battery}" 
        value="${thresholds.battery?.critical || DEFAULT_THRESHOLDS.battery.critical}" 
        aria-label="Battery critical threshold"
      >
      <p class="info-text">At this threshold, ALEJO will disable all non-essential features and suggest shutting down.</p>
    </div>
  `;
  
  // Set up event listeners for sliders
  const lowSlider = batteryTab.querySelector('#battery-low');
  const criticalSlider = batteryTab.querySelector('#battery-critical');
  const lowValue = batteryTab.querySelector('.slider-container:first-child .slider-value');
  const criticalValue = batteryTab.querySelector('.slider-container:last-child .slider-value');
  
  lowSlider.addEventListener('input', () => {
    const low = parseInt(lowSlider.value);
    lowValue.textContent = `${low}%`;
    
    // Ensure critical is always lower than low
    if (parseInt(criticalSlider.value) > low - 5) {
      criticalSlider.value = low - 5;
      criticalValue.textContent = `${low - 5}%`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('battery', 'low', low);
    }
  });
  
  criticalSlider.addEventListener('input', () => {
    const critical = parseInt(criticalSlider.value);
    criticalValue.textContent = `${critical}%`;
    
    // Ensure low is always higher than critical
    if (parseInt(lowSlider.value) < critical + 5) {
      lowSlider.value = critical + 5;
      lowValue.textContent = `${critical + 5}%`;
    }
    
    if (onUpdateThreshold) {
      onUpdateThreshold('battery', 'critical', critical);
    }
  });
}

/**
 * Populate the Preferences tab with user preference controls
 * @param {HTMLElement} container - The container element
 * @param {Object} preferences - Current user preferences
 * @param {Function} onUpdatePreference - Callback when preference is updated
 * @private
 */
function _populatePreferencesTab(container, preferences, onUpdatePreference) {
  const preferencesTab = container.querySelector('#preferences-tab');
  
  preferencesTab.innerHTML = `
    <p class="info-text">Configure general resource management preferences for ALEJO.</p>
    
    <div class="preference-item">
      <label class="preference-label" for="auto-resource-management">
        Enable automatic resource management
        <p class="info-text">Allows ALEJO to automatically adjust quality and features based on resource availability.</p>
      </label>
      <label class="toggle-switch">
        <input type="checkbox" id="auto-resource-management" ${preferences.enableAutomaticResourceManagement !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div class="preference-item">
      <label class="preference-label" for="prioritize-accessibility">
        Prioritize accessibility over performance
        <p class="info-text">When enabled, accessibility features will never be disabled even in low-resource situations.</p>
      </label>
      <label class="toggle-switch">
        <input type="checkbox" id="prioritize-accessibility" ${preferences.prioritizeAccessibilityOverPerformance !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div class="preference-item">
      <label class="preference-label" for="battery-preservation">
        Battery preservation mode
        <p class="info-text">When enabled, ALEJO will always optimize for battery life on portable devices.</p>
      </label>
      <label class="toggle-switch">
        <input type="checkbox" id="battery-preservation" ${preferences.batteryPreservationMode === true ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div class="preference-item">
      <label class="preference-label" for="threshold-notifications">
        Notify on threshold crossing
        <p class="info-text">When enabled, ALEJO will show notifications when resource usage crosses warning thresholds.</p>
      </label>
      <label class="toggle-switch">
        <input type="checkbox" id="threshold-notifications" ${preferences.notifyOnThresholdCrossing !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div class="preference-item">
      <label class="preference-label" for="apply-immediately">
        Apply changes immediately
        <p class="info-text">When enabled, threshold changes will be applied as you adjust sliders without needing to click Apply.</p>
      </label>
      <label class="toggle-switch">
        <input type="checkbox" id="apply-immediately" ${preferences.applyImmediately !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  
  // Set up event listeners for preference toggles
  const autoResourceToggle = preferencesTab.querySelector('#auto-resource-management');
  const prioritizeAccessibilityToggle = preferencesTab.querySelector('#prioritize-accessibility');
  const batteryPreservationToggle = preferencesTab.querySelector('#battery-preservation');
  const thresholdNotificationsToggle = preferencesTab.querySelector('#threshold-notifications');
  const applyImmediatelyToggle = preferencesTab.querySelector('#apply-immediately');
  
  autoResourceToggle.addEventListener('change', () => {
    if (onUpdatePreference) {
      onUpdatePreference('enableAutomaticResourceManagement', autoResourceToggle.checked);
    }
  });
  
  prioritizeAccessibilityToggle.addEventListener('change', () => {
    if (onUpdatePreference) {
      onUpdatePreference('prioritizeAccessibilityOverPerformance', prioritizeAccessibilityToggle.checked);
    }
  });
  
  batteryPreservationToggle.addEventListener('change', () => {
    if (onUpdatePreference) {
      onUpdatePreference('batteryPreservationMode', batteryPreservationToggle.checked);
    }
  });
  
  thresholdNotificationsToggle.addEventListener('change', () => {
    if (onUpdatePreference) {
      onUpdatePreference('notifyOnThresholdCrossing', thresholdNotificationsToggle.checked);
    }
  });
  
  applyImmediatelyToggle.addEventListener('change', () => {
    if (onUpdatePreference) {
      onUpdatePreference('applyImmediately', applyImmediatelyToggle.checked);
    }
  });
}
