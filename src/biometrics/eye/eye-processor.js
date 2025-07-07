/**
 * ALEJO Eye Tracking Processor
 * 
 * This module provides core eye tracking functionality including:
 * - Gaze estimation
 * - Blink detection
 * - Saccade detection
 * - Calibration
 * - Accessibility features
 * - Privacy modes
 * 
 * The eye processor integrates with face detection to extract eye landmarks
 * and processes them to determine gaze direction, eye openness, and other metrics.
 * 
 * @module biometrics/eye/eye-processor
 */

import * as faceapi from 'face-api.js';
import { publish, subscribe, unsubscribe } from '../../events';
import { getLogger } from '../../utils/logger';

const logger = getLogger('eye-processor');

// Module state
let initialized = false;
let processing = false;
let calibrating = false;
let calibrationData = null;
let lastGazePoint = null;
let lastBlinkState = false;
let blinkStartTime = null;
let gazeHistory = [];
let processingInterval = 50; // Default 50ms (20fps)
let config = {
  debugMode: false,
  privacyMode: 'none', // none, blur, abstract
  accessibility: {
    highContrastMode: false,
    largerTargets: false,
    slowerAnimations: false,
    voicePrompts: false,
    extraTime: false
  },
  mobility: {
    adaptToLimitedMobility: false,
    isEyeControlPrimary: false,     // Whether eye control is the primary input method
    dwellClickEnabled: false,        // Enable clicking by dwelling gaze on a target
    dwellTime: 1000,                // Time in ms to trigger a dwell click
    enhancedPrecision: false,       // Enhanced precision mode for users relying on eye control
    sensitivityLevel: 'medium',     // low, medium, high
    autoCalibration: false          // Automatically recalibrate for users with limited mobility
  }
};

// Constants
const HISTORY_MAX_LENGTH = 30;
const BLINK_THRESHOLD = 0.3;
const SACCADE_VELOCITY_THRESHOLD = 300; // pixels per second
const VALID_PRIVACY_MODES = ['none', 'blur', 'abstract'];

/**
 * Initialize the eye tracking system
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    logger.info('Initializing eye tracking system');
    
    // Update configuration
    config = {
      ...config,
      ...options
    };
    
    // Set processing interval
    processingInterval = config.processingInterval || 50;
    
    // Load face detection models if not already loaded
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      logger.info('Face detection models loaded successfully');
    } catch (error) {
      logger.error('Failed to load face detection models', error);
      return false;
    }
    
    // Subscribe to face detection events
    subscribe('face:detected', handleFaceDetected);
    subscribe('face:lost', handleFaceLost);
    
    // Subscribe to calibration events
    subscribe('eye:calibration:point:complete', handleCalibrationPointComplete);
    
    // Subscribe to mobility assistance events
    subscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
    subscribe('accessibility:mobility:eye_control', handleEyeControlToggle);
    subscribe('accessibility:mobility:dwell_click', handleDwellClickToggle);
    subscribe('accessibility:mobility:adaptive_mode', handleAdaptiveModeChange);
    
    // Subscribe to system events
    window.addEventListener('memory-pressure', handleMemoryPressure);
    
    // Set up accessibility
    if (config.accessibility) {
      updateAccessibilitySettings(config.accessibility);
    }
    
    // Set up privacy mode
    if (config.privacyMode) {
      setPrivacyMode(config.privacyMode);
    }
    
    // Publish initialization event
    publish('eye:tracking:initialized', { 
      timestamp: Date.now(),
      config
    });
    
    initialized = true;
    logger.info('Eye tracking system initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize eye tracking system', error);
    return false;
  }
}

/**
 * Start the eye tracking process
 * @returns {boolean} - Success status
 */
export function startProcessing() {
  if (!initialized) {
    logger.warn('Cannot start processing: eye tracking not initialized');
    return false;
  }
  
  if (processing) {
    logger.warn('Eye tracking already processing');
    return true;
  }
  
  processing = true;
  logger.info('Eye tracking processing started');
  
  publish('eye:tracking:started', {
    timestamp: Date.now(),
    config
  });
  
  return true;
}

/**
 * Stop the eye tracking process
 * @returns {boolean} - Success status
 */
export function stopProcessing() {
  if (!processing) {
    logger.warn('Eye tracking not processing');
    return true;
  }
  
  processing = false;
  logger.info('Eye tracking processing stopped');
  
  // Clean up calibration if in progress
  if (calibrating) {
    cancelCalibration();
  }
  
  publish('eye:tracking:stopped', {
    timestamp: Date.now()
  });
  
  return true;
}

/**
 * Pause the eye tracking process
 * @returns {boolean} - Success status
 */
export function pauseProcessing() {
  if (!processing) {
    logger.warn('Eye tracking not processing');
    return false;
  }
  
  processing = false;
  logger.info('Eye tracking processing paused');
  
  publish('eye:tracking:paused', {
    timestamp: Date.now()
  });
  
  return true;
}

/**
 * Resume the eye tracking process
 * @returns {boolean} - Success status
 */
export function resumeProcessing() {
  if (processing) {
    logger.warn('Eye tracking already processing');
    return true;
  }
  
  if (!initialized) {
    logger.warn('Cannot resume processing: eye tracking not initialized');
    return false;
  }
  
  processing = true;
  logger.info('Eye tracking processing resumed');
  
  publish('eye:tracking:resumed', {
    timestamp: Date.now()
  });
  
  return true;
}

/**
 * Process eye landmarks data
 * @param {Object} data - Eye landmarks data
 * @param {Array} data.leftEye - Left eye landmarks
 * @param {Array} data.rightEye - Right eye landmarks
 * @param {number} data.timestamp - Timestamp
 * @returns {Promise<boolean>} - Success status
 */
export async function processEyeData(data) {
  if (!processing) {
    return false;
  }
  
  try {
    const { leftEye, rightEye, timestamp } = data;
    
    // Calculate eye openness
    const leftEyeOpenness = calculateEyeOpenness(leftEye);
    const rightEyeOpenness = calculateEyeOpenness(rightEye);
    
    // Detect blinking
    const currentlyBlinking = isBlinking(leftEye, rightEye);
    
    // Handle blink state changes
    if (currentlyBlinking && !lastBlinkState) {
      // Blink started
      blinkStartTime = timestamp;
      publish('eye:blink:started', {
        timestamp,
        leftEyeOpenness,
        rightEyeOpenness
      });
    } else if (!currentlyBlinking && lastBlinkState && blinkStartTime) {
      // Blink ended
      const blinkDuration = timestamp - blinkStartTime;
      publish('eye:blink:detected', {
        timestamp,
        duration: blinkDuration,
        strength: 1 - ((leftEyeOpenness + rightEyeOpenness) / 2)
      });
      blinkStartTime = null;
    }
    
    lastBlinkState = currentlyBlinking;
    
    // Skip gaze estimation if eyes are closed
    if (currentlyBlinking) {
      return true;
    }
    
    // Calculate gaze point
    const gazePoint = getGazePoint(leftEye, rightEye);
    
    // Add to history
    if (lastGazePoint) {
      // Check for saccade
      const timeElapsed = timestamp - lastGazePoint.timestamp;
      const isSaccade = detectSaccade(lastGazePoint, gazePoint, timeElapsed);
      
      if (isSaccade) {
        publish('eye:saccade:detected', {
          timestamp,
          from: {
            x: lastGazePoint.x,
            y: lastGazePoint.y
          },
          to: {
            x: gazePoint.x,
            y: gazePoint.y
          },
          velocity: calculateVelocity(lastGazePoint, gazePoint, timeElapsed)
        });
      }
    }
    
    // Update gaze history
    gazePoint.timestamp = timestamp;
    gazeHistory.push(gazePoint);
    
    // Trim history if needed
    if (gazeHistory.length > HISTORY_MAX_LENGTH) {
      gazeHistory.shift();
    }
    
    lastGazePoint = gazePoint;
    
    // Publish gaze update
    publish('eye:gaze:updated', {
      timestamp,
      x: gazePoint.x,
      y: gazePoint.y,
      confidence: gazePoint.confidence
    });
    
    // Process dwell detection for eye-controlled clicking if enabled
    if (config.mobility.dwellClickEnabled) {
      processDwellDetection(gazePoint, timestamp);
    }
    
    // Handle calibration if active
    if (calibrating && calibrationData) {
      handleCalibrationGaze(gazePoint);
    }
    
    return true;
  } catch (error) {
    logger.error('Error processing eye data', error);
    return false;
  }
}

/**
 * Calculate eye openness based on landmarks
 * @param {Array} eyeLandmarks - Eye landmarks
 * @returns {number} - Eye openness value between 0 and 1
 */
export function calculateEyeOpenness(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) {
    return 0;
  }
  
  try {
    // Calculate vertical distance between upper and lower eyelids
    const upperY = (eyeLandmarks[1].y + eyeLandmarks[2].y) / 2;
    const lowerY = (eyeLandmarks[4].y + eyeLandmarks[5].y) / 2;
    const verticalDistance = Math.abs(upperY - lowerY);
    
    // Calculate horizontal distance as reference
    const horizontalDistance = Math.abs(eyeLandmarks[0].x - eyeLandmarks[3].x);
    
    // Normalize by horizontal distance to get relative openness
    const openness = verticalDistance / (horizontalDistance * 0.5);
    
    // Clamp between 0 and 1
    return Math.min(Math.max(openness, 0), 1);
  } catch (error) {
    logger.error('Error calculating eye openness', error);
    return 0;
  }
}

/**
 * Determine if eyes are blinking based on openness
 * @param {Array} leftEyeLandmarks - Left eye landmarks
 * @param {Array} rightEyeLandmarks - Right eye landmarks
 * @returns {boolean} - True if blinking
 */
export function isBlinking(leftEyeLandmarks, rightEyeLandmarks) {
  const leftEyeOpenness = calculateEyeOpenness(leftEyeLandmarks);
  const rightEyeOpenness = calculateEyeOpenness(rightEyeLandmarks);
  
  // Both eyes need to be below threshold to count as a blink
  return leftEyeOpenness < BLINK_THRESHOLD && rightEyeOpenness < BLINK_THRESHOLD;
}

/**
 * Calculate gaze point based on eye landmarks
 * @param {Array} leftEyeLandmarks - Left eye landmarks
 * @param {Array} rightEyeLandmarks - Right eye landmarks
 * @returns {Object} - Gaze point with x, y coordinates and confidence
 */
export function getGazePoint(leftEyeLandmarks, rightEyeLandmarks) {
  if (!leftEyeLandmarks || !rightEyeLandmarks) {
    return { x: 0, y: 0, confidence: 0 };
  }
  
  try {
    // Calculate eye centers
    const leftEyeCenter = getEyeCenter(leftEyeLandmarks);
    const rightEyeCenter = getEyeCenter(rightEyeLandmarks);
    
    // Calculate pupil positions (approximated from landmarks)
    const leftPupil = estimatePupilPosition(leftEyeLandmarks);
    const rightPupil = estimatePupilPosition(rightEyeLandmarks);
    
    // Calculate pupil offsets from center
    const leftOffset = {
      x: leftPupil.x - leftEyeCenter.x,
      y: leftPupil.y - leftEyeCenter.y
    };
    
    const rightOffset = {
      x: rightPupil.x - rightEyeCenter.x,
      y: rightPupil.y - rightEyeCenter.y
    };
    
    // Average the offsets
    const avgOffset = {
      x: (leftOffset.x + rightOffset.x) / 2,
      y: (leftOffset.y + rightOffset.y) / 2
    };
    
    // Calculate openness for confidence
    const leftOpenness = calculateEyeOpenness(leftEyeLandmarks);
    const rightOpenness = calculateEyeOpenness(rightEyeLandmarks);
    const avgOpenness = (leftOpenness + rightOpenness) / 2;
    
    // Apply calibration if available
    let calibratedX = window.innerWidth / 2;
    let calibratedY = window.innerHeight / 2;
    
    if (calibrationData && calibrationData.completed) {
      // Apply calibration mapping
      const mappedPoint = applyCalibrationMapping(avgOffset);
      calibratedX = mappedPoint.x;
      calibratedY = mappedPoint.y;
    } else {
      // Simple mapping without calibration
      // Map pupil offset to screen coordinates
      // This is a basic approximation - calibration provides better results
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Scale factors (these would be refined during calibration)
      const scaleX = screenWidth / 0.4;  // Assume pupil moves about 0.4 of eye width
      const scaleY = screenHeight / 0.4; // Assume pupil moves about 0.4 of eye height
      
      calibratedX = (screenWidth / 2) + (avgOffset.x * scaleX);
      calibratedY = (screenHeight / 2) + (avgOffset.y * scaleY);
    }
    
    // Calculate confidence based on eye openness and consistency
    const confidence = avgOpenness * 0.8;
    
    return {
      x: calibratedX,
      y: calibratedY,
      confidence
    };
  } catch (error) {
    logger.error('Error calculating gaze point', error);
    return { x: 0, y: 0, confidence: 0 };
  }
}

/**
 * Calculate the center point of an eye
 * @param {Array} eyeLandmarks - Eye landmarks
 * @returns {Object} - Center point with x, y coordinates
 */
function getEyeCenter(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) {
    return { x: 0, y: 0 };
  }
  
  // Calculate average of all landmarks
  let sumX = 0;
  let sumY = 0;
  
  for (const point of eyeLandmarks) {
    sumX += point.x;
    sumY += point.y;
  }
  
  return {
    x: sumX / eyeLandmarks.length,
    y: sumY / eyeLandmarks.length
  };
}

/**
 * Estimate pupil position from eye landmarks
 * @param {Array} eyeLandmarks - Eye landmarks
 * @returns {Object} - Pupil position with x, y coordinates
 */
function estimatePupilPosition(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) {
    return { x: 0, y: 0 };
  }
  
  // This is an approximation since face-api.js doesn't directly detect pupils
  // We use the center point of the eye with a bias toward the inner corners
  // A more accurate approach would use computer vision to detect the actual pupil
  
  const center = getEyeCenter(eyeLandmarks);
  
  // Calculate weighted average biased toward the darker regions (approximating pupil)
  // In a real implementation, this would use image processing to find the darkest region
  
  // For now, we'll just return the center as an approximation
  return center;
}

/**
 * Detect if a saccade (rapid eye movement) occurred
 * @param {Object} prevGaze - Previous gaze point
 * @param {Object} currentGaze - Current gaze point
 * @param {number} timeElapsed - Time elapsed in ms
 * @returns {boolean} - True if saccade detected
 */
export function detectSaccade(prevGaze, currentGaze, timeElapsed) {
  if (!prevGaze || !currentGaze || timeElapsed <= 0) {
    return false;
  }
  
  const velocity = calculateVelocity(prevGaze, currentGaze, timeElapsed);
  return velocity > SACCADE_VELOCITY_THRESHOLD;
}

/**
 * Calculate velocity between two gaze points
 * @param {Object} point1 - First point
 * @param {Object} point2 - Second point
 * @param {number} timeElapsed - Time elapsed in ms
 * @returns {number} - Velocity in pixels per second
 */
function calculateVelocity(point1, point2, timeElapsed) {
  const distance = Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + 
    Math.pow(point2.y - point1.y, 2)
  );
  
  // Convert to pixels per second
  return distance / (timeElapsed / 1000);
}

/**
 * Start calibration process
 * @param {Object} options - Calibration options
 * @param {number} options.points - Number of calibration points (5, 9, or 16)
 * @param {string} options.speed - Calibration speed (slow, normal, fast)
 * @returns {boolean} - Success status
 */
export function startCalibration(options = { points: 5, speed: 'normal' }) {
  if (calibrating) {
    logger.warn('Calibration already in progress');
    return false;
  }
  
  logger.info('Starting eye tracking calibration');
  
  calibrating = true;
  calibrationData = {
    points: options.points || 5,
    speed: options.speed || 'normal',
    currentPoint: 0,
    pointsData: [],
    completed: false
  };
  
  publish('eye:calibration:started', {
    timestamp: Date.now(),
    totalPoints: calibrationData.points,
    speed: calibrationData.speed
  });
  
  return true;
}

/**
 * Cancel calibration process
 * @returns {boolean} - Success status
 */
export function cancelCalibration() {
  if (!calibrating) {
    logger.warn('No calibration in progress');
    return false;
  }
  
  logger.info('Canceling eye tracking calibration');
  
  calibrating = false;
  
  publish('eye:calibration:canceled', {
    timestamp: Date.now()
  });
  
  calibrationData = null;
  return true;
}

/**
 * Handle calibration gaze data
 * @param {Object} gazePoint - Gaze point
 */
function handleCalibrationGaze(gazePoint) {
  if (!calibrating || !calibrationData) {
    return;
  }
  
  // Add gaze data to current calibration point
  if (!calibrationData.pointsData[calibrationData.currentPoint]) {
    calibrationData.pointsData[calibrationData.currentPoint] = [];
  }
  
  calibrationData.pointsData[calibrationData.currentPoint].push({
    x: gazePoint.x,
    y: gazePoint.y,
    confidence: gazePoint.confidence,
    timestamp: gazePoint.timestamp
  });
}

/**
 * Handle calibration point completion
 * @param {Object} data - Calibration point data
 */
function handleCalibrationPointComplete(data) {
  if (!calibrating || !calibrationData) {
    return;
  }
  
  // Move to next point
  calibrationData.currentPoint++;
  
  // Check if calibration is complete
  if (data.isLast || calibrationData.currentPoint >= calibrationData.points) {
    completeCalibration();
  } else {
    // Publish next point event
    publish('eye:calibration:next-point', {
      timestamp: Date.now(),
      pointIndex: calibrationData.currentPoint,
      totalPoints: calibrationData.points
    });
  }
}

/**
 * Complete calibration process
 */
function completeCalibration() {
  if (!calibrating || !calibrationData) {
    return;
  }
  
  logger.info('Completing eye tracking calibration');
  
  // Process calibration data
  const mappingQuality = calculateCalibrationQuality();
  
  // Set calibration as completed
  calibrationData.completed = true;
  
  // Publish completion event
  publish('eye:calibration:completed', {
    timestamp: Date.now(),
    accuracy: mappingQuality.accuracy,
    mappingQuality: mappingQuality.quality
  });
  
  calibrating = false;
}

/**
 * Calculate calibration quality
 * @returns {Object} - Calibration quality metrics
 */
function calculateCalibrationQuality() {
  // In a real implementation, this would analyze the collected calibration data
  // and calculate accuracy metrics
  
  // For now, return placeholder values
  return {
    accuracy: 0.85,
    quality: 'good'
  };
}

/**
 * Apply calibration mapping to raw gaze data
 * @param {Object} offset - Raw pupil offset
 * @returns {Object} - Mapped screen coordinates
 */
function applyCalibrationMapping(offset) {
  // In a real implementation, this would use the calibration data
  // to map eye movements to screen coordinates
  
  // For now, return a simple mapping
  return {
    x: window.innerWidth / 2 + (offset.x * window.innerWidth),
    y: window.innerHeight / 2 + (offset.y * window.innerHeight)
  };
}

/**
 * Update accessibility settings
 * @param {Object} settings - Accessibility settings
 * @returns {boolean} - Success status
 */
export function updateAccessibilitySettings(settings) {
  if (!settings) {
    return false;
  }
  
  logger.info('Updating eye tracking accessibility settings');
  
  config.accessibility = {
    ...config.accessibility,
    ...settings
  };
  
  publish('eye:accessibility:updated', config.accessibility);
  return true;
}

/**
 * Set privacy mode
 * @param {string} mode - Privacy mode (none, blur, abstract)
 * @returns {boolean} - Success status
 */
export function setPrivacyMode(mode) {
  if (!VALID_PRIVACY_MODES.includes(mode)) {
    logger.warn(`Invalid privacy mode: ${mode}`);
    return false;
  }
  
  logger.info(`Setting eye tracking privacy mode to: ${mode}`);
  
  config.privacyMode = mode;
  
  publish('eye:privacy:updated', { mode });
  return true;
}

/**
 * Handle face detected event
 * @param {Object} faceData - Face detection data
 */
function handleFaceDetected(faceData) {
  if (!processing) {
    return;
  }
  
  // Extract eye landmarks
  const leftEye = faceData.landmarks.getLeftEye();
  const rightEye = faceData.landmarks.getRightEye();
  
  // Process eye data
  processEyeData({
    leftEye,
    rightEye,
    timestamp: Date.now()
  });
}

/**
 * Handle face lost event
 */
function handleFaceLost() {
  // Reset blink state
  lastBlinkState = false;
  blinkStartTime = null;
  
  publish('eye:tracking:face-lost', {
    timestamp: Date.now()
  });
}

/**
 * Handle memory pressure event
 * @param {Event} event - Memory pressure event
 */
function handleMemoryPressure(event) {
  if (!processing) {
    return;
  }
  
  // Adapt processing based on memory pressure
  if (event.pressure === 'critical') {
    // Reduce processing frequency
    processingInterval = Math.min(processingInterval * 2, 200);
    
    publish('eye:tracking:adaptation', {
      timestamp: Date.now(),
      reason: 'memory-pressure',
      processingInterval
    });
  }
}

/**
 * Handle mobility profile updates
 * @param {Object} data - Mobility profile data
 */
function handleMobilityProfileUpdate(data) {
  if (data && data.profile) {
    // Adapt eye tracking based on mobility profile
    const { hasLimitedMobility, canUseHands, preferredInputMethod } = data.profile;
    
    // Update configuration based on mobility profile
    config.mobility.adaptToLimitedMobility = hasLimitedMobility;
    config.mobility.isEyeControlPrimary = preferredInputMethod === 'eye' || !canUseHands;
    
    // Apply more sensitive settings for users who rely on eye control
    if (hasLimitedMobility && !canUseHands) {
      // For users who can't use hands at all, optimize for eye control
      config.mobility.enhancedPrecision = true;
      config.mobility.sensitivityLevel = 'high';
      config.mobility.dwellClickEnabled = true;
      config.mobility.dwellTime = 800; // Faster dwell time for experienced users
      
      // Update processing interval for more responsive eye tracking
      processingInterval = 30; // ~33fps
      
      // Enable accessibility features that help with eye control
      updateAccessibilitySettings({
        largerTargets: true,
        slowerAnimations: true,
        extraTime: true
      });
      
      logger.info('Eye tracking optimized for primary eye control');
    } else if (hasLimitedMobility) {
      // For users with limited mobility but some hand control
      config.mobility.enhancedPrecision = true;
      config.mobility.sensitivityLevel = 'medium-high';
      config.mobility.dwellClickEnabled = preferredInputMethod === 'eye';
      config.mobility.dwellTime = 1000; // Standard dwell time
      
      // Standard processing interval
      processingInterval = 50; // 20fps
      
      logger.info('Eye tracking adapted for limited mobility');
    } else {
      // For users with full mobility
      config.mobility.enhancedPrecision = false;
      config.mobility.sensitivityLevel = 'medium';
      config.mobility.dwellClickEnabled = false;
      
      // Standard processing interval
      processingInterval = 50; // 20fps
      
      logger.info('Eye tracking using standard settings');
    }
    
    // If processing is active, update the processing interval
    if (processing) {
      stopProcessing();
      startProcessing();
    }
    
    // Publish updated configuration
    publish('eye:config:updated', { 
      mobility: config.mobility,
      processingInterval
    });
  }
}

/**
 * Handle eye control toggle
 * @param {Object} data - Eye control data
 */
function handleEyeControlToggle(data) {
  if (data && typeof data.enabled === 'boolean') {
    if (data.enabled && !processing) {
      // Start eye tracking if not already started
      startProcessing();
      
      // Enable enhanced precision for eye control
      config.mobility.enhancedPrecision = true;
      
      logger.info('Eye control enabled');
    } else if (!data.enabled && processing && !config.mobility.adaptToLimitedMobility) {
      // Only stop processing if we're not in adaptive mode for limited mobility
      // (in adaptive mode, we keep eye tracking running for other features)
      stopProcessing();
      
      logger.info('Eye control disabled');
    }
  }
}

/**
 * Handle dwell click toggle
 * @param {Object} data - Dwell click data
 */
function handleDwellClickToggle(data) {
  if (data && typeof data.enabled === 'boolean') {
    config.mobility.dwellClickEnabled = data.enabled;
    
    if (data.enabled) {
      // Make sure eye tracking is active when dwell clicks are enabled
      if (!processing) {
        startProcessing();
      }
      
      logger.info('Dwell clicks enabled');
    } else {
      logger.info('Dwell clicks disabled');
    }
    
    // Publish updated configuration
    publish('eye:config:updated', { 
      mobility: config.mobility 
    });
  }
}

/**
 * Handle adaptive mode changes
 * @param {Object} data - Adaptive mode data
 */
function handleAdaptiveModeChange(data) {
  if (data && typeof data.enabled === 'boolean') {
    // Request current mobility profile to adapt accordingly
    if (data.enabled) {
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
      config.mobility.enhancedPrecision = false;
      config.mobility.sensitivityLevel = 'medium';
      config.mobility.dwellClickEnabled = false;
      processingInterval = 50; // 20fps
      
      // If processing is active, update the processing interval
      if (processing) {
        stopProcessing();
        startProcessing();
      }
      
      logger.info('Eye tracking reset to standard settings');
    }
  }
}

// Variables for dwell detection (module scope to persist between calls)
let dwellStartTime = 0;
let dwellPosition = null;
let isDwelling = false;
const DWELL_RADIUS = 30; // pixels

/**
 * Process dwell detection for eye-controlled clicking
 * @param {Object} gazePoint - Current gaze point
 * @param {number} timestamp - Current timestamp
 */
function processDwellDetection(gazePoint, timestamp) {
  // Skip if dwell clicks are not enabled
  if (!config.mobility.dwellClickEnabled || !gazePoint) return;
  
  // Check if gaze is within dwell radius of the dwell position
  const isWithinDwellRadius = (pos1, pos2) => {
    if (!pos1 || !pos2) return false;
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy) <= DWELL_RADIUS;
  };
  
  if (!isDwelling) {
    // Start a new dwell
    dwellStartTime = timestamp;
    dwellPosition = { ...gazePoint };
    isDwelling = true;
  } else if (!isWithinDwellRadius(gazePoint, dwellPosition)) {
    // Reset dwell if gaze moved outside radius
    isDwelling = false;
  } else if (timestamp - dwellStartTime >= config.mobility.dwellTime) {
    // Dwell completed, trigger click event
    publish('eye:dwell:completed', {
      x: dwellPosition.x,
      y: dwellPosition.y,
      timestamp
    });
    
    // Reset dwell state
    isDwelling = false;
    
    logger.debug('Dwell click triggered at', dwellPosition);
  }
}

/**
 * Clean up resources
 */
function cleanup() {
  try {
    // Stop processing
    stopProcessing();
    
    // Unsubscribe from events
    unsubscribe('face:detected', handleFaceDetected);
    unsubscribe('face:lost', handleFaceLost);
    unsubscribe('eye:calibration:point:complete', handleCalibrationPointComplete);
    unsubscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
    unsubscribe('accessibility:mobility:eye_control', handleEyeControlToggle);
    unsubscribe('accessibility:mobility:dwell_click', handleDwellClickToggle);
    unsubscribe('accessibility:mobility:adaptive_mode', handleAdaptiveModeChange);
    
    // Remove event listeners
    window.removeEventListener('memory-pressure', handleMemoryPressure);
    
    // Clear data
    gazeHistory = [];
    calibrationData = null;
    lastGazePoint = null;
    
    // Reset state
    initialized = false;
    processing = false;
    calibrating = false;
    
    logger.info('Eye tracking system cleaned up');
    return true;
  } catch (error) {
    logger.error('Failed to clean up eye tracking system', error);
    return false;
  }
}

/**
 * Export additional functions for testing and advanced usage
 */
export default {
  initialize,
  startProcessing,
  stopProcessing,
  pauseProcessing,
  resumeProcessing,
  processEyeData,
  calculateEyeOpenness,
  isBlinking,
  getGazePoint,
  detectSaccade,
  startCalibration,
  cancelCalibration,
  updateAccessibilitySettings,
  setPrivacyMode,
  // Mobility assistance functions
  handleMobilityProfileUpdate,
  handleEyeControlToggle,
  handleDwellClickToggle,
  handleAdaptiveModeChange,
  processDwellDetection,
  cleanup
};
