/**
 * @file visual-feedback-system.test.js
 * @description Unit and integration tests for the Visual Feedback System component
 * @copyright ALEJO AI Assistant (c) 2025
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { VisualFeedbackSystem } from '../../../src/personalization/hearing/visual-feedback-system';
import { AuditTrail } from '../../../src/utils/audit-trail';

describe('Visual Feedback System', () => {
  let visualFeedbackSystem;
  let dom;
  let document;
  let window;
  let auditTrailStub;
  
  beforeEach(() => {
    // Set up a DOM environment for testing
    dom = new JSDOM(`<!DOCTYPE html><div id="alejo-container"></div>`);
    window = dom.window;
    document = window.document;
    
    // Stub the global document
    global.document = document;
    global.window = window;
    
    // Stub the audit trail
    auditTrailStub = sinon.stub(AuditTrail, 'log');
    
    // Create a new instance of the visual feedback system
    visualFeedbackSystem = new VisualFeedbackSystem({
      container: document.getElementById('alejo-container'),
      intensity: 'medium',
      colorScheme: 'standard',
      animationStyle: 'fade',
      position: 'bottom-right'
    });
  });
  
  afterEach(() => {
    // Clean up
    auditTrailStub.restore();
    delete global.document;
    delete global.window;
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings when no options are provided', () => {
      const defaultSystem = new VisualFeedbackSystem();
      expect(defaultSystem.intensity).to.equal('medium');
      expect(defaultSystem.colorScheme).to.equal('standard');
      expect(defaultSystem.animationStyle).to.equal('fade');
      expect(defaultSystem.position).to.equal('bottom-right');
    });
    
    it('should initialize with custom settings when options are provided', () => {
      expect(visualFeedbackSystem.intensity).to.equal('medium');
      expect(visualFeedbackSystem.colorScheme).to.equal('standard');
      expect(visualFeedbackSystem.animationStyle).to.equal('fade');
      expect(visualFeedbackSystem.position).to.equal('bottom-right');
    });
    
    it('should create a container element if none is provided', () => {
      const noContainerSystem = new VisualFeedbackSystem({ container: null });
      expect(document.querySelector('.alejo-visual-feedback-container')).to.not.be.null;
    });
    
    it('should log initialization to audit trail', () => {
      expect(auditTrailStub.calledWith('ACCESSIBILITY', 'Visual Feedback System initialized')).to.be.true;
    });
  });
  
  describe('Notification Display', () => {
    it('should create a notification element when showNotification is called', () => {
      visualFeedbackSystem.showNotification('Test notification', 'info');
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification).to.not.be.null;
      expect(notification.textContent).to.include('Test notification');
      expect(notification.classList.contains('info')).to.be.true;
    });
    
    it('should apply the correct notification type class', () => {
      visualFeedbackSystem.showNotification('Warning message', 'warning');
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.classList.contains('warning')).to.be.true;
    });
    
    it('should automatically remove notifications after the specified duration', (done) => {
      visualFeedbackSystem.showNotification('Quick notification', 'info', 100);
      expect(document.querySelector('.alejo-visual-notification')).to.not.be.null;
      
      setTimeout(() => {
        expect(document.querySelector('.alejo-visual-notification')).to.be.null;
        done();
      }, 200);
    });
    
    it('should log notification creation to audit trail', () => {
      visualFeedbackSystem.showNotification('Audit test', 'info');
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Visual notification displayed/))).to.be.true;
    });
  });
  
  describe('Audio Level Indicator', () => {
    it('should create an audio level indicator when showAudioLevelIndicator is called', () => {
      visualFeedbackSystem.showAudioLevelIndicator(0.5);
      const indicator = document.querySelector('.alejo-audio-level-indicator');
      expect(indicator).to.not.be.null;
    });
    
    it('should update the indicator level when updateAudioLevel is called', () => {
      visualFeedbackSystem.showAudioLevelIndicator(0.2);
      visualFeedbackSystem.updateAudioLevel(0.8);
      
      const indicator = document.querySelector('.alejo-audio-level-indicator');
      const level = indicator.querySelector('.level-fill');
      
      // Check that the height or width (depending on orientation) is updated
      // This will depend on your implementation, adjust as needed
      const style = window.getComputedStyle(level);
      expect(parseFloat(style.width) > 0 || parseFloat(style.height) > 0).to.be.true;
    });
    
    it('should remove the indicator when clearAudioLevelIndicator is called', () => {
      visualFeedbackSystem.showAudioLevelIndicator(0.5);
      expect(document.querySelector('.alejo-audio-level-indicator')).to.not.be.null;
      
      visualFeedbackSystem.clearAudioLevelIndicator();
      expect(document.querySelector('.alejo-audio-level-indicator')).to.be.null;
    });
  });
  
  describe('Rhythmic Pattern Visualization', () => {
    it('should create a rhythmic pattern visualization when showRhythmicPattern is called', () => {
      const pattern = [0.2, 0.5, 0.8, 0.3];
      visualFeedbackSystem.showRhythmicPattern(pattern);
      
      const visualization = document.querySelector('.alejo-rhythmic-pattern');
      expect(visualization).to.not.be.null;
      
      // Check that the correct number of elements were created
      const elements = visualization.querySelectorAll('.pattern-element');
      expect(elements.length).to.equal(pattern.length);
    });
    
    it('should update the pattern when updateRhythmicPattern is called', () => {
      visualFeedbackSystem.showRhythmicPattern([0.2, 0.5]);
      visualFeedbackSystem.updateRhythmicPattern([0.3, 0.6, 0.9]);
      
      const visualization = document.querySelector('.alejo-rhythmic-pattern');
      const elements = visualization.querySelectorAll('.pattern-element');
      expect(elements.length).to.equal(3);
    });
    
    it('should remove the pattern when clearRhythmicPattern is called', () => {
      visualFeedbackSystem.showRhythmicPattern([0.2, 0.5]);
      expect(document.querySelector('.alejo-rhythmic-pattern')).to.not.be.null;
      
      visualFeedbackSystem.clearRhythmicPattern();
      expect(document.querySelector('.alejo-rhythmic-pattern')).to.be.null;
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration when updateConfig is called', () => {
      visualFeedbackSystem.updateConfig({
        intensity: 'high',
        colorScheme: 'high-contrast',
        animationStyle: 'bounce',
        position: 'top-left'
      });
      
      expect(visualFeedbackSystem.intensity).to.equal('high');
      expect(visualFeedbackSystem.colorScheme).to.equal('high-contrast');
      expect(visualFeedbackSystem.animationStyle).to.equal('bounce');
      expect(visualFeedbackSystem.position).to.equal('top-left');
    });
    
    it('should apply new position to the container when position is updated', () => {
      visualFeedbackSystem.updateConfig({ position: 'top-center' });
      
      const container = document.querySelector('.alejo-visual-feedback-container');
      expect(container.classList.contains('position-top-center')).to.be.true;
    });
    
    it('should log configuration updates to audit trail', () => {
      visualFeedbackSystem.updateConfig({ intensity: 'low' });
      expect(auditTrailStub.calledWith('ACCESSIBILITY', sinon.match(/Visual Feedback System configuration updated/))).to.be.true;
    });
  });
  
  describe('Accessibility', () => {
    it('should set appropriate ARIA attributes on notifications', () => {
      visualFeedbackSystem.showNotification('Accessible notification', 'info');
      const notification = document.querySelector('.alejo-visual-notification');
      
      expect(notification.getAttribute('role')).to.equal('alert');
      expect(notification.getAttribute('aria-live')).to.equal('assertive');
    });
    
    it('should set appropriate ARIA attributes on audio level indicators', () => {
      visualFeedbackSystem.showAudioLevelIndicator(0.5);
      const indicator = document.querySelector('.alejo-audio-level-indicator');
      
      expect(indicator.getAttribute('role')).to.equal('meter');
      expect(indicator.getAttribute('aria-valuenow')).to.equal('50');
    });
  });
  
  describe('Event Handling', () => {
    it('should emit events when notifications are shown', (done) => {
      visualFeedbackSystem.on('notification:shown', (data) => {
        expect(data.message).to.equal('Event test');
        expect(data.type).to.equal('info');
        done();
      });
      
      visualFeedbackSystem.showNotification('Event test', 'info');
    });
    
    it('should emit events when audio level is updated', (done) => {
      visualFeedbackSystem.showAudioLevelIndicator(0.3);
      
      visualFeedbackSystem.on('audio-level:updated', (data) => {
        expect(data.level).to.equal(0.7);
        done();
      });
      
      visualFeedbackSystem.updateAudioLevel(0.7);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid notification types gracefully', () => {
      // Should not throw an error for invalid type
      expect(() => {
        visualFeedbackSystem.showNotification('Invalid type test', 'invalid-type');
      }).to.not.throw();
      
      // Should default to 'info' type
      const notification = document.querySelector('.alejo-visual-notification');
      expect(notification.classList.contains('info')).to.be.true;
    });
    
    it('should handle invalid audio levels gracefully', () => {
      // Should clamp values to 0-1 range
      visualFeedbackSystem.showAudioLevelIndicator(1.5);
      let indicator = document.querySelector('.alejo-audio-level-indicator');
      expect(indicator.getAttribute('aria-valuenow')).to.equal('100');
      
      visualFeedbackSystem.updateAudioLevel(-0.5);
      indicator = document.querySelector('.alejo-audio-level-indicator');
      expect(indicator.getAttribute('aria-valuenow')).to.equal('0');
    });
  });
});
