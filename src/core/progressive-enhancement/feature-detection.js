/**
 * @file feature-detection.js
 * @description Feature detection for progressive enhancement
 * @module core/progressive-enhancement/feature-detection
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { publish } from '../events.js';

// Feature categories
export const FEATURE_CATEGORIES = Object.freeze({
  ACCESSIBILITY: 'accessibility',
  AUDIO: 'audio',
  GRAPHICS: 'graphics',
  INPUT: 'input',
  MEDIA: 'media',
  NETWORKING: 'networking',
  PERFORMANCE: 'performance',
  STORAGE: 'storage'
});

/**
 * Feature detection service
 */
export class FeatureDetection {
  static detectedFeatures = new Map();
  
  /**
   * Detect all available features
   * 
   * @returns {Promise<Object>} - Object containing all detected features
   */
  static async detectAll() {
    try {
      // Collect all feature detection results
      const features = {
        timestamp: Date.now()
      };
      
      // Accessibility features
      features.accessibility = {
        speechSynthesis: this.detectSpeechSynthesis(),
        speechRecognition: this.detectSpeechRecognition(),
        highContrast: this.detectHighContrastSupport(),
        reducedMotion: this.detectReducedMotion()
      };
      
      // Audio features
      features.audio = {
        webAudio: this.detectWebAudio(),
        audioWorklet: this.detectAudioWorklet(),
        speechRecognition: this.detectSpeechRecognition()
      };
      
      // Graphics features
      features.graphics = {
        canvas2D: this.detectCanvas2D(),
        webGL: this.detectWebGL(),
        webGL2: this.detectWebGL2(),
        webGPU: this.detectWebGPU()
      };
      
      // Input features
      features.input = {
        touch: this.detectTouchSupport(),
        pointer: this.detectPointerEvents(),
        gamepad: this.detectGamepad(),
        webMIDI: this.detectWebMIDI()
      };
      
      // Media features
      features.media = {
        videoPlayback: this.detectVideoPlayback(),
        mediaRecorder: this.detectMediaRecorder(),
        imageCapture: this.detectImageCapture(),
        mediaSession: this.detectMediaSession()
      };
      
      // Networking features
      features.networking = {
        fetch: this.detectFetch(),
        webSockets: this.detectWebSockets(),
        webRTC: this.detectWebRTC(),
        backgroundSync: this.detectBackgroundSync()
      };
      
      // Performance features
      features.performance = {
        webWorkers: this.detectWebWorkers(),
        sharedArrayBuffer: this.detectSharedArrayBuffer(),
        webAssembly: this.detectWebAssembly()
      };
      
      // Storage features
      features.storage = {
        localStorage: this.detectLocalStorage(),
        sessionStorage: this.detectSessionStorage(),
        indexedDB: this.detectIndexedDB(),
        cacheAPI: this.detectCacheAPI()
      };
      
      // Store detected features
      this.detectedFeatures.clear();
      this.flattenFeatures(features).forEach((value, key) => {
        this.detectedFeatures.set(key, value);
      });
      
      // Publish feature detection results
      publish('feature-detection:completed', features);
      
      return features;
    } catch (error) {
      console.error('[FeatureDetection] Error detecting features:', error);
      return {
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
  
  /**
   * Flatten nested feature object to a Map
   * 
   * @param {Object} features - Nested feature object
   * @param {string} prefix - Prefix for flattened keys
   * @returns {Map} - Flattened map of features
   */
  static flattenFeatures(features, prefix = '') {
    const result = new Map();
    
    Object.entries(features).forEach(([key, value]) => {
      if (key === 'timestamp') return;
      
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedMap = this.flattenFeatures(value, newKey);
        nestedMap.forEach((nestedValue, nestedKey) => {
          result.set(nestedKey, nestedValue);
        });
      } else {
        result.set(newKey, value);
      }
    });
    
    return result;
  }
  
  /**
   * Check if a specific feature is supported
   * 
   * @param {string} featureId - Feature identifier (e.g., 'graphics.webGL')
   * @returns {boolean} - Whether the feature is supported
   */
  static isFeatureSupported(featureId) {
    // If we haven't detected features yet, do it now
    if (this.detectedFeatures.size === 0) {
      return false; // Will be updated after detectAll() is called
    }
    
    return this.detectedFeatures.get(featureId) === true;
  }
  
  /* ========== Accessibility Feature Detection ========== */
  
  /**
   * Detect Speech Synthesis API support
   * 
   * @returns {boolean} - Whether Speech Synthesis is supported
   */
  static detectSpeechSynthesis() {
    return 'speechSynthesis' in window;
  }
  
  /**
   * Detect Speech Recognition API support
   * 
   * @returns {boolean} - Whether Speech Recognition is supported
   */
  static detectSpeechRecognition() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * Detect if high contrast mode is supported/enabled
   * 
   * @returns {boolean} - Whether high contrast mode is detected
   */
  static detectHighContrastSupport() {
    // This is a simplification - proper detection requires more complex testing
    try {
      // Create a small test element
      const el = document.createElement('div');
      el.style.color = 'red';
      el.style.backgroundColor = 'blue';
      el.style.position = 'absolute';
      el.style.opacity = '0.001';
      document.body.appendChild(el);
      
      // Check computed styles
      const computed = getComputedStyle(el);
      const result = computed.color !== 'rgb(255, 0, 0)' || computed.backgroundColor !== 'rgb(0, 0, 255)';
      
      document.body.removeChild(el);
      return result;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect prefers-reduced-motion media query
   * 
   * @returns {boolean} - Whether reduced motion is preferred
   */
  static detectReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ========== Audio Feature Detection ========== */
  
  /**
   * Detect Web Audio API support
   * 
   * @returns {boolean} - Whether Web Audio API is supported
   */
  static detectWebAudio() {
    return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
  }
  
  /**
   * Detect Audio Worklet API support
   * 
   * @returns {boolean} - Whether Audio Worklet API is supported
   */
  static detectAudioWorklet() {
    try {
      const context = new (AudioContext || webkitAudioContext)();
      return typeof context.audioWorklet !== 'undefined';
    } catch (e) {
      return false;
    }
  }
  
  /* ========== Graphics Feature Detection ========== */
  
  /**
   * Detect Canvas 2D API support
   * 
   * @returns {boolean} - Whether Canvas 2D API is supported
   */
  static detectCanvas2D() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect WebGL 1.0 support
   * 
   * @returns {boolean} - Whether WebGL 1.0 is supported
   */
  static detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect WebGL 2.0 support
   * 
   * @returns {boolean} - Whether WebGL 2.0 is supported
   */
  static detectWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect WebGPU API support
   * 
   * @returns {boolean} - Whether WebGPU is supported
   */
  static detectWebGPU() {
    return 'gpu' in navigator;
  }
  
  /* ========== Input Feature Detection ========== */
  
  /**
   * Detect touch support
   * 
   * @returns {boolean} - Whether touch input is supported
   */
  static detectTouchSupport() {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
  }
  
  /**
   * Detect Pointer Events support
   * 
   * @returns {boolean} - Whether Pointer Events are supported
   */
  static detectPointerEvents() {
    return window.PointerEvent !== undefined;
  }
  
  /**
   * Detect Gamepad API support
   * 
   * @returns {boolean} - Whether Gamepad API is supported
   */
  static detectGamepad() {
    return 'getGamepads' in navigator;
  }
  
  /**
   * Detect Web MIDI API support
   * 
   * @returns {boolean} - Whether Web MIDI API is supported
   */
  static detectWebMIDI() {
    return 'requestMIDIAccess' in navigator;
  }
  
  /* ========== Media Feature Detection ========== */
  
  /**
   * Detect video playback support
   * 
   * @returns {boolean} - Whether video playback is supported
   */
  static detectVideoPlayback() {
    return !!document.createElement('video').canPlayType;
  }
  
  /**
   * Detect MediaRecorder API support
   * 
   * @returns {boolean} - Whether MediaRecorder is supported
   */
  static detectMediaRecorder() {
    return typeof MediaRecorder !== 'undefined';
  }
  
  /**
   * Detect ImageCapture API support
   * 
   * @returns {boolean} - Whether ImageCapture is supported
   */
  static detectImageCapture() {
    return typeof ImageCapture !== 'undefined';
  }
  
  /**
   * Detect Media Session API support
   * 
   * @returns {boolean} - Whether Media Session API is supported
   */
  static detectMediaSession() {
    return 'mediaSession' in navigator;
  }
  
  /* ========== Networking Feature Detection ========== */
  
  /**
   * Detect Fetch API support
   * 
   * @returns {boolean} - Whether Fetch API is supported
   */
  static detectFetch() {
    return 'fetch' in window;
  }
  
  /**
   * Detect WebSocket API support
   * 
   * @returns {boolean} - Whether WebSocket API is supported
   */
  static detectWebSockets() {
    return 'WebSocket' in window;
  }
  
  /**
   * Detect WebRTC support
   * 
   * @returns {boolean} - Whether WebRTC is supported
   */
  static detectWebRTC() {
    return navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices;
  }
  
  /**
   * Detect Background Sync API support
   * 
   * @returns {boolean} - Whether Background Sync API is supported
   */
  static detectBackgroundSync() {
    return 'serviceWorker' in navigator && 'SyncManager' in window;
  }
  
  /* ========== Performance Feature Detection ========== */
  
  /**
   * Detect Web Workers support
   * 
   * @returns {boolean} - Whether Web Workers are supported
   */
  static detectWebWorkers() {
    return typeof Worker !== 'undefined';
  }
  
  /**
   * Detect SharedArrayBuffer support
   * 
   * @returns {boolean} - Whether SharedArrayBuffer is supported
   */
  static detectSharedArrayBuffer() {
    try {
      // This will throw if SharedArrayBuffer is not available or not enabled
      // Note: This requires appropriate headers for security (COOP/COEP)
      return typeof SharedArrayBuffer !== 'undefined';
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect WebAssembly support
   * 
   * @returns {boolean} - Whether WebAssembly is supported
   */
  static detectWebAssembly() {
    try {
      // Feature detection for WebAssembly
      return typeof WebAssembly === 'object' && 
             typeof WebAssembly.compile === 'function';
    } catch (e) {
      return false;
    }
  }
  
  /* ========== Storage Feature Detection ========== */
  
  /**
   * Detect localStorage support
   * 
   * @returns {boolean} - Whether localStorage is supported and available
   */
  static detectLocalStorage() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect sessionStorage support
   * 
   * @returns {boolean} - Whether sessionStorage is supported and available
   */
  static detectSessionStorage() {
    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, testKey);
      sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect IndexedDB support
   * 
   * @returns {boolean} - Whether IndexedDB is supported
   */
  static detectIndexedDB() {
    return !!window.indexedDB;
  }
  
  /**
   * Detect Cache API support
   * 
   * @returns {boolean} - Whether Cache API is supported
   */
  static detectCacheAPI() {
    return 'caches' in window;
  }
}
