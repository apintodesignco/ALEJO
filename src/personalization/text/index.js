/**
 * ALEJO Text Processing Module
 * 
 * Main entry point for the text processing module.
 * Integrates natural language understanding, conversation context
 * management, and response generation for text-based interactions.
 * 
 * This module provides:
 * - Natural language understanding (intent detection, entity extraction)
 * - Context-aware multi-turn conversation
 * - Reference resolution (pronouns, implied subjects)
 * - Context-sensitive response generation
 * 
 * All processing is done locally without external API dependencies,
 * following ALEJO's core principles.
 */

import { EventBus } from '../../core/event-bus.js';
import { 
  registerWithResourceManager, 
  unregisterFromResourceManager 
} from './performance-integration.js';

import * as NLU from './natural-language-understanding.js';
import * as ConversationContext from './conversation-context.js';
import * as ResponseGenerator from './response-generator.js';

// Module state
let isInitialized = false;

/**
 * Initialize the text processing module
 * @param {Object} options - Initialization options
 * @param {boolean} [options.registerWithResourceManager=true] - Whether to register with resource manager
 * @param {Object} [options.nlu] - NLU initialization options
 * @param {Object} [options.context] - Conversation context initialization options
 * @param {Object} [options.response] - Response generator initialization options
 * @returns {Promise<Object>} Initialization results
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    console.warn('Text processing module already initialized');
    return { success: true, status: 'already-initialized' };
  }

  console.log('Initializing ALEJO Text Processing module');

  // Default options
  const defaultOptions = {
    registerWithResourceManager: true,
    nlu: { complexity: 'medium' },
    context: { maxHistoryLength: 10 },
    response: { complexity: 'medium' }
  };

  // Merge options with defaults
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    nlu: { ...defaultOptions.nlu, ...(options.nlu || {}) },
    context: { ...defaultOptions.context, ...(options.context || {}) },
    response: { ...defaultOptions.response, ...(options.response || {}) }
  };

  try {
    // Register with Resource Allocation Manager if specified
    let resourceRegistration = { success: true };
    if (mergedOptions.registerWithResourceManager) {
      resourceRegistration.success = registerWithResourceManager({
        adaptToResourceMode: true
      });

      if (!resourceRegistration.success) {
        console.warn('Failed to register text processing with Resource Allocation Manager');
      }
    }

    // Initialize all components
    const results = {
      resourceRegistration,
      nlu: { success: false },
      context: { success: false },
      response: { success: false }
    };

    // Initialize NLU
    results.nlu.success = await NLU.initialize(mergedOptions.nlu);
    
    // Initialize Conversation Context
    results.context.success = await ConversationContext.initialize(mergedOptions.context);
    
    // Initialize Response Generator
    results.response.success = await ResponseGenerator.initialize(mergedOptions.response);

    // Set module state
    isInitialized = true;

    // Publish initialization event
    EventBus.publish('text:processing:initialized', {
      timestamp: Date.now(),
      results
    });

    // Overall success if all critical components succeeded
    const success = results.nlu.success && results.context.success && results.response.success;

    return {
      success,
      status: success ? 'initialized' : 'partial-initialization',
      results
    };
  } catch (error) {
    console.error('Failed to initialize text processing module:', error);
    return {
      success: false,
      status: 'initialization-failed',
      error: error.message
    };
  }
}

/**
 * Shutdown the text processing module
 * @returns {Promise<Object>} Shutdown results
 */
export async function shutdown() {
  if (!isInitialized) {
    return { success: true, status: 'not-initialized' };
  }

  console.log('Shutting down ALEJO Text Processing module');

  try {
    // Shutdown all components
    const results = {
      nlu: { success: false },
      context: { success: false },
      response: { success: false },
      resourceManager: { success: false }
    };

    // Shutdown in reverse order
    results.response.success = await safeShutdown(ResponseGenerator);
    results.context.success = await safeShutdown(ConversationContext);
    results.nlu.success = await safeShutdown(NLU);

    // Unregister from Resource Allocation Manager
    try {
      unregisterFromResourceManager();
      results.resourceManager.success = true;
    } catch (error) {
      console.error('Error unregistering from Resource Allocation Manager:', error);
      results.resourceManager.success = false;
      results.resourceManager.error = error.message;
    }

    // Reset module state
    isInitialized = false;

    // Publish shutdown event
    EventBus.publish('text:processing:shutdown', {
      timestamp: Date.now(),
      results
    });

    // Overall success if all critical components succeeded
    const success = results.nlu.success && results.context.success && results.response.success;

    return {
      success,
      status: success ? 'shutdown-complete' : 'partial-shutdown',
      results
    };
  } catch (error) {
    console.error('Error during text processing module shutdown:', error);
    return {
      success: false,
      status: 'shutdown-failed',
      error: error.message
    };
  }
}

/**
 * Helper function for safe component shutdown
 * @private
 * @param {Object} component - Component with shutdown method
 * @returns {Promise<boolean>} Shutdown success
 */
async function safeShutdown(component) {
  try {
    await component.shutdown();
    return true;
  } catch (error) {
    console.error(`Error shutting down component:`, error);
    return false;
  }
}

/**
 * Process text input through the entire pipeline
 * @param {string} text - Text to process
 * @param {Object} [options] - Processing options
 * @returns {Promise<Object>} Processing results
 */
export async function processText(text, options = {}) {
  if (!isInitialized) {
    throw new Error('Text processing module not initialized');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }

  try {
    // Emit text input event
    EventBus.publish('text:input', {
      text,
      timestamp: Date.now(),
      context: options.context || {}
    });

    // The rest of the processing happens asynchronously through event handlers
    return {
      success: true,
      text,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error processing text:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the current conversation context
 * @returns {Object} Current conversation context or null if not available
 */
export function getCurrentContext() {
  if (!isInitialized) {
    return null;
  }

  return ConversationContext.getCurrentContext();
}

/**
 * Reset the current conversation
 * @returns {boolean} Success
 */
export function resetConversation() {
  if (!isInitialized) {
    return false;
  }

  try {
    ConversationContext.resetConversation();
    return true;
  } catch (error) {
    console.error('Error resetting conversation:', error);
    return false;
  }
}

/**
 * Generate a response to a given text
 * @param {string} text - Text to respond to
 * @param {Object} [options] - Response options
 * @returns {Promise<Object>} Response object
 */
export async function generateResponse(text, options = {}) {
  if (!isInitialized) {
    throw new Error('Text processing module not initialized');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }

  try {
    // Process text through NLU
    const analysis = await NLU.processText(text, options.context || {});

    // Get current context
    const context = options.useContext !== false
      ? ConversationContext.getCurrentContext()
      : null;

    // Generate response
    const response = await ResponseGenerator.generateResponse(analysis, context);

    return {
      success: true,
      text: response.text,
      analysis,
      response
    };
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export submodules for direct access
export { NLU, ConversationContext, ResponseGenerator };
