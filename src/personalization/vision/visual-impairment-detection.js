/**
 * ALEJO Visual Impairment Detection Module
 * 
 * This module analyzes eye movements, gaze patterns, and pupil responses
 * to detect potential visual impairments and provide appropriate accessibility
 * accommodations automatically while respecting privacy and user agency.
 * 
 * All processing happens locally on the device, maintaining ALEJO's
 * local-first and privacy-first principles.
 */

import { auditTrail } from '../../security/audit-trail';
import { privacyGuard } from '../../security/privacy-guard';
import { consentManager } from '../../security/consent-manager';
import { EventEmitter } from '../../core/events';

class VisualImpairmentDetection extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      enabled: options.enabled !== false,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      analysisFrequency: options.analysisFrequency || 1000, // ms between analyses
      adaptInterfaceAutomatically: options.adaptInterfaceAutomatically !== false,
      requireExplicitConsent: options.requireExplicitConsent !== false,
      storageKey: 'alejo_visual_impairment_detection',
      ...options
    };
    
    // State
    this.isInitialized = false;
    this.isAnalyzing = false;
    this.lastAnalysisTime = 0;
    this.analysisHistory = [];
    this.detectionConfidence = 0;
    this.detectedImpairments = {
      lowVision: 0,
      blindness: 0,
      focusIssues: 0,
      lightSensitivity: 0
    };
    
    // User interaction history for pattern analysis
    this.userInteractionHistory = {
      screenTouches: [],
      mouseMovements: [],
      keyboardUsage: []
    };
    
    // Model state
    this.model = null;
    this.modelLoaded = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.analyzeEyes = this.analyzeEyes.bind(this);
    this.trackUserInteraction = this.trackUserInteraction.bind(this);
    this.generateAccessibilityRecommendations = this.generateAccessibilityRecommendations.bind(this);
  }
  
  /**
   * Initialize the visual impairment detection system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Check for user consent
      const hasConsent = await consentManager.checkConsent('accessibility_detection');
      
      if (this.config.requireExplicitConsent && !hasConsent) {
        console.log('Visual impairment detection requires explicit user consent');
        return false;
      }
      
      // Load the eye analysis model (lightweight TensorFlow.js model)
      await this.loadModel();
      
      // Set up interaction tracking
      this.setupInteractionTracking();
      
      // Load previous analysis if available
      await this.loadPreviousAnalysis();
      
      this.isInitialized = true;
      
      // Log initialization
      auditTrail.log({
        action: 'visual_impairment_detection_initialized',
        details: {
          timestamp: new Date().toISOString(),
          config: { ...this.config, enabled: this.config.enabled }
        },
        component: 'accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize visual impairment detection:', error);
      
      auditTrail.log({
        action: 'visual_impairment_detection_initialization_failed',
        details: {
          timestamp: new Date().toISOString(),
          error: error.message
        },
        component: 'accessibility',
        level: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Load the eye analysis model
   * @returns {Promise<void>}
   */
  async loadModel() {
    // For now, we'll use face-api.js landmarks as our base
    // In a production implementation, we would load a specialized TensorFlow.js model
    // that's been trained on eye movement patterns
    
    this.modelLoaded = true;
    return Promise.resolve();
  }
  
  /**
   * Set up tracking for user interactions with the interface
   */
  setupInteractionTracking() {
    if (typeof window === 'undefined') return;
    
    // Track mouse/touch movements
    window.addEventListener('mousemove', this.trackUserInteraction);
    window.addEventListener('touchmove', this.trackUserInteraction);
    
    // Track keyboard usage
    window.addEventListener('keydown', this.trackUserInteraction);
    
    // Track clicks/taps
    window.addEventListener('click', this.trackUserInteraction);
    window.addEventListener('touchstart', this.trackUserInteraction);
  }
  
  /**
   * Track user interaction with the interface
   * @param {Event} event - DOM event
   */
  trackUserInteraction(event) {
    if (!this.isInitialized || !this.config.enabled) return;
    
    const timestamp = Date.now();
    
    // Track different types of interactions
    switch (event.type) {
      case 'mousemove':
        this.userInteractionHistory.mouseMovements.push({
          x: event.clientX,
          y: event.clientY,
          timestamp
        });
        
        // Keep history manageable
        if (this.userInteractionHistory.mouseMovements.length > 100) {
          this.userInteractionHistory.mouseMovements.shift();
        }
        break;
        
      case 'touchmove':
      case 'touchstart':
        if (event.touches && event.touches[0]) {
          this.userInteractionHistory.screenTouches.push({
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            timestamp
          });
          
          // Keep history manageable
          if (this.userInteractionHistory.screenTouches.length > 100) {
            this.userInteractionHistory.screenTouches.shift();
          }
        }
        break;
        
      case 'keydown':
        this.userInteractionHistory.keyboardUsage.push({
          key: event.key,
          timestamp
        });
        
        // Keep history manageable
        if (this.userInteractionHistory.keyboardUsage.length > 100) {
          this.userInteractionHistory.keyboardUsage.shift();
        }
        break;
    }
  }
  
  /**
   * Load previous analysis results from secure storage
   * @returns {Promise<void>}
   */
  async loadPreviousAnalysis() {
    try {
      const encryptedData = localStorage.getItem(this.config.storageKey);
      
      if (encryptedData) {
        const data = await privacyGuard.decrypt(encryptedData);
        
        if (data) {
          const parsedData = JSON.parse(data);
          
          // Only use recent data (within the last week)
          const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          
          if (parsedData.timestamp && parsedData.timestamp > oneWeekAgo) {
            this.detectionConfidence = parsedData.detectionConfidence || 0;
            this.detectedImpairments = parsedData.detectedImpairments || this.detectedImpairments;
            this.analysisHistory = parsedData.analysisHistory || [];
          }
        }
      }
    } catch (error) {
      console.error('Failed to load previous visual impairment analysis:', error);
    }
  }
  
  /**
   * Save current analysis results to secure storage
   * @returns {Promise<void>}
   */
  async saveAnalysis() {
    try {
      const data = {
        timestamp: Date.now(),
        detectionConfidence: this.detectionConfidence,
        detectedImpairments: this.detectedImpairments,
        analysisHistory: this.analysisHistory.slice(-20) // Keep only recent history
      };
      
      const encryptedData = await privacyGuard.encrypt(JSON.stringify(data));
      localStorage.setItem(this.config.storageKey, encryptedData);
    } catch (error) {
      console.error('Failed to save visual impairment analysis:', error);
    }
  }
  
  /**
   * Analyze eye landmarks for potential visual impairments
   * @param {Object} faceDetection - Face detection result from face-api.js
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeEyes(faceDetection) {
    if (!this.isInitialized || !this.config.enabled || !faceDetection) {
      return null;
    }
    
    // Throttle analysis to avoid performance issues
    const now = Date.now();
    if (now - this.lastAnalysisTime < this.config.analysisFrequency) {
      return null;
    }
    
    this.lastAnalysisTime = now;
    this.isAnalyzing = true;
    
    try {
      // Extract eye landmarks
      const landmarks = faceDetection.landmarks;
      if (!landmarks) return null;
      
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      
      if (!leftEye || !rightEye) return null;
      
      // Analyze blink patterns
      const blinkAnalysis = await this.analyzeBlinkPatterns(leftEye, rightEye);
      
      // Track gaze direction
      const gazeAnalysis = await this.trackGazeDirection(leftEye, rightEye, faceDetection);
      
      // Analyze pupil response (estimated from landmarks)
      const pupilAnalysis = await this.analyzePupilResponse(leftEye, rightEye);
      
      // Combine analyses with interaction history
      const combinedAnalysis = this.combineAnalyses({
        blinkAnalysis,
        gazeAnalysis,
        pupilAnalysis,
        interactionHistory: this.userInteractionHistory
      });
      
      // Update detection confidence based on new analysis
      // Use a weighted moving average to avoid rapid changes
      this.detectionConfidence = (this.detectionConfidence * 0.7) + (combinedAnalysis.overallScore * 0.3);
      
      // Update impairment type scores
      for (const [key, value] of Object.entries(combinedAnalysis.impairmentScores)) {
        this.detectedImpairments[key] = (this.detectedImpairments[key] * 0.7) + (value * 0.3);
      }
      
      // Add to analysis history
      this.analysisHistory.push({
        timestamp: now,
        confidence: this.detectionConfidence,
        impairments: { ...this.detectedImpairments }
      });
      
      // Keep history at a reasonable size
      if (this.analysisHistory.length > 50) {
        this.analysisHistory.shift();
      }
      
      // Save analysis results
      await this.saveAnalysis();
      
      // Generate recommendations if confidence exceeds threshold
      let recommendations = null;
      if (this.detectionConfidence > this.config.confidenceThreshold) {
        recommendations = this.generateAccessibilityRecommendations();
        
        // Emit event with recommendations
        this.emit('impairment_detected', {
          confidence: this.detectionConfidence,
          impairments: { ...this.detectedImpairments },
          recommendations
        });
      }
      
      this.isAnalyzing = false;
      
      return {
        confidence: this.detectionConfidence,
        impairments: { ...this.detectedImpairments },
        recommendations,
        timestamp: now
      };
    } catch (error) {
      console.error('Error analyzing eyes for visual impairment:', error);
      this.isAnalyzing = false;
      return null;
    }
  }
  
  /**
   * Analyze blink patterns from eye landmarks
   * @param {Array} leftEye - Left eye landmarks
   * @param {Array} rightEye - Right eye landmarks
   * @returns {Promise<Object>} Blink analysis results
   */
  async analyzeBlinkPatterns(leftEye, rightEye) {
    // Calculate eye aspect ratio (EAR) which is commonly used to detect blinks
    // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    
    // For simplicity in this implementation, we'll use a basic approximation
    const leftEyeHeight = this.calculateEyeHeight(leftEye);
    const rightEyeHeight = this.calculateEyeHeight(rightEye);
    const leftEyeWidth = this.calculateEyeWidth(leftEye);
    const rightEyeWidth = this.calculateEyeWidth(rightEye);
    
    // Calculate aspect ratios
    const leftEAR = leftEyeHeight / leftEyeWidth;
    const rightEAR = rightEyeHeight / rightEyeWidth;
    const averageEAR = (leftEAR + rightEAR) / 2;
    
    // Typical threshold for blink detection is around 0.2-0.25
    const isBlinking = averageEAR < 0.2;
    
    // Check for asymmetry between eyes (can indicate certain conditions)
    const asymmetry = Math.abs(leftEAR - rightEAR);
    
    return {
      leftEAR,
      rightEAR,
      averageEAR,
      isBlinking,
      asymmetry,
      // Scores for different potential impairments based on blink patterns
      impairmentScores: {
        lowVision: isBlinking ? 0.3 : 0, // Frequent blinking can indicate eye strain
        focusIssues: asymmetry > 0.15 ? 0.4 : 0 // Asymmetry can indicate focus issues
      }
    };
  }
  
  /**
   * Calculate eye height from landmarks
   * @param {Array} eye - Eye landmarks
   * @returns {number} Eye height
   */
  calculateEyeHeight(eye) {
    // Simplified: use distance between top and bottom landmarks
    // In a real implementation, we would use the proper landmarks
    const topY = Math.min(...eye.map(point => point.y));
    const bottomY = Math.max(...eye.map(point => point.y));
    return bottomY - topY;
  }
  
  /**
   * Calculate eye width from landmarks
   * @param {Array} eye - Eye landmarks
   * @returns {number} Eye width
   */
  calculateEyeWidth(eye) {
    // Simplified: use distance between leftmost and rightmost landmarks
    const leftX = Math.min(...eye.map(point => point.x));
    const rightX = Math.max(...eye.map(point => point.x));
    return rightX - leftX;
  }
  
  /**
   * Track gaze direction relative to the screen
   * @param {Array} leftEye - Left eye landmarks
   * @param {Array} rightEye - Right eye landmarks
   * @param {Object} faceDetection - Full face detection result
   * @returns {Promise<Object>} Gaze analysis results
   */
  async trackGazeDirection(leftEye, rightEye, faceDetection) {
    // Calculate eye centers
    const leftCenter = this.calculateEyeCenter(leftEye);
    const rightCenter = this.calculateEyeCenter(rightEye);
    
    // Calculate iris positions (estimated)
    // In a real implementation, we would use more sophisticated iris detection
    const leftIris = this.estimateIrisPosition(leftEye);
    const rightIris = this.estimateIrisPosition(rightEye);
    
    // Calculate gaze vectors (from eye center to iris)
    const leftGazeVector = {
      x: leftIris.x - leftCenter.x,
      y: leftIris.y - leftCenter.y
    };
    
    const rightGazeVector = {
      x: rightIris.x - rightCenter.x,
      y: rightIris.y - rightCenter.y
    };
    
    // Normalize vectors
    const leftMagnitude = Math.sqrt(leftGazeVector.x ** 2 + leftGazeVector.y ** 2);
    const rightMagnitude = Math.sqrt(rightGazeVector.x ** 2 + rightGazeVector.y ** 2);
    
    if (leftMagnitude > 0) {
      leftGazeVector.x /= leftMagnitude;
      leftGazeVector.y /= leftMagnitude;
    }
    
    if (rightMagnitude > 0) {
      rightGazeVector.x /= rightMagnitude;
      rightGazeVector.y /= rightMagnitude;
    }
    
    // Calculate average gaze direction
    const avgGazeVector = {
      x: (leftGazeVector.x + rightGazeVector.x) / 2,
      y: (leftGazeVector.y + rightGazeVector.y) / 2
    };
    
    // Check if gaze is directed at the camera/screen
    // Simplified: if y component is close to 0 and x component is close to 0, 
    // the person is likely looking at the camera
    const lookingAtCamera = Math.abs(avgGazeVector.y) < 0.2 && Math.abs(avgGazeVector.x) < 0.2;
    
    // Check for wandering gaze (can indicate certain visual impairments)
    // Compare with recent gaze directions
    const gazeStability = 0.8; // Placeholder - would be calculated from history
    
    // Check for nystagmus (involuntary eye movements)
    // Would require analyzing gaze over time
    const nystagmusScore = 0.1; // Placeholder
    
    return {
      leftGazeVector,
      rightGazeVector,
      avgGazeVector,
      lookingAtCamera,
      gazeStability,
      nystagmusScore,
      // Scores for different potential impairments based on gaze
      impairmentScores: {
        lowVision: !lookingAtCamera ? 0.3 : 0,
        blindness: (!lookingAtCamera && gazeStability < 0.5) ? 0.5 : 0,
        focusIssues: nystagmusScore > 0.3 ? 0.4 : 0
      }
    };
  }
  
  /**
   * Calculate the center point of an eye from landmarks
   * @param {Array} eye - Eye landmarks
   * @returns {Object} Center point {x, y}
   */
  calculateEyeCenter(eye) {
    const sumX = eye.reduce((sum, point) => sum + point.x, 0);
    const sumY = eye.reduce((sum, point) => sum + point.y, 0);
    return {
      x: sumX / eye.length,
      y: sumY / eye.length
    };
  }
  
  /**
   * Estimate iris position from eye landmarks
   * @param {Array} eye - Eye landmarks
   * @returns {Object} Estimated iris position {x, y}
   */
  estimateIrisPosition(eye) {
    // In a real implementation, we would use more sophisticated iris detection
    // For now, we'll use a weighted center calculation that emphasizes the
    // inner points of the eye which are closer to where the iris would be
    
    // Simplified approach: use the center of the eye as an approximation
    return this.calculateEyeCenter(eye);
  }
  
  /**
   * Analyze pupil response (estimated from landmarks)
   * @param {Array} leftEye - Left eye landmarks
   * @param {Array} rightEye - Right eye landmarks
   * @returns {Promise<Object>} Pupil analysis results
   */
  async analyzePupilResponse(leftEye, rightEye) {
    // In a real implementation, we would need specialized iris/pupil detection
    // For this simplified version, we'll use eye openness as a proxy
    
    const leftEyeArea = this.calculateEyeArea(leftEye);
    const rightEyeArea = this.calculateEyeArea(rightEye);
    const averageEyeArea = (leftEyeArea + rightEyeArea) / 2;
    
    // Check for light sensitivity (would normally compare pupil size over time)
    // For now, use a placeholder value
    const lightSensitivityScore = 0.1;
    
    return {
      leftEyeArea,
      rightEyeArea,
      averageEyeArea,
      lightSensitivityScore,
      // Scores for different potential impairments based on pupil response
      impairmentScores: {
        lightSensitivity: lightSensitivityScore,
        lowVision: averageEyeArea < 0.3 ? 0.2 : 0 // Small eye opening can indicate strain
      }
    };
  }
  
  /**
   * Calculate approximate eye area from landmarks
   * @param {Array} eye - Eye landmarks
   * @returns {number} Approximate eye area
   */
  calculateEyeArea(eye) {
    const width = this.calculateEyeWidth(eye);
    const height = this.calculateEyeHeight(eye);
    return width * height;
  }
  
  /**
   * Combine different analyses into an overall assessment
   * @param {Object} analyses - Various analysis results
   * @returns {Object} Combined analysis
   */
  combineAnalyses(analyses) {
    const { blinkAnalysis, gazeAnalysis, pupilAnalysis, interactionHistory } = analyses;
    
    // Initialize scores
    const impairmentScores = {
      lowVision: 0,
      blindness: 0,
      focusIssues: 0,
      lightSensitivity: 0
    };
    
    // Combine impairment scores from different analyses
    if (blinkAnalysis) {
      for (const [key, value] of Object.entries(blinkAnalysis.impairmentScores)) {
        impairmentScores[key] += value;
      }
    }
    
    if (gazeAnalysis) {
      for (const [key, value] of Object.entries(gazeAnalysis.impairmentScores)) {
        impairmentScores[key] += value;
      }
    }
    
    if (pupilAnalysis) {
      for (const [key, value] of Object.entries(pupilAnalysis.impairmentScores)) {
        impairmentScores[key] += value;
      }
    }
    
    // Analyze interaction patterns
    const interactionScore = this.analyzeInteractionPatterns(interactionHistory);
    impairmentScores.lowVision += interactionScore.lowVision;
    impairmentScores.blindness += interactionScore.blindness;
    
    // Normalize scores to 0-1 range
    for (const key in impairmentScores) {
      impairmentScores[key] = Math.min(1, impairmentScores[key]);
    }
    
    // Calculate overall score (weighted average of individual scores)
    const overallScore = (
      impairmentScores.lowVision * 0.3 +
      impairmentScores.blindness * 0.4 +
      impairmentScores.focusIssues * 0.2 +
      impairmentScores.lightSensitivity * 0.1
    );
    
    return {
      impairmentScores,
      overallScore: Math.min(1, overallScore),
      timestamp: Date.now()
    };
  }
  
  /**
   * Analyze user interaction patterns for signs of visual impairment
   * @param {Object} history - User interaction history
   * @returns {Object} Analysis scores
   */
  analyzeInteractionPatterns(history) {
    const scores = {
      lowVision: 0,
      blindness: 0
    };
    
    // Check for screen reader usage (high keyboard, low mouse)
    if (history.keyboardUsage.length > 20 && history.mouseMovements.length < 5) {
      scores.blindness += 0.4;
    }
    
    // Check for erratic mouse movements (can indicate low vision)
    if (history.mouseMovements.length > 10) {
      let erraticMovements = 0;
      
      for (let i = 1; i < history.mouseMovements.length; i++) {
        const prev = history.mouseMovements[i - 1];
        const curr = history.mouseMovements[i];
        
        // Calculate movement vector
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check for sudden direction changes
        if (distance > 100) {
          erraticMovements++;
        }
      }
      
      const erraticRatio = erraticMovements / history.mouseMovements.length;
      if (erraticRatio > 0.3) {
        scores.lowVision += 0.3;
      }
    }
    
    return scores;
  }
  
  /**
   * Generate accessibility recommendations based on detected impairments
   * @returns {Object} Accessibility recommendations
   */
  generateAccessibilityRecommendations() {
    const recommendations = {
      features: [],
      uiAdjustments: [],
      priority: 'low'
    };
    
    // Set priority based on overall confidence
    if (this.detectionConfidence > 0.9) {
      recommendations.priority = 'high';
    } else if (this.detectionConfidence > 0.7) {
      recommendations.priority = 'medium';
    }
    
    // Add recommendations based on detected impairments
    if (this.detectedImpairments.blindness > 0.7) {
      recommendations.features.push('screen_reader_mode');
      recommendations.features.push('audio_descriptions');
      recommendations.features.push('haptic_feedback');
      recommendations.priority = 'high';
    } else if (this.detectedImpairments.lowVision > 0.7) {
      recommendations.features.push('high_contrast_mode');
      recommendations.features.push('larger_text');
      recommendations.features.push('screen_magnifier');
      recommendations.priority = 'high';
    }
    
    if (this.detectedImpairments.focusIssues > 0.5) {
      recommendations.features.push('simplified_interface');
      recommendations.features.push('reduced_motion');
      recommendations.uiAdjustments.push('increase_element_spacing');
    }
    
    if (this.detectedImpairments.lightSensitivity > 0.5) {
      recommendations.features.push('dark_mode');
      recommendations.features.push('reduced_brightness');
      recommendations.uiAdjustments.push('avoid_flashing_elements');
    }
    
    return recommendations;
  }
  
  /**
   * Apply accessibility recommendations to the interface
   * @param {Object} recommendations - Accessibility recommendations
   * @param {boolean} userConfirmed - Whether the user has confirmed the changes
   * @returns {boolean} Success status
   */
  applyRecommendations(recommendations, userConfirmed = false) {
    if (!recommendations || (!userConfirmed && !this.config.adaptInterfaceAutomatically)) {
      return false;
    }
    
    try {
      // Apply UI adjustments
      if (recommendations.uiAdjustments.includes('increase_element_spacing')) {
        document.documentElement.style.setProperty('--element-spacing', '1.5em');
      }
      
      // Apply features
      if (recommendations.features.includes('high_contrast_mode')) {
        document.body.classList.add('high-contrast-mode');
      }
      
      if (recommendations.features.includes('larger_text')) {
        document.body.classList.add('larger-text');
      }
      
      if (recommendations.features.includes('dark_mode')) {
        document.body.classList.add('dark-mode');
      }
      
      // Log application of recommendations
      auditTrail.log({
        action: 'accessibility_recommendations_applied',
        details: {
          timestamp: new Date().toISOString(),
          recommendations,
          userConfirmed
        },
        component: 'accessibility',
        level: 'info'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to apply accessibility recommendations:', error);
      return false;
    }
  }
  
  /**
   * Clean up resources used by the detection system
   */
  cleanup() {
    if (typeof window === 'undefined') return;
    
    // Remove event listeners
    window.removeEventListener('mousemove', this.trackUserInteraction);
    window.removeEventListener('touchmove', this.trackUserInteraction);
    window.removeEventListener('keydown', this.trackUserInteraction);
    window.removeEventListener('click', this.trackUserInteraction);
    window.removeEventListener('touchstart', this.trackUserInteraction);
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const visualImpairmentDetection = new VisualImpairmentDetection();

// Also export the class for testing and custom instances
export { VisualImpairmentDetection };
