/**
 * @file announcement-service.js
 * @description Service for managing screen reader announcements
 * @module accessibility/announcement-service
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { EventBus } from '../core/events/event-bus.js';
import { Logger } from '../core/utils/logger.js';
import { ConfigManager } from '../core/system/config-manager.js';
import * as AriaManager from './aria-manager.js';

// Initialize logger
const logger = new Logger('AnnouncementService');

// Module state
let _initialized = false;
let _enabled = false;
let _config = null;

// Announcement queue and processing state
const _queue = [];
let _processing = false;
const _liveRegions = new Map();

// Announcement types and their default properties
const ANNOUNCEMENT_TYPES = {
  INFO: { 
    politeness: 'polite', 
    delay: 0, 
    prefix: '', 
    duration: 5000,
    priority: 1
  },
  SUCCESS: { 
    politeness: 'polite', 
    delay: 0, 
    prefix: 'Success: ', 
    duration: 5000,
    priority: 2
  },
  WARNING: { 
    politeness: 'assertive', 
    delay: 0, 
    prefix: 'Warning: ', 
    duration: 7000,
    priority: 3
  },
  ERROR: { 
    politeness: 'assertive', 
    delay: 0, 
    prefix: 'Error: ', 
    duration: 10000,
    priority: 4
  },
  STATUS: { 
    politeness: 'polite', 
    delay: 500, 
    prefix: 'Status: ', 
    duration: 5000,
    priority: 1
  },
  NAVIGATION: { 
    politeness: 'polite', 
    delay: 0, 
    prefix: 'Navigated to: ', 
    duration: 3000,
    priority: 2
  },
  PROGRESS: { 
    politeness: 'polite', 
    delay: 1000, 
    prefix: '', 
    duration: 3000,
    priority: 1
  },
  CRITICAL: { 
    politeness: 'assertive', 
    delay: 0, 
    prefix: 'Critical alert: ', 
    duration: 15000,
    priority: 5
  },
};

// Default configuration
const DEFAULT_CONFIG = {
  // Whether announcements are enabled
  enabled: true,
  // Default announcement type if not specified
  defaultType: 'INFO',
  // Whether to queue announcements to prevent overlap
  queueAnnouncements: true,
  // Maximum number of items in queue
  maxQueueLength: 10,
  // Default announcement politeness level
  defaultPoliteness: 'polite',
  // Delay between announcements in ms
  announcementDelay: 500,
  // Custom prefixes for announcement types
  customPrefixes: {},
  // Filter out duplicate announcements if identical and within this time window (ms)
  duplicateFilterWindow: 3000,
  // Types of announcements to suppress
  suppressedTypes: []
};

/**
 * Initialize the announcement service
 * @param {Object} config - Configuration options
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initialize(config = {}) {
  if (_initialized) {
    logger.warn('Announcement service already initialized');
    return true;
  }
  
  try {
    logger.info('Initializing announcement service');
    
    // Load saved config if available
    const savedConfig = await ConfigManager.load('accessibility.announcements');
    _config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    _enabled = _config.enabled;
    
    // Set up live regions for each politeness level
    createLiveRegions();
    
    // Set up event listeners
    setupEventListeners();
    
    _initialized = true;
    
    EventBus.publish('accessibility:announcementServiceInitialized', { enabled: _enabled });
    logger.info('Announcement service initialized successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize announcement service', error);
    return false;
  }
}

/**
 * Enable or disable announcements
 * @param {boolean} enable - Whether to enable announcements
 */
export function setEnabled(enable) {
  if (!_initialized) {
    return;
  }
  
  _enabled = enable;
  _config.enabled = enable;
  
  // Save the updated config
  ConfigManager.save('accessibility.announcements', _config);
  
  EventBus.publish('accessibility:announcementsToggled', { enabled: _enabled });
  logger.info(`Announcements ${enable ? 'enabled' : 'disabled'}`);
  
  if (enable) {
    announce('Screen reader announcements enabled', { type: 'INFO' });
  }
}

/**
 * Update configuration
 * @param {Object} config - New configuration
 */
export function updateConfig(config) {
  if (!_initialized) {
    return;
  }
  
  _config = { ...DEFAULT_CONFIG, ..._config, ...config };
  _enabled = _config.enabled;
  
  // Save the updated config
  ConfigManager.save('accessibility.announcements', _config);
  
  EventBus.publish('accessibility:announcementConfigUpdated', { config: _config });
}

/**
 * Make an announcement for screen readers
 * @param {string} message - The message to announce
 * @param {Object} [options] - Announcement options
 * @param {string} [options.type] - Announcement type (INFO, SUCCESS, WARNING, ERROR, etc.)
 * @param {string} [options.politeness] - Politeness level (polite or assertive)
 * @param {number} [options.delay] - Delay before announcing in milliseconds
 * @param {string} [options.prefix] - Prefix to add before the message
 * @param {number} [options.duration] - How long the announcement should remain in the live region
 * @param {number} [options.priority] - Priority level (higher numbers = higher priority)
 * @param {boolean} [options.skipQueue] - Whether to skip the queue and announce immediately
 * @returns {Promise<boolean>} - True if announcement successful or queued
 */
export async function announce(message, options = {}) {
  if (!_initialized || !_enabled || !message) {
    return false;
  }
  
  // Get announcement type configuration
  const type = options.type || _config.defaultType;
  const typeConfig = ANNOUNCEMENT_TYPES[type] || ANNOUNCEMENT_TYPES.INFO;
  
  // Check if this type is suppressed
  if (_config.suppressedTypes.includes(type)) {
    logger.debug(`Announcement of type ${type} suppressed: ${message}`);
    return false;
  }
  
  // Merge options with defaults
  const announcementOptions = {
    type,
    politeness: options.politeness || typeConfig.politeness || _config.defaultPoliteness,
    delay: options.delay !== undefined ? options.delay : typeConfig.delay,
    prefix: options.prefix !== undefined ? options.prefix : 
      (_config.customPrefixes[type] || typeConfig.prefix),
    duration: options.duration || typeConfig.duration,
    priority: options.priority !== undefined ? options.priority : typeConfig.priority,
    skipQueue: options.skipQueue || false,
    timestamp: Date.now()
  };
  
  // Filter duplicate announcements if they occur within the configured time window
  if (_config.duplicateFilterWindow > 0) {
    const recentDuplicate = _queue.find(item => 
      item.message === message && 
      (Date.now() - item.options.timestamp) < _config.duplicateFilterWindow
    );
    
    if (recentDuplicate) {
      logger.debug(`Filtered duplicate announcement: ${message}`);
      return false;
    }
  }
  
  // Prepare the announcement with prefix
  const fullMessage = `${announcementOptions.prefix}${message}`;
  
  // Check if we should queue or announce immediately
  if (_config.queueAnnouncements && !announcementOptions.skipQueue && (_processing || _queue.length > 0)) {
    return queueAnnouncement(fullMessage, announcementOptions);
  } else {
    return makeAnnouncement(fullMessage, announcementOptions);
  }
}

/**
 * Clear all pending announcements
 */
export function clearAnnouncements() {
  if (!_initialized) {
    return;
  }
  
  // Clear the queue
  _queue.length = 0;
  
  // Clear all live regions
  for (const region of _liveRegions.values()) {
    region.textContent = '';
  }
  
  _processing = false;
  
  logger.debug('Cleared all announcements');
}

/**
 * Get the announcement queue length
 * @returns {number} - Current queue length
 */
export function getQueueLength() {
  return _queue.length;
}

/**
 * Clean up and release resources
 */
export function cleanup() {
  if (!_initialized) {
    return;
  }
  
  logger.info('Cleaning up announcement service');
  
  try {
    // Clear announcements
    clearAnnouncements();
    
    // Remove event listeners
    removeEventListeners();
    
    // Remove live regions
    removeLiveRegions();
    
    _initialized = false;
    _enabled = false;
    
    EventBus.publish('accessibility:announcementServiceCleanup');
    logger.info('Announcement service cleaned up');
  } catch (error) {
    logger.error('Error during announcement service cleanup', error);
  }
}

/* Private Functions */

/**
 * Queue an announcement for later delivery
 * @private
 * @param {string} message - The message to announce
 * @param {Object} options - Announcement options
 * @returns {boolean} - True if announcement was queued
 */
function queueAnnouncement(message, options) {
  try {
    // Check if queue is full
    if (_queue.length >= _config.maxQueueLength) {
      // Remove lowest priority item
      const lowestPriorityIndex = _queue.reduce((lowest, item, index, array) => {
        return item.options.priority < array[lowest].options.priority ? index : lowest;
      }, 0);
      
      _queue.splice(lowestPriorityIndex, 1);
    }
    
    // Add to queue
    _queue.push({
      message,
      options
    });
    
    logger.debug(`Queued announcement: ${message}`);
    
    // Start processing if not already
    if (!_processing) {
      processQueue();
    }
    
    return true;
  } catch (error) {
    logger.error(`Error queuing announcement: ${message}`, error);
    return false;
  }
}

/**
 * Process the announcement queue
 * @private
 */
async function processQueue() {
  if (_queue.length === 0) {
    _processing = false;
    return;
  }
  
  _processing = true;
  
  try {
    // Sort by priority (higher first)
    _queue.sort((a, b) => b.options.priority - a.options.priority);
    
    // Get next announcement
    const next = _queue.shift();
    
    // Announce it
    await makeAnnouncement(next.message, next.options);
    
    // Wait for configured delay between announcements
    await new Promise(resolve => setTimeout(resolve, _config.announcementDelay));
    
    // Process next item
    processQueue();
  } catch (error) {
    logger.error('Error processing announcement queue', error);
    _processing = false;
  }
}

/**
 * Make an announcement
 * @private
 * @param {string} message - The message to announce
 * @param {Object} options - Announcement options
 * @returns {Promise<boolean>} - True if announcement successful
 */
async function makeAnnouncement(message, options) {
  try {
    // Wait for any configured delay
    if (options.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    
    // Get the appropriate live region
    const politeness = options.politeness || 'polite';
    const regionId = `live-region-${politeness}`;
    
    // Use AriaManager to update the live region
    if (!AriaManager.updateLiveRegion(regionId, message, true)) {
      // Fallback to direct DOM manipulation if AriaManager failed
      const region = _liveRegions.get(politeness);
      if (region) {
        region.textContent = message;
        
        // Clear after duration
        setTimeout(() => {
          if (region.textContent === message) {
            region.textContent = '';
          }
        }, options.duration || 5000);
      }
    }
    
    logger.debug(`Announced: ${message}`);
    
    // Emit event about the announcement
    EventBus.publish('accessibility:announcementMade', {
      message,
      type: options.type,
      politeness
    });
    
    return true;
  } catch (error) {
    logger.error(`Error making announcement: ${message}`, error);
    return false;
  }
}

/**
 * Create live regions for different politeness levels
 * @private
 */
function createLiveRegions() {
  // Create polite live region
  let politeRegion = document.getElementById('live-region-polite');
  if (!politeRegion) {
    politeRegion = AriaManager.createLiveRegion('live-region-polite', false) || createLiveRegionFallback('polite');
  }
  _liveRegions.set('polite', politeRegion);
  
  // Create assertive live region
  let assertiveRegion = document.getElementById('live-region-assertive');
  if (!assertiveRegion) {
    assertiveRegion = AriaManager.createLiveRegion('live-region-assertive', true) || createLiveRegionFallback('assertive');
  }
  _liveRegions.set('assertive', assertiveRegion);
  
  logger.debug('Live regions created');
}

/**
 * Create a live region without using AriaManager
 * @private
 * @param {string} politeness - Politeness level
 * @returns {HTMLElement} - The created live region element
 */
function createLiveRegionFallback(politeness) {
  const region = document.createElement('div');
  region.id = `live-region-${politeness}`;
  region.className = 'sr-only';
  region.setAttribute('aria-live', politeness);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('aria-relevant', 'additions text');
  
  document.body.appendChild(region);
  
  return region;
}

/**
 * Remove live regions
 * @private
 */
function removeLiveRegions() {
  for (const [politeness, region] of _liveRegions.entries()) {
    try {
      if (region && region.parentNode) {
        region.parentNode.removeChild(region);
      }
    } catch (error) {
      logger.error(`Error removing ${politeness} live region`, error);
    }
  }
  
  _liveRegions.clear();
  
  logger.debug('Live regions removed');
}

/**
 * Set up event listeners
 * @private
 */
function setupEventListeners() {
  // Listen for content update events
  EventBus.subscribe('accessibility:contentUpdated', handleContentUpdated);
  
  // Listen for focus change events
  EventBus.subscribe('accessibility:focusChanged', handleFocusChanged);
  
  // Listen for navigation events
  EventBus.subscribe('navigation:pathChanged', handleNavigationChanged);
  
  // Listen for error events
  EventBus.subscribe('system:error', handleSystemError);
  
  // Listen for health status events
  EventBus.subscribe('health:statusChanged', handleHealthStatusChanged);
  
  // Listen for resource usage events
  EventBus.subscribe('resources:thresholdExceeded', handleResourceThresholdExceeded);
}

/**
 * Remove event listeners
 * @private
 */
function removeEventListeners() {
  EventBus.unsubscribe('accessibility:contentUpdated', handleContentUpdated);
  EventBus.unsubscribe('accessibility:focusChanged', handleFocusChanged);
  EventBus.unsubscribe('navigation:pathChanged', handleNavigationChanged);
  EventBus.unsubscribe('system:error', handleSystemError);
  EventBus.unsubscribe('health:statusChanged', handleHealthStatusChanged);
  EventBus.unsubscribe('resources:thresholdExceeded', handleResourceThresholdExceeded);
}

/**
 * Handle content updated events
 * @private
 * @param {Object} data - Event data
 */
function handleContentUpdated(data) {
  if (!_enabled) return;
  
  const { content, role } = data;
  
  if (!content) return;
  
  // Determine announcement type based on role
  let type = 'INFO';
  if (role === 'alert') {
    type = 'WARNING';
  } else if (role === 'status') {
    type = 'STATUS';
  } else if (role === 'log') {
    type = 'INFO';
  }
  
  announce(content, { type });
}

/**
 * Handle focus change events
 * @private
 * @param {Object} data - Event data
 */
function handleFocusChanged(data) {
  if (!_enabled) return;
  
  const { label } = data;
  
  if (label) {
    announce(label, { 
      type: 'NAVIGATION',
      priority: 0, // Lower priority for focus announcements
      duration: 2000 // Shorter duration
    });
  }
}

/**
 * Handle navigation changes
 * @private
 * @param {Object} data - Event data
 */
function handleNavigationChanged(data) {
  if (!_enabled) return;
  
  const { path, title } = data;
  
  if (title) {
    announce(`${title}`, { 
      type: 'NAVIGATION',
      prefix: 'Navigated to: '
    });
  } else if (path) {
    // Extract a reasonable name from the path
    const pathParts = path.split('/');
    const lastPart = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || path;
    const formattedName = lastPart
      .replace(/[_-]/g, ' ')
      .replace(/\..*$/, '') // Remove file extension
      .trim();
    
    if (formattedName) {
      announce(formattedName, { 
        type: 'NAVIGATION',
        prefix: 'Navigated to: '
      });
    }
  }
}

/**
 * Handle system error events
 * @private
 * @param {Object} data - Event data
 */
function handleSystemError(data) {
  if (!_enabled) return;
  
  const { message, severity } = data;
  
  if (!message) return;
  
  // Determine announcement type based on severity
  let type = 'ERROR';
  if (severity === 'critical') {
    type = 'CRITICAL';
  } else if (severity === 'warning') {
    type = 'WARNING';
  }
  
  announce(message, { 
    type,
    skipQueue: severity === 'critical' // Skip queue for critical errors
  });
}

/**
 * Handle health status changed events
 * @private
 * @param {Object} data - Event data
 */
function handleHealthStatusChanged(data) {
  if (!_enabled) return;
  
  const { component, status, previousStatus } = data;
  
  // Only announce significant changes
  if (previousStatus === status) return;
  
  // Determine message based on status
  let message = '';
  let type = 'INFO';
  
  if (component) {
    // Component-specific status
    switch (status) {
      case 'error':
        message = `${component} has encountered an error`;
        type = 'ERROR';
        break;
      case 'degraded':
        message = `${component} performance is degraded`;
        type = 'WARNING';
        break;
      case 'offline':
        message = `${component} is offline`;
        type = 'WARNING';
        break;
      case 'online':
        if (previousStatus && previousStatus !== 'online') {
          message = `${component} is now online`;
          type = 'SUCCESS';
        }
        break;
    }
  } else {
    // Overall system status
    switch (status) {
      case 'error':
        message = 'System has encountered an error';
        type = 'ERROR';
        break;
      case 'degraded':
        message = 'System performance is degraded';
        type = 'WARNING';
        break;
      case 'offline':
        message = 'System is offline';
        type = 'WARNING';
        break;
      case 'online':
        if (previousStatus && previousStatus !== 'online') {
          message = 'System is now online';
          type = 'SUCCESS';
        }
        break;
    }
  }
  
  if (message) {
    announce(message, { type });
  }
}

/**
 * Handle resource threshold exceeded events
 * @private
 * @param {Object} data - Event data
 */
function handleResourceThresholdExceeded(data) {
  if (!_enabled) return;
  
  const { resource, currentValue, threshold, severity } = data;
  
  if (!resource) return;
  
  // Format a user-friendly message
  let message = '';
  let type = 'WARNING';
  
  switch (resource) {
    case 'cpu':
      message = `CPU usage ${Math.round(currentValue)}% exceeds ${Math.round(threshold)}% threshold`;
      break;
    case 'memory':
      message = `Memory usage ${Math.round(currentValue)}% exceeds ${Math.round(threshold)}% threshold`;
      break;
    case 'storage':
      message = `Storage usage ${Math.round(currentValue)}% exceeds ${Math.round(threshold)}% threshold`;
      break;
    case 'battery':
      message = `Battery level ${Math.round(currentValue)}% below ${Math.round(threshold)}% threshold`;
      break;
    case 'temperature':
      message = `System temperature high at ${Math.round(currentValue)}°C`;
      break;
    default:
      message = `${resource} usage exceeds configured threshold`;
  }
  
  // Adjust type based on severity
  if (severity === 'critical') {
    type = 'CRITICAL';
  } else if (severity === 'error') {
    type = 'ERROR';
  } else if (severity === 'info') {
    type = 'INFO';
  }
  
  announce(message, { type });
}
