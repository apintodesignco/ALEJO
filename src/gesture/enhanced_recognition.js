/**
 * ALEJO Enhanced Gesture Recognition Module
 * 
 * Advanced gesture recognition system that combines MediaPipe for hand landmark detection
 * with ALEJO's custom TensorFlow model for gesture classification.
 * Supports both static and dynamic gestures, as well as custom user-defined gestures.
 */

import { publish, subscribe } from '../core/events.js';
import { getVideoElement } from './camera.js';

// Default configuration
const DEFAULT_CONFIG = {
  // Recognition settings
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
  maxNumHands: 2,
  modelComplexity: 1,
  
  // Processing settings
  processingInterval: 100, // ms between processing frames
  
  // Feature flags
  enableGestureRecognition: true,
  enableHandTracking: true,
  
  // Accessibility settings
  accessibility: {
    adaptToLimitedMobility: false,
    sensitivityLevel: 'medium', // low, medium, high
    detectMinimalMovements: false,
    allowPartialGestures: false
  },
  
  // Debug settings
  debugMode: false
};

// Recognition state
let config = { ...DEFAULT_CONFIG };
let handsModel = null;
let gestureModel = null;
let isProcessing = false;
let lastProcessedTime = 0;
let landmarkHistory = [];
let lastRecognizedGesture = null;
let gestureStartTime = 0;
let frameCounter = 0;
let fpsEstimate = 0;
let modelLoaded = false;
let pythonBridge = null;

// Gesture definitions
import { GESTURES } from './constants.js';

/**
 * Initialize the enhanced gesture recognition system
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    // Merge configuration options
    Object.assign(config, options);
    
    // Initialize MediaPipe Hands
    handsModel = new window.MediaPipeHands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });
    
    // Configure MediaPipe Hands
    await handsModel.setOptions({
      maxNumHands: config.maxNumHands,
      modelComplexity: config.modelComplexity,
      minDetectionConfidence: config.minDetectionConfidence,
      minTrackingConfidence: config.minTrackingConfidence
    });
    
    // Set up result handler
    handsModel.onResults(handleHandResults);
    
    // Load gesture recognition model
    if (config.enableGestureRecognition) {
      gestureModel = await window.tf.loadLayersModel(
        'https://alejo-models.s3.amazonaws.com/gesture-recognition/model.json'
      );
    }
    
    // Set up event subscriptions
    subscribe('camera:frame', processFrame);
    subscribe('gesture:update_config', updateConfig);
    
    // Subscribe to mobility assistance events
    subscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
    subscribe('accessibility:mobility:adaptive_mode', handleAdaptiveModeChange);
    
    // Check if mobility assistance is active and adapt accordingly
    checkMobilityAssistanceStatus();
    
    // Mark as initialized
    modelLoaded = true;
    
    return true;
  } catch (error) {
    console.error('Failed to initialize enhanced gesture recognition:', error);
    return false;
  }
}

/**
 * Handle mobility profile updates
 * @param {Object} data - Mobility profile data
 * @private
 */
function handleMobilityProfileUpdate(data) {
  if (data && data.profile) {
    // Adapt gesture recognition based on mobility profile
    const { hasLimitedMobility, canUseHands, preferredInputMethod } = data.profile;
    
    // Enable accessibility adaptations if user has limited mobility
    config.accessibility.adaptToLimitedMobility = hasLimitedMobility;
    
    // If user can't use hands well, apply more aggressive adaptations
    if (hasLimitedMobility && !canUseHands) {
      // Lower detection confidence for users who can barely move their hands
      config.minDetectionConfidence = 0.4;
      config.accessibility.sensitivityLevel = 'high';
      config.accessibility.detectMinimalMovements = true;
      config.accessibility.allowPartialGestures = true;
    } else if (hasLimitedMobility) {
      // User has limited mobility but can use hands somewhat
      config.minDetectionConfidence = 0.6;
      config.accessibility.sensitivityLevel = 'medium-high';
      config.accessibility.detectMinimalMovements = true;
      config.accessibility.allowPartialGestures = true;
    } else {
      // User has full mobility
      config.minDetectionConfidence = 0.7;
      config.accessibility.sensitivityLevel = 'medium';
      config.accessibility.detectMinimalMovements = false;
      config.accessibility.allowPartialGestures = false;
    }
    
    // Update MediaPipe Hands configuration if model is loaded
    if (handsModel) {
      handsModel.setOptions({
        minDetectionConfidence: config.minDetectionConfidence
      });
    }
    
    console.log('Gesture recognition adapted for mobility profile:', {
      hasLimitedMobility,
      canUseHands,
      adaptedConfig: config.accessibility
    });
  }
}

/**
 * Handle adaptive mode changes
 * @param {Object} data - Adaptive mode data
 * @private
 */
function handleAdaptiveModeChange(data) {
  if (data && typeof data.enabled === 'boolean') {
    // Enable or disable adaptive features based on adaptive mode
    if (data.enabled) {
      // Request current mobility profile to adapt accordingly
      publish('settings:request', { 
        category: 'accessibility',
        key: 'mobilityProfile',
        callback: (profile) => {
          if (profile) {
            handleMobilityProfileUpdate({ profile });
          }
        }
      });
    } else {
      // Reset to standard configuration
      config.minDetectionConfidence = 0.7;
      config.accessibility.sensitivityLevel = 'medium';
      config.accessibility.detectMinimalMovements = false;
      config.accessibility.allowPartialGestures = false;
      
      // Update MediaPipe Hands configuration if model is loaded
      if (handsModel) {
        handsModel.setOptions({
          minDetectionConfidence: config.minDetectionConfidence
        });
      }
    }
  }
}

/**
 * Check mobility assistance status and adapt gesture recognition
 * @private
 */
function checkMobilityAssistanceStatus() {
  // Request current mobility profile
  publish('settings:request', { 
    category: 'accessibility',
    key: 'mobilityProfile',
    callback: (profile) => {
      if (profile) {
        handleMobilityProfileUpdate({ profile });
      }
    }
  });
}

/**
 * Update configuration
 * @param {Object} options - Configuration options
 */
function updateConfig(options) {
  if (options) {
    Object.assign(config, options);
    
    // Update MediaPipe Hands configuration if model is loaded
    if (handsModel) {
      handsModel.setOptions({
        maxNumHands: config.maxNumHands,
        modelComplexity: config.modelComplexity,
        minDetectionConfidence: config.minDetectionConfidence,
        minTrackingConfidence: config.minTrackingConfidence
      });
    }
  }
}

/**
 * Set up enhanced gesture recognition with the provided hands model
 * @param {Object} model - MediaPipe Hands model instance
 * @param {Object} options - Configuration options
 */
export async function setupEnhancedGestureRecognition(model, options = {}) {
  console.log('Setting up enhanced gesture recognition');
  
  if (!model) {
    throw new Error('Hands model is required for gesture recognition');
  }
  
  // Store model reference
  handsModel = model;
  
  // Update configuration
  config = { ...DEFAULT_CONFIG, ...options };
  
  // Set up result callback
  handsModel.onResults(processHandResults);
  
  // Initialize ALEJO's custom gesture model
  await initializeGestureModel();
  
  // Start processing
  return startGestureProcessing();
}

/**
 * Initialize ALEJO's custom gesture recognition model
 */
async function initializeGestureModel() {
  try {
    publish('gesture:status', { 
      state: 'loading', 
      message: 'Loading ALEJO gesture recognition model...' 
    });
    
    // Initialize Python bridge for TensorFlow model
    pythonBridge = await initializePythonBridge();
    
    // Create model configuration
    const modelConfig = {
      use_dynamic_gestures: config.dynamicGesturesEnabled,
      temporal_window: config.temporalWindow,
      confidence_threshold: config.modelConfidence,
      custom_gestures_enabled: true
    };
    
    // Initialize the gesture recognition model
    const response = await pythonBridge.call('initialize_gesture_model', modelConfig);
    
    if (response.success) {
      modelLoaded = true;
      console.log('ALEJO gesture recognition model loaded successfully');
      
      // Log supported gestures
      console.log('Supported gestures:', response.supported_gestures);
      
      publish('gesture:status', { 
        state: 'model_ready', 
        message: 'ALEJO gesture model ready',
        supportedGestures: response.supported_gestures
      });
      
      return true;
    } else {
      console.error('Failed to initialize gesture model:', response.error);
      
      // Fall back to rule-based recognition
      console.log('Falling back to rule-based gesture recognition');
      modelLoaded = false;
      
      publish('gesture:status', { 
        state: 'fallback', 
        message: 'Using fallback gesture recognition'
      });
      
      return false;
    }
  } catch (error) {
    console.error('Error initializing gesture model:', error);
    modelLoaded = false;
    return false;
  }
}

/**
 * Initialize the Python bridge for TensorFlow model communication
 */
async function initializePythonBridge() {
  try {
    // Use dynamic import to avoid loading this module unless needed
    const { PythonBridge } = await import('../utils/python-bridge.js');
    
    // Create a new bridge instance
    const bridge = new PythonBridge({
      module: 'alejo.ml.models.gesture_recognition_model',
      className: 'GestureRecognitionModel',
      timeout: 5000
    });
    
    // Initialize the bridge
    await bridge.initialize();
    
    return bridge;
  } catch (error) {
    console.error('Failed to initialize Python bridge:', error);
    throw error;
  }
}

/**
 * Start gesture processing loop
 */
export async function startGestureProcessing() {
  if (isProcessing) return true;
  
  const videoElement = getVideoElement();
  if (!videoElement) {
    console.error('Video element not available for gesture processing');
    return false;
  }
  
  isProcessing = true;
  frameCounter = 0;
  lastProcessedTime = 0;
  
  // Start processing loop
  processFrame();
  
  // Start FPS monitoring
  setInterval(updateFPS, 1000);
  
  return true;
}

/**
 * Process camera frames for gesture detection
 * Using a throttled approach to reduce CPU usage
 */
async function processFrame() {
  if (!isProcessing || !handsModel) return;
  
  const now = Date.now();
  const videoElement = getVideoElement();
  
  // Throttle processing based on interval and adaptive processing
  const interval = config.adaptiveProcessing 
    ? adjustProcessingInterval(fpsEstimate)
    : config.processingInterval;
    
  if (now - lastProcessedTime >= interval && videoElement) {
    try {
      await handsModel.send({ image: videoElement });
      lastProcessedTime = now;
      frameCounter++;
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  }
  
  // Schedule next frame
  requestAnimationFrame(processFrame);
}

/**
 * Adjust processing interval based on performance
 * @param {number} fps - Current FPS estimate
 * @returns {number} - Adjusted processing interval
 */
function adjustProcessingInterval(fps) {
  // Target 30 fps for smooth operation
  if (fps < 20) {
    // Performance is poor, increase interval to reduce load
    return config.processingInterval * 1.5;
  } else if (fps > 45) {
    // Performance is good, decrease interval for better responsiveness
    return Math.max(config.processingInterval * 0.8, 50);
  }
  
  // Keep current interval
  return config.processingInterval;
}

/**
 * Update FPS estimate
 */
function updateFPS() {
  if (!isProcessing) return;
  
  fpsEstimate = frameCounter;
  frameCounter = 0;
  
  if (config.debugMode) {
    console.log(`Gesture processing FPS: ${fpsEstimate}`);
  }
}

/**
 * Process hand detection results
 * @param {Object} results - Results from MediaPipe Hands
 */
function processHandResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    // No hands detected
    if (lastRecognizedGesture) {
      // If we had a gesture before, publish gesture end event
      const gestureEndData = {
        gesture: lastRecognizedGesture.gesture,
        duration: Date.now() - gestureStartTime
      };
      
      publish('gesture:end', gestureEndData);
      lastRecognizedGesture = null;
    }
    return;
  }
  
  // Process each detected hand
  const hands = results.multiHandLandmarks;
  const handedness = results.multiHandedness;
  
  // Publish hand landmarks for other modules (like sign language processor)
  publish('gesture:landmarks', { 
    hands, 
    handedness,
    timestamp: Date.now() 
  });
  
  // Process the hand landmarks to detect gestures
  _processHandLandmarks(hands, handedness);
}

/**
 * Process hand landmarks to detect gestures
 * @param {Array} hands - Hand landmarks
 * @param {Array} handedness - Handedness of each hand
 * @private
 */
async function _processHandLandmarks(hands, handedness) {
  try {
    // Process the first detected hand (we could support multiple hands in the future)
    const landmarks = hands[0];
    const handednessLabel = handedness[0].label; // 'Left' or 'Right'
        
    // Convert landmarks to the format expected by our model
    const landmarkArray = convertLandmarksToArray(landmarks);
        
    // Add to history for dynamic gesture recognition
    landmarkHistory.push(landmarkArray);
    if (landmarkHistory.length > config.temporalWindow) {
      landmarkHistory.shift();
    }
        
    // Recognize gesture
    const gestureResult = await recognizeGesture(landmarkArray, handednessLabel);
    
    // Publish results if confidence is high enough
    if (gestureResult && gestureResult.confidence >= config.modelConfidence) {
      // Check if this is a new gesture
      if (!lastRecognizedGesture || lastRecognizedGesture.gesture !== gestureResult.gesture) {
        // End previous gesture if any
        if (lastRecognizedGesture) {
          publish('gesture:end', {
            gesture: lastRecognizedGesture.gesture,
            duration: Date.now() - gestureStartTime
          });
        }
        
        // Start new gesture
        gestureStartTime = Date.now();
        
        // Publish gesture start event
        publish('gesture:detected', {
          gesture: gestureResult.gesture,
          confidence: gestureResult.confidence,
          handedness: handedness,
          type: gestureResult.type || 'static'
        });
        
        // Debug logging
        if (config.debugMode) {
          console.log(`Gesture detected: ${gestureResult.gesture} (${gestureResult.confidence.toFixed(2)})`);
        }
      }
      
      // Update last recognized gesture
      lastRecognizedGesture = gestureResult;
      
      // Publish gesture update event (for continuous tracking)
      publish('gesture:update', {
        gesture: gestureResult.gesture,
        confidence: gestureResult.confidence,
        handedness: handedness,
        duration: Date.now() - gestureStartTime
      });
    } else if (lastRecognizedGesture) {
      // End current gesture if confidence dropped
      publish('gesture:end', {
        gesture: lastRecognizedGesture.gesture,
        duration: Date.now() - gestureStartTime
      });
      
      lastRecognizedGesture = null;
    }
    
    // Publish raw landmark data for visualization or custom processing
    if (config.debugMode) {
      publish('gesture:landmarks', {
        landmarks: landmarks,
        handedness: handedness
      });
    }
  } catch (error) {
    console.error('Error processing hand results:', error);
  }
}

/**
 * Convert MediaPipe landmarks to array format for our model
 * @param {Array} landmarks - MediaPipe hand landmarks
 * @returns {Array} - Landmark array in the format expected by our model
 */
function convertLandmarksToArray(landmarks) {
  // Convert to a flat array of [x, y, z] coordinates
  return landmarks.map(landmark => [landmark.x, landmark.y, landmark.z]);
}

/**
 * Recognize gesture from hand landmarks
 * @param {Array} landmarks - Hand landmarks array
 * @param {String} handedness - 'Left' or 'Right'
 * @returns {Object} - Recognized gesture data
 */
async function recognizeGesture(landmarks, handedness) {
  // Use our custom model if available
  if (modelLoaded && pythonBridge) {
    try {
      // Call the Python model for prediction
      const result = await pythonBridge.call('predict', landmarks);
      
      if (result.error) {
        console.error('Error from gesture model:', result.error);
        return fallbackGestureRecognition(landmarks, handedness);
      }
      
      return result;
    } catch (error) {
      console.error('Error calling gesture model:', error);
      return fallbackGestureRecognition(landmarks, handedness);
    }
  } else {
    // Fall back to rule-based recognition
    return fallbackGestureRecognition(landmarks, handedness);
  }
}

/**
 * Rule-based gesture recognition as a fallback
 * @param {Array} landmarks - Hand landmarks array
 * @param {String} handedness - 'Left' or 'Right'
 * @returns {Object} - Recognized gesture data
 */
function fallbackGestureRecognition(landmarks, handedness) {
  // Extract finger states
  const fingerStates = extractFingerStates(landmarks);
  
  // Recognize basic gestures based on finger states
  if (fingerStates.allExtended) {
    return { gesture: GESTURES.OPEN_HAND, confidence: 0.9 };
  } else if (!fingerStates.anyExtended) {
    return { gesture: GESTURES.CLOSED_FIST, confidence: 0.9 };
  } else if (fingerStates.indexExtended && !fingerStates.middleExtended && 
             !fingerStates.ringExtended && !fingerStates.pinkyExtended) {
    return { gesture: GESTURES.POINTING, confidence: 0.85 };
  } else if (fingerStates.indexExtended && fingerStates.middleExtended && 
             !fingerStates.ringExtended && !fingerStates.pinkyExtended) {
    return { gesture: GESTURES.VICTORY, confidence: 0.85 };
  } else if (fingerStates.thumbExtended && !fingerStates.indexExtended && 
             !fingerStates.middleExtended && !fingerStates.ringExtended && 
             !fingerStates.pinkyExtended) {
    return { gesture: GESTURES.THUMBS_UP, confidence: 0.8 };
  } else if (fingerStates.thumbExtended && fingerStates.indexExtended && 
             !fingerStates.middleExtended && !fingerStates.ringExtended && 
             !fingerStates.pinkyExtended) {
    return { gesture: GESTURES.PINCH, confidence: 0.8 };
  }
  
  // If no specific gesture is recognized
  return { gesture: 'unknown', confidence: 0.5 };
}

/**
 * Extract finger extension states from landmarks
 * @param {Array} landmarks - Hand landmarks array
 * @returns {Object} - Finger extension states
 */
function extractFingerStates(landmarks) {
  // Define finger indices
  const WRIST = 0;
  const THUMB_TIP = 4;
  const INDEX_TIP = 8;
  const INDEX_PIP = 6;
  const MIDDLE_TIP = 12;
  const MIDDLE_PIP = 10;
  const RING_TIP = 16;
  const RING_PIP = 14;
  const PINKY_TIP = 20;
  const PINKY_PIP = 18;
  
  // Check if each finger is extended
  const thumbExtended = isThumbExtended(landmarks, WRIST, THUMB_TIP);
  const indexExtended = isFingerExtended(landmarks, INDEX_TIP, INDEX_PIP);
  const middleExtended = isFingerExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP);
  const ringExtended = isFingerExtended(landmarks, RING_TIP, RING_PIP);
  const pinkyExtended = isFingerExtended(landmarks, PINKY_TIP, PINKY_PIP);
  
  // Count extended fingers
  const extendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
    .filter(Boolean).length;
  
  return {
    thumbExtended,
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
    anyExtended: extendedCount > 0,
    allExtended: extendedCount === 5,
    extendedCount
  };
}

/**
 * Check if thumb is extended
 * @param {Array} landmarks - Hand landmarks array
 * @param {Number} wristIdx - Wrist landmark index
 * @param {Number} tipIdx - Thumb tip landmark index
 * @returns {Boolean} - True if thumb is extended
 */
function isThumbExtended(landmarks, wristIdx, tipIdx) {
  // For thumb, check if it's extended to the side
  const wrist = landmarks[wristIdx];
  const tip = landmarks[tipIdx];
  
  // Thumb is extended if its tip is significantly to the side of the wrist
  return Math.abs(tip[0] - wrist[0]) > 0.1;
}

/**
 * Check if a finger is extended
 * @param {Array} landmarks - Hand landmarks array
 * @param {Number} tipIdx - Finger tip landmark index
 * @param {Number} pipIdx - PIP (middle finger joint) landmark index
 * @returns {Boolean} - True if finger is extended
 */
function isFingerExtended(landmarks, tipIdx, pipIdx) {
  // Finger is extended if tip is higher than PIP joint
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  
  return tip[1] < pip[1];
}

/**
 * Stop gesture processing
 */
export function stopGestureProcessing() {
  isProcessing = false;
  
  // Clear history
  landmarkHistory = [];
  lastRecognizedGesture = null;
  
  console.log('Gesture processing stopped');
}

/**
 * Train the gesture recognition model with new data
 * @param {Object} trainingData - Training data for gestures
 * @param {Number} epochs - Number of training epochs
 * @returns {Promise<Object>} - Training results
 */
export async function trainGestureModel(trainingData, epochs = 50) {
  if (!pythonBridge) {
    return { success: false, error: 'Python bridge not initialized' };
  }
  
  try {
    publish('gesture:status', { 
      state: 'training', 
      message: 'Training gesture model...' 
    });
    
    // Call the Python model for training
    const result = await pythonBridge.call('train', trainingData, epochs);
    
    if (result.success) {
      publish('gesture:status', { 
        state: 'trained', 
        message: 'Gesture model trained successfully',
        accuracy: result.accuracy,
        gestures: result.gestures
      });
    } else {
      publish('gesture:status', { 
        state: 'error', 
        message: `Training error: ${result.error}` 
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error training gesture model:', error);
    
    publish('gesture:status', { 
      state: 'error',
      message: `Training error: ${error.message}`
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Save a custom gesture
 * @param {String} name - Name of the custom gesture
 * @param {Array} landmarks - Array of hand landmarks representing the gesture
 * @returns {Promise<Object>} - Result of saving the gesture
 */
export async function saveCustomGesture(name, landmarks) {
  if (!pythonBridge) {
    return { success: false, error: 'Python bridge not initialized' };
  }
  
  try {
    // Call the Python model to save the custom gesture
    const result = await pythonBridge.call('save_custom_gesture', name, landmarks);
    
    if (result) {
      publish('gesture:custom', { 
        action: 'saved',
        name: name
      });
      
      return { success: true, name };
    } else {
      return { success: false, error: 'Failed to save custom gesture' };
    }
  } catch (error) {
    console.error('Error saving custom gesture:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current state of the gesture recognition system
 * @returns {Object} - Current state
 */
export function getGestureRecognitionState() {
  return {
    isProcessing,
    modelLoaded,
    fpsEstimate,
    config,
    lastRecognizedGesture,
    historyLength: landmarkHistory.length
  };
}

/**
 * Update gesture recognition configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateGestureConfig(newConfig) {
  config = { ...config, ...newConfig };
  
  // Apply changes that need immediate effect
  if (pythonBridge) {
    pythonBridge.call('update_config', {
      confidence_threshold: config.modelConfidence,
      use_dynamic_gestures: config.dynamicGesturesEnabled,
      temporal_window: config.temporalWindow
    }).catch(error => {
      console.error('Error updating gesture model config:', error);
    });
  }
  
  return config;
}
