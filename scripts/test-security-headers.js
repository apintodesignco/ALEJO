/**
 * ALEJO Security Headers Test Utility
 * 
 * This script tests the security headers configuration by making a request to
 * the development server and checking the headers in the response.
 * 
 * Usage:
 *   node scripts/test-security-headers.js [url]
 * 
 * If no URL is provided, it defaults to http://localhost:3000
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const targetUrl = process.argv[2] || 'http://localhost:3000';

console.log(chalk.blue(`Testing security headers for: ${targetUrl}`));

// Expected security headers
const expectedHeaders = {
  'content-security-policy': { required: true, label: 'Content-Security-Policy' },
  'strict-transport-security': { required: false, label: 'Strict-Transport-Security' }, // Optional in dev
  'x-content-type-options': { required: true, label: 'X-Content-Type-Options' },
  'x-frame-options': { required: true, label: 'X-Frame-Options' },
  'x-xss-protection': { required: true, label: 'X-XSS-Protection' },
  'referrer-policy': { required: true, label: 'Referrer-Policy' },
  'permissions-policy': { required: true, label: 'Permissions-Policy' }
};

async function testHeaders() {
  try {
    const response = await fetch(targetUrl);
    console.log(chalk.green(`✓ Connected to ${targetUrl} (Status: ${response.status})`));
    
    const headers = response.headers;
    let missingRequired = false;
    
    // Check each expected header
    for (const [headerKey, headerInfo] of Object.entries(expectedHeaders)) {
      const headerValue = headers.get(headerKey);
      
      if (headerValue) {
        console.log(chalk.green(`✓ ${headerInfo.label}: ${headerValue}`));
      } else if (headerInfo.required) {
        console.log(chalk.red(`✗ Missing required header: ${headerInfo.label}`));
        missingRequired = true;
      } else {
        console.log(chalk.yellow(`! Optional header not found: ${headerInfo.label}`));
      }
    }
    
    // Check for CSP directives
    const csp = headers.get('content-security-policy');
    if (csp) {
      console.log(chalk.blue('\nAnalyzing Content-Security-Policy:'));
      const directives = csp.split(';').map(d => d.trim());
      
      for (const directive of directives) {
        console.log(`  ${directive}`);
      }
      
      // Check for unsafe directives
      if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
        console.log(chalk.yellow("\n! Warning: CSP contains unsafe directives ('unsafe-inline' or 'unsafe-eval')"));
        console.log(chalk.yellow("  This is acceptable in development but should be avoided in production."));
      }
    }
    
    // Summary
    console.log(chalk.blue('\nSummary:'));
    if (missingRequired) {
      console.log(chalk.red('✗ Some required security headers are missing!'));
    } else {
      console.log(chalk.green('✓ All required security headers are present.'));
    }
    
    // Recommendations
    console.log(chalk.blue('\nRecommendations:'));
    console.log('- Verify header values match your security requirements');
    console.log('- Use online tools like securityheaders.com for additional validation');
    console.log('- Ensure production environment has all headers properly configured');
    
  } catch (error) {
    console.error(chalk.red(`Error connecting to ${targetUrl}:`));
    console.error(error);
  }
}

testHeaders();
