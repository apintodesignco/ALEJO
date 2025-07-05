/**
 * ALEJO Vision Recognition Module
 * 
 * This module handles facial recognition, expression detection, and other
 * vision-based recognition features. It works with models created by the
 * vision training module to identify users and detect emotions.
 * 
 * It integrates with ALEJO's security layer for permission management and
 * audit logging, and provides a comprehensive API for vision recognition.
 */

import * as security from '../../security/index.js';
import * as faceapi from '@vladmandic/face-api';
import { EventBus } from '../../core/event-bus.js';
import * as training from './training.js';

// Module state
const state = {
  initialized: false,
  recognizing: false,
  currentSession: null,
  models: {},
  faceMatcher: null,
  detectionOptions: null,
  securityInitialized: false,
  userId: null,
  eventHandlersRegistered: false,
  modelPath: './models',
  recognitionThreshold: 0.6, // Default recognition threshold (lower = more permissive)
  lastRecognitionResult: null
};

/**
 * Initialize the vision recognition module
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID for the current session
 * @param {string} options.modelPath - Path to face-api models
 * @param {number} options.recognitionThreshold - Threshold for recognition confidence (0-1)
 * @param {Object} options.detectionOptions - Options for face detection
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
export async function initialize(options = {}) {
  try {
    console.log('Initializing ALEJO Vision Recognition System');
    
    // Initialize security first
    try {
      state.securityInitialized = await security.initialize(options);
      state.userId = options.userId || security.getCurrentUserId();
      
      // Log initialization in audit trail
      security.auditTrail.log('vision:recognition:initialization', {
        userId: state.userId,
        timestamp: new Date().toISOString(),
        options: JSON.stringify(options)
      });
    } catch (error) {
      console.error('Failed to initialize security for vision recognition:', error);
      return false;
    }
    
    // Set up configuration
    state.modelPath = options.modelPath || state.modelPath;
    state.recognitionThreshold = options.recognitionThreshold || state.recognitionThreshold;
    
    // Set up face detection options
    state.detectionOptions = {
      scoreThreshold: 0.5,
      inputSize: 224,
      ...options.detectionOptions
    };
    
    // Initialize training module if needed
    if (!training.isInitialized()) {
      try {
        await training.initialize(options);
      } catch (error) {
        console.error('Failed to initialize vision training module:', error);
        // Non-critical error, continue initialization
      }
    }
    
    // Load face-api models
    try {
      await loadModels();
    } catch (error) {
      console.error('Failed to load face-api models:', error);
      security.auditTrail.log('vision:recognition:model_load_failed', {
        userId: state.userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
    
    // Register event handlers if not already registered
    if (!state.eventHandlersRegistered) {
      registerEventHandlers();
      state.eventHandlersRegistered = true;
    }
    
    // Load vision models
    try {
      await loadVisionModels();
    } catch (error) {
      console.warn('Failed to load vision models:', error);
      // Non-critical error, continue initialization
    }
    
    state.initialized = true;
    
    // Log successful initialization
    security.auditTrail.log('vision:recognition:initialized', {
      userId: state.userId,
      timestamp: new Date().toISOString(),
      success: true
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize vision recognition:', error);
    security.auditTrail.log('vision:recognition:initialization_failed', {
      userId: state.userId || 'unknown',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

/**
 * Load face-api models from the specified path
 * 
 * @returns {Promise<void>}
 */
async function loadModels() {
  console.log(`Loading face-api models from ${state.modelPath}`);
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(state.modelPath),
    faceapi.nets.faceLandmark68Net.loadFromUri(state.modelPath),
    faceapi.nets.faceRecognitionNet.loadFromUri(state.modelPath),
    faceapi.nets.faceExpressionNet.loadFromUri(state.modelPath)
  ]);
  
  console.log('Face-api models loaded successfully');
}

/**
 * Load vision models for recognition
 * 
 * @returns {Promise<void>}
 */
async function loadVisionModels() {
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:recognition:load_models');
  if (!hasPermission) {
    throw new Error('User does not have permission to load vision models for recognition');
  }
  
  console.log('Loading vision models for recognition');
  
  try {
    // Get models from training module
    const models = await training.getVisionModels();
    
    // Create labeled face descriptors for each model
    const labeledFaceDescriptors = [];
    
    for (const model of models) {
      try {
        // Get the full model data (this would normally come from storage)
        const storedModels = JSON.parse(localStorage.getItem(`alejo_vision_models_${state.userId}`)) || {};
        const fullModel = storedModels[model.id];
        
        if (fullModel && fullModel.descriptors) {
          const descriptors = fullModel.descriptors.map(d => new Float32Array(d));
          const labeledDescriptor = new faceapi.LabeledFaceDescriptors(model.id, descriptors);
          labeledFaceDescriptors.push(labeledDescriptor);
          
          // Store the model in our state
          state.models[model.id] = fullModel;
        }
      } catch (error) {
        console.error(`Failed to load model ${model.id}:`, error);
      }
    }
    
    // Create face matcher
    if (labeledFaceDescriptors.length > 0) {
      state.faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, state.recognitionThreshold);
      console.log(`Created face matcher with ${labeledFaceDescriptors.length} models`);
    } else {
      console.warn('No vision models available for recognition');
    }
  } catch (error) {
    console.error('Failed to load vision models:', error);
    throw error;
  }
}

/**
 * Register event handlers for user login/logout and security changes
 */
function registerEventHandlers() {
  // Handle user login
  EventBus.subscribe('user:login', handleUserLogin);
  
  // Handle user logout
  EventBus.subscribe('user:logout', handleUserLogout);
  
  // Handle security level changes
  EventBus.subscribe('security:level_changed', handleSecurityLevelChange);
  
  // Handle new vision model creation
  EventBus.subscribe('vision:training:model_created', handleModelCreated);
  
  // Handle vision model deletion
  EventBus.subscribe('vision:training:model_deleted', handleModelDeleted);
  
  console.log('Vision recognition event handlers registered');
}

/**
 * Handle user login events
 * 
 * @param {Object} data - Event data
 */
function handleUserLogin(data) {
  state.userId = data.userId;
  console.log('Vision recognition: User logged in:', state.userId);
  
  // Load vision models
  loadVisionModels()
    .catch(error => console.error('Failed to load vision models on login:', error));
}

/**
 * Handle user logout events
 */
function handleUserLogout() {
  // Clear any sensitive data
  state.userId = null;
  state.models = {};
  state.faceMatcher = null;
  state.currentSession = null;
  state.lastRecognitionResult = null;
  
  console.log('Vision recognition: User logged out, sensitive data cleared');
}

/**
 * Handle security level changes
 * 
 * @param {Object} data - Event data
 */
function handleSecurityLevelChange(data) {
  console.log('Vision recognition: Security level changed to', data.level);
  
  // Adjust behavior based on security level
  if (data.level === 'high') {
    // In high security mode, we require higher confidence
    state.recognitionThreshold = 0.4; // Lower threshold = stricter matching
    
    // Update face matcher if it exists
    if (state.faceMatcher) {
      state.faceMatcher = new faceapi.FaceMatcher(
        state.faceMatcher.labeledDescriptors,
        state.recognitionThreshold
      );
    }
  } else {
    // Reset to default
    state.recognitionThreshold = 0.6;
    
    // Update face matcher if it exists
    if (state.faceMatcher) {
      state.faceMatcher = new faceapi.FaceMatcher(
        state.faceMatcher.labeledDescriptors,
        state.recognitionThreshold
      );
    }
  }
}

/**
 * Handle model creation events
 * 
 * @param {Object} data - Event data
 */
function handleModelCreated(data) {
  console.log('Vision recognition: New model created:', data.modelId);
  
  // Reload vision models
  loadVisionModels()
    .catch(error => console.error('Failed to reload vision models after creation:', error));
}

/**
 * Handle model deletion events
 * 
 * @param {Object} data - Event data
 */
function handleModelDeleted(data) {
  console.log('Vision recognition: Model deleted:', data.modelId);
  
  // Remove from local state
  if (state.models[data.modelId]) {
    delete state.models[data.modelId];
  }
  
  // Reload face matcher
  loadVisionModels()
    .catch(error => console.error('Failed to reload vision models after deletion:', error));
}

/**
 * Start a recognition session
 * 
 * @param {Object} options - Recognition options
 * @param {string} options.mode - Recognition mode ('identify' or 'verify')
 * @param {string} options.targetModelId - Target model ID for verification mode
 * @returns {Promise<Object>} - Session information
 */
export async function startRecognitionSession(options = {}) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision recognition system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:recognition:start');
  if (!hasPermission) {
    throw new Error('User does not have permission to use vision recognition');
  }
  
  // Check if already in a recognition session
  if (state.recognizing) {
    throw new Error('Already in a vision recognition session');
  }
  
  // Validate options
  const mode = options.mode || 'identify';
  if (!['identify', 'verify'].includes(mode)) {
    throw new Error('Invalid recognition mode. Must be "identify" or "verify"');
  }
  
  // For verify mode, we need a target model ID
  if (mode === 'verify' && !options.targetModelId) {
    throw new Error('Target model ID is required for verification mode');
  }
  
  // Check if we have models loaded
  if (!state.faceMatcher) {
    throw new Error('No vision models available for recognition');
  }
  
  // Create a new session
  const sessionId = `vision_recognition_${Date.now()}`;
  state.currentSession = {
    id: sessionId,
    mode,
    targetModelId: options.targetModelId,
    startTime: new Date(),
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
    results: []
  };
  
  state.recognizing = true;
  
  // Log session start
  security.auditTrail.log('vision:recognition:session_started', {
    userId: state.userId,
    sessionId,
    mode,
    targetModelId: options.targetModelId,
    timestamp: new Date().toISOString()
  });
  
  // Publish event
  EventBus.publish('vision:recognition:session_started', {
    userId: state.userId,
    sessionId,
    mode
  });
  
  return {
    sessionId,
    mode,
    targetModelId: options.targetModelId,
    maxAttempts: state.currentSession.maxAttempts
  };
}

/**
 * Process an image for recognition
 * 
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageData} imageInput - Image input
 * @returns {Promise<Object>} - Recognition result
 */
export async function recognizeFace(imageInput) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision recognition system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:recognition:process');
  if (!hasPermission) {
    throw new Error('User does not have permission to process vision recognition');
  }
  
  // Check if we have models loaded
  if (!state.faceMatcher) {
    throw new Error('No vision models available for recognition');
  }
  
  try {
    // Detect faces in the image
    const detections = await faceapi
      .detectAllFaces(imageInput, new faceapi.SsdMobilenetv1Options(state.detectionOptions))
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    // If no faces detected
    if (detections.length === 0) {
      const result = {
        success: false,
        error: 'No face detected in the image',
        timestamp: new Date()
      };
      
      // Store the result
      state.lastRecognitionResult = result;
      
      // If in a session, add to session results
      if (state.recognizing && state.currentSession) {
        state.currentSession.attempts++;
        state.currentSession.results.push(result);
      }
      
      return result;
    }
    
    // If multiple faces detected
    if (detections.length > 1) {
      const result = {
        success: false,
        error: 'Multiple faces detected in the image',
        timestamp: new Date()
      };
      
      // Store the result
      state.lastRecognitionResult = result;
      
      // If in a session, add to session results
      if (state.recognizing && state.currentSession) {
        state.currentSession.attempts++;
        state.currentSession.results.push(result);
      }
      
      return result;
    }
    
    // Get the best match
    const detection = detections[0];
    const match = state.faceMatcher.findBestMatch(detection.descriptor);
    
    // Process the match result
    let result;
    
    if (state.recognizing && state.currentSession && state.currentSession.mode === 'verify') {
      // Verification mode - check if the match is the target model
      const isMatch = match.label === state.currentSession.targetModelId;
      const confidence = 1 - match.distance; // Convert distance to confidence
      
      result = {
        success: true,
        mode: 'verify',
        isMatch,
        confidence,
        targetModelId: state.currentSession.targetModelId,
        timestamp: new Date()
      };
      
      // Log verification result
      security.auditTrail.log('vision:recognition:verification_result', {
        userId: state.userId,
        sessionId: state.currentSession.id,
        isMatch,
        confidence,
        timestamp: new Date().toISOString()
      });
    } else {
      // Identification mode - return the best match
      const isUnknown = match.label === 'unknown';
      const confidence = 1 - match.distance; // Convert distance to confidence
      
      result = {
        success: true,
        mode: 'identify',
        isUnknown,
        modelId: isUnknown ? null : match.label,
        confidence,
        timestamp: new Date()
      };
      
      // Log identification result
      security.auditTrail.log('vision:recognition:identification_result', {
        userId: state.userId,
        sessionId: state.currentSession ? state.currentSession.id : 'no_session',
        isUnknown,
        modelId: isUnknown ? null : match.label,
        confidence,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store the result
    state.lastRecognitionResult = result;
    
    // If in a session, add to session results
    if (state.recognizing && state.currentSession) {
      state.currentSession.attempts++;
      state.currentSession.results.push(result);
    }
    
    // Publish event
    EventBus.publish('vision:recognition:result', {
      userId: state.userId,
      sessionId: state.currentSession ? state.currentSession.id : 'no_session',
      success: result.success,
      mode: result.mode,
      isMatch: result.isMatch,
      isUnknown: result.isUnknown,
      modelId: result.modelId,
      confidence: result.confidence
    });
    
    return result;
  } catch (error) {
    console.error('Error processing vision recognition:', error);
    
    const result = {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
    
    // Store the result
    state.lastRecognitionResult = result;
    
    // If in a session, add to session results
    if (state.recognizing && state.currentSession) {
      state.currentSession.attempts++;
      state.currentSession.results.push(result);
    }
    
    // Log error
    security.auditTrail.log('vision:recognition:error', {
      userId: state.userId,
      sessionId: state.currentSession ? state.currentSession.id : 'no_session',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
}

/**
 * Analyze facial expressions in an image
 * 
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageData} imageInput - Image input
 * @returns {Promise<Object>} - Expression analysis result
 */
export async function analyzeExpressions(imageInput) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision recognition system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:recognition:expressions');
  if (!hasPermission) {
    throw new Error('User does not have permission to analyze facial expressions');
  }
  
  try {
    // Detect faces and expressions in the image
    const detections = await faceapi
      .detectAllFaces(imageInput, new faceapi.SsdMobilenetv1Options(state.detectionOptions))
      .withFaceLandmarks()
      .withFaceExpressions();
    
    // If no faces detected
    if (detections.length === 0) {
      return {
        success: false,
        error: 'No face detected in the image',
        timestamp: new Date()
      };
    }
    
    // Get expressions from the first face
    const expressions = detections[0].expressions;
    
    // Find the dominant expression
    let dominantExpression = null;
    let highestScore = 0;
    
    for (const [expression, score] of Object.entries(expressions)) {
      if (score > highestScore) {
        highestScore = score;
        dominantExpression = expression;
      }
    }
    
    const result = {
      success: true,
      expressions,
      dominant: dominantExpression,
      dominantScore: highestScore,
      timestamp: new Date()
    };
    
    // Log expression analysis
    security.auditTrail.log('vision:recognition:expression_analysis', {
      userId: state.userId,
      dominant: dominantExpression,
      dominantScore: highestScore,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    console.error('Error analyzing facial expressions:', error);
    
    // Log error
    security.auditTrail.log('vision:recognition:expression_error', {
      userId: state.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * End the current recognition session
 * 
 * @returns {Promise<Object>} - Session results
 */
export async function endRecognitionSession() {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision recognition system not initialized');
  }
  
  // Check if in a recognition session
  if (!state.recognizing || !state.currentSession) {
    throw new Error('Not in a vision recognition session');
  }
  
  try {
    // Prepare session summary
    const sessionSummary = {
      id: state.currentSession.id,
      mode: state.currentSession.mode,
      targetModelId: state.currentSession.targetModelId,
      startTime: state.currentSession.startTime,
      endTime: new Date(),
      attempts: state.currentSession.attempts,
      results: state.currentSession.results
    };
    
    // Determine overall success based on the mode
    if (state.currentSession.mode === 'verify') {
      // For verification, check if any result matched the target
      const successfulMatch = state.currentSession.results.some(
        result => result.success && result.isMatch
      );
      
      sessionSummary.success = successfulMatch;
      
      // Get the best match (highest confidence)
      const successfulResults = state.currentSession.results.filter(
        result => result.success && result.isMatch
      );
      
      if (successfulResults.length > 0) {
        sessionSummary.bestMatch = successfulResults.reduce(
          (best, current) => current.confidence > best.confidence ? current : best,
          successfulResults[0]
        );
      }
    } else {
      // For identification, check if any result identified a model
      const successfulIdentification = state.currentSession.results.some(
        result => result.success && !result.isUnknown
      );
      
      sessionSummary.success = successfulIdentification;
      
      // Get the best match (highest confidence)
      const successfulResults = state.currentSession.results.filter(
        result => result.success && !result.isUnknown
      );
      
      if (successfulResults.length > 0) {
        sessionSummary.bestMatch = successfulResults.reduce(
          (best, current) => current.confidence > best.confidence ? current : best,
          successfulResults[0]
        );
      }
    }
    
    // Log session end
    security.auditTrail.log('vision:recognition:session_ended', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      success: sessionSummary.success,
      attempts: state.currentSession.attempts,
      timestamp: new Date().toISOString()
    });
    
    // Publish event
    EventBus.publish('vision:recognition:session_ended', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      success: sessionSummary.success
    });
    
    // Reset session state
    const result = { ...sessionSummary };
    state.currentSession = null;
    state.recognizing = false;
    
    return result;
  } catch (error) {
    console.error('Error ending vision recognition session:', error);
    
    // Log error
    security.auditTrail.log('vision:recognition:session_error', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Reset session state on error
    state.currentSession = null;
    state.recognizing = false;
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the last recognition result
 * 
 * @returns {Object|null} - Last recognition result or null if none
 */
export function getLastRecognitionResult() {
  return state.lastRecognitionResult;
}

/**
 * Get the current recognition session status
 * 
 * @returns {Object|null} - Current session status or null if not in a session
 */
export function getRecognitionSessionStatus() {
  if (!state.recognizing || !state.currentSession) {
    return null;
  }
  
  return {
    sessionId: state.currentSession.id,
    mode: state.currentSession.mode,
    targetModelId: state.currentSession.targetModelId,
    startTime: state.currentSession.startTime,
    attempts: state.currentSession.attempts,
    maxAttempts: state.currentSession.maxAttempts,
    results: state.currentSession.results
  };
}

/**
 * Check if the vision recognition system is initialized
 * 
 * @returns {boolean} - Whether the system is initialized
 */
export function isInitialized() {
  return state.initialized;
}

/**
 * Check if a recognition session is in progress
 * 
 * @returns {boolean} - Whether a recognition session is in progress
 */
export function isRecognizing() {
  return state.recognizing;
}

// Export the module
export default {
  initialize,
  startRecognitionSession,
  recognizeFace,
  analyzeExpressions,
  endRecognitionSession,
  getLastRecognitionResult,
  getRecognitionSessionStatus,
  isInitialized,
  isRecognizing
};
