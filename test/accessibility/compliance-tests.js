/**
 * @file compliance-tests.js
 * @description Accessibility compliance tests for ALEJO against WCAG standards
 * @copyright ALEJO AI Assistant (c) 2025
 */

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { createHtmlReport } = require('axe-html-reporter');

// Test configuration
const config = {
  testPages: [
    { name: 'Main Interface', path: '/index.html' },
    { name: 'Training UI', path: '/training.html' },
    { name: 'Visual Feedback System', path: '/accessibility/visual-feedback.html' },
    { name: 'Visual Communication System', path: '/accessibility/visual-communication.html' },
    { name: 'Sign Language Interface', path: '/accessibility/sign-language.html' }
  ],
  reportDir: path.join(__dirname, '../../reports/accessibility-compliance'),
  serverPort: 3000,
  staticDir: path.join(__dirname, '../../demo'),
  axeConfig: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
    }
  }
};

// Ensure report directory exists
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

// Start a local server to serve test pages
async function startServer() {
  const app = express();
  app.use(express.static(config.staticDir));
  
  // Special route for testing visual feedback system
  app.get('/accessibility/visual-feedback.html', (req, res) => {
    res.sendFile(path.join(config.staticDir, 'accessibility-test-pages/visual-feedback.html'));
  });
  
  // Special route for testing visual communication system
  app.get('/accessibility/visual-communication.html', (req, res) => {
    res.sendFile(path.join(config.staticDir, 'accessibility-test-pages/visual-communication.html'));
  });
  
  // Special route for testing sign language interface
  app.get('/accessibility/sign-language.html', (req, res) => {
    res.sendFile(path.join(config.staticDir, 'accessibility-test-pages/sign-language.html'));
  });
  
  return new Promise((resolve) => {
    const server = app.listen(config.serverPort, () => {
      console.log(`Test server started on port ${config.serverPort}`);
      resolve(server);
    });
  });
}

// Run axe accessibility tests on a page
async function runAccessibilityTests(page, pageName) {
  console.log(`Testing ${pageName}...`);
  
  // Run axe on the page
  const results = await new AxePuppeteer(page)
    .configure(config.axeConfig)
    .analyze();
  
  // Save raw results
  const resultsPath = path.join(config.reportDir, `${pageName.replace(/\s+/g, '-').toLowerCase()}-results.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  // Generate HTML report
  const reportPath = path.join(config.reportDir, `${pageName.replace(/\s+/g, '-').toLowerCase()}-report.html`);
  createHtmlReport({
    results,
    options: {
      outputDir: config.reportDir,
      reportFileName: `${pageName.replace(/\s+/g, '-').toLowerCase()}-report.html`
    }
  });
  
  // Log summary
  console.log(`${pageName} Results:`);
  console.log(`- Violations: ${results.violations.length}`);
  console.log(`- Passes: ${results.passes.length}`);
  console.log(`- Incomplete: ${results.incomplete.length}`);
  console.log(`- Inapplicable: ${results.inapplicable.length}`);
  
  return {
    pageName,
    violations: results.violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length
  };
}

// Test specific accessibility features
async function testAccessibilityFeatures(page, pageName) {
  const featureTests = [];
  
  // Test ARIA attributes
  await page.evaluate(() => {
    const ariaElements = document.querySelectorAll('[aria-live], [role="alert"], [aria-atomic], [aria-relevant]');
    return Array.from(ariaElements).map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      ariaLive: el.getAttribute('aria-live'),
      role: el.getAttribute('role'),
      ariaAtomic: el.getAttribute('aria-atomic'),
      ariaRelevant: el.getAttribute('aria-relevant')
    }));
  }).then(ariaElements => {
    featureTests.push({
      name: 'ARIA Live Regions',
      passed: ariaElements.length > 0,
      details: `Found ${ariaElements.length} elements with ARIA live region attributes`
    });
  });
  
  // Test keyboard navigation
  await page.evaluate(() => {
    const focusableElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return focusableElements.length;
  }).then(count => {
    featureTests.push({
      name: 'Keyboard Navigation',
      passed: count > 0,
      details: `Found ${count} focusable elements for keyboard navigation`
    });
  });
  
  // Test color contrast (simplified check)
  await page.evaluate(() => {
    const styles = Array.from(document.querySelectorAll('*')).map(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor
      };
    });
    
    // Very simplified contrast check - just checking if there are non-default colors
    const hasCustomColors = styles.some(style => 
      style.color !== 'rgb(0, 0, 0)' && style.backgroundColor !== 'rgba(0, 0, 0, 0)');
    
    return hasCustomColors;
  }).then(hasCustomColors => {
    featureTests.push({
      name: 'Color Usage',
      passed: hasCustomColors,
      details: hasCustomColors ? 'Custom colors detected' : 'No custom colors detected'
    });
  });
  
  // Additional tests for specific pages
  if (pageName === 'Visual Feedback System') {
    // Test visual notifications
    await page.evaluate(() => {
      const notifications = document.querySelectorAll('.alejo-visual-notification, .alejo-visual-alert');
      return notifications.length;
    }).then(count => {
      featureTests.push({
        name: 'Visual Notifications',
        passed: count > 0,
        details: `Found ${count} visual notification elements`
      });
    });
  }
  
  if (pageName === 'Visual Communication System') {
    // Test captions
    await page.evaluate(() => {
      const captions = document.querySelectorAll('.alejo-caption, .alejo-caption-container');
      return captions.length;
    }).then(count => {
      featureTests.push({
        name: 'Caption System',
        passed: count > 0,
        details: `Found ${count} caption elements`
      });
    });
  }
  
  if (pageName === 'Sign Language Interface') {
    // Test sign language elements
    await page.evaluate(() => {
      const signElements = document.querySelectorAll('.alejo-sign-avatar, .alejo-sign-container');
      return signElements.length;
    }).then(count => {
      featureTests.push({
        name: 'Sign Language Elements',
        passed: count > 0,
        details: `Found ${count} sign language interface elements`
      });
    });
  }
  
  // Save feature test results
  const featureResultsPath = path.join(config.reportDir, `${pageName.replace(/\s+/g, '-').toLowerCase()}-features.json`);
  fs.writeFileSync(featureResultsPath, JSON.stringify(featureTests, null, 2));
  
  return featureTests;
}

// Generate a summary report
function generateSummaryReport(results) {
  const summaryPath = path.join(config.reportDir, 'summary-report.html');
  
  // Calculate totals
  const totalViolations = results.reduce((sum, page) => sum + page.axeResults.violations.length, 0);
  const totalPasses = results.reduce((sum, page) => sum + page.axeResults.passes, 0);
  const featureTestsPassed = results.reduce((sum, page) => 
    sum + page.featureTests.filter(test => test.passed).length, 0);
  const featureTestsTotal = results.reduce((sum, page) => sum + page.featureTests.length, 0);
  
  // Generate HTML
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALEJO Accessibility Compliance Summary</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
      h1, h2, h3 { color: #333; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
      tr:nth-child(even) { background-color: #f9f9f9; }
      .summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
      .summary-box { border: 1px solid #ddd; padding: 15px; flex: 1; margin: 0 10px; text-align: center; }
      .violations { color: #d9534f; }
      .passes { color: #5cb85c; }
      .warnings { color: #f0ad4e; }
      .feature-tests { color: #5bc0de; }
    </style>
  </head>
  <body>
    <h1>ALEJO Accessibility Compliance Summary</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="summary-box violations">
        <h2>${totalViolations}</h2>
        <p>WCAG Violations</p>
      </div>
      <div class="summary-box passes">
        <h2>${totalPasses}</h2>
        <p>WCAG Passes</p>
      </div>
      <div class="summary-box feature-tests">
        <h2>${featureTestsPassed} / ${featureTestsTotal}</h2>
        <p>Feature Tests Passed</p>
      </div>
    </div>
    
    <h2>Page Results</h2>
    <table>
      <tr>
        <th>Page</th>
        <th>Violations</th>
        <th>Passes</th>
        <th>Feature Tests</th>
        <th>Report</th>
      </tr>
      ${results.map(page => `
        <tr>
          <td>${page.pageName}</td>
          <td class="violations">${page.axeResults.violations.length}</td>
          <td class="passes">${page.axeResults.passes}</td>
          <td>${page.featureTests.filter(t => t.passed).length} / ${page.featureTests.length}</td>
          <td><a href="./${page.pageName.replace(/\s+/g, '-').toLowerCase()}-report.html">View Report</a></td>
        </tr>
      `).join('')}
    </table>
    
    <h2>Violation Summary</h2>
    <table>
      <tr>
        <th>Page</th>
        <th>Impact</th>
        <th>Description</th>
        <th>WCAG Criteria</th>
      </tr>
      ${results.flatMap(page => 
        page.axeResults.violations.map(violation => `
          <tr>
            <td>${page.pageName}</td>
            <td>${violation.impact}</td>
            <td>${violation.description}</td>
            <td>${violation.tags.filter(tag => tag.startsWith('wcag')).join(', ')}</td>
          </tr>
        `)
      ).join('')}
    </table>
    
    <h2>Feature Tests</h2>
    <table>
      <tr>
        <th>Page</th>
        <th>Feature</th>
        <th>Status</th>
        <th>Details</th>
      </tr>
      ${results.flatMap(page => 
        page.featureTests.map(test => `
          <tr>
            <td>${page.pageName}</td>
            <td>${test.name}</td>
            <td>${test.passed ? '<span class="passes">Pass</span>' : '<span class="violations">Fail</span>'}</td>
            <td>${test.details}</td>
          </tr>
        `)
      ).join('')}
    </table>
  </body>
  </html>
  `;
  
  fs.writeFileSync(summaryPath, html);
  console.log(`Summary report generated at: ${summaryPath}`);
}

// Main test function
async function runTests() {
  let server;
  let browser;
  
  try {
    // Start server
    server = await startServer();
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const results = [];
    
    // Test each page
    for (const testPage of config.testPages) {
      const page = await browser.newPage();
      await page.setBypassCSP(true);
      
      // Navigate to the page
      const url = `http://localhost:${config.serverPort}${testPage.path}`;
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Run axe tests
      const axeResults = await runAccessibilityTests(page, testPage.name);
      
      // Run feature-specific tests
      const featureTests = await testAccessibilityFeatures(page, testPage.name);
      
      results.push({
        pageName: testPage.name,
        axeResults,
        featureTests
      });
      
      await page.close();
    }
    
    // Generate summary report
    generateSummaryReport(results);
    
    // Check if there are critical violations
    const criticalViolations = results.reduce((count, page) => {
      return count + page.axeResults.violations.filter(v => v.impact === 'critical').length;
    }, 0);
    
    if (criticalViolations > 0) {
      console.error(`❌ Found ${criticalViolations} critical accessibility violations!`);
      process.exitCode = 1;
    } else {
      console.log('✅ No critical accessibility violations found.');
      process.exitCode = 0;
    }
    
  } catch (error) {
    console.error('Error running accessibility tests:', error);
    process.exitCode = 1;
  } finally {
    // Clean up
    if (browser) await browser.close();
    if (server) server.close();
  }
}

// Run the tests
runTests();
