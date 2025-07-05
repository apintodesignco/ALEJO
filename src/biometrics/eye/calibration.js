/**
 * ALEJO Eye Calibration Module
 * 
 * Provides calibration functionality for the eye tracking system:
 * - Multi-point calibration procedure
 * - Calibration accuracy assessment
 * - Calibration visualization
 * - Accessibility-focused calibration options
 * 
 * All processing happens locally on the client device to maintain privacy.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// State
let isInitialized = false;
let isCalibrating = false;
let currentCalibrationPoint = 0;

// Calibration data
const calibrationData = {
  points: [],
  targetPoints: [],
  accuracy: 0,
  lastCalibrationTime: 0,
  isCalibrated: false,
  calibrationMatrix: null,
  pointResults: []
};

// Default configuration
const DEFAULT_CONFIG = {
  numPoints: 9, // Number of calibration points (9 is standard, can be 5 for quick calibration)
  pointDuration: 2000, // How long to show each point (ms)
  pointSize: 20, // Size of calibration point in pixels
  pointColor: '#FF0000', // Color of calibration point
  animatePoints: true, // Whether to animate points (pulsing)
  showFeedback: true, // Whether to show feedback during calibration
  audioFeedback: false, // Whether to provide audio feedback
  autoAdvance: true, // Whether to automatically advance to next point
  validationPoints: 4, // Number of validation points to show after calibration
  requireMinimumAccuracy: true, // Whether to require minimum accuracy
  minimumAccuracy: 0.7, // Minimum required accuracy (0-1)
  calibrationTimeout: 30000, // Maximum time for calibration (ms)
  accessibility: {
    highContrastMode: false, // High contrast calibration points
    largerTargets: false, // Larger calibration targets
    slowerAnimation: false, // Slower animations
    voicePrompts: false, // Voice prompts for each calibration step
    extraTime: false // Extra time for each calibration point
  }
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

// DOM elements
let calibrationContainer = null;
let calibrationCanvas = null;
let calibrationContext = null;

/**
 * Initialize eye calibration
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Calibration API
 */
export async function initializeCalibration(options = {}) {
  if (isInitialized) {
    console.warn('Eye calibration already initialized');
    return getPublicAPI();
  }
  
  console.log('Initializing ALEJO Eye Calibration System');
  
  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options,
    accessibility: {
      ...DEFAULT_CONFIG.accessibility,
      ...(options.accessibility || {})
    }
  };
  
  try {
    // Set up event listeners
    setupEventListeners();
    
    isInitialized = true;
    publish('eye:calibration:initialized');
    
    return getPublicAPI();
  } catch (error) {
    console.error('Failed to initialize eye calibration:', error);
    publish('eye:calibration:error', { 
      message: 'Failed to initialize eye calibration', 
      error 
    });
    throw error;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for calibration events
  subscribe('eye:calibration:start', handleCalibrationStart);
  subscribe('eye:calibration:point:fixated', handlePointFixated);
  subscribe('eye:calibration:cancel', handleCalibrationCancel);
  
  // Listen for configuration changes
  subscribe('biometrics:config:updated', (event) => {
    if (event.newConfig.eyeCalibration) {
      updateConfig(event.newConfig.eyeCalibration);
    }
  });
  
  // Listen for accessibility changes
  subscribe('accessibility:settings:changed', (event) => {
    if (event.settings && event.settings.vision) {
      updateAccessibilitySettings(event.settings.vision);
    }
  });
}

/**
 * Start the calibration process
 * @param {Object} options - Optional override configuration for this calibration
 * @returns {Promise<boolean>} - Whether calibration was started
 */
export async function startCalibration(options = {}) {
  if (isCalibrating) {
    console.warn('Calibration already in progress');
    return false;
  }
  
  // Merge with current configuration
  const calibrationConfig = {
    ...config,
    ...options,
    accessibility: {
      ...config.accessibility,
      ...(options.accessibility || {})
    }
  };
  
  try {
    isCalibrating = true;
    currentCalibrationPoint = 0;
    calibrationData.points = [];
    calibrationData.targetPoints = generateCalibrationPoints(calibrationConfig.numPoints);
    calibrationData.pointResults = [];
    
    // Create calibration UI
    createCalibrationUI();
    
    publish('eye:calibration:started', {
      numPoints: calibrationConfig.numPoints,
      timestamp: Date.now()
    });
    
    // Show first calibration point
    showNextCalibrationPoint();
    
    return true;
  } catch (error) {
    console.error('Failed to start calibration:', error);
    isCalibrating = false;
    publish('eye:calibration:error', { 
      message: 'Failed to start calibration', 
      error 
    });
    return false;
  }
}

/**
 * Handle calibration start event
 * @param {Object} event - Calibration start event
 */
function handleCalibrationStart(event) {
  startCalibration(event.options || {});
}

/**
 * Handle point fixation event
 * @param {Object} event - Point fixation event
 */
function handlePointFixated(event) {
  if (!isCalibrating) {
    return;
  }
  
  // Record calibration data for current point
  const pointData = {
    target: { ...calibrationData.targetPoints[currentCalibrationPoint] },
    actual: { ...event.gazePoint },
    accuracy: calculatePointAccuracy(
      calibrationData.targetPoints[currentCalibrationPoint],
      event.gazePoint
    ),
    timestamp: Date.now()
  };
  
  calibrationData.pointResults.push(pointData);
  
  // Show feedback if enabled
  if (config.showFeedback) {
    showCalibrationFeedback(pointData);
  }
  
  // Move to next point or finish calibration
  if (currentCalibrationPoint < calibrationData.targetPoints.length - 1) {
    currentCalibrationPoint++;
    showNextCalibrationPoint();
  } else {
    finishCalibration();
  }
}

/**
 * Handle calibration cancel event
 */
function handleCalibrationCancel() {
  if (!isCalibrating) {
    return;
  }
  
  cleanupCalibration();
  
  publish('eye:calibration:cancelled', {
    timestamp: Date.now()
  });
}

/**
 * Generate calibration points based on screen size
 * @param {number} numPoints - Number of calibration points
 * @returns {Array} - Array of calibration points
 */
function generateCalibrationPoints(numPoints) {
  const { innerWidth, innerHeight } = window;
  const points = [];
  
  // Padding from edges
  const paddingX = innerWidth * 0.1;
  const paddingY = innerHeight * 0.1;
  
  // Available area
  const availableWidth = innerWidth - (paddingX * 2);
  const availableHeight = innerHeight - (paddingY * 2);
  
  if (numPoints === 5) {
    // 5-point calibration (center and four corners)
    points.push({ x: innerWidth / 2, y: innerHeight / 2 }); // Center
    points.push({ x: paddingX, y: paddingY }); // Top-left
    points.push({ x: innerWidth - paddingX, y: paddingY }); // Top-right
    points.push({ x: paddingX, y: innerHeight - paddingY }); // Bottom-left
    points.push({ x: innerWidth - paddingX, y: innerHeight - paddingY }); // Bottom-right
  } else {
    // Default 9-point calibration (3x3 grid)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        points.push({
          x: paddingX + (availableWidth * col / 2),
          y: paddingY + (availableHeight * row / 2)
        });
      }
    }
  }
  
  // Add additional points if needed
  if (numPoints > 9) {
    // Add more points in between existing points
    const extraPoints = [];
    for (let i = 0; i < points.length - 1; i++) {
      extraPoints.push({
        x: (points[i].x + points[i + 1].x) / 2,
        y: (points[i].y + points[i + 1].y) / 2
      });
    }
    points.push(...extraPoints.slice(0, numPoints - 9));
  }
  
  return points;
}

/**
 * Create calibration UI
 */
function createCalibrationUI() {
  // Create container
  calibrationContainer = document.createElement('div');
  calibrationContainer.className = 'alejo-eye-calibration-container';
  calibrationContainer.style.position = 'fixed';
  calibrationContainer.style.top = '0';
  calibrationContainer.style.left = '0';
  calibrationContainer.style.width = '100%';
  calibrationContainer.style.height = '100%';
  calibrationContainer.style.zIndex = '9999';
  calibrationContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  
  // Create canvas
  calibrationCanvas = document.createElement('canvas');
  calibrationCanvas.width = window.innerWidth;
  calibrationCanvas.height = window.innerHeight;
  calibrationCanvas.style.position = 'absolute';
  calibrationCanvas.style.top = '0';
  calibrationCanvas.style.left = '0';
  
  // Apply accessibility settings
  if (config.accessibility.highContrastMode) {
    calibrationContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  }
  
  // Add canvas to container
  calibrationContainer.appendChild(calibrationCanvas);
  
  // Add container to document
  document.body.appendChild(calibrationContainer);
  
  // Get canvas context
  calibrationContext = calibrationCanvas.getContext('2d');
  
  // Add instructions
  const instructions = document.createElement('div');
  instructions.className = 'alejo-eye-calibration-instructions';
  instructions.style.position = 'absolute';
  instructions.style.bottom = '20px';
  instructions.style.left = '0';
  instructions.style.width = '100%';
  instructions.style.textAlign = 'center';
  instructions.style.color = 'white';
  instructions.style.fontSize = '18px';
  instructions.style.fontFamily = 'Arial, sans-serif';
  
  instructions.textContent = 'Follow the dot with your eyes. Try not to move your head.';
  
  // Apply accessibility settings to instructions
  if (config.accessibility.largerTargets) {
    instructions.style.fontSize = '24px';
  }
  
  calibrationContainer.appendChild(instructions);
  
  // Add cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'alejo-eye-calibration-cancel';
  cancelButton.style.position = 'absolute';
  cancelButton.style.top = '20px';
  cancelButton.style.right = '20px';
  cancelButton.style.padding = '10px 20px';
  cancelButton.style.backgroundColor = '#ff4444';
  cancelButton.style.color = 'white';
  cancelButton.style.border = 'none';
  cancelButton.style.borderRadius = '5px';
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.fontSize = '16px';
  
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', handleCalibrationCancel);
  
  calibrationContainer.appendChild(cancelButton);
  
  // Voice prompt for accessibility
  if (config.accessibility.voicePrompts) {
    const message = 'Eye calibration started. Please follow the red dot with your eyes without moving your head.';
    speakMessage(message);
  }
}

/**
 * Show next calibration point
 */
function showNextCalibrationPoint() {
  if (!isCalibrating || !calibrationContext) {
    return;
  }
  
  // Clear canvas
  calibrationContext.clearRect(0, 0, calibrationCanvas.width, calibrationCanvas.height);
  
  // Get current point
  const point = calibrationData.targetPoints[currentCalibrationPoint];
  
  // Draw point
  drawCalibrationPoint(point);
  
  // Voice prompt for accessibility
  if (config.accessibility.voicePrompts) {
    const position = getPointPositionDescription(point);
    speakMessage(`Look at the ${position} point`);
  }
  
  // Set timeout for point fixation
  const pointDuration = config.accessibility.extraTime ? 
    config.pointDuration * 1.5 : config.pointDuration;
  
  setTimeout(() => {
    if (isCalibrating && config.autoAdvance) {
      // Simulate point fixation (in a real implementation, this would come from eye tracking)
      publish('eye:calibration:point:fixated', {
        pointIndex: currentCalibrationPoint,
        gazePoint: {
          x: point.x + (Math.random() * 20 - 10), // Add some random error
          y: point.y + (Math.random() * 20 - 10)
        }
      });
    }
  }, pointDuration);
}

/**
 * Draw calibration point
 * @param {Object} point - Point coordinates
 */
function drawCalibrationPoint(point) {
  if (!calibrationContext) {
    return;
  }
  
  const pointSize = config.accessibility.largerTargets ? 
    config.pointSize * 1.5 : config.pointSize;
  
  // Draw outer circle
  calibrationContext.beginPath();
  calibrationContext.arc(point.x, point.y, pointSize * 1.5, 0, Math.PI * 2);
  calibrationContext.fillStyle = 'rgba(255, 255, 255, 0.3)';
  calibrationContext.fill();
  
  // Draw inner circle
  calibrationContext.beginPath();
  calibrationContext.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
  calibrationContext.fillStyle = config.accessibility.highContrastMode ? 
    '#FFFFFF' : config.pointColor;
  calibrationContext.fill();
  
  // Draw center dot
  calibrationContext.beginPath();
  calibrationContext.arc(point.x, point.y, pointSize / 4, 0, Math.PI * 2);
  calibrationContext.fillStyle = config.accessibility.highContrastMode ? 
    '#000000' : '#FFFFFF';
  calibrationContext.fill();
  
  // Animate point if enabled
  if (config.animatePoints) {
    animateCalibrationPoint(point);
  }
}

/**
 * Animate calibration point
 * @param {Object} point - Point coordinates
 */
function animateCalibrationPoint(point) {
  let animationFrame;
  let scale = 1;
  let growing = true;
  const minScale = 0.8;
  const maxScale = 1.2;
  const animationSpeed = config.accessibility.slowerAnimation ? 0.01 : 0.03;
  
  function animate() {
    if (!isCalibrating || !calibrationContext) {
      cancelAnimationFrame(animationFrame);
      return;
    }
    
    // Update scale
    if (growing) {
      scale += animationSpeed;
      if (scale >= maxScale) {
        growing = false;
      }
    } else {
      scale -= animationSpeed;
      if (scale <= minScale) {
        growing = true;
      }
    }
    
    // Clear point area
    calibrationContext.clearRect(
      point.x - pointSize * 2, 
      point.y - pointSize * 2, 
      pointSize * 4, 
      pointSize * 4
    );
    
    const pointSize = config.accessibility.largerTargets ? 
      config.pointSize * 1.5 : config.pointSize;
    
    // Draw outer circle
    calibrationContext.beginPath();
    calibrationContext.arc(point.x, point.y, pointSize * 1.5 * scale, 0, Math.PI * 2);
    calibrationContext.fillStyle = 'rgba(255, 255, 255, 0.3)';
    calibrationContext.fill();
    
    // Draw inner circle
    calibrationContext.beginPath();
    calibrationContext.arc(point.x, point.y, pointSize * scale, 0, Math.PI * 2);
    calibrationContext.fillStyle = config.accessibility.highContrastMode ? 
      '#FFFFFF' : config.pointColor;
    calibrationContext.fill();
    
    // Draw center dot
    calibrationContext.beginPath();
    calibrationContext.arc(point.x, point.y, pointSize / 4, 0, Math.PI * 2);
    calibrationContext.fillStyle = config.accessibility.highContrastMode ? 
      '#000000' : '#FFFFFF';
    calibrationContext.fill();
    
    // Continue animation
    animationFrame = requestAnimationFrame(animate);
  }
  
  // Start animation
  animate();
}

/**
 * Show calibration feedback
 * @param {Object} pointData - Point data
 */
function showCalibrationFeedback(pointData) {
  if (!calibrationContext) {
    return;
  }
  
  // Draw actual gaze point
  calibrationContext.beginPath();
  calibrationContext.arc(pointData.actual.x, pointData.actual.y, 5, 0, Math.PI * 2);
  calibrationContext.fillStyle = pointData.accuracy > 0.8 ? '#00FF00' : '#FFFF00';
  calibrationContext.fill();
  
  // Draw line between target and actual
  calibrationContext.beginPath();
  calibrationContext.moveTo(pointData.target.x, pointData.target.y);
  calibrationContext.lineTo(pointData.actual.x, pointData.actual.y);
  calibrationContext.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  calibrationContext.lineWidth = 1;
  calibrationContext.stroke();
  
  // Audio feedback
  if (config.audioFeedback) {
    const frequency = pointData.accuracy > 0.8 ? 880 : 440;
    playTone(frequency, 200);
  }
}

/**
 * Finish calibration
 */
function finishCalibration() {
  if (!isCalibrating) {
    return;
  }
  
  // Calculate overall accuracy
  const accuracies = calibrationData.pointResults.map(point => point.accuracy);
  const overallAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  
  // Calculate calibration matrix
  calculateCalibrationMatrix();
  
  // Update calibration data
  calibrationData.accuracy = overallAccuracy;
  calibrationData.lastCalibrationTime = Date.now();
  calibrationData.isCalibrated = overallAccuracy >= config.minimumAccuracy;
  
  // Clean up UI
  cleanupCalibration();
  
  // Publish calibration results
  publish('eye:calibration:completed', {
    accuracy: overallAccuracy,
    isCalibrated: calibrationData.isCalibrated,
    points: calibrationData.pointResults.length,
    timestamp: Date.now()
  });
  
  // Voice prompt for accessibility
  if (config.accessibility.voicePrompts) {
    const accuracyPercent = Math.round(overallAccuracy * 100);
    const message = calibrationData.isCalibrated ?
      `Calibration completed successfully with ${accuracyPercent} percent accuracy.` :
      `Calibration completed with low accuracy of ${accuracyPercent} percent. You may want to try again.`;
    
    speakMessage(message);
  }
  
  // Reset state
  isCalibrating = false;
}

/**
 * Clean up calibration UI
 */
function cleanupCalibration() {
  // Remove calibration UI
  if (calibrationContainer && calibrationContainer.parentNode) {
    calibrationContainer.parentNode.removeChild(calibrationContainer);
  }
  
  calibrationContainer = null;
  calibrationCanvas = null;
  calibrationContext = null;
}

/**
 * Calculate calibration matrix
 * This is a simplified version - a real implementation would use more sophisticated mapping
 */
function calculateCalibrationMatrix() {
  // In a real implementation, this would calculate a transformation matrix
  // to map raw gaze coordinates to screen coordinates
  calibrationData.calibrationMatrix = {
    scaleX: 1.0,
    scaleY: 1.0,
    offsetX: 0,
    offsetY: 0
  };
}

/**
 * Calculate accuracy between target and actual gaze point
 * @param {Object} target - Target point
 * @param {Object} actual - Actual gaze point
 * @returns {number} - Accuracy score (0-1)
 */
function calculatePointAccuracy(target, actual) {
  const distance = Math.sqrt(
    Math.pow(target.x - actual.x, 2) + 
    Math.pow(target.y - actual.y, 2)
  );
  
  // Convert distance to accuracy score (0-1)
  // Closer points have higher accuracy
  const maxDistance = Math.sqrt(
    Math.pow(window.innerWidth, 2) + 
    Math.pow(window.innerHeight, 2)
  ) / 4; // Quarter of screen diagonal as max distance
  
  return Math.max(0, 1 - (distance / maxDistance));
}

/**
 * Get point position description for accessibility
 * @param {Object} point - Point coordinates
 * @returns {string} - Position description
 */
function getPointPositionDescription(point) {
  const { innerWidth, innerHeight } = window;
  
  // Determine horizontal position
  let horizontal = 'center';
  if (point.x < innerWidth * 0.33) {
    horizontal = 'left';
  } else if (point.x > innerWidth * 0.66) {
    horizontal = 'right';
  }
  
  // Determine vertical position
  let vertical = 'middle';
  if (point.y < innerHeight * 0.33) {
    vertical = 'top';
  } else if (point.y > innerHeight * 0.66) {
    vertical = 'bottom';
  }
  
  // Special case for center
  if (horizontal === 'center' && vertical === 'middle') {
    return 'center';
  }
  
  return `${vertical} ${horizontal}`;
}

/**
 * Speak a message using speech synthesis
 * @param {string} message - Message to speak
 */
function speakMessage(message) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9; // Slightly slower rate for clarity
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Play a tone using Web Audio API
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in ms
 */
function playTone(frequency, duration) {
  if ('AudioContext' in window || 'webkitAudioContext' in window) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, duration);
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
    ...newConfig,
    accessibility: {
      ...config.accessibility,
      ...(newConfig.accessibility || {})
    }
  };
  
  publish('eye:calibration:config:updated', { 
    newConfig: config
  });
}

/**
 * Update accessibility settings
 * @param {Object} settings - Accessibility settings
 */
function updateAccessibilitySettings(settings) {
  config.accessibility = {
    ...config.accessibility,
    highContrastMode: settings.highContrast || config.accessibility.highContrastMode,
    largerTargets: settings.largeTargets || config.accessibility.largerTargets,
    slowerAnimation: settings.reducedMotion || config.accessibility.slowerAnimation,
    voicePrompts: settings.screenReader || config.accessibility.voicePrompts,
    extraTime: settings.extraTime || config.accessibility.extraTime
  };
  
  publish('eye:calibration:accessibility:updated', { 
    settings: config.accessibility
  });
}

/**
 * Get calibration data
 * @returns {Object} - Calibration data
 */
export function getCalibrationData() {
  return {
    isCalibrated: calibrationData.isCalibrated,
    accuracy: calibrationData.accuracy,
    lastCalibrationTime: calibrationData.lastCalibrationTime,
    pointCount: calibrationData.pointResults.length
  };
}

/**
 * Reset calibration data
 */
export function resetCalibration() {
  calibrationData.isCalibrated = false;
  calibrationData.accuracy = 0;
  calibrationData.points = [];
  calibrationData.pointResults = [];
  calibrationData.calibrationMatrix = null;
  
  publish('eye:calibration:reset', {
    timestamp: Date.now()
  });
}

/**
 * Get the public API for eye calibration
 * @returns {Object} - Calibration API
 */
function getPublicAPI() {
  return {
    isInitialized: () => isInitialized,
    isCalibrating: () => isCalibrating,
    getConfig: () => ({ ...config }),
    getCalibrationData,
    startCalibration,
    cancelCalibration: handleCalibrationCancel,
    resetCalibration,
    updateConfig
  };
}

export default {
  initializeCalibration,
  startCalibration,
  resetCalibration,
  updateConfig,
  getCalibrationData
};
