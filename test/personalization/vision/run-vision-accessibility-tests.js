#!/usr/bin/env node
/**
 * ALEJO Vision Accessibility Test Runner
 * 
 * This script runs automated tests for ALEJO's vision accessibility features.
 * It provides comprehensive testing for:
 * 1. Screen reader compatibility
 * 2. High contrast mode functionality
 * 3. Text zoom and scaling
 * 4. Color blindness adaptations
 * 5. Focus indicators and keyboard navigation
 * 
 * Usage:
 *   node run-vision-accessibility-tests.js [options]
 * 
 * Options:
 *   --headless       Run tests without showing browser UI
 *   --report-format  Format for test reports (html, json, junit)
 *   --report-dir     Directory for test reports
 *   --components     Specific components to test (comma separated)
 *   --debug          Enable debug mode with verbose output
 */

import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from 'child_process';
import express from 'express';
import axe from '@axe-core/puppeteer';
import { createHtmlReport } from 'axe-html-reporter';
import { createServer } from 'http';
import chalk from 'chalk';

// Fallback for chalk if not available
const chalkFallback = { green: (text) => text, red: (text) => text, yellow: (text) => text, blue: (text) => text };
const log = chalk || chalkFallback;
const ROOT_DIR = path.resolve(__dirname, '../../../');

// Define CLI options
const argv = yargs(hideBin(process.argv))
  .option('headless', {
    type: 'boolean',
    default: true,
    describe: 'Run tests headlessly'
  })
  .option('report-format', {
    type: 'string',
    choices: ['html', 'json', 'junit'],
    default: 'html',
    describe: 'Format for test reports'
  })
  .option('report-dir', {
    type: 'string',
    default: path.join(ROOT_DIR, 'test-reports/vision-accessibility'),
    describe: 'Directory for test reports'
  })
  .option('components', {
    type: 'string',
    describe: 'Specific components to test (comma separated)'
  })
  .option('debug', {
    type: 'boolean',
    default: false,
    describe: 'Enable debug mode'
  })
  .option('server-port', {
    type: 'number',
    default: 3030,
    describe: 'Port for test server'
  })
  .option('delay', {
    type: 'number',
    default: 500,
    describe: 'Delay in ms between test actions'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Ensure report directory exists
if (!fs.existsSync(argv.reportDir)) {
  fs.mkdirSync(argv.reportDir, { recursive: true });
}

// Define test components
const allComponents = [
  'high-contrast-mode',
  'screen-reader-support',
  'focus-indicators',
  'text-scaling',
  'color-blindness-filters',
  'keyboard-navigation',
  'adaptive-feature-manager',
  'settings-panel'
];

// Parse components to test
const componentsToTest = argv.components ? 
  argv.components.split(',').map(c => c.trim()) : 
  allComponents;

// Log configuration
if (argv.debug) {
  console.log(log.blue('Test Configuration:'));
  console.log('- Headless:', argv.headless);
  console.log('- Report Format:', argv.reportFormat);
  console.log('- Report Directory:', argv.reportDir);
  console.log('- Components to test:', componentsToTest);
  console.log('- Server Port:', argv.serverPort);
}

/**
 * Start the test server
 * @returns {Promise<{server: object, url: string}>}
 */
async function startTestServer() {
  const app = express();
  
  // Serve static files from the project root
  app.use(express.static(ROOT_DIR));
  
  // Add special route for test fixtures
  app.use('/test-fixtures', express.static(path.join(__dirname, 'fixtures')));
  
  // Special route for vision test page
  app.get('/vision-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'fixtures', 'vision-test.html'));
  });
  
  // Create the server
  const server = createServer(app);
  
  // Start the server
  return new Promise((resolve) => {
    server.listen(argv.serverPort, () => {
      const url = `http://localhost:${argv.serverPort}`;
      console.log(log.green(`Test server started at ${url}`));
      resolve({ server, url });
    });
  });
}

/**
 * Create test report
 * @param {Object} results - Test results
 * @param {string} componentName - Name of component being tested
 */
function createReport(results, componentName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportName = `vision-accessibility-${componentName}-${timestamp}`;
  
  switch (argv.reportFormat) {
    case 'html':
      const reportFilePath = path.join(argv.reportDir, `${reportName}.html`);
      const htmlReport = createHtmlReport({
        results,
        options: {
          reportFileName: reportFilePath,
          doNotCreateReportFile: false
        }
      });
      console.log(log.green(`HTML report created at: ${reportFilePath}`));
      break;
    case 'json':
      const jsonFilePath = path.join(argv.reportDir, `${reportName}.json`);
      fs.writeFileSync(jsonFilePath, JSON.stringify(results, null, 2));
      console.log(log.green(`JSON report created at: ${jsonFilePath}`));
      break;
    case 'junit':
      const junitFilePath = path.join(argv.reportDir, `${reportName}.xml`);
      // Convert aXe results to JUnit format - this would need more implementation
      console.log(log.yellow(`JUnit reports not fully implemented yet. JSON report created instead.`));
      fs.writeFileSync(path.join(argv.reportDir, `${reportName}.json`), JSON.stringify(results, null, 2));
      break;
    default:
      console.log(log.yellow(`Unknown report format: ${argv.reportFormat}, saving as JSON`));
      fs.writeFileSync(path.join(argv.reportDir, `${reportName}.json`), JSON.stringify(results, null, 2));
  }
}

/**
 * Run accessibility tests for a specific component
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} baseUrl - Base URL for tests
 * @param {string} component - Component name to test
 * @returns {Promise<boolean>} - Test result (pass/fail)
 */
async function testComponent(browser, baseUrl, component) {
  console.log(log.blue(`\nTesting component: ${component}`));
  
  // Different test strategy based on component
  try {
    const page = await browser.newPage();
    
    // Enable console log collection for debugging
    if (argv.debug) {
      page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
    }
    
    // Configure viewport for testing
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to appropriate test page based on component
    let testUrl;
    let scriptToInject;
    let postTestActions;
    
    switch (component) {
      case 'high-contrast-mode':
        testUrl = `${baseUrl}/vision-test?feature=high-contrast`;
        scriptToInject = `
          // Test enabling high contrast mode
          const manager = window.adaptiveFeatureManager || {};
          if (manager.toggleFeature) {
            manager.toggleFeature('highContrast', true, true);
          } else {
            document.documentElement.classList.add('alejo-high-contrast');
          }
        `;
        postTestActions = async () => {
          // Take screenshot of high contrast mode
          await page.screenshot({ 
            path: path.join(argv.reportDir, `${component}-screenshot.png`),
            fullPage: true 
          });
          
          // Test contrast ratios
          await page.evaluate(() => {
            // Check if high-contrast is applied correctly
            const body = document.body;
            const bodyStyles = window.getComputedStyle(body);
            const backgroundColor = bodyStyles.backgroundColor;
            const foregroundColor = bodyStyles.color;
            
            console.log(`Background: ${backgroundColor}, Foreground: ${foregroundColor}`);
            
            // Highlight potential issues
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;
              const fg = style.color;
              // Simple contrast check (a complete implementation would be more sophisticated)
              if (bg === 'rgba(0, 0, 0, 0)' || fg === 'rgba(0, 0, 0, 0)') {
                // Skip transparent elements
                return;
              }
              
              // Mark potential contrast issues
              if (bg === fg || (bg.includes('255, 255, 255') && fg.includes('255, 255, 255'))) {
                el.setAttribute('data-contrast-issue', 'true');
              }
            });
            
            return {
              backgroundColor,
              foregroundColor,
              issuesDetected: document.querySelectorAll('[data-contrast-issue]').length
            };
          });
        };
        break;
        
      case 'screen-reader-support':
        testUrl = `${baseUrl}/vision-test?feature=screen-reader`;
        scriptToInject = `
          // Test screen reader support
          // This simulates checking for appropriate ARIA roles and labels
          function checkAriaSupport() {
            const issues = [];
            const elements = document.querySelectorAll('button, a, input, select, textarea');
            
            elements.forEach(el => {
              // Check for missing labels on interactive elements
              if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
                if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.labels.length) {
                  issues.push({
                    element: el.tagName.toLowerCase(),
                    issue: 'Missing accessible label'
                  });
                }
              }
              
              // Check for missing roles
              if (el.tagName.toLowerCase() === 'a' && !el.hasAttribute('role') && !el.hasAttribute('href')) {
                issues.push({
                  element: el.tagName.toLowerCase(),
                  issue: 'Anchor without href should have role'
                });
              }
              
              // Check for missing alt text on images
              if (el.tagName.toLowerCase() === 'img' && !el.hasAttribute('alt')) {
                issues.push({
                  element: el.tagName.toLowerCase(),
                  issue: 'Image missing alt text'
                });
              }
            });
            
            return issues;
          }
          
          window.ariaCheckResult = checkAriaSupport();
        `;
        postTestActions = async () => {
          // Get ARIA check results
          const ariaIssues = await page.evaluate(() => window.ariaCheckResult);
          if (ariaIssues && ariaIssues.length > 0) {
            console.log(log.yellow(`Found ${ariaIssues.length} ARIA issues`));
            console.table(ariaIssues);
          } else {
            console.log(log.green('No ARIA issues detected'));
          }
        };
        break;
        
      case 'focus-indicators':
        testUrl = `${baseUrl}/vision-test?feature=focus`;
        scriptToInject = `
          // Test focus indicators
          // Simulate tabbing through interface and checking focus visibility
          function checkFocusVisibility() {
            const issues = [];
            const focusableElements = Array.from(document.querySelectorAll(
              'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
            ));
            
            // Store original element styles
            const originalStyles = focusableElements.map(el => ({
              element: el,
              outlineStyle: window.getComputedStyle(el).outlineStyle,
              outlineWidth: window.getComputedStyle(el).outlineWidth,
              outlineColor: window.getComputedStyle(el).outlineColor
            }));
            
            // Simulate focus on each element and check if there's a visible indicator
            focusableElements.forEach((el, index) => {
              el.focus();
              
              const focusedStyle = window.getComputedStyle(el);
              const hasVisibleOutline = 
                focusedStyle.outlineStyle !== 'none' && 
                focusedStyle.outlineWidth !== '0px';
              
              const hasFocusClass = el.classList.contains('focus') || 
                                    el.classList.contains('focused') ||
                                    el.classList.contains('has-focus');
                                    
              if (!hasVisibleOutline && !hasFocusClass) {
                issues.push({
                  element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
                  issue: 'No visible focus indicator'
                });
              }
            });
            
            return issues;
          }
          
          window.focusCheckResult = checkFocusVisibility();
        `;
        postTestActions = async () => {
          // Get focus check results
          const focusIssues = await page.evaluate(() => window.focusCheckResult);
          if (focusIssues && focusIssues.length > 0) {
            console.log(log.yellow(`Found ${focusIssues.length} focus indicator issues`));
            console.table(focusIssues);
          } else {
            console.log(log.green('No focus indicator issues detected'));
          }
        };
        break;
        
      // Additional components would have similar implementation
      default:
        testUrl = `${baseUrl}/vision-test`;
        scriptToInject = '';
        postTestActions = async () => {};
    }
    
    // Navigate to test page
    await page.goto(testUrl, { waitUntil: 'networkidle0' });
    
    // Execute component-specific test script
    if (scriptToInject) {
      await page.evaluate(scriptToInject);
    }
    
    // Allow time for any animations or changes to complete
    await page.waitForTimeout(argv.delay);
    
    // Run axe accessibility tests
    const results = await axe.analyze(page);
    
    // Log results
    console.log(log.green(`Tests completed for ${component}`));
    console.log(`Passes: ${results.passes.length}`);
    console.log(`Violations: ${results.violations.length}`);
    
    // Generate detailed report
    createReport(results, component);
    
    // Run post-test actions
    if (postTestActions) {
      await postTestActions();
    }
    
    // Close page
    await page.close();
    
    // Return test result status
    return results.violations.length === 0;
  } catch (error) {
    console.error(log.red(`Error testing component ${component}:`), error);
    return false;
  }
}

/**
 * Main test execution function
 */
async function runTests() {
  console.log(log.green('=== ALEJO Vision Accessibility Tests ==='));
  console.log(`Testing ${componentsToTest.length} components: ${componentsToTest.join(', ')}`);
  
  let server;
  let browser;
  let testResults = {};
  
  try {
    // Start test server
    const serverInfo = await startTestServer();
    server = serverInfo.server;
    const baseUrl = serverInfo.url;
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: argv.headless ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    // Run tests for each component
    for (const component of componentsToTest) {
      testResults[component] = await testComponent(browser, baseUrl, component);
    }
    
    // Log summary results
    console.log(log.blue('\n=== Test Results Summary ==='));
    const passingTests = Object.values(testResults).filter(result => result).length;
    const totalTests = componentsToTest.length;
    
    console.log(`${passingTests}/${totalTests} components passed`);
    
    // Log detailed results
    console.table(Object.keys(testResults).map(component => ({
      Component: component,
      Status: testResults[component] ? '✅ PASS' : '❌ FAIL'
    })));
    
    // Create summary report
    const summaryPath = path.join(argv.reportDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalComponents: totalTests,
      passingComponents: passingTests,
      componentResults: testResults,
    }, null, 2));
    
    console.log(log.green(`\nTest summary written to: ${summaryPath}`));
    
    // Exit with appropriate status code
    process.exitCode = passingTests === totalTests ? 0 : 1;
  } catch (error) {
    console.error(log.red('Test execution failed:'), error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    if (browser) await browser.close();
    if (server) server.close();
    
    console.log(log.green('\n=== Vision Accessibility Tests Completed ==='));
  }
}

// Run the tests
runTests();
