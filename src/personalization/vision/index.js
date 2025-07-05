/**
 * ALEJO Vision System
 * 
 * This module serves as the main entry point for ALEJO's vision system,
 * providing a unified interface to the vision training, recognition,
 * face model, and expression detection components.
 */

import * as training from './training.js';
import * as recognition from './recognition.js';
import { faceModel } from './face-model.js';
import { expressionDetection } from './expression.js';
import { trainingUI } from './training-ui.js';

/**
 * Initialize the ALEJO Vision System
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID for the current session
 * @param {string} options.modelPath - Path to face-api models
 * @param {boolean} options.loadExistingModels - Whether to load existing models
 * @param {Object} options.detectionOptions - Options for face detection
 * @returns {Promise<Object>} - Initialization results
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Vision System');
  
  const results = {
    training: false,
    recognition: false,
    faceModel: false,
    expressionDetection: false,
    trainingUI: false
  };
  
  // Initialize training module
  try {
    results.training = await training.initialize(options);
  } catch (error) {
    console.error('Failed to initialize vision training:', error);
  }
  
  // Initialize recognition module
  try {
    results.recognition = await recognition.initialize(options);
  } catch (error) {
    console.error('Failed to initialize vision recognition:', error);
  }
  
  // Initialize face model
  try {
    results.faceModel = await faceModel.initialize(options);
  } catch (error) {
    console.error('Failed to initialize face model:', error);
  }
  
  // Initialize expression detection
  try {
    results.expressionDetection = await expressionDetection.initialize(options);
  } catch (error) {
    console.error('Failed to initialize expression detection:', error);
  }
  
  // Initialize training UI (if needed)
  if (options.initializeUI !== false) {
    try {
      // Note: trainingUI.initialize requires specific DOM elements
      // We don't call it here directly, but mark it as available
      results.trainingUI = true;
    } catch (error) {
      console.error('Failed to initialize vision training UI:', error);
    }
  }
  
  return {
    success: Object.values(results).some(result => result === true),
    results
  };
}

// Export individual modules for direct access
export {
  training,
  recognition,
  faceModel,
  expressionDetection,
  trainingUI
};

// Default export for the entire vision system
export default {
  initialize,
  training,
  recognition,
  faceModel,
  expressionDetection,
  trainingUI
};
