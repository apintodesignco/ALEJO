/**
 * ALEJO Gesture Camera Module
 * 
 * Handles camera setup and access for the gesture recognition system.
 * Uses the MediaDevices API with optimized settings for gesture recognition.
 */

import { publish } from '../core/events.js';

// Camera state
let videoElement = null;
let stream = null;
let isSetup = false;

/**
 * Set up the camera for gesture recognition
 * @returns {Promise<boolean>} Whether camera setup was successful
 */
export async function setupCamera() {
  console.log('Setting up camera for gesture recognition');
  
  if (isSetup) {
    console.log('Camera already set up');
    return true;
  }
  
  try {
    // Create video element if it doesn't exist
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.setAttribute('playsinline', 'true'); // Required for iOS
      videoElement.setAttribute('autoplay', 'true');
      videoElement.setAttribute('muted', 'true');
      videoElement.style.position = 'absolute';
      videoElement.style.top = '0';
      videoElement.style.left = '0';
      videoElement.style.width = '1px'; // Keep it small but rendered
      videoElement.style.height = '1px';
      videoElement.style.opacity = '0.01'; // Nearly invisible but still active
      
      // Append to the DOM but keep it invisible
      document.body.appendChild(videoElement);
    }
    
    // Get optimal camera constraints
    const constraints = getOptimalCameraConstraints();
    
    // Request camera permission and access
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Attach stream to video element
    videoElement.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve);
      };
    });
    
    isSetup = true;
    console.log('Camera setup complete');
    
    // Publish camera status
    publish('gesture:camera', {
      status: 'ready',
      dimensions: {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      }
    });
    
    return true;
  } catch (error) {
    console.error('Camera setup failed:', error);
    
    // Publish error
    publish('gesture:camera', {
      status: 'error',
      error: error.message || 'Failed to access camera'
    });
    
    return false;
  }
}

/**
 * Get the video element for gesture processing
 */
export function getVideoElement() {
  return videoElement;
}

/**
 * Release camera resources
 */
export function releaseCamera() {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
    stream = null;
  }
  
  if (videoElement && videoElement.parentNode) {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.parentNode.removeChild(videoElement);
    videoElement = null;
  }
  
  isSetup = false;
  
  console.log('Camera resources released');
}

/**
 * Determine optimal camera constraints based on device capabilities
 */
function getOptimalCameraConstraints() {
  // Default constraints
  const constraints = {
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    }
  };
  
  // Check if this is a mobile device
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Lower resolution for mobile to improve performance
    constraints.video.width = { ideal: 480 };
    constraints.video.height = { ideal: 360 };
    constraints.video.frameRate = { ideal: 24 };
  } else {
    // Higher resolution for desktop
    constraints.video.width = { ideal: 640 };
    constraints.video.height = { ideal: 480 };
    constraints.video.frameRate = { ideal: 30 };
  }
  
  // Check if the device has performance issues
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    // Further reduce quality for low-end devices
    constraints.video.width = { ideal: 320 };
    constraints.video.height = { ideal: 240 };
    constraints.video.frameRate = { ideal: 15 };
  }
  
  return constraints;
}
