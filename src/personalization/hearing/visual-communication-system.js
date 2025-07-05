/**
 * ALEJO Visual Communication System
 * 
 * This module provides visual communication features for deaf and hard-of-hearing users,
 * including real-time captioning, visual representation of environmental sounds,
 * and text-based alternatives to voice interactions.
 * 
 * @module visual-communication-system
 * @author ALEJO Team
 * @version 1.0.0
 * @license MIT
 */

import { EventEmitter } from '../../core/events/event-emitter.js';
import { auditTrail } from '../../core/logging/audit-trail.js';

/**
 * Class providing visual communication features
 * @extends EventEmitter
 */
class VisualCommunicationSystem extends EventEmitter {
  /**
   * Create a new VisualCommunicationSystem instance
   */
  constructor() {
    super();
    
    // Configuration defaults
    this.config = {
      enabled: true,
      captioningEnabled: true,
      soundVisualizationEnabled: true,
      captionPosition: 'bottom', // top, bottom, left, right
      captionStyle: 'standard', // standard, high-contrast, large-text
      captionLanguage: 'en-US',
      speakerIdentification: true,
      environmentalSoundDetection: true,
      maxCaptionHistory: 50
    };
    
    this.state = {
      initialized: false,
      captionContainer: null,
      captionHistory: [],
      activeSpeakers: {},
      recognitionActive: false,
      speechRecognition: null,
      audioContext: null,
      audioAnalyser: null
    };
    
    // Bind methods
    this.startCaptioning = this.startCaptioning.bind(this);
    this.stopCaptioning = this.stopCaptioning.bind(this);
    this.addCaption = this.addCaption.bind(this);
    this.clearCaptions = this.clearCaptions.bind(this);
  }
  
  /**
   * Initialize the visual communication system
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
      
      // Log initialization start
      auditTrail.log({
        action: 'visual_communication_system_initializing',
        details: {
          captioningEnabled: this.config.captioningEnabled,
          soundVisualizationEnabled: this.config.soundVisualizationEnabled
        },
        component: 'visual_communication',
        level: 'info'
      });
      
      // Create caption container
      this._createCaptionContainer();
      
      // Add CSS styles
      this._addStyles();
      
      // Initialize speech recognition if available and enabled
      if (this.config.captioningEnabled) {
        await this._initializeSpeechRecognition();
      }
      
      // Initialize audio context for sound visualization if enabled
      if (this.config.soundVisualizationEnabled) {
        await this._initializeAudioContext();
      }
      
      this.state.initialized = true;
      
      // Log initialization success
      auditTrail.log({
        action: 'visual_communication_system_initialized',
        component: 'visual_communication',
        level: 'info'
      });
      
      // Emit initialized event
      this.emit('initialized', { success: true });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize visual communication system:', error);
      
      // Log initialization failure
      auditTrail.log({
        action: 'visual_communication_system_initialization_failed',
        details: { error: error.message },
        component: 'visual_communication',
        level: 'error'
      });
      
      // Emit error event
      this.emit('error', { 
        type: 'initialization_failed',
        message: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Start real-time captioning
   * @param {Object} options - Captioning options
   * @returns {Promise<boolean>} - Whether captioning started successfully
   */
  async startCaptioning(options = {}) {
    if (!this.state.initialized || !this.config.captioningEnabled) {
      return false;
    }
    
    try {
      // Update options
      const captioningOptions = {
        continuous: true,
        interimResults: true,
        language: this.config.captionLanguage,
        ...options
      };
      
      // Check if speech recognition is available
      if (!this.state.speechRecognition) {
        throw new Error('Speech recognition not available');
      }
      
      // Configure speech recognition
      this.state.speechRecognition.continuous = captioningOptions.continuous;
      this.state.speechRecognition.interimResults = captioningOptions.interimResults;
      this.state.speechRecognition.lang = captioningOptions.language;
      
      // Start recognition
      this.state.speechRecognition.start();
      this.state.recognitionActive = true;
      
      // Make caption container visible
      if (this.state.captionContainer) {
        this.state.captionContainer.style.display = 'block';
      }
      
      // Log captioning start
      auditTrail.log({
        action: 'captioning_started',
        details: captioningOptions,
        component: 'visual_communication',
        level: 'info'
      });
      
      // Emit captioning started event
      this.emit('captioning_started', captioningOptions);
      
      return true;
    } catch (error) {
      console.error('Failed to start captioning:', error);
      
      // Log failure
      auditTrail.log({
        action: 'captioning_start_failed',
        details: { error: error.message },
        component: 'visual_communication',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Stop real-time captioning
   * @returns {boolean} - Whether captioning was stopped successfully
   */
  stopCaptioning() {
    if (!this.state.initialized || !this.state.recognitionActive) {
      return false;
    }
    
    try {
      // Stop speech recognition
      if (this.state.speechRecognition) {
        this.state.speechRecognition.stop();
      }
      
      this.state.recognitionActive = false;
      
      // Log captioning stop
      auditTrail.log({
        action: 'captioning_stopped',
        component: 'visual_communication',
        level: 'info'
      });
      
      // Emit captioning stopped event
      this.emit('captioning_stopped');
      
      return true;
    } catch (error) {
      console.error('Failed to stop captioning:', error);
      
      // Log failure
      auditTrail.log({
        action: 'captioning_stop_failed',
        details: { error: error.message },
        component: 'visual_communication',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Add a caption manually
   * @param {Object} caption - Caption data
   * @param {string} caption.text - Caption text
   * @param {string} caption.speaker - Speaker identifier (optional)
   * @param {boolean} caption.isInterim - Whether this is an interim result
   * @param {string} caption.type - Caption type (speech, sound, system)
   * @returns {string} - Caption ID
   */
  addCaption(caption) {
    if (!this.state.initialized) {
      return null;
    }
    
    try {
      const { 
        text, 
        speaker = 'unknown', 
        isInterim = false, 
        type = 'speech' 
      } = caption;
      
      if (!text) {
        return null;
      }
      
      // Create caption ID
      const captionId = `caption-${Date.now()}`;
      
      // Create caption element
      const captionElement = this._createCaptionElement({
        id: captionId,
        text,
        speaker,
        isInterim,
        type,
        timestamp: Date.now()
      });
      
      // Add to caption container
      if (this.state.captionContainer && captionElement) {
        this.state.captionContainer.appendChild(captionElement);
        
        // Scroll to bottom if container is scrollable
        this.state.captionContainer.scrollTop = this.state.captionContainer.scrollHeight;
      }
      
      // Add to history if not interim
      if (!isInterim) {
        this.state.captionHistory.push({
          id: captionId,
          text,
          speaker,
          type,
          timestamp: Date.now()
        });
        
        // Limit history size
        if (this.state.captionHistory.length > this.config.maxCaptionHistory) {
          this.state.captionHistory.shift();
        }
      }
      
      // Log caption added
      auditTrail.log({
        action: 'caption_added',
        details: {
          type,
          speaker,
          isInterim,
          textLength: text.length
        },
        component: 'visual_communication',
        level: 'info'
      });
      
      return captionId;
    } catch (error) {
      console.error('Failed to add caption:', error);
      return null;
    }
  }
  
  /**
   * Update an existing caption
   * @param {string} captionId - ID of caption to update
   * @param {Object} updates - Updates to apply
   * @returns {boolean} - Whether update was successful
   */
  updateCaption(captionId, updates) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      // Find caption element
      const captionElement = document.getElementById(captionId);
      
      if (!captionElement) {
        return false;
      }
      
      // Update text if provided
      if (updates.text) {
        const textElement = captionElement.querySelector('.alejo-caption-text');
        if (textElement) {
          textElement.textContent = updates.text;
        }
      }
      
      // Update speaker if provided
      if (updates.speaker) {
        const speakerElement = captionElement.querySelector('.alejo-caption-speaker');
        if (speakerElement) {
          speakerElement.textContent = updates.speaker;
        }
      }
      
      // Update interim status if provided
      if (updates.isInterim !== undefined) {
        if (updates.isInterim) {
          captionElement.classList.add('alejo-caption-interim');
        } else {
          captionElement.classList.remove('alejo-caption-interim');
          
          // Update history if transitioning from interim to final
          const existingIndex = this.state.captionHistory.findIndex(c => c.id === captionId);
          
          if (existingIndex >= 0) {
            // Update existing entry
            this.state.captionHistory[existingIndex] = {
              ...this.state.captionHistory[existingIndex],
              text: updates.text || this.state.captionHistory[existingIndex].text,
              speaker: updates.speaker || this.state.captionHistory[existingIndex].speaker
            };
          } else {
            // Add to history
            this.state.captionHistory.push({
              id: captionId,
              text: updates.text || captionElement.querySelector('.alejo-caption-text').textContent,
              speaker: updates.speaker || captionElement.querySelector('.alejo-caption-speaker').textContent,
              type: captionElement.dataset.captionType,
              timestamp: Date.now()
            });
            
            // Limit history size
            if (this.state.captionHistory.length > this.config.maxCaptionHistory) {
              this.state.captionHistory.shift();
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to update caption:', error);
      return false;
    }
  }
  
  /**
   * Clear all captions
   * @param {boolean} clearHistory - Whether to also clear caption history
   * @returns {boolean} - Whether clear was successful
   */
  clearCaptions(clearHistory = false) {
    if (!this.state.initialized) {
      return false;
    }
    
    try {
      // Clear caption container
      if (this.state.captionContainer) {
        this.state.captionContainer.innerHTML = '';
      }
      
      // Clear history if requested
      if (clearHistory) {
        this.state.captionHistory = [];
      }
      
      // Log captions cleared
      auditTrail.log({
        action: 'captions_cleared',
        details: { clearHistory },
        component: 'visual_communication',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to clear captions:', error);
      return false;
    }
  }
  
  /**
   * Get caption history
   * @returns {Array<Object>} - Caption history
   */
  getCaptionHistory() {
    return [...this.state.captionHistory];
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
      container.className = `alejo-caption-container alejo-caption-position-${this.config.captionPosition} alejo-caption-style-${this.config.captionStyle}`;
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('role', 'log');
      document.body.appendChild(container);
    }
    
    this.state.captionContainer = container;
  }
  
  /**
   * Create caption element
   * @private
   * @param {Object} caption - Caption data
   * @returns {HTMLElement} - Caption element
   */
  _createCaptionElement(caption) {
    const { id, text, speaker, isInterim, type, timestamp } = caption;
    
    // Create caption element
    const captionElement = document.createElement('div');
    captionElement.id = id;
    captionElement.className = `alejo-caption alejo-caption-type-${type}`;
    captionElement.dataset.captionType = type;
    captionElement.dataset.timestamp = timestamp;
    
    if (isInterim) {
      captionElement.classList.add('alejo-caption-interim');
    }
    
    // Add speaker if enabled and available
    if (this.config.speakerIdentification && speaker && speaker !== 'unknown') {
      const speakerElement = document.createElement('span');
      speakerElement.className = 'alejo-caption-speaker';
      speakerElement.textContent = speaker;
      captionElement.appendChild(speakerElement);
    }
    
    // Add text
    const textElement = document.createElement('span');
    textElement.className = 'alejo-caption-text';
    textElement.textContent = text;
    captionElement.appendChild(textElement);
    
    return captionElement;
  }
  
  /**
   * Add CSS styles for captions
   * @private
   */
  _addStyles() {
    // Check if styles already exist
    if (document.getElementById('alejo-caption-styles')) {
      return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'alejo-caption-styles';
    
    // Define CSS
    const css = `
      .alejo-caption-container {
        position: fixed;
        z-index: 9997;
        background-color: rgba(0, 0, 0, 0.7);
        padding: 16px;
        box-sizing: border-box;
        overflow-y: auto;
        max-height: 30vh;
        width: 100%;
        font-family: Arial, sans-serif;
      }
      
      /* Positions */
      .alejo-caption-position-bottom {
        bottom: 0;
        left: 0;
      }
      
      .alejo-caption-position-top {
        top: 0;
        left: 0;
      }
      
      .alejo-caption-position-left {
        top: 0;
        left: 0;
        height: 100vh;
        width: 30%;
        max-width: 300px;
      }
      
      .alejo-caption-position-right {
        top: 0;
        right: 0;
        height: 100vh;
        width: 30%;
        max-width: 300px;
      }
      
      /* Styles */
      .alejo-caption-style-standard {
        color: white;
        font-size: 16px;
      }
      
      .alejo-caption-style-high-contrast {
        color: yellow;
        font-size: 16px;
        text-shadow: 1px 1px 2px black;
      }
      
      .alejo-caption-style-large-text {
        color: white;
        font-size: 24px;
      }
      
      /* Caption elements */
      .alejo-caption {
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .alejo-caption-interim {
        opacity: 0.7;
        font-style: italic;
      }
      
      .alejo-caption-speaker {
        font-weight: bold;
        margin-right: 8px;
      }
      
      .alejo-caption-speaker::after {
        content: ":";
      }
      
      /* Caption types */
      .alejo-caption-type-speech {
        /* Default style */
      }
      
      .alejo-caption-type-sound {
        color: #3498db;
      }
      
      .alejo-caption-type-system {
        color: #2ecc71;
        font-style: italic;
      }
    `;
    
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }
  
  /**
   * Initialize speech recognition
   * @private
   * @returns {Promise<void>}
   */
  async _initializeSpeechRecognition() {
    try {
      // Check if Web Speech API is available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech Recognition API not supported');
      }
      
      // Create speech recognition instance
      this.state.speechRecognition = new SpeechRecognition();
      
      // Configure speech recognition
      this.state.speechRecognition.continuous = true;
      this.state.speechRecognition.interimResults = true;
      this.state.speechRecognition.lang = this.config.captionLanguage;
      
      // Set up event handlers
      this.state.speechRecognition.onstart = () => {
        this.emit('recognition_started');
      };
      
      this.state.speechRecognition.onend = () => {
        // Restart if recognition was active but ended unexpectedly
        if (this.state.recognitionActive) {
          this.state.speechRecognition.start();
        }
        
        this.emit('recognition_ended');
      };
      
      this.state.speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Log error
        auditTrail.log({
          action: 'speech_recognition_error',
          details: { error: event.error },
          component: 'visual_communication',
          level: 'error'
        });
        
        this.emit('recognition_error', { error: event.error });
      };
      
      this.state.speechRecognition.onresult = (event) => {
        const results = event.results;
        const resultIndex = event.resultIndex;
        
        // Process each result
        for (let i = resultIndex; i < results.length; i++) {
          const result = results[i];
          const transcript = result[0].transcript;
          const isFinal = result.isFinal;
          
          // Generate caption ID based on result index
          const captionId = `speech-caption-${resultIndex}-${i}`;
          
          // Check if caption already exists
          const existingCaption = document.getElementById(captionId);
          
          if (existingCaption) {
            // Update existing caption
            this.updateCaption(captionId, {
              text: transcript,
              isInterim: !isFinal
            });
          } else {
            // Add new caption
            this.addCaption({
              text: transcript,
              speaker: this._identifySpeaker(result),
              isInterim: !isFinal,
              type: 'speech'
            });
          }
          
          // Emit result event
          this.emit('recognition_result', {
            transcript,
            isFinal,
            confidence: result[0].confidence
          });
        }
      };
      
      // Log speech recognition initialized
      auditTrail.log({
        action: 'speech_recognition_initialized',
        details: { language: this.config.captionLanguage },
        component: 'visual_communication',
        level: 'info'
      });
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      
      // Log failure
      auditTrail.log({
        action: 'speech_recognition_initialization_failed',
        details: { error: error.message },
        component: 'visual_communication',
        level: 'error'
      });
      
      throw error;
    }
  }
  
  /**
   * Initialize audio context for sound visualization
   * @private
   * @returns {Promise<void>}
   */
  async _initializeAudioContext() {
    try {
      // Check if Web Audio API is available
      if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error('Web Audio API not supported');
      }
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.state.audioContext = new AudioContext();
      
      // Create analyser
      this.state.audioAnalyser = this.state.audioContext.createAnalyser();
      this.state.audioAnalyser.fftSize = 2048;
      
      // Log audio context initialized
      auditTrail.log({
        action: 'audio_context_initialized',
        component: 'visual_communication',
        level: 'info'
      });
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      
      // Log failure
      auditTrail.log({
        action: 'audio_context_initialization_failed',
        details: { error: error.message },
        component: 'visual_communication',
        level: 'error'
      });
      
      throw error;
    }
  }
  
  /**
   * Identify speaker from recognition result
   * @private
   * @param {SpeechRecognitionResult} result - Recognition result
   * @returns {string} - Speaker identifier
   */
  _identifySpeaker(result) {
    // In a real implementation, this would use speaker diarization
    // For now, we'll return a placeholder
    return 'Speaker';
  }
}

// Create and export singleton instance
const visualCommunicationSystem = new VisualCommunicationSystem();
export default visualCommunicationSystem;
