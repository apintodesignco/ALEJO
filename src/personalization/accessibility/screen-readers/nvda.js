/**
 * NVDA (NonVisual Desktop Access) Integration Module
 * 
 * This module provides integration with the open source NVDA screen reader.
 * It handles communication between ALEJO and NVDA via available APIs and
 * ensures proper accessibility announcements and controls.
 * 
 * NVDA is a free, open source screen reader for Microsoft Windows.
 * Website: https://www.nvaccess.org/
 */

import { eventEmitter } from '../../../core/event-emitter.js';
import { auditTrail } from '../../../core/audit-trail.js';

// NVDA specific constants
const NVDA_CONTROLLER_CLIENT_DLL = 'nvdaControllerClient.dll';
const NVDA_API_CHECK_INTERVAL = 2000; // Check NVDA availability every 2 seconds
const NVDA_DETECTION_KEYS = ['nvda', 'NVDA'];

// State management
let isDetected = false;
let isConnected = false;
let detectionInterval = null;
let nvdaController = null;

/**
 * Detects if NVDA is running on the system
 * @returns {Promise<boolean>} - Whether NVDA is detected
 */
async function detectNVDA() {
  // Check for NVDA specific objects or properties in the window
  if (typeof window !== 'undefined') {
    // 1. Check for NVDA controller objects
    if (window.nvdaController) {
      return true;
    }
    
    // 2. Look for specific NVDA keyboard modifications
    try {
      if (NVDA_DETECTION_KEYS.some(key => key in window)) {
        return true;
      }
    } catch (e) {
      // Ignore errors in detection
    }
    
    // 3. Check for NVDA specific CSS classes or attributes
    const nvdaElements = document.querySelectorAll('[nvda-role], [data-nvda]');
    if (nvdaElements.length > 0) {
      return true;
    }

    // 4. Test if accessibilityState includes specific NVDA information
    if (navigator.userAgent.toLowerCase().includes('nvda')) {
      return true;
    }
  }

  return false;
}

/**
 * Attempt to initialize connection to NVDA
 * @returns {Promise<boolean>} - Whether connection succeeded
 */
async function connectToNVDA() {
  if (isConnected) return true;
  
  try {
    // First check if NVDA is running
    isDetected = await detectNVDA();
    
    if (!isDetected) {
      console.info('NVDA not detected, integration unavailable');
      return false;
    }
    
    // If NVDA is detected, try to establish communication
    if (window.nvdaController) {
      nvdaController = window.nvdaController;
      isConnected = true;
      
      auditTrail.log('accessibility', 'NVDA connection established');
      eventEmitter.emit('accessibility:nvda:connected', { success: true });
      
      return true;
    }
    
    // If direct controller not available, use NVDA API via compatible interfaces
    // This would use accessibility APIs that NVDA can detect
    isConnected = true;
    auditTrail.log('accessibility', 'NVDA compatible mode activated');
    eventEmitter.emit('accessibility:nvda:connected', { success: true, compatMode: true });
    
    return true;
  } catch (error) {
    console.error('Error connecting to NVDA:', error);
    auditTrail.log('accessibility', 'NVDA connection failed', { error: error.message });
    return false;
  }
}

/**
 * Start NVDA detection and reconnection attempts
 */
function startDetection() {
  if (detectionInterval) return;
  
  detectionInterval = setInterval(async () => {
    if (!isConnected) {
      const detected = await detectNVDA();
      if (detected && !isDetected) {
        isDetected = true;
        await connectToNVDA();
      } else if (!detected && isDetected) {
        isDetected = false;
        isConnected = false;
        eventEmitter.emit('accessibility:nvda:disconnected');
      }
    }
  }, NVDA_API_CHECK_INTERVAL);
}

/**
 * Stop NVDA detection
 */
function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

/**
 * Speak text with NVDA directly if possible
 * @param {string} text - Text to speak
 * @param {boolean} interrupt - Whether to interrupt current speech
 * @returns {boolean} - Whether speak request was successful
 */
function speak(text, interrupt = false) {
  if (!isConnected) return false;
  
  try {
    // If we have direct NVDA controller access
    if (nvdaController && typeof nvdaController.speakText === 'function') {
      nvdaController.speakText(text, interrupt);
      return true;
    }
    
    // Alternative: Create temporary live region for NVDA to detect
    const tempLiveRegion = document.createElement('div');
    tempLiveRegion.setAttribute('aria-live', interrupt ? 'assertive' : 'polite');
    tempLiveRegion.style.position = 'absolute';
    tempLiveRegion.style.width = '1px';
    tempLiveRegion.style.height = '1px';
    tempLiveRegion.style.overflow = 'hidden';
    tempLiveRegion.style.clip = 'rect(0 0 0 0)';
    document.body.appendChild(tempLiveRegion);
    
    // Use a small delay to ensure ARIA processing
    setTimeout(() => {
      tempLiveRegion.textContent = text;
      
      // Clean up after announcement
      setTimeout(() => {
        if (tempLiveRegion.parentNode) {
          tempLiveRegion.parentNode.removeChild(tempLiveRegion);
        }
      }, 3000);
    }, 50);
    
    return true;
  } catch (error) {
    console.error('Error using NVDA speak:', error);
    return false;
  }
}

/**
 * Register a custom keyboard command with NVDA if possible
 * @param {string} key - Key combination
 * @param {Function} callback - Callback function
 * @returns {boolean} - Whether registration succeeded
 */
function registerKeyCommand(key, callback) {
  if (!isConnected) return false;
  
  try {
    // If direct NVDA controller access is available
    if (nvdaController && typeof nvdaController.registerScriptHandler === 'function') {
      // This is a simplified concept - actual implementation would depend on NVDA's API
      nvdaController.registerScriptHandler(key, callback);
      return true;
    }
    
    // Fallback: Use standard keyboard events
    const keyHandler = (e) => {
      // Convert key event to NVDA compatible format
      const keyCombo = makeNVDAKeyString(e);
      if (keyCombo === key) {
        callback(e);
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    return true;
  } catch (error) {
    console.error('Error registering NVDA key command:', error);
    return false;
  }
}

/**
 * Helper to convert keyboard event to NVDA key string format
 * @param {KeyboardEvent} e - Keyboard event
 * @returns {string} - NVDA key string
 */
function makeNVDAKeyString(e) {
  let result = '';
  if (e.ctrlKey) result += 'control+';
  if (e.altKey) result += 'alt+';
  if (e.shiftKey) result += 'shift+';
  if (e.metaKey) result += 'windows+';
  result += e.key.toLowerCase();
  return result;
}

/**
 * Initialize the NVDA integration
 * @returns {Promise<Object>} - NVDA interface object
 */
async function initialize() {
  const connected = await connectToNVDA();
  if (connected) {
    startDetection();
  }
  
  return {
    isAvailable: () => isConnected,
    speak,
    registerKeyCommand,
    connect: connectToNVDA,
    disconnect: () => {
      stopDetection();
      isConnected = false;
      isDetected = false;
      nvdaController = null;
      eventEmitter.emit('accessibility:nvda:disconnected');
      return true;
    }
  };
}

export const nvdaAdapter = {
  initialize,
  detectNVDA,
  isAvailable: () => isConnected
};
