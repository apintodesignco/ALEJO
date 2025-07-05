/**
 * @file eye-processor.test.js
 * @description Unit tests for the eye tracking processor module
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import eyeProcessor from '../../../src/biometrics/eye/eye-processor';
import { publish } from '../../../src/events';

// Mock the face-api.js and TensorFlow dependencies
vi.mock('@tensorflow-models/face-landmarks-detection', () => ({
  load: vi.fn().mockResolvedValue({
    estimateFaces: vi.fn().mockResolvedValue([{
      landmarks: {
        positions: [
          // Left eye landmarks
          { x: 100, y: 100 }, // Left eye left corner
          { x: 110, y: 98 },  // Left eye top
          { x: 120, y: 100 }, // Left eye right corner
          { x: 110, y: 102 }, // Left eye bottom
          { x: 110, y: 100 }, // Left eye center
          
          // Right eye landmarks
          { x: 140, y: 100 }, // Right eye left corner
          { x: 150, y: 98 },  // Right eye top
          { x: 160, y: 100 }, // Right eye right corner
          { x: 150, y: 102 }, // Right eye bottom
          { x: 150, y: 100 }, // Right eye center
        ]
      },
      probability: 0.98
    }])
  })
}));

vi.mock('../../../src/events', () => ({
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

describe('Eye Processor Module', () => {
  let mockVideoElement;
  let mockCanvas;
  let mockContext;
  
  beforeEach(() => {
    // Create mock DOM elements
    mockVideoElement = {
      videoWidth: 640,
      videoHeight: 480,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn()
    };
    
    mockContext = {
      drawImage: vi.fn(),
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn()
    };
    
    mockCanvas = {
      width: 640,
      height: 480,
      getContext: vi.fn().mockReturnValue(mockContext)
    };
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should initialize successfully', async () => {
    const config = {
      enabled: true,
      debugMode: false
    };
    
    const result = await eyeProcessor.initialize(config);
    
    expect(result).toBe(true);
    expect(eyeProcessor.isInitialized()).toBe(true);
  });
  
  it('should not initialize if disabled in config', async () => {
    const config = {
      enabled: false
    };
    
    const result = await eyeProcessor.initialize(config);
    
    expect(result).toBe(false);
    expect(eyeProcessor.isInitialized()).toBe(false);
  });
  
  it('should start processing successfully', async () => {
    // First initialize
    await eyeProcessor.initialize({ enabled: true });
    
    const result = await eyeProcessor.startProcessing(mockVideoElement, mockCanvas);
    
    expect(result).toBe(true);
    expect(eyeProcessor.isProcessing()).toBe(true);
  });
  
  it('should stop processing successfully', async () => {
    // First initialize and start
    await eyeProcessor.initialize({ enabled: true });
    await eyeProcessor.startProcessing(mockVideoElement, mockCanvas);
    
    const result = await eyeProcessor.stopProcessing();
    
    expect(result).toBe(true);
    expect(eyeProcessor.isProcessing()).toBe(false);
  });
  
  it('should detect eye blinks', async () => {
    // First initialize and start
    await eyeProcessor.initialize({ 
      enabled: true,
      trackBlinks: true 
    });
    
    await eyeProcessor.startProcessing(mockVideoElement, mockCanvas);
    
    // Simulate a blink by changing eye landmark positions
    const blinkEvent = {
      type: 'blink',
      eye: 'left',
      duration: 200
    };
    
    // Trigger the blink detection
    eyeProcessor.onFrameProcessed({
      leftEye: {
        openRatio: 0.1, // Low ratio indicates closed eye
        center: { x: 110, y: 100 }
      },
      rightEye: {
        openRatio: 0.8,
        center: { x: 150, y: 100 }
      }
    });
    
    // Check if blink event was published
    expect(publish).toHaveBeenCalledWith('eye:blink', expect.objectContaining({
      eye: 'left'
    }));
  });
  
  it('should track gaze direction', async () => {
    // First initialize and start
    await eyeProcessor.initialize({ 
      enabled: true,
      trackGaze: true 
    });
    
    await eyeProcessor.startProcessing(mockVideoElement, mockCanvas);
    
    // Simulate gaze tracking
    eyeProcessor.onFrameProcessed({
      leftEye: {
        openRatio: 0.8,
        center: { x: 110, y: 100 },
        pupil: { x: 112, y: 100 } // Pupil slightly to the right
      },
      rightEye: {
        openRatio: 0.8,
        center: { x: 150, y: 100 },
        pupil: { x: 152, y: 100 } // Pupil slightly to the right
      }
    });
    
    // Check if gaze event was published
    expect(publish).toHaveBeenCalledWith('eye:gaze', expect.objectContaining({
      direction: expect.any(Object)
    }));
  });
  
  it('should update configuration successfully', () => {
    const newConfig = {
      trackBlinks: false,
      trackGaze: true,
      debugMode: true
    };
    
    const result = eyeProcessor.updateConfig(newConfig);
    
    expect(result).toBe(true);
    expect(eyeProcessor.getConfig()).toMatchObject(newConfig);
  });
  
  it('should handle calibration process', async () => {
    await eyeProcessor.initialize({ enabled: true });
    
    const calibrationOptions = {
      points: 5,
      duration: 2000
    };
    
    const result = await eyeProcessor.startCalibration(calibrationOptions);
    
    expect(result).toBe(true);
    expect(eyeProcessor.isCalibrating()).toBe(true);
    
    // Complete calibration
    await eyeProcessor.completeCalibration();
    
    expect(eyeProcessor.isCalibrating()).toBe(false);
    expect(eyeProcessor.isCalibrated()).toBe(true);
  });
});
