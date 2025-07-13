/**
 * Vision System Health Check Module
 * Provides health check functions for vision system components
 */

import { Logger } from '../utils/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { AuditTrail } from '../utils/audit-trail.js';

const logger = new Logger('VisionSystemHealth');
const config = ConfigManager.getConfig('vision');
const auditTrail = new AuditTrail('vision-system-health');

// Internal state
const _systemHealth = {
  status: 'unknown',
  components: {},
  lastCheck: null,
  initialized: false
};

/**
 * Initialize the vision system health module
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initialize() {
  try {
    logger.info('Initializing vision system health module');
    _systemHealth.initialized = true;
    _systemHealth.status = 'online';
    auditTrail.log('info', 'Vision system health module initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize vision system health module', error);
    auditTrail.log('error', 'Vision system health module initialization failed', { error: error.message });
    _systemHealth.status = 'error';
    return false;
  }
}

/**
 * Perform health check of the face recognition system
 * @returns {Promise<Object>} Health check results
 */
export async function checkFaceRecognitionHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import face recognition module dynamically to avoid circular dependencies
    const faceRecognition = await import('../vision/face-recognition.js')
      .catch(error => {
        logger.error('Failed to import face recognition module', error);
        return null;
      });
    
    if (!faceRecognition) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load face recognition module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if face recognition is initialized
    const isInitialized = faceRecognition.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Face recognition not initialized',
          recommendation: 'Initialize face recognition before using'
        }
      };
    }

    // Check model availability
    const modelsLoaded = faceRecognition.getLoadedModels?.() || [];
    if (!modelsLoaded.length) {
      return {
        status: 'degraded',
        details: {
          warning: 'No face recognition models loaded',
          recommendation: 'Load required models for face recognition'
        }
      };
    }

    // Check for recent detections (activity)
    const recentActivity = faceRecognition.getRecentActivity?.();
    const hasRecentActivity = recentActivity && (Date.now() - recentActivity.lastDetection < 86400000); // 24h

    return {
      status: 'healthy',
      details: {
        modelsLoaded,
        memoryUsage: faceRecognition.getMemoryUsage?.() || 'unknown',
        hasRecentActivity
      }
    };
  } catch (error) {
    logger.error('Error checking face recognition health', error);
    return {
      status: 'error',
      details: {
        error: error.message,
        stack: config.debug ? error.stack : undefined
      }
    };
  }
}

/**
 * Perform health check of the gesture recognition system
 * @returns {Promise<Object>} Health check results
 */
export async function checkGestureSystemHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import gesture system module dynamically to avoid circular dependencies
    const gestureSystem = await import('../vision/gesture-system.js')
      .catch(error => {
        logger.error('Failed to import gesture system module', error);
        return null;
      });
    
    if (!gestureSystem) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load gesture system module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if gesture system is initialized
    const isInitialized = gestureSystem.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Gesture system not initialized',
          recommendation: 'Initialize gesture system before using'
        }
      };
    }

    // Check for resources needed by gesture detection
    const hasRequiredResources = gestureSystem.hasRequiredResources?.() || false;
    if (!hasRequiredResources) {
      return {
        status: 'degraded',
        details: {
          warning: 'Gesture system missing required resources',
          recommendation: 'Check device capabilities and permissions'
        }
      };
    }

    // Check camera access
    const cameraAccess = await gestureSystem.checkCameraAccess?.().catch(() => false) || false;
    if (!cameraAccess) {
      return {
        status: 'degraded',
        details: {
          warning: 'Camera access unavailable for gesture detection',
          recommendation: 'Check camera permissions and connections'
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        supportedGestures: gestureSystem.getSupportedGestures?.() || [],
        performance: gestureSystem.getPerformanceStats?.() || { fps: 'unknown' },
        cameraAccess
      }
    };
  } catch (error) {
    logger.error('Error checking gesture system health', error);
    return {
      status: 'error',
      details: {
        error: error.message,
        stack: config.debug ? error.stack : undefined
      }
    };
  }
}

/**
 * Get overall vision system health status
 * @returns {Object} Health status object
 */
export function getHealthStatus() {
  return {
    ..._systemHealth,
    lastCheck: Date.now()
  };
}

/**
 * Clean up resources used by the vision system health module
 */
export function cleanup() {
  _systemHealth.initialized = false;
  _systemHealth.status = 'unknown';
  logger.info('Vision system health module cleaned up');
}
