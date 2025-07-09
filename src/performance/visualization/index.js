/**
 * @file index.js
 * @description Main entry point for ALEJO's performance visualization system
 * @module performance/visualization
 */

import * as VisCore from './visualization-core.js';
import { LineChart } from './line-chart.js';
import { BarChart } from './bar-chart.js';
import { GaugeChart } from './gauge-chart.js';
import { EventBus } from '../../core/event-bus.js';

/**
 * @namespace Visualization
 * @description Provides a unified interface to ALEJO's performance visualization components
 */
const Visualization = {
  /**
   * Core visualization utilities
   */
  core: VisCore,
  
  /**
   * Chart component classes
   */
  components: {
    LineChart,
    BarChart,
    GaugeChart
  },
  
  /**
   * Create a line chart for time-series data visualization
   * @param {Object} config - Configuration object for the line chart
   * @returns {LineChart} - Configured line chart instance
   */
  createLineChart(config) {
    return new LineChart(config);
  },
  
  /**
   * Create a bar chart for comparative data visualization
   * @param {Object} config - Configuration object for the bar chart
   * @returns {BarChart} - Configured bar chart instance
   */
  createBarChart(config) {
    return new BarChart(config);
  },
  
  /**
   * Create a gauge chart for single metric visualization with thresholds
   * @param {Object} config - Configuration object for the gauge chart
   * @returns {GaugeChart} - Configured gauge chart instance
   */
  createGaugeChart(config) {
    return new GaugeChart(config);
  },
  
  /**
   * Create a performance visualization based on the specified type
   * @param {string} type - Type of visualization ('line', 'bar', 'gauge')
   * @param {Object} config - Configuration object for the visualization
   * @returns {Object} - Configured visualization instance
   */
  createVisualization(type, config) {
    switch (type.toLowerCase()) {
      case 'line':
      case 'linechart':
        return this.createLineChart(config);
      case 'bar':
      case 'barchart':
        return this.createBarChart(config);
      case 'gauge':
      case 'gaugechart':
        return this.createGaugeChart(config);
      default:
        console.error(`Unknown visualization type: ${type}`);
        return null;
    }
  },
  
  /**
   * Subscribe to performance data events and automatically update visualizations
   * @param {Object} visualization - Visualization instance to update
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} [dataTransformer] - Optional function to transform event data before updating
   * @returns {Function} - Unsubscribe function
   */
  connectToDataSource(visualization, eventName, dataTransformer) {
    if (!visualization || !eventName) {
      console.error('Both visualization and eventName are required');
      return () => {};
    }
    
    const handler = (data) => {
      const transformedData = dataTransformer ? dataTransformer(data) : data;
      visualization.update(transformedData);
    };
    
    EventBus.subscribe(eventName, handler);
    
    // Return unsubscribe function
    return () => EventBus.unsubscribe(eventName, handler);
  },
  
  /**
   * Create a dashboard with multiple visualizations
   * @param {Object} config - Dashboard configuration
   * @param {string} config.containerId - ID of the container element
   * @param {Array} config.visualizations - Array of visualization configurations
   * @returns {Object} - Dashboard object with methods to manage visualizations
   */
  createDashboard(config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error(`Container with ID ${config.containerId} not found`);
      return null;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Add dashboard class
    container.classList.add('alejo-performance-dashboard');
    
    // Create visualizations
    const visualizations = [];
    
    config.visualizations.forEach(vizConfig => {
      // Create container for this visualization
      const vizContainer = document.createElement('div');
      vizContainer.className = 'alejo-dashboard-item';
      vizContainer.id = `${config.containerId}-${vizConfig.type}-${visualizations.length}`;
      container.appendChild(vizContainer);
      
      // Update config to use this container
      const updatedConfig = {
        ...vizConfig.config,
        containerId: vizContainer.id
      };
      
      // Create visualization
      const viz = this.createVisualization(vizConfig.type, updatedConfig);
      
      if (viz) {
        visualizations.push({
          instance: viz,
          config: vizConfig
        });
        
        // Connect to data source if specified
        if (vizConfig.dataSource) {
          this.connectToDataSource(
            viz, 
            vizConfig.dataSource.eventName,
            vizConfig.dataSource.transformer
          );
        }
        
        // Render initial data if provided
        if (vizConfig.initialData) {
          viz.render(vizConfig.initialData);
        }
      }
    });
    
    // Create dashboard object
    return {
      visualizations,
      
      /**
       * Update a specific visualization with new data
       * @param {number} index - Index of the visualization to update
       * @param {Array} data - New data for the visualization
       */
      updateVisualization(index, data) {
        if (index >= 0 && index < visualizations.length) {
          visualizations[index].instance.update(data);
        }
      },
      
      /**
       * Update all visualizations with new data
       * @param {Array} dataArray - Array of data for each visualization
       */
      updateAll(dataArray) {
        if (Array.isArray(dataArray) && dataArray.length === visualizations.length) {
          dataArray.forEach((data, index) => {
            visualizations[index].instance.update(data);
          });
        }
      },
      
      /**
       * Resize all visualizations to fit their containers
       */
      resize() {
        visualizations.forEach(viz => {
          viz.instance.updateDimensions();
          viz.instance.render(viz.instance.data);
        });
      },
      
      /**
       * Clean up all visualizations and remove event listeners
       */
      destroy() {
        visualizations.forEach(viz => {
          viz.instance.destroy();
        });
        
        // Clear array
        visualizations.length = 0;
      }
    };
  },
  
  /**
   * Initialize the visualization system
   * @param {Object} [config] - Configuration options
   * @returns {Object} - The Visualization namespace
   */
  initialize(config = {}) {
    // Set up window resize handler for responsive visualizations
    window.addEventListener('resize', this.debounce(() => {
      EventBus.publish('visualization:resize', {});
    }, 250));
    
    // Publish initialization event
    EventBus.publish('visualization:initialized', { timestamp: Date.now() });
    
    return this;
  },
  
  /**
   * Debounce function to limit the rate at which a function is executed
   * @private
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

// Export the Visualization namespace
export default Visualization;
