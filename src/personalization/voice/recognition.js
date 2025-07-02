/**
 * ALEJO Voice Recognition System
 * 
 * This module provides voice identification and authentication capabilities:
 * - Voice fingerprint matching
 * - Speaker verification
 * - Voice-based authentication
 * - Confidence scoring
 * 
 * Works in conjunction with the voice training module and integrates
 * with ALEJO's security layer for privacy protection.
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';
import * as training from './training.js';

// Constants
const CONFIDENCE_THRESHOLD = 0.75;
const VERIFICATION_SAMPLE_MIN_DURATION_MS = 1500; // 1.5 seconds
const VOICE_STORAGE_KEY = 'alejo-voice-models';
const DEFAULT_VOICE_ID = 'alejo-pinto-default';

// State management
let initialized = false;
let audioContext = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let voiceModels = new Map();
let currentVerificationSession = null;

/**
 * Initialize the voice recognition system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Voice Recognition System');
  
  if (initialized) {
    console.warn('Voice Recognition System already initialized');
    return true;
  }
  
  try {
    // Initialize security module if not already done
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    // Check for required consent
    const hasConsent = await checkRequiredConsent();
    if (!hasConsent) {
      console.warn('Voice recognition requires explicit user consent');
      publish('voice:consent-required', { 
        feature: 'voice-recognition',
        requiredConsents: ['voice-recording', 'voice-processing', 'voice-authentication']
      });
      return false;
    }
    
    // Initialize audio context
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      publish('voice:error', { 
        component: 'recognition',
        message: 'Audio system initialization failed'
      });
      return false;
    }
    
    // Load voice models (shared with training module)
    await loadVoiceModels();
    
    // Register for events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    subscribe('security:level-changed', handleSecurityLevelChange);
    subscribe('voice:training:model-created', handleVoiceModelCreated);
    
    initialized = true;
    publish('voice:recognition:initialized', { success: true });
    
    // Log initialization
    if (security && typeof security.logSecureEvent === 'function') {
      security.logSecureEvent('voice:recognition:initialized', {
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Voice Recognition System:', error);
    publish('voice:error', { 
      component: 'recognition',
      message: error.message
    });
    return false;
  }
}

/**
 * Start voice verification process
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification session info
 */
export async function startVerification(options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  if (currentVerificationSession) {
    console.warn('Verification session already in progress');
    return { 
      success: false, 
      error: 'Verification session already in progress',
      sessionId: currentVerificationSession.id
    };
  }
  
  // Create a new verification session
  const sessionId = generateSessionId();
  const targetVoiceId = options.voiceId || null;
  
  currentVerificationSession = {
    id: sessionId,
    startTime: Date.now(),
    targetVoiceId,
    mode: options.mode || 'identification', // 'identification' or 'authentication'
    maxAttempts: options.maxAttempts || 3,
    attempts: 0,
    results: []
  };
  
  // Log verification session start
  if (security && typeof security.logSecureEvent === 'function') {
    security.logSecureEvent('voice:verification:session-started', {
      sessionId,
      mode: currentVerificationSession.mode,
      timestamp: new Date().toISOString()
    });
  }
  
  publish('voice:verification:session-started', {
    sessionId,
    mode: currentVerificationSession.mode,
    targetVoiceId
  });
  
  return { 
    success: true, 
    sessionId,
    mode: currentVerificationSession.mode,
    targetVoiceId
  };
}

/**
 * End the current verification session
 * @returns {Promise<Object>} Result
 */
export async function endVerification() {
  if (!currentVerificationSession) {
    return { success: false, error: 'No active verification session' };
  }
  
  const sessionData = { ...currentVerificationSession };
  
  // Determine overall result
  let overallResult = {
    success: false,
    confidence: 0,
    matchedVoiceId: null
  };
  
  if (sessionData.results.length > 0) {
    // Find the result with highest confidence
    const bestResult = sessionData.results.reduce((best, current) => {
      return (current.confidence > best.confidence) ? current : best;
    }, { confidence: 0 });
    
    if (bestResult.confidence >= CONFIDENCE_THRESHOLD) {
      overallResult = {
        success: true,
        confidence: bestResult.confidence,
        matchedVoiceId: bestResult.voiceId
      };
    }
  }
  
  // Log verification session end
  if (security && typeof security.logSecureEvent === 'function') {
    security.logSecureEvent('voice:verification:session-ended', {
      sessionId: sessionData.id,
      attempts: sessionData.attempts,
      success: overallResult.success,
      confidence: overallResult.confidence,
      timestamp: new Date().toISOString()
    });
  }
  
  const result = { 
    success: true, 
    sessionId: sessionData.id,
    attempts: sessionData.attempts,
    verificationResult: overallResult
  };
  
  currentVerificationSession = null;
  publish('voice:verification:session-ended', result);
  
  return result;
}

/**
 * Start recording for voice verification
 * @returns {Promise<Object>} Recording status
 */
export async function startVerificationRecording() {
  if (!initialized) {
    await initialize();
  }
  
  if (!currentVerificationSession) {
    return { success: false, error: 'No active verification session' };
  }
  
  if (isRecording) {
    return { success: false, error: 'Already recording' };
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      const recordingDuration = Date.now() - recordingStartTime;
      
      if (currentVerificationSession) {
        // Increment attempt counter
        currentVerificationSession.attempts++;
        
        // Process the recording for verification
        if (recordingDuration >= VERIFICATION_SAMPLE_MIN_DURATION_MS) {
          const verificationResult = await verifyVoiceSample(audioBlob, currentVerificationSession.targetVoiceId);
          currentVerificationSession.results.push(verificationResult);
          
          publish('voice:verification:sample-processed', {
            sessionId: currentVerificationSession.id,
            attempt: currentVerificationSession.attempts,
            success: verificationResult.success,
            confidence: verificationResult.confidence,
            matchedVoiceId: verificationResult.voiceId
          });
        } else {
          publish('voice:verification:sample-too-short', {
            sessionId: currentVerificationSession.id,
            attempt: currentVerificationSession.attempts,
            duration: recordingDuration,
            minimumRequired: VERIFICATION_SAMPLE_MIN_DURATION_MS
          });
        }
      }
      
      // Release media resources
      stream.getTracks().forEach(track => track.stop());
    };
    
    const recordingStartTime = Date.now();
    mediaRecorder.start();
    isRecording = true;
    
    publish('voice:verification:recording-started', {
      sessionId: currentVerificationSession.id,
      attempt: currentVerificationSession.attempts + 1
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to start verification recording:', error);
    return { 
      success: false, 
      error: 'Failed to start recording: ' + error.message 
    };
  }
}

/**
 * Stop recording for voice verification
 * @returns {Promise<Object>} Recording result
 */
export async function stopVerificationRecording() {
  if (!isRecording || !mediaRecorder) {
    return { success: false, error: 'Not currently recording' };
  }
  
  try {
    mediaRecorder.stop();
    isRecording = false;
    
    return { 
      success: true,
      attempt: currentVerificationSession ? currentVerificationSession.attempts + 1 : 0
    };
  } catch (error) {
    console.error('Failed to stop verification recording:', error);
    isRecording = false;
    
    return { 
      success: false, 
      error: 'Failed to stop recording: ' + error.message 
    };
  }
}

/**
 * Verify a voice sample against trained models
 * @param {Blob} audioBlob - Audio sample to verify
 * @param {string} targetVoiceId - Optional target voice ID for authentication
 * @returns {Promise<Object>} Verification result
 */
async function verifyVoiceSample(audioBlob, targetVoiceId = null) {
  try {
    // Extract voice features from the sample
    const sampleFeatures = await extractVoiceFeatures(audioBlob);
    
    if (!sampleFeatures) {
      return {
        success: false,
        error: 'Could not extract voice features',
        confidence: 0
      };
    }
    
    // If target voice ID is specified, only compare against that model
    if (targetVoiceId) {
      const targetModel = voiceModels.get(targetVoiceId);
      
      if (!targetModel) {
        return {
          success: false,
          error: 'Target voice model not found',
          confidence: 0
        };
      }
      
      const confidence = compareVoiceFeatures(sampleFeatures, targetModel.modelData);
      const success = confidence >= CONFIDENCE_THRESHOLD;
      
      return {
        success,
        voiceId: targetVoiceId,
        confidence,
        timestamp: Date.now()
      };
    } 
    // Otherwise, compare against all models (identification mode)
    else {
      let bestMatch = {
        voiceId: null,
        confidence: 0
      };
      
      // Compare against each model
      for (const [voiceId, model] of voiceModels.entries()) {
        const confidence = compareVoiceFeatures(sampleFeatures, model.modelData);
        
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            voiceId,
            confidence
          };
        }
      }
      
      const success = bestMatch.confidence >= CONFIDENCE_THRESHOLD;
      
      return {
        success,
        voiceId: bestMatch.voiceId,
        confidence: bestMatch.confidence,
        timestamp: Date.now()
      };
    }
  } catch (error) {
    console.error('Voice verification error:', error);
    return {
      success: false,
      error: error.message,
      confidence: 0
    };
  }
}

/**
 * Extract voice features from audio sample
 * @param {Blob} audioBlob - Audio sample
 * @returns {Promise<Object>} Voice features
 */
async function extractVoiceFeatures(audioBlob) {
  try {
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Extract features (simplified implementation)
    // In a real implementation, this would use more sophisticated
    // voice feature extraction techniques
    const features = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      // Extract basic audio features
      energyProfile: extractEnergyProfile(audioBuffer),
      frequencyProfile: extractFrequencyProfile(audioBuffer),
      // Add timestamp for model versioning
      extractedAt: Date.now()
    };
    
    return features;
  } catch (error) {
    console.error('Failed to extract voice features:', error);
    return null;
  }
}

/**
 * Extract energy profile from audio buffer
 * @param {AudioBuffer} audioBuffer - Audio buffer
 * @returns {Array} Energy profile
 */
function extractEnergyProfile(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(data.length / 20);
  const profile = [];
  
  for (let i = 0; i < 20; i++) {
    let sum = 0;
    const offset = i * blockSize;
    
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(data[offset + j]);
    }
    
    profile.push(sum / blockSize);
  }
  
  return profile;
}

/**
 * Extract frequency profile from audio buffer
 * @param {AudioBuffer} audioBuffer - Audio buffer
 * @returns {Array} Frequency profile
 */
function extractFrequencyProfile(audioBuffer) {
  // This is a simplified implementation
  // In a real implementation, this would use FFT to extract frequency components
  const data = audioBuffer.getChannelData(0);
  const profile = [];
  const blockSize = Math.floor(data.length / 10);
  
  // Simple zero-crossing rate as a very basic frequency measure
  for (let i = 0; i < 10; i++) {
    let crossings = 0;
    const offset = i * blockSize;
    
    for (let j = 1; j < blockSize; j++) {
      if ((data[offset + j] >= 0 && data[offset + j - 1] < 0) || 
          (data[offset + j] < 0 && data[offset + j - 1] >= 0)) {
        crossings++;
      }
    }
    
    profile.push(crossings / blockSize * audioBuffer.sampleRate);
  }
  
  return profile;
}

/**
 * Compare voice features to a voice model
 * @param {Object} features - Voice features
 * @param {Object} modelData - Voice model data
 * @returns {number} Confidence score (0-1)
 */
function compareVoiceFeatures(features, modelData) {
  // This is a simplified implementation
  // In a real implementation, this would use more sophisticated
  // comparison techniques like MFCC distance, DTW, or neural networks
  
  // Compare energy profiles
  const energySimilarity = compareProfiles(
    features.energyProfile,
    modelData.energyProfile
  );
  
  // Compare frequency profiles
  const frequencySimilarity = compareProfiles(
    features.frequencyProfile,
    modelData.frequencyProfile
  );
  
  // Combine similarities (weighted average)
  const confidence = (energySimilarity * 0.4) + (frequencySimilarity * 0.6);
  
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Compare two profiles (arrays of numbers)
 * @param {Array} profile1 - First profile
 * @param {Array} profile2 - Second profile
 * @returns {number} Similarity score (0-1)
 */
function compareProfiles(profile1, profile2) {
  // Ensure profiles are the same length
  const length = Math.min(profile1.length, profile2.length);
  
  // Calculate normalized Euclidean distance
  let sumSquaredDiff = 0;
  let sumSquaredValues = 0;
  
  for (let i = 0; i < length; i++) {
    const diff = profile1[i] - profile2[i];
    sumSquaredDiff += diff * diff;
    sumSquaredValues += profile1[i] * profile1[i] + profile2[i] * profile2[i];
  }
  
  // Avoid division by zero
  if (sumSquaredValues === 0) {
    return 0;
  }
  
  // Convert distance to similarity (1 - normalized distance)
  const distance = Math.sqrt(sumSquaredDiff) / Math.sqrt(sumSquaredValues);
  return 1 - Math.min(1, distance);
}

/**
 * Check if the user has provided required consent
 * @returns {Promise<boolean>} Consent status
 */
async function checkRequiredConsent() {
  if (security && typeof security.checkConsent === 'function') {
    const voiceRecordingConsent = await security.checkConsent('voice-recording');
    const voiceProcessingConsent = await security.checkConsent('voice-processing');
    const voiceAuthConsent = await security.checkConsent('voice-authentication');
    
    return voiceRecordingConsent && voiceProcessingConsent && voiceAuthConsent;
  }
  
  return true; // Default to true if security module not available
}

/**
 * Generate a unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return 'vrec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Load voice models from storage
 * @returns {Promise<boolean>} Success status
 */
async function loadVoiceModels() {
  try {
    // Try to get models from training module first
    if (training && typeof training.getAvailableVoices === 'function') {
      const voices = await training.getAvailableVoices();
      if (voices && voices.length > 0) {
        // Models are already loaded in the training module
        return true;
      }
    }
    
    // Otherwise load from secure storage
    if (security && typeof security.getSecureData === 'function') {
      const encryptedData = await security.getSecureData(VOICE_STORAGE_KEY);
      
      if (encryptedData) {
        const decryptedData = await security.decryptData(encryptedData);
        
        if (decryptedData && Array.isArray(decryptedData)) {
          voiceModels.clear();
          
          for (const model of decryptedData) {
            voiceModels.set(model.id, model);
          }
          
          console.log(`Loaded ${voiceModels.size} voice models`);
          return true;
        }
      }
    }
    
    // Ensure default voice model exists
    if (!voiceModels.has(DEFAULT_VOICE_ID)) {
      // Create default voice model
      voiceModels.set(DEFAULT_VOICE_ID, {
        id: DEFAULT_VOICE_ID,
        created: Date.now(),
        updated: Date.now(),
        sampleCount: 1,
        isMemorialVoice: false,
        modelData: {
          // Default voice features (would be more complex in real implementation)
          energyProfile: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          frequencyProfile: [120, 130, 140, 150, 160, 170, 180, 170, 160, 150]
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to load voice models:', error);
    return false;
  }
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
function handleUserLogin(data) {
  if (data && data.isOwner) {
    console.log('Owner logged in, enabling all voice recognition features');
  }
}

/**
 * Handle user logout event
 */
function handleUserLogout() {
  // End any active verification session
  if (currentVerificationSession) {
    endVerification();
  }
}

/**
 * Handle security level change event
 * @param {Object} data - Event data
 */
function handleSecurityLevelChange(data) {
  // Adjust behavior based on security level
  if (data && data.level === 'high') {
    // Increase confidence threshold for high security
    CONFIDENCE_THRESHOLD = 0.85;
  } else {
    // Reset to default
    CONFIDENCE_THRESHOLD = 0.75;
  }
}

/**
 * Handle voice model created event
 * @param {Object} data - Event data
 */
function handleVoiceModelCreated(data) {
  // Reload voice models when a new one is created
  loadVoiceModels();
}

// Export additional functions for testing and advanced usage
export const _testing = {
  extractVoiceFeatures,
  compareVoiceFeatures,
  CONFIDENCE_THRESHOLD
};
