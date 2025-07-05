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
    beforeEach(() => {
      pythonBridge.callPython.mockReset();
    });

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

    test('should retry on failure before returning empty object', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      const expectedResult = { strength: 0.8, familiarity: 0.6 };
      
      // Mock failure on first attempt, success on second attempt
      pythonBridge.callPython
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(expectedResult);
        
      // Use a shorter retry delay for testing
      const options = { maxRetries: 1, retryDelay: 10 };
      
      // Act
      const result = await preferenceRelationshipIntegration.getRelationshipContext(userId, entityId, options);
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expectedResult);
    });

    test('should return empty object after all retries fail', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      
      // Mock multiple failures
      pythonBridge.callPython
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed again'));
      
      // Use a shorter retry delay for testing
      const options = { maxRetries: 1, retryDelay: 10 };
      
      // Act
      const result = await preferenceRelationshipIntegration.getRelationshipContext(userId, entityId, options);
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledTimes(2);
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
    beforeEach(() => {
      pythonBridge.callPython.mockReset();
      jest.spyOn(global, 'setTimeout').mockImplementation(callback => callback());
    });
    
    afterEach(() => {
      global.setTimeout.mockRestore();
    });
    
    it('should update relationship based on preference', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      const key = 'content:topic:science';
      const value = true;
      const strength = 0.7;
      
      pythonBridge.callPython.mockResolvedValue(true);
      
      // Act
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(userId, entityId, key, value, strength);
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledWith(
        'alejo.cognitive.memory.relationship_memory',
        'record_preference_interaction',
        expect.arrayContaining([userId, entityId])
      );
      expect(result).toBe(true);
    });
    
    it('should return false when entityId is missing', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = null;
      const key = 'content:topic:science';
      const value = true;
      const strength = 0.7;
      
      // Act
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(userId, entityId, key, value, strength);
      
      // Assert
      expect(pythonBridge.callPython).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should retry on temporary failure', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      const key = 'content:topic:science';
      const value = true;
      const strength = 0.7;
      
      // Mock failure on first attempt, success on second attempt
      pythonBridge.callPython
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(true);
      
      // Act - use custom options for faster testing
      const options = { maxRetries: 1, criticalUpdate: false };
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        userId, entityId, key, value, strength, options
      );
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });
    
    it('should handle errors from Python bridge after max retries', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      const key = 'content:topic:science';
      const value = true;
      const strength = 0.7;
      
      // Mock multiple failures
      pythonBridge.callPython
        .mockRejectedValueOnce(new Error('Python error'))
        .mockRejectedValueOnce(new Error('Python error again'));
      
      // Act - use custom options for faster testing
      const options = { maxRetries: 1, criticalUpdate: false };
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        userId, entityId, key, value, strength, options
      );
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledTimes(2);
      expect(result).toBe(false);
    });
    
    it('should attempt to queue critical updates when they fail', async () => {
      // Arrange
      const userId = 'user123';
      const entityId = 'entity456';
      const key = 'relationship:liked:person:entity456';
      const value = true;
      const strength = 0.8;
      
      // Mock the enqueue function
      const enqueueFailedRelationshipUpdateMock = jest.spyOn(
        preferenceRelationshipIntegration, 
        'enqueueFailedRelationshipUpdate'
      ).mockResolvedValue(true);
      
      // Ensure Python bridge always fails
      pythonBridge.callPython.mockRejectedValue(new Error('Persistent failure'));
      
      // Act - set as critical update
      const options = { maxRetries: 1, criticalUpdate: true };
      const result = await preferenceRelationshipIntegration.updateRelationshipFromPreference(
        userId, entityId, key, value, strength, options
      );
      
      // Assert
      expect(pythonBridge.callPython).toHaveBeenCalledTimes(2); // Original + 1 retry
      expect(result).toBe(false); // Still returns false as the immediate operation failed
      expect(enqueueFailedRelationshipUpdateMock).toHaveBeenCalledWith(
        userId, entityId, key, value, strength
      );
      
      // Clean up mock
      enqueueFailedRelationshipUpdateMock.mockRestore();
    });
  });
});
