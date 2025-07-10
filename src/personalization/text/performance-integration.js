/**
 * Text Processing Module - Performance Integration
 * 
 * Handles registration and integration with ALEJO's Resource Allocation Manager.
 * Follows the standard pattern used across ALEJO for resource management.
 */

import { 
  registerComponent, 
  unregisterComponent,
  ResourcePriority,
  ResourceMode,
  subscribeToResourceModeChange
} from '../../performance/resource-manager.js';

// Component IDs for the text processing module
export const TEXT_COMPONENTS = {
  TEXT_PROCESSOR: 'text-processor',
  NLU_ENGINE: 'natural-language-understanding-engine',
  CONVERSATION_CONTEXT: 'conversation-context-manager',
  RESPONSE_GENERATOR: 'response-generator'
};

// Track registration status
let isRegistered = false;
const registrations = {};

// Track current resource mode
let currentResourceMode = ResourceMode.NORMAL;

/**
 * Register the text processing module with the Resource Allocation Manager
 * @param {Object} options - Configuration options
 * @returns {boolean} Registration success
 */
export function registerWithResourceManager(options = {}) {
  if (isRegistered) {
    console.warn('Text processing module already registered with Resource Allocation Manager');
    return true;
  }

  try {
    // Register the main text processor
    registrations[TEXT_COMPONENTS.TEXT_PROCESSOR] = registerComponent({
      componentId: TEXT_COMPONENTS.TEXT_PROCESSOR,
      priority: ResourcePriority.MEDIUM,
      category: 'personalization',
      description: 'Text processing main module',
      adaptiveFeatures: true,
      isAccessibilityComponent: true
    });

    // Register the NLU engine
    registrations[TEXT_COMPONENTS.NLU_ENGINE] = registerComponent({
      componentId: TEXT_COMPONENTS.NLU_ENGINE,
      priority: ResourcePriority.MEDIUM,
      category: 'personalization',
      description: 'Natural Language Understanding engine',
      adaptiveFeatures: true,
      isAccessibilityComponent: true
    });

    // Register the conversation context manager
    registrations[TEXT_COMPONENTS.CONVERSATION_CONTEXT] = registerComponent({
      componentId: TEXT_COMPONENTS.CONVERSATION_CONTEXT,
      priority: ResourcePriority.HIGH, // Context is critical for conversation continuity
      category: 'personalization',
      description: 'Multi-turn conversation context manager',
      adaptiveFeatures: false, // Context must be maintained regardless of resource mode
      isAccessibilityComponent: true
    });

    // Register the response generator
    registrations[TEXT_COMPONENTS.RESPONSE_GENERATOR] = registerComponent({
      componentId: TEXT_COMPONENTS.RESPONSE_GENERATOR,
      priority: ResourcePriority.MEDIUM,
      category: 'personalization',
      description: 'Context-aware response generator',
      adaptiveFeatures: true,
      isAccessibilityComponent: true
    });

    // Subscribe to resource mode changes
    subscribeToResourceModeChange(handleResourceModeChange);

    isRegistered = true;
    console.log('Text processing module registered with Resource Allocation Manager');
    return true;
  } catch (error) {
    console.error('Failed to register text processing module with Resource Allocation Manager:', error);
    return false;
  }
}

/**
 * Unregister the text processing module from the Resource Allocation Manager
 */
export function unregisterFromResourceManager() {
  if (!isRegistered) return;

  try {
    // Unregister all components
    Object.values(registrations).forEach(registration => {
      if (registration && typeof registration.unregister === 'function') {
        registration.unregister();
      }
    });

    isRegistered = false;
    console.log('Text processing module unregistered from Resource Allocation Manager');
  } catch (error) {
    console.error('Error unregistering text processing module:', error);
  }
}

/**
 * Handle resource mode changes
 * @param {Object} data - Resource mode change data
 */
function handleResourceModeChange(data) {
  const { newMode } = data;
  currentResourceMode = newMode;

  console.log(`Text processing module adapting to resource mode: ${newMode}`);

  switch (newMode) {
    case ResourceMode.LOW:
      // Reduce complexity of text processing
      // Simplify NLU operations
      // Limit response generation options
      break;

    case ResourceMode.NORMAL:
      // Standard operation
      break;

    case ResourceMode.HIGH:
      // Enable advanced features
      // Use more complex NLU models
      // Enable richer response generation
      break;

    case ResourceMode.CRITICAL:
      // Minimize processing to essential functions only
      // Prioritize accessibility-related text processing
      // Disable non-essential features
      break;
  }
}

/**
 * Get the current resource mode
 * @returns {string} Current resource mode
 */
export function getCurrentResourceMode() {
  return currentResourceMode;
}
