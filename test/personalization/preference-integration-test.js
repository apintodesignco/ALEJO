/**
 * preference-integration-test.js
 * 
 * Integration tests for the preference model with circuit breaker, caching,
 * and normalization features.
 */
import { jest } from '@jest/globals';
import { observePreference, getPreference } from '../../src/personalization/behavior/preference-model.js';
import { getRelationshipContext } from '../../src/personalization/behavior/preference-relationship-integration.js';
import { relationshipCircuitBreaker } from '../../src/utils/circuit-breaker.js';
import { relationshipCache, preferenceCache } from '../../src/utils/cache-manager.js';
import { normalizePreferenceStrength } from '../../src/personalization/behavior/preference-normalization.js';

// Mock dependencies
jest.mock('../../src/core/integrations/python-bridge.js');
jest.mock('../../src/utils/audit-trail.js');
jest.mock('../../src/core/event-bus.js');

describe('Preference Model Integration', () => {
  beforeEach(() => {
    // Reset caches and circuit breaker before each test
    relationshipCache.clear();
    preferenceCache.clear();
    relationshipCircuitBreaker.reset();
    
    // Mock implementation for storage functions
    global.savePreferenceModel = jest.fn().mockResolvedValue(true);
    global.recordPreferenceChange = jest.fn().mockResolvedValue(true);
    global.loadPreferenceModel = jest.fn().mockResolvedValue(null);
    global.loadPreferenceHistory = jest.fn().mockResolvedValue([]);
  });
  
  test('observePreference should use cache for preference model', async () => {
    // Setup
    const userId = 'test-user-1';
    const key = 'favorite-color';
    const value = 'blue';
    
    // First call should miss cache
    await observePreference(userId, key, value);
    
    // Second call should hit cache
    await observePreference(userId, key, value);
    
    // Verify cache was used
    expect(preferenceCache.getStats().hits).toBeGreaterThan(0);
  });
  
  test('getRelationshipContext should use cache for relationship data', async () => {
    // Setup
    const userId = 'test-user-1';
    const entityId = 'test-entity-1';
    const mockRelationship = { affinity: 0.8, interactions: 5 };
    
    // Mock Python bridge to return relationship data
    const pythonBridge = require('../../src/core/integrations/python-bridge.js').PythonBridge.mock.instances[0];
    pythonBridge.callPython.mockResolvedValue(mockRelationship);
    
    // First call should miss cache
    const result1 = await getRelationshipContext(userId, entityId);
    
    // Second call should hit cache
    const result2 = await getRelationshipContext(userId, entityId);
    
    // Verify results and cache usage
    expect(result1).toEqual(mockRelationship);
    expect(result2).toEqual(mockRelationship);
    expect(pythonBridge.callPython).toHaveBeenCalledTimes(1);
    expect(relationshipCache.getStats().hits).toBe(1);
  });
  
  test('preference normalization should be applied during observation', async () => {
    // Setup
    const userId = 'test-user-1';
    const key = 'favorite-genre';
    const value = 'sci-fi';
    const mockStrength = 0.75;
    
    // Mock normalizePreferenceStrength
    const originalNormalize = normalizePreferenceStrength;
    normalizePreferenceStrength = jest.fn().mockReturnValue(mockStrength);
    
    // Observe preference
    await observePreference(userId, key, value, 'CONTENT', 'explicit', 0.9);
    
    // Verify normalization was called
    expect(normalizePreferenceStrength).toHaveBeenCalled();
    
    // Restore original function
    normalizePreferenceStrength = originalNormalize;
  });
  
  test('circuit breaker should prevent relationship calls when open', async () => {
    // Setup
    const userId = 'test-user-1';
    const entityId = 'test-entity-1';
    
    // Mock Python bridge to fail
    const pythonBridge = require('../../src/core/integrations/python-bridge.js').PythonBridge.mock.instances[0];
    pythonBridge.callPython.mockRejectedValue(new Error('Connection failed'));
    
    // Force circuit breaker to open
    relationshipCircuitBreaker.forceOpen();
    
    // Call should return empty object due to open circuit
    const result = await getRelationshipContext(userId, entityId);
    
    // Verify Python bridge was not called
    expect(result).toEqual({});
    expect(pythonBridge.callPython).not.toHaveBeenCalled();
  });
  
  test('getPreference should use specific item cache', async () => {
    // Setup
    const userId = 'test-user-1';
    const key = 'theme';
    const value = 'dark';
    
    // Seed the preference
    await observePreference(userId, key, value, 'UI', 'explicit', 0.9);
    
    // First get should cache the specific preference
    const result1 = await getPreference(userId, key);
    
    // Mock to verify we don't hit the model again
    global.getPreferenceModel = jest.fn();
    
    // Second get should use the item-specific cache
    const result2 = await getPreference(userId, key);
    
    // Verify results and that model wasn't loaded again
    expect(result1).toBe(value);
    expect(result2).toBe(value);
    expect(global.getPreferenceModel).not.toHaveBeenCalled();
  });
  
  test('integration of all components', async () => {
    // Setup
    const userId = 'test-user-1';
    const entityId = 'test-entity-1';
    const key = 'favorite-activity';
    const value = 'hiking';
    
    // Mock relationship context
    const mockRelationship = { affinity: 0.9, interactions: 10 };
    const pythonBridge = require('../../src/core/integrations/python-bridge.js').PythonBridge.mock.instances[0];
    pythonBridge.callPython.mockResolvedValue(mockRelationship);
    
    // Observe preference with entity context
    await observePreference(userId, key, value, 'ACTIVITIES', 'interaction', 0.8, 0.01, { entityId });
    
    // Verify cache was populated
    expect(relationshipCache.has(`${userId}:${entityId}`)).toBe(true);
    expect(preferenceCache.has(`preference_model:${userId}`)).toBe(true);
    
    // Get the preference and verify it was normalized and stored
    const storedPreference = await getPreference(userId, key);
    expect(storedPreference).toBe(value);
    
    // Verify Python bridge was called exactly once despite multiple operations
    expect(pythonBridge.callPython).toHaveBeenCalledTimes(1);
  });
});
