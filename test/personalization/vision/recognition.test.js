/**
 * ALEJO Vision Recognition Module Tests
 * 
 * This test suite validates the functionality of the vision recognition module,
 * including face identification, verification, expression analysis, and security integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as recognition from '../../../src/personalization/vision/recognition.js';

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
    })),
    FaceMatcher: vi.fn().mockImplementation(() => ({
      findBestMatch: vi.fn().mockReturnValue({
        label: 'test-user',
        distance: 0.4
      })
    }))
  }
}));

vi.mock('../../../src/personalization/vision/training.js', () => ({
  getModels: vi.fn().mockResolvedValue([
    {
      id: 'model1',
      userId: 'test-user',
      name: 'Test Model',
      descriptors: [new Float32Array(128).fill(0.5)],
      created: new Date().toISOString()
    }
  ])
}));

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
describe('Vision Recognition Module', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Clean up after each test
  afterEach(async () => {
    try {
      // End any active sessions
      const sessions = recognition.getActiveSessions();
      for (const sessionId of Object.keys(sessions)) {
        await recognition.endRecognitionSession({ sessionId });
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default options', async () => {
      const result = await recognition.initialize();
      expect(result).toBe(true);
      expect(recognition.isInitialized()).toBe(true);
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

      const result = await recognition.initialize(options);
      expect(result).toBe(true);
      expect(recognition.getConfig().userId).toBe('custom-user');
      expect(recognition.getConfig().modelPath).toBe('/custom/path');
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a dependency failure
      const securityMock = await import('../../../src/security/index.js');
      securityMock.initialize.mockRejectedValueOnce(new Error('Security initialization failed'));

      await expect(recognition.initialize()).rejects.toThrow('Vision recognition initialization failed');
    });

    it('should prevent duplicate initialization', async () => {
      await recognition.initialize();
      const consoleSpy = vi.spyOn(console, 'warn');
      await recognition.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
    });

    it('should create a new recognition session', async () => {
      const session = await recognition.startRecognitionSession({
        mode: 'identify',
        confidenceThreshold: 0.7
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.mode).toBe('identify');
      expect(session.confidenceThreshold).toBe(0.7);
    });

    it('should require proper permissions to start a session', async () => {
      // Mock permission denied
      const securityMock = await import('../../../src/security/index.js');
      securityMock.hasPermission.mockReturnValueOnce(false);

      await expect(recognition.startRecognitionSession({
        mode: 'identify'
      })).rejects.toThrow('Permission denied');
    });

    it('should end a recognition session', async () => {
      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      const result = await recognition.endRecognitionSession({
        sessionId: session.id
      });

      expect(result).toBe(true);
      expect(recognition.getActiveSessions()[session.id]).toBeUndefined();
    });

    it('should reject invalid session IDs', async () => {
      await expect(recognition.endRecognitionSession({
        sessionId: 'invalid-session'
      })).rejects.toThrow('Invalid session ID');
    });

    it('should track session statistics', async () => {
      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      // Process a frame to update statistics
      await recognition.processFrame({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const stats = recognition.getSessionStats(session.id);
      expect(stats).toBeDefined();
      expect(stats.framesProcessed).toBe(1);
      expect(stats.startTime).toBeDefined();
    });
  });

  describe('Face Recognition', () => {
    let sessionId;

    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
      const session = await recognition.startRecognitionSession({
        mode: 'identify',
        confidenceThreshold: 0.7
      });
      sessionId = session.id;
    });

    it('should process a frame and identify a face', async () => {
      const result = await recognition.processFrame({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.identified).toBe(true);
      expect(result.userId).toBe('test-user');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should verify a user identity', async () => {
      // Create a verification session
      const verifySession = await recognition.startRecognitionSession({
        mode: 'verify',
        userId: 'test-user',
        confidenceThreshold: 0.7
      });

      const result = await recognition.processFrame({
        sessionId: verifySession.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.verified).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle no face detected', async () => {
      // Mock no face detected
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.detectSingleFace.mockReturnValueOnce(null);

      const result = await recognition.processFrame({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.faceDetected).toBe(false);
      expect(result.identified).toBe(false);
    });

    it('should respect confidence threshold', async () => {
      // Create a session with high confidence threshold
      const highConfSession = await recognition.startRecognitionSession({
        mode: 'identify',
        confidenceThreshold: 0.1 // Very low to ensure match
      });

      // Mock a low confidence match
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.FaceMatcher.mockImplementationOnce(() => ({
        findBestMatch: vi.fn().mockReturnValue({
          label: 'test-user',
          distance: 0.9 // High distance = low confidence
        })
      }));

      const result = await recognition.processFrame({
        sessionId: highConfSession.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.faceDetected).toBe(true);
      expect(result.identified).toBe(false);
    });
  });

  describe('Expression Analysis', () => {
    let sessionId;

    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
      const session = await recognition.startRecognitionSession({
        mode: 'identify',
        analyzeExpressions: true
      });
      sessionId = session.id;
    });

    it('should analyze facial expressions', async () => {
      const result = await recognition.processFrame({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.expressions).toBeDefined();
      expect(result.expressions.dominant).toBe('neutral');
      expect(result.expressions.confidence).toBeGreaterThan(0);
      expect(result.expressions.all).toEqual(expect.objectContaining({
        neutral: expect.any(Number),
        happy: expect.any(Number)
      }));
    });

    it('should skip expression analysis when disabled', async () => {
      // Create a session with expressions disabled
      const noExprSession = await recognition.startRecognitionSession({
        mode: 'identify',
        analyzeExpressions: false
      });

      const result = await recognition.processFrame({
        sessionId: noExprSession.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result).toBeDefined();
      expect(result.expressions).toBeUndefined();
    });

    it('should track expression history', async () => {
      // Process multiple frames to build history
      await recognition.processFrame({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      // Mock a different expression
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.detectSingleFace.mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockResolvedValue({
            descriptor: new Float32Array(128).fill(0.5),
            detection: { box: { x: 100, y: 100, width: 100, height: 100 } }
          }),
          withFaceExpressions: vi.fn().mockResolvedValue({
            expressions: {
              neutral: 0.2,
              happy: 0.7,
              sad: 0.05,
              angry: 0.02,
              fearful: 0.01,
              disgusted: 0.01,
              surprised: 0.01
            }
          })
        })
      });

      await recognition.processFrame({
        sessionId,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      const history = recognition.getExpressionHistory(sessionId);
      expect(history).toBeDefined();
      expect(history.length).toBe(2);
      expect(history[0].dominant).toBe('neutral');
      expect(history[1].dominant).toBe('happy');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
    });

    it('should emit events on session start', async () => {
      const eventSpy = vi.fn();
      recognition.on('session_started', eventSpy);

      await recognition.startRecognitionSession({
        mode: 'identify'
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'identify'
      }));
    });

    it('should emit events on face recognition', async () => {
      const eventSpy = vi.fn();
      recognition.on('face_recognized', eventSpy);

      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      await recognition.processFrame({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user'
      }));
    });

    it('should emit events on session end', async () => {
      const eventSpy = vi.fn();
      recognition.on('session_ended', eventSpy);

      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      await recognition.endRecognitionSession({
        sessionId: session.id
      });

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: session.id
      }));
    });
  });

  describe('Security Integration', () => {
    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
    });

    it('should check permissions before operations', async () => {
      const securityMock = await import('../../../src/security/index.js');
      securityMock.hasPermission.mockClear();

      await recognition.startRecognitionSession({
        mode: 'identify'
      });

      expect(securityMock.hasPermission).toHaveBeenCalledWith('vision:recognition:identify');
    });

    it('should log security events', async () => {
      const securityMock = await import('../../../src/security/index.js');
      securityMock.logSecureEvent.mockClear();

      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      await recognition.processFrame({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(securityMock.logSecureEvent).toHaveBeenCalledWith(
        'vision:recognition:processed',
        expect.any(Object)
      );
    });

    it('should respect feature flags', async () => {
      const securityMock = await import('../../../src/security/index.js');
      securityMock.isFeatureAllowed.mockReturnValueOnce(false);

      const session = await recognition.startRecognitionSession({
        mode: 'identify',
        analyzeExpressions: true
      });

      const result = await recognition.processFrame({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      });

      expect(result.expressions).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
    });

    it('should handle missing parameters', async () => {
      await expect(recognition.startRecognitionSession({}))
        .rejects.toThrow('Mode is required');

      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      await expect(recognition.processFrame({
        sessionId: session.id
      })).rejects.toThrow('Video element is required');
    });

    it('should handle face detection errors', async () => {
      const faceApiMock = await import('@vladmandic/face-api');
      faceApiMock.default.detectSingleFace.mockImplementationOnce(() => {
        throw new Error('Detection failed');
      });

      const session = await recognition.startRecognitionSession({
        mode: 'identify'
      });

      await expect(recognition.processFrame({
        sessionId: session.id,
        videoElement: mockVideo,
        canvas: mockCanvas
      })).rejects.toThrow('Face detection failed');
    });

    it('should handle invalid session modes', async () => {
      await expect(recognition.startRecognitionSession({
        mode: 'invalid-mode'
      })).rejects.toThrow('Invalid recognition mode');
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      await recognition.initialize({ userId: 'test-user' });
    });

    it('should convert confidence score correctly', () => {
      // Distance of 0 = perfect match = confidence 1.0
      expect(recognition.distanceToConfidence(0)).toBe(1.0);
      
      // Distance of 1.0 = worst match = confidence 0.0
      expect(recognition.distanceToConfidence(1.0)).toBe(0.0);
      
      // Distance of 0.5 = confidence 0.5
      expect(recognition.distanceToConfidence(0.5)).toBe(0.5);
    });

    it('should get dominant expression correctly', () => {
      const expressions = {
        neutral: 0.2,
        happy: 0.7,
        sad: 0.05,
        angry: 0.02,
        fearful: 0.01,
        disgusted: 0.01,
        surprised: 0.01
      };
      
      const result = recognition.getDominantExpression(expressions);
      expect(result).toEqual({
        dominant: 'happy',
        confidence: 0.7,
        all: expressions
      });
    });
  });
});
