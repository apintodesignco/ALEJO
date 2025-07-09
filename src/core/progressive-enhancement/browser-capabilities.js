/**
 * @file browser-capabilities.js
 * @description Detects browser capabilities for progressive enhancement
 * @module core/progressive-enhancement/browser-capabilities
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { publish } from '../events.js';

/**
 * Browser capabilities detection service
 */
export class BrowserCapabilities {
  /**
   * Detect all browser capabilities
   * 
   * @returns {Promise<Object>} - Object containing detected capabilities
   */
  static async detect() {
    const capabilities = {
      // System capabilities
      memory: this.detectMemory(),
      cpu: this.detectCPU(),
      cores: this.detectCores(),
      mobile: this.detectMobile(),
      
      // Graphics capabilities
      webgl: this.detectWebGL(),
      webgl2: this.detectWebGL2(),
      canvas: this.detectCanvas(),
      
      // API support
      webRTC: this.detectWebRTC(),
      webWorkers: this.detectWebWorkers(),
      serviceWorker: this.detectServiceWorker(),
      indexedDB: this.detectIndexedDB(),
      localStorage: this.detectLocalStorage(),
      
      // Media capabilities
      mediaRecording: this.detectMediaRecording(),
      speechRecognition: this.detectSpeechRecognition(),
      speechSynthesis: this.detectSpeechSynthesis(),
      webAudio: this.detectWebAudio(),
      
      // Accessibility features
      contrastSupport: this.detectContrastMode(),
      
      // Overall performance estimate
      performanceLevel: 'unknown'
    };
    
    // Publish detected capabilities
    publish('browser-capabilities:detected', capabilities);
    
    // Estimate overall performance level
    capabilities.performanceLevel = this.estimatePerformanceLevel(capabilities);
    
    return capabilities;
  }
  
  /**
   * Detect device memory (in GB)
   * 
   * @returns {number|null} - Amount of device memory or null if not detectable
   */
  static detectMemory() {
    if (navigator.deviceMemory !== undefined) {
      return navigator.deviceMemory;
    }
    
    return null; // Not detectable
  }
  
  /**
   * Estimate CPU performance using a quick benchmark
   * 
   * @returns {string} - CPU performance category (high, medium, low)
   */
  static detectCPU() {
    try {
      // Simple computational benchmark (fibonacci calculation)
      const start = performance.now();
      
      // Calculate fibonacci(35) using iterative approach
      let a = 0, b = 1;
      for (let i = 0; i < 35; i++) {
        [a, b] = [b, a + b];
      }
      
      const end = performance.now();
      const executionTime = end - start;
      
      // Categorize based on execution time
      if (executionTime < 5) {
        return 'high';
      } else if (executionTime < 20) {
        return 'medium';
      } else {
        return 'low';
      }
    } catch (e) {
      console.error('[BrowserCapabilities] CPU detection error:', e);
      return 'unknown';
    }
  }
  
  /**
   * Detect number of logical processor cores
   * 
   * @returns {number|null} - Number of cores or null if not detectable
   */
  static detectCores() {
    if (navigator.hardwareConcurrency !== undefined) {
      return navigator.hardwareConcurrency;
    }
    
    return null; // Not detectable
  }
  
  /**
   * Detect if running on a mobile device
   * 
   * @returns {boolean} - True if on mobile device
   */
  static detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * Detect WebGL support
   * 
   * @returns {boolean} - True if WebGL is supported
   */
  static detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (context && typeof context.getParameter === 'function') {
        return true;
      }
    } catch (e) {
      console.error('[BrowserCapabilities] WebGL detection error:', e);
    }
    
    return false;
  }
  
  /**
   * Detect WebGL2 support
   * 
   * @returns {boolean} - True if WebGL2 is supported
   */
  static detectWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      
      if (context && typeof context.getParameter === 'function') {
        return true;
      }
    } catch (e) {
      console.error('[BrowserCapabilities] WebGL2 detection error:', e);
    }
    
    return false;
  }
  
  /**
   * Detect HTML5 canvas support
   * 
   * @returns {boolean} - True if canvas is supported
   */
  static detectCanvas() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect WebRTC support
   * 
   * @returns {boolean} - True if WebRTC is supported
   */
  static detectWebRTC() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  /**
   * Detect Web Workers support
   * 
   * @returns {boolean} - True if Web Workers are supported
   */
  static detectWebWorkers() {
    return !!window.Worker;
  }
  
  /**
   * Detect Service Worker support
   * 
   * @returns {boolean} - True if Service Workers are supported
   */
  static detectServiceWorker() {
    return 'serviceWorker' in navigator;
  }
  
  /**
   * Detect IndexedDB support
   * 
   * @returns {boolean} - True if IndexedDB is supported
   */
  static detectIndexedDB() {
    return !!window.indexedDB;
  }
  
  /**
   * Detect localStorage support
   * 
   * @returns {boolean} - True if localStorage is supported
   */
  static detectLocalStorage() {
    try {
      const testKey = '__test_local_storage__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect MediaRecorder support
   * 
   * @returns {boolean} - True if MediaRecorder is supported
   */
  static detectMediaRecording() {
    return !!window.MediaRecorder;
  }
  
  /**
   * Detect Speech Recognition support
   * 
   * @returns {boolean} - True if Speech Recognition is supported
   */
  static detectSpeechRecognition() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * Detect Speech Synthesis support
   * 
   * @returns {boolean} - True if Speech Synthesis is supported
   */
  static detectSpeechSynthesis() {
    return !!window.speechSynthesis;
  }
  
  /**
   * Detect Web Audio API support
   * 
   * @returns {boolean} - True if Web Audio API is supported
   */
  static detectWebAudio() {
    return !!window.AudioContext || !!window.webkitAudioContext;
  }
  
  /**
   * Detect if high contrast mode is enabled
   * 
   * @returns {boolean|null} - True if high contrast mode is detected, null if unknown
   */
  static detectContrastMode() {
    try {
      // Create test elements to detect high contrast mode
      const element = document.createElement('div');
      element.style.cssText = 'position:absolute;opacity:0.001;height:1em;width:1em;left:0;top:0;z-index:-1;';
      element.style.backgroundColor = 'rgb(240,240,240)';
      element.style.color = 'rgb(120,120,120)';
      document.head.appendChild(element);
      
      const computed = window.getComputedStyle(element);
      const bgColor = computed.backgroundColor;
      const textColor = computed.color;
      
      document.head.removeChild(element);
      
      // If colors are significantly different from what we set,
      // the browser is likely in high contrast mode
      return !this.isSimilarColor(bgColor, 'rgb(240,240,240)') || 
             !this.isSimilarColor(textColor, 'rgb(120,120,120)');
    } catch (e) {
      console.error('[BrowserCapabilities] Contrast detection error:', e);
      return null;
    }
  }
  
  /**
   * Compare two RGB colors for similarity
   * 
   * @param {string} color1 - First RGB color
   * @param {string} color2 - Second RGB color
   * @returns {boolean} - True if colors are similar
   */
  static isSimilarColor(color1, color2) {
    try {
      const rgb1 = this.parseRgb(color1);
      const rgb2 = this.parseRgb(color2);
      
      if (!rgb1 || !rgb2) return false;
      
      // Calculate Euclidean distance between colors
      const distance = Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
      );
      
      // Colors are considered similar if distance is less than 30
      return distance < 30;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Parse RGB color string
   * 
   * @param {string} color - RGB color string
   * @returns {Object|null} - Object with r, g, b properties
   */
  static parseRgb(color) {
    try {
      const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (match) {
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10)
        };
      }
    } catch (e) {
      console.error('[BrowserCapabilities] RGB parse error:', e);
    }
    
    return null;
  }
  
  /**
   * Estimate overall performance level based on detected capabilities
   * 
   * @param {Object} capabilities - Detected capabilities
   * @returns {string} - Performance level (high, medium, low)
   */
  static estimatePerformanceLevel(capabilities) {
    let score = 0;
    
    // CPU performance
    if (capabilities.cpu === 'high') score += 30;
    else if (capabilities.cpu === 'medium') score += 20;
    else if (capabilities.cpu === 'low') score += 10;
    
    // Memory
    if (capabilities.memory !== null) {
      if (capabilities.memory >= 8) score += 30;
      else if (capabilities.memory >= 4) score += 20;
      else score += 10;
    } else {
      // Default to medium if memory can't be detected
      score += 20;
    }
    
    // Cores
    if (capabilities.cores !== null) {
      if (capabilities.cores >= 8) score += 20;
      else if (capabilities.cores >= 4) score += 15;
      else if (capabilities.cores >= 2) score += 10;
      else score += 5;
    }
    
    // Mobile penalty (mobile devices typically have less sustained performance)
    if (capabilities.mobile) {
      score -= 10;
    }
    
    // Advanced graphics support
    if (capabilities.webgl2) score += 10;
    else if (capabilities.webgl) score += 5;
    
    // Workers for multithreading
    if (capabilities.webWorkers) score += 10;
    
    // Categorize
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}
