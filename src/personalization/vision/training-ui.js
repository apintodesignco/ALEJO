/**
 * ALEJO Vision Training UI Module
 * 
 * This module provides a guided interface for training the vision system,
 * including face recognition and expression detection.
 * 
 * Uses a multi-step process similar to the gesture calibration system.
 */

import { faceModel } from './face-model';
import { expressionDetection } from './expression';
import { consentManager } from '../../security/consent-manager';
import { privacyGuard } from '../../security/privacy-guard';
import { auditTrail } from '../../security/audit-trail';
import { EventEmitter } from '../../core/events';

class TrainingUI extends EventEmitter {
  constructor() {
    super();
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
   * @param {HTMLVideoElement} videoElement - Video element for camera feed
   * @param {HTMLCanvasElement} canvasElement - Canvas element for capturing frames
   */
  async initialize(userId, videoElement, canvasElement) {
    if (this.isInitialized) return true;

    try {
      this.userId = userId;
      this.videoElement = videoElement;
      this.canvasElement = canvasElement;
      
      // Initialize face model and expression detection
      await faceModel.initialize();
      await expressionDetection.initialize();
      
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
}

// Create and export singleton instance
export const trainingUI = new TrainingUI();
export default trainingUI;
