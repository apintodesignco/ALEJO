/**
 * preference-system-init.js
 * 
 * Initializes and configures the preference system components including:
 * - Circuit breakers for external integrations
 * - Caching for performance optimization
 * - Normalization scheduling for preference consistency
 * - Event listeners for system events
 */
import { auditTrail } from '../../utils/audit-trail.js';
import { relationshipCircuitBreaker } from '../../utils/circuit-breaker.js';
import { relationshipCache, preferenceCache } from '../../utils/cache-manager.js';
import { startScheduler as startNormalizationScheduler } from './preference-normalization-scheduler.js';
import { publish, subscribe } from '../../core/event-bus.js';

// Default configuration
const DEFAULT_CONFIG = {
  // Circuit breaker configuration
  circuitBreaker: {
    resetTimeoutMs: 30000,         // 30 seconds
    failureThreshold: 5,           // 5 failures to open circuit
    successThreshold: 2,           // 2 successes to close circuit
    monitorIntervalMs: 60000       // Check status every minute
  },
  
  // Cache configuration
  cache: {
    relationship: {
      ttlMs: 3600000,              // 1 hour TTL for relationship context
      maxSize: 1000                // Maximum 1000 entries
    },
    preference: {
      ttlMs: 7200000,              // 2 hour TTL for preference data
      maxSize: 2000                // Maximum 2000 entries
    }
  },
  
  // Normalization configuration
  normalization: {
    intervalHours: 24,             // Run normalization daily
    runOnStartup: true,            // Run normalization on system startup
    batchSize: 50                  // Process 50 users per batch
  }
};

/**
 * Initialize the preference system with all components
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Initialization status
 */
export async function initializePreferenceSystem(config = {}) {
  const startTime = performance.now();
  const systemConfig = {
    circuitBreaker: { ...DEFAULT_CONFIG.circuitBreaker, ...(config.circuitBreaker || {}) },
    cache: { ...DEFAULT_CONFIG.cache, ...(config.cache || {}) },
    normalization: { ...DEFAULT_CONFIG.normalization, ...(config.normalization || {}) }
  };
  
  const status = {
    circuitBreaker: false,
    cache: false,
    normalization: false,
    eventListeners: false,
    duration: 0
  };
  
  try {
    // Initialize circuit breaker monitoring
    relationshipCircuitBreaker.configure({
      resetTimeoutMs: systemConfig.circuitBreaker.resetTimeoutMs,
      failureThreshold: systemConfig.circuitBreaker.failureThreshold,
      successThreshold: systemConfig.circuitBreaker.successThreshold
    });
    
    // Start circuit breaker monitoring
    const monitorInterval = setInterval(() => {
      const cbStatus = relationshipCircuitBreaker.getStatus();
      if (cbStatus.state !== 'CLOSED') {
        auditTrail.log('preference:circuit_breaker:status', cbStatus);
      }
    }, systemConfig.circuitBreaker.monitorIntervalMs);
    
    status.circuitBreaker = true;
    
    // Configure caches
    relationshipCache.configure({
      ttl: systemConfig.cache.relationship.ttlMs,
      maxSize: systemConfig.cache.relationship.maxSize
    });
    
    preferenceCache.configure({
      ttl: systemConfig.cache.preference.ttlMs,
      maxSize: systemConfig.cache.preference.maxSize
    });
    
    // Start cache maintenance
    relationshipCache.startMaintenance();
    preferenceCache.startMaintenance();
    
    status.cache = true;
    
    // Start normalization scheduler
    const normalizationStatus = await startNormalizationScheduler({
      intervalHours: systemConfig.normalization.intervalHours,
      runOnStartup: systemConfig.normalization.runOnStartup,
      batchSize: systemConfig.normalization.batchSize
    });
    
    status.normalization = normalizationStatus;
    
    // Set up event listeners
    setupEventListeners();
    status.eventListeners = true;
    
    // Calculate initialization duration
    status.duration = performance.now() - startTime;
    
    // Log successful initialization
    auditTrail.log('preference:system:initialized', {
      status,
      config: systemConfig,
      duration: status.duration
    });
    
    // Publish system ready event
    publish('preference:system:ready', { status });
    
    return {
      success: true,
      status,
      cleanup: () => cleanupPreferenceSystem(monitorInterval)
    };
  } catch (error) {
    console.error('Error initializing preference system:', error);
    auditTrail.log('preference:system:init:error', {
      error: error.message,
      stack: error.stack,
      status
    });
    
    return {
      success: false,
      status,
      error: error.message
    };
  }
}

/**
 * Set up event listeners for system events
 */
function setupEventListeners() {
  // Listen for user logout to clear their cache entries
  subscribe('user:logout', ({ userId }) => {
    if (userId) {
      // Clear user-specific cache entries
      const relationshipEntries = relationshipCache.getKeys().filter(key => key.startsWith(`${userId}:`));
      const preferenceEntries = preferenceCache.getKeys().filter(key => key.startsWith(`preference:${userId}:`) || 
                                                                key === `preference_model:${userId}`);
      
      // Remove entries
      relationshipEntries.forEach(key => relationshipCache.delete(key));
      preferenceEntries.forEach(key => preferenceCache.delete(key));
      
      auditTrail.log('preference:cache:user:cleared', {
        userId,
        relationshipEntriesCleared: relationshipEntries.length,
        preferenceEntriesCleared: preferenceEntries.length
      });
    }
  });
  
  // Listen for system shutdown to clean up resources
  subscribe('system:shutdown', () => {
    cleanupPreferenceSystem();
  });
  
  // Listen for low memory warnings to reduce cache size
  subscribe('system:memory:warning', () => {
    // Reduce cache sizes by 50%
    const relationshipStats = relationshipCache.getStats();
    const preferenceStats = preferenceCache.getStats();
    
    relationshipCache.configure({ maxSize: Math.floor(relationshipStats.maxSize / 2) });
    preferenceCache.configure({ maxSize: Math.floor(preferenceStats.maxSize / 2) });
    
    // Force pruning
    relationshipCache.prune();
    preferenceCache.prune();
    
    auditTrail.log('preference:cache:reduced', {
      relationshipCache: relationshipCache.getStats(),
      preferenceCache: preferenceCache.getStats()
    });
  });
}

/**
 * Clean up preference system resources
 * @param {number} monitorInterval - Circuit breaker monitor interval ID
 */
function cleanupPreferenceSystem(monitorInterval) {
  try {
    // Clear monitoring interval
    if (monitorInterval) {
      clearInterval(monitorInterval);
    }
    
    // Stop cache maintenance
    relationshipCache.stopMaintenance();
    preferenceCache.stopMaintenance();
    
    // Stop normalization scheduler
    import { stopScheduler } from './preference-normalization-scheduler.js';
    stopScheduler();
    
    auditTrail.log('preference:system:cleanup', {
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error during preference system cleanup:', error);
    auditTrail.log('preference:system:cleanup:error', {
      error: error.message,
      stack: error.stack
    });
  }
}
