/**
 * ALEJO Eye Tracking Module
 * 
 * Provides advanced eye tracking capabilities including:
 * - Pupil detection and tracking
 * - Gaze estimation
 * - Blink detection
 * - Saccade detection
 * - Eye movement pattern analysis
 * 
 * All processing happens locally on the client device to maintain privacy.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// State
let isInitialized = false;
let eyeModelsLoaded = false;

// Eye tracking data
const eyeData = {
  left: {
    pupil: { x: 0, y: 0, size: 0 },
    lastPupil: { x: 0, y: 0, size: 0 },
    openness: 1.0,
    movement: { velocity: 0, direction: 0 },
    lastBlinkTime: 0
  },
  right: {
    pupil: { x: 0, y: 0, size: 0 },
    lastPupil: { x: 0, y: 0, size: 0 },
    openness: 1.0,
    movement: { velocity: 0, direction: 0 },
    lastBlinkTime: 0
  },
  gaze: {
    x: 0, 
    y: 0,
    depth: 0,
    confidence: 0,
    screenPoint: { x: 0, y: 0 }
  },
  blink: {
    isBlinking: false,
    lastBlink: 0,
    blinkDuration: 0,
    blinkRate: 0,
    blinkHistory: []
  },
  calibration: {
    isCalibrated: false,
    points: [],
    accuracy: 0,
    lastCalibrationTime: 0
  }
};

// Thresholds and constants
const BLINK_THRESHOLD = 0.3; // Eye openness below this value is considered a blink
const SACCADE_VELOCITY_THRESHOLD = 0.5; // Minimum velocity for saccade detection
const BLINK_HISTORY_SIZE = 20; // Number of blinks to store in history
const CALIBRATION_POINTS = 9; // Number of points used for calibration

// Default configuration
const DEFAULT_CONFIG = {
  trackPupils: true,
  trackGaze: true,
  trackBlinks: true,
  minEyeOpenness: 0.1,
  gazeSmoothing: 0.5, // 0-1, higher means more smoothing
  blinkDetectionEnabled: true,
  saccadeDetectionEnabled: true,
  useHighPrecisionMode: false,
  calibrationRequired: true,
  recalibrateAfterMs: 600000, // 10 minutes
  accessibilityFeatures: {
    audioFeedback: false,
    highContrastPupil: false,
    extraSensitivity: false
  }
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Load eye tracking models
 * @returns {Promise<void>}
 */
export async function loadEyeTrackingModels() {
  if (eyeModelsLoaded) {
    console.log('Eye tracking models already loaded');
    return;
  }
  
  try {
    console.log('Loading eye tracking models');
    publish('eye:models:loading');
    
    // WebNN or other local ML frameworks would be used here
    // For this implementation, we'll use TensorFlow.js for eye tracking
    // This would be integrated with face-api.js for more precise eye landmarks
    
    // Simulate model loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    eyeModelsLoaded = true;
    publish('eye:models:loaded');
    
    console.log('Eye tracking models loaded successfully');
  } catch (error) {
    console.error('Failed to load eye tracking models:', error);
    publish('eye:models:error', { 
      message: 'Failed to load eye tracking models', 
      error 
    });
    throw error;
  }
}

/**
 * Initialize eye tracking
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Eye tracking API
 */
export async function initializeEyeTracking(options = {}) {
  if (isInitialized) {
    console.warn('Eye tracking already initialized');
    return getPublicAPI();
  }
  
  console.log('Initializing ALEJO Eye Tracking System');
  
  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options
  };
  
  try {
    // Load models if not already loaded
    if (!eyeModelsLoaded) {
      await loadEyeTrackingModels();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    isInitialized = true;
    publish('eye:tracking:initialized');
    
    // Check if calibration is required
    if (config.calibrationRequired && !eyeData.calibration.isCalibrated) {
      publish('eye:calibration:required');
    }
    
    return getPublicAPI();
  } catch (error) {
    console.error('Failed to initialize eye tracking:', error);
    publish('eye:tracking:error', { 
      message: 'Failed to initialize eye tracking', 
      error 
    });
    throw error;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for face detection events to extract eye data
  subscribe('face:detected', handleFaceDetected);
  
  // Listen for calibration events
  subscribe('eye:calibration:point:added', handleCalibrationPointAdded);
  subscribe('eye:calibration:completed', handleCalibrationCompleted);
  
  // Listen for configuration changes
  subscribe('biometrics:config:updated', (event) => {
    if (event.newConfig.eyeTracking) {
      updateConfig(event.newConfig.eyeTracking);
    }
  });
  
  // Listen for window resize events to update screen coordinates
  window.addEventListener('resize', handleWindowResize);
  
  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Handle face detected events
 * @param {Object} event - Face detection event
 */
function handleFaceDetected(event) {
  if (!isInitialized || !event.faces || event.faces.length === 0) {
    return;
  }
  
  // For simplicity, we'll only process the first face
  // In a multi-person scenario, you'd need to track which face belongs to the user
  const face = event.faces[0];
  
  if (!face.landmarks || !face.landmarks.keyPoints) {
    return;
  }
  
  const { leftEyeCenter, rightEyeCenter, leftPupil, rightPupil } = face.landmarks.keyPoints;
  
  // Process eye data
  processEyeData(leftEyeCenter, rightEyeCenter, leftPupil, rightPupil, face.landmarks);
}

/**
 * Process eye data from face landmarks
 * @param {Object} leftEyeCenter - Left eye center coordinates
 * @param {Object} rightEyeCenter - Right eye center coordinates
 * @param {Object} leftPupil - Left pupil coordinates
 * @param {Object} rightPupil - Right pupil coordinates
 * @param {Object} landmarks - Complete facial landmarks
 */
function processEyeData(leftEyeCenter, rightEyeCenter, leftPupil, rightPupil, landmarks) {
  // Store previous pupil positions
  eyeData.left.lastPupil = { ...eyeData.left.pupil };
  eyeData.right.lastPupil = { ...eyeData.right.pupil };
  
  // Update pupil positions
  if (config.trackPupils) {
    updatePupilData(leftPupil, rightPupil);
  }
  
  // Calculate eye openness based on landmarks
  if (landmarks.leftEye && landmarks.rightEye) {
    updateEyeOpenness(landmarks.leftEye, landmarks.rightEye);
  }
  
  // Detect blinks
  if (config.trackBlinks && config.blinkDetectionEnabled) {
    detectBlinks();
  }
  
  // Calculate gaze direction
  if (config.trackGaze) {
    calculateGazeDirection(leftEyeCenter, rightEyeCenter, leftPupil, rightPupil);
  }
  
  // Detect saccades (rapid eye movements)
  if (config.saccadeDetectionEnabled) {
    detectSaccades();
  }
  
  // Publish eye tracking data
  publishEyeTrackingData();
}

/**
 * Update pupil data
 * @param {Object} leftPupil - Left pupil coordinates
 * @param {Object} rightPupil - Right pupil coordinates
 */
function updatePupilData(leftPupil, rightPupil) {
  // Apply smoothing to pupil positions
  const alpha = config.gazeSmoothing;
  
  // Left pupil
  eyeData.left.pupil.x = eyeData.left.pupil.x * alpha + leftPupil.x * (1 - alpha);
  eyeData.left.pupil.y = eyeData.left.pupil.y * alpha + leftPupil.y * (1 - alpha);
  
  // Right pupil
  eyeData.right.pupil.x = eyeData.right.pupil.x * alpha + rightPupil.x * (1 - alpha);
  eyeData.right.pupil.y = eyeData.right.pupil.y * alpha + rightPupil.y * (1 - alpha);
  
  // Calculate pupil size (estimated from landmarks)
  // This is an approximation; real pupil size would require specialized eye tracking hardware
  eyeData.left.pupil.size = 0.5; // Normalized size between 0-1
  eyeData.right.pupil.size = 0.5; // Normalized size between 0-1
}

/**
 * Calculate eye openness from landmarks
 * @param {Array} leftEyeLandmarks - Left eye landmarks
 * @param {Array} rightEyeLandmarks - Right eye landmarks
 */
function updateEyeOpenness(leftEyeLandmarks, rightEyeLandmarks) {
  // Calculate vertical distance between upper and lower eyelids
  const leftUpperPoint = leftEyeLandmarks[1]; // Upper eyelid
  const leftLowerPoint = leftEyeLandmarks[5]; // Lower eyelid
  const rightUpperPoint = rightEyeLandmarks[1]; // Upper eyelid
  const rightLowerPoint = rightEyeLandmarks[5]; // Lower eyelid
  
  // Calculate horizontal distance as reference
  const leftEyeWidth = calculateDistance(leftEyeLandmarks[0], leftEyeLandmarks[3]);
  const rightEyeWidth = calculateDistance(rightEyeLandmarks[0], rightEyeLandmarks[3]);
  
  // Calculate vertical openness
  const leftOpenness = calculateDistance(leftUpperPoint, leftLowerPoint) / leftEyeWidth;
  const rightOpenness = calculateDistance(rightUpperPoint, rightLowerPoint) / rightEyeWidth;
  
  // Apply smoothing
  const alpha = config.gazeSmoothing;
  eyeData.left.openness = Math.max(
    config.minEyeOpenness,
    eyeData.left.openness * alpha + leftOpenness * (1 - alpha)
  );
  eyeData.right.openness = Math.max(
    config.minEyeOpenness,
    eyeData.right.openness * alpha + rightOpenness * (1 - alpha)
  );
}

/**
 * Detect blinks based on eye openness
 */
function detectBlinks() {
  const now = Date.now();
  const averageOpenness = (eyeData.left.openness + eyeData.right.openness) / 2;
  
  // Check if blinking
  if (!eyeData.blink.isBlinking && averageOpenness < BLINK_THRESHOLD) {
    // Start of blink
    eyeData.blink.isBlinking = true;
    eyeData.blink.lastBlink = now;
    
    publish('eye:blink:started', {
      timestamp: now,
      openness: averageOpenness
    });
  } else if (eyeData.blink.isBlinking && averageOpenness > BLINK_THRESHOLD) {
    // End of blink
    eyeData.blink.isBlinking = false;
    const blinkDuration = now - eyeData.blink.lastBlink;
    eyeData.blink.blinkDuration = blinkDuration;
    
    // Add to blink history
    eyeData.blink.blinkHistory.push({
      timestamp: now,
      duration: blinkDuration
    });
    
    // Limit history size
    if (eyeData.blink.blinkHistory.length > BLINK_HISTORY_SIZE) {
      eyeData.blink.blinkHistory.shift();
    }
    
    // Calculate blink rate (blinks per minute)
    calculateBlinkRate();
    
    publish('eye:blink:ended', {
      timestamp: now,
      duration: blinkDuration,
      rate: eyeData.blink.blinkRate
    });
  }
}

/**
 * Calculate blink rate
 */
function calculateBlinkRate() {
  const history = eyeData.blink.blinkHistory;
  if (history.length < 2) {
    eyeData.blink.blinkRate = 0;
    return;
  }
  
  const now = Date.now();
  const recentHistory = history.filter(b => (now - b.timestamp) < 60000); // Last minute
  
  eyeData.blink.blinkRate = recentHistory.length;
}

/**
 * Calculate gaze direction from eye positions
 * @param {Object} leftEyeCenter - Left eye center coordinates
 * @param {Object} rightEyeCenter - Right eye center coordinates
 * @param {Object} leftPupil - Left pupil coordinates
 * @param {Object} rightPupil - Right pupil coordinates
 */
function calculateGazeDirection(leftEyeCenter, rightEyeCenter, leftPupil, rightPupil) {
  if (!eyeData.calibration.isCalibrated && config.calibrationRequired) {
    // Skip gaze calculation if not calibrated
    return;
  }
  
  // Calculate relative position of pupil within each eye
  const leftOffsetX = (leftPupil.x - leftEyeCenter.x) / 10; // Normalize to -1 to 1 range
  const leftOffsetY = (leftPupil.y - leftEyeCenter.y) / 5;
  const rightOffsetX = (rightPupil.x - rightEyeCenter.x) / 10;
  const rightOffsetY = (rightPupil.y - rightEyeCenter.y) / 5;
  
  // Average the offsets from both eyes
  const offsetX = (leftOffsetX + rightOffsetX) / 2;
  const offsetY = (leftOffsetY + rightOffsetY) / 2;
  
  // Apply calibration factors if calibrated
  let gazeX = offsetX;
  let gazeY = offsetY;
  let confidence = 0.5;
  
  if (eyeData.calibration.isCalibrated) {
    // Apply calibration mapping
    const calibration = eyeData.calibration;
    
    // In a real implementation, this would use a more sophisticated mapping
    // based on calibration points, but this is a simplified version
    gazeX = offsetX * calibration.accuracy;
    gazeY = offsetY * calibration.accuracy;
    confidence = calibration.accuracy;
  }
  
  // Apply smoothing
  const alpha = config.gazeSmoothing;
  eyeData.gaze.x = eyeData.gaze.x * alpha + gazeX * (1 - alpha);
  eyeData.gaze.y = eyeData.gaze.y * alpha + gazeY * (1 - alpha);
  eyeData.gaze.confidence = confidence;
  
  // Map to screen coordinates
  mapGazeToScreen();
}

/**
 * Map gaze coordinates to screen coordinates
 */
function mapGazeToScreen() {
  const { innerWidth, innerHeight } = window;
  
  // Map from normalized coordinates (-1 to 1) to screen coordinates
  eyeData.gaze.screenPoint = {
    x: innerWidth * (0.5 + eyeData.gaze.x / 2),
    y: innerHeight * (0.5 + eyeData.gaze.y / 2)
  };
}

/**
 * Detect saccades (rapid eye movements)
 */
function detectSaccades() {
  // Calculate movement velocity for each eye
  const leftVelocity = calculateDistance(eyeData.left.pupil, eyeData.left.lastPupil);
  const rightVelocity = calculateDistance(eyeData.right.pupil, eyeData.right.lastPupil);
  
  // Average velocity
  const velocity = (leftVelocity + rightVelocity) / 2;
  
  // Calculate movement direction
  const leftDx = eyeData.left.pupil.x - eyeData.left.lastPupil.x;
  const leftDy = eyeData.left.pupil.y - eyeData.left.lastPupil.y;
  const leftDirection = Math.atan2(leftDy, leftDx);
  
  const rightDx = eyeData.right.pupil.x - eyeData.right.lastPupil.x;
  const rightDy = eyeData.right.pupil.y - eyeData.right.lastPupil.y;
  const rightDirection = Math.atan2(rightDy, rightDx);
  
  // Average direction
  const direction = (leftDirection + rightDirection) / 2;
  
  // Store movement data
  eyeData.left.movement = { velocity: leftVelocity, direction: leftDirection };
  eyeData.right.movement = { velocity: rightVelocity, direction: rightDirection };
  
  // Check if this is a saccade
  if (velocity > SACCADE_VELOCITY_THRESHOLD) {
    publish('eye:saccade:detected', {
      velocity,
      direction,
      timestamp: Date.now()
    });
  }
}

/**
 * Publish eye tracking data
 */
function publishEyeTrackingData() {
  publish('eye:tracking:update', {
    timestamp: Date.now(),
    left: {
      pupil: { ...eyeData.left.pupil },
      openness: eyeData.left.openness,
      movement: { ...eyeData.left.movement }
    },
    right: {
      pupil: { ...eyeData.right.pupil },
      openness: eyeData.right.openness,
      movement: { ...eyeData.right.movement }
    },
    gaze: {
      x: eyeData.gaze.x,
      y: eyeData.gaze.y,
      confidence: eyeData.gaze.confidence,
      screenPoint: { ...eyeData.gaze.screenPoint }
    },
    blink: {
      isBlinking: eyeData.blink.isBlinking,
      lastBlink: eyeData.blink.lastBlink,
      blinkRate: eyeData.blink.blinkRate
    },
    calibration: {
      isCalibrated: eyeData.calibration.isCalibrated,
      accuracy: eyeData.calibration.accuracy
    }
  });
}

/**
 * Handle window resize
 */
function handleWindowResize() {
  // Update gaze screen mapping
  mapGazeToScreen();
}

/**
 * Handle visibility changes
 */
function handleVisibilityChange() {
  // Reset some tracking data when the page becomes visible again
  if (!document.hidden) {
    // Reset blink detection
    eyeData.blink.isBlinking = false;
    
    // Check if calibration has expired
    checkCalibrationExpiry();
  }
}

/**
 * Handle calibration point added
 * @param {Object} event - Calibration point event
 */
function handleCalibrationPointAdded(event) {
  // Add calibration point
  eyeData.calibration.points.push({
    screen: { ...event.screenPoint },
    gaze: {
      x: eyeData.gaze.x,
      y: eyeData.gaze.y
    },
    timestamp: Date.now()
  });
  
  // Check if calibration is complete
  if (eyeData.calibration.points.length >= CALIBRATION_POINTS) {
    completeCalibration();
  }
}

/**
 * Handle calibration completed
 */
function handleCalibrationCompleted() {
  // Update calibration timestamp
  eyeData.calibration.lastCalibrationTime = Date.now();
}

/**
 * Complete calibration process
 */
function completeCalibration() {
  // Calculate calibration accuracy based on points
  // In a real implementation, this would be a more sophisticated calculation
  const accuracy = 0.85; // 85% accuracy (simplified)
  
  eyeData.calibration.isCalibrated = true;
  eyeData.calibration.accuracy = accuracy;
  eyeData.calibration.lastCalibrationTime = Date.now();
  
  publish('eye:calibration:completed', {
    points: eyeData.calibration.points.length,
    accuracy,
    timestamp: Date.now()
  });
}

/**
 * Check if calibration has expired
 */
function checkCalibrationExpiry() {
  if (!eyeData.calibration.isCalibrated) {
    return;
  }
  
  const now = Date.now();
  const calibrationAge = now - eyeData.calibration.lastCalibrationTime;
  
  if (calibrationAge > config.recalibrateAfterMs) {
    // Calibration has expired
    eyeData.calibration.isCalibrated = false;
    
    publish('eye:calibration:expired', {
      lastCalibration: eyeData.calibration.lastCalibrationTime,
      age: calibrationAge,
      timestamp: now
    });
  }
}

/**
 * Update eye tracking configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateConfig(newConfig) {
  // Update configuration
  config = {
    ...config,
    ...newConfig,
    accessibilityFeatures: {
      ...config.accessibilityFeatures,
      ...(newConfig.accessibilityFeatures || {})
    }
  };
  
  publish('eye:config:updated', { 
    newConfig: config
  });
}

/**
 * Reset calibration
 */
export function resetCalibration() {
  eyeData.calibration.isCalibrated = false;
  eyeData.calibration.points = [];
  eyeData.calibration.accuracy = 0;
  
  publish('eye:calibration:reset', {
    timestamp: Date.now()
  });
}

/**
 * Calculate Euclidean distance between two points
 * @param {Object} point1 - First point with x,y coordinates
 * @param {Object} point2 - Second point with x,y coordinates
 * @returns {number} - Distance between points
 */
function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
  );
}

/**
 * Get the public API for eye tracking
 * @returns {Object} - Eye tracking API
 */
function getPublicAPI() {
  return {
    isInitialized: () => isInitialized,
    areModelsLoaded: () => eyeModelsLoaded,
    getConfig: () => ({ ...config }),
    getEyeData: () => ({ ...eyeData }),
    updateConfig,
    resetCalibration,
    getGazePoint: () => ({ ...eyeData.gaze.screenPoint }),
    isBlinking: () => eyeData.blink.isBlinking,
    isCalibrated: () => eyeData.calibration.isCalibrated,
    getCalibrationAccuracy: () => eyeData.calibration.accuracy
  };
}

export default {
  loadEyeTrackingModels,
  initializeEyeTracking,
  updateConfig,
  resetCalibration
};
