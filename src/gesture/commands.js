/**
 * ALEJO Gesture Commands Module
 * 
 * Maps detected gestures to application commands.
 * Implements command debouncing and context-aware gesture interpretation.
 */

import { publish, subscribe } from '../core/events.js';

// Command state
const commandRegistry = {};
let lastCommandTime = 0;
let currentContext = 'default';
const COMMAND_COOLDOWN = 500; // ms between commands to prevent accidental triggers

import { GESTURES } from './constants.js';

/**
 * Register gesture commands and set up event listeners
 */
export function registerGestureCommands() {
  console.log('Registering gesture commands');
  
  // Define default command mappings
  registerDefaultCommands();
  
  // Listen for gesture detection events
  subscribe('gesture:detected', handleGestureDetection);
  
  // Listen for context changes
  subscribe('ui:section-change', (event) => {
    updateContext(event.section);
  });
  
  return true;
}

/**
 * Register the default command mappings for different contexts
 */
function registerDefaultCommands() {
  // Default context commands
  registerCommand('default', GESTURES.OPEN_HAND, () => {
    publish('alejo:start', { source: 'gesture' });
  });
  
  registerCommand('default', GESTURES.CLOSED_FIST, () => {
    publish('alejo:stop', { source: 'gesture' });
  });
  
  registerCommand('default', GESTURES.POINTING, () => {
    publish('alejo:select', { source: 'gesture' });
  });
  
  registerCommand('default', GESTURES.VICTORY, () => {
    publish('ui:toggle-panel', { source: 'gesture' });
  });
  
  // Main section commands
  registerCommand('main', GESTURES.THUMBS_UP, () => {
    publish('alejo:confirm', { source: 'gesture' });
  });
  
  registerCommand('main', GESTURES.WAVE, () => {
    publish('alejo:cancel', { source: 'gesture' });
  });
  
  // Settings section commands
  registerCommand('settings', GESTURES.THUMBS_UP, () => {
    publish('settings:save', { source: 'gesture' });
  });
  
  registerCommand('settings', GESTURES.WAVE, () => {
    publish('settings:cancel', { source: 'gesture' });
  });
  
  // Gesture section commands
  registerCommand('gesture', GESTURES.THUMBS_UP, () => {
    publish('gesture:calibrate', { source: 'gesture' });
  });
  
  // Help section commands - simplified navigation
  registerCommand('help', GESTURES.POINTING, () => {
    publish('help:next', { source: 'gesture' });
  });
  
  registerCommand('help', GESTURES.VICTORY, () => {
    publish('help:previous', { source: 'gesture' });
  });
}

/**
 * Register a command for a specific gesture in a context
 * 
 * @param {string} context - The UI context (e.g., 'default', 'main')
 * @param {string} gesture - The gesture type
 * @param {Function} callback - Function to execute
 */
export function registerCommand(context, gesture, callback) {
  if (!commandRegistry[context]) {
    commandRegistry[context] = {};
  }
  
  commandRegistry[context][gesture] = callback;
  
  console.log(`Registered ${gesture} command for ${context} context`);
}

/**
 * Handle a detected gesture and map it to a command
 * 
 * @param {Object} gestureData - Data about the detected gesture
 */
function handleGestureDetection(gestureData) {
  const { gesture, hand } = gestureData;
  
  // Skip if no gesture detected
  if (!gesture) return;
  
  const now = Date.now();
  
  // Debounce commands to prevent accidental triggers
  if (now - lastCommandTime < COMMAND_COOLDOWN) {
    return;
  }
  
  // Try to find command in current context
  let command = commandRegistry[currentContext] && 
                commandRegistry[currentContext][gesture];
  
  // Fall back to default context if not found
  if (!command && currentContext !== 'default') {
    command = commandRegistry['default'] && 
              commandRegistry['default'][gesture];
  }
  
  // Execute the command if found
  if (command && typeof command === 'function') {
    console.log(`Executing command for ${gesture} in ${currentContext} context`);
    
    // Update last command time
    lastCommandTime = now;
    
    try {
      // Execute the command
      command(gestureData);
      
      // Provide visual feedback that gesture was recognized
      publish('ui:gesture-feedback', {
        gesture,
        success: true
      });
    } catch (error) {
      console.error(`Error executing gesture command: ${error}`);
      
      // Provide error feedback
      publish('ui:gesture-feedback', {
        gesture,
        success: false,
        error: error.message
      });
    }
  }
}

/**
 * Update the current context
 * 
 * @param {string} newContext - The new context
 */
export function updateContext(newContext) {
  if (newContext) {
    currentContext = newContext;
    console.log(`Gesture command context updated to: ${currentContext}`);
  }
}

/**
 * Get available commands for the current context
 */
export function getAvailableCommands() {
  const commands = {};
  
  // Get commands from current context
  if (commandRegistry[currentContext]) {
    Object.assign(commands, commandRegistry[currentContext]);
  }
  
  // Add commands from default context that don't overlap
  if (currentContext !== 'default' && commandRegistry['default']) {
    Object.keys(commandRegistry['default']).forEach(gesture => {
      if (!commands[gesture]) {
        commands[gesture] = commandRegistry['default'][gesture];
      }
    });
  }
  
  return Object.keys(commands).map(gesture => ({ gesture }));
}
