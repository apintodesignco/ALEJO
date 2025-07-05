/**
 * ALEJO Eye Tracking Integration Test
 * 
 * This test verifies the integration between the eye tracking module and the main biometrics system.
 * It tests the initialization, start/stop/pause/resume functionality, configuration updates,
 * and event handling between the components.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { initializeBiometrics } from '../../src/biometrics/index.js';
import eyeTracking from '../../src/biometrics/eye/index.js';
import eyeProcessor from '../../src/biometrics/eye/eye-processor.js';
import * as events from '../../src/events.js';

describe('Eye Tracking Integration Tests', () => {
  let biometrics;
  let publishSpy;
  let subscribeSpy;
  let eyeTrackingInitializeSpy;
  let eyeTrackingStartSpy;
  let eyeTrackingStopSpy;
  let eyeTrackingPauseSpy;
  let eyeTrackingResumeSpy;
  let eyeTrackingUpdateConfigSpy;
  
  // Mock video stream
  const mockVideoStream = {
    getTracks: () => [{
      stop: sinon.spy()
    }]
  };
  
  // Mock getUserMedia
  global.navigator = {
    mediaDevices: {
      getUserMedia: sinon.stub().resolves(mockVideoStream)
    }
  };
  
  beforeEach(async () => {
    // Reset spies
    publishSpy = sinon.spy(events, 'publish');
    subscribeSpy = sinon.spy(events, 'subscribe');
    eyeTrackingInitializeSpy = sinon.stub(eyeTracking, 'initialize').resolves(true);
    eyeTrackingStartSpy = sinon.stub(eyeTracking, 'startProcessing').resolves(true);
    eyeTrackingStopSpy = sinon.stub(eyeTracking, 'stopProcessing').resolves(true);
    eyeTrackingPauseSpy = sinon.stub(eyeTracking, 'pauseProcessing').resolves(true);
    eyeTrackingResumeSpy = sinon.stub(eyeTracking, 'resumeProcessing').resolves(true);
    eyeTrackingUpdateConfigSpy = sinon.stub(eyeTracking, 'updateConfig').returns(true);
    
    // Mock document
    global.document = {
      createElement: () => ({
        srcObject: null,
        autoplay: false,
        muted: false,
        playsInline: false
      }),
      addEventListener: sinon.spy(),
      removeEventListener: sinon.spy(),
      visibilityState: 'visible'
    };
    
    // Initialize biometrics with eye tracking enabled
    biometrics = await initializeBiometrics({
      eyeTracking: {
        enabled: true,
        processingInterval: 50,
        debugMode: false,
        privacyMode: 'none'
      }
    });
  });
  
  afterEach(() => {
    // Restore all spies
    sinon.restore();
  });
  
  it('should initialize eye tracking during biometrics initialization', async () => {
    expect(eyeTrackingInitializeSpy.calledOnce).to.be.true;
    expect(eyeTrackingInitializeSpy.firstCall.args[0]).to.deep.include({
      enabled: true,
      processingInterval: 50
    });
    
    // Verify events were published
    expect(publishSpy.calledWith('biometrics:initialized')).to.be.true;
  });
  
  it('should start eye tracking when biometrics processing starts', async () => {
    await biometrics.startProcessing();
    
    expect(eyeTrackingStartSpy.calledOnce).to.be.true;
    expect(publishSpy.calledWith('biometrics:eye:started')).to.be.true;
    expect(publishSpy.calledWith('biometrics:processing:started')).to.be.true;
  });
  
  it('should stop eye tracking when biometrics processing stops', async () => {
    await biometrics.startProcessing();
    await biometrics.stopProcessing();
    
    expect(eyeTrackingStopSpy.calledOnce).to.be.true;
    expect(publishSpy.calledWith('biometrics:eye:stopped')).to.be.true;
    expect(publishSpy.calledWith('biometrics:processing:stopped')).to.be.true;
  });
  
  it('should pause eye tracking when biometrics processing pauses', async () => {
    await biometrics.startProcessing();
    await biometrics.pauseProcessing();
    
    expect(eyeTrackingPauseSpy.calledOnce).to.be.true;
    expect(publishSpy.calledWith('biometrics:eye:paused')).to.be.true;
    expect(publishSpy.calledWith('biometrics:processing:paused')).to.be.true;
  });
  
  it('should resume eye tracking when biometrics processing resumes', async () => {
    await biometrics.startProcessing();
    await biometrics.pauseProcessing();
    await biometrics.resumeProcessing();
    
    expect(eyeTrackingResumeSpy.calledOnce).to.be.true;
    expect(publishSpy.calledWith('biometrics:eye:resumed')).to.be.true;
    expect(publishSpy.calledWith('biometrics:processing:resumed')).to.be.true;
  });
  
  it('should update eye tracking configuration when biometrics config is updated', async () => {
    await biometrics.updateConfig({
      eyeTracking: {
        processingInterval: 100,
        debugMode: true,
        privacyMode: 'blur'
      }
    });
    
    expect(eyeTrackingUpdateConfigSpy.calledOnce).to.be.true;
    expect(eyeTrackingUpdateConfigSpy.firstCall.args[0]).to.deep.include({
      processingInterval: 100,
      debugMode: true,
      privacyMode: 'blur'
    });
    
    expect(publishSpy.calledWith('biometrics:config:updated')).to.be.true;
  });
  
  it('should handle accessibility settings updates', async () => {
    // Simulate accessibility settings update event
    const accessibilityHandler = subscribeSpy.getCalls()
      .find(call => call.args[0] === 'accessibility:settings:updated')
      ?.args[1];
      
    expect(accessibilityHandler).to.be.a('function');
    
    if (accessibilityHandler) {
      accessibilityHandler({
        eyeTracking: {
          highContrastMode: true,
          largerTargets: true
        }
      });
      
      expect(eyeTrackingUpdateConfigSpy.calledOnce).to.be.true;
    }
  });
  
  it('should handle privacy mode updates', async () => {
    // Simulate privacy mode update event
    const privacyHandler = subscribeSpy.getCalls()
      .find(call => call.args[0] === 'privacy:mode:updated')
      ?.args[1];
      
    expect(privacyHandler).to.be.a('function');
    
    if (privacyHandler) {
      privacyHandler({
        eyeTracking: 'blur'
      });
      
      expect(eyeTrackingUpdateConfigSpy.calledOnce).to.be.true;
    }
  });
  
  it('should handle calibration requests', async () => {
    // Mock startCalibration
    const startCalibrationSpy = sinon.stub(eyeTracking, 'startCalibration').returns(true);
    
    // Simulate calibration request event
    const calibrationHandler = subscribeSpy.getCalls()
      .find(call => call.args[0] === 'calibration:request:eye-tracking')
      ?.args[1];
      
    expect(calibrationHandler).to.be.a('function');
    
    if (calibrationHandler) {
      const calibrationOptions = {
        pointCount: 9,
        speed: 'slow'
      };
      
      calibrationHandler(calibrationOptions);
      
      expect(startCalibrationSpy.calledOnce).to.be.true;
      expect(startCalibrationSpy.firstCall.args[0]).to.deep.equal(calibrationOptions);
    }
  });
  
  it('should disable eye tracking when configuration is updated', async () => {
    await biometrics.startProcessing();
    
    await biometrics.updateConfig({
      eyeTracking: {
        enabled: false
      }
    });
    
    expect(eyeTrackingStopSpy.calledOnce).to.be.true;
  });
  
  it('should enable eye tracking when configuration is updated', async () => {
    // First disable eye tracking
    await biometrics.updateConfig({
      eyeTracking: {
        enabled: false
      }
    });
    
    // Reset spies
    eyeTrackingInitializeSpy.reset();
    eyeTrackingStartSpy.reset();
    
    // Then re-enable it
    await biometrics.updateConfig({
      eyeTracking: {
        enabled: true
      }
    });
    
    expect(eyeTrackingInitializeSpy.calledOnce).to.be.true;
  });
  
  it('should handle low memory warnings', async () => {
    // Simulate low memory event
    const lowMemoryHandler = subscribeSpy.getCalls()
      .find(call => call.args[0] === 'system:memory:low')
      ?.args[1];
      
    expect(lowMemoryHandler).to.be.a('function');
    
    if (lowMemoryHandler) {
      lowMemoryHandler({
        availableMemory: 100,
        totalMemory: 1000
      });
      
      // Verify that processing interval was increased
      expect(publishSpy.calledWith('biometrics:reduced:performance')).to.be.true;
    }
  });
});
