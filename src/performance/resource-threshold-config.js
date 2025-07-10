/**
 * @file resource-threshold-config.js
 * @description User-configurable resource thresholds for ALEJO performance management
 * @module performance/resource-threshold-config
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/event-bus.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../core/logger.js';
import { getResourceAllocationManager, RESOURCE_MODES } from './resource-allocation-manager.js';
import { getAuditTrail } from '../security/audit-trail.js';

/**
 * Default resource threshold configuration
 * @type {Object}
 */
const DEFAULT_THRESHOLDS = {
  cpu: {
    warning: 80,     // 80% CPU usage triggers warning
    critical: 90     // 90% CPU usage triggers critical action
  },
  memory: {
    warning: 75,     // 75% memory usage triggers warning
    critical: 85     // 85% memory usage triggers critical action
  },
  temperature: {
    warning: 70,     // 70°C triggers warning
    critical: 80     // 80°C triggers critical action
  },
  disk: {
    warning: 85,     // 85% disk usage triggers warning
    critical: 95     // 95% disk usage triggers critical action
  },
  battery: {
    low: 20,         // 20% battery triggers low power mode
    critical: 10     // 10% battery triggers critical power saving
  }
};

/**
 * Threshold step values for UI controls
 * @type {Object}
 */
const THRESHOLD_STEPS = {
  cpu: 5,            // CPU percentage steps
  memory: 5,         // Memory percentage steps
  temperature: 1,    // Temperature steps in °C
  disk: 5,           // Disk percentage steps
  battery: 5         // Battery percentage steps
};

/**
 * Resource Threshold Configuration Manager
 * Provides interface for users to configure resource thresholds
 */
class ResourceThresholdConfig {
  /**
   * Create a ResourceThresholdConfig instance
   */
  constructor() {
    this.logger = new Logger('ResourceThresholdConfig');
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.auditTrail = getAuditTrail();
    
    // Get resource manager instance
    this.resourceManager = getResourceAllocationManager();
    
    // Current threshold configuration
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    
    // User preferences
    this.userPreferences = {
      enableAutomaticResourceManagement: true,
      prioritizeAccessibilityOverPerformance: true,
      batteryPreservationMode: false,
      notifyOnThresholdCrossing: true,
      applyImmediately: true
    };
    
    // Flag to track initialization
    this.initialized = false;
    
    // UI configuration
    this.uiConfig = {
      currentTab: 'cpu',
      showAdvancedOptions: false,
      expanded: true
    };
  }
  
  /**
   * Initialize the resource threshold configuration
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      // Load user configuration
      await this._loadConfiguration();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Apply current thresholds to resource manager
      await this._applyThresholds();
      
      // Log initialization
      this.auditTrail.log('resource-config:initialized', {
        thresholds: this.thresholds,
        userPreferences: this.userPreferences
      });
      
      this.initialized = true;
      this.logger.info('Resource threshold configuration initialized');
      
      // Notify other components
      this.eventBus.emit('resource-thresholds:initialized', {
        thresholds: this.thresholds,
        userPreferences: this.userPreferences
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize resource threshold configuration', error);
      return false;
    }
  }
  
  /**
   * Load user configuration from config manager
   * @private
   */
  async _loadConfiguration() {
    try {
      // Load thresholds
      const savedThresholds = await this.configManager.get('resourceThresholds');
      if (savedThresholds) {
        this.thresholds = this._validateThresholds({
          ...DEFAULT_THRESHOLDS,
          ...savedThresholds
        });
      }
      
      // Load preferences
      const savedPreferences = await this.configManager.get('resourcePreferences');
      if (savedPreferences) {
        this.userPreferences = {
          ...this.userPreferences,
          ...savedPreferences
        };
      }
      
      // Load UI config
      const savedUiConfig = await this.configManager.get('resourceThresholdUi');
      if (savedUiConfig) {
        this.uiConfig = {
          ...this.uiConfig,
          ...savedUiConfig
        };
      }
      
      this.logger.debug('Loaded resource configuration', {
        thresholds: this.thresholds,
        preferences: this.userPreferences
      });
    } catch (error) {
      this.logger.warn('Failed to load resource configuration, using defaults', error);
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for resource monitoring events
    this.eventBus.on('resource-monitor:warning', this._handleResourceWarning.bind(this));
    this.eventBus.on('resource-monitor:critical', this._handleResourceCritical.bind(this));
    
    // Listen for user preference changes
    this.eventBus.on('user-preferences:updated', this._handlePreferencesUpdated.bind(this));
    
    // Listen for dashboard requests
    this.eventBus.on('resource-thresholds:request-config', this._handleConfigRequest.bind(this));
  }
  
  /**
   * Validate thresholds to ensure they make sense
   * @param {Object} thresholds - The thresholds to validate
   * @returns {Object} - Validated thresholds
   * @private
   */
  _validateThresholds(thresholds) {
    const validated = { ...thresholds };
    
    // CPU thresholds
    if (validated.cpu) {
      validated.cpu.warning = this._clamp(validated.cpu.warning, 40, 95);
      validated.cpu.critical = this._clamp(validated.cpu.critical, validated.cpu.warning + 5, 100);
    }
    
    // Memory thresholds
    if (validated.memory) {
      validated.memory.warning = this._clamp(validated.memory.warning, 40, 95);
      validated.memory.critical = this._clamp(validated.memory.critical, validated.memory.warning + 5, 100);
    }
    
    // Temperature thresholds
    if (validated.temperature) {
      validated.temperature.warning = this._clamp(validated.temperature.warning, 40, 85);
      validated.temperature.critical = this._clamp(validated.temperature.critical, validated.temperature.warning + 5, 95);
    }
    
    // Disk thresholds
    if (validated.disk) {
      validated.disk.warning = this._clamp(validated.disk.warning, 50, 95);
      validated.disk.critical = this._clamp(validated.disk.critical, validated.disk.warning + 5, 100);
    }
    
    // Battery thresholds
    if (validated.battery) {
      validated.battery.low = this._clamp(validated.battery.low, 10, 30);
      validated.battery.critical = this._clamp(validated.battery.critical, 5, validated.battery.low - 5);
    }
    
    return validated;
  }
  
  /**
   * Clamp a value between min and max
   * @param {number} value - The value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Clamped value
   * @private
   */
  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }
  
  /**
   * Apply thresholds to resource manager
   * @returns {Promise<boolean>} Whether thresholds were applied successfully
   * @private
   */
  async _applyThresholds() {
    try {
      // Check if resource manager is available
      if (!this.resourceManager) {
        this.resourceManager = getResourceAllocationManager();
        if (!this.resourceManager) {
          this.logger.warn('Resource manager not available, cannot apply thresholds');
          return false;
        }
      }
      
      // Apply thresholds to resource manager
      const result = await this.resourceManager.setCustomThresholds(this.thresholds);
      
      // Apply user preferences
      await this.resourceManager.setUserPreferences({
        enableAutomaticResourceManagement: this.userPreferences.enableAutomaticResourceManagement,
        prioritizeAccessibilityOverPerformance: this.userPreferences.prioritizeAccessibilityOverPerformance,
        batteryPreservationMode: this.userPreferences.batteryPreservationMode
      });
      
      this.logger.info('Applied resource thresholds and preferences', {
        thresholds: this.thresholds,
        preferences: this.userPreferences,
        result
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to apply thresholds to resource manager', error);
      return false;
    }
  }
  
  /**
   * Handle resource warning event
   * @param {Object} event - Resource warning event data
   * @private
   */
  _handleResourceWarning(event) {
    if (!this.userPreferences.notifyOnThresholdCrossing) return;
    
    // Notify user of threshold crossing if enabled
    this.eventBus.emit('notification:show', {
      type: 'warning',
      title: 'Resource Warning',
      message: `${event.resource} usage exceeds warning threshold (${event.value}${event.unit})`,
      source: 'ResourceThresholdConfig',
      actions: [
        {
          label: 'Adjust Thresholds',
          callback: () => this.openConfigurationUI()
        },
        {
          label: 'Ignore',
          callback: () => {}
        }
      ]
    });
  }
  
  /**
   * Handle resource critical event
   * @param {Object} event - Resource critical event data
   * @private
   */
  _handleResourceCritical(event) {
    // Always notify on critical events
    this.eventBus.emit('notification:show', {
      type: 'error',
      title: 'Resource Critical',
      message: `${event.resource} usage exceeds critical threshold (${event.value}${event.unit})`,
      source: 'ResourceThresholdConfig',
      autoClose: false,
      actions: [
        {
          label: 'Reduce Quality',
          callback: () => this.resourceManager.setResourceMode(RESOURCE_MODES.CONSERVATIVE)
        },
        {
          label: 'Adjust Thresholds',
          callback: () => this.openConfigurationUI()
        }
      ]
    });
  }
  
  /**
   * Handle user preferences updated event
   * @param {Object} event - User preferences event data
   * @private
   */
  _handlePreferencesUpdated(event) {
    // Check if event contains resource preferences
    if (event.preferences && event.preferences.resources) {
      this.userPreferences = {
        ...this.userPreferences,
        ...event.preferences.resources
      };
      
      // Save and apply if needed
      this._saveConfiguration();
      
      if (this.userPreferences.applyImmediately) {
        this._applyThresholds();
      }
    }
  }
  
  /**
   * Handle configuration request from dashboard
   * @private
   */
  _handleConfigRequest() {
    this.eventBus.emit('resource-thresholds:config', {
      thresholds: this.thresholds,
      preferences: this.userPreferences,
      defaults: DEFAULT_THRESHOLDS,
      steps: THRESHOLD_STEPS
    });
  }
  
  /**
   * Save current configuration to persistent storage
   * @returns {Promise<boolean>} Whether save was successful
   */
  async saveConfiguration() {
    try {
      // Save thresholds
      await this.configManager.set('resourceThresholds', this.thresholds);
      
      // Save preferences
      await this.configManager.set('resourcePreferences', this.userPreferences);
      
      // Save UI config
      await this.configManager.set('resourceThresholdUi', this.uiConfig);
      
      this.logger.debug('Saved resource configuration');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to save resource configuration', error);
      return false;
    }
  }
  
  /**
   * Update thresholds with new values
   * @param {string} resource - Resource type (cpu, memory, etc.)
   * @param {string} level - Threshold level (warning, critical, etc.)
   * @param {number} value - New threshold value
   * @returns {boolean} Whether update was successful
   */
  updateThreshold(resource, level, value) {
    // Validate resource type
    if (!this.thresholds[resource]) {
      this.logger.warn(`Invalid resource type: ${resource}`);
      return false;
    }
    
    // Validate threshold level
    if (!this.thresholds[resource][level]) {
      this.logger.warn(`Invalid threshold level: ${level}`);
      return false;
    }
    
    // Update threshold
    this.thresholds[resource][level] = this._clamp(
      value,
      level === 'critical' ? this.thresholds[resource].warning + 5 : 0,
      100
    );
    
    // Save configuration
    this.saveConfiguration();
    
    // Apply if immediate application is enabled
    if (this.userPreferences.applyImmediately) {
      this._applyThresholds();
    }
    
    // Notify of threshold update
    this.eventBus.emit('resource-thresholds:updated', {
      resource,
      level,
      value: this.thresholds[resource][level]
    });
    
    return true;
  }
  
  /**
   * Update multiple thresholds at once
   * @param {Object} newThresholds - New thresholds object
   * @returns {boolean} Whether update was successful
   */
  updateThresholds(newThresholds) {
    // Validate and merge thresholds
    this.thresholds = this._validateThresholds({
      ...this.thresholds,
      ...newThresholds
    });
    
    // Save configuration
    this.saveConfiguration();
    
    // Apply if immediate application is enabled
    if (this.userPreferences.applyImmediately) {
      this._applyThresholds();
    }
    
    // Notify of threshold updates
    this.eventBus.emit('resource-thresholds:bulk-update', {
      thresholds: this.thresholds
    });
    
    return true;
  }
  
  /**
   * Update user preferences
   * @param {Object} newPreferences - New user preferences
   * @returns {boolean} Whether update was successful
   */
  updatePreferences(newPreferences) {
    // Update preferences
    this.userPreferences = {
      ...this.userPreferences,
      ...newPreferences
    };
    
    // Save configuration
    this.saveConfiguration();
    
    // Apply preferences to resource manager
    this.resourceManager.setUserPreferences({
      enableAutomaticResourceManagement: this.userPreferences.enableAutomaticResourceManagement,
      prioritizeAccessibilityOverPerformance: this.userPreferences.prioritizeAccessibilityOverPerformance,
      batteryPreservationMode: this.userPreferences.batteryPreservationMode
    });
    
    // Notify of preference updates
    this.eventBus.emit('resource-thresholds:preferences-updated', {
      preferences: this.userPreferences
    });
    
    return true;
  }
  
  /**
   * Reset thresholds to default values
   * @returns {boolean} Whether reset was successful
   */
  resetToDefaults() {
    // Reset thresholds to defaults
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    
    // Save configuration
    this.saveConfiguration();
    
    // Apply if immediate application is enabled
    if (this.userPreferences.applyImmediately) {
      this._applyThresholds();
    }
    
    // Notify of threshold reset
    this.eventBus.emit('resource-thresholds:reset', {
      thresholds: this.thresholds
    });
    
    // Log reset action
    this.auditTrail.log('resource-config:reset', {
      thresholds: this.thresholds
    });
    
    return true;
  }
  
  /**
   * Get current thresholds
   * @returns {Object} Current resource thresholds
   */
  getThresholds() {
    return this.thresholds;
  }
  
  /**
   * Get user preferences
   * @returns {Object} Current user preferences
   */
  getPreferences() {
    return this.userPreferences;
  }
  
  /**
   * Open the configuration UI
   */
  openConfigurationUI() {
    // This will be implemented by the monitoring dashboard
    this.eventBus.emit('dashboard:open-resource-config', {
      thresholds: this.thresholds,
      preferences: this.userPreferences,
      defaults: DEFAULT_THRESHOLDS,
      steps: THRESHOLD_STEPS
    });
  }
}

// Create singleton instance
let instance = null;

/**
 * Get the ResourceThresholdConfig instance
 * @returns {ResourceThresholdConfig} Singleton instance
 */
export function getResourceThresholdConfig() {
  if (!instance) {
    instance = new ResourceThresholdConfig();
  }
  return instance;
}

/**
 * Initialize the resource threshold configuration
 * @returns {Promise<ResourceThresholdConfig>} Initialized singleton instance
 */
export async function initializeResourceThresholdConfig() {
  const config = getResourceThresholdConfig();
  await config.initialize();
  return config;
}

export {
  DEFAULT_THRESHOLDS,
  THRESHOLD_STEPS
};
