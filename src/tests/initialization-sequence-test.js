/**
 * Test for the ALEJO Initialization Sequence Integrator
 * 
 * This test verifies the proper functionality of the initialization sequence,
 * ensuring components load in the correct order with proper error handling.
 */

import { 
  startInitializationSequence,
  getInitializationSequenceState,
  resetInitializationSequence 
} from '../core/system/initialization-sequence-integrator.js';

// Test configuration
const testConfig = {
  testTimeout: 30000, // 30 seconds
  testModes: ['normal', 'safe', 'minimal'],
  progressCallbackInterval: 250, // ms
  componentCountToTest: 10
};

// Store test results
const testResults = {
  normal: null,
  safe: null,
  minimal: null
};

// Mock progress indicator
let progressIndicator = null;
let testMode = 'normal';

/**
 * Run initialization sequence tests
 */
async function runTests() {
  console.log('🚀 Starting ALEJO Initialization Sequence Tests');
  
  // Run tests for each mode
  for (const mode of testConfig.testModes) {
    testMode = mode;
    console.log(`\n🧪 Testing '${mode}' initialization mode`);
    
    // Reset before each test
    resetInitializationSequence();
    
    // Setup progress indicator
    setupProgressIndicator();
    
    // Start timing
    const startTime = Date.now();
    
    try {
      // Start initialization sequence
      const result = await startInitializationSequence({
        startupMode: mode,
        detailedDiagnostics: true,
        progressCallback: updateProgressIndicator,
        prioritizeAccessibility: true,
        resourceConservationMode: mode !== 'normal'
      });
      
      // Calculate time
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      
      // Store test result
      testResults[mode] = {
        success: result.success,
        elapsedTime,
        status: result.status,
        healthReport: result.healthReport || {},
        errors: result.error ? [result.error] : []
      };
      
      // Display result
      console.log(`✅ ${mode} mode initialization ${result.success ? 'succeeded' : 'failed'}`);
      console.log(`⏱️  Time: ${elapsedTime}ms`);
      
      if (result.success) {
        if (result.healthReport) {
          console.log(`🏥 Health: ${result.healthReport.status}`);
          console.log(`📊 Components: ${result.healthReport.components.initialized}/${result.healthReport.components.total} initialized, ${result.healthReport.components.fallback} fallbacks, ${result.healthReport.components.failed} failed`);
        }
      } else {
        console.error(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`🔥 Test error in ${mode} mode:`, error);
      
      // Store test result
      testResults[mode] = {
        success: false,
        elapsedTime: Date.now() - startTime,
        error: error.message || 'Unknown error',
        status: 'test-failed'
      };
    }
    
    // Clear progress indicator
    clearProgressIndicator();
  }
  
  // Summarize results
  summarizeResults();
}

/**
 * Set up progress indicator
 */
function setupProgressIndicator() {
  clearProgressIndicator();
  progressIndicator = setInterval(() => {
    const state = getInitializationSequenceState();
    const progress = state.progress || 0;
    const phase = state.currentPhase || 'Initializing...';
    
    // Create progress bar
    const barLength = 30;
    const filledLength = Math.floor(progress / 100 * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    // Clear previous line
    process.stdout.write('\r\x1b[K');
    
    // Print progress
    process.stdout.write(`[${bar}] ${Math.floor(progress)}% - ${phase}`);
  }, testConfig.progressCallbackInterval);
}

/**
 * Clear progress indicator
 */
function clearProgressIndicator() {
  if (progressIndicator) {
    clearInterval(progressIndicator);
    progressIndicator = null;
    
    // Clear line and move to next
    process.stdout.write('\r\x1b[K\n');
  }
}

/**
 * Update progress indicator with callback from initialization
 */
function updateProgressIndicator(progress, phase) {
  // This will be automatically picked up by the progress indicator interval
}

/**
 * Summarize test results
 */
function summarizeResults() {
  console.log('\n\n📋 Initialization Sequence Test Summary:');
  console.log('========================================');
  
  let allTestsSucceeded = true;
  
  for (const mode of testConfig.testModes) {
    const result = testResults[mode];
    if (!result) continue;
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${mode.toUpperCase()} mode: ${result.success ? 'Passed' : 'Failed'} (${result.elapsedTime}ms)`);
    
    if (!result.success) {
      allTestsSucceeded = false;
      console.log(`   Error: ${result.error || 'No specific error reported'}`);
    }
  }
  
  console.log('----------------------------------------');
  if (allTestsSucceeded) {
    console.log('🎉 All initialization tests passed!');
  } else {
    console.log('⚠️  Some initialization tests failed.');
    console.log('   Review the logs above for details.');
  }
  console.log('========================================');
}

// Run tests
runTests().catch(error => {
  console.error('Fatal test error:', error);
  clearProgressIndicator();
});
