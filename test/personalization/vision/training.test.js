/**
 * ALEJO Vision Training Module Tests
 * 
 * This test suite validates the functionality of the vision training module,
 * including model creation, sample processing, and security integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as training from '../../../src/personalization/vision/training.js';

// Mock dependencies
vi.mock('../../../src/security/index.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockReturnValue(true),
  logSecureEvent: vi.fn(),
  isFeatureAllowed: vi.fn().mockReturnValue(true)
}));

vi.mock('@vladmandic/face-api', () => ({
  default: {
    nets: {
      ssdMobilenetv1: { loadFromUri: vi.fn().mockResolvedValue(true) },
      faceLandmark68Net: { loadFromUri: vi.fn().mockResolvedValue(true) },
      faceRecognitionNet: { loadFromUri: vi.fn().mockResolvedValue(true) },
      faceExpressionNet: { loadFromUri: vi.fn().mockResolvedValue(true) }
    },
    detectSingleFace: vi.fn().mockReturnValue({
      withFaceLandmarks: vi.fn().mockReturnValue({
        withFaceDescriptor: vi.fn().mockResolvedValue({
          descriptor: new Float32Array(128).fill(0.5),
          detection: { box: { x: 100, y: 100, width: 100, height: 100 } }
        }),
        withFaceExpressions: vi.fn().mockResolvedValue({
          expressions: {
            neutral: 0.7,
            happy: 0.2,
            sad: 0.05,
            angry: 0.02,
            fearful: 0.01,
            disgusted: 0.01,
            surprised: 0.01
          }
        })
      })
    }),
    LabeledFaceDescriptors: vi.fn().mockImplementation((label, descriptors) => ({
      label,
      descriptors
    }))
  }
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock canvas and video elements
const mockCanvas = {
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    canvas: {
      width: 640,
      height: 480,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData')
    }
  })
};

const mockVideo = {
  videoWidth: 640,
  videoHeight: 480
};

// Test suite
describe('Vision Training Module', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  // Clean up after each test
  afterEach(async () => {
    try {
      // End any active sessions
      const sessions = training.getActiveSessions();
      for (const sessionId of Object.keys(sessions)) {
        await training.endTrainingSession({ sessionId });
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default options', async () => {
      const result = await training.initialize();
      expect(result).toBe(true);
      expect(training.isInitialized()).toBe(true);
    });

    it('should initialize with custom options', async () => {
      const options = {
        userId: 'custom-user',
        modelPath: '/custom/path',
        detectionOptions: {
          minConfidence: 0.8,
          maxResults: 5
        }
      };

      const result = await training.initialize(options);
      expect(result).toBe(true);
      expect(training.getConfig().userId).toBe('custom-user');
      expect(training.getConfig().modelPath).toBe('/custom/path');
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a dependency failure
      const securityMock = await import('../../../src/security/index.js');
      securityMock.initialize.mockRejectedValueOnce(new Error('Security initialization failed'));

      await expect(training.initialize()).rejects.toThrow('Vision training initialization failed');
    });

    it('should prevent duplicate initialization', async () => {
      await training.initialize();
      const consoleSpy = vi.spyOn(console, 'warn');
      await training.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
    });
  });

  describe('Training Session Management', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should create a new training session', async () => {
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session',
        sampleCount: 5
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('test-user');
      expect(session.name).toBe('Test Session');
      expect(session.sampleCount).toBe(5);
      expect(session.samples).toEqual([]);
    });

    it('should require proper permissions to start a session', async () => {
      // Mock permission denied
      const securityMock = await import('../../../src/security/index.js');
      securityMock.hasPermission.mockReturnValueOnce(false);

      await expect(training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      })).rejects.toThrow('Permission denied');
    });

    it('should end a training session', async () => {
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      const result = await training.endTrainingSession({
        sessionId: session.id
      });

      expect(result).toBe(true);
      expect(training.getActiveSessions()[session.id]).toBeUndefined();
    });

    it('should reject invalid session IDs', async () => {
      await expect(training.endTrainingSession({
        sessionId: 'invalid-session'
      })).rejects.toThrow('Invalid session ID');
    });

    it('should track session statistics', async () => {
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      // Process a sample to update statistics
      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const stats = training.getSessionStats(session.id);
      expect(stats).toBeDefined();
      expect(stats.samplesProcessed).toBe(1);
      expect(stats.startTime).toBeDefined();
    });
  });

  describe('Sample Processing', () => {
    let sessionId;

    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session',
        sampleCount: 5
      });
      sessionId = session.id;
    });

    it('should process a sample successfully', async () => {
      const result = await training.processSample({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sampleIndex).toBe(0);
      expect(result.descriptor).toBeDefined();
      expect(result.expressions).toBeDefined();
    });

    it('should handle no face detected', async () => {
      // Mock no face detected
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.detectSingleFace.mockReturnValueOnce(null);

      await expect(training.processSample({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      })).rejects.toThrow('No face detected');
    });

    it('should track multiple samples', async () => {
      // Process multiple samples
      for (let i = 0; i < 3; i++) {
        await training.processSample({
          sessionId,
          videoElement: mockVideo,
          canvas: mockCanvas
        });
      }

      const session = training.getActiveSessions()[sessionId];
      expect(session.samples.length).toBe(3);
    });

    it('should limit samples to the configured count', async () => {
      // Process more samples than the limit
      for (let i = 0; i < 6; i++) {
        try {
          await training.processSample({
            sessionId,
            videoElement: mockVideo,
            canvas: mockCanvas
          });
        } catch (error) {
          // Expected error on the 6th sample
          expect(error.message).toContain('Maximum sample count reached');
          break;
        }
      }

      const session = training.getActiveSessions()[sessionId];
      expect(session.samples.length).toBe(5);
    });
  });

  describe('Model Creation and Management', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should create a model from a completed training session', async () => {
      // Create and populate a session
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      // Add samples
      for (let i = 0; i < 3; i++) {
        await training.processSample({
          sessionId: session.id,
          videoElement: mockVideo,
          canvas: mockCanvas
        });
      }

      // Complete the session to create a model
      const model = await training.completeTrainingSession({
        sessionId: session.id
      });

      expect(model).toBeDefined();
      expect(model.id).toBeDefined();
      expect(model.userId).toBe('test-user');
      expect(model.name).toBe('Test Model');
      expect(model.descriptors.length).toBe(3);
    });

    it('should require minimum samples to create a model', async () => {
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model',
        minSamples: 3
      });

      // Add only one sample
      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      // Try to complete with insufficient samples
      await expect(training.completeTrainingSession({
        sessionId: session.id
      })).rejects.toThrow('Insufficient samples');
    });

    it('should list available models', async () => {
      // Create a model first
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      await training.completeTrainingSession({
        sessionId: session.id
      });

      // List models
      const models = await training.listModels({
        userId: 'test-user'
      });

      expect(models).toBeDefined();
      expect(models.length).toBe(1);
      expect(models[0].name).toBe('Test Model');
    });

    it('should delete a model', async () => {
      // Create a model first
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const model = await training.completeTrainingSession({
        sessionId: session.id
      });

      // Delete the model
      const result = await training.deleteModel({
        userId: 'test-user',
        modelId: model.id
      });

      expect(result).toBe(true);

      // Verify it's gone
      const models = await training.listModels({
        userId: 'test-user'
      });
      expect(models.length).toBe(0);
    });

    it('should export and import models', async () => {
      // Create a model first
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const originalModel = await training.completeTrainingSession({
        sessionId: session.id
      });

      // Export the model
      const exportedData = await training.exportModel({
        userId: 'test-user',
        modelId: originalModel.id
      });

      expect(exportedData).toBeDefined();
      expect(typeof exportedData).toBe('string');

      // Delete the original
      await training.deleteModel({
        userId: 'test-user',
        modelId: originalModel.id
      });

      // Import the model back
      const importedModel = await training.importModel({
        userId: 'test-user',
        modelData: exportedData
      });

      expect(importedModel).toBeDefined();
      expect(importedModel.name).toBe('Test Model');
      expect(importedModel.userId).toBe('test-user');

      // Verify it's in the list
      const models = await training.listModels({
        userId: 'test-user'
      });
      expect(models.length).toBe(1);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should emit events on session start', async () => {
      const eventSpy = vi.fn();
      training.on('session_started', eventSpy);

      await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user',
        name: 'Test Session'
      }));
    });

    it('should emit events on sample processing', async () => {
      const eventSpy = vi.fn();
      training.on('sample_processed', eventSpy);

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: session.id,
        sampleIndex: 0
      }));
    });

    it('should emit events on model creation', async () => {
      const eventSpy = vi.fn();
      training.on('model_created', eventSpy);

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const model = await training.completeTrainingSession({
        sessionId: session.id
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        modelId: model.id,
        userId: 'test-user'
      }));
    });

    it('should emit events on model deletion', async () => {
      const eventSpy = vi.fn();
      training.on('model_deleted', eventSpy);

      // Create a model first
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const model = await training.completeTrainingSession({
        sessionId: session.id
      });

      // Delete the model
      await training.deleteModel({
        userId: 'test-user',
        modelId: model.id
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        modelId: model.id,
        userId: 'test-user'
      }));
    });
  });

  describe('Security Integration', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should check permissions before operations', async () => {
      const securityMock = await import('../../../src/security/index.js');
      securityMock.hasPermission.mockClear();

      await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      expect(securityMock.hasPermission).toHaveBeenCalledWith('vision:training:create');
    });

    it('should log security events', async () => {
      const securityMock = await import('../../../src/security/index.js');
      securityMock.logSecureEvent.mockClear();

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(securityMock.logSecureEvent).toHaveBeenCalledWith(
        'vision:training:sample_processed',
        expect.any(Object)
      );
    });

    it('should prevent access to other users\' models', async () => {
      // Create a model for test-user
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const model = await training.completeTrainingSession({
        sessionId: session.id
      });

      // Try to access as different user
      const securityMock = await import('../../../src/security/index.js');
      securityMock.hasPermission.mockReturnValueOnce(true); // Allow the operation permission-wise

      await expect(training.getModel({
        userId: 'different-user',
        modelId: model.id
      })).rejects.toThrow('Access denied');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should handle missing parameters', async () => {
      await expect(training.startTrainingSession({}))
        .rejects.toThrow('User ID is required');

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await expect(training.processSample({
        sessionId: session.id
      })).rejects.toThrow('Video element is required');
    });

    it('should handle face detection errors', async () => {
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.detectSingleFace.mockImplementationOnce(() => {
        throw new Error('Detection failed');
      });

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await expect(training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      })).rejects.toThrow('Face detection failed');
    });

    it('should handle storage errors', async () => {
      // Mock localStorage failure
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });

      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Session'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      await expect(training.completeTrainingSession({
        sessionId: session.id
      })).rejects.toThrow('Failed to save model');
    });
  });

  describe('Model Storage', () => {
    beforeEach(async () => {
      await training.initialize({ userId: 'test-user' });
    });

    it('should store models in localStorage', async () => {
      // Create a model
      const session = await training.startTrainingSession({
        userId: 'test-user',
        sessionName: 'Test Model'
      });

      await training.processSample({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      await training.completeTrainingSession({
        sessionId: session.id
      });

      // Check localStorage was used
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const storageKey = mockLocalStorage.setItem.mock.calls[0][0];
      expect(storageKey).toContain('alejo_vision_model');
    });

    it('should handle model versioning', async () => {
      // Create two models with the same name
      for (let i = 0; i < 2; i++) {
        const session = await training.startTrainingSession({
          userId: 'test-user',
          sessionName: 'Test Model'
        });

        await training.processSample({
          sessionId: session.id,
          videoElement: mockVideo,
          canvas: mockCanvas
        });

        await training.completeTrainingSession({
          sessionId: session.id
        });
      }

      // List models
      const models = await training.listModels({
        userId: 'test-user'
      });

      // Should have two models with the same name but different IDs
      expect(models.length).toBe(2);
      expect(models[0].name).toBe('Test Model');
      expect(models[1].name).toBe('Test Model');
      expect(models[0].id).not.toBe(models[1].id);
    });
  });
});
