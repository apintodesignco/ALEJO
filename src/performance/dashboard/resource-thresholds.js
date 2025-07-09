/**
 * @file resource-thresholds.js
 * @description User-configurable resource thresholds for ALEJO's resource allocation system
 * @module performance/dashboard/resource-thresholds
 */

import { getResourceAllocationManager } from '../resource-allocation-manager.js';
import { subscribe, publish } from '../../core/neural-architecture/neural-event-bus.js';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  CPU: { HIGH: 80, MEDIUM: 50, LOW: 30 },
  MEMORY: { HIGH: 85, MEDIUM: 60, LOW: 40 },
  TEMPERATURE: { CRITICAL: 85, HIGH: 75, MEDIUM: 65, LOW: 55 }
};

/**
 * ResourceThresholds class - Manages user-configurable resource thresholds
 */
export class ResourceThresholds {
  /**
   * Constructor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    // Default configuration
    this.config = {
      containerId: 'alejo-resource-thresholds',
      saveToUserPreferences: true,
      ...config
    };
    
    // Initialize container
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      console.error(`Container with ID ${this.config.containerId} not found`);
      return;
    }
    
    // Get resource manager
    this.resourceManager = getResourceAllocationManager();
    
    // Get current thresholds
    this.thresholds = this.getCurrentThresholds();
    
    // Create UI
    this.createUI();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Get current thresholds from resource manager
   * @returns {Object} - Current thresholds
   */
  getCurrentThresholds() {
    try {
      // Try to get thresholds from user preferences
      const userPreferences = this.resourceManager.userPreferences || {};
      
      // Return thresholds with defaults for missing values
      return {
        CPU: {
          HIGH: userPreferences.cpuUsageCeilingPercent || DEFAULT_THRESHOLDS.CPU.HIGH,
          MEDIUM: userPreferences.cpuMediumThresholdPercent || DEFAULT_THRESHOLDS.CPU.MEDIUM,
          LOW: userPreferences.cpuLowThresholdPercent || DEFAULT_THRESHOLDS.CPU.LOW
        },
        MEMORY: {
          HIGH: userPreferences.memoryUsageCeilingPercent || DEFAULT_THRESHOLDS.MEMORY.HIGH,
          MEDIUM: userPreferences.memoryMediumThresholdPercent || DEFAULT_THRESHOLDS.MEMORY.MEDIUM,
          LOW: userPreferences.memoryLowThresholdPercent || DEFAULT_THRESHOLDS.MEMORY.LOW
        },
        TEMPERATURE: {
          CRITICAL: userPreferences.temperatureCeilingCelsius || DEFAULT_THRESHOLDS.TEMPERATURE.CRITICAL,
          HIGH: userPreferences.temperatureHighThresholdCelsius || DEFAULT_THRESHOLDS.TEMPERATURE.HIGH,
          MEDIUM: userPreferences.temperatureMediumThresholdCelsius || DEFAULT_THRESHOLDS.TEMPERATURE.MEDIUM,
          LOW: userPreferences.temperatureLowThresholdCelsius || DEFAULT_THRESHOLDS.TEMPERATURE.LOW
        }
      };
    } catch (error) {
      console.error('Failed to get current thresholds:', error);
      return DEFAULT_THRESHOLDS;
    }
  }
  
  /**
   * Create the UI for configuring thresholds
   */
  createUI() {
    // Clear container
    this.container.innerHTML = '';
    
    // Add thresholds class
    this.container.classList.add('alejo-resource-thresholds');
    
    // Create header
    const header = document.createElement('div');
    header.className = 'thresholds-header';
    header.innerHTML = `
      <h3>Resource Thresholds</h3>
      <p>Configure when ALEJO should adjust resource usage based on system conditions.</p>
    `;
    this.container.appendChild(header);
    
    // Create form
    const form = document.createElement('form');
    form.className = 'thresholds-form';
    form.id = 'resource-thresholds-form';
    
    // CPU thresholds
    const cpuSection = this.createThresholdSection(
      'CPU Usage',
      'cpu',
      this.thresholds.CPU,
      '%',
      0,
      100
    );
    form.appendChild(cpuSection);
    
    // Memory thresholds
    const memorySection = this.createThresholdSection(
      'Memory Usage',
      'memory',
      this.thresholds.MEMORY,
      '%',
      0,
      100
    );
    form.appendChild(memorySection);
    
    // Temperature thresholds
    const temperatureSection = this.createThresholdSection(
      'Temperature',
      'temperature',
      this.thresholds.TEMPERATURE,
      '°C',
      20,
      100
    );
    form.appendChild(temperatureSection);
    
    // Form controls
    const controls = document.createElement('div');
    controls.className = 'thresholds-controls';
    controls.innerHTML = `
      <button type="submit" class="thresholds-btn primary">Save Changes</button>
      <button type="button" class="thresholds-btn" id="reset-thresholds">Reset to Defaults</button>
    `;
    form.appendChild(controls);
    
    this.container.appendChild(form);
    
    // Add styles
    this.addStyles();
  }
  
  /**
   * Create a threshold section for a specific resource
   * @param {string} title - Section title
   * @param {string} id - Resource ID
   * @param {Object} values - Threshold values
   * @param {string} unit - Unit of measurement
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {HTMLElement} - Section element
   */
  createThresholdSection(title, id, values, unit, min, max) {
    const section = document.createElement('div');
    section.className = 'threshold-section';
    
    // Section header
    const sectionHeader = document.createElement('h4');
    sectionHeader.textContent = title;
    section.appendChild(sectionHeader);
    
    // Create sliders for each threshold level
    const levels = Object.keys(values).sort((a, b) => {
      // Sort levels from highest to lowest
      const order = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return order[b] - order[a];
    });
    
    const sliders = document.createElement('div');
    sliders.className = 'threshold-sliders';
    
    levels.forEach(level => {
      const value = values[level];
      const sliderId = `${id}-${level.toLowerCase()}-threshold`;
      
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'threshold-slider-container';
      
      const label = document.createElement('label');
      label.htmlFor = sliderId;
      label.innerHTML = `
        <span class="threshold-level ${level.toLowerCase()}">${level}</span>
        <span class="threshold-value" id="${sliderId}-value">${value}${unit}</span>
      `;
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = sliderId;
      slider.name = sliderId;
      slider.min = min;
      slider.max = max;
      slider.value = value;
      slider.className = 'threshold-slider';
      slider.dataset.level = level;
      slider.dataset.resource = id;
      
      sliderContainer.appendChild(label);
      sliderContainer.appendChild(slider);
      sliders.appendChild(sliderContainer);
    });
    
    section.appendChild(sliders);
    return section;
  }
  
  /**
   * Add styles for the thresholds UI
   */
  addStyles() {
    // Check if styles already exist
    if (document.getElementById('alejo-thresholds-styles')) {
      return;
    }
    
    const styleEl = document.createElement('style');
    styleEl.id = 'alejo-thresholds-styles';
    styleEl.textContent = `
      .alejo-resource-thresholds {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        color: #333;
        background-color: #f9f9f9;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      }
      
      .thresholds-header {
        margin-bottom: 20px;
      }
      
      .thresholds-header h3 {
        margin: 0 0 10px 0;
        color: #3498db;
      }
      
      .thresholds-header p {
        margin: 0;
        color: #666;
      }
      
      .thresholds-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .threshold-section {
        background-color: #fff;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      }
      
      .threshold-section h4 {
        margin: 0 0 15px 0;
        color: #2c3e50;
      }
      
      .threshold-sliders {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .threshold-slider-container {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .threshold-slider-container label {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .threshold-level {
        font-weight: 600;
      }
      
      .threshold-level.critical {
        color: #e74c3c;
      }
      
      .threshold-level.high {
        color: #e67e22;
      }
      
      .threshold-level.medium {
        color: #f39c12;
      }
      
      .threshold-level.low {
        color: #2ecc71;
      }
      
      .threshold-value {
        font-weight: normal;
        color: #7f8c8d;
      }
      
      .threshold-slider {
        width: 100%;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: #ecf0f1;
        border-radius: 3px;
        outline: none;
      }
      
      .threshold-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #3498db;
        cursor: pointer;
      }
      
      .threshold-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #3498db;
        cursor: pointer;
        border: none;
      }
      
      .thresholds-controls {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 10px;
      }
      
      .thresholds-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        background-color: #95a5a6;
        color: white;
      }
      
      .thresholds-btn.primary {
        background-color: #3498db;
      }
      
      .thresholds-btn:hover {
        opacity: 0.9;
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          transition-duration: 0.01ms !important;
        }
      }
      
      @media (prefers-color-scheme: dark) {
        .alejo-resource-thresholds {
          background-color: #1a1a1a;
          color: #f1f1f1;
        }
        
        .threshold-section {
          background-color: #2d2d2d;
        }
        
        .thresholds-header h3 {
          color: #3498db;
        }
        
        .thresholds-header p {
          color: #bdc3c7;
        }
        
        .threshold-section h4 {
          color: #ecf0f1;
        }
        
        .threshold-value {
          color: #bdc3c7;
        }
        
        .threshold-slider {
          background: #34495e;
        }
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Slider input events
    const sliders = this.container.querySelectorAll('.threshold-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', this.handleSliderInput.bind(this));
    });
    
    // Form submit
    const form = document.getElementById('resource-thresholds-form');
    if (form) {
      form.addEventListener('submit', this.handleFormSubmit.bind(this));
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset-thresholds');
    if (resetBtn) {
      resetBtn.addEventListener('click', this.handleReset.bind(this));
    }
  }
  
  /**
   * Handle slider input
   * @param {Event} event - Input event
   */
  handleSliderInput(event) {
    const slider = event.target;
    const resource = slider.dataset.resource;
    const level = slider.dataset.level;
    const value = slider.value;
    const unit = resource === 'temperature' ? '°C' : '%';
    
    // Update value display
    const valueDisplay = document.getElementById(`${slider.id}-value`);
    if (valueDisplay) {
      valueDisplay.textContent = `${value}${unit}`;
    }
    
    // Update thresholds object
    if (!this.thresholds[resource.toUpperCase()]) {
      this.thresholds[resource.toUpperCase()] = {};
    }
    this.thresholds[resource.toUpperCase()][level] = parseInt(value, 10);
    
    // Enforce threshold ordering (e.g., HIGH > MEDIUM > LOW)
    this.enforceThresholdOrdering(resource.toUpperCase());
  }
  
  /**
   * Enforce threshold ordering (e.g., HIGH > MEDIUM > LOW)
   * @param {string} resource - Resource type
   */
  enforceThresholdOrdering(resource) {
    const thresholds = this.thresholds[resource];
    const levels = Object.keys(thresholds).sort((a, b) => {
      const order = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return order[b] - order[a];
    });
    
    // Enforce ordering
    for (let i = 0; i < levels.length - 1; i++) {
      const currentLevel = levels[i];
      const nextLevel = levels[i + 1];
      
      if (thresholds[currentLevel] < thresholds[nextLevel]) {
        thresholds[nextLevel] = thresholds[currentLevel];
        
        // Update slider and display
        const sliderId = `${resource.toLowerCase()}-${nextLevel.toLowerCase()}-threshold`;
        const slider = document.getElementById(sliderId);
        if (slider) {
          slider.value = thresholds[nextLevel];
          
          const valueDisplay = document.getElementById(`${sliderId}-value`);
          if (valueDisplay) {
            const unit = resource === 'TEMPERATURE' ? '°C' : '%';
            valueDisplay.textContent = `${thresholds[nextLevel]}${unit}`;
          }
        }
      }
    }
  }
  
  /**
   * Handle form submission
   * @param {Event} event - Submit event
   */
  handleFormSubmit(event) {
    event.preventDefault();
    
    // Save thresholds to user preferences
    this.saveThresholds();
  }
  
  /**
   * Handle reset button click
   */
  handleReset() {
    // Reset thresholds to defaults
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    
    // Update UI
    this.updateUI();
    
    // Save defaults if configured
    if (this.config.saveToUserPreferences) {
      this.saveThresholds();
    }
  }
  
  /**
   * Update UI with current threshold values
   */
  updateUI() {
    Object.entries(this.thresholds).forEach(([resource, levels]) => {
      Object.entries(levels).forEach(([level, value]) => {
        const sliderId = `${resource.toLowerCase()}-${level.toLowerCase()}-threshold`;
        const slider = document.getElementById(sliderId);
        if (slider) {
          slider.value = value;
          
          const valueDisplay = document.getElementById(`${sliderId}-value`);
          if (valueDisplay) {
            const unit = resource === 'TEMPERATURE' ? '°C' : '%';
            valueDisplay.textContent = `${value}${unit}`;
          }
        }
      });
    });
  }
  
  /**
   * Save thresholds to user preferences
   */
  async saveThresholds() {
    if (!this.config.saveToUserPreferences) {
      return;
    }
    
    try {
      // Convert thresholds to user preferences format
      const preferences = {
        cpuUsageCeilingPercent: this.thresholds.CPU.HIGH,
        cpuMediumThresholdPercent: this.thresholds.CPU.MEDIUM,
        cpuLowThresholdPercent: this.thresholds.CPU.LOW,
        memoryUsageCeilingPercent: this.thresholds.MEMORY.HIGH,
        memoryMediumThresholdPercent: this.thresholds.MEMORY.MEDIUM,
        memoryLowThresholdPercent: this.thresholds.MEMORY.LOW,
        temperatureCeilingCelsius: this.thresholds.TEMPERATURE.CRITICAL,
        temperatureHighThresholdCelsius: this.thresholds.TEMPERATURE.HIGH,
        temperatureMediumThresholdCelsius: this.thresholds.TEMPERATURE.MEDIUM,
        temperatureLowThresholdCelsius: this.thresholds.TEMPERATURE.LOW
      };
      
      // Update user preferences
      await this.resourceManager.updateUserPreferences(preferences);
      
      // Publish event
      publish('resource-thresholds:updated', {
        thresholds: this.thresholds,
        timestamp: Date.now()
      });
      
      console.log('Resource thresholds saved successfully');
    } catch (error) {
      console.error('Failed to save resource thresholds:', error);
    }
  }
  
  /**
   * Destroy the thresholds UI
   */
  destroy() {
    // Remove event listeners
    const form = document.getElementById('resource-thresholds-form');
    if (form) {
      form.removeEventListener('submit', this.handleFormSubmit);
    }
    
    const resetBtn = document.getElementById('reset-thresholds');
    if (resetBtn) {
      resetBtn.removeEventListener('click', this.handleReset);
    }
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default ResourceThresholds;
