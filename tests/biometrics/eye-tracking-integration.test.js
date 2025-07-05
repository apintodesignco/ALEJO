/**
 * ALEJO Eye Tracking Integration Tests
 * 
 * Tests the integration between the eye tracking modules and the main biometrics system.
 * Verifies that the eye tracking, calibration, and processor modules work together correctly.
 */

import { jest } from '@jest/globals';
import { initializeBiometrics, startProcessing, stopProcessing } from '../../src/biometrics/index.js';
import * as eyeProcessor from '../../src/biometrics/eye/processor.js';
import * as eyeTracking from '../../src/biometrics/eye/tracking.js';
import * as eyeCalibration from '../../src/biometrics/eye/calibration.js';
import * as eventBus from '../../src/core/event-bus.js';

// Mock the modules
jest.mock('../../src/biometrics/eye/processor.js');
jest.mock('../../src/biometrics/eye/tracking.js');
jest.mock('../../src/biometrics/eye/calibration.js');
jest.mock('../../src/core/event-bus.js');

// Mock MediaStream and HTMLVideoElement
global.MediaStream = jest.fn().mockImplementation(() => ({
  getTracks: () => [{
    stop: jest.fn()
  }]
}));

global.HTMLVideoElement = class {
  constructor() {
    this.srcObject = null;
    this.autoplay = false;
    this.muted = false;
    this.playsInline = false;
  }
};

// Mock navigator.mediaDevices
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(new MediaStream())
};

describe('Eye Tracking Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    eyeProcessor.initializeProcessor.mockResolvedValue();
    eyeProcessor.setVideoSource.mockReturnValue();
    eyeProcessor.startProcessing.mockReturnValue();
    eyeProcessor.stopProcessing.mockReturnValue();
    eyeProcessor.pauseProcessing.mockReturnValue();
    eyeProcessor.resumeProcessing.mockReturnValue();
    
    eyeTracking.initialize.mockResolvedValue();
    eyeTracking.startTracking.mockReturnValue();
    eyeTracking.stopTracking.mockReturnValue();
    
    eyeCalibration.initialize.mockResolvedValue();
    eyeCalibration.startCalibration.mockResolvedValue();
    eyeCalibration.cancelCalibration.mockReturnValue();
    
    eventBus.publish.mockReturnValue();
    eventBus.subscribe.mockImplementation((event, callback) => {
      return { unsubscribe: jest.fn() };
    });
    
    // Mock BiometricConsentManager
    global.BiometricConsentManager = jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      checkConsent: jest.fn().mockResolvedValue(true)
    }));
  });
  
  test('Biometrics system initializes eye tracking modules', async () => {
    // Initialize biometrics system with eye tracking enabled
    const biometrics = await initializeBiometrics({
      eyeTracking: {
        enabled: true,
        calibrationRequired: true
      }
    });
    
    // Verify that loadEyeTrackingModels was called
    expect(eyeTracking.initialize).toHaveBeenCalled();
    
    // Verify that the event bus subscriptions were set up
    expect(eventBus.subscribe).toHaveBeenCalledWith('consent:biometrics:changed', expect.any(Function));
    expect(eventBus.subscribe).toHaveBeenCalledWith('camera:status', expect.any(Function));
    expect(eventBus.subscribe).toHaveBeenCalledWith('system:memory:low', expect.any(Function));
    expect(eventBus.subscribe).toHaveBeenCalledWith('accessibility:settings:changed', expect.any(Function));
    
    // Verify that the initialization event was published
    expect(eventBus.publish).toHaveBeenCalledWith('biometrics:initialized', expect.objectContaining({
      activeScanners: expect.arrayContaining(['eye'])
    }));
  });
  
  test('Starting biometrics processing initializes and starts eye processor', async () => {
    // Initialize biometrics system
    await initializeBiometrics({
      eyeTracking: { enabled: true }
    });
    
    // Start processing
    await startProcessing();
    
    // Verify that eye processor was initialized and started
    expect(eyeProcessor.initializeProcessor).toHaveBeenCalled();
    expect(eyeProcessor.setVideoSource).toHaveBeenCalled();
    expect(eyeProcessor.startProcessing).toHaveBeenCalled();
    
    // Verify that the start event was published
    expect(eventBus.publish).toHaveBeenCalledWith('biometrics:eye:started');
  });
  
  test('Stopping biometrics processing stops eye processor', async () => {
    // Initialize and start biometrics system
    await initializeBiometrics({
      eyeTracking: { enabled: true }
    });
    await startProcessing();
    
    // Stop processing
    stopProcessing();
    
    // Verify that eye processor was stopped
    expect(eyeProcessor.stopProcessing).toHaveBeenCalled();
    
    // Verify that the stop event was published
    expect(eventBus.publish).toHaveBeenCalledWith('biometrics:eye:stopped');
  });
  
  test('Eye calibration can be started and completed', async () => {
    // Initialize biometrics system
    await initializeBiometrics({
      eyeTracking: { enabled: true, calibrationRequired: true }
    });
    
    // Mock the calibration complete event
    const calibrationCompleteCallback = jest.fn();
    eventBus.subscribe.mockImplementation((event, callback) => {
      if (event === 'eye:calibration:completed') {
        calibrationCompleteCallback.mockImplementation(callback);
      }
      return { unsubscribe: jest.fn() };
    });
    
    // Start eye calibration
    await eyeCalibration.startCalibration({
      numPoints: 5,
      pointDurationMs: 1000
    });
    
    // Verify calibration was started
    expect(eyeCalibration.startCalibration).toHaveBeenCalledWith({
      numPoints: 5,
      pointDurationMs: 1000
    });
    
    // Simulate calibration completion
    calibrationCompleteCallback({
      accuracy: 0.95,
      points: 5,
      durationMs: 5000
    });
    
    // Verify that eye tracking is updated with calibration data
    expect(eyeTracking.updateCalibration).toHaveBeenCalledWith(expect.objectContaining({
      accuracy: 0.95
    }));
  });
  
  test('Eye processor handles face detection events', async () => {
    // Initialize biometrics system
    await initializeBiometrics({
      eyeTracking: { enabled: true }
    });
    await startProcessing();
    
    // Find the face detection event subscription
    const faceDetectionCallback = jest.fn();
    eventBus.subscribe.mockImplementation((event, callback) => {
      if (event === 'face:detection:updated') {
        faceDetectionCallback.mockImplementation(callback);
      }
      return { unsubscribe: jest.fn() };
    });
    
    // Simulate a face detection event with eye landmarks
    const mockFaceData = {
      landmarks: {
        leftEye: [
          { x: 100, y: 100 },
          { x: 110, y: 100 },
          { x: 120, y: 105 },
          { x: 110, y: 110 },
          { x: 100, y: 110 },
          { x: 95, y: 105 }
        ],
        rightEye: [
          { x: 150, y: 100 },
          { x: 160, y: 100 },
          { x: 170, y: 105 },
          { x: 160, y: 110 },
          { x: 150, y: 110 },
          { x: 145, y: 105 }
        ]
      }
    };
    
    faceDetectionCallback(mockFaceData);
    
    // Verify that eye processor processes the face landmarks
    expect(eyeProcessor.processFaceLandmarks).toHaveBeenCalledWith(
      expect.objectContaining({
        leftEye: expect.any(Array),
        rightEye: expect.any(Array)
      })
    );
  });
  
  test('Eye tracking detects blinks and publishes events', async () => {
    // Initialize biometrics system
    await initializeBiometrics({
      eyeTracking: { enabled: true, trackBlinks: true }
    });
    await startProcessing();
    
    // Mock the blink detection method
    const mockBlinkData = {
      type: 'blink',
      eye: 'both',
      duration: 200,
      timestamp: Date.now()
    };
    
    // Simulate blink detection
    const blinkDetectedCallback = jest.fn();
    eventBus.subscribe.mockImplementation((event, callback) => {
      if (event === 'eye:blink:detected') {
        blinkDetectedCallback.mockImplementation(callback);
      }
      return { unsubscribe: jest.fn() };
    });
    
    // Trigger a blink event
    eyeTracking.detectBlink.mockReturnValue(mockBlinkData);
    blinkDetectedCallback(mockBlinkData);
    
    // Verify that the blink event was published
    expect(eventBus.publish).toHaveBeenCalledWith('eye:blink:detected', mockBlinkData);
  });
  
  test('System handles low memory conditions by adjusting eye tracking', async () => {
    // Initialize biometrics system
    await initializeBiometrics({
      eyeTracking: {
        enabled: true,
        processingIntervalMs: 50,
        adaptiveProcessing: true
      }
    });
    await startProcessing();
    
    // Find the low memory event subscription
    let lowMemoryCallback;
    eventBus.subscribe.mockImplementation((event, callback) => {
      if (event === 'system:memory:low') {
        lowMemoryCallback = callback;
      }
      return { unsubscribe: jest.fn() };
    });
    
    // Simulate a low memory event
    lowMemoryCallback();
    
    // Verify that eye processor was updated with reduced performance settings
    expect(eyeProcessor.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        processingIntervalMs: expect.any(Number),
        performanceMode: 'low'
      })
    );
    
    // Verify that the reduced performance event was published
    expect(eventBus.publish).toHaveBeenCalledWith(
      'biometrics:reduced:performance',
      expect.objectContaining({
        reason: 'low_memory'
      })
    );
  });
});
