/**
 * ALEJO Vision-Voice Fusion Module Tests
 * 
 * This test suite validates the functionality of the vision-voice fusion module,
 * including event handling, fusion logic, and integration with security components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { visionVoiceFusion } from '../../../src/integration/fusion/vision-voice-fusion.js';
import { eventBus } from '../../../src/core/event-bus.js';

// Mock dependencies
vi.mock('../../../src/core/event-bus.js', () => ({
  eventBus: {
    on: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn(),
    off: vi.fn()
  }
}));

vi.mock('../../../src/security/audit-trail.js', () => ({
  auditTrail: {
    log: vi.fn()
  }
}));

vi.mock('../../../src/security/consent-manager.js', () => ({
  consentManager: {
    hasConsent: vi.fn().mockResolvedValue(true),
    requestConsent: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../../../src/personalization/vision/index.js', () => ({
  visionSystem: {
    initialize: vi.fn().mockResolvedValue({ success: true }),
    faceModel: {
      detectFace: vi.fn().mockResolvedValue(true)
    },
    expressionDetection: {
      analyzeExpression: vi.fn().mockResolvedValue(true)
    }
  }
}));

vi.mock('../../../src/personalization/voice/index.js', () => ({
  voiceSystem: {
    initialize: vi.fn().mockResolvedValue({ success: true })
  }
}));

describe('Vision-Voice Fusion Module', () => {
  // Reset mocks and module state before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset fusion module state
    visionVoiceFusion.isInitialized = false;
    visionVoiceFusion.config = { ...visionVoiceFusion.config };
    visionVoiceFusion.inputBuffers = {
      voice: [],
      vision: []
    };
    visionVoiceFusion.subscriptions = [];
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      const result = await visionVoiceFusion.initialize();
      
      expect(result).toBe(true);
      expect(visionVoiceFusion.isInitialized).toBe(true);
      
      // Should check for consent
      const consentManager = await import('../../../src/security/consent-manager.js');
      expect(consentManager.consentManager.hasConsent).toHaveBeenCalledWith([
        'voice_analysis',
        'expression_detection',
        'multimodal_fusion'
      ]);
      
      // Should subscribe to events
      const eventBusMock = await import('../../../src/core/event-bus.js');
      expect(eventBusMock.eventBus.on).toHaveBeenCalledTimes(6); // 3 voice events + 3 vision events
      
      // Should log initialization
      const auditTrailMock = await import('../../../src/security/audit-trail.js');
      expect(auditTrailMock.auditTrail.log).toHaveBeenCalledWith(
        'vision_voice_fusion_initialized',
        expect.any(Object)
      );
      
      // Should emit initialization event
      expect(eventBusMock.eventBus.emit).toHaveBeenCalledWith(
        'vision_voice_fusion_initialized',
        expect.any(Object)
      );
    });

    it('should initialize with custom config', async () => {
      const customConfig = {
        temporalWindow: 5000,
        confidenceThreshold: 0.8,
        modalityWeights: {
          voice: 0.7,
          vision: 0.3
        },
        bufferSize: 20
      };
      
      const result = await visionVoiceFusion.initialize(customConfig);
      
      expect(result).toBe(true);
      expect(visionVoiceFusion.config).toEqual(expect.objectContaining(customConfig));
    });

    it('should handle missing consent', async () => {
      // Mock consent denial
      const consentManager = await import('../../../src/security/consent-manager.js');
      consentManager.consentManager.hasConsent.mockResolvedValueOnce(false);
      
      const result = await visionVoiceFusion.initialize();
      
      expect(result).toBe(false);
      expect(visionVoiceFusion.isInitialized).toBe(false);
    });

    it('should handle initialization errors', async () => {
      // Mock a dependency failure
      const consentManager = await import('../../../src/security/consent-manager.js');
      consentManager.consentManager.hasConsent.mockRejectedValueOnce(new Error('Consent check failed'));
      
      await expect(visionVoiceFusion.initialize()).rejects.toThrow('Vision-Voice fusion initialization failed');
      
      // Should log error
      const auditTrailMock = await import('../../../src/security/audit-trail.js');
      expect(auditTrailMock.auditTrail.log).toHaveBeenCalledWith(
        'vision_voice_fusion_error',
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should prevent duplicate initialization', async () => {
      // First initialization
      await visionVoiceFusion.initialize();
      
      // Clear mocks to check if they're called again
      vi.clearAllMocks();
      
      // Second initialization
      const result = await visionVoiceFusion.initialize();
      
      expect(result).toBe(true);
      
      // Should not subscribe to events again
      const eventBusMock = await import('../../../src/core/event-bus.js');
      expect(eventBusMock.eventBus.on).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await visionVoiceFusion.initialize();
      vi.clearAllMocks(); // Clear initialization events
    });

    it('should handle voice emotion events', () => {
      const voiceEmotionData = {
        dominant: 'happy',
        confidence: 0.8,
        emotions: {
          neutral: 0.2,
          happy: 0.7,
          sad: 0.1
        }
      };
      
      // Simulate voice emotion event
      visionVoiceFusion._handleVoiceEmotion(voiceEmotionData);
      
      // Check if added to buffer
      expect(visionVoiceFusion.inputBuffers.voice.length).toBe(1);
      expect(visionVoiceFusion.inputBuffers.voice[0].type).toBe('emotion');
      expect(visionVoiceFusion.inputBuffers.voice[0].data).toBe(voiceEmotionData);
    });

    it('should handle facial expression events', () => {
      const expressionData = {
        dominant: 'neutral',
        confidence: 0.9,
        expressions: {
          neutral: 0.8,
          happy: 0.1,
          sad: 0.1
        }
      };
      
      // Simulate expression event
      visionVoiceFusion._handleFacialExpression(expressionData);
      
      // Check if added to buffer
      expect(visionVoiceFusion.inputBuffers.vision.length).toBe(1);
      expect(visionVoiceFusion.inputBuffers.vision[0].type).toBe('expression');
      expect(visionVoiceFusion.inputBuffers.vision[0].data).toBe(expressionData);
    });

    it('should handle voice command events', () => {
      const commandData = {
        command: 'open menu',
        parameters: {},
        confidence: 0.85
      };
      
      // Simulate voice command event
      visionVoiceFusion._handleVoiceCommand(commandData);
      
      // Check if added to buffer
      expect(visionVoiceFusion.inputBuffers.voice.length).toBe(1);
      expect(visionVoiceFusion.inputBuffers.voice[0].type).toBe('command');
      expect(visionVoiceFusion.inputBuffers.voice[0].data).toBe(commandData);
    });

    it('should handle verification events', () => {
      const voiceVerificationData = {
        userId: 'test-user',
        isVerified: true,
        confidence: 0.9
      };
      
      const faceVerificationData = {
        userId: 'test-user',
        isVerified: true,
        confidence: 0.85
      };
      
      // Simulate verification events
      visionVoiceFusion._handleVoiceVerification(voiceVerificationData);
      visionVoiceFusion._handleFaceVerification(faceVerificationData);
      
      // Check if added to buffers
      expect(visionVoiceFusion.inputBuffers.voice.length).toBe(1);
      expect(visionVoiceFusion.inputBuffers.voice[0].type).toBe('verification');
      expect(visionVoiceFusion.inputBuffers.voice[0].data).toBe(voiceVerificationData);
      
      expect(visionVoiceFusion.inputBuffers.vision.length).toBe(1);
      expect(visionVoiceFusion.inputBuffers.vision[0].type).toBe('verification');
      expect(visionVoiceFusion.inputBuffers.vision[0].data).toBe(faceVerificationData);
    });

    it('should limit buffer size', () => {
      // Set small buffer size for testing
      visionVoiceFusion.config.bufferSize = 3;
      
      // Add more items than buffer size
      for (let i = 0; i < 5; i++) {
        visionVoiceFusion._addToBuffer('voice', {
          type: 'emotion',
          timestamp: Date.now(),
          data: { id: i }
        });
      }
      
      // Buffer should be limited to configured size
      expect(visionVoiceFusion.inputBuffers.voice.length).toBe(3);
      
      // Should contain the most recent items (2, 3, 4)
      expect(visionVoiceFusion.inputBuffers.voice[0].data.id).toBe(2);
      expect(visionVoiceFusion.inputBuffers.voice[1].data.id).toBe(3);
      expect(visionVoiceFusion.inputBuffers.voice[2].data.id).toBe(4);
    });
  });

  describe('Fusion Logic', () => {
    beforeEach(async () => {
      await visionVoiceFusion.initialize();
      
      // Mock Date.now to return consistent timestamps
      const now = 1625097600000; // 2021-07-01T00:00:00.000Z
      vi.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fuse emotional state from voice and vision inputs', () => {
      // Add voice emotion to buffer
      visionVoiceFusion._addToBuffer('voice', {
        type: 'emotion',
        timestamp: Date.now(),
        data: {
          dominant: 'happy',
          confidence: 0.8,
          emotions: {
            neutral: 0.2,
            happy: 0.7,
            sad: 0.1
          }
        }
      });
      
      // Add facial expression to buffer
      visionVoiceFusion._addToBuffer('vision', {
        type: 'expression',
        timestamp: Date.now(),
        data: {
          dominant: 'neutral',
          confidence: 0.9,
          expressions: {
            neutral: 0.8,
            happy: 0.1,
            sad: 0.1
          }
        }
      });
      
      // Spy on fusion methods
      const fuseSpy = vi.spyOn(visionVoiceFusion, '_fuseEmotionalState');
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should call emotional fusion
      expect(fuseSpy).toHaveBeenCalled();
      
      // Should emit fused emotional state
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'fused_emotional_state',
        expect.objectContaining({
          dominant: expect.any(String),
          confidence: expect.any(Number),
          all: expect.any(Object)
        })
      );
      
      // Should log fusion
      const auditTrailMock = require('../../../src/security/audit-trail.js').auditTrail;
      expect(auditTrailMock.log).toHaveBeenCalledWith(
        'emotional_fusion_completed',
        expect.any(Object)
      );
    });

    it('should fuse identity verification from voice and vision inputs', () => {
      // Add voice verification to buffer
      visionVoiceFusion._addToBuffer('voice', {
        type: 'verification',
        timestamp: Date.now(),
        data: {
          userId: 'test-user',
          isVerified: true,
          confidence: 0.8
        }
      });
      
      // Add face verification to buffer
      visionVoiceFusion._addToBuffer('vision', {
        type: 'verification',
        timestamp: Date.now(),
        data: {
          userId: 'test-user',
          isVerified: true,
          confidence: 0.9
        }
      });
      
      // Spy on fusion methods
      const fuseSpy = vi.spyOn(visionVoiceFusion, '_fuseIdentityVerification');
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should call identity verification fusion
      expect(fuseSpy).toHaveBeenCalled();
      
      // Should emit fused verification
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'fused_identity_verification',
        expect.objectContaining({
          userId: 'test-user',
          isVerified: true,
          confidence: expect.any(Number)
        })
      );
    });

    it('should fuse command intent with emotional context', () => {
      // Add voice command to buffer
      visionVoiceFusion._addToBuffer('voice', {
        type: 'command',
        timestamp: Date.now(),
        data: {
          command: 'open menu',
          parameters: {},
          confidence: 0.85
        }
      });
      
      // Add facial expression to buffer
      visionVoiceFusion._addToBuffer('vision', {
        type: 'expression',
        timestamp: Date.now(),
        data: {
          dominant: 'happy',
          confidence: 0.9,
          expressions: {
            neutral: 0.2,
            happy: 0.7,
            sad: 0.1
          }
        }
      });
      
      // Spy on fusion methods
      const fuseSpy = vi.spyOn(visionVoiceFusion, '_fuseCommandIntent');
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should call command intent fusion
      expect(fuseSpy).toHaveBeenCalled();
      
      // Should emit fused command intent
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'fused_command_intent',
        expect.objectContaining({
          command: 'open menu',
          emotionalContext: 'happy'
        })
      );
    });

    it('should not fuse if inputs are outside temporal window', () => {
      const now = Date.now();
      
      // Add voice emotion to buffer (outside temporal window)
      visionVoiceFusion._addToBuffer('voice', {
        type: 'emotion',
        timestamp: now - visionVoiceFusion.config.temporalWindow - 1000, // 1 second outside window
        data: {
          dominant: 'happy',
          confidence: 0.8
        }
      });
      
      // Add facial expression to buffer (within temporal window)
      visionVoiceFusion._addToBuffer('vision', {
        type: 'expression',
        timestamp: now,
        data: {
          dominant: 'neutral',
          confidence: 0.9
        }
      });
      
      // Spy on fusion methods
      const fuseSpy = vi.spyOn(visionVoiceFusion, '_fuseEmotionalState');
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should not call emotional fusion
      expect(fuseSpy).not.toHaveBeenCalled();
      
      // Should not emit any fusion events
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).not.toHaveBeenCalledWith('fused_emotional_state', expect.any(Object));
    });

    it('should not fuse if confidence is below threshold', () => {
      // Set high confidence threshold
      visionVoiceFusion.config.confidenceThreshold = 0.9;
      
      // Add voice emotion to buffer (below threshold)
      visionVoiceFusion._addToBuffer('voice', {
        type: 'emotion',
        timestamp: Date.now(),
        data: {
          dominant: 'happy',
          confidence: 0.8, // Below threshold
          emotions: {
            neutral: 0.2,
            happy: 0.7,
            sad: 0.1
          }
        }
      });
      
      // Add facial expression to buffer
      visionVoiceFusion._addToBuffer('vision', {
        type: 'expression',
        timestamp: Date.now(),
        data: {
          dominant: 'neutral',
          confidence: 0.95, // Above threshold
          expressions: {
            neutral: 0.8,
            happy: 0.1,
            sad: 0.1
          }
        }
      });
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should not emit fused emotional state
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).not.toHaveBeenCalledWith('fused_emotional_state', expect.any(Object));
    });

    it('should not fuse verification for different users', () => {
      // Add voice verification to buffer
      visionVoiceFusion._addToBuffer('voice', {
        type: 'verification',
        timestamp: Date.now(),
        data: {
          userId: 'user-1',
          isVerified: true,
          confidence: 0.8
        }
      });
      
      // Add face verification to buffer (different user)
      visionVoiceFusion._addToBuffer('vision', {
        type: 'verification',
        timestamp: Date.now(),
        data: {
          userId: 'user-2', // Different user
          isVerified: true,
          confidence: 0.9
        }
      });
      
      // Attempt fusion
      visionVoiceFusion._attemptFusion();
      
      // Should not emit fused verification
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).not.toHaveBeenCalledWith('fused_identity_verification', expect.any(Object));
    });
  });

  describe('Utility Functions', () => {
    it('should map voice emotions to common format', () => {
      const voiceEmotion = {
        emotions: {
          neutral: 0.6,
          happy: 0.3,
          angry: 0.1
        }
      };
      
      const mapped = visionVoiceFusion._mapVoiceEmotionToCommonFormat(voiceEmotion);
      
      expect(mapped).toEqual({
        neutral: 0.6,
        happy: 0.3,
        sad: 0,
        angry: 0.1,
        fearful: 0,
        disgusted: 0,
        surprised: 0
      });
    });

    it('should map vision expressions to common format', () => {
      const visionExpression = {
        expressions: {
          neutral: 0.5,
          happy: 0.2,
          surprised: 0.3
        }
      };
      
      const mapped = visionVoiceFusion._mapVisionExpressionToCommonFormat(visionExpression);
      
      expect(mapped).toEqual({
        neutral: 0.5,
        happy: 0.2,
        sad: 0,
        angry: 0,
        fearful: 0,
        disgusted: 0,
        surprised: 0.3
      });
    });

    it('should perform weighted fusion of objects', () => {
      const obj1 = {
        a: 0.7,
        b: 0.2,
        c: 0.1
      };
      
      const obj2 = {
        a: 0.3,
        b: 0.6,
        d: 0.1
      };
      
      const weight1 = 0.6;
      const weight2 = 0.4;
      
      const fused = visionVoiceFusion._weightedFusion(obj1, obj2, weight1, weight2);
      
      // Expected values with normalized weights
      expect(fused.a).toBeCloseTo(0.7 * 0.6 + 0.3 * 0.4, 5);
      expect(fused.b).toBeCloseTo(0.2 * 0.6 + 0.6 * 0.4, 5);
      expect(fused.c).toBeCloseTo(0.1 * 0.6, 5);
      expect(fused.d).toBeCloseTo(0.1 * 0.4, 5);
    });
  });

  describe('Reset and Shutdown', () => {
    beforeEach(async () => {
      await visionVoiceFusion.initialize();
      
      // Add some data to buffers
      visionVoiceFusion._addToBuffer('voice', {
        type: 'emotion',
        timestamp: Date.now(),
        data: { dominant: 'happy' }
      });
      
      visionVoiceFusion._addToBuffer('vision', {
        type: 'expression',
        timestamp: Date.now(),
        data: { dominant: 'neutral' }
      });
      
      vi.clearAllMocks(); // Clear initialization events
    });

    it('should reset fusion state', () => {
      const result = visionVoiceFusion.reset();
      
      expect(result).toBe(true);
      expect(visionVoiceFusion.inputBuffers.voice).toEqual([]);
      expect(visionVoiceFusion.inputBuffers.vision).toEqual([]);
      
      // Should emit reset event
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'vision_voice_fusion_reset',
        expect.any(Object)
      );
      
      // Should log reset
      const auditTrailMock = require('../../../src/security/audit-trail.js').auditTrail;
      expect(auditTrailMock.log).toHaveBeenCalledWith(
        'vision_voice_fusion_reset',
        expect.any(Object)
      );
    });

    it('should shutdown fusion module', async () => {
      // Mock unsubscribe function
      visionVoiceFusion._unsubscribeFromEvents = vi.fn();
      
      const result = await visionVoiceFusion.shutdown();
      
      expect(result).toBe(true);
      expect(visionVoiceFusion.isInitialized).toBe(false);
      expect(visionVoiceFusion._unsubscribeFromEvents).toHaveBeenCalled();
      
      // Should emit shutdown event
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'vision_voice_fusion_shutdown',
        expect.any(Object)
      );
      
      // Should log shutdown
      const auditTrailMock = require('../../../src/security/audit-trail.js').auditTrail;
      expect(auditTrailMock.log).toHaveBeenCalledWith(
        'vision_voice_fusion_shutdown',
        expect.any(Object)
      );
    });

    it('should handle shutdown when not initialized', async () => {
      visionVoiceFusion.isInitialized = false;
      
      const result = await visionVoiceFusion.shutdown();
      
      expect(result).toBe(true);
      
      // Should not emit or log anything
      const eventBusMock = eventBus;
      expect(eventBusMock.emit).not.toHaveBeenCalled();
    });
  });
});
