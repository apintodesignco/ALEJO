/**
 * ALEJO Eye Tracking Unit Tests
 * 
 * Tests the core functionality of the eye tracking module including:
 * - Initialization
 * - Gaze estimation
 * - Blink detection
 * - Calibration
 * - Accessibility features
 * - Privacy modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  initialize, 
  processEyeData, 
  startCalibration, 
  cancelCalibration, 
  updateAccessibilitySettings,
  setPrivacyMode,
  getGazePoint,
  isBlinking,
  calculateEyeOpenness,
  detectSaccade
} from '../../src/biometrics/eye/eye-processor';

// Mock face-api.js
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

// Mock event system
vi.mock('../../src/events', () => {
  const events = {};
  
  return {
    publish: vi.fn((event, data) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].forEach(callback => callback(data));
    }),
    subscribe: vi.fn((event, callback) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(callback);
      return () => {
        events[event] = events[event].filter(cb => cb !== callback);
      };
    }),
    unsubscribe: vi.fn((event, callback) => {
      if (events[event]) {
        events[event] = events[event].filter(cb => cb !== callback);
      }
    })
  };
});

describe('Eye Tracking Unit Tests', () => {
  // Default configuration for testing
  const defaultConfig = {
    processingInterval: 50,
    debugMode: false,
    privacyMode: 'none',
    accessibility: {
      highContrastMode: false,
      largerTargets: false,
      slowerAnimations: false,
      voicePrompts: false,
      extraTime: false
    }
  };
  
  // Mock eye landmarks
  const mockOpenEyes = {
    leftEye: [
      { x: 200, y: 200 },
      { x: 210, y: 200 },
      { x: 220, y: 200 },
      { x: 230, y: 200 },
      { x: 220, y: 210 },
      { x: 210, y: 210 }
    ],
    rightEye: [
      { x: 300, y: 200 },
      { x: 310, y: 200 },
      { x: 320, y: 200 },
      { x: 330, y: 200 },
      { x: 320, y: 210 },
      { x: 310, y: 210 }
    ]
  };
  
  const mockClosedEyes = {
    leftEye: [
      { x: 200, y: 205 },
      { x: 210, y: 205 },
      { x: 220, y: 205 },
      { x: 230, y: 205 },
      { x: 220, y: 205 },
      { x: 210, y: 205 }
    ],
    rightEye: [
      { x: 300, y: 205 },
      { x: 310, y: 205 },
      { x: 320, y: 205 },
      { x: 330, y: 205 },
      { x: 320, y: 205 },
      { x: 310, y: 205 }
    ]
  };
  
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Initialize eye tracking
    await initialize(defaultConfig);
  });
  
  afterEach(() => {
    // Clean up
    vi.resetModules();
  });
  
  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const result = await initialize(defaultConfig);
      expect(result).toBe(true);
    });
    
    it('should handle initialization errors gracefully', async () => {
      // Mock face-api.js to throw an error
      const faceApi = await import('face-api.js');
      faceApi.nets.tinyFaceDetector.loadFromUri.mockRejectedValueOnce(new Error('Failed to load model'));
      
      // Should not throw but return false
      const result = await initialize(defaultConfig);
      expect(result).toBe(false);
    });
  });
  
  describe('Eye Openness Calculation', () => {
    it('should calculate eye openness correctly for open eyes', () => {
      const openness = calculateEyeOpenness(mockOpenEyes.leftEye);
      expect(openness).toBeGreaterThan(0.5);
    });
    
    it('should calculate eye openness correctly for closed eyes', () => {
      const openness = calculateEyeOpenness(mockClosedEyes.leftEye);
      expect(openness).toBeLessThan(0.3);
    });
  });
  
  describe('Blink Detection', () => {
    it('should detect when eyes are blinking', () => {
      const blinking = isBlinking(mockClosedEyes.leftEye, mockClosedEyes.rightEye);
      expect(blinking).toBe(true);
    });
    
    it('should detect when eyes are open', () => {
      const blinking = isBlinking(mockOpenEyes.leftEye, mockOpenEyes.rightEye);
      expect(blinking).toBe(false);
    });
    
    it('should handle asymmetric blinks (winks)', () => {
      const blinking = isBlinking(mockClosedEyes.leftEye, mockOpenEyes.rightEye);
      expect(blinking).toBe(false); // Not considered a full blink
    });
  });
  
  describe('Gaze Estimation', () => {
    it('should estimate gaze point correctly', () => {
      const gazePoint = getGazePoint(mockOpenEyes.leftEye, mockOpenEyes.rightEye);
      
      expect(gazePoint).toHaveProperty('x');
      expect(gazePoint).toHaveProperty('y');
      expect(gazePoint).toHaveProperty('confidence');
      
      // Gaze should be roughly between the eyes
      expect(gazePoint.x).toBeGreaterThan(200);
      expect(gazePoint.x).toBeLessThan(330);
    });
    
    it('should have lower confidence when eyes are nearly closed', () => {
      const gazePoint = getGazePoint(mockClosedEyes.leftEye, mockClosedEyes.rightEye);
      
      expect(gazePoint.confidence).toBeLessThan(0.5);
    });
  });
  
  describe('Saccade Detection', () => {
    it('should detect rapid eye movements (saccades)', () => {
      // First position
      const position1 = getGazePoint(mockOpenEyes.leftEye, mockOpenEyes.rightEye);
      
      // Second position (shifted right)
      const shiftedEyes = {
        leftEye: mockOpenEyes.leftEye.map(p => ({ x: p.x + 50, y: p.y })),
        rightEye: mockOpenEyes.rightEye.map(p => ({ x: p.x + 50, y: p.y }))
      };
      
      const position2 = getGazePoint(shiftedEyes.leftEye, shiftedEyes.rightEye);
      
      // Detect saccade
      const saccade = detectSaccade(position1, position2, 16); // 16ms = fast movement
      
      expect(saccade).toBe(true);
    });
    
    it('should not detect saccades for slow eye movements', () => {
      // First position
      const position1 = getGazePoint(mockOpenEyes.leftEye, mockOpenEyes.rightEye);
      
      // Second position (slightly shifted)
      const shiftedEyes = {
        leftEye: mockOpenEyes.leftEye.map(p => ({ x: p.x + 5, y: p.y })),
        rightEye: mockOpenEyes.rightEye.map(p => ({ x: p.x + 5, y: p.y }))
      };
      
      const position2 = getGazePoint(shiftedEyes.leftEye, shiftedEyes.rightEye);
      
      // Detect saccade with longer time interval (slow movement)
      const saccade = detectSaccade(position1, position2, 100);
      
      expect(saccade).toBe(false);
    });
  });
  
  describe('Calibration', () => {
    it('should start calibration process', () => {
      const { publish } = require('../../src/events');
      
      const result = startCalibration({ points: 5, speed: 'normal' });
      
      expect(result).toBe(true);
      expect(publish).toHaveBeenCalledWith('eye:calibration:started', expect.any(Object));
    });
    
    it('should cancel calibration process', () => {
      const { publish } = require('../../src/events');
      
      // Start calibration first
      startCalibration({ points: 5, speed: 'normal' });
      
      // Then cancel it
      const result = cancelCalibration();
      
      expect(result).toBe(true);
      expect(publish).toHaveBeenCalledWith('eye:calibration:canceled', expect.any(Object));
    });
  });
  
  describe('Accessibility Features', () => {
    it('should update accessibility settings', () => {
      const { publish } = require('../../src/events');
      
      const settings = {
        highContrastMode: true,
        largerTargets: true,
        slowerAnimations: true,
        voicePrompts: true,
        extraTime: true
      };
      
      const result = updateAccessibilitySettings(settings);
      
      expect(result).toBe(true);
      expect(publish).toHaveBeenCalledWith('eye:accessibility:updated', settings);
    });
  });
  
  describe('Privacy Modes', () => {
    it('should set privacy mode', () => {
      const { publish } = require('../../src/events');
      
      const result = setPrivacyMode('blur');
      
      expect(result).toBe(true);
      expect(publish).toHaveBeenCalledWith('eye:privacy:updated', { mode: 'blur' });
    });
    
    it('should validate privacy mode values', () => {
      // Invalid mode should return false
      const result = setPrivacyMode('invalid-mode');
      
      expect(result).toBe(false);
    });
  });
  
  describe('Eye Data Processing', () => {
    it('should process eye data and emit events', async () => {
      const { publish } = require('../../src/events');
      
      const result = await processEyeData({
        leftEye: mockOpenEyes.leftEye,
        rightEye: mockOpenEyes.rightEye,
        timestamp: Date.now()
      });
      
      expect(result).toBe(true);
      expect(publish).toHaveBeenCalledWith('eye:gaze:updated', expect.any(Object));
    });
    
    it('should detect and publish blink events', async () => {
      const { publish } = require('../../src/events');
      
      // First process open eyes
      await processEyeData({
        leftEye: mockOpenEyes.leftEye,
        rightEye: mockOpenEyes.rightEye,
        timestamp: Date.now()
      });
      
      // Then process closed eyes
      await processEyeData({
        leftEye: mockClosedEyes.leftEye,
        rightEye: mockClosedEyes.rightEye,
        timestamp: Date.now() + 50
      });
      
      // Then process open eyes again
      await processEyeData({
        leftEye: mockOpenEyes.leftEye,
        rightEye: mockOpenEyes.rightEye,
        timestamp: Date.now() + 100
      });
      
      // Should have published a blink event
      expect(publish).toHaveBeenCalledWith('eye:blink:detected', expect.any(Object));
    });
  });
});
