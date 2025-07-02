/**
 * ALEJO Neural Event Bus
 * 
 * An enhanced event system inspired by brain-like information processing.
 * Extends the core event system with:
 * - Hemispheric event routing (left/right brain)
 * - Priority-based event handling
 * - Cognitive state awareness
 * - Parallel processing paths with synchronized outputs
 */

import { publish as corePublish, subscribe as coreSubscribe } from '../events.js';

// Neural event registry with hemispheric separation
const neuralRegistry = {
  left: {},    // Left hemisphere (analytical) events
  right: {},   // Right hemisphere (creative/intuitive) events
  bridge: {},  // Cross-hemisphere events
  global: {}   // System-wide events
};

// Current cognitive state
let cognitiveState = {
  dominantHemisphere: 'balanced', // 'left', 'right', or 'balanced'
  attentionFocus: 1.0,           // 0.0-1.0 attention level
  emotionalState: {              // Current emotional context
    valence: 0,                  // -1.0 to 1.0 (negative to positive)
    arousal: 0.5                 // 0.0 to 1.0 (calm to excited)
  },
  taskContext: 'general'         // Current task context
};

// Event processing queues
const eventQueues = {
  high: [],    // High priority (0-3)
  medium: [],  // Medium priority (4-6)
  low: []      // Low priority (7-10)
};

/**
 * Subscribe to a neural event
 * 
 * @param {string} event - Event name to subscribe to
 * @param {Function} callback - Function to call when event is triggered
 * @param {Object} options - Subscription options
 * @param {string} options.hemisphere - Target hemisphere ('left', 'right', 'bridge', 'global')
 * @param {Array<string>} options.cognitiveStates - States when this handler is most relevant
 * @param {number} options.priority - Handler priority (0-10, lower is higher priority)
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(event, callback, options = {}) {
  const hemisphere = options.hemisphere || 'global';
  const priority = options.priority !== undefined ? options.priority : 5;
  const cognitiveStates = options.cognitiveStates || ['general'];
  
  // Validate hemisphere
  if (!['left', 'right', 'bridge', 'global'].includes(hemisphere)) {
    console.error(`Invalid hemisphere: ${hemisphere}. Using 'global' instead.`);
    hemisphere = 'global';
  }
  
  // Initialize event registry for this hemisphere and event if needed
  if (!neuralRegistry[hemisphere][event]) {
    neuralRegistry[hemisphere][event] = [];
  }
  
  // Add handler with metadata
  const handler = {
    callback,
    priority,
    cognitiveStates,
    active: true
  };
  
  neuralRegistry[hemisphere][event].push(handler);
  
  // Also subscribe to core event system as fallback/compatibility
  const coreUnsubscribe = coreSubscribe(event, callback);
  
  // Return unsubscribe function
  return () => {
    // Mark as inactive in neural registry
    const handlers = neuralRegistry[hemisphere][event];
    const index = handlers.findIndex(h => h.callback === callback);
    
    if (index >= 0) {
      handlers[index].active = false;
      // Clean up if this was the last one
      if (handlers.every(h => !h.active)) {
        neuralRegistry[hemisphere][event] = handlers.filter(h => h.active);
      }
    }
    
    // Unsubscribe from core system
    coreUnsubscribe();
  };
}

/**
 * Publish an event to the neural event bus
 * 
 * @param {string} event - Event name to publish
 * @param {any} data - Data to pass to subscribers
 * @param {Object} options - Publishing options
 * @param {string} options.source - Source hemisphere or module
 * @param {number} options.priority - Event priority (0-10, 0 is highest)
 * @param {Object} options.context - Event context data
 * @returns {Promise<void>} - Resolves when all handlers have processed
 */
export async function publish(event, data, options = {}) {
  const source = options.source || 'global';
  const priority = options.priority !== undefined ? options.priority : 5;
  const context = options.context || {};
  
  // Create neural event object with metadata
  const neuralEvent = {
    type: event,
    source: {
      hemisphere: source,
      priority
    },
    context: {
      ...context,
      cognitiveState: { ...cognitiveState },
      timestamp: Date.now()
    },
    data
  };
  
  // Add to appropriate queue based on priority
  const queue = 
    priority <= 3 ? eventQueues.high :
    priority <= 6 ? eventQueues.medium :
    eventQueues.low;
  
  queue.push(neuralEvent);
  
  // Process the queues (immediate for high priority)
  if (priority <= 3) {
    await processEventQueues();
  } else {
    // Schedule processing for lower priority events
    scheduleQueueProcessing();
  }
  
  // Also publish to core event system for compatibility
  corePublish(event, data);
}

/**
 * Process all event queues based on priority
 * @returns {Promise<void>}
 */
async function processEventQueues() {
  // Process high priority first, then medium, then low
  await processQueue(eventQueues.high);
  await processQueue(eventQueues.medium);
  await processQueue(eventQueues.low);
}

/**
 * Process a specific event queue
 * @param {Array} queue - Queue to process
 * @returns {Promise<void>}
 */
async function processQueue(queue) {
  if (queue.length === 0) return;
  
  // Take a snapshot of the current queue and clear it
  const currentBatch = [...queue];
  queue.length = 0;
  
  // Process each event in the queue
  for (const event of currentBatch) {
    await processNeuralEvent(event);
  }
}

/**
 * Process a single neural event
 * @param {Object} neuralEvent - Event to process
 * @returns {Promise<void>}
 */
async function processNeuralEvent(neuralEvent) {
  const { type, source, context, data } = neuralEvent;
  
  // Determine which hemispheres should handle this event
  const hemispheres = determineTargetHemispheres(source.hemisphere, type);
  
  // Process in each target hemisphere
  for (const hemisphere of hemispheres) {
    if (neuralRegistry[hemisphere][type]) {
      const handlers = neuralRegistry[hemisphere][type];
      
      // Sort by priority
      const sortedHandlers = [...handlers].sort((a, b) => a.priority - b.priority);
      
      // Filter by cognitive state relevance
      const relevantHandlers = sortedHandlers.filter(handler => {
        return (
          handler.active && 
          (handler.cognitiveStates.includes('general') || 
           handler.cognitiveStates.includes(cognitiveState.taskContext))
        );
      });
      
      // Execute handlers
      for (const handler of relevantHandlers) {
        try {
          await Promise.resolve(handler.callback(data, context));
        } catch (error) {
          console.error(`Error in neural event handler for ${type}:`, error);
        }
      }
    }
  }
}

/**
 * Determine which hemispheres should handle an event
 * @param {string} sourceHemisphere - Source hemisphere
 * @param {string} eventType - Type of event
 * @returns {Array<string>} - Target hemispheres
 */
function determineTargetHemispheres(sourceHemisphere, eventType) {
  // Bridge events go to both hemispheres
  if (sourceHemisphere === 'bridge') {
    return ['left', 'right', 'bridge', 'global'];
  }
  
  // Global events go everywhere
  if (sourceHemisphere === 'global') {
    return ['global', 'left', 'right', 'bridge'];
  }
  
  // Left hemisphere events primarily go to left + bridge
  if (sourceHemisphere === 'left') {
    return ['left', 'bridge', 'global'];
  }
  
  // Right hemisphere events primarily go to right + bridge
  if (sourceHemisphere === 'right') {
    return ['right', 'bridge', 'global'];
  }
  
  // Default fallback
  return ['global'];
}

/**
 * Schedule processing of event queues
 * Uses requestAnimationFrame for browser environments or setImmediate/setTimeout for Node
 */
function scheduleQueueProcessing() {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(() => {
      processEventQueues();
    });
  } else if (typeof setImmediate !== 'undefined') {
    setImmediate(() => {
      processEventQueues();
    });
  } else {
    setTimeout(() => {
      processEventQueues();
    }, 0);
  }
}

/**
 * Update the current cognitive state
 * @param {Object} newState - New cognitive state properties
 */
export function updateCognitiveState(newState) {
  cognitiveState = {
    ...cognitiveState,
    ...newState
  };
  
  // Publish state change event
  publish('cognitive:state-changed', cognitiveState, {
    source: 'bridge',
    priority: 2
  });
}

/**
 * Get the current cognitive state
 * @returns {Object} - Current cognitive state
 */
export function getCognitiveState() {
  return { ...cognitiveState };
}

/**
 * Initialize the neural event bus system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    // Set initial cognitive state if provided
    if (options.initialState) {
      cognitiveState = {
        ...cognitiveState,
        ...options.initialState
      };
    }
    
    // Subscribe to core system events that might affect cognitive state
    coreSubscribe('user:interaction', handleUserInteraction);
    coreSubscribe('system:load', handleSystemLoad);
    
    // Publish initialization event
    publish('neural:bus:initialized', { timestamp: Date.now() }, {
      source: 'bridge',
      priority: 1
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Neural Event Bus:', error);
    return false;
  }
}

/**
 * Handle user interaction events to update cognitive state
 * @param {Object} data - Interaction data
 */
function handleUserInteraction(data) {
  // Analyze interaction to determine appropriate cognitive state
  // This is a placeholder for more sophisticated analysis
  
  if (data.type === 'analytical-query') {
    updateCognitiveState({
      dominantHemisphere: 'left',
      taskContext: 'problem-solving'
    });
  } else if (data.type === 'creative-request') {
    updateCognitiveState({
      dominantHemisphere: 'right',
      taskContext: 'creative'
    });
  } else if (data.type === 'emotional-expression') {
    updateCognitiveState({
      dominantHemisphere: 'right',
      emotionalState: {
        valence: data.sentiment || 0,
        arousal: data.intensity || 0.5
      }
    });
  }
}

/**
 * Handle system load events to adjust processing priorities
 * @param {Object} data - System load data
 */
function handleSystemLoad(data) {
  // Adjust event processing based on system load
  // This is a placeholder for more sophisticated load balancing
  
  if (data.highLoad) {
    // Under high load, focus on essential processing
    updateCognitiveState({
      attentionFocus: 0.8 // Focus on critical tasks
    });
  } else {
    // Under normal load, balanced processing
    updateCognitiveState({
      attentionFocus: 1.0
    });
  }
}
