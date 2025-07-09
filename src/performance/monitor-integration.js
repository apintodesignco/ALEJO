/**
 * @file monitor-integration.js
 * @description Integrates the standalone resource monitoring tool with the resource allocation manager
 * to provide more accurate and comprehensive resource tracking.
 */

import {
  startMonitoring,
  stopMonitoring,
  getResourceSnapshot,
  addListener,
  checkResourceAvailability,
  updateThresholds
} from '../../tools/resource-monitor.js';

/**
 * Resource Monitor Integration
 * 
 * Connects the standalone resource monitoring tool with the resource allocation manager
 * to provide accurate system resource measurements and events.
 */
class ResourceMonitorIntegration {
  /**
   * Create a new resource monitor integration instance
   * @param {Object} eventBus - The application event bus
   * @param {Object} logger - The application logger
   */
  constructor(eventBus, logger) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.isInitialized = false;
    this.config = {
      sampleIntervalMs: 5000, // Match RAM's default interval
      logToConsole: false,    // We'll use the application logger instead
      notifyOnThreshold: true
    };
    
    // Bind methods
    this._handleResourceMeasurement = this._handleResourceMeasurement.bind(this);
    this._handleWarning = this._handleWarning.bind(this);
  }
  
  /**
   * Initialize the resource monitor integration
   * @param {Object} thresholds - Optional custom thresholds
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(thresholds) {
    try {
      if (this.isInitialized) {
        return true;
      }
      
      // Update thresholds if provided
      if (thresholds) {
        updateThresholds(thresholds);
      }
      
      // Start the monitoring with our config
      await startMonitoring(this.config);
      
      // Add listener for measurements
      addListener(this._handleResourceMeasurement);
      
      this.isInitialized = true;
      this.logger.info('Resource monitor integration initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize resource monitor integration:', error);
      return false;
    }
  }
  
  /**
   * Get the current resource usage
   * @returns {Promise<Object>} - Current resource usage stats
   */
  async getResourceUsage() {
    try {
      return await getResourceSnapshot();
    } catch (error) {
      this.logger.error('Error getting resource snapshot:', error);
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Check if system has enough resources for an operation
   * @param {Object} requirements - Resource requirements
   * @returns {Promise<Object>} - Result with available flag and message
   */
  async checkResourceAvailability(requirements) {
    return await checkResourceAvailability(requirements);
  }
  
  /**
   * Stop the resource monitor integration
   */
  shutdown() {
    if (this.isInitialized) {
      stopMonitoring();
      this.isInitialized = false;
      this.logger.info('Resource monitor integration shut down');
    }
  }
  
  /**
   * Handle resource measurements from the monitor
   * @private
   * @param {Object} measurement - Resource measurement
   */
  _handleResourceMeasurement(measurement) {
    // Emit event with resource usage data
    this.eventBus.emit('resource-monitor:measurement', measurement);
    
    // Check if any resources are above warning thresholds
    if (measurement.warnings && measurement.warnings.length > 0) {
      this._handleWarning(measurement);
    }
  }
  
  /**
   * Handle resource warnings
   * @private
   * @param {Object} measurement - Resource measurement with warnings
   */
  _handleWarning(measurement) {
    const { warnings } = measurement;
    
    warnings.forEach(warning => {
      switch(warning.type) {
        case 'cpu':
          if (warning.level === 'critical') {
            this.eventBus.emit('system:cpu-critical', {
              value: measurement.cpu,
              message: warning.message
            });
          }
          break;
          
        case 'memory':
          if (warning.level === 'critical') {
            this.eventBus.emit('system:memory-pressure', {
              value: measurement.memory,
              message: warning.message
            });
          }
          break;
          
        case 'disk':
          if (warning.level === 'critical') {
            this.eventBus.emit('system:disk-critical', {
              value: measurement.disk,
              message: warning.message
            });
          }
          break;
      }
    });
    
    // Also emit a general warning event
    this.eventBus.emit('resource-monitor:warning', {
      warnings,
      measurement
    });
  }
}

export default ResourceMonitorIntegration;
