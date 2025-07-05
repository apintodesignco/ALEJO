/**
 * @file hearing-impairment-detection.test.js
 * @description Unit and integration tests for the Hearing Impairment Detection module
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { HearingImpairmentDetection } from '../../../src/personalization/hearing/hearing-impairment-detection';
import { AuditTrail } from '../../../src/utils/audit-trail';

describe('Hearing Impairment Detection', () => {
  let hearingDetection;
  let dom;
  let document;
  let window;
  let auditTrailStub;
  let localStorageMock;
  
  beforeEach(() => {
    // Set up a DOM environment for testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <div id="alejo-container">
        <video id="video-input"></video>
        <audio id="audio-test"></audio>
        <button id="test-button">Test Button</button>
      </div>
    `, { 
      url: "https://localhost/",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    document = window.document;
    
    // Mock localStorage
    localStorageMock = {
      getItem: sinon.stub(),
      setItem: sinon.stub(),
      removeItem: sinon.stub()
    };
    
    // Add mocks to window
    window.localStorage = localStorageMock;
    global.document = document;
    global.window = window;
    
    // Mock navigator.mediaDevices
    global.navigator = {
      mediaDevices: {
        getUserMedia: sinon.stub().resolves({
          getTracks: () => [{
            stop: sinon.stub()
          }]
        })
      }
    };
    
    // Stub the audit trail
    auditTrailStub = sinon.stub(AuditTrail, 'log');
    
    // Create a new instance of the hearing impairment detection
    hearingDetection = new HearingImpairmentDetection({
      videoElement: document.getElementById('video-input'),
      audioElement: document.getElementById('audio-test'),
      detectionThreshold: 0.7,
      detectionInterval: 100,
      consentRequired: true,
      storageKey: 'alejo-hearing-detection'
    });
  });
  
  afterEach(() => {
    // Clean up
    auditTrailStub.restore();
    delete global.document;
    delete global.window;
    delete global.navigator;
    
    // If there are any timers or event listeners, clean them up
    if (hearingDetection.cleanup) {
      hearingDetection.cleanup();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings when no options are provided', () => {
      const defaultDetection = new HearingImpairmentDetection();
      expect(defaultDetection.detectionThreshold).to.equal(0.8);
      expect(defaultDetection.detectionInterval).to.equal(500);
      expect(defaultDetection.consentRequired).to.be.true;
      expect(defaultDetection.storageKey).to.equal('alejo-hearing-impairment-detection');
    });
    
    it('should initialize with custom settings when options are provided', () => {
      expect(hearingDetection.detectionThreshold).to.equal(0.7);
      expect(hearingDetection.detectionInterval).to.equal(100);
      expect(hearingDetection.consentRequired).to.be.true;
      expect(hearingDetection.storageKey).to.equal('alejo-hearing-detection');
    });
    
    it('should create necessary DOM elements if not provided', () => {
      const minimalDetection = new HearingImpairmentDetection({
        videoElement: null,
        audioElement: null
      });
      
      // Check if elements were created
      expect(document.querySelector('.alejo-hearing-detection-video')).to.not.be.null;
      expect(document.querySelector('.alejo-hearing-detection-audio')).to.not.be.null;
    });
    
    it('should log initialization to audit trail', () => {
      expect(auditTrailStub.calledWith('ACCESSIBILITY', 'Hearing Impairment Detection initialized')).to.be.true;
    });
  });
  
  describe('Consent Management', () => {
    it('should require consent before starting detection when consentRequired is true', () => {
      const startDetectionSpy = sinon.spy(hearingDetection, 'startDetection');
      
      // Try to detect without consent
      hearingDetection.detect();
      
      // Should not start detection
      expect(startDetectionSpy.called).to.be.false;
    });
    
    it('should start detection when consent is provided', () => {
      const startDetectionSpy = sinon.spy(hearingDetection, 'startDetection');
      
      hearingDetection.setConsent(true);
      hearingDetection.detect();
      
      expect(startDetectionSpy.called).to.be.true;
    });
    
    it('should store consent status in localStorage', () => {
      hearingDetection.setConsent(true);
      
      expect(localStorageMock.setItem.calledWith(
        'alejo-hearing-detection-consent',
        sinon.match.string
      )).to.be.true;
    });
    
    it('should load consent status from localStorage during initialization', () => {
      // Mock localStorage to return consent data
      localStorageMock.getItem.withArgs('alejo-hearing-detection-consent').returns(JSON.stringify({
        granted: true,
        timestamp: Date.now()
      }));
      
      // Create a new instance that should load the consent
      const newDetection = new HearingImpairmentDetection({
        storageKey: 'alejo-hearing-detection'
      });
      
      expect(newDetection.hasConsent).to.be.true;
    });
    
    it('should log consent changes to audit trail', () => {
      hearingDetection.setConsent(true);
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Hearing detection consent granted/))).to.be.true;
    });
  });
  
  describe('Audio Response Detection', () => {
    let audioContext;
    let analyser;
    let audioData;
    
    beforeEach(() => {
      // Mock Web Audio API
      audioData = new Uint8Array(128).fill(0);
      analyser = {
        connect: sinon.stub(),
        fftSize: 256,
        frequencyBinCount: 128,
        getByteFrequencyData: sinon.stub().callsFake((data) => {
          data.set(audioData);
        })
      };
      
      audioContext = {
        createAnalyser: sinon.stub().returns(analyser),
        createMediaStreamSource: sinon.stub().returns({
          connect: sinon.stub()
        })
      };
      
      // Add to window
      window.AudioContext = sinon.stub().returns(audioContext);
      
      // Set consent for testing
      hearingDetection.setConsent(true);
    });
    
    it('should detect lack of response to audio cues', (done) => {
      // Mock the checkAudioResponse method to simulate no response
      sinon.stub(hearingDetection, 'checkAudioResponse').returns(false);
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0);
        expect(result.detectionMethod).to.equal('audio-response');
        done();
      });
      
      hearingDetection.detectAudioResponse();
      
      // Fast forward the detection process
      hearingDetection.processAudioResponseResults();
    });
    
    it('should not detect impairment when audio responses are present', (done) => {
      // Mock the checkAudioResponse method to simulate responses
      sinon.stub(hearingDetection, 'checkAudioResponse').returns(true);
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.false;
        done();
      });
      
      hearingDetection.detectAudioResponse();
      
      // Fast forward the detection process
      hearingDetection.processAudioResponseResults();
    });
    
    it('should play test sounds during audio response detection', () => {
      const audioElement = document.getElementById('audio-test');
      const playSpy = sinon.spy(audioElement, 'play');
      
      hearingDetection.playTestSound(500);
      
      expect(playSpy.called).to.be.true;
    });
  });
  
  describe('Vision-Based Detection', () => {
    beforeEach(() => {
      // Mock face-api.js or similar vision detection library
      window.faceapi = {
        detectAllFaces: sinon.stub().returns({
          withFaceLandmarks: sinon.stub().returns({
            withFaceExpressions: sinon.stub().returns([
              {
                detection: { box: { x: 100, y: 100, width: 200, height: 200 } },
                landmarks: { positions: Array(68).fill({ x: 0, y: 0 }) },
                expressions: { neutral: 0.9 }
              }
            ])
          })
        }),
        nets: {
          tinyFaceDetector: { loadFromUri: sinon.stub().resolves() },
          faceLandmark68Net: { loadFromUri: sinon.stub().resolves() },
          faceExpressionNet: { loadFromUri: sinon.stub().resolves() }
        }
      };
      
      // Set consent for testing
      hearingDetection.setConsent(true);
    });
    
    it('should detect hearing aids or cochlear implants in video', (done) => {
      // Mock the detectHearingDevices method to simulate finding devices
      sinon.stub(hearingDetection, 'detectHearingDevices').resolves({
        hearingAidDetected: true,
        confidence: 0.85
      });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0.8);
        expect(result.detectionMethod).to.equal('vision-hearing-device');
        done();
      });
      
      hearingDetection.detectVisionBased();
    });
    
    it('should detect lip reading behavior in video', (done) => {
      // Mock the detectLipReadingBehavior method to simulate lip reading
      sinon.stub(hearingDetection, 'detectLipReadingBehavior').resolves({
        lipReadingDetected: true,
        confidence: 0.75
      });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0.7);
        expect(result.detectionMethod).to.equal('vision-lip-reading');
        done();
      });
      
      hearingDetection.detectVisionBased();
    });
    
    it('should detect sign language usage in video', (done) => {
      // Mock the detectSignLanguageUsage method to simulate sign language
      sinon.stub(hearingDetection, 'detectSignLanguageUsage').resolves({
        signLanguageDetected: true,
        confidence: 0.9
      });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0.8);
        expect(result.detectionMethod).to.equal('vision-sign-language');
        done();
      });
      
      hearingDetection.detectVisionBased();
    });
  });
  
  describe('User Interaction Analysis', () => {
    let interactionEvents = [];
    
    beforeEach(() => {
      // Set up interaction tracking
      interactionEvents = [];
      
      // Mock the trackInteraction method
      sinon.stub(hearingDetection, 'trackInteraction').callsFake((event) => {
        interactionEvents.push(event);
      });
      
      // Set consent for testing
      hearingDetection.setConsent(true);
    });
    
    it('should detect lack of response to audio prompts', (done) => {
      // Simulate missed audio prompts
      hearingDetection.recordInteraction('audio-prompt', { responded: false });
      hearingDetection.recordInteraction('audio-prompt', { responded: false });
      hearingDetection.recordInteraction('audio-prompt', { responded: false });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0);
        expect(result.detectionMethod).to.equal('interaction-audio-prompts');
        done();
      });
      
      hearingDetection.analyzeInteractions();
    });
    
    it('should detect preference for visual over audio interactions', (done) => {
      // Simulate preference for visual interactions
      hearingDetection.recordInteraction('visual-interaction', { used: true });
      hearingDetection.recordInteraction('visual-interaction', { used: true });
      hearingDetection.recordInteraction('audio-interaction', { used: false });
      hearingDetection.recordInteraction('audio-interaction', { used: false });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.true;
        expect(result.confidence).to.be.above(0);
        expect(result.detectionMethod).to.equal('interaction-preference');
        done();
      });
      
      hearingDetection.analyzeInteractions();
    });
    
    it('should not detect impairment with balanced interaction patterns', (done) => {
      // Simulate balanced interaction pattern
      hearingDetection.recordInteraction('visual-interaction', { used: true });
      hearingDetection.recordInteraction('audio-interaction', { used: true });
      hearingDetection.recordInteraction('audio-prompt', { responded: true });
      
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.false;
        done();
      });
      
      hearingDetection.analyzeInteractions();
    });
  });
  
  describe('Detection Results', () => {
    beforeEach(() => {
      // Set consent for testing
      hearingDetection.setConsent(true);
      
      // Stub storage methods
      sinon.stub(hearingDetection, 'saveDetectionResult');
    });
    
    it('should store detection results securely', () => {
      const result = {
        hearingImpairmentDetected: true,
        confidence: 0.85,
        detectionMethod: 'audio-response',
        timestamp: Date.now()
      };
      
      hearingDetection.saveDetectionResult(result);
      
      expect(localStorageMock.setItem.calledWith(
        'alejo-hearing-detection-result',
        sinon.match.string
      )).to.be.true;
    });
    
    it('should load previous detection results during initialization', () => {
      const mockResult = {
        hearingImpairmentDetected: true,
        confidence: 0.85,
        detectionMethod: 'audio-response',
        timestamp: Date.now()
      };
      
      // Mock localStorage to return detection data
      localStorageMock.getItem.withArgs('alejo-hearing-detection-result').returns(JSON.stringify(mockResult));
      
      // Create a new instance that should load the result
      const newDetection = new HearingImpairmentDetection({
        storageKey: 'alejo-hearing-detection'
      });
      
      expect(newDetection.lastDetectionResult).to.deep.equal(mockResult);
    });
    
    it('should emit events when detection is complete', (done) => {
      hearingDetection.on('detection:complete', (result) => {
        expect(result.hearingImpairmentDetected).to.be.a('boolean');
        expect(result.confidence).to.be.a('number');
        expect(result.detectionMethod).to.be.a('string');
        done();
      });
      
      // Trigger a detection result
      hearingDetection.completeDetection({
        hearingImpairmentDetected: true,
        confidence: 0.9,
        detectionMethod: 'test'
      });
    });
    
    it('should log detection results to audit trail', () => {
      hearingDetection.completeDetection({
        hearingImpairmentDetected: true,
        confidence: 0.9,
        detectionMethod: 'test'
      });
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Hearing impairment detected/))).to.be.true;
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration when updateConfig is called', () => {
      hearingDetection.updateConfig({
        detectionThreshold: 0.6,
        detectionInterval: 200,
        consentRequired: false
      });
      
      expect(hearingDetection.detectionThreshold).to.equal(0.6);
      expect(hearingDetection.detectionInterval).to.equal(200);
      expect(hearingDetection.consentRequired).to.be.false;
    });
    
    it('should log configuration updates to audit trail', () => {
      hearingDetection.updateConfig({ detectionThreshold: 0.5 });
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Hearing Impairment Detection configuration updated/))).to.be.true;
    });
  });
  
  describe('Error Handling', () => {
    it('should handle media access errors gracefully', (done) => {
      // Make getUserMedia reject
      navigator.mediaDevices.getUserMedia.rejects(new Error('Permission denied'));
      
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(hearingDetection, 'emit');
      
      hearingDetection.setConsent(true);
      hearingDetection.detectVisionBased()
        .catch(() => {
          // Should emit an error event
          expect(emitSpy.calledWith('error')).to.be.true;
          expect(errorSpy.called).to.be.true;
          
          errorSpy.restore();
          done();
        });
    });
    
    it('should handle audio context errors gracefully', () => {
      // Make AudioContext throw an error
      window.AudioContext = sinon.stub().throws(new Error('Audio context error'));
      
      const errorSpy = sinon.spy(console, 'error');
      const emitSpy = sinon.spy(hearingDetection, 'emit');
      
      hearingDetection.setConsent(true);
      
      // This should not throw despite the error in AudioContext
      expect(() => {
        hearingDetection.detectAudioResponse();
      }).to.not.throw();
      
      // Should emit an error event
      expect(emitSpy.calledWith('error')).to.be.true;
      expect(errorSpy.called).to.be.true;
      
      errorSpy.restore();
    });
  });
});
