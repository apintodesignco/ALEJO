/**
 * @file performance-integration-test.js
 * @description Simple test script to verify the refactored performance integration implementations
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { initializePerformanceModule, RESOURCE_MODES } from '../performance/index.js';
import * as voiceIntegration from '../personalization/voice/performance-integration-refactored.js';
import * as accessibilityIntegration from '../personalization/accessibility/performance-integration-refactored.js';
import * as visionIntegration from '../personalization/vision/performance-integration-refactored.js';
import * as reasoningIntegration from '../reasoning/performance-integration-refactored.js';
import { subscribe } from '../core/events.js';

// Initialize the performance module
async function runTest() {
  console.log('Initializing performance module...');
  const performance = await initializePerformanceModule({
    debug: true,
    initialMode: RESOURCE_MODES.BALANCED
  });
  
  // Subscribe to configuration events to verify they're being published
  subscribe('voice:config', (config) => {
    console.log('Voice configuration updated:', config);
  });
  
  subscribe('accessibility:config', (config) => {
    console.log('Accessibility configuration updated:', config);
  });
  
  subscribe('vision:config', (config) => {
    console.log('Vision configuration updated:', config);
  });
  
  subscribe('reasoning:config', (config) => {
    console.log('Reasoning configuration updated:', config);
  });
  
  // Register all modules
  console.log('\nRegistering modules with Resource Allocation Manager...');
  await voiceIntegration.registerWithResourceManager();
  await accessibilityIntegration.registerWithResourceManager();
  await visionIntegration.registerWithResourceManager();
  await reasoningIntegration.registerWithResourceManager();
  
  // Get the resource manager
  const resourceManager = performance.getResourceAllocationManager();
  
  // Test changing resource modes
  console.log('\nTesting resource mode changes...');
  
  // Wait between mode changes
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Test each mode
  console.log('\nChanging to FULL mode...');
  await resourceManager.setMode(RESOURCE_MODES.FULL, 'test');
  await wait(1000);
  
  console.log('\nChanging to CONSERVATIVE mode...');
  await resourceManager.setMode(RESOURCE_MODES.CONSERVATIVE, 'test');
  await wait(1000);
  
  console.log('\nChanging to MINIMAL mode...');
  await resourceManager.setMode(RESOURCE_MODES.MINIMAL, 'test');
  await wait(1000);
  
  console.log('\nChanging back to BALANCED mode...');
  await resourceManager.setMode(RESOURCE_MODES.BALANCED, 'test');
  await wait(1000);
  
  // Unregister all modules
  console.log('\nUnregistering modules...');
  await voiceIntegration.unregisterFromResourceManager();
  await accessibilityIntegration.unregisterFromResourceManager();
  await visionIntegration.unregisterFromResourceManager();
  await reasoningIntegration.unregisterFromResourceManager();
  
  console.log('\nTest completed successfully!');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
});
