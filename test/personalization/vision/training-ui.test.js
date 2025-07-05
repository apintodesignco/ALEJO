/**
 * ALEJO Vision Training UI Module Tests
 * 
 * This test suite validates the functionality of the vision training UI module,
 * including step navigation, camera handling, and training workflow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trainingUI } from '../../../src/personalization/vision/training-ui.js';

// Mock dependencies
vi.mock('../../../src/personalization/vision/face-model.js', () => ({
  faceModel: {
    initialize: vi.fn().mockResolvedValue(true),
    registerFace: vi.fn().mockResolvedValue({ id: 'mock-model-id' })
  }
}));

vi.mock('../../../src/personalization/vision/expression.js', () => ({
  expressionDetection: {
    initialize: vi.fn().mockResolvedValue(true),
    analyzeExpression: vi.fn().mockResolvedValue({
      dominant: 'neutral',
      confidence: 0.8,
      all: {
        neutral: 0.8,
        happy: 0.1,
        sad: 0.05,
        angry: 0.02,
        fearful: 0.01,
        disgusted: 0.01,
        surprised: 0.01
      }
    })
  }
}));

vi.mock('../../../src/security/consent-manager.js', () => ({
  consentManager: {
    requestConsent: vi.fn().mockResolvedValue(true),
    hasConsent: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../../../src/security/privacy-guard.js', () => ({
  privacyGuard: {
    encryptData: vi.fn(data => `encrypted_${data}`),
    decryptData: vi.fn(data => data.replace('encrypted_', ''))
  }
}));

vi.mock('../../../src/security/audit-trail.js', () => ({
  auditTrail: {
    log: vi.fn()
  }
}));

// Mock face-api global
global.faceapi = {
  detectAllFaces: vi.fn().mockResolvedValue([{ detection: { box: { x: 100, y: 100, width: 100, height: 100 } } }]),
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
  })
};

// Mock navigator.mediaDevices
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
};

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
};

// Mock DOM elements
const mockVideoElement = {
  srcObject: null,
  play: vi.fn().mockResolvedValue(undefined),
  videoWidth: 640,
  videoHeight: 480,
  onloadedmetadata: null
};

const mockCanvasElement = {
  width: 640,
  height: 480,
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    canvas: {
      width: 640,
      height: 480,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData')
    }
  })
};

// Test suite
describe('Vision Training UI Module', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset trainingUI state
    trainingUI.isInitialized = false;
    trainingUI.currentStep = 0;
    trainingUI.trainingData = {
      userId: null,
      faceCaptures: [],
      expressionCaptures: {},
      verificationResults: null
    };
    trainingUI.videoElement = null;
    trainingUI.canvasElement = null;
    trainingUI.stream = null;
  });

  // Clean up after each test
  afterEach(async () => {
    try {
      // Stop camera if it's running
      if (trainingUI.stream) {
        await trainingUI._stopCamera();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      expect(result).toBe(true);
      expect(trainingUI.isInitialized).toBe(true);
      expect(trainingUI.userId).toBe('test-user');
      expect(trainingUI.videoElement).toBe(mockVideoElement);
      expect(trainingUI.canvasElement).toBe(mockCanvasElement);
    });

    it('should emit initialized event', async () => {
      const eventSpy = vi.fn();
      trainingUI.on('initialized', eventSpy);
      
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Mock a dependency failure
      const faceModelMock = await import('../../../src/personalization/vision/face-model.js');
      faceModelMock.faceModel.initialize.mockRejectedValueOnce(new Error('Face model initialization failed'));

      await expect(trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement))
        .rejects.toThrow('Training UI initialization failed');
    });

    it('should prevent duplicate initialization', async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      
      const result = await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      expect(result).toBe(true); // Returns true but doesn't reinitialize
    });
  });

  describe('Training Process', () => {
    beforeEach(async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
    });

    it('should start training process', async () => {
      const eventSpy = vi.fn();
      trainingUI.on('training_started', eventSpy);
      
      await trainingUI.startTraining();
      
      expect(trainingUI.currentStep).toBe(0);
      expect(trainingUI.trainingData.userId).toBe('test-user');
      expect(eventSpy).toHaveBeenCalled();
      
      const auditTrailMock = await import('../../../src/security/audit-trail.js');
      expect(auditTrailMock.auditTrail.log).toHaveBeenCalledWith(
        'vision_training_started',
        expect.objectContaining({ userId: 'test-user' })
      );
    });

    it('should navigate between steps', async () => {
      await trainingUI.startTraining();
      
      const eventSpy = vi.fn();
      trainingUI.on('step_changed', eventSpy);
      
      await trainingUI.goToStep(1); // Go to camera setup step
      
      expect(trainingUI.currentStep).toBe(1);
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        stepIndex: 1,
        step: expect.objectContaining({ id: 'camera-setup' })
      }));
    });

    it('should reject invalid step indices', async () => {
      await trainingUI.startTraining();
      
      await expect(trainingUI.goToStep(-1)).rejects.toThrow('Invalid step index');
      await expect(trainingUI.goToStep(10)).rejects.toThrow('Invalid step index');
    });

    it('should process consent step', async () => {
      await trainingUI.startTraining();
      
      const eventSpy = vi.fn();
      trainingUI.on('consent_completed', eventSpy);
      
      await trainingUI._processConsentStep();
      
      const consentManagerMock = await import('../../../src/security/consent-manager.js');
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'face_recognition',
        expect.any(Object)
      );
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'expression_detection',
        expect.any(Object)
      );
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'face_model_creation',
        expect.any(Object)
      );
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Camera Handling', () => {
    beforeEach(async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      await trainingUI.startTraining();
    });

    it('should start camera', async () => {
      const eventSpy = vi.fn();
      trainingUI.on('camera_started', eventSpy);
      
      const result = await trainingUI._startCamera();
      
      expect(result).toBe(true);
      expect(trainingUI.stream).toBe(mockMediaStream);
      expect(mockVideoElement.srcObject).toBe(mockMediaStream);
      expect(mockVideoElement.play).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle camera start errors', async () => {
      // Mock getUserMedia failure
      global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Camera access denied'));
      
      const eventSpy = vi.fn();
      trainingUI.on('camera_error', eventSpy);
      
      await expect(trainingUI._startCamera()).rejects.toThrow('Camera initialization failed');
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Camera access denied')
      }));
    });

    it('should stop camera', async () => {
      await trainingUI._startCamera();
      
      const eventSpy = vi.fn();
      trainingUI.on('camera_stopped', eventSpy);
      
      const result = await trainingUI._stopCamera();
      
      expect(result).toBe(true);
      expect(mockMediaStream.getTracks).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockVideoElement.srcObject).toBeNull();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should capture frame from video', () => {
      trainingUI.stream = mockMediaStream;
      
      const canvas = trainingUI._captureFrame();
      
      expect(canvas).toBe(mockCanvasElement);
      expect(mockCanvasElement.getContext).toHaveBeenCalledWith('2d');
      expect(mockCanvasElement.getContext().drawImage).toHaveBeenCalledWith(
        mockVideoElement,
        0, 0,
        mockVideoElement.videoWidth,
        mockVideoElement.videoHeight
      );
    });

    it('should reject frame capture without camera', () => {
      trainingUI.stream = null;
      
      expect(() => trainingUI._captureFrame()).toThrow('Camera not initialized');
    });
  });

  describe('Step Processing', () => {
    beforeEach(async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      await trainingUI.startTraining();
    });

    it('should process camera setup step', async () => {
      await trainingUI.goToStep(1); // Camera setup step
      
      const eventSpy = vi.fn();
      trainingUI.on('camera_setup_completed', eventSpy);
      
      await trainingUI._processCameraSetupStep();
      
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        facesDetected: 1
      }));
    });

    it('should handle no face detected in camera setup', async () => {
      await trainingUI.goToStep(1); // Camera setup step
      
      // Mock no face detected
      global.faceapi.detectAllFaces.mockResolvedValueOnce([]);
      
      await expect(trainingUI._processCameraSetupStep()).rejects.toThrow('No face detected');
    });

    it('should process face capture step', async () => {
      await trainingUI.goToStep(2); // Face capture step
      
      const captureEventSpy = vi.fn();
      const completedEventSpy = vi.fn();
      trainingUI.on('face_captured', captureEventSpy);
      trainingUI.on('face_capture_completed', completedEventSpy);
      
      // Mock setTimeout to execute immediately
      vi.useFakeTimers();
      
      const processingPromise = trainingUI._processFaceCaptureStep();
      
      // Fast-forward timers
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(500);
        await Promise.resolve(); // Let any pending promises resolve
      }
      
      await processingPromise;
      
      vi.useRealTimers();
      
      expect(captureEventSpy).toHaveBeenCalledTimes(5);
      expect(completedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        capturesCount: 5
      }));
      expect(trainingUI.trainingData.faceCaptures.length).toBe(5);
      
      const faceModelMock = await import('../../../src/personalization/vision/face-model.js');
      expect(faceModelMock.faceModel.registerFace).toHaveBeenCalled();
    });

    it('should process expression capture step', async () => {
      await trainingUI.goToStep(3); // Expression capture step
      
      // Set up mock expressions to capture
      trainingUI.expressionsToCapture = ['neutral', 'happy', 'sad'];
      
      const captureEventSpy = vi.fn();
      const completedEventSpy = vi.fn();
      trainingUI.on('expression_captured', captureEventSpy);
      trainingUI.on('expression_capture_completed', completedEventSpy);
      
      // Mock different expressions
      const expressions = [
        { neutral: 0.8, happy: 0.1, sad: 0.05 },
        { neutral: 0.1, happy: 0.8, sad: 0.05 },
        { neutral: 0.1, happy: 0.05, sad: 0.8 }
      ];
      
      let expressionIndex = 0;
      global.faceapi.detectSingleFace.mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockResolvedValue({
            descriptor: new Float32Array(128).fill(0.5)
          }),
          withFaceExpressions: vi.fn().mockImplementation(() => {
            return Promise.resolve({
              expressions: expressions[expressionIndex++]
            });
          })
        })
      });
      
      // Mock setTimeout to execute immediately
      vi.useFakeTimers();
      
      const processingPromise = trainingUI._processExpressionCaptureStep();
      
      // Fast-forward timers for each expression
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000);
        await Promise.resolve(); // Let any pending promises resolve
      }
      
      await processingPromise;
      
      vi.useRealTimers();
      
      expect(captureEventSpy).toHaveBeenCalledTimes(3);
      expect(completedEventSpy).toHaveBeenCalled();
      expect(Object.keys(trainingUI.trainingData.expressionCaptures).length).toBe(3);
    });

    it('should process verification step', async () => {
      await trainingUI.goToStep(4); // Verification step
      
      const eventSpy = vi.fn();
      trainingUI.on('verification_completed', eventSpy);
      
      await trainingUI._processVerificationStep();
      
      expect(eventSpy).toHaveBeenCalled();
      expect(trainingUI.trainingData.verificationResults).toBeDefined();
    });

    it('should process completion step', async () => {
      await trainingUI.goToStep(5); // Completion step
      
      const eventSpy = vi.fn();
      trainingUI.on('training_completed', eventSpy);
      
      await trainingUI._processCompletionStep();
      
      expect(eventSpy).toHaveBeenCalled();
      
      const auditTrailMock = await import('../../../src/security/audit-trail.js');
      expect(auditTrailMock.auditTrail.log).toHaveBeenCalledWith(
        'vision_training_completed',
        expect.any(Object)
      );
    });

    it('should process full step sequence', async () => {
      // Start at the beginning
      trainingUI.currentStep = 0;
      
      // Mock step processing methods
      trainingUI._processConsentStep = vi.fn().mockResolvedValue(undefined);
      trainingUI._processCameraSetupStep = vi.fn().mockResolvedValue(undefined);
      trainingUI._processFaceCaptureStep = vi.fn().mockResolvedValue(undefined);
      trainingUI._processExpressionCaptureStep = vi.fn().mockResolvedValue(undefined);
      trainingUI._processVerificationStep = vi.fn().mockResolvedValue(undefined);
      trainingUI._processCompletionStep = vi.fn().mockResolvedValue(undefined);
      trainingUI.goToStep = vi.fn().mockResolvedValue(undefined);
      
      // Process each step
      for (let i = 0; i < trainingUI.steps.length; i++) {
        trainingUI.currentStep = i;
        await trainingUI.processStep();
      }
      
      // Verify all steps were processed
      expect(trainingUI._processConsentStep).toHaveBeenCalled();
      expect(trainingUI._processCameraSetupStep).toHaveBeenCalled();
      expect(trainingUI._processFaceCaptureStep).toHaveBeenCalled();
      expect(trainingUI._processExpressionCaptureStep).toHaveBeenCalled();
      expect(trainingUI._processVerificationStep).toHaveBeenCalled();
      expect(trainingUI._processCompletionStep).toHaveBeenCalled();
      
      // Verify navigation between steps
      expect(trainingUI.goToStep).toHaveBeenCalledTimes(trainingUI.steps.length - 1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
    });

    it('should handle errors during step processing', async () => {
      await trainingUI.startTraining();
      
      // Mock a step processing error
      trainingUI._processConsentStep = vi.fn().mockRejectedValue(new Error('Consent denied'));
      
      await expect(trainingUI.processStep()).rejects.toThrow('Consent denied');
    });

    it('should handle errors during step navigation', async () => {
      await trainingUI.startTraining();
      
      // Mock a step cleanup error
      trainingUI._cleanupCurrentStep = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      await expect(trainingUI.goToStep(1)).rejects.toThrow('Cleanup failed');
    });

    it('should handle errors during training start', async () => {
      // Mock an initialization error
      trainingUI.isInitialized = false;
      
      await expect(trainingUI.startTraining()).rejects.toThrow('Training UI not initialized');
    });
  });

  describe('Security Integration', () => {
    beforeEach(async () => {
      await trainingUI.initialize('test-user', mockVideoElement, mockCanvasElement);
      await trainingUI.startTraining();
    });

    it('should log training events to audit trail', async () => {
      const auditTrailMock = await import('../../../src/security/audit-trail.js');
      auditTrailMock.auditTrail.log.mockClear();
      
      await trainingUI._processFaceCaptureStep();
      
      expect(auditTrailMock.auditTrail.log).toHaveBeenCalledWith(
        expect.stringMatching(/vision_/),
        expect.any(Object)
      );
    });

    it('should request proper consent for biometric data', async () => {
      const consentManagerMock = await import('../../../src/security/consent-manager.js');
      consentManagerMock.consentManager.requestConsent.mockClear();
      
      await trainingUI._processConsentStep();
      
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'face_recognition',
        expect.any(Object)
      );
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'expression_detection',
        expect.any(Object)
      );
      expect(consentManagerMock.consentManager.requestConsent).toHaveBeenCalledWith(
        'face_model_creation',
        expect.any(Object)
      );
    });
  });
});
