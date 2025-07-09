/**
 * @file performance-dashboard.js
 * @description Real-time performance monitoring dashboard for ALEJO
 * @module performance/dashboard/performance-dashboard
 */

import Visualization from '../visualization/index.js';
import { getResourceAllocationManager, RESOURCE_MODES } from '../resource-allocation-manager.js';

/**
 * @class PerformanceDashboard
 * @description A real-time performance monitoring dashboard for ALEJO
 */
export class PerformanceDashboard {
  /**
   * @constructor
   * @param {Object} config - Configuration object for the dashboard
   */
  constructor(config = {}) {
    // Default configuration
    this.config = {
      containerId: 'alejo-performance-dashboard',
      updateInterval: 2000,
      showCpuChart: true,
      showMemoryChart: true,
      showComponentsChart: true,
      showResourceModeGauge: true,
      maxHistoryPoints: 60, // 2 minutes of data at 2-second intervals
      accessibilityEnabled: true,
      ...config
    };
    
    // Initialize dashboard elements
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      console.error(`Container with ID ${this.config.containerId} not found`);
      return;
    }
    
    // Get resource manager
    this.resourceManager = getResourceAllocationManager();
    
    // Initialize data structures
    this.initializeData();
    
    // Create dashboard layout
    this.createDashboardLayout();
    
    // Initialize visualization system
    Visualization.initialize();
    
    // Create charts
    this.createCharts();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start data collection
    this.startMonitoring();
  }
  
  /**
   * Initialize data structures for the dashboard
   * @private
   */
  initializeData() {
    const currentTime = new Date();
    
    // CPU usage history
    this.cpuData = {
      labels: Array.from({ length: this.config.maxHistoryPoints }, 
        (_, i) => new Date(currentTime - (this.config.maxHistoryPoints - i) * this.config.updateInterval)),
      datasets: [
        {
          label: 'CPU Usage',
          data: Array.from({ length: this.config.maxHistoryPoints }, () => 0),
          color: '#3498db'
        }
      ]
    };
    
    // Memory usage history
    this.memoryData = {
      labels: Array.from({ length: this.config.maxHistoryPoints }, 
        (_, i) => new Date(currentTime - (this.config.maxHistoryPoints - i) * this.config.updateInterval)),
      datasets: [
        {
          label: 'Memory Usage',
          data: Array.from({ length: this.config.maxHistoryPoints }, () => 0),
          color: '#2ecc71'
        }
      ]
    };
    
    // Component resource usage
    this.componentData = [];
    
    // Current resource mode
    this.resourceModeValue = this.getResourceModeValue(this.resourceManager.getCurrentMode());
  }
  
  /**
   * Create the dashboard layout
   * @private
   */
  createDashboardLayout() {
    // Clear container
    this.container.innerHTML = '';
    
    // Add dashboard class
    this.container.classList.add('alejo-performance-dashboard');
    
    // Create header
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.innerHTML = `
      <h2>ALEJO Performance Monitor</h2>
      <div class="dashboard-controls">
        <button id="${this.config.containerId}-pause-btn" class="dashboard-btn">Pause</button>
        <button id="${this.config.containerId}-resume-btn" class="dashboard-btn" disabled>Resume</button>
      </div>
    `;
    this.container.appendChild(header);
    
    // Create grid layout
    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';
    this.container.appendChild(grid);
    
    // Create chart containers
    if (this.config.showCpuChart) {
      const cpuContainer = document.createElement('div');
      cpuContainer.className = 'dashboard-item';
      cpuContainer.id = `${this.config.containerId}-cpu-chart`;
      grid.appendChild(cpuContainer);
    }
    
    if (this.config.showMemoryChart) {
      const memoryContainer = document.createElement('div');
      memoryContainer.className = 'dashboard-item';
      memoryContainer.id = `${this.config.containerId}-memory-chart`;
      grid.appendChild(memoryContainer);
    }
    
    if (this.config.showResourceModeGauge) {
      const modeContainer = document.createElement('div');
      modeContainer.className = 'dashboard-item';
      modeContainer.id = `${this.config.containerId}-mode-gauge`;
      grid.appendChild(modeContainer);
    }
    
    if (this.config.showComponentsChart) {
      const componentsContainer = document.createElement('div');
      componentsContainer.className = 'dashboard-item full-width';
      componentsContainer.id = `${this.config.containerId}-components-chart`;
      grid.appendChild(componentsContainer);
    }
    
    // Add dashboard styles
    this.addDashboardStyles();
  }
  
  /**
   * Add dashboard styles to the document
   * @private
   */
  addDashboardStyles() {
    // Check if styles already exist
    if (document.getElementById('alejo-dashboard-styles')) {
      return;
    }
    
    const styleEl = document.createElement('style');
    styleEl.id = 'alejo-dashboard-styles';
    styleEl.textContent = `
      .alejo-performance-dashboard {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        color: #333;
        background-color: #f9f9f9;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      }
      
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 10px;
      }
      
      .dashboard-header h2 {
        margin: 0;
        color: #3498db;
      }
      
      .dashboard-controls {
        display: flex;
        gap: 10px;
      }
      
      .dashboard-btn {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .dashboard-btn:hover {
        background-color: #2980b9;
      }
      
      .dashboard-btn:disabled {
        background-color: #95a5a6;
        cursor: not-allowed;
      }
      
      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }
      
      .dashboard-item {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        padding: 15px;
        min-height: 250px;
      }
      
      .full-width {
        grid-column: 1 / -1;
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
      
      @media (max-width: 768px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * Create visualization charts
   * @private
   */
  createCharts() {
    // CPU usage line chart
    if (this.config.showCpuChart) {
      this.cpuChart = Visualization.createLineChart({
        containerId: `${this.config.containerId}-cpu-chart`,
        title: 'CPU Usage',
        xAxisLabel: 'Time',
        yAxisLabel: 'Usage (%)',
        height: 250,
        animation: true,
        yAxisMin: 0,
        yAxisMax: 100,
        tooltip: {
          enabled: true,
          formatter: (item) => `${new Date(item.label).toLocaleTimeString()}: ${item.value.toFixed(1)}%`
        },
        accessibility: {
          enabled: this.config.accessibilityEnabled,
          ariaLabel: 'CPU usage over time line chart',
          includeDataTable: true
        }
      });
      
      this.cpuChart.render(this.cpuData);
    }
    
    // Memory usage line chart
    if (this.config.showMemoryChart) {
      this.memoryChart = Visualization.createLineChart({
        containerId: `${this.config.containerId}-memory-chart`,
        title: 'Memory Usage',
        xAxisLabel: 'Time',
        yAxisLabel: 'Usage (%)',
        height: 250,
        animation: true,
        yAxisMin: 0,
        yAxisMax: 100,
        tooltip: {
          enabled: true,
          formatter: (item) => `${new Date(item.label).toLocaleTimeString()}: ${item.value.toFixed(1)}%`
        },
        accessibility: {
          enabled: this.config.accessibilityEnabled,
          ariaLabel: 'Memory usage over time line chart',
          includeDataTable: true
        }
      });
      
      this.memoryChart.render(this.memoryData);
    }
    
    // Resource mode gauge
    if (this.config.showResourceModeGauge) {
      this.modeGauge = Visualization.createGaugeChart({
        containerId: `${this.config.containerId}-mode-gauge`,
        title: 'Resource Mode',
        units: '',
        minValue: 0,
        maxValue: 3,
        value: this.resourceModeValue,
        thresholds: [
          { value: 1, color: '#2ecc71' }, // Full - Green
          { value: 2, color: '#f39c12' }, // Balanced - Orange
          { value: 3, color: '#e74c3c' }  // Conservative/Minimal - Red
        ],
        valueFormatter: (value) => this.getResourceModeName(value),
        accessibility: {
          enabled: this.config.accessibilityEnabled,
          ariaLabel: 'Resource mode gauge',
          includeDataTable: true
        }
      });
    }
    
    // Component resource usage bar chart
    if (this.config.showComponentsChart) {
      this.componentsChart = Visualization.createBarChart({
        containerId: `${this.config.containerId}-components-chart`,
        title: 'Component Resource Usage',
        xAxisLabel: 'Component',
        yAxisLabel: 'Usage (%)',
        height: 300,
        horizontal: true,
        showLegend: false,
        showValueLabels: true,
        animation: true,
        accessibility: {
          enabled: this.config.accessibilityEnabled,
          ariaLabel: 'Component resource usage bar chart',
          includeDataTable: true
        }
      });
      
      this.componentsChart.render(this.componentData);
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Pause button
    const pauseBtn = document.getElementById(`${this.config.containerId}-pause-btn`);
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.pauseMonitoring();
        pauseBtn.disabled = true;
        
        const resumeBtn = document.getElementById(`${this.config.containerId}-resume-btn`);
        if (resumeBtn) {
          resumeBtn.disabled = false;
        }
      });
    }
    
    // Resume button
    const resumeBtn = document.getElementById(`${this.config.containerId}-resume-btn`);
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.startMonitoring();
        resumeBtn.disabled = true;
        
        const pauseBtn = document.getElementById(`${this.config.containerId}-pause-btn`);
        if (pauseBtn) {
          pauseBtn.disabled = false;
        }
      });
    }
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  /**
   * Handle window resize
   * @private
   */
  handleResize() {
    if (this.cpuChart) this.cpuChart.updateDimensions();
    if (this.memoryChart) this.memoryChart.updateDimensions();
    if (this.modeGauge) this.modeGauge.updateDimensions();
    if (this.componentsChart) this.componentsChart.updateDimensions();
  }
  
  /**
   * Start monitoring and updating the dashboard
   * @public
   */
  startMonitoring() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }
    
    this.updateIntervalId = setInterval(() => {
      this.updateDashboard();
    }, this.config.updateInterval);
    
    // Update immediately
    this.updateDashboard();
  }
  
  /**
   * Pause monitoring
   * @public
   */
  pauseMonitoring() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }
  
  /**
   * Update dashboard with latest data
   * @private
   */
  async updateDashboard() {
    try {
      // Get current resource usage
      const resourceUsage = this.resourceManager.getResourceUsage();
      const currentMode = this.resourceManager.getCurrentMode();
      
      // Update CPU data
      if (this.cpuChart) {
        this.cpuData.labels.shift();
        this.cpuData.labels.push(new Date());
        
        this.cpuData.datasets[0].data.shift();
        this.cpuData.datasets[0].data.push(resourceUsage.cpu);
        
        this.cpuChart.render(this.cpuData);
      }
      
      // Update memory data
      if (this.memoryChart) {
        this.memoryData.labels.shift();
        this.memoryData.labels.push(new Date());
        
        this.memoryData.datasets[0].data.shift();
        this.memoryData.datasets[0].data.push(resourceUsage.memory);
        
        this.memoryChart.render(this.memoryData);
      }
      
      // Update resource mode gauge
      if (this.modeGauge) {
        const modeValue = this.getResourceModeValue(currentMode);
        this.modeGauge.update(modeValue);
      }
      
      // Update component data
      if (this.componentsChart) {
        // Get component registry from resource manager
        const componentRegistry = this.getComponentData();
        this.componentData = componentRegistry;
        
        this.componentsChart.render(this.componentData);
      }
    } catch (error) {
      console.error('Error updating performance dashboard:', error);
    }
  }
  
  /**
   * Get component data for visualization
   * @private
   * @returns {Array} - Component data for bar chart
   */
  getComponentData() {
    // This would normally come from the resource manager's component registry
    // For now, we'll simulate some component data
    return [
      { label: 'Voice System', value: Math.random() * 30 + 40 },
      { label: 'Vision System', value: Math.random() * 20 + 30 },
      { label: 'Memory System', value: Math.random() * 15 + 20 },
      { label: 'Reasoning Engine', value: Math.random() * 25 + 15 },
      { label: 'UI Components', value: Math.random() * 10 + 5 }
    ];
  }
  
  /**
   * Convert resource mode to numeric value for gauge
   * @private
   * @param {string} mode - Resource mode
   * @returns {number} - Numeric value for gauge
   */
  getResourceModeValue(mode) {
    switch (mode) {
      case RESOURCE_MODES.FULL:
        return 0.5;
      case RESOURCE_MODES.BALANCED:
        return 1.5;
      case RESOURCE_MODES.CONSERVATIVE:
        return 2.5;
      case RESOURCE_MODES.MINIMAL:
        return 3;
      default:
        return 0;
    }
  }
  
  /**
   * Get resource mode name from gauge value
   * @private
   * @param {number} value - Gauge value
   * @returns {string} - Resource mode name
   */
  getResourceModeName(value) {
    if (value <= 1) return 'Full';
    if (value <= 2) return 'Balanced';
    if (value <= 2.75) return 'Conservative';
    return 'Minimal';
  }
  
  /**
   * Clean up resources used by the dashboard
   * @public
   */
  destroy() {
    // Stop monitoring
    this.pauseMonitoring();
    
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    
    // Clean up charts
    if (this.cpuChart) this.cpuChart.destroy();
    if (this.memoryChart) this.memoryChart.destroy();
    if (this.modeGauge) this.modeGauge.destroy();
    if (this.componentsChart) this.componentsChart.destroy();
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default PerformanceDashboard;
