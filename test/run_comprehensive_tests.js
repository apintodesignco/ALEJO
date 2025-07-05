/**
 * @file run_comprehensive_tests.js
 * @description Comprehensive test orchestration for ALEJO
 * @copyright ALEJO AI Assistant (c) 2025
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('unit', {
    alias: 'u',
    type: 'boolean',
    description: 'Run unit tests',
    default: true
  })
  .option('integration', {
    alias: 'i',
    type: 'boolean',
    description: 'Run integration tests',
    default: true
  })
  .option('e2e', {
    alias: 'e',
    type: 'boolean',
    description: 'Run end-to-end tests',
    default: false
  })
  .option('accessibility', {
    alias: 'a',
    type: 'boolean',
    description: 'Run accessibility tests',
    default: true
  })
  .option('performance', {
    alias: 'p',
    type: 'boolean',
    description: 'Run performance tests',
    default: false
  })
  .option('security', {
    alias: 's',
    type: 'boolean',
    description: 'Run security tests',
    default: false
  })
  .option('module', {
    alias: 'm',
    type: 'string',
    description: 'Specific module to test (e.g., "hearing", "vision", "core")',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false
  })
  .option('report', {
    alias: 'r',
    type: 'boolean',
    description: 'Generate HTML reports',
    default: true
  })
  .help()
  .alias('help', 'h')
  .argv;

// Configuration
const config = {
  rootDir: path.resolve(__dirname, '..'),
  reportDir: path.resolve(__dirname, '../reports'),
  testModules: {
    core: {
      unit: ['test/core/**/*.test.js'],
      integration: ['test/integration/core/**/*.test.js'],
      e2e: ['test/e2e/core/**/*.test.js']
    },
    hearing: {
      unit: ['test/personalization/hearing/**/*.test.js'],
      integration: ['test/integration/hearing/**/*.test.js'],
      e2e: ['test/e2e/hearing/**/*.test.js'],
      accessibility: ['test/accessibility/hearing/**/*.test.js', 'test/personalization/hearing/run-hearing-accessibility-tests.js']
    },
    vision: {
      unit: ['test/personalization/vision/**/*.test.js'],
      integration: ['test/integration/vision/**/*.test.js'],
      e2e: ['test/e2e/vision/**/*.test.js'],
      accessibility: ['test/accessibility/vision/**/*.test.js', 'test/personalization/vision/run-vision-accessibility-tests.js']
    },
    security: {
      unit: ['test/security/**/*.test.js'],
      integration: ['test/integration/security/**/*.test.js']
    },
    performance: {
      tests: ['test/performance/**/*.test.js']
    }
  },
  accessibilityTests: ['test/accessibility/compliance-tests.js']
};

// Ensure report directory exists
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  modules: {}
};

// Helper function to run a command
async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: argv.verbose ? 'inherit' : 'pipe',
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    if (!argv.verbose && proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }
    
    if (!argv.verbose && proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        if (!argv.verbose) {
          console.error(stderr);
        }
        reject({ code, stdout, stderr });
      }
    });
  });
}

// Run mocha tests
async function runMochaTests(testFiles, reportName) {
  const args = [
    '--require', '@babel/register',
    '--timeout', '10000',
    '--colors'
  ];
  
  if (argv.report) {
    args.push('--reporter', 'mochawesome');
    args.push('--reporter-options', `reportDir=${config.reportDir},reportFilename=${reportName}`);
  }
  
  // Add test files
  args.push(...testFiles);
  
  try {
    const result = await runCommand('mocha', args, { cwd: config.rootDir });
    return { success: true, result };
  } catch (error) {
    return { success: false, error };
  }
}

// Run node script
async function runNodeScript(scriptPath) {
  try {
    const result = await runCommand('node', [scriptPath], { cwd: config.rootDir });
    return { success: true, result };
  } catch (error) {
    return { success: false, error };
  }
}

// Run accessibility tests
async function runAccessibilityTests() {
  console.log('\n🔍 Running Accessibility Tests...');
  
  // Run compliance tests
  if (config.accessibilityTests.length > 0) {
    for (const testScript of config.accessibilityTests) {
      const scriptPath = path.resolve(config.rootDir, testScript);
      if (fs.existsSync(scriptPath)) {
        console.log(`Running ${testScript}...`);
        const result = await runNodeScript(scriptPath);
        
        if (result.success) {
          console.log(`✅ Accessibility compliance tests completed successfully`);
          testResults.passed++;
        } else {
          console.error(`❌ Accessibility compliance tests failed`);
          testResults.failed++;
        }
      }
    }
  }
  
  // Run module-specific accessibility tests
  const modules = argv.module ? [argv.module] : Object.keys(config.testModules);
  
  for (const moduleName of modules) {
    if (config.testModules[moduleName]?.accessibility) {
      const testFiles = config.testModules[moduleName].accessibility;
      
      for (const testFile of testFiles) {
        const scriptPath = path.resolve(config.rootDir, testFile);
        if (fs.existsSync(scriptPath)) {
          console.log(`Running ${testFile}...`);
          const result = await runNodeScript(scriptPath);
          
          if (result.success) {
            console.log(`✅ ${moduleName} accessibility tests completed successfully`);
            testResults.passed++;
          } else {
            console.error(`❌ ${moduleName} accessibility tests failed`);
            testResults.failed++;
          }
        }
      }
    }
  }
}

// Run performance tests
async function runPerformanceTests() {
  console.log('\n⚡ Running Performance Tests...');
  
  const modules = argv.module ? [argv.module] : Object.keys(config.testModules);
  
  for (const moduleName of modules) {
    if (moduleName === 'performance' || config.testModules[moduleName]?.performance) {
      const testFiles = moduleName === 'performance' 
        ? config.testModules.performance.tests 
        : config.testModules[moduleName].performance;
      
      const reportName = `performance-${moduleName}-report`;
      console.log(`Running performance tests for ${moduleName}...`);
      
      const result = await runMochaTests(testFiles, reportName);
      
      if (result.success) {
        console.log(`✅ ${moduleName} performance tests completed successfully`);
        testResults.passed++;
      } else {
        console.error(`❌ ${moduleName} performance tests failed`);
        testResults.failed++;
      }
    }
  }
}

// Run security tests
async function runSecurityTests() {
  console.log('\n🔒 Running Security Tests...');
  
  // Run security module tests
  const testFiles = config.testModules.security.unit.concat(config.testModules.security.integration);
  const reportName = 'security-report';
  
  console.log('Running security tests...');
  const result = await runMochaTests(testFiles, reportName);
  
  if (result.success) {
    console.log(`✅ Security tests completed successfully`);
    testResults.passed++;
  } else {
    console.error(`❌ Security tests failed`);
    testResults.failed++;
  }
  
  // Run security scanning if available
  const securityScannerPath = path.resolve(config.rootDir, 'test/security/alejo_security_scanner.js');
  if (fs.existsSync(securityScannerPath)) {
    console.log('Running security scanner...');
    const scanResult = await runNodeScript(securityScannerPath);
    
    if (scanResult.success) {
      console.log(`✅ Security scanning completed successfully`);
      testResults.passed++;
    } else {
      console.error(`❌ Security scanning failed`);
      testResults.failed++;
    }
  }
}

// Run unit and integration tests
async function runUnitAndIntegrationTests() {
  const modules = argv.module ? [argv.module] : Object.keys(config.testModules);
  
  // Initialize module results
  for (const moduleName of modules) {
    testResults.modules[moduleName] = {
      unit: { passed: 0, failed: 0 },
      integration: { passed: 0, failed: 0 },
      e2e: { passed: 0, failed: 0 }
    };
  }
  
  // Run unit tests
  if (argv.unit) {
    console.log('\n🧪 Running Unit Tests...');
    
    for (const moduleName of modules) {
      if (config.testModules[moduleName]?.unit) {
        const testFiles = config.testModules[moduleName].unit;
        const reportName = `unit-${moduleName}-report`;
        
        console.log(`Running unit tests for ${moduleName}...`);
        const result = await runMochaTests(testFiles, reportName);
        
        if (result.success) {
          console.log(`✅ ${moduleName} unit tests completed successfully`);
          testResults.modules[moduleName].unit.passed++;
          testResults.passed++;
        } else {
          console.error(`❌ ${moduleName} unit tests failed`);
          testResults.modules[moduleName].unit.failed++;
          testResults.failed++;
        }
      }
    }
  }
  
  // Run integration tests
  if (argv.integration) {
    console.log('\n🔄 Running Integration Tests...');
    
    for (const moduleName of modules) {
      if (config.testModules[moduleName]?.integration) {
        const testFiles = config.testModules[moduleName].integration;
        const reportName = `integration-${moduleName}-report`;
        
        console.log(`Running integration tests for ${moduleName}...`);
        const result = await runMochaTests(testFiles, reportName);
        
        if (result.success) {
          console.log(`✅ ${moduleName} integration tests completed successfully`);
          testResults.modules[moduleName].integration.passed++;
          testResults.passed++;
        } else {
          console.error(`❌ ${moduleName} integration tests failed`);
          testResults.modules[moduleName].integration.failed++;
          testResults.failed++;
        }
      }
    }
  }
  
  // Run end-to-end tests
  if (argv.e2e) {
    console.log('\n🌐 Running End-to-End Tests...');
    
    for (const moduleName of modules) {
      if (config.testModules[moduleName]?.e2e) {
        const testFiles = config.testModules[moduleName].e2e;
        const reportName = `e2e-${moduleName}-report`;
        
        console.log(`Running E2E tests for ${moduleName}...`);
        const result = await runMochaTests(testFiles, reportName);
        
        if (result.success) {
          console.log(`✅ ${moduleName} E2E tests completed successfully`);
          testResults.modules[moduleName].e2e.passed++;
          testResults.passed++;
        } else {
          console.error(`❌ ${moduleName} E2E tests failed`);
          testResults.modules[moduleName].e2e.failed++;
          testResults.failed++;
        }
      }
    }
  }
}

// Generate summary report
function generateSummaryReport() {
  const reportPath = path.join(config.reportDir, 'test-summary.json');
  
  // Add timestamp
  testResults.timestamp = new Date().toISOString();
  testResults.total = testResults.passed + testResults.failed + testResults.skipped;
  
  // Write JSON report
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  
  // Generate HTML summary if requested
  if (argv.report) {
    const htmlReportPath = path.join(config.reportDir, 'test-summary.html');
    
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ALEJO Test Summary</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .summary-box { border: 1px solid #ddd; padding: 15px; flex: 1; margin: 0 10px; text-align: center; }
        .passed { color: #5cb85c; }
        .failed { color: #d9534f; }
        .skipped { color: #f0ad4e; }
      </style>
    </head>
    <body>
      <h1>ALEJO Test Summary</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
      
      <div class="summary">
        <div class="summary-box">
          <h2>${testResults.total}</h2>
          <p>Total Tests</p>
        </div>
        <div class="summary-box passed">
          <h2>${testResults.passed}</h2>
          <p>Passed</p>
        </div>
        <div class="summary-box failed">
          <h2>${testResults.failed}</h2>
          <p>Failed</p>
        </div>
        <div class="summary-box skipped">
          <h2>${testResults.skipped}</h2>
          <p>Skipped</p>
        </div>
      </div>
      
      <h2>Module Results</h2>
      <table>
        <tr>
          <th>Module</th>
          <th>Unit Tests</th>
          <th>Integration Tests</th>
          <th>E2E Tests</th>
        </tr>
        ${Object.entries(testResults.modules).map(([moduleName, results]) => `
          <tr>
            <td>${moduleName}</td>
            <td>
              ${results.unit.passed > 0 ? `<span class="passed">✓ ${results.unit.passed} passed</span>` : ''}
              ${results.unit.failed > 0 ? `<span class="failed">✗ ${results.unit.failed} failed</span>` : ''}
            </td>
            <td>
              ${results.integration.passed > 0 ? `<span class="passed">✓ ${results.integration.passed} passed</span>` : ''}
              ${results.integration.failed > 0 ? `<span class="failed">✗ ${results.integration.failed} failed</span>` : ''}
            </td>
            <td>
              ${results.e2e.passed > 0 ? `<span class="passed">✓ ${results.e2e.passed} passed</span>` : ''}
              ${results.e2e.failed > 0 ? `<span class="failed">✗ ${results.e2e.failed} failed</span>` : ''}
            </td>
          </tr>
        `).join('')}
      </table>
      
      <h2>Test Reports</h2>
      <ul>
        ${fs.readdirSync(config.reportDir)
          .filter(file => file.endsWith('.html') && file !== 'test-summary.html')
          .map(file => `<li><a href="./${file}">${file}</a></li>`)
          .join('')}
      </ul>
    </body>
    </html>
    `;
    
    fs.writeFileSync(htmlReportPath, html);
    console.log(`\nSummary report generated at: ${htmlReportPath}`);
  }
  
  // Print summary to console
  console.log('\n📊 Test Summary:');
  console.log(`Total: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Skipped: ${testResults.skipped}`);
}

// Main function
async function main() {
  console.log('🚀 Starting ALEJO Comprehensive Tests');
  console.log('====================================');
  
  try {
    // Run unit and integration tests
    await runUnitAndIntegrationTests();
    
    // Run accessibility tests if requested
    if (argv.accessibility) {
      await runAccessibilityTests();
    }
    
    // Run performance tests if requested
    if (argv.performance) {
      await runPerformanceTests();
    }
    
    // Run security tests if requested
    if (argv.security) {
      await runSecurityTests();
    }
    
    // Generate summary report
    generateSummaryReport();
    
    // Set exit code based on test results
    process.exitCode = testResults.failed > 0 ? 1 : 0;
    
  } catch (error) {
    console.error('Error running tests:', error);
    process.exitCode = 1;
  }
}

// Run the main function
main();
