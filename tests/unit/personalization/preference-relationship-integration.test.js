/**
 * Unit tests for preference-relationship integration
 */
import { jest } from '@jest/globals';
import * as preferenceRelationshipIntegration from '../../../src/personalization/behavior/preference-relationship-integration.js';
import { pythonBridge } from '../../../src/utils/python-bridge.js';

// Mock the Python bridge
jest.mock('../../../src/utils/python-bridge.js', () => ({
  pythonBridge: {
    callPython: jest.fn()
  }
}));

describe('Preference-Relationship Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getRelationshipContext', () => {
    it('should return relationship context data when available', async () => {
      // Mock data
      const mockRelationshipData = {
        entity_id: 'entity123',
        entity_type: 'person',
        name: 'John Doe',
        strength: 0.75,
        sentiment: 0.6,
        last_interaction: '2025-07-03T12:00:00Z',
        interaction_patterns: [
          { type: 'sentiment_trend', value: 'positive', frequency: 0.8 }
        ]
      };

      // Setup mock
      pythonBridge.callPython.mockResolvedValue(mockRelationshipData);

      // Call function
      const result = await preferenceRelationshipIntegration.getRelationshipContext('user123', 'entity123');

      // Assertions
      expect(pythonBridge.callPython).toHaveBeenCalledWith(
        'alejo.cognitive.memory.relationship_memory',
        'get_relationship_context',
        ['user123', 'entity123']
      );
      expect(result).toEqual(mockRelationshipData);
    });

    it('should return empty object when error occurs', async () => {
      // Setup mock to throw error
      pythonBridge.callPython.mockRejectedValue(new Error('Connection failed'));

      // Call function
      const result = await preferenceRelationshipIntegration.getRelationshipContext('user123', 'entity123');

      // Assertions
      expect(result).toEqual({});
    });
  });

  describe('adjustPreferenceByRelationship', () => {
    it('should adjust preference strength based on relationship context', async () => {
      // Mock data
      const mockRelationshipData = {
        strength: 0.8,
        sentiment: 0.6,
        last_interaction: new Date().toISOString()
      };

      // Setup mock
      pythonBridge.callPython.mockResolvedValue(mockRelationshipData);

      // Call function
      const result = await preferenceRelationshipIntegration.adjustPreferenceByRelationship('user123', 'entity123', 0.5);

      // Assertions
      expect(pythonBridge.callPython).toHaveBeenCalled();
      expect(result).toBeGreaterThan(0.5); // Strength should be increased due to positive relationship
      expect(result).toBeLessThanOrEqual(1.0); // Should be capped at 1.0
    });

    it('should return base strength when no relationship data exists', async () => {
      // Setup mock
      pythonBridge.callPython.mockResolvedValue(null);

      // Call function
      const result = await preferenceRelationshipIntegration.adjustPreferenceByRelationship('user123', 'entity123', 0.5);

      // Assertions
      expect(result).toBe(0.5); // Should return the base strength
    });

    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      pythonBridge.callPython.mockRejectedValue(new Error('Connection failed'));

      // Call function
      const result = await preferenceRelationshipIntegration.adjustPreferenceByRelationship('user123', 'entity123', 0.5);

      // Assertions
      expect(result).toBe(0.5); // Should return the base strength on error
    });
  });

  describe('updateRelationshipFromPreference', () => {
    it('should update relationship data based on preference changes', async () => {
      // Setup mock
      pythonBridge.callPython.mockResolvedValue('memory123');

      // Call function
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        'user123', 
        'entity123', 
        'relationship:liked:person:John', 
        true, 
        0.8
      );

      // Assertions
      expect(pythonBridge.callPython).toHaveBeenCalledWith(
        'alejo.cognitive.memory.relationship_memory',
        'record_preference_interaction',
        expect.arrayContaining(['user123', 'entity123'])
      );
      expect(result).toBe(true);
    });

    it('should handle missing entity ID', async () => {
      // Call function with null entity ID
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        'user123', 
        null, 
        'relationship:liked:person:John', 
        true, 
        0.8
      );

      // Assertions
      expect(pythonBridge.callPython).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      pythonBridge.callPython.mockRejectedValue(new Error('Connection failed'));

      // Call function
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        'user123', 
        'entity123', 
        'relationship:liked:person:John', 
        true, 
        0.8
      );

      // Assertions
      expect(result).toBe(false);
    });
  });
});
