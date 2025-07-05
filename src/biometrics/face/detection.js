/**
 * ALEJO Face Detection Module
 * 
 * Provides facial detection, landmark tracking, expression analysis,
 * and face recognition capabilities using face-api.js.
 * All processing happens locally on the client device.
 */

import * as faceapi from 'face-api.js';
import { publish, subscribe } from '../../core/event-bus.js';

// State
let modelsLoaded = false;
let modelPath = '';

// Default options for face detection
const DEFAULT_FACE_DETECTION_OPTIONS = {
  minConfidence: 0.5,
  withFaceLandmarks: true,
  withFaceExpressions: true,
  withAgeAndGender: false,
  withFaceDescriptors: false
};

/**
 * Load face detection models
 * @param {string} path - Path to the model files
 * @returns {Promise<void>}
 */
export async function loadFaceDetectionModels(path = '/models/face-api') {
  if (modelsLoaded) {
    console.log('Face detection models already loaded');
    return;
  }
  
  modelPath = path;
  console.log(`Loading face detection models from ${modelPath}`);
  
  try {
    // Start loading models
    publish('face:models:loading');
    
    // Load models in parallel
    const modelPromises = [
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelPath)
    ];
    
    // Load optional models based on common use cases
    modelPromises.push(faceapi.nets.faceExpressionNet.loadFromUri(modelPath));
    
    await Promise.all(modelPromises);
    
    modelsLoaded = true;
    publish('face:models:loaded');
    
    console.log('Face detection models loaded successfully');
  } catch (error) {
    console.error('Failed to load face detection models:', error);
    publish('face:models:error', { 
      message: 'Failed to load face detection models', 
      error 
    });
    throw error;
  }
}

/**
 * Detect faces in an image or video element
 * @param {HTMLImageElement|HTMLVideoElement} media - Image or video element
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} - Detection results
 */
export async function detectFaces(media, options = {}) {
  if (!modelsLoaded) {
    throw new Error('Face detection models not loaded');
  }
  
  // Merge with default options
  const detectionOptions = {
    ...DEFAULT_FACE_DETECTION_OPTIONS,
    ...options
  };
  
  try {
    // Create tiny face detector options
    const tinyFaceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: detectionOptions.minConfidence
    });
    
    // Determine which tasks to perform based on options
    let detectionTask = faceapi.detectAllFaces(media, tinyFaceDetectorOptions);
    
    if (detectionOptions.withFaceLandmarks) {
      detectionTask = detectionTask.withFaceLandmarks();
    }
    
    if (detectionOptions.withFaceExpressions) {
      detectionTask = detectionTask.withFaceExpressions();
    }
    
    if (detectionOptions.withAgeAndGender) {
      // Ensure age and gender model is loaded if requested
      if (!faceapi.nets.ageGenderNet.isLoaded) {
        await faceapi.nets.ageGenderNet.loadFromUri(modelPath);
      }
      detectionTask = detectionTask.withAgeAndGender();
    }
    
    if (detectionOptions.withFaceDescriptors) {
      // Ensure face recognition model is loaded if requested
      if (!faceapi.nets.faceRecognitionNet.isLoaded) {
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      }
      detectionTask = detectionTask.withFaceDescriptors();
    }
    
    // Run detection
    const results = await detectionTask;
    
    return {
      faces: results,
      dimensions: {
        width: media.width || media.videoWidth,
        height: media.height || media.videoHeight
      }
    };
  } catch (error) {
    console.error('Face detection error:', error);
    publish('face:detection:error', { 
      message: 'Face detection failed', 
      error 
    });
    throw error;
  }
}

/**
 * Extract facial landmarks from a detection result
 * @param {Object} detection - Face detection result
 * @returns {Object} - Extracted landmarks
 */
export function extractLandmarks(detection) {
  if (!detection || !detection.landmarks) {
    return null;
  }
  
  // Extract key facial landmarks
  const landmarks = {
    // Facial contour
    contour: detection.landmarks.getJawOutline(),
    
    // Eyes
    leftEye: detection.landmarks.getLeftEye(),
    rightEye: detection.landmarks.getRightEye(),
    leftEyeBrow: detection.landmarks.getLeftEyeBrow(),
    rightEyeBrow: detection.landmarks.getRightEyeBrow(),
    
    // Nose
    nose: detection.landmarks.getNose(),
    
    // Mouth
    mouth: detection.landmarks.getMouth(),
    
    // Calculate key points
    keyPoints: {
      // Eye centers
      leftEyeCenter: calculateCenterPoint(detection.landmarks.getLeftEye()),
      rightEyeCenter: calculateCenterPoint(detection.landmarks.getRightEye()),
      
      // Mouth center
      mouthCenter: calculateCenterPoint(detection.landmarks.getMouth()),
      
      // Nose tip
      noseTip: detection.landmarks.getNose()[3],
      
      // Pupil positions (estimated from eye landmarks)
      leftPupil: estimatePupilPosition(detection.landmarks.getLeftEye()),
      rightPupil: estimatePupilPosition(detection.landmarks.getRightEye())
    }
  };
  
  return landmarks;
}

/**
 * Calculate head rotation from facial landmarks
 * @param {Object} landmarks - Facial landmarks
 * @returns {Object} - Estimated head rotation in degrees
 */
export function calculateHeadRotation(landmarks) {
  if (!landmarks || !landmarks.keyPoints) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  
  // Calculate eye line for roll (head tilt)
  const leftEye = landmarks.keyPoints.leftEyeCenter;
  const rightEye = landmarks.keyPoints.rightEyeCenter;
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI;
  
  // Estimate yaw (head turning left/right) from relative eye distance
  // When face is turned, one eye appears closer to the nose than the other
  const nose = landmarks.keyPoints.noseTip;
  const leftDist = calculateDistance(nose, leftEye);
  const rightDist = calculateDistance(nose, rightEye);
  const eyeDistRatio = leftDist / rightDist;
  // Convert ratio to angle estimate (-30 to 30 degrees is a reasonable range)
  const yaw = (eyeDistRatio - 1) * 60;
  
  // Estimate pitch (head nodding up/down) from relative vertical positions
  // of eyes to mouth
  const mouth = landmarks.keyPoints.mouthCenter;
  const eyeLevel = (leftEye.y + rightEye.y) / 2;
  const faceHeight = calculateDistance(nose, mouth) * 2; // Approximate face height
  const verticalRatio = (mouth.y - eyeLevel) / faceHeight;
  // Convert to angle estimate
  const pitch = (verticalRatio - 0.4) * 90; // 0.4 is an approximation for neutral position
  
  return {
    yaw: Math.max(-30, Math.min(30, yaw)),
    pitch: Math.max(-30, Math.min(30, pitch)),
    roll: roll
  };
}

/**
 * Analyze facial expressions from detection result
 * @param {Object} detection - Face detection result with expressions
 * @returns {Object} - Analyzed expressions
 */
export function analyzeExpressions(detection) {
  if (!detection || !detection.expressions) {
    return null;
  }
  
  // Get raw expressions
  const expressions = detection.expressions;
  
  // Find dominant expression
  let dominantExpression = 'neutral';
  let maxConfidence = 0;
  
  for (const [expression, confidence] of Object.entries(expressions)) {
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      dominantExpression = expression;
    }
  }
  
  // Calculate expression changes and fluidity
  const result = {
    raw: expressions,
    dominant: dominantExpression,
    dominantConfidence: maxConfidence,
    valence: calculateValence(expressions),
    arousal: calculateArousal(expressions),
    expressionSummary: generateExpressionSummary(expressions)
  };
  
  return result;
}

/**
 * Calculate emotional valence (negative to positive) from expressions
 * @param {Object} expressions - Facial expressions with confidence values
 * @returns {number} - Valence value from -1 to 1
 */
function calculateValence(expressions) {
  // Positive expressions
  const positive = (expressions.happy || 0) + (expressions.surprised || 0) * 0.5;
  
  // Negative expressions
  const negative = (expressions.sad || 0) + (expressions.angry || 0) + 
                  (expressions.fearful || 0) + (expressions.disgusted || 0);
  
  // Calculate valence (-1 to 1 scale)
  return Math.max(-1, Math.min(1, positive - negative));
}

/**
 * Calculate emotional arousal (calm to excited) from expressions
 * @param {Object} expressions - Facial expressions with confidence values
 * @returns {number} - Arousal value from 0 to 1
 */
function calculateArousal(expressions) {
  // High arousal expressions
  const highArousal = (expressions.surprised || 0) + (expressions.angry || 0) + 
                     (expressions.fearful || 0);
  
  // Low arousal expressions
  const lowArousal = (expressions.sad || 0) + (expressions.neutral || 0);
  
  // Calculate arousal (0 to 1 scale)
  return Math.max(0, Math.min(1, highArousal - lowArousal + 0.5));
}

/**
 * Generate a textual summary of expressions
 * @param {Object} expressions - Facial expressions with confidence values
 * @returns {string} - Expression summary
 */
function generateExpressionSummary(expressions) {
  // Find top two expressions
  const sortedExpressions = Object.entries(expressions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  // If dominant expression is very confident, just use that
  if (sortedExpressions[0][1] > 0.7) {
    return capitalizeFirstLetter(sortedExpressions[0][0]);
  }
  
  // If two expressions are close in confidence, blend them
  if (sortedExpressions[1][1] > sortedExpressions[0][1] * 0.7) {
    return `${capitalizeFirstLetter(sortedExpressions[0][0])} with ${sortedExpressions[1][0]}`;
  }
  
  return capitalizeFirstLetter(sortedExpressions[0][0]);
}

/**
 * Capitalize first letter of a string
 * @param {string} string - Input string
 * @returns {string} - String with first letter capitalized
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Calculate center point from an array of points
 * @param {Array} points - Array of points with x,y coordinates
 * @returns {Object} - Center point
 */
function calculateCenterPoint(points) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0 };
  }
  
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

/**
 * Estimate pupil position from eye landmarks
 * @param {Array} eyePoints - Eye landmark points
 * @returns {Object} - Estimated pupil position
 */
function estimatePupilPosition(eyePoints) {
  // Eye landmarks form roughly an ellipse around the eye
  // The pupil is approximately at the center of this ellipse
  return calculateCenterPoint(eyePoints);
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
 * Check if models are loaded
 * @returns {boolean} - Whether models are loaded
 */
export function areModelsLoaded() {
  return modelsLoaded;
}

/**
 * Get model path
 * @returns {string} - Model path
 */
export function getModelPath() {
  return modelPath;
}

export default {
  loadFaceDetectionModels,
  detectFaces,
  extractLandmarks,
  calculateHeadRotation,
  analyzeExpressions,
  areModelsLoaded,
  getModelPath
};
