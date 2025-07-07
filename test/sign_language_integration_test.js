/**
 * ALEJO Sign Language Integration Test
 * 
 * This test script verifies the integration between the enhanced gesture recognition system
 * and the sign language processor. It tests the full pipeline from gesture detection to
 * sign language recognition and fingerspelling.
 */

import { initializeGestureRecognition } from '../src/gesture/index.js';
import { SignLanguageProcessor } from '../src/personalization/hearing/sign-language-processor.js';
import { subscribe, publish } from '../src/core/events.js';
import { config as bridgeConfig } from '../src/personalization/hearing/sign-language-bridge.js';

// Test configuration
const TEST_CONFIG = {
  testDuration: 60000, // 60 seconds
  logInterval: 1000,   // Log stats every second
  detectionThreshold: 0.7
};

// Statistics
let stats = {
  gesturesDetected: 0,
  signsRecognized: 0,
  fingerspellingEvents: 0,
  lastGesture: null,
  lastSign: null,
  lastFingerspelling: null,
  startTime: 0
};

/**
 * Initialize the test
 */
async function initializeTest() {
  console.log('Initializing sign language integration test...');
  
  // Initialize gesture recognition
  await initializeGestureRecognition({
    useEnhancedRecognition: true,
    modelConfidence: TEST_CONFIG.detectionThreshold
  });
  
  console.log('Enhanced gesture recognition initialized');
  
  // Initialize sign language processor
  const signProcessor = new SignLanguageProcessor({
    language: 'asl',
    modelQuality: 'high'
  });
  
  await signProcessor.initialize();
  console.log('Sign language processor initialized');
  
  // Set up event listeners
  setupEventListeners();
  
  // Start the test
  startTest();
}

/**
 * Set up event listeners for the test
 */
function setupEventListeners() {
  // Listen for gesture events
  subscribe('gesture:detected', (data) => {
    stats.gesturesDetected++;
    stats.lastGesture = {
      id: data.gesture,
      confidence: data.confidence,
      timestamp: Date.now()
    };
    console.log(`Gesture detected: ${data.gesture} (${data.confidence.toFixed(2)})`);
  });
  
  // Listen for sign language events
  subscribe('sign_language:sign_recognized', (data) => {
    stats.signsRecognized++;
    stats.lastSign = {
      id: data.id,
      confidence: data.confidence,
      timestamp: Date.now()
    };
    console.log(`Sign recognized: ${data.id} (${data.confidence.toFixed(2)})`);
  });
  
  // Listen for fingerspelling events
  subscribe('sign_language:fingerspelling_completed', (data) => {
    stats.fingerspellingEvents++;
    stats.lastFingerspelling = {
      word: data.word,
      letters: data.letters,
      timestamp: Date.now()
    };
    console.log(`Fingerspelling completed: ${data.word}`);
  });
  
  // Listen for keyboard events to control the test
  document.addEventListener('keydown', (event) => {
    switch(event.key) {
      case 'Escape':
        endTest();
        break;
      case 't':
        toggleBridgeConfig();
        break;
      case 'd':
        printDebugInfo();
        break;
    }
  });
}

/**
 * Start the test
 */
function startTest() {
  stats.startTime = Date.now();
  console.log('Test started. Press ESC to end, T to toggle bridge config, D for debug info');
  
  // Start sign language recognition
  publish('sign_language:start_recognition', {});
  
  // Set up interval to log stats
  const statsInterval = setInterval(() => {
    const elapsedTime = (Date.now() - stats.startTime) / 1000;
    console.log(`
    === Test Stats (${elapsedTime.toFixed(0)}s) ===
    Gestures detected: ${stats.gesturesDetected}
    Signs recognized: ${stats.signsRecognized}
    Fingerspelling events: ${stats.fingerspellingEvents}
    `);
  }, TEST_CONFIG.logInterval);
  
  // Set timeout to end test
  setTimeout(() => {
    clearInterval(statsInterval);
    endTest();
  }, TEST_CONFIG.testDuration);
}

/**
 * End the test
 */
function endTest() {
  const elapsedTime = (Date.now() - stats.startTime) / 1000;
  
  console.log(`
  === Test Completed (${elapsedTime.toFixed(0)}s) ===
  Gestures detected: ${stats.gesturesDetected}
  Signs recognized: ${stats.signsRecognized}
  Fingerspelling events: ${stats.fingerspellingEvents}
  
  Gesture detection rate: ${(stats.gesturesDetected / elapsedTime).toFixed(2)}/s
  Sign recognition rate: ${(stats.signsRecognized / elapsedTime).toFixed(2)}/s
  `);
  
  // Stop sign language recognition
  publish('sign_language:stop_recognition', {});
  
  console.log('Test ended');
}

/**
 * Toggle bridge configuration
 */
function toggleBridgeConfig() {
  bridgeConfig.useEnhancedRecognition = !bridgeConfig.useEnhancedRecognition;
  console.log(`Enhanced recognition ${bridgeConfig.useEnhancedRecognition ? 'enabled' : 'disabled'}`);
  
  // Update the bridge configuration
  publish('sign_language:update_config', {
    useEnhancedRecognition: bridgeConfig.useEnhancedRecognition
  });
}

/**
 * Print debug information
 */
function printDebugInfo() {
  console.log(`
  === Debug Information ===
  Bridge config: ${JSON.stringify(bridgeConfig, null, 2)}
  Last gesture: ${JSON.stringify(stats.lastGesture, null, 2)}
  Last sign: ${JSON.stringify(stats.lastSign, null, 2)}
  Last fingerspelling: ${JSON.stringify(stats.lastFingerspelling, null, 2)}
  `);
}

// Start the test when the page loads
window.addEventListener('DOMContentLoaded', initializeTest);

// Export for testing
export { stats, TEST_CONFIG };
