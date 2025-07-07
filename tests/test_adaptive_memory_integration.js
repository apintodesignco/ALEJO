/**
 * Tests for the Adaptive Memory Integration module
 */

import { expect } from 'chai';
import sinon from 'sinon';

import { AdaptiveMemoryIntegration } from '../src/personalization/accessibility/adaptive-memory-integration.js';
import { AccessibilityMemoryBridge } from '../src/personalization/accessibility/accessibility-memory-bridge.js';
import { MultimodalFusionSystem } from '../src/personalization/accessibility/multimodal-fusion.js';
import { publish } from '../src/core/events.js';

describe('AdaptiveMemoryIntegration', () => {
  let integration;
  let memoryBridge;
  let fusionSystem;
  let clock;
  
  beforeEach(() => {
    // Set up clock for timers
    clock = sinon.useFakeTimers();
    
    // Create stubs for dependencies
    memoryBridge = {
      isInitialized: true,
      initialize: sinon.stub().resolves(),
      getPreferredSettings: sinon.stub().resolves({ dwell_time: 1000 }),
      getAdaptationRecommendations: sinon.stub().resolves([
        {
          feature_id: 'dwell_click',
          modality: 'visual',
          effectiveness: 0.4,
          frequency: 3
        }
      ]),
      recordSuccessfulAdaptation: sinon.stub().resolves(true)
    };
    
    fusionSystem = {
      getModalityStatuses: sinon.stub().returns({
        visual: { available: true, confidence: 0.9 },
        auditory: { available: true, confidence: 0.8 },
        motor: { available: false, confidence: 0.2 }
      })
    };
    
    // Create test instance with stubs
    integration = new AdaptiveMemoryIntegration({
      adaptationInterval: 1000, // 1 second for testing
      contextUpdateInterval: 500, // 0.5 seconds for testing
      memoryBridge,
      fusionSystem
    });
    
    // Replace the real memory bridge with our stub
    integration.memoryBridge = memoryBridge;
  });
  
  afterEach(() => {
    // Restore clock
    clock.restore();
    
    // Clean up
    if (integration.isRunning) {
      return integration.stop();
    }
  });
  
  describe('#start', () => {
    it('should initialize the memory bridge if not initialized', async () => {
      // Set bridge to not initialized
      integration.memoryBridge.isInitialized = false;
      
      await integration.start();
      
      expect(memoryBridge.initialize.calledOnce).to.be.true;
      expect(integration.isRunning).to.be.true;
    });
    
    it('should not initialize the memory bridge if already initialized', async () => {
      // Set bridge to initialized
      integration.memoryBridge.isInitialized = true;
      
      await integration.start();
      
      expect(memoryBridge.initialize.called).to.be.false;
      expect(integration.isRunning).to.be.true;
    });
    
    it('should start timers for adaptation and context updates', async () => {
      await integration.start();
      
      expect(integration.adaptationTimer).to.not.be.null;
      expect(integration.contextTimer).to.not.be.null;
    });
    
    it('should check for adaptations immediately on start', async () => {
      const spy = sinon.spy(integration, '_checkForAdaptations');
      
      await integration.start();
      
      expect(spy.calledOnce).to.be.true;
    });
  });
  
  describe('#stop', () => {
    it('should clear timers and mark as not running', async () => {
      await integration.start();
      await integration.stop();
      
      expect(integration.adaptationTimer).to.be.null;
      expect(integration.contextTimer).to.be.null;
      expect(integration.isRunning).to.be.false;
    });
  });
  
  describe('event handling', () => {
    beforeEach(async () => {
      await integration.start();
    });
    
    it('should handle feature state changes', () => {
      const spy = sinon.spy(global, 'publish');
      
      // Simulate feature state change event
      integration._handleFeatureStateChanged({
        featureId: 'eye_tracking',
        state: 'enabled',
        modality: 'visual'
      });
      
      expect(integration.featureStates.has('eye_tracking')).to.be.true;
      expect(integration.featureStates.get('eye_tracking').state).to.equal('enabled');
      expect(integration.featureStates.get('eye_tracking').modality).to.equal('visual');
      
      // Should publish feature used event
      expect(spy.calledWith('accessibility:feature:used')).to.be.true;
      
      spy.restore();
    });
    
    it('should handle adaptation applied events', async () => {
      // Simulate adaptation applied event
      await integration._handleAdaptationApplied({
        featureId: 'voice_commands',
        modality: 'auditory',
        settings: { volume: 0.8 },
        success: true
      });
      
      expect(memoryBridge.recordSuccessfulAdaptation.calledOnce).to.be.true;
      expect(integration.adaptationHistory.length).to.equal(1);
      expect(integration.adaptationHistory[0].featureId).to.equal('voice_commands');
    });
    
    it('should handle user profile updates', async () => {
      const spy = sinon.spy(integration, '_checkForAdaptations');
      
      // Simulate user profile update event
      await integration._handleUserProfileUpdated({
        profile: {
          mobility: 'limited',
          preferences: { high_contrast: true }
        }
      });
      
      expect(integration.currentContext.mobility_profile).to.equal('limited');
      expect(integration.currentContext.user_preferences.high_contrast).to.be.true;
      expect(spy.calledOnce).to.be.true;
      
      spy.restore();
    });
    
    it('should handle environment changes', async () => {
      const spy = sinon.spy(global, 'publish');
      const adaptationSpy = sinon.spy(integration, '_checkForAdaptations');
      
      // Simulate environment change event
      await integration._handleEnvironmentChange({
        environment: {
          lighting: 'dim',
          noise_level: 'high'
        }
      });
      
      expect(integration.currentContext.environment_lighting).to.equal('dim');
      expect(integration.currentContext.environment_noise_level).to.equal('high');
      expect(spy.calledWith('user:context:changed')).to.be.true;
      expect(adaptationSpy.calledOnce).to.be.true;
      
      spy.restore();
      adaptationSpy.restore();
    });
    
    it('should handle modality status changes', async () => {
      const adaptationSpy = sinon.spy(integration, '_checkForAdaptations');
      
      // Simulate modality status change event
      await integration._handleModalityStatusChanged({
        modality: 'motor',
        status: 'unavailable',
        confidence: 0.1
      });
      
      expect(integration.currentContext.modality_motor_status).to.equal('unavailable');
      expect(integration.currentContext.modality_motor_confidence).to.equal(0.1);
      expect(adaptationSpy.calledOnce).to.be.true;
      
      adaptationSpy.restore();
    });
  });
  
  describe('adaptation checking', () => {
    beforeEach(async () => {
      await integration.start();
    });
    
    it('should check for adaptations on timer', async () => {
      const spy = sinon.spy(integration, '_checkForAdaptations');
      
      // Fast-forward time
      clock.tick(1100); // Just over 1 second
      
      expect(spy.calledTwice).to.be.true; // Once on start, once on timer
      
      spy.restore();
    });
    
    it('should process adaptation recommendations', async () => {
      const processSpy = sinon.spy(integration, '_processAdaptationRecommendation');
      
      await integration._checkForAdaptations();
      
      expect(memoryBridge.getAdaptationRecommendations.calledOnce).to.be.true;
      expect(processSpy.calledOnce).to.be.true;
      
      processSpy.restore();
    });
    
    it('should request adaptations for recommendations', async () => {
      const publishSpy = sinon.spy(global, 'publish');
      
      // Clear adaptation history to ensure processing
      integration.adaptationHistory = [];
      
      await integration._processAdaptationRecommendation({
        feature_id: 'dwell_click',
        modality: 'visual',
        effectiveness: 0.4
      });
      
      expect(memoryBridge.getPreferredSettings.calledOnce).to.be.true;
      expect(publishSpy.calledWith('accessibility:adaptation:requested')).to.be.true;
      
      publishSpy.restore();
    });
    
    it('should skip recently adapted features', async () => {
      const publishSpy = sinon.spy(global, 'publish');
      
      // Add recent adaptation to history
      integration.adaptationHistory.push({
        featureId: 'dwell_click',
        modality: 'visual',
        settings: { dwell_time: 1000 },
        timestamp: Date.now()
      });
      
      await integration._processAdaptationRecommendation({
        feature_id: 'dwell_click',
        modality: 'visual',
        effectiveness: 0.4
      });
      
      expect(memoryBridge.getPreferredSettings.called).to.be.false;
      expect(publishSpy.calledWith('accessibility:adaptation:requested')).to.be.false;
      
      publishSpy.restore();
    });
  });
  
  describe('context updates', () => {
    beforeEach(async () => {
      await integration.start();
    });
    
    it('should update context on timer', async () => {
      const spy = sinon.spy(integration, '_updateCurrentContext');
      
      // Fast-forward time
      clock.tick(600); // Just over 0.5 seconds
      
      expect(spy.calledOnce).to.be.true;
      
      spy.restore();
    });
    
    it('should get system context', async () => {
      const context = await integration._getSystemContext();
      
      expect(context).to.have.property('time_of_day');
      expect(context).to.have.property('modality_visual_available', true);
      expect(context).to.have.property('modality_motor_available', false);
    });
  });
  
  describe('public API', () => {
    beforeEach(async () => {
      await integration.start();
    });
    
    it('should get preferred settings', async () => {
      const settings = await integration.getPreferredSettings('dwell_click', 'visual');
      
      expect(memoryBridge.getPreferredSettings.calledOnce).to.be.true;
      expect(settings).to.deep.equal({ dwell_time: 1000 });
    });
    
    it('should get current context', () => {
      integration.currentContext = {
        time_of_day: 'morning',
        mobility_profile: 'limited'
      };
      
      const context = integration.getCurrentContext();
      
      expect(context).to.deep.equal(integration.currentContext);
      expect(context).to.not.equal(integration.currentContext); // Should be a copy
    });
    
    it('should get adaptation history', () => {
      integration.adaptationHistory = [
        {
          featureId: 'eye_tracking',
          modality: 'visual',
          timestamp: Date.now()
        }
      ];
      
      const history = integration.getAdaptationHistory();
      
      expect(history).to.deep.equal(integration.adaptationHistory);
      expect(history).to.not.equal(integration.adaptationHistory); // Should be a copy
    });
    
    it('should force adaptation check', async () => {
      const spy = sinon.spy(integration, '_checkForAdaptations');
      
      await integration.forceAdaptationCheck();
      
      expect(spy.calledOnce).to.be.true;
      
      spy.restore();
    });
  });
});
