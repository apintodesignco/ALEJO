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

/**
 * Initialize the complete voice system
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Voice System');
  
  const results = {
    training: false,
    recognition: false,
    synthesis: false,
    advancedFeatures: false
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
  
  return {
    success: results.training || results.recognition || results.synthesis || results.advancedFeatures,
    results
  };
}

// Export all modules
export { 
  training,
  recognition,
  advancedFeatures,
  synthesis
};
