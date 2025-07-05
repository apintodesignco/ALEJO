/**
 * Integration test for preference and relationship memory integration
 * Tests the full pipeline from preference observation to relationship updates
 */

const { observePreference, getPreferenceModel } = require('../../src/personalization/behavior/preference-model');
const { setupPythonBridge, teardownPythonBridge } = require('../utils/python-test-utils');

describe('Preference-Relationship Integration', () => {
  let pythonBridge;
  
  beforeAll(async () => {
    pythonBridge = await setupPythonBridge();
  });
  
  afterAll(async () => {
    await teardownPythonBridge(pythonBridge);
  });
  
  describe('End-to-End Preference Observation with Relationship Context', () => {
    const TEST_USER_ID = 'test_integration_user';
    const TEST_ENTITY_ID = 'test_entity_123';
    
    beforeEach(async () => {
      // Clear test user preferences and relationships
      await pythonBridge.callPython(
        'tests.utils.test_data_cleanup',
        'clear_test_preferences_and_relationships',
        [TEST_USER_ID, TEST_ENTITY_ID]
      );
    });
    
    test('should adjust preference strength based on relationship context', async () => {
      // 1. First establish a relationship
      await pythonBridge.callPython(
        'alejo.cognitive.memory.relationship_memory',
        'record_interaction',
        [
          TEST_USER_ID, 
          TEST_ENTITY_ID,
          'positive_interaction',
          'User engaged positively with entity',
          0.7, // sentiment
          0.8, // importance
          { test: 'setup relationship' }
        ]
      );
      
      // 2. Observe preference with relationship context
      await observePreference(
        TEST_USER_ID,
        'content:topic:science',
        true,
        'CONTENT',
        'interaction',
        0.5, // baseline strength
        0.01, // decay rate
        { entityId: TEST_ENTITY_ID }
      );
      
      // 3. Get resulting preference
      const preferenceModel = await getPreferenceModel(TEST_USER_ID);
      expect(preferenceModel.preferences['content:topic:science']).toBeDefined();
      
      // The strength should be adjusted based on relationship
      // Exact value depends on integration code, but should be different from 0.5
      expect(preferenceModel.preferences['content:topic:science'].strength).not.toEqual(0.5);
      
      // 4. Verify relationship memory was updated
      const relationshipData = await pythonBridge.callPython(
        'alejo.cognitive.memory.relationship_memory',
        'get_relationship',
        [TEST_USER_ID, TEST_ENTITY_ID]
      );
      
      // Check for interaction records related to preference
      const interactions = relationshipData.interactions || [];
      const hasPreferenceInteraction = interactions.some(
        interaction => interaction.type === 'preference_update'
      );
      
      expect(hasPreferenceInteraction).toBe(true);
    });
    
    test('should handle failures in relationship lookups gracefully', async () => {
      // 1. Temporarily break the Python bridge to simulate failure
      const originalCallPython = pythonBridge.callPython;
      let callCount = 0;
      
      // Mock to fail only relationship calls but allow preference operations
      pythonBridge.callPython = jest.fn((module, func, args) => {
        if (module.includes('relationship_memory')) {
          callCount++;
          if (callCount <= 2) { // Fail the first two relationship calls
            return Promise.reject(new Error('Simulated relationship service failure'));
          }
        }
        return originalCallPython(module, func, args);
      });
      
      // 2. Observe preference - should work despite relationship failures
      await observePreference(
        TEST_USER_ID,
        'content:topic:travel',
        true,
        'CONTENT',
        'interaction',
        0.6, // baseline strength
        0.01, // decay rate
        { entityId: TEST_ENTITY_ID }
      );
      
      // 3. Get resulting preference - should still be saved
      const preferenceModel = await getPreferenceModel(TEST_USER_ID);
      expect(preferenceModel.preferences['content:topic:travel']).toBeDefined();
      
      // 4. Restore original function
      pythonBridge.callPython = originalCallPython;
    });
    
    test('should measure performance metrics during preference observation', async () => {
      // 1. Spy on the auditTrail.log function
      const auditTrailModule = require('../../src/utils/audit-trail');
      const logSpy = jest.spyOn(auditTrailModule.auditTrail, 'log');
      
      // 2. Observe preference with relationship context
      await observePreference(
        TEST_USER_ID,
        'content:category:entertainment',
        true,
        'CONTENT',
        'interaction',
        0.7, // baseline strength
        0.01, // decay rate
        { entityId: TEST_ENTITY_ID }
      );
      
      // 3. Verify performance metrics were logged
      expect(logSpy).toHaveBeenCalledWith(
        'preferences:performance',
        expect.objectContaining({
          userId: TEST_USER_ID,
          key: 'content:category:entertainment',
          totalTime: expect.any(Number),
          relationshipLookupTime: expect.any(Number),
          decayCalculationTime: expect.any(Number),
          dbOperationsTime: expect.any(Number)
        })
      );
      
      // 4. Restore original function
      logSpy.mockRestore();
    });
  });
});
