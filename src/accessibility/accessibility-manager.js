/**
 * @file accessibility-manager.js
 * @description Central manager for all accessibility features
 * @module accessibility/accessibility-manager
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';

// Import accessibility modules
import * as AriaManager from './aria-manager.js';
import * as KeyboardNavigation from './keyboard-navigation.js';
import * as AnnouncementService from './announcement-service.js';
import * as HighContrastMode from './high-contrast-mode.js';
import * as FontScaling from './font-scaling.js';
import * as ColorBlindnessMode from './color-blindness-mode.js';

// Initialize logger
const logger = new Logger('AccessibilityManager');

// Module state
let _initialized = false;
let _config = null;

// Map of all managed modules
const _modules = {
  aria: {
    name: 'ARIA Manager',
    instance: AriaManager,
    initialized: false,
    enabled: false
  },
  keyboard: {
    name: 'Keyboard Navigation',
    instance: KeyboardNavigation,
    initialized: false,
    enabled: false
  },
  announcements: {
    name: 'Announcement Service',
    instance: AnnouncementService,
    initialized: false,
    enabled: false
  },
  highContrast: {
    name: 'High Contrast Mode',
    instance: HighContrastMode,
    initialized: false,
    enabled: false
  },
  fontScaling: {
    name: 'Font Scaling',
    instance: FontScaling,
    initialized: false,
    enabled: false
  },
  colorBlindness: {
    name: 'Color Blindness Mode',
    instance: ColorBlindnessMode,
    initialized: false,
    enabled: false
  }
};

// Default configuration
const DEFAULT_CONFIG = {
  // Whether to enable accessibility features on startup
  enabledByDefault: true,
  
  // Whether to detect and respect system accessibility preferences
  detectSystemPreferences: true,
  
  // Default settings for each module
  modules: {
    aria: { enabled: true },
    keyboard: { enabled: true },
    announcements: { enabled: true },
    highContrast: { enabled: false },
    fontScaling: { enabled: false },
    colorBlindness: { enabled: false }
  },
  
  // Integration options
  announceResourceChanges: true,
  announceHealthChanges: true,
  
  // Resource thresholds for accessibility features
  resourceThresholds: {
    // Maximum CPU percentage when all features are enabled
    maxCpuPercentage: 25,
    // Memory threshold in MB that triggers optimization
    memoryThresholdMB: 100,
    // Features to disable first when resources are constrained
    optimizationOrder: [
      'colorBlindness',
      'highContrast',
      'fontScaling'
    ]
  },
  
  // Keyboard shortcuts
  keyboardShortcuts: {
    'alt+a': 'toggleAccessibilityPanel',
    'alt+c': 'toggleHighContrast',
    'alt+f': 'toggleFontScaling',
    'alt+b': 'toggleColorBlindness',
    'alt+shift+a': 'toggleAllFeatures'
  }
};

/**
 * Initialize the accessibility manager
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Accessibility Manager already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing Accessibility Manager');
    
    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    
    // Check for system accessibility settings
    if (_config.detectSystemPreferences) {
      detectSystemAccessibilitySettings();
    }
    
    // Initialize all modules
    await initializeAllModules();
    
    // Set up event listeners
    setupEventListeners();
    
    _initialized = true;
    
    EventBus.publish('accessibility:managerInitialized', {
      enabledModules: getEnabledModules()
    });
    
    logger.info('Accessibility Manager initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Accessibility Manager', error);
    return false;
  }
}

/**
 * Initialize all accessibility modules
 * @private
 * @returns {Promise<void>}
 */
async function initializeAllModules() {
  for (const [key, module] of Object.entries(_modules)) {
    try {
      const moduleConfig = _config.modules[key] || {};
      const shouldEnable = moduleConfig.enabled !== undefined ? 
        moduleConfig.enabled : 
        _config.enabledByDefault;
      
      logger.info(`Initializing ${module.name}`);
      const success = await module.instance.initialize(moduleConfig);
      
      if (success) {
        _modules[key].initialized = true;
        
        // Enable the module if configured
        if (shouldEnable) {
          await module.instance.setEnabled(true);
          _modules[key].enabled = true;
        }
        
        logger.info(`${module.name} initialized successfully`);
      } else {
        logger.warn(`Failed to initialize ${module.name}`);
      }
    } catch (error) {
      logger.error(`Error initializing ${module.name}`, error);
    }
  }
}

/**
 * Detect system accessibility settings
 * @private
 */
function detectSystemAccessibilitySettings() {
  try {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      logger.info('Detected system preference for reduced motion');
      _config.modules.animations = { enabled: false };
    }
    
    // Check for prefers-contrast
    const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
    if (prefersContrast) {
      logger.info('Detected system preference for increased contrast');
      _config.modules.highContrast = { enabled: true };
    }
    
    // Check for forced colors (Windows high contrast mode)
    const forcedColors = window.matchMedia('(forced-colors: active)').matches;
    if (forcedColors) {
      logger.info('Detected system forced colors mode');
      _config.modules.highContrast = { enabled: true };
    }
    
    // Check for prefers-color-scheme
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDarkMode) {
      logger.info('Detected system preference for dark mode');
      // Will be used when initializing high contrast mode
    }
    
    // Check for system font size preference
    const htmlFontSize = window.getComputedStyle(document.documentElement).fontSize;
    const baseFontSize = parseInt(htmlFontSize);
    if (baseFontSize > 16) {
      logger.info(`Detected increased system font size: ${baseFontSize}px`);
      _config.modules.fontScaling = { enabled: true };
    }
  } catch (error) {
    logger.error('Error detecting system accessibility settings', error);
  }
}

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Listen for resource usage updates
  EventBus.subscribe('system:resourceUpdate', handleResourceUpdate);
  
  // Listen for health status changes
  EventBus.subscribe('health:statusChanged', handleHealthStatusChange);
  
  // Listen for configuration changes
  EventBus.subscribe('config:updated', handleConfigUpdate);
  
  // System preference changes
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotionQuery.addEventListener('change', () => detectSystemAccessibilitySettings());
  
  const contrastQuery = window.matchMedia('(prefers-contrast: more)');
  contrastQuery.addEventListener('change', () => detectSystemAccessibilitySettings());
  
  const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
  forcedColorsQuery.addEventListener('change', () => detectSystemAccessibilitySettings());
}

/**
 * Handle resource usage updates
 * @private
 * @param {Object} data - Resource usage data
 */
function handleResourceUpdate(data) {
  if (!_initialized) return;
  
  const cpuPercentage = data.cpu?.percentage || 0;
  const memoryUsageMB = data.memory?.usedMB || 0;
  const thresholds = _config.resourceThresholds;
  
  // Check if we need to optimize
  if (cpuPercentage > thresholds.maxCpuPercentage || 
      memoryUsageMB > thresholds.memoryThresholdMB) {
    
    logger.warn(`Resource usage above thresholds: CPU ${cpuPercentage}%, Memory ${memoryUsageMB}MB`);
    
    // Disable features according to optimization order
    for (const moduleKey of thresholds.optimizationOrder) {
      if (_modules[moduleKey]?.enabled) {
        const module = _modules[moduleKey];
        module.instance.setEnabled(false);
        module.enabled = false;
        
        logger.info(`Temporarily disabled ${module.name} to conserve resources`);
        
        // Announce the change
        if (_modules.announcements?.enabled) {
          AnnouncementService.announce(
            `${module.name} temporarily disabled to improve performance`,
            'info'
          );
        }
        
        // Check if this optimization is enough
        if (data.cpu?.percentage < thresholds.maxCpuPercentage * 0.8 &&
            data.memory?.usedMB < thresholds.memoryThresholdMB * 0.8) {
          break;
        }
      }
    }
  }
}

/**
 * Handle health status changes
 * @private
 * @param {Object} data - Health status data
 */
function handleHealthStatusChange(data) {
  if (!_initialized || !_config.announceHealthChanges) return;
  
  if (_modules.announcements?.enabled) {
    if (data.overallStatus !== data.previousStatus) {
      AnnouncementService.announce(
        `System health changed to ${data.overallStatus}`,
        data.overallStatus === 'online' ? 'info' : 
        data.overallStatus === 'degraded' ? 'warning' : 'error'
      );
    }
    
    // Announce component status changes if they exist
    if (data.componentChanges && data.componentChanges.length > 0) {
      for (const component of data.componentChanges) {
        AnnouncementService.announce(
          `${component.name} health changed to ${component.status}`,
          component.status === 'online' ? 'info' : 
          component.status === 'degraded' ? 'warning' : 'error',
          { priority: 'low' }
        );
      }
    }
  }
}

/**
 * Handle configuration updates
 * @private
 * @param {Object} data - Configuration update data
 */
function handleConfigUpdate(data) {
  if (!_initialized) return;
  
  // If accessibility configuration was updated
  if (data.path === 'accessibility') {
    _config = { ..._config, ...data.config };
    applyConfig();
  }
}

/**
 * Apply current configuration to all modules
 * @private
 */
function applyConfig() {
  for (const [key, moduleConfig] of Object.entries(_config.modules)) {
    const module = _modules[key];
    if (module?.initialized) {
      // Update enabled state if it changed
      if (moduleConfig.enabled !== undefined && module.enabled !== moduleConfig.enabled) {
        module.instance.setEnabled(moduleConfig.enabled);
        module.enabled = moduleConfig.enabled;
      }
      
      // Update other module-specific settings
      if (moduleConfig.options) {
        if (typeof module.instance.updateConfig === 'function') {
          module.instance.updateConfig(moduleConfig.options);
        }
      }
    }
  }
}

/**
 * Get array of currently enabled accessibility modules
 * @returns {Array} - Array of enabled module names
 */
export function getEnabledModules() {
  if (!_initialized) return [];
  
  const enabled = [];
  for (const [key, module] of Object.entries(_modules)) {
    if (module.enabled) {
      enabled.push(key);
    }
  }
  return enabled;
}

/**
 * Enable or disable a specific accessibility feature
 * @param {string} moduleKey - Key of the module to control
 * @param {boolean} enable - Whether to enable the module
 * @param {Object} [options] - Additional options for the module
 * @returns {boolean} - Success status
 */
export function toggleFeature(moduleKey, enable, options = {}) {
  if (!_initialized) return false;
  
  const module = _modules[moduleKey];
  if (!module || !module.initialized) {
    logger.warn(`Cannot toggle ${moduleKey} - module not initialized`);
    return false;
  }
  
  try {
    // Enable/disable the module
    const success = module.instance.setEnabled(enable, options);
    
    if (success) {
      module.enabled = enable;
      
      // Update config
      _config.modules[moduleKey] = { 
        ..._config.modules[moduleKey],
        enabled: enable,
        ...(options ? { options } : {})
      };
      
      // Save config
      ConfigManager.save('accessibility', _config);
      
      // Publish event
      EventBus.publish('accessibility:featureToggled', {
        feature: moduleKey,
        enabled: enable
      });
      
      // Announce the change
      if (_modules.announcements?.enabled) {
        AnnouncementService.announce(
          `${module.name} ${enable ? 'enabled' : 'disabled'}`,
          'info'
        );
      }
      
      logger.info(`${module.name} ${enable ? 'enabled' : 'disabled'}`);
      return true;
    } else {
      logger.warn(`Failed to ${enable ? 'enable' : 'disable'} ${module.name}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error toggling ${module.name}`, error);
    return false;
  }
}

/**
 * Toggle all accessibility features on or off
 * @param {boolean} enable - Whether to enable all features
 * @returns {boolean} - Success status (true if all succeeded)
 */
export function toggleAllFeatures(enable) {
  if (!_initialized) return false;
  
  let allSucceeded = true;
  
  for (const [key, module] of Object.entries(_modules)) {
    if (module.initialized) {
      const success = toggleFeature(key, enable);
      if (!success) allSucceeded = false;
    }
  }
  
  return allSucceeded;
}

/**
 * Get full accessibility state for all modules
 * @returns {Object} - State of all accessibility modules
 */
export function getFullState() {
  if (!_initialized) {
    return { initialized: false };
  }
  
  const state = {
    initialized: true,
    enabledModules: getEnabledModules(),
    modules: {}
  };
  
  for (const [key, module] of Object.entries(_modules)) {
    if (module.initialized && typeof module.instance.getState === 'function') {
      state.modules[key] = module.instance.getState();
    } else {
      state.modules[key] = {
        initialized: module.initialized,
        enabled: module.enabled
      };
    }
  }
  
  return state;
}

/**
 * Announce an accessibility message
 * @param {string} message - Message to announce
 * @param {string} type - Announcement type
 * @param {Object} [options] - Additional options
 * @returns {boolean} - Success status
 */
export function announce(message, type = 'info', options = {}) {
  if (!_initialized || !_modules.announcements?.enabled) {
    return false;
  }
  
  return AnnouncementService.announce(message, type, options);
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) return;
  
  logger.info('Cleaning up Accessibility Manager');
  
  try {
    // Clean up all modules in reverse initialization order
    const moduleKeys = Object.keys(_modules).reverse();
    
    for (const key of moduleKeys) {
      const module = _modules[key];
      if (module.initialized) {
        logger.info(`Cleaning up ${module.name}`);
        try {
          module.instance.cleanup();
          _modules[key].initialized = false;
          _modules[key].enabled = false;
        } catch (error) {
          logger.error(`Error cleaning up ${module.name}`, error);
        }
      }
    }
    
    // Remove event listeners
    EventBus.unsubscribe('system:resourceUpdate', handleResourceUpdate);
    EventBus.unsubscribe('health:statusChanged', handleHealthStatusChange);
    EventBus.unsubscribe('config:updated', handleConfigUpdate);
    
    // Remove media query listeners
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.removeEventListener('change', detectSystemAccessibilitySettings);
    
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    contrastQuery.removeEventListener('change', detectSystemAccessibilitySettings);
    
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
    forcedColorsQuery.removeEventListener('change', detectSystemAccessibilitySettings);
    
    _initialized = false;
    
    EventBus.publish('accessibility:managerCleanup');
    logger.info('Accessibility Manager cleaned up');
  } catch (error) {
    logger.error('Error during Accessibility Manager cleanup', error);
  }
}
