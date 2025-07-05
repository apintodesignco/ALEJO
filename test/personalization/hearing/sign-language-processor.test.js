/**
 * @file sign-language-processor.test.js
 * @description Unit and integration tests for the Sign Language Processor component
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { SignLanguageProcessor } from '../../../src/personalization/hearing/sign-language-processor';
import { AuditTrail } from '../../../src/utils/audit-trail';

describe('Sign Language Processor', () => {
  let signLanguageProcessor;
  let dom;
  let document;
  let window;
  let auditTrailStub;
  let mockVideoElement;
  let mockCanvasElement;
  
  beforeEach(() => {
    // Set up a DOM environment for testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <div id="alejo-container">
        <video id="video-input"></video>
        <canvas id="hand-tracking-canvas"></canvas>
        <div id="avatar-container"></div>
      </div>
    `);
    window = dom.window;
    document = window.document;
    
    // Stub the global document and window
    global.document = document;
    global.window = window;
    
    // Mock video and canvas elements
    mockVideoElement = document.getElementById('video-input');
    mockCanvasElement = document.getElementById('hand-tracking-canvas');
    
    // Stub the audit trail
    auditTrailStub = sinon.stub(AuditTrail, 'log');
    
    // Create a new instance of the sign language processor
    signLanguageProcessor = new SignLanguageProcessor({
      videoElement: mockVideoElement,
      canvasElement: mockCanvasElement,
      avatarContainer: document.getElementById('avatar-container'),
      language: 'ASL',
      recognitionConfidence: 0.7,
      enableFingerspelling: true
    });
  });
  
  afterEach(() => {
    // Clean up
    auditTrailStub.restore();
    delete global.document;
    delete global.window;
    
    // If there are any timers or event listeners, clean them up
    if (signLanguageProcessor.cleanup) {
      signLanguageProcessor.cleanup();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings when no options are provided', () => {
      const defaultProcessor = new SignLanguageProcessor();
      expect(defaultProcessor.language).to.equal('ASL');
      expect(defaultProcessor.recognitionConfidence).to.equal(0.8);
      expect(defaultProcessor.enableFingerspelling).to.be.true;
    });
    
    it('should initialize with custom settings when options are provided', () => {
      expect(signLanguageProcessor.language).to.equal('ASL');
      expect(signLanguageProcessor.recognitionConfidence).to.equal(0.7);
      expect(signLanguageProcessor.enableFingerspelling).to.be.true;
    });
    
    it('should create necessary DOM elements if not provided', () => {
      const minimalProcessor = new SignLanguageProcessor({
        videoElement: null,
        canvasElement: null,
        avatarContainer: null
      });
      
      // Check if elements were created
      expect(document.querySelector('.alejo-sign-language-video')).to.not.be.null;
      expect(document.querySelector('.alejo-hand-tracking-canvas')).to.not.be.null;
      expect(document.querySelector('.alejo-sign-avatar-container')).to.not.be.null;
    });
    
    it('should log initialization to audit trail', () => {
      expect(auditTrailStub.calledWith('ACCESSIBILITY', 'Sign Language Processor initialized')).to.be.true;
    });
    
    it('should load sign dictionary for the specified language', () => {
      expect(signLanguageProcessor.signDictionary).to.not.be.undefined;
      expect(signLanguageProcessor.signDictionary.ASL).to.not.be.undefined;
    });
  });
  
  describe('Sign Recognition', () => {
    let mockHandData;
    
    beforeEach(() => {
      // Mock hand tracking data
      mockHandData = {
        landmarks: [
          { x: 0.1, y: 0.2, z: 0.0 }, // Wrist
          { x: 0.2, y: 0.3, z: 0.0 }, // Thumb base
          { x: 0.3, y: 0.4, z: 0.0 }, // Thumb tip
          { x: 0.4, y: 0.3, z: 0.0 }, // Index finger base
          { x: 0.5, y: 0.2, z: 0.0 }, // Index finger tip
          // ... more landmarks for a complete hand
        ]
      };
      
      // Stub the hand tracking method
      sinon.stub(signLanguageProcessor, 'getHandTrackingData').returns(mockHandData);
    });
    
    it('should start recognition when startRecognition is called', () => {
      const startTrackingSpy = sinon.spy(signLanguageProcessor, 'startHandTracking');
      signLanguageProcessor.startRecognition();
      
      expect(startTrackingSpy.called).to.be.true;
      expect(signLanguageProcessor.isRecognizing).to.be.true;
    });
    
    it('should stop recognition when stopRecognition is called', () => {
      signLanguageProcessor.startRecognition();
      const stopTrackingSpy = sinon.spy(signLanguageProcessor, 'stopHandTracking');
      
      signLanguageProcessor.stopRecognition();
      
      expect(stopTrackingSpy.called).to.be.true;
      expect(signLanguageProcessor.isRecognizing).to.be.false;
    });
    
    it('should emit events when signs are recognized', (done) => {
      // Stub the sign recognition to return a known sign
      sinon.stub(signLanguageProcessor, 'recognizeSign').returns({
        sign: 'hello',
        confidence: 0.9
      });
      
      signLanguageProcessor.on('sign:recognized', (data) => {
        expect(data.sign).to.equal('hello');
        expect(data.confidence).to.equal(0.9);
        done();
      });
      
      // Trigger the recognition process
      signLanguageProcessor.processFrame();
    });
    
    it('should log recognized signs to audit trail', () => {
      // Stub the sign recognition to return a known sign
      sinon.stub(signLanguageProcessor, 'recognizeSign').returns({
        sign: 'thank you',
        confidence: 0.85
      });
      
      signLanguageProcessor.processFrame();
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Sign recognized: thank you/))).to.be.true;
    });
    
    it('should filter out low confidence recognitions', () => {
      // Stub the sign recognition to return a low confidence result
      sinon.stub(signLanguageProcessor, 'recognizeSign').returns({
        sign: 'maybe',
        confidence: 0.3 // Below threshold
      });
      
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      signLanguageProcessor.processFrame();
      
      // Should not emit the recognition event for low confidence
      expect(emitSpy.calledWith('sign:recognized')).to.be.false;
    });
  });
  
  describe('Sign Generation', () => {
    it('should generate sign animations when generateSign is called', () => {
      const avatarUpdateSpy = sinon.spy(signLanguageProcessor, 'updateAvatarAnimation');
      
      signLanguageProcessor.generateSign('hello');
      
      expect(avatarUpdateSpy.called).to.be.true;
      expect(signLanguageProcessor.currentGeneratedSign).to.equal('hello');
    });
    
    it('should emit events when sign generation starts and completes', () => {
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      
      signLanguageProcessor.generateSign('welcome');
      
      expect(emitSpy.calledWith('sign:generation-started')).to.be.true;
      
      // Fast-forward animation completion
      signLanguageProcessor.onAnimationComplete();
      
      expect(emitSpy.calledWith('sign:generation-completed')).to.be.true;
    });
    
    it('should fall back to fingerspelling for unknown signs', () => {
      const fingerspellSpy = sinon.spy(signLanguageProcessor, 'generateFingerspelling');
      
      // Assume this sign doesn't exist in the dictionary
      signLanguageProcessor.generateSign('xyzabc123');
      
      expect(fingerspellSpy.called).to.be.true;
    });
    
    it('should log sign generation to audit trail', () => {
      signLanguageProcessor.generateSign('goodbye');
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Generating sign: goodbye/))).to.be.true;
    });
  });
  
  describe('Fingerspelling', () => {
    it('should generate fingerspelling animations for individual letters', () => {
      const updateAvatarSpy = sinon.spy(signLanguageProcessor, 'updateAvatarAnimation');
      
      signLanguageProcessor.generateFingerspelling('hi');
      
      // Should call updateAvatarAnimation for each letter
      expect(updateAvatarSpy.callCount).to.equal(2);
    });
    
    it('should emit events for fingerspelling progress', () => {
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      
      signLanguageProcessor.generateFingerspelling('test');
      
      expect(emitSpy.calledWith('fingerspelling:started')).to.be.true;
      
      // Fast-forward through all letters
      for (let i = 0; i < 4; i++) {
        signLanguageProcessor.onLetterAnimationComplete();
      }
      
      expect(emitSpy.calledWith('fingerspelling:completed')).to.be.true;
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration when updateConfig is called', () => {
      signLanguageProcessor.updateConfig({
        language: 'BSL',
        recognitionConfidence: 0.6,
        enableFingerspelling: false
      });
      
      expect(signLanguageProcessor.language).to.equal('BSL');
      expect(signLanguageProcessor.recognitionConfidence).to.equal(0.6);
      expect(signLanguageProcessor.enableFingerspelling).to.be.false;
    });
    
    it('should reload sign dictionary when language is changed', () => {
      const loadDictionarySpy = sinon.spy(signLanguageProcessor, 'loadSignDictionary');
      
      signLanguageProcessor.updateConfig({ language: 'BSL' });
      
      expect(loadDictionarySpy.called).to.be.true;
      expect(signLanguageProcessor.signDictionary.BSL).to.not.be.undefined;
    });
    
    it('should log configuration updates to audit trail', () => {
      signLanguageProcessor.updateConfig({ recognitionConfidence: 0.75 });
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Sign Language Processor configuration updated/))).to.be.true;
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing video stream gracefully', () => {
      // Simulate error in starting video stream
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      
      // Mock the startVideo method to throw an error
      sinon.stub(signLanguageProcessor, 'startVideo').throws(new Error('Video stream error'));
      
      // This should not throw despite the error in startVideo
      expect(() => {
        signLanguageProcessor.startRecognition();
      }).to.not.throw();
      
      // Should emit an error event
      expect(emitSpy.calledWith('error')).to.be.true;
      
      // Clean up
      errorSpy.restore();
    });
    
    it('should handle invalid sign generation requests gracefully', () => {
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      
      // Empty string should not cause errors
      signLanguageProcessor.generateSign('');
      
      // Should emit an error event
      expect(emitSpy.calledWith('error')).to.be.true;
    });
  });
  
  describe('Avatar Control', () => {
    it('should create and initialize avatar when setupAvatar is called', () => {
      // Reset processor to test avatar setup
      signLanguageProcessor = new SignLanguageProcessor({
        avatarContainer: document.getElementById('avatar-container'),
        initializeAvatar: false
      });
      
      const avatarContainer = document.getElementById('avatar-container');
      expect(avatarContainer.children.length).to.equal(0);
      
      signLanguageProcessor.setupAvatar();
      
      // Should have created avatar elements
      expect(avatarContainer.children.length).to.be.above(0);
    });
    
    it('should update avatar pose when updateAvatarAnimation is called', () => {
      const emitSpy = sinon.spy(signLanguageProcessor, 'emit');
      
      signLanguageProcessor.updateAvatarAnimation('hello');
      
      // Should emit animation update event
      expect(emitSpy.calledWith('avatar:animation-updated')).to.be.true;
    });
  });
});
