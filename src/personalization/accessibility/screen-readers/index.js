/**
 * Screen Reader Factory Module
 * 
 * This module provides a unified interface for accessing different screen reader integrations.
 * It automatically selects the appropriate screen reader based on availability and user preferences.
 */

import { eventEmitter } from '../../../core/event-emitter.js';
import { auditTrail } from '../../../core/audit-trail.js';
import { ConfigManager } from '../../../core/config-manager.js';
import { nvdaAdapter } from './nvda.js';

// Constants for configuration
const CONFIG_KEY_PREFIX = 'accessibility.screenReader';

// List of supported screen readers in priority order
const SCREEN_READERS = {
  NVDA: 'nvda',
  SYSTEM: 'system', // Browser's native accessibility API
  CUSTOM: 'custom'  // ALEJO's custom screen reader implementation
};

// Screen reader adapter registry
const screenReaderAdapters = {
  [SCREEN_READERS.NVDA]: nvdaAdapter,
  // Additional screen readers can be added here
};

// State management
let activeScreenReader = null;
let activeAdapterName = null;
let configInstance = null;
let isInitialized = false;

/**
 * Auto-detects available screen readers
 * @returns {Promise<Object>} - Object with detection results
 */
async function detectScreenReaders() {
  const results = {};
  
  try {
    // Check for NVDA
    results[SCREEN_READERS.NVDA] = await nvdaAdapter.detectNVDA();
    
    // Check for system screen readers
    results[SCREEN_READERS.SYSTEM] = !!window.speechSynthesis;
    
    auditTrail.log('accessibility', 'Screen reader detection completed', { results });
    return results;
  } catch (error) {
    console.error('Error detecting screen readers:', error);
    auditTrail.log('accessibility', 'Screen reader detection failed', { error: error.message });
    return results;
  }
}

/**
 * Get the best available screen reader
 * @param {string} preferredReader - Preferred screen reader (optional)
 * @returns {Promise<Object>} - Selected screen reader info
 */
async function selectScreenReader(preferredReader = null) {
  // Get configuration if not already loaded
  if (!configInstance) {
    configInstance = await ConfigManager.getInstance();
  }
  
  // Get user preferences
  const userPreference = preferredReader || await configInstance.get(`${CONFIG_KEY_PREFIX}.preferredReader`);
  
  // Detect available readers
  const availableReaders = await detectScreenReaders();
  
  // If user has a preference and it's available, use it
  if (userPreference && availableReaders[userPreference]) {
    return {
      name: userPreference,
      adapter: screenReaderAdapters[userPreference]
    };
  }
  
  // Otherwise select the first available reader in priority order
  for (const readerName of Object.values(SCREEN_READERS)) {
    if (availableReaders[readerName] && screenReaderAdapters[readerName]) {
      return {
        name: readerName,
        adapter: screenReaderAdapters[readerName]
      };
    }
  }
  
  // Fallback to system API as last resort
  return {
    name: SCREEN_READERS.SYSTEM,
    adapter: null // Will use browser API directly
  };
}

/**
 * Initialize and activate a screen reader
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Screen reader interface
 */
async function initialize(options = {}) {
  if (isInitialized && activeScreenReader) {
    return activeScreenReader;
  }
  
  try {
    // Select appropriate screen reader
    const { name, adapter } = await selectScreenReader(options.preferredReader);
    
    // Initialize the selected adapter
    if (adapter) {
      activeScreenReader = await adapter.initialize();
      activeAdapterName = name;
      
      auditTrail.log('accessibility', `Screen reader initialized: ${name}`);
      eventEmitter.emit('accessibility:screen-reader:selected', { 
        name, 
        success: true 
      });
      
      isInitialized = true;
      return activeScreenReader;
    } else {
      // Fall back to browser's native API
      auditTrail.log('accessibility', 'Using browser native accessibility API');
      eventEmitter.emit('accessibility:screen-reader:selected', { 
        name: SCREEN_READERS.SYSTEM, 
        success: true,
        native: true
      });
      
      // Return a minimal interface using browser capabilities
      activeScreenReader = {
        isAvailable: () => !!window.speechSynthesis,
        speak: (text, interrupt) => {
          if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            if (interrupt) {
              window.speechSynthesis.cancel();
            }
            window.speechSynthesis.speak(utterance);
            return true;
          }
          return false;
        }
      };
      
      activeAdapterName = SCREEN_READERS.SYSTEM;
      isInitialized = true;
      return activeScreenReader;
    }
  } catch (error) {
    console.error('Error initializing screen reader:', error);
    auditTrail.log('accessibility', 'Screen reader initialization failed', { error: error.message });
    return null;
  }
}

/**
 * Shut down active screen reader
 * @returns {Promise<boolean>} - Whether shutdown succeeded
 */
async function shutdown() {
  if (!isInitialized || !activeScreenReader) {
    return true;
  }
  
  try {
    // If screen reader has disconnect method, use it
    if (activeScreenReader.disconnect && typeof activeScreenReader.disconnect === 'function') {
      await activeScreenReader.disconnect();
    }
    
    // If using system speech synthesis, cancel any ongoing speech
    if (activeAdapterName === SCREEN_READERS.SYSTEM && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    activeScreenReader = null;
    activeAdapterName = null;
    isInitialized = false;
    
    auditTrail.log('accessibility', 'Screen reader shut down successfully');
    eventEmitter.emit('accessibility:screen-reader:shutdown', { success: true });
    
    return true;
  } catch (error) {
    console.error('Error shutting down screen reader:', error);
    auditTrail.log('accessibility', 'Screen reader shutdown failed', { error: error.message });
    return false;
  }
}

/**
 * Get active screen reader information
 * @returns {Object} - Info about active screen reader
 */
function getActiveScreenReader() {
  return {
    name: activeAdapterName,
    isActive: isInitialized && !!activeScreenReader,
    isAvailable: activeScreenReader ? activeScreenReader.isAvailable() : false
  };
}

export const screenReaderFactory = {
  initialize,
  shutdown,
  getActiveReader: getActiveScreenReader,
  detectAvailableReaders: detectScreenReaders,
  SCREEN_READERS
};
