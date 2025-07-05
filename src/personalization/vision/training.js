/**
 * ALEJO Vision Training Module
 * 
 * This module handles the training of vision models for facial recognition,
 * expression detection, and other vision-based personalization features.
 * 
 * It integrates with ALEJO's security layer for permission management and
 * audit logging, and provides a comprehensive API for vision training.
 */

import * as security from '../../security/index.js';
import * as faceapi from '@vladmandic/face-api';
import { EventBus } from '../../core/event-bus.js';

// Module state
const state = {
  initialized: false,
  training: false,
  currentSession: null,
  models: {},
  detectionOptions: null,
  securityInitialized: false,
  userId: null,
  eventHandlersRegistered: false,
  trainingData: {},
  modelPath: './models'
};

/**
 * Initialize the vision training module
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID for the current session
 * @param {string} options.modelPath - Path to face-api models
 * @param {boolean} options.loadExistingModels - Whether to load existing models
 * @param {Object} options.detectionOptions - Options for face detection
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
export async function initialize(options = {}) {
  try {
    console.log('Initializing ALEJO Vision Training System');
    
    // Initialize security first
    try {
      state.securityInitialized = await security.initialize(options);
      state.userId = options.userId || security.getCurrentUserId();
      
      // Log initialization in audit trail
      security.auditTrail.log('vision:training:initialization', {
        userId: state.userId,
        timestamp: new Date().toISOString(),
        options: JSON.stringify(options)
      });
    } catch (error) {
      console.error('Failed to initialize security for vision training:', error);
      return false;
    }
    
    // Set up configuration
    state.modelPath = options.modelPath || state.modelPath;
    
    // Set up face detection options
    state.detectionOptions = {
      scoreThreshold: 0.5,
      inputSize: 224,
      ...options.detectionOptions
    };
    
    // Load face-api models
    try {
      await loadModels();
    } catch (error) {
      console.error('Failed to load face-api models:', error);
      security.auditTrail.log('vision:training:model_load_failed', {
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
    
    // Load existing models if requested
    if (options.loadExistingModels) {
      try {
        await loadExistingModels();
      } catch (error) {
        console.warn('Failed to load existing vision models:', error);
        // Non-critical error, continue initialization
      }
    }
    
    state.initialized = true;
    
    // Log successful initialization
    security.auditTrail.log('vision:training:initialized', {
      userId: state.userId,
      timestamp: new Date().toISOString(),
      success: true
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize vision training:', error);
    security.auditTrail.log('vision:training:initialization_failed', {
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
 * Load existing vision models for the current user
 * 
 * @returns {Promise<void>}
 */
async function loadExistingModels() {
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:load_models');
  if (!hasPermission) {
    throw new Error('User does not have permission to load vision models');
  }
  
  // In a real implementation, this would load models from storage
  // For now, we'll just log the attempt
  console.log('Loading existing vision models for user:', state.userId);
  
  // Mock implementation - in a real app, this would load from IndexedDB or server
  try {
    const storedModels = localStorage.getItem(`alejo_vision_models_${state.userId}`);
    if (storedModels) {
      state.models = JSON.parse(storedModels);
      console.log(`Loaded ${Object.keys(state.models).length} vision models`);
    }
  } catch (error) {
    console.error('Failed to load stored vision models:', error);
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
  
  console.log('Vision training event handlers registered');
}

/**
 * Handle user login events
 * 
 * @param {Object} data - Event data
 */
function handleUserLogin(data) {
  state.userId = data.userId;
  console.log('Vision training: User logged in:', state.userId);
  
  // Load user's vision models
  loadExistingModels()
    .catch(error => console.error('Failed to load vision models on login:', error));
}

/**
 * Handle user logout events
 */
function handleUserLogout() {
  // Clear any sensitive data
  state.userId = null;
  state.models = {};
  state.currentSession = null;
  
  console.log('Vision training: User logged out, sensitive data cleared');
}

/**
 * Handle security level changes
 * 
 * @param {Object} data - Event data
 */
function handleSecurityLevelChange(data) {
  console.log('Vision training: Security level changed to', data.level);
  
  // Adjust behavior based on security level
  if (data.level === 'high') {
    // In high security mode, we might want to require additional verification
    state.detectionOptions.scoreThreshold = 0.7; // Higher threshold for more confidence
  } else {
    // Reset to default
    state.detectionOptions.scoreThreshold = 0.5;
  }
}

/**
 * Start a new vision training session
 * 
 * @param {Object} options - Training session options
 * @param {string} options.modelName - Name for the vision model
 * @param {number} options.requiredSamples - Number of samples required for training
 * @param {boolean} options.includeExpressions - Whether to include expression detection
 * @returns {Promise<Object>} - Session information
 */
export async function startTrainingSession(options = {}) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:create');
  if (!hasPermission) {
    throw new Error('User does not have permission to create vision models');
  }
  
  // Check if already in a training session
  if (state.training) {
    throw new Error('Already in a vision training session');
  }
  
  // Create a new session
  const sessionId = `vision_session_${Date.now()}`;
  state.currentSession = {
    id: sessionId,
    modelName: options.modelName || `vision_model_${Date.now()}`,
    startTime: new Date(),
    samples: [],
    requiredSamples: options.requiredSamples || 5,
    includeExpressions: options.includeExpressions !== false,
    descriptors: [],
    expressions: [],
    complete: false
  };
  
  state.training = true;
  
  // Log session start
  security.auditTrail.log('vision:training:session_started', {
    userId: state.userId,
    sessionId,
    modelName: state.currentSession.modelName,
    timestamp: new Date().toISOString(),
    requiredSamples: state.currentSession.requiredSamples
  });
  
  // Publish event
  EventBus.publish('vision:training:session_started', {
    userId: state.userId,
    sessionId,
    requiredSamples: state.currentSession.requiredSamples
  });
  
  return {
    sessionId,
    modelName: state.currentSession.modelName,
    requiredSamples: state.currentSession.requiredSamples,
    includeExpressions: state.currentSession.includeExpressions
  };
}

/**
 * Process an image for the current training session
 * 
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageData} imageInput - Image input
 * @param {Object} options - Processing options
 * @param {string} options.expression - Optional expression label for this sample
 * @returns {Promise<Object>} - Processing result
 */
export async function processTrainingSample(imageInput, options = {}) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check if in a training session
  if (!state.training || !state.currentSession) {
    throw new Error('Not in a vision training session');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:process');
  if (!hasPermission) {
    throw new Error('User does not have permission to process vision samples');
  }
  
  try {
    // Detect faces in the image
    const detections = await faceapi
      .detectAllFaces(imageInput, new faceapi.SsdMobilenetv1Options(state.detectionOptions))
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    // If no faces detected
    if (detections.length === 0) {
      return {
        success: false,
        error: 'No face detected in the image',
        samplesCollected: state.currentSession.samples.length,
        samplesRequired: state.currentSession.requiredSamples
      };
    }
    
    // If multiple faces detected
    if (detections.length > 1) {
      return {
        success: false,
        error: 'Multiple faces detected in the image',
        samplesCollected: state.currentSession.samples.length,
        samplesRequired: state.currentSession.requiredSamples
      };
    }
    
    // Get the face descriptor
    const descriptor = Array.from(detections[0].descriptor);
    
    // Get expressions if requested
    let expressions = null;
    if (state.currentSession.includeExpressions) {
      const expressionResults = await faceapi
        .detectAllFaces(imageInput, new faceapi.SsdMobilenetv1Options(state.detectionOptions))
        .withFaceExpressions();
      
      if (expressionResults.length > 0) {
        expressions = expressionResults[0].expressions;
      }
    }
    
    // Add the sample to the session
    state.currentSession.samples.push({
      timestamp: new Date(),
      descriptor,
      expressions,
      customExpression: options.expression || null
    });
    
    state.currentSession.descriptors.push(descriptor);
    
    if (expressions) {
      state.currentSession.expressions.push({
        detected: expressions,
        custom: options.expression || null
      });
    }
    
    // Log sample collection
    security.auditTrail.log('vision:training:sample_collected', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      timestamp: new Date().toISOString(),
      sampleIndex: state.currentSession.samples.length,
      hasExpressions: !!expressions
    });
    
    // Publish event
    EventBus.publish('vision:training:sample_collected', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      samplesCollected: state.currentSession.samples.length,
      samplesRequired: state.currentSession.requiredSamples
    });
    
    return {
      success: true,
      samplesCollected: state.currentSession.samples.length,
      samplesRequired: state.currentSession.requiredSamples,
      progress: state.currentSession.samples.length / state.currentSession.requiredSamples,
      complete: state.currentSession.samples.length >= state.currentSession.requiredSamples
    };
  } catch (error) {
    console.error('Error processing vision training sample:', error);
    
    // Log error
    security.auditTrail.log('vision:training:sample_processing_error', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      samplesCollected: state.currentSession.samples.length,
      samplesRequired: state.currentSession.requiredSamples
    };
  }
}

/**
 * End the current training session and create a vision model
 * 
 * @param {boolean} save - Whether to save the model
 * @returns {Promise<Object>} - Result of the training session
 */
export async function endTrainingSession(save = true) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check if in a training session
  if (!state.training || !state.currentSession) {
    throw new Error('Not in a vision training session');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:save');
  if (!hasPermission && save) {
    throw new Error('User does not have permission to save vision models');
  }
  
  try {
    // Check if we have enough samples
    if (state.currentSession.samples.length < state.currentSession.requiredSamples) {
      return {
        success: false,
        error: `Not enough samples collected. Required: ${state.currentSession.requiredSamples}, Collected: ${state.currentSession.samples.length}`,
        sessionId: state.currentSession.id
      };
    }
    
    // Create the vision model
    const modelId = `vision_model_${Date.now()}`;
    const model = {
      id: modelId,
      name: state.currentSession.modelName,
      userId: state.userId,
      createdAt: new Date(),
      descriptors: state.currentSession.descriptors,
      expressions: state.currentSession.includeExpressions ? state.currentSession.expressions : null,
      labeledFaceDescriptors: new faceapi.LabeledFaceDescriptors(
        state.userId,
        state.currentSession.descriptors.map(d => new Float32Array(d))
      )
    };
    
    // Save the model if requested
    if (save) {
      state.models[modelId] = model;
      
      // In a real implementation, this would save to IndexedDB or server
      // For now, we'll just save to localStorage as a demonstration
      try {
        localStorage.setItem(`alejo_vision_models_${state.userId}`, JSON.stringify(state.models));
      } catch (error) {
        console.error('Failed to save vision model to localStorage:', error);
      }
      
      // Log model creation
      security.auditTrail.log('vision:training:model_created', {
        userId: state.userId,
        sessionId: state.currentSession.id,
        modelId,
        modelName: model.name,
        timestamp: new Date().toISOString(),
        sampleCount: state.currentSession.samples.length
      });
    }
    
    // Clean up the session
    const sessionSummary = {
      id: state.currentSession.id,
      modelId: save ? modelId : null,
      modelName: state.currentSession.modelName,
      startTime: state.currentSession.startTime,
      endTime: new Date(),
      sampleCount: state.currentSession.samples.length,
      includeExpressions: state.currentSession.includeExpressions,
      saved: save
    };
    
    // Reset session state
    state.currentSession = null;
    state.training = false;
    
    // Publish event
    EventBus.publish('vision:training:session_completed', {
      userId: state.userId,
      sessionId: sessionSummary.id,
      modelId: sessionSummary.modelId,
      saved: save
    });
    
    return {
      success: true,
      modelId: save ? modelId : null,
      sessionSummary
    };
  } catch (error) {
    console.error('Error ending vision training session:', error);
    
    // Log error
    security.auditTrail.log('vision:training:session_error', {
      userId: state.userId,
      sessionId: state.currentSession.id,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    // Reset session state on error
    state.currentSession = null;
    state.training = false;
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get a list of vision models for the current user
 * 
 * @returns {Promise<Array>} - List of vision models
 */
export async function getVisionModels() {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:list_models');
  if (!hasPermission) {
    throw new Error('User does not have permission to list vision models');
  }
  
  // Return models without sensitive data
  return Object.values(state.models).map(model => ({
    id: model.id,
    name: model.name,
    createdAt: model.createdAt,
    hasExpressions: !!model.expressions,
    sampleCount: model.descriptors.length
  }));
}

/**
 * Delete a vision model
 * 
 * @param {string} modelId - ID of the model to delete
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
export async function deleteVisionModel(modelId) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:delete');
  if (!hasPermission) {
    throw new Error('User does not have permission to delete vision models');
  }
  
  // Check if the model exists
  if (!state.models[modelId]) {
    throw new Error(`Vision model ${modelId} not found`);
  }
  
  // Delete the model
  delete state.models[modelId];
  
  // Update storage
  try {
    localStorage.setItem(`alejo_vision_models_${state.userId}`, JSON.stringify(state.models));
  } catch (error) {
    console.error('Failed to update localStorage after model deletion:', error);
    return false;
  }
  
  // Log deletion
  security.auditTrail.log('vision:training:model_deleted', {
    userId: state.userId,
    modelId,
    timestamp: new Date().toISOString()
  });
  
  // Publish event
  EventBus.publish('vision:training:model_deleted', {
    userId: state.userId,
    modelId
  });
  
  return true;
}

/**
 * Export a vision model for backup or transfer
 * 
 * @param {string} modelId - ID of the model to export
 * @returns {Promise<Object>} - Exported model data
 */
export async function exportVisionModel(modelId) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:export');
  if (!hasPermission) {
    throw new Error('User does not have permission to export vision models');
  }
  
  // Check if the model exists
  if (!state.models[modelId]) {
    throw new Error(`Vision model ${modelId} not found`);
  }
  
  // Create a safe export version (without methods)
  const model = state.models[modelId];
  const exportData = {
    id: model.id,
    name: model.name,
    userId: model.userId,
    createdAt: model.createdAt,
    descriptors: model.descriptors,
    expressions: model.expressions,
    exportedAt: new Date(),
    version: '1.0'
  };
  
  // Log export
  security.auditTrail.log('vision:training:model_exported', {
    userId: state.userId,
    modelId,
    timestamp: new Date().toISOString()
  });
  
  return exportData;
}

/**
 * Import a vision model from exported data
 * 
 * @param {Object} exportData - Exported model data
 * @returns {Promise<Object>} - Import result
 */
export async function importVisionModel(exportData) {
  // Ensure the module is initialized
  if (!state.initialized) {
    throw new Error('Vision training system not initialized');
  }
  
  // Check permissions
  const hasPermission = await security.hasPermission(state.userId, 'vision:training:import');
  if (!hasPermission) {
    throw new Error('User does not have permission to import vision models');
  }
  
  // Validate export data
  if (!exportData || !exportData.id || !exportData.descriptors) {
    throw new Error('Invalid vision model export data');
  }
  
  try {
    // Create a new model ID to avoid conflicts
    const modelId = `vision_model_import_${Date.now()}`;
    
    // Create the model
    const model = {
      id: modelId,
      name: exportData.name || `Imported ${new Date().toLocaleDateString()}`,
      userId: state.userId, // Always use current user ID
      createdAt: new Date(),
      importedAt: new Date(),
      originalId: exportData.id,
      descriptors: exportData.descriptors,
      expressions: exportData.expressions,
      labeledFaceDescriptors: new faceapi.LabeledFaceDescriptors(
        state.userId,
        exportData.descriptors.map(d => new Float32Array(d))
      )
    };
    
    // Save the model
    state.models[modelId] = model;
    
    // Update storage
    try {
      localStorage.setItem(`alejo_vision_models_${state.userId}`, JSON.stringify(state.models));
    } catch (error) {
      console.error('Failed to save imported vision model to localStorage:', error);
    }
    
    // Log import
    security.auditTrail.log('vision:training:model_imported', {
      userId: state.userId,
      modelId,
      originalId: exportData.id,
      timestamp: new Date().toISOString()
    });
    
    // Publish event
    EventBus.publish('vision:training:model_imported', {
      userId: state.userId,
      modelId
    });
    
    return {
      success: true,
      modelId,
      name: model.name
    };
  } catch (error) {
    console.error('Error importing vision model:', error);
    
    // Log error
    security.auditTrail.log('vision:training:import_error', {
      userId: state.userId,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the current training session status
 * 
 * @returns {Object|null} - Current session status or null if not in a session
 */
export function getTrainingSessionStatus() {
  if (!state.training || !state.currentSession) {
    return null;
  }
  
  return {
    sessionId: state.currentSession.id,
    modelName: state.currentSession.modelName,
    startTime: state.currentSession.startTime,
    samplesCollected: state.currentSession.samples.length,
    samplesRequired: state.currentSession.requiredSamples,
    progress: state.currentSession.samples.length / state.currentSession.requiredSamples,
    includeExpressions: state.currentSession.includeExpressions
  };
}

/**
 * Check if the vision training system is initialized
 * 
 * @returns {boolean} - Whether the system is initialized
 */
export function isInitialized() {
  return state.initialized;
}

/**
 * Check if a training session is in progress
 * 
 * @returns {boolean} - Whether a training session is in progress
 */
export function isTraining() {
  return state.training;
}

// Export the module
export default {
  initialize,
  startTrainingSession,
  processTrainingSample,
  endTrainingSession,
  getVisionModels,
  deleteVisionModel,
  exportVisionModel,
  importVisionModel,
  getTrainingSessionStatus,
  isInitialized,
  isTraining
};
