/**
 * ALEJO Multimodal Fusion Engine
 * 
 * Integrates multiple input modalities (gesture, voice, text) into a unified understanding:
 * - Temporal alignment of inputs from different modalities
 * - Semantic fusion of complementary information
 * - Conflict resolution between modalities
 * - Context-aware interpretation of multimodal commands
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';

// Constants
const FUSION_WINDOW_MS = 1000; // Time window for considering inputs as related
const MAX_HISTORY = 10; // Maximum number of recent multimodal inputs to keep

// State management
let initialized = false;
let inputBuffer = {
  gesture: [],
  voice: [],
  text: [],
  combined: []
};
let contextState = {
  activeSession: false,
  currentMode: 'default',
  confidenceThreshold: 0.7, // Minimum confidence to consider an input valid
  lastActivity: Date.now()
};

/**
 * Initialize the multimodal fusion engine
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Multimodal Fusion Engine');
  
  if (initialized) {
    console.warn('Multimodal Fusion Engine already initialized');
    return true;
  }
  
  try {
    // Configure options
    contextState.confidenceThreshold = options.confidenceThreshold || 0.7;
    contextState.currentMode = options.initialMode || 'default';
    
    // Subscribe to input events
    subscribe('gesture:recognized', handleGestureInput);
    subscribe('voice:recognized', handleVoiceInput);
    subscribe('text:input', handleTextInput);
    
    // Subscribe to context events
    subscribe('session:start', () => { contextState.activeSession = true; });
    subscribe('session:end', () => { contextState.activeSession = false; });
    subscribe('mode:change', (data) => { contextState.currentMode = data.mode; });
    
    // Initialize security integration
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    initialized = true;
    publish('fusion:initialized', { success: true });
    
    // Log initialization if consent is granted
    if (security.isFeatureAllowed('personalization:learning')) {
      security.logSecureEvent('fusion:initialized', {
        timestamp: Date.now(),
        mode: contextState.currentMode
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Multimodal Fusion Engine:', error);
    publish('fusion:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Handle gesture input events
 * @param {Object} data - Gesture data
 */
function handleGestureInput(data) {
  if (!initialized) return;
  
  contextState.lastActivity = Date.now();
  
  // Create standardized input representation
  const input = {
    type: 'gesture',
    timestamp: Date.now(),
    data: {
      gesture: data.gesture,
      confidence: data.confidence || 1.0,
      duration: data.duration,
      position: data.position,
      intensity: data.intensity
    },
    raw: data
  };
  
  // Add to buffer with limit
  inputBuffer.gesture.unshift(input);
  if (inputBuffer.gesture.length > MAX_HISTORY) {
    inputBuffer.gesture.pop();
  }
  
  // Process for fusion
  processInputForFusion(input);
}

/**
 * Handle voice input events
 * @param {Object} data - Voice recognition data
 */
function handleVoiceInput(data) {
  if (!initialized) return;
  
  contextState.lastActivity = Date.now();
  
  // Create standardized input representation
  const input = {
    type: 'voice',
    timestamp: Date.now(),
    data: {
      text: data.text,
      confidence: data.confidence || 1.0,
      isFinal: data.isFinal || true,
      language: data.language || 'en-US',
      emotion: data.emotion
    },
    raw: data
  };
  
  // Add to buffer with limit
  inputBuffer.voice.unshift(input);
  if (inputBuffer.voice.length > MAX_HISTORY) {
    inputBuffer.voice.pop();
  }
  
  // Process for fusion
  processInputForFusion(input);
}

/**
 * Handle text input events
 * @param {Object} data - Text input data
 */
function handleTextInput(data) {
  if (!initialized) return;
  
  contextState.lastActivity = Date.now();
  
  // Create standardized input representation
  const input = {
    type: 'text',
    timestamp: Date.now(),
    data: {
      text: data.text,
      source: data.source || 'user',
      metadata: data.metadata
    },
    raw: data
  };
  
  // Add to buffer with limit
  inputBuffer.text.unshift(input);
  if (inputBuffer.text.length > MAX_HISTORY) {
    inputBuffer.text.pop();
  }
  
  // Process for fusion
  processInputForFusion(input);
}

/**
 * Process a new input for potential fusion with other recent inputs
 * @param {Object} input - New input event
 */
function processInputForFusion(input) {
  // Skip low-confidence inputs
  if (input.data.confidence && input.data.confidence < contextState.confidenceThreshold) {
    console.log(`Skipping low-confidence input: ${input.type}`, input.data);
    return;
  }
  
  // Find temporally related inputs from other modalities
  const relatedInputs = findRelatedInputs(input);
  
  // If we have related inputs, perform fusion
  if (relatedInputs.length > 0) {
    const fusedInput = performFusion(input, relatedInputs);
    
    // Add to combined buffer with limit
    inputBuffer.combined.unshift(fusedInput);
    if (inputBuffer.combined.length > MAX_HISTORY) {
      inputBuffer.combined.pop();
    }
    
    // Publish the fused input
    publish('fusion:combined', fusedInput);
  }
}

/**
 * Find inputs from other modalities that are temporally related
 * @param {Object} input - Reference input
 * @returns {Array} Related inputs
 */
function findRelatedInputs(input) {
  const timestamp = input.timestamp;
  const relatedInputs = [];
  
  // Gather inputs from all modalities except the current one
  ['gesture', 'voice', 'text'].forEach(modalityType => {
    if (modalityType !== input.type) {
      const modalityBuffer = inputBuffer[modalityType];
      
      // Find inputs within the fusion window
      for (const modalityInput of modalityBuffer) {
        if (Math.abs(modalityInput.timestamp - timestamp) <= FUSION_WINDOW_MS) {
          relatedInputs.push(modalityInput);
        }
      }
    }
  });
  
  return relatedInputs;
}

/**
 * Perform fusion of multiple inputs into a combined representation
 * @param {Object} primaryInput - Primary input that triggered fusion
 * @param {Array} relatedInputs - Related inputs from other modalities
 * @returns {Object} Fused multimodal input
 */
function performFusion(primaryInput, relatedInputs) {
  // Start with primary input
  const allInputs = [primaryInput, ...relatedInputs];
  
  // Create base fusion structure
  const fusion = {
    id: `fusion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: primaryInput.timestamp,
    modalities: allInputs.map(input => input.type),
    inputs: allInputs,
    context: {
      mode: contextState.currentMode,
      session: contextState.activeSession
    }
  };
  
  // Extract the main command/intent
  fusion.command = extractPrimaryCommand(allInputs);
  
  // Extract parameters from across modalities
  fusion.parameters = extractCrossModalParameters(allInputs);
  
  // Calculate overall confidence
  fusion.confidence = calculateFusionConfidence(allInputs);
  
  // Resolve conflicts between modalities
  resolveModalityConflicts(fusion);
  
  // Log the fusion if permitted
  if (security.isFeatureAllowed('personalization:learning')) {
    security.logSecureEvent('fusion:created', {
      fusionId: fusion.id,
      modalities: fusion.modalities,
      command: fusion.command.action,
      confidence: fusion.confidence
    });
  }
  
  return fusion;
}

/**
 * Extract the primary command/action from inputs
 * @param {Array} inputs - Array of inputs
 * @returns {Object} Command object
 */
function extractPrimaryCommand(inputs) {
  // Prioritize explicit text commands
  const textInput = inputs.find(input => input.type === 'text');
  if (textInput) {
    return {
      action: interpretTextCommand(textInput.data.text),
      source: 'text',
      original: textInput.data.text,
      confidence: textInput.data.confidence || 1.0
    };
  }
  
  // Next try voice commands
  const voiceInput = inputs.find(input => input.type === 'voice');
  if (voiceInput) {
    return {
      action: interpretTextCommand(voiceInput.data.text),
      source: 'voice',
      original: voiceInput.data.text,
      confidence: voiceInput.data.confidence || 0.9
    };
  }
  
  // Fall back to gesture
  const gestureInput = inputs.find(input => input.type === 'gesture');
  if (gestureInput) {
    return {
      action: gestureInput.data.gesture,
      source: 'gesture',
      original: gestureInput.data.gesture,
      confidence: gestureInput.data.confidence || 0.8
    };
  }
  
  // No clear command found
  return {
    action: 'unknown',
    source: 'none',
    confidence: 0
  };
}

/**
 * Parse a text input to extract a command
 * @param {string} text - Input text
 * @returns {string} Extracted command
 */
function interpretTextCommand(text) {
  // This is a simple implementation that could be enhanced with NLP
  const lowercaseText = text.toLowerCase().trim();
  
  // Check for common commands
  if (lowercaseText.includes('play') || lowercaseText.includes('start')) return 'play';
  if (lowercaseText.includes('stop') || lowercaseText.includes('pause')) return 'stop';
  if (lowercaseText.includes('next')) return 'next';
  if (lowercaseText.includes('previous') || lowercaseText.includes('back')) return 'previous';
  if (lowercaseText.includes('volume up') || lowercaseText.includes('louder')) return 'volume_up';
  if (lowercaseText.includes('volume down') || lowercaseText.includes('quieter')) return 'volume_down';
  if (lowercaseText.includes('mute')) return 'mute';
  
  // Default to the text itself for more complex commands
  return lowercaseText;
}

/**
 * Extract parameters from all input modalities
 * @param {Array} inputs - Array of inputs
 * @returns {Object} Parameters object
 */
function extractCrossModalParameters(inputs) {
  const parameters = {};
  
  // Extract from text/voice first (more explicit)
  const textualInputs = inputs.filter(input => input.type === 'text' || input.type === 'voice');
  textualInputs.forEach(input => {
    const text = input.type === 'text' ? input.data.text : input.data.text;
    
    // Extract numeric parameters
    const numbers = text.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
      parameters.value = parseFloat(numbers[0]);
    }
    
    // Extract directional parameters
    if (text.match(/up|higher|increase|more/i)) {
      parameters.direction = 'up';
    } else if (text.match(/down|lower|decrease|less/i)) {
      parameters.direction = 'down';
    }
    
    // Extract target parameters
    if (text.match(/volume|sound|audio/i)) {
      parameters.target = 'volume';
    } else if (text.match(/brightness|screen|display/i)) {
      parameters.target = 'brightness';
    }
  });
  
  // Augment with gesture data
  const gestureInputs = inputs.filter(input => input.type === 'gesture');
  gestureInputs.forEach(input => {
    // Use gesture position for spatial parameters
    if (input.data.position) {
      parameters.position = input.data.position;
    }
    
    // Use gesture intensity for magnitude
    if (input.data.intensity) {
      parameters.intensity = input.data.intensity;
    }
    
    // Map specific gestures to parameters
    if (input.data.gesture === 'swipe_up') {
      parameters.direction = parameters.direction || 'up';
    } else if (input.data.gesture === 'swipe_down') {
      parameters.direction = parameters.direction || 'down';
    } else if (input.data.gesture === 'pinch_in') {
      parameters.zoom = 'out';
    } else if (input.data.gesture === 'pinch_out') {
      parameters.zoom = 'in';
    }
  });
  
  return parameters;
}

/**
 * Calculate overall confidence of the fused input
 * @param {Array} inputs - Array of inputs
 * @returns {number} Combined confidence score
 */
function calculateFusionConfidence(inputs) {
  // Base confidence on individual input confidences and modality reliability
  const confidenceWeights = {
    text: 1.0,    // Text is most explicit
    voice: 0.9,   // Voice can have recognition errors
    gesture: 0.8  // Gesture can be ambiguous
  };
  
  let totalWeight = 0;
  let weightedConfidence = 0;
  
  inputs.forEach(input => {
    const weight = confidenceWeights[input.type];
    const confidence = input.data.confidence || 1.0;
    
    weightedConfidence += weight * confidence;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
}

/**
 * Resolve conflicts between inputs from different modalities
 * @param {Object} fusion - Fusion object to update
 */
function resolveModalityConflicts(fusion) {
  // Check for conflicting commands
  if (fusion.inputs.length <= 1) {
    // No conflicts possible with only one input
    return;
  }
  
  // Extract actions by modality
  const actionsByModality = {};
  fusion.inputs.forEach(input => {
    if (input.type === 'text' || input.type === 'voice') {
      const action = input.type === 'text' ? 
        interpretTextCommand(input.data.text) : 
        interpretTextCommand(input.data.text);
        
      actionsByModality[input.type] = action;
    } else if (input.type === 'gesture') {
      actionsByModality.gesture = input.data.gesture;
    }
  });
  
  // If we have both gestural and verbal inputs that conflict
  if (actionsByModality.gesture && 
      (actionsByModality.text || actionsByModality.voice)) {
    
    const verbalAction = actionsByModality.text || actionsByModality.voice;
    const gestureAction = actionsByModality.gesture;
    
    // If they appear to contradict
    if (areActionsContradictory(verbalAction, gestureAction)) {
      // Prefer the verbal command (higher specificity)
      fusion.command.action = verbalAction;
      fusion.command.source = actionsByModality.text ? 'text' : 'voice';
      
      // Note the conflict resolution
      fusion.conflicts = fusion.conflicts || [];
      fusion.conflicts.push({
        type: 'command_mismatch',
        resolved: 'verbal_over_gestural',
        verbal: verbalAction,
        gestural: gestureAction
      });
    }
  }
}

/**
 * Check if two actions are contradictory
 * @param {string} action1 - First action
 * @param {string} action2 - Second action
 * @returns {boolean} Whether actions are contradictory
 */
function areActionsContradictory(action1, action2) {
  // Define contradictory pairs
  const contradictions = [
    ['play', 'stop'],
    ['play', 'pause'],
    ['volume_up', 'volume_down'],
    ['next', 'previous']
  ];
  
  // Check if the actions are in any contradiction pair
  return contradictions.some(pair => 
    (pair[0] === action1 && pair[1] === action2) || 
    (pair[0] === action2 && pair[1] === action1)
  );
}

/**
 * Get recent inputs from all modalities
 * @param {Object} options - Query options
 * @returns {Object} Recent inputs by modality
 */
export function getRecentInputs(options = {}) {
  if (!initialized) {
    console.warn('Multimodal Fusion Engine not initialized');
    return { gesture: [], voice: [], text: [], combined: [] };
  }
  
  const limit = options.limit || MAX_HISTORY;
  const result = {};
  
  // Copy buffers with limit
  ['gesture', 'voice', 'text', 'combined'].forEach(type => {
    result[type] = inputBuffer[type].slice(0, limit);
  });
  
  return result;
}

/**
 * Get the most recent fused input
 * @returns {Object|null} Most recent fused input or null
 */
export function getLatestFusion() {
  if (!initialized || inputBuffer.combined.length === 0) {
    return null;
  }
  
  return inputBuffer.combined[0];
}

/**
 * Set the current mode for context-aware fusion
 * @param {string} mode - New mode
 */
export function setMode(mode) {
  if (!initialized) {
    console.warn('Multimodal Fusion Engine not initialized');
    return;
  }
  
  contextState.currentMode = mode;
  publish('fusion:mode:changed', { mode });
}

/**
 * Clear input buffers
 */
export function clearBuffers() {
  if (!initialized) {
    console.warn('Multimodal Fusion Engine not initialized');
    return;
  }
  
  inputBuffer = {
    gesture: [],
    voice: [],
    text: [],
    combined: []
  };
  
  publish('fusion:buffers:cleared');
}
