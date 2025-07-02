/**
 * ALEJO Voice Synthesis System
 * 
 * This module provides voice synthesis capabilities with the following features:
 * - Default voice (Alejo Pinto) that remains the signature sound
 * - Adaptive voice model based on user's speech patterns
 * - Voice style transfer and transformation
 * - Integration with trained voice models
 * 
 * Works in conjunction with the voice training and recognition modules.
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';
import * as training from './training.js';

// Constants
const DEFAULT_VOICE_ID = 'alejo-pinto-default';
const VOICE_STORAGE_KEY = 'alejo-voice-models';
const DEFAULT_RATE = 1.0;
const DEFAULT_PITCH = 1.0;
const DEFAULT_VOLUME = 1.0;

// State management
let initialized = false;
let speechSynthesis = window.speechSynthesis;
let availableVoices = [];
let currentVoice = null;
let voiceModels = new Map();
let voiceStyleMap = new Map();
let isSpeaking = false;
let currentUtterance = null;
let utteranceQueue = [];

/**
 * Initialize the voice synthesis system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Voice Synthesis System');
  
  if (initialized) {
    console.warn('Voice Synthesis System already initialized');
    return true;
  }
  
  try {
    // Initialize security module if not already done
    if (security && typeof security.initialize === 'function') {
      await security.initialize();
    }
    
    // Check if speech synthesis is available
    if (!speechSynthesis) {
      console.error('Speech synthesis not supported in this browser');
      publish('voice:error', { 
        component: 'synthesis',
        message: 'Speech synthesis not supported in this browser'
      });
      return false;
    }
    
    // Load available voices
    await loadAvailableVoices();
    
    // Load voice models (shared with training module)
    await loadVoiceModels();
    
    // Set up voice style mapping
    setupVoiceStyleMapping();
    
    // Set default voice
    setDefaultVoice();
    
    // Register for events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    subscribe('voice:training:model-created', handleVoiceModelCreated);
    
    // Handle browser tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    initialized = true;
    publish('voice:synthesis:initialized', { success: true });
    
    // Log initialization
    if (security && typeof security.logSecureEvent === 'function') {
      security.logSecureEvent('voice:synthesis:initialized', {
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Voice Synthesis System:', error);
    publish('voice:error', { 
      component: 'synthesis',
      message: error.message
    });
    return false;
  }
}

/**
 * Load available system voices
 * @returns {Promise<boolean>} Success status
 */
async function loadAvailableVoices() {
  return new Promise((resolve) => {
    // Function to handle voices loaded
    const handleVoicesChanged = () => {
      availableVoices = speechSynthesis.getVoices();
      console.log(`Loaded ${availableVoices.length} system voices`);
      
      // Remove event listener once voices are loaded
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(true);
    };
    
    // Check if voices are already available
    availableVoices = speechSynthesis.getVoices();
    if (availableVoices && availableVoices.length > 0) {
      console.log(`Loaded ${availableVoices.length} system voices`);
      resolve(true);
    } else {
      // Wait for voices to be loaded
      speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Set a timeout in case voices never load
      setTimeout(() => {
        speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        console.warn('Timed out waiting for system voices');
        resolve(false);
      }, 3000);
    }
  });
}

/**
 * Set up mapping between trained voice models and system voices
 */
function setupVoiceStyleMapping() {
  voiceStyleMap.clear();
  
  // Map default voice to a suitable system voice
  let defaultSystemVoice = availableVoices.find(voice => 
    voice.lang === 'en-US' && voice.name.includes('Male')
  );
  
  // Fallback to any English voice
  if (!defaultSystemVoice) {
    defaultSystemVoice = availableVoices.find(voice => 
      voice.lang.startsWith('en')
    );
  }
  
  // Last resort - first available voice
  if (!defaultSystemVoice && availableVoices.length > 0) {
    defaultSystemVoice = availableVoices[0];
  }
  
  if (defaultSystemVoice) {
    voiceStyleMap.set(DEFAULT_VOICE_ID, {
      systemVoice: defaultSystemVoice,
      pitch: 1.0,
      rate: 1.0,
      volume: 1.0
    });
  }
  
  // Map other trained voices to system voices
  // This is a simplified implementation - a real system would use more
  // sophisticated voice matching based on voice characteristics
  let voiceIndex = 0;
  
  for (const [voiceId, model] of voiceModels.entries()) {
    if (voiceId === DEFAULT_VOICE_ID) continue;
    
    // Skip if we don't have any system voices
    if (availableVoices.length === 0) continue;
    
    // Cycle through available voices
    const systemVoice = availableVoices[voiceIndex % availableVoices.length];
    voiceIndex++;
    
    // Create a unique style for this voice model
    voiceStyleMap.set(voiceId, {
      systemVoice,
      // Adjust parameters based on voice model characteristics
      pitch: model.isMemorialVoice ? 1.05 : 0.95,
      rate: model.isMemorialVoice ? 0.9 : 1.1,
      volume: 1.0
    });
  }
}

/**
 * Set the default voice
 */
function setDefaultVoice() {
  const defaultStyle = voiceStyleMap.get(DEFAULT_VOICE_ID);
  if (defaultStyle) {
    currentVoice = DEFAULT_VOICE_ID;
  } else {
    console.warn('Default voice style not available');
  }
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
        voiceModels.clear();
        
        for (const voice of voices) {
          voiceModels.set(voice.id, voice);
        }
        
        console.log(`Loaded ${voiceModels.size} voice models from training module`);
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
          
          console.log(`Loaded ${voiceModels.size} voice models from secure storage`);
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
        isMemorialVoice: false
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to load voice models:', error);
    return false;
  }
}

/**
 * Speak text using the current voice
 * @param {string} text - Text to speak
 * @param {Object} options - Speech options
 * @returns {Promise<Object>} Speech result
 */
export async function speak(text, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  if (!text) {
    return { success: false, error: 'No text provided' };
  }
  
  try {
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get voice style
    const voiceId = options.voiceId || currentVoice || DEFAULT_VOICE_ID;
    const voiceStyle = voiceStyleMap.get(voiceId);
    
    if (!voiceStyle) {
      console.warn(`Voice style not found for ${voiceId}, using default`);
      const defaultStyle = voiceStyleMap.get(DEFAULT_VOICE_ID);
      
      if (!defaultStyle) {
        return { success: false, error: 'No voice styles available' };
      }
      
      utterance.voice = defaultStyle.systemVoice;
      utterance.pitch = options.pitch || defaultStyle.pitch || DEFAULT_PITCH;
      utterance.rate = options.rate || defaultStyle.rate || DEFAULT_RATE;
      utterance.volume = options.volume || defaultStyle.volume || DEFAULT_VOLUME;
    } else {
      utterance.voice = voiceStyle.systemVoice;
      utterance.pitch = options.pitch || voiceStyle.pitch || DEFAULT_PITCH;
      utterance.rate = options.rate || voiceStyle.rate || DEFAULT_RATE;
      utterance.volume = options.volume || voiceStyle.volume || DEFAULT_VOLUME;
    }
    
    // Set language if provided
    if (options.language) {
      utterance.lang = options.language;
    }
    
    // Create a promise to track completion
    const speakPromise = new Promise((resolve, reject) => {
      utterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        
        // Process next utterance in queue
        processUtteranceQueue();
        
        resolve({
          success: true,
          text,
          voiceId
        });
      };
      
      utterance.onerror = (event) => {
        isSpeaking = false;
        currentUtterance = null;
        
        // Process next utterance in queue
        processUtteranceQueue();
        
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };
    });
    
    // If already speaking, add to queue
    if (isSpeaking) {
      utteranceQueue.push({
        utterance,
        promise: speakPromise
      });
      
      return speakPromise;
    }
    
    // Start speaking
    isSpeaking = true;
    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
    
    // Log speech event
    if (security && typeof security.logSecureEvent === 'function') {
      security.logSecureEvent('voice:synthesis:speaking', {
        voiceId,
        textLength: text.length,
        timestamp: new Date().toISOString()
      });
    }
    
    publish('voice:synthesis:speaking', {
      voiceId,
      textLength: text.length
    });
    
    return speakPromise;
  } catch (error) {
    console.error('Failed to speak text:', error);
    return { 
      success: false, 
      error: 'Failed to speak text: ' + error.message 
    };
  }
}

/**
 * Process the next utterance in the queue
 */
function processUtteranceQueue() {
  if (utteranceQueue.length === 0) {
    return;
  }
  
  if (isSpeaking) {
    return;
  }
  
  const next = utteranceQueue.shift();
  isSpeaking = true;
  currentUtterance = next.utterance;
  speechSynthesis.speak(next.utterance);
}

/**
 * Stop speaking and clear the utterance queue
 * @returns {Object} Result
 */
export function stop() {
  if (!initialized || !isSpeaking) {
    return { success: true, wasSpeaking: false };
  }
  
  try {
    speechSynthesis.cancel();
    isSpeaking = false;
    currentUtterance = null;
    utteranceQueue = [];
    
    publish('voice:synthesis:stopped');
    
    return { success: true, wasSpeaking: true };
  } catch (error) {
    console.error('Failed to stop speaking:', error);
    return { 
      success: false, 
      error: 'Failed to stop speaking: ' + error.message 
    };
  }
}

/**
 * Pause speaking
 * @returns {Object} Result
 */
export function pause() {
  if (!initialized || !isSpeaking) {
    return { success: true, wasSpeaking: false };
  }
  
  try {
    speechSynthesis.pause();
    publish('voice:synthesis:paused');
    
    return { success: true, wasSpeaking: true };
  } catch (error) {
    console.error('Failed to pause speaking:', error);
    return { 
      success: false, 
      error: 'Failed to pause speaking: ' + error.message 
    };
  }
}

/**
 * Resume speaking
 * @returns {Object} Result
 */
export function resume() {
  if (!initialized) {
    return { success: false, error: 'Voice synthesis not initialized' };
  }
  
  try {
    speechSynthesis.resume();
    publish('voice:synthesis:resumed');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to resume speaking:', error);
    return { 
      success: false, 
      error: 'Failed to resume speaking: ' + error.message 
    };
  }
}

/**
 * Set the current voice
 * @param {string} voiceId - Voice ID
 * @returns {Object} Result
 */
export function setVoice(voiceId) {
  if (!initialized) {
    return { success: false, error: 'Voice synthesis not initialized' };
  }
  
  if (!voiceModels.has(voiceId)) {
    return { success: false, error: 'Voice model not found' };
  }
  
  if (!voiceStyleMap.has(voiceId)) {
    return { success: false, error: 'Voice style not available' };
  }
  
  currentVoice = voiceId;
  
  publish('voice:synthesis:voice-changed', { voiceId });
  
  return { success: true, voiceId };
}

/**
 * Get available voices
 * @returns {Promise<Array>} Available voices
 */
export async function getAvailableVoices() {
  if (!initialized) {
    await initialize();
  }
  
  const voices = Array.from(voiceModels.values()).map(model => ({
    id: model.id,
    created: model.created,
    updated: model.updated,
    sampleCount: model.sampleCount,
    isMemorialVoice: model.isMemorialVoice,
    memorialInfo: model.isMemorialVoice ? model.memorialInfo : undefined,
    isDefault: model.id === DEFAULT_VOICE_ID,
    isAvailable: voiceStyleMap.has(model.id)
  }));
  
  return voices;
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
function handleUserLogin(data) {
  // Reload voice models on login
  loadVoiceModels().then(() => {
    setupVoiceStyleMapping();
  });
}

/**
 * Handle user logout event
 */
function handleUserLogout() {
  // Stop any active speech
  stop();
  
  // Reset to default voice
  setDefaultVoice();
}

/**
 * Handle voice model created event
 * @param {Object} data - Event data
 */
function handleVoiceModelCreated(data) {
  // Reload voice models when a new one is created
  loadVoiceModels().then(() => {
    setupVoiceStyleMapping();
  });
}

/**
 * Handle visibility change event
 */
function handleVisibilityChange() {
  // Chrome bug workaround: resume speech synthesis when tab becomes visible
  if (document.visibilityState === 'visible') {
    if (isSpeaking) {
      speechSynthesis.resume();
    }
  }
}

// Export additional functions for testing and advanced usage
export const _testing = {
  getVoiceStyle: (voiceId) => voiceStyleMap.get(voiceId),
  getSystemVoices: () => availableVoices
};
