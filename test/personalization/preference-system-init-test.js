/**
 * preference-system-init-test.js
 * 
 * Integration tests for the preference system initialization
 * including circuit breaker, caching, and normalization components.
 */
import { jest } from '@jest/globals';
import { initializePreferenceSystem } from '../../src/personalization/behavior/preference-system-init.js';
import { relationshipCircuitBreaker } from '../../src/utils/circuit-breaker.js';
import { relationshipCache, preferenceCache } from '../../src/utils/cache-manager.js';
import { getSchedulerStatus } from '../../src/personalization/behavior/preference-normalization-scheduler.js';
import { publish } from '../../core/event-bus.js';

// Mock dependencies
jest.mock('../../src/utils/audit-trail.js');
jest.mock('../../src/core/event-bus.js');
jest.mock('../../src/personalization/behavior/preference-normalization-scheduler.js');

describe('Preference System Initialization', () => {
  beforeEach(() => {
    // Reset mocks and components
    jest.clearAllMocks();
    relationshipCircuitBreaker.reset();
    relationshipCache.clear();
    preferenceCache.clear();
  });
  
  test('should initialize all components with default configuration', async () => {
    // Setup mocks
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    mockStartScheduler.mockResolvedValue(true);
    
    // Initialize the system
    const result = await initializePreferenceSystem();
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.status.circuitBreaker).toBe(true);
    expect(result.status.cache).toBe(true);
    expect(result.status.normalization).toBe(true);
    expect(result.status.eventListeners).toBe(true);
    
    // Verify circuit breaker was configured
    expect(relationshipCircuitBreaker.getStatus().failureThreshold).toBeDefined();
    
    // Verify caches were configured
    expect(relationshipCache.getStats().maxSize).toBeDefined();
    expect(preferenceCache.getStats().maxSize).toBeDefined();
    
    // Verify normalization scheduler was started
    expect(mockStartScheduler).toHaveBeenCalled();
    
    // Verify event was published
    const { publish } = require('../../src/core/event-bus.js');
    expect(publish).toHaveBeenCalledWith('preference:system:ready', expect.any(Object));
  });
  
  test('should use custom configuration when provided', async () => {
    // Setup custom config
    const customConfig = {
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeoutMs: 60000
      },
      cache: {
        relationship: {
          ttlMs: 1800000,
          maxSize: 500
        }
      },
      normalization: {
        intervalHours: 12,
        batchSize: 25
      }
    };
    
    // Setup mocks
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    mockStartScheduler.mockResolvedValue(true);
    
    // Initialize with custom config
    await initializePreferenceSystem(customConfig);
    
    // Verify normalization scheduler received custom config
    expect(mockStartScheduler).toHaveBeenCalledWith(expect.objectContaining({
      intervalHours: 12,
      batchSize: 25
    }));
  });
  
  test('should handle initialization errors gracefully', async () => {
    // Setup mock to throw error
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    mockStartScheduler.mockRejectedValue(new Error('Scheduler error'));
    
    // Initialize the system
    const result = await initializePreferenceSystem();
    
    // Verify result indicates failure
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    // Verify audit trail logged the error
    const { auditTrail } = require('../../src/utils/audit-trail.js');
    expect(auditTrail.log).toHaveBeenCalledWith(
      'preference:system:init:error',
      expect.objectContaining({
        error: expect.any(String)
      })
    );
  });
  
  test('should clean up resources when cleanup function is called', async () => {
    // Setup mocks
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    const mockStopScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').stopScheduler;
    mockStartScheduler.mockResolvedValue(true);
    mockStopScheduler.mockReturnValue(true);
    
    // Initialize the system
    const result = await initializePreferenceSystem();
    
    // Call cleanup function
    result.cleanup();
    
    // Verify scheduler was stopped
    expect(mockStopScheduler).toHaveBeenCalled();
    
    // Verify audit trail logged cleanup
    const { auditTrail } = require('../../src/utils/audit-trail.js');
    expect(auditTrail.log).toHaveBeenCalledWith(
      'preference:system:cleanup',
      expect.any(Object)
    );
  });
  
  test('should respond to user logout events by clearing cache', async () => {
    // Setup
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    mockStartScheduler.mockResolvedValue(true);
    
    // Initialize the system
    await initializePreferenceSystem();
    
    // Add some test data to caches
    relationshipCache.set('user123:entity1', { data: 'test' });
    preferenceCache.set('preference:user123:theme', 'dark');
    preferenceCache.set('preference_model:user123', { preferences: {} });
    
    // Simulate user logout event
    const { subscribe } = require('../../src/core/event-bus.js');
    const logoutHandler = subscribe.mock.calls.find(call => call[0] === 'user:logout')[1];
    logoutHandler({ userId: 'user123' });
    
    // Verify cache entries were cleared
    expect(relationshipCache.get('user123:entity1')).toBeUndefined();
    expect(preferenceCache.get('preference:user123:theme')).toBeUndefined();
    expect(preferenceCache.get('preference_model:user123')).toBeUndefined();
  });
  
  test('should respond to low memory warnings by reducing cache size', async () => {
    // Setup
    const mockStartScheduler = require('../../src/personalization/behavior/preference-normalization-scheduler.js').startScheduler;
    mockStartScheduler.mockResolvedValue(true);
    
    // Initialize the system with specific cache sizes
    await initializePreferenceSystem({
      cache: {
        relationship: { maxSize: 1000 },
        preference: { maxSize: 2000 }
      }
    });
    
    // Simulate low memory warning
    const { subscribe } = require('../../src/core/event-bus.js');
    const memoryWarningHandler = subscribe.mock.calls.find(call => call[0] === 'system:memory:warning')[1];
    memoryWarningHandler();
    
    // Verify cache sizes were reduced
    expect(relationshipCache.getStats().maxSize).toBe(500); // 50% of original
    expect(preferenceCache.getStats().maxSize).toBe(1000); // 50% of original
  });
});
