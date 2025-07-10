/**
 * @file index.js
 * @description Main entry point for the ALEJO system monitoring dashboard
 * @module core/system/dashboard
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  initDashboard, 
  showDashboard, 
  hideDashboard, 
  toggleDashboard, 
  updateDashboard,
  toggleHighContrastMode,
  getAccessibilityStatus
} from '../monitoring-dashboard.js';

import { 
  initializeResourceThresholdSection, 
  updateResourceThresholdSummary, 
  getResourceThresholds,
  setResourceThreshold,
  resetToDefaultThresholds
} from '../resource-threshold-section.js';

import { EventBus } from '../../event-bus.js';
import { Logger } from '../../logger.js';

// Initialize logger
const logger = new Logger('DashboardAPI');

// Get event bus instance
const eventBus = EventBus.getInstance();

/**
 * Initialize the system monitoring dashboard with accessibility features
 * 
 * @param {Object} options - Dashboard initialization options
 * @param {boolean} [options.autoShow=false] - Whether to show dashboard after initialization
 * @param {boolean} [options.prioritizeAccessibility=true] - Whether to prioritize accessibility features
 * @param {Object} [options.sections] - Dashboard sections to enable/disable
 * @param {boolean} [options.highContrast=false] - Initialize with high contrast mode
 * @returns {Object} Dashboard API object
 */
export async function initializeSystemDashboard(options = {}) {
  try {
    logger.info('Initializing system monitoring dashboard');
    
    const {
      autoShow = false,
      prioritizeAccessibility = true,
      sections = {},
      highContrast = false
    } = options;
    
    // Initialize main dashboard
    const dashboard = initDashboard({
      autoShow,
      sections
    });
    
    // Initialize resource threshold section
    await initializeResourceThresholdSection();
    
    // Apply high contrast if needed
    if (highContrast) {
      toggleHighContrastMode(true);
    }
    
    // Set up accessibility priority if enabled
    if (prioritizeAccessibility) {
      eventBus.emit('accessibility:priority', { enabled: true });
      logger.info('Accessibility prioritization enabled for dashboard');
    }
    
    logger.info('System monitoring dashboard initialized successfully');
    
    return getDashboardAPI();
  } catch (error) {
    logger.error('Failed to initialize system dashboard', error);
    throw error;
  }
}

/**
 * Get the dashboard API object
 * @returns {Object} Dashboard API object with all methods
 */
export function getDashboardAPI() {
  return {
    // Dashboard visibility controls
    show: showDashboard,
    hide: hideDashboard,
    toggle: toggleDashboard,
    
    // Dashboard content management
    update: updateDashboard,
    
    // Accessibility features
    toggleHighContrast: toggleHighContrastMode,
    getAccessibilityStatus,
    
    // Resource threshold management
    getResourceThresholds,
    setResourceThreshold,
    resetThresholds: resetToDefaultThresholds,
    updateThresholdSummary: updateResourceThresholdSummary,
    
    // Event-based integration
    onUpdate: (callback) => {
      eventBus.on('dashboard:updated', callback);
      return () => eventBus.off('dashboard:updated', callback);
    },
    
    onThresholdCrossing: (callback) => {
      eventBus.on('resource-threshold:crossed', callback);
      return () => eventBus.off('resource-threshold:crossed', callback);
    }
  };
}

// Export the initialization function as default
export default initializeSystemDashboard;
