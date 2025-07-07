/**
 * @file resource-allocation-manager.js
 * @description Manages system resources to prevent overheating and optimize performance
 * while maintaining ALEJO's functionality. Implements adaptive resource usage based on
 * system conditions and user preferences.
 * @module performance/resource-allocation-manager
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/event-bus.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../core/logger.js';

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
    
    // Current resource usage statistics
    this.resources = {
      cpu: 0,
      memory: 0,
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
      this.logger.info('Initializing ResourceAllocationManager');
      
      // Load user preferences from config
      await this._loadUserPreferences();
      
      // Start resource monitoring
      this._startMonitoring();
      
      // Emit initialization event
      this.eventBus.emit('resource-manager:initialized', {
        currentMode: this.currentMode,
        userPreferences: this.userPreferences
      });
      
      this.logger.info('ResourceAllocationManager initialized successfully');
      
      // Return the initialized instance for the initialization manager
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize ResourceAllocationManager', error);
      throw error;
    }
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
    this._stopMonitoring();
    this.logger.info('ResourceAllocationManager shut down');
  }
  
  /**
   * Load user preferences from config
   * @private
   * @returns {Promise<void>}
   */
  async _loadUserPreferences() {
    try {
      const savedPreferences = await this.configManager.get('resourceManagement');
      
      if (savedPreferences) {
        Object.assign(this.userPreferences, savedPreferences);
        this.logger.debug('Loaded user preferences for resource management');
      } else {
        // Save default preferences if none exist
        await this.configManager.set('resourceManagement', this.userPreferences);
        this.logger.debug('Created default user preferences for resource management');
      }
    } catch (error) {
      this.logger.error('Error loading user preferences:', error);
    }
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
      // Get CPU usage
      const cpuUsage = await this._getCpuUsage();
      this.resources.cpu = cpuUsage;
      
      // Get memory usage
      const memoryUsage = await this._getMemoryUsage();
      this.resources.memory = memoryUsage;
      
      // Get temperature (if available)
      const temperature = await this._getSystemTemperature();
      if (temperature !== null) {
        this.resources.temperature = temperature;
      }
      
      // Get battery status (if available)
      const batteryStatus = await this._getBatteryStatus();
      if (batteryStatus) {
        this.resources.batteryLevel = batteryStatus.level;
        this.resources.isCharging = batteryStatus.charging;
      }
      
      // Emit resource update event
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
    this.logger.warn(`Thermal warning received: ${data.level}`);
    
    // Immediately reduce resource usage based on thermal warning level
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
function createFallbackResourceManager() {
  return {
    currentMode: RESOURCE_MODES.CONSERVATIVE,
    resources: {
      cpu: 0,
      memory: 0,
      temperature: 0,
      batteryLevel: 100,
      isCharging: true
    },
    componentRegistry: new Map(),
    userPreferences: {
      enableAutomaticResourceManagement: true,
      prioritizePerformanceOverFeatures: false,
      temperatureCeilingCelsius: 80,
      cpuUsageCeilingPercent: 85,
      memoryUsageCeilingPercent: 90,
      batteryPreservationMode: false
    },
    
    // Simplified API methods
    initialize: async () => {
      console.log('Using fallback resource manager');
      return Promise.resolve();
    },
    registerComponent: (componentId, requirements) => {
      console.log(`Fallback: Registered component ${componentId}`);
      return true;
    },
    unregisterComponent: (componentId) => {
      console.log(`Fallback: Unregistered component ${componentId}`);
      return true;
    },
    setResourceMode: (mode) => {
      console.log(`Fallback: Set resource mode to ${mode}`);
      return true;
    },
    getResourceUsage: () => ({
      cpu: 50, // Default values
      memory: 50,
      temperature: 40,
      batteryLevel: 100,
      isCharging: true
    }),
    getCurrentMode: () => RESOURCE_MODES.CONSERVATIVE,
    updateUserPreferences: async (preferences) => {
      console.log('Fallback: Updated user preferences');
      return Promise.resolve();
    },
    pauseComponent: () => true,
    resumeComponent: () => true,
    shutdown: () => {}
  };
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
