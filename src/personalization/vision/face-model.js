/**
 * ALEJO Face Recognition and Mapping Module
 * 
 * This module provides facial recognition capabilities for ALEJO,
 * allowing for user identification, emotional state detection,
 * and personalized interactions based on facial features.
 * 
 * Uses Face-API.js for browser-based face recognition.
 */

import * as faceapi from 'face-api.js';
import { privacyGuard } from '../../security/privacy-guard';
import { auditTrail } from '../../security/audit-trail';
import { consentManager } from '../../security/consent-manager';
import { valueAlignment } from '../../integration/ethics/value-alignment';
import { EventEmitter } from '../../core/events';

class FaceModel extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.isModelLoaded = false;
    this.faceDescriptors = new Map();
    this.userFaceData = new Map();
    this.defaultFace = 'alejo_pinto'; // Default face is always Alejo Pinto
    this.activeFace = this.defaultFace;
    this.confidenceThreshold = 0.6;
    this.modelPath = '/models/face-api';
  }

  /**
   * Initialize the face recognition system
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Check if face recognition is allowed by user consent
      if (!await consentManager.hasConsent('face_recognition')) {
        console.warn('Face recognition disabled due to user consent settings');
        return false;
      }

      // Load face-api.js models
      await this._loadModels();
      
      // Load default face (Alejo Pinto)
      await this._loadDefaultFace();
      
      this.isInitialized = true;
      this.emit('initialized');
      auditTrail.log('face_model_initialized', { success: true });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize face model:', error);
      auditTrail.log('face_model_initialized', { 
        success: false, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Load required face-api.js models
   */
  async _loadModels() {
    try {
      await faceapi.nets.ssdMobilenetv1.load(this.modelPath);
      await faceapi.nets.faceLandmark68Net.load(this.modelPath);
      await faceapi.nets.faceRecognitionNet.load(this.modelPath);
      await faceapi.nets.faceExpressionNet.load(this.modelPath);
      
      this.isModelLoaded = true;
      this.emit('models_loaded');
      return true;
    } catch (error) {
      console.error('Error loading face models:', error);
      throw new Error(`Failed to load face recognition models: ${error.message}`);
    }
  }

  /**
   * Load the default Alejo Pinto face
   */
  async _loadDefaultFace() {
    try {
      // Load the default face descriptor from a secure location
      const defaultFaceData = await fetch('/assets/faces/alejo_pinto_descriptor.json');
      const descriptor = await defaultFaceData.json();
      
      // Store the default face descriptor
      this.faceDescriptors.set(this.defaultFace, new Float32Array(descriptor));
      
      return true;
    } catch (error) {
      console.error('Error loading default face:', error);
      // Even if default face fails, we can continue with other functionality
      return false;
    }
  }

  /**
   * Detect and recognize faces in an image
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Input image or video
   * @returns {Promise<Object>} Detection results
   */
  async detectFace(input) {
    if (!this.isInitialized || !this.isModelLoaded) {
      throw new Error('Face model not initialized');
    }

    try {
      // Run face detection
      const detections = await faceapi
        .detectAllFaces(input)
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions();
      
      // Process results
      const results = await this._processDetections(detections);
      
      // Log detection (with privacy protections)
      auditTrail.log('face_detection', {
        count: detections.length,
        timestamp: new Date().toISOString()
      });
      
      return results;
    } catch (error) {
      console.error('Face detection error:', error);
      throw new Error(`Face detection failed: ${error.message}`);
    }
  }

  /**
   * Process face detection results
   * @param {Array} detections - Face detection results
   * @returns {Promise<Object>} Processed results
   */
  async _processDetections(detections) {
    const results = {
      faces: [],
      primaryUser: null,
      expressions: null
    };

    if (!detections || detections.length === 0) {
      return results;
    }

    // Process each detected face
    for (const detection of detections) {
      const descriptor = detection.descriptor;
      const expressions = detection.expressions;
      
      // Find matching face if any
      const match = this._findBestMatch(descriptor);
      
      // Add to results
      results.faces.push({
        id: match.label,
        confidence: match.distance,
        position: detection.detection.box,
        landmarks: detection.landmarks.positions,
        expressions: expressions
      });
    }

    // Set primary user (highest confidence match)
    if (results.faces.length > 0) {
      results.faces.sort((a, b) => b.confidence - a.confidence);
      results.primaryUser = results.faces[0].id;
      results.expressions = results.faces[0].expressions;
    }

    return results;
  }

  /**
   * Find the best match for a face descriptor
   * @param {Float32Array} descriptor - Face descriptor
   * @returns {Object} Best match result
   */
  _findBestMatch(descriptor) {
    let bestMatch = {
      label: 'unknown',
      distance: 1.0
    };

    // Compare with stored descriptors
    for (const [label, storedDescriptor] of this.faceDescriptors.entries()) {
      const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
      
      if (distance < bestMatch.distance && distance < this.confidenceThreshold) {
        bestMatch = {
          label,
          distance
        };
      }
    }

    return bestMatch;
  }

  /**
   * Register a new face for recognition
   * @param {string} userId - User ID
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Face image
   * @returns {Promise<boolean>} Success status
   */
  async registerFace(userId, input) {
    if (!this.isInitialized || !this.isModelLoaded) {
      throw new Error('Face model not initialized');
    }

    // Verify consent for face registration
    if (!await consentManager.hasConsent('face_registration')) {
      throw new Error('Face registration requires explicit consent');
    }

    try {
      // Detect face in the input
      const detection = await faceapi
        .detectSingleFace(input)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        throw new Error('No face detected in the image');
      }
      
      // Encrypt and store the face descriptor
      const encryptedDescriptor = await privacyGuard.encryptData(
        Array.from(detection.descriptor),
        userId
      );
      
      // Store user face data
      this.userFaceData.set(userId, {
        registeredAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        encryptedDescriptor
      });
      
      // Store the descriptor for immediate use
      this.faceDescriptors.set(userId, detection.descriptor);
      
      // Log registration (with privacy protections)
      auditTrail.log('face_registration', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      this.emit('face_registered', { userId });
      return true;
    } catch (error) {
      console.error('Face registration error:', error);
      auditTrail.log('face_registration_failed', {
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Face registration failed: ${error.message}`);
    }
  }

  /**
   * Load a user's face data
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async loadUserFace(userId) {
    try {
      // Check if we already have this face loaded
      if (this.faceDescriptors.has(userId)) {
        return true;
      }
      
      // Check if we have stored data for this user
      if (!this.userFaceData.has(userId)) {
        // Try to load from storage
        const userData = await privacyGuard.retrieveSecureData(`face_${userId}`);
        
        if (!userData) {
          return false;
        }
        
        this.userFaceData.set(userId, userData);
      }
      
      // Get the stored data
      const userData = this.userFaceData.get(userId);
      
      // Decrypt the descriptor
      const descriptorArray = await privacyGuard.decryptData(
        userData.encryptedDescriptor,
        userId
      );
      
      // Store the descriptor
      this.faceDescriptors.set(userId, new Float32Array(descriptorArray));
      
      return true;
    } catch (error) {
      console.error(`Error loading face data for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Create a face model from a single photo
   * @param {string} userId - User ID
   * @param {HTMLImageElement} image - User photo
   * @returns {Promise<Object>} Face model data
   */
  async createFaceModelFromPhoto(userId, image) {
    if (!this.isInitialized || !this.isModelLoaded) {
      throw new Error('Face model not initialized');
    }

    // Verify consent
    if (!await consentManager.hasConsent('face_model_creation')) {
      throw new Error('Face model creation requires explicit consent');
    }

    try {
      // Detect face in the image
      const detection = await faceapi
        .detectSingleFace(image)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        throw new Error('No face detected in the image');
      }
      
      // Create face model
      const faceModel = {
        userId,
        descriptor: Array.from(detection.descriptor),
        createdAt: new Date().toISOString()
      };
      
      // Store the face model
      await this.registerFace(userId, image);
      
      // Log creation (with privacy protections)
      auditTrail.log('face_model_created', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      return faceModel;
    } catch (error) {
      console.error('Face model creation error:', error);
      throw new Error(`Face model creation failed: ${error.message}`);
    }
  }

  /**
   * Reset to default face (Alejo Pinto)
   */
  resetToDefault() {
    this.activeFace = this.defaultFace;
    this.emit('face_reset', { face: this.defaultFace });
    return true;
  }
}

// Create and export singleton instance
export const faceModel = new FaceModel();
export default faceModel;
