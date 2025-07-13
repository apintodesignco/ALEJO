/**
 * Reasoning Engine Health Check Module
 * Provides health check functions for reasoning engine components
 */

import { Logger } from '../utils/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { AuditTrail } from '../utils/audit-trail.js';
import { EventBus } from '../events/event-bus.js';

const logger = new Logger('ReasoningEngineHealth');
const config = ConfigManager.getConfig('reasoning');
const auditTrail = new AuditTrail('reasoning-engine-health');

// Internal state
const _systemHealth = {
  status: 'unknown',
  components: {},
  lastCheck: null,
  initialized: false
};

/**
 * Initialize the reasoning engine health module
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initialize() {
  try {
    logger.info('Initializing reasoning engine health module');
    _systemHealth.initialized = true;
    _systemHealth.status = 'online';
    auditTrail.log('info', 'Reasoning engine health module initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize reasoning engine health module', error);
    auditTrail.log('error', 'Reasoning engine health module initialization failed', { error: error.message });
    _systemHealth.status = 'error';
    return false;
  }
}

/**
 * Perform health check of the logical reasoning system
 * @returns {Promise<Object>} Health check results
 */
export async function checkLogicalReasoningHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import logical reasoning module dynamically to avoid circular dependencies
    const logicalReasoning = await import('../reasoning/logical-reasoning.js')
      .catch(error => {
        logger.error('Failed to import logical reasoning module', error);
        return null;
      });
    
    if (!logicalReasoning) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load logical reasoning module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if logical reasoning is initialized
    const isInitialized = logicalReasoning.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Logical reasoning not initialized',
          recommendation: 'Initialize logical reasoning before using'
        }
      };
    }

    // Check for system resources
    const resourceStats = logicalReasoning.getResourceStats?.() || { sufficient: false };
    if (!resourceStats.sufficient) {
      return {
        status: 'degraded',
        details: {
          warning: 'Insufficient resources for optimal reasoning',
          recommendation: 'Consider reducing model complexity or increasing memory allocation',
          resources: resourceStats
        }
      };
    }

    // Check consistency validator
    const validatorStatus = logicalReasoning.checkConsistencyValidator?.() || { 
      operational: false 
    };
    
    if (!validatorStatus.operational) {
      return {
        status: 'degraded',
        details: {
          warning: 'Logical consistency validator not functioning properly',
          recommendation: 'Check validator initialization and rules database',
          validator: validatorStatus
        }
      };
    }

    // Test with simple reasoning task
    const testResult = await logicalReasoning.performSelfTest?.() || { passed: false };
    if (!testResult.passed) {
      return {
        status: 'error',
        details: {
          error: 'Reasoning engine failed basic reasoning test',
          recommendation: 'Check reasoning model and inference engine',
          test: testResult
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        modelVersion: logicalReasoning.getModelVersion?.() || 'unknown',
        accuracyScore: logicalReasoning.getAccuracyScore?.() || 'unknown',
        avgInferenceTime: logicalReasoning.getAverageInferenceTime?.() || 'unknown',
        lastUpdated: logicalReasoning.getLastUpdated?.() || null
      }
    };
  } catch (error) {
    logger.error('Error checking logical reasoning health', error);
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
 * Perform health check of the facts database
 * @returns {Promise<Object>} Health check results
 */
export async function checkFactsDatabaseHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import facts database module dynamically
    const factsDatabase = await import('../reasoning/facts-database.js')
      .catch(error => {
        logger.error('Failed to import facts database module', error);
        return null;
      });
    
    if (!factsDatabase) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load facts database module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if facts database is initialized
    const isInitialized = factsDatabase.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Facts database not initialized',
          recommendation: 'Initialize facts database before using'
        }
      };
    }

    // Check database accessibility
    const dbStatus = await factsDatabase.checkDatabaseStatus?.() || { 
      accessible: false 
    };
    
    if (!dbStatus.accessible) {
      return {
        status: 'error',
        details: {
          error: 'Facts database inaccessible',
          recommendation: 'Check database connection and permissions',
          dbStatus
        }
      };
    }

    // Check database integrity
    const integrityCheck = await factsDatabase.checkIntegrity?.() || { 
      intact: false, 
      issues: [] 
    };
    
    if (!integrityCheck.intact) {
      return {
        status: 'degraded',
        details: {
          warning: 'Facts database has integrity issues',
          recommendation: 'Consider running database repair or validation',
          integrity: integrityCheck
        }
      };
    }

    // Check facts recency
    const recencyStatus = factsDatabase.checkFactsRecency?.() || {
      recent: false,
      lastUpdate: null
    };
    
    if (!recencyStatus.recent) {
      return {
        status: 'degraded',
        details: {
          warning: 'Facts database content may be outdated',
          recommendation: 'Consider updating the facts database',
          recency: recencyStatus
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        factCount: await factsDatabase.getFactCount?.() || 0,
        categoryCoverage: factsDatabase.getCategoryCoverage?.() || [],
        lastUpdated: recencyStatus.lastUpdate,
        verifiedPercentage: factsDatabase.getVerifiedPercentage?.() || 0
      }
    };
  } catch (error) {
    logger.error('Error checking facts database health', error);
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
 * Perform health check of the fallacy detection system
 * @returns {Promise<Object>} Health check results
 */
export async function checkFallacyDetectionHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import fallacy detection module dynamically
    const fallacyDetection = await import('../reasoning/fallacy-detection.js')
      .catch(error => {
        logger.error('Failed to import fallacy detection module', error);
        return null;
      });
    
    if (!fallacyDetection) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load fallacy detection module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if fallacy detection is initialized
    const isInitialized = fallacyDetection.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Fallacy detection not initialized',
          recommendation: 'Initialize fallacy detection before using'
        }
      };
    }

    // Check model availability
    const modelsAvailable = fallacyDetection.checkModelsAvailable?.() || { available: false };
    if (!modelsAvailable.available) {
      return {
        status: 'error',
        details: {
          error: 'Fallacy detection models unavailable',
          recommendation: 'Check model files and initialization',
          models: modelsAvailable
        }
      };
    }

    // Test with known fallacies
    const testResult = await fallacyDetection.testDetection?.() || { accuracy: 0 };
    if (testResult.accuracy < 0.7) { // 70% accuracy threshold
      return {
        status: 'degraded',
        details: {
          warning: `Fallacy detection accuracy below threshold (${testResult.accuracy * 100}%)`,
          recommendation: 'Model may need retraining or tuning',
          test: testResult
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        modelVersion: fallacyDetection.getModelVersion?.() || 'unknown',
        detectionAccuracy: testResult.accuracy,
        supportedFallacyTypes: fallacyDetection.getSupportedFallacyTypes?.() || [],
        lastUpdated: fallacyDetection.getLastUpdated?.() || null
      }
    };
  } catch (error) {
    logger.error('Error checking fallacy detection health', error);
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
 * Get overall reasoning engine health status
 * @returns {Object} Health status object
 */
export function getHealthStatus() {
  return {
    ..._systemHealth,
    lastCheck: Date.now()
  };
}

/**
 * Clean up resources used by the reasoning engine health module
 */
export function cleanup() {
  _systemHealth.initialized = false;
  _systemHealth.status = 'unknown';
  logger.info('Reasoning engine health module cleaned up');
  EventBus.publish('reasoning:healthCleanup', { timestamp: Date.now() });
}
