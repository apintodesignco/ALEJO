/**
 * ALEJO Comprehensive Test Runner
 * 
 * This script runs all ALEJO test suites to validate the entire system,
 * with special focus on the core initialization, resource allocation,
 * and accessibility integration.
 * 
 * Usage:
 * - Run in browser: Open tests/run-comprehensive-tests.html
 * - Run in Node.js: node tests/run-comprehensive-tests.js
 */

import { runTests as runInitializationTests } from './core/test-initialization.js';
import { runTests as runResourceAccessibilityTests } from './core/test-resource-accessibility-integration.js';
import { runTests as runErrorFallbackTests } from './core/test-error-fallback-scenarios.js';
import testAriaManager from './accessibility/test-aria-manager.js';

// Add imports for other test suites as they are created
// import { runTests as runVoiceTests } from './personalization/voice/test-voice-system.js';
// import { runTests as runGestureTests } from './personalization/gesture/test-gesture-system.js';

// Test suite registry
const TEST_SUITES = [
  { 
    name: 'Core Initialization', 
    runner: runInitializationTests,
    category: 'core',
    priority: 10
  },
  { 
    name: 'Resource & Accessibility Integration', 
    runner: runResourceAccessibilityTests,
    category: 'core',
    priority: 9
  },
  { 
    name: 'Error Handling & Fallback Scenarios', 
    runner: runErrorFallbackTests,
    category: 'core',
    priority: 8
  },
  {
    name: 'ARIA Manager Tests',
    runner: testAriaManager,
    category: 'accessibility',
    priority: 9
  },
  // Add other test suites here
];

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: TEST_SUITES.length,
  suiteResults: []
};

// Console styling for browser and Node environments
const consoleStyles = {
  reset: typeof window !== 'undefined' ? '' : '\x1b[0m',
  bright: typeof window !== 'undefined' ? '' : '\x1b[1m',
  dim: typeof window !== 'undefined' ? '' : '\x1b[2m',
  red: typeof window !== 'undefined' ? '' : '\x1b[31m',
  green: typeof window !== 'undefined' ? '' : '\x1b[32m',
  yellow: typeof window !== 'undefined' ? '' : '\x1b[33m',
  blue: typeof window !== 'undefined' ? '' : '\x1b[34m',
  magenta: typeof window !== 'undefined' ? '' : '\x1b[35m',
  cyan: typeof window !== 'undefined' ? '' : '\x1b[36m'
};

/**
 * Run all test suites in order of priority
 * @param {Object} options - Test run options
 * @param {Array<string>} options.categories - Categories to run (all if empty)
 * @param {Array<string>} options.suiteNames - Specific suites to run (all if empty)
 * @param {boolean} options.stopOnFailure - Whether to stop on first failure
 * @returns {Promise<Object>} - Test results
 */
export async function runAllTests(options = {}) {
  const {
    categories = [],
    suiteNames = [],
    stopOnFailure = false
  } = options;
  
  console.log(`${consoleStyles.bright}${consoleStyles.cyan}=== ALEJO COMPREHENSIVE TEST SUITE ===${consoleStyles.reset}`);
  console.log(`${consoleStyles.dim}Starting test run at: ${new Date().toISOString()}${consoleStyles.reset}`);
  console.log(`${consoleStyles.dim}Test suites: ${TEST_SUITES.length}${consoleStyles.reset}`);
  
  // Filter test suites based on options
  const suitesToRun = TEST_SUITES
    .filter(suite => {
      if (categories.length > 0 && !categories.includes(suite.category)) {
        return false;
      }
      if (suiteNames.length > 0 && !suiteNames.includes(suite.name)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
  
  console.log(`${consoleStyles.dim}Running ${suitesToRun.length} of ${TEST_SUITES.length} test suites${consoleStyles.reset}`);
  console.log('');
  
  // Run each test suite
  for (const suite of suitesToRun) {
    try {
      console.log(`${consoleStyles.bright}${consoleStyles.blue}Running Test Suite: ${suite.name}${consoleStyles.reset}`);
      console.log(`${consoleStyles.dim}Category: ${suite.category}, Priority: ${suite.priority}${consoleStyles.reset}`);
      console.log(`${consoleStyles.dim}----------------------------------------${consoleStyles.reset}`);
      
      const startTime = performance.now();
      await suite.runner();
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      // For now, we're assuming success if no exception is thrown
      // In a more sophisticated system, the runner would return detailed results
      console.log(`${consoleStyles.green}✓ Test suite completed successfully in ${duration}s${consoleStyles.reset}`);
      
      testResults.passed++;
      testResults.suiteResults.push({
        name: suite.name,
        status: 'passed',
        duration: parseFloat(duration)
      });
    } catch (error) {
      console.error(`${consoleStyles.red}✗ Test suite failed: ${error.message}${consoleStyles.reset}`);
      console.error(error);
      
      testResults.failed++;
      testResults.suiteResults.push({
        name: suite.name,
        status: 'failed',
        error: error.message
      });
      
      if (stopOnFailure) {
        console.log(`${consoleStyles.yellow}Stopping test run due to failure${consoleStyles.reset}`);
        break;
      }
    }
    
    console.log(''); // Add spacing between suites
  }
  
  // Print summary
  console.log(`${consoleStyles.bright}${consoleStyles.cyan}=== TEST SUMMARY ===${consoleStyles.reset}`);
  console.log(`${consoleStyles.green}Passed: ${testResults.passed}${consoleStyles.reset}`);
  console.log(`${consoleStyles.red}Failed: ${testResults.failed}${consoleStyles.reset}`);
  console.log(`${consoleStyles.yellow}Skipped: ${TEST_SUITES.length - suitesToRun.length}${consoleStyles.reset}`);
  console.log(`${consoleStyles.bright}Total: ${TEST_SUITES.length}${consoleStyles.reset}`);
  
  return testResults;
}

// If running directly (not imported)
if (typeof window !== 'undefined') {
  // Browser environment
  document.addEventListener('DOMContentLoaded', () => {
    const runButton = document.getElementById('run-tests-button');
    if (runButton) {
      runButton.addEventListener('click', () => {
        runAllTests();
      });
    } else {
      // Auto-run if no button is found
      setTimeout(() => runAllTests(), 500);
    }
  });
} else {
  // Node.js environment
  runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

// Export for use in other modules
export { TEST_SUITES };
