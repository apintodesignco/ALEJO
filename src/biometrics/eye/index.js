/**
 * ALEJO Eye Tracking Integration Module
 * 
 * This module integrates the eye tracking processor with the main biometrics system.
 * It handles initialization, event management, and provides a clean interface for
 * the biometrics system to interact with eye tracking functionality.
 * 
 * @module biometrics/eye
 */

import eyeProcessor from './eye-processor';
import { publish, subscribe, unsubscribe } from '../../events';
import { getLogger } from '../../utils/logger';

const logger = getLogger('eye-tracking');

// Module state
let initialized = false;
let processing = false;
let config = {
  enabled: false,
  processingInterval: 50,
  debugMode: false,
  privacyMode: 'none',
  accessibility: {
    highContrastMode: false,
    largerTargets: false,
    slowerAnimations: false,
    voicePrompts: false,
    extraTime: false
  }
};

/**
 * Initialize the eye tracking module
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    logger.info('Initializing eye tracking module');
    
    // Update configuration
    config = {
      ...config,
      ...options
    };
    
    // Skip initialization if not enabled
    if (!config.enabled) {
      logger.info('Eye tracking disabled, skipping initialization');
      return true;
    }
    
    // Initialize eye processor
    const success = await eyeProcessor.initialize(config);
    
    if (!success) {
      logger.error('Failed to initialize eye processor');
      return false;
    }
    
    // Subscribe to biometrics system events
    subscribe('biometrics:start', handleBiometricsStart);
    subscribe('biometrics:stop', handleBiometricsStop);
    subscribe('biometrics:pause', handleBiometricsPause);
    subscribe('biometrics:resume', handleBiometricsResume);
    subscribe('biometrics:config:updated', handleConfigUpdate);
    
    // Subscribe to accessibility events
    subscribe('accessibility:settings:updated', handleAccessibilityUpdate);
    
    // Subscribe to privacy events
    subscribe('privacy:mode:updated', handlePrivacyUpdate);
    
    // Subscribe to calibration events
    subscribe('calibration:request:eye-tracking', handleCalibrationRequest);
    
    initialized = true;
    logger.info('Eye tracking module initialized successfully');
    
    // Publish initialization event
    publish('eye:module:initialized', {
      timestamp: Date.now(),
      config
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize eye tracking module', error);
    return false;
  }
}

/**
 * Start eye tracking processing
 * @returns {Promise<boolean>} - Success status
 */
export async function startProcessing() {
  if (!initialized) {
    logger.warn('Cannot start processing: eye tracking not initialized');
    return false;
  }
  
  if (!config.enabled) {
    logger.info('Eye tracking disabled, skipping processing');
    return true;
  }
  
  if (processing) {
    logger.warn('Eye tracking already processing');
    return true;
  }
  
  const success = eyeProcessor.startProcessing();
  
  if (success) {
    processing = true;
    logger.info('Eye tracking processing started');
  }
  
  return success;
}

/**
 * Stop eye tracking processing
 * @returns {Promise<boolean>} - Success status
 */
export async function stopProcessing() {
  if (!processing) {
    logger.info('Eye tracking not processing');
    return true;
  }
  
  const success = eyeProcessor.stopProcessing();
  
  if (success) {
    processing = false;
    logger.info('Eye tracking processing stopped');
  }
  
  return success;
}

/**
 * Pause eye tracking processing
 * @returns {Promise<boolean>} - Success status
 */
export async function pauseProcessing() {
  if (!processing) {
    logger.warn('Eye tracking not processing');
    return true;
  }
  
  const success = eyeProcessor.pauseProcessing();
  
  if (success) {
    processing = false;
    logger.info('Eye tracking processing paused');
  }
  
  return success;
}

/**
 * Resume eye tracking processing
 * @returns {Promise<boolean>} - Success status
 */
export async function resumeProcessing() {
  if (processing) {
    logger.warn('Eye tracking already processing');
    return true;
  }
  
  if (!config.enabled) {
    logger.info('Eye tracking disabled, skipping resume');
    return true;
  }
  
  const success = eyeProcessor.resumeProcessing();
  
  if (success) {
    processing = true;
    logger.info('Eye tracking processing resumed');
  }
  
  return success;
}

/**
 * Update eye tracking configuration
 * @param {Object} newConfig - New configuration options
 * @returns {boolean} - Success status
 */
export function updateConfig(newConfig) {
  if (!newConfig) {
    return false;
  }
  
  logger.info('Updating eye tracking configuration');
  
  // Update configuration
  config = {
    ...config,
    ...newConfig
  };
  
  // Update accessibility settings if provided
  if (newConfig.accessibility) {
    eyeProcessor.updateAccessibilitySettings(newConfig.accessibility);
  }
  
  // Update privacy mode if provided
  if (newConfig.privacyMode) {
    eyeProcessor.setPrivacyMode(newConfig.privacyMode);
  }
  
  // Handle enabled/disabled state change
  if (newConfig.hasOwnProperty('enabled')) {
    if (newConfig.enabled && !processing && initialized) {
      // Start processing if newly enabled
      eyeProcessor.startProcessing();
      processing = true;
    } else if (!newConfig.enabled && processing) {
      // Stop processing if newly disabled
      eyeProcessor.stopProcessing();
      processing = false;
    }
  }
  
  // Publish configuration update event
  publish('eye:config:updated', {
    timestamp: Date.now(),
    config
  });
  
  return true;
}

/**
 * Start eye tracking calibration
 * @param {Object} options - Calibration options
 * @returns {boolean} - Success status
 */
export function startCalibration(options = {}) {
  if (!initialized || !config.enabled) {
    logger.warn('Cannot start calibration: eye tracking not initialized or disabled');
    return false;
  }
  
  logger.info('Starting eye tracking calibration');
  return eyeProcessor.startCalibration(options);
}

/**
 * Cancel eye tracking calibration
 * @returns {boolean} - Success status
 */
export function cancelCalibration() {
  if (!initialized || !config.enabled) {
    logger.warn('Cannot cancel calibration: eye tracking not initialized or disabled');
    return false;
  }
  
  logger.info('Canceling eye tracking calibration');
  return eyeProcessor.cancelCalibration();
}

/**
 * Clean up eye tracking resources
 */
export function cleanup() {
  logger.info('Cleaning up eye tracking module');
  
  // Unsubscribe from events
  unsubscribe('biometrics:start', handleBiometricsStart);
  unsubscribe('biometrics:stop', handleBiometricsStop);
  unsubscribe('biometrics:pause', handleBiometricsPause);
  unsubscribe('biometrics:resume', handleBiometricsResume);
  unsubscribe('biometrics:config:updated', handleConfigUpdate);
  unsubscribe('accessibility:settings:updated', handleAccessibilityUpdate);
  unsubscribe('privacy:mode:updated', handlePrivacyUpdate);
  unsubscribe('calibration:request:eye-tracking', handleCalibrationRequest);
  
  // Clean up processor
  eyeProcessor.cleanup();
  
  // Reset state
  initialized = false;
  processing = false;
  
  logger.info('Eye tracking module cleaned up');
}

/**
 * Handle biometrics start event
 */
function handleBiometricsStart() {
  if (config.enabled) {
    startProcessing();
  }
}

/**
 * Handle biometrics stop event
 */
function handleBiometricsStop() {
  stopProcessing();
}

/**
 * Handle biometrics pause event
 */
function handleBiometricsPause() {
  pauseProcessing();
}

/**
 * Handle biometrics resume event
 */
function handleBiometricsResume() {
  if (config.enabled) {
    resumeProcessing();
  }
}

/**
 * Handle configuration update event
 * @param {Object} data - Configuration data
 */
function handleConfigUpdate(data) {
  if (data && data.eyeTracking) {
    updateConfig(data.eyeTracking);
  }
}

/**
 * Handle accessibility update event
 * @param {Object} data - Accessibility settings
 */
function handleAccessibilityUpdate(data) {
  if (data) {
    eyeProcessor.updateAccessibilitySettings(data);
  }
}

/**
 * Handle privacy update event
 * @param {Object} data - Privacy settings
 */
function handlePrivacyUpdate(data) {
  if (data && data.eyeTracking) {
    eyeProcessor.setPrivacyMode(data.eyeTracking);
  }
}

/**
 * Handle calibration request event
 * @param {Object} data - Calibration options
 */
function handleCalibrationRequest(data) {
  startCalibration(data);
}

// Export module interface
export default {
  initialize,
  startProcessing,
  stopProcessing,
  pauseProcessing,
  resumeProcessing,
  updateConfig,
  startCalibration,
  cancelCalibration,
  cleanup
};
