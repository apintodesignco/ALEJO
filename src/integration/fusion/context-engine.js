/**
 * context-engine.js
 * Maintains environmental and session context for multimodal fusion.
 */
import { subscribe, publish } from '../../core/events.js';

const contextState = {
  activeSession: false,
  currentMode: 'default',
  lastInputTimestamp: null,
  environment: {
    timeOfDay: null,
    locale: navigator.language || 'en-US',
    platform: navigator.platform || 'unknown'
  }
};

function determineTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Initialize the context engine
 */
export function initialize(options = {}) {
  // Set initial environment
  contextState.environment.timeOfDay = determineTimeOfDay();
  
  // Subscribe to session events
  subscribe('session:start', () => {
    contextState.activeSession = true;
    publish('fusion:context-updated', { ...contextState });
  });
  subscribe('session:end', () => {
    contextState.activeSession = false;
    publish('fusion:context-updated', { ...contextState });
  });

  // Subscribe to mode changes
  subscribe('mode:change', ({ mode }) => {
    contextState.currentMode = mode;
    publish('fusion:context-updated', { ...contextState });
  });

  // Track last input timestamp
  const recordInput = ({ timestamp }) => {
    contextState.lastInputTimestamp = timestamp || Date.now();
    publish('fusion:context-updated', { ...contextState });
  };
  subscribe('gesture:recognized', recordInput);
  subscribe('voice:recognized', recordInput);
  subscribe('text:input', recordInput);

  publish('fusion:context-initialized', { ...contextState });
  return true;
}

/**
 * Get the current context state
 */
export function getContext() {
  return { ...contextState };
}
