/**
 * Eye Tracking Calibration Integration Test
 * 
 * This test verifies the eye tracking calibration functionality
 * integrated with the main biometrics system.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Mock browser environment
const dom = new JSDOM('<!DOCTYPE html><html><body><video id="video"></video><canvas id="canvas"></canvas></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLVideoElement = dom.window.HTMLVideoElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.navigator = {
  mediaDevices: {
    getUserMedia: sinon.stub().resolves({
      getTracks: () => [{
        stop: sinon.spy()
      }]
    })
  }
};

// Mock canvas context
const mockContext2D = {
  drawImage: sinon.spy(),
  clearRect: sinon.spy(),
  fillRect: sinon.spy(),
  fillText: sinon.spy(),
  beginPath: sinon.spy(),
  arc: sinon.spy(),
  fill: sinon.spy(),
  stroke: sinon.spy()
};

HTMLCanvasElement.prototype.getContext = () => mockContext2D;

// Mock event system
const eventSubscriptions = {};
global.subscribe = (eventName, callback) => {
  if (!eventSubscriptions[eventName]) {
    eventSubscriptions[eventName] = [];
  }
  eventSubscriptions[eventName].push(callback);
  return { unsubscribe: () => {} };
};

global.publish = (eventName, data) => {
  if (eventSubscriptions[eventName]) {
    eventSubscriptions[eventName].forEach(callback => callback(data));
  }
};

// Import modules under test
import biometrics from '../../src/biometrics/index.js';
import eyeTracking from '../../src/biometrics/eye/index.js';

describe('Eye Tracking Calibration Integration Tests', () => {
  let sandbox;
  
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    
    // Reset event subscriptions
    Object.keys(eventSubscriptions).forEach(key => {
      delete eventSubscriptions[key];
    });
    
    // Reset mocks
    mockContext2D.drawImage.resetHistory();
    mockContext2D.clearRect.resetHistory();
    mockContext2D.fillRect.resetHistory();
    mockContext2D.fillText.resetHistory();
    
    // Stub eye tracking methods
    sandbox.stub(eyeTracking, 'startCalibration').resolves({ success: true, accuracy: 0.95 });
    
    // Initialize biometrics with eye tracking enabled
    await biometrics.initializeBiometrics({
      eye: {
        enabled: true,
        models: {
          path: './models'
        },
        calibration: {
          requiredAccuracy: 0.8,
          maxAttempts: 3
        }
      }
    });
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('Calibration through Biometrics API', () => {
    it('should expose calibration method in public API', () => {
      const api = biometrics.getPublicAPI();
      expect(api).to.have.property('calibrateEyeTracking').that.is.a('function');
    });
    
    it('should call eye tracking module when calibration is requested', async () => {
      const api = biometrics.getPublicAPI();
      
      await api.startProcessing();
      const result = await api.calibrateEyeTracking();
      
      expect(eyeTracking.startCalibration.calledOnce).to.be.true;
      expect(result).to.deep.equal({ success: true, accuracy: 0.95 });
    });
    
    it('should pass calibration options to eye tracking module', async () => {
      const api = biometrics.getPublicAPI();
      const options = { 
        points: 5,
        pointSize: 20,
        pointColor: 'red',
        animationDuration: 1000
      };
      
      await api.startProcessing();
      await api.calibrateEyeTracking(options);
      
      expect(eyeTracking.startCalibration.calledWith(options)).to.be.true;
    });
    
    it('should throw error if eye tracking is not enabled', async () => {
      // Re-initialize with eye tracking disabled
      await biometrics.initializeBiometrics({
        eye: {
          enabled: false
        }
      });
      
      const api = biometrics.getPublicAPI();
      
      try {
        await api.calibrateEyeTracking();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Eye tracking not enabled');
      }
    });
    
    it('should publish calibration events', async () => {
      const api = biometrics.getPublicAPI();
      const eventSpy = sinon.spy();
      
      subscribe('biometrics:eye:calibration:start', eventSpy);
      subscribe('biometrics:eye:calibration:complete', eventSpy);
      
      await api.startProcessing();
      await api.calibrateEyeTracking();
      
      expect(eventSpy.called).to.be.true;
    });
  });
  
  describe('Calibration Lifecycle', () => {
    it('should handle successful calibration', async () => {
      const api = biometrics.getPublicAPI();
      
      await api.startProcessing();
      const result = await api.calibrateEyeTracking();
      
      expect(result.success).to.be.true;
      expect(result.accuracy).to.be.above(0.8);
    });
    
    it('should handle failed calibration', async () => {
      eyeTracking.startCalibration.resolves({ success: false, accuracy: 0.5, error: 'Insufficient accuracy' });
      
      const api = biometrics.getPublicAPI();
      
      await api.startProcessing();
      const result = await api.calibrateEyeTracking();
      
      expect(result.success).to.be.false;
      expect(result.accuracy).to.be.below(0.8);
      expect(result.error).to.equal('Insufficient accuracy');
    });
    
    it('should handle calibration errors', async () => {
      eyeTracking.startCalibration.rejects(new Error('Camera access denied'));
      
      const api = biometrics.getPublicAPI();
      
      await api.startProcessing();
      
      try {
        await api.calibrateEyeTracking();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Camera access denied');
      }
    });
  });
  
  describe('Accessibility Integration', () => {
    it('should support accessibility options during calibration', async () => {
      const api = biometrics.getPublicAPI();
      const accessibilityOptions = {
        audioFeedback: true,
        highContrastMode: true,
        largeTargets: true,
        extendedDuration: true
      };
      
      await api.startProcessing();
      await api.calibrateEyeTracking({ accessibility: accessibilityOptions });
      
      expect(eyeTracking.startCalibration.firstCall.args[0]).to.have.property('accessibility')
        .that.deep.includes(accessibilityOptions);
    });
    
    it('should handle visual impairment adaptations', async () => {
      // Simulate visual impairment detection
      publish('accessibility:visual_impairment:detected', { 
        type: 'low_vision',
        severity: 'moderate'
      });
      
      const api = biometrics.getPublicAPI();
      
      await api.startProcessing();
      await api.calibrateEyeTracking();
      
      // Verify that appropriate accessibility options were automatically applied
      const calibrationOptions = eyeTracking.startCalibration.firstCall.args[0];
      expect(calibrationOptions).to.have.nested.property('accessibility.adaptations');
    });
  });
  
  describe('Privacy Integration', () => {
    it('should respect privacy settings during calibration', async () => {
      const api = biometrics.getPublicAPI();
      
      // Update config with privacy mode
      await api.updateConfig({
        eye: {
          privacy: {
            mode: 'blur',
            dataRetention: 'session'
          }
        }
      });
      
      await api.startProcessing();
      await api.calibrateEyeTracking();
      
      // Verify privacy settings were passed to calibration
      const calibrationOptions = eyeTracking.startCalibration.firstCall.args[0];
      expect(calibrationOptions).to.have.nested.property('privacy.mode', 'blur');
    });
  });
});
