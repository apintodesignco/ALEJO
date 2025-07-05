/**
 * ALEJO Eye Tracking Modules Unit Tests
 * 
 * Tests for the individual eye tracking modules:
 * - Eye Tracking (tracking.js)
 * - Eye Calibration (calibration.js)
 * - Eye Processor (processor.js)
 */

import { jest } from '@jest/globals';
import * as eyeTracking from '../../src/biometrics/eye/tracking.js';
import * as eyeCalibration from '../../src/biometrics/eye/calibration.js';
import * as eyeProcessor from '../../src/biometrics/eye/processor.js';
import * as eventBus from '../../src/core/event-bus.js';

// Mock the event bus
jest.mock('../../src/core/event-bus.js', () => ({
  publish: jest.fn(),
  subscribe: jest.fn().mockImplementation(() => ({
    unsubscribe: jest.fn()
  }))
}));

// Mock Canvas and related APIs
global.HTMLCanvasElement = class {
  constructor() {
    this.width = 640;
    this.height = 480;
  }
  
  getContext() {
    return {
      drawImage: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      setTransform: jest.fn(),
      save: jest.fn(),
      restore: jest.fn()
    };
  }
};

// Mock HTMLVideoElement
global.HTMLVideoElement = class {
  constructor() {
    this.videoWidth = 640;
    this.videoHeight = 480;
    this.width = 640;
    this.height = 480;
    this.srcObject = null;
    this.autoplay = false;
    this.muted = false;
    this.playsInline = false;
    this.play = jest.fn().mockResolvedValue();
    this.pause = jest.fn();
  }
};

// Mock window.requestAnimationFrame
global.requestAnimationFrame = jest.fn(callback => {
  setTimeout(callback, 0);
  return 123; // Mock ID
});

// Mock window.cancelAnimationFrame
global.cancelAnimationFrame = jest.fn();

// Mock performance.now
global.performance = {
  now: jest.fn().mockReturnValue(Date.now())
};

describe('Eye Tracking Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Eye Tracking (tracking.js)', () => {
    test('initialize sets up eye tracking with default configuration', async () => {
      await eyeTracking.initialize();
      
      // Verify that the module is initialized
      expect(eyeTracking.isInitialized()).toBe(true);
      
      // Verify that default configuration is applied
      expect(eyeTracking.getConfig()).toEqual(expect.objectContaining({
        trackPupils: true,
        trackGaze: true,
        trackBlinks: true
      }));
      
      // Verify that event subscriptions are set up
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        'eye:calibration:completed',
        expect.any(Function)
      );
    });
    
    test('processEyeData detects pupils and calculates gaze', () => {
      // Initialize the module
      eyeTracking.initialize();
      
      // Mock eye data
      const mockEyeData = {
        leftEye: {
          landmarks: [
            { x: 100, y: 100 }, // Top
            { x: 110, y: 100 }, // Top right
            { x: 120, y: 105 }, // Right
            { x: 110, y: 110 }, // Bottom right
            { x: 100, y: 110 }, // Bottom
            { x: 95, y: 105 }   // Left
          ],
          center: { x: 105, y: 105 }
        },
        rightEye: {
          landmarks: [
            { x: 150, y: 100 }, // Top
            { x: 160, y: 100 }, // Top right
            { x: 170, y: 105 }, // Right
            { x: 160, y: 110 }, // Bottom right
            { x: 150, y: 110 }, // Bottom
            { x: 145, y: 105 }  // Left
          ],
          center: { x: 155, y: 105 }
        },
        timestamp: Date.now()
      };
      
      // Process the eye data
      const result = eyeTracking.processEyeData(mockEyeData);
      
      // Verify the result contains pupil data
      expect(result).toEqual(expect.objectContaining({
        leftPupil: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          size: expect.any(Number)
        }),
        rightPupil: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          size: expect.any(Number)
        }),
        gaze: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          confidence: expect.any(Number)
        }),
        timestamp: expect.any(Number)
      }));
      
      // Verify that tracking events are published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:tracking:updated',
        expect.any(Object)
      );
    });
    
    test('detectBlink identifies blinks correctly', () => {
      // Initialize the module
      eyeTracking.initialize();
      
      // Mock previous eye data with open eyes
      const openEyeData = {
        leftEye: {
          aspectRatio: 0.5, // Open eye
          openness: 0.9
        },
        rightEye: {
          aspectRatio: 0.5, // Open eye
          openness: 0.9
        },
        timestamp: Date.now() - 100
      };
      
      // Process open eye data first
      eyeTracking.processEyeData(openEyeData);
      
      // Mock closed eye data
      const closedEyeData = {
        leftEye: {
          aspectRatio: 0.1, // Closed eye
          openness: 0.1
        },
        rightEye: {
          aspectRatio: 0.1, // Closed eye
          openness: 0.1
        },
        timestamp: Date.now()
      };
      
      // Process closed eye data
      const result = eyeTracking.processEyeData(closedEyeData);
      
      // Verify that a blink was detected
      expect(result.blink).toEqual(expect.objectContaining({
        detected: true,
        eye: 'both',
        duration: expect.any(Number)
      }));
      
      // Verify that blink event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:blink:detected',
        expect.objectContaining({
          eye: 'both',
          duration: expect.any(Number)
        })
      );
    });
    
    test('detectSaccade identifies rapid eye movements', () => {
      // Initialize the module
      eyeTracking.initialize();
      
      // Mock initial eye position
      const initialEyeData = {
        leftPupil: { x: 100, y: 100 },
        rightPupil: { x: 150, y: 100 },
        gaze: { x: 0.5, y: 0.5 },
        timestamp: Date.now() - 50
      };
      
      // Process initial eye data
      eyeTracking.processEyeData(initialEyeData);
      
      // Mock eye data with rapid movement
      const movedEyeData = {
        leftPupil: { x: 120, y: 100 }, // Moved 20px to the right
        rightPupil: { x: 170, y: 100 }, // Moved 20px to the right
        gaze: { x: 0.7, y: 0.5 }, // Moved significantly
        timestamp: Date.now()
      };
      
      // Process moved eye data
      const result = eyeTracking.processEyeData(movedEyeData);
      
      // Verify that a saccade was detected
      expect(result.saccade).toEqual(expect.objectContaining({
        detected: true,
        velocity: expect.any(Number),
        direction: expect.any(String)
      }));
      
      // Verify that saccade event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:saccade:detected',
        expect.objectContaining({
          velocity: expect.any(Number),
          direction: expect.any(String)
        })
      );
    });
    
    test('updateCalibration updates tracking parameters', () => {
      // Initialize the module
      eyeTracking.initialize();
      
      // Mock calibration data
      const calibrationData = {
        accuracy: 0.95,
        points: [
          { x: 0.1, y: 0.1, actual: { x: 0.12, y: 0.09 } },
          { x: 0.9, y: 0.1, actual: { x: 0.88, y: 0.11 } },
          { x: 0.5, y: 0.5, actual: { x: 0.51, y: 0.49 } },
          { x: 0.1, y: 0.9, actual: { x: 0.09, y: 0.91 } },
          { x: 0.9, y: 0.9, actual: { x: 0.91, y: 0.89 } }
        ],
        timestamp: Date.now()
      };
      
      // Update calibration
      eyeTracking.updateCalibration(calibrationData);
      
      // Verify that calibration status is updated
      expect(eyeTracking.getCalibrationStatus()).toEqual(expect.objectContaining({
        isCalibrated: true,
        accuracy: 0.95,
        timestamp: expect.any(Number)
      }));
      
      // Verify that calibration event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:tracking:calibration:updated',
        expect.objectContaining({
          isCalibrated: true,
          accuracy: 0.95
        })
      );
    });
  });
  
  describe('Eye Calibration (calibration.js)', () => {
    test('initialize sets up calibration with default configuration', async () => {
      await eyeCalibration.initialize();
      
      // Verify that the module is initialized
      expect(eyeCalibration.isInitialized()).toBe(true);
      
      // Verify that default configuration is applied
      expect(eyeCalibration.getConfig()).toEqual(expect.objectContaining({
        numPoints: expect.any(Number),
        pointDurationMs: expect.any(Number),
        pointSize: expect.any(Number)
      }));
    });
    
    test('startCalibration begins the calibration procedure', async () => {
      // Initialize the module
      await eyeCalibration.initialize();
      
      // Start calibration
      const calibrationPromise = eyeCalibration.startCalibration({
        numPoints: 5,
        pointDurationMs: 1000
      });
      
      // Verify that calibration started event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:calibration:started',
        expect.objectContaining({
          numPoints: 5,
          estimatedDurationMs: expect.any(Number)
        })
      );
      
      // Verify that calibration is in progress
      expect(eyeCalibration.isCalibrating()).toBe(true);
      
      // Mock calibration completion
      eyeCalibration.completeCalibration({
        accuracy: 0.95,
        points: 5
      });
      
      // Wait for calibration to complete
      await calibrationPromise;
      
      // Verify that calibration completed event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:calibration:completed',
        expect.objectContaining({
          accuracy: 0.95,
          points: 5
        })
      );
      
      // Verify that calibration is no longer in progress
      expect(eyeCalibration.isCalibrating()).toBe(false);
    });
    
    test('cancelCalibration aborts the calibration procedure', async () => {
      // Initialize the module
      await eyeCalibration.initialize();
      
      // Start calibration
      const calibrationPromise = eyeCalibration.startCalibration({
        numPoints: 5,
        pointDurationMs: 1000
      });
      
      // Verify that calibration is in progress
      expect(eyeCalibration.isCalibrating()).toBe(true);
      
      // Cancel calibration
      eyeCalibration.cancelCalibration('user_cancelled');
      
      // Verify that calibration cancelled event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:calibration:cancelled',
        expect.objectContaining({
          reason: 'user_cancelled'
        })
      );
      
      // Verify that calibration is no longer in progress
      expect(eyeCalibration.isCalibrating()).toBe(false);
      
      // Verify that the promise was rejected
      await expect(calibrationPromise).rejects.toEqual(
        expect.objectContaining({
          reason: 'user_cancelled'
        })
      );
    });
    
    test('renderCalibrationUI renders calibration points', () => {
      // Initialize the module
      eyeCalibration.initialize();
      
      // Create a mock canvas
      const mockCanvas = new HTMLCanvasElement();
      const mockContext = mockCanvas.getContext('2d');
      
      // Mock calibration state
      const calibrationState = {
        currentPoint: 0,
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.5, y: 0.5 },
          { x: 0.1, y: 0.9 },
          { x: 0.9, y: 0.9 }
        ],
        pointSize: 20,
        animationProgress: 0.5
      };
      
      // Render calibration UI
      eyeCalibration.renderCalibrationUI(mockCanvas, calibrationState);
      
      // Verify that canvas was cleared
      expect(mockContext.clearRect).toHaveBeenCalled();
      
      // Verify that a point was drawn
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
    });
  });
  
  describe('Eye Processor (processor.js)', () => {
    test('initializeProcessor sets up processor with configuration', async () => {
      // Initialize the processor
      await eyeProcessor.initializeProcessor({
        trackPupils: true,
        trackGaze: true,
        trackBlinks: true,
        processingIntervalMs: 50,
        debugMode: true
      });
      
      // Verify that the processor is initialized
      expect(eyeProcessor.isInitialized()).toBe(true);
      
      // Verify that configuration is applied
      expect(eyeProcessor.getConfig()).toEqual(expect.objectContaining({
        trackPupils: true,
        trackGaze: true,
        trackBlinks: true,
        processingIntervalMs: 50,
        debugMode: true
      }));
    });
    
    test('setVideoSource connects video element to processor', async () => {
      // Initialize the processor
      await eyeProcessor.initializeProcessor();
      
      // Create mock video element
      const mockVideo = new HTMLVideoElement();
      
      // Set video source
      eyeProcessor.setVideoSource(mockVideo);
      
      // Verify that video source is set
      expect(eyeProcessor.getVideoSource()).toBe(mockVideo);
    });
    
    test('startProcessing begins frame processing loop', async () => {
      // Initialize the processor
      await eyeProcessor.initializeProcessor({
        processingIntervalMs: 50
      });
      
      // Create mock video element
      const mockVideo = new HTMLVideoElement();
      eyeProcessor.setVideoSource(mockVideo);
      
      // Start processing
      eyeProcessor.startProcessing();
      
      // Verify that processing is started
      expect(eyeProcessor.isProcessing()).toBe(true);
      
      // Verify that requestAnimationFrame was called
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      
      // Verify that processing started event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:processor:started',
        expect.any(Object)
      );
      
      // Stop processing to clean up
      eyeProcessor.stopProcessing();
    });
    
    test('stopProcessing ends frame processing loop', async () => {
      // Initialize the processor and start processing
      await eyeProcessor.initializeProcessor();
      const mockVideo = new HTMLVideoElement();
      eyeProcessor.setVideoSource(mockVideo);
      eyeProcessor.startProcessing();
      
      // Stop processing
      eyeProcessor.stopProcessing();
      
      // Verify that processing is stopped
      expect(eyeProcessor.isProcessing()).toBe(false);
      
      // Verify that cancelAnimationFrame was called
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
      
      // Verify that processing stopped event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'eye:processor:stopped',
        expect.any(Object)
      );
    });
    
    test('processFaceLandmarks extracts eye data from face landmarks', async () => {
      // Initialize the processor
      await eyeProcessor.initializeProcessor();
      
      // Mock face landmarks
      const mockLandmarks = {
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
      };
      
      // Process face landmarks
      const result = eyeProcessor.processFaceLandmarks(mockLandmarks);
      
      // Verify that eye data was extracted
      expect(result).toEqual(expect.objectContaining({
        leftEye: expect.objectContaining({
          landmarks: expect.any(Array),
          center: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          }),
          aspectRatio: expect.any(Number)
        }),
        rightEye: expect.objectContaining({
          landmarks: expect.any(Array),
          center: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          }),
          aspectRatio: expect.any(Number)
        }),
        timestamp: expect.any(Number)
      }));
    });
    
    test('renderDebugInfo draws debug visualization', async () => {
      // Initialize the processor with debug mode
      await eyeProcessor.initializeProcessor({
        debugMode: true
      });
      
      // Create mock canvas and context
      const mockCanvas = new HTMLCanvasElement();
      const mockContext = mockCanvas.getContext('2d');
      
      // Mock eye tracking data
      const mockEyeData = {
        leftEye: {
          landmarks: [
            { x: 100, y: 100 },
            { x: 110, y: 100 },
            { x: 120, y: 105 },
            { x: 110, y: 110 },
            { x: 100, y: 110 },
            { x: 95, y: 105 }
          ],
          center: { x: 105, y: 105 },
          pupil: { x: 105, y: 105, size: 5 }
        },
        rightEye: {
          landmarks: [
            { x: 150, y: 100 },
            { x: 160, y: 100 },
            { x: 170, y: 105 },
            { x: 160, y: 110 },
            { x: 150, y: 110 },
            { x: 145, y: 105 }
          ],
          center: { x: 155, y: 105 },
          pupil: { x: 155, y: 105, size: 5 }
        },
        gaze: { x: 0.5, y: 0.5, confidence: 0.9 },
        blink: { detected: false },
        saccade: { detected: false },
        timestamp: Date.now(),
        processingTimeMs: 10
      };
      
      // Render debug info
      eyeProcessor.renderDebugInfo(mockCanvas, mockEyeData);
      
      // Verify that debug info was drawn
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });
    
    test('applyPrivacyFilter blurs or masks eye regions', async () => {
      // Initialize the processor with privacy mode
      await eyeProcessor.initializeProcessor({
        privacyMode: 'blur'
      });
      
      // Create mock canvas and context
      const mockCanvas = new HTMLCanvasElement();
      const mockContext = mockCanvas.getContext('2d');
      
      // Mock eye data
      const mockEyeData = {
        leftEye: {
          landmarks: [
            { x: 100, y: 100 },
            { x: 120, y: 110 }
          ],
          center: { x: 110, y: 105 }
        },
        rightEye: {
          landmarks: [
            { x: 150, y: 100 },
            { x: 170, y: 110 }
          ],
          center: { x: 160, y: 105 }
        }
      };
      
      // Apply privacy filter
      eyeProcessor.applyPrivacyFilter(mockCanvas, mockEyeData);
      
      // Verify that filter was applied
      expect(mockContext.fillRect).toHaveBeenCalled();
    });
  });
});
