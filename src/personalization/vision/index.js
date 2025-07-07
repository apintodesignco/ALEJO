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
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';

/**
 * Initialize the ALEJO Vision System
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID for the current session
 * @param {string} options.modelPath - Path to face-api models
 * @param {boolean} options.loadExistingModels - Whether to load existing models
 * @param {Object} options.detectionOptions - Options for face detection
 * @param {boolean} [options.enableResourceManagement=true] - Whether to register with Resource Allocation Manager
 * @param {boolean} [options.accessibilityPriority=true] - Whether accessibility components have higher priority
 * @returns {Promise<Object>} - Initialization results
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Vision System');
  
  const results = {
    training: false,
    recognition: false,
    faceModel: false,
    expressionDetection: false,
    trainingUI: false,
    resourceManagement: false
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
  
  // Register with Resource Allocation Manager if enabled
  if (options.enableResourceManagement !== false) {
    try {
      results.resourceManagement = registerWithResourceManager({
        accessibilityPriority: options.accessibilityPriority !== false
      });
    } catch (error) {
      console.error('Failed to register vision system with Resource Allocation Manager:', error);
    }
  }
  
  return {
    success: Object.values(results).some(result => result === true),
    results
  };
}

/**
 * Shutdown the vision system and release resources
 */
export async function shutdown() {
  console.log('Shutting down ALEJO Vision System');
  
  // Unregister from Resource Allocation Manager
  unregisterFromResourceManager();
  
  // Shutdown individual modules
  try {
    if (typeof training.shutdown === 'function') await training.shutdown();
    if (typeof recognition.shutdown === 'function') await recognition.shutdown();
    if (faceModel && typeof faceModel.shutdown === 'function') await faceModel.shutdown();
    if (expressionDetection && typeof expressionDetection.shutdown === 'function') await expressionDetection.shutdown();
  } catch (error) {
    console.error('Error during vision system shutdown:', error);
  }
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
  shutdown,
  training,
  recognition,
  faceModel,
  expressionDetection,
  trainingUI
};
