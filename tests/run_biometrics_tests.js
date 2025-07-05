/**
 * ALEJO Biometrics Test Runner
 * 
 * This script runs all biometrics-related tests, including eye tracking,
 * face detection, and hand tracking tests. It integrates with the central
 * ALEJO testing system and provides detailed reporting.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { argv } = process;

// Create a batch script to run Node.js commands
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Create helper scripts for Node.js commands
const RUN_NODE_BATCH = path.join(TEMP_DIR, 'run_node.bat');
fs.writeFileSync(RUN_NODE_BATCH, '@echo off\r\n"C:\\Program Files\\nodejs\\node.exe" %*');

const RUN_NPX_BATCH = path.join(TEMP_DIR, 'run_npx.bat');
fs.writeFileSync(RUN_NPX_BATCH, '@echo off\r\n"C:\\Program Files\\nodejs\\npx.cmd" %*');

const RUN_NPM_BATCH = path.join(TEMP_DIR, 'run_npm.bat');
fs.writeFileSync(RUN_NPM_BATCH, '@echo off\r\n"C:\\Program Files\\nodejs\\npm.cmd" %*');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  const args = {};
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    }
  }
  
  return args;
}

const args = parseArguments();

// Configuration
const config = {
  testTypes: args.testTypes ? args.testTypes.split(',') : ['unit', 'integration', 'system'],
  components: args.component ? [args.component] : ['eye', 'face', 'hand', 'core'],
  reportDir: args.reportDir || path.join(__dirname, '../reports/biometrics'),
  timeoutMs: args.timeout ? parseInt(args.timeout) : 60000,
  securityScan: args.securityScan !== 'false',
  performanceBenchmark: args.performanceBenchmark !== 'false',
  coverageThreshold: args['coverage-threshold'] ? parseInt(args['coverage-threshold']) : 80
};

// Test definitions
const tests = {
  eye: {
    unit: ['eye-tracking-test.js'],
    integration: ['eye-tracking-integration-test.js', 'eye-tracking-system-test.js'],
    system: []
  },
  face: {
    unit: ['face-detection-test.js'],
    integration: ['face-recognition-test.js'],
    system: []
  },
  hand: {
    unit: ['hand-tracking-test.js'],
    integration: ['gesture-recognition-test.js'],
    system: []
  },
  core: {
    unit: ['biometrics-core-test.js'],
    integration: ['biometrics-integration-test.js'],
    system: ['biometrics-system-test.js']
  }
};

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  startTime: Date.now(),
  endTime: null,
  testResults: []
};

// Ensure report directory exists
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

/**
 * Run a test file with Mocha
 * @param {string} testType - Type of test (unit, integration, system)
 * @param {string} component - Component being tested
 * @param {string} testFile - Test file name
 * @returns {Promise<Object>} - Test result
 */
async function runTest(testType, component, testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testType, testFile);
    console.log(`\n[${component.toUpperCase()}] Running ${testType} test: ${testFile}`);
    
    const mochaArgs = [
      testPath,
      '--reporter', 'spec',
      '--timeout', config.timeoutMs.toString()
    ];
    
    if (config.coverageThreshold > 0) {
      mochaArgs.unshift('--coverage');
    }
    
    const testProcess = spawn(RUN_NPX_BATCH, ['mocha', ...mochaArgs], { 
      stdio: 'inherit',
      shell: true
    });
    
    testProcess.on('close', (code) => {
      const result = {
        component,
        testType,
        testFile,
        passed: code === 0,
        exitCode: code
      };
      
      if (code === 0) {
        console.log(`✅ [${component.toUpperCase()}] ${testFile} passed`);
        results.passed++;
      } else {
        console.error(`❌ [${component.toUpperCase()}] ${testFile} failed with code ${code}`);
        results.failed++;
      }
      
      results.total++;
      results.testResults.push(result);
      resolve(result);
    });
  });
}

/**
 * Run security scan on biometrics code
 * @returns {Promise<void>}
 */
async function runSecurityScan() {
  return new Promise((resolve) => {
    console.log('\n🔒 Running security scan on biometrics code...');
    
    const scanProcess = spawn(RUN_NODE_BATCH, [
      path.join(__dirname, '../tools/alejo_security_scanner.py'),
      '--module=biometrics',
      '--report-file=' + path.join(config.reportDir, 'security-report.json')
    ], { 
      stdio: 'inherit',
      shell: true
    });
    
    scanProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Security scan completed successfully');
      } else {
        console.error(`❌ Security scan failed with code ${code}`);
      }
      resolve();
    });
  });
}

/**
 * Run performance benchmark on biometrics code
 * @returns {Promise<void>}
 */
async function runPerformanceBenchmark() {
  return new Promise((resolve) => {
    console.log('\n⚡ Running performance benchmark on biometrics code...');
    
    const benchmarkProcess = spawn(RUN_NODE_BATCH, [
      path.join(__dirname, '../tools/alejo_performance_tester.py'),
      '--module=biometrics',
      '--report-file=' + path.join(config.reportDir, 'performance-report.json')
    ], { 
      stdio: 'inherit',
      shell: true
    });
    
    benchmarkProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Performance benchmark completed successfully');
      } else {
        console.error(`❌ Performance benchmark failed with code ${code}`);
      }
      resolve();
    });
  });
}

/**
 * Generate test report
 */
function generateReport() {
  results.endTime = Date.now();
  const duration = (results.endTime - results.startTime) / 1000;
  
  const report = {
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      duration,
      success: results.failed === 0,
      timestamp: new Date().toISOString()
    },
    config,
    results: results.testResults
  };
  
  const reportPath = path.join(config.reportDir, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n📊 Test Report:');
  console.log(`Total tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main function to run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting ALEJO Biometrics Test Suite');
  console.log('======================================');
  
  // Run all tests
  for (const testType of config.testTypes) {
    for (const component of config.components) {
      const componentTests = tests[component][testType] || [];
      for (const testFile of componentTests) {
        await runTest(testType, component, testFile);
      }
    }
  }
  
  // Run security scan if enabled
  if (config.securityScan) {
    await runSecurityScan();
  }
  
  // Run performance benchmark if enabled
  if (config.performanceBenchmark) {
    await runPerformanceBenchmark();
  }
  
  // Generate report
  const report = generateReport();
  
  // Exit with appropriate code
  process.exit(report.summary.success ? 0 : 1);
}

// Run all tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
