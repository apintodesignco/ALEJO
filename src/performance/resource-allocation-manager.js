/**
 * @file resource-allocation-manager.js
 * @description Manages system resources to prevent overheating and optimize performance
 * while maintaining ALEJO's functionality. Implements adaptive resource usage based on
 * system conditions and user preferences. Integrated with comprehensive resource monitoring
 * for accurate system metrics.
 * @module performance/resource-allocation-manager
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/event-bus.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../core/logger.js';
import ResourceMonitorIntegration from './monitor-integration.js';

// Constants for resource thresholds
const RESOURCE_THRESHOLDS = {
  CPU: {
    HIGH: 80, // Percentage
    MEDIUM: 50, // Percentage
    LOW: 30 // Percentage
  },
  MEMORY: {
    HIGH: 85, // Percentage
    MEDIUM: 60, // Percentage
    LOW: 40 // Percentage
  },
  TEMPERATURE: {
    CRITICAL: 85, // Celsius
    HIGH: 75, // Celsius
    MEDIUM: 65, // Celsius
    LOW: 55 // Celsius
  }
};

// Resource usage modes
const RESOURCE_MODES = {
  FULL: 'full',           // All features enabled
  BALANCED: 'balanced',   // Some non-essential features disabled
  CONSERVATIVE: 'conservative', // Only essential features enabled
  MINIMAL: 'minimal'      // Absolute minimum functionality
};

/**
 * ResourceAllocationManager class
 * Monitors and manages system resources to prevent overheating and optimize performance
 */
class ResourceAllocationManager {
  /**
   * Create a ResourceAllocationManager instance
   */
  constructor() {
    this.logger = new Logger('ResourceAllocationManager');
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    
    // Resource monitor integration
    this.resourceMonitor = null;
    
    // Current resource usage statistics
    this.resources = {
      cpu: 0,
      memory: 0,
      disk: 0,
      temperature: 0,
      batteryLevel: 100,
      isCharging: true
    };
    
    // Current resource mode
    this.currentMode = RESOURCE_MODES.FULL;
    
    // Map of components and their resource requirements
    this.componentRegistry = new Map();
    
    // Resource monitoring interval (in milliseconds)
    this.monitoringInterval = 5000;
    
    // Interval ID for resource monitoring
    this.monitorIntervalId = null;
    
    // User preferences for resource management
    this.userPreferences = {
      enableAutomaticResourceManagement: true,
      prioritizePerformanceOverFeatures: false,
      temperatureCeilingCelsius: 80,
      cpuUsageCeilingPercent: 85,
      memoryUsageCeilingPercent: 90,
      batteryPreservationMode: false
    };
    
    // Initialize event listeners
    this._initEventListeners();
  }
  
  /**
   * Initialize the ResourceAllocationManager
   * @returns {Promise<Object>} - The initialized resource manager instance
   */
  async initialize() {
    try {
      this.logger.info('Initializing ResourceAllocationManager - Starting progressive loading sequence');
      
      // Stage 1: Configuration Loading
      const capabilities = await this._detectSystemCapabilities();
      this.logger.debug('System capabilities:', capabilities);
      
      // Initialize resource monitor integration
      this.resourceMonitor = new ResourceMonitorIntegration(this.eventBus, this.logger);
      
      // Initialize monitor with our thresholds
      const thresholds = {
        cpu: {
          warning: this.userPreferences.cpuUsageCeilingPercent - 5,
          critical: this.userPreferences.cpuUsageCeilingPercent
        },
        memory: {
          warning: this.userPreferences.memoryUsageCeilingPercent - 5,
          critical: this.userPreferences.memoryUsageCeilingPercent
        },
        disk: {
          warning: 80,
          critical: 90
        }
      };
      
      const monitorInitialized = await this.resourceMonitor.initialize(thresholds);
      
      if (!monitorInitialized) {
        this.logger.warn('Failed to initialize resource monitor integration, falling back to basic monitoring');
        this._startMonitoring();
      } else {
        // Set up event listeners for resource monitor events
        this.eventBus.on('resource-monitor:measurement', this._handleResourceUpdate.bind(this));
        this.eventBus.on('resource-monitor:warning', this._handleResourceWarning.bind(this));
      }
      
      // Stage 4: Initial Resource Assessment
      this.logger.debug('Stage 4/5: Performing initial resource assessment');
      try {
        await this._updateResourceUsage();
        this._evaluateResourceMode();
        this.logger.debug(`Stage 4/5: Initial assessment complete. Mode: ${this.currentMode}`);
      } catch (assessmentError) {
        this.logger.warn('Stage 4/5: Failed to perform initial resource assessment', assessmentError);
        // Not critical, we'll assess on the next monitoring cycle
      }
      
      // Stage 5: Event System Integration
      this.logger.debug('Stage 5/5: Integrating with event system');
      try {
        // Re-initialize event listeners to ensure they're properly set up
        this._initEventListeners();
        
        // Emit initialization event with detailed status
        this.eventBus.emit('resource-manager:initialized', {
          currentMode: this.currentMode,
          userPreferences: this.userPreferences,
          resources: this.resources,
          systemCapabilities: capabilities,
          initializationTime: new Date().toISOString()
        });
        
        this.logger.debug('Stage 5/5: Event system integration complete');
      } catch (eventError) {
        this.logger.warn('Stage 5/5: Event system integration issues detected', eventError);
        // Not critical for basic functionality
      }
      
      this.logger.info('ResourceAllocationManager initialized successfully');
      
      // Return the initialized instance for the initialization manager
      return this;
    } catch (error) {
      this.logger.error('Critical failure in ResourceAllocationManager initialization', error);
      
      // Instead of throwing, return a fallback instance
      this.logger.warn('Switching to fallback resource manager');
      return createFallbackResourceManager();
    }
  }
  
  /**
   * Detect system capabilities for resource management
   * @private
   * @returns {Promise<Object>} - System capabilities
   */
  async _detectSystemCapabilities() {
    const capabilities = {
      canMonitorCpu: true,
      canMonitorMemory: true,
      canMonitorTemperature: true,
      canMonitorBattery: true,
      supportsPowerModes: true,
      supportsBackgroundThrottling: true
    };
    
    try {
      // Test CPU monitoring
      await this._getCpuUsage();
    } catch (e) {
      capabilities.canMonitorCpu = false;
      this.logger.warn('CPU monitoring not available', e);
    }
    
    try {
      // Test memory monitoring
      await this._getMemoryUsage();
    } catch (e) {
      capabilities.canMonitorMemory = false;
      this.logger.warn('Memory monitoring not available', e);
    }
    
    try {
      // Test temperature monitoring
      const temp = await this._getSystemTemperature();
      capabilities.canMonitorTemperature = temp !== null;
    } catch (e) {
      capabilities.canMonitorTemperature = false;
      this.logger.warn('Temperature monitoring not available', e);
    }
    
    try {
      // Test battery monitoring
      const battery = await this._getBatteryStatus();
      capabilities.canMonitorBattery = battery !== null;
    } catch (e) {
      capabilities.canMonitorBattery = false;
      this.logger.warn('Battery monitoring not available', e);
    }
    
    // Store capabilities for future reference
    this.systemCapabilities = capabilities;
    return capabilities;
  }
  
  /**
   * Set up fallback monitoring when regular monitoring fails
   * @private
   */
  _setupFallbackMonitoring() {
    this.logger.warn('Setting up fallback resource monitoring');
    
    // Use a more conservative resource mode by default
    this.currentMode = RESOURCE_MODES.CONSERVATIVE;
    
    // Set up a simple interval that just checks for critical system events
    this.monitorIntervalId = setInterval(() => {
      // Simplified monitoring that just checks if the system is responsive
      const now = Date.now();
      const responseTime = Date.now() - now;
      
      if (responseTime > 1000) {
        // System is under heavy load if simple operations take > 1s
        this.logger.warn(`System under heavy load (response time: ${responseTime}ms)`);
        this._applyConservativeMode();
      }
      
      // Try to get battery status as it's often available even when other metrics aren't
      this._getBatteryStatus().then(battery => {
        if (battery && battery.level < 0.2 && !battery.charging) {
          this.logger.warn('Low battery detected in fallback monitoring');
          this._applyMinimalMode();
        }
      }).catch(() => {});
      
    }, 30000); // Check less frequently in fallback mode
  }
  
  /**
   * Register a component with its resource requirements
   * @param {string} componentId - Unique identifier for the component
   * @param {Object} requirements - Resource requirements for the component
   * @param {number} requirements.cpuPriority - CPU priority (1-10, 10 being highest)
   * @param {number} requirements.memoryFootprint - Estimated memory usage in MB
   * @param {boolean} requirements.isEssential - Whether the component is essential for core functionality
   * @param {Function} requirements.pauseCallback - Function to call when component should pause
   * @param {Function} requirements.resumeCallback - Function to call when component can resume
   * @param {Function} requirements.reduceResourcesCallback - Function to call when component should reduce resource usage
   * @returns {boolean} - Whether registration was successful
   */
  registerComponent(componentId, requirements) {
    if (!componentId || this.componentRegistry.has(componentId)) {
      this.logger.warn(`Failed to register component: ${componentId}. ID invalid or already registered.`);
      return false;
    }
    
    this.componentRegistry.set(componentId, {
      id: componentId,
      cpuPriority: requirements.cpuPriority || 5,
      memoryFootprint: requirements.memoryFootprint || 10,
      isEssential: requirements.isEssential || false,
      pauseCallback: requirements.pauseCallback || (() => {}),
      resumeCallback: requirements.resumeCallback || (() => {}),
      reduceResourcesCallback: requirements.reduceResourcesCallback || (() => {}),
      isActive: true
    });
    
    this.logger.debug(`Component registered: ${componentId}`);
    return true;
  }
  
  /**
   * Unregister a component
   * @param {string} componentId - Unique identifier for the component
   * @returns {boolean} - Whether unregistration was successful
   */
  unregisterComponent(componentId) {
    if (!this.componentRegistry.has(componentId)) {
      this.logger.warn(`Failed to unregister component: ${componentId}. Not found.`);
      return false;
    }
    
    this.componentRegistry.delete(componentId);
    this.logger.debug(`Component unregistered: ${componentId}`);
    return true;
  }
  
  /**
   * Update the resource usage mode based on current system conditions
   * @param {string} mode - Resource mode to set (from RESOURCE_MODES)
   * @param {boolean} [force=false] - Whether to force the mode change regardless of conditions
   * @returns {boolean} - Whether the mode was changed
   */
  setResourceMode(mode, force = false) {
    if (!Object.values(RESOURCE_MODES).includes(mode)) {
      this.logger.warn(`Invalid resource mode: ${mode}`);
      return false;
    }
    
    if (this.currentMode === mode && !force) {
      return false;
    }
    
    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    this._applyResourceMode();
    
    this.eventBus.emit('resource-manager:mode-changed', {
      previousMode,
      currentMode: this.currentMode,
      forced: force
    });
    
    this.logger.info(`Resource mode changed: ${previousMode} -> ${this.currentMode}`);
    return true;
  }
  
  /**
   * Get current system resource usage
   * @returns {Object} - Current resource usage statistics
   */
  getResourceUsage() {
    return { ...this.resources };
  }
  
  /**
   * Get current resource mode
   * @returns {string} - Current resource mode
   */
  getCurrentMode() {
    return this.currentMode;
  }
  
  /**
   * Update user preferences for resource management
   * @param {Object} preferences - User preferences
   * @returns {Promise<void>}
   */
  async updateUserPreferences(preferences) {
    const oldPreferences = { ...this.userPreferences };
    
    // Update preferences with new values
    Object.assign(this.userPreferences, preferences);
    
    // Save preferences to config
    await this.configManager.set('resourceManagement', this.userPreferences);
    
    this.eventBus.emit('resource-manager:preferences-updated', {
      oldPreferences,
      newPreferences: this.userPreferences
    });
    
    this.logger.info('Resource management preferences updated');
    
    // Re-evaluate resource mode with new preferences
    this._evaluateResourceMode();
  }
  
  /**
   * Pause a specific component to conserve resources
   * @param {string} componentId - ID of component to pause
   * @returns {boolean} - Whether the component was paused
   */
  pauseComponent(componentId) {
    const component = this.componentRegistry.get(componentId);
    
    if (!component) {
      this.logger.warn(`Cannot pause component: ${componentId}. Not found.`);
      return false;
    }
    
    if (!component.isActive) {
      return false;
    }
    
    try {
      component.pauseCallback();
      component.isActive = false;
      
      this.eventBus.emit('resource-manager:component-paused', {
        componentId,
        reason: 'manual'
      });
      
      this.logger.info(`Component paused: ${componentId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error pausing component ${componentId}:`, error);
      return false;
    }
  }
  
  /**
   * Resume a specific component
   * @param {string} componentId - ID of component to resume
   * @returns {boolean} - Whether the component was resumed
   */
  resumeComponent(componentId) {
    const component = this.componentRegistry.get(componentId);
    
    if (!component) {
      this.logger.warn(`Cannot resume component: ${componentId}. Not found.`);
      return false;
    }
    
    if (component.isActive) {
      return false;
    }
    
    try {
      component.resumeCallback();
      component.isActive = true;
      
      this.eventBus.emit('resource-manager:component-resumed', {
        componentId,
        reason: 'manual'
      });
      
      this.logger.info(`Component resumed: ${componentId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error resuming component ${componentId}:`, error);
      return false;
    }
  }
  
  /**
   * Stop resource monitoring and cleanup
   */
  shutdown() {
    // Stop internal monitoring
    this._stopMonitoring();
    
    // Clean up resource monitor integration if it exists
    if (this.resourceMonitor && typeof this.resourceMonitor.shutdown === 'function') {
      this.logger.debug('Shutting down resource monitor integration');
      this.resourceMonitor.shutdown();
      
      // Remove resource monitor event listeners
      this.eventBus.off('resource-monitor:measurement', this._handleResourceUpdate);
      this.eventBus.off('resource-monitor:warning', this._handleResourceWarning);
    }
    
    // Remove all other event listeners
    this.eventBus.off('system:battery-status-changed', this._handleBatteryStatusChange);
    this.eventBus.off('system:visibility-changed', this._handleVisibilityChange);
    this.eventBus.off('system:thermal-warning', this._handleThermalWarning);
    this.eventBus.off('system:memory-pressure', this._handleMemoryPressure);
    this.eventBus.off('component:registered', this._handleComponentRegistered);
    this.eventBus.off('component:unregistered', this._handleComponentUnregistered);
    
    // Reset to full resource mode before shutting down
    this.setResourceMode(RESOURCE_MODES.FULL, true);
    
    this.resourceMonitor = null;
    
    this.logger.info('ResourceAllocationManager shut down completely');
  }
  
  /**
   * Load user preferences from config
   * @private
   * @returns {Promise<void>}
   */
  async _loadUserPreferences() {
    try {
      // Default comprehensive configuration with thresholds for all monitored resources
      const defaultConfig = {
        // Basic preferences
        enableAutomaticResourceManagement: true,
        prioritizePerformanceOverFeatures: false,
        
        // Threshold configuration
        thresholds: {
          cpu: {
            warning: this.userPreferences.cpuUsageCeilingPercent - 5 || 80,
            critical: this.userPreferences.cpuUsageCeilingPercent || 85
          },
          memory: {
            warning: this.userPreferences.memoryUsageCeilingPercent - 5 || 85,
            critical: this.userPreferences.memoryUsageCeilingPercent || 90
          },
          disk: {
            warning: 80,
            critical: 90
          },
          temperature: {
            warning: this.userPreferences.temperatureCeilingCelsius - 10 || 70,
            critical: this.userPreferences.temperatureCeilingCelsius || 80
          }
        },
        
        // Battery settings
        batteryPreservationMode: false,
        batteryThresholds: {
          warning: 20, // percentage
          critical: 10  // percentage
        },
        
        // Monitoring settings
        monitoringInterval: 5000, // ms
        adaptiveMonitoring: true, // adjust frequency based on system load
        
        // Logging
        logResourceWarnings: true,
        detailedResourceLogging: false // more verbose logging
      };
      
      // Get saved preferences from config
      const savedPreferences = await this.configManager.get('resourceManagement');
      
      if (savedPreferences) {
        // Merge savedPreferences with defaultConfig, using deep merge for nested objects
        this.userPreferences = this._deepMerge(defaultConfig, savedPreferences);
        this.logger.debug('Loaded user preferences for resource management');
      } else {
        // Save default preferences if none exist
        this.userPreferences = defaultConfig;
        await this.configManager.set('resourceManagement', this.userPreferences);
        this.logger.debug('Created default user preferences for resource management');
      }
      
      // Apply new monitoring interval if changed
      if (this.userPreferences.monitoringInterval !== this.monitoringInterval) {
        this.monitoringInterval = this.userPreferences.monitoringInterval;
        if (this.monitorIntervalId) {
          this._stopMonitoring();
          this._startMonitoring();
        }
      }
      
      // Update resource monitor thresholds if available
      if (this.resourceMonitor && this.resourceMonitor.isInitialized && this.resourceMonitor.isInitialized()) {
        await this.resourceMonitor.updateThresholds(this.userPreferences.thresholds);
        this.logger.debug('Updated resource monitor thresholds from user preferences');
      }
    } catch (error) {
      this.logger.error('Error loading user preferences:', error);
    }
  }
  
  /**
   * Deep merge two objects
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} - Merged object
   */
  _deepMerge(target, source) {
    const output = Object.assign({}, target);
    
    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this._deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }
  
  /**
   * Check if value is an object
   * @private
   * @param {*} item - Value to check
   * @returns {boolean} - Whether the value is an object
   */
  _isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Listen for system events that might affect resource usage
    this.eventBus.on('system:battery-status-changed', this._handleBatteryStatusChange.bind(this));
    this.eventBus.on('system:visibility-changed', this._handleVisibilityChange.bind(this));
    this.eventBus.on('system:thermal-warning', this._handleThermalWarning.bind(this));
    this.eventBus.on('system:memory-pressure', this._handleMemoryPressure.bind(this));
    
    // Listen for component registration/unregistration
    this.eventBus.on('component:registered', this._handleComponentRegistered.bind(this));
    this.eventBus.on('component:unregistered', this._handleComponentUnregistered.bind(this));
  }
  
  /**
   * Start resource monitoring
   * @private
   */
  _startMonitoring() {
    if (this.monitorIntervalId) {
      return;
    }
    
    this.monitorIntervalId = setInterval(() => {
      this._updateResourceUsage()
        .then(() => this._evaluateResourceMode())
        .catch(error => this.logger.error('Error in resource monitoring cycle:', error));
    }, this.monitoringInterval);
    
    this.logger.debug('Resource monitoring started');
  }
  
  /**
   * Stop resource monitoring
   * @private
   */
  _stopMonitoring() {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
      this.logger.debug('Resource monitoring stopped');
    }
  }
  
  /**
   * Update current resource usage statistics
   * @private
   * @returns {Promise<void>}
   */
  async _updateResourceUsage() {
    try {
      // If resource monitor integration is available, use it for accurate measurements
      if (this.resourceMonitor && this.resourceMonitor.isInitialized()) {
        // Get a snapshot of current resource usage
        const snapshot = await this.resourceMonitor.getResourceSnapshot();
        
        // Update our resource stats with data from the monitor
        this.resources.cpu = snapshot.cpu;
        this.resources.memory = snapshot.memory;
        this.resources.disk = snapshot.disk;
        
        // For now, still use internal methods for temperature and battery
        // as they might not be provided by the resource monitor
        const temperature = await this._getSystemTemperature();
        if (temperature !== null) {
          this.resources.temperature = temperature;
        }
        
        const batteryStatus = await this._getBatteryStatus();
        if (batteryStatus) {
          this.resources.batteryLevel = batteryStatus.level;
          this.resources.isCharging = batteryStatus.charging;
        }
      } else {
        // Fallback to internal measurement methods
        this.resources.cpu = await this._getCpuUsage();
        this.resources.memory = await this._getMemoryUsage();
        
        // Measure temperature if supported
        const temperature = await this._getSystemTemperature();
        if (temperature !== null) {
          this.resources.temperature = temperature;
        }
        
        // Measure battery status if supported
        const batteryStatus = await this._getBatteryStatus();
        if (batteryStatus) {
          this.resources.batteryLevel = batteryStatus.level;
          this.resources.isCharging = batteryStatus.charging;
        }
      }
      
      // Log resource usage
      this.logger.debug('Resource usage updated:', this.resources);
      
      // Emit event with updated resources
      this.eventBus.emit('resource-manager:resources-updated', { ...this.resources });
    } catch (error) {
      this.logger.error('Error updating resource usage:', error);
    }
  }
  
  /**
   * Evaluate and update resource mode based on current conditions
   * @private
   */
  _evaluateResourceMode() {
    // Skip evaluation if automatic resource management is disabled
    if (!this.userPreferences.enableAutomaticResourceManagement) {
      return;
    }
    
    let newMode = RESOURCE_MODES.FULL;
    
    // Check temperature
    if (this.resources.temperature >= this.userPreferences.temperatureCeilingCelsius ||
        this.resources.temperature >= RESOURCE_THRESHOLDS.TEMPERATURE.CRITICAL) {
      newMode = RESOURCE_MODES.MINIMAL;
    } else if (this.resources.temperature >= RESOURCE_THRESHOLDS.TEMPERATURE.HIGH) {
      newMode = RESOURCE_MODES.CONSERVATIVE;
    } else if (this.resources.temperature >= RESOURCE_THRESHOLDS.TEMPERATURE.MEDIUM) {
      newMode = RESOURCE_MODES.BALANCED;
    }
    
    // Check CPU usage
    if (this.resources.cpu >= this.userPreferences.cpuUsageCeilingPercent ||
        this.resources.cpu >= RESOURCE_THRESHOLDS.CPU.HIGH) {
      newMode = newMode === RESOURCE_MODES.FULL ? RESOURCE_MODES.BALANCED : newMode;
    }
    
    // Check memory usage
    if (this.resources.memory >= this.userPreferences.memoryUsageCeilingPercent ||
        this.resources.memory >= RESOURCE_THRESHOLDS.MEMORY.HIGH) {
      newMode = newMode === RESOURCE_MODES.FULL ? RESOURCE_MODES.BALANCED : newMode;
    }
    
    // Check battery status
    if (this.userPreferences.batteryPreservationMode && 
        !this.resources.isCharging && 
        this.resources.batteryLevel < 20) {
      newMode = RESOURCE_MODES.CONSERVATIVE;
    } else if (this.userPreferences.batteryPreservationMode && 
               !this.resources.isCharging && 
               this.resources.batteryLevel < 10) {
      newMode = RESOURCE_MODES.MINIMAL;
    }
    
    // Update resource mode if needed
    if (newMode !== this.currentMode) {
      this.setResourceMode(newMode);
    }
  }
  
  /**
   * Apply the current resource mode to all registered components
   * @private
   */
  _applyResourceMode() {
    switch (this.currentMode) {
      case RESOURCE_MODES.MINIMAL:
        this._applyMinimalMode();
        break;
      case RESOURCE_MODES.CONSERVATIVE:
        this._applyConservativeMode();
        break;
      case RESOURCE_MODES.BALANCED:
        this._applyBalancedMode();
        break;
      case RESOURCE_MODES.FULL:
      default:
        this._applyFullMode();
        break;
    }
  }
  
  /**
   * Apply minimal resource mode (only essential components active)
   * @private
   */
  _applyMinimalMode() {
    for (const [id, component] of this.componentRegistry.entries()) {
      if (!component.isEssential && component.isActive) {
        this.pauseComponent(id);
      } else if (component.isEssential && component.isActive) {
        try {
          component.reduceResourcesCallback('minimal');
        } catch (error) {
          this.logger.error(`Error reducing resources for component ${id}:`, error);
        }
      }
    }
    
    // Emit event for system-wide minimal mode
    this.eventBus.emit('resource-manager:minimal-mode', {
      reason: `High resource usage: CPU ${this.resources.cpu}%, Memory ${this.resources.memory}%, Temperature ${this.resources.temperature}°C`
    });
  }
  
  /**
   * Apply conservative resource mode
   * @private
   */
  _applyConservativeMode() {
    // Sort components by priority (lower priority first)
    const sortedComponents = Array.from(this.componentRegistry.entries())
      .sort(([, a], [, b]) => a.cpuPriority - b.cpuPriority);
    
    // Pause low priority, non-essential components
    for (const [id, component] of sortedComponents) {
      if (!component.isEssential && component.cpuPriority < 4 && component.isActive) {
        this.pauseComponent(id);
      } else if (component.isActive) {
        try {
          component.reduceResourcesCallback('conservative');
        } catch (error) {
          this.logger.error(`Error reducing resources for component ${id}:`, error);
        }
      }
    }
    
    // Emit event for system-wide conservative mode
    this.eventBus.emit('resource-manager:conservative-mode', {
      reason: `Elevated resource usage: CPU ${this.resources.cpu}%, Memory ${this.resources.memory}%, Temperature ${this.resources.temperature}°C`
    });
  }
  
  /**
   * Apply balanced resource mode
   * @private
   */
  _applyBalancedMode() {
    // Resume essential components
    for (const [id, component] of this.componentRegistry.entries()) {
      if (component.isEssential && !component.isActive) {
        this.resumeComponent(id);
      }
      
      if (component.isActive) {
        try {
          component.reduceResourcesCallback('balanced');
        } catch (error) {
          this.logger.error(`Error reducing resources for component ${id}:`, error);
        }
      }
    }
    
    // Emit event for system-wide balanced mode
    this.eventBus.emit('resource-manager:balanced-mode', {
      reason: `Moderate resource usage: CPU ${this.resources.cpu}%, Memory ${this.resources.memory}%, Temperature ${this.resources.temperature}°C`
    });
  }
  
  /**
   * Apply full resource mode (all components active)
   * @private
   */
  _applyFullMode() {
    // Resume all components
    for (const [id, component] of this.componentRegistry.entries()) {
      if (!component.isActive) {
        this.resumeComponent(id);
      }
    }
    
    // Emit event for system-wide full mode
    this.eventBus.emit('resource-manager:full-mode', {
      reason: `Normal resource usage: CPU ${this.resources.cpu}%, Memory ${this.resources.memory}%, Temperature ${this.resources.temperature}°C`
    });
  }
  
  /**
   * Get current CPU usage
   * @private
   * @returns {Promise<number>} - CPU usage percentage
   */
  async _getCpuUsage() {
    // In a browser environment, we can't directly measure CPU usage
    // This is a placeholder for a more sophisticated implementation
    // that could use the Performance API or other browser APIs
    
    try {
      // Use performance.now() to estimate CPU usage based on execution time
      const start = performance.now();
      const iterations = 1000000;
      
      // Perform a CPU-intensive operation
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i);
      }
      
      const end = performance.now();
      const executionTime = end - start;
      
      // Calculate a rough estimate of CPU usage based on execution time
      // This is not accurate but gives some indication of CPU load
      const baselineTime = 50; // Expected time on an idle CPU (ms)
      const maxTime = 200;     // Expected time on a fully loaded CPU (ms)
      
      let cpuUsage = ((executionTime - baselineTime) / (maxTime - baselineTime)) * 100;
      cpuUsage = Math.max(0, Math.min(100, cpuUsage));
      
      return cpuUsage;
    } catch (error) {
      this.logger.error('Error estimating CPU usage:', error);
      return 0;
    }
  }
  
  /**
   * Get current memory usage
   * @private
   * @returns {Promise<number>} - Memory usage percentage
   */
  async _getMemoryUsage() {
    try {
      // Use performance.memory if available (Chrome only)
      if (performance && performance.memory) {
        const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
        return (usedJSHeapSize / jsHeapSizeLimit) * 100;
      }
      
      // Fallback: use a rough estimate based on object creation
      const objects = [];
      const initialTime = performance.now();
      let currentTime = initialTime;
      const maxTime = 100; // ms
      
      while (currentTime - initialTime < maxTime) {
        objects.push(new Array(10000).fill('x'));
        currentTime = performance.now();
      }
      
      // Clean up
      objects.length = 0;
      
      // Estimate memory pressure based on GC behavior
      // This is very rough and not accurate
      return 50; // Default to medium memory usage when we can't measure
    } catch (error) {
      this.logger.error('Error estimating memory usage:', error);
      return 0;
    }
  }
  
  /**
   * Get current system temperature
   * @private
   * @returns {Promise<number|null>} - Temperature in Celsius, or null if not available
   */
  async _getSystemTemperature() {
    // In a browser environment, we can't directly measure system temperature
    // This is a placeholder that could be replaced with a more accurate implementation
    // on platforms that support it
    
    try {
      // If we're in a browser that supports the Sensors API and has permission
      if (typeof DeviceTemperatureSensor !== 'undefined') {
        // This is speculative - DeviceTemperatureSensor is not widely implemented
        const tempSensor = new DeviceTemperatureSensor();
        await tempSensor.start();
        const temp = tempSensor.temperature;
        await tempSensor.stop();
        return temp;
      }
      
      // Otherwise, estimate based on CPU usage as a rough proxy
      // This is not accurate but gives some indication
      const cpuUsage = await this._getCpuUsage();
      const baselineTemp = 40; // Baseline temperature in Celsius
      const maxTempIncrease = 40; // Maximum temperature increase under load
      
      return baselineTemp + (cpuUsage / 100) * maxTempIncrease;
    } catch (error) {
      // Temperature measurement not available
      return null;
    }
  }
  
  /**
   * Get current battery status
   * @private
   * @returns {Promise<Object|null>} - Battery status object or null if not available
   */
  async _getBatteryStatus() {
    try {
      // Use the Battery Status API if available
      if (navigator && navigator.getBattery) {
        const battery = await navigator.getBattery();
        return {
          level: battery.level * 100, // Convert to percentage
          charging: battery.charging
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error getting battery status:', error);
      return null;
    }
  }
  
  /**
   * Handle battery status change event
   * @private
   * @param {Object} data - Battery status data
   */
  _handleBatteryStatusChange(data) {
    this.resources.batteryLevel = data.level;
    this.resources.isCharging = data.charging;
    
    // Re-evaluate resource mode when battery status changes
    this._evaluateResourceMode();
  }
  
  /**
   * Handle visibility change event
   * @private
   * @param {Object} data - Visibility data
   */
  _handleVisibilityChange(data) {
    const isVisible = data.isVisible;
    
    // If page is hidden and we're not in minimal mode, switch to conservative
    if (!isVisible && this.currentMode === RESOURCE_MODES.FULL) {
      this.setResourceMode(RESOURCE_MODES.CONSERVATIVE);
    } 
    // If page becomes visible again and we're in conservative mode, re-evaluate
    else if (isVisible && this.currentMode === RESOURCE_MODES.CONSERVATIVE) {
      this._evaluateResourceMode();
    }
  }
  
  /**
   * Handle thermal warning event
   * @private
   * @param {Object} data - Thermal warning data
   */
  _handleThermalWarning(data) {
    this.logger.warn(`Thermal warning detected: ${data.message}`);
    
    // If temperature is critical, switch to minimal resource mode
    if (data.level === 'critical') {
      this.setResourceMode(RESOURCE_MODES.MINIMAL, true);
    } else {
      this._evaluateResourceMode();
    }
  }
  
  /**
   * Handle resource update from the monitoring system
   * @private
   * @param {Object} measurement - Resource measurement data
   */
  _handleResourceUpdate(measurement) {
    // Update our internal resource stats with the measurement data
    this.resources.cpu = measurement.cpu;
    this.resources.memory = measurement.memory;
    this.resources.disk = measurement.disk;
    
    // Emit resource update event with updated data
    this.eventBus.emit('resource-manager:resources-updated', { ...this.resources });
    
    // Evaluate if we need to change resource mode based on new measurements
    this._evaluateResourceMode();
  }
  
  /**
   * Handle resource warnings from the monitoring system
   * @private
   * @param {Object} data - Warning data containing warnings and measurements
   */
  _handleResourceWarning(data) {
    const { warnings, measurement } = data;
    
    this.logger.warn(`Resource warning detected: ${warnings.length} issue(s)`);
    
    // Track if we need system-wide resource mode changes
    let systemModeChange = null;
    let affectedComponents = [];
    
    // Process each warning
    warnings.forEach(warning => {
      this.logger.warn(`Resource warning: ${warning.message}`);
      
      // Take appropriate action based on warning type and level
      if (warning.level === 'critical') {
        switch(warning.type) {
          case 'cpu':
            // Find the highest CPU consumers first
            const cpuIntensiveComponents = this._getHighResourceComponents('cpuPriority');
            affectedComponents.push(...cpuIntensiveComponents);
            systemModeChange = RESOURCE_MODES.CONSERVATIVE;
            break;
            
          case 'memory':
            // Find components with large memory footprints
            const memoryIntensiveComponents = this._getHighResourceComponents('memoryFootprint');
            affectedComponents.push(...memoryIntensiveComponents);
            systemModeChange = RESOURCE_MODES.CONSERVATIVE;
            break;
            
          case 'disk':
            this.logger.error(`Critical disk space warning: ${warning.message}`);
            this.eventBus.emit('resource-manager:disk-critical', { 
              message: warning.message, 
              value: measurement.disk 
            });
            break;
        }
      } else if (warning.level === 'warning') {
        // For warning level, consider a more moderate response
        switch(warning.type) {
          case 'cpu':
            // Only target the top few CPU intensive components
            const moderateCpuComponents = this._getHighResourceComponents('cpuPriority', 3);
            affectedComponents.push(...moderateCpuComponents);
            // Only reduce system-wide resources if we're in full mode
            if (this.currentMode === RESOURCE_MODES.FULL) {
              systemModeChange = RESOURCE_MODES.BALANCED;
            }
            break;
          case 'memory':
            // Only target the top few memory intensive components
            const moderateMemComponents = this._getHighResourceComponents('memoryFootprint', 3);
            affectedComponents.push(...moderateMemComponents);
            // Only reduce system-wide resources if we're in full mode
            if (this.currentMode === RESOURCE_MODES.FULL) {
              systemModeChange = RESOURCE_MODES.BALANCED;
            }
            break;
        }
      }
    });
    
    // Check for critical warnings first
    const hasCriticalWarnings = warnings.some(w => w.level === 'critical');
    const warningLevel = hasCriticalWarnings ? 'critical' : 'warning';
    
    // Apply component-specific resource reduction for affected components
    this._applyComponentSpecificActions(affectedComponents, warningLevel);
    
    // Apply system-wide resource mode change if needed
    if (systemModeChange) {
      this.setResourceMode(systemModeChange);
    }
    
    // Emit comprehensive warning event for other systems to respond to
    this.eventBus.emit('resource-manager:resource-warning', {
      warnings,
      measurement,
      affectedComponents: affectedComponents.map(c => c.id),
      systemModeChange
    });
  }
  
  /**
   * Handle memory pressure event
   * @private
   * @param {Object} data - Memory pressure data
   */
  _handleMemoryPressure(data) {
    this.logger.warn(`Memory pressure received: ${data.level}`);
    
    // Immediately reduce resource usage based on memory pressure level
    switch (data.level) {
      case 'critical':
        this.setResourceMode(RESOURCE_MODES.MINIMAL, true);
        break;
      case 'serious':
        this.setResourceMode(RESOURCE_MODES.CONSERVATIVE, true);
        break;
      case 'moderate':
        this.setResourceMode(RESOURCE_MODES.BALANCED, true);
        break;
      default:
        this._evaluateResourceMode();
        break;
    }
  }
  
  /**
   * Handle component registered event
   * @private
   * @param {Object} data - Component data
   */
  _handleComponentRegistered(data) {
    if (data && data.id && data.resourceRequirements) {
      this.registerComponent(data.id, data.resourceRequirements);
    }
  }
  
  /**
   * Handle component unregistered event
   * @private
   * @param {Object} data - Component data
   */
  _handleComponentUnregistered(data) {
    if (data && data.id) {
      this.unregisterComponent(data.id);
    }
  }
  
  /**
   * Get components with high resource usage based on a specific property
   * @private
   * @param {string} resourceProperty - The component property to sort by ('cpuPriority' or 'memoryFootprint')
   * @param {number} [limit=5] - Maximum number of components to return
   * @returns {Array} - Array of high-resource components
   */
  _getHighResourceComponents(resourceProperty, limit = 5) {
    // Convert map to array and filter for active components
    const activeComponents = Array.from(this.componentRegistry.entries())
      .filter(([, component]) => component.isActive)
      .map(([id, component]) => ({ 
        id, 
        ...component 
      }));
    
    // Sort based on the resource property
    // Note: for cpuPriority, higher is more important (reverse sort)
    // For memoryFootprint, higher means more usage (reverse sort)
    const sortedComponents = [...activeComponents].sort((a, b) => {
      if (resourceProperty === 'cpuPriority') {
        return b[resourceProperty] - a[resourceProperty]; // Higher priority first
      }
      return b[resourceProperty] - a[resourceProperty]; // Higher resource usage first
    });
    
    // Return only non-essential components if possible
    const nonEssentialComponents = sortedComponents.filter(c => !c.isEssential);
    
    // If we have enough non-essential components, return those first
    if (nonEssentialComponents.length >= limit) {
      return nonEssentialComponents.slice(0, limit);
    }
    
    // Otherwise return mixed, but prioritize non-essential components
    return [
      ...nonEssentialComponents,
      ...sortedComponents.filter(c => c.isEssential).slice(0, limit - nonEssentialComponents.length)
    ];
  }
  
  /**
   * Apply component-specific resource management actions based on warning level
   * @private
   * @param {Array} components - List of components to apply actions to
   * @param {string} warningLevel - The warning level ('critical', 'warning', etc.)
   */
  _applyComponentSpecificActions(components, warningLevel) {
    if (!components || components.length === 0) {
      return;
    }
    
    this.logger.debug(`Applying component-specific actions to ${components.length} components due to ${warningLevel} warning`);
    
    components.forEach(component => {
      const registeredComponent = this.componentRegistry.get(component.id);
      if (!registeredComponent) return;
      
      if (warningLevel === 'critical') {
        // For critical warnings: pause non-essential components, reduce resources for essential ones
        if (!registeredComponent.isEssential) {
          this.pauseComponent(component.id);
        } else if (typeof registeredComponent.reduceResourcesCallback === 'function') {
          try {
            registeredComponent.reduceResourcesCallback('critical');
            this.logger.debug(`Reduced resources for essential component: ${component.id}`);
          } catch (error) {
            this.logger.error(`Failed to reduce resources for component ${component.id}:`, error);
          }
        }
      } else { // 'warning' level
        // For warnings: reduce resources but don't pause
        if (typeof registeredComponent.reduceResourcesCallback === 'function') {
          try {
            registeredComponent.reduceResourcesCallback('warning');
            this.logger.debug(`Reduced resources for component: ${component.id} due to warning`);
          } catch (error) {
            this.logger.error(`Failed to reduce resources for component ${component.id}:`, error);
          }
        }
      }
    });
  }
}

// Create singleton instance
let instance = null;

/**
 * Get the ResourceAllocationManager instance
 * @returns {ResourceAllocationManager} - Singleton instance
 */
function getResourceAllocationManager() {
  if (!instance) {
    instance = new ResourceAllocationManager();
  }
  return instance;
}

/**
 * Fallback implementation of the resource allocation manager
 * Used when the main implementation fails to initialize
 * @returns {Object} - A simplified resource manager with the same interface
 */
/**
 * Fallback implementation of the resource allocation manager
 * Used when the main implementation fails to initialize
 * @returns {Object} - A simplified resource manager with the same interface
 */
function createFallbackResourceManager() {
  // Create a logger if possible, otherwise use console
  let logger;
  try {
    logger = new Logger('FallbackResourceManager');
  } catch (e) {
    logger = {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
  }
  
  logger.warn('Creating fallback resource manager - limited functionality available');
  
  // Try to get event bus, but don't fail if unavailable
  let eventBus;
  try {
    eventBus = EventBus.getInstance();
  } catch (e) {
    logger.warn('EventBus not available, using mock implementation');
    eventBus = {
      emit: () => {},
      on: () => {},
      off: () => {}
    };
  }
  
  // Component registry with degraded functionality tracking
  const componentRegistry = new Map();
  const essentialComponents = new Set();
  
  // Start in conservative mode to ensure stability
  let currentMode = RESOURCE_MODES.CONSERVATIVE;
  
  // Default resource values
  const resources = {
    cpu: 50,
    memory: 50,
    temperature: 40,
    batteryLevel: 100,
    isCharging: true,
    lastUpdated: new Date().toISOString()
  };
  
  // Default preferences focused on stability
  const userPreferences = {
    enableAutomaticResourceManagement: true,
    prioritizePerformanceOverFeatures: false,
    temperatureCeilingCelsius: 75, // More conservative than normal
    cpuUsageCeilingPercent: 80,     // More conservative than normal
    memoryUsageCeilingPercent: 85,  // More conservative than normal
    batteryPreservationMode: true   // Enable battery preservation by default
  };
  
  // Set up minimal monitoring
  let monitorIntervalId = null;
  
  const fallbackManager = {
    currentMode,
    resources,
    componentRegistry,
    essentialComponents,
    userPreferences,
    systemCapabilities: {
      canMonitorCpu: false,
      canMonitorMemory: false,
      canMonitorTemperature: false,
      canMonitorBattery: true, // Battery API is often available
      supportsPowerModes: false,
      supportsBackgroundThrottling: false
    },
    
    // API methods with enhanced logging and fallback behavior
    initialize: async () => {
      logger.info('Initializing fallback resource manager');
      
      // Try to set up minimal monitoring
      try {
        // Check battery status periodically if available
        navigator.getBattery && navigator.getBattery().then(battery => {
          resources.batteryLevel = battery.level * 100;
          resources.isCharging = battery.charging;
          
          // Update on battery changes
          battery.addEventListener('levelchange', () => {
            resources.batteryLevel = battery.level * 100;
            if (resources.batteryLevel < 20 && !battery.charging) {
              currentMode = RESOURCE_MODES.MINIMAL;
              logger.warn('Low battery detected, switching to minimal mode');
              eventBus.emit('resource-manager:mode-changed', { mode: currentMode });
            }
          });
          
          battery.addEventListener('chargingchange', () => {
            resources.isCharging = battery.charging;
          });
        }).catch(e => {
          logger.warn('Battery API not available', e);
        });
        
        // Set up minimal interval for resource estimation
        monitorIntervalId = setInterval(() => {
          // Simulate increasing resource usage over time to encourage
          // periodic reloads/restarts for stability
          resources.cpu = Math.min(resources.cpu + 0.5, 75);
          resources.memory = Math.min(resources.memory + 0.25, 80);
          resources.lastUpdated = new Date().toISOString();
          
          // Emit update event
          eventBus.emit('resource-manager:usage-updated', { resources });
          
          // If we reach high values, suggest conservative mode
          if (resources.cpu > 70 || resources.memory > 75) {
            if (currentMode !== RESOURCE_MODES.CONSERVATIVE && 
                currentMode !== RESOURCE_MODES.MINIMAL) {
              currentMode = RESOURCE_MODES.CONSERVATIVE;
              logger.warn('High resource usage detected, switching to conservative mode');
              eventBus.emit('resource-manager:mode-changed', { mode: currentMode });
            }
          }
        }, 60000); // Check every minute
      } catch (e) {
        logger.error('Failed to set up fallback monitoring', e);
      }
      
      // Emit initialization event
      eventBus.emit('resource-manager:initialized', {
        currentMode,
        userPreferences,
        resources,
        systemCapabilities: fallbackManager.systemCapabilities,
        fallbackMode: true,
        initializationTime: new Date().toISOString()
      });
      
      logger.info('Fallback resource manager initialized');
      return fallbackManager;
    },
    
    registerComponent: (componentId, requirements) => {
      logger.info(`Registering component ${componentId} with fallback manager`);
      
      if (!componentId) {
        logger.warn('Invalid component ID provided');
        return false;
      }
      
      // Store component with its requirements
      componentRegistry.set(componentId, {
        ...requirements,
        registeredAt: new Date().toISOString(),
        status: 'active'
      });
      
      // Track essential components separately
      if (requirements && requirements.isEssential) {
        essentialComponents.add(componentId);
        logger.debug(`Component ${componentId} marked as essential`);
      }
      
      // Emit event
      eventBus.emit('resource-manager:component-registered', {
        componentId,
        requirements
      });
      
      return true;
    },
    
    unregisterComponent: (componentId) => {
      logger.info(`Unregistering component ${componentId} from fallback manager`);
      
      if (!componentRegistry.has(componentId)) {
        logger.warn(`Component ${componentId} not found in registry`);
        return false;
      }
      
      // Remove from registries
      componentRegistry.delete(componentId);
      essentialComponents.delete(componentId);
      
      // Emit event
      eventBus.emit('resource-manager:component-unregistered', {
        componentId
      });
      
      return true;
    },
    
    setResourceMode: (mode, force = false) => {
      if (!Object.values(RESOURCE_MODES).includes(mode)) {
        logger.warn(`Invalid resource mode: ${mode}`);
        return false;
      }
      
      // Don't allow switching to FULL mode in fallback manager unless forced
      if (mode === RESOURCE_MODES.FULL && !force) {
        logger.warn('Cannot switch to FULL mode in fallback manager without force flag');
        return false;
      }
      
      const previousMode = currentMode;
      currentMode = mode;
      
      logger.info(`Resource mode changed: ${previousMode} -> ${currentMode}`);
      
      // Apply the mode change
      if (mode === RESOURCE_MODES.MINIMAL) {
        // In minimal mode, pause all non-essential components
        for (const [componentId, component] of componentRegistry.entries()) {
          if (!essentialComponents.has(componentId) && component.pauseCallback) {
            try {
              component.pauseCallback();
              component.status = 'paused';
              logger.debug(`Paused non-essential component: ${componentId}`);
            } catch (e) {
              logger.error(`Failed to pause component ${componentId}`, e);
            }
          }
        }
      } else if (mode === RESOURCE_MODES.CONSERVATIVE) {
        // In conservative mode, reduce resources for non-essential components
        for (const [componentId, component] of componentRegistry.entries()) {
          if (!essentialComponents.has(componentId) && component.reduceResourcesCallback) {
            try {
              component.reduceResourcesCallback();
              component.status = 'reduced';
              logger.debug(`Reduced resources for component: ${componentId}`);
            } catch (e) {
              logger.error(`Failed to reduce resources for component ${componentId}`, e);
            }
          }
        }
      } else {
        // In other modes, resume components
        for (const [componentId, component] of componentRegistry.entries()) {
          if (component.status !== 'active' && component.resumeCallback) {
            try {
              component.resumeCallback();
              component.status = 'active';
              logger.debug(`Resumed component: ${componentId}`);
            } catch (e) {
              logger.error(`Failed to resume component ${componentId}`, e);
            }
          }
        }
      }
      
      // Emit event
      eventBus.emit('resource-manager:mode-changed', {
        previousMode,
        currentMode: mode,
        forced: force
      });
      
      return true;
    },
    
    getResourceUsage: () => ({
      ...resources,
      lastUpdated: new Date().toISOString()
    }),
    
    getCurrentMode: () => currentMode,
    
    updateUserPreferences: async (preferences) => {
      logger.info('Updating user preferences in fallback manager');
      
      // Merge preferences
      Object.assign(userPreferences, preferences);
      
      // Emit event
      eventBus.emit('resource-manager:preferences-updated', {
        userPreferences
      });
      
      return Promise.resolve(userPreferences);
    },
    
    pauseComponent: (componentId) => {
      const component = componentRegistry.get(componentId);
      if (!component) {
        logger.warn(`Component ${componentId} not found in registry`);
        return false;
      }
      
      if (component.pauseCallback) {
        try {
          component.pauseCallback();
          component.status = 'paused';
          logger.debug(`Manually paused component: ${componentId}`);
          return true;
        } catch (e) {
          logger.error(`Failed to pause component ${componentId}`, e);
          return false;
        }
      }
      
      return false;
    },
    
    resumeComponent: (componentId) => {
      const component = componentRegistry.get(componentId);
      if (!component) {
        logger.warn(`Component ${componentId} not found in registry`);
        return false;
      }
      
      if (component.resumeCallback) {
        try {
          component.resumeCallback();
          component.status = 'active';
          logger.debug(`Manually resumed component: ${componentId}`);
          return true;
        } catch (e) {
          logger.error(`Failed to resume component ${componentId}`, e);
          return false;
        }
      }
      
      return false;
    },
    
    shutdown: () => {
      logger.info('Shutting down fallback resource manager');
      
      // Clear monitoring interval
      if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
        monitorIntervalId = null;
      }
      
      // Emit event
      eventBus.emit('resource-manager:shutdown', {
        timestamp: new Date().toISOString()
      });
    }
  };
  
  return fallbackManager;
}

export {
  getResourceAllocationManager,
  createFallbackResourceManager,
  RESOURCE_MODES
};

export default {
  getResourceAllocationManager,
  createFallbackResourceManager,
  RESOURCE_MODES
};
