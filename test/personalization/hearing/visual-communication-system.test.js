/**
 * @file visual-communication-system.test.js
 * @description Unit and integration tests for the Visual Communication System component
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { VisualCommunicationSystem } from '../../../src/personalization/hearing/visual-communication-system';
import { AuditTrail } from '../../../src/utils/audit-trail';

describe('Visual Communication System', () => {
  let visualCommunicationSystem;
  let dom;
  let document;
  let window;
  let auditTrailStub;
  let mockSpeechRecognition;
  let mockAudioContext;
  
  beforeEach(() => {
    // Set up a DOM environment for testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <div id="alejo-container">
        <div id="caption-container"></div>
        <div id="sound-visualization"></div>
      </div>
    `);
    window = dom.window;
    document = window.document;
    
    // Stub the global document and window
    global.document = document;
    global.window = window;
    
    // Mock Web Speech API
    mockSpeechRecognition = function() {
      this.start = sinon.stub();
      this.stop = sinon.stub();
      this.abort = sinon.stub();
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
    };
    
    // Mock Web Audio API
    mockAudioContext = function() {
      this.createAnalyser = sinon.stub().returns({
        connect: sinon.stub(),
        fftSize: 0,
        getByteFrequencyData: sinon.stub()
      });
      this.createMediaStreamSource = sinon.stub().returns({
        connect: sinon.stub()
      });
    };
    
    // Add mocks to window
    window.SpeechRecognition = mockSpeechRecognition;
    window.webkitSpeechRecognition = mockSpeechRecognition;
    window.AudioContext = mockAudioContext;
    window.webkitAudioContext = mockAudioContext;
    
    // Stub the audit trail
    auditTrailStub = sinon.stub(AuditTrail, 'log');
    
    // Create a new instance of the visual communication system
    visualCommunicationSystem = new VisualCommunicationSystem({
      captionContainer: document.getElementById('caption-container'),
      soundVisualizationContainer: document.getElementById('sound-visualization'),
      captionLanguage: 'en-US',
      captionPosition: 'bottom',
      captionStyle: 'standard',
      maxCaptionHistory: 5,
      enableSpeakerIdentification: true
    });
  });
  
  afterEach(() => {
    // Clean up
    auditTrailStub.restore();
    delete global.document;
    delete global.window;
    
    // If there are any timers or event listeners, clean them up
    if (visualCommunicationSystem.cleanup) {
      visualCommunicationSystem.cleanup();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings when no options are provided', () => {
      const defaultSystem = new VisualCommunicationSystem();
      expect(defaultSystem.captionLanguage).to.equal('en-US');
      expect(defaultSystem.captionPosition).to.equal('bottom');
      expect(defaultSystem.captionStyle).to.equal('standard');
      expect(defaultSystem.maxCaptionHistory).to.equal(10);
      expect(defaultSystem.enableSpeakerIdentification).to.be.true;
    });
    
    it('should initialize with custom settings when options are provided', () => {
      expect(visualCommunicationSystem.captionLanguage).to.equal('en-US');
      expect(visualCommunicationSystem.captionPosition).to.equal('bottom');
      expect(visualCommunicationSystem.captionStyle).to.equal('standard');
      expect(visualCommunicationSystem.maxCaptionHistory).to.equal(5);
      expect(visualCommunicationSystem.enableSpeakerIdentification).to.be.true;
    });
    
    it('should create necessary DOM elements if not provided', () => {
      const minimalSystem = new VisualCommunicationSystem({
        captionContainer: null,
        soundVisualizationContainer: null
      });
      
      // Check if elements were created
      expect(document.querySelector('.alejo-caption-container')).to.not.be.null;
      expect(document.querySelector('.alejo-sound-visualization')).to.not.be.null;
    });
    
    it('should log initialization to audit trail', () => {
      expect(auditTrailStub.calledWith('ACCESSIBILITY', 'Visual Communication System initialized')).to.be.true;
    });
  });
  
  describe('Caption System', () => {
    it('should create a caption element when addCaption is called', () => {
      visualCommunicationSystem.addCaption('Test caption', 'user');
      const caption = document.querySelector('.alejo-caption');
      expect(caption).to.not.be.null;
      expect(caption.textContent).to.include('Test caption');
    });
    
    it('should apply speaker identification when enabled', () => {
      visualCommunicationSystem.addCaption('Speaker test', 'assistant');
      const caption = document.querySelector('.alejo-caption');
      expect(caption.querySelector('.speaker-identifier')).to.not.be.null;
    });
    
    it('should maintain caption history within the specified limit', () => {
      // Add more captions than the limit
      for (let i = 0; i < 7; i++) {
        visualCommunicationSystem.addCaption(`Caption ${i}`, 'user');
      }
      
      const captions = document.querySelectorAll('.alejo-caption');
      expect(captions.length).to.equal(5); // maxCaptionHistory is 5
    });
    
    it('should update an existing caption when updateCaption is called', () => {
      visualCommunicationSystem.addCaption('Initial text', 'user');
      const caption = document.querySelector('.alejo-caption');
      const captionId = caption.getAttribute('data-caption-id');
      
      visualCommunicationSystem.updateCaption(captionId, 'Updated text');
      expect(caption.textContent).to.include('Updated text');
    });
    
    it('should clear all captions when clearCaptions is called', () => {
      visualCommunicationSystem.addCaption('Caption 1', 'user');
      visualCommunicationSystem.addCaption('Caption 2', 'assistant');
      
      expect(document.querySelectorAll('.alejo-caption').length).to.equal(2);
      
      visualCommunicationSystem.clearCaptions();
      expect(document.querySelectorAll('.alejo-caption').length).to.equal(0);
    });
    
    it('should log caption actions to audit trail', () => {
      visualCommunicationSystem.addCaption('Audit test', 'user');
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Caption added/))).to.be.true;
    });
  });
  
  describe('Speech Recognition', () => {
    let recognitionInstance;
    
    beforeEach(() => {
      // Get the recognition instance created during initialization
      recognitionInstance = visualCommunicationSystem.recognition;
    });
    
    it('should start speech recognition when startCaptioning is called', () => {
      visualCommunicationSystem.startCaptioning();
      expect(recognitionInstance.start.called).to.be.true;
      expect(visualCommunicationSystem.isCaptioning).to.be.true;
    });
    
    it('should stop speech recognition when stopCaptioning is called', () => {
      visualCommunicationSystem.startCaptioning();
      visualCommunicationSystem.stopCaptioning();
      
      expect(recognitionInstance.stop.called).to.be.true;
      expect(visualCommunicationSystem.isCaptioning).to.be.false;
    });
    
    it('should add captions when speech is recognized', () => {
      visualCommunicationSystem.startCaptioning();
      
      // Simulate speech recognition result
      const mockEvent = {
        results: [
          [{ transcript: 'Hello world', confidence: 0.9, isFinal: true }]
        ],
        resultIndex: 0
      };
      
      recognitionInstance.onresult(mockEvent);
      
      const caption = document.querySelector('.alejo-caption');
      expect(caption).to.not.be.null;
      expect(caption.textContent).to.include('Hello world');
    });
    
    it('should update interim results when not final', () => {
      visualCommunicationSystem.startCaptioning();
      
      // Simulate interim speech recognition result
      const mockEvent = {
        results: [
          [{ transcript: 'Interim text', confidence: 0.7, isFinal: false }]
        ],
        resultIndex: 0
      };
      
      recognitionInstance.onresult(mockEvent);
      
      // Should create an interim caption
      const caption = document.querySelector('.alejo-caption.interim');
      expect(caption).to.not.be.null;
      expect(caption.textContent).to.include('Interim text');
    });
    
    it('should restart recognition when it ends', () => {
      visualCommunicationSystem.startCaptioning();
      
      // Reset the start stub to check if it's called again
      recognitionInstance.start.reset();
      
      // Simulate recognition end event
      recognitionInstance.onend();
      
      // Should restart if isCaptioning is still true
      expect(recognitionInstance.start.called).to.be.true;
    });
    
    it('should handle recognition errors gracefully', () => {
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(visualCommunicationSystem, 'emit');
      
      visualCommunicationSystem.startCaptioning();
      
      // Simulate error event
      recognitionInstance.onerror({ error: 'no-speech' });
      
      // Should emit error event
      expect(emitSpy.calledWith('error')).to.be.true;
      expect(errorSpy.called).to.be.true;
      
      errorSpy.restore();
    });
  });
  
  describe('Sound Visualization', () => {
    let mockAnalyser;
    let mockMediaStream;
    
    beforeEach(() => {
      mockAnalyser = {
        connect: sinon.stub(),
        fftSize: 0,
        frequencyBinCount: 1024,
        getByteFrequencyData: sinon.stub()
      };
      
      mockMediaStream = {};
      
      // Stub the audio context methods
      sinon.stub(window.AudioContext.prototype, 'createAnalyser').returns(mockAnalyser);
      sinon.stub(window.AudioContext.prototype, 'createMediaStreamSource').returns({
        connect: sinon.stub()
      });
    });
    
    afterEach(() => {
      window.AudioContext.prototype.createAnalyser.restore();
      window.AudioContext.prototype.createMediaStreamSource.restore();
    });
    
    it('should initialize audio context when startSoundVisualization is called', () => {
      const initAudioContextSpy = sinon.spy(visualCommunicationSystem, 'initializeAudioContext');
      
      visualCommunicationSystem.startSoundVisualization(mockMediaStream);
      
      expect(initAudioContextSpy.called).to.be.true;
      expect(visualCommunicationSystem.isVisualizing).to.be.true;
    });
    
    it('should stop visualization when stopSoundVisualization is called', () => {
      visualCommunicationSystem.startSoundVisualization(mockMediaStream);
      
      // Stub the animation frame
      const cancelAnimationFrameSpy = sinon.stub(window, 'cancelAnimationFrame');
      
      visualCommunicationSystem.stopSoundVisualization();
      
      expect(cancelAnimationFrameSpy.called).to.be.true;
      expect(visualCommunicationSystem.isVisualizing).to.be.false;
      
      cancelAnimationFrameSpy.restore();
    });
    
    it('should create visualization elements when visualizing sound', () => {
      visualCommunicationSystem.startSoundVisualization(mockMediaStream);
      
      // Trigger a visualization update
      visualCommunicationSystem.updateSoundVisualization();
      
      // Should have created visualization elements
      const visualizationContainer = document.querySelector('.alejo-sound-visualization');
      expect(visualizationContainer.children.length).to.be.above(0);
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration when updateConfig is called', () => {
      visualCommunicationSystem.updateConfig({
        captionLanguage: 'es-ES',
        captionPosition: 'top',
        captionStyle: 'large',
        maxCaptionHistory: 3,
        enableSpeakerIdentification: false
      });
      
      expect(visualCommunicationSystem.captionLanguage).to.equal('es-ES');
      expect(visualCommunicationSystem.captionPosition).to.equal('top');
      expect(visualCommunicationSystem.captionStyle).to.equal('large');
      expect(visualCommunicationSystem.maxCaptionHistory).to.equal(3);
      expect(visualCommunicationSystem.enableSpeakerIdentification).to.be.false;
    });
    
    it('should update speech recognition language when captionLanguage is changed', () => {
      visualCommunicationSystem.updateConfig({ captionLanguage: 'fr-FR' });
      
      // If recognition exists, it should have the updated language
      if (visualCommunicationSystem.recognition) {
        expect(visualCommunicationSystem.recognition.lang).to.equal('fr-FR');
      }
    });
    
    it('should apply new position to the caption container when position is updated', () => {
      visualCommunicationSystem.updateConfig({ captionPosition: 'top-right' });
      
      const container = document.querySelector('.alejo-caption-container');
      expect(container.classList.contains('position-top-right')).to.be.true;
    });
    
    it('should log configuration updates to audit trail', () => {
      visualCommunicationSystem.updateConfig({ captionStyle: 'minimal' });
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Visual Communication System configuration updated/))).to.be.true;
    });
  });
  
  describe('Accessibility', () => {
    it('should set appropriate ARIA attributes on caption container', () => {
      const container = document.querySelector('.alejo-caption-container');
      
      expect(container.getAttribute('role')).to.equal('log');
      expect(container.getAttribute('aria-live')).to.equal('polite');
    });
    
    it('should set appropriate ARIA attributes on sound visualization', () => {
      const container = document.querySelector('.alejo-sound-visualization');
      
      expect(container.getAttribute('role')).to.equal('img');
      expect(container.getAttribute('aria-label')).to.not.be.null;
    });
    
    it('should make important captions more assertive when needed', () => {
      visualCommunicationSystem.addCaption('Important message', 'system', true);
      const caption = document.querySelector('.alejo-caption');
      
      expect(caption.getAttribute('aria-live')).to.equal('assertive');
    });
  });
  
  describe('Event Handling', () => {
    it('should emit events when captioning starts and stops', () => {
      const emitSpy = sinon.spy(visualCommunicationSystem, 'emit');
      
      visualCommunicationSystem.startCaptioning();
      expect(emitSpy.calledWith('captioning:started')).to.be.true;
      
      visualCommunicationSystem.stopCaptioning();
      expect(emitSpy.calledWith('captioning:stopped')).to.be.true;
    });
    
    it('should emit events when captions are added', (done) => {
      visualCommunicationSystem.on('caption:added', (data) => {
        expect(data.text).to.equal('Event test');
        expect(data.speaker).to.equal('user');
        done();
      });
      
      visualCommunicationSystem.addCaption('Event test', 'user');
    });
    
    it('should emit events when sound visualization starts and stops', () => {
      const emitSpy = sinon.spy(visualCommunicationSystem, 'emit');
      const mockMediaStream = {};
      
      visualCommunicationSystem.startSoundVisualization(mockMediaStream);
      expect(emitSpy.calledWith('sound-visualization:started')).to.be.true;
      
      visualCommunicationSystem.stopSoundVisualization();
      expect(emitSpy.calledWith('sound-visualization:stopped')).to.be.true;
    });
  });
  
  describe('Error Handling', () => {
    it('should handle speech recognition not supported error', () => {
      // Remove speech recognition support
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
      
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(visualCommunicationSystem, 'emit');
      
      // Creating a new instance should handle the missing API gracefully
      const noSpeechSystem = new VisualCommunicationSystem();
      
      // Should emit an error event
      expect(emitSpy.calledWith('error')).to.be.true;
      expect(errorSpy.called).to.be.true;
      
      errorSpy.restore();
    });
    
    it('should handle audio context not supported error', () => {
      // Remove audio context support
      delete window.AudioContext;
      delete window.webkitAudioContext;
      
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(visualCommunicationSystem, 'emit');
      
      // Try to start visualization without audio context support
      visualCommunicationSystem.startSoundVisualization({});
      
      // Should emit an error event
      expect(emitSpy.calledWith('error')).to.be.true;
      expect(errorSpy.called).to.be.true;
      
      errorSpy.restore();
    });
  });
});
