/**
 * ALEJO Gesture Recognition Module
 * 
 * Processes camera input to detect and recognize hand gestures.
 * Optimized for performance and accuracy.
 */

import { publish } from '../core/events.js';
import { getVideoElement } from './camera.js';

// Recognition state
let handsModel = null;
let isProcessing = false;
let lastProcessedTime = 0;
let processingInterval = 100; // milliseconds between processing frames
let gestureBuffer = []; // Buffer for gesture smoothing

// Gesture definitions
const GESTURES = {
  OPEN_HAND: 'open_hand',
  CLOSED_FIST: 'closed_fist',
  POINTING: 'pointing',
  VICTORY: 'victory',
  THUMBS_UP: 'thumbs_up',
  WAVE: 'wave'
};

/**
 * Set up gesture recognition with the provided hands model
 * @param {Object} model - MediaPipe Hands model instance
 */
export async function setupGestureRecognition(model) {
  console.log('Setting up gesture recognition');
  
  if (!model) {
    throw new Error('Hands model is required for gesture recognition');
  }
  
  // Store model reference
  handsModel = model;
  
  // Set up result callback
  handsModel.onResults(processHandResults);
  
  // Start processing
  return startGestureProcessing();
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
  
  // Start processing loop
  processFrame();
  
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
  
  // Throttle processing based on interval
  if (now - lastProcessedTime >= processingInterval && videoElement) {
    try {
      await handsModel.send({ image: videoElement });
      lastProcessedTime = now;
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  }
  
  // Schedule next frame
  requestAnimationFrame(processFrame);
}

/**
 * Process hand detection results
 * @param {Object} results - Results from MediaPipe Hands
 */
function processHandResults(results) {
  // Check if hands were detected
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Process each detected hand
    results.multiHandLandmarks.forEach((landmarks, handIndex) => {
      // Get hand type (left or right)
      const handType = results.multiHandedness[handIndex].label;
      
      // Recognize gestures from landmarks
      const gesture = recognizeGesture(landmarks, handType);
      
      if (gesture) {
        // Add to buffer for smoothing
        gestureBuffer.push(gesture);
        
        // Only keep the last 5 gestures for smoothing
        if (gestureBuffer.length > 5) {
          gestureBuffer.shift();
        }
        
        // Get the most common gesture in the buffer (smoothing)
        const smoothedGesture = getSmoothedGesture();
        
        // Publish the recognized gesture if it's stable
        publish('gesture:detected', {
          gesture: smoothedGesture,
          hand: handType,
          landmarks: landmarks,
          timestamp: Date.now()
        });
      }
    });
  } else {
    // No hands detected, clear buffer
    gestureBuffer = [];
    
    // Publish no hands event
    publish('gesture:noHands', {
      timestamp: Date.now()
    });
  }
}

/**
 * Recognize gesture from hand landmarks
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @param {String} handType - 'Left' or 'Right'
 * @returns {String|null} - Recognized gesture or null
 */
function recognizeGesture(landmarks, handType) {
  // Basic gesture recognition - in a real implementation,
  // this would use more sophisticated algorithms
  
  // Extract key points for gesture recognition
  const thumb = landmarks[4];
  const indexFinger = landmarks[8];
  const middleFinger = landmarks[12];
  const ringFinger = landmarks[16];
  const pinkyFinger = landmarks[20];
  const wrist = landmarks[0];
  
  // Calculate finger extensions
  const thumbExtended = isFingerExtended(thumb, landmarks[3], wrist);
  const indexExtended = isFingerExtended(indexFinger, landmarks[6], wrist);
  const middleExtended = isFingerExtended(middleFinger, landmarks[10], wrist);
  const ringExtended = isFingerExtended(ringFinger, landmarks[14], wrist);
  const pinkyExtended = isFingerExtended(pinkyFinger, landmarks[18], wrist);
  
  // Count extended fingers
  const extendedFingers = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended];
  const extendedCount = extendedFingers.filter(extended => extended).length;
  
  // Recognize gestures
  if (extendedCount === 0) {
    return GESTURES.CLOSED_FIST;
  } else if (extendedCount === 5) {
    return GESTURES.OPEN_HAND;
  } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.POINTING;
  } else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.VICTORY;
  } else if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.THUMBS_UP;
  }
  
  // No recognized gesture
  return null;
}

/**
 * Check if a finger is extended based on its landmarks
 */
function isFingerExtended(fingerTip, fingerMid, wrist) {
  // Calculate distances
  const tipToWristDist = calculateDistance(fingerTip, wrist);
  const midToWristDist = calculateDistance(fingerMid, wrist);
  
  // If tip is further from wrist than mid point, finger is extended
  return tipToWristDist > midToWristDist;
}

/**
 * Calculate distance between two landmarks
 */
function calculateDistance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

/**
 * Get the most common gesture from the buffer for smoothing
 */
function getSmoothedGesture() {
  if (gestureBuffer.length === 0) return null;
  
  // Count occurrences of each gesture
  const gestureCounts = {};
  gestureBuffer.forEach(gesture => {
    gestureCounts[gesture] = (gestureCounts[gesture] || 0) + 1;
  });
  
  // Find the most common gesture
  let maxCount = 0;
  let mostCommonGesture = null;
  
  Object.keys(gestureCounts).forEach(gesture => {
    if (gestureCounts[gesture] > maxCount) {
      maxCount = gestureCounts[gesture];
      mostCommonGesture = gesture;
    }
  });
  
  // Only return if the gesture appears in majority of the buffer
  if (maxCount >= Math.ceil(gestureBuffer.length / 2)) {
    return mostCommonGesture;
  }
  
  return null;
}

/**
 * Set processing quality level
 * @param {String} level - 'low', 'medium', or 'high'
 */
export function setProcessingQuality(level) {
  switch (level) {
    case 'low':
      processingInterval = 200; // Process fewer frames
      break;
    case 'medium':
      processingInterval = 100;
      break;
    case 'high':
      processingInterval = 50; // Process more frames
      break;
    default:
      processingInterval = 100;
  }
  
  console.log(`Gesture processing quality set to ${level}`);
  
  return true;
}

/**
 * Stop gesture processing
 */
export function stopGestureProcessing() {
  isProcessing = false;
  gestureBuffer = [];
  return true;
}
