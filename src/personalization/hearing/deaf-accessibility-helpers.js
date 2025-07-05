/**
 * ALEJO Deaf Accessibility Helpers
 * 
 * This module provides accessibility features for deaf and hard-of-hearing users,
 * including visual alternatives to audio, captions, and visual feedback.
 * 
 * @module deaf-accessibility-helpers
 * @author ALEJO Team
 * @version 1.0.0
 * @license MIT
 */

import { EventEmitter } from '../../core/events/event-emitter.js';
import { auditTrail } from '../../core/logging/audit-trail.js';
import { consentManager } from '../../core/privacy/consent-manager.js';

/**
 * Class providing accessibility helpers for deaf and hard-of-hearing users
 * @extends EventEmitter
 */
class DeafAccessibilityHelpers extends EventEmitter {
  /**
   * Create a new DeafAccessibilityHelpers instance
   */
  constructor() {
    super();
    
    // Configuration defaults
    this.config = {
      enabled: false,
      visualNotifications: true,
      captions: true,
      vibrationFeedback: true,
      visualIndicators: true,
      captionStyle: 'standard', // standard, enhanced, high-contrast
      visualFeedbackIntensity: 'medium' // low, medium, high
    };
    
    this.state = {
      initialized: false,
      captionsActive: false,
      visualNotificationsActive: false,
      vibrationActive: false,
      visualIndicatorsActive: false,
      captionContainer: null,
      notificationContainer: null,
      visualIndicatorElements: {}
    };
    
    // Bind methods
    this.showVisualNotification = this.showVisualNotification.bind(this);
    this.showCaption = this.showCaption.bind(this);
    this.provideVibrationFeedback = this.provideVibrationFeedback.bind(this);
    this.updateVisualIndicator = this.updateVisualIndicator.bind(this);
  }
  
  /**
   * Initialize the deaf accessibility helpers
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    if (this.state.initialized) return true;
    
    try {
      // Update configuration with provided options
      this.config = {
        ...this.config,
        ...options
      };
      
      // Create UI elements if needed
      if (this.config.captions) {
        this._createCaptionContainer();
      }
      
      if (this.config.visualNotifications) {
        this._createNotificationContainer();
      }
      
      // Set up event listeners
      this._setupEventListeners();
      
      this.state.initialized = true;
      this.state.captionsActive = this.config.captions;
      this.state.visualNotificationsActive = this.config.visualNotifications;
      this.state.vibrationActive = this.config.vibrationFeedback;
      this.state.visualIndicatorsActive = this.config.visualIndicators;
      
      // Log initialization
      auditTrail.log({
        action: 'deaf_accessibility_helpers_initialized',
        details: {
          captions: this.config.captions,
          visualNotifications: this.config.visualNotifications,
          vibrationFeedback: this.config.vibrationFeedback,
          visualIndicators: this.config.visualIndicators
        },
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize deaf accessibility helpers:', error);
      
      auditTrail.log({
        action: 'deaf_accessibility_helpers_initialization_failed',
        details: { error: error.message },
        component: 'deaf_accessibility',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Show a visual notification as an alternative to audio alerts
   * @param {Object} options - Notification options
   * @param {string} options.message - Notification message
   * @param {string} options.type - Notification type (info, warning, error, success)
   * @param {number} options.duration - Duration in ms (0 for persistent)
   * @param {boolean} options.flash - Whether to flash the notification
   * @returns {string} - Notification ID
   */
  showVisualNotification(options) {
    if (!this.state.initialized || !this.state.visualNotificationsActive) {
      return null;
    }
    
    try {
      const { message, type = 'info', duration = 3000, flash = false } = options;
      
      // Create notification element
      const notificationId = `notification-${Date.now()}`;
      const notification = document.createElement('div');
      notification.id = notificationId;
      notification.className = `alejo-visual-notification alejo-notification-${type}`;
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');
      
      // Add icon based on type
      const iconElement = document.createElement('span');
      iconElement.className = 'alejo-notification-icon';
      
      // Set icon based on type
      switch (type) {
        case 'warning':
          iconElement.innerHTML = '⚠️';
          break;
        case 'error':
          iconElement.innerHTML = '❌';
          break;
        case 'success':
          iconElement.innerHTML = '✅';
          break;
        default:
          iconElement.innerHTML = 'ℹ️';
      }
      
      notification.appendChild(iconElement);
      
      // Add message
      const messageElement = document.createElement('span');
      messageElement.className = 'alejo-notification-message';
      messageElement.textContent = message;
      notification.appendChild(messageElement);
      
      // Add to container
      this.state.notificationContainer.appendChild(notification);
      
      // Apply flash effect if requested
      if (flash) {
        notification.classList.add('alejo-notification-flash');
      }
      
      // Auto-remove after duration if not persistent
      if (duration > 0) {
        setTimeout(() => {
          if (notification.parentNode) {
            notification.classList.add('alejo-notification-fade-out');
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 500);
          }
        }, duration);
      }
      
      // Log notification
      auditTrail.log({
        action: 'visual_notification_shown',
        details: {
          type,
          message,
          duration,
          flash
        },
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return notificationId;
    } catch (error) {
      console.error('Error showing visual notification:', error);
      return null;
    }
  }
  
  /**
   * Show a caption for spoken content or audio
   * @param {Object} options - Caption options
   * @param {string} options.text - Caption text
   * @param {string} options.speaker - Speaker name (optional)
   * @param {number} options.duration - Duration in ms (0 for automatic)
   * @param {string} options.position - Caption position (bottom, top)
   * @returns {string} - Caption ID
   */
  showCaption(options) {
    if (!this.state.initialized || !this.state.captionsActive) {
      return null;
    }
    
    try {
      const { 
        text, 
        speaker = null, 
        duration = 0, 
        position = 'bottom' 
      } = options;
      
      // Create caption element
      const captionId = `caption-${Date.now()}`;
      const caption = document.createElement('div');
      caption.id = captionId;
      caption.className = `alejo-caption alejo-caption-${position} alejo-caption-${this.config.captionStyle}`;
      caption.setAttribute('role', 'text');
      
      // Add speaker if provided
      if (speaker) {
        const speakerElement = document.createElement('span');
        speakerElement.className = 'alejo-caption-speaker';
        speakerElement.textContent = speaker + ': ';
        caption.appendChild(speakerElement);
      }
      
      // Add text
      const textElement = document.createElement('span');
      textElement.className = 'alejo-caption-text';
      textElement.textContent = text;
      caption.appendChild(textElement);
      
      // Add to container
      this.state.captionContainer.appendChild(caption);
      
      // Calculate automatic duration based on text length if duration is 0
      const actualDuration = duration === 0 ? 
        Math.max(2000, text.length * 80) : duration;
      
      // Auto-remove after duration
      setTimeout(() => {
        if (caption.parentNode) {
          caption.classList.add('alejo-caption-fade-out');
          setTimeout(() => {
            if (caption.parentNode) {
              caption.parentNode.removeChild(caption);
            }
          }, 500);
        }
      }, actualDuration);
      
      // Log caption
      auditTrail.log({
        action: 'caption_shown',
        details: {
          text,
          speaker,
          duration: actualDuration,
          position
        },
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return captionId;
    } catch (error) {
      console.error('Error showing caption:', error);
      return null;
    }
  }
  
  /**
   * Provide vibration feedback as an alternative to audio
   * @param {Object} options - Vibration options
   * @param {Array<number>} options.pattern - Vibration pattern in ms [on, off, on, ...]
   * @param {string} options.type - Predefined pattern type (notification, warning, error, success)
   * @returns {boolean} - Whether vibration was triggered
   */
  provideVibrationFeedback(options) {
    if (!this.state.initialized || !this.state.vibrationActive) {
      return false;
    }
    
    try {
      // Check if vibration API is available
      if (!navigator.vibrate) {
        return false;
      }
      
      let pattern;
      
      if (options.pattern) {
        pattern = options.pattern;
      } else if (options.type) {
        // Predefined patterns
        switch (options.type) {
          case 'notification':
            pattern = [100];
            break;
          case 'warning':
            pattern = [100, 50, 100];
            break;
          case 'error':
            pattern = [100, 50, 100, 50, 100];
            break;
          case 'success':
            pattern = [200];
            break;
          default:
            pattern = [100];
        }
      } else {
        pattern = [100];
      }
      
      // Trigger vibration
      navigator.vibrate(pattern);
      
      // Log vibration
      auditTrail.log({
        action: 'vibration_feedback_provided',
        details: {
          pattern,
          type: options.type
        },
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Error providing vibration feedback:', error);
      return false;
    }
  }
  
  /**
   * Update a visual indicator for audio or speech events
   * @param {Object} options - Indicator options
   * @param {string} options.id - Indicator ID
   * @param {string} options.type - Indicator type (audio-level, speech-activity, etc.)
   * @param {number} options.value - Indicator value (0-1)
   * @param {string} options.label - Indicator label
   * @returns {boolean} - Whether update was successful
   */
  updateVisualIndicator(options) {
    if (!this.state.initialized || !this.state.visualIndicatorsActive) {
      return false;
    }
    
    try {
      const { id, type, value, label } = options;
      
      // Get or create indicator element
      let indicator = this.state.visualIndicatorElements[id];
      
      if (!indicator) {
        // Create new indicator
        indicator = document.createElement('div');
        indicator.id = `alejo-indicator-${id}`;
        indicator.className = `alejo-visual-indicator alejo-indicator-${type}`;
        indicator.setAttribute('role', 'meter');
        indicator.setAttribute('aria-label', label || type);
        
        // Create label element
        const labelElement = document.createElement('div');
        labelElement.className = 'alejo-indicator-label';
        labelElement.textContent = label || type;
        indicator.appendChild(labelElement);
        
        // Create value element
        const valueElement = document.createElement('div');
        valueElement.className = 'alejo-indicator-value';
        indicator.appendChild(valueElement);
        
        // Add to document
        document.body.appendChild(indicator);
        
        // Store reference
        this.state.visualIndicatorElements[id] = indicator;
      }
      
      // Update indicator value
      const valueElement = indicator.querySelector('.alejo-indicator-value');
      
      // Update value based on type
      switch (type) {
        case 'audio-level':
          valueElement.style.width = `${value * 100}%`;
          valueElement.style.backgroundColor = value > 0.7 ? 'red' : 
                                              value > 0.4 ? 'yellow' : 'green';
          break;
        case 'speech-activity':
          valueElement.style.height = `${value * 100}%`;
          valueElement.style.backgroundColor = value > 0 ? 'blue' : 'gray';
          break;
        default:
          valueElement.style.width = `${value * 100}%`;
      }
      
      // Update ARIA attributes
      indicator.setAttribute('aria-valuenow', Math.round(value * 100));
      indicator.setAttribute('aria-valuemin', '0');
      indicator.setAttribute('aria-valuemax', '100');
      
      return true;
    } catch (error) {
      console.error('Error updating visual indicator:', error);
      return false;
    }
  }
  
  /**
   * Enable or disable captions
   * @param {boolean} enabled - Whether to enable captions
   * @returns {boolean} - Whether the operation was successful
   */
  setCaptionsEnabled(enabled) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      this.config.captions = enabled;
      this.state.captionsActive = enabled;
      
      if (enabled && !this.state.captionContainer) {
        this._createCaptionContainer();
      }
      
      // Log status change
      auditTrail.log({
        action: enabled ? 'captions_enabled' : 'captions_disabled',
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} captions:`, error);
      return false;
    }
  }
  
  /**
   * Enable or disable visual notifications
   * @param {boolean} enabled - Whether to enable visual notifications
   * @returns {boolean} - Whether the operation was successful
   */
  setVisualNotificationsEnabled(enabled) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      this.config.visualNotifications = enabled;
      this.state.visualNotificationsActive = enabled;
      
      if (enabled && !this.state.notificationContainer) {
        this._createNotificationContainer();
      }
      
      // Log status change
      auditTrail.log({
        action: enabled ? 'visual_notifications_enabled' : 'visual_notifications_disabled',
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} visual notifications:`, error);
      return false;
    }
  }
  
  /**
   * Enable or disable vibration feedback
   * @param {boolean} enabled - Whether to enable vibration feedback
   * @returns {boolean} - Whether the operation was successful
   */
  setVibrationFeedbackEnabled(enabled) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      this.config.vibrationFeedback = enabled;
      this.state.vibrationActive = enabled;
      
      // Log status change
      auditTrail.log({
        action: enabled ? 'vibration_feedback_enabled' : 'vibration_feedback_disabled',
        component: 'deaf_accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} vibration feedback:`, error);
      return false;
    }
  }
  
  /**
   * Create caption container element
   * @private
   */
  _createCaptionContainer() {
    // Check if container already exists
    let container = document.getElementById('alejo-caption-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'alejo-caption-container';
      container.className = 'alejo-caption-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    
    this.state.captionContainer = container;
  }
  
  /**
   * Create notification container element
   * @private
   */
  _createNotificationContainer() {
    // Check if container already exists
    let container = document.getElementById('alejo-notification-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'alejo-notification-container';
      container.className = 'alejo-notification-container';
      document.body.appendChild(container);
    }
    
    this.state.notificationContainer = container;
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for audio events to provide visual alternatives
    document.addEventListener('alejo:audio_playback', (event) => {
      const { audioId, type, message } = event.detail;
      
      // Show visual notification for audio events
      if (this.state.visualNotificationsActive) {
        this.showVisualNotification({
          message: message || `Audio: ${type || audioId}`,
          type: 'info',
          duration: 3000,
          flash: true
        });
      }
      
      // Provide vibration feedback
      if (this.state.vibrationActive) {
        this.provideVibrationFeedback({
          type: 'notification'
        });
      }
    });
    
    // Listen for speech events to provide captions
    document.addEventListener('alejo:speech_event', (event) => {
      const { text, speaker } = event.detail;
      
      // Show caption for speech
      if (this.state.captionsActive && text) {
        this.showCaption({
          text,
          speaker,
          duration: 0, // Auto-calculate based on text length
          position: 'bottom'
        });
      }
    });
  }
}

// Create and export singleton instance
const deafAccessibilityHelpers = new DeafAccessibilityHelpers();
export default deafAccessibilityHelpers;
