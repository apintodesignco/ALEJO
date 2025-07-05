/**
 * @file run-hearing-accessibility-tests.js
 * @description Test runner for all hearing accessibility module tests
 * @copyright ALEJO AI Assistant (c) 2025
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');
const { createHtmlReport } = require('mocha-html-reporter');

// Configure Mocha
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 10000, // 10 seconds
  bail: false,     // Continue running tests even if one fails
  ui: 'bdd'
});

// Define the test directory
const testDir = path.join(__dirname);

// Add all test files
const testFiles = [
  'visual-feedback-system.test.js',
  'sign-language-processor.test.js',
  'visual-communication-system.test.js',
  'hearing-impairment-detection.test.js',
  'deaf-accessibility-helpers.test.js'
];

// Add each test file to mocha
testFiles.forEach(file => {
  mocha.addFile(path.join(testDir, file));
});

// Set up HTML report directory
const reportDir = path.join(__dirname, '../../../reports/hearing-accessibility');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Run the tests
console.log('Running hearing accessibility tests...');
console.log('-------------------------------------');

mocha.run(failures => {
  // Generate HTML report
  const reportPath = path.join(reportDir, 'hearing-accessibility-report.html');
  
  createHtmlReport({
    reportDir: reportDir,
    reportFilename: 'hearing-accessibility-report.html',
    pageTitle: 'ALEJO Hearing Accessibility Tests'
  });
  
  console.log(`\nTest report generated at: ${reportPath}`);
  
  // Exit with appropriate code
  process.exitCode = failures ? 1 : 0;
});
