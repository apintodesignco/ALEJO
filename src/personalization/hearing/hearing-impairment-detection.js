/**
 * ALEJO Hearing Impairment Detection Module
 * 
 * This module provides functionality to detect potential hearing impairments
 * through analysis of user interactions, audio response patterns, and visual cues.
 * All processing is done locally on the client device to ensure privacy.
 * 
 * @module hearing-impairment-detection
 * @author ALEJO Team
 * @version 1.0.0
 * @license MIT
 */

import { EventEmitter } from '../../core/events/event-emitter.js';
import { secureStorage } from '../../core/security/secure-storage.js';
import { consentManager } from '../../core/privacy/consent-manager.js';
import { auditTrail } from '../../core/logging/audit-trail.js';
import { faceModel } from '../vision/face-model.js';

/**
 * Class for detecting potential hearing impairments and providing accessibility recommendations
 * @extends EventEmitter
 */
class HearingImpairmentDetection extends EventEmitter {
  /**
   * Create a new HearingImpairmentDetection instance
   */
  constructor() {
    super();
    
    // Configuration defaults
    this.config = {
      enabled: false,
      adaptInterfaceAutomatically: false,
      requireExplicitConsent: true,
      detectionFrequency: 5000, // ms between detection attempts
      detectionThreshold: 0.7,  // confidence threshold for detection
      storageKey: 'alejo_hearing_impairment_data',
      minInteractionsForBaseline: 10
    };
    
    // Detection state
    this.state = {
      initialized: false,
      analyzing: false,
      hasConsent: false,
      detectionActive: false,
      lastDetectionTime: 0,
      detectionHistory: [],
      interactionHistory: [],
      baselineEstablished: false
    };
    
    // Detection results
    this.results = {
      hearingImpairmentDetected: false,
      deafnessDetected: false,
      partialHearingLossDetected: false,
      signLanguageUsageDetected: false,
      lipReadingBehaviorDetected: false,
      hearingAidDetected: false,
      confidence: 0,
      lastUpdated: null,
      recommendedFeatures: []
    };
    
    // Bind methods
    this.analyzeAudioResponse = this.analyzeAudioResponse.bind(this);
    this.detectVisualCues = this.detectVisualCues.bind(this);
    this.analyzeInteractionPatterns = this.analyzeInteractionPatterns.bind(this);
    this.handleAudioPlayback = this.handleAudioPlayback.bind(this);
    this.handleAudioPrompt = this.handleAudioPrompt.bind(this);
    this.handleUserInteraction = this.handleUserInteraction.bind(this);
  }
  
  /**
   * Initialize the hearing impairment detection module
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
      
      // Check for consent
      if (this.config.requireExplicitConsent) {
        this.state.hasConsent = await consentManager.hasConsent('hearing_impairment_detection');
        
        if (!this.state.hasConsent && this.config.enabled) {
          // Request consent if enabled but no consent yet
          this.state.hasConsent = await consentManager.requestConsent('hearing_impairment_detection', {
            purpose: 'To detect potential hearing impairments and provide appropriate accessibility features',
            dataUsage: 'Analysis is performed locally on your device. No audio data is sent to external servers.',
            retention: 'Detection results are stored locally and encrypted. You can delete this data at any time.'
          });
        }
      } else {
        this.state.hasConsent = true;
      }
      
      // Load previous detection data if available
      await this._loadDetectionData();
      
      // Set up event listeners if enabled and has consent
      if (this.config.enabled && this.state.hasConsent) {
        this._setupEventListeners();
        this.state.detectionActive = true;
      }
      
      this.state.initialized = true;
      
      // Log initialization
      auditTrail.log({
        action: 'hearing_impairment_detection_initialized',
        details: {
          enabled: this.config.enabled,
          hasConsent: this.state.hasConsent,
          adaptInterfaceAutomatically: this.config.adaptInterfaceAutomatically
        },
        component: 'hearing_impairment_detection',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize hearing impairment detection:', error);
      
      auditTrail.log({
        action: 'hearing_impairment_detection_initialization_failed',
        details: { error: error.message },
        component: 'hearing_impairment_detection',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Enable or disable hearing impairment detection
   * @param {boolean} enabled - Whether to enable detection
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setEnabled(enabled) {
    if (enabled === this.config.enabled) return true;
    
    try {
      if (enabled && this.config.requireExplicitConsent && !this.state.hasConsent) {
        // Request consent if enabling and no consent yet
        this.state.hasConsent = await consentManager.requestConsent('hearing_impairment_detection', {
          purpose: 'To detect potential hearing impairments and provide appropriate accessibility features',
          dataUsage: 'Analysis is performed locally on your device. No audio data is sent to external servers.',
          retention: 'Detection results are stored locally and encrypted. You can delete this data at any time.'
        });
        
        if (!this.state.hasConsent) {
          console.warn('Cannot enable hearing impairment detection without user consent');
          return false;
        }
      }
      
      this.config.enabled = enabled;
      
      if (enabled) {
        this._setupEventListeners();
        this.state.detectionActive = true;
      } else {
        this._removeEventListeners();
        this.state.detectionActive = false;
      }
      
      // Save updated configuration
      await this._saveDetectionData();
      
      // Log status change
      auditTrail.log({
        action: enabled ? 'hearing_impairment_detection_enabled' : 'hearing_impairment_detection_disabled',
        details: { hasConsent: this.state.hasConsent },
        component: 'hearing_impairment_detection',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} hearing impairment detection:`, error);
      return false;
    }
  }
  
  /**
   * Analyze user response to audio cues
   * @param {Object} data - Audio response data
   * @param {string} data.audioId - ID of the audio cue
   * @param {boolean} data.responded - Whether the user responded to the audio
   * @param {number} data.responseTime - Time taken to respond (ms)
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeAudioResponse(data) {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return null;
    }
    
    try {
      // Record the interaction
      this.state.interactionHistory.push({
        type: 'audio_response',
        timestamp: Date.now(),
        data: {
          audioId: data.audioId,
          responded: data.responded,
          responseTime: data.responseTime
        }
      });
      
      // Limit history size
      if (this.state.interactionHistory.length > 100) {
        this.state.interactionHistory.shift();
      }
      
      // Only proceed with analysis if we have enough data
      if (this.state.interactionHistory.length < this.config.minInteractionsForBaseline) {
        return null;
      }
      
      // Calculate response rate to audio cues
      const audioResponses = this.state.interactionHistory.filter(
        interaction => interaction.type === 'audio_response'
      );
      
      const responseRate = audioResponses.filter(
        response => response.data.responded
      ).length / audioResponses.length;
      
      // Calculate average response time
      const avgResponseTime = audioResponses
        .filter(response => response.data.responded)
        .reduce((sum, response) => sum + response.data.responseTime, 0) / 
        audioResponses.filter(response => response.data.responded).length;
      
      // Update detection results
      const previousDetection = this.results.hearingImpairmentDetected;
      
      // Low response rate to audio cues suggests potential hearing impairment
      if (responseRate < 0.5) {
        this.results.hearingImpairmentDetected = true;
        this.results.partialHearingLossDetected = true;
        this.results.confidence = Math.min(1.0, (1 - responseRate) * 1.5);
      }
      
      // Very low response rate suggests potential deafness
      if (responseRate < 0.2) {
        this.results.deafnessDetected = true;
        this.results.confidence = Math.min(1.0, (1 - responseRate) * 2);
      }
      
      // Update recommendations based on detection
      this._updateRecommendations();
      
      // Emit event if detection status changed
      if (previousDetection !== this.results.hearingImpairmentDetected) {
        this.emit('impairment_detected', {
          type: 'hearing',
          detected: this.results.hearingImpairmentDetected,
          confidence: this.results.confidence,
          recommendations: this.results.recommendedFeatures
        });
        
        // Log detection
        auditTrail.log({
          action: 'hearing_impairment_detection_changed',
          details: {
            detected: this.results.hearingImpairmentDetected,
            confidence: this.results.confidence,
            recommendations: this.results.recommendedFeatures
          },
          component: 'hearing_impairment_detection',
          level: 'info'
        });
      }
      
      return {
        hearingImpairmentDetected: this.results.hearingImpairmentDetected,
        confidence: this.results.confidence,
        responseRate,
        avgResponseTime
      };
    } catch (error) {
      console.error('Error analyzing audio response:', error);
      return null;
    }
  }
  
  /**
   * Detect visual cues that may indicate hearing impairment
   * @param {Object} faceDetection - Face detection results
   * @returns {Promise<Object>} - Detection results
   */
  async detectVisualCues(faceDetection) {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return null;
    }
    
    if (!faceDetection || !faceDetection.landmarks) {
      return null;
    }
    
    try {
      // Check for hearing aids or cochlear implants
      // This is a simplified placeholder - in a real implementation,
      // this would use more sophisticated image recognition
      const hearingAidDetected = this._detectHearingAid(faceDetection);
      
      // Check for lip reading behavior
      // Look for focused attention on mouth area during speech
      const lipReadingDetected = this._detectLipReading(faceDetection);
      
      // Update detection results
      const previousDetection = this.results.hearingImpairmentDetected;
      
      if (hearingAidDetected) {
        this.results.hearingAidDetected = true;
        this.results.hearingImpairmentDetected = true;
        this.results.confidence = Math.max(this.results.confidence, 0.9);
      }
      
      if (lipReadingDetected) {
        this.results.lipReadingBehaviorDetected = true;
        this.results.hearingImpairmentDetected = true;
        this.results.confidence = Math.max(this.results.confidence, 0.7);
      }
      
      // Update recommendations
      this._updateRecommendations();
      
      // Emit event if detection status changed
      if (previousDetection !== this.results.hearingImpairmentDetected) {
        this.emit('impairment_detected', {
          type: 'hearing',
          detected: this.results.hearingImpairmentDetected,
          confidence: this.results.confidence,
          recommendations: this.results.recommendedFeatures
        });
        
        // Log detection
        auditTrail.log({
          action: 'hearing_impairment_detection_changed',
          details: {
            detected: this.results.hearingImpairmentDetected,
            confidence: this.results.confidence,
            hearingAidDetected: this.results.hearingAidDetected,
            lipReadingDetected: this.results.lipReadingBehaviorDetected,
            recommendations: this.results.recommendedFeatures
          },
          component: 'hearing_impairment_detection',
          level: 'info'
        });
      }
      
      return {
        hearingImpairmentDetected: this.results.hearingImpairmentDetected,
        hearingAidDetected,
        lipReadingDetected,
        confidence: this.results.confidence
      };
    } catch (error) {
      console.error('Error detecting visual cues for hearing impairment:', error);
      return null;
    }
  }
  
  /**
   * Analyze user interaction patterns for signs of hearing impairment
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeInteractionPatterns() {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return null;
    }
    
    try {
      // Only proceed with analysis if we have enough data
      if (this.state.interactionHistory.length < this.config.minInteractionsForBaseline) {
        return null;
      }
      
      // Calculate ratio of visual to audio interactions
      const visualInteractions = this.state.interactionHistory.filter(
        interaction => ['click', 'touch', 'gesture', 'keyboard'].includes(interaction.type)
      ).length;
      
      const audioInteractions = this.state.interactionHistory.filter(
        interaction => ['voice_command', 'audio_response'].includes(interaction.type)
      ).length;
      
      // High ratio of visual to audio interactions may indicate hearing impairment
      const visualAudioRatio = audioInteractions > 0 ? 
        visualInteractions / audioInteractions : 
        visualInteractions;
      
      // Update detection results
      const previousDetection = this.results.hearingImpairmentDetected;
      
      if (visualAudioRatio > 5 && visualInteractions > 20) {
        // Strong preference for visual interactions may indicate hearing impairment
        this.results.hearingImpairmentDetected = true;
        this.results.confidence = Math.min(1.0, Math.max(this.results.confidence, 0.6));
      }
      
      // Update recommendations
      this._updateRecommendations();
      
      // Emit event if detection status changed
      if (previousDetection !== this.results.hearingImpairmentDetected) {
        this.emit('impairment_detected', {
          type: 'hearing',
          detected: this.results.hearingImpairmentDetected,
          confidence: this.results.confidence,
          recommendations: this.results.recommendedFeatures
        });
        
        // Log detection
        auditTrail.log({
          action: 'hearing_impairment_detection_changed',
          details: {
            detected: this.results.hearingImpairmentDetected,
            confidence: this.results.confidence,
            visualAudioRatio,
            recommendations: this.results.recommendedFeatures
          },
          component: 'hearing_impairment_detection',
          level: 'info'
        });
      }
      
      return {
        hearingImpairmentDetected: this.results.hearingImpairmentDetected,
        confidence: this.results.confidence,
        visualAudioRatio
      };
    } catch (error) {
      console.error('Error analyzing interaction patterns:', error);
      return null;
    }
  }
  
  /**
   * Handle audio playback event
   * @param {Object} data - Audio playback data
   */
  handleAudioPlayback(data) {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return;
    }
    
    // Record the audio playback event
    this.state.interactionHistory.push({
      type: 'audio_playback',
      timestamp: Date.now(),
      data: {
        audioId: data.audioId,
        duration: data.duration,
        volume: data.volume
      }
    });
    
    // Limit history size
    if (this.state.interactionHistory.length > 100) {
      this.state.interactionHistory.shift();
    }
  }
  
  /**
   * Handle audio prompt event (system expecting user response to audio)
   * @param {Object} data - Audio prompt data
   */
  handleAudioPrompt(data) {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return;
    }
    
    // Record the audio prompt event
    this.state.interactionHistory.push({
      type: 'audio_prompt',
      timestamp: Date.now(),
      data: {
        promptId: data.promptId,
        expectsResponse: data.expectsResponse,
        responseTimeout: data.responseTimeout
      }
    });
    
    // Limit history size
    if (this.state.interactionHistory.length > 100) {
      this.state.interactionHistory.shift();
    }
  }
  
  /**
   * Handle user interaction event
   * @param {Object} data - Interaction data
   */
  handleUserInteraction(data) {
    if (!this.config.enabled || !this.state.hasConsent || !this.state.detectionActive) {
      return;
    }
    
    // Record the user interaction
    this.state.interactionHistory.push({
      type: data.type, // click, touch, gesture, keyboard, voice_command
      timestamp: Date.now(),
      data: {
        target: data.target,
        value: data.value
      }
    });
    
    // Limit history size
    if (this.state.interactionHistory.length > 100) {
      this.state.interactionHistory.shift();
    }
    
    // If we have enough data, analyze interaction patterns
    if (this.state.interactionHistory.length >= this.config.minInteractionsForBaseline &&
        Date.now() - this.state.lastDetectionTime > this.config.detectionFrequency) {
      this.state.lastDetectionTime = Date.now();
      this.analyzeInteractionPatterns();
    }
  }
  
  /**
   * Get current detection results
   * @returns {Object} - Current detection results
   */
  getDetectionResults() {
    return {
      ...this.results,
      detectionActive: this.state.detectionActive,
      hasConsent: this.state.hasConsent,
      baselineEstablished: this.state.baselineEstablished
    };
  }
  
  /**
   * Clear detection history and results
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async clearDetectionData() {
    try {
      this.state.interactionHistory = [];
      this.state.detectionHistory = [];
      this.state.baselineEstablished = false;
      
      this.results = {
        hearingImpairmentDetected: false,
        deafnessDetected: false,
        partialHearingLossDetected: false,
        signLanguageUsageDetected: false,
        lipReadingBehaviorDetected: false,
        hearingAidDetected: false,
        confidence: 0,
        lastUpdated: null,
        recommendedFeatures: []
      };
      
      // Remove from storage
      await secureStorage.removeItem(this.config.storageKey);
      
      // Log data clearing
      auditTrail.log({
        action: 'hearing_impairment_detection_data_cleared',
        component: 'hearing_impairment_detection',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Error clearing hearing impairment detection data:', error);
      return false;
    }
  }
  
  /**
   * Set up event listeners for detection
   * @private
   */
  _setupEventListeners() {
    // These would be connected to actual system events in a real implementation
    // For now, we'll just set up the structure
    
    // Listen for audio playback events
    document.addEventListener('alejo:audio_playback', (event) => {
      this.handleAudioPlayback(event.detail);
    });
    
    // Listen for audio prompt events
    document.addEventListener('alejo:audio_prompt', (event) => {
      this.handleAudioPrompt(event.detail);
    });
    
    // Listen for user interactions
    document.addEventListener('alejo:user_interaction', (event) => {
      this.handleUserInteraction(event.detail);
    });
  }
  
  /**
   * Remove event listeners
   * @private
   */
  _removeEventListeners() {
    // Remove event listeners
    document.removeEventListener('alejo:audio_playback', this.handleAudioPlayback);
    document.removeEventListener('alejo:audio_prompt', this.handleAudioPrompt);
    document.removeEventListener('alejo:user_interaction', this.handleUserInteraction);
  }
  
  /**
   * Load detection data from storage
   * @private
   * @returns {Promise<void>}
   */
  async _loadDetectionData() {
    try {
      const storedData = await secureStorage.getItem(this.config.storageKey);
      
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        // Restore detection results
        if (parsedData.results) {
          this.results = {
            ...this.results,
            ...parsedData.results
          };
        }
        
        // Restore detection history
        if (parsedData.detectionHistory) {
          this.state.detectionHistory = parsedData.detectionHistory;
        }
        
        // Restore baseline status
        if (parsedData.baselineEstablished !== undefined) {
          this.state.baselineEstablished = parsedData.baselineEstablished;
        }
      }
    } catch (error) {
      console.error('Error loading hearing impairment detection data:', error);
    }
  }
  
  /**
   * Save detection data to storage
   * @private
   * @returns {Promise<void>}
   */
  async _saveDetectionData() {
    try {
      const dataToSave = {
        results: this.results,
        detectionHistory: this.state.detectionHistory,
        baselineEstablished: this.state.baselineEstablished,
        lastUpdated: new Date().toISOString()
      };
      
      await secureStorage.setItem(
        this.config.storageKey,
        JSON.stringify(dataToSave)
      );
    } catch (error) {
      console.error('Error saving hearing impairment detection data:', error);
    }
  }
  
  /**
   * Update recommended accessibility features based on detection results
   * @private
   */
  _updateRecommendations() {
    const recommendations = [];
    
    if (this.results.hearingImpairmentDetected) {
      // Basic recommendations for all hearing impairments
      recommendations.push('visual_notifications');
      recommendations.push('captions');
      recommendations.push('vibration_feedback');
      
      if (this.results.deafnessDetected) {
        // Additional recommendations for deafness
        recommendations.push('sign_language_support');
        recommendations.push('visual_indicators');
        recommendations.push('text_communication');
      }
      
      if (this.results.partialHearingLossDetected) {
        // Recommendations for partial hearing loss
        recommendations.push('amplified_audio');
        recommendations.push('frequency_shifting');
        recommendations.push('noise_reduction');
      }
      
      if (this.results.lipReadingBehaviorDetected) {
        // Recommendations for lip readers
        recommendations.push('speaker_visibility');
        recommendations.push('facial_emphasis');
      }
    }
    
    // Update recommendations and timestamp
    this.results.recommendedFeatures = [...new Set(recommendations)];
    this.results.lastUpdated = new Date().toISOString();
    
    // Save updated data
    this._saveDetectionData();
  }
  
  /**
   * Detect hearing aids or cochlear implants in face detection results
   * @private
   * @param {Object} faceDetection - Face detection results
   * @returns {boolean} - Whether hearing aids were detected
   */
  _detectHearingAid(faceDetection) {
    // This is a simplified placeholder implementation
    // In a real system, this would use more sophisticated image recognition
    
    // For now, we'll return false as this requires specialized ML models
    return false;
  }
  
  /**
   * Detect lip reading behavior in face detection results
   * @private
   * @param {Object} faceDetection - Face detection results
   * @returns {boolean} - Whether lip reading behavior was detected
   */
  _detectLipReading(faceDetection) {
    // This is a simplified placeholder implementation
    // In a real system, this would analyze gaze patterns focused on mouth area
    
    try {
      if (!faceDetection || !faceDetection.landmarks) {
        return false;
      }
      
      // Check if gaze is consistently directed at mouth area during speech
      // This is a simplified approximation
      const eyeToMouthAttention = 0.3; // Placeholder value
      
      return eyeToMouthAttention > 0.7;
    } catch (error) {
      return false;
    }
  }
}

// Create and export singleton instance
const hearingImpairmentDetection = new HearingImpairmentDetection();
export default hearingImpairmentDetection;
