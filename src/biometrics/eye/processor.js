/**
 * ALEJO Eye Processor Module
 * 
 * Provides continuous eye processing from video stream:
 * - Integrates with eye tracking and calibration modules
 * - Processes video frames to extract eye data
 * - Applies privacy filters
 * - Handles adaptive processing rate
 * - Provides debug visualization
 * - Publishes eye tracking events
 * 
 * All processing happens locally on the client device to maintain privacy.
 */

import { publish, subscribe } from '../../core/event-bus.js';
import * as eyeTracking from './tracking.js';
import * as eyeCalibration from './calibration.js';

// State
let isInitialized = false;
let isProcessing = false;
let isPaused = false;
let videoElement = null;
let canvasElement = null;
let canvasContext = null;
let processingInterval = null;
let lastProcessingTime = 0;
let frameSkipCounter = 0;
let fpsHistory = [];
let lastFrameTime = 0;

// Default configuration
const DEFAULT_CONFIG = {
  processingIntervalMs: 50, // How often to process frames (ms)
  adaptiveProcessing: true, // Adjust processing rate based on performance
  maxProcessingTime: 33, // Maximum time for processing a frame (ms)
  frameSkipThreshold: 5, // Skip frames if processing takes too long
  debugMode: false, // Show debug visualization
  privacyMode: 'none', // 'none', 'blur', 'mask'
  privacyBlurAmount: 15, // Blur amount for privacy mode
  drawLandmarks: true, // Draw eye landmarks
  drawGaze: true, // Draw gaze direction
  drawPupils: true, // Draw detected pupils
  confidenceThreshold: 0.6, // Minimum confidence for detection
  smoothingFactor: 0.7, // Smoothing factor for eye movements (0-1)
  performanceMode: 'balanced', // 'performance', 'balanced', 'quality'
  lowMemoryMode: false, // Reduce memory usage
  accessibilityMode: false // Enable accessibility features
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

// Performance metrics
const performanceMetrics = {
  fps: 0,
  processingTime: 0,
  skippedFrames: 0,
  totalFrames: 0,
  memoryUsage: 0,
  lastReportTime: 0
};

/**
 * Initialize eye processor
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Eye processor API
 */
export async function initializeProcessor(options = {}) {
  if (isInitialized) {
    console.warn('Eye processor already initialized');
    return getPublicAPI();
  }
  
  console.log('Initializing ALEJO Eye Processor');
  
  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options
  };
  
  try {
    // Initialize eye tracking and calibration
    await eyeTracking.initializeEyeTracking(options.tracking || {});
    await eyeCalibration.initializeCalibration(options.calibration || {});
    
    // Set up event listeners
    setupEventListeners();
    
    isInitialized = true;
    publish('eye:processor:initialized');
    
    return getPublicAPI();
  } catch (error) {
    console.error('Failed to initialize eye processor:', error);
    publish('eye:processor:error', { 
      message: 'Failed to initialize eye processor', 
      error 
    });
    throw error;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for configuration changes
  subscribe('biometrics:config:updated', (event) => {
    if (event.newConfig.eyeProcessor) {
      updateConfig(event.newConfig.eyeProcessor);
    }
  });
  
  // Listen for video stream events
  subscribe('biometrics:video:ready', (event) => {
    setVideoSource(event.videoElement);
  });
  
  // Listen for performance monitoring events
  subscribe('performance:memory:low', () => {
    handleLowMemory();
  });
  
  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Set video source for processing
 * @param {HTMLVideoElement} video - Video element
 */
export function setVideoSource(video) {
  if (!video || !(video instanceof HTMLVideoElement)) {
    console.error('Invalid video element provided to eye processor');
    return;
  }
  
  videoElement = video;
  
  // Create canvas for processing if needed
  if (!canvasElement) {
    canvasElement = document.createElement('canvas');
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    canvasContext = canvasElement.getContext('2d');
  }
  
  // Update canvas dimensions when video metadata is loaded
  if (videoElement.videoWidth === 0) {
    videoElement.addEventListener('loadedmetadata', () => {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
    });
  }
  
  publish('eye:processor:video:set', {
    width: canvasElement.width,
    height: canvasElement.height
  });
}

/**
 * Start processing video frames
 * @param {Object} options - Optional start options
 * @returns {boolean} - Whether processing was started
 */
export function startProcessing(options = {}) {
  if (!isInitialized || !videoElement) {
    console.error('Cannot start eye processing: not initialized or no video source');
    return false;
  }
  
  if (isProcessing && !isPaused) {
    console.warn('Eye processing already started');
    return true;
  }
  
  // If paused, resume
  if (isPaused) {
    return resumeProcessing();
  }
  
  // Apply any options
  if (Object.keys(options).length > 0) {
    updateConfig(options);
  }
  
  console.log('Starting eye processing');
  
  isProcessing = true;
  isPaused = false;
  lastProcessingTime = 0;
  frameSkipCounter = 0;
  fpsHistory = [];
  lastFrameTime = performance.now();
  performanceMetrics.lastReportTime = performance.now();
  
  // Start processing loop
  processingInterval = setInterval(processFrame, config.processingIntervalMs);
  
  publish('eye:processor:started');
  
  return true;
}

/**
 * Stop processing video frames
 * @returns {boolean} - Whether processing was stopped
 */
export function stopProcessing() {
  if (!isProcessing) {
    console.warn('Eye processing already stopped');
    return true;
  }
  
  console.log('Stopping eye processing');
  
  isProcessing = false;
  isPaused = false;
  
  // Clear processing interval
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
  
  publish('eye:processor:stopped');
  
  return true;
}

/**
 * Pause processing video frames
 * @returns {boolean} - Whether processing was paused
 */
export function pauseProcessing() {
  if (!isProcessing || isPaused) {
    console.warn('Eye processing not running or already paused');
    return false;
  }
  
  console.log('Pausing eye processing');
  
  isPaused = true;
  
  // Clear processing interval
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
  
  publish('eye:processor:paused');
  
  return true;
}

/**
 * Resume processing video frames
 * @returns {boolean} - Whether processing was resumed
 */
export function resumeProcessing() {
  if (!isProcessing || !isPaused) {
    console.warn('Eye processing not paused');
    return false;
  }
  
  console.log('Resuming eye processing');
  
  isPaused = false;
  lastFrameTime = performance.now();
  
  // Restart processing loop
  processingInterval = setInterval(processFrame, config.processingIntervalMs);
  
  publish('eye:processor:resumed');
  
  return true;
}

/**
 * Process a single video frame
 */
async function processFrame() {
  if (!isProcessing || isPaused || !videoElement || !canvasContext) {
    return;
  }
  
  const startTime = performance.now();
  
  // Calculate FPS
  const currentTime = performance.now();
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  const currentFps = 1000 / deltaTime;
  fpsHistory.push(currentFps);
  if (fpsHistory.length > 10) {
    fpsHistory.shift();
  }
  
  performanceMetrics.fps = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;
  
  // Skip frames if processing is taking too long
  if (config.adaptiveProcessing && lastProcessingTime > config.maxProcessingTime) {
    frameSkipCounter++;
    
    if (frameSkipCounter <= config.frameSkipThreshold) {
      performanceMetrics.skippedFrames++;
      return;
    }
    
    frameSkipCounter = 0;
  }
  
  performanceMetrics.totalFrames++;
  
  try {
    // Draw video frame to canvas
    canvasContext.drawImage(
      videoElement, 
      0, 0, 
      canvasElement.width, 
      canvasElement.height
    );
    
    // Apply privacy filter if enabled
    if (config.privacyMode !== 'none') {
      applyPrivacyFilter();
    }
    
    // Extract face data from the main biometrics module
    // This would be provided by the face detection module in a real implementation
    const faceData = await getFaceDataFromBiometrics();
    
    if (!faceData) {
      // No face detected
      return;
    }
    
    // Process eye data
    const eyeData = extractEyeData(faceData);
    
    // Draw debug visualization if enabled
    if (config.debugMode) {
      drawDebugVisualization(faceData, eyeData);
    }
    
    // Publish eye data
    publishEyeData(eyeData);
    
  } catch (error) {
    console.error('Error processing eye frame:', error);
    publish('eye:processor:error', {
      message: 'Error processing eye frame',
      error
    });
  }
  
  // Update performance metrics
  lastProcessingTime = performance.now() - startTime;
  performanceMetrics.processingTime = lastProcessingTime;
  
  // Report performance metrics periodically
  if (currentTime - performanceMetrics.lastReportTime > 5000) {
    reportPerformanceMetrics();
    performanceMetrics.lastReportTime = currentTime;
  }
}

/**
 * Apply privacy filter to the canvas
 */
function applyPrivacyFilter() {
  if (!canvasContext) {
    return;
  }
  
  if (config.privacyMode === 'blur') {
    // Apply blur filter
    // Note: This is a simplified implementation
    // A real implementation would use a more efficient blur algorithm
    canvasContext.filter = `blur(${config.privacyBlurAmount}px)`;
    canvasContext.drawImage(canvasElement, 0, 0);
    canvasContext.filter = 'none';
  } else if (config.privacyMode === 'mask') {
    // Apply mask (black out eyes)
    // This would use face landmarks to identify eye regions
    // and black them out
    
    // Simplified implementation - would be replaced with actual eye masking
    const eyeRegions = [
      { x: 100, y: 100, width: 50, height: 30 },
      { x: 200, y: 100, width: 50, height: 30 }
    ];
    
    canvasContext.fillStyle = '#000000';
    eyeRegions.forEach(region => {
      canvasContext.fillRect(region.x, region.y, region.width, region.height);
    });
  }
}

/**
 * Get face data from biometrics module
 * @returns {Promise<Object|null>} - Face data or null if no face detected
 */
async function getFaceDataFromBiometrics() {
  // In a real implementation, this would get data from the face detection module
  // For now, we'll simulate face data
  
  // Check if we should simulate a face detection
  const shouldDetect = Math.random() > 0.1; // 90% chance of detection
  
  if (!shouldDetect) {
    return null;
  }
  
  // Simulate face data
  return {
    boundingBox: {
      x: canvasElement.width * 0.3,
      y: canvasElement.height * 0.2,
      width: canvasElement.width * 0.4,
      height: canvasElement.height * 0.6
    },
    landmarks: {
      leftEye: [
        { x: canvasElement.width * 0.35, y: canvasElement.height * 0.4 },
        { x: canvasElement.width * 0.38, y: canvasElement.height * 0.38 },
        { x: canvasElement.width * 0.41, y: canvasElement.height * 0.39 },
        { x: canvasElement.width * 0.41, y: canvasElement.height * 0.41 },
        { x: canvasElement.width * 0.38, y: canvasElement.height * 0.42 },
        { x: canvasElement.width * 0.35, y: canvasElement.height * 0.41 }
      ],
      rightEye: [
        { x: canvasElement.width * 0.55, y: canvasElement.height * 0.4 },
        { x: canvasElement.width * 0.58, y: canvasElement.height * 0.38 },
        { x: canvasElement.width * 0.61, y: canvasElement.height * 0.39 },
        { x: canvasElement.width * 0.61, y: canvasElement.height * 0.41 },
        { x: canvasElement.width * 0.58, y: canvasElement.height * 0.42 },
        { x: canvasElement.width * 0.55, y: canvasElement.height * 0.41 }
      ],
      leftEyeCenter: { 
        x: canvasElement.width * 0.38, 
        y: canvasElement.height * 0.4 
      },
      rightEyeCenter: { 
        x: canvasElement.width * 0.58, 
        y: canvasElement.height * 0.4 
      },
      leftPupil: { 
        x: canvasElement.width * 0.38 + Math.random() * 6 - 3, 
        y: canvasElement.height * 0.4 + Math.random() * 6 - 3 
      },
      rightPupil: { 
        x: canvasElement.width * 0.58 + Math.random() * 6 - 3, 
        y: canvasElement.height * 0.4 + Math.random() * 6 - 3 
      }
    },
    confidence: 0.95
  };
}

/**
 * Extract eye data from face data
 * @param {Object} faceData - Face detection data
 * @returns {Object} - Extracted eye data
 */
function extractEyeData(faceData) {
  if (!faceData || !faceData.landmarks) {
    return null;
  }
  
  const { landmarks } = faceData;
  
  // Calculate eye openness
  const leftEyeOpenness = calculateEyeOpenness(landmarks.leftEye);
  const rightEyeOpenness = calculateEyeOpenness(landmarks.rightEye);
  
  // Calculate pupil position relative to eye center
  const leftPupilOffset = {
    x: landmarks.leftPupil.x - landmarks.leftEyeCenter.x,
    y: landmarks.leftPupil.y - landmarks.leftEyeCenter.y
  };
  
  const rightPupilOffset = {
    x: landmarks.rightPupil.x - landmarks.rightEyeCenter.x,
    y: landmarks.rightPupil.y - landmarks.rightEyeCenter.y
  };
  
  // Calculate gaze direction
  const gazeDirection = calculateGazeDirection(leftPupilOffset, rightPupilOffset);
  
  // Detect blink
  const isBlinking = (leftEyeOpenness + rightEyeOpenness) / 2 < 0.3;
  
  return {
    timestamp: Date.now(),
    leftEye: {
      center: landmarks.leftEyeCenter,
      pupil: landmarks.leftPupil,
      openness: leftEyeOpenness,
      pupilOffset: leftPupilOffset
    },
    rightEye: {
      center: landmarks.rightEyeCenter,
      pupil: landmarks.rightPupil,
      openness: rightEyeOpenness,
      pupilOffset: rightPupilOffset
    },
    gaze: gazeDirection,
    isBlinking,
    confidence: faceData.confidence
  };
}

/**
 * Calculate eye openness from eye landmarks
 * @param {Array} eyeLandmarks - Eye landmark points
 * @returns {number} - Eye openness (0-1)
 */
function calculateEyeOpenness(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) {
    return 0;
  }
  
  // Calculate vertical distance between upper and lower eyelids
  const upperPoint = eyeLandmarks[1]; // Upper eyelid
  const lowerPoint = eyeLandmarks[4]; // Lower eyelid
  
  // Calculate horizontal distance as reference
  const leftPoint = eyeLandmarks[0]; // Left corner
  const rightPoint = eyeLandmarks[3]; // Right corner
  
  const verticalDistance = Math.sqrt(
    Math.pow(upperPoint.y - lowerPoint.y, 2) + 
    Math.pow(upperPoint.x - lowerPoint.x, 2)
  );
  
  const horizontalDistance = Math.sqrt(
    Math.pow(leftPoint.y - rightPoint.y, 2) + 
    Math.pow(leftPoint.x - rightPoint.x, 2)
  );
  
  // Normalize openness
  return Math.min(1, Math.max(0, verticalDistance / (horizontalDistance * 0.5)));
}

/**
 * Calculate gaze direction from pupil offsets
 * @param {Object} leftPupilOffset - Left pupil offset
 * @param {Object} rightPupilOffset - Right pupil offset
 * @returns {Object} - Gaze direction
 */
function calculateGazeDirection(leftPupilOffset, rightPupilOffset) {
  // Average the offsets from both eyes
  const offsetX = (leftPupilOffset.x + rightPupilOffset.x) / 2;
  const offsetY = (leftPupilOffset.y + rightPupilOffset.y) / 2;
  
  // Normalize to -1 to 1 range
  const normalizedX = offsetX / 10; // Adjust divisor based on eye size
  const normalizedY = offsetY / 5;
  
  // Calculate screen coordinates
  const { innerWidth, innerHeight } = window;
  const screenX = innerWidth * (0.5 + normalizedX / 2);
  const screenY = innerHeight * (0.5 + normalizedY / 2);
  
  return {
    x: normalizedX,
    y: normalizedY,
    screenPoint: { x: screenX, y: screenY },
    confidence: 0.8
  };
}

/**
 * Draw debug visualization
 * @param {Object} faceData - Face detection data
 * @param {Object} eyeData - Extracted eye data
 */
function drawDebugVisualization(faceData, eyeData) {
  if (!canvasContext || !config.debugMode) {
    return;
  }
  
  // Draw face bounding box
  canvasContext.strokeStyle = '#00FF00';
  canvasContext.lineWidth = 2;
  canvasContext.strokeRect(
    faceData.boundingBox.x,
    faceData.boundingBox.y,
    faceData.boundingBox.width,
    faceData.boundingBox.height
  );
  
  // Draw eye landmarks
  if (config.drawLandmarks) {
    // Left eye
    drawEyeLandmarks(faceData.landmarks.leftEye, '#FFFF00');
    
    // Right eye
    drawEyeLandmarks(faceData.landmarks.rightEye, '#FFFF00');
  }
  
  // Draw pupils
  if (config.drawPupils) {
    // Left pupil
    canvasContext.beginPath();
    canvasContext.arc(
      faceData.landmarks.leftPupil.x,
      faceData.landmarks.leftPupil.y,
      5,
      0,
      Math.PI * 2
    );
    canvasContext.fillStyle = '#FF0000';
    canvasContext.fill();
    
    // Right pupil
    canvasContext.beginPath();
    canvasContext.arc(
      faceData.landmarks.rightPupil.x,
      faceData.landmarks.rightPupil.y,
      5,
      0,
      Math.PI * 2
    );
    canvasContext.fillStyle = '#FF0000';
    canvasContext.fill();
  }
  
  // Draw gaze direction
  if (config.drawGaze && eyeData && eyeData.gaze) {
    const leftEyeCenter = faceData.landmarks.leftEyeCenter;
    const rightEyeCenter = faceData.landmarks.rightEyeCenter;
    const gazeLength = 50;
    
    // Calculate gaze end points
    const leftGazeEnd = {
      x: leftEyeCenter.x + eyeData.gaze.x * gazeLength,
      y: leftEyeCenter.y + eyeData.gaze.y * gazeLength
    };
    
    const rightGazeEnd = {
      x: rightEyeCenter.x + eyeData.gaze.x * gazeLength,
      y: rightEyeCenter.y + eyeData.gaze.y * gazeLength
    };
    
    // Draw gaze lines
    canvasContext.beginPath();
    canvasContext.moveTo(leftEyeCenter.x, leftEyeCenter.y);
    canvasContext.lineTo(leftGazeEnd.x, leftGazeEnd.y);
    canvasContext.moveTo(rightEyeCenter.x, rightEyeCenter.y);
    canvasContext.lineTo(rightGazeEnd.x, rightGazeEnd.y);
    canvasContext.strokeStyle = '#00FFFF';
    canvasContext.lineWidth = 2;
    canvasContext.stroke();
  }
  
  // Draw performance metrics
  drawPerformanceMetrics();
}

/**
 * Draw eye landmarks
 * @param {Array} landmarks - Eye landmark points
 * @param {string} color - Color to draw with
 */
function drawEyeLandmarks(landmarks, color) {
  if (!canvasContext || !landmarks || landmarks.length === 0) {
    return;
  }
  
  // Draw points
  landmarks.forEach(point => {
    canvasContext.beginPath();
    canvasContext.arc(point.x, point.y, 2, 0, Math.PI * 2);
    canvasContext.fillStyle = color;
    canvasContext.fill();
  });
  
  // Connect points
  canvasContext.beginPath();
  canvasContext.moveTo(landmarks[0].x, landmarks[0].y);
  
  for (let i = 1; i < landmarks.length; i++) {
    canvasContext.lineTo(landmarks[i].x, landmarks[i].y);
  }
  
  // Close the shape
  canvasContext.lineTo(landmarks[0].x, landmarks[0].y);
  
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = 1;
  canvasContext.stroke();
}

/**
 * Draw performance metrics
 */
function drawPerformanceMetrics() {
  if (!canvasContext) {
    return;
  }
  
  const metrics = [
    `FPS: ${performanceMetrics.fps.toFixed(1)}`,
    `Processing: ${performanceMetrics.processingTime.toFixed(1)}ms`,
    `Skipped: ${performanceMetrics.skippedFrames}`,
    `Total: ${performanceMetrics.totalFrames}`
  ];
  
  canvasContext.font = '14px Arial';
  canvasContext.fillStyle = '#FFFFFF';
  canvasContext.strokeStyle = '#000000';
  canvasContext.lineWidth = 3;
  
  metrics.forEach((text, index) => {
    const y = 20 + (index * 20);
    canvasContext.strokeText(text, 10, y);
    canvasContext.fillText(text, 10, y);
  });
}

/**
 * Publish eye data
 * @param {Object} eyeData - Extracted eye data
 */
function publishEyeData(eyeData) {
  if (!eyeData) {
    return;
  }
  
  // Only publish if confidence is above threshold
  if (eyeData.confidence < config.confidenceThreshold) {
    return;
  }
  
  publish('eye:tracking:update', eyeData);
  
  // Publish blink events
  if (eyeData.isBlinking) {
    publish('eye:blink:detected', {
      timestamp: eyeData.timestamp,
      leftEyeOpenness: eyeData.leftEye.openness,
      rightEyeOpenness: eyeData.rightEye.openness
    });
  }
}

/**
 * Report performance metrics
 */
function reportPerformanceMetrics() {
  publish('eye:processor:performance', {
    ...performanceMetrics,
    timestamp: Date.now()
  });
  
  // Reset skipped frames counter
  performanceMetrics.skippedFrames = 0;
}

/**
 * Handle low memory condition
 */
function handleLowMemory() {
  console.warn('Low memory detected, adjusting eye processor settings');
  
  // Reduce processing quality
  updateConfig({
    processingIntervalMs: Math.max(config.processingIntervalMs, 100),
    frameSkipThreshold: Math.max(config.frameSkipThreshold, 10),
    debugMode: false,
    lowMemoryMode: true
  });
  
  publish('eye:processor:low:memory:mode');
}

/**
 * Handle visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Pause processing when tab is not visible
    if (isProcessing && !isPaused) {
      pauseProcessing();
    }
  } else {
    // Resume processing when tab becomes visible again
    if (isProcessing && isPaused) {
      resumeProcessing();
    }
  }
}

/**
 * Update configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateConfig(newConfig) {
  // Update configuration
  config = {
    ...config,
    ...newConfig
  };
  
  // Update processing interval if running
  if (isProcessing && !isPaused && processingInterval) {
    clearInterval(processingInterval);
    processingInterval = setInterval(processFrame, config.processingIntervalMs);
  }
  
  publish('eye:processor:config:updated', { 
    newConfig: config
  });
}

/**
 * Get debug canvas
 * @returns {HTMLCanvasElement|null} - Debug canvas element
 */
export function getDebugCanvas() {
  return canvasElement;
}

/**
 * Get the public API for eye processor
 * @returns {Object} - Eye processor API
 */
function getPublicAPI() {
  return {
    isInitialized: () => isInitialized,
    isProcessing: () => isProcessing,
    isPaused: () => isPaused,
    getConfig: () => ({ ...config }),
    getPerformanceMetrics: () => ({ ...performanceMetrics }),
    setVideoSource,
    startProcessing,
    stopProcessing,
    pauseProcessing,
    resumeProcessing,
    updateConfig,
    getDebugCanvas
  };
}

export default {
  initializeProcessor,
  setVideoSource,
  startProcessing,
  stopProcessing,
  pauseProcessing,
  resumeProcessing,
  updateConfig,
  getDebugCanvas
};
