/**
 * Memory System Health Check Module
 * Provides health check functions for memory system components
 */

import { Logger } from '../utils/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { AuditTrail } from '../utils/audit-trail.js';
import { EventBus } from '../events/event-bus.js';

const logger = new Logger('MemorySystemHealth');
const config = ConfigManager.getConfig('memory');
const auditTrail = new AuditTrail('memory-system-health');

// Internal state
const _systemHealth = {
  status: 'unknown',
  components: {},
  lastCheck: null,
  initialized: false
};

/**
 * Initialize the memory system health module
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initialize() {
  try {
    logger.info('Initializing memory system health module');
    _systemHealth.initialized = true;
    _systemHealth.status = 'online';
    auditTrail.log('info', 'Memory system health module initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize memory system health module', error);
    auditTrail.log('error', 'Memory system health module initialization failed', { error: error.message });
    _systemHealth.status = 'error';
    return false;
  }
}

/**
 * Perform health check of the memory storage system
 * @returns {Promise<Object>} Health check results
 */
export async function checkMemoryStorageHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import memory storage module dynamically to avoid circular dependencies
    const memoryStorage = await import('../memory/memory-storage.js')
      .catch(error => {
        logger.error('Failed to import memory storage module', error);
        return null;
      });
    
    if (!memoryStorage) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load memory storage module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if memory storage is initialized
    const isInitialized = memoryStorage.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Memory storage not initialized',
          recommendation: 'Initialize memory storage before using'
        }
      };
    }

    // Check storage capacity and usage
    const storageStats = await memoryStorage.getStorageStats?.() || { 
      available: false, 
      used: 0, 
      total: 0 
    };
    
    if (!storageStats.available) {
      return {
        status: 'error',
        details: {
          error: 'Memory storage unavailable',
          recommendation: 'Check browser storage permissions and quota'
        }
      };
    }

    // Calculate storage usage percentage
    const usagePercent = storageStats.total > 0 
      ? Math.round((storageStats.used / storageStats.total) * 100) 
      : 0;

    // If storage is nearly full, return degraded status
    if (usagePercent > 85) {
      return {
        status: 'degraded',
        details: {
          warning: `Memory storage nearly full (${usagePercent}%)`,
          recommendation: 'Consider cleaning up old or unused memories',
          usageStats: storageStats
        }
      };
    }

    // Check recent read/write operations
    const operationsStatus = await memoryStorage.checkOperations?.() || { success: false };
    if (!operationsStatus.success) {
      return {
        status: 'degraded',
        details: {
          warning: 'Memory operations failing or slow',
          recommendation: 'Check for storage corruption or browser issues',
          operations: operationsStatus
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        storageType: memoryStorage.getStorageType?.() || 'unknown',
        usagePercent,
        memoryCount: await memoryStorage.getMemoryCount?.() || 0,
        lastSyncTime: memoryStorage.getLastSyncTime?.() || null
      }
    };
  } catch (error) {
    logger.error('Error checking memory storage health', error);
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
 * Perform health check of the memory indexing system
 * @returns {Promise<Object>} Health check results
 */
export async function checkMemoryIndexHealth() {
  if (!_systemHealth.initialized) {
    return { status: 'unknown' };
  }

  try {
    // Import memory index module dynamically
    const memoryIndex = await import('../memory/memory-index.js')
      .catch(error => {
        logger.error('Failed to import memory index module', error);
        return null;
      });
    
    if (!memoryIndex) {
      return {
        status: 'error',
        details: {
          error: 'Failed to load memory index module',
          recommendation: 'Check module imports and dependencies'
        }
      };
    }

    // Check if memory index is initialized
    const isInitialized = memoryIndex.isInitialized?.() || false;
    if (!isInitialized) {
      return {
        status: 'error',
        details: {
          error: 'Memory index not initialized',
          recommendation: 'Initialize memory index before using'
        }
      };
    }

    // Check index integrity
    const indexStatus = await memoryIndex.checkIndexIntegrity?.() || { intact: false };
    if (!indexStatus.intact) {
      return {
        status: 'degraded',
        details: {
          warning: 'Memory index integrity issues detected',
          recommendation: 'Consider rebuilding the memory index',
          integrity: indexStatus
        }
      };
    }

    // Check search performance
    const searchPerformance = await memoryIndex.benchmarkSearch?.() || { 
      performant: false,
      avgQueryTime: null
    };
    
    if (!searchPerformance.performant) {
      return {
        status: 'degraded',
        details: {
          warning: 'Memory search performance degraded',
          recommendation: 'Index may need optimization or rebuilding',
          performance: searchPerformance
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        indexedEntries: await memoryIndex.getIndexSize?.() || 0,
        lastReindexTime: memoryIndex.getLastReindexTime?.() || null,
        searchPerformance: searchPerformance.avgQueryTime || 'unknown'
      }
    };
  } catch (error) {
    logger.error('Error checking memory index health', error);
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
 * Get overall memory system health status
 * @returns {Object} Health status object
 */
export function getHealthStatus() {
  return {
    ..._systemHealth,
    lastCheck: Date.now()
  };
}

/**
 * Clean up resources used by the memory system health module
 */
export function cleanup() {
  _systemHealth.initialized = false;
  _systemHealth.status = 'unknown';
  logger.info('Memory system health module cleaned up');
  EventBus.publish('memory:healthCleanup', { timestamp: Date.now() });
}
