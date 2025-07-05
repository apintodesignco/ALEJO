/**
 * ALEJO Fusion Integration Index
 * 
 * This module serves as the unified entry point for ALEJO's fusion integration systems,
 * providing access to multimodal fusion components that combine different input modalities
 * into a coherent understanding.
 * 
 * @module integration/fusion
 */

import { eventBus } from '../../core/event-bus.js';
import { auditTrail } from '../../security/audit-trail.js';
import { multimodalMerge } from './multimodal-merge.js';
import { contextEngine } from './context-engine.js';
import { visionVoiceFusion } from './vision-voice-fusion.js';

/**
 * Initialize all fusion components
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Initialization results for each component
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Fusion Integration System');
  
  const results = {
    multimodalMerge: false,
    contextEngine: false,
    visionVoiceFusion: false
  };
  
  // Initialize multimodal merge
  try {
    results.multimodalMerge = await multimodalMerge.initialize(options);
  } catch (error) {
    console.error('Failed to initialize multimodal merge:', error);
  }
  
  // Initialize context engine
  try {
    results.contextEngine = await contextEngine.initialize(options);
  } catch (error) {
    console.error('Failed to initialize context engine:', error);
  }
  
  // Initialize vision-voice fusion
  try {
    results.visionVoiceFusion = await visionVoiceFusion.initialize(options);
  } catch (error) {
    console.error('Failed to initialize vision-voice fusion:', error);
  }
  
  const success = Object.values(results).some(result => result === true);
  
  auditTrail.log('fusion_system_initialized', {
    success,
    results
  });
  
  eventBus.emit('fusion_system_initialized', {
    success,
    results
  });
  
  return {
    success,
    results
  };
}

/**
 * Shutdown all fusion components
 * @returns {Promise<Object>} - Shutdown results for each component
 */
export async function shutdown() {
  console.log('Shutting down ALEJO Fusion Integration System');
  
  const results = {
    multimodalMerge: false,
    contextEngine: false,
    visionVoiceFusion: false
  };
  
  // Shutdown multimodal merge
  try {
    results.multimodalMerge = await multimodalMerge.shutdown();
  } catch (error) {
    console.error('Failed to shutdown multimodal merge:', error);
  }
  
  // Shutdown context engine
  try {
    results.contextEngine = await contextEngine.shutdown();
  } catch (error) {
    console.error('Failed to shutdown context engine:', error);
  }
  
  // Shutdown vision-voice fusion
  try {
    results.visionVoiceFusion = await visionVoiceFusion.shutdown();
  } catch (error) {
    console.error('Failed to shutdown vision-voice fusion:', error);
  }
  
  auditTrail.log('fusion_system_shutdown', {
    results
  });
  
  eventBus.emit('fusion_system_shutdown', {
    results
  });
  
  return results;
}

// Export fusion components
export {
  multimodalMerge,
  contextEngine,
  visionVoiceFusion
};
