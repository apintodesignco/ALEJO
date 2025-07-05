/**
 * preference-system-e2e-test.js
 * 
 * End-to-end integration test for the preference system demonstrating
 * how all components work together in real-world scenarios.
 */
import { jest } from '@jest/globals';
import { initializePreferenceSystem } from '../../src/personalization/behavior/preference-system-init.js';
import { observePreference, getPreference } from '../../src/personalization/behavior/preference-model.js';
import { relationshipCircuitBreaker } from '../../src/utils/circuit-breaker.js';
import { relationshipCache, preferenceCache } from '../../src/utils/cache-manager.js';
import { normalizeAllPreferences } from '../../src/personalization/behavior/preference-normalization.js';
import { publish } from '../../core/event-bus.js';

// Mock dependencies
jest.mock('../../src/utils/audit-trail.js');
jest.mock('../../src/core/event-bus.js');
jest.mock('../../src/core/integrations/python-bridge.js');

describe('Preference System End-to-End', () => {
  let systemCleanup;
  const TEST_USER_ID = 'test-user-e2e';
  
  // Setup before all tests
  beforeAll(async () => {
    // Initialize the system with test configuration
    const initResult = await initializePreferenceSystem({
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeoutMs: 1000, // Short timeout for testing
        successThreshold: 1
      },
      cache: {
        relationship: {
          ttlMs: 5000, // 5 seconds for testing
          maxSize: 100
        },
        preference: {
          ttlMs: 5000,
          maxSize: 100
        }
      },
      normalization: {
        intervalHours: 24,
        runOnStartup: false
      }
    });
    
    systemCleanup = initResult.cleanup;
    
    // Mock storage functions
    global.savePreferenceModel = jest.fn().mockResolvedValue(true);
    global.recordPreferenceChange = jest.fn().mockResolvedValue(true);
    global.loadPreferenceModel = jest.fn().mockResolvedValue(null);
    global.loadPreferenceHistory = jest.fn().mockResolvedValue([]);
    
    // Mock Python bridge for relationship memory
    const pythonBridge = require('../../src/core/integrations/python-bridge.js').PythonBridge.mock.instances[0];
    pythonBridge.callPython.mockImplementation((module, func, args) => {
      if (func === 'get_relationship_context') {
        const [userId, entityId] = args;
        // Return mock relationship data
        return Promise.resolve({
          affinity: 0.8,
          interactions: 10,
          lastInteraction: Date.now() - 86400000, // 1 day ago
          categories: ['friend', 'colleague']
        });
      }
      return Promise.resolve({});
    });
  });
  
  // Cleanup after all tests
  afterAll(() => {
    if (systemCleanup) {
      systemCleanup();
    }
  });
  
  // Reset caches between tests
  beforeEach(() => {
    relationshipCache.clear();
    preferenceCache.clear();
    relationshipCircuitBreaker.reset();
    jest.clearAllMocks();
  });
  
  test('E2E: User preference learning with relationship context', async () => {
    // Scenario: User interacts with content from a friend
    const entityId = 'friend-123';
    const contentId = 'article-456';
    
    // 1. Observe initial preference from interaction
    await observePreference(
      TEST_USER_ID,
      `likes:${contentId}`,
      true,
      'CONTENT',
      'interaction',
      0.7,
      0.01, // Low decay rate
      { entityId, contentType: 'article', category: 'technology' }
    );
    
    // Verify preference was stored
    const pref1 = await getPreference(TEST_USER_ID, `likes:${contentId}`);
    expect(pref1).toBe(true);
    
    // Verify relationship cache was populated
    expect(relationshipCache.has(`${TEST_USER_ID}:${entityId}`)).toBe(true);
    
    // 2. Observe related preference with same entity
    await observePreference(
      TEST_USER_ID,
      'interest:technology',
      'high',
      'INTERESTS',
      'derived',
      0.6,
      0.005,
      { entityId, source: `likes:${contentId}` }
    );
    
    // Verify second preference was stored
    const pref2 = await getPreference(TEST_USER_ID, 'interest:technology');
    expect(pref2).toBe('high');
    
    // 3. Verify cache hits on subsequent retrievals
    const pythonBridge = require('../../src/core/integrations/python-bridge.js').PythonBridge.mock.instances[0];
    pythonBridge.callPython.mockClear();
    
    // This should use cache and not call Python bridge
    await observePreference(
      TEST_USER_ID,
      `likes:${contentId}`,
      true,
      'CONTENT',
      'reinforcement',
      0.8,
      0.01,
      { entityId }
    );
    
    // Verify Python bridge was not called again
    expect(pythonBridge.callPython).not.toHaveBeenCalled();
    
    // 4. Run normalization on the preferences
    const normalizedCount = await normalizeAllPreferences(TEST_USER_ID, 'CONTENT');
    expect(normalizedCount).toBeGreaterThan(0);
    
    // 5. Simulate circuit breaker opening
    pythonBridge.callPython.mockRejectedValue(new Error('Connection failed'));
    
    // Make enough failing calls to open the circuit
    try { await observePreference(TEST_USER_ID, 'test1', true, 'TEST', 'test', 0.5, 0.01, { entityId: 'entity1' }); } catch {}
    try { await observePreference(TEST_USER_ID, 'test2', true, 'TEST', 'test', 0.5, 0.01, { entityId: 'entity2' }); } catch {}
    try { await observePreference(TEST_USER_ID, 'test3', true, 'TEST', 'test', 0.5, 0.01, { entityId: 'entity3' }); } catch {}
    
    // Verify circuit breaker is open
    expect(relationshipCircuitBreaker.isOpen()).toBe(true);
    
    // 6. Verify system degrades gracefully with open circuit
    // This should still work but not call relationship memory
    await observePreference(
      TEST_USER_ID,
      'interest:science',
      'medium',
      'INTERESTS',
      'explicit',
      0.9,
      0.01,
      { entityId: 'entity4' }
    );
    
    // Preference should be stored despite relationship memory failure
    const pref3 = await getPreference(TEST_USER_ID, 'interest:science');
    expect(pref3).toBe('medium');
    
    // 7. Simulate user logout and verify cache clearing
    publish('user:logout', { userId: TEST_USER_ID });
    
    // Wait for event to process
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify caches were cleared for this user
    expect(preferenceCache.has(`preference_model:${TEST_USER_ID}`)).toBe(false);
    expect(relationshipCache.has(`${TEST_USER_ID}:${entityId}`)).toBe(false);
  });
  
  test('E2E: System handles high load with caching', async () => {
    // Setup: Create a bunch of preferences
    const startTime = performance.now();
    const iterations = 50;
    
    // Create preferences in a loop
    for (let i = 0; i < iterations; i++) {
      await observePreference(
        TEST_USER_ID,
        `pref:${i}`,
        `value:${i}`,
        'BENCHMARK',
        'test',
        0.5 + (i / iterations / 2), // Increasing strength
        0.01
      );
    }
    
    // Measure time for initial creation
    const initialTime = performance.now() - startTime;
    
    // Now retrieve them all (should be faster due to caching)
    const retrieveStartTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await getPreference(TEST_USER_ID, `pref:${i}`);
    }
    
    const retrieveTime = performance.now() - retrieveStartTime;
    
    // Verify retrieval was significantly faster than initial creation
    expect(retrieveTime).toBeLessThan(initialTime * 0.5);
    
    // Verify cache statistics show hits
    expect(preferenceCache.getStats().hits).toBeGreaterThan(iterations * 0.8);
  });
  
  test('E2E: Preference normalization maintains distribution', async () => {
    // Setup: Create preferences with extreme values
    await observePreference(TEST_USER_ID, 'extreme:1', 'high', 'DISTRIBUTION', 'test', 0.95);
    await observePreference(TEST_USER_ID, 'extreme:2', 'high', 'DISTRIBUTION', 'test', 0.92);
    await observePreference(TEST_USER_ID, 'extreme:3', 'high', 'DISTRIBUTION', 'test', 0.90);
    await observePreference(TEST_USER_ID, 'extreme:4', 'low', 'DISTRIBUTION', 'test', 0.15);
    await observePreference(TEST_USER_ID, 'extreme:5', 'low', 'DISTRIBUTION', 'test', 0.12);
    
    // Run normalization
    await normalizeAllPreferences(TEST_USER_ID, 'DISTRIBUTION');
    
    // Get the model directly to check normalized strengths
    const model = await global.getPreferenceModel(TEST_USER_ID);
    const preferences = model.preferences.DISTRIBUTION;
    
    // Calculate statistics
    const strengths = Object.values(preferences).map(p => p.strength);
    const sum = strengths.reduce((a, b) => a + b, 0);
    const mean = sum / strengths.length;
    
    // Verify mean is closer to target (0.5) after normalization
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
    
    // Verify no preference is at the extreme ends
    for (const strength of strengths) {
      expect(strength).toBeGreaterThan(0.2);
      expect(strength).toBeLessThan(0.8);
    }
  });
});
