/**
 * ALEJO Visual Feedback System
 * 
 * This module provides enhanced visual feedback as alternatives to audio cues,
 * particularly for deaf and hard-of-hearing users.
 * 
 * @module visual-feedback-system
 * @author ALEJO Team
 * @version 1.0.0
 * @license MIT
 */

import { EventEmitter } from '../../core/events/event-emitter.js';
import { auditTrail } from '../../core/logging/audit-trail.js';

/**
 * Class providing visual feedback alternatives to audio
 * @extends EventEmitter
 */
class VisualFeedbackSystem extends EventEmitter {
  /**
   * Create a new VisualFeedbackSystem instance
   */
  constructor() {
    super();
    
    // Configuration defaults
    this.config = {
      enabled: true,
      intensity: 'medium', // low, medium, high
      colorScheme: 'standard', // standard, high-contrast, monochrome
      animationSpeed: 'normal', // slow, normal, fast
      position: 'top-right', // top-right, top-left, bottom-right, bottom-left, center
      size: 'medium' // small, medium, large
    };
    
    this.state = {
      initialized: false,
      activeIndicators: {},
      feedbackContainer: null
    };
    
    // Predefined visual patterns
    this.patterns = {
      notification: {
        color: '#3498db',
        duration: 2000,
        animation: 'pulse'
      },
      warning: {
        color: '#f39c12',
        duration: 3000,
        animation: 'flash'
      },
      error: {
        color: '#e74c3c',
        duration: 4000,
        animation: 'shake'
      },
      success: {
        color: '#2ecc71',
        duration: 2000,
        animation: 'bounce'
      },
      recording: {
        color: '#e74c3c',
        duration: 0, // Persistent
        animation: 'pulse-continuous'
      },
      processing: {
        color: '#3498db',
        duration: 0, // Persistent
        animation: 'spin'
      }
    };
    
    // Bind methods
    this.showVisualFeedback = this.showVisualFeedback.bind(this);
    this.showAudioLevelIndicator = this.showAudioLevelIndicator.bind(this);
    this.showRhythmicPattern = this.showRhythmicPattern.bind(this);
    this.clearFeedback = this.clearFeedback.bind(this);
  }
  
  /**
   * Initialize the visual feedback system
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
      
      // Create feedback container
      this._createFeedbackContainer();
      
      // Add CSS styles
      this._addStyles();
      
      this.state.initialized = true;
      
      // Log initialization
      auditTrail.log({
        action: 'visual_feedback_system_initialized',
        details: {
          intensity: this.config.intensity,
          colorScheme: this.config.colorScheme,
          position: this.config.position
        },
        component: 'visual_feedback',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize visual feedback system:', error);
      
      auditTrail.log({
        action: 'visual_feedback_system_initialization_failed',
        details: { error: error.message },
        component: 'visual_feedback',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Show visual feedback for an event
   * @param {Object} options - Feedback options
   * @param {string} options.type - Feedback type (notification, warning, error, success, etc.)
   * @param {string} options.message - Optional message to display
   * @param {number} options.duration - Duration in ms (0 for persistent)
   * @param {string} options.position - Position override
   * @returns {string} - Feedback ID
   */
  showVisualFeedback(options) {
    if (!this.state.initialized) {
      return null;
    }
    
    try {
      const { 
        type = 'notification', 
        message = null, 
        duration = null,
        position = null
      } = options;
      
      // Get pattern for type
      const pattern = this.patterns[type] || this.patterns.notification;
      
      // Create feedback element
      const feedbackId = `visual-feedback-${Date.now()}`;
      const feedback = document.createElement('div');
      feedback.id = feedbackId;
      feedback.className = `alejo-visual-feedback alejo-${type}-feedback alejo-${this.config.intensity}-intensity`;
      
      // Set position
      feedback.classList.add(`alejo-position-${position || this.config.position}`);
      
      // Set size
      feedback.classList.add(`alejo-size-${this.config.size}`);
      
      // Add animation
      feedback.classList.add(`alejo-animation-${pattern.animation}`);
      
      // Set color based on pattern and color scheme
      let color = pattern.color;
      if (this.config.colorScheme === 'high-contrast') {
        // Enhance contrast
        color = this._enhanceContrast(color);
      } else if (this.config.colorScheme === 'monochrome') {
        // Convert to grayscale
        color = this._convertToGrayscale(color);
      }
      feedback.style.backgroundColor = color;
      
      // Add message if provided
      if (message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'alejo-feedback-message';
        messageElement.textContent = message;
        feedback.appendChild(messageElement);
      }
      
      // Add to container
      this.state.feedbackContainer.appendChild(feedback);
      
      // Store reference
      this.state.activeIndicators[feedbackId] = feedback;
      
      // Auto-remove after duration if not persistent
      const actualDuration = duration !== null ? duration : pattern.duration;
      if (actualDuration > 0) {
        setTimeout(() => {
          this.clearFeedback(feedbackId);
        }, actualDuration);
      }
      
      // Log feedback
      auditTrail.log({
        action: 'visual_feedback_shown',
        details: {
          type,
          message,
          duration: actualDuration
        },
        component: 'visual_feedback',
        level: 'info'
      });
      
      return feedbackId;
    } catch (error) {
      console.error('Error showing visual feedback:', error);
      return null;
    }
  }
  
  /**
   * Show audio level indicator
   * @param {Object} options - Indicator options
   * @param {number} options.level - Audio level (0-1)
   * @param {string} options.source - Audio source identifier
   * @param {string} options.position - Position override
   * @returns {string} - Indicator ID
   */
  showAudioLevelIndicator(options) {
    if (!this.state.initialized) {
      return null;
    }
    
    try {
      const { level, source = 'default', position = null } = options;
      
      // Create or update indicator
      const indicatorId = `audio-level-${source}`;
      let indicator = this.state.activeIndicators[indicatorId];
      
      if (!indicator) {
        // Create new indicator
        indicator = document.createElement('div');
        indicator.id = indicatorId;
        indicator.className = 'alejo-audio-level-indicator';
        indicator.setAttribute('role', 'meter');
        indicator.setAttribute('aria-label', 'Audio level');
        
        // Set position
        indicator.classList.add(`alejo-position-${position || this.config.position}`);
        
        // Set size
        indicator.classList.add(`alejo-size-${this.config.size}`);
        
        // Create level bar
        const levelBar = document.createElement('div');
        levelBar.className = 'alejo-level-bar';
        indicator.appendChild(levelBar);
        
        // Add to container
        this.state.feedbackContainer.appendChild(indicator);
        
        // Store reference
        this.state.activeIndicators[indicatorId] = indicator;
      }
      
      // Update level
      const levelBar = indicator.querySelector('.alejo-level-bar');
      levelBar.style.height = `${level * 100}%`;
      
      // Set color based on level
      let color;
      if (level > 0.8) {
        color = '#e74c3c'; // Red for high levels
      } else if (level > 0.5) {
        color = '#f39c12'; // Orange for medium levels
      } else {
        color = '#2ecc71'; // Green for low levels
      }
      
      // Apply color scheme adjustments
      if (this.config.colorScheme === 'high-contrast') {
        color = this._enhanceContrast(color);
      } else if (this.config.colorScheme === 'monochrome') {
        color = this._convertToGrayscale(color);
      }
      
      levelBar.style.backgroundColor = color;
      
      // Update ARIA attributes
      indicator.setAttribute('aria-valuenow', Math.round(level * 100));
      indicator.setAttribute('aria-valuemin', '0');
      indicator.setAttribute('aria-valuemax', '100');
      
      return indicatorId;
    } catch (error) {
      console.error('Error showing audio level indicator:', error);
      return null;
    }
  }
  
  /**
   * Show rhythmic pattern visualization (for music, speech, etc.)
   * @param {Object} options - Pattern options
   * @param {Array<number>} options.pattern - Array of values (0-1) representing the pattern
   * @param {number} options.tempo - Tempo in BPM
   * @param {string} options.type - Pattern type (music, speech, etc.)
   * @returns {string} - Pattern ID
   */
  showRhythmicPattern(options) {
    if (!this.state.initialized) {
      return null;
    }
    
    try {
      const { pattern, tempo = 120, type = 'music' } = options;
      
      if (!pattern || !Array.isArray(pattern)) {
        return null;
      }
      
      // Create pattern ID
      const patternId = `rhythmic-pattern-${Date.now()}`;
      
      // Create pattern container
      const patternContainer = document.createElement('div');
      patternContainer.id = patternId;
      patternContainer.className = `alejo-rhythmic-pattern alejo-${type}-pattern`;
      
      // Set position
      patternContainer.classList.add(`alejo-position-${this.config.position}`);
      
      // Set size
      patternContainer.classList.add(`alejo-size-${this.config.size}`);
      
      // Calculate bar width based on pattern length
      const barWidth = 100 / pattern.length;
      
      // Create bars for each value in pattern
      pattern.forEach((value, index) => {
        const bar = document.createElement('div');
        bar.className = 'alejo-rhythm-bar';
        bar.style.width = `${barWidth}%`;
        bar.style.height = `${value * 100}%`;
        
        // Set color based on value
        let color;
        if (value > 0.8) {
          color = '#3498db'; // Blue for high values
        } else if (value > 0.5) {
          color = '#9b59b6'; // Purple for medium values
        } else {
          color = '#2ecc71'; // Green for low values
        }
        
        // Apply color scheme adjustments
        if (this.config.colorScheme === 'high-contrast') {
          color = this._enhanceContrast(color);
        } else if (this.config.colorScheme === 'monochrome') {
          color = this._convertToGrayscale(color);
        }
        
        bar.style.backgroundColor = color;
        
        // Add animation delay based on index
        const animationDelay = (index / pattern.length) * (60000 / tempo);
        bar.style.animationDelay = `${animationDelay}ms`;
        
        patternContainer.appendChild(bar);
      });
      
      // Add to container
      this.state.feedbackContainer.appendChild(patternContainer);
      
      // Store reference
      this.state.activeIndicators[patternId] = patternContainer;
      
      // Log pattern visualization
      auditTrail.log({
        action: 'rhythmic_pattern_shown',
        details: {
          type,
          tempo,
          patternLength: pattern.length
        },
        component: 'visual_feedback',
        level: 'info'
      });
      
      return patternId;
    } catch (error) {
      console.error('Error showing rhythmic pattern:', error);
      return null;
    }
  }
  
  /**
   * Clear a specific feedback element
   * @param {string} feedbackId - ID of the feedback to clear
   * @returns {boolean} - Whether the operation was successful
   */
  clearFeedback(feedbackId) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      const feedback = this.state.activeIndicators[feedbackId];
      
      if (!feedback) {
        return false;
      }
      
      // Add fade-out class
      feedback.classList.add('alejo-feedback-fade-out');
      
      // Remove after animation
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
        
        // Remove from active indicators
        delete this.state.activeIndicators[feedbackId];
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Error clearing feedback:', error);
      return false;
    }
  }
  
  /**
   * Clear all feedback elements
   * @returns {boolean} - Whether the operation was successful
   */
  clearAllFeedback() {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      // Get all feedback IDs
      const feedbackIds = Object.keys(this.state.activeIndicators);
      
      // Clear each feedback
      feedbackIds.forEach(id => this.clearFeedback(id));
      
      return true;
    } catch (error) {
      console.error('Error clearing all feedback:', error);
      return false;
    }
  }
  
  /**
   * Create feedback container element
   * @private
   */
  _createFeedbackContainer() {
    // Check if container already exists
    let container = document.getElementById('alejo-visual-feedback-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'alejo-visual-feedback-container';
      container.className = 'alejo-visual-feedback-container';
      document.body.appendChild(container);
    }
    
    this.state.feedbackContainer = container;
  }
  
  /**
   * Add CSS styles for visual feedback
   * @private
   */
  _addStyles() {
    // Check if styles already exist
    if (document.getElementById('alejo-visual-feedback-styles')) {
      return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'alejo-visual-feedback-styles';
    
    // Define CSS
    const css = `
      .alejo-visual-feedback-container {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
      }
      
      .alejo-visual-feedback {
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        margin: 8px;
        overflow: hidden;
        pointer-events: none;
      }
      
      /* Positions */
      .alejo-position-top-right {
        top: 20px;
        right: 20px;
      }
      
      .alejo-position-top-left {
        top: 20px;
        left: 20px;
      }
      
      .alejo-position-bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .alejo-position-bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .alejo-position-center {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      /* Sizes */
      .alejo-size-small {
        width: 30px;
        height: 30px;
      }
      
      .alejo-size-medium {
        width: 50px;
        height: 50px;
      }
      
      .alejo-size-large {
        width: 80px;
        height: 80px;
      }
      
      /* Intensities */
      .alejo-low-intensity {
        opacity: 0.5;
      }
      
      .alejo-medium-intensity {
        opacity: 0.75;
      }
      
      .alejo-high-intensity {
        opacity: 1;
      }
      
      /* Animations */
      .alejo-animation-pulse {
        animation: alejo-pulse 1s ease-in-out;
      }
      
      .alejo-animation-pulse-continuous {
        animation: alejo-pulse 1s ease-in-out infinite;
      }
      
      .alejo-animation-flash {
        animation: alejo-flash 0.5s ease-in-out 3;
      }
      
      .alejo-animation-shake {
        animation: alejo-shake 0.5s ease-in-out;
      }
      
      .alejo-animation-bounce {
        animation: alejo-bounce 0.5s ease-in-out;
      }
      
      .alejo-animation-spin {
        animation: alejo-spin 1s linear infinite;
      }
      
      /* Audio level indicator */
      .alejo-audio-level-indicator {
        width: 20px;
        height: 100px;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 10px;
        overflow: hidden;
        position: relative;
      }
      
      .alejo-level-bar {
        position: absolute;
        bottom: 0;
        width: 100%;
        background-color: #3498db;
        transition: height 0.1s ease-out;
      }
      
      /* Rhythmic pattern */
      .alejo-rhythmic-pattern {
        display: flex;
        align-items: flex-end;
        height: 100px;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 10px;
        overflow: hidden;
      }
      
      .alejo-rhythm-bar {
        flex: 1;
        background-color: #3498db;
        margin: 0 1px;
        animation: alejo-pulse 1s ease-in-out infinite;
      }
      
      /* Fade out animation */
      .alejo-feedback-fade-out {
        animation: alejo-fade-out 0.5s ease-in-out forwards;
      }
      
      /* Keyframes */
      @keyframes alejo-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      @keyframes alejo-flash {
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
      }
      
      @keyframes alejo-shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
      }
      
      @keyframes alejo-bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-20px); }
        60% { transform: translateY(-10px); }
      }
      
      @keyframes alejo-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes alejo-fade-out {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }
  
  /**
   * Enhance contrast of a color
   * @private
   * @param {string} color - Color in hex format
   * @returns {string} - Enhanced color
   */
  _enhanceContrast(color) {
    // Simple implementation - in a real system this would be more sophisticated
    return color;
  }
  
  /**
   * Convert color to grayscale
   * @private
   * @param {string} color - Color in hex format
   * @returns {string} - Grayscale color
   */
  _convertToGrayscale(color) {
    // Simple implementation - in a real system this would be more sophisticated
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Calculate grayscale value (luminance)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Convert back to hex
    const grayHex = gray.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}`;
  }
}

// Create and export singleton instance
const visualFeedbackSystem = new VisualFeedbackSystem();
export default visualFeedbackSystem;
