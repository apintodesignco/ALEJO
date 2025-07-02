/**
 * ALEJO Expression Detection Module
 * 
 * This module provides emotion detection capabilities based on facial expressions,
 * allowing ALEJO to respond appropriately to the user's emotional state.
 * 
 * Uses Face-API.js for browser-based emotion detection.
 */

import * as faceapi from 'face-api.js';
import { faceModel } from './face-model';
import { auditTrail } from '../../security/audit-trail';
import { consentManager } from '../../security/consent-manager';
import { EventEmitter } from '../../core/events';

class ExpressionDetection extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.expressionHistory = [];
    this.historyMaxLength = 10;
    this.confidenceThreshold = 0.5;
    this.emotionalStates = {
      NEUTRAL: 'neutral',
      HAPPY: 'happy',
      SAD: 'sad',
      ANGRY: 'angry',
      FEARFUL: 'fearful',
      DISGUSTED: 'disgusted',
      SURPRISED: 'surprised'
    };
    this.currentEmotionalState = this.emotionalStates.NEUTRAL;
    this.emotionChangeThreshold = 0.2; // Minimum change to trigger an emotion change event
  }

  /**
   * Initialize the expression detection system
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Check if expression detection is allowed by user consent
      if (!await consentManager.hasConsent('expression_detection')) {
        console.warn('Expression detection disabled due to user consent settings');
        return false;
      }

      // Ensure face model is initialized
      if (!faceModel.isInitialized) {
        await faceModel.initialize();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      auditTrail.log('expression_detection_initialized', { success: true });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize expression detection:', error);
      auditTrail.log('expression_detection_initialized', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Detect expressions in an image
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Input image or video
   * @returns {Promise<Object>} Expression detection results
   */
  async detectExpression(input) {
    if (!this.isInitialized) {
      throw new Error('Expression detection not initialized');
    }

    try {
      // Run face detection with expressions
      const detections = await faceapi
        .detectAllFaces(input)
        .withFaceExpressions();
      
      if (!detections || detections.length === 0) {
        return {
          expressions: null,
          dominantExpression: this.emotionalStates.NEUTRAL,
          confidence: 0
        };
      }
      
      // Get the primary face (usually the largest/closest)
      const primaryFace = detections.sort((a, b) => 
        (b.detection.box.width * b.detection.box.height) - 
        (a.detection.box.width * a.detection.box.height)
      )[0];
      
      // Get expressions
      const expressions = primaryFace.expressions;
      
      // Find dominant expression
      const dominantExpression = this._getDominantExpression(expressions);
      
      // Update expression history
      this._updateExpressionHistory(dominantExpression);
      
      // Check if emotional state has changed
      const previousState = this.currentEmotionalState;
      this.currentEmotionalState = dominantExpression.expression;
      
      if (previousState !== this.currentEmotionalState && 
          dominantExpression.confidence > this.emotionChangeThreshold) {
        this.emit('emotion_changed', {
          from: previousState,
          to: this.currentEmotionalState,
          confidence: dominantExpression.confidence
        });
        
        // Log emotion change (with privacy protections)
        auditTrail.log('emotion_changed', {
          emotion: this.currentEmotionalState,
          confidence: dominantExpression.confidence,
          timestamp: new Date().toISOString()
        });
      }
      
      return {
        expressions,
        dominantExpression: dominantExpression.expression,
        confidence: dominantExpression.confidence
      };
    } catch (error) {
      console.error('Expression detection error:', error);
      throw new Error(`Expression detection failed: ${error.message}`);
    }
  }

  /**
   * Get the dominant expression from expression data
   * @param {Object} expressions - Expression data from face-api.js
   * @returns {Object} Dominant expression and confidence
   */
  _getDominantExpression(expressions) {
    let dominantExpression = this.emotionalStates.NEUTRAL;
    let maxConfidence = 0;
    
    for (const [expression, confidence] of Object.entries(expressions)) {
      if (confidence > maxConfidence && confidence > this.confidenceThreshold) {
        maxConfidence = confidence;
        dominantExpression = this._mapExpressionToEmotionalState(expression);
      }
    }
    
    return {
      expression: dominantExpression,
      confidence: maxConfidence
    };
  }

  /**
   * Map face-api.js expression to our emotional state
   * @param {string} expression - Expression from face-api.js
   * @returns {string} Mapped emotional state
   */
  _mapExpressionToEmotionalState(expression) {
    const mapping = {
      'neutral': this.emotionalStates.NEUTRAL,
      'happy': this.emotionalStates.HAPPY,
      'sad': this.emotionalStates.SAD,
      'angry': this.emotionalStates.ANGRY,
      'fearful': this.emotionalStates.FEARFUL,
      'disgusted': this.emotionalStates.DISGUSTED,
      'surprised': this.emotionalStates.SURPRISED
    };
    
    return mapping[expression] || this.emotionalStates.NEUTRAL;
  }

  /**
   * Update expression history
   * @param {Object} dominantExpression - Dominant expression data
   */
  _updateExpressionHistory(dominantExpression) {
    this.expressionHistory.push({
      expression: dominantExpression.expression,
      confidence: dominantExpression.confidence,
      timestamp: new Date().toISOString()
    });
    
    // Limit history length
    if (this.expressionHistory.length > this.historyMaxLength) {
      this.expressionHistory.shift();
    }
  }

  /**
   * Get the current emotional state
   * @returns {string} Current emotional state
   */
  getCurrentEmotionalState() {
    return this.currentEmotionalState;
  }

  /**
   * Get expression history
   * @param {number} count - Number of history items to return (default: all)
   * @returns {Array} Expression history
   */
  getExpressionHistory(count = this.historyMaxLength) {
    return this.expressionHistory.slice(-count);
  }

  /**
   * Get the emotional trend over time
   * @returns {Object} Emotional trend data
   */
  getEmotionalTrend() {
    if (this.expressionHistory.length < 2) {
      return {
        trend: 'stable',
        dominantEmotion: this.currentEmotionalState
      };
    }
    
    // Count occurrences of each emotion
    const emotionCounts = {};
    for (const item of this.expressionHistory) {
      emotionCounts[item.expression] = (emotionCounts[item.expression] || 0) + 1;
    }
    
    // Find dominant emotion
    let dominantEmotion = this.emotionalStates.NEUTRAL;
    let maxCount = 0;
    
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    }
    
    // Determine trend
    const recentEmotions = this.expressionHistory.slice(-3);
    const uniqueRecentEmotions = new Set(recentEmotions.map(item => item.expression));
    
    let trend = 'stable';
    if (uniqueRecentEmotions.size > 1) {
      trend = 'fluctuating';
    } else if (recentEmotions[0].expression !== this.expressionHistory[0].expression) {
      trend = 'changing';
    }
    
    return {
      trend,
      dominantEmotion
    };
  }

  /**
   * Analyze emotional response to content
   * @param {string} contentId - Content identifier
   * @param {Object} expressionData - Expression detection results
   * @returns {Object} Emotional response analysis
   */
  analyzeEmotionalResponse(contentId, expressionData) {
    if (!expressionData || !expressionData.expressions) {
      return {
        contentId,
        response: 'neutral',
        confidence: 0,
        recommendation: 'continue'
      };
    }
    
    const { expressions, dominantExpression, confidence } = expressionData;
    
    // Analyze response
    let recommendation = 'continue';
    
    // If negative emotion detected with high confidence
    if ((dominantExpression === this.emotionalStates.SAD || 
         dominantExpression === this.emotionalStates.ANGRY ||
         dominantExpression === this.emotionalStates.FEARFUL ||
         dominantExpression === this.emotionalStates.DISGUSTED) && 
        confidence > 0.7) {
      recommendation = 'adjust';
    }
    
    // If very positive emotion detected
    if (dominantExpression === this.emotionalStates.HAPPY && confidence > 0.8) {
      recommendation = 'enhance';
    }
    
    return {
      contentId,
      response: dominantExpression,
      confidence,
      recommendation
    };
  }
}

// Create and export singleton instance
export const expressionDetection = new ExpressionDetection();
export default expressionDetection;
