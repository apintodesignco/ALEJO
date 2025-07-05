/**
 * @file deaf-accessibility-helpers.test.js
 * @description Unit and integration tests for the Deaf Accessibility Helpers module
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { DeafAccessibilityHelpers } from '../../../src/personalization/hearing/deaf-accessibility-helpers';
import { AuditTrail } from '../../../src/utils/audit-trail';

describe('Deaf Accessibility Helpers', () => {
  let accessibilityHelpers;
  let dom;
  let document;
  let window;
  let auditTrailStub;
  
  beforeEach(() => {
    // Set up a DOM environment for testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <div id="alejo-container">
        <div id="notification-area"></div>
        <div id="vibration-test"></div>
        <div id="caption-container"></div>
      </div>
    `, { 
      url: "https://localhost/",
      runScripts: "dangerously"
    });
    
    window = dom.window;
    document = window.document;
    
    // Stub the global document and window
    global.document = document;
    global.window = window;
    
    // Mock navigator.vibrate
    global.navigator = {
      vibrate: sinon.stub().returns(true)
    };
    
    // Stub the audit trail
    auditTrailStub = sinon.stub(AuditTrail, 'log');
    
    // Create a new instance of the deaf accessibility helpers
    accessibilityHelpers = new DeafAccessibilityHelpers({
      container: document.getElementById('alejo-container'),
      notificationArea: document.getElementById('notification-area'),
      captionContainer: document.getElementById('caption-container'),
      visualFeedbackIntensity: 'medium',
      vibrationEnabled: true,
      captionsEnabled: true
    });
  });
  
  afterEach(() => {
    // Clean up
    auditTrailStub.restore();
    delete global.document;
    delete global.window;
    delete global.navigator;
    
    // If there are any timers or event listeners, clean them up
    if (accessibilityHelpers.cleanup) {
      accessibilityHelpers.cleanup();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings when no options are provided', () => {
      const defaultHelpers = new DeafAccessibilityHelpers();
      expect(defaultHelpers.visualFeedbackIntensity).to.equal('medium');
      expect(defaultHelpers.vibrationEnabled).to.be.true;
      expect(defaultHelpers.captionsEnabled).to.be.true;
    });
    
    it('should initialize with custom settings when options are provided', () => {
      expect(accessibilityHelpers.visualFeedbackIntensity).to.equal('medium');
      expect(accessibilityHelpers.vibrationEnabled).to.be.true;
      expect(accessibilityHelpers.captionsEnabled).to.be.true;
    });
    
    it('should create necessary DOM elements if not provided', () => {
      const minimalHelpers = new DeafAccessibilityHelpers({
        container: document.getElementById('alejo-container'),
        notificationArea: null,
        captionContainer: null
      });
      
      // Check if elements were created
      expect(document.querySelector('.alejo-notification-area')).to.not.be.null;
      expect(document.querySelector('.alejo-caption-container')).to.not.be.null;
    });
    
    it('should log initialization to audit trail', () => {
      expect(auditTrailStub.calledWith('ACCESSIBILITY', 'Deaf Accessibility Helpers initialized')).to.be.true;
    });
  });
  
  describe('Visual Notifications', () => {
    it('should create a visual notification when showVisualNotification is called', () => {
      accessibilityHelpers.showVisualNotification('Test notification', 'info');
      
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification).to.not.be.null;
      expect(notification.textContent).to.include('Test notification');
      expect(notification.classList.contains('info')).to.be.true;
    });
    
    it('should apply the correct notification type class', () => {
      accessibilityHelpers.showVisualNotification('Warning message', 'warning');
      
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.classList.contains('warning')).to.be.true;
    });
    
    it('should automatically remove notifications after the specified duration', (done) => {
      accessibilityHelpers.showVisualNotification('Quick notification', 'info', 100);
      
      expect(document.querySelector('.alejo-visual-notification')).to.not.be.null;
      
      setTimeout(() => {
        expect(document.querySelector('.alejo-visual-notification')).to.be.null;
        done();
      }, 200);
    });
    
    it('should apply intensity class based on configuration', () => {
      accessibilityHelpers.updateConfig({ visualFeedbackIntensity: 'high' });
      accessibilityHelpers.showVisualNotification('High intensity', 'info');
      
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.classList.contains('intensity-high')).to.be.true;
    });
    
    it('should log notification creation to audit trail', () => {
      accessibilityHelpers.showVisualNotification('Audit test', 'info');
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Visual notification displayed/))).to.be.true;
    });
  });
  
  describe('Visual Alerts', () => {
    it('should create a visual alert when flashAlert is called', () => {
      accessibilityHelpers.flashAlert('error');
      
      const alert = document.querySelector('.alejo-visual-alert');
      expect(alert).to.not.be.null;
      expect(alert.classList.contains('error')).to.be.true;
    });
    
    it('should apply the correct alert type class', () => {
      accessibilityHelpers.flashAlert('success');
      
      const alert = document.querySelector('.alejo-visual-alert');
      expect(alert.classList.contains('success')).to.be.true;
    });
    
    it('should automatically remove alerts after the specified duration', (done) => {
      accessibilityHelpers.flashAlert('info', 100);
      
      expect(document.querySelector('.alejo-visual-alert')).to.not.be.null;
      
      setTimeout(() => {
        expect(document.querySelector('.alejo-visual-alert')).to.be.null;
        done();
      }, 200);
    });
    
    it('should apply intensity class based on configuration', () => {
      accessibilityHelpers.updateConfig({ visualFeedbackIntensity: 'low' });
      accessibilityHelpers.flashAlert('info');
      
      const alert = document.querySelector('.alejo-visual-alert');
      expect(alert.classList.contains('intensity-low')).to.be.true;
    });
  });
  
  describe('Visual Metronome', () => {
    it('should create a visual metronome when startVisualMetronome is called', () => {
      accessibilityHelpers.startVisualMetronome(60);
      
      const metronome = document.querySelector('.alejo-visual-metronome');
      expect(metronome).to.not.be.null;
    });
    
    it('should update the metronome tempo when updateMetronomeTempo is called', () => {
      accessibilityHelpers.startVisualMetronome(60);
      accessibilityHelpers.updateMetronomeTempo(120);
      
      // Check that the interval has been updated (indirectly)
      expect(accessibilityHelpers.metronomeInterval).to.equal(500); // 60000 / 120
    });
    
    it('should stop the metronome when stopVisualMetronome is called', () => {
      accessibilityHelpers.startVisualMetronome(60);
      expect(document.querySelector('.alejo-visual-metronome')).to.not.be.null;
      
      accessibilityHelpers.stopVisualMetronome();
      expect(document.querySelector('.alejo-visual-metronome')).to.be.null;
    });
  });
  
  describe('Vibration Feedback', () => {
    it('should call navigator.vibrate when vibratePattern is called', () => {
      accessibilityHelpers.vibratePattern([100, 50, 100]);
      
      expect(navigator.vibrate.calledWith([100, 50, 100])).to.be.true;
    });
    
    it('should not vibrate when vibrationEnabled is false', () => {
      accessibilityHelpers.updateConfig({ vibrationEnabled: false });
      accessibilityHelpers.vibratePattern([100]);
      
      expect(navigator.vibrate.called).to.be.false;
    });
    
    it('should vibrate with notification type patterns', () => {
      accessibilityHelpers.vibrateNotification('error');
      
      // Should have called vibrate with some pattern
      expect(navigator.vibrate.called).to.be.true;
    });
    
    it('should log vibration events to audit trail', () => {
      accessibilityHelpers.vibratePattern([100, 50, 100]);
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Vibration feedback provided/))).to.be.true;
    });
  });
  
  describe('Caption Management', () => {
    it('should add a caption when showCaption is called', () => {
      accessibilityHelpers.showCaption('Test caption');
      
      const caption = document.querySelector('.alejo-caption');
      expect(caption).to.not.be.null;
      expect(caption.textContent).to.include('Test caption');
    });
    
    it('should not add captions when captionsEnabled is false', () => {
      accessibilityHelpers.updateConfig({ captionsEnabled: false });
      accessibilityHelpers.showCaption('Disabled caption');
      
      expect(document.querySelector('.alejo-caption')).to.be.null;
    });
    
    it('should clear captions when clearCaptions is called', () => {
      accessibilityHelpers.showCaption('Caption 1');
      accessibilityHelpers.showCaption('Caption 2');
      
      expect(document.querySelectorAll('.alejo-caption').length).to.equal(2);
      
      accessibilityHelpers.clearCaptions();
      expect(document.querySelectorAll('.alejo-caption').length).to.equal(0);
    });
    
    it('should log caption events to audit trail', () => {
      accessibilityHelpers.showCaption('Audit caption');
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Caption displayed/))).to.be.true;
    });
  });
  
  describe('Audio Alternative Visualization', () => {
    it('should create audio visualization when visualizeAudio is called', () => {
      const audioData = new Uint8Array(128).fill(50);
      accessibilityHelpers.visualizeAudio(audioData);
      
      const visualization = document.querySelector('.alejo-audio-visualization');
      expect(visualization).to.not.be.null;
    });
    
    it('should update audio visualization when updateAudioVisualization is called', () => {
      const audioData1 = new Uint8Array(128).fill(50);
      const audioData2 = new Uint8Array(128).fill(100);
      
      accessibilityHelpers.visualizeAudio(audioData1);
      
      // Get the initial state
      const visualization = document.querySelector('.alejo-audio-visualization');
      const initialState = visualization.innerHTML;
      
      // Update with new data
      accessibilityHelpers.updateAudioVisualization(audioData2);
      
      // Should have changed
      expect(visualization.innerHTML).to.not.equal(initialState);
    });
    
    it('should clear audio visualization when clearAudioVisualization is called', () => {
      const audioData = new Uint8Array(128).fill(50);
      accessibilityHelpers.visualizeAudio(audioData);
      
      expect(document.querySelector('.alejo-audio-visualization')).to.not.be.null;
      
      accessibilityHelpers.clearAudioVisualization();
      expect(document.querySelector('.alejo-audio-visualization')).to.be.null;
    });
  });
  
  describe('Event Notification Conversion', () => {
    it('should convert audio events to visual notifications', () => {
      const showVisualNotificationSpy = sinon.spy(accessibilityHelpers, 'showVisualNotification');
      
      accessibilityHelpers.notifyEvent('audio-alert', {
        message: 'Audio alert message',
        type: 'warning'
      });
      
      expect(showVisualNotificationSpy.calledWith('Audio alert message', 'warning')).to.be.true;
    });
    
    it('should convert audio events to vibration patterns', () => {
      const vibrateNotificationSpy = sinon.spy(accessibilityHelpers, 'vibrateNotification');
      
      accessibilityHelpers.notifyEvent('audio-alert', {
        message: 'Audio alert message',
        type: 'error'
      });
      
      expect(vibrateNotificationSpy.calledWith('error')).to.be.true;
    });
    
    it('should handle different event types appropriately', () => {
      const flashAlertSpy = sinon.spy(accessibilityHelpers, 'flashAlert');
      
      accessibilityHelpers.notifyEvent('system-alert', {
        type: 'success'
      });
      
      expect(flashAlertSpy.calledWith('success')).to.be.true;
    });
    
    it('should log event notifications to audit trail', () => {
      accessibilityHelpers.notifyEvent('audio-alert', {
        message: 'Test event',
        type: 'info'
      });
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Event notification converted/))).to.be.true;
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration when updateConfig is called', () => {
      accessibilityHelpers.updateConfig({
        visualFeedbackIntensity: 'low',
        vibrationEnabled: false,
        captionsEnabled: false
      });
      
      expect(accessibilityHelpers.visualFeedbackIntensity).to.equal('low');
      expect(accessibilityHelpers.vibrationEnabled).to.be.false;
      expect(accessibilityHelpers.captionsEnabled).to.be.false;
    });
    
    it('should log configuration updates to audit trail', () => {
      accessibilityHelpers.updateConfig({ visualFeedbackIntensity: 'high' });
      
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Deaf Accessibility Helpers configuration updated/))).to.be.true;
    });
  });
  
  describe('Accessibility', () => {
    it('should set appropriate ARIA attributes on notifications', () => {
      accessibilityHelpers.showVisualNotification('Accessible notification', 'info');
      
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.getAttribute('role')).to.equal('alert');
      expect(notification.getAttribute('aria-live')).to.equal('assertive');
    });
    
    it('should set appropriate ARIA attributes on captions', () => {
      accessibilityHelpers.showCaption('Accessible caption');
      
      const caption = document.querySelector('.alejo-caption');
      expect(caption.getAttribute('aria-live')).to.equal('polite');
    });
  });
  
  describe('Event Handling', () => {
    it('should emit events when notifications are shown', (done) => {
      accessibilityHelpers.on('notification:shown', (data) => {
        expect(data.message).to.equal('Event test');
        expect(data.type).to.equal('info');
        done();
      });
      
      accessibilityHelpers.showVisualNotification('Event test', 'info');
    });
    
    it('should emit events when vibration feedback is provided', (done) => {
      accessibilityHelpers.on('vibration:triggered', (data) => {
        expect(data.pattern).to.deep.equal([100, 50, 100]);
        done();
      });
      
      accessibilityHelpers.vibratePattern([100, 50, 100]);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle vibration API not supported error', () => {
      // Remove vibration support
      delete navigator.vibrate;
      
      const errorSpy = sinon.spy(console, 'warn');
      
      // This should not throw despite missing vibration API
      expect(() => {
        accessibilityHelpers.vibratePattern([100]);
      }).to.not.throw();
      
      expect(errorSpy.called).to.be.true;
      
      errorSpy.restore();
    });
    
    it('should handle invalid notification types gracefully', () => {
      // Should not throw an error for invalid type
      expect(() => {
        accessibilityHelpers.showVisualNotification('Invalid type test', 'invalid-type');
      }).to.not.throw();
      
      // Should default to 'info' type
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.classList.contains('info')).to.be.true;
    });
  });
});
