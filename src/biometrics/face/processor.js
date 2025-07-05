/**
 * ALEJO Face Processor Module
 * 
 * Handles continuous facial processing, analysis, and tracking
 * for the biometrics system.
 */

import { publish, subscribe } from '../../core/event-bus.js';
import * as FaceDetection from './detection.js';
import { privacyFilter } from '../privacy.js';

// Processing state
let isProcessing = false;
let isPaused = false;
let processingInterval = 100; // ms
let processingTimer = null;
let videoElement = null;
let canvasElement = null;
let lastProcessingTime = 0;
let frameSkip = 0; // Number of frames to skip
let currentFrameCount = 0;
let lastDetectionResults = null;
let faceTrackingIds = new Map(); // Map to track faces across frames
let nextTrackingId = 1;
let trackingThreshold = 0.6; // IOU threshold for tracking

// Configuration
let config = {
  minConfidence: 0.5,
  withFaceLandmarks: true,
  withFaceExpressions: true,
  withAgeAndGender: false,
  withFaceDescriptors: false,
  trackFaces: true,
  faceIdPersistence: 10000, // ms
  drawDebugInfo: false,
  stabilizeLandmarks: true,
  smoothingFactor: 0.5, // 0-1, higher means more smoothing
  processingInterval: 100,
  adaptiveProcessing: true, // Adjust processing rate based on performance
  notifyNoFaceDetected: true,
  noFaceTimeout: 2000, // ms
  detectionOddRatioThreshold: 3.0, // Threshold for detection confidence
  privacyMode: 'blur', // 'blur', 'mask', 'none'
};

// Face memory for tracking
const faceMemory = new Map();
let noFaceDetectedTimer = null;

/**
 * Start face processing on a video stream
 * @param {MediaStream} videoStream - Video stream to process
 * @param {Object} options - Processing options
 */
export async function startFaceProcessing(videoStream, options = {}) {
  if (isProcessing && !isPaused) {
    console.warn('Face processing already started');
    return;
  }

  // Update configuration
  config = {
    ...config,
    ...(options.faceDetection || {}),
    processingInterval: options.processingInterval || config.processingInterval,
    privacyMode: options.privacy?.blurBackground ? 'blur' : options.privacy?.maskOtherFaces ? 'mask' : 'none'
  };
  
  processingInterval = config.processingInterval;

  try {
    // Ensure models are loaded
    if (!FaceDetection.areModelsLoaded()) {
      await FaceDetection.loadFaceDetectionModels();
    }

    // Create video element if it doesn't exist
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.width = 640;
      videoElement.height = 480;
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);
    }

    // Create canvas element for processing if it doesn't exist
    if (!canvasElement && config.drawDebugInfo) {
      canvasElement = document.createElement('canvas');
      canvasElement.width = 640;
      canvasElement.height = 480;
      canvasElement.id = 'alejo-face-debug-canvas';
      canvasElement.style.display = config.drawDebugInfo ? 'block' : 'none';
      document.body.appendChild(canvasElement);
    }

    // Connect video stream
    if (videoStream) {
      videoElement.srcObject = videoStream;
      await videoElement.play();
    } else {
      throw new Error('No video stream provided');
    }

    // Reset state
    isProcessing = true;
    isPaused = false;
    lastDetectionResults = null;
    faceTrackingIds.clear();
    nextTrackingId = 1;
    lastProcessingTime = 0;
    currentFrameCount = 0;
    
    // Start processing loop
    processFrame();

    publish('face:processing:started');
  } catch (error) {
    console.error('Failed to start face processing:', error);
    publish('face:processing:error', { 
      message: 'Failed to start face processing', 
      error 
    });
    throw error;
  }
}

/**
 * Stop face processing
 */
export function stopFaceProcessing() {
  if (!isProcessing) {
    return;
  }

  clearTimeout(processingTimer);
  clearTimeout(noFaceDetectedTimer);
  
  isProcessing = false;
  isPaused = false;
  
  // Clean up video element
  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.remove();
    videoElement = null;
  }

  // Clean up canvas element
  if (canvasElement) {
    canvasElement.remove();
    canvasElement = null;
  }

  publish('face:processing:stopped');
}

/**
 * Pause face processing temporarily
 */
export function pauseFaceProcessing() {
  if (!isProcessing || isPaused) {
    return;
  }

  clearTimeout(processingTimer);
  clearTimeout(noFaceDetectedTimer);
  isPaused = true;

  publish('face:processing:paused');
}

/**
 * Resume face processing after pause
 */
export function resumeFaceProcessing() {
  if (!isProcessing || !isPaused) {
    return;
  }

  isPaused = false;
  processFrame();

  publish('face:processing:resumed');
}

/**
 * Update face processing configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateConfig(newConfig) {
  const oldConfig = { ...config };
  
  // Update configuration
  config = {
    ...config,
    ...newConfig
  };

  // Update processing interval if changed
  if (newConfig.processingInterval && newConfig.processingInterval !== processingInterval) {
    processingInterval = newConfig.processingInterval;
  }

  // Update canvas visibility if debug mode changed
  if (canvasElement && newConfig.drawDebugInfo !== undefined) {
    canvasElement.style.display = newConfig.drawDebugInfo ? 'block' : 'none';
  }

  publish('face:config:updated', { 
    oldConfig,
    newConfig: config
  });
}

/**
 * Process a single frame from the video stream
 */
async function processFrame() {
  if (!isProcessing || isPaused || !videoElement || !videoElement.readyState === 4) {
    return;
  }

  // Check if we should skip this frame
  if (currentFrameCount < frameSkip) {
    currentFrameCount++;
    processingTimer = setTimeout(processFrame, processingInterval);
    return;
  }
  
  currentFrameCount = 0;
  const startTime = performance.now();

  try {
    // Detect faces
    const detectionResults = await FaceDetection.detectFaces(videoElement, config);
    
    // Process detection results
    if (detectionResults && detectionResults.faces) {
      // Track faces across frames
      if (config.trackFaces && lastDetectionResults) {
        trackFaces(detectionResults.faces, lastDetectionResults.faces);
      } else if (config.trackFaces) {
        // First frame, assign IDs to all faces
        detectionResults.faces.forEach(face => {
          const id = nextTrackingId++;
          faceTrackingIds.set(face, id);
          face.trackingId = id;
          trackFace(face, id);
        });
      }

      // Extract face data for each detected face
      const faceData = detectionResults.faces.map(face => {
        // Extract landmarks if available
        const landmarks = face.landmarks ? FaceDetection.extractLandmarks(face) : null;
        
        // Calculate head rotation if landmarks are available
        const headRotation = landmarks ? FaceDetection.calculateHeadRotation(landmarks) : null;
        
        // Analyze expressions if available
        const expressions = face.expressions ? FaceDetection.analyzeExpressions(face) : null;
        
        return {
          id: face.trackingId || nextTrackingId++,
          detection: {
            box: face.detection.box,
            score: face.detection.score
          },
          landmarks,
          headRotation,
          expressions,
          age: face.age,
          gender: face.gender,
          genderProbability: face.genderProbability,
          descriptor: face.descriptor
        };
      });

      // Draw debug info if enabled
      if (config.drawDebugInfo && canvasElement) {
        drawDebugInfo(detectionResults.faces, detectionResults.dimensions);
      }

      // Apply privacy filters if needed
      const privacyApplied = config.privacyMode !== 'none' ? 
        await privacyFilter(faceData, videoElement, config.privacyMode) : null;

      // Publish detection results
      publish('face:detected', { 
        faces: faceData,
        count: faceData.length,
        dimensions: detectionResults.dimensions,
        timestamp: Date.now(),
        processingTime: performance.now() - startTime
      });

      // Clear no face timer if faces are detected
      if (faceData.length > 0 && noFaceDetectedTimer) {
        clearTimeout(noFaceDetectedTimer);
        noFaceDetectedTimer = null;
      }
      
      // Set timer for no face detection
      if (faceData.length === 0 && !noFaceDetectedTimer && config.notifyNoFaceDetected) {
        noFaceDetectedTimer = setTimeout(() => {
          publish('face:not:detected', {
            message: 'No face detected for an extended period',
            lastDetectionTime: lastDetectionResults ? lastDetectionResults.timestamp : null
          });
        }, config.noFaceTimeout);
      }

      // Store results for tracking
      lastDetectionResults = {
        ...detectionResults,
        timestamp: Date.now()
      };

      // Adjust processing rate based on performance if adaptive processing is enabled
      if (config.adaptiveProcessing) {
        adjustProcessingRate(performance.now() - startTime);
      }
    }

    // Calculate time to next frame
    const processingTime = performance.now() - startTime;
    lastProcessingTime = processingTime;
    const timeToNextFrame = Math.max(1, processingInterval - processingTime);

    // Schedule next frame
    processingTimer = setTimeout(processFrame, timeToNextFrame);
  } catch (error) {
    console.error('Error processing face frame:', error);
    publish('face:processing:error', { 
      message: 'Error processing face frame', 
      error 
    });

    // Continue processing even after an error
    processingTimer = setTimeout(processFrame, processingInterval);
  }
}

/**
 * Track faces across frames
 * @param {Array} currentFaces - Current frame face detections
 * @param {Array} previousFaces - Previous frame face detections
 */
function trackFaces(currentFaces, previousFaces) {
  // Skip if no faces in either frame
  if (!currentFaces.length || !previousFaces.length) {
    return;
  }

  // Calculate IoU (Intersection over Union) for all pairs of faces
  const iouMatrix = [];
  for (const currentFace of currentFaces) {
    const row = [];
    for (const previousFace of previousFaces) {
      row.push(calculateIoU(
        currentFace.detection.box,
        previousFace.detection.box
      ));
    }
    iouMatrix.push(row);
  }

  // Assign IDs to current faces based on best IoU match
  const assignedPrevious = new Set();
  
  for (let i = 0; i < currentFaces.length; i++) {
    const currentFace = currentFaces[i];
    let bestMatch = -1;
    let bestIoU = trackingThreshold;  // Minimum IoU to consider a match
    
    for (let j = 0; j < previousFaces.length; j++) {
      if (!assignedPrevious.has(j) && iouMatrix[i][j] > bestIoU) {
        bestMatch = j;
        bestIoU = iouMatrix[i][j];
      }
    }
    
    if (bestMatch !== -1) {
      // Found a match, assign the same ID
      const previousFace = previousFaces[bestMatch];
      const id = faceTrackingIds.get(previousFace);
      if (id) {
        faceTrackingIds.set(currentFace, id);
        currentFace.trackingId = id;
        assignedPrevious.add(bestMatch);
        trackFace(currentFace, id);
      }
    } else {
      // No match found, assign a new ID
      const id = nextTrackingId++;
      faceTrackingIds.set(currentFace, id);
      currentFace.trackingId = id;
      trackFace(currentFace, id);
    }
  }
}

/**
 * Track a face and update face memory
 * @param {Object} face - Face detection object
 * @param {number} id - Face tracking ID
 */
function trackFace(face, id) {
  // Create or update face in memory
  const now = Date.now();
  
  if (!faceMemory.has(id)) {
    faceMemory.set(id, {
      firstSeen: now,
      lastSeen: now,
      detectionCount: 1,
      box: face.detection.box,
      confidence: face.detection.score,
      expressions: face.expressions ? { ...face.expressions } : null
    });
  } else {
    const memory = faceMemory.get(id);
    memory.lastSeen = now;
    memory.detectionCount++;
    
    // Apply smoothing to box coordinates if enabled
    if (config.stabilizeLandmarks) {
      const alpha = config.smoothingFactor;
      memory.box = {
        x: memory.box.x * alpha + face.detection.box.x * (1 - alpha),
        y: memory.box.y * alpha + face.detection.box.y * (1 - alpha),
        width: memory.box.width * alpha + face.detection.box.width * (1 - alpha),
        height: memory.box.height * alpha + face.detection.box.height * (1 - alpha)
      };
      
      // Apply smoothed coordinates back to face
      face.detection.box = { ...memory.box };
    } else {
      memory.box = face.detection.box;
    }
    
    // Update confidence
    memory.confidence = face.detection.score;
    
    // Update expressions if available
    if (face.expressions) {
      memory.expressions = face.expressions;
    }
  }
  
  // Clean up old faces from memory
  const expiryTime = now - config.faceIdPersistence;
  for (const [faceId, data] of faceMemory.entries()) {
    if (data.lastSeen < expiryTime) {
      faceMemory.delete(faceId);
      publish('face:lost', {
        id: faceId,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
        detectionCount: data.detectionCount
      });
    }
  }
}

/**
 * Calculate IoU (Intersection over Union) between two bounding boxes
 * @param {Object} box1 - First bounding box {x, y, width, height}
 * @param {Object} box2 - Second bounding box {x, y, width, height}
 * @returns {number} - IoU value (0-1)
 */
function calculateIoU(box1, box2) {
  // Calculate coordinates of the intersection rectangle
  const xLeft = Math.max(box1.x, box2.x);
  const yTop = Math.max(box1.y, box2.y);
  const xRight = Math.min(box1.x + box1.width, box2.x + box2.width);
  const yBottom = Math.min(box1.y + box1.height, box2.y + box2.height);

  // Check if there is any intersection
  if (xRight < xLeft || yBottom < yTop) {
    return 0;
  }

  // Calculate area of intersection rectangle
  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);

  // Calculate areas of both boxes
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;

  // Calculate IoU
  return intersectionArea / (box1Area + box2Area - intersectionArea);
}

/**
 * Adjust processing rate based on performance
 * @param {number} processingTime - Time taken to process a frame
 */
function adjustProcessingRate(processingTime) {
  // If processing takes too long, reduce frame rate
  if (processingTime > processingInterval * 0.8) {
    // Increase frame skip
    frameSkip = Math.min(frameSkip + 1, 5);
    
    if (processingTime > processingInterval * 1.5) {
      // Increase processing interval as well for very slow processing
      processingInterval = Math.min(processingInterval * 1.2, 500);
    }
  } else if (processingTime < processingInterval * 0.3 && frameSkip > 0) {
    // If processing is fast, reduce frame skip
    frameSkip = Math.max(frameSkip - 1, 0);
    
    // If consistently fast, decrease processing interval
    if (processingTime < processingInterval * 0.2 && processingInterval > config.processingInterval) {
      processingInterval = Math.max(processingInterval * 0.8, config.processingInterval);
    }
  }
}

/**
 * Draw debug information on canvas
 * @param {Array} faces - Detected faces
 * @param {Object} dimensions - Dimensions of the video frame
 */
function drawDebugInfo(faces, dimensions) {
  if (!canvasElement) return;
  
  const ctx = canvasElement.getContext('2d');
  const { width, height } = dimensions;
  
  // Resize canvas if needed
  if (canvasElement.width !== width || canvasElement.height !== height) {
    canvasElement.width = width;
    canvasElement.height = height;
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw video frame as background
  if (videoElement) {
    ctx.drawImage(videoElement, 0, 0, width, height);
  }
  
  // Draw each face
  faces.forEach(face => {
    const { x, y, width: boxWidth, height: boxHeight } = face.detection.box;
    
    // Draw face box
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    // Draw face ID
    const id = faceTrackingIds.get(face) || '?';
    ctx.fillStyle = 'green';
    ctx.font = '16px Arial';
    ctx.fillText(`ID: ${id}`, x, y - 5);
    
    // Draw confidence score
    ctx.fillText(`${(face.detection.score * 100).toFixed(1)}%`, x, y + boxHeight + 15);
    
    // Draw landmarks if available
    if (face.landmarks) {
      // Draw all landmarks as small dots
      ctx.fillStyle = 'blue';
      const positions = face.landmarks.positions;
      positions.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      // Draw eyes with special markers
      if (face.landmarks.getLeftEye && face.landmarks.getRightEye) {
        const leftEye = face.landmarks.getLeftEye();
        const rightEye = face.landmarks.getRightEye();
        
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 1;
        
        // Left eye
        ctx.beginPath();
        leftEye.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
        
        // Right eye
        ctx.beginPath();
        rightEye.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
    }
    
    // Draw expressions if available
    if (face.expressions) {
      const expressions = face.expressions;
      const dominantExpression = Object.entries(expressions)
        .sort((a, b) => b[1] - a[1])[0];
      
      ctx.fillStyle = 'yellow';
      ctx.fillText(
        `${dominantExpression[0]}: ${(dominantExpression[1] * 100).toFixed(0)}%`,
        x, 
        y + boxHeight + 30
      );
    }
  });
  
  // Draw processing stats
  ctx.fillStyle = 'white';
  ctx.fillRect(5, 5, 200, 60);
  ctx.fillStyle = 'black';
  ctx.fillText(`Faces: ${faces.length}`, 10, 20);
  ctx.fillText(`Processing: ${lastProcessingTime.toFixed(1)} ms`, 10, 40);
  ctx.fillText(`Interval: ${processingInterval} ms (skip: ${frameSkip})`, 10, 60);
}

export default {
  startFaceProcessing,
  stopFaceProcessing,
  pauseFaceProcessing,
  resumeFaceProcessing,
  updateConfig
};
