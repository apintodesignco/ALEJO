/**
 * ALEJO Gesture System Integration
 * 
 * This module integrates the existing ALEJO gesture system with the optimized frontend.
 * It's dynamically loaded only when needed to reduce the initial bundle size.
 */

import { publish, subscribe } from '../core/events.js';
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';

// Track initialization state
let isInitialized = false;
let isActive = false;

// MediaPipe Hands model
let handsModel = null;

// Enhanced recognition flag
let useEnhancedRecognition = true;

/**
 * Initialize the gesture recognition system
 * This is called only when the user activates the gesture feature
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializeGesture(options = {}) {
  console.log('Initializing ALEJO gesture system...');
  
  // Prevent duplicate initialization
  if (isInitialized) {
    console.log('Gesture system already initialized');
    return { success: true };
  }
  
  try {
    // Publish loading status
    publish('gesture:status', { 
      state: 'loading', 
      message: 'Loading gesture recognition system...' 
    });
    
    // Dynamically import dependencies only when needed
    // This uses code splitting to avoid loading these large libraries in the initial bundle
    const mediaPipeHands = await import('@mediapipe/hands');
    
    // Initialize the hands model from MediaPipe
    handsModel = new mediaPipeHands.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });
    
    // Configure the model
    await handsModel.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    // Set up camera access for gesture recognition
    const { setupCamera } = await import('./camera.js');
    const cameraReady = await setupCamera();
    
    if (!cameraReady) {
      return { 
        success: false, 
        error: 'Failed to initialize camera for gesture recognition'
      };
    }
    
    // Initialize the gesture recognition system
    if (useEnhancedRecognition) {
      // Use enhanced gesture recognition with custom ML model
      const { setupEnhancedGestureRecognition } = await import('./enhanced_recognition.js');
      await setupEnhancedGestureRecognition(handsModel, {
        dynamicGesturesEnabled: true,
        adaptiveProcessing: true,
        modelConfidence: 0.7
      });
      
      console.log('Enhanced gesture recognition activated');
    } else {
      // Use basic gesture recognition (fallback)
      const { setupGestureRecognition } = await import('./recognition.js');
      await setupGestureRecognition(handsModel);
    }
    
    // Set up WebSocket connection to the gesture backend
    const { connectToGestureBackend } = await import('./connection.js');
    await connectToGestureBackend();
    
    // Set up gesture command mappings
    const { registerGestureCommands } = await import('./commands.js');
    registerGestureCommands();
    
    // Subscribe to system events
    setupGestureSystemEvents();
    
    // Register with Resource Allocation Manager
    registerWithResourceManager({
      useEnhancedRecognition: useEnhancedRecognition
    });
    
    // Mark as initialized
    isInitialized = true;
    isActive = true;
    
    // Publish ready status
    publish('gesture:status', { 
      state: 'online', 
      message: 'Gesture recognition system ready'
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize gesture system:', error);
    
    publish('gesture:status', { 
      state: 'error',
      message: `Initialization error: ${error.message}`
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set up event listeners for the gesture system
 */
function setupGestureSystemEvents() {
  // Handle page visibility changes to conserve resources
  subscribe('system:visibility', (isVisible) => {
    // Pause gesture processing when the page is not visible
    if (isActive) {
      if (isVisible) {
        resumeGestureProcessing();
      } else {
        pauseGestureProcessing();
      }
    }
  });
  
  // Handle system pause/resume events
  subscribe('system:pause', () => pauseGestureProcessing());
  subscribe('system:resume', () => resumeGestureProcessing());
  
  // Handle calibration requests
  subscribe('gesture:calibrate', () => calibrateGesture());
  
  // Handle gesture training requests
  subscribe('gesture:training', handleTrainingRequest);
  
  // Handle enhanced recognition toggle
  subscribe('gesture:config', (config) => {
    if (config.hasOwnProperty('enhancedRecognition')) {
      const newValue = Boolean(config.enhancedRecognition);
      
      // Only restart if the value changed and we're already initialized
      if (newValue !== useEnhancedRecognition && isInitialized) {
        useEnhancedRecognition = newValue;
        
        // Restart the gesture system to apply the change
        stopGestureProcessing();
        isInitialized = false;
        initializeGesture();
      } else {
        useEnhancedRecognition = newValue;
      }
    }
  });
}

/**
 * Start gesture processing
 */
export function startGestureProcessing() {
  if (!isInitialized) {
    console.warn('Gesture system not initialized');
    return false;
  }
  
  isActive = true;
  
  // Publish status
  publish('gesture:status', { 
    state: 'online', 
    message: 'Gesture recognition active'
  });
  
  return true;
}

/**
 * Stop gesture processing
 */
export function stopGestureProcessing() {
  if (!isInitialized) return false;
  
  isActive = false;
  
  // Unregister from Resource Allocation Manager
  unregisterFromResourceManager();
  
  // Publish status
  publish('gesture:status', { 
    state: 'offline', 
    message: 'Gesture recognition inactive'
  });
  
  return true;
}

/**
 * Pause gesture processing temporarily (e.g., when tab not visible)
 */
export function pauseGestureProcessing() {
  if (!isInitialized || !isActive) return;
  
  console.log('Pausing gesture processing to conserve resources');
  
  // Implement actual pause logic here
  // This might involve stopping the camera feed or reducing processing frequency
  
  // Publish status
  publish('gesture:status', { 
    state: 'paused', 
    message: 'Gesture recognition paused'
  });
}

/**
 * Resume gesture processing after pause
 */
export function resumeGestureProcessing() {
  if (!isInitialized || !isActive) return;
  
  console.log('Resuming gesture processing');
  
  // Implement actual resume logic here
  
  // Publish status
  publish('gesture:status', { 
    state: 'online', 
    message: 'Gesture recognition active'
  });
}

/**
 * Calibrate the gesture recognition system
 */
export async function calibrateGesture() {
  if (!isInitialized) {
    console.warn('Cannot calibrate: Gesture system not initialized');
    return false;
  }
  
  console.log('Calibrating gesture recognition system');
  
  // Publish status
  publish('gesture:status', { 
    state: 'calibrating', 
    message: 'Calibrating gesture recognition...'
  });
  
  try {
    // Import the calibration module only when needed
    const { runCalibration } = await import('./calibration.js');
    const result = await runCalibration();
    
    if (result.success) {
      publish('gesture:status', { 
        state: 'online', 
        message: 'Calibration completed successfully'
      });
      return true;
    } else {
      publish('gesture:status', { 
        state: 'error', 
        message: `Calibration failed: ${result.error}`
      });
      return false;
    }
  } catch (error) {
    console.error('Calibration error:', error);
    publish('gesture:status', { 
      state: 'error', 
      message: `Calibration error: ${error.message}`
    });
    return false;
  }
}

/**
 * Get the current state of the gesture system
 */
export function getGestureSystemState() {
  return {
    initialized: isInitialized,
    active: isActive,
    enhancedRecognition: useEnhancedRecognition
  };
}

/**
 * Handle requests to open/close the gesture training interface
 * @param {Object} action - Action details
 */
async function handleTrainingRequest(action) {
  if (!isInitialized || !useEnhancedRecognition) {
    publish('gesture:status', { 
      state: 'error', 
      message: 'Enhanced gesture recognition must be active to use training interface'
    });
    return;
  }
  
  try {
    // Dynamically import the training interface
    const { showTrainingInterface, hideTrainingInterface } = await import('./training-interface.js');
    
    if (action.show) {
      showTrainingInterface();
    } else {
      hideTrainingInterface();
    }
  } catch (error) {
    console.error('Error handling training interface request:', error);
    publish('gesture:status', { 
      state: 'error', 
      message: `Training interface error: ${error.message}`
    });
  }
}

/**
 * Show the gesture training interface
 * This is a convenience method for external modules
 */
export async function showGestureTraining() {
  if (!isInitialized) {
    await initializeGesture();
  }
  
  publish('gesture:training', { show: true });
}
