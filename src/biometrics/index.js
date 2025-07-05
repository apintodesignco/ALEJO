/**
 * ALEJO Biometrics System
 * 
 * Core module for facial, eye, and hand biometrics processing.
 * Integrates with face-api.js and handpose libraries for local-first
 * biometric processing without external API dependencies.
 */

import { publish, subscribe } from '../core/event-bus.js';
import { loadFaceDetectionModels } from './face/detection.js';
import { loadHandTrackingModels } from './hand/tracking.js';
import eyeTracking from './eye/index.js';
import { setupAccessibilityFeatures } from './accessibility.js';
import { setupPrivacyControls } from './privacy.js';
import { BiometricConsentManager } from './consent-manager.js';

// System state
let isInitialized = false;
let isProcessing = false;
let activeScanners = new Set();
let currentVideoStream = null;
let consentManager = null;

// Default configuration
const DEFAULT_CONFIG = {
  autoStart: false,
  processingInterval: 100,
  faceDetection: {
    enabled: true,
    modelPath: '/models/face-api',
    minConfidence: 0.5,
    options: {
      withFaceLandmarks: true,
      withFaceExpressions: true,
      withAgeAndGender: false,
      withFaceDescriptors: false
    }
  },
  handTracking: {
    enabled: true,
    modelPath: '/models/handpose',
    minConfidence: 0.7
  },
  eyeTracking: {
    enabled: true,
    calibrationRequired: true,
    trackPupils: true,
    trackGaze: true,
    trackBlinks: true,
    processingIntervalMs: 50,
    adaptiveProcessing: true,
    debugMode: false,
    privacyMode: 'none',
    smoothingFactor: 0.7,
    performanceMode: 'balanced',
    accessibility: {
      highContrastMode: false,
      largerTargets: false,
      slowerAnimation: false,
      voicePrompts: false,
      extraTime: false
    }
  },
  accessibility: {
    detectionFeedback: true,
    audioGuidance: true,
    highContrastMarkers: false
  },
  privacy: {
    storeRawImages: false,
    localProcessingOnly: true,
    automaticDataPurge: true,
    dataRetentionTime: 60000, // 1 minute in milliseconds
    blurBackground: true,
    maskOtherFaces: true
  }
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Initialize the biometrics system
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Biometrics API
 */
export async function initializeBiometrics(options = {}) {
  if (isInitialized) {
    console.warn('Biometrics system already initialized');
    return getPublicAPI();
  }

  console.log('Initializing ALEJO Biometrics System');

  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options
  };

  try {
    // Initialize consent manager
    consentManager = new BiometricConsentManager();
    await consentManager.initialize();

    // Set up event listeners
    setupEventListeners();

    // Set up privacy controls
    await setupPrivacyControls(config.privacy);

    // Set up accessibility features
    await setupAccessibilityFeatures(config.accessibility);

    // Load required models in parallel
    // Load models based on configuration
    try {
      if (config.faceDetection.enabled) {
        await loadFaceDetectionModels(config.faceDetection.modelPath);
        activeScanners.add('face');
      }
      
      if (config.handTracking.enabled) {
        await loadHandTrackingModels(config.handTracking.modelPath);
        activeScanners.add('hand');
      }
      
      if (config.eyeTracking.enabled) {
        await eyeTracking.initialize(config.eyeTracking);
        activeScanners.add('eye');
      }

      isInitialized = true;
      publish('biometrics:initialized', { activeScanners: Array.from(activeScanners) });

      // Auto-start if configured
      if (config.autoStart) {
        await startProcessing();
      }

      return getPublicAPI();
    } catch (error) {
      console.error('Failed to load models:', error);
      publish('biometrics:error', { 
        type: 'model_loading_failed',
        message: error.message,
        error
      });
      throw error;
    }
    isInitialized = true;
    publish('biometrics:initialized', { activeScanners: Array.from(activeScanners) });

    // Auto-start if configured
    if (config.autoStart) {
      await startProcessing();
    }

    return getPublicAPI();
  } catch (error) {
    console.error('Failed to initialize biometrics system:', error);
    publish('biometrics:error', { 
      type: 'initialization_failed',
      message: error.message,
      error
    });
    throw error;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for biometric consent changes
  subscribe('consent:biometrics:changed', handleConsentChanged);

  // Listen for camera/video availability changes
  subscribe('camera:status', handleCameraStatusChanged);

  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Listen for low memory warnings
  subscribe('system:memory:low', handleLowMemory);

  // Listen for accessibility setting changes
  subscribe('accessibility:settings:changed', handleAccessibilityChanged);
}

/**
 * Handle biometric consent changes
 * @param {Object} event - Consent change event
 */
function handleConsentChanged(event) {
  if (!event.granted) {
    // Stop processing if consent is revoked
    stopProcessing();
    publish('biometrics:consent:revoked');
  } else {
    // Restart processing if consent is granted and was previously initialized
    if (isInitialized && !isProcessing) {
      startProcessing();
      publish('biometrics:consent:granted');
    }
  }
}

/**
 * Handle camera status changes
 * @param {Object} event - Camera status event
 */
function handleCameraStatusChanged(event) {
  if (event.available === false) {
    stopProcessing();
    publish('biometrics:camera:unavailable');
  }
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Pause processing when page is not visible
    if (isProcessing) {
      pauseProcessing();
    }
  } else {
    // Resume processing when page becomes visible again
    if (isInitialized && !isProcessing) {
      resumeProcessing();
    }
  }
}

/**
 * Handle low memory warnings
 */
function handleLowMemory() {
  // Reduce processing frequency or disable some features temporarily
  updateConfig({
    processingInterval: config.processingInterval * 2,
    faceDetection: {
      ...config.faceDetection,
      options: {
        ...config.faceDetection.options,
        withFaceExpressions: false,
        withAgeAndGender: false,
        withFaceDescriptors: false
      }
    }
  });

  publish('biometrics:reduced:performance', { 
    reason: 'low_memory',
    newInterval: config.processingInterval
  });
}

/**
 * Handle accessibility setting changes
 * @param {Object} event - Accessibility settings event
 */
function handleAccessibilityChanged(event) {
  if (event.settings && event.settings.biometrics) {
    updateConfig({
      accessibility: {
        ...config.accessibility,
        ...event.settings.biometrics
      }
    });
  }
}

/**
 * Start biometric processing
 * @returns {Promise<void>}
 */
export async function startProcessing() {
  if (!isInitialized) {
    throw new Error('Biometrics system not initialized');
  }

  if (isProcessing) {
    console.warn('Biometrics system already processing');
    return;
  }

  // Check for user consent first
  const hasConsent = await consentManager.checkConsent('biometrics');
  if (!hasConsent) {
    console.log('Cannot start biometrics: user consent not granted');
    publish('biometrics:consent:required');
    return;
  }

  try {
    // Get user media (camera)
    if (!currentVideoStream) {
      currentVideoStream = await getVideoStream();
    }

    isProcessing = true;
    publish('biometrics:processing:started');
    
    // Start individual scanners
    if (activeScanners.has('face')) {
      await import('./face/processor.js').then(module => module.startFaceProcessing(currentVideoStream, config));
    }
    
    if (activeScanners.has('hand')) {
      await import('./hand/processor.js').then(module => module.startHandProcessing(currentVideoStream, config));
    }
    
    if (activeScanners.has('eye')) {
      await eyeTracking.startProcessing();
      publish('biometrics:eye:started');
    }
  } catch (error) {
    console.error('Failed to start biometric processing:', error);
    isProcessing = false;
    publish('biometrics:error', { 
      type: 'processing_start_failed',
      message: error.message,
      error
    });
    throw error;
  }
}

/**
 * Stop biometric processing
 */
export async function stopProcessing() {
  if (!isProcessing) return;

  try {
    // Stop individual scanners
    if (activeScanners.has('face')) {
      await import('./face/processor.js').then(module => module.stopFaceProcessing());
    }
    
    if (activeScanners.has('hand')) {
      await import('./hand/processor.js').then(module => module.stopHandProcessing());
    }
    
    if (activeScanners.has('eye')) {
      await eyeTracking.stopProcessing();
      publish('biometrics:eye:stopped');
    }

    isProcessing = false;
    
    // Release camera stream
    if (currentVideoStream) {
      currentVideoStream.getTracks().forEach(track => track.stop());
      currentVideoStream = null;
    }

    publish('biometrics:processing:stopped');
  } catch (error) {
    console.error('Error stopping biometric processing:', error);
    publish('biometrics:error', { 
      type: 'processing_stop_failed',
      message: error.message,
      error
    });
  }
}

/**
 * Pause biometric processing temporarily
 */
export async function pauseProcessing() {
  if (!isProcessing) return;

  try {
    // Pause individual scanners
    if (activeScanners.has('face')) {
      import('./face/processor.js').then(module => module.pauseFaceProcessing());
    }
    
    if (activeScanners.has('hand')) {
      import('./hand/processor.js').then(module => module.pauseHandProcessing());
    }
    
    if (activeScanners.has('eye')) {
      await eyeTracking.pauseProcessing();
      publish('biometrics:eye:paused');
    }

    isProcessing = false;
    publish('biometrics:processing:paused');
  } catch (error) {
    console.error('Error pausing biometric processing:', error);
    publish('biometrics:error', { 
      type: 'processing_pause_failed',
      message: error.message,
      error
    });
  }
}

/**
 * Resume biometric processing
 */
export async function resumeProcessing() {
  if (isProcessing) return;

  try {
    // Resume individual scanners
    if (activeScanners.has('face')) {
      import('./face/processor.js').then(module => module.resumeFaceProcessing());
    }
    
    if (activeScanners.has('hand')) {
      import('./hand/processor.js').then(module => module.resumeHandProcessing());
    }
    
    if (activeScanners.has('eye')) {
      await eyeTracking.resumeProcessing();
      publish('biometrics:eye:resumed');
    }

    isProcessing = true;
    publish('biometrics:processing:resumed');
  } catch (error) {
    console.error('Error resuming biometric processing:', error);
    publish('biometrics:error', { 
      type: 'processing_resume_failed',
      message: error.message,
      error
    });
  }
}

/**
 * Update biometrics system configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateConfig(newConfig) {
  const oldConfig = { ...config };
  
  // Update configuration
  config = {
    ...config,
    ...newConfig,
    faceDetection: {
      ...config.faceDetection,
      ...(newConfig.faceDetection || {})
    },
    handTracking: {
      ...config.handTracking,
      ...(newConfig.handTracking || {})
    },
    eyeTracking: {
      ...config.eyeTracking,
      ...(newConfig.eyeTracking || {})
    },
    accessibility: {
      ...config.accessibility,
      ...(newConfig.accessibility || {})
    },
    privacy: {
      ...config.privacy,
      ...(newConfig.privacy || {})
    }
  };

  // Handle scanner enabling/disabling
  if (newConfig.faceDetection?.enabled !== undefined && 
      newConfig.faceDetection.enabled !== oldConfig.faceDetection.enabled) {
    if (newConfig.faceDetection.enabled) {
      activeScanners.add('face');
      if (isProcessing) {
        import('./face/processor.js').then(module => module.startFaceProcessing(currentVideoStream, config));
      }
    } else {
      activeScanners.delete('face');
      import('./face/processor.js').then(module => module.stopFaceProcessing());
    }
  }

  if (newConfig.handTracking?.enabled !== undefined && 
      newConfig.handTracking.enabled !== oldConfig.handTracking.enabled) {
    if (newConfig.handTracking.enabled) {
      activeScanners.add('hand');
      if (isProcessing) {
        import('./hand/processor.js').then(module => module.startHandProcessing(currentVideoStream, config));
      }
    } else {
      activeScanners.delete('hand');
      import('./hand/processor.js').then(module => module.stopHandProcessing());
    }
  }

  if (newConfig.eyeTracking?.enabled !== undefined && 
      newConfig.eyeTracking.enabled !== oldConfig.eyeTracking.enabled) {
    if (newConfig.eyeTracking.enabled) {
      activeScanners.add('eye');
      eyeTracking.initialize(config.eyeTracking).then(() => {
        if (isProcessing) {
          eyeTracking.startProcessing();
        }
      });
    } else {
      activeScanners.delete('eye');
      eyeTracking.stopProcessing();
    }
  }
  
  // Update eye tracking configuration if it changed
  if (newConfig.eyeTracking && isInitialized && activeScanners.has('eye')) {
    eyeTracking.updateConfig(config.eyeTracking);
  }

  // Propagate configuration changes to individual processors
  if (isInitialized) {
    publish('biometrics:config:updated', { 
      oldConfig,
      newConfig: config
    });
  }
}

/**
 * Get a video stream from the user's camera
 * @returns {Promise<MediaStream>} - Video stream
 */
async function getVideoStream() {
  try {
    // Request user media with preferred settings
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    
    return stream;
  } catch (error) {
    console.error('Failed to access camera:', error);
    publish('biometrics:error', { 
      type: 'camera_access_failed',
      message: 'Could not access camera',
      error
    });
    throw error;
  }
}

/**
 * Get the public API for the biometrics system
 * @returns {Object} - Biometrics API
 */
function getPublicAPI() {
  return {
    isInitialized: () => isInitialized,
    isProcessing: () => isProcessing,
    getActiveScanners: () => Array.from(activeScanners),
    getConfig: () => ({ ...config }),
    updateConfig,
    startProcessing,
    stopProcessing,
    pauseProcessing,
    resumeProcessing,
    calibrateEyeTracking: async (options = {}) => {
      if (activeScanners.has('eye')) {
        return eyeTracking.startCalibration(options);
      }
      throw new Error('Eye tracking not enabled');
    },
    requestConsent: () => consentManager.requestConsent('biometrics'),
    checkConsent: () => consentManager.checkConsent('biometrics')
  };
}

export default {
  initializeBiometrics,
  startProcessing,
  stopProcessing,
  pauseProcessing,
  resumeProcessing,
  updateConfig
};
