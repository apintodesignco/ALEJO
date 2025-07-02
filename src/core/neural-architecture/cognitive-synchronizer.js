/**
 * ALEJO Cognitive Synchronizer
 * 
 * Manages processing rhythm and timing between hemispheres, inspired by
 * neural oscillations in the brain. This module helps coordinate information
 * flow between analytical and creative processes, ensuring synchronized outputs.
 * 
 * Key features:
 * - Oscillatory processing patterns mimicking brain waves
 * - Synchronized information processing between hemispheres
 * - Adaptive timing based on task complexity and cognitive state
 * - Processing coordination for optimal integration of different thought modes
 */

import { 
  publish, 
  subscribe, 
  getCognitiveState, 
  updateCognitiveState 
} from './neural-event-bus.js';

// Oscillation patterns (frequency ranges in Hz)
const OSCILLATION_PATTERNS = {
  delta: { min: 1, max: 4 },    // Deep focus, complex problem-solving
  theta: { min: 4, max: 8 },    // Creative, memory tasks
  alpha: { min: 8, max: 13 },   // Relaxed alertness, default state
  beta: { min: 13, max: 30 },   // Active thinking, analytical tasks
  gamma: { min: 30, max: 100 }  // High-level processing, integration
};

// Current synchronization state
let syncState = {
  currentPattern: 'alpha',      // Default oscillation pattern
  patternFrequency: 10,         // Hz within the pattern range
  phaseAlignment: {             // Relative phase between hemispheres
    leftRight: 0,               // 0 = in sync, π = opposite phase
  },
  entrainmentLevel: 0.5,        // 0-1 strength of synchronization
  adaptiveTiming: true          // Whether to adapt timing to tasks
};

// Processing cycle tracking
let processingCycles = {
  left: { cycleCount: 0, lastCycle: 0 },
  right: { cycleCount: 0, lastCycle: 0 },
  bridge: { cycleCount: 0, lastCycle: 0 }
};

// Processing timers
let timers = {
  left: null,
  right: null,
  integration: null
};

/**
 * Initialize the cognitive synchronizer
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    console.log('Initializing ALEJO Cognitive Synchronizer');
    
    // Apply initial configuration if provided
    if (options.initialPattern) {
      syncState.currentPattern = options.initialPattern;
    }
    
    if (options.adaptiveTiming !== undefined) {
      syncState.adaptiveTiming = options.adaptiveTiming;
    }
    
    // Calculate initial frequency based on pattern
    updateFrequencyForPattern(syncState.currentPattern);
    
    // Subscribe to events that might affect synchronization
    subscribe('cognitive:state-changed', handleCognitiveStateChange, {
      hemisphere: 'bridge',
      priority: 2
    });
    
    subscribe('task:complexity-changed', handleTaskComplexityChange, {
      hemisphere: 'bridge',
      priority: 3
    });
    
    subscribe('integration:needed', triggerIntegrationCycle, {
      hemisphere: 'bridge',
      priority: 1
    });
    
    // Start the synchronization cycles
    startSynchronizationCycles();
    
    // Publish initialization event
    publish('cognitive:synchronizer:initialized', { 
      timestamp: Date.now(),
      initialPattern: syncState.currentPattern 
    }, {
      source: 'bridge',
      priority: 2
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Cognitive Synchronizer:', error);
    return false;
  }
}

/**
 * Start synchronization cycles for both hemispheres
 */
function startSynchronizationCycles() {
  // Clear any existing timers
  stopSynchronizationCycles();
  
  // Calculate cycle intervals (in ms) based on frequency
  const leftInterval = calculateCycleInterval('left');
  const rightInterval = calculateCycleInterval('right');
  const integrationInterval = Math.max(leftInterval, rightInterval) * 2;
  
  // Start hemisphere processing cycles
  timers.left = setInterval(() => {
    processingCycles.left.cycleCount++;
    processingCycles.left.lastCycle = Date.now();
    
    // Trigger left hemisphere processing cycle
    publish('cycle:left-hemisphere', {
      cycleCount: processingCycles.left.cycleCount,
      timestamp: processingCycles.left.lastCycle
    }, {
      source: 'bridge',
      priority: 3
    });
  }, leftInterval);
  
  timers.right = setInterval(() => {
    processingCycles.right.cycleCount++;
    processingCycles.right.lastCycle = Date.now();
    
    // Trigger right hemisphere processing cycle
    publish('cycle:right-hemisphere', {
      cycleCount: processingCycles.right.cycleCount,
      timestamp: processingCycles.right.lastCycle
    }, {
      source: 'bridge',
      priority: 3
    });
  }, rightInterval);
  
  // Start integration cycles
  timers.integration = setInterval(() => {
    processingCycles.bridge.cycleCount++;
    processingCycles.bridge.lastCycle = Date.now();
    
    // Trigger integration processing cycle
    publish('cycle:integration', {
      leftCycles: processingCycles.left.cycleCount,
      rightCycles: processingCycles.right.cycleCount,
      timestamp: processingCycles.bridge.lastCycle
    }, {
      source: 'bridge',
      priority: 2
    });
  }, integrationInterval);
}

/**
 * Stop all synchronization cycles
 */
function stopSynchronizationCycles() {
  if (timers.left) clearInterval(timers.left);
  if (timers.right) clearInterval(timers.right);
  if (timers.integration) clearInterval(timers.integration);
  
  timers.left = null;
  timers.right = null;
  timers.integration = null;
}

/**
 * Calculate the interval between processing cycles for a hemisphere
 * @param {string} hemisphere - Target hemisphere
 * @returns {number} - Interval in milliseconds
 */
function calculateCycleInterval(hemisphere) {
  // Base interval from current frequency (convert Hz to ms)
  let baseInterval = 1000 / syncState.patternFrequency;
  
  // Apply phase alignment for hemispheres
  if (hemisphere === 'right' && syncState.phaseAlignment.leftRight !== 0) {
    // Offset right hemisphere timing based on phase
    baseInterval = baseInterval * (1 + syncState.phaseAlignment.leftRight / Math.PI);
  }
  
  // Consider cognitive state for timing
  const cognitiveState = getCognitiveState();
  
  // Adjust timing based on dominant hemisphere
  if (syncState.adaptiveTiming) {
    if (cognitiveState.dominantHemisphere === 'left' && hemisphere === 'left') {
      baseInterval *= 0.9; // Speed up left hemisphere when it's dominant
    } else if (cognitiveState.dominantHemisphere === 'right' && hemisphere === 'right') {
      baseInterval *= 0.9; // Speed up right hemisphere when it's dominant
    }
  }
  
  // Ensure minimum practical interval
  return Math.max(baseInterval, 16.67); // Never faster than 60Hz (~16.67ms)
}

/**
 * Update the oscillation frequency based on pattern
 * @param {string} pattern - Oscillation pattern name
 */
function updateFrequencyForPattern(pattern) {
  if (OSCILLATION_PATTERNS[pattern]) {
    const { min, max } = OSCILLATION_PATTERNS[pattern];
    // Select a frequency within the pattern range
    syncState.patternFrequency = min + (max - min) / 2;
  }
}

/**
 * Handle changes in cognitive state
 * @param {Object} state - New cognitive state
 */
function handleCognitiveStateChange(state) {
  // Update synchronization based on cognitive state
  
  // Analytical tasks favor beta oscillations
  if (state.taskContext === 'problem-solving' || 
      state.dominantHemisphere === 'left') {
    changeOscillationPattern('beta');
  }
  // Creative tasks favor theta oscillations
  else if (state.taskContext === 'creative' ||
           state.dominantHemisphere === 'right') {
    changeOscillationPattern('theta');
  }
  // Emotional processing might use different phase alignment
  else if (state.emotionalState && 
           Math.abs(state.emotionalState.valence) > 0.5) {
    // Adjust phase alignment for emotional processing
    syncState.phaseAlignment.leftRight = 0.3 * Math.PI;
    restartSynchronization();
  }
  // Default balanced state
  else {
    changeOscillationPattern('alpha');
  }
}

/**
 * Handle changes in task complexity
 * @param {Object} data - Task complexity data
 */
function handleTaskComplexityChange(data) {
  if (!data.complexity) return;
  
  // Complex integration tasks benefit from gamma oscillations
  if (data.complexity > 0.8) {
    changeOscillationPattern('gamma');
  }
  // Deep, sustained focus tasks benefit from delta oscillations
  else if (data.complexity > 0.6 && data.sustainedFocus) {
    changeOscillationPattern('delta');
  }
  // Moderate complexity uses beta
  else if (data.complexity > 0.4) {
    changeOscillationPattern('beta');
  }
  // Default to alpha for simpler tasks
  else {
    changeOscillationPattern('alpha');
  }
}

/**
 * Change the current oscillation pattern
 * @param {string} pattern - New pattern name
 */
function changeOscillationPattern(pattern) {
  if (syncState.currentPattern === pattern) return;
  
  // Update pattern
  syncState.currentPattern = pattern;
  updateFrequencyForPattern(pattern);
  
  // Publish pattern change event
  publish('cognitive:oscillation-changed', {
    pattern,
    frequency: syncState.patternFrequency
  }, {
    source: 'bridge',
    priority: 4
  });
  
  // Restart synchronization with new timing
  restartSynchronization();
}

/**
 * Restart synchronization cycles with current settings
 */
function restartSynchronization() {
  stopSynchronizationCycles();
  startSynchronizationCycles();
}

/**
 * Trigger an immediate integration cycle
 * @param {Object} data - Integration trigger data
 */
function triggerIntegrationCycle(data) {
  // Increment cycle count
  processingCycles.bridge.cycleCount++;
  processingCycles.bridge.lastCycle = Date.now();
  
  // Publish priority integration event
  publish('cycle:priority-integration', {
    trigger: data.trigger,
    leftCycles: processingCycles.left.cycleCount,
    rightCycles: processingCycles.right.cycleCount,
    timestamp: processingCycles.bridge.lastCycle
  }, {
    source: 'bridge',
    priority: 1  // Highest priority
  });
}

/**
 * Adjust phase alignment between hemispheres
 * @param {number} phase - New phase alignment value (0-π)
 */
export function adjustPhaseAlignment(phase) {
  // Validate phase value
  const validPhase = Math.max(0, Math.min(Math.PI, phase));
  
  // Update phase alignment
  syncState.phaseAlignment.leftRight = validPhase;
  
  // Restart synchronization with new phase
  restartSynchronization();
  
  return syncState.phaseAlignment;
}

/**
 * Get current synchronization state
 * @returns {Object} - Synchronization state
 */
export function getSynchronizationState() {
  return { ...syncState };
}

/**
 * Get current processing cycle information
 * @returns {Object} - Processing cycle information
 */
export function getProcessingCycles() {
  return JSON.parse(JSON.stringify(processingCycles));
}
