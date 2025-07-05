/**
 * ALEJO Eye Tracking System Integration Test
 * 
 * This test verifies the full integration of the eye tracking system with other ALEJO components,
 * including the biometrics system, event bus, and accessibility features.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { initializeBiometrics } from '../../src/biometrics';
import { publish, subscribe, unsubscribe } from '../../src/events';

// Mock browser APIs
global.HTMLVideoElement = class HTMLVideoElement {
  constructor() {
    this.srcObject = null;
    this.width = 640;
    this.height = 480;
    this.play = vi.fn().mockResolvedValue();
    this.pause = vi.fn();
  }
};

global.HTMLCanvasElement = class HTMLCanvasElement {
  constructor() {
    this.width = 640;
    this.height = 480;
    this.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      setLineDash: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(640 * 480 * 4) }),
      putImageData: vi.fn()
    });
  }
};

global.MediaStream = class MediaStream {
  constructor() {
    this.getTracks = vi.fn().mockReturnValue([
      { stop: vi.fn() }
    ]);
  }
};

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(new MediaStream())
};

// Mock face detection
vi.mock('face-api.js', () => {
  return {
    detectSingleFace: vi.fn().mockResolvedValue({
      landmarks: {
        getLeftEye: vi.fn().mockReturnValue([
          { x: 200, y: 200 },
          { x: 210, y: 200 },
          { x: 220, y: 200 },
          { x: 230, y: 200 },
          { x: 220, y: 210 },
          { x: 210, y: 210 }
        ]),
        getRightEye: vi.fn().mockReturnValue([
          { x: 300, y: 200 },
          { x: 310, y: 200 },
          { x: 320, y: 200 },
          { x: 330, y: 200 },
          { x: 320, y: 210 },
          { x: 310, y: 210 }
        ])
      }
    }),
    TinyFaceDetectorOptions: class TinyFaceDetectorOptions {
      constructor() {}
    },
    nets: {
      tinyFaceDetector: {
        loadFromUri: vi.fn().mockResolvedValue()
      },
      faceLandmark68Net: {
        loadFromUri: vi.fn().mockResolvedValue()
      }
    }
  };
});

describe('Eye Tracking System Integration', () => {
  let biometrics;
  let eventCallbacks = {};
  let mockVideoElement;
  
  // Setup and teardown
  beforeAll(async () => {
    // Mock event system
    vi.spyOn(global, 'addEventListener').mockImplementation((event, callback) => {
      eventCallbacks[event] = eventCallbacks[event] || [];
      eventCallbacks[event].push(callback);
    });
    
    vi.spyOn(global, 'removeEventListener').mockImplementation((event, callback) => {
      if (eventCallbacks[event]) {
        eventCallbacks[event] = eventCallbacks[event].filter(cb => cb !== callback);
      }
    });
  });
  
  afterAll(() => {
    vi.restoreAllMocks();
  });
  
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockVideoElement = new HTMLVideoElement();
    
    // Initialize biometrics with eye tracking enabled
    biometrics = await initializeBiometrics({
      faceDetection: { enabled: true },
      eyeTracking: { 
        enabled: true,
        processingInterval: 50,
        debugMode: true,
        privacyMode: 'none',
        accessibility: {
          highContrastMode: false,
          largerTargets: false,
          slowerAnimations: false,
          voicePrompts: false,
          extraTime: false
        }
      }
    });
  });
  
  afterEach(async () => {
    // Stop biometrics processing
    await biometrics.stopProcessing();
    
    // Unsubscribe from all events
    unsubscribe('eye:tracking:initialized');
    unsubscribe('eye:gaze:updated');
    unsubscribe('eye:blink:detected');
    unsubscribe('eye:saccade:detected');
    unsubscribe('eye:calibration:started');
    unsubscribe('eye:calibration:completed');
    unsubscribe('eye:calibration:canceled');
    
    // Clear event callbacks
    eventCallbacks = {};
  });
  
  it('should initialize eye tracking when biometrics starts', async () => {
    // Setup event listener
    const initSpy = vi.fn();
    subscribe('eye:tracking:initialized', initSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Verify eye tracking was initialized
    expect(initSpy).toHaveBeenCalled();
  });
  
  it('should publish gaze updates during processing', async () => {
    // Setup event listener
    const gazeSpy = vi.fn();
    subscribe('eye:gaze:updated', gazeSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Simulate face detection event
    publish('face:detected', {
      landmarks: {
        getLeftEye: () => [
          { x: 200, y: 200 },
          { x: 210, y: 200 },
          { x: 220, y: 200 },
          { x: 230, y: 200 },
          { x: 220, y: 210 },
          { x: 210, y: 210 }
        ],
        getRightEye: () => [
          { x: 300, y: 200 },
          { x: 310, y: 200 },
          { x: 320, y: 200 },
          { x: 330, y: 200 },
          { x: 320, y: 210 },
          { x: 310, y: 210 }
        ]
      }
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify gaze updates were published
    expect(gazeSpy).toHaveBeenCalled();
    
    // Check gaze data structure
    const gazeData = gazeSpy.mock.calls[0][0];
    expect(gazeData).toHaveProperty('x');
    expect(gazeData).toHaveProperty('y');
    expect(gazeData).toHaveProperty('confidence');
  });
  
  it('should detect blinks and publish blink events', async () => {
    // Setup event listener
    const blinkSpy = vi.fn();
    subscribe('eye:blink:detected', blinkSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Simulate normal eyes
    publish('face:detected', {
      landmarks: {
        getLeftEye: () => [
          { x: 200, y: 200 },
          { x: 210, y: 200 },
          { x: 220, y: 200 },
          { x: 230, y: 200 },
          { x: 220, y: 210 },
          { x: 210, y: 210 }
        ],
        getRightEye: () => [
          { x: 300, y: 200 },
          { x: 310, y: 200 },
          { x: 320, y: 200 },
          { x: 330, y: 200 },
          { x: 320, y: 210 },
          { x: 310, y: 210 }
        ]
      }
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate closed eyes (blink)
    publish('face:detected', {
      landmarks: {
        getLeftEye: () => [
          { x: 200, y: 205 },
          { x: 210, y: 205 },
          { x: 220, y: 205 },
          { x: 230, y: 205 },
          { x: 220, y: 205 },
          { x: 210, y: 205 }
        ],
        getRightEye: () => [
          { x: 300, y: 205 },
          { x: 310, y: 205 },
          { x: 320, y: 205 },
          { x: 330, y: 205 },
          { x: 320, y: 205 },
          { x: 310, y: 205 }
        ]
      }
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate open eyes again
    publish('face:detected', {
      landmarks: {
        getLeftEye: () => [
          { x: 200, y: 200 },
          { x: 210, y: 200 },
          { x: 220, y: 200 },
          { x: 230, y: 200 },
          { x: 220, y: 210 },
          { x: 210, y: 210 }
        ],
        getRightEye: () => [
          { x: 300, y: 200 },
          { x: 310, y: 200 },
          { x: 320, y: 200 },
          { x: 330, y: 200 },
          { x: 320, y: 210 },
          { x: 310, y: 210 }
        ]
      }
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify blink was detected
    expect(blinkSpy).toHaveBeenCalled();
    
    // Check blink data structure
    const blinkData = blinkSpy.mock.calls[0][0];
    expect(blinkData).toHaveProperty('duration');
    expect(blinkData).toHaveProperty('strength');
  });
  
  it('should handle calibration workflow', async () => {
    // Setup event listeners
    const calibrationStartSpy = vi.fn();
    const calibrationCompleteSpy = vi.fn();
    subscribe('eye:calibration:started', calibrationStartSpy);
    subscribe('eye:calibration:completed', calibrationCompleteSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Trigger calibration
    publish('eye:calibration:start', { points: 5, speed: 'normal' });
    
    // Verify calibration started
    expect(calibrationStartSpy).toHaveBeenCalled();
    
    // Simulate calibration points
    for (let i = 0; i < 5; i++) {
      // Simulate gaze at calibration point
      publish('eye:gaze:raw', {
        leftEye: { x: 100 + i * 100, y: 100 + i * 50 },
        rightEye: { x: 150 + i * 100, y: 100 + i * 50 }
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Simulate calibration completion
    publish('eye:calibration:point:complete', { index: 4, isLast: true });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify calibration completed
    expect(calibrationCompleteSpy).toHaveBeenCalled();
    
    // Check calibration data
    const calibrationData = calibrationCompleteSpy.mock.calls[0][0];
    expect(calibrationData).toHaveProperty('accuracy');
    expect(calibrationData).toHaveProperty('mappingQuality');
  });
  
  it('should adapt to low memory conditions', async () => {
    // Setup event listener
    const adaptationSpy = vi.fn();
    subscribe('eye:tracking:adaptation', adaptationSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Simulate low memory condition
    const lowMemoryEvent = new Event('memory-pressure');
    lowMemoryEvent.pressure = 'critical';
    eventCallbacks['memory-pressure']?.[0]?.(lowMemoryEvent);
    
    // Wait for adaptation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify adaptation occurred
    expect(adaptationSpy).toHaveBeenCalled();
    
    // Check adaptation data
    const adaptationData = adaptationSpy.mock.calls[0][0];
    expect(adaptationData).toHaveProperty('processingInterval');
    expect(adaptationData.processingInterval).toBeGreaterThan(50); // Should increase from default 50ms
  });
  
  it('should properly apply accessibility settings', async () => {
    // Update biometrics with accessibility settings
    biometrics.updateConfig({
      eyeTracking: {
        accessibility: {
          highContrastMode: true,
          largerTargets: true,
          slowerAnimations: true,
          voicePrompts: true,
          extraTime: true
        }
      }
    });
    
    // Setup event listener
    const accessibilitySpy = vi.fn();
    subscribe('eye:accessibility:updated', accessibilitySpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify accessibility settings were applied
    expect(accessibilitySpy).toHaveBeenCalled();
    
    // Check accessibility data
    const accessibilityData = accessibilitySpy.mock.calls[0][0];
    expect(accessibilityData.highContrastMode).toBe(true);
    expect(accessibilityData.largerTargets).toBe(true);
    expect(accessibilityData.slowerAnimations).toBe(true);
    expect(accessibilityData.voicePrompts).toBe(true);
    expect(accessibilityData.extraTime).toBe(true);
  });
  
  it('should respect privacy modes', async () => {
    // Update biometrics with privacy mode
    biometrics.updateConfig({
      eyeTracking: {
        privacyMode: 'blur'
      }
    });
    
    // Setup event listener
    const privacySpy = vi.fn();
    subscribe('eye:privacy:updated', privacySpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify privacy mode was applied
    expect(privacySpy).toHaveBeenCalled();
    
    // Check privacy data
    const privacyData = privacySpy.mock.calls[0][0];
    expect(privacyData.mode).toBe('blur');
  });
  
  it('should properly stop eye tracking when biometrics stops', async () => {
    // Setup event listener
    const stopSpy = vi.fn();
    subscribe('eye:tracking:stopped', stopSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Wait for processing to start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Stop biometrics processing
    await biometrics.stopProcessing();
    
    // Verify eye tracking was stopped
    expect(stopSpy).toHaveBeenCalled();
  });
  
  it('should properly pause and resume eye tracking', async () => {
    // Setup event listeners
    const pauseSpy = vi.fn();
    const resumeSpy = vi.fn();
    subscribe('eye:tracking:paused', pauseSpy);
    subscribe('eye:tracking:resumed', resumeSpy);
    
    // Start biometrics processing
    await biometrics.startProcessing();
    
    // Wait for processing to start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Pause biometrics processing
    await biometrics.pauseProcessing();
    
    // Verify eye tracking was paused
    expect(pauseSpy).toHaveBeenCalled();
    
    // Resume biometrics processing
    await biometrics.resumeProcessing();
    
    // Verify eye tracking was resumed
    expect(resumeSpy).toHaveBeenCalled();
  });
});
