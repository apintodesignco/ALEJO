/**
 * ALEJO Vision Training UI Module
 * 
 * This module provides a guided interface for training the vision system,
 * including face recognition and expression detection with comprehensive 
 * accessibility features for blind and visually impaired users.
 * 
 * Uses a multi-step process similar to the gesture calibration system with
 * audio guidance, haptic feedback, and screen reader support.
 */

import { faceModel } from './face-model';
import { expressionDetection } from './expression';
import { consentManager } from '../../security/consent-manager';
import { privacyGuard } from '../../security/privacy-guard';
import { auditTrail } from '../../security/audit-trail';
import { EventEmitter } from '../../core/events';
import accessibilityHelpers from './accessibility-helpers';
import { visualImpairmentDetection } from './visual-impairment-detection';

class TrainingUI extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      accessibilityEnabled: options.accessibilityEnabled !== false,
      audioFeedback: options.audioFeedback !== false,
      hapticFeedback: options.hapticFeedback !== false,
      autoDetectImpairments: options.autoDetectImpairments !== false,
      adaptInterfaceAutomatically: options.adaptInterfaceAutomatically === true,
      ...options
    };
    
    // Training state
    this.isInitialized = false;
    this.currentStep = 0;
    this.steps = [
      {
        id: 'consent',
        title: 'Privacy & Consent',
        description: 'Before we begin training, we need your consent to collect and store facial data.'
      },
      {
        id: 'camera-setup',
        title: 'Camera Setup',
        description: 'Position yourself in a well-lit area facing the camera.'
      },
      {
        id: 'face-capture',
        title: 'Face Capture',
        description: 'We\'ll take several photos to build your facial model.'
      },
      {
        id: 'expression-capture',
        title: 'Expression Capture',
        description: 'Now show different expressions to train the emotion detection.'
      },
      {
        id: 'verification',
        title: 'Verification',
        description: 'Let\'s verify that the system can recognize you correctly.'
      },
      {
        id: 'completion',
        title: 'Training Complete',
        description: 'Your facial model has been created successfully.'
      }
    ];
    
    this.trainingData = {
      userId: null,
      faceCaptures: [],
      expressionCaptures: {},
      verificationResults: null
    };
    
    this.videoElement = null;
    this.canvasElement = null;
    this.stream = null;
  }

  /**
   * Initialize the training UI
   * @param {string} userId - User ID
   * @param {HTMLElement} container - Container element for the UI
   * @param {HTMLVideoElement} videoElement - Video element for camera feed
   * @param {HTMLCanvasElement} canvasElement - Canvas element for capturing frames
   * @param {Object} options - Additional options
   */
  async initialize(userId, container, videoElement, canvasElement, options = {}) {
    if (this.isInitialized) return true;

    try {
      // Update configuration with any runtime options
      this.config = {
        ...this.config,
        ...options
      };
      
      this.userId = userId;
      this.videoElement = videoElement;
      this.canvasElement = canvasElement;
      
      // Store UI container reference
      this.elements.container = container;
      this.elements.video = videoElement;
      this.elements.canvas = canvasElement;
      
      // Initialize face model and expression detection
      await faceModel.initialize();
      await expressionDetection.initialize();
      
      // Initialize accessibility helpers if enabled
      if (this.config.accessibilityEnabled) {
        await accessibilityHelpers.initialize({
          audioFeedback: this.config.audioFeedback,
          hapticFeedback: this.config.hapticFeedback
        });
        
        // Enhance UI elements with accessibility attributes
        this.setupAccessibility();
      }
      
      // Initialize visual impairment detection if auto-detection is enabled
      if (this.config.autoDetectImpairments) {
        await visualImpairmentDetection.initialize({
          enabled: true,
          adaptInterfaceAutomatically: this.config.adaptInterfaceAutomatically,
          requireExplicitConsent: true
        });
        
        // Listen for impairment detection events
        visualImpairmentDetection.on('impairment_detected', this.handleVisualImpairmentDetection);
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize training UI:', error);
      throw new Error(`Training UI initialization failed: ${error.message}`);
    }
  }

  /**
   * Start the training process
   */
  async startTraining() {
    if (!this.isInitialized) {
      throw new Error('Training UI not initialized');
    }
    
    this.currentStep = 0;
    this.trainingData = {
      userId: this.userId,
      faceCaptures: [],
      expressionCaptures: {},
      verificationResults: null
    };
    
    // Go to first step
    await this.goToStep(0);
    
    this.emit('training_started');
    auditTrail.log('vision_training_started', {
      userId: this.userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Go to a specific step in the training process
   * @param {number} stepIndex - Step index
   */
  async goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error('Invalid step index');
    }
    
    // Clean up previous step
    await this._cleanupCurrentStep();
    
    // Set new step
    this.currentStep = stepIndex;
    const step = this.steps[this.currentStep];
    
    // Initialize step
    await this._initializeStep(step);
    
    this.emit('step_changed', {
      stepIndex: this.currentStep,
      step
    });
  }

  /**
   * Clean up the current step
   */
  async _cleanupCurrentStep() {
    if (this.currentStep === null) return;
    
    const currentStep = this.steps[this.currentStep];
    
    // Stop camera if it's running
    if (['camera-setup', 'face-capture', 'expression-capture', 'verification'].includes(currentStep.id)) {
      await this._stopCamera();
    }
  }

  /**
   * Initialize a step
   * @param {Object} step - Step data
   */
  async _initializeStep(step) {
    switch (step.id) {
      case 'consent':
        // Nothing to initialize
        break;
        
      case 'camera-setup':
        await this._startCamera();
        break;
        
      case 'face-capture':
        await this._startCamera();
        break;
        
      case 'expression-capture':
        await this._startCamera();
        break;
        
      case 'verification':
        await this._startCamera();
        break;
        
      case 'completion':
        // Nothing to initialize
        break;
    }
  }

  /**
   * Start the camera
   */
  async _startCamera() {
    try {
      if (this.stream) return; // Camera already started
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      this.videoElement.srcObject = this.stream;
      await new Promise(resolve => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });
      
      this.emit('camera_started');
      return true;
    } catch (error) {
      console.error('Failed to start camera:', error);
      this.emit('camera_error', { error: error.message });
      throw new Error(`Camera initialization failed: ${error.message}`);
    }
  }

  /**
   * Stop the camera
   */
  async _stopCamera() {
    if (!this.stream) return;
    
    try {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => track.stop());
      this.stream = null;
      this.videoElement.srcObject = null;
      
      this.emit('camera_stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop camera:', error);
      return false;
    }
  }

  /**
   * Capture a frame from the video
   * @returns {HTMLCanvasElement} Canvas with captured frame
   */
  _captureFrame() {
    if (!this.stream || !this.videoElement || !this.canvasElement) {
      throw new Error('Camera not initialized');
    }
    
    const context = this.canvasElement.getContext('2d');
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    
    context.drawImage(
      this.videoElement,
      0, 0,
      this.videoElement.videoWidth,
      this.videoElement.videoHeight
    );
    
    return this.canvasElement;
  }

  /**
   * Process the current step
   */
  async processStep() {
    if (!this.isInitialized) {
      throw new Error('Training UI not initialized');
    }
    
    const step = this.steps[this.currentStep];
    
    switch (step.id) {
      case 'consent':
        await this._processConsentStep();
        break;
        
      case 'camera-setup':
        await this._processCameraSetupStep();
        break;
        
      case 'face-capture':
        await this._processFaceCaptureStep();
        break;
        
      case 'expression-capture':
        await this._processExpressionCaptureStep();
        break;
        
      case 'verification':
        await this._processVerificationStep();
        break;
        
      case 'completion':
        await this._processCompletionStep();
        break;
    }
    
    // Go to next step if not the last one
    if (this.currentStep < this.steps.length - 1) {
      await this.goToStep(this.currentStep + 1);
    }
  }

  /**
   * Process the consent step
   */
  async _processConsentStep() {
    // Request consent for face recognition and expression detection
    await consentManager.requestConsent('face_recognition', {
      purpose: 'To recognize you and provide personalized experiences',
      dataUsage: 'Your facial data will be stored locally and encrypted',
      retention: 'Until you choose to delete it'
    });
    
    await consentManager.requestConsent('expression_detection', {
      purpose: 'To detect your emotional state and adapt responses',
      dataUsage: 'Expression data is processed in real-time and not stored long-term',
      retention: 'Temporary processing only'
    });
    
    await consentManager.requestConsent('face_model_creation', {
      purpose: 'To create a facial model for recognition',
      dataUsage: 'Model data will be stored locally and encrypted',
      retention: 'Until you choose to delete it'
    });
    
    this.emit('consent_completed', {
      faceRecognition: await consentManager.hasConsent('face_recognition'),
      expressionDetection: await consentManager.hasConsent('expression_detection'),
      faceModelCreation: await consentManager.hasConsent('face_model_creation')
    });
  }

  /**
   * Process the camera setup step
   */
  async _processCameraSetupStep() {
    // Check if face is detected
    const frame = this._captureFrame();
    const detections = await faceapi.detectAllFaces(frame);
    
    if (!detections || detections.length === 0) {
      throw new Error('No face detected. Please position yourself in front of the camera.');
    }
    
    this.emit('camera_setup_completed', {
      facesDetected: detections.length
    });
  }

  /**
   * Process the face capture step
   */
  async _processFaceCaptureStep() {
    // Capture multiple frames for better recognition
    for (let i = 0; i < 5; i++) {
      // Wait a moment between captures
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture frame
      const frame = this._captureFrame();
      
      // Detect face
      const detection = await faceapi
        .detectSingleFace(frame)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        throw new Error('No face detected in capture. Please try again.');
      }
      
      // Store capture
      this.trainingData.faceCaptures.push({
        descriptor: Array.from(detection.descriptor),
        timestamp: new Date().toISOString()
      });
      
      this.emit('face_captured', {
        captureIndex: i + 1,
        totalCaptures: 5
      });
    }
    
    // Register face with the face model
    await faceModel.registerFace(this.userId, this._captureFrame());
    
    this.emit('face_capture_completed', {
      capturesCount: this.trainingData.faceCaptures.length
    });
  }

  /**
   * Process the expression capture step
   */
  async _processExpressionCaptureStep() {
    // Capture different expressions
    const expressionsToCapture = [
      'neutral', 'happy', 'sad', 'surprised'
    ];
    
    for (const expression of expressionsToCapture) {
      // Prompt user to show expression
      this.emit('expression_prompt', { expression });
      
      // Wait for user to prepare
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Capture frame
      const frame = this._captureFrame();
      
      // Detect expression
      const detection = await faceapi
        .detectSingleFace(frame)
        .withFaceExpressions();
      
      if (!detection) {
        throw new Error('No face detected for expression capture. Please try again.');
      }
      
      // Store expression capture
      this.trainingData.expressionCaptures[expression] = {
        expressions: detection.expressions,
        timestamp: new Date().toISOString()
      };
      
      this.emit('expression_captured', {
        expression,
        detected: detection.expressions
      });
    }
    
    this.emit('expression_capture_completed', {
      capturedExpressions: Object.keys(this.trainingData.expressionCaptures)
    });
  }

  /**
   * Process the verification step
   */
  async _processVerificationStep() {
    // Verify that the system can recognize the user
    const frame = this._captureFrame();
    
    // Detect face
    const faceResult = await faceModel.detectFace(frame);
    
    // Detect expression
    const expressionResult = await expressionDetection.detectExpression(frame);
    
    // Store verification results
    this.trainingData.verificationResults = {
      faceRecognized: faceResult.primaryUser === this.userId,
      confidence: faceResult.faces.find(face => face.id === this.userId)?.confidence || 0,
      detectedExpression: expressionResult.dominantExpression,
      expressionConfidence: expressionResult.confidence,
      timestamp: new Date().toISOString()
    };
    
    this.emit('verification_completed', this.trainingData.verificationResults);
  }

  /**
   * Process the completion step
   */
  async _processCompletionStep() {
    // Encrypt and store training data
    const encryptedTrainingData = await privacyGuard.encryptData(
      this.trainingData,
      this.userId
    );
    
    // Store in secure storage
    await privacyGuard.storeSecureData(
      `vision_training_${this.userId}`,
      encryptedTrainingData
    );
    
    // Log completion
    auditTrail.log('vision_training_completed', {
      userId: this.userId,
      timestamp: new Date().toISOString()
    });
    
    this.emit('training_completed', {
      userId: this.userId,
      success: true
    });
    
    // Clean up
    await this._stopCamera();
    this.currentStep = null;
  }

  /**
   * Get the current step
   * @returns {Object} Current step data
   */
  getCurrentStep() {
    if (this.currentStep === null) {
      return null;
    }
    
    return this.steps[this.currentStep];
  }

  /**
   * Get training progress
   * @returns {Object} Training progress data
   */
  getTrainingProgress() {
    return {
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      percentComplete: Math.round((this.currentStep / (this.steps.length - 1)) * 100),
      stepsCompleted: this.currentStep
    };
  }
  
  /**
   * Set up accessibility features for the training UI
   */
  setupAccessibility() {
    if (!this.config.accessibilityEnabled) return;
    
    try {
      // Create progress indicator for screen readers if it doesn't exist
      if (!document.getElementById('vision-training-progress')) {
        const progressIndicator = document.createElement('div');
        progressIndicator.id = 'vision-training-progress';
        progressIndicator.setAttribute('role', 'progressbar');
        progressIndicator.setAttribute('aria-valuemin', '0');
        progressIndicator.setAttribute('aria-valuemax', '100');
        progressIndicator.setAttribute('aria-valuenow', '0');
        progressIndicator.classList.add('sr-only');
        this.elements.container.appendChild(progressIndicator);
        this.elements.progressIndicator = progressIndicator;
      }
      
      // Add ARIA attributes to video element
      if (this.elements.video) {
        this.elements.video.setAttribute('aria-hidden', 'true');
        
        // Create accessible description for video feed
        const videoDescription = document.createElement('div');
        videoDescription.id = 'video-description';
        videoDescription.setAttribute('aria-live', 'polite');
        videoDescription.classList.add('sr-only');
        this.elements.videoDescription = videoDescription;
        this.elements.container.appendChild(videoDescription);
      }
      
      // Set up keyboard navigation
      accessibilityHelpers.setupKeyboardNavigation(this.elements, (event) => {
        // Custom key handling for training UI
        if (event.key === 'c' && this.getCurrentStep().id === 'face-capture') {
          // Capture frame with 'c' key during face capture step
          this.captureFrame();
          event.preventDefault();
        }
      });
      
      // Announce initial state
      const currentStep = this.getCurrentStep();
      if (currentStep) {
        accessibilityHelpers.announceToScreenReader(
          `ALEJO Vision Training: ${currentStep.title}. ${currentStep.description}`,
          'assertive'
        );
      }
      
      // Log accessibility setup
      auditTrail.log({
        action: 'accessibility_setup_completed',
        details: {
          features: [
            'screen_reader_support',
            'keyboard_navigation',
            'audio_feedback',
            'haptic_feedback',
            'visual_impairment_detection'
          ]
        },
        component: 'vision_training',
        level: 'info'
      });
    } catch (error) {
      console.error('Error setting up accessibility features:', error);
    }
  }
  
  /**
   * Handle visual impairment detection from face detection results
   * @param {Object} faceDetection - Face detection results
   * @returns {Promise<Object>} Detection results
   */
  async handleVisualImpairmentDetection(faceDetection) {
    if (!this.config.autoDetectImpairments || !faceDetection) {
      return null;
    }
    
    try {
      // Analyze eyes for potential visual impairments
      const detectionResults = await visualImpairmentDetection.analyzeEyes(faceDetection);
      
      if (!detectionResults) return null;
      
      // Update accessibility state
      if (detectionResults.confidence > 0.7 && !this.accessibilityState.visualImpairmentDetected) {
        this.accessibilityState.visualImpairmentDetected = true;
        this.accessibilityState.detectionConfidence = detectionResults.confidence;
        this.accessibilityState.recommendedFeatures = detectionResults.recommendations?.features || [];
        
        // Log detection
        auditTrail.log({
          action: 'visual_impairment_detected',
          details: {
            confidence: detectionResults.confidence,
            impairments: detectionResults.impairments,
            recommendations: detectionResults.recommendations
          },
          component: 'vision_training',
          level: 'info'
        });
        
        // Announce detection to user if high confidence
        if (detectionResults.confidence > 0.85) {
          this.offerAccessibilityAssistance(detectionResults);
        }
        
        // Apply recommendations if configured to do so automatically
        if (this.config.adaptInterfaceAutomatically && detectionResults.recommendations) {
          visualImpairmentDetection.applyRecommendations(
            detectionResults.recommendations,
            this.accessibilityState.userConfirmedFeatures
          );
        }
      }
      
      return detectionResults;
    } catch (error) {
      console.error('Error in visual impairment detection:', error);
      return null;
    }
  }
  
  /**
   * Offer accessibility assistance to the user based on detection results
   * @param {Object} detectionResults - Visual impairment detection results
   */
  offerAccessibilityAssistance(detectionResults) {
    if (!detectionResults || !detectionResults.recommendations) return;
    
    // Create accessibility notification if it doesn't exist
    if (!this.elements.accessibilityNotification) {
      const notification = document.createElement('div');
      notification.className = 'accessibility-notification';
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');
      
      const message = document.createElement('p');
      const actionButtons = document.createElement('div');
      actionButtons.className = 'accessibility-actions';
      
      const acceptButton = document.createElement('button');
      acceptButton.textContent = 'Enable accessibility features';
      acceptButton.setAttribute('aria-label', 'Enable recommended accessibility features');
      acceptButton.addEventListener('click', () => {
        this.accessibilityState.userConfirmedFeatures = true;
        visualImpairmentDetection.applyRecommendations(detectionResults.recommendations, true);
        notification.style.display = 'none';
        
        // Announce confirmation
        accessibilityHelpers.announceToScreenReader(
          'Accessibility features enabled. Training will continue with additional assistance.',
          'assertive'
        );
        
        // Log user choice
        auditTrail.log({
          action: 'accessibility_features_accepted',
          details: {
            features: detectionResults.recommendations.features
          },
          component: 'vision_training',
          level: 'info'
        });
      });
      
      const declineButton = document.createElement('button');
      declineButton.textContent = 'Continue without changes';
      declineButton.setAttribute('aria-label', 'Continue without enabling accessibility features');
      declineButton.addEventListener('click', () => {
        notification.style.display = 'none';
        
        // Log user choice
        auditTrail.log({
          action: 'accessibility_features_declined',
          component: 'vision_training',
          level: 'info'
        });
      });
      
      actionButtons.appendChild(acceptButton);
      actionButtons.appendChild(declineButton);
      notification.appendChild(message);
      notification.appendChild(actionButtons);
      
      this.elements.accessibilityNotification = notification;
      this.elements.container.appendChild(notification);
    }
    
    // Update notification message
    const message = this.elements.accessibilityNotification.querySelector('p');
    const features = detectionResults.recommendations.features
      .map(f => f.replace('_', ' '))
      .join(', ');
    
    message.textContent = `ALEJO has detected you may benefit from accessibility features: ${features}. Would you like to enable these features?`;
    
    // Show notification
    this.elements.accessibilityNotification.style.display = 'block';
    
    // Also announce to screen reader
    accessibilityHelpers.announceToScreenReader(
      `ALEJO has detected you may benefit from accessibility features: ${features}. Use the buttons below to enable or decline these features.`,
      'assertive'
    );
  }
  
  /**
   * Provide accessible feedback during face detection and training
   * @param {Object} detectionData - Face detection data
   * @param {string} feedbackType - Type of feedback ('position', 'expression', 'capture', etc.)
   */
  provideAccessibleFeedback(detectionData, feedbackType) {
    if (!this.config.accessibilityEnabled) return;
    
    const now = Date.now();
    const minAnnouncementInterval = 2000; // Minimum time between announcements (ms)
    
    // Don't provide feedback too frequently
    if (now - this.accessibilityState.lastAnnouncementTime < minAnnouncementInterval) {
      return;
    }
    
    try {
      switch (feedbackType) {
        case 'position':
          if (detectionData) {
            // Generate position guidance
            const guidance = accessibilityHelpers.generatePositionGuidance(detectionData);
            
            // Only announce if different from last announcement or high priority
            if (guidance.message !== this.accessibilityState.lastAnnouncement || 
                guidance.feedbackType === 'no_face' || 
                guidance.feedbackType === 'good_position') {
              
              // Provide audio feedback
              if (this.config.audioFeedback) {
                accessibilityHelpers.playFaceDetectionFeedback(guidance.feedbackType);
                accessibilityHelpers.playPositionFeedbackTone(guidance.confidence);
              }
              
              // Provide haptic feedback
              if (this.config.hapticFeedback) {
                accessibilityHelpers.provideHapticFeedback(guidance.feedbackType === 'good_position' ? 'success' : 'position');
              }
              
              // Announce to screen reader if significant change
              accessibilityHelpers.announceToScreenReader(guidance.message, 'polite');
              
              // Update state
              this.accessibilityState.lastAnnouncement = guidance.message;
              this.accessibilityState.lastAnnouncementTime = now;
            }
          }
          break;
          
        case 'expression':
          if (detectionData && detectionData.expressions) {
            const targetExpression = this.getCurrentStep().targetExpression;
            const guidance = accessibilityHelpers.getExpressionGuidance(
              targetExpression, 
              detectionData.expressions
            );
            
            // Only announce if different from last announcement
            if (guidance.message !== this.accessibilityState.lastAnnouncement) {
              // Provide audio feedback
              if (this.config.audioFeedback) {
                accessibilityHelpers.playExpressionFeedback(targetExpression, guidance.confidence);
              }
              
              // Provide haptic feedback
              if (this.config.hapticFeedback && guidance.match) {
                accessibilityHelpers.provideHapticFeedback('success');
              }
              
              // Announce to screen reader
              accessibilityHelpers.announceToScreenReader(guidance.message, guidance.match ? 'assertive' : 'polite');
              
              // Update state
              this.accessibilityState.lastAnnouncement = guidance.message;
              this.accessibilityState.lastAnnouncementTime = now;
            }
          }
          break;
          
        case 'capture':
          // Provide audio feedback for capture
          if (this.config.audioFeedback) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 880; // A5
            gainNode.gain.value = 0.3;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
          }
          
          // Provide haptic feedback
          if (this.config.hapticFeedback) {
            accessibilityHelpers.provideHapticFeedback('capture');
          }
          
          // Announce to screen reader
          accessibilityHelpers.announceToScreenReader('Image captured', 'assertive');
          
          // Update state
          this.accessibilityState.lastAnnouncement = 'Image captured';
          this.accessibilityState.lastAnnouncementTime = now;
          break;
          
        case 'step_change':
          const currentStep = this.getCurrentStep();
          const progress = this.getTrainingProgress();
          
          // Update progress announcement for screen readers
          accessibilityHelpers.updateProgressAnnouncement({
            currentStep: progress.currentStep,
            totalSteps: progress.totalSteps,
            percentComplete: progress.percentComplete,
            currentStepName: currentStep.title
          });
          
          // Announce step change
          accessibilityHelpers.announceToScreenReader(
            `Step ${progress.currentStep + 1} of ${progress.totalSteps}: ${currentStep.title}. ${currentStep.description}`,
            'assertive'
          );
          
          // Update state
          this.accessibilityState.lastAnnouncement = currentStep.title;
          this.accessibilityState.lastAnnouncementTime = now;
          break;
      }
    } catch (error) {
      console.error('Error providing accessible feedback:', error);
    }
  }
}

// Create and export singleton instance
export const trainingUI = new TrainingUI();
export default trainingUI;
