/**
 * ALEJO Voice System Index
 * 
 * This module exports all voice-related components:
 * - Training: Voice pattern capture and model creation
 * - Recognition: Voice identification and authentication
 * - Synthesis: Voice output and style adaptation
 * - Advanced Features: Neural voice embedding, emotion analysis, and adaptive learning
 */

import * as training from './training.js';
import * as recognition from './recognition.js';
import * as synthesis from './synthesis.js';
import * as advancedFeatures from './advanced-features.js';
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';

/**
 * Initialize the complete voice system
 * @param {Object} options - Initialization options
 * @param {boolean} [options.enableResourceManagement=true] - Whether to register with Resource Allocation Manager
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Voice System');
  
  const results = {
    training: false,
    recognition: false,
    synthesis: false,
    advancedFeatures: false,
    resourceManagement: false
  };
  
  // Initialize training module
  try {
    results.training = await training.initialize(options);
  } catch (error) {
    console.error('Failed to initialize voice training:', error);
  }
  
  // Initialize recognition module
  try {
    results.recognition = await recognition.initialize(options);
  } catch (error) {
    console.error('Failed to initialize voice recognition:', error);
  }
  
  // Initialize synthesis module
  try {
    results.synthesis = await synthesis.initialize(options);
  } catch (error) {
    console.error('Failed to initialize voice synthesis:', error);
  }
  
  // Initialize advanced features module
  try {
    results.advancedFeatures = await advancedFeatures.initialize(options);
  } catch (error) {
    console.error('Failed to initialize advanced voice features:', error);
  }
  
  // Register with Resource Allocation Manager if enabled
  if (options.enableResourceManagement !== false) {
    try {
      results.resourceManagement = registerWithResourceManager(options);
    } catch (error) {
      console.error('Failed to register voice system with Resource Allocation Manager:', error);
    }
  }
  
  return {
    success: results.training || results.recognition || results.synthesis || results.advancedFeatures,
    results
  };
}

/**
 * Shutdown the voice system and release resources
 */
export async function shutdown() {
  console.log('Shutting down ALEJO Voice System');
  
  // Unregister from Resource Allocation Manager
  unregisterFromResourceManager();
  
  // Shutdown individual modules
  try {
    if (typeof training.shutdown === 'function') await training.shutdown();
    if (typeof recognition.shutdown === 'function') await recognition.shutdown();
    if (typeof synthesis.shutdown === 'function') await synthesis.shutdown();
    if (typeof advancedFeatures.shutdown === 'function') await advancedFeatures.shutdown();
  } catch (error) {
    console.error('Error during voice system shutdown:', error);
  }
}

// Export all modules
export { 
  training,
  recognition,
  advancedFeatures,
  synthesis
};
