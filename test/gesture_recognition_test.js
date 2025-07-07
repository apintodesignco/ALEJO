/**
 * ALEJO Enhanced Gesture Recognition Test
 * 
 * This script tests the integration of the enhanced gesture recognition system
 * with ALEJO's event-driven architecture.
 */

import { initializeGesture, showGestureTraining, getGestureSystemState } from '../src/gesture/index.js';
import { subscribe, publish } from '../src/core/events.js';

// Configuration
const TEST_DURATION = 60000; // 1 minute test by default

// Track detected gestures
const detectedGestures = new Set();
let gestureCount = 0;

// Set up event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Listen for gesture detection events
  subscribe('gesture:detected', (data) => {
    console.log(`Gesture detected: ${data.gesture} (confidence: ${data.confidence.toFixed(2)})`);
    detectedGestures.add(data.gesture);
    gestureCount++;
    
    // Show stats in console
    if (gestureCount % 5 === 0) {
      showStats();
    }
  });
  
  // Listen for gesture updates
  subscribe('gesture:update', (data) => {
    console.log(`Gesture update: ${data.gesture} (progress: ${data.progress.toFixed(2)})`);
  });
  
  // Listen for gesture end events
  subscribe('gesture:end', (data) => {
    console.log(`Gesture ended: ${data.gesture} (duration: ${data.duration}ms)`);
  });
  
  // Listen for status updates
  subscribe('gesture:status', (data) => {
    console.log(`Gesture system status: ${data.state} - ${data.message}`);
  });
  
  // Listen for training events
  subscribe('gesture:training:status', (data) => {
    console.log(`Training status: ${data.state} - ${data.message}`);
  });
}

// Show current statistics
function showStats() {
  console.log('\n--- GESTURE RECOGNITION STATS ---');
  console.log(`Total gestures detected: ${gestureCount}`);
  console.log(`Unique gestures detected: ${detectedGestures.size}`);
  console.log(`Detected gesture types: ${Array.from(detectedGestures).join(', ')}`);
  console.log('--------------------------------\n');
}

// Main test function
async function runTest() {
  console.log('Starting ALEJO Enhanced Gesture Recognition Test');
  
  // Set up event listeners
  setupEventListeners();
  
  try {
    // Initialize the gesture system
    console.log('Initializing gesture system...');
    const initResult = await initializeGesture();
    
    if (!initResult.success) {
      console.error(`Failed to initialize gesture system: ${initResult.error}`);
      return;
    }
    
    // Get system state
    const state = getGestureSystemState();
    console.log('Gesture system state:', state);
    
    // If enhanced recognition is active, show additional options
    if (state.enhancedRecognition) {
      console.log('\nEnhanced gesture recognition is active!');
      console.log('Press T to open the training interface');
      console.log('Press C to toggle between static and dynamic gesture recognition');
      console.log('Press S to save the current gesture model');
      console.log('Press Q to quit the test');
      
      // Set up keyboard controls
      process.stdin.setRawMode(true);
      process.stdin.on('data', (key) => {
        const keyPressed = key.toString().toLowerCase();
        
        if (keyPressed === 't') {
          console.log('Opening gesture training interface...');
          showGestureTraining();
        } else if (keyPressed === 'c') {
          console.log('Toggling gesture recognition mode...');
          publish('gesture:config', { dynamicGesturesEnabled: 'toggle' });
        } else if (keyPressed === 's') {
          console.log('Saving current gesture model...');
          publish('gesture:model:save', {});
        } else if (keyPressed === 'q') {
          console.log('Quitting test...');
          process.exit(0);
        }
      });
    }
    
    // Run the test for the specified duration
    console.log(`\nRunning test for ${TEST_DURATION / 1000} seconds...`);
    console.log('Please perform various hand gestures in front of the camera');
    
    // Set a timeout to end the test
    setTimeout(() => {
      console.log('\nTest completed!');
      showStats();
      process.exit(0);
    }, TEST_DURATION);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
runTest();
