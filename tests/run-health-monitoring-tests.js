/**
 * @file run-health-monitoring-tests.js
 * @description Test runner for health monitoring system tests
 */

import { runAllTests } from './health-monitoring-test.js';

// Utility function to format test results
function formatResults(results) {
  console.log('\n=======================================');
  console.log('   HEALTH MONITORING TESTS SUMMARY     ');
  console.log('=======================================\n');
  
  const { passed, failed, total } = results;
  
  console.log(`Tests run: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failures.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.name}`);
      console.log(`   Error: ${failure.error}`);
    });
    console.log('\n');
  } else {
    console.log('\n✅ ALL TESTS PASSED\n');
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  quick: args.includes('--quick') || args.includes('-q')
};

// Run tests
console.log('Starting health monitoring system tests...');
console.log('Options:', options);

if (options.quick) {
  console.log('Running in quick mode (skipping performance tests)');
}

if (options.verbose) {
  console.log('Running in verbose mode (showing detailed logs)');
}

runAllTests(options)
  .then(results => {
    formatResults(results);
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
